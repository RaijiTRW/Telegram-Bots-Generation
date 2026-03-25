import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { DocsBlock, DocsLocale } from '../lib/docs-cms/types'
import {
  buildLegacyHomeBlocks,
  buildLegacyPageBlocks,
  getPublishedDocsDataset,
} from '../lib/docs-cms/repository'
import { getDocsContentWithMarkdown } from '../lib/docs/docs-content-loader'
import { getDocsPageDefinitions } from '../lib/docs/docs-pages'
import { getSanityWriteClient } from '../lib/sanity/client'
import { docsBlockToSanityBlock, sanitizeSanityDocsBlock } from '../lib/sanity/docs-blocks'
import { getSupabasePublicEnv } from '../lib/supabase/config'
import type { Database } from '../lib/supabase/types'

type ImportPage = {
  locale: DocsLocale
  sourceKey: string
  title: string
  summary: string
  slug: string
  sortOrder: number
  isHome: boolean
  parentSourceId: string | null
  logicalIdentity: string
  previousPaths: string[]
  seo: Record<string, unknown>
  blocks: DocsBlock[]
}

function getPageSummary(blocks: DocsBlock[]) {
  const firstParagraph = blocks.find(
    (block): block is Extract<DocsBlock, { type: 'paragraph' }> =>
      block.type === 'paragraph' && block.richText.trim().length > 0
  )

  return firstParagraph?.richText.trim() || ''
}

function shouldStripLegacyHomeTocList(block: DocsBlock) {
  return (
    block.type === 'list' &&
    block.items.length > 0 &&
    block.items.every((item) => typeof item === 'string' && item.includes(':'))
  )
}

function normalizeImportBlocks(page: Pick<ImportPage, 'isHome' | 'blocks'>) {
  if (!page.isHome) {
    return page.blocks
  }

  return page.blocks.filter((block) => !shouldStripLegacyHomeTocList(block))
}

function normalizePath(path: string) {
  const trimmed = String(path || '').trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

function sanitizeIdPart(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toSanityDocId(locale: DocsLocale, logicalIdentity: string) {
  const suffix = sanitizeIdPart(logicalIdentity) || 'page'
  return `docsPage.${locale}.${suffix}`
}

async function getSupabaseClient() {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv()
  if (!isConfigured || !url || !anonKey) {
    return null
  }

  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function getSupabaseImportPages(locale: DocsLocale): Promise<ImportPage[]> {
  const supabase = await getSupabaseClient()
  if (!supabase) {
    return []
  }

  const dataset = await getPublishedDocsDataset(supabase, locale)
  if (!dataset.pages.length) {
    return []
  }

  const { data: redirectRows, error: redirectsError } = await supabase
    .from('docs_redirects')
    .select('to_page_id, from_path')
    .eq('locale', locale)
    .eq('is_active', true)

  if (redirectsError) {
    throw redirectsError
  }

  const previousPathsByPageId = new Map<string, string[]>()
  for (const row of redirectRows || []) {
    const current = previousPathsByPageId.get(row.to_page_id) || []
    current.push(normalizePath(row.from_path))
    previousPathsByPageId.set(row.to_page_id, current)
  }

  return dataset.pages.map((page) => {
    const revision = dataset.revisionsByPageId[page.id]

    return {
      locale,
      sourceKey: page.id,
      title: page.title,
      summary: getPageSummary(revision?.blocks || []),
      slug: page.slug,
      sortOrder: page.sortOrder,
      isHome: page.isHome,
      parentSourceId: page.parentId,
      logicalIdentity: page.isHome ? 'home' : page.path || page.slug || page.id,
      previousPaths: (previousPathsByPageId.get(page.id) || []).filter((path) => path && path !== page.path),
      seo: revision?.seo || {},
      blocks: revision?.blocks || [],
    }
  })
}

async function getLegacyImportPages(locale: DocsLocale): Promise<ImportPage[]> {
  const content = await getDocsContentWithMarkdown(locale)
  const pageDefinitions = getDocsPageDefinitions(content)

  const pages: ImportPage[] = [
    {
      locale,
      sourceKey: 'home',
      title: content.hero.title,
      summary: content.hero.subtitle,
      slug: locale === 'ru' ? 'obzor-dokumentacii' : 'documentation-overview',
      sortOrder: 0,
      isHome: true,
      parentSourceId: null,
      logicalIdentity: 'home',
      previousPaths: [],
      seo: {},
      blocks: buildLegacyHomeBlocks(content, pageDefinitions, locale),
    },
  ]

  pageDefinitions.forEach((page, index) => {
    pages.push({
      locale,
      sourceKey: page.slug,
      title: page.title,
      summary: page.description,
      slug: page.slug,
      sortOrder: index + 1,
      isHome: false,
      parentSourceId: null,
      logicalIdentity: page.slug,
      previousPaths: [],
      seo: {},
      blocks: buildLegacyPageBlocks(content, page, locale),
    })
  })

  return pages
}

async function getImportPages(locale: DocsLocale) {
  const publishedPages = await getSupabaseImportPages(locale)
  if (publishedPages.length > 0) {
    return publishedPages
  }

  return getLegacyImportPages(locale)
}

async function main() {
  const sanity = getSanityWriteClient()
  const pagesByLocale = await Promise.all((['ru', 'en'] as const).map(async (locale) => [locale, await getImportPages(locale)] as const))

  const docs = pagesByLocale.flatMap(([, pages]) => pages)
  const documentIdBySourceKey = new Map<string, string>()

  for (const page of docs) {
    documentIdBySourceKey.set(`${page.locale}:${page.sourceKey}`, toSanityDocId(page.locale, page.logicalIdentity))
  }

  let transaction = sanity.transaction()

  for (const page of docs) {
    const documentId = documentIdBySourceKey.get(`${page.locale}:${page.logicalIdentity}`)
      || documentIdBySourceKey.get(`${page.locale}:${page.sourceKey}`)
    if (!documentId) {
      continue
    }

    const parentDocumentId = page.parentSourceId
      ? documentIdBySourceKey.get(`${page.locale}:${page.parentSourceId}`)
      : undefined

    const document = {
      _id: documentId,
      _type: 'docsPage',
      locale: page.locale,
      title: page.title,
      summary: page.summary,
      slug: {
        _type: 'slug',
        current: page.slug,
      },
      sortOrder: page.sortOrder,
      isHome: page.isHome,
      previousPaths: Array.from(new Set(page.previousPaths.map((path) => normalizePath(path)).filter(Boolean))),
      seo: page.seo,
      blocks: normalizeImportBlocks(page).map((block, index) => sanitizeSanityDocsBlock(docsBlockToSanityBlock(block, index))),
      ...(parentDocumentId
        ? {
            parentPage: {
              _type: 'reference' as const,
              _ref: parentDocumentId,
            },
          }
        : {}),
    }

    transaction = transaction.createOrReplace(document)
  }

  const result = await transaction.commit()

  console.log(`Imported ${docs.length} documentation page(s) into Sanity.`)
  console.log(`Transaction results: ${result.results.length}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
