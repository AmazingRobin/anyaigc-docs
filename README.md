# AnyAIGC Docs (docs.anyaigc.com)

AnyAIGC AI 教程中心 - 多语言 SEO 博客系统。

## 技术栈

- **Next.js 16** - 静态导出 (`output: 'export'`)
- **Supabase** - 文章存储,复合主键 `(slug, locale)`
- **Tailwind CSS 4** - 样式
- **Cloudflare Pages** - 静态托管 + Functions(后台 API)
- **OpenRouter / 自定义 OpenAI 兼容 API** - AI 生成

## 支持语言

zh(默认/原版)、en、ko、ja、es、de

## URL 结构

- `/` → 重定向到 `/zh/`
- `/[locale]/` → 文章列表(导出为 `/[locale]/index.html`)
- `/[locale]/[slug]` → 文章详情(导出为 `/[locale]/[slug].html`)
- `/admin/*` → 集成式后台(P3 阶段实现)

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 Supabase / 模型 / 密码等
npm run dev                  # http://localhost:3000
```

## 构建

```bash
npm run build       # 输出到 ./out/
npx serve out       # 本地预览构建产物
```

## Supabase 表

```sql
create table if not exists blogs (
  id bigserial primary key,
  original_id text,
  slug text not null,
  locale text not null,
  title text not null,
  excerpt text,
  content text not null,
  date date not null default current_date,
  author text default 'Admin',
  keyword text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (slug, locale)
);
create index if not exists blogs_locale_date_idx on blogs (locale, date desc);
create index if not exists blogs_slug_idx on blogs (slug);

-- 启用 RLS：前台 anon key 只能读，写操作走 service_role key（自动绕过 RLS）
alter table blogs enable row level security;

create policy "Public read access"
  on blogs for select
  to anon, authenticated
  using (true);
```

## 自动日发(P2 阶段)

```bash
DAILY_BLOG_LIMIT=1 npm run blogger
```

## 后台(P3 阶段)

`/admin/login` → 单密码登录,后续支持文章 CRUD 与「关键词→竞品抓取→AI 仿写中文」工作流。

## 部署到 Cloudflare Pages

- Build command: `npm run build`
- Output directory: `out`
- Functions 自动从 `functions/` 目录加载
- 在 Pages 项目中配置 `.env.example` 中的环境变量
