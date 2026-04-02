import type { MetadataRoute } from 'next'

import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageDefinitions } from '@/lib/docs/docs-pages'
import { getPublishedSanityDocsDataset } from '@/lib/sanity/docs'
import { INFO_PAGE_SLUGS } from '@/lib/site/info-pages'
import { SEO_LANDING_SLUGS } from '@/lib/site/seo-landing-pages'
import { PUBLIC_SITE, withLocalePath } from '@/lib/site/public-config'
import { absoluteUrl } from '@/lib/site/seo'

function buildEntry(path: string, priority: number, lastModified: string | Date = new Date()) {
  return {
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: 'weekly' as const,
    priority,
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []
  const seen = new Set<string>()

  const pushEntry = (path: string, priority: number, lastModified?: string | Date) => {
    const url = absoluteUrl(path)
    if (seen.has(url)) {
      return
    }

    seen.add(url)
    entries.push(buildEntry(path, priority, lastModified))
  }

  for (const locale of PUBLIC_SITE.supportedLocales) {
    pushEntry(withLocalePath(locale), 1)
    pushEntry(withLocalePath(locale, '/pricing'), 0.92)
    pushEntry(withLocalePath(locale, '/docs'), 0.84)

    for (const slug of SEO_LANDING_SLUGS) {
      pushEntry(withLocalePath(locale, `/${slug}`), 0.9)
    }

    for (const infoPage of INFO_PAGE_SLUGS) {
      pushEntry(withLocalePath(locale, `/${infoPage}`), infoPage === 'contact' ? 0.72 : 0.55)
    }

    const sanityDocsLocale = locale === 'en' ? 'en' : 'ru'
    const cms = await getPublishedSanityDocsDataset(sanityDocsLocale)

    if (cms && cms.pages.length > 0) {
      for (const page of cms.pages) {
        const revision = cms.revisionsByPageId[page.id]
        if (revision?.seo?.noIndex) {
          continue
        }
        const suffix = page.isHome ? '/docs' : `/docs/${page.path}`
        pushEntry(withLocalePath(locale, suffix), 0.76, revision?.createdAt || page.updatedAt)
      }
      continue
    }

    const content = await getDocsContentWithMarkdown(locale)
    for (const page of getDocsPageDefinitions(content)) {
      pushEntry(withLocalePath(locale, `/docs/${page.slug}`), 0.76)
    }
  }

  return entries
}
