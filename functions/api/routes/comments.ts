/**
 * Comments Routes
 *
 * Handles comment retrieval and submission.
 *
 * Routes:
 * - GET /api/comments - Get approved comments for a post
 * - POST /api/comments - Submit a new comment
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createErrorResponse } from '../utils/error-response';
import { DatabaseQueries } from '../../db/queries';
import { buildCommentTree } from '../services/comment-tree';
import { sessionMiddleware, requireAuth, type SessionVariables } from '../middleware/session';
import { csrfMiddleware } from '../middleware/csrf';
import { commentRateLimitMiddleware } from '../middleware/rate-limit';
import { moderate } from '../services/moderation';
import { verifyTurnstileToken, isTurnstileRequired } from '../services/turnstile';
import { calculateTrustLevelFromDb } from '../services/trust-level';
import { GetCommentsSchema, CommentSubmitSchema } from '@orin/shared/validators';
import type { CommentListResponse, CommentSubmitResponse } from '@orin/shared/types';

/**
 * Create comments routes
 */
export function createCommentsRoutes() {
  const comments = new Hono<{
    Bindings: Env;
    Variables: SessionVariables;
  }>();

  // Apply session middleware to all routes
  comments.use('*', sessionMiddleware());

  /**
   * GET /api/comments
   * Get approved comments for a post
   */
  comments.get('/', async (c) => {
    // Parse and validate query params
    const query = c.req.query();
    const validation = GetCommentsSchema.safeParse(query);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        'INVALID_INPUT',
        validation.error.errors[0]?.message || '请求参数无效'
      );
      return c.json(errorResponse, 400);
    }

    const { post } = validation.data;

    // Get approved comments from database
    const db = new DatabaseQueries(c.env.DB);
    const commentsWithUser = await db.comments.getApprovedForPost(post);

    // Build comment tree
    const commentTree = buildCommentTree(commentsWithUser);

    const response: { ok: true; data: CommentListResponse } = {
      ok: true,
      data: {
        post,
        comments: commentTree,
      },
    };

    return c.json(response);
  });

  /**
   * POST /api/comments
   * Submit a new comment
   */
  comments.post('/', requireAuth(), csrfMiddleware(), commentRateLimitMiddleware(), async (c) => {
    const user = c.get('user')!;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      const errorResponse = createErrorResponse('INVALID_INPUT', '无效的JSON数据');
      return c.json(errorResponse, 400);
    }

    const validation = CommentSubmitSchema.safeParse(body);

    if (!validation.success) {
      const errorResponse = createErrorResponse(
        'INVALID_INPUT',
        validation.error.errors[0]?.message || '请求数据无效'
      );
      return c.json(errorResponse, 400);
    }

    const { post, parentId, content, turnstileToken } = validation.data;

    const db = new DatabaseQueries(c.env.DB);

    // Validate parent comment if provided (Requirements: 5.3)
    if (parentId !== undefined) {
      const parentValid = await db.comments.validateParent(parentId, post);
      if (!parentValid) {
        const errorResponse = createErrorResponse('INVALID_INPUT', '父评论不存在或属于其他文章');
        return c.json(errorResponse, 400);
      }
    }

    // Calculate user's trust level
    const approvedCount = await db.users.getApprovedCommentCount(user.id);
    const hasRecentRejections = await db.users.hasRecentRejections(user.id, 30);
    const trustLevel = calculateTrustLevelFromDb(
      approvedCount,
      hasRecentRejections,
      user.trustLevel
    );

    // Turnstile verification (Requirements: 5.6)
    const environment = c.env.ENVIRONMENT || 'development';
    if (isTurnstileRequired(environment, trustLevel)) {
      if (!turnstileToken) {
        const errorResponse = createErrorResponse('INVALID_INPUT', '需要进行人机验证');
        return c.json(errorResponse, 400);
      }

      const clientIp = c.req.header('CF-Connecting-IP');
      const turnstileResult = await verifyTurnstileToken(
        turnstileToken,
        c.env.TURNSTILE_SECRET_KEY,
        clientIp
      );

      if (!turnstileResult.success) {
        const errorResponse = createErrorResponse(
          'INVALID_INPUT',
          turnstileResult.errorMessage || '人机验证失败'
        );
        return c.json(errorResponse, 400);
      }
    }

    // Run moderation pipeline
    const moderationResult = await moderate(
      content,
      [], // TODO: Get recent contents for duplicate detection
      c.env.AI
    );

    // Get client metadata
    const userAgent = c.req.header('User-Agent');
    const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const ipHash = clientIp ? await hashIpAddress(clientIp) : undefined;

    // Create comment in database
    const comment = await db.comments.create({
      postSlug: post,
      parentId,
      userId: user.id,
      content,
      status: moderationResult.status,
      moderationSource: moderationResult.source,
      aiScore: moderationResult.aiScore,
      aiLabel: moderationResult.aiLabel,
      ruleScore: moderationResult.ruleScore,
      ruleFlags: moderationResult.ruleFlags,
      ipHash,
      userAgent,
    });

    const response: { ok: true; data: CommentSubmitResponse } = {
      ok: true,
      data: {
        commentId: comment.id,
        status: comment.status,
      },
    };

    return c.json(response, 201);
  });

  return comments;
}

/**
 * Hash IP address for privacy
 */
async function hashIpAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'orin-blog-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default createCommentsRoutes;
