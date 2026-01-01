import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import styles from './PostEditorPage.module.css';

const DEFAULT_TEMPLATE = `---
title: 文章标题
date: ${new Date().toISOString().split('T')[0]}
tags: []
group: 
description: 文章描述
---

在这里开始写作...
`;

export function PostEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(slug);

  const [content, setContent] = useState(DEFAULT_TEMPLATE);
  const [newSlug, setNewSlug] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlug = () => {
    const date = new Date().toISOString().split('T')[0];
    return `${date}-`;
  };

  const handlePublish = async () => {
    if (!newSlug.trim()) {
      setError('请输入文章 slug');
      return;
    }

    const finalSlug = newSlug.trim();
    const message = commitMessage.trim() || `Publish: ${finalSlug}`;

    setSaving(true);
    setError(null);

    try {
      const result = await adminApi.publishPost(finalSlug, content, message);
      if ('slug' in result) {
        navigate('/posts');
      } else if ('error' in result) {
        setError(result.error.message);
      }
    } catch (_err) {
      setError('发布失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!slug) return;

    const message = commitMessage.trim() || `Update: ${slug}`;

    setSaving(true);
    setError(null);

    try {
      const result = await adminApi.updatePost(slug, content, message);
      if ('slug' in result) {
        navigate('/posts');
      } else if ('error' in result) {
        setError(result.error.message);
      }
    } catch (_err) {
      setError('更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!slug) return;
    if (!confirm('确定要下线这篇文章吗？')) return;

    setSaving(true);
    setError(null);

    try {
      const result = await adminApi.unpublishPost(slug);
      if ('slug' in result) {
        navigate('/posts');
      } else if ('error' in result) {
        setError(result.error.message);
      }
    } catch (_err) {
      setError('下线失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isEditing ? '编辑文章' : '新建文章'}</h1>
        <div className={styles.actions}>
          {isEditing && (
            <button onClick={handleUnpublish} className={styles.dangerBtn} disabled={saving}>
              下线
            </button>
          )}
          <button
            onClick={isEditing ? handleUpdate : handlePublish}
            className={styles.primaryBtn}
            disabled={saving}
          >
            {saving ? '保存中...' : isEditing ? '更新' : '发布'}
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        {!isEditing && (
          <div className={styles.field}>
            <label htmlFor="slug">Slug</label>
            <div className={styles.slugInput}>
              <input
                id="slug"
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="2024-01-01-my-post-title"
              />
              <button
                type="button"
                onClick={() => setNewSlug(generateSlug())}
                className={styles.generateBtn}
              >
                生成日期前缀
              </button>
            </div>
            <p className={styles.hint}>格式: YYYY-MM-DD-slug-name</p>
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="commit">提交信息（可选）</label>
          <input
            id="commit"
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder={isEditing ? `Update: ${slug}` : '留空将自动生成'}
          />
        </div>

        <div className={styles.editorField}>
          <label htmlFor="content">内容 (MDX)</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={styles.editor}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
