import type { Metadata } from 'next'

import { SeoLandingPage } from '@/components/site/seo-landing-page'
import { toLocale } from '@/lib/site/public-config'
import { getSeoLandingMetadata, getSeoLandingPage } from '@/lib/site/seo-landing-pages'

const slug = 'no-code-telegram-bot' as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return getSeoLandingMetadata(toLocale(locale), slug)
}

export default async function NoCodeTelegramBotPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const safeLocale = toLocale(locale)

  return <SeoLandingPage locale={safeLocale} page={getSeoLandingPage(safeLocale, slug)} />
}

