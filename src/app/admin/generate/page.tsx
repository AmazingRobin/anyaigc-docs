'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

interface Section {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface GeneratedArticle {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  content: string;
  keyword: string;
  sections: Section[];
  date: string;
  author: string;
}

interface GenerateResponse {
  competitor: string | null;
  article: GeneratedArticle;
}

interface ModelConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  useFreeModels: boolean;
}

const TARGET_LOCALES = ['en', 'ko', 'ja', 'es', 'de'] as const;

const FREE_MODEL_DEFAULTS = {
  apiBase: 'https://api.anyaigc.com/v1',
  model: 'gemini-2.0-flash',
};

const DEFAULT_CONFIG: ModelConfig = {
  apiBase: '',
  apiKey: '',
  model: 'gpt-4o',
  useFreeModels: false,
};

export default function GeneratePage() {
  const router = useRouter();

  // Block A — config
  const [keyword, setKeyword] = useState('');
  const [config, setConfig] = useState<ModelConfig>(DEFAULT_CONFIG);

  // Block B — progress
  const [logs, setLogs] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Block C — result
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');

  function addLog(line: string) {
    setLogs((prev) => [...prev, line]);
    setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function setConfigField(field: keyof ModelConfig, value: string | boolean) {
    setConfig((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'useFreeModels' && value === true) {
        next.apiBase = FREE_MODEL_DEFAULTS.apiBase;
        next.model = FREE_MODEL_DEFAULTS.model;
      }
      return next;
    });
  }

  const handleGenerate = useCallback(async () => {
    if (!keyword.trim()) return;
    setGenerating(true);
    setLogs([]);
    setResult(null);
    setEditedContent('');
    setPublishError('');
    setPublishSuccess('');

    addLog(`开始生成关键词："${keyword}"`);

    try {
      const payload: Record<string, string | boolean> = { keyword: keyword.trim() };
      if (config.useFreeModels) {
        payload.useFreeModels = true;
      } else {
        if (config.apiBase) payload.apiBase = config.apiBase;
        if (config.apiKey) payload.apiKey = config.apiKey;
        if (config.model) payload.model = config.model;
      }

      addLog('正在请求 /api/admin/generate…');

      const res = await apiFetch('/api/admin/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data: GenerateResponse = await res.json();
      if (!data.article) {
        throw new Error('返回数据缺少 article 字段');
      }
      setResult(data);
      setEditedContent(data.article.content ?? '');
      addLog('生成完成。');
    } catch (err) {
      addLog(`错误：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  }, [keyword, config]);

  async function handlePublishAll() {
    if (!result) return;
    setPublishing(true);
    setPublishError('');
    setPublishSuccess('');

    const basePost = {
      ...result.article,
      content: editedContent,
    };

    try {
      addLog('正在翻译为多语言…');
      const translateRes = await apiFetch('/api/admin/translate', {
        method: 'POST',
        body: JSON.stringify({
          basePost,
          targetLocales: TARGET_LOCALES,
          ...(!config.useFreeModels && config.apiBase ? { apiBase: config.apiBase } : {}),
          ...(!config.useFreeModels && config.apiKey ? { apiKey: config.apiKey } : {}),
          ...(!config.useFreeModels && config.model ? { model: config.model } : {}),
        }),
      });

      if (!translateRes.ok) {
        const err = await translateRes.json().catch(() => ({}));
        throw new Error(err.error || '翻译失败');
      }
      const translateData = await translateRes.json();
      const translations: GeneratedArticle[] = translateData.translations ?? [];
      addLog(`翻译完成，得到 ${translations.length} 个语言版本，正在发布…`);

      const posts = [basePost, ...translations];
      const publishRes = await apiFetch('/api/admin/publish', {
        method: 'POST',
        body: JSON.stringify({ posts }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.json().catch(() => ({}));
        throw new Error(err.error || '发布失败');
      }
      const publishData = await publishRes.json();

      addLog(`发布成功，共写入 ${publishData.count ?? posts.length} 条记录。`);
      setPublishSuccess(`已成功发布 ${publishData.count ?? posts.length} 个语言版本。`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`发布出错：${msg}`);
      setPublishError(msg);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI 生成文章</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          输入关键词，AI 自动调研并生成文章，再一键发布到所有语言。
        </p>
      </div>

      {/* Block A — Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          配置
        </h2>

        <div className="space-y-4">
          {/* Keyword */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              关键词 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !generating && handleGenerate()}
              placeholder="例如：claude api 教程"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
            />
          </div>

          {/* Free models toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={config.useFreeModels}
              onClick={() => setConfigField('useFreeModels', !config.useFreeModels)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:ring-offset-1 ${
                config.useFreeModels ? 'bg-[#0084FF]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  config.useFreeModels ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">使用免费模型（AnyAIGC）</span>
          </div>

          {/* Model config */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API 地址</label>
              <input
                type="text"
                value={config.apiBase}
                onChange={(e) => setConfigField('apiBase', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfigField('apiKey', e.target.value)}
                placeholder="sk-…"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">模型</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfigField('model', e.target.value)}
                placeholder="gpt-4o"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent"
              />
            </div>
          </div>

          {/* Start button */}
          <div className="pt-1">
            <button
              onClick={handleGenerate}
              disabled={generating || !keyword.trim()}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-b from-[#53ACFF] to-[#0084FF] text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {generating ? '生成中…' : '开始生成'}
            </button>
          </div>
        </div>
      </div>

      {/* Block B — Progress log */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            进度日志
          </h2>
          <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
            {logs.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.startsWith('错误') || line.startsWith('发布出错') ? 'text-red-400' : 'text-green-400'
                }`}
              >
                <span className="text-gray-500 select-none mr-2">{String(i + 1).padStart(2, '0')}</span>
                {line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Block C — Compare + actions */}
      {result && (
        <div className="space-y-4">
          {/* Article meta */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              文章信息
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">标题：</span>
                <span className="text-gray-900 font-medium">{result.article.title}</span>
              </div>
              <div>
                <span className="text-gray-500">Slug：</span>
                <span className="text-gray-900 font-mono text-xs">{result.article.slug}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500">摘要：</span>
                <span className="text-gray-700">{result.article.excerpt}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left — competitor */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                竞品内容参考
              </h2>
              {result.competitor ? (
                <div className="prose prose-sm prose-blue max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                  {result.competitor}
                </div>
              ) : (
                <p className="text-sm text-gray-400">未抓取到竞品内容（可能是搜索失败或被屏蔽）。</p>
              )}
            </div>

            {/* Right — generated article editor */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  AI 生成的文章
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="px-3 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {showPreview ? '编辑 HTML' : '渲染预览'}
                </button>
              </div>
              {showPreview ? (
                <div
                  className="flex-1 prose prose-sm prose-blue max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700 border border-gray-200 rounded-lg p-4 min-h-[400px] max-h-[600px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                />
              ) : (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={20}
                  className="flex-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0084FF] focus:border-transparent resize-y"
                />
              )}
            </div>
          </div>

          {/* Status messages */}
          {publishError && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {publishError}
            </div>
          )}
          {publishSuccess && (
            <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-700">
              {publishSuccess}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                router.push(`/admin/edit/${result.article.locale ?? 'zh'}/${result.article.slug}`)
              }
              className="px-4 py-2 rounded-lg border border-[#0084FF] text-[#0084FF] text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              在完整编辑器中编辑
            </button>

            <button
              onClick={handlePublishAll}
              disabled={publishing}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-b from-[#53ACFF] to-[#0084FF] text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {publishing && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {publishing ? '发布中…' : '发布所有语言版本'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
