import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '../i18n';
import { MotionWrapper } from '@/components/motion-wrapper';
import { DashboardPresenceHeartbeat } from '@/components/dashboard/dashboard-presence-heartbeat';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

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
      <DashboardPresenceHeartbeat />
      <MotionWrapper>{children}</MotionWrapper>
    </NextIntlClientProvider>
  );
}
