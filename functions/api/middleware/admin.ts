/**
 * Admin Permission Middleware
 *
 * Validates that the current user is an admin based on ADMIN_GITHUB_IDS whitelist.
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index';
import type { SessionVariables } from './session';
import { createErrorResponse } from '../utils/error-response';

/**
 * Parse ADMIN_GITHUB_IDS environment variable into an array
 * Format: comma-separated list of GitHub IDs
 */
export function parseAdminGithubIds(adminGithubIdsEnv: string | undefined): string[] {
  if (!adminGithubIdsEnv) {
    return [];
  }
  return adminGithubIdsEnv
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Check if a GitHub ID is in the admin whitelist
 */
export function isAdminGithubId(githubId: string, adminGithubIds: string[]): boolean {
  return adminGithubIds.includes(githubId);
}

/**
 * Require admin permission middleware
 * Returns 401 if not authenticated, 403 if not admin
 */
export function requireAdmin(): MiddlewareHandler<{
  Bindings: Env;
  Variables: SessionVariables;
}> {
  return async (c, next) => {
    const session = c.get('session');
    const user = c.get('user');

    // Check authentication first
    if (!session || !user) {
      return c.json(createErrorResponse('UNAUTHORIZED', '需要登录'), 401);
    }

    // Check if session has admin flag
    if (!session.isAdmin) {
      return c.json(createErrorResponse('FORBIDDEN', '需要管理员权限'), 403);
    }

    // Double-check against whitelist for extra security
    const adminGithubIds = parseAdminGithubIds(c.env.ADMIN_GITHUB_IDS);
    if (!isAdminGithubId(user.githubId, adminGithubIds)) {
      return c.json(createErrorResponse('FORBIDDEN', '需要管理员权限'), 403);
    }

    await next();
  };
}
