import { Locale } from '@/lib/i18n';

interface FooterLabels {
  copyright?: string;
  poweredBy?: string;
  privacy?: string;
  terms?: string;
}

interface Props {
  locale: Locale;
  labels: FooterLabels;
}

export default function Footer({ labels }: Props) {
  const year = new Date().getFullYear();
  return (
    <footer className="relative w-full mt-16 px-6 md:px-24 py-12 overflow-hidden">
      <div className="absolute hidden md:block top-[40px] left-[-100px] w-[151px] h-[151px] rounded-full bg-[#FFD166] opacity-60" />
      <div className="relative max-w-[1110px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
        <span>
          © {year} AnyAIGC. {labels.copyright || 'All rights reserved.'}
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://anyaigc.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0084FF] transition-colors"
          >
            anyaigc.com
          </a>
        </div>
      </div>
    </footer>
  );
}
