import { notFound, redirect } from 'next/navigation'

import { Footer } from '@/components/footer/footer'
import { Header } from '@/components/header/header'
import { CmsDocsPage } from '@/components/docs/cms-docs-page'
import { DocsHashFocus } from '@/components/docs/docs-hash-focus'
import { CmsDocsSidebar } from '@/components/docs/cms-sidebar'
import { DocsFrame } from '@/components/docs/docs-frame'
import { DocsHomePage } from '@/components/docs/docs-home-page'
import { DocsSectionPage } from '@/components/docs/docs-section-page'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageBySlug, getDocsPageDefinitions } from '@/lib/docs/docs-pages'
import { buildDocsSearchIndex } from '@/lib/docs-cms/search-index'
import { getPublishedSanityDocsDataset, resolvePublishedSanityDocsPage } from '@/lib/sanity/docs'

export const dynamic = 'force-dynamic'

export default async function DocsCatchAllRoute({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>
}) {
  const { locale, slug } = await params
  const docsLocale = locale === 'en' ? 'en' : 'ru'
  const cms = await getPublishedSanityDocsDataset(docsLocale)
  const hasCms = Boolean(cms && cms.pages.length > 0)

  if (hasCms && cms) {
    const basePath = `/${locale}/docs`
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
    const searchIndex = buildDocsSearchIndex(cms.tree, Object.fromEntries(
      Object.entries(cms.revisionsByPageId).map(([pageId, revision]) => [pageId, revision.blocks])
    ))

    return (
      <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-20">
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
        </main>
        <Footer />
      </div>
    )
  }

  const content = await getDocsContentWithMarkdown(locale)
  if (!slug || slug.length === 0) {
    const pages = getDocsPageDefinitions(content)
    return (
      <DocsFrame locale={locale} content={content} currentPageSlug={null}>
        <DocsHashFocus />
        <DocsHomePage locale={locale} content={content} pages={pages} />
      </DocsFrame>
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
  const pages = getDocsPageDefinitions(content)
  const pageIndex = pages.findIndex((item) => item.slug === page.slug)
  const previousPage = pageIndex > 0 ? pages[pageIndex - 1] : null
  const nextPage = pageIndex >= 0 && pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null

  return (
    <DocsFrame locale={locale} content={content} currentPageSlug={page.slug}>
      <DocsHashFocus />
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
