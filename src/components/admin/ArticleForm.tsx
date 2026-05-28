'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

export interface ArticleFormData {
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  keyword: string;
}

const LOCALES = ['zh', 'en', 'ko', 'ja', 'es', 'de'] as const;

const EMPTY_FORM: ArticleFormData = {
  locale: 'zh',
  slug: '',
  title: '',
  excerpt: '',
  content: '',
  date: new Date().toISOString().slice(0, 10),
  author: 'Admin',
  keyword: '',
};

interface ArticleFormProps {
  initial?: Partial<ArticleFormData>;
  isEdit?: boolean;
}

export default function ArticleForm({ initial, isEdit = false }: ArticleFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ArticleFormData>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(false);
  const [showDeployPrompt, setShowDeployPrompt] = useState(false);
  const [deploying, setDeploying] = useState(false);

  function set(field: keyof ArticleFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }

      setSuccess('文章保存成功。');
      setShowDeployPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeploy() {
    setDeploying(true);
    try {
      await apiFetch('/api/admin/deploy', { method: 'POST' });
    } catch {
      // deploy is best-effort
    } finally {
      setDeploying(false);
      setShowDeployPrompt(false);
      router.push('/admin');
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Meta fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          文章信息
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Locale */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">语言</label>
            <select
              value={form.locale}
              onChange={(e) => set('locale', e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => set('slug', e.target.value)}
              disabled={isEdit}
              required
              placeholder="my-article-slug"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 font-mono"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">日期</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
            />
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">作者</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => set('author', e.target.value)}
              placeholder="Admin"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
            />
          </div>

          {/* Keyword */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">关键词</label>
            <input
              type="text"
              value={form.keyword}
              onChange={(e) => set('keyword', e.target.value)}
              placeholder="例如：claude-api"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
            />
          </div>
        </div>

        {/* Title */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">标题</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="文章标题"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
          />
        </div>

        {/* Excerpt */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">摘要</label>
          <textarea
            value={form.excerpt}
            onChange={(e) => set('excerpt', e.target.value)}
            rows={2}
            placeholder="用于 SEO 和文章卡片的简短描述"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent resize-none"
          />
        </div>
      </div>

      {/* Content editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">正文</h2>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {preview ? '编辑' : '预览'}
          </button>
        </div>

        {preview ? (
          <div
            className="prose prose-blue max-w-none min-h-[400px] prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700 border border-gray-200 rounded-lg p-4"
            dangerouslySetInnerHTML={{ __html: form.content }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1.5">HTML 源码</p>
              <textarea
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                rows={24}
                placeholder="<p>文章内容（HTML 格式）…</p>"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent font-mono resize-y"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">渲染预览</p>
              <div
                className="prose prose-blue max-w-none min-h-[400px] prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700 border border-gray-100 rounded-lg p-4 bg-gray-50 overflow-auto"
                dangerouslySetInnerHTML={{ __html: form.content }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && !showDeployPrompt && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/admin')}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-gradient-to-b from-[#53ACFF] to-[#0084FF] text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {saving ? '保存中…' : isEdit ? '更新文章' : '创建文章'}
        </button>
      </div>

      {/* Deploy prompt modal */}
      {showDeployPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold text-gray-900 mb-2">文章已保存</h2>
            <p className="text-sm text-gray-600 mb-5">
              是否立即触发站点部署？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeployPrompt(false); router.push('/admin'); }}
                disabled={deploying}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                暂不部署
              </button>
              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#53ACFF] to-[#0084FF] text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {deploying && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                立即部署
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
