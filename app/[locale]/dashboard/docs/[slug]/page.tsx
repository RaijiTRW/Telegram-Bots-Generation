import { notFound } from 'next/navigation'

import { DocumentationSidebar } from '@/components/docs/documentation-sidebar'
import { DocsSectionPage } from '@/components/docs/docs-section-page'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageBySlug, getDocsPageDefinitions } from '@/lib/docs/docs-pages'

export default async function DashboardDocsSectionPage({
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
  const basePath = `/${locale}/dashboard/docs`

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <DocumentationSidebar
        content={content}
        locale={locale}
        pages={pages}
        currentPageSlug={page.slug}
        basePath={basePath}
      />
      <div className="min-w-0 space-y-8">
        <DocsSectionPage
          locale={locale}
          content={content}
          page={page}
          previousPage={previousPage}
          nextPage={nextPage}
          basePath={basePath}
        />
      </div>
    </div>
  )
}

