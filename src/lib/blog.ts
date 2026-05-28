import { Locale, defaultLocale, locales } from './i18n';
import { supabase } from './supabase';

const DEFAULT_STATIC_BLOG_SLUG_LIMIT = 400;

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  keyword?: string;
}

function getStaticBlogSlugLimit() {
  const configured = Number(process.env.STATIC_BLOG_SLUG_LIMIT);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return DEFAULT_STATIC_BLOG_SLUG_LIMIT;
}

export async function getStaticBlogSlugs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('blogs')
    .select('slug')
    .eq('locale', defaultLocale)
    .order('date', { ascending: false })
    .order('slug', { ascending: true })
    .limit(getStaticBlogSlugLimit());

  if (error || !data) return [];
  return data.map((row) => row.slug as string);
}

export async function getBlogPosts(locale: Locale): Promise<BlogPost[]> {
  try {
    const slugs = await getStaticBlogSlugs();
    if (slugs.length === 0) return [];

    const { data, error } = await supabase
      .from('blogs')
      .select('original_id, slug, title, excerpt, content, date, author, keyword')
      .eq('locale', locale)
      .in('slug', slugs)
      .order('date', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      if (locale !== defaultLocale) return getBlogPosts(defaultLocale);
      return [];
    }

    return data.map((post) => ({
      id: post.original_id || '',
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || '',
      content: post.content,
      date: post.date,
      author: post.author || 'Admin',
      keyword: post.keyword || undefined,
    }));
  } catch (err) {
    console.error('[blog] fetch error', err);
    if (locale !== defaultLocale) return getBlogPosts(defaultLocale);
    return [];
  }
}

export async function getBlogPost(locale: Locale, slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blogs')
    .select('original_id, slug, title, excerpt, content, date, author, keyword')
    .eq('locale', locale)
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    if (locale !== defaultLocale) {
      return getBlogPost(defaultLocale, slug);
    }
    return null;
  }

  return {
    id: data.original_id || '',
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt || '',
    content: data.content,
    date: data.date,
    author: data.author || 'Admin',
    keyword: data.keyword || undefined,
  };
}

export async function generateBlogParams() {
  const slugs = await getStaticBlogSlugs();
  const params: { locale: Locale; slug: string }[] = [];
  for (const locale of locales) {
    for (const slug of slugs) {
      params.push({ locale, slug });
    }
  }
  return params;
}
