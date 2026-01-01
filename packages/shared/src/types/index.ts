/**
 * Shared TypeScript types for Orin Blog System
 */

// Trust level enum (0-3)
export type TrustLevel = 0 | 1 | 2 | 3;

// Comment status enum
export type CommentStatus = 'pending' | 'approved' | 'rejected' | 'deleted';

// Moderation source enum
export type ModerationSource = 'rules' | 'ai' | 'manual' | 'fallback';

// Audit action enum
export type AuditAction =
  | 'POST_PUBLISH'
  | 'POST_UPDATE'
  | 'POST_UNPUBLISH'
  | 'COMMENT_APPROVE'
  | 'COMMENT_REJECT'
  | 'USER_BAN'
  | 'USER_UNBAN'
  | 'USER_TRUST_UPDATE';

// Audit target type enum
export type AuditTargetType = 'post' | 'comment' | 'user';

// API error codes
export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

/**
 * User entity
 */
export interface User {
  id: number;
  githubId: string;
  githubLogin: string;
  avatarUrl: string;
  email?: string;
  trustLevel: TrustLevel;
  isBanned: boolean;
  banReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Session entity
 */
export interface Session {
  id: string;
  userId: number;
  isAdmin: boolean;
  expiresAt: string;
  revokedAt?: string;
  userAgent?: string;
  ipHash?: string;
  createdAt: string;
}

/**
 * Comment entity
 */
export interface Comment {
  id: number;
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
  isPinned: boolean;
  pinnedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Comment with user info for display
 */
export interface CommentWithUser extends Comment {
  user: Pick<User, 'githubLogin' | 'avatarUrl' | 'githubId'>;
}

/**
 * Comment tree node (nested comments)
 */
export interface CommentTree extends CommentWithUser {
  children: CommentTree[];
}

/**
 * Audit log entity
 */
export interface AuditLog {
  id: number;
  actorUserId: number;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  detailJson: string;
  createdAt: string;
}

/**
 * API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data?: T;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
  };
}

/**
 * API response union type
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Current user response
 */
export interface CurrentUserResponse {
  user: User | null;
  isAdmin: boolean;
}

/**
 * Comment list response
 */
export interface CommentListResponse {
  post: string;
  comments: CommentTree[];
}

/**
 * Comment submit response
 */
export interface CommentSubmitResponse {
  commentId: number;
  status: CommentStatus;
}

/**
 * Publish post response
 */
export interface PublishPostResponse {
  slug: string;
  commitSha: string;
  url: string;
}

/**
 * Update post response
 */
export interface UpdatePostResponse {
  slug: string;
  commitSha: string;
}

/**
 * Pending comment for admin review
 */
export interface PendingComment extends CommentWithUser {
  postSlug: string;
}

/**
 * Pending comments list response
 */
export interface PendingCommentsResponse {
  comments: PendingComment[];
  nextCursor?: string;
}

/**
 * Site configuration entity
 */
export interface SiteConfig {
  siteName: string;
  logoUrl: string;
  ownerName: string;
  ownerAvatar: string;
  description: string;
  backgroundMode: 'solid' | 'image';
  backgroundColor: string;
  backgroundImageUrl: string;
  defaultTheme: 'light' | 'dark' | 'auto';
  ownerGithubId: string;
}

/**
 * Site configuration keys
 */
export type SiteConfigKey = keyof SiteConfig;

/**
 * Post metadata entity (for pinning and other features)
 */
export interface PostMetadata {
  slug: string;
  isPinned: boolean;
  pinnedAt?: string;
  createdAt: string;
  updatedAt: string;
}
