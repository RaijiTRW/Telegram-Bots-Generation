import { notFound, redirect } from 'next/navigation'

import { CmsDocsPage } from '@/components/docs/cms-docs-page'
import { DocsHashFocus } from '@/components/docs/docs-hash-focus'
import { CmsDocsSidebar } from '@/components/docs/cms-sidebar'
import { DocsHomePage } from '@/components/docs/docs-home-page'
import { DocsSectionPage } from '@/components/docs/docs-section-page'
import { DocumentationSidebar } from '@/components/docs/documentation-sidebar'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageBySlug, getDocsPageDefinitions } from '@/lib/docs/docs-pages'
import { buildDocsSearchIndex } from '@/lib/docs-cms/search-index'
import { getPublishedSanityDocsDataset, resolvePublishedSanityDocsPage } from '@/lib/sanity/docs'

export const dynamic = 'force-dynamic'

export default async function DashboardDocsCatchAllRoute({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>
}) {
  const { locale, slug } = await params
  const basePath = `/${locale}/dashboard/docs`
  const docsLocale = locale === 'en' ? 'en' : 'ru'
  const cms = await getPublishedSanityDocsDataset(docsLocale)
  const hasCms = Boolean(cms && cms.pages.length > 0)

  if (hasCms && cms) {
    const requestedPath = Array.isArray(slug) ? slug.join('/') : ''
    const resolved = resolvePublishedSanityDocsPage(cms, requestedPath)

    if (!resolved) {
      notFound()
    }

    if ('redirectedFrom' in resolved && resolved.redirectedFrom) {
      const targetPath = resolved.page.isHome ? '' : resolved.page.path
      redirect(targetPath ? `${basePath}/${targetPath}` : basePath)
    }

    const currentPath = resolved.page.isHome ? '' : resolved.page.path
    const searchIndex = buildDocsSearchIndex(
      cms.tree,
      Object.fromEntries(
        Object.entries(cms.revisionsByPageId).map(([pageId, revision]) => [pageId, revision.blocks])
      )
    )

    return (
      <div className="w-full max-w-7xl mx-auto min-w-0 text-white">
        <DocsHashFocus />
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
          <CmsDocsSidebar
            locale={locale}
            basePath={basePath}
            tree={cms.tree}
            currentPath={currentPath}
            searchIndex={searchIndex}
          />
          <div className="min-w-0 space-y-8 lg:max-w-[1080px] 2xl:max-w-[1160px]">
            <CmsDocsPage
              locale={locale}
              basePath={basePath}
              page={resolved.page}
              revision={resolved.revision}
              tree={cms.tree}
              revisionsByPageId={cms.revisionsByPageId}
            />
          </div>
        </div>
      </div>
    )
  }

  const content = await getDocsContentWithMarkdown(locale)
  const pages = getDocsPageDefinitions(content)

  if (!slug || slug.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto min-w-0 text-white">
        <DocsHashFocus />
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <DocumentationSidebar
            content={content}
            locale={locale}
            pages={pages}
            currentPageSlug={null}
            basePath={basePath}
          />
          <div className="min-w-0 space-y-8">
            <DocsHomePage locale={locale} content={content} pages={pages} basePath={basePath} />
          </div>
        </div>
      </div>
    )
  }

  if (slug.length !== 1) {
    notFound()
  }

  const fallbackSlug = slug[0]
  const page = getDocsPageBySlug(content, fallbackSlug)
  if (!page) {
    notFound()
  }

  const pageIndex = pages.findIndex((item) => item.slug === page.slug)
  const previousPage = pageIndex > 0 ? pages[pageIndex - 1] : null
  const nextPage = pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 text-white">
      <DocsHashFocus />
      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
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
    </div>
  )
}
