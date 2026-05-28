// Server component — exports generateStaticParams for static export
// Actual UI is in EditArticleClient (client component)
import EditArticleClient from '@/components/admin/EditArticleClient';

export function generateStaticParams() {
  return [{ locale: 'zh', slug: '_placeholder' }];
}

export default function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  return <EditArticleClient params={params} />;
}
