/**
 * Shared Zod validators for Orin Blog System
 */
import { z } from 'zod';

// Error codes enum
export const ErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'RATE_LIMITED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
]);

// Comment status enum
export const CommentStatusSchema = z.enum(['pending', 'approved', 'rejected', 'deleted']);

// Moderation source enum
export const ModerationSourceSchema = z.enum(['rules', 'ai', 'manual', 'fallback']);

// Trust level (0-3)
export const TrustLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

// Audit action enum
export const AuditActionSchema = z.enum([
  'POST_PUBLISH',
  'POST_UPDATE',
  'POST_UNPUBLISH',
  'COMMENT_APPROVE',
  'COMMENT_REJECT',
  'USER_BAN',
  'USER_UNBAN',
  'USER_TRUST_UPDATE',
]);

// Audit target type enum
export const AuditTargetTypeSchema = z.enum(['post', 'comment', 'user']);

/**
 * API Error Response Schema
 */
export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

/**
 * Comment content validation (1-2000 characters)
 * Requirements: 5.4
 */
export const CommentContentSchema = z
  .string()
  .min(1, 'Comment content is required')
  .max(2000, 'Comment content must not exceed 2000 characters');

/**
 * Post slug validation
 * Format: YYYY-MM-DD-slug-text (3-80 chars for slug part)
 * Requirements: 9.2, 9.4
 */
export const PostSlugSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,80}$/,
    'Slug must be in format: YYYY-MM-DD-slug-text (lowercase letters, numbers, hyphens only)'
  );

/**
 * Comment submission request schema
 * Requirements: 5.2, 5.3, 5.4
 */
export const CommentSubmitSchema = z.object({
  post: z.string().min(1, 'Post slug is required'),
  parentId: z.number().int().positive().optional(),
  content: CommentContentSchema,
  turnstileToken: z.string().optional(),
});

/**
 * Get comments request schema
 */
export const GetCommentsSchema = z.object({
  post: z.string().min(1, 'Post slug is required'),
});

/**
 * Publish post request schema
 * Requirements: 9.1, 9.2
 */
export const PublishPostSchema = z.object({
  slug: PostSlugSchema,
  content: z.string().min(1, 'Post content is required'),
  commitMessage: z.string().min(1, 'Commit message is required').max(200),
});

/**
 * Update post request schema
 * Requirements: 10.1
 */
export const UpdatePostSchema = z.object({
  content: z.string().min(1, 'Post content is required'),
  commitMessage: z.string().min(1, 'Commit message is required').max(200),
});

/**
 * Ban user request schema
 * Requirements: 11.4
 */
export const BanUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required').max(500),
});

/**
 * Pagination query schema
 */
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * OAuth callback query schema
 */
export const OAuthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State parameter is required'),
});

/**
 * OAuth start query schema
 */
export const OAuthStartSchema = z.object({
  redirect: z.string().url().optional(),
});

// Type exports from schemas
export type CommentSubmitInput = z.infer<typeof CommentSubmitSchema>;
export type GetCommentsInput = z.infer<typeof GetCommentsSchema>;
export type PublishPostInput = z.infer<typeof PublishPostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type BanUserInput = z.infer<typeof BanUserSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
export type OAuthCallbackInput = z.infer<typeof OAuthCallbackSchema>;
export type OAuthStartInput = z.infer<typeof OAuthStartSchema>;
