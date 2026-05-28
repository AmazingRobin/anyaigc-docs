'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Login page doesn't need auth
    if (pathname === '/admin/login') {
      setChecked(true);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace('/admin/login');
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0084FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">加载中…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
