/**
 * Comment Molecules - Public Interface
 *
 * Components for the comment system including section, list, item, and form.
 *
 * @module molecules/comment
 */

// React components
export { CommentSection } from './CommentSection';
export { CommentList } from './CommentList';
export { CommentItem } from './CommentItem';
export { CommentForm } from './CommentForm';

// Types
export type {
  CurrentUser,
  CommentFormData,
  CommentSubmitResult,
  CommentSectionProps,
  CommentListProps,
  CommentItemProps,
  CommentFormProps,
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
} from './types';

// API functions
export {
  fetchCurrentUser,
  fetchComments,
  fetchSiteConfig,
  submitComment,
  getLoginUrl,
  logout,
} from './api';
