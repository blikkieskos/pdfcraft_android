'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

// The parts of PDF.js's PDFViewerApplication (inside a pdfjs-viewer/viewer.html iframe) used here
interface PdfJsApp {
  initializedPromise: Promise<void>;
  eventBus: { on(name: string, listener: (event: Record<string, number>) => void): void };
  pdfViewer: { currentScaleValue: string };
  zoomIn(): void;
  zoomOut(): void;
}
type PdfJsWindow = Window & { PDFViewerApplication?: PdfJsApp };

const getViewerApp = (iframe: HTMLIFrameElement | null) =>
  (iframe?.contentWindow as PdfJsWindow | null)?.PDFViewerApplication;

export interface PdfJsViewerState {
  page: number;
  pageCount: number;
  scale: number | null;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
}

/**
 * Follows the page and zoom of a PDF.js viewer iframe. Pass the iframe's src so the
 * listeners are re-attached whenever it loads another document.
 */
export function usePdfJsViewer(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  src: string | null
): PdfJsViewerState {
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !src) return;
    setPage(1);
    setPageCount(0);
    setScale(null);

    let cancelled = false;
    const attach = async () => {
      const app = getViewerApp(iframe);
      if (!app) return;
      await app.initializedPromise;
      if (cancelled) return;
      app.eventBus.on('pagesloaded', (e) => setPageCount(e.pagesCount));
      app.eventBus.on('pagechanging', (e) => setPage(e.pageNumber));
      app.eventBus.on('scalechanging', (e) => setScale(e.scale));
    };
    iframe.addEventListener('load', attach);
    return () => {
      cancelled = true;
      iframe.removeEventListener('load', attach);
    };
  }, [iframeRef, src]);

  const zoomIn = useCallback(() => getViewerApp(iframeRef.current)?.zoomIn(), [iframeRef]);
  const zoomOut = useCallback(() => getViewerApp(iframeRef.current)?.zoomOut(), [iframeRef]);
  const fitWidth = useCallback(() => {
    const app = getViewerApp(iframeRef.current);
    if (app) app.pdfViewer.currentScaleValue = 'page-width';
  }, [iframeRef]);

  return { page, pageCount, scale, zoomIn, zoomOut, fitWidth };
}

/**
 * Thumb-sized page counter and zoom buttons for a PDF.js viewer (pinch-to-zoom works too).
 * `leading` is shown first in the bar, e.g. a Tools button.
 */
export function PdfJsZoomBar({
  viewer,
  leading,
  className = '',
}: {
  viewer: PdfJsViewerState;
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3 ${className}`.trim()}>
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-slate-900/85 p-1 text-white shadow-xl backdrop-blur-md">
        {leading}
        <span className="min-w-[4.25rem] px-2 text-center text-sm font-medium tabular-nums">
          {viewer.pageCount > 0 ? `${viewer.page} / ${viewer.pageCount}` : '…'}
        </span>
        <span className="h-6 w-px bg-white/20" aria-hidden="true" />
        <ZoomButton label="Zoom out" onClick={viewer.zoomOut}>
          <Minus className="h-5 w-5" aria-hidden="true" />
        </ZoomButton>
        <button
          type="button"
          onClick={viewer.fitWidth}
          className="h-11 min-w-[3.75rem] rounded-full px-2 text-sm font-medium tabular-nums active:bg-white/15"
          aria-label="Fit to width"
        >
          {viewer.scale ? `${Math.round(viewer.scale * 100)}%` : 'Fit'}
        </button>
        <ZoomButton label="Zoom in" onClick={viewer.zoomIn}>
          <Plus className="h-5 w-5" aria-hidden="true" />
        </ZoomButton>
      </div>
    </div>
  );
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15"
    >
      {children}
    </button>
  );
}
