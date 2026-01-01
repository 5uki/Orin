/**
 * Site Configuration Routes
 *
 * Handles site configuration operations.
 *
 * Routes:
 * - GET /api/config - Get site configuration (public)
 * - PUT /api/config - Update site configuration (admin only)
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createErrorResponse } from '../utils/error-response';
import { sessionMiddleware, type SessionVariables } from '../middleware/session';
import { csrfMiddleware } from '../middleware/csrf';
import { requireAdmin } from '../middleware/admin';
import { DatabaseQueries } from '../../db/queries';
import type { SiteConfig } from '@orin/shared/types';

/**
 * Validate site configuration input
 */
function validateSiteConfig(
  data: unknown
): { valid: true; config: Partial<SiteConfig> } | { valid: false; error: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: '配置数据无效' };
  }

  const config = data as Record<string, unknown>;
  const result: Partial<SiteConfig> = {};

  // Validate siteName
  if (config.siteName !== undefined) {
    if (typeof config.siteName !== 'string') {
      return { valid: false, error: '站点名称必须是字符串' };
    }
    if (config.siteName.length > 100) {
      return { valid: false, error: '站点名称不能超过100个字符' };
    }
    result.siteName = config.siteName;
  }

  // Validate logoUrl
  if (config.logoUrl !== undefined) {
    if (typeof config.logoUrl !== 'string') {
      return { valid: false, error: 'Logo URL必须是字符串' };
    }
    if (config.logoUrl.length > 500) {
      return { valid: false, error: 'Logo URL不能超过500个字符' };
    }
    result.logoUrl = config.logoUrl;
  }

  // Validate ownerName
  if (config.ownerName !== undefined) {
    if (typeof config.ownerName !== 'string') {
      return { valid: false, error: '博主名称必须是字符串' };
    }
    if (config.ownerName.length > 100) {
      return { valid: false, error: '博主名称不能超过100个字符' };
    }
    result.ownerName = config.ownerName;
  }

  // Validate ownerAvatar
  if (config.ownerAvatar !== undefined) {
    if (typeof config.ownerAvatar !== 'string') {
      return { valid: false, error: '博主头像URL必须是字符串' };
    }
    if (config.ownerAvatar.length > 500) {
      return { valid: false, error: '博主头像URL不能超过500个字符' };
    }
    result.ownerAvatar = config.ownerAvatar;
  }

  // Validate description
  if (config.description !== undefined) {
    if (typeof config.description !== 'string') {
      return { valid: false, error: '站点描述必须是字符串' };
    }
    if (config.description.length > 1000) {
      return { valid: false, error: '站点描述不能超过1000个字符' };
    }
    result.description = config.description;
  }

  // Validate backgroundMode
  if (config.backgroundMode !== undefined) {
    if (config.backgroundMode !== 'solid' && config.backgroundMode !== 'image') {
      return { valid: false, error: '背景模式必须是 solid 或 image' };
    }
    result.backgroundMode = config.backgroundMode;
  }

  // Validate backgroundColor
  if (config.backgroundColor !== undefined) {
    if (typeof config.backgroundColor !== 'string') {
      return { valid: false, error: '背景颜色必须是字符串' };
    }
    if (config.backgroundColor.length > 50) {
      return { valid: false, error: '背景颜色不能超过50个字符' };
    }
    result.backgroundColor = config.backgroundColor;
  }

  // Validate backgroundImageUrl
  if (config.backgroundImageUrl !== undefined) {
    if (typeof config.backgroundImageUrl !== 'string') {
      return { valid: false, error: '背景图片URL必须是字符串' };
    }
    if (config.backgroundImageUrl.length > 500) {
      return { valid: false, error: '背景图片URL不能超过500个字符' };
    }
    result.backgroundImageUrl = config.backgroundImageUrl;
  }

  // Validate defaultTheme
  if (config.defaultTheme !== undefined) {
    if (
      config.defaultTheme !== 'light' &&
      config.defaultTheme !== 'dark' &&
      config.defaultTheme !== 'auto'
    ) {
      return { valid: false, error: '默认主题必须是 light、dark 或 auto' };
    }
    result.defaultTheme = config.defaultTheme;
  }

  // Validate ownerGithubId
  if (config.ownerGithubId !== undefined) {
    if (typeof config.ownerGithubId !== 'string') {
      return { valid: false, error: '博主GitHub ID必须是字符串' };
    }
    if (config.ownerGithubId.length > 50) {
      return { valid: false, error: '博主GitHub ID不能超过50个字符' };
    }
    result.ownerGithubId = config.ownerGithubId;
  }

  return { valid: true, config: result };
}

/**
 * Create config routes
 */
export function createConfigRoutes() {
  const config = new Hono<{
    Bindings: Env;
    Variables: SessionVariables;
  }>();

  /**
   * GET /api/config
   * Get site configuration (public endpoint)
   */
  config.get('/', async (c) => {
    const db = new DatabaseQueries(c.env.DB);
    const siteConfig = await db.siteConfig.getAll();

    return c.json({
      ok: true,
      data: siteConfig,
    });
  });

  /**
   * PUT /api/config
   * Update site configuration (admin only)
   */
  config.put('/', sessionMiddleware(), requireAdmin(), csrfMiddleware(), async (c) => {
    // Parse request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的JSON数据'), 400);
    }

    // Validate input
    const validation = validateSiteConfig(body);
    if (!validation.valid) {
      return c.json(createErrorResponse('INVALID_INPUT', validation.error), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Update configuration
    await db.siteConfig.setAll(validation.config);

    // Get updated configuration
    const updatedConfig = await db.siteConfig.getAll();

    return c.json({
      ok: true,
      data: updatedConfig,
    });
  });

  return config;
}

export default createConfigRoutes;
