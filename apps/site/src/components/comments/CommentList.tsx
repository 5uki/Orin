/**
 * CommentList Component
 *
 * Renders a list of comments in tree structure.
 * Only displays approved comments.
 * Pinned comments are displayed first, sorted by pinned timestamp.
 *
 * Requirements: 5.1, 6.2, 6.4
 */

import type { CommentListProps } from './types';
import type { CommentTree } from '@orin/shared/types';
import { CommentItem } from './CommentItem';
import styles from './Comments.module.css';

/**
 * Sort comments with pinned comments first, then by pinned timestamp
 */
function sortCommentsWithPinned(comments: CommentTree[]): CommentTree[] {
  return [...comments].sort((a, b) => {
    // Pinned comments come first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Both pinned: sort by pinnedAt (most recent first)
    if (a.isPinned && b.isPinned) {
      const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
      const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
      return bTime - aTime;
    }

    // Both unpinned: maintain original order (by createdAt)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function CommentList({ comments, onReply, currentUser, ownerGithubId }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>暂无评论，来发表第一条评论吧！</p>
      </div>
    );
  }

  // Sort comments with pinned first
  const sortedComments = sortCommentsWithPinned(comments);

  return (
    <div className={styles.commentList}>
      {sortedComments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          depth={0}
          onReply={onReply}
          currentUser={currentUser}
          ownerGithubId={ownerGithubId}
        />
      ))}
    </div>
  );
}

export default CommentList;
