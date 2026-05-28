/**
 * GET  /api/admin/articles  — paginated list with optional search
 * POST /api/admin/articles  — upsert a single article
 */

import { getSupabase } from "../../_shared/supabase";
import type { Env } from "../../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
}

// ---------------------------------------------------------------------------
// GET — list articles
// ---------------------------------------------------------------------------

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const locale = url.searchParams.get("locale") ?? "";
  const q = url.searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  try {
    const supabase = getSupabase(env);

    let query = supabase
      .from("blogs")
      .select("id, slug, locale, title, excerpt, date, author, keyword", { count: "exact" });

    if (locale) query = query.eq("locale", locale);
    if (q) query = query.or(`title.ilike.%${q}%,keyword.ilike.%${q}%,slug.ilike.%${q}%`);

    query = query.order("date", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[articles GET] Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ data: data ?? [], total: count ?? 0, page }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---------------------------------------------------------------------------
// POST — upsert article
// ---------------------------------------------------------------------------

interface ArticleBody {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  keyword: string;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  let body: Partial<ArticleBody>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const required: (keyof ArticleBody)[] = ["slug", "locale", "title", "content"];
  const missing = required.filter((k) => !body[k]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = getSupabase(env);

    const record = {
      slug: body.slug,
      locale: body.locale,
      title: body.title,
      excerpt: body.excerpt ?? "",
      content: body.content,
      date: body.date ?? new Date().toISOString().split("T")[0],
      author: body.author ?? "Admin",
      keyword: body.keyword ?? "",
    };

    const { error } = await supabase
      .from("blogs")
      .upsert(record, { onConflict: "slug,locale" });

    if (error) {
      console.error("[articles POST] Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
