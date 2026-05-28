export const locales = ['zh', 'en', 'ko', 'ja', 'es', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  de: 'Deutsch',
};

export const localeFlags: Record<Locale, string> = {
  zh: '🇨🇳',
  en: '🇺🇸',
  ko: '🇰🇷',
  ja: '🇯🇵',
  es: '🇪🇸',
  de: '🇩🇪',
};

export const localeAiNames: Record<Locale, string> = {
  zh: 'Simplified Chinese',
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  es: 'Spanish',
  de: 'German',
};

export const RESERVED_SLUGS = ['admin', 'api', '_next', ...locales];

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}
