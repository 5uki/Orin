/**
 * Posts Routes
 *
 * Handles public post metadata endpoints.
 *
 * Routes:
 * - GET /api/posts/pinned - Get pinned posts (public)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { DatabaseQueries } from '../../db/queries';
import type { PostMetadata } from '@orin/shared/types';

/**
 * Create posts routes
 */
export function createPostsRoutes() {
  const posts = new Hono<{ Bindings: Env }>();

  /**
   * GET /api/posts/pinned
   * Get pinned posts (public)
   */
  posts.get('/pinned', async (c) => {
    const db = new DatabaseQueries(c.env.DB);
    const pinnedPosts = await db.postMetadata.getPinned();

    const response: { ok: true; data: PostMetadata[] } = {
      ok: true,
      data: pinnedPosts,
    };

    return c.json(response);
  });

  return posts;
}

export default createPostsRoutes;
