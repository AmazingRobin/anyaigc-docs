/**
 * POST /api/admin/translate
 * Translates a base Chinese article into one or more target locales.
 *
 * Body: {
 *   basePost: {
 *     slug: string
 *     title: string
 *     excerpt: string
 *     content: string
 *     date: string
 *     author: string
 *     keyword: string
 *     sections: Section[]
 *   }
 *   targetLocales: string[]   — e.g. ["en", "ko", "ja", "es", "de"]
 * }
 */

import {
  translateArticlePrompt,
  askAI,
  askAICustom,
  parseJSONFallback,
  buildHtmlFromSections,
} from "../../_shared/ai";
import type { Env } from "../../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
}

const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  es: "Spanish",
  de: "German",
  zh: "Chinese",
  fr: "French",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
};

interface BasePost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  keyword: string;
  sections: unknown[];
}

interface TranslatedPost {
  locale: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  keyword: string;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  let body: {
    basePost?: Partial<BasePost>;
    targetLocales?: string[];
    apiBase?: string;
    apiKey?: string;
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const basePost = body.basePost;
  const targetLocales = body.targetLocales;
  const customConfig =
    body.apiBase && body.apiKey && body.model
      ? { apiBase: body.apiBase, apiKey: body.apiKey, model: body.model }
      : null;

  if (!basePost || !basePost.title || !basePost.sections) {
    return new Response(
      JSON.stringify({ error: "basePost with title and sections is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!Array.isArray(targetLocales) || targetLocales.length === 0) {
    return new Response(JSON.stringify({ error: "targetLocales array is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const translations: TranslatedPost[] = [];
  const errors: { locale: string; error: string }[] = [];

  for (const localeCode of targetLocales) {
    const languageName = LOCALE_NAMES[localeCode] ?? localeCode;

    const payload = {
      title: basePost.title ?? "",
      excerpt: basePost.excerpt ?? "",
      sections: basePost.sections as import("../../_shared/ai").Section[],
    };

    const prompt = translateArticlePrompt(payload, languageName);
    const systemMsg = "You are a strict JSON returning translation machine.";

    try {
      let result;
      if (customConfig) {
        const raw = await askAICustom(prompt, systemMsg, customConfig);
        const parsed = raw.responseText
          ? parseJSONFallback(raw.responseText, `translate/${localeCode}`)
          : null;
        result = { ...raw, parsed };
      } else {
        result = await askAI(
          prompt,
          systemMsg,
          env,
          `translate/${localeCode}`,
          ["title", "excerpt", "sections"]
        );
      }

      if (!result.parsed || !result.parsed.title || !result.parsed.sections) {
        // Fall back to the base post content for this locale
        console.warn(`[translate] ${localeCode}: AI returned invalid JSON, using base post fallback`);
        translations.push({
          locale: localeCode,
          slug: basePost.slug ?? "",
          title: basePost.title ?? "",
          excerpt: basePost.excerpt ?? "",
          content: basePost.content ?? "",
          date: basePost.date ?? new Date().toISOString().split("T")[0],
          author: basePost.author ?? "Admin",
          keyword: basePost.keyword ?? "",
        });
        continue;
      }

      const parsed = result.parsed as {
        title: string;
        excerpt?: string;
        sections: unknown[];
      };

      const contentHtml = buildHtmlFromSections(parsed.sections);
      if (!contentHtml) {
        console.warn(`[translate] ${localeCode}: sections produced empty HTML, using base post fallback`);
        translations.push({
          locale: localeCode,
          slug: basePost.slug ?? "",
          title: basePost.title ?? "",
          excerpt: basePost.excerpt ?? "",
          content: basePost.content ?? "",
          date: basePost.date ?? new Date().toISOString().split("T")[0],
          author: basePost.author ?? "Admin",
          keyword: basePost.keyword ?? "",
        });
        continue;
      }

      translations.push({
        locale: localeCode,
        slug: basePost.slug ?? "",
        title: parsed.title,
        excerpt: parsed.excerpt ?? "",
        content: contentHtml,
        date: basePost.date ?? new Date().toISOString().split("T")[0],
        author: basePost.author ?? "Admin",
        keyword: basePost.keyword ?? "",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[translate] ${localeCode} error:`, msg);
      errors.push({ locale: localeCode, error: msg });
    }
  }

  return new Response(
    JSON.stringify({ translations, errors: errors.length > 0 ? errors : undefined }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
