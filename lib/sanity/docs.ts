import { groq } from 'next-sanity'
import { unstable_cache } from 'next/cache'

import type { DocsBlock, DocsLocale, DocsPageNode, DocsRevision } from '@/lib/docs-cms/types'
import { hasSanityEnv } from '@/lib/sanity/config'
import { getSanityReadClient } from '@/lib/sanity/client'
import { normalizeSanityDocsSeo } from '@/lib/sanity/docs-blocks'

type SanityDocsBlockRecord = {
  _key?: string
  _type: string
  level?: number
  text?: string
  ordered?: boolean
  items?: string[]
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  columns?: string[]
  rows?: Array<{ cells?: string[] }>
  assetId?: string | null
  url?: string
  alt?: string
  caption?: string
  posterUrl?: string
  label?: string
  provider?: 'youtube' | 'vimeo' | 'other'
  variant?: 'default' | 'outline' | 'ghost'
  language?: string
  code?: string
}

type SanityDocsPageRecord = {
  _id: string
  _createdAt: string
  _updatedAt: string
  locale: DocsLocale
  title: string
  summary?: string
  slug: string
  sortOrder: number
  isHome: boolean
  previousPaths?: string[]
  parentId?: string | null
  seo?: unknown
  blocks: SanityDocsBlockRecord[]
}

type NormalizedDocsPageRecord = {
  page: DocsPageNode
  revision: DocsRevision
  previousPaths: string[]
}

export type SanityDocsDataset = {
  tree: DocsPageNode[]
  pages: DocsPageNode[]
  revisionsByPageId: Record<string, DocsRevision>
  recordsByPageId: Record<string, NormalizedDocsPageRecord>
  pageIdByPath: Record<string, string>
  redirectPageIdByPath: Record<string, string>
}

export const PUBLISHED_SANITY_DOCS_CACHE_TAG = 'published-sanity-docs'

const DOCS_PAGES_QUERY = groq`*[_type == "docsPage" && locale == $locale] | order(sortOrder asc, title asc) {
  _id,
  _createdAt,
  _updatedAt,
  locale,
  title,
  summary,
  "slug": slug.current,
  "sortOrder": coalesce(sortOrder, 0),
  "isHome": coalesce(isHome, false),
  "previousPaths": coalesce(previousPaths, []),
  "parentId": parentPage._ref,
  seo,
  blocks[]{
    _key,
    _type,
    level,
    text,
    ordered,
    items,
    tone,
    title,
    columns,
    rows[]{
      cells
    },
    "assetId": coalesce(asset.asset._ref, asset._ref),
    "url": coalesce(asset.asset->url, asset->url, url),
    alt,
    caption,
    "posterUrl": coalesce(poster.asset->url, posterUrl),
    label,
    provider,
    variant,
    language,
    code
  }
}`

function sanitizeSlug(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizePath(path: string) {
  const trimmed = String(path || '').trim()
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizeBlock(block: SanityDocsBlockRecord, index: number): DocsBlock | null {
  const id = block._key || `${block._type}-${index + 1}`

  switch (block._type) {
    case 'docsHeading':
      return {
        id,
        type: 'heading',
        level:
          typeof block.level === 'number' && block.level >= 1 && block.level <= 6
            ? (block.level as 1 | 2 | 3 | 4 | 5 | 6)
            : 2,
        text: String(block.text || ''),
      }
    case 'docsParagraph':
      return {
        id,
        type: 'paragraph',
        richText: String(block.text || ''),
      }
    case 'docsList':
      return {
        id,
        type: 'list',
        ordered: Boolean(block.ordered),
        items: Array.isArray(block.items) ? block.items.map((item) => String(item)) : [],
      }
    case 'docsCallout':
      return {
        id,
        type: 'callout',
        tone:
          block.tone === 'success' || block.tone === 'warning' || block.tone === 'danger'
            ? block.tone
            : 'info',
        title: String(block.title || ''),
        text: String(block.text || ''),
      }
    case 'docsTable':
      return {
        id,
        type: 'table',
        columns: Array.isArray(block.columns) ? block.columns.map((item) => String(item)) : [],
        rows: Array.isArray(block.rows)
          ? block.rows.map((row) => (Array.isArray(row?.cells) ? row.cells.map((cell) => String(cell)) : []))
          : [],
      }
    case 'docsImage':
      return {
        id,
        type: 'image',
        assetId: block.assetId || null,
        url: String(block.url || ''),
        alt: String(block.alt || ''),
        caption: String(block.caption || ''),
      }
    case 'docsVideo':
      return {
        id,
        type: 'video',
        assetId: block.assetId || null,
        url: String(block.url || ''),
        caption: String(block.caption || ''),
        posterUrl: String(block.posterUrl || ''),
      }
    case 'docsVideoEmbed':
      return {
        id,
        type: 'videoEmbed',
        provider:
          block.provider === 'youtube' || block.provider === 'vimeo'
            ? block.provider
            : 'other',
        url: String(block.url || ''),
        caption: String(block.caption || ''),
      }
    case 'docsButton':
      return {
        id,
        type: 'button',
        label: String(block.label || ''),
        url: String(block.url || ''),
        variant:
          block.variant === 'outline' || block.variant === 'ghost'
            ? block.variant
            : 'default',
      }
    case 'docsDivider':
      return {
        id,
        type: 'divider',
      }
    case 'docsCode':
      return {
        id,
        type: 'code',
        language: String(block.language || 'text'),
        code: String(block.code || ''),
      }
    default:
      return null
  }
}

function buildPathLookup(records: SanityDocsPageRecord[]) {
  const byId = new Map(records.map((record) => [record._id, record]))
  const cache = new Map<string, string>()

  const computePath = (record: SanityDocsPageRecord, trail = new Set<string>()): string => {
    if (cache.has(record._id)) {
      return cache.get(record._id) || ''
    }

    if (record.isHome) {
      cache.set(record._id, '')
      return ''
    }

    if (trail.has(record._id)) {
      const fallback = sanitizeSlug(record.slug)
      cache.set(record._id, fallback)
      return fallback
    }

    const safeSlug = sanitizeSlug(record.slug)
    const parent = record.parentId ? byId.get(record.parentId) || null : null

    if (!parent || parent.isHome) {
      cache.set(record._id, safeSlug)
      return safeSlug
    }

    trail.add(record._id)
    const parentPath = computePath(parent, trail)
    trail.delete(record._id)

    const nextPath = parentPath ? `${parentPath}/${safeSlug}` : safeSlug
    cache.set(record._id, nextPath)
    return nextPath
  }

  for (const record of records) {
    computePath(record)
  }

  return cache
}

function buildTree(records: NormalizedDocsPageRecord[]): DocsPageNode[] {
  const byId = new Map<string, DocsPageNode>()

  for (const record of records) {
    byId.set(record.page.id, {
      ...record.page,
      children: [],
    })
  }

  const roots: DocsPageNode[] = []

  for (const record of records) {
    const node = byId.get(record.page.id)
    if (!node) {
      continue
    }

    if (!node.parentId) {
      roots.push(node)
      continue
    }

    const parent = byId.get(node.parentId)
    if (!parent) {
      roots.push(node)
      continue
    }

    parent.children.push(node)
  }

  const sortNodes = (nodes: DocsPageNode[]) => {
    nodes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }

      return a.createdAt.localeCompare(b.createdAt)
    })

    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

async function fetchPublishedSanityDocsDataset(locale: DocsLocale): Promise<SanityDocsDataset | null> {
  if (!hasSanityEnv()) {
    return null
  }

  const client = getSanityReadClient({
    perspective: 'published',
    useCdn: true,
  })

  const rawRecords = await client.fetch<SanityDocsPageRecord[]>(DOCS_PAGES_QUERY, { locale })
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    return null
  }

  const pathLookup = buildPathLookup(rawRecords)
  const normalizedRecords = rawRecords.map<NormalizedDocsPageRecord>((record) => {
    const pageId = record._id.replace(/^drafts\./, '')
    const path = pathLookup.get(record._id) || ''
    const blocks = Array.isArray(record.blocks)
      ? record.blocks
          .map((block, index) => normalizeBlock(block, index))
          .filter((block): block is DocsBlock => Boolean(block))
      : []

    const page: DocsPageNode = {
      id: pageId,
      locale,
      parentId: record.parentId || null,
      title: record.title,
      summary: typeof record.summary === 'string' ? record.summary : '',
      slug: sanitizeSlug(record.slug),
      path,
      sortOrder: Number.isFinite(record.sortOrder) ? record.sortOrder : 0,
      isHome: Boolean(record.isHome),
      latestRevisionId: `${pageId}:published`,
      publishedRevisionId: `${pageId}:published`,
      createdBy: '',
      updatedBy: '',
      createdAt: record._createdAt,
      updatedAt: record._updatedAt,
      children: [],
    }

    const revision: DocsRevision = {
      id: `${pageId}:published`,
      pageId,
      revisionNo: 1,
      status: 'published',
      titleSnapshot: record.title,
      blocks,
      seo: normalizeSanityDocsSeo(record.seo),
      changeNote: null,
      createdBy: '',
      createdAt: record._updatedAt,
    }

    const previousPaths = Array.isArray(record.previousPaths)
      ? record.previousPaths.map((item) => normalizePath(item)).filter(Boolean)
      : []

    return {
      page,
      revision,
      previousPaths,
    }
  })

  const tree = buildTree(normalizedRecords)
  const pages = normalizedRecords.map((record) => record.page)
  const revisionsByPageId = Object.fromEntries(
    normalizedRecords.map((record) => [record.page.id, record.revision])
  )
  const recordsByPageId = Object.fromEntries(
    normalizedRecords.map((record) => [record.page.id, record])
  )
  const pageIdByPath = Object.fromEntries(
    normalizedRecords
      .filter((record) => record.page.isHome || record.page.path)
      .map((record) => [record.page.path, record.page.id])
  )
  const redirectPageIdByPath = Object.fromEntries(
    normalizedRecords.flatMap((record) =>
      record.previousPaths
        .filter((path) => path !== record.page.path)
        .map((path) => [path, record.page.id] as const)
    )
  )

  return {
    tree,
    pages,
    revisionsByPageId,
    recordsByPageId,
    pageIdByPath,
    redirectPageIdByPath,
  }
}

const getCachedPublishedSanityDocsDataset = unstable_cache(
  fetchPublishedSanityDocsDataset,
  ['published-sanity-docs-dataset'],
  {
    revalidate: 300,
    tags: [PUBLISHED_SANITY_DOCS_CACHE_TAG],
  }
)

export async function getPublishedSanityDocsDataset(locale: DocsLocale): Promise<SanityDocsDataset | null> {
  return getCachedPublishedSanityDocsDataset(locale)
}

export function resolvePublishedSanityDocsPage(
  dataset: SanityDocsDataset,
  requestedPath: string
):
  | {
      page: DocsPageNode
      revision: DocsRevision
      redirectedFrom?: undefined
    }
  | {
      page: DocsPageNode
      revision: DocsRevision
      redirectedFrom: string
    }
  | null {
  const safePath = normalizePath(requestedPath)
  const pageId = dataset.pageIdByPath[safePath]

  if (pageId) {
    const record = dataset.recordsByPageId[pageId]
    if (!record) {
      return null
    }

    return {
      page: record.page,
      revision: record.revision,
    }
  }

  const redirectPageId = dataset.redirectPageIdByPath[safePath]
  if (!redirectPageId) {
    return null
  }

  const redirectRecord = dataset.recordsByPageId[redirectPageId]
  if (!redirectRecord) {
    return null
  }

  return {
    page: redirectRecord.page,
    revision: redirectRecord.revision,
    redirectedFrom: safePath,
  }
}
