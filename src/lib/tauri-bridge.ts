/**
 * Tauri Bridge
 * Provides a unified interface for file operations in both Tauri and Browser environments.
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

const browserFileStore = new Map<string, File>();

export const isTauri = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  );
};

/**
 * Tauri running on Android. The native dialogs there return content:// URIs instead of
 * file system paths, so file I/O must go through the fs plugin rather than std::fs.
 */
export const isAndroidTauri = (): boolean => {
  return isTauri() && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
};

// Android IPC serializes payloads as JSON, so large files are written in chunks
const ANDROID_WRITE_CHUNK_SIZE = 2 * 1024 * 1024;

async function writeAndroidFile(target: string, data: Blob | Uint8Array): Promise<void> {
  const { open } = await import('@tauri-apps/plugin-fs');
  const handle = await open(target, { write: true, create: true, truncate: true });
  try {
    const size = data instanceof Blob ? data.size : data.byteLength;
    for (let offset = 0; offset < size; offset += ANDROID_WRITE_CHUNK_SIZE) {
      const end = Math.min(offset + ANDROID_WRITE_CHUNK_SIZE, size);
      const chunk =
        data instanceof Blob
          ? new Uint8Array(await data.slice(offset, end).arrayBuffer())
          : data.subarray(offset, end);
      let written = 0;
      while (written < chunk.byteLength) {
        written += await handle.write(chunk.subarray(written));
      }
    }
  } finally {
    await handle.close();
  }
}

/**
 * Dynamically import Tauri invoke to avoid build-time issues in non-Tauri environments
 */
async function getTauriInvoke() {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

export async function openFiles(filters: FileFilter[] = []): Promise<string[]> {
  // On Android the WebView's own file chooser is used, since native picks are content:// URIs
  if (isTauri() && !isAndroidTauri()) {
    const invoke = await getTauriInvoke();
    return invoke<string[]>('open_files', { filters });
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (filters.length > 0) {
      const exts = filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
      input.accept = exts.join(',');
    }

    input.onchange = () => {
      if (input.files) {
        const files = Array.from(input.files).map((file) => {
          const browserPath = `__browser__/${crypto.randomUUID()}/${file.name}`;
          browserFileStore.set(browserPath, file);
          return browserPath;
        });
        resolve(files);
      } else {
        resolve([]);
      }
    };

    input.click();
  });
}

export function getFiltersForFilename(filename: string): FileFilter[] {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
  if (!ext) {
    return [{ name: 'All Files', extensions: ['*'] }];
  }

  const extMap: Record<string, string> = {
    pdf: 'PDF Document',
    xlsx: 'Excel Spreadsheet',
    xls: 'Excel Spreadsheet',
    docx: 'Word Document',
    doc: 'Word Document',
    pptx: 'PowerPoint Presentation',
    ppt: 'PowerPoint Presentation',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    webp: 'WebP Image',
    svg: 'SVG Image',
    zip: 'ZIP Archive',
    txt: 'Text Document',
    json: 'JSON Document',
    csv: 'CSV Document',
  };

  const label = extMap[ext] || `${ext.toUpperCase()} File`;
  return [
    { name: label, extensions: [ext] },
    { name: 'All Files', extensions: ['*'] },
  ];
}

export async function saveFile(suggestedName: string, filters: FileFilter[] = []): Promise<string | null> {
  if (isAndroidTauri()) {
    // Opens the system "Save as" picker and returns a content:// URI
    const { save } = await import('@tauri-apps/plugin-dialog');
    return save({
      defaultPath: suggestedName,
      filters: filters.filter((f) => !f.extensions.includes('*')),
    });
  }

  if (isTauri()) {
    try {
      const invoke = await getTauriInvoke();
      return await invoke<string>('save_file', { suggestedName, filters });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (
        errMsg.includes('No file selected') ||
        errMsg.includes('canceled') ||
        errMsg.includes('cancelled')
      ) {
        return null;
      }
      // Fallback: attempt to use @tauri-apps/plugin-dialog save
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const res = await save({
          defaultPath: suggestedName,
          filters: filters.map((f) => ({ name: f.name, extensions: f.extensions })),
        });
        return res;
      } catch {
        throw err;
      }
    }
  }

  // Browser fallback: no native save path API, use filename as virtual path.
  return suggestedName.replace(/^[/\\]+/, '');
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
  if (isTauri() && !browserFileStore.has(path)) {
    const invoke = await getTauriInvoke();
    const data = await invoke<number[]>('read_file', { path });
    return new Uint8Array(data);
  }

  const file = browserFileStore.get(path);
  if (!file) {
    throw new Error(`File not found in browser session: ${path}`);
  }

  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function writeFileBytes(path: string, data: Uint8Array): Promise<void> {
  if (isAndroidTauri()) {
    await writeAndroidFile(path, data);
    return;
  }

  if (isTauri()) {
    try {
      const invoke = await getTauriInvoke();
      await invoke('write_file', { path, data: Array.from(data) });
      return;
    } catch (err) {
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs');
        await writeFile(path, data);
        return;
      } catch {
        throw err;
      }
    }
  }

  const blobData = new Uint8Array(data.byteLength);
  blobData.set(data);
  const blob = new Blob([blobData.buffer]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = path.split('/').pop() || path.split('\\').pop() || 'download.bin';
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Saves a Blob or byte array to disk.
 * - In Tauri desktop environment: opens native OS Save File dialog for the user to choose
 *   the destination directory and filename, then writes the file bytes.
 * - In Browser environment: triggers standard browser download via temporary <a> element.
 *
 * @param fileData Blob or Uint8Array containing file content
 * @param suggestedName Suggested filename (e.g., 'converted.pdf')
 * @param filters Optional file dialog filters
 * @returns Promise<boolean> Returns true if file was saved / downloaded, false if cancelled by user.
 */
export async function saveBlobFile(
  fileData: Blob | Uint8Array,
  suggestedName: string,
  filters?: FileFilter[]
): Promise<boolean> {
  const activeFilters =
    filters && filters.length > 0 ? filters : getFiltersForFilename(suggestedName);

  if (isAndroidTauri()) {
    const target = await saveFile(suggestedName, activeFilters);
    if (!target) {
      return false;
    }
    await writeAndroidFile(target, fileData);
    return true;
  }

  if (isTauri()) {
    const selectedPath = await saveFile(suggestedName, activeFilters);
    if (!selectedPath) {
      // User cancelled dialog
      return false;
    }

    let bytes: Uint8Array;
    if (fileData instanceof Uint8Array) {
      bytes = fileData;
    } else {
      const buffer = await fileData.arrayBuffer();
      bytes = new Uint8Array(buffer);
    }

    await writeFileBytes(selectedPath, bytes);
    return true;
  }

  // Browser fallback: <a> tag download
  let blob: Blob;
  if (fileData instanceof Blob) {
    blob = fileData;
  } else {
    const copy = new Uint8Array(fileData.byteLength);
    copy.set(fileData);
    blob = new Blob([copy.buffer]);
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  return true;
}

let androidDownloadInterceptorInstalled = false;
let androidSaveQueue: Promise<unknown> = Promise.resolve();

function saveAnchorDownloadOnAndroid(anchor: HTMLAnchorElement): void {
  const name = anchor.getAttribute('download') || 'download';
  // fetch() resolves the blob: URL immediately, so a later revokeObjectURL() is harmless
  const blobPromise = fetch(anchor.href).then((res) => res.blob());
  // One save dialog at a time when several downloads fire together
  androidSaveQueue = androidSaveQueue
    .then(() => blobPromise)
    .then((blob) => saveBlobFile(blob, name))
    .catch((err) => console.error('Failed to save download on Android:', err));
}

function isInterceptableDownload(anchor: HTMLAnchorElement): boolean {
  return anchor.hasAttribute('download') && /^(blob|data):/i.test(anchor.href);
}

/**
 * Android's WebView ignores <a download> clicks. Route blob:/data: downloads through
 * the native save dialog instead. No-op outside the Android app.
 */
export function installAndroidDownloadInterceptor(): void {
  if (androidDownloadInterceptorInstalled || !isAndroidTauri()) return;
  androidDownloadInterceptorInstalled = true;

  // Programmatic a.click(), including on anchors never attached to the document
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (isInterceptableDownload(this)) {
      saveAnchorDownloadOnAndroid(this);
      return;
    }
    originalClick.call(this);
  };

  // Real taps on download links rendered in the page
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[download]') as HTMLAnchorElement | null;
      if (!anchor || !isInterceptableDownload(anchor)) return;
      event.preventDefault();
      saveAnchorDownloadOnAndroid(anchor);
    },
    true
  );
}

/**
 * Opens a URL in the system's default web browser.
 * In a desktop Tauri environment, it invokes the native open_url command.
 * In a standard browser environment, it falls back to window.open or anchor click.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;

  if (isTauri()) {
    try {
      const invoke = await getTauriInvoke();
      await invoke('open_url', { url });
      return true;
    } catch (err) {
      console.warn('Tauri native open_url failed, trying browser fallbacks:', err);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) return true;
    } catch {
      // ignore
    }

    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 100);
      return true;
    } catch (e) {
      console.error('Failed to open link via fallback anchor:', e);
    }
  }

  return false;
}

export interface SystemPrinter {
  name: string;
  is_default: boolean;
  port_name?: string | null;
}

/**
 * Fetch installed system printers.
 * In a desktop Tauri environment: queries real OS printers (local, network, USB).
 * In a standard browser environment: returns empty array.
 */
export async function getSystemPrinters(): Promise<SystemPrinter[]> {
  if (isTauri()) {
    try {
      const invoke = await getTauriInvoke();
      return await invoke<SystemPrinter[]>('get_system_printers');
    } catch (err) {
      console.warn('Failed to get system printers via Tauri:', err);
    }
  }
  return [];
}

/**
 * Print a PDF document natively or via browser fallback.
 * In desktop Tauri environment: invokes native print to specific printer or default printer.
 * In browser environment: falls back to window.print().
 */
export async function printPdfFile(
  fileData: Blob | Uint8Array,
  printerName?: string
): Promise<{ success: boolean; error?: string }> {
  if (isTauri()) {
    try {
      const invoke = await getTauriInvoke();
      let bytes: Uint8Array;
      if (fileData instanceof Uint8Array) {
        bytes = fileData;
      } else {
        const buffer = await fileData.arrayBuffer();
        bytes = new Uint8Array(buffer);
      }
      await invoke('print_pdf_file', {
        data: Array.from(bytes),
        printerName: printerName || null,
      });
      return { success: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errMsg };
    }
  }

  // Browser fallback
  if (typeof window !== 'undefined') {
    window.print();
    return { success: true };
  }

  return { success: false, error: 'Environment does not support printing' };
}

