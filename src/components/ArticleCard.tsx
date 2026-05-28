import Link from 'next/link';
import { BlogPost } from '@/lib/blog';
import { Locale } from '@/lib/i18n';

interface Props {
  post: BlogPost;
  locale: Locale;
  readMoreLabel: string;
}

export default function ArticleCard({ post, locale, readMoreLabel }: Props) {
  return (
    <article className="group flex flex-col rounded-3xl border border-gray-200 bg-white/70 backdrop-blur p-6 hover:border-[#0084FF]/40 hover:shadow-xl transition-all duration-300">
      <Link href={`/${locale}/${post.slug}`} className="flex flex-col flex-grow">
        <div className="text-xs text-gray-500 mb-3 font-mono tracking-wide">{post.date}</div>
        <h2 className="text-xl font-bold mb-3 text-gray-900 group-hover:text-[#0084FF] transition-colors leading-tight">
          {post.title}
        </h2>
        <p className="text-gray-600 text-sm line-clamp-3 mb-4 leading-relaxed">{post.excerpt}</p>
        {post.keyword && (
          <span className="inline-flex self-start items-center mb-4 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[11px] text-blue-600 font-medium">
            #{post.keyword}
          </span>
        )}
      </Link>
      <Link
        href={`/${locale}/${post.slug}`}
        className="text-[#0084FF] text-sm font-semibold mt-auto inline-flex items-center gap-1 group-hover:gap-2 transition-all"
      >
        {readMoreLabel}
        <span aria-hidden>→</span>
      </Link>
    </article>
  );
}
