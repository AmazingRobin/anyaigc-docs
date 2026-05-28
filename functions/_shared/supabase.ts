/**
 * Supabase client factory for Cloudflare Workers / Pages Functions.
 * Creates a fresh client per request — no global state in Workers.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_SECRET: string;
  ADMIN_PASSWORD: string;
  OPENROUTER_API_KEY?: string;
  DEFAULT_AI_BASE?: string;
  DEFAULT_AI_KEY?: string;
  DEFAULT_AI_MODEL?: string;
  CF_DEPLOY_HOOK?: string;
}

/**
 * Returns a Supabase client using the service role key (full access).
 * Must only be used in server-side Functions, never exposed to the client.
 */
export function getSupabase(env: Env): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }

  return createClient(url, key, {
    auth: {
      // Disable auto-refresh and session persistence — not needed in Workers
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
