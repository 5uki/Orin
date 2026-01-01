/**
 * Rate Limiting Middleware
 *
 * Implements user-based rate limiting for comment submissions.
 * Limits users to 3 comments per 60 seconds.
 */

import type { MiddlewareHandler } from 'hono';
import type { SessionVariables } from './session';
import { DatabaseQueries } from '../../db/queries';
import { createErrorResponse } from '../utils/error-response';

// Cloudflare environment bindings
interface Env {
  DB: D1Database;
  AI: Ai;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  ADMIN_GITHUB_IDS: string;
  TURNSTILE_SECRET_KEY: string;
  ENVIRONMENT: string;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
}

/**
 * Default rate limit configuration for comments
 */
export const COMMENT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 3,
  windowSeconds: 60,
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests made in current window */
  currentCount: number;
  /** Maximum requests allowed */
  maxRequests: number;
  /** Seconds until window resets */
  retryAfterSeconds: number;
}

/**
 * Check if a user has exceeded the rate limit for comments.
 *
 * @param db - Database queries instance
 * @param userId - User ID to check
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkCommentRateLimit(
  db: DatabaseQueries,
  userId: number,
  config: RateLimitConfig = COMMENT_RATE_LIMIT
): Promise<RateLimitResult> {
  const currentCount = await db.comments.countRecentByUser(userId, config.windowSeconds);

  const allowed = currentCount < config.maxRequests;

  return {
    allowed,
    currentCount,
    maxRequests: config.maxRequests,
    // If not allowed, suggest retry after full window
    retryAfterSeconds: allowed ? 0 : config.windowSeconds,
  };
}

/**
 * Rate limiting middleware for comment submissions.
 *
 * @param config - Optional rate limit configuration
 * @returns Hono middleware handler
 */
export function commentRateLimitMiddleware(
  config: RateLimitConfig = COMMENT_RATE_LIMIT
): MiddlewareHandler<{
  Bindings: Env;
  Variables: SessionVariables;
}> {
  return async (c, next) => {
    const user = c.get('user');

    // Rate limiting only applies to authenticated users
    if (!user) {
      // Let auth middleware handle unauthenticated requests
      await next();
      return;
    }

    const db = new DatabaseQueries(c.env.DB);
    const result = await checkCommentRateLimit(db, user.id, config);

    if (!result.allowed) {
      const errorResponse = createErrorResponse(
        'RATE_LIMITED',
        `评论过于频繁，请等待 ${result.retryAfterSeconds} 秒后再试。`
      );

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(result.maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(result.retryAfterSeconds));
      c.header('Retry-After', String(result.retryAfterSeconds));

      return c.json(errorResponse, 429);
    }

    // Set rate limit headers for successful requests
    c.header('X-RateLimit-Limit', String(result.maxRequests));
    c.header('X-RateLimit-Remaining', String(result.maxRequests - result.currentCount - 1));

    await next();
  };
}

/**
 * Pure function to determine if rate limit is exceeded.
 * Used for testing without database dependency.
 *
 * @param currentCount - Current number of requests in window
 * @param maxRequests - Maximum allowed requests
 * @returns true if rate limit is exceeded
 */
export function isRateLimitExceeded(currentCount: number, maxRequests: number): boolean {
  return currentCount >= maxRequests;
}

/**
 * Calculate remaining requests in the current window.
 *
 * @param currentCount - Current number of requests in window
 * @param maxRequests - Maximum allowed requests
 * @returns Number of remaining requests (minimum 0)
 */
export function calculateRemainingRequests(currentCount: number, maxRequests: number): number {
  return Math.max(0, maxRequests - currentCount);
}
