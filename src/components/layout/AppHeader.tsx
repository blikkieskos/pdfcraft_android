'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { type Locale } from '@/lib/i18n/config';

export interface AppHeaderProps {
  locale: Locale;
  /** Page title; the home screen shows the brand instead */
  title?: string;
  /** Extra buttons on the right, e.g. a favorite toggle */
  actions?: React.ReactNode;
}

/**
 * Top app bar for the Android app (replaces the website header there):
 * brand on the home screen, back button + page title everywhere else.
 */
export function AppHeader({ locale, title, actions }: AppHeaderProps) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const homePath = `/${locale}/`;
  const isHome = pathname === `/${locale}` || pathname === homePath;

  const goBack = () => {
    // Opened directly on this page: go home rather than nowhere
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(homePath);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-background)/0.92)] backdrop-blur-md"
      role="banner"
    >
      <div className="flex h-14 items-center gap-1 px-2">
        {isHome ? (
          <Link
            href={homePath}
            className="flex min-w-0 items-center gap-2.5 px-2 text-lg font-bold tracking-tight text-[hsl(var(--color-foreground))]"
            data-testid="brand-name"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-accent))]">
              <svg
                className="h-4 w-4 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span className="truncate">{t('brand')}</span>
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={goBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[hsl(var(--color-foreground))] active:bg-[hsl(var(--color-muted))]"
              aria-label={t('buttons.back') || 'Back'}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1 truncate text-base font-semibold text-[hsl(var(--color-foreground))]">
              {title || t('brand')}
            </span>
          </>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
      </div>
    </header>
  );
}

export default AppHeader;
