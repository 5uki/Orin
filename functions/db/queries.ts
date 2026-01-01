/**
 * Database Query Layer for Orin Blog System
 *
 * This module provides parameterized query functions for all database operations.
 * All queries use prepared statements to prevent SQL injection attacks.
 */

import type {
  User,
  Session,
  Comment,
  CommentWithUser,
  CommentTree,
  AuditLog,
  TrustLevel,
  CommentStatus,
  ModerationSource,
  AuditAction,
  AuditTargetType,
  SiteConfig,
  SiteConfigKey,
  PostMetadata,
} from '@orin/shared/types';

/**
 * Raw database row types (matching SQLite column names)
 */
interface UserRow {
  id: number;
  github_id: string;
  github_login: string;
  avatar_url: string;
  email: string | null;
  trust_level: number;
  is_banned: number;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  user_id: number;
  is_admin: number;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: string;
}

interface CommentRow {
  id: number;
  post_slug: string;
  parent_id: number | null;
  user_id: number;
  content: string;
  status: string;
  moderation_source: string | null;
  ai_score: number | null;
  ai_label: string | null;
  rule_score: number;
  rule_flags: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  is_pinned: number;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CommentWithUserRow extends CommentRow {
  user_github_login: string;
  user_avatar_url: string;
  user_github_id: string;
}

interface AuditLogRow {
  id: number;
  actor_user_id: number;
  action: string;
  target_type: string;
  target_id: string;
  detail_json: string;
  created_at: string;
}

interface SiteConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

interface PostMetadataRow {
  slug: string;
  is_pinned: number;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to User object
 */
function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    githubId: row.github_id,
    githubLogin: row.github_login,
    avatarUrl: row.avatar_url,
    email: row.email || undefined,
    trustLevel: row.trust_level as TrustLevel,
    isBanned: Boolean(row.is_banned),
    banReason: row.ban_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to Session object
 */
function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    isAdmin: Boolean(row.is_admin),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at || undefined,
    userAgent: row.user_agent || undefined,
    ipHash: row.ip_hash || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Convert database row to Comment object
 */
function mapCommentRow(row: CommentRow): Comment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    parentId: row.parent_id || undefined,
    userId: row.user_id,
    content: row.content,
    status: row.status as CommentStatus,
    moderationSource: (row.moderation_source as ModerationSource) || undefined,
    aiScore: row.ai_score || undefined,
    aiLabel: row.ai_label || undefined,
    ruleScore: row.rule_score,
    ruleFlags: row.rule_flags ? JSON.parse(row.rule_flags) : [],
    isPinned: Boolean(row.is_pinned),
    pinnedAt: row.pinned_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to CommentWithUser object
 */
function mapCommentWithUserRow(row: CommentWithUserRow): CommentWithUser {
  const comment = mapCommentRow(row);
  return {
    ...comment,
    user: {
      githubLogin: row.user_github_login,
      avatarUrl: row.user_avatar_url,
      githubId: row.user_github_id,
    },
  };
}

/**
 * Convert database row to AuditLog object
 */
function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action as AuditAction,
    targetType: row.target_type as AuditTargetType,
    targetId: row.target_id,
    detailJson: row.detail_json,
    createdAt: row.created_at,
  };
}

/**
 * User Queries
 */
export class UserQueries {
  constructor(private db: D1Database) {}

  /**
   * Find user by GitHub ID
   */
  async findByGithubId(githubId: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE github_id = ?');
    const result = await stmt.bind(githubId).first<UserRow>();
    return result ? mapUserRow(result) : null;
  }

  /**
   * Find user by ID
   */
  async findById(id: number): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const result = await stmt.bind(id).first<UserRow>();
    return result ? mapUserRow(result) : null;
  }

  /**
   * Create or update user (upsert)
   */
  async upsert(userData: {
    githubId: string;
    githubLogin: string;
    avatarUrl: string;
    email?: string;
  }): Promise<User> {
    const stmt = this.db.prepare(`
      INSERT INTO users (github_id, github_login, avatar_url, email, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(github_id) DO UPDATE SET
        github_login = excluded.github_login,
        avatar_url = excluded.avatar_url,
        email = excluded.email,
        updated_at = datetime('now')
      RETURNING *
    `);

    const result = await stmt
      .bind(userData.githubId, userData.githubLogin, userData.avatarUrl, userData.email || null)
      .first<UserRow>();

    if (!result) {
      throw new Error('Failed to create/update user');
    }

    return mapUserRow(result);
  }

  /**
   * Update user ban status
   */
  async updateBanStatus(userId: number, isBanned: boolean, banReason?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET is_banned = ?, ban_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(isBanned ? 1 : 0, banReason || null, userId).run();
  }

  /**
   * Ban a user
   */
  async ban(userId: number, reason: string): Promise<void> {
    await this.updateBanStatus(userId, true, reason);
  }

  /**
   * Unban a user
   */
  async unban(userId: number): Promise<void> {
    await this.updateBanStatus(userId, false, undefined);
  }

  /**
   * Update user trust level
   */
  async updateTrustLevel(userId: number, trustLevel: TrustLevel): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET trust_level = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(trustLevel, userId).run();
  }

  /**
   * Get user's approved comment count
   */
  async getApprovedCommentCount(userId: number): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM comments 
      WHERE user_id = ? AND status = 'approved'
    `);

    const result = await stmt.bind(userId).first<{ count: number }>();
    return result?.count || 0;
  }

  /**
   * Check if user has rejected comments in last N days
   */
  async hasRecentRejections(userId: number, days: number = 30): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM comments 
      WHERE user_id = ? 
        AND status = 'rejected' 
        AND created_at > datetime('now', '-' || ? || ' days')
    `);

    const result = await stmt.bind(userId, days).first<{ count: number }>();
    return (result?.count || 0) > 0;
  }
}

/**
 * Session Queries
 */
export class SessionQueries {
  constructor(private db: D1Database) {}

  /**
   * Find session by ID
   */
  async findById(sessionId: string): Promise<Session | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND expires_at > datetime('now') AND revoked_at IS NULL
    `);

    const result = await stmt.bind(sessionId).first<SessionRow>();
    return result ? mapSessionRow(result) : null;
  }

  /**
   * Create new session
   */
  async create(sessionData: {
    id: string;
    userId: number;
    isAdmin: boolean;
    expiresAt: string;
    userAgent?: string;
    ipHash?: string;
  }): Promise<Session> {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, is_admin, expires_at, user_agent, ip_hash)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = await stmt
      .bind(
        sessionData.id,
        sessionData.userId,
        sessionData.isAdmin ? 1 : 0,
        sessionData.expiresAt,
        sessionData.userAgent || null,
        sessionData.ipHash || null
      )
      .first<SessionRow>();

    if (!result) {
      throw new Error('Failed to create session');
    }

    return mapSessionRow(result);
  }

  /**
   * Revoke session
   */
  async revoke(sessionId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET revoked_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(sessionId).run();
  }

  /**
   * Revoke all sessions for user
   */
  async revokeAllForUser(userId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET revoked_at = datetime('now')
      WHERE user_id = ? AND revoked_at IS NULL
    `);

    await stmt.bind(userId).run();
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM sessions 
      WHERE expires_at < datetime('now')
    `);

    await stmt.run();
  }
}

/**
 * Comment Queries
 */
export class CommentQueries {
  constructor(private db: D1Database) {}

  /**
   * Get approved comments for a post with user info
   */
  async getApprovedForPost(postSlug: string): Promise<CommentWithUser[]> {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.github_login as user_github_login,
        u.avatar_url as user_avatar_url,
        u.github_id as user_github_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_slug = ? AND c.status = 'approved'
      ORDER BY c.created_at ASC
    `);

    const results = await stmt.bind(postSlug).all<CommentWithUserRow>();
    return results.results.map(mapCommentWithUserRow);
  }

  /**
   * Create new comment
   */
  async create(commentData: {
    postSlug: string;
    parentId?: number;
    userId: number;
    content: string;
    status: CommentStatus;
    moderationSource?: ModerationSource;
    aiScore?: number;
    aiLabel?: string;
    ruleScore: number;
    ruleFlags: string[];
    ipHash?: string;
    userAgent?: string;
  }): Promise<Comment> {
    const stmt = this.db.prepare(`
      INSERT INTO comments (
        post_slug, parent_id, user_id, content, status, 
        moderation_source, ai_score, ai_label, rule_score, rule_flags,
        ip_hash, user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = await stmt
      .bind(
        commentData.postSlug,
        commentData.parentId || null,
        commentData.userId,
        commentData.content,
        commentData.status,
        commentData.moderationSource || null,
        commentData.aiScore || null,
        commentData.aiLabel || null,
        commentData.ruleScore,
        JSON.stringify(commentData.ruleFlags),
        commentData.ipHash || null,
        commentData.userAgent || null
      )
      .first<CommentRow>();

    if (!result) {
      throw new Error('Failed to create comment');
    }

    return mapCommentRow(result);
  }

  /**
   * Update comment status
   */
  async updateStatus(
    commentId: number,
    status: CommentStatus,
    moderationSource?: ModerationSource
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE comments 
      SET status = ?, moderation_source = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(status, moderationSource || null, commentId).run();
  }

  /**
   * Get pending comments for moderation with cursor-based pagination
   */
  async getPending(
    limit: number = 20,
    cursor?: string
  ): Promise<{ comments: CommentWithUser[]; nextCursor?: string }> {
    let stmt;
    if (cursor) {
      // Cursor is the ID of the last item from previous page
      const cursorId = parseInt(cursor, 10);
      stmt = this.db.prepare(`
        SELECT 
          c.*,
          u.github_login as user_github_login,
          u.avatar_url as user_avatar_url,
          u.github_id as user_github_id
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.status = 'pending' AND c.id < ?
        ORDER BY c.id DESC
        LIMIT ?
      `);
      const results = await stmt.bind(cursorId, limit + 1).all<CommentWithUserRow>();
      const comments = results.results.slice(0, limit).map(mapCommentWithUserRow);
      const hasMore = results.results.length > limit;
      const nextCursor = hasMore ? String(comments[comments.length - 1]?.id) : undefined;
      return { comments, nextCursor };
    } else {
      stmt = this.db.prepare(`
        SELECT 
          c.*,
          u.github_login as user_github_login,
          u.avatar_url as user_avatar_url,
          u.github_id as user_github_id
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.status = 'pending'
        ORDER BY c.id DESC
        LIMIT ?
      `);
      const results = await stmt.bind(limit + 1).all<CommentWithUserRow>();
      const comments = results.results.slice(0, limit).map(mapCommentWithUserRow);
      const hasMore = results.results.length > limit;
      const nextCursor = hasMore ? String(comments[comments.length - 1]?.id) : undefined;
      return { comments, nextCursor };
    }
  }

  /**
   * Get pending comments for moderation (offset-based, deprecated)
   */
  async getPendingOffset(limit: number = 20, offset: number = 0): Promise<CommentWithUser[]> {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.github_login as user_github_login,
        u.avatar_url as user_avatar_url,
        u.github_id as user_github_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'pending'
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const results = await stmt.bind(limit, offset).all<CommentWithUserRow>();
    return results.results.map(mapCommentWithUserRow);
  }

  /**
   * Find comment by ID
   */
  async findById(commentId: number): Promise<Comment | null> {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?');
    const result = await stmt.bind(commentId).first<CommentRow>();
    return result ? mapCommentRow(result) : null;
  }

  /**
   * Count user's recent comments (for rate limiting)
   */
  async countRecentByUser(userId: number, seconds: number): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM comments 
      WHERE user_id = ? 
        AND created_at > datetime('now', '-' || ? || ' seconds')
    `);

    const result = await stmt.bind(userId, seconds).first<{ count: number }>();
    return result?.count || 0;
  }

  /**
   * Check if parent comment exists and belongs to same post
   */
  async validateParent(parentId: number, postSlug: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM comments 
      WHERE id = ? AND post_slug = ?
    `);

    const result = await stmt.bind(parentId, postSlug).first<{ count: number }>();
    return (result?.count || 0) > 0;
  }

  /**
   * Pin a comment
   */
  async pin(commentId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE comments 
      SET is_pinned = 1, pinned_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(commentId).run();
  }

  /**
   * Unpin a comment
   */
  async unpin(commentId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE comments 
      SET is_pinned = 0, pinned_at = NULL, updated_at = datetime('now')
      WHERE id = ?
    `);

    await stmt.bind(commentId).run();
  }

  /**
   * Get approved comments for a post with user info, pinned comments first
   */
  async getApprovedForPostWithPinned(postSlug: string): Promise<CommentWithUser[]> {
    const stmt = this.db.prepare(`
      SELECT 
        c.*,
        u.github_login as user_github_login,
        u.avatar_url as user_avatar_url,
        u.github_id as user_github_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_slug = ? AND c.status = 'approved'
      ORDER BY c.is_pinned DESC, c.pinned_at DESC, c.created_at ASC
    `);

    const results = await stmt.bind(postSlug).all<CommentWithUserRow>();
    return results.results.map(mapCommentWithUserRow);
  }
}

/**
 * Audit Log Queries
 */
export class AuditLogQueries {
  constructor(private db: D1Database) {}

  /**
   * Create audit log entry
   */
  async create(logData: {
    actorUserId: number;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    detailJson: string;
  }): Promise<AuditLog> {
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, detail_json)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `);

    const result = await stmt
      .bind(
        logData.actorUserId,
        logData.action,
        logData.targetType,
        logData.targetId,
        logData.detailJson
      )
      .first<AuditLogRow>();

    if (!result) {
      throw new Error('Failed to create audit log');
    }

    return mapAuditLogRow(result);
  }

  /**
   * Get audit logs for a specific target
   */
  async getForTarget(
    targetType: AuditTargetType,
    targetId: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      WHERE target_type = ? AND target_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const results = await stmt.bind(targetType, targetId, limit).all<AuditLogRow>();
    return results.results.map(mapAuditLogRow);
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit: number = 100): Promise<AuditLog[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const results = await stmt.bind(limit).all<AuditLogRow>();
    return results.results.map(mapAuditLogRow);
  }
}

/**
 * Site Config Queries
 */
export class SiteConfigQueries {
  constructor(private db: D1Database) {}

  /**
   * Default site configuration values
   */
  private readonly defaults: SiteConfig = {
    siteName: 'Orin Blog',
    logoUrl: '',
    ownerName: '',
    ownerAvatar: '',
    description: '',
    backgroundMode: 'solid',
    backgroundColor: '#fafaf9',
    backgroundImageUrl: '',
    defaultTheme: 'auto',
    ownerGithubId: '',
  };

  /**
   * Map database key to SiteConfig key
   */
  private readonly keyMap: Record<string, SiteConfigKey> = {
    site_name: 'siteName',
    logo_url: 'logoUrl',
    owner_name: 'ownerName',
    owner_avatar: 'ownerAvatar',
    description: 'description',
    background_mode: 'backgroundMode',
    background_color: 'backgroundColor',
    background_image_url: 'backgroundImageUrl',
    default_theme: 'defaultTheme',
    owner_github_id: 'ownerGithubId',
  };

  /**
   * Map SiteConfig key to database key
   */
  private readonly reverseKeyMap: Record<SiteConfigKey, string> = {
    siteName: 'site_name',
    logoUrl: 'logo_url',
    ownerName: 'owner_name',
    ownerAvatar: 'owner_avatar',
    description: 'description',
    backgroundMode: 'background_mode',
    backgroundColor: 'background_color',
    backgroundImageUrl: 'background_image_url',
    defaultTheme: 'default_theme',
    ownerGithubId: 'owner_github_id',
  };

  /**
   * Get a single config value
   */
  async get<K extends SiteConfigKey>(key: K): Promise<SiteConfig[K]> {
    const dbKey = this.reverseKeyMap[key];
    const stmt = this.db.prepare('SELECT value FROM site_config WHERE key = ?');
    const result = await stmt.bind(dbKey).first<SiteConfigRow>();

    if (!result) {
      return this.defaults[key];
    }

    return result.value as SiteConfig[K];
  }

  /**
   * Get all config values
   */
  async getAll(): Promise<SiteConfig> {
    const stmt = this.db.prepare('SELECT key, value FROM site_config');
    const results = await stmt.all<SiteConfigRow>();

    const config: SiteConfig = { ...this.defaults };

    for (const row of results.results) {
      const configKey = this.keyMap[row.key];
      if (configKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config as any)[configKey] = row.value;
      }
    }

    return config;
  }

  /**
   * Set a single config value
   */
  async set<K extends SiteConfigKey>(key: K, value: SiteConfig[K]): Promise<void> {
    const dbKey = this.reverseKeyMap[key];
    const stmt = this.db.prepare(`
      INSERT INTO site_config (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `);

    await stmt.bind(dbKey, String(value)).run();
  }

  /**
   * Set multiple config values
   */
  async setAll(config: Partial<SiteConfig>): Promise<void> {
    const entries = Object.entries(config) as [SiteConfigKey, string][];

    for (const [key, value] of entries) {
      if (value !== undefined) {
        await this.set(key, value as SiteConfig[typeof key]);
      }
    }
  }

  /**
   * Delete a config value (reset to default)
   */
  async delete(key: SiteConfigKey): Promise<void> {
    const dbKey = this.reverseKeyMap[key];
    const stmt = this.db.prepare('DELETE FROM site_config WHERE key = ?');
    await stmt.bind(dbKey).run();
  }
}

/**
 * Post Metadata Queries
 */
export class PostMetadataQueries {
  constructor(private db: D1Database) {}

  /**
   * Get post metadata by slug
   */
  async findBySlug(slug: string): Promise<PostMetadata | null> {
    const stmt = this.db.prepare('SELECT * FROM post_metadata WHERE slug = ?');
    const result = await stmt.bind(slug).first<PostMetadataRow>();

    if (!result) {
      return null;
    }

    return {
      slug: result.slug,
      isPinned: Boolean(result.is_pinned),
      pinnedAt: result.pinned_at || undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  /**
   * Pin a post
   */
  async pin(slug: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO post_metadata (slug, is_pinned, pinned_at, updated_at)
      VALUES (?, 1, datetime('now'), datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        is_pinned = 1,
        pinned_at = datetime('now'),
        updated_at = datetime('now')
    `);

    await stmt.bind(slug).run();
  }

  /**
   * Unpin a post
   */
  async unpin(slug: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE post_metadata 
      SET is_pinned = 0, pinned_at = NULL, updated_at = datetime('now')
      WHERE slug = ?
    `);

    await stmt.bind(slug).run();
  }

  /**
   * Get all pinned posts (ordered by pinned_at)
   */
  async getPinned(): Promise<PostMetadata[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM post_metadata 
      WHERE is_pinned = 1 
      ORDER BY pinned_at DESC
    `);

    const results = await stmt.all<PostMetadataRow>();

    return results.results.map((row) => ({
      slug: row.slug,
      isPinned: Boolean(row.is_pinned),
      pinnedAt: row.pinned_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Check if a post is pinned
   */
  async isPinned(slug: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT is_pinned FROM post_metadata WHERE slug = ?');
    const result = await stmt.bind(slug).first<{ is_pinned: number }>();
    return Boolean(result?.is_pinned);
  }
}

/**
 * Database Query Factory
 * Provides access to all query classes
 */
export class DatabaseQueries {
  public readonly users: UserQueries;
  public readonly sessions: SessionQueries;
  public readonly comments: CommentQueries;
  public readonly auditLogs: AuditLogQueries;
  public readonly siteConfig: SiteConfigQueries;
  public readonly postMetadata: PostMetadataQueries;

  constructor(db: D1Database) {
    this.users = new UserQueries(db);
    this.sessions = new SessionQueries(db);
    this.comments = new CommentQueries(db);
    this.auditLogs = new AuditLogQueries(db);
    this.siteConfig = new SiteConfigQueries(db);
    this.postMetadata = new PostMetadataQueries(db);
  }
}

/**
 * Helper function to build comment tree from flat list
 * This is used to convert the flat comment list into a nested tree structure
 */
export function buildCommentTree(comments: CommentWithUser[]): CommentTree[] {
  const commentMap = new Map<number, CommentTree>();
  const rootComments: CommentTree[] = [];

  // First pass: create all comment nodes
  for (const comment of comments) {
    const treeNode: CommentTree = {
      ...comment,
      children: [],
    };
    commentMap.set(comment.id, treeNode);
  }

  // Second pass: build the tree structure
  for (const comment of comments) {
    const treeNode = commentMap.get(comment.id)!;

    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Parent not found (maybe not approved), treat as root comment
        rootComments.push(treeNode);
      }
    } else {
      rootComments.push(treeNode);
    }
  }

  return rootComments;
}
