/**
 * Cloudflare Pages Functions catch-all route
 *
 * This file handles all /api/* requests and delegates to the Hono app.
 */

import app, { type Env } from './index';

export const onRequest = (context: {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}) => app.fetch(context.request, context.env, context as unknown as ExecutionContext);
