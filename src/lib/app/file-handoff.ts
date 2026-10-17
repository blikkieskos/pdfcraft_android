/**
 * Hands a File from one screen of the Android app to another: home or "Open with" → viewer,
 * viewer → tool. Next.js client-side navigation keeps module state, so this survives
 * router.push().
 */

let viewerFile: File | null = null;
let toolFile: File | null = null;
const viewerListeners = new Set<() => void>();

/** Queue a file for the viewer; a mounted viewer is notified right away. */
export function queueForViewer(file: File): void {
  viewerFile = file;
  viewerListeners.forEach((listener) => listener());
}

export function takeViewerFile(): File | null {
  const file = viewerFile;
  viewerFile = null;
  return file;
}

/** Subscribe to files queued for the viewer. Returns an unsubscribe function. */
export function onViewerFile(listener: () => void): () => void {
  viewerListeners.add(listener);
  return () => {
    viewerListeners.delete(listener);
  };
}

/** Queue a file for the next tool page; its first file uploader picks it up. */
export function queueForTool(file: File): void {
  toolFile = file;
}

export function takeToolFile(): File | null {
  const file = toolFile;
  toolFile = null;
  return file;
}
