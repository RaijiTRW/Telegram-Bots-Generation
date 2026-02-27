import { notFound } from 'next/navigation'

import { DocsFrame } from '@/components/docs/docs-frame'
import { DocsSectionPage } from '@/components/docs/docs-section-page'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageDefinitions, getDocsPageBySlug } from '@/lib/docs/docs-pages'

export default async function DocsSectionRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const content = await getDocsContentWithMarkdown(locale)
  const page = getDocsPageBySlug(content, slug)

  if (!page) {
    notFound()
  }

  const pages = getDocsPageDefinitions(content)
  const pageIndex = pages.findIndex((item) => item.slug === page.slug)
  const previousPage = pageIndex > 0 ? pages[pageIndex - 1] : null
  const nextPage = pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null

  return (
    <DocsFrame locale={locale} content={content} currentPageSlug={page.slug}>
      <DocsSectionPage
        locale={locale}
        content={content}
        page={page}
        previousPage={previousPage}
        nextPage={nextPage}
      />
    </DocsFrame>
  )
}
