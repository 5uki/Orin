import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { isAuthenticated, isAdmin, isLoading, login, devLogin, isDevelopment } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [devUsername, setDevUsername] = useState('');
  const [devIsAdmin, setDevIsAdmin] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate, from]);

  const handleLogin = () => {
    login('/admin' + from);
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (devUsername.trim()) {
      await devLogin(devUsername.trim(), devIsAdmin);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Orin Blog Admin</h1>
        <p className={styles.subtitle}>使用 GitHub 账号登录管理后台</p>

        <button onClick={handleLogin} className={styles.loginBtn}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          使用 GitHub 登录
        </button>

        {isDevelopment && (
          <div className={styles.devSection}>
            <div className={styles.divider}>
              <span>或</span>
            </div>

            {!showDevLogin ? (
              <button onClick={() => setShowDevLogin(true)} className={styles.devToggleBtn}>
                开发模式登录
              </button>
            ) : (
              <form onSubmit={handleDevLogin} className={styles.devForm}>
                <h3 className={styles.devTitle}>开发模式登录</h3>
                <p className={styles.devSubtitle}>仅用于本地测试</p>

                <div className={styles.inputGroup}>
                  <label htmlFor="devUsername" className={styles.label}>
                    用户名
                  </label>
                  <input
                    id="devUsername"
                    type="text"
                    value={devUsername}
                    onChange={(e) => setDevUsername(e.target.value)}
                    placeholder="输入测试用户名"
                    className={styles.input}
                    required
                  />
                </div>

                <div className={styles.checkboxGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={devIsAdmin}
                      onChange={(e) => setDevIsAdmin(e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>管理员权限</span>
                  </label>
                </div>

                <div className={styles.devActions}>
                  <button type="submit" className={styles.devLoginBtn}>
                    登录
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDevLogin(false)}
                    className={styles.devCancelBtn}
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
