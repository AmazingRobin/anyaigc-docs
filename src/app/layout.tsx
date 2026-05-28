import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://docs.anyaigc.com'),
  title: { default: 'AnyAIGC AI 教程中心', template: '%s · AnyAIGC' },
  description:
    'AnyAIGC AI 教程中心 — 一站式 AI API 中转聚合平台的官方文档与最佳实践教程。',
  icons: {
    icon: 'https://lsky.zhongzhuan.chat/i/2026/04/23/69e8f6ee60c5b.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
