'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ArticleForm, { ArticleFormData } from '@/components/admin/ArticleForm';
import { apiFetch } from '@/lib/api-client';

export default function EditArticleClient({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = use(params);
  const router = useRouter();
  const [initial, setInitial] = useState<Partial<ArticleFormData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(
          `/api/admin/article?slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`
        );
        if (!res.ok) throw new Error('未找到该文章');
        const json = await res.json();
        const data = json.data ?? json;
        setInitial({
          locale: data.locale ?? locale,
          slug: data.slug ?? slug,
          title: data.title ?? '',
          excerpt: data.excerpt ?? '',
          content: data.content ?? '',
          date: data.date ?? new Date().toISOString().slice(0, 10),
          author: data.author ?? 'Admin',
          keyword: data.keyword ?? '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文章失败');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [locale, slug]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-500 hover:text-[#0084FF] transition-colors"
        >
          ← 返回列表
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          编辑文章
          <span className="ml-2 text-sm font-normal text-gray-400 font-mono">
            [{locale}] {slug}
          </span>
        </h1>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-4 border-[#0084FF] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && initial && <ArticleForm initial={initial} isEdit={true} />}
    </div>
  );
}
