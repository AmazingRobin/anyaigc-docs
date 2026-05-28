import { Locale, locales } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionaries';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dict = (await getDictionary(locale as Locale)) as {
    nav?: Record<string, string>;
    footer?: Record<string, string>;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header locale={locale as Locale} nav={dict.nav || {}} />
      <main className="flex-grow pt-24 md:pt-28">{children}</main>
      <Footer locale={locale as Locale} labels={dict.footer || {}} />
    </div>
  );
}
