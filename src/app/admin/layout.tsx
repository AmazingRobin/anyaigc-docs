// Server component wrapper — exports generateStaticParams for static export
// The actual UI is in AdminLayoutClient (client component)
import AdminLayoutClient from '@/components/admin/AdminLayoutClient';

export function generateStaticParams() {
  return [];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
