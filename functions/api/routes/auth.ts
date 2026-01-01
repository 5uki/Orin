/**
 * Authentication Routes
 *
 * Handles GitHub OAuth login flow, logout, and current user info.
 *
 * Routes:
 * - GET /api/auth/github/start - Start OAuth flow
 * - GET /api/auth/github/callback - OAuth callback
 * - POST /api/auth/logout - Logout
 * - GET /api/auth/me - Get current user
 */

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../index';
import { createErrorResponse } from '../utils/error-response';
import { DatabaseQueries } from '../../db/queries';
import {
  generateOAuthState,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  serializeOAuthState,
  deserializeOAuthState,
  validateState,
  type GitHubOAuthConfig,
} from '../services/github-oauth';
import {
  createSession,
  revokeSession,
  sessionMiddleware,
  type SessionVariables,
} from '../middleware/session';
import { ensureCsrfToken, setCsrfToken, csrfMiddleware } from '../middleware/csrf';
import { OAuthCallbackSchema, OAuthStartSchema } from '@orin/shared/validators';
import type { CurrentUserResponse } from '@orin/shared/types';

/**
 * OAuth state cookie configuration
 */
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes

/**
 * Create auth routes
 */
export function createAuthRoutes() {
  const auth = new Hono<{
    Bindings: Env;
    Variables: SessionVariables;
  }>();

  // Apply session middleware to all routes
  auth.use('*', sessionMiddleware());

  /**
   * GET /api/auth/github/start
   * Start GitHub OAuth flow
   */
  auth.get('/github/start', async (c) => {
    // Parse and validate query params
    const query = c.req.query();
    const validation = OAuthStartSchema.safeParse(query);

    let redirectTo: string | undefined;
    if (validation.success && validation.data.redirect) {
      // Only allow relative URLs or same-origin URLs for security
      try {
        const url = new URL(validation.data.redirect, 'http://localhost');
        if (url.origin === 'http://localhost') {
          redirectTo = validation.data.redirect;
        }
      } catch {
        // Invalid URL, ignore
      }
    }

    // Generate OAuth state
    const stateData = generateOAuthState(redirectTo);

    // Build redirect URI
    const requestUrl = new URL(c.req.url);
    const redirectUri = `${requestUrl.origin}/api/auth/github/callback`;

    // Build authorization URL
    const config: GitHubOAuthConfig = {
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri,
    };

    const authUrl = await buildAuthorizationUrl(config, stateData);

    // Store state in cookie
    const isProduction = c.env.ENVIRONMENT === 'production';
    setCookie(c, OAUTH_STATE_COOKIE, serializeOAuthState(stateData), {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'Lax',
      path: '/',
      maxAge: OAUTH_STATE_MAX_AGE,
    });

    // Redirect to GitHub
    return c.redirect(authUrl);
  });

  /**
   * GET /api/auth/github/callback
   * Handle GitHub OAuth callback
   */
  auth.get('/github/callback', async (c) => {
    // Parse and validate query params
    const query = c.req.query();
    const validation = OAuthCallbackSchema.safeParse(query);

    if (!validation.success) {
      const errorResponse = createErrorResponse('INVALID_INPUT', 'OAuth参数缺失或无效');
      return c.json(errorResponse, 400);
    }

    const { code, state } = validation.data;

    // Get stored state from cookie
    const stateCookie = getCookie(c, OAUTH_STATE_COOKIE);
    const storedState = stateCookie ? deserializeOAuthState(stateCookie) : null;

    // Clear state cookie
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

    // Validate state
    if (!validateState(state, storedState)) {
      const errorResponse = createErrorResponse('FORBIDDEN', 'OAuth状态无效');
      return c.json(errorResponse, 403);
    }

    // Build redirect URI
    const requestUrl = new URL(c.req.url);
    const redirectUri = `${requestUrl.origin}/api/auth/github/callback`;

    // Exchange code for token
    const config: GitHubOAuthConfig = {
      clientId: c.env.GITHUB_CLIENT_ID,
      clientSecret: c.env.GITHUB_CLIENT_SECRET,
      redirectUri,
    };

    let accessToken: string;
    try {
      accessToken = await exchangeCodeForToken(config, code, storedState!.codeVerifier);
    } catch (error) {
      console.error('Token exchange failed:', error);
      const errorResponse = createErrorResponse('INTERNAL_ERROR', 'OAuth授权码交换失败');
      return c.json(errorResponse, 500);
    }

    // Fetch GitHub user info
    let githubUser;
    try {
      githubUser = await fetchGitHubUser(accessToken);
    } catch (error) {
      console.error('User fetch failed:', error);
      const errorResponse = createErrorResponse('INTERNAL_ERROR', '获取用户信息失败');
      return c.json(errorResponse, 500);
    }

    // Upsert user in database
    const db = new DatabaseQueries(c.env.DB);
    const user = await db.users.upsert({
      githubId: String(githubUser.id),
      githubLogin: githubUser.login,
      avatarUrl: githubUser.avatar_url,
      email: githubUser.email || undefined,
    });

    // Check if user is banned
    if (user.isBanned) {
      const errorResponse = createErrorResponse(
        'FORBIDDEN',
        `账号已被封禁: ${user.banReason || '未提供原因'}`
      );
      return c.json(errorResponse, 403);
    }

    // Parse admin GitHub IDs
    const adminGithubIds = c.env.ADMIN_GITHUB_IDS
      ? c.env.ADMIN_GITHUB_IDS.split(',').map((id) => id.trim())
      : [];

    // Create session
    await createSession(c, user, adminGithubIds);

    // Set CSRF token
    setCsrfToken(c);

    // Redirect to original page or home
    const redirectTo = storedState?.redirectTo || '/';
    return c.redirect(redirectTo);
  });

  /**
   * POST /api/auth/logout
   * Logout current user
   */
  auth.post('/logout', csrfMiddleware(), async (c) => {
    const session = c.get('session');

    if (!session) {
      // Already logged out
      return c.json({ ok: true });
    }

    // Revoke session
    await revokeSession(c);

    return c.json({ ok: true });
  });

  /**
   * POST /api/auth/dev-login
   * Development-only login bypass (for local testing)
   */
  auth.post('/dev-login', csrfMiddleware(), async (c) => {
    // Only allow in development environment
    if (c.env.ENVIRONMENT === 'production') {
      const errorResponse = createErrorResponse('FORBIDDEN', '生产环境不支持开发登录');
      return c.json(errorResponse, 403);
    }

    // Parse request body
    let body;
    try {
      body = await c.req.json();
    } catch {
      const errorResponse = createErrorResponse('INVALID_INPUT', '无效的JSON数据');
      return c.json(errorResponse, 400);
    }

    const { username, isAdmin } = body;

    if (!username || typeof username !== 'string') {
      const errorResponse = createErrorResponse('INVALID_INPUT', '用户名为必填项');
      return c.json(errorResponse, 400);
    }

    // Create or find development user
    const db = new DatabaseQueries(c.env.DB);

    // Use a predictable GitHub ID for dev users (negative to avoid conflicts)
    const devGithubId = `dev-${username}`;

    const user = await db.users.upsert({
      githubId: devGithubId,
      githubLogin: username,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      email: `${username}@dev.local`,
    });

    // Check if user is banned (even dev users can be banned for testing)
    if (user.isBanned) {
      const errorResponse = createErrorResponse(
        'FORBIDDEN',
        `Account is banned: ${user.banReason || 'No reason provided'}`
      );
      return c.json(errorResponse, 403);
    }

    // For dev login, admin status is determined by the request
    const adminGithubIds = isAdmin ? [devGithubId] : [];

    // Create session
    await createSession(c, user, adminGithubIds);

    // Set CSRF token
    setCsrfToken(c);

    return c.json({ ok: true, data: { user, isAdmin: Boolean(isAdmin) } });
  });

  /**
   * GET /api/auth/me
   * Get current user info
   */
  auth.get('/me', ensureCsrfToken(), async (c) => {
    const session = c.get('session');
    const user = c.get('user');

    const response: { ok: true; data: CurrentUserResponse } = {
      ok: true,
      data: {
        user: user,
        isAdmin: session?.isAdmin || false,
      },
    };

    return c.json(response);
  });

  return auth;
}

export default createAuthRoutes;
