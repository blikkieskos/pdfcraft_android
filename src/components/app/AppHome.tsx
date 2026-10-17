'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Coffee, FileText, Search, Sparkles, X } from 'lucide-react';
import { queueForViewer } from '@/lib/app/file-handoff';
import { openExternalUrl } from '@/lib/tauri-bridge';
import { DefaultPdfAppCard, DefaultPdfAppRow } from '@/components/app/DefaultPdfApp';
import { Header } from '@/components/layout/Header';
import { getPopularTools, getToolById, getToolsByCategory } from '@/config/tools';
import { getToolIcon } from '@/config/icons';
import { searchTools } from '@/lib/utils/search';
import { useFavorites } from '@/hooks/useFavorites';
import { type Locale } from '@/lib/i18n/config';
import { type Tool, type ToolCategory } from '@/types/tool';

type LocalizedTools = Record<string, { title: string; description: string }>;

// Maintainer of the Android port
const SUPPORT_URL = 'https://ko-fi.com/epiblitikos';

const CATEGORY_ORDER: ToolCategory[] = [
  'organize-manage',
  'edit-annotate',
  'convert-to-pdf',
  'convert-from-pdf',
  'optimize-repair',
  'secure-pdf',
];

const CATEGORY_KEYS: Record<ToolCategory, string> = {
  'edit-annotate': 'editAnnotate',
  'convert-to-pdf': 'convertToPdf',
  'convert-from-pdf': 'convertFromPdf',
  'organize-manage': 'organizeManage',
  'optimize-repair': 'optimizeRepair',
  'secure-pdf': 'securePdf',
};

export interface AppHomeProps {
  locale: Locale;
  localizedToolContent?: LocalizedTools;
}

/**
 * Home screen of the Android app: a tool launcher instead of the website's landing page.
 */
export function AppHome({ locale, localizedToolContent = {} }: AppHomeProps) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { favorites, isLoaded } = useFavorites();

  const results = useMemo(
    () => (query.trim() ? searchTools(query, localizedToolContent).map((r) => r.tool) : []),
    [query, localizedToolContent]
  );
  const favoriteTools = favorites
    .map((id) => getToolById(id))
    .filter((tool): tool is Tool => tool !== undefined);

  const toolName = (tool: Tool) =>
    localizedToolContent[tool.id]?.title ||
    tool.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const toolHref = (tool: Tool) => `/${locale}/tools/${tool.slug}`;

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--color-background))]">
      <Header locale={locale} />

      <main id="main-content" className="flex-1 px-3 pb-8" tabIndex={-1}>
        {/* Search stays reachable while scrolling */}
        <div className="sticky top-14 z-40 -mx-3 bg-[hsl(var(--color-background)/0.95)] px-3 pb-2 pt-3 backdrop-blur-md">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--color-muted-foreground))]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search.placeholder')}
              aria-label={t('common.search.placeholder')}
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] pl-10 pr-10 text-base text-[hsl(var(--color-foreground))] placeholder:text-[hsl(var(--color-muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[hsl(var(--color-muted-foreground))] active:bg-[hsl(var(--color-muted))]"
                aria-label={t('common.buttons.clear')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {query.trim() ? (
          results.length > 0 ? (
            <ToolList tools={results} toolName={toolName} toolHref={toolHref} localizedToolContent={localizedToolContent} />
          ) : (
            <p className="py-12 text-center text-sm text-[hsl(var(--color-muted-foreground))]">
              {t('common.search.noResults')}
            </p>
          )
        ) : (
          <>
            {/* Viewer first: reading a PDF is the main thing this app does */}
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="mt-2 flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-accent))] p-4 text-left text-white shadow-lg shadow-[hsl(var(--color-primary)/0.25)] active:opacity-90"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">Open a PDF</span>
                <span className="block text-sm text-white/85">Read, zoom, search and annotate</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                e.target.value = '';
                if (picked) {
                  queueForViewer(picked);
                  router.push(`/${locale}/view`);
                }
              }}
            />

            <Link
              href={`/${locale}/studio`}
              className="mt-2 flex items-center gap-4 rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] p-4 active:bg-[hsl(var(--color-muted))]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[hsl(var(--color-foreground))]">PDF Studio</span>
                <span className="block text-sm text-[hsl(var(--color-muted-foreground))]">
                  Several edits in a row, with undo
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
            </Link>

            <DefaultPdfAppCard />

            {isLoaded && favoriteTools.length > 0 && (
              <HomeSection title={t('tools.favorite.title')}>
                <ToolTiles tools={favoriteTools} toolName={toolName} toolHref={toolHref} />
              </HomeSection>
            )}

            <HomeSection title={t('home.categories.popular')}>
              <ToolTiles tools={getPopularTools()} toolName={toolName} toolHref={toolHref} />
            </HomeSection>

            <HomeSection title={t('toolsPage.allTools')}>
              <div className="space-y-2">
                {CATEGORY_ORDER.map((category) => {
                  const categoryTools = getToolsByCategory(category);
                  return (
                    <details
                      key={category}
                      className="group overflow-hidden rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))]"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-[hsl(var(--color-foreground))]">
                            {t(`home.categories.${CATEGORY_KEYS[category]}`)}
                          </span>
                          <span className="block truncate text-xs text-[hsl(var(--color-muted-foreground))]">
                            {t(`home.categoriesDescription.${CATEGORY_KEYS[category]}`)}
                          </span>
                        </span>
                        <span className="rounded-md bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--color-primary))]">
                          {categoryTools.length}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))] transition-transform group-open:rotate-90"
                          aria-hidden="true"
                        />
                      </summary>
                      <div className="border-t border-[hsl(var(--color-border))]">
                        <ToolList
                          tools={categoryTools}
                          toolName={toolName}
                          toolHref={toolHref}
                          localizedToolContent={localizedToolContent}
                          bare
                        />
                      </div>
                    </details>
                  );
                })}
              </div>
            </HomeSection>

            <DefaultPdfAppRow />

            <button
              type="button"
              onClick={() => openExternalUrl(SUPPORT_URL)}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] px-4 py-3.5 text-left active:bg-[hsl(var(--color-muted))]"
            >
              <Coffee className="h-5 w-5 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-[hsl(var(--color-foreground))]">Support the Android port</span>
              <span className="text-sm text-[hsl(var(--color-muted-foreground))]">Ko-fi</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function HomeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 px-1 text-sm font-semibold uppercase tracking-wide text-[hsl(var(--color-muted-foreground))]">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface ToolLinksProps {
  tools: Tool[];
  toolName: (tool: Tool) => string;
  toolHref: (tool: Tool) => string;
}

/** Icon grid for short, frequently used lists */
function ToolTiles({ tools, toolName, toolHref }: ToolLinksProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {tools.map((tool) => {
        const Icon = getToolIcon(tool.icon);
        return (
          <Link
            key={tool.id}
            href={toolHref(tool)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] px-1 py-2.5 text-center transition-transform active:scale-[0.97]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="line-clamp-2 text-[11px] font-medium leading-tight text-[hsl(var(--color-foreground))]">
              {toolName(tool)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Rows with a one-line description, for long lists */
function ToolList({
  tools,
  toolName,
  toolHref,
  localizedToolContent,
  bare = false,
}: ToolLinksProps & { localizedToolContent: LocalizedTools; bare?: boolean }) {
  return (
    <ul
      className={
        bare
          ? 'divide-y divide-[hsl(var(--color-border)/0.6)]'
          : 'mt-1 divide-y divide-[hsl(var(--color-border)/0.6)] overflow-hidden rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))]'
      }
    >
      {tools.map((tool) => {
        const Icon = getToolIcon(tool.icon);
        return (
          <li key={tool.id}>
            <Link
              href={toolHref(tool)}
              className="flex items-center gap-3 px-4 py-2.5 active:bg-[hsl(var(--color-muted))]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[hsl(var(--color-foreground))]">
                  {toolName(tool)}
                </span>
                {localizedToolContent[tool.id]?.description && (
                  <span className="block truncate text-xs text-[hsl(var(--color-muted-foreground))]">
                    {localizedToolContent[tool.id].description}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default AppHome;
