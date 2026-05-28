/**
 * GET    /api/admin/article?slug=&locale=  — fetch single article
 * DELETE /api/admin/article?slug=&locale=  — delete article
 */

import { getSupabase } from "../../_shared/supabase";
import type { Env } from "../../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
}

// ---------------------------------------------------------------------------
// GET — single article
// ---------------------------------------------------------------------------

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const slug = url.searchParams.get("slug") ?? "";
  const locale = url.searchParams.get("locale") ?? "";

  if (!slug || !locale) {
    return new Response(JSON.stringify({ error: "slug and locale are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabase(env);

    const { data, error } = await supabase
      .from("blogs")
      .select("*")
      .eq("slug", slug)
      .eq("locale", locale)
      .single();

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500;
      return new Response(JSON.stringify({ error: error.message }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data }), {
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

// ---------------------------------------------------------------------------
// DELETE — remove article
// ---------------------------------------------------------------------------

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const slug = url.searchParams.get("slug") ?? "";
  const locale = url.searchParams.get("locale") ?? "";

  if (!slug || !locale) {
    return new Response(JSON.stringify({ error: "slug and locale are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabase(env);

    const { error } = await supabase
      .from("blogs")
      .delete()
      .eq("slug", slug)
      .eq("locale", locale);

    if (error) {
      console.error("[article DELETE] Supabase error:", error);
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
