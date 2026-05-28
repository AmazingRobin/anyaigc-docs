/**
 * Cloudflare Pages Functions middleware for /api/* routes.
 * Protects all /api/admin/* paths except /api/admin/login.
 */

import { verifyToken } from "../_shared/auth";
import type { Env } from "../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Only guard /api/admin/* — skip the login endpoint itself
  if (path.startsWith("/api/admin/") && path !== "/api/admin/login") {
    const authHeader = request.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const valid = await verifyToken(token, env.ADMIN_SECRET);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return next();
}
