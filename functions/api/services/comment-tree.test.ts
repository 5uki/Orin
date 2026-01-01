/**
 * Property-based tests for Comment Tree Service
 *
 * Tests Property: Comment Tree Filtering
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { CommentWithUser, CommentStatus } from '@orin/shared/types';
import {
  buildCommentTree,
  filterApprovedComments,
  validateTreeOnlyApproved,
  countTreeComments,
  flattenCommentTree,
} from './comment-tree';

/**
 * Arbitrary generator for CommentWithUser
 */
const commentStatusArb = fc.constantFrom<CommentStatus>(
  'pending',
  'approved',
  'rejected',
  'deleted'
);

const commentWithUserArb = (id: number, parentId?: number): fc.Arbitrary<CommentWithUser> =>
  fc.record({
    id: fc.constant(id),
    postSlug: fc.constant('test-post'),
    parentId: fc.constant(parentId),
    userId: fc.integer({ min: 1, max: 1000 }),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    status: commentStatusArb,
    ruleScore: fc.integer({ min: 0, max: 10 }),
    ruleFlags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
    isPinned: fc.boolean(),
    createdAt: fc.constant('2024-01-01T00:00:00Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00Z'),
    user: fc.record({
      githubLogin: fc.string({ minLength: 1, maxLength: 20 }),
      avatarUrl: fc.constant('https://github.com/user.png'),
      githubId: fc.string({ minLength: 1, maxLength: 20 }),
    }),
  });

/**
 * Generate a flat list of comments with sequential IDs
 */
const commentsListArb: fc.Arbitrary<CommentWithUser[]> = fc
  .array(commentStatusArb, { minLength: 0, maxLength: 20 })
  .chain((statuses) => {
    const arbitraries = statuses.map((status, index) => {
      const id = index + 1;
      // Randomly assign parent (either no parent or one of previous comments)
      const parentIdArb =
        index === 0
          ? fc.constant(undefined)
          : fc.oneof(
              fc.constant(undefined),
              fc.integer({ min: 1, max: index }).map((pid) => pid)
            );

      return parentIdArb.chain((parentId) =>
        commentWithUserArb(id, parentId).map((comment) => ({
          ...comment,
          status,
        }))
      );
    });

    return arbitraries.length === 0
      ? fc.constant([] as CommentWithUser[])
      : fc
          .tuple(
            ...(arbitraries as [fc.Arbitrary<CommentWithUser>, ...fc.Arbitrary<CommentWithUser>[]])
          )
          .map((arr) => arr as CommentWithUser[]);
  });

describe('Comment Tree Service Properties', () => {
  /**
   * Property Test: Comment Tree Filtering
   * For any comment query, the returned tree SHALL only contain comments
   * with status=approved, and the tree structure SHALL correctly reflect
   * parent-child relationships.
   */
  describe('Property: Comment Tree Filtering', () => {
    it('should only include approved comments in the tree', () => {
      fc.assert(
        fc.property(commentsListArb, (comments) => {
          const tree = buildCommentTree(comments);

          // All comments in tree must be approved
          expect(validateTreeOnlyApproved(tree)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should filter out all non-approved comments', () => {
      fc.assert(
        fc.property(commentsListArb, (comments) => {
          const tree = buildCommentTree(comments);
          const approvedCount = comments.filter((c) => c.status === 'approved').length;
          const treeCount = countTreeComments(tree);

          // Tree should contain exactly the number of approved comments
          expect(treeCount).toBe(approvedCount);
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve comment data when building tree', () => {
      fc.assert(
        fc.property(commentsListArb, (comments) => {
          const tree = buildCommentTree(comments);
          const flattenedTree = flattenCommentTree(tree);
          const approvedComments = filterApprovedComments(comments);

          // All approved comments should be in the flattened tree
          for (const approved of approvedComments) {
            const found = flattenedTree.find((c) => c.id === approved.id);
            expect(found).toBeDefined();
            expect(found?.content).toBe(approved.content);
            expect(found?.userId).toBe(approved.userId);
            expect(found?.status).toBe('approved');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty comment list', () => {
      fc.assert(
        fc.property(fc.constant([] as CommentWithUser[]), (comments) => {
          const tree = buildCommentTree(comments);
          expect(tree).toHaveLength(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle all non-approved comments', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .constantFrom<CommentStatus>('pending', 'rejected', 'deleted')
              .chain((status) => commentWithUserArb(1, undefined).map((c) => ({ ...c, status }))),
            { minLength: 1, maxLength: 10 }
          ),
          (comments) => {
            // Ensure unique IDs
            const commentsWithIds = comments.map((c, i) => ({ ...c, id: i + 1 }));
            const tree = buildCommentTree(commentsWithIds);

            // Tree should be empty when no approved comments
            expect(tree).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly build parent-child relationships', () => {
      fc.assert(
        fc.property(commentsListArb, (comments) => {
          const tree = buildCommentTree(comments);

          // Verify each child's parentId matches its parent's id
          function verifyRelationships(nodes: typeof tree, _parentId?: number): boolean {
            for (const node of nodes) {
              // Children should have correct parentId
              for (const child of node.children) {
                if (child.parentId !== node.id) {
                  return false;
                }
              }
              // Recursively verify
              if (!verifyRelationships(node.children, node.id)) {
                return false;
              }
            }
            return true;
          }

          expect(verifyRelationships(tree)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should treat orphaned comments as root comments', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1000, max: 9999 }), // Non-existent parent ID
          (id, orphanParentId) => {
            const orphanComment: CommentWithUser = {
              id,
              postSlug: 'test-post',
              parentId: orphanParentId,
              userId: 1,
              content: 'Orphan comment',
              status: 'approved',
              ruleScore: 0,
              ruleFlags: [],
              isPinned: false,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              user: {
                githubLogin: 'user',
                avatarUrl: 'https://github.com/user.png',
                githubId: 'github123',
              },
            };

            const tree = buildCommentTree([orphanComment]);

            // Orphan should become a root comment
            expect(tree).toHaveLength(1);
            expect(tree[0].id).toBe(id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
