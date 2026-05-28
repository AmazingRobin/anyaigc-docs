'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, localeNames, localeFlags, Locale } from '@/lib/i18n';

interface Props {
  currentLocale: Locale;
}

export default function LanguageSelector({ currentLocale }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || `/${currentLocale}`;

  const buildHref = (target: Locale) => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && (locales as readonly string[]).includes(parts[0])) {
      parts[0] = target;
    } else {
      parts.unshift(target);
    }
    return '/' + parts.join('/');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm hover:border-blue-400 transition-colors bg-white/70 backdrop-blur"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span>{localeFlags[currentLocale]}</span>
        <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50">
          {locales.map((loc) => (
            <Link
              key={loc}
              href={buildHref(loc)}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50 ${
                loc === currentLocale ? 'bg-blue-50/60 text-blue-600 font-semibold' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">{localeFlags[loc]}</span>
              <span>{localeNames[loc]}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
