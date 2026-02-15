import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '../i18n';
import type { Metadata } from 'next';
import { MotionWrapper } from '@/components/motion-wrapper';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: "TFlow — Telegram Bot Builder with AI",
  description: "Create Telegram bots in 60 seconds with AI. No code, no servers, just describe what you need.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <MotionWrapper>{children}</MotionWrapper>
    </NextIntlClientProvider>
  );
}
