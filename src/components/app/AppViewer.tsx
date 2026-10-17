'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, FileText, FolderOpen, Search, Sparkles, Wrench, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PdfJsZoomBar, usePdfJsViewer } from '@/components/app/PdfJsZoomBar';
import { getAllTools, getToolById, POPULAR_TOOL_IDS } from '@/config/tools';
import { getToolIcon } from '@/config/icons';
import { searchTools } from '@/lib/utils/search';
import { withBasePath } from '@/lib/utils/path';
import { onViewerFile, queueForTool, queueForViewer, takeViewerFile } from '@/lib/app/file-handoff';
import { type Locale } from '@/lib/i18n/config';
import { type Tool } from '@/types/tool';

type LocalizedTools = Record<string, { title: string; description: string }>;

export interface AppViewerProps {
  locale: Locale;
  localizedToolContent?: LocalizedTools;
}

/**
 * Full-screen PDF viewer of the Android app (PDF.js), with touch-sized zoom controls
 * and a hand-over of the open document to any PDF tool.
 */
export function AppViewer({ locale, localizedToolContent = {} }: AppViewerProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewer = usePdfJsViewer(iframeRef, pdfUrl);

  // Files arrive from the home screen or from "Open with" in other apps
  useEffect(() => {
    const receive = () => {
      const incoming = takeViewerFile();
      if (incoming) setFile(incoming);
    };
    receive();
    return onViewerFile(receive);
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Studio and every tool page pick the document up on arrival
  const openWith = (path: string) => {
    if (!file) return;
    queueForTool(file);
    setToolsOpen(false);
    router.push(`/${locale}${path}`);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[hsl(var(--color-background))]">
      <Header
        locale={locale}
        title={file?.name || 'PDF Viewer'}
        actions={
          <>
            <HeaderButton label="Open a PDF" onClick={() => inputRef.current?.click()}>
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
            </HeaderButton>
            {file && (
              <HeaderButton label="Tools" onClick={() => setToolsOpen(true)}>
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </HeaderButton>
            )}
          </>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) queueForViewer(picked);
          e.target.value = '';
        }}
      />

      <main id="main-content" className="relative flex-1" tabIndex={-1}>
        {pdfUrl && file ? (
          <>
            <iframe
              ref={iframeRef}
              key={pdfUrl}
              src={withBasePath(`/pdfjs-viewer/viewer.html?file=${encodeURIComponent(pdfUrl)}`)}
              className="absolute inset-0 h-full w-full border-0"
              title={file.name}
            />
            <PdfJsZoomBar viewer={viewer} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
              <FileText className="h-10 w-10" aria-hidden="true" />
            </span>
            <h1 className="mb-2 text-xl font-semibold text-[hsl(var(--color-foreground))]">Open a PDF to start reading</h1>
            <p className="mb-6 max-w-xs text-sm text-[hsl(var(--color-muted-foreground))]">
              You can also open PDFs straight from Files, WhatsApp or email: choose PDFCraft under &ldquo;Open with&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-12 rounded-full bg-[hsl(var(--color-primary))] px-8 font-semibold text-[hsl(var(--color-primary-foreground))] active:opacity-90"
            >
              Choose PDF
            </button>
          </div>
        )}
      </main>

      {toolsOpen && (
        <ToolsSheet
          localizedToolContent={localizedToolContent}
          onPick={(tool) => openWith(`/tools/${tool.slug}`)}
          onOpenStudio={() => openWith('/studio')}
          onClose={() => setToolsOpen(false)}
        />
      )}
    </div>
  );
}

function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-[hsl(var(--color-foreground))] active:bg-[hsl(var(--color-muted))]"
    >
      {children}
    </button>
  );
}

/** Bottom sheet listing PDF Studio and the tools that take a PDF, popular ones first */
function ToolsSheet({
  localizedToolContent,
  onPick,
  onOpenStudio,
  onClose,
}: {
  localizedToolContent: LocalizedTools;
  onPick: (tool: Tool) => void;
  onOpenStudio: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState('');

  const pdfTools = useMemo(() => {
    const acceptsPdf = (tool: Tool) => tool.acceptedFormats.includes('.pdf');
    if (query.trim()) {
      return searchTools(query, localizedToolContent).map((r) => r.tool).filter(acceptsPdf);
    }
    const popular = POPULAR_TOOL_IDS.map((id) => getToolById(id)).filter(
      (tool): tool is Tool => tool !== undefined && acceptsPdf(tool)
    );
    const rest = getAllTools().filter((tool) => acceptsPdf(tool) && !POPULAR_TOOL_IDS.includes(tool.id));
    return [...popular, ...rest];
  }, [query, localizedToolContent]);

  const toolName = (tool: Tool) =>
    localizedToolContent[tool.id]?.title ||
    tool.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[80dvh] flex-col rounded-t-3xl bg-[hsl(var(--color-card))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Open in a tool"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="text-base font-semibold text-[hsl(var(--color-foreground))]">Open in a tool</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.buttons.close')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--color-muted-foreground))] active:bg-[hsl(var(--color-muted))]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="relative px-4 pb-2">
          <Search
            className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--color-muted-foreground))]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search.placeholder')}
            aria-label={t('common.search.placeholder')}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-background))] pl-10 pr-3 text-base text-[hsl(var(--color-foreground))] placeholder:text-[hsl(var(--color-muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
          />
        </div>
        <ul className="flex-1 divide-y divide-[hsl(var(--color-border)/0.6)] overflow-y-auto pb-4">
          {!query.trim() && (
            <li>
              <button
                type="button"
                onClick={onOpenStudio}
                className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[hsl(var(--color-muted))]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--color-primary))] to-[hsl(var(--color-accent))] text-white">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[hsl(var(--color-foreground))]">Edit in PDF Studio</span>
                  <span className="block truncate text-xs text-[hsl(var(--color-muted-foreground))]">Several edits in a row, with undo</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
              </button>
            </li>
          )}
          {pdfTools.map((tool) => {
            const Icon = getToolIcon(tool.icon);
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => onPick(tool)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-[hsl(var(--color-muted))]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[hsl(var(--color-foreground))]">
                    {toolName(tool)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
                </button>
              </li>
            );
          })}
          {pdfTools.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[hsl(var(--color-muted-foreground))]">
              {t('common.search.noResults')}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default AppViewer;
