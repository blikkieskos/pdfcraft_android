'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, ChevronRight, FileCheck2 } from 'lucide-react';
import {
  DEFAULT_PDF_APP_CHANGED_EVENT,
  getDefaultPdfAppStatus,
  setUpDefaultPdfApp,
  type DefaultPdfAppStatus,
} from '@/lib/app/default-pdf-app';

const DISMISSED_KEY = 'pdfcraft-default-prompt-dismissed';

/**
 * Current default-PDF-app status, refreshed when the user comes back from Android's
 * settings or picks PDFCraft in the "Open with" sheet. `lastPick` says whether that pick
 * was "Always" (it stuck) or "Just once".
 */
function useDefaultPdfApp() {
  const [status, setStatus] = useState<DefaultPdfAppStatus | null>(null);
  const [lastPick, setLastPick] = useState<'always' | 'once' | null>(null);

  useEffect(() => {
    const refresh = () => setStatus(getDefaultPdfAppStatus());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onPicked = () => {
      const current = getDefaultPdfAppStatus();
      setStatus(current);
      setLastPick(current?.status === 'self' ? 'always' : 'once');
    };

    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(DEFAULT_PDF_APP_CHANGED_EVENT, onPicked);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(DEFAULT_PDF_APP_CHANGED_EVENT, onPicked);
    };
  }, []);

  return { status, lastPick };
}

/** Home screen prompt, shown until PDFCraft is the default PDF app or the user dismisses it */
export function DefaultPdfAppCard() {
  const { status, lastPick } = useDefaultPdfApp();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!status) return null;

  if (status.status === 'self') {
    return lastPick === 'always' ? (
      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
        <BadgeCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        Done! PDFs from other apps now open in PDFCraft.
      </div>
    ) : null;
  }

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
  };

  return (
    <div className="mt-2 rounded-2xl border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)] p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--color-primary))]" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {status.status === 'other' ? (
            <>
              <p className="font-semibold text-[hsl(var(--color-foreground))]">PDFs open in {status.app} right now</p>
              <p className="mt-1 text-[hsl(var(--color-muted-foreground))]">
                To switch: in its settings tap <strong>Open by default</strong> (or <strong>Set as default</strong>)
                → <strong>Clear defaults</strong>. Then come back here.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[hsl(var(--color-foreground))]">Open all your PDFs with PDFCraft</p>
              <p className="mt-1 text-[hsl(var(--color-muted-foreground))]">
                {lastPick === 'once'
                  ? 'That was "Just once". Try again and tap Always so it sticks.'
                  : 'Tap Set as default, choose PDFCraft, then tap Always.'}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="h-10 whitespace-nowrap rounded-full px-4 text-sm font-medium text-[hsl(var(--color-muted-foreground))] active:bg-[hsl(var(--color-muted))]"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={setUpDefaultPdfApp}
          className="h-10 whitespace-nowrap rounded-full bg-[hsl(var(--color-primary))] px-5 text-sm font-semibold text-[hsl(var(--color-primary-foreground))] active:opacity-90"
        >
          {status.status === 'other' ? 'Open settings' : 'Set as default'}
        </button>
      </div>
    </div>
  );
}

/** Always-available settings row for the bottom of the home screen */
export function DefaultPdfAppRow() {
  const { status } = useDefaultPdfApp();
  if (!status) return null;

  const isSelf = status.status === 'self';
  const value = isSelf ? 'PDFCraft' : status.status === 'other' ? status.app : 'Not set';

  return (
    <button
      type="button"
      onClick={isSelf ? undefined : setUpDefaultPdfApp}
      disabled={isSelf}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] px-4 py-3.5 text-left active:bg-[hsl(var(--color-muted))] disabled:active:bg-[hsl(var(--color-card))]"
    >
      <FileCheck2 className="h-5 w-5 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
      <span className="flex-1 text-sm font-medium text-[hsl(var(--color-foreground))]">Default PDF app</span>
      <span
        className={`text-sm ${isSelf ? 'text-emerald-600 dark:text-emerald-400' : 'text-[hsl(var(--color-muted-foreground))]'}`}
      >
        {value}
      </span>
      {isSelf ? (
        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--color-muted-foreground))]" aria-hidden="true" />
      )}
    </button>
  );
}
