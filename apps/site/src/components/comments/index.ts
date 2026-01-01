/**
 * Comment Components
 *
 * Export all comment-related components and utilities.
 */

export { CommentSection } from './CommentSection';
export { CommentList } from './CommentList';
export { CommentItem } from './CommentItem';
export { CommentForm } from './CommentForm';

// Safe rendering utilities
export {
  escapeHtml,
  renderSafeMarkdown,
  stripHtml,
  containsHtml,
  validateSafeOutput,
  formatDate,
} from './safe-render';

// API functions
export { fetchCurrentUser, fetchComments, submitComment, getLoginUrl, logout } from './api';

// Types
export type {
  CommentSectionProps,
  CommentListProps,
  CommentItemProps,
  CommentFormProps,
  CurrentUser,
  CommentFormData,
  CommentSubmitResult,
} from './types';
