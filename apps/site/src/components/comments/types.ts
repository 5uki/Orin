/**
 * Comment Component Types
 *
 * Type definitions for the comment system React components.
 */

import type { CommentTree, User, CommentStatus } from '@orin/shared/types';

/**
 * Current user state for comment components
 */
export interface CurrentUser {
  user: User | null;
  isAdmin: boolean;
}

/**
 * Comment form data
 */
export interface CommentFormData {
  content: string;
  parentId?: number;
  turnstileToken?: string;
}

/**
 * Comment submission result
 */
export interface CommentSubmitResult {
  commentId: number;
  status: CommentStatus;
}

/**
 * Props for the main CommentSection component
 */
export interface CommentSectionProps {
  postSlug: string;
  turnstileSiteKey?: string;
}

/**
 * Props for the CommentList component
 */
export interface CommentListProps {
  comments: CommentTree[];
  onReply: (commentId: number) => void;
  currentUser: CurrentUser | null;
  ownerGithubId?: string;
}

/**
 * Props for a single CommentItem component
 */
export interface CommentItemProps {
  comment: CommentTree;
  depth: number;
  onReply: (commentId: number) => void;
  currentUser: CurrentUser | null;
  ownerGithubId?: string;
}

/**
 * Props for the CommentForm component
 */
export interface CommentFormProps {
  postSlug: string;
  parentId?: number;
  onSubmit: (data: CommentFormData) => Promise<CommentSubmitResult>;
  onCancel?: () => void;
  isSubmitting: boolean;
  turnstileSiteKey?: string;
}

/**
 * API response types
 */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
