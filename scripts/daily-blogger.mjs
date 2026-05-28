import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CF_WEBHOOK_URL = process.env.CF_DEPLOY_HOOK || '';
const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "tencent/hy3-preview:free",
  "inclusionai/ling-2.6-1t:free",
  "inclusionai/ling-2.6-flash:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free"
];
const REQUEST_PAUSE_MS = Number(process.env.AI_REQUEST_PAUSE_MS || 2500);
const MODEL_SWITCH_PAUSE_MS = Number(process.env.AI_MODEL_SWITCH_PAUSE_MS || 4000);
const DAILY_BLOG_LIMIT = Number(process.env.DAILY_BLOG_LIMIT || 1);
const LOG_PREVIEW_LIMIT = 500;

const RESERVED_SLUGS = ['admin', 'api', 'zh', 'en', 'ko', 'ja', 'es', 'de'];

if (!OPENROUTER_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ 缺少必要的环境变量 (OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function previewText(text, limit = LOG_PREVIEW_LIMIT) {
  if (text === null || text === undefined) return "<empty>";
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return "<empty>";
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function stringifyError(err) {
  if (!err) return "<unknown error>";
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function safeJsonParse(text) {
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (error) { return { ok: false, error }; }
}

function cleanAIText(text) {
  if (!text) return "";
  return text
    .replace(/^﻿/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJSONObject(text) {
  const cleaned = cleanAIText(text);
  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  return objectMatch ? objectMatch[0].trim() : cleaned;
}

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeInlineHtml(text = "") {
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

function normalizeParagraphs(paragraphs) {
  if (!Array.isArray(paragraphs)) return [];
  return paragraphs.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeBullets(bullets) {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((item) => String(item || "").trim()).filter(Boolean);
}

function buildHtmlFromSections(sections) {
  if (!Array.isArray(sections)) return "";
  const chunks = [];
  for (const section of sections) {
    if (!section || typeof section !== 'object') continue;
    const heading = String(section.heading || "").trim();
    const paragraphs = normalizeParagraphs(section.paragraphs);
    const bullets = normalizeBullets(section.bullets);
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

function looksLikeRefusal(text) {
  const normalized = cleanAIText(text).toLowerCase();
  const signals = [
    "i can't help with this request", "i cannot help with this request",
    "i'm not able to assist", "i am not able to assist",
    "falls outside what i'm able to assist with",
    "cannot assist with", "unable to help with"
  ];
  return signals.some((s) => normalized.includes(s));
}

function parseJSONFallback(text, contextLabel = "JSON解析") {
  if (!text) { console.warn(`[${contextLabel}] 响应正文为空`); return null; }
  const candidates = [cleanAIText(text), extractJSONObject(text)].filter(Boolean);
  for (const c of candidates) {
    const result = safeJsonParse(c);
    if (result.ok) return result.value;
  }
  console.error(`[${contextLabel}] JSON 解析失败。片段: ${previewText(text)}`);
  return null;
}

const targetLocales = [
  { code: 'en', name: 'English' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'de', name: 'German' },
];

function logApiFailure(contextLabel, message, details = {}) {
  const serialized = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${previewText(typeof v === 'string' ? v : JSON.stringify(v))}`)
    .join(" | ");
  console.warn(`[免费模型异常][${contextLabel}] ${message}${serialized ? ` | ${serialized}` : ''}`);
}

function hasRequiredFields(parsed, requiredFields) {
  return !!parsed && requiredFields.every((f) => parsed[f]);
}

async function askAI(prompt, systemMsg = "You are a professional SEO content writer who writes in Chinese.", contextLabel = "通用任务", requiredFields = null) {
  for (let i = 0; i < FREE_MODELS.length; i++) {
    const model = FREE_MODELS[i];
    try {
      if (i > 0) await delay(MODEL_SWITCH_PAUSE_MS);
      console.log(`    [免费模型] ${contextLabel} 尝试模型 -> ${model}`);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          max_tokens: 6000,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: prompt }
          ]
        })
      });

      const rawText = await response.text();
      const parsedResponse = safeJsonParse(rawText);

      if (!response.ok) {
        logApiFailure(contextLabel, "HTTP 状态异常", { model, status: response.status, body: rawText });
        continue;
      }
      if (!parsedResponse.ok) {
        logApiFailure(contextLabel, "响应体不是合法 JSON", { model, status: response.status, body: rawText });
        continue;
      }

      const data = parsedResponse.value;
      if (data.error) {
        logApiFailure(contextLabel, "响应内包含 error 字段", { model, error: data.error });
        continue;
      }

      const content = data.choices?.[0]?.message?.content;
      if (content) {
        if (!requiredFields) return { responseText: content, parsed: null, model };
        const parsed = parseJSONFallback(content, `${contextLabel}/${model}`);
        if (hasRequiredFields(parsed, requiredFields)) return { responseText: content, parsed, model };

        if (looksLikeRefusal(content)) {
          console.warn(`    [${contextLabel}/${model}] 模型拒答`);
        } else {
          const missing = requiredFields.filter((f) => !parsed?.[f]);
          console.warn(`    [${contextLabel}/${model}] 缺少字段: ${missing.join(', ')}`);
        }
        if (i < FREE_MODELS.length - 1) {
          console.log(`    [免费模型] ${contextLabel} 输出不可用，切换下一个模型...`);
        }
        continue;
      }

      logApiFailure(contextLabel, "响应缺少 content", { model, body: rawText });
    } catch (err) {
      logApiFailure(contextLabel, "网络错误", { model, error: stringifyError(err) });
    }
    if (i < FREE_MODELS.length - 1) {
      console.log(`    [免费模型] ${contextLabel} 当前模型失败，切换下一个...`);
    }
  }
  console.error(`[免费模型异常][${contextLabel}] 已耗尽全部免费模型。`);
  return { responseText: null, parsed: null, model: null };
}

const PRODUCT_KNOWLEDGE = `
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

async function searchAndScrapeCompetitor(keyword) {
  try {
    console.log(`\n[竞品分析] 正在通过 DuckDuckGo 搜索 "${keyword}" 的现有文章...`);
    const searchRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    });
    const searchHtml = await searchRes.text();

    const urls = [];
    const urlMatches = searchHtml.match(/uddg=([^&]+)/g);
    if (urlMatches) {
      for (const m of urlMatches) {
        const decoded = decodeURIComponent(m.replace('uddg=', ''));
        if (decoded.startsWith('http') && !decoded.includes('duckduckgo') && !decoded.includes('youtube.com')) {
          urls.push(decoded);
        }
      }
    }

    if (urls.length === 0) {
      console.log(`[竞品分析] 未找到外部文章，使用纯原创模式。`);
      return null;
    }

    const targetUrl = urls[0];
    console.log(`[竞品分析] 锁定竞品文章: ${targetUrl}，正在抓取...`);
    const pageRes = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      signal: AbortSignal.timeout(10000)
    });
    const pageHtml = await pageRes.text();

    let cleanText = pageHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');

    const words = cleanText.split(/\s+/).filter(w => w.length > 1);
    const snippet = words.slice(40, 840).join(' ');

    if (snippet.length > 200) {
      console.log(`[竞品分析] 成功提取参考内容 (${snippet.length} 字符)`);
      return snippet;
    }
    return null;
  } catch (err) {
    console.warn(`[竞品分析] 抓取失败 (${err.message})，启用纯原创模式。`);
    return null;
  }
}

async function generateChineseArticle(keyword, referenceText = null) {
  const referencePrompt = referenceText
    ? `\n\n🎯 竞品仿写模式：\n我已抓取了该关键词排名靠前的竞品文章。\n**你的任务：** 参考竞品的结构、话题覆盖度，写出比它更好、完全独立原创的内容。\n\n竞品内容片段：\n"""${referenceText}"""\n\n`
    : "";

  const prompt = `
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

  console.log(`🧠 正在为关键词 "${keyword}" 生成高质量中文文章...`);
  const result = await askAI(
    prompt,
    "你是一位专业的中文 SEO 内容作家，擅长 AI 和科技领域的博客写作。",
    `文章生成/${keyword}`,
    ['title', 'excerpt', 'sections']
  );

  if (!result.parsed || !result.parsed.title || !result.parsed.sections) {
    throw new Error("免费模型未返回有效文章 JSON");
  }

  const parsed = result.parsed;
  const contentHtml = buildHtmlFromSections(parsed.sections);
  if (!contentHtml) throw new Error("sections 无法转换为有效 HTML");

  let slug = parsed.slug
    ? parsed.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : keyword.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');

  if (!slug || slug.length < 3) {
    slug = `tutorial-${Date.now().toString(36)}`;
  }
  if (RESERVED_SLUGS.includes(slug)) {
    slug = `${slug}-tutorial`;
  }

  return {
    original_id: Date.now().toString(),
    date: new Date().toISOString().split('T')[0],
    author: "Admin",
    locale: "zh",
    keyword,
    slug,
    title: parsed.title,
    excerpt: parsed.excerpt,
    content: contentHtml,
    sections: parsed.sections,
  };
}

async function translateArticle(basePost, targetLanguageName, targetLocaleCode) {
  const payload = {
    title: basePost.title,
    excerpt: basePost.excerpt,
    sections: basePost.sections || []
  };

  const prompt = `
You are an expert translator specializing in SEO content.
Translate the values of "title", "excerpt", and every string inside "sections" from the given JSON object into ${targetLanguageName}.
IMPORTANT RULES:
1. "sections" is structured content. Preserve the JSON structure exactly.
2. Keep any inline HTML anchor string like <a href="https://anyaigc.com/">anyaigc.com</a> intact and untranslated inside the paragraph text.
3. Return ONLY a pure JSON object string without markdown fences. Your entire response must be readable by JSON.parse().

JSON to Translate:
${JSON.stringify(payload, null, 2)}`;

  console.log(`   🌍 正在翻译为 -> ${targetLanguageName} (${targetLocaleCode})...`);
  const result = await askAI(
    prompt,
    "You are a strict JSON returning translation machine.",
    `翻译/${targetLocaleCode}`,
    ['title', 'excerpt', 'sections']
  );

  if (!result.parsed || !result.parsed.title || !result.parsed.sections) {
    console.log(`    ⚠️ 翻译失败，回退至中文原版。`);
    return { ...stripTransientFields(basePost), locale: targetLocaleCode };
  }

  const contentHtml = buildHtmlFromSections(result.parsed.sections);
  if (!contentHtml) {
    console.log(`    ⚠️ sections 无法转换为 HTML，回退至中文原版。`);
    return { ...stripTransientFields(basePost), locale: targetLocaleCode };
  }

  return {
    original_id: basePost.original_id,
    slug: basePost.slug,
    date: basePost.date,
    author: basePost.author,
    keyword: basePost.keyword,
    locale: targetLocaleCode,
    title: result.parsed.title,
    excerpt: result.parsed.excerpt,
    content: contentHtml,
  };
}

function stripTransientFields(post) {
  const { sections, ...persisted } = post;
  return persisted;
}

async function runJob() {
  const pendingFile = path.resolve(__dirname, 'pending-keywords.json');
  const usedFile = path.resolve(__dirname, 'used-keywords.json');

  let pending = [];
  let used = [];
  try { pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8')); } catch {}
  try { used = JSON.parse(fs.readFileSync(usedFile, 'utf-8')); } catch {}

  if (pending.length === 0) {
    console.log("📝 没有需要处理的长尾词了 (pending-keywords.json 为空)!");
    return;
  }

  const limit = Number.isFinite(DAILY_BLOG_LIMIT) && DAILY_BLOG_LIMIT > 0 ? Math.floor(DAILY_BLOG_LIMIT) : 1;
  const keywordsToProcess = pending.splice(0, limit);
  console.log(`🚀 开始日常任务：今日计划写 ${keywordsToProcess.length} 篇文章...`);

  let successCount = 0;

  for (let i = 0; i < keywordsToProcess.length; i++) {
    const kw = keywordsToProcess[i];
    console.log(`\n================================`);
    console.log(`任务 [${i + 1}/${keywordsToProcess.length}] 关键词: ${kw}`);

    try {
      const dbEntries = [];

      const referenceText = await searchAndScrapeCompetitor(kw);
      const zhPost = await generateChineseArticle(kw, referenceText);
      dbEntries.push(stripTransientFields(zhPost));

      console.log(`✅ 中文生成完成。开始向 5 种语言翻译...`);

      for (let j = 0; j < targetLocales.length; j++) {
        const loc = targetLocales[j];
        const translated = await translateArticle(zhPost, loc.name, loc.code);
        dbEntries.push(translated);
        if (j < targetLocales.length - 1) await delay(REQUEST_PAUSE_MS);
      }

      console.log(`💾 文章矩阵构建完成(${dbEntries.length} 篇)。Upsert 进 Supabase...`);
      const { error } = await supabase.from('blogs').upsert(dbEntries, { onConflict: 'slug,locale' });

      if (error) {
        console.error(`❌ 数据库写入失败:`, error);
        pending.push(kw);
      } else {
        console.log(`🎉 关键词 "${kw}" 入库成功！`);
        used.push({ keyword: kw, date: new Date().toISOString() });
        successCount++;
      }
    } catch (err) {
      console.error(`处理关键词 "${kw}" 时发生错误:`, err.message);
      pending.push(kw);
    }
  }

  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
  fs.writeFileSync(usedFile, JSON.stringify(used, null, 2));

  if (successCount > 0 && CF_WEBHOOK_URL) {
    console.log(`\n🌐 共 ${successCount} 篇生成成功。触发 Cloudflare Pages 部署...`);
    try {
      const res = await fetch(CF_WEBHOOK_URL, { method: 'POST' });
      if (res.ok) {
        console.log(`✅ 部署已触发！`);
      } else {
        console.warn(`🚧 触发部署失败 HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`🚨 触发部署网络错误: ${err.message}`);
    }
  }

  console.log(`\n🏁 自动发文脚本运行完毕！`);
}

runJob();
