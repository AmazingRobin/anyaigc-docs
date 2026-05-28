import Link from 'next/link';
import { Locale } from '@/lib/i18n';
import LanguageSelector from './LanguageSelector';

interface NavLabels {
  home?: string;
  console?: string;
  models?: string;
  apiDocs?: string;
  tutorials?: string;
  login?: string;
}

interface Props {
  locale: Locale;
  nav: NavLabels;
}

export default function Header({ locale, nav }: Props) {
  return (
    <header className="fixed top-2 inset-x-2 z-50 rounded-2xl border border-gray-200 bg-white/70 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://anyaigc.com/"
            className="flex items-center gap-2 group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://lsky.zhongzhuan.chat/i/2026/04/23/69e8f6ee60c5b.png"
              alt="AnyAIGC"
              className="h-10 md:h-11 rounded-full transition-transform group-hover:scale-105"
            />
            <span className="hidden md:inline text-[22px] font-bold tracking-tight bg-gradient-to-r from-[#46ACFF] to-[#0084FF] bg-clip-text text-transparent">
              AnyAIGC
            </span>
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-1 mx-auto flex-1 justify-center">
          <NavLink href="https://anyaigc.com/" external>
            {nav.home || 'Home'}
          </NavLink>
          <NavLink href="https://anyaigc.com/login" external>
            {nav.console || 'Console'}
          </NavLink>
          <NavLink href="https://anyaigc.com/pricing" external>
            {nav.models || 'Models'}
          </NavLink>
          <NavLink href="https://anyaigc.apifox.cn/" external>
            {nav.apiDocs || 'API Docs'}
          </NavLink>
          <NavLink href={`/${locale}`} active>
            {nav.tutorials || 'AI Tutorials'}
          </NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSelector currentLocale={locale} />
          <a
            href="https://anyaigc.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex h-[38px] items-center justify-center rounded-full bg-gradient-to-b from-[#53ACFF] to-[#0084FF] px-5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            {nav.login || 'Login'}
          </a>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
  active,
  external,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  external?: boolean;
}) {
  const className = `relative px-3 py-2 text-[15px] font-medium whitespace-nowrap transition-colors ${
    active ? 'text-[#0084FF]' : 'text-gray-700 hover:text-[#46ACFF]'
  }`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span className="relative">
        {children}
        {active && (
          <span
            className="absolute left-0 -bottom-1 h-[2px] w-full rounded-full"
            style={{ background: 'linear-gradient(to right, #46ACFF, #0084FF)' }}
          />
        )}
      </span>
    </Link>
  );
}
