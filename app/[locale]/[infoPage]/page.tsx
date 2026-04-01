import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import type { Locale } from '@/app/i18n'
import { locales } from '@/app/i18n'
import { InfoPageShell } from '@/components/site/info-page-shell'
import { INFO_PAGE_SLUGS, getInfoPageContent, isInfoPageSlug, type InfoPageSlug } from '@/lib/site/info-pages'
import { getPublicStatusHistory } from '@/lib/site/status-history'

export const revalidate = 3600

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    INFO_PAGE_SLUGS.map((infoPage) => ({ locale, infoPage }))
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; infoPage: string }>
}): Promise<Metadata> {
  const { locale, infoPage } = await params

  if (!locales.includes(locale as Locale) || !isInfoPageSlug(infoPage)) {
    return {}
  }

  const content = getInfoPageContent(locale as Locale, infoPage)

  return {
    title: `${content.title} | CBTooll`,
    description: content.description,
  }
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ locale: string; infoPage: string }>
}) {
  const { locale, infoPage } = await params

  if (!locales.includes(locale as Locale) || !isInfoPageSlug(infoPage)) {
    notFound()
  }

  const safeLocale = locale as Locale
  const slug = infoPage as InfoPageSlug
  const content = getInfoPageContent(safeLocale, slug)

  if (slug !== 'status') {
    return <InfoPageShell locale={locale} content={content} />
  }

  const statusHistory = await getPublicStatusHistory(safeLocale)

  return (
    <InfoPageShell
      locale={locale}
      content={{
        ...content,
        updatedAt: statusHistory.updatedAtLabel,
      }}
      statusHistory={statusHistory}
    />
  )
}
