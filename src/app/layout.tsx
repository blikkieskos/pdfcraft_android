import type { Metadata } from 'next';
import '@/app/globals.css';

import { siteConfig } from '@/config/site';
import { IS_ANDROID_APP } from '@/lib/platform';

// The Android app follows the system theme (live), so the web UI always matches the
// native status/navigation bar area. The website keeps its manual light/dark toggle.
const themeScript = IS_ANDROID_APP
  ? `
              try {
                var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
                var applyTheme = function () { document.documentElement.classList.toggle('dark', darkQuery.matches); };
                applyTheme();
                darkQuery.addEventListener('change', applyTheme);
              } catch (_) {}
            `
  : `
              try {
                if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

// Root layout - provides the basic HTML structure
// The actual layout with i18n is in [locale]/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={IS_ANDROID_APP ? 'app-android' : undefined} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="color-scheme" content="light dark" />
        <style dangerouslySetInnerHTML={{ __html: 'html{scrollbar-gutter:stable}' }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/coi-serviceworker.js`}
          data-coi="true"
          async
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
