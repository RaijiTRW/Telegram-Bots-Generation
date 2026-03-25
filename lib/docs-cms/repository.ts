import { randomUUID } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeDocsBlocks } from '@/lib/docs-cms/blocks'
import type {
  DocsBlock,
  DocsLocale as CmsLocaleType,
  DocsEditorPayload,
  DocsLocale,
  DocsPageNode,
  DocsRevision,
  DocsSeo,
} from '@/lib/docs-cms/types'
import type { Database, DocsPageRevisionRow, DocsPageRow } from '@/lib/supabase/types'
import type { DocsContent } from '@/lib/docs/docs-content'
import { getDocsContentWithMarkdown } from '@/lib/docs/docs-content-loader'
import { getDocsPageDefinitions, type DocsPageDefinition, type DocsPageSectionId } from '@/lib/docs/docs-pages'

type ServerClient = SupabaseClient<Database>

const EMPTY_BLOCKS: DocsBlock[] = [
  {
    id: 'intro',
    type: 'paragraph',
    richText: 'Новая страница документации. Добавьте контент и сохраните черновик.',
  },
]

function normalizePath(path: string): string {
  const trimmed = String(path || '').trim()
  if (!trimmed) return ''
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

function blockId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function sanitizeSlug(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureParentIsAllowed(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    pageId: string
    newParentId: string | null
  }
): Promise<void> {
  if (!input.newParentId) {
    return
  }

  if (input.newParentId === input.pageId) {
    throw new Error('Cannot set page as its own parent')
  }

  const rows = await getPageRows(supabase, input.locale, false)
  const byId = new Map(rows.map((row) => [row.id, row]))

  if (!byId.has(input.newParentId)) {
    throw new Error('Parent page not found')
  }

  let cursor: string | null = input.newParentId
  while (cursor) {
    if (cursor === input.pageId) {
      throw new Error('Cannot move page into its own subtree')
    }
    const row = byId.get(cursor)
    cursor = row?.parent_id || null
  }
}

async function upsertRedirectForOldPath(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    oldPath: string
    toPageId: string
    userId: string
  }
): Promise<void> {
  const oldPath = normalizePath(input.oldPath)
  if (!oldPath) {
    return
  }

  const { error } = await supabase
    .from('docs_redirects')
    .upsert(
      {
        locale: input.locale,
        from_path: oldPath,
        to_page_id: input.toPageId,
        is_active: true,
        created_by: input.userId,
      },
      { onConflict: 'locale,from_path' }
    )

  if (error) throw error
}

function buildTree(rows: DocsPageRow[]): DocsPageNode[] {
  const map = new Map<string, DocsPageNode>()
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      locale: row.locale,
      parentId: row.parent_id,
      title: row.title,
      summary: '',
      slug: row.slug,
      path: row.path,
      sortOrder: row.sort_order,
      isHome: row.is_home,
      latestRevisionId: row.latest_revision_id,
      publishedRevisionId: row.published_revision_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      children: [],
    })
  }

  const roots: DocsPageNode[] = []

  for (const node of map.values()) {
    if (!node.parentId) {
      roots.push(node)
      continue
    }
    const parent = map.get(node.parentId)
    if (!parent) {
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  const sortNodes = (nodes: DocsPageNode[]) => {
    nodes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.createdAt.localeCompare(b.createdAt)
    })
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

function mapRevisionRow(row: DocsPageRevisionRow): DocsRevision {
  return {
    id: row.id,
    pageId: row.page_id,
    revisionNo: row.revision_no,
    status: row.status,
    titleSnapshot: row.title_snapshot,
    blocks: normalizeDocsBlocks(row.blocks),
    seo: (row.seo || {}) as DocsSeo,
    changeNote: row.change_note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

async function getPageRows(
  supabase: ServerClient,
  locale: DocsLocale,
  publishedOnly: boolean
): Promise<DocsPageRow[]> {
  let query = supabase
    .from('docs_pages')
    .select('*')
    .eq('locale', locale)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (publishedOnly) {
    query = query.not('published_revision_id', 'is', null)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as DocsPageRow[]
}

async function getRevisionById(supabase: ServerClient, revisionId: string): Promise<DocsRevision | null> {
  const { data, error } = await supabase
    .from('docs_page_revisions')
    .select('*')
    .eq('id', revisionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapRevisionRow(data as DocsPageRevisionRow)
}

async function getMaxRevisionNo(supabase: ServerClient, pageId: string): Promise<number> {
  const { data, error } = await supabase
    .from('docs_page_revisions')
    .select('revision_no')
    .eq('page_id', pageId)
    .order('revision_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Number(data?.revision_no || 0)
}

export async function getPublishedDocsTree(
  supabase: ServerClient,
  locale: DocsLocale
): Promise<DocsPageNode[]> {
  const rows = await getPageRows(supabase, locale, true)
  return buildTree(rows)
}

export async function getPublishedDocsDataset(
  supabase: ServerClient,
  locale: DocsLocale
): Promise<{
  tree: DocsPageNode[]
  pages: DocsPageNode[]
  revisionsByPageId: Record<string, DocsRevision>
}> {
  const rows = await getPageRows(supabase, locale, true)
  const tree = buildTree(rows)
  const pages = flattenTree(tree)
  const revisionIds = rows
    .map((row) => row.published_revision_id)
    .filter((value): value is string => Boolean(value))

  const revisionsByPageId: Record<string, DocsRevision> = {}
  if (revisionIds.length > 0) {
    const { data: revisionsRaw, error: revisionsError } = await supabase
      .from('docs_page_revisions')
      .select('*')
      .in('id', revisionIds)

    if (revisionsError) throw revisionsError

    for (const row of revisionsRaw || []) {
      const revision = mapRevisionRow(row as DocsPageRevisionRow)
      revisionsByPageId[revision.pageId] = revision
    }
  }

  return { tree, pages, revisionsByPageId }
}

export async function getAdminDocsTree(
  supabase: ServerClient,
  locale: DocsLocale
): Promise<DocsPageNode[]> {
  const rows = await getPageRows(supabase, locale, false)
  return buildTree(rows)
}

export async function getPublishedDocsHomePage(
  supabase: ServerClient,
  locale: DocsLocale
): Promise<{ page: DocsPageNode; revision: DocsRevision } | null> {
  const { data, error } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('locale', locale)
    .eq('is_home', true)
    .not('published_revision_id', 'is', null)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const page = buildTree([data as DocsPageRow])[0]
  if (!page || !page.publishedRevisionId) return null
  const revision = await getRevisionById(supabase, page.publishedRevisionId)
  if (!revision) return null

  return { page, revision }
}

export async function getPublishedDocsPageByPath(
  supabase: ServerClient,
  locale: DocsLocale,
  path: string
): Promise<{ page: DocsPageNode; revision: DocsRevision; redirectedFrom?: string } | null> {
  const normalizedPath = normalizePath(path)

  const { data: pageByPath, error: pathError } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('locale', locale)
    .eq('path', normalizedPath)
    .not('published_revision_id', 'is', null)
    .maybeSingle()

  if (pathError) throw pathError

  if (pageByPath) {
    const page = buildTree([pageByPath as DocsPageRow])[0]
    if (!page?.publishedRevisionId) return null
    const revision = await getRevisionById(supabase, page.publishedRevisionId)
    if (!revision) return null
    return { page, revision }
  }

  const { data: redirectRow, error: redirectError } = await supabase
    .from('docs_redirects')
    .select('*')
    .eq('locale', locale)
    .eq('from_path', normalizedPath)
    .eq('is_active', true)
    .maybeSingle()

  if (redirectError) throw redirectError
  if (!redirectRow) return null

  const { data: redirectedPage, error: redirectedError } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('id', redirectRow.to_page_id)
    .eq('locale', locale)
    .not('published_revision_id', 'is', null)
    .maybeSingle()

  if (redirectedError) throw redirectedError
  if (!redirectedPage) return null

  const page = buildTree([redirectedPage as DocsPageRow])[0]
  if (!page?.publishedRevisionId) return null
  const revision = await getRevisionById(supabase, page.publishedRevisionId)
  if (!revision) return null

  return { page, revision, redirectedFrom: normalizedPath }
}

function flattenTree(nodes: DocsPageNode[], out: DocsPageNode[] = []): DocsPageNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0) {
      flattenTree(node.children, out)
    }
  }
  return out
}

export async function getDocsEditorPayload(
  supabase: ServerClient,
  locale: DocsLocale,
  pageId: string
): Promise<DocsEditorPayload | null> {
  const { data: pageData, error: pageError } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('id', pageId)
    .eq('locale', locale)
    .maybeSingle()

  if (pageError) throw pageError
  if (!pageData) return null

  const page = buildTree([pageData as DocsPageRow])[0]
  if (!page) return null

  const { data: revisionsRaw, error: revisionsError } = await supabase
    .from('docs_page_revisions')
    .select('*')
    .eq('page_id', pageId)
    .order('revision_no', { ascending: false })

  if (revisionsError) throw revisionsError
  const revisions = (revisionsRaw || []).map((row) => mapRevisionRow(row as DocsPageRevisionRow))

  const draft = page.latestRevisionId
    ? revisions.find((revision) => revision.id === page.latestRevisionId) || null
    : null

  const fallbackDraft: DocsRevision = draft || {
    id: 'draft-local',
    pageId: page.id,
    revisionNo: 0,
    status: 'draft',
    titleSnapshot: page.title,
    blocks: EMPTY_BLOCKS,
    seo: {},
    changeNote: null,
    createdBy: page.updatedBy,
    createdAt: page.updatedAt,
  }

  const { data: redirectsRaw, error: redirectsError } = await supabase
    .from('docs_redirects')
    .select('id, from_path, is_active, created_at')
    .eq('locale', locale)
    .eq('to_page_id', pageId)
    .order('created_at', { ascending: false })

  if (redirectsError) throw redirectsError

  return {
    page,
    draft: fallbackDraft,
    revisions,
    redirects: (redirectsRaw || []).map((row) => ({
      id: row.id,
      fromPath: row.from_path,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    })),
  }
}

export async function createDocsPage(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    parentId: string | null
    title: string
    slug: string
    isHome: boolean
    userId: string
  }
): Promise<DocsPageNode> {
  const safeSlug = sanitizeSlug(input.slug || input.title || 'page')
  const safeTitle = String(input.title || '').trim() || 'New page'

  let siblingsQuery = supabase
    .from('docs_pages')
    .select('sort_order')
    .eq('locale', input.locale)
    .order('sort_order', { ascending: false })
    .limit(1)

  siblingsQuery =
    input.parentId === null
      ? siblingsQuery.is('parent_id', null)
      : siblingsQuery.eq('parent_id', input.parentId)

  const { data: siblingsRaw, error: siblingsError } = await siblingsQuery

  if (siblingsError) throw siblingsError
  const nextSort = Number(siblingsRaw?.[0]?.sort_order || 0) + 1

  if (input.isHome) {
    const { error: resetHomeError } = await supabase
      .from('docs_pages')
      .update({ is_home: false, updated_by: input.userId })
      .eq('locale', input.locale)
      .eq('is_home', true)
    if (resetHomeError) throw resetHomeError
  }

  const { data: inserted, error: insertError } = await supabase
    .from('docs_pages')
    .insert({
      locale: input.locale,
      parent_id: input.parentId,
      title: safeTitle,
      slug: safeSlug,
      path: safeSlug,
      sort_order: nextSort,
      is_home: input.isHome,
      created_by: input.userId,
      updated_by: input.userId,
    })
    .select('*')
    .single()

  if (insertError) throw insertError

  const page = inserted as DocsPageRow
  const revision = await createRevision(supabase, {
    pageId: page.id,
    titleSnapshot: page.title,
    blocks: EMPTY_BLOCKS,
    seo: {},
    status: 'draft',
    changeNote: 'Initial draft',
    userId: input.userId,
  })

  const { data: updated, error: updateError } = await supabase
    .from('docs_pages')
    .update({
      latest_revision_id: revision.id,
      updated_by: input.userId,
    })
    .eq('id', page.id)
    .select('*')
    .single()

  if (updateError) throw updateError
  return buildTree([updated as DocsPageRow])[0]
}

export async function updateDocsPageMeta(
  supabase: ServerClient,
  input: {
    pageId: string
    locale: DocsLocale
    title: string
    slug: string
    parentId: string | null
    isHome: boolean
    userId: string
  }
): Promise<DocsPageNode> {
  const safeSlug = sanitizeSlug(input.slug || input.title || 'page')
  const safeTitle = String(input.title || '').trim() || 'Untitled'

  const { data: currentPageRaw, error: currentPageError } = await supabase
    .from('docs_pages')
    .select('id, path, parent_id')
    .eq('id', input.pageId)
    .eq('locale', input.locale)
    .single()

  if (currentPageError) throw currentPageError
  const currentPage = currentPageRaw as Pick<DocsPageRow, 'id' | 'path' | 'parent_id'>

  await ensureParentIsAllowed(supabase, {
    locale: input.locale,
    pageId: input.pageId,
    newParentId: input.parentId,
  })

  if (input.isHome) {
    const { error: resetHomeError } = await supabase
      .from('docs_pages')
      .update({ is_home: false, updated_by: input.userId })
      .eq('locale', input.locale)
      .eq('is_home', true)
      .neq('id', input.pageId)
    if (resetHomeError) throw resetHomeError
  }

  const { data, error } = await supabase
    .from('docs_pages')
    .update({
      title: safeTitle,
      slug: safeSlug,
      parent_id: input.parentId,
      is_home: input.isHome,
      updated_by: input.userId,
    })
    .eq('id', input.pageId)
    .eq('locale', input.locale)
    .select('*')
    .single()

  if (error) throw error

  const nextPage = data as DocsPageRow
  if (currentPage.path !== nextPage.path) {
    await upsertRedirectForOldPath(supabase, {
      locale: input.locale,
      oldPath: currentPage.path,
      toPageId: nextPage.id,
      userId: input.userId,
    })
  }
  return buildTree([nextPage])[0]
}

export async function moveDocsPage(
  supabase: ServerClient,
  input: {
    pageId: string
    locale: DocsLocale
    newParentId: string | null
    sortOrder?: number
    userId: string
  }
): Promise<void> {
  await ensureParentIsAllowed(supabase, {
    locale: input.locale,
    pageId: input.pageId,
    newParentId: input.newParentId,
  })

  const { data: currentPageRaw, error: currentPageError } = await supabase
    .from('docs_pages')
    .select('id, path')
    .eq('id', input.pageId)
    .eq('locale', input.locale)
    .single()

  if (currentPageError) throw currentPageError
  const currentPage = currentPageRaw as Pick<DocsPageRow, 'id' | 'path'>

  let nextSort = Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : Number.NaN
  if (!Number.isFinite(nextSort)) {
    let siblingsQuery = supabase
      .from('docs_pages')
      .select('sort_order')
      .eq('locale', input.locale)
      .neq('id', input.pageId)
      .order('sort_order', { ascending: false })
      .limit(1)

    siblingsQuery =
      input.newParentId === null
        ? siblingsQuery.is('parent_id', null)
        : siblingsQuery.eq('parent_id', input.newParentId)

    const { data: siblingsRaw, error: siblingsError } = await siblingsQuery
    if (siblingsError) throw siblingsError
    nextSort = Number(siblingsRaw?.[0]?.sort_order || 0) + 1
  }

  const { error } = await supabase
    .from('docs_pages')
    .update({
      parent_id: input.newParentId,
      sort_order: nextSort,
      updated_by: input.userId,
    })
    .eq('id', input.pageId)
    .eq('locale', input.locale)

  if (error) throw error

  const { data: movedRaw, error: movedError } = await supabase
    .from('docs_pages')
    .select('id, path')
    .eq('id', input.pageId)
    .eq('locale', input.locale)
    .single()

  if (movedError) throw movedError
  const movedPage = movedRaw as Pick<DocsPageRow, 'id' | 'path'>

  if (currentPage.path !== movedPage.path) {
    await upsertRedirectForOldPath(supabase, {
      locale: input.locale,
      oldPath: currentPage.path,
      toPageId: movedPage.id,
      userId: input.userId,
    })
  }
}

export async function reorderDocsSiblings(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    parentId: string | null
    orderedPageIds: string[]
    userId: string
  }
): Promise<void> {
  for (let index = 0; index < input.orderedPageIds.length; index += 1) {
    const pageId = input.orderedPageIds[index]
    const { error } = await supabase
      .from('docs_pages')
      .update({
        sort_order: index,
        parent_id: input.parentId,
        updated_by: input.userId,
      })
      .eq('id', pageId)
      .eq('locale', input.locale)

    if (error) throw error
  }
}

async function createRevision(
  supabase: ServerClient,
  input: {
    pageId: string
    titleSnapshot: string
    blocks: DocsBlock[]
    seo: DocsSeo
    status: 'draft' | 'published' | 'archived'
    changeNote: string | null
    userId: string
  }
): Promise<DocsRevision> {
  const maxRevisionNo = await getMaxRevisionNo(supabase, input.pageId)
  const nextRevisionNo = maxRevisionNo + 1

  const { data, error } = await supabase
    .from('docs_page_revisions')
    .insert({
      page_id: input.pageId,
      revision_no: nextRevisionNo,
      status: input.status,
      title_snapshot: input.titleSnapshot,
      blocks: input.blocks as unknown as Database['public']['Tables']['docs_page_revisions']['Insert']['blocks'],
      seo: input.seo as unknown as Database['public']['Tables']['docs_page_revisions']['Insert']['seo'],
      change_note: input.changeNote,
      created_by: input.userId,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapRevisionRow(data as DocsPageRevisionRow)
}

export async function saveDocsDraft(
  supabase: ServerClient,
  input: {
    pageId: string
    titleSnapshot: string
    blocks: DocsBlock[]
    seo: DocsSeo
    changeNote: string | null
    userId: string
  }
): Promise<DocsRevision> {
  const { data: pageRow, error: pageError } = await supabase
    .from('docs_pages')
    .select('id, latest_revision_id')
    .eq('id', input.pageId)
    .single()

  if (pageError) throw pageError

  let revision: DocsRevision | null = null

  if (pageRow.latest_revision_id) {
    const existing = await getRevisionById(supabase, pageRow.latest_revision_id)
    if (existing && existing.status === 'draft') {
      const { data: updatedDraft, error: updateDraftError } = await supabase
        .from('docs_page_revisions')
        .update({
          title_snapshot: input.titleSnapshot,
          blocks: input.blocks as unknown as Database['public']['Tables']['docs_page_revisions']['Update']['blocks'],
          seo: input.seo as unknown as Database['public']['Tables']['docs_page_revisions']['Update']['seo'],
          change_note: input.changeNote,
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateDraftError) throw updateDraftError
      revision = mapRevisionRow(updatedDraft as DocsPageRevisionRow)
    }
  }

  if (!revision) {
    revision = await createRevision(supabase, {
      pageId: input.pageId,
      titleSnapshot: input.titleSnapshot,
      blocks: input.blocks,
      seo: input.seo,
      status: 'draft',
      changeNote: input.changeNote,
      userId: input.userId,
    })
  }

  const { error: updatePageError } = await supabase
    .from('docs_pages')
    .update({
      latest_revision_id: revision.id,
      updated_by: input.userId,
      title: input.titleSnapshot,
    })
    .eq('id', input.pageId)

  if (updatePageError) throw updatePageError
  return revision
}

export async function publishDocsPage(
  supabase: ServerClient,
  input: { pageId: string; userId: string; changeNote?: string | null }
): Promise<DocsRevision> {
  const { data: pageRow, error: pageError } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('id', input.pageId)
    .single()

  if (pageError) throw pageError
  const page = pageRow as DocsPageRow
  if (!page.latest_revision_id) {
    throw new Error('No draft to publish')
  }

  const latest = await getRevisionById(supabase, page.latest_revision_id)
  if (!latest) {
    throw new Error('Latest revision not found')
  }

  const { data: published, error: publishedError } = await supabase
    .from('docs_page_revisions')
    .update({
      status: 'published',
      change_note: input.changeNote || latest.changeNote,
    })
    .eq('id', latest.id)
    .select('*')
    .single()

  if (publishedError) throw publishedError

  if (page.published_revision_id && page.published_revision_id !== latest.id) {
    const { error: archivePrevError } = await supabase
      .from('docs_page_revisions')
      .update({ status: 'archived' })
      .eq('id', page.published_revision_id)

    if (archivePrevError) throw archivePrevError
  }

  const { error: updatePageError } = await supabase
    .from('docs_pages')
    .update({
      published_revision_id: latest.id,
      latest_revision_id: latest.id,
      updated_by: input.userId,
    })
    .eq('id', input.pageId)

  if (updatePageError) throw updatePageError
  return mapRevisionRow(published as DocsPageRevisionRow)
}

export async function restoreDocsRevision(
  supabase: ServerClient,
  input: { pageId: string; revisionId: string; userId: string }
): Promise<DocsRevision> {
  const sourceRevision = await getRevisionById(supabase, input.revisionId)
  if (!sourceRevision || sourceRevision.pageId !== input.pageId) {
    throw new Error('Revision not found')
  }

  const draft = await createRevision(supabase, {
    pageId: input.pageId,
    titleSnapshot: sourceRevision.titleSnapshot,
    blocks: sourceRevision.blocks,
    seo: sourceRevision.seo,
    status: 'draft',
    changeNote: `Restored from #${sourceRevision.revisionNo}`,
    userId: input.userId,
  })

  const { error } = await supabase
    .from('docs_pages')
    .update({
      latest_revision_id: draft.id,
      updated_by: input.userId,
      title: draft.titleSnapshot,
    })
    .eq('id', input.pageId)

  if (error) throw error
  return draft
}

export async function deleteDocsPage(
  supabase: ServerClient,
  input: { pageId: string; locale: DocsLocale }
): Promise<void> {
  const { error } = await supabase
    .from('docs_pages')
    .delete()
    .eq('id', input.pageId)
    .eq('locale', input.locale)

  if (error) throw error
}

export async function createDocsRedirect(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    fromPath: string
    toPageId: string
    userId: string
  }
): Promise<void> {
  const normalizedFromPath = normalizePath(input.fromPath)
  const { error } = await supabase.from('docs_redirects').insert({
    locale: input.locale,
    from_path: normalizedFromPath,
    to_page_id: input.toPageId,
    created_by: input.userId,
    is_active: true,
  })
  if (error) throw error
}

export async function deleteDocsRedirect(
  supabase: ServerClient,
  input: { redirectId: string }
): Promise<void> {
  const { error } = await supabase
    .from('docs_redirects')
    .delete()
    .eq('id', input.redirectId)
  if (error) throw error
}

function sectionMeta(content: DocsContent, sectionId: DocsPageSectionId) {
  return content.sections.find((section) => section.id === sectionId) || null
}

function pushHeading(out: DocsBlock[], level: 1 | 2 | 3 | 4, text: string) {
  const value = String(text || '').trim()
  if (!value) return
  out.push({
    id: blockId('heading'),
    type: 'heading',
    level,
    text: value,
  })
}

function pushParagraph(out: DocsBlock[], text: string) {
  const value = String(text || '').trim()
  if (!value) return
  out.push({
    id: blockId('paragraph'),
    type: 'paragraph',
    richText: value,
  })
}

function pushList(out: DocsBlock[], items: string[]) {
  const normalized = items.map((item) => String(item || '').trim()).filter(Boolean)
  if (normalized.length === 0) return
  out.push({
    id: blockId('list'),
    type: 'list',
    ordered: false,
    items: normalized,
  })
}

function pushCallout(out: DocsBlock[], tone: 'info' | 'warning' | 'success' | 'danger', title: string, text: string) {
  const safeTitle = String(title || '').trim()
  const safeText = String(text || '').trim()
  if (!safeTitle && !safeText) return
  out.push({
    id: blockId('callout'),
    type: 'callout',
    tone,
    title: safeTitle || (tone === 'warning' ? 'Важно' : 'Note'),
    text: safeText,
  })
}

function pushTable(out: DocsBlock[], columns: string[], rows: string[][]) {
  const normalizedColumns = columns.map((c) => String(c || '').trim()).filter(Boolean)
  const normalizedRows = rows
    .map((row) => row.map((cell) => String(cell || '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
  if (normalizedColumns.length === 0 || normalizedRows.length === 0) return
  out.push({
    id: blockId('table'),
    type: 'table',
    columns: normalizedColumns,
    rows: normalizedRows,
  })
}

function pushVideoPlaceholder(out: DocsBlock[], caption: string) {
  const safeCaption = String(caption || '').trim()
  out.push({
    id: blockId('video'),
    type: 'video',
    assetId: null,
    url: '',
    caption: safeCaption,
    posterUrl: '',
  })
}

function buildSectionBlocks(content: DocsContent, sectionId: DocsPageSectionId, locale: CmsLocaleType): DocsBlock[] {
  const blocks: DocsBlock[] = []
  const meta = sectionMeta(content, sectionId)
  const isRu = locale === 'ru'

  if (meta) {
    pushHeading(blocks, 2, meta.title)
    pushParagraph(blocks, meta.description)
  }

  switch (sectionId) {
    case 'learning-flow': {
      pushHeading(blocks, 3, content.learningFlow.title)
      pushParagraph(blocks, content.learningFlow.description)
      pushList(blocks, content.learningFlow.steps)
      pushVideoPlaceholder(blocks, content.learningFlow.videoNoteTitle)
      break
    }
    case 'quick-start': {
      pushHeading(blocks, 3, content.quickStart.title)
      pushParagraph(blocks, content.quickStart.description)
      content.quickStart.steps.forEach((step, index) => {
        pushHeading(blocks, 4, `${index + 1}. ${step.title}`)
        pushParagraph(blocks, step.goal)
        pushCallout(
          blocks,
          'info',
          isRu ? 'Действия' : 'Actions',
          step.actions.join('\n')
        )
        pushCallout(
          blocks,
          'success',
          isRu ? 'Что делает система' : 'System behavior',
          step.systemBehavior.join('\n')
        )
        pushCallout(
          blocks,
          'warning',
          isRu ? 'Что проверить' : 'Check',
          step.check.join('\n')
        )
        pushVideoPlaceholder(
          blocks,
          step.quickVideoSlotTitle ||
            (isRu ? `Подробнее по шагу: ${step.title}` : `Step detail: ${step.title}`)
        )
        pushVideoPlaceholder(blocks, step.videoSlotTitle)
      })
      break
    }
    case 'service-flow': {
      pushHeading(blocks, 3, content.serviceFlow.title)
      pushParagraph(blocks, content.serviceFlow.description)
      content.serviceFlow.stages.forEach((stage, index) => {
        pushHeading(blocks, 4, `${index + 1}. ${stage.title}`)
        pushParagraph(blocks, stage.description)
        pushCallout(blocks, 'success', isRu ? 'Результат' : 'Output', stage.output)
      })
      break
    }
    case 'editor-areas': {
      pushHeading(blocks, 3, content.editorAreas.title)
      pushParagraph(blocks, content.editorAreas.description)
      content.editorAreas.cards.forEach((card) => {
        pushHeading(blocks, 4, card.title)
        pushParagraph(blocks, card.subtitle)
        pushParagraph(blocks, `${isRu ? 'Когда использовать:' : 'When to use:'} ${card.whenToUse}`)
        pushList(blocks, card.actions)
        pushCallout(blocks, 'success', isRu ? 'Результат' : 'Result', card.result)
      })
      break
    }
    case 'ui-components': {
      pushHeading(blocks, 3, content.uiComponents.title)
      pushParagraph(blocks, content.uiComponents.description)
      content.uiComponents.cards.forEach((card) => {
        pushHeading(blocks, 4, card.title)
        pushParagraph(blocks, `${card.location} - ${card.purpose}`)
        pushList(blocks, card.howToUse)
        if (card.commonMistakes && card.commonMistakes.length > 0) {
          pushCallout(
            blocks,
            'warning',
            isRu ? 'Частые ошибки' : 'Common mistakes',
            card.commonMistakes.join('\n')
          )
        }
      })
      break
    }
    case 'nodes-reference': {
      pushHeading(blocks, 3, content.nodes.title)
      pushParagraph(blocks, content.nodes.description)
      content.nodes.groups.forEach((group) => {
        pushHeading(blocks, 4, group.title)
        pushParagraph(blocks, group.description)
        group.items.forEach((item) => {
          pushHeading(blocks, 4, item.name)
          pushParagraph(blocks, item.purpose)
          pushParagraph(blocks, `${isRu ? 'Когда использовать:' : 'When to use:'} ${item.whenToUse}`)
          pushList(blocks, item.setup)
          pushCallout(blocks, 'success', isRu ? 'Результат' : 'Output', item.output)
          if (item.notes && item.notes.length > 0) {
            pushCallout(blocks, 'warning', isRu ? 'Важно' : 'Important', item.notes.join('\n'))
          }
        })
      })
      break
    }
    case 'keyboards-triggers': {
      pushHeading(blocks, 3, content.keyboardsAndTriggers.title)
      pushParagraph(blocks, content.keyboardsAndTriggers.description)
      pushCallout(blocks, 'warning', isRu ? 'Примечание' : 'Note', content.keyboardsAndTriggers.note)
      pushHeading(blocks, 4, isRu ? 'Быстрые правила' : 'Quick rules')
      pushList(blocks, content.keyboardsAndTriggers.quickRules)
      pushHeading(blocks, 4, isRu ? 'Чек-лист диагностики' : 'Debug checklist')
      pushList(blocks, content.keyboardsAndTriggers.debugChecklist)
      pushTable(
        blocks,
        [isRu ? 'Параметр' : 'Topic', 'Reply Keyboard', 'Inline Keyboard'],
        content.keyboardsAndTriggers.rows.map((row) => [row.topic, row.replyKeyboard, row.inlineKeyboard])
      )
      pushHeading(blocks, 4, isRu ? 'Практические сценарии настройки' : 'Practical setup scenarios')
      content.keyboardsAndTriggers.scenarios.forEach((scenario, index) => {
        pushHeading(blocks, 4, `${index + 1}. ${scenario.title}`)
        pushParagraph(
          blocks,
          `${isRu ? 'Когда использовать:' : 'When to use:'} ${scenario.whenToUse}`
        )
        pushList(blocks, scenario.steps)
        pushCallout(blocks, 'success', isRu ? 'Ожидаемый результат' : 'Expected result', scenario.result)
        pushCallout(blocks, 'info', isRu ? 'Сигнал в логах' : 'Runtime signal', scenario.runtimeSignal)
        if (scenario.commonMistakes.length > 0) {
          pushCallout(
            blocks,
            'warning',
            isRu ? 'Частые ошибки' : 'Common mistakes',
            scenario.commonMistakes.join('\n')
          )
        }
      })
      pushHeading(blocks, 4, isRu ? 'Анти-паттерны (что не делать)' : 'Anti-patterns (what to avoid)')
      pushList(blocks, content.keyboardsAndTriggers.antiPatterns)
      break
    }
    case 'statistics': {
      pushHeading(blocks, 3, content.statistics.title)
      pushParagraph(blocks, content.statistics.description)
      pushCallout(blocks, 'info', isRu ? 'Важно' : 'Important', content.statistics.note)
      pushHeading(blocks, 4, isRu ? 'Рабочий цикл' : 'Operational cycle')
      pushList(blocks, content.statistics.workflow)
      content.statistics.tabs.forEach((tab, index) => {
        pushHeading(blocks, 4, `${index + 1}. ${tab.title}`)
        pushParagraph(blocks, tab.description)
        pushParagraph(blocks, `${isRu ? 'Когда использовать:' : 'When to use:'} ${tab.whenToUse}`)
        pushCallout(
          blocks,
          'info',
          isRu ? 'Фильтры и диапазоны' : 'Filters and ranges',
          tab.filters.join('\n')
        )
        pushCallout(
          blocks,
          'success',
          isRu ? 'KPI и ключевые метрики' : 'KPI and key metrics',
          tab.kpis.join('\n')
        )
        pushCallout(
          blocks,
          'warning',
          isRu ? 'Что смотреть глубже' : 'Deep-dive checks',
          tab.details.join('\n')
        )
      })
      pushHeading(blocks, 4, isRu ? 'Диагностика' : 'Diagnostics')
      pushList(blocks, content.statistics.diagnostics)
      break
    }
    case 'data-security': {
      pushHeading(blocks, 3, content.dataAndSecurity.title)
      pushParagraph(blocks, content.dataAndSecurity.description)
      pushTable(
        blocks,
        [
          isRu ? 'Что' : 'Item',
          isRu ? 'Где хранится' : 'Where',
          isRu ? 'Постоянность' : 'Persistence',
          isRu ? 'Видимость' : 'Visibility',
          isRu ? 'Комментарий' : 'Notes',
        ],
        content.dataAndSecurity.rows.map((row) => [
          row.item,
          row.where,
          row.persistence,
          row.visibility,
          row.notes,
        ])
      )
      break
    }
    case 'test-deploy': {
      pushHeading(blocks, 3, content.testAndDeploy.title)
      pushParagraph(blocks, content.testAndDeploy.description)
      content.testAndDeploy.steps.forEach((step, index) => {
        pushHeading(blocks, 4, `${index + 1}. ${step.title}`)
        pushList(blocks, step.actions)
        pushCallout(blocks, 'success', isRu ? 'Результат' : 'Outcome', step.outcome)
        pushVideoPlaceholder(blocks, step.videoSlotTitle)
      })
      break
    }
    case 'troubleshooting': {
      pushHeading(blocks, 3, content.troubleshooting.title)
      pushParagraph(blocks, content.troubleshooting.description)
      content.troubleshooting.items.forEach((item) => {
        pushHeading(blocks, 4, item.question)
        pushList(blocks, item.answer)
      })
      break
    }
    case 'video-plan': {
      pushHeading(blocks, 3, content.videoPlan.title)
      pushParagraph(blocks, content.videoPlan.description)
      content.videoPlan.slots.forEach((slot) => {
        pushHeading(blocks, 4, slot.title)
        pushParagraph(blocks, slot.description)
        pushVideoPlaceholder(blocks, slot.title)
      })
      break
    }
    default:
      break
  }

  return blocks
}

export function buildLegacyHomeBlocks(content: DocsContent, _pages: DocsPageDefinition[], locale: CmsLocaleType): DocsBlock[] {
  const isRu = locale === 'ru'
  const blocks: DocsBlock[] = []
  pushHeading(blocks, 1, content.hero.title)
  pushParagraph(blocks, content.hero.subtitle)
  pushParagraph(blocks, content.hero.description)
  pushCallout(blocks, 'info', isRu ? 'Ключевые заметки' : 'Key notes', content.hero.notes.join('\n'))
  pushHeading(blocks, 2, content.tocTitle)
  pushParagraph(blocks, content.tocHint)
  return blocks
}

export function buildLegacyPageBlocks(content: DocsContent, page: DocsPageDefinition, locale: CmsLocaleType): DocsBlock[] {
  const blocks: DocsBlock[] = []
  pushHeading(blocks, 1, page.title)
  pushParagraph(blocks, page.description)
  page.sections.forEach((sectionId) => {
    blocks.push(...buildSectionBlocks(content, sectionId, locale))
  })
  return blocks
}

async function ensurePageForBootstrap(
  supabase: ServerClient,
  input: {
    locale: DocsLocale
    title: string
    slug: string
    isHome: boolean
    userId: string
    blocks: DocsBlock[]
    overwriteExisting?: boolean
  }
): Promise<boolean> {
  const safeSlug = sanitizeSlug(input.slug || input.title)
  const { data: existing, error: existingError } = await supabase
    .from('docs_pages')
    .select('*')
    .eq('locale', input.locale)
    .eq('slug', safeSlug)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    if (!input.overwriteExisting) {
      return false
    }

    if (input.isHome) {
      const { error: resetHomeError } = await supabase
        .from('docs_pages')
        .update({ is_home: false, updated_by: input.userId })
        .eq('locale', input.locale)
        .eq('is_home', true)
        .neq('id', existing.id)

      if (resetHomeError) throw resetHomeError
    }

    const { error: updatePageError } = await supabase
      .from('docs_pages')
      .update({
        title: input.title,
        is_home: input.isHome,
        updated_by: input.userId,
      })
      .eq('id', existing.id)

    if (updatePageError) throw updatePageError

    await saveDocsDraft(supabase, {
      pageId: existing.id,
      titleSnapshot: input.title,
      blocks: input.blocks,
      seo: {},
      changeNote: 'Sync from legacy docs',
      userId: input.userId,
    })

    await publishDocsPage(supabase, {
      pageId: existing.id,
      userId: input.userId,
      changeNote: 'Synced from legacy docs',
    })

    return true
  }

  const page = await createDocsPage(supabase, {
    locale: input.locale,
    parentId: null,
    title: input.title,
    slug: safeSlug,
    isHome: input.isHome,
    userId: input.userId,
  })

  await saveDocsDraft(supabase, {
    pageId: page.id,
    titleSnapshot: input.title,
    blocks: input.blocks,
    seo: {},
    changeNote: 'Bootstrap from legacy docs',
    userId: input.userId,
  })

  await publishDocsPage(supabase, {
    pageId: page.id,
    userId: input.userId,
    changeNote: 'Initial published import from legacy docs',
  })

  return true
}

export async function bootstrapDocsFromLegacy(
  supabase: ServerClient,
  input: { userId: string; overwriteExisting?: boolean }
): Promise<{ importedLocales: DocsLocale[] }> {
  const importedLocales: DocsLocale[] = []

  for (const locale of ['ru', 'en'] as const) {
    let localeImported = false
    const legacy = await getDocsContentWithMarkdown(locale)
    const pageDefinitions = getDocsPageDefinitions(legacy)

    localeImported =
      (await ensurePageForBootstrap(supabase, {
      locale,
      title: legacy.hero.title,
      slug: locale === 'ru' ? 'obzor-dokumentacii' : 'documentation-overview',
      isHome: true,
      userId: input.userId,
      overwriteExisting: Boolean(input.overwriteExisting),
      blocks: [
        ...buildLegacyHomeBlocks(legacy, pageDefinitions, locale),
      ],
    })) || localeImported

    for (const page of pageDefinitions) {
      localeImported =
        (await ensurePageForBootstrap(supabase, {
        locale,
        title: page.title,
        slug: page.slug,
        isHome: false,
        userId: input.userId,
        overwriteExisting: Boolean(input.overwriteExisting),
        blocks: [
          ...buildLegacyPageBlocks(legacy, page, locale),
        ],
      })) || localeImported
    }

    if (localeImported) {
      importedLocales.push(locale)
    }
  }

  return { importedLocales }
}
