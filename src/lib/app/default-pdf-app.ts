/**
 * Android app only: is PDFCraft the phone's default PDF app? Talks to the PdfCraftAndroid
 * bridge in MainActivity.kt. Android never lets an app make itself the default, so
 * setUpDefaultPdfApp() brings up the system's own "Open with → Always" choice, or the
 * settings of the app that currently holds the default.
 */

export type DefaultPdfAppStatus =
  | { status: 'self' }
  | { status: 'none' }
  | { status: 'other'; app: string };

interface PdfCraftAndroidBridge {
  getDefaultPdfApp(): string;
  setUpDefaultPdfApp(): string;
}

/** Fired by MainActivity when the user picked PDFCraft in the "Open with" sheet */
export const DEFAULT_PDF_APP_CHANGED_EVENT = 'pdfcraft-default-changed';

function getBridge(): PdfCraftAndroidBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { PdfCraftAndroid?: PdfCraftAndroidBridge }).PdfCraftAndroid;
}

/** null outside the Android app */
export function getDefaultPdfAppStatus(): DefaultPdfAppStatus | null {
  const bridge = getBridge();
  if (!bridge) return null;
  try {
    return JSON.parse(bridge.getDefaultPdfApp()) as DefaultPdfAppStatus;
  } catch {
    return null;
  }
}

export function setUpDefaultPdfApp(): void {
  getBridge()?.setUpDefaultPdfApp();
}
