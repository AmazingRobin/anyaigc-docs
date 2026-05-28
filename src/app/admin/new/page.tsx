'use client';

import { useRouter } from 'next/navigation';
import ArticleForm from '@/components/admin/ArticleForm';

export default function NewArticlePage() {
  const router = useRouter();

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-500 hover:text-[#0084FF] transition-colors"
        >
          ← 返回列表
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">新建文章</h1>
      </div>

      <ArticleForm isEdit={false} />
    </div>
  );
}
