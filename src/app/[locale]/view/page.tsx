import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { locales, type Locale } from '@/lib/i18n/config';
import { IS_ANDROID_APP } from '@/lib/platform';
import { AppViewer } from '@/components/app/AppViewer';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'PDF Viewer',
  robots: { index: false, follow: false },
};

interface ViewPageProps {
  params: Promise<{ locale: string }>;
}

/** Full-screen PDF viewer of the Android app; the website has the PDF Reader tool instead. */
export default async function ViewPage({ params }: ViewPageProps) {
  if (!IS_ANDROID_APP) {
    notFound();
  }

  const { locale } = await params;
  setRequestLocale(locale);

  const { tools } = await import('@/config/tools');
  const { getToolContent } = await import('@/config/tool-content');
  const localizedToolContent = tools.reduce((acc, tool) => {
    const content = getToolContent(locale as Locale, tool.id);
    if (content) {
      acc[tool.id] = { title: content.title, description: content.metaDescription };
    }
    return acc;
  }, {} as Record<string, { title: string; description: string }>);

  return <AppViewer locale={locale as Locale} localizedToolContent={localizedToolContent} />;
}
