import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Footer } from '@/components/footer/footer'
import { Header } from '@/components/header/header'
import { JsonLd } from '@/components/seo/json-ld'
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
import { PUBLIC_SITE, toLocale } from '@/lib/site/public-config'
import {
  buildBreadcrumbSchema,
  buildWebPageSchema,
  getDocsMetadata,
} from '@/lib/site/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const safeLocale = toLocale(locale)
  const docsLocale = safeLocale === 'en' ? 'en' : 'ru'
  const requestedPath = Array.isArray(slug) ? slug.join('/') : ''
  const cms = await getPublishedSanityDocsDataset(docsLocale)

  if (cms && cms.pages.length > 0) {
    const resolved = resolvePublishedSanityDocsPage(cms, requestedPath)

    if (resolved && !('redirectedFrom' in resolved && resolved.redirectedFrom)) {
      const pagePath = resolved.page.isHome ? '/docs' : `/docs/${resolved.page.path}`
      const title = resolved.revision.seo.title || `${resolved.page.title} | ${PUBLIC_SITE.brandName}`
      const description =
        resolved.revision.seo.description ||
        resolved.page.summary ||
        (safeLocale === 'ru'
          ? 'Документация по созданию, настройке и запуску Telegram-ботов в CBTooll.'
          : 'Documentation for building, configuring, and launching Telegram bots in CBTooll.')

      return getDocsMetadata(safeLocale, title, description, pagePath, Boolean(resolved.revision.seo.noIndex))
    }
  }

  if (!slug || slug.length === 0) {
    return getDocsMetadata(safeLocale)
  }

  if (slug.length !== 1) {
    return {}
  }

  const content = await getDocsContentWithMarkdown(safeLocale)
  const page = getDocsPageBySlug(content, slug[0])

  if (!page) {
    return {}
  }

  return getDocsMetadata(
    safeLocale,
    `${page.title} | ${PUBLIC_SITE.brandName}`,
    page.description,
    `/docs/${page.slug}`
  )
}

export default async function DocsCatchAllRoute({
  params,
}: {
  params: Promise<{ locale: string; slug?: string[] }>
}) {
  const { locale, slug } = await params
  const safeLocale = toLocale(locale)
  const docsLocale = safeLocale === 'en' ? 'en' : 'ru'
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
        <JsonLd
          data={[
            buildWebPageSchema(
              safeLocale,
              currentPath ? `/docs/${currentPath}` : '/docs',
              resolved.page.title,
              resolved.revision.seo.description || resolved.page.summary || resolved.page.title
            ),
            buildBreadcrumbSchema(safeLocale, [
              { name: safeLocale === 'ru' ? 'Главная' : 'Home', path: '' },
              { name: safeLocale === 'ru' ? 'Документация' : 'Documentation', path: '/docs' },
              ...(resolved.page.isHome ? [] : [{ name: resolved.page.title, path: `/docs/${resolved.page.path}` }]),
            ]),
          ]}
        />
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
      <>
        <JsonLd
          data={[
            buildWebPageSchema(
              safeLocale,
              '/docs',
              safeLocale === 'ru'
                ? 'Документация по Telegram-ботам и запуску | CBTooll'
                : 'Telegram Bot Documentation and Launch Guides | CBTooll',
              safeLocale === 'ru'
                ? 'Инструкции по созданию, настройке, запуску и тестированию Telegram-ботов в CBTooll.'
                : 'Guides for building, configuring, launching, and testing Telegram bots in CBTooll.'
            ),
            buildBreadcrumbSchema(safeLocale, [
              { name: safeLocale === 'ru' ? 'Главная' : 'Home', path: '' },
              { name: safeLocale === 'ru' ? 'Документация' : 'Documentation', path: '/docs' },
            ]),
          ]}
        />
        <DocsFrame locale={locale} content={content} currentPageSlug={null}>
          <DocsHashFocus />
          <DocsHomePage locale={locale} content={content} pages={pages} />
        </DocsFrame>
      </>
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
    <>
      <JsonLd
        data={[
          buildWebPageSchema(safeLocale, `/docs/${page.slug}`, `${page.title} | ${PUBLIC_SITE.brandName}`, page.description),
          buildBreadcrumbSchema(safeLocale, [
            { name: safeLocale === 'ru' ? 'Главная' : 'Home', path: '' },
            { name: safeLocale === 'ru' ? 'Документация' : 'Documentation', path: '/docs' },
            { name: page.title, path: `/docs/${page.slug}` },
          ]),
        ]}
      />
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
    </>
  )
}
