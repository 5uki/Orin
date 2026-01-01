/**
 * Unit tests for Database Query Layer
 *
 * Tests the query functions and data mapping logic
 */

import { describe, it, expect } from 'vitest';
import { buildCommentTree } from './queries';
import type { CommentWithUser } from '@orin/shared/types';

describe('Database Query Layer', () => {
  describe('buildCommentTree', () => {
    it('should build correct tree structure from flat comments', () => {
      const flatComments: CommentWithUser[] = [
        {
          id: 1,
          postSlug: 'test-post',
          userId: 1,
          content: 'Root comment 1',
          status: 'approved',
          ruleScore: 0,
          ruleFlags: [],
          isPinned: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          user: {
            githubLogin: 'user1',
            avatarUrl: 'https://github.com/user1.png',
            githubId: 'github1',
          },
        },
        {
          id: 2,
          postSlug: 'test-post',
          parentId: 1,
          userId: 2,
          content: 'Reply to comment 1',
          status: 'approved',
          ruleScore: 0,
          ruleFlags: [],
          isPinned: false,
          createdAt: '2024-01-01T01:00:00Z',
          updatedAt: '2024-01-01T01:00:00Z',
          user: {
            githubLogin: 'user2',
            avatarUrl: 'https://github.com/user2.png',
            githubId: 'github2',
          },
        },
        {
          id: 3,
          postSlug: 'test-post',
          userId: 3,
          content: 'Root comment 2',
          status: 'approved',
          ruleScore: 0,
          ruleFlags: [],
          isPinned: false,
          createdAt: '2024-01-01T02:00:00Z',
          updatedAt: '2024-01-01T02:00:00Z',
          user: {
            githubLogin: 'user3',
            avatarUrl: 'https://github.com/user3.png',
            githubId: 'github3',
          },
        },
        {
          id: 4,
          postSlug: 'test-post',
          parentId: 2,
          userId: 1,
          content: 'Reply to reply',
          status: 'approved',
          ruleScore: 0,
          ruleFlags: [],
          isPinned: false,
          createdAt: '2024-01-01T03:00:00Z',
          updatedAt: '2024-01-01T03:00:00Z',
          user: {
            githubLogin: 'user1',
            avatarUrl: 'https://github.com/user1.png',
            githubId: 'github1',
          },
        },
      ];

      const tree = buildCommentTree(flatComments);

      // Should have 2 root comments
      expect(tree).toHaveLength(2);

      // First root comment should have 1 child
      expect(tree[0].id).toBe(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe(2);

      // The child should have 1 child (nested reply)
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].id).toBe(4);

      // Second root comment should have no children
      expect(tree[1].id).toBe(3);
      expect(tree[1].children).toHaveLength(0);
    });

    it('should handle empty comment list', () => {
      const tree = buildCommentTree([]);
      expect(tree).toHaveLength(0);
    });

    it('should handle orphaned comments (parent not in list)', () => {
      const flatComments: CommentWithUser[] = [
        {
          id: 2,
          postSlug: 'test-post',
          parentId: 999, // Parent doesn't exist
          userId: 1,
          content: 'Orphaned comment',
          status: 'approved',
          ruleScore: 0,
          ruleFlags: [],
          isPinned: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          user: {
            githubLogin: 'user1',
            avatarUrl: 'https://github.com/user1.png',
            githubId: 'github1',
          },
        },
      ];

      const tree = buildCommentTree(flatComments);

      // Orphaned comment should become a root comment
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(2);
      expect(tree[0].children).toHaveLength(0);
    });

    it('should preserve all comment properties in tree nodes', () => {
      const flatComments: CommentWithUser[] = [
        {
          id: 1,
          postSlug: 'test-post',
          userId: 1,
          content: 'Test content',
          status: 'approved',
          moderationSource: 'ai',
          aiScore: 0.1,
          aiLabel: 'safe',
          ruleScore: 0,
          ruleFlags: ['test-flag'],
          isPinned: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          user: {
            githubLogin: 'testuser',
            avatarUrl: 'https://github.com/testuser.png',
            githubId: 'github123',
          },
        },
      ];

      const tree = buildCommentTree(flatComments);

      expect(tree[0]).toMatchObject({
        id: 1,
        postSlug: 'test-post',
        userId: 1,
        content: 'Test content',
        status: 'approved',
        moderationSource: 'ai',
        aiScore: 0.1,
        aiLabel: 'safe',
        ruleScore: 0,
        ruleFlags: ['test-flag'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        user: {
          githubLogin: 'testuser',
          avatarUrl: 'https://github.com/testuser.png',
          githubId: 'github123',
        },
        children: [],
      });
    });
  });
});
