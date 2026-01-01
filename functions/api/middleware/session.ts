/**
 * Session Management Middleware
 *
 * Handles session creation, validation, and revocation.
 * Sets secure cookie attributes as per requirements.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../index';
import type { Session, User } from '@orin/shared/types';
import { DatabaseQueries } from '../../db/queries';
import { generateRandomString } from '../services/github-oauth';

/**
 * Session cookie configuration
 */
export const SESSION_COOKIE_NAME = 'session_id';
export const SESSION_DURATION_DAYS = 7;

/**
 * Cookie options for session cookie
 */
export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  path: string;
  maxAge: number;
}

/**
 * Get secure cookie options
 */
export function getSessionCookieOptions(isProduction: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * Session context type for middleware
 */
export interface SessionContext {
  session: Session | null;
  user: User | null;
}

/**
 * Extended Hono context with session
 */
export type SessionVariables = {
  session: Session | null;
  user: User | null;
};

/**
 * Generate a new session ID
 */
export function generateSessionId(): string {
  return `sess_${generateRandomString(32)}`;
}

/**
 * Calculate session expiration date
 */
export function calculateSessionExpiry(durationDays: number = SESSION_DURATION_DAYS): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);
  return expiresAt.toISOString();
}

/**
 * Hash IP address for privacy
 */
export async function hashIpAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'orin-blog-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a new session for a user
 */
export async function createSession<E extends { Bindings: Env }>(
  c: Context<E>,
  user: User,
  adminGithubIds: string[]
): Promise<Session> {
  const db = new DatabaseQueries(c.env.DB);
  const isProduction = c.env.ENVIRONMENT === 'production';

  const sessionId = generateSessionId();
  const expiresAt = calculateSessionExpiry();
  const userAgent = c.req.header('User-Agent');
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
  const ipHash = clientIp ? await hashIpAddress(clientIp) : undefined;

  // Check if user is admin
  const isAdmin = adminGithubIds.includes(user.githubId);

  const session = await db.sessions.create({
    id: sessionId,
    userId: user.id,
    isAdmin,
    expiresAt,
    userAgent,
    ipHash,
  });

  // Set session cookie
  const cookieOptions = getSessionCookieOptions(isProduction);
  setCookie(c, SESSION_COOKIE_NAME, sessionId, cookieOptions);

  return session;
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession<E extends { Bindings: Env }>(c: Context<E>): Promise<void> {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionId) {
    const db = new DatabaseQueries(c.env.DB);
    await db.sessions.revoke(sessionId);
  }

  // Delete session cookie
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Revoke all sessions for a user (used when banning)
 */
export async function revokeAllUserSessions<E extends { Bindings: Env }>(
  c: Context<E>,
  userId: number
): Promise<void> {
  const db = new DatabaseQueries(c.env.DB);
  await db.sessions.revokeAllForUser(userId);
}

/**
 * Validate and load session from cookie
 * Returns null if session is invalid, expired, or revoked
 */
export async function validateSession<E extends { Bindings: Env }>(
  c: Context<E>
): Promise<SessionContext> {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionId) {
    return { session: null, user: null };
  }

  const db = new DatabaseQueries(c.env.DB);

  // Find valid session (not expired, not revoked)
  const session = await db.sessions.findById(sessionId);

  if (!session) {
    // Invalid or expired session, clear cookie
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    return { session: null, user: null };
  }

  // Load user
  const user = await db.users.findById(session.userId);

  if (!user) {
    // User not found, revoke session
    await db.sessions.revoke(sessionId);
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    return { session: null, user: null };
  }

  // Check if user is banned
  if (user.isBanned) {
    // Revoke session for banned user
    await db.sessions.revoke(sessionId);
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    return { session: null, user: null };
  }

  return { session, user };
}

/**
 * Session middleware - loads session and user into context
 */
export function sessionMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: SessionVariables;
}> {
  return async (c, next) => {
    const { session, user } = await validateSession(c);

    c.set('session', session);
    c.set('user', user);

    await next();
  };
}

/**
 * Require authentication middleware
 * Returns 401 if not authenticated
 */
export function requireAuth(): MiddlewareHandler<{
  Bindings: Env;
  Variables: SessionVariables;
}> {
  return async (c, next) => {
    const session = c.get('session');
    const user = c.get('user');

    if (!session || !user) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '需要登录',
          },
        },
        401
      );
    }

    await next();
  };
}
