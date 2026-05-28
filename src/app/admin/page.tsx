'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Article {
  id: string;
  slug: string;
  title: string;
  locale: string;
  date: string;
  keyword?: string;
  author?: string;
}

interface ArticlesResponse {
  data: Article[];
  total: number;
  page: number;
}

const LOCALES = ['all', 'zh', 'en', 'ko', 'ja', 'es', 'de'] as const;
const PAGE_SIZE = 20;

export default function AdminPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [locale, setLocale] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (locale !== 'all') params.set('locale', locale);
      if (search) params.set('q', search);

      const res = await apiFetch(`/api/admin/articles?${params}`);
      if (!res.ok) throw new Error('加载文章列表失败');
      const data: ArticlesResponse = await res.json();
      setArticles(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文章列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, locale, search]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleLocaleChange(val: string) {
    setLocale(val);
    setPage(1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({ slug: deleteTarget.slug, locale: deleteTarget.locale });
      const res = await apiFetch(`/api/admin/article?${params}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      setDeleteTarget(null);
      fetchArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">文章列表</h1>
          <p className="text-sm text-gray-500 mt-0.5">共 {total} 篇</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/generate"
            className="px-4 py-2 rounded-lg border border-[#0084FF] text-[#0084FF] text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            AI 生成
          </Link>
          <Link
            href="/admin/new"
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#53ACFF] to-[#0084FF] text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity"
          >
            + 新建文章
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select
          value={locale}
          onChange={(e) => handleLocaleChange(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l === 'all' ? '全部语言' : l.toUpperCase()}
            </option>
          ))}
        </select>

        <div className="flex gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索标题、Slug 或关键词…"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors"
          >
            搜索
          </button>
          {search && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-[#0084FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">暂无文章</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-40">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-16">语言</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">日期</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">关键词</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {articles.map((article) => (
                  <tr key={`${article.locale}-${article.slug}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900 font-medium max-w-xs truncate">
                      {article.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[160px]">
                      {article.slug}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {article.locale}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{article.date}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[128px]">
                      {article.keyword || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/admin/edit/${article.locale}/${article.slug}`)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-[#0084FF] hover:bg-blue-50 transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => setDeleteTarget(article)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            第 {page} / {totalPages} 页
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              上一页
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold text-gray-900 mb-2">删除文章</h2>
            <p className="text-sm text-gray-600 mb-1">
              确定要删除这篇文章吗？此操作不可撤销。
            </p>
            <p className="text-xs text-gray-400 font-mono mb-5">
              [{deleteTarget.locale}] {deleteTarget.slug}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
