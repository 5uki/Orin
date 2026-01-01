/**
 * CommentItem Component
 *
 * Renders a single comment with user info, content, and reply button.
 * Supports nested comments (replies) with visual indentation.
 * Shows blog owner badge and pinned indicator.
 *
 * Requirements: 5.1, 8.1, 8.2, 8.3, 6.3
 */

import type { CommentTree } from '@orin/shared/types';
import type { CommentItemProps } from './types';
import { renderSafeMarkdown, formatDate, escapeHtml } from './safe-render';
import styles from './Comments.module.css';

const MAX_DEPTH = 4;

export function CommentItem({
  comment,
  depth,
  onReply,
  currentUser,
  ownerGithubId,
}: CommentItemProps) {
  const canReply = currentUser?.user !== null && depth < MAX_DEPTH;
  const isOwner = ownerGithubId && comment.user.githubId === ownerGithubId;
  const isPinned = comment.isPinned;

  const handleReply = () => {
    onReply(comment.id);
  };

  // Safely render the comment content
  const safeContent = renderSafeMarkdown(comment.content);

  // Build class names for comment item
  const commentItemClasses = [
    styles.commentItem,
    isOwner ? styles.ownerComment : '',
    isPinned ? styles.pinnedComment : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={commentItemClasses}
      style={{ marginLeft: depth > 0 ? `${Math.min(depth, MAX_DEPTH) * 24}px` : '0' }}
    >
      {isPinned && (
        <div className={styles.pinnedIndicator}>
          <span className={styles.pinnedIcon}>📌</span>
          <span>置顶评论</span>
        </div>
      )}
      <div className={styles.commentHeader}>
        <img
          src={comment.user.avatarUrl}
          alt={`${escapeHtml(comment.user.githubLogin)}'s avatar`}
          className={styles.avatar}
          width={32}
          height={32}
          loading="lazy"
        />
        <div className={styles.commentMeta}>
          <div className={styles.authorInfo}>
            <a
              href={`https://github.com/${encodeURIComponent(comment.user.githubLogin)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.authorName}
            >
              {escapeHtml(comment.user.githubLogin)}
            </a>
            {isOwner && <span className={styles.ownerBadge}>博主</span>}
          </div>
          <time className={styles.commentTime} dateTime={comment.createdAt}>
            {formatDate(comment.createdAt)}
          </time>
        </div>
      </div>

      <div className={styles.commentContent} dangerouslySetInnerHTML={{ __html: safeContent }} />

      {canReply && (
        <div className={styles.commentActions}>
          <button type="button" onClick={handleReply} className={styles.replyButton}>
            回复
          </button>
        </div>
      )}

      {comment.children.length > 0 && (
        <div className={styles.replies}>
          {comment.children.map((child: CommentTree) => (
            <CommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              onReply={onReply}
              currentUser={currentUser}
              ownerGithubId={ownerGithubId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentItem;
