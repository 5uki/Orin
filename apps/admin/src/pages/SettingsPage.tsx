import { useState, useEffect, useCallback } from 'react';
import type { SiteConfig } from '@orin/shared/types';
import styles from './SettingsPage.module.css';

const API_BASE = '/api';

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function SettingsPage() {
  const [_config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [siteName, setSiteName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerAvatar, setOwnerAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [backgroundMode, setBackgroundMode] = useState<'solid' | 'image'>('solid');
  const [backgroundColor, setBackgroundColor] = useState('#fafaf9');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [defaultTheme, setDefaultTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [ownerGithubId, setOwnerGithubId] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/config`);
      const result = await response.json();

      if (result.ok && result.data) {
        const data = result.data as SiteConfig;
        setConfig(data);
        setSiteName(data.siteName || '');
        setLogoUrl(data.logoUrl || '');
        setOwnerName(data.ownerName || '');
        setOwnerAvatar(data.ownerAvatar || '');
        setDescription(data.description || '');
        setBackgroundMode(data.backgroundMode || 'solid');
        setBackgroundColor(data.backgroundColor || '#fafaf9');
        setBackgroundImageUrl(data.backgroundImageUrl || '');
        setDefaultTheme(data.defaultTheme || 'auto');
        setOwnerGithubId(data.ownerGithubId || '');
      }
    } catch (err) {
      setError('加载配置失败');
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          logoUrl,
          ownerName,
          ownerAvatar,
          description,
          backgroundMode,
          backgroundColor,
          backgroundImageUrl,
          defaultTheme,
          ownerGithubId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setSuccess('配置保存成功');
        setConfig(result.data);
      } else {
        setError(result.error?.message || '保存配置失败');
      }
    } catch (err) {
      setError('保存配置失败');
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>站点设置</h1>
      </div>

      {error && <div className={styles.alert + ' ' + styles.alertError}>{error}</div>}

      {success && <div className={styles.alert + ' ' + styles.alertSuccess}>{success}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 基本信息 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>基本信息</h2>

          <div className={styles.field}>
            <label htmlFor="siteName" className={styles.label}>
              站点名称
            </label>
            <input
              type="text"
              id="siteName"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className={styles.input}
              placeholder="Orin Blog"
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="logoUrl" className={styles.label}>
              Logo URL
            </label>
            <input
              type="url"
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className={styles.input}
              placeholder="https://example.com/logo.png"
              maxLength={500}
            />
            {logoUrl && (
              <div className={styles.preview}>
                <img src={logoUrl} alt="Logo 预览" className={styles.logoPreview} />
              </div>
            )}
          </div>
        </section>

        {/* 博主信息 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>博主信息</h2>

          <div className={styles.field}>
            <label htmlFor="ownerName" className={styles.label}>
              博主名称
            </label>
            <input
              type="text"
              id="ownerName"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={styles.input}
              placeholder="输入博主名称"
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="ownerAvatar" className={styles.label}>
              博主头像 URL
            </label>
            <input
              type="url"
              id="ownerAvatar"
              value={ownerAvatar}
              onChange={(e) => setOwnerAvatar(e.target.value)}
              className={styles.input}
              placeholder="https://example.com/avatar.png"
              maxLength={500}
            />
            {ownerAvatar && (
              <div className={styles.preview}>
                <img src={ownerAvatar} alt="头像预览" className={styles.avatarPreview} />
              </div>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="ownerGithubId" className={styles.label}>
              博主 GitHub ID
            </label>
            <input
              type="text"
              id="ownerGithubId"
              value={ownerGithubId}
              onChange={(e) => setOwnerGithubId(e.target.value)}
              className={styles.input}
              placeholder="用于识别博主评论"
              maxLength={50}
            />
            <p className={styles.hint}>填写博主的 GitHub 用户 ID，用于在评论区显示博主标识</p>
          </div>

          <div className={styles.field}>
            <label htmlFor="description" className={styles.label}>
              站点描述
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={styles.textarea}
              placeholder="输入站点描述..."
              maxLength={1000}
              rows={4}
            />
          </div>
        </section>

        {/* 背景设置 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>背景设置</h2>

          <div className={styles.field}>
            <label className={styles.label}>背景模式</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="backgroundMode"
                  value="solid"
                  checked={backgroundMode === 'solid'}
                  onChange={() => setBackgroundMode('solid')}
                  className={styles.radio}
                />
                <span>纯色背景</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="backgroundMode"
                  value="image"
                  checked={backgroundMode === 'image'}
                  onChange={() => setBackgroundMode('image')}
                  className={styles.radio}
                />
                <span>图片背景（带模糊效果）</span>
              </label>
            </div>
          </div>

          {backgroundMode === 'solid' && (
            <div className={styles.field}>
              <label htmlFor="backgroundColor" className={styles.label}>
                背景颜色
              </label>
              <div className={styles.colorInput}>
                <input
                  type="color"
                  id="backgroundColor"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className={styles.colorPicker}
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className={styles.input}
                  placeholder="#fafaf9"
                  maxLength={50}
                />
              </div>
            </div>
          )}

          {backgroundMode === 'image' && (
            <div className={styles.field}>
              <label htmlFor="backgroundImageUrl" className={styles.label}>
                背景图片 URL
              </label>
              <input
                type="url"
                id="backgroundImageUrl"
                value={backgroundImageUrl}
                onChange={(e) => setBackgroundImageUrl(e.target.value)}
                className={styles.input}
                placeholder="https://example.com/background.jpg"
                maxLength={500}
              />
              {backgroundImageUrl && (
                <div className={styles.preview}>
                  <img
                    src={backgroundImageUrl}
                    alt="背景预览"
                    className={styles.backgroundPreview}
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* 主题设置 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>主题设置</h2>

          <div className={styles.field}>
            <label className={styles.label}>默认主题</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="defaultTheme"
                  value="auto"
                  checked={defaultTheme === 'auto'}
                  onChange={() => setDefaultTheme('auto')}
                  className={styles.radio}
                />
                <span>跟随系统</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="defaultTheme"
                  value="light"
                  checked={defaultTheme === 'light'}
                  onChange={() => setDefaultTheme('light')}
                  className={styles.radio}
                />
                <span>浅色模式</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="defaultTheme"
                  value="dark"
                  checked={defaultTheme === 'dark'}
                  onChange={() => setDefaultTheme('dark')}
                  className={styles.radio}
                />
                <span>深色模式</span>
              </label>
            </div>
          </div>
        </section>

        {/* 提交按钮 */}
        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </form>
    </div>
  );
}
