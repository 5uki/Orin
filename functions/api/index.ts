/**
 * Hono API Entry Point for Orin Blog System
 *
 * This is the main entry point for all API routes in the Cloudflare Pages Functions.
 * It handles routing, middleware, and unified error handling.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { createErrorResponse, generateRequestId } from './utils/error-response';

// Re-export for backward compatibility
export { createErrorResponse } from './utils/error-response';

// Cloudflare environment bindings
export interface Env {
  DB: D1Database;
  AI: Ai;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_REPO_OWNER?: string;
  GITHUB_REPO_NAME?: string;
  ADMIN_GITHUB_IDS: string;
  TURNSTILE_SECRET_KEY: string;
  ENVIRONMENT: string;
  ALLOWED_ORIGINS?: string;
}

// Create Hono app with Cloudflare bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());

// CORS configuration
app.use(
  '/api/*',
  cors({
    origin: (origin, c) => {
      // Allow same-origin requests and localhost for development
      if (!origin) return origin; // Same-origin requests
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
      const allowList = (c.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((value: string) => value.trim())
        .filter(Boolean);
      if (allowList.includes(origin)) {
        return origin;
      }
      return undefined;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
  })
);

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns standardized error responses
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  const requestId = generateRequestId();

  // Log error details for debugging
  console.error(`[${requestId}] Error:`, {
    message: err.message,
    stack: err.stack,
    url: c.req.url,
    method: c.req.method,
  });

  // Return standardized error response
  const errorResponse = createErrorResponse(
    'INTERNAL_ERROR',
    'An internal server error occurred',
    requestId
  );

  return c.json(errorResponse, 500);
});

/**
 * 404 handler for unmatched routes
 */
app.notFound((c) => {
  const errorResponse = createErrorResponse(
    'NOT_FOUND',
    `Route ${c.req.method} ${c.req.path} not found`
  );
  return c.json(errorResponse, 404);
});

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
    },
  });
});

// Route handlers
import { createAuthRoutes } from './routes/auth';
import { createCommentsRoutes } from './routes/comments';
import { createAdminRoutes } from './routes/admin';
import { createConfigRoutes } from './routes/config';
import { createPostsRoutes } from './routes/posts';

// Mount auth routes
app.route('/api/auth', createAuthRoutes());

// Mount comments routes
app.route('/api/comments', createCommentsRoutes());

// Mount admin routes
app.route('/api/admin', createAdminRoutes());

// Mount config routes
app.route('/api/config', createConfigRoutes());

// Mount posts routes
app.route('/api/posts', createPostsRoutes());

export default app;

export const onRequest = (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}) => app.fetch(context.request, context.env, context as unknown as ExecutionContext);
