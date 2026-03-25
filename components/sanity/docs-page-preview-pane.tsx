'use client'

import { useEffect, useState } from 'react'
import { useClient } from 'sanity'

import { CmsDocsPage } from '@/components/docs/cms-docs-page'
import type { DocsBlock, DocsLocale, DocsPageNode, DocsRevision } from '@/lib/docs-cms/types'
import { SANITY_API_VERSION } from '@/lib/sanity/config'
import { normalizeSanityDocsSeo, studioDocsBlockToAppBlock } from '@/lib/sanity/docs-blocks'

type PreviewDocument = {
  _id?: string
  locale?: DocsLocale
  title?: string
  summary?: string
  slug?: { current?: string } | string
  sortOrder?: number
  isHome?: boolean
  seo?: unknown
  blocks?: Array<Record<string, unknown>>
}

type PreviewPaneProps = {
  document?: {
    displayed?: PreviewDocument | null
  }
}

type AssetLookupRow = {
  _id: string
  url?: string
}

type PreviewPageRecord = {
  _id: string
  title?: string
  summary?: string
  slug?: string
  sortOrder?: number
  isHome?: boolean
  parentId?: string | null
}

const ASSET_URLS_QUERY = `*[_id in $ids]{
  _id,
  url
}`

const PREVIEW_PAGES_QUERY = `*[_type == "docsPage" && locale == $locale]{
  _id,
  title,
  summary,
  "slug": slug.current,
  "sortOrder": coalesce(sortOrder, 0),
  "isHome": coalesce(isHome, false),
  "parentId": parentPage._ref
}`

function getAssetRef(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as { _ref?: unknown; asset?: { _ref?: unknown } }

  if (typeof record._ref === 'string' && record._ref.trim()) {
    return record._ref.trim()
  }

  if (typeof record.asset?._ref === 'string' && record.asset._ref.trim()) {
    return record.asset._ref.trim()
  }

  return null
}

function normalizePreviewSlug(value: string | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildPreviewPathMap(records: PreviewPageRecord[]) {
  const byId = new Map(records.map((record) => [record._id.replace(/^drafts\./, ''), record]))
  const cache = new Map<string, string>()

  const computePath = (record: PreviewPageRecord, trail = new Set<string>()): string => {
    const recordId = record._id.replace(/^drafts\./, '')
    if (cache.has(recordId)) {
      return cache.get(recordId) || ''
    }

    if (record.isHome) {
      cache.set(recordId, '')
      return ''
    }

    if (trail.has(recordId)) {
      const fallback = normalizePreviewSlug(record.slug)
      cache.set(recordId, fallback)
      return fallback
    }

    const safeSlug = normalizePreviewSlug(record.slug)
    const parentId = typeof record.parentId === 'string' ? record.parentId.replace(/^drafts\./, '') : ''
    const parent = parentId ? byId.get(parentId) || null : null

    if (!parent || parent.isHome) {
      cache.set(recordId, safeSlug)
      return safeSlug
    }

    trail.add(recordId)
    const parentPath = computePath(parent, trail)
    trail.delete(recordId)

    const nextPath = parentPath ? `${parentPath}/${safeSlug}` : safeSlug
    cache.set(recordId, nextPath)
    return nextPath
  }

  for (const record of records) {
    computePath(record)
  }

  return cache
}

function buildPreviewTree(records: PreviewPageRecord[], locale: DocsLocale) {
  const pathMap = buildPreviewPathMap(records)
  const byId = new Map<string, DocsPageNode>()

  for (const record of records) {
    const pageId = record._id.replace(/^drafts\./, '')
    byId.set(pageId, {
      id: pageId,
      locale,
      parentId: typeof record.parentId === 'string' ? record.parentId.replace(/^drafts\./, '') : null,
      title: typeof record.title === 'string' ? record.title : 'Untitled docs page',
      summary: typeof record.summary === 'string' ? record.summary : '',
      slug: normalizePreviewSlug(record.slug),
      path: pathMap.get(pageId) || '',
      sortOrder: typeof record.sortOrder === 'number' ? record.sortOrder : 0,
      isHome: Boolean(record.isHome),
      latestRevisionId: `${pageId}:preview`,
      publishedRevisionId: null,
      createdBy: '',
      updatedBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
    })
  }

  const roots: DocsPageNode[] = []
  for (const node of byId.values()) {
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
      return a.title.localeCompare(b.title)
    })

    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

export function DocsPagePreviewPane({ document }: PreviewPaneProps) {
  const client = useClient({ apiVersion: SANITY_API_VERSION })
  const displayed = document?.displayed || null
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [previewTree, setPreviewTree] = useState<DocsPageNode[]>([])

  const sourceBlocks = Array.isArray(displayed?.blocks) ? displayed.blocks : []

  useEffect(() => {
    let cancelled = false
    const blocks = Array.isArray(displayed?.blocks) ? displayed.blocks : []
    const assetIds = Array.from(new Set(
      blocks.flatMap((block) => {
        if (!block || typeof block !== 'object') {
          return []
        }

        const record = block as {
          asset?: unknown
          poster?: unknown
        }

        return [getAssetRef(record.asset), getAssetRef(record.poster)].filter(
          (assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0
        )
      })
    ))

    if (assetIds.length === 0) {
      return
    }

    void client.fetch<AssetLookupRow[]>(ASSET_URLS_QUERY, { ids: assetIds }).then((rows) => {
      if (cancelled) {
        return
      }

      const nextMap = Object.fromEntries(
        (rows || [])
          .filter((row) => row && typeof row._id === 'string' && typeof row.url === 'string')
          .map((row) => [row._id, row.url as string])
      )

      setAssetUrls(nextMap)
    }).catch(() => {
      if (!cancelled) {
        setAssetUrls({})
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, displayed])

  useEffect(() => {
    let cancelled = false
    const locale = displayed?.locale === 'en' ? 'en' : 'ru'

    void client.fetch<PreviewPageRecord[]>(PREVIEW_PAGES_QUERY, { locale }).then((rows) => {
      if (cancelled) {
        return
      }

      const records = Array.isArray(rows) ? rows : []
      setPreviewTree(buildPreviewTree(records, locale))
    }).catch(() => {
      if (!cancelled) {
        setPreviewTree([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, displayed?.locale])

  const blocks: DocsBlock[] = sourceBlocks
    .map((block, index) => studioDocsBlockToAppBlock(block as never, index, assetUrls))
    .filter((block): block is DocsBlock => Boolean(block))

  const pageId = typeof displayed?._id === 'string'
    ? displayed._id.replace(/^drafts\./, '')
    : 'preview'
  const page: DocsPageNode = {
    id: pageId,
    locale: displayed?.locale === 'en' ? 'en' : 'ru',
    parentId: null,
    title: typeof displayed?.title === 'string' && displayed.title.trim() ? displayed.title : 'Untitled docs page',
    summary: typeof displayed?.summary === 'string' ? displayed.summary : '',
    slug: '',
    path: '',
    sortOrder: typeof displayed?.sortOrder === 'number' ? displayed.sortOrder : 0,
    isHome: Boolean(displayed?.isHome),
    latestRevisionId: `${pageId}:preview`,
    publishedRevisionId: null,
    createdBy: '',
    updatedBy: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    children: [],
  }

  const revision: DocsRevision = {
    id: `${page.id}:preview`,
    pageId: page.id,
    revisionNo: 1,
    status: 'draft',
    titleSnapshot: page.title,
    blocks,
    seo: normalizeSanityDocsSeo(displayed?.seo),
    changeNote: null,
    createdBy: '',
    createdAt: new Date().toISOString(),
  }

  return (
    <div className="min-h-full bg-[#05070A] p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 text-sm text-zinc-300">
          Это draft-preview текущей страницы. Публичная документация продолжает показывать только опубликованный контент.
        </div>
        <CmsDocsPage
          locale={page.locale}
          basePath={page.locale === 'en' ? '/en/docs' : '/ru/docs'}
          page={page}
          revision={revision}
          tree={previewTree.length > 0 ? previewTree : [page]}
        />
      </div>
    </div>
  )
}
