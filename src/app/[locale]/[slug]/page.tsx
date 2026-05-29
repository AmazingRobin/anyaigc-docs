import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Locale, locales } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';
import { getBlogPost, generateBlogParams } from '@/lib/blog';

const SITE_URL = process.env.SITE_URL || 'https://docs.anyaigc.com';

export const dynamicParams = false;

export async function generateStaticParams() {
  const params = await generateBlogParams();
  if (params.length === 0) {
    return [{ locale: 'zh', slug: '_placeholder' }];
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getBlogPost(locale as Locale, slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `${SITE_URL}/${locale}/${slug}`,
      languages: {
        'x-default': `${SITE_URL}/en/${slug}`,
        ...Object.fromEntries(locales.map((loc) => [loc, `${SITE_URL}/${loc}/${slug}`])),
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/${locale}/${slug}`,
      siteName: 'AnyAIGC',
      type: 'article',
      locale,
    },
  };
}

export default async function DetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await getBlogPost(locale as Locale, slug);
  if (!post) notFound();

  const dict = (await getDictionary(locale as Locale)) as {
    blog?: { backToList?: string; cta?: { title?: string; subtitle?: string; button?: string } };
  };
  const blog = dict.blog || {};

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: 'AnyAIGC' },
    mainEntityOfPage: `${SITE_URL}/${locale}/${slug}`,
  };

  return (
    <article className="px-5 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <div className="max-w-3xl mx-auto pt-4">
        <Link
          href={`/${locale}`}
          className="text-[#0084FF] hover:text-[#46ACFF] text-sm font-medium mb-6 inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span>
          {blog.backToList || 'Back to tutorials'}
        </Link>

        <header className="mb-10 mt-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gray-900">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{post.date}</span>
            <span aria-hidden>•</span>
            <span>By {post.author}</span>
            {post.keyword && (
              <>
                <span aria-hidden>•</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] text-blue-600">
                  #{post.keyword}
                </span>
              </>
            )}
          </div>
        </header>

        <div
          className="prose prose-blue max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <aside className="mt-12 p-8 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-purple-50 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {blog.cta?.title || '立即试用 AnyAIGC'}
          </h3>
          <p className="text-gray-600 mb-5">
            {blog.cta?.subtitle || '支持微信/支付宝/USDT支付,充值5折优惠,可自助开票,300+ AI 模型一键切换。'}
          </p>
          <a
            href="https://anyaigc.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-b from-[#53ACFF] to-[#0084FF] px-8 text-white font-bold shadow-lg hover:opacity-95 transition-opacity"
          >
            {blog.cta?.button || '前往 anyaigc.com'}
          </a>
        </aside>
      </div>
    </article>
  );
}
