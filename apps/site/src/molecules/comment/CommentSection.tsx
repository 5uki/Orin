/**
 * CommentSection Component
 *
 * Main comment section component that combines comment list and form.
 * Handles user authentication state and comment submission.
 * Fetches site config to identify blog owner.
 *
 * @module molecules/comment
 */

import { useState, useEffect, useCallback } from 'react';
import type { CommentSectionProps, CurrentUser, CommentFormData } from './types';
import type { CommentTree } from '@orin/shared/types';
import {
  fetchCurrentUser,
  fetchComments,
  fetchSiteConfig,
  submitComment,
  getLoginUrl,
} from './api';
import { CommentList } from './CommentList';
import { CommentForm } from './CommentForm';
import styles from './Comments.module.css';

export function CommentSection({ postSlug, turnstileSiteKey }: CommentSectionProps) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [comments, setComments] = useState<CommentTree[]>([]);
  const [ownerGithubId, setOwnerGithubId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch user, comments, and site config on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const [user, commentList, siteConfig] = await Promise.all([
          fetchCurrentUser(),
          fetchComments(postSlug),
          fetchSiteConfig(),
        ]);

        setCurrentUser(user);
        setComments(commentList);
        setOwnerGithubId(siteConfig?.ownerGithubId || undefined);
      } catch {
        setError('加载评论失败');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [postSlug]);

  const handleReply = useCallback((commentId: number) => {
    setReplyingTo(commentId);
    setSubmitMessage(null);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleSubmit = useCallback(
    async (data: CommentFormData) => {
      setIsSubmitting(true);
      setSubmitMessage(null);
      setError(null);

      try {
        const result = await submitComment(postSlug, data);

        if (!result.ok) {
          throw new Error(result.error.message);
        }

        // Show appropriate message based on status
        if (result.data.status === 'approved') {
          setSubmitMessage('评论发布成功！');
          // Refresh comments to show the new one
          const updatedComments = await fetchComments(postSlug);
          setComments(updatedComments);
        } else if (result.data.status === 'pending') {
          setSubmitMessage('评论已提交，等待审核后显示。');
        } else {
          setSubmitMessage('评论发布失败。');
        }

        // Clear reply state
        setReplyingTo(null);

        return result.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : '评论提交失败';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [postSlug]
  );

  const loginUrl = getLoginUrl(
    typeof window !== 'undefined' ? window.location.pathname : undefined
  );

  if (isLoading) {
    return (
      <div className={styles.commentSection}>
        <h2 className={styles.sectionTitle}>评论</h2>
        <div className={styles.loading}>加载评论中...</div>
      </div>
    );
  }

  return (
    <div className={styles.commentSection}>
      <h2 className={styles.sectionTitle}>评论 {comments.length > 0 && `(${comments.length})`}</h2>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {submitMessage && (
        <div className={styles.success} role="status">
          {submitMessage}
        </div>
      )}

      {/* Comment form for logged-in users */}
      {currentUser?.user ? (
        <div className={styles.formWrapper}>
          <div className={styles.userInfo}>
            <img
              src={currentUser.user.avatarUrl}
              alt={`${currentUser.user.githubLogin}'s avatar`}
              className={styles.userAvatar}
              width={24}
              height={24}
            />
            <span>以 {currentUser.user.githubLogin} 身份评论</span>
          </div>
          {replyingTo === null && (
            <CommentForm
              postSlug={postSlug}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              turnstileSiteKey={turnstileSiteKey}
            />
          )}
        </div>
      ) : (
        <div className={styles.loginPrompt}>
          <p>
            <a href={loginUrl} className={styles.loginLink}>
              使用 GitHub 登录
            </a>{' '}
            后发表评论。
          </p>
        </div>
      )}

      {/* Comment list */}
      <CommentList
        comments={comments}
        onReply={handleReply}
        currentUser={currentUser}
        ownerGithubId={ownerGithubId}
      />

      {/* Reply form (shown inline when replying) */}
      {replyingTo !== null && currentUser?.user && (
        <div className={styles.replyFormWrapper}>
          <CommentForm
            postSlug={postSlug}
            parentId={replyingTo}
            onSubmit={handleSubmit}
            onCancel={handleCancelReply}
            isSubmitting={isSubmitting}
            turnstileSiteKey={turnstileSiteKey}
          />
        </div>
      )}
    </div>
  );
}

export default CommentSection;
