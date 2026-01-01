import { useState } from 'react';
import { adminApi } from '../services/api';
import styles from './UsersPage.module.css';

export function UsersPage() {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();

    const id = parseInt(userId, 10);
    if (isNaN(id) || id <= 0) {
      setMessage({ type: 'error', text: '请输入有效的用户 ID' });
      return;
    }

    if (!reason.trim()) {
      setMessage({ type: 'error', text: '请输入封禁原因' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const success = await adminApi.banUser(id, reason.trim());
      if (success) {
        setMessage({ type: 'success', text: `用户 ${id} 已被封禁` });
        setUserId('');
        setReason('');
      } else {
        setMessage({ type: 'error', text: '封禁失败，请检查用户 ID 是否正确' });
      }
    } catch (_error) {
      setMessage({ type: 'error', text: '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>用户管理</h1>

      <div className={styles.info}>
        <p>在此页面可以封禁违规用户。封禁后，用户将无法登录或发表评论。</p>
        <p>用户 ID 可以在评论审核页面或数据库中查看。</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>封禁用户</h2>

        {message && (
          <div className={styles.message} data-type={message.type}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleBan} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="userId">用户 ID</label>
            <input
              id="userId"
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="输入用户 ID"
              min="1"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="reason">封禁原因</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="输入封禁原因"
              rows={3}
            />
          </div>

          <button type="submit" className={styles.banBtn} disabled={loading}>
            {loading ? '处理中...' : '封禁用户'}
          </button>
        </form>
      </div>
    </div>
  );
}
