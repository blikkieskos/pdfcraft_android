'use client';

import { useEffect } from 'react';
import { installAndroidDownloadInterceptor } from '@/lib/tauri-bridge';

/**
 * Makes plain <a download> links save files in the Android app.
 * Renders nothing; does nothing on the web or desktop.
 */
export function AndroidDownloadBridge() {
  useEffect(() => {
    installAndroidDownloadInterceptor();
  }, []);

  return null;
}
