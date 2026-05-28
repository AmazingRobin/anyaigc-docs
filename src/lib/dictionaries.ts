import { Locale, defaultLocale } from './i18n';

const loaders: Record<Locale, () => Promise<Record<string, unknown>>> = {
  zh: () => import('@/locales/zh.json').then((m) => m.default),
  en: () => import('@/locales/en.json').then((m) => m.default),
  ko: () => import('@/locales/ko.json').then((m) => m.default),
  ja: () => import('@/locales/ja.json').then((m) => m.default),
  es: () => import('@/locales/es.json').then((m) => m.default),
  de: () => import('@/locales/de.json').then((m) => m.default),
};

export async function getDictionary(locale: Locale): Promise<Record<string, unknown>> {
  const load = loaders[locale] || loaders[defaultLocale];
  return load();
}
