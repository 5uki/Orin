import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../services/api';
import type { PendingComment } from '@orin/shared/types';
import styles from './CommentsPage.module.css';

export function CommentsPage() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const result = await adminApi.getPendingComments(20, cursor);
      if ('comments' in result) {
        setComments((prev) => (cursor ? [...prev, ...result.comments] : result.comments));
        setNextCursor(result.nextCursor);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    setError(null);
    try {
      const success = await adminApi.approveComment(id);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to approve comment:', error);
      setError('批准评论失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    setError(null);
    try {
      const success = await adminApi.rejectComment(id);
      if (success) {
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error('Failed to reject comment:', error);
      setError('拒绝评论失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePin = async (id: number) => {
    setActionLoading(id);
    setError(null);
    try {
      const result = await adminApi.pinComment(id);
      if ('error' in result) {
        setError(result.error.message);
      } else {
        // Update the comment in the list to show pinned status
        setComments((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, isPinned: true, pinnedAt: new Date().toISOString() } : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to pin comment:', error);
      setError('置顶评论失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpin = async (id: number) => {
    setActionLoading(id);
    setError(null);
    try {
      const result = await adminApi.unpinComment(id);
      if ('error' in result) {
        setError(result.error.message);
      } else {
        // Update the comment in the list to show unpinned status
        setComments((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isPinned: false, pinnedAt: undefined } : c))
        );
      }
    } catch (error) {
      console.error('Failed to unpin comment:', error);
      setError('取消置顶失败');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>评论审核</h1>

      {error && (
        <div className={styles.error}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {loading && comments.length === 0 ? (
        <p className={styles.loading}>加载中...</p>
      ) : comments.length === 0 ? (
        <div className={styles.empty}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>没有待审核的评论</p>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={`${styles.item} ${comment.isPinned ? styles.pinnedItem : ''}`}
              >
                <div className={styles.itemHeader}>
                  <img
                    src={comment.user.avatarUrl}
                    alt={comment.user.githubLogin}
                    className={styles.avatar}
                  />
                  <div className={styles.meta}>
                    <span className={styles.author}>{comment.user.githubLogin}</span>
                    {comment.isPinned && (
                      <span className={styles.pinnedBadge}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        已置顶
                      </span>
                    )}
                    <span className={styles.post}>在 {comment.postSlug}</span>
                    <span className={styles.time}>
                      {new Date(comment.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                </div>

                <div className={styles.content}>{comment.content}</div>

                <div className={styles.itemFooter}>
                  <div className={styles.scores}>
                    {comment.aiScore !== undefined && (
                      <span
                        className={styles.score}
                        data-level={
                          comment.aiScore >= 0.7
                            ? 'high'
                            : comment.aiScore >= 0.3
                              ? 'medium'
                              : 'low'
                        }
                      >
                        AI: {(comment.aiScore * 100).toFixed(0)}%
                      </span>
                    )}
                    {comment.ruleScore > 0 && (
                      <span className={styles.score} data-level="high">
                        规则: {comment.ruleScore}
                      </span>
                    )}
                    {comment.ruleFlags && comment.ruleFlags.length > 0 && (
                      <span className={styles.flags}>{comment.ruleFlags.join(', ')}</span>
                    )}
                  </div>

                  <div className={styles.actions}>
                    {comment.isPinned ? (
                      <button
                        onClick={() => handleUnpin(comment.id)}
                        className={styles.unpinBtn}
                        disabled={actionLoading === comment.id}
                      >
                        {actionLoading === comment.id ? '处理中...' : '取消置顶'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePin(comment.id)}
                        className={styles.pinBtn}
                        disabled={actionLoading === comment.id}
                      >
                        {actionLoading === comment.id ? '处理中...' : '置顶'}
                      </button>
                    )}
                    <button
                      onClick={() => handleReject(comment.id)}
                      className={styles.rejectBtn}
                      disabled={actionLoading === comment.id}
                    >
                      拒绝
                    </button>
                    <button
                      onClick={() => handleApprove(comment.id)}
                      className={styles.approveBtn}
                      disabled={actionLoading === comment.id}
                    >
                      批准
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nextCursor && (
            <button
              onClick={() => loadComments(nextCursor)}
              className={styles.loadMore}
              disabled={loading}
            >
              {loading ? '加载中...' : '加载更多'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
