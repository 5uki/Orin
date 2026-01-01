/**
 * CommentForm Component
 *
 * Form for submitting new comments or replies.
 * Includes content validation and optional Turnstile verification.
 *
 * Requirements: 5.2, 5.3, 5.4
 */

import { useState, useRef, useEffect } from 'react';
import type { CommentFormProps } from './types';
import styles from './Comments.module.css';

const MIN_LENGTH = 1;
const MAX_LENGTH = 2000;

export function CommentForm({
  parentId,
  onSubmit,
  onCancel,
  isSubmitting,
  turnstileSiteKey,
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Initialize Turnstile widget if site key is provided
  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;

    // Check if Turnstile script is loaded
    const win = window as Window & { turnstile?: TurnstileApi };
    if (!win.turnstile) {
      // Load Turnstile script
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        renderTurnstile();
      };
    } else {
      renderTurnstile();
    }

    function renderTurnstile() {
      const win = window as Window & { turnstile?: TurnstileApi };
      if (win.turnstile && turnstileRef.current) {
        win.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey!,
          callback: (token: string) => setTurnstileToken(token),
          'error-callback': () => setError('验证失败，请重试。'),
        });
      }
    }
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate content length
    const trimmedContent = content.trim();
    if (trimmedContent.length < MIN_LENGTH) {
      setError('评论内容不能为空');
      return;
    }
    if (trimmedContent.length > MAX_LENGTH) {
      setError(`评论内容不能超过 ${MAX_LENGTH} 个字符`);
      return;
    }

    try {
      await onSubmit({
        content: trimmedContent,
        parentId,
        turnstileToken: turnstileToken || undefined,
      });

      // Clear form on success
      setContent('');
      setTurnstileToken(null);

      // Reset Turnstile if present
      const win = window as Window & { turnstile?: TurnstileApi };
      if (win.turnstile && turnstileRef.current) {
        win.turnstile.reset(turnstileRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '评论提交失败');
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setError(null);
  };

  const remainingChars = MAX_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;

  return (
    <form onSubmit={handleSubmit} className={styles.commentForm}>
      {parentId && (
        <div className={styles.replyIndicator}>
          回复评论
          {onCancel && (
            <button type="button" onClick={onCancel} className={styles.cancelReply}>
              取消
            </button>
          )}
        </div>
      )}

      <div className={styles.formGroup}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder="写下你的评论... (支持 Markdown: **粗体**, *斜体*, `代码`)"
          className={styles.textarea}
          rows={4}
          disabled={isSubmitting}
          aria-label="评论内容"
          aria-describedby={error ? 'comment-error' : undefined}
        />
        <div className={styles.charCount} data-over={isOverLimit}>
          剩余 {remainingChars} 个字符
        </div>
      </div>

      {error && (
        <div id="comment-error" className={styles.error} role="alert">
          {error}
        </div>
      )}

      {turnstileSiteKey && <div ref={turnstileRef} className={styles.turnstile} />}

      <div className={styles.formActions}>
        <button
          type="submit"
          disabled={isSubmitting || isOverLimit || content.trim().length === 0}
          className={styles.submitButton}
        >
          {isSubmitting ? '提交中...' : parentId ? '回复' : '发表评论'}
        </button>
      </div>
    </form>
  );
}

/**
 * Turnstile API type
 */
interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback': () => void;
    }
  ) => string;
  reset: (element: HTMLElement) => void;
}

export default CommentForm;
