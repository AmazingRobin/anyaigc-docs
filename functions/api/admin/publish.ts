/**
 * POST /api/admin/publish
 * Batch-upserts posts to Supabase and optionally triggers a CF Pages deploy hook.
 *
 * Body: {
 *   posts: Array<{
 *     slug: string
 *     locale: string
 *     title: string
 *     excerpt: string
 *     content: string
 *     date: string
 *     author: string
 *     keyword: string
 *   }>
 * }
 */

import { getSupabase } from "../../_shared/supabase";
import type { Env } from "../../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
}

interface PostRecord {
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

  let body: { posts?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body.posts) || body.posts.length === 0) {
    return new Response(JSON.stringify({ error: "posts array is required and must not be empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate and sanitize each post record
  const records: PostRecord[] = [];
  for (const item of body.posts) {
    if (!item || typeof item !== "object") continue;
    const p = item as Partial<PostRecord>;
    if (!p.slug || !p.locale || !p.title || !p.content) continue;
    records.push({
      slug: p.slug,
      locale: p.locale,
      title: p.title,
      excerpt: p.excerpt ?? "",
      content: p.content,
      date: p.date ?? new Date().toISOString().split("T")[0],
      author: p.author ?? "Admin",
      keyword: p.keyword ?? "",
    });
  }

  if (records.length === 0) {
    return new Response(
      JSON.stringify({ error: "No valid post records found (slug, locale, title, content are required)" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = getSupabase(env);

    const { error } = await supabase
      .from("blogs")
      .upsert(records, { onConflict: "slug,locale" });

    if (error) {
      console.error("[publish POST] Supabase error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Trigger Cloudflare Pages deploy hook if configured
    let deployTriggered = false;
    if (env.CF_DEPLOY_HOOK) {
      try {
        const hookRes = await fetch(env.CF_DEPLOY_HOOK, { method: "POST" });
        deployTriggered = hookRes.ok;
        if (!hookRes.ok) {
          console.warn(`[publish POST] Deploy hook returned HTTP ${hookRes.status}`);
        }
      } catch (hookErr) {
        console.warn(
          "[publish POST] Deploy hook failed:",
          hookErr instanceof Error ? hookErr.message : String(hookErr)
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: records.length, deployTriggered }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[publish POST] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
