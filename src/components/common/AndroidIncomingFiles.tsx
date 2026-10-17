'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isAndroidTauri } from '@/lib/tauri-bridge';
import { queueForViewer } from '@/lib/app/file-handoff';

/**
 * Opens PDFs that other apps sent to PDFCraft ("Open with" / "Share") in the viewer.
 * MainActivity.kt stores them and src-tauri/src/lib.rs serves them over the
 * pdfcraft-incoming protocol. Renders nothing; does nothing outside the Android app.
 */
export function AndroidIncomingFiles({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!isAndroidTauri()) return;

    const openPending = async () => {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const pending = await fetch(convertFileSrc('pending', 'pdfcraft-incoming'));
      if (pending.status !== 200) return;
      const { file, name } = (await pending.json()) as { file: string; name: string };
      const pdf = await fetch(convertFileSrc(file, 'pdfcraft-incoming'));
      if (!pdf.ok) return;
      queueForViewer(new File([await pdf.blob()], name, { type: 'application/pdf' }));
      if (!pathnameRef.current.startsWith(`/${locale}/view`)) {
        router.push(`/${locale}/view`);
      }
    };

    // A file can land while a check is in flight, so check again rather than drop the signal
    let running = false;
    let checkAgain = false;
    const check = async () => {
      if (running) {
        checkAgain = true;
        return;
      }
      running = true;
      do {
        checkAgain = false;
        try {
          await openPending();
        } catch (err) {
          console.error('Could not open the shared PDF:', err);
        }
      } while (checkAgain);
      running = false;
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    window.addEventListener('pdfcraft-incoming-file', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('pdfcraft-incoming-file', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [locale, router]);

  return null;
}
