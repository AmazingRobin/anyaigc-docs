/**
 * Shared AI utilities for Cloudflare Workers / Pages Functions.
 * Adapted from scripts/daily-blogger.mjs — no fs/path dependencies.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "tencent/hy3-preview:free",
  "inclusionai/ling-2.6-1t:free",
  "inclusionai/ling-2.6-flash:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
] as const;

export const RESERVED_SLUGS = ["admin", "api", "zh", "en", "ko", "ja", "es", "de"];

export const PRODUCT_KNOWLEDGE = `
⚠️ 产品植入要求（必须严格遵守）：
我们的产品是 AnyAIGC，全网最稳定的 AI API 中转聚合平台：
- 一站式接入 OpenAI/Claude/Gemini/Grok/DeepSeek 等 300+ 主流大模型
- 完全兼容 OpenAI 接口协议，5 分钟无缝接入
- 价格低至官方 0.95 折，按量计费，注册即送 $0.2 免费额度
- 全球多点部署，平均响应 < 100ms，99.9% 可用性
- 24/7 技术支持，银行级加密传输

每当文中提到我们的平台或推荐 AI 工具/中转站时，必须以这个 HTML 链接形式插入正文段落：
<a href="https://anyaigc.com/">anyaigc.com</a>
`;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Section {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface ArticlePayload {
  title: string;
  excerpt: string;
  sections: Section[];
}

export interface AIConfig {
  apiBase: string;
  apiKey: string;
  model: string;
}

export interface AIResult {
  responseText: string | null;
  parsed: Record<string, unknown> | null;
  model: string | null;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function previewText(text: unknown, limit = 500): string {
  if (text === null || text === undefined) return "<empty>";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "<empty>";
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function stringifyError(err: unknown): string {
  if (!err) return "<unknown error>";
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error };
  }
}

function cleanAIText(text: string): string {
  if (!text) return "";
  return text
    .replace(/^﻿/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJSONObject(text: string): string {
  const cleaned = cleanAIText(text);
  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0].trim() : cleaned;
}

function escapeHtml(text = ""): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeInlineHtml(text = ""): string {
  return String(text)
    .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;")
    .replace(/<(?!\/?(?:a)\b)[^>]*>/gi, "")
    .replace(/<a\b[^>]*>/gi, (openTag) => {
      const hrefMatch = openTag.match(/href\s*=\s*(["'])(https?:\/\/[^"']+)\1/i);
      if (hrefMatch) {
        const safeHref = hrefMatch[2].replace(/"/g, "&quot;");
        return `<a href="${safeHref}">`;
      }
      return "<a>";
    })
    .replace(/<\/a>/gi, "</a>");
}

function normalizeParagraphs(paragraphs: unknown): string[] {
  if (!Array.isArray(paragraphs)) return [];
  return paragraphs.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeBullets(bullets: unknown): string[] {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((item) => String(item || "").trim()).filter(Boolean);
}

function looksLikeRefusal(text: string): boolean {
  const normalized = cleanAIText(text).toLowerCase();
  const signals = [
    "i can't help with this request",
    "i cannot help with this request",
    "i'm not able to assist",
    "i am not able to assist",
    "falls outside what i'm able to assist with",
    "cannot assist with",
    "unable to help with",
  ];
  return signals.some((s) => normalized.includes(s));
}

function hasRequiredFields(parsed: unknown, requiredFields: string[]): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  return requiredFields.every((f) => (parsed as Record<string, unknown>)[f]);
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

export function parseJSONFallback(
  text: string,
  contextLabel = "JSON解析"
): Record<string, unknown> | null {
  if (!text) {
    console.warn(`[${contextLabel}] 响应正文为空`);
    return null;
  }
  const candidates = [cleanAIText(text), extractJSONObject(text)].filter(Boolean);
  for (const c of candidates) {
    const result = safeJsonParse(c);
    if (result.ok) return result.value as Record<string, unknown>;
  }
  console.error(`[${contextLabel}] JSON 解析失败。片段: ${previewText(text)}`);
  return null;
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

export function buildHtmlFromSections(sections: unknown): string {
  if (!Array.isArray(sections)) return "";
  const chunks: string[] = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const s = section as Record<string, unknown>;
    const heading = String(s.heading || "").trim();
    const paragraphs = normalizeParagraphs(s.paragraphs);
    const bullets = normalizeBullets(s.bullets);
    if (!heading && paragraphs.length === 0 && bullets.length === 0) continue;
    if (heading) chunks.push(`<h2>${escapeHtml(heading)}</h2>`);
    for (const paragraph of paragraphs) chunks.push(`<p>${sanitizeInlineHtml(paragraph)}</p>`);
    if (bullets.length > 0) {
      const listHtml = bullets.map((b) => `<li>${sanitizeInlineHtml(b)}</li>`).join("");
      chunks.push(`<ul>${listHtml}</ul>`);
    }
  }
  return chunks.join("");
}

// ---------------------------------------------------------------------------
// AI callers
// ---------------------------------------------------------------------------

/**
 * Calls a custom AI endpoint (admin-supplied model config).
 */
export async function askAICustom(
  prompt: string,
  systemMsg: string,
  config: AIConfig
): Promise<AIResult> {
  const { apiBase, apiKey, model } = config;
  try {
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
      }),
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.warn(`[askAICustom] HTTP ${response.status}: ${previewText(rawText)}`);
      return { responseText: null, parsed: null, model };
    }

    const parsed = safeJsonParse(rawText);
    if (!parsed.ok) {
      console.warn(`[askAICustom] 响应不是合法 JSON: ${previewText(rawText)}`);
      return { responseText: null, parsed: null, model };
    }

    const data = parsed.value as Record<string, unknown>;
    if (data.error) {
      console.warn(`[askAICustom] 响应包含 error: ${previewText(JSON.stringify(data.error))}`);
      return { responseText: null, parsed: null, model };
    }

    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    const content = choices?.[0]?.message?.content ?? null;
    return { responseText: content, parsed: null, model };
  } catch (err) {
    console.error(`[askAICustom] 网络错误: ${stringifyError(err)}`);
    return { responseText: null, parsed: null, model };
  }
}

/**
 * Rotates through FREE_MODELS on OpenRouter until one returns a valid response.
 * If requiredFields is provided, validates the parsed JSON before accepting.
 */
export async function askAIFreeModels(
  prompt: string,
  systemMsg: string,
  openrouterKey: string,
  contextLabel = "通用任务",
  requiredFields: string[] | null = null
): Promise<AIResult> {
  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    try {
      const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: prompt },
          ],
        }),
      });

      const rawText = await response.text();
      const parsedResponse = safeJsonParse(rawText);

      if (!response.ok) {
        console.warn(
          `[免费模型][${contextLabel}] HTTP ${response.status} model=${model}: ${previewText(rawText)}`
        );
        continue;
      }
      if (!parsedResponse.ok) {
        console.warn(`[免费模型][${contextLabel}] 响应不是合法 JSON model=${model}`);
        continue;
      }

      const data = parsedResponse.value as Record<string, unknown>;
      if (data.error) {
        console.warn(
          `[免费模型][${contextLabel}] 响应含 error model=${model}: ${previewText(JSON.stringify(data.error))}`
        );
        continue;
      }

      const choices = data.choices as Array<{ message: { content: string } }> | undefined;
      const content = choices?.[0]?.message?.content ?? null;

      if (!content) {
        console.warn(`[免费模型][${contextLabel}] 响应缺少 content model=${model}`);
        continue;
      }

      if (!requiredFields) {
        return { responseText: content, parsed: null, model };
      }

      const parsed = parseJSONFallback(content, `${contextLabel}/${model}`);
      if (hasRequiredFields(parsed, requiredFields)) {
        return { responseText: content, parsed, model };
      }

      if (looksLikeRefusal(content)) {
        console.warn(`[免费模型][${contextLabel}] 模型拒答 model=${model}`);
      } else {
        const missing = requiredFields.filter((f) => !parsed?.[f]);
        console.warn(
          `[免费模型][${contextLabel}] 缺少字段: ${missing.join(", ")} model=${model}`
        );
      }
    } catch (err) {
      console.warn(`[免费模型][${contextLabel}] 网络错误 model=${model}: ${stringifyError(err)}`);
    }
  }

  console.error(`[免费模型][${contextLabel}] 已耗尽全部免费模型。`);
  return { responseText: null, parsed: null, model: null };
}

/**
 * General-purpose AI caller that uses the default env-configured model.
 * Falls back to free models if DEFAULT_AI_* vars are not set.
 */
export async function askAI(
  prompt: string,
  systemMsg: string,
  env: {
    OPENROUTER_API_KEY?: string;
    DEFAULT_AI_BASE?: string;
    DEFAULT_AI_KEY?: string;
    DEFAULT_AI_MODEL?: string;
  },
  contextLabel = "通用任务",
  requiredFields: string[] | null = null
): Promise<AIResult> {
  if (env.DEFAULT_AI_BASE && env.DEFAULT_AI_KEY && env.DEFAULT_AI_MODEL) {
    const result = await askAICustom(prompt, systemMsg, {
      apiBase: env.DEFAULT_AI_BASE,
      apiKey: env.DEFAULT_AI_KEY,
      model: env.DEFAULT_AI_MODEL,
    });
    if (result.responseText) {
      if (!requiredFields) return result;
      const parsed = parseJSONFallback(result.responseText, contextLabel);
      if (hasRequiredFields(parsed, requiredFields)) {
        return { ...result, parsed };
      }
    }
  }

  if (env.OPENROUTER_API_KEY) {
    return askAIFreeModels(prompt, systemMsg, env.OPENROUTER_API_KEY, contextLabel, requiredFields);
  }

  console.error(`[askAI][${contextLabel}] 没有可用的 AI 配置`);
  return { responseText: null, parsed: null, model: null };
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Returns the prompt for generating a Chinese SEO article from a keyword.
 */
export function generateChineseArticlePrompt(keyword: string, referenceText?: string | null): string {
  const referencePrompt = referenceText
    ? `\n\n🎯 竞品仿写模式：\n我已抓取了该关键词排名靠前的竞品文章。\n**你的任务：** 参考竞品的结构、话题覆盖度，写出比它更好、完全独立原创的内容。\n\n竞品内容片段：\n"""${referenceText}"""\n\n`
    : "";

  return `
为长尾关键词 "${keyword}" 写一篇 SEO 友好、高质量的中文博客文章，严格输出 JSON。
${referencePrompt}
要求：
- 关键词 "${keyword}" 自然分布 3-4 次
- title：吸引人的中文标题
- slug：url 友好的英文短串（基于关键词翻译，小写、连字符，不超过 60 字符）
- excerpt：不超过 150 字符的中文 meta 描述
- sections：数组，每项 { heading, paragraphs[], bullets[] (可选) }
- 全部 paragraphs + bullets 累计 >= 800 中文字
${PRODUCT_KNOWLEDGE}

输出格式示例：
{
  "title": "...",
  "slug": "...",
  "excerpt": "...",
  "sections": [
    { "heading": "...", "paragraphs": ["...", "..."], "bullets": ["...", "..."] }
  ]
}

仅输出一个合法 JSON 对象，以 { 开头 } 结尾，不要 markdown 围栏、不要解释。`;
}

/**
 * Returns the prompt for translating an article payload to a target language.
 */
export function translateArticlePrompt(
  payload: ArticlePayload,
  targetLanguageName: string
): string {
  return `
You are an expert translator specializing in SEO content.
Translate the values of "title", "excerpt", and every string inside "sections" from the given JSON object into ${targetLanguageName}.
IMPORTANT RULES:
1. "sections" is structured content. Preserve the JSON structure exactly.
2. Keep any inline HTML anchor string like <a href="https://anyaigc.com/">anyaigc.com</a> intact and untranslated inside the paragraph text.
3. Return ONLY a pure JSON object string without markdown fences. Your entire response must be readable by JSON.parse().

JSON to Translate:
${JSON.stringify(payload, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Competitor scraper
// ---------------------------------------------------------------------------

/**
 * Searches DuckDuckGo for the keyword and scrapes the first result's text.
 * Returns a plain-text snippet or null on failure.
 */
export async function searchAndScrapeCompetitor(keyword: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }
    );
    const searchHtml = await searchRes.text();

    const urls: string[] = [];
    const urlMatches = searchHtml.match(/uddg=([^&]+)/g);
    if (urlMatches) {
      for (const m of urlMatches) {
        const decoded = decodeURIComponent(m.replace("uddg=", ""));
        if (
          decoded.startsWith("http") &&
          !decoded.includes("duckduckgo") &&
          !decoded.includes("youtube.com")
        ) {
          urls.push(decoded);
        }
      }
    }

    if (urls.length === 0) return null;

    const targetUrl = urls[0];
    const pageRes = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal: AbortSignal.timeout(10000),
    });
    const pageHtml = await pageRes.text();

    const cleanText = pageHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ");

    const words = cleanText.split(/\s+/).filter((w) => w.length > 1);
    const snippet = words.slice(40, 840).join(" ");

    return snippet.length > 200 ? snippet : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

export function sanitizeSlug(raw: string, keyword: string): string {
  let slug = raw
    ? raw.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : keyword.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "");

  if (!slug || slug.length < 3) {
    slug = `tutorial-${Date.now().toString(36)}`;
  }
  if (RESERVED_SLUGS.includes(slug)) {
    slug = `${slug}-tutorial`;
  }
  return slug;
}
