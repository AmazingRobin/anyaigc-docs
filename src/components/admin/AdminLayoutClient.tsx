'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AuthGuard from '@/components/admin/AuthGuard';
import { clearToken } from '@/lib/auth';

function AdminHeader() {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    clearToken();
    router.push('/admin/login');
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href));

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/admin"
            className="text-base font-bold text-gray-900 hover:text-[#0084FF] transition-colors"
          >
            AnyAIGC 管理后台
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/admin'
                  ? 'bg-blue-50 text-[#0084FF]'
                  : 'text-gray-600 hover:text-[#0084FF] hover:bg-blue-50'
              }`}
            >
              文章列表
            </Link>
            <Link
              href="/admin/generate"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive('/admin/generate')
                  ? 'bg-blue-50 text-[#0084FF]'
                  : 'text-gray-600 hover:text-[#0084FF] hover:bg-blue-50'
              }`}
            >
              AI 生成
            </Link>
            <button
              onClick={handleLogout}
              className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              退出登录
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
