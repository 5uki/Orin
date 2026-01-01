/**
 * CSRF Protection Middleware
 *
 * Implements CSRF token generation and validation.
 * Uses double-submit cookie pattern.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env } from '../index';
import { generateRandomString } from '../services/github-oauth';

/**
 * CSRF cookie configuration
 */
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
export const CSRF_TOKEN_LENGTH = 32;

/**
 * Cookie options for CSRF token
 * Note: NOT HttpOnly so JavaScript can read it
 * Requirements: 4.1
 */
export interface CsrfCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
  path: string;
  maxAge: number;
}

/**
 * Get CSRF cookie options
 */
export function getCsrfCookieOptions(isProduction: boolean): CsrfCookieOptions {
  return {
    httpOnly: false, // Must be readable by JavaScript
    secure: isProduction,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return generateRandomString(CSRF_TOKEN_LENGTH);
}

/**
 * Set CSRF token cookie
 */
export function setCsrfToken<E extends { Bindings: Env }>(c: Context<E>): string {
  const isProduction = c.env.ENVIRONMENT === 'production';
  const token = generateCsrfToken();
  const options = getCsrfCookieOptions(isProduction);

  setCookie(c, CSRF_COOKIE_NAME, token, options);

  return token;
}

/**
 * Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie(c: Context): string | undefined {
  return getCookie(c, CSRF_COOKIE_NAME);
}

/**
 * Get CSRF token from header
 */
export function getCsrfTokenFromHeader(c: Context): string | undefined {
  return c.req.header(CSRF_HEADER_NAME);
}

/**
 * Validate CSRF token
 * Compares header token with cookie token
 */
export function validateCsrfToken(
  headerToken: string | undefined,
  cookieToken: string | undefined
): boolean {
  // Both tokens must exist
  if (!headerToken || !cookieToken) {
    return false;
  }

  // Tokens must match exactly
  if (headerToken !== cookieToken) {
    return false;
  }

  // Token must have minimum length
  if (headerToken.length < CSRF_TOKEN_LENGTH * 2) {
    return false;
  }

  return true;
}

/**
 * Check if request method requires CSRF validation
 */
export function requiresCsrfValidation(method: string): boolean {
  const writeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  return writeMethods.includes(method.toUpperCase());
}

/**
 * CSRF validation middleware
 * Validates CSRF token for write operations (POST/PUT/DELETE)
 */
export function csrfMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const method = c.req.method;

    // Only validate CSRF for write operations
    if (!requiresCsrfValidation(method)) {
      await next();
      return;
    }

    const headerToken = getCsrfTokenFromHeader(c);
    const cookieToken = getCsrfTokenFromCookie(c);

    // Validate CSRF token
    // Requirements: 4.2, 4.3
    if (!validateCsrfToken(headerToken, cookieToken)) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'CSRF令牌验证失败',
          },
        },
        403
      );
    }

    await next();
  };
}

/**
 * Middleware to ensure CSRF token cookie exists
 * Sets a new token if one doesn't exist
 */
export function ensureCsrfToken(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const existingToken = getCsrfTokenFromCookie(c);

    if (!existingToken) {
      setCsrfToken(c);
    }

    await next();
  };
}
