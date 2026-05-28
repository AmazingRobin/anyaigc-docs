/**
 * POST /api/admin/generate
 * Generates a Chinese SEO article from a keyword using AI.
 *
 * Body: {
 *   keyword: string
 *   apiBase?: string   — custom AI base URL
 *   apiKey?: string    — custom AI key
 *   model?: string     — custom model name
 *   useFreeModels?: boolean — force free model rotation
 * }
 */

import {
  searchAndScrapeCompetitor,
  generateChineseArticlePrompt,
  askAICustom,
  askAIFreeModels,
  askAI,
  parseJSONFallback,
  buildHtmlFromSections,
  sanitizeSlug,
} from "../../_shared/ai";
import type { Env } from "../../_shared/supabase";

interface PagesContext {
  request: Request;
  env: Env;
}

interface GenerateBody {
  keyword: string;
  apiBase?: string;
  apiKey?: string;
  model?: string;
  useFreeModels?: boolean;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  let body: Partial<GenerateBody>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const keyword = (body.keyword ?? "").trim();
  if (!keyword) {
    return new Response(JSON.stringify({ error: "keyword is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Step 1: scrape competitor content for reference
    const competitorText = await searchAndScrapeCompetitor(keyword);

    // Step 2: build the generation prompt
    const prompt = generateChineseArticlePrompt(keyword, competitorText);
    const systemMsg = "你是一位专业的中文 SEO 内容作家，擅长 AI 和科技领域的博客写作。";
    const requiredFields = ["title", "excerpt", "sections"];

    // Step 3: call AI — custom config > free models > env default
    let result;

    if (!body.useFreeModels && body.apiBase && body.apiKey && body.model) {
      // Admin-supplied custom model
      const raw = await askAICustom(prompt, systemMsg, {
        apiBase: body.apiBase,
        apiKey: body.apiKey,
        model: body.model,
      });
      const parsed = raw.responseText
        ? parseJSONFallback(raw.responseText, `generate/${keyword}`)
        : null;
      result = { ...raw, parsed };
    } else if (body.useFreeModels && env.OPENROUTER_API_KEY) {
      // Explicit free-model rotation
      result = await askAIFreeModels(
        prompt,
        systemMsg,
        env.OPENROUTER_API_KEY,
        `generate/${keyword}`,
        requiredFields
      );
    } else {
      // Fall back to env-configured default (or free models)
      result = await askAI(prompt, systemMsg, env, `generate/${keyword}`, requiredFields);
    }

    if (!result.parsed || !result.parsed.title || !result.parsed.sections) {
      return new Response(
        JSON.stringify({ error: "AI did not return a valid article JSON" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Step 4: build HTML and sanitize slug
    const parsed = result.parsed as {
      title: string;
      slug?: string;
      excerpt?: string;
      sections: unknown[];
    };

    const contentHtml = buildHtmlFromSections(parsed.sections);
    if (!contentHtml) {
      return new Response(
        JSON.stringify({ error: "sections could not be converted to HTML" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const slug = sanitizeSlug(parsed.slug ?? "", keyword);

    const article = {
      slug,
      locale: "zh",
      title: parsed.title,
      excerpt: parsed.excerpt ?? "",
      content: contentHtml,
      keyword,
      sections: parsed.sections,
      date: new Date().toISOString().split("T")[0],
      author: "Admin",
    };

    return new Response(
      JSON.stringify({ competitor: competitorText, article }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate POST] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
