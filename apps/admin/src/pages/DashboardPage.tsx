import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../services/api';
import type { PendingComment } from '@orin/shared/types';
import styles from './DashboardPage.module.css';

interface DashboardStats {
  pendingComments: number;
  recentComments: PendingComment[];
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const result = await adminApi.getPendingComments(5);
        if ('comments' in result) {
          setStats({
            pendingComments: result.comments.length,
            recentComments: result.comments,
          });
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>仪表盘</h1>
        <p className={styles.loading}>加载中...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>仪表盘</h1>

      <div className={styles.statsGrid}>
        <Link to="/comments" className={styles.statCard}>
          <div className={styles.statValue}>{stats?.pendingComments ?? 0}</div>
          <div className={styles.statLabel}>待审核评论</div>
        </Link>
        <Link to="/posts/new" className={styles.statCard}>
          <div className={styles.statIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className={styles.statLabel}>发布新文章</div>
        </Link>
      </div>

      {stats && stats.recentComments.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>待审核评论</h2>
            <Link to="/comments">查看全部</Link>
          </div>
          <div className={styles.commentList}>
            {stats.recentComments.map((comment) => (
              <div key={comment.id} className={styles.commentItem}>
                <img
                  src={comment.user.avatarUrl}
                  alt={comment.user.githubLogin}
                  className={styles.commentAvatar}
                />
                <div className={styles.commentContent}>
                  <div className={styles.commentMeta}>
                    <span className={styles.commentAuthor}>{comment.user.githubLogin}</span>
                    <span className={styles.commentPost}>在 {comment.postSlug}</span>
                  </div>
                  <p className={styles.commentText}>{comment.content}</p>
                  {comment.aiScore !== undefined && (
                    <span
                      className={styles.aiScore}
                      data-level={
                        comment.aiScore >= 0.7 ? 'high' : comment.aiScore >= 0.3 ? 'medium' : 'low'
                      }
                    >
                      AI: {(comment.aiScore * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
