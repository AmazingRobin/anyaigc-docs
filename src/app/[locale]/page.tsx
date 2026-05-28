import { Metadata } from 'next';
import { Locale, locales } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';
import { getBlogPosts } from '@/lib/blog';
import ArticleCard from '@/components/ArticleCard';

const SITE_URL = process.env.SITE_URL || 'https://docs.anyaigc.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = (await getDictionary(locale as Locale)) as {
    meta?: { title?: string; description?: string };
  };
  const title = dict.meta?.title || 'AnyAIGC AI 教程中心';
  const description = dict.meta?.description || 'AnyAIGC AI tutorials and best practices.';
  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: {
        'x-default': `${SITE_URL}/en`,
        ...Object.fromEntries(locales.map((loc) => [loc, `${SITE_URL}/${loc}`])),
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${locale}`,
      siteName: 'AnyAIGC',
      type: 'website',
      locale,
    },
  };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = (await getDictionary(locale as Locale)) as {
    blog?: { heroTitle?: string; heroSubtitle?: string; readMore?: string; empty?: string };
  };
  const posts = await getBlogPosts(locale as Locale);
  const blog = dict.blog || {};

  return (
    <section className="px-5 pb-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 md:mb-16 pt-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white/70 backdrop-blur px-4 py-1.5 mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold tracking-widest text-blue-500 uppercase">
              AI Tutorials
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-5 leading-tight">
            <span className="bg-gradient-to-r from-[#46ACFF] via-[#0084FF] to-purple-500 bg-clip-text text-transparent">
              {blog.heroTitle || 'AnyAIGC 教程中心'}
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {blog.heroSubtitle ||
              '300+ AI 大模型一站式接入,与全球开发者一起探索 AI 创新最佳实践。'}
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            {blog.empty || 'No articles yet. Stay tuned.'}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {posts.map((post) => (
              <ArticleCard
                key={`${post.slug}-${post.id}`}
                post={post}
                locale={locale as Locale}
                readMoreLabel={blog.readMore || 'Read more'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
