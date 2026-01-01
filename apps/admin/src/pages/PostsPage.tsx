import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/api';
import type { PostMetadata } from '@orin/shared/types';
import styles from './PostsPage.module.css';

export function PostsPage() {
  const [pinnedPosts, setPinnedPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pinSlug, setPinSlug] = useState('');

  const fetchPinnedPosts = useCallback(async () => {
    try {
      const result = await adminApi.getPinnedPosts();
      if (Array.isArray(result)) {
        setPinnedPosts(result);
      } else if ('error' in result) {
        setError(result.error.message);
      }
    } catch (_err) {
      setError('获取置顶文章失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPinnedPosts();
  }, [fetchPinnedPosts]);

  const handlePin = async (slug: string) => {
    if (!slug.trim()) return;

    setActionLoading(slug);
    setError(null);

    try {
      const result = await adminApi.pinPost(slug);
      if ('error' in result) {
        setError(result.error.message);
      } else {
        await fetchPinnedPosts();
        setPinSlug('');
      }
    } catch (_err) {
      setError('置顶文章失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpin = async (slug: string) => {
    setActionLoading(slug);
    setError(null);

    try {
      const result = await adminApi.unpinPost(slug);
      if ('error' in result) {
        setError(result.error.message);
      } else {
        await fetchPinnedPosts();
      }
    } catch (_err) {
      setError('取消置顶失败');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>文章管理</h1>
        <Link to="/posts/new" className={styles.newBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建文章
        </Link>
      </div>

      <div className={styles.info}>
        <p>
          文章存储在 GitHub 仓库的 <code>content/posts/</code> 目录中。
        </p>
        <p>您可以在此创建新文章或编辑现有文章，更改将自动提交到仓库。</p>
      </div>

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

      {/* Pin a post section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>置顶文章</h2>
        <div className={styles.pinForm}>
          <input
            type="text"
            value={pinSlug}
            onChange={(e) => setPinSlug(e.target.value)}
            placeholder="输入文章 slug（如：2025-12-31-hello-world）"
            className={styles.pinInput}
          />
          <button
            onClick={() => handlePin(pinSlug)}
            disabled={!pinSlug.trim() || actionLoading === pinSlug}
            className={styles.pinBtn}
          >
            {actionLoading === pinSlug ? '处理中...' : '置顶'}
          </button>
        </div>
        <p className={styles.hint}>
          文章 slug 是文件名去掉 .mdx 后缀，例如 <code>2025-12-31-hello-world</code>
        </p>
      </div>

      {/* Pinned posts list */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          已置顶文章
          {pinnedPosts.length > 0 && <span className={styles.badge}>{pinnedPosts.length}</span>}
        </h2>

        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : pinnedPosts.length === 0 ? (
          <div className={styles.empty}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <p>暂无置顶文章</p>
          </div>
        ) : (
          <div className={styles.postList}>
            {pinnedPosts.map((post) => (
              <div key={post.slug} className={styles.postItem}>
                <div className={styles.postInfo}>
                  <div className={styles.postSlug}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles.pinIcon}
                    >
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                    </svg>
                    {post.slug}
                  </div>
                  {post.pinnedAt && (
                    <div className={styles.postDate}>置顶于 {formatDate(post.pinnedAt)}</div>
                  )}
                </div>
                <div className={styles.postActions}>
                  <Link to={`/posts/${post.slug}/edit`} className={styles.editBtn}>
                    编辑
                  </Link>
                  <button
                    onClick={() => handleUnpin(post.slug)}
                    disabled={actionLoading === post.slug}
                    className={styles.unpinBtn}
                  >
                    {actionLoading === post.slug ? '处理中...' : '取消置顶'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.placeholder}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p>点击"新建文章"开始创作</p>
      </div>
    </div>
  );
}
