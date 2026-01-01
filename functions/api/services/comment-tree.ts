/**
 * Comment Tree Service
 *
 * Handles building comment trees from flat lists and filtering by status.
 * Only returns approved comments in the tree structure.
 */

import type { CommentWithUser, CommentTree } from '@orin/shared/types';

/**
 * Build a comment tree from a flat list of comments.
 * Only includes comments with approved status.
 *
 * @param comments - Flat list of comments with user info
 * @returns Tree structure of approved comments
 */
export function buildCommentTree(comments: CommentWithUser[]): CommentTree[] {
  // Filter to only approved comments
  const approvedComments = filterApprovedComments(comments);

  const commentMap = new Map<number, CommentTree>();
  const rootComments: CommentTree[] = [];

  // First pass: create all comment nodes
  for (const comment of approvedComments) {
    const treeNode: CommentTree = {
      ...comment,
      children: [],
    };
    commentMap.set(comment.id, treeNode);
  }

  // Second pass: build the tree structure
  for (const comment of approvedComments) {
    const treeNode = commentMap.get(comment.id)!;

    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Parent not found (maybe not approved), treat as root comment
        rootComments.push(treeNode);
      }
    } else {
      rootComments.push(treeNode);
    }
  }

  return rootComments;
}

/**
 * Filter comments to only include approved ones.
 *
 * @param comments - List of comments to filter
 * @returns Only approved comments
 */
export function filterApprovedComments(comments: CommentWithUser[]): CommentWithUser[] {
  return comments.filter((comment) => comment.status === 'approved');
}

/**
 * Check if a comment tree only contains approved comments.
 * Used for validation/testing purposes.
 *
 * @param tree - Comment tree to validate
 * @returns true if all comments in tree are approved
 */
export function validateTreeOnlyApproved(tree: CommentTree[]): boolean {
  for (const node of tree) {
    if (node.status !== 'approved') {
      return false;
    }
    if (!validateTreeOnlyApproved(node.children)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate that parent-child relationships in the tree are correct.
 * Each child's parentId should match its parent's id.
 *
 * @param tree - Comment tree to validate
 * @param expectedParentId - Expected parent ID (undefined for root)
 * @returns true if all relationships are valid
 */
export function validateTreeRelationships(tree: CommentTree[], expectedParentId?: number): boolean {
  for (const node of tree) {
    // Root nodes should have no parentId or parentId matching expected
    if (expectedParentId === undefined) {
      // For root nodes, parentId should be undefined OR parent not in tree
      // (orphaned comments become roots)
    } else {
      // For non-root nodes, parentId should match expected
      if (node.parentId !== expectedParentId) {
        return false;
      }
    }

    // Recursively validate children
    if (!validateTreeRelationships(node.children, node.id)) {
      return false;
    }
  }
  return true;
}

/**
 * Count total comments in a tree (including nested children).
 *
 * @param tree - Comment tree to count
 * @returns Total number of comments
 */
export function countTreeComments(tree: CommentTree[]): number {
  let count = 0;
  for (const node of tree) {
    count += 1 + countTreeComments(node.children);
  }
  return count;
}

/**
 * Flatten a comment tree back to a list.
 * Useful for testing round-trip properties.
 *
 * @param tree - Comment tree to flatten
 * @returns Flat list of comments
 */
export function flattenCommentTree(tree: CommentTree[]): CommentWithUser[] {
  const result: CommentWithUser[] = [];

  function traverse(nodes: CommentTree[]) {
    for (const node of nodes) {
      // Extract CommentWithUser without children
      const { children, ...comment } = node;
      result.push(comment);
      traverse(children);
    }
  }

  traverse(tree);
  return result;
}
