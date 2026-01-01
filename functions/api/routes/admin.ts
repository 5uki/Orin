/**
 * Admin Routes
 *
 * Handles admin operations for posts, comments, and users.
 *
 * Routes:
 * - POST /api/admin/posts/publish - Publish a new post
 * - PUT /api/admin/posts/:slug - Update an existing post
 * - POST /api/admin/posts/:slug/unpublish - Unpublish a post
 * - GET /api/admin/comments/pending - Get pending comments
 * - POST /api/admin/comments/:id/approve - Approve a comment
 * - POST /api/admin/comments/:id/reject - Reject a comment
 * - POST /api/admin/users/:id/ban - Ban a user
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createErrorResponse } from '../utils/error-response';
import {
  sessionMiddleware,
  type SessionVariables,
  revokeAllUserSessions,
} from '../middleware/session';
import { csrfMiddleware } from '../middleware/csrf';
import { requireAdmin } from '../middleware/admin';
import { GitHubAppClient, decodeFileContent } from '../services/github-app';
import { createAuditLog } from '../services/audit';
import { DatabaseQueries } from '../../db/queries';
import {
  PublishPostSchema,
  UpdatePostSchema,
  BanUserSchema,
  PaginationSchema,
} from '@orin/shared/validators';
import type {
  PublishPostResponse,
  UpdatePostResponse,
  PendingCommentsResponse,
} from '@orin/shared/types';

/**
 * Validate that the file path is safe (no directory traversal)
 */
export function isPathSafe(slug: string): boolean {
  // Check for directory traversal attempts
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    return false;
  }
  // Check for null bytes
  if (slug.includes('\0')) {
    return false;
  }
  return true;
}

/**
 * Build the safe file path for a post
 */
export function buildPostPath(slug: string): string {
  return `content/posts/${slug}.mdx`;
}

/**
 * Get repository config from environment
 */
function getRepoConfig(env: Env): { owner: string; repo: string } | null {
  const owner = env.GITHUB_REPO_OWNER?.trim();
  const repo = env.GITHUB_REPO_NAME?.trim();

  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

/**
 * Get GitHub App config from environment
 */
function getGitHubAppConfig(
  env: Env
): { appId: string; privateKey: string; installationId?: string } | null {
  const appId = env.GITHUB_APP_ID?.trim();
  const privateKey = env.GITHUB_APP_PRIVATE_KEY?.trim();

  if (!appId || !privateKey) {
    return null;
  }

  const installationId = env.GITHUB_APP_INSTALLATION_ID?.trim();

  return {
    appId,
    privateKey,
    installationId: installationId || undefined,
  };
}

/**
 * Create admin routes
 */
export function createAdminRoutes() {
  const admin = new Hono<{
    Bindings: Env;
    Variables: SessionVariables;
  }>();

  // Apply middleware to all routes
  admin.use('*', sessionMiddleware());
  admin.use('*', requireAdmin());
  admin.use('*', csrfMiddleware());

  /**
   * POST /api/admin/posts/publish
   * Publish a new post
   */
  admin.post('/posts/publish', async (c) => {
    const user = c.get('user')!;

    // Parse and validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的JSON数据'), 400);
    }

    const validation = PublishPostSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        createErrorResponse('INVALID_INPUT', validation.error.errors[0]?.message || '请求数据无效'),
        400
      );
    }

    const { slug, content, commitMessage } = validation.data;

    // Validate path safety (Requirements: 9.1)
    if (!isPathSafe(slug)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的文章标识格式'), 400);
    }

    const filePath = buildPostPath(slug);
    const repoInfo = getRepoConfig(c.env);
    const appConfig = getGitHubAppConfig(c.env);

    if (!repoInfo || !appConfig) {
      return c.json(createErrorResponse('INTERNAL_ERROR', 'GitHub仓库未配置'), 500);
    }

    // Create GitHub App client
    const githubClient = new GitHubAppClient(
      {
        appId: appConfig.appId,
        privateKey: appConfig.privateKey,
        installationId: appConfig.installationId,
      },
      repoInfo.owner,
      repoInfo.repo
    );

    try {
      // Check if file already exists
      const existingFile = await githubClient.readFile(filePath);
      if (existingFile) {
        return c.json(createErrorResponse('INVALID_INPUT', '该标识的文章已存在'), 400);
      }

      // Create the file
      const result = await githubClient.writeFile(filePath, content, commitMessage);

      // Log audit event (Requirements: 10.3)
      const db = new DatabaseQueries(c.env.DB);
      await createAuditLog(db, {
        actorUserId: user.id,
        action: 'POST_PUBLISH',
        targetType: 'post',
        targetId: slug,
        detail: {
          commitSha: result.commit.sha,
          filePath,
        },
      });

      const response: { ok: true; data: PublishPostResponse } = {
        ok: true,
        data: {
          slug,
          commitSha: result.commit.sha,
          url: `/posts/${slug}`,
        },
      };

      return c.json(response, 201);
    } catch (error) {
      console.error('Failed to publish post:', error);
      return c.json(createErrorResponse('INTERNAL_ERROR', '发布文章失败'), 500);
    }
  });

  /**
   * PUT /api/admin/posts/:slug
   * Update an existing post
   */
  admin.put('/posts/:slug', async (c) => {
    const user = c.get('user')!;
    const slug = c.req.param('slug');

    // Validate path safety
    if (!isPathSafe(slug)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的文章标识格式'), 400);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的JSON数据'), 400);
    }

    const validation = UpdatePostSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        createErrorResponse('INVALID_INPUT', validation.error.errors[0]?.message || '请求数据无效'),
        400
      );
    }

    const { content, commitMessage } = validation.data;
    const filePath = buildPostPath(slug);
    const repoInfo = getRepoConfig(c.env);
    const appConfig = getGitHubAppConfig(c.env);

    if (!repoInfo || !appConfig) {
      return c.json(createErrorResponse('INTERNAL_ERROR', 'GitHub仓库未配置'), 500);
    }

    const githubClient = new GitHubAppClient(
      {
        appId: appConfig.appId,
        privateKey: appConfig.privateKey,
        installationId: appConfig.installationId,
      },
      repoInfo.owner,
      repoInfo.repo
    );

    try {
      // Get existing file to get SHA
      const existingFile = await githubClient.readFile(filePath);
      if (!existingFile) {
        return c.json(createErrorResponse('NOT_FOUND', '文章不存在'), 404);
      }

      // Update the file
      const result = await githubClient.writeFile(
        filePath,
        content,
        commitMessage,
        existingFile.sha
      );

      // Log audit event
      const db = new DatabaseQueries(c.env.DB);
      await createAuditLog(db, {
        actorUserId: user.id,
        action: 'POST_UPDATE',
        targetType: 'post',
        targetId: slug,
        detail: {
          commitSha: result.commit.sha,
          filePath,
        },
      });

      const response: { ok: true; data: UpdatePostResponse } = {
        ok: true,
        data: {
          slug,
          commitSha: result.commit.sha,
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Failed to update post:', error);
      return c.json(createErrorResponse('INTERNAL_ERROR', '更新文章失败'), 500);
    }
  });

  /**
   * POST /api/admin/posts/:slug/unpublish
   * Unpublish a post by setting draft: true in frontmatter
   */
  admin.post('/posts/:slug/unpublish', async (c) => {
    const user = c.get('user')!;
    const slug = c.req.param('slug');

    // Validate path safety
    if (!isPathSafe(slug)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的文章标识格式'), 400);
    }

    const filePath = buildPostPath(slug);
    const repoInfo = getRepoConfig(c.env);
    const appConfig = getGitHubAppConfig(c.env);

    if (!repoInfo || !appConfig) {
      return c.json(createErrorResponse('INTERNAL_ERROR', 'GitHub仓库未配置'), 500);
    }

    const githubClient = new GitHubAppClient(
      {
        appId: appConfig.appId,
        privateKey: appConfig.privateKey,
        installationId: appConfig.installationId,
      },
      repoInfo.owner,
      repoInfo.repo
    );

    try {
      // Get existing file
      const existingFile = await githubClient.readFile(filePath);
      if (!existingFile) {
        return c.json(createErrorResponse('NOT_FOUND', '文章不存在'), 404);
      }

      // Decode content
      const currentContent = decodeFileContent(existingFile.content);

      // Update frontmatter to set draft: true
      const updatedContent = setDraftFlag(currentContent, true);

      // Update the file
      const result = await githubClient.writeFile(
        filePath,
        updatedContent,
        `Unpublish: ${slug}`,
        existingFile.sha
      );

      // Log audit event
      const db = new DatabaseQueries(c.env.DB);
      await createAuditLog(db, {
        actorUserId: user.id,
        action: 'POST_UNPUBLISH',
        targetType: 'post',
        targetId: slug,
        detail: {
          commitSha: result.commit.sha,
          filePath,
        },
      });

      const response: { ok: true; data: UpdatePostResponse } = {
        ok: true,
        data: {
          slug,
          commitSha: result.commit.sha,
        },
      };

      return c.json(response);
    } catch (error) {
      console.error('Failed to unpublish post:', error);
      return c.json(createErrorResponse('INTERNAL_ERROR', '取消发布文章失败'), 500);
    }
  });

  /**
   * POST /api/admin/posts/:slug/pin
   * Pin a post
   */
  admin.post('/posts/:slug/pin', async (c) => {
    const slug = c.req.param('slug');

    // Validate path safety
    if (!isPathSafe(slug)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的文章标识'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Check if already pinned
    const isPinned = await db.postMetadata.isPinned(slug);
    if (isPinned) {
      return c.json(createErrorResponse('INVALID_INPUT', '文章已置顶'), 400);
    }

    // Pin the post
    await db.postMetadata.pin(slug);

    // Get updated metadata
    const metadata = await db.postMetadata.findBySlug(slug);

    return c.json({
      ok: true,
      data: metadata,
    });
  });

  /**
   * DELETE /api/admin/posts/:slug/pin
   * Unpin a post
   */
  admin.delete('/posts/:slug/pin', async (c) => {
    const slug = c.req.param('slug');

    // Validate path safety
    if (!isPathSafe(slug)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的文章标识'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Check if pinned
    const isPinned = await db.postMetadata.isPinned(slug);
    if (!isPinned) {
      return c.json(createErrorResponse('INVALID_INPUT', '文章未置顶'), 400);
    }

    // Unpin the post
    await db.postMetadata.unpin(slug);

    return c.json({
      ok: true,
      data: { slug, isPinned: false },
    });
  });

  /**
   * GET /api/admin/posts/pinned
   * Get all pinned posts
   */
  admin.get('/posts/pinned', async (c) => {
    const db = new DatabaseQueries(c.env.DB);
    const pinnedPosts = await db.postMetadata.getPinned();

    return c.json({
      ok: true,
      data: pinnedPosts,
    });
  });

  /**
   * GET /api/admin/comments/pending
   * Get pending comments for review
   */
  admin.get('/comments/pending', async (c) => {
    const query = c.req.query();
    const validation = PaginationSchema.safeParse(query);

    const { limit, cursor } = validation.success
      ? validation.data
      : { limit: 20, cursor: undefined };

    const db = new DatabaseQueries(c.env.DB);
    const { comments, nextCursor } = await db.comments.getPending(limit, cursor);

    const response: { ok: true; data: PendingCommentsResponse } = {
      ok: true,
      data: {
        comments,
        nextCursor,
      },
    };

    return c.json(response);
  });

  /**
   * POST /api/admin/comments/:id/approve
   * Approve a pending comment
   */
  admin.post('/comments/:id/approve', async (c) => {
    const user = c.get('user')!;
    const commentId = parseInt(c.req.param('id'), 10);

    if (isNaN(commentId)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的评论ID'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Get comment
    const comment = await db.comments.findById(commentId);
    if (!comment) {
      return c.json(createErrorResponse('NOT_FOUND', '评论不存在'), 404);
    }

    // Update status
    await db.comments.updateStatus(commentId, 'approved', 'manual');

    // Log audit event
    await createAuditLog(db, {
      actorUserId: user.id,
      action: 'COMMENT_APPROVE',
      targetType: 'comment',
      targetId: String(commentId),
      detail: {
        postSlug: comment.postSlug,
        previousStatus: comment.status,
      },
    });

    return c.json({ ok: true });
  });

  /**
   * POST /api/admin/comments/:id/reject
   * Reject a pending comment
   */
  admin.post('/comments/:id/reject', async (c) => {
    const user = c.get('user')!;
    const commentId = parseInt(c.req.param('id'), 10);

    if (isNaN(commentId)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的评论ID'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Get comment
    const comment = await db.comments.findById(commentId);
    if (!comment) {
      return c.json(createErrorResponse('NOT_FOUND', '评论不存在'), 404);
    }

    // Update status
    await db.comments.updateStatus(commentId, 'rejected', 'manual');

    // Log audit event
    await createAuditLog(db, {
      actorUserId: user.id,
      action: 'COMMENT_REJECT',
      targetType: 'comment',
      targetId: String(commentId),
      detail: {
        postSlug: comment.postSlug,
        previousStatus: comment.status,
      },
    });

    return c.json({ ok: true });
  });

  /**
   * POST /api/admin/comments/:id/pin
   * Pin a comment
   */
  admin.post('/comments/:id/pin', async (c) => {
    const commentId = parseInt(c.req.param('id'), 10);

    if (isNaN(commentId)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的评论ID'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Get comment
    const comment = await db.comments.findById(commentId);
    if (!comment) {
      return c.json(createErrorResponse('NOT_FOUND', '评论不存在'), 404);
    }

    // Check if already pinned
    if (comment.isPinned) {
      return c.json(createErrorResponse('INVALID_INPUT', '评论已置顶'), 400);
    }

    // Pin the comment
    await db.comments.pin(commentId);

    // Get updated comment
    const updatedComment = await db.comments.findById(commentId);

    return c.json({
      ok: true,
      data: updatedComment,
    });
  });

  /**
   * DELETE /api/admin/comments/:id/pin
   * Unpin a comment
   */
  admin.delete('/comments/:id/pin', async (c) => {
    const commentId = parseInt(c.req.param('id'), 10);

    if (isNaN(commentId)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的评论ID'), 400);
    }

    const db = new DatabaseQueries(c.env.DB);

    // Get comment
    const comment = await db.comments.findById(commentId);
    if (!comment) {
      return c.json(createErrorResponse('NOT_FOUND', '评论不存在'), 404);
    }

    // Check if pinned
    if (!comment.isPinned) {
      return c.json(createErrorResponse('INVALID_INPUT', '评论未置顶'), 400);
    }

    // Unpin the comment
    await db.comments.unpin(commentId);

    return c.json({
      ok: true,
      data: { id: commentId, isPinned: false },
    });
  });

  /**
   * POST /api/admin/users/:id/ban
   * Ban a user
   */
  admin.post('/users/:id/ban', async (c) => {
    const adminUser = c.get('user')!;
    const userId = parseInt(c.req.param('id'), 10);

    if (isNaN(userId)) {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的用户ID'), 400);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(createErrorResponse('INVALID_INPUT', '无效的JSON数据'), 400);
    }

    const validation = BanUserSchema.safeParse(body);
    if (!validation.success) {
      return c.json(
        createErrorResponse('INVALID_INPUT', validation.error.errors[0]?.message || '请求数据无效'),
        400
      );
    }

    const { reason } = validation.data;

    const db = new DatabaseQueries(c.env.DB);

    // Get user
    const targetUser = await db.users.findById(userId);
    if (!targetUser) {
      return c.json(createErrorResponse('NOT_FOUND', '用户不存在'), 404);
    }

    // Prevent self-ban
    if (targetUser.id === adminUser.id) {
      return c.json(createErrorResponse('FORBIDDEN', '不能封禁自己'), 403);
    }

    // Ban user
    await db.users.ban(userId, reason);

    // Revoke all sessions for the banned user
    await revokeAllUserSessions(c, userId);

    // Log audit event
    await createAuditLog(db, {
      actorUserId: adminUser.id,
      action: 'USER_BAN',
      targetType: 'user',
      targetId: String(userId),
      detail: {
        reason,
        targetGithubLogin: targetUser.githubLogin,
      },
    });

    return c.json({ ok: true });
  });

  return admin;
}

/**
 * Set draft flag in MDX frontmatter
 */
export function setDraftFlag(content: string, draft: boolean): string {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter, add it
    return `---\ndraft: ${draft}\n---\n\n${content}`;
  }

  const frontmatter = match[1];
  const draftRegex = /^draft:\s*.*/m;

  if (draftRegex.test(frontmatter)) {
    // Update existing draft field
    const updatedFrontmatter = frontmatter.replace(draftRegex, `draft: ${draft}`);
    // Use a function replacement to avoid special character interpretation
    return content.replace(frontmatterRegex, () => `---\n${updatedFrontmatter}\n---`);
  } else {
    // Add draft field
    const updatedFrontmatter = `draft: ${draft}\n${frontmatter}`;
    // Use a function replacement to avoid special character interpretation
    return content.replace(frontmatterRegex, () => `---\n${updatedFrontmatter}\n---`);
  }
}

export default createAdminRoutes;
