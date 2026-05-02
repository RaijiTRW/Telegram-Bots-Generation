'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath, revalidateTag } from 'next/cache'

import { validateDocsBlocksByMode } from '@/lib/docs-cms/blocks'
import { PUBLISHED_SANITY_DOCS_CACHE_TAG } from '@/lib/sanity/docs'
import { PUBLISHED_SANITY_HELP_GUIDES_CACHE_TAG } from '@/lib/sanity/help-guides'
import type { DocsBlock, DocsEditorPayload, DocsLocale, DocsPageNode, DocsSeo } from '@/lib/docs-cms/types'
import { isDocsLocale } from '@/lib/docs-cms/types'
import {
  bootstrapDocsFromLegacy,
  createDocsPage,
  createDocsRedirect,
  deleteDocsPage,
  deleteDocsRedirect,
  getAdminDocsTree,
  getDocsEditorPayload,
  moveDocsPage,
  publishDocsPage,
  reorderDocsSiblings,
  restoreDocsRevision,
  saveDocsDraft,
  updateDocsPageMeta,
} from '@/lib/docs-cms/repository'
import { createServerClientWrapper } from '@/lib/supabase/server'

const DOCS_MEDIA_BUCKET = 'docs-media'
const MAX_DOCS_MEDIA_BYTES = 500 * 1024 * 1024
const ALLOWED_DOCS_MEDIA_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/webp',
])

type ActionSuccess<T> = { success: true; data: T }
type ActionError = { success: false; error: string }
type ActionResult<T> = ActionSuccess<T> | ActionError

function normalizePath(path: string): string {
  const value = String(path || '').trim()
  if (!value) return ''
  return value.replace(/^\/+/, '').replace(/\/+$/, '')
}

async function getAdminContext() {
  const supabase = await createServerClientWrapper()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('UNAUTHORIZED')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  return { supabase, userId: user.id }
}

function safeLocale(locale: string): DocsLocale {
  return isDocsLocale(locale) ? locale : 'ru'
}

function errorResult<T>(error: unknown): ActionResult<T> {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message || 'Unknown error' }
}

function revalidateDocsPaths(locale: DocsLocale) {
  revalidatePath(`/${locale}/docs`, 'layout')
  revalidatePath(`/${locale}/dashboard/docs`, 'layout')
  revalidateTag(PUBLISHED_SANITY_DOCS_CACHE_TAG, 'max')
  revalidateTag(PUBLISHED_SANITY_HELP_GUIDES_CACHE_TAG, 'max')
  revalidateTag('docs-content-with-markdown', 'max')
}

export async function getDocsTreeAction(locale: string): Promise<ActionResult<DocsPageNode[]>> {
  try {
    const { supabase } = await getAdminContext()
    const tree = await getAdminDocsTree(supabase, safeLocale(locale))
    return { success: true, data: tree }
  } catch (error) {
    return errorResult(error)
  }
}

export async function getDocsEditorPayloadAction(
  locale: string,
  pageId: string
): Promise<ActionResult<DocsEditorPayload | null>> {
  try {
    const { supabase } = await getAdminContext()
    const payload = await getDocsEditorPayload(supabase, safeLocale(locale), pageId)
    return { success: true, data: payload }
  } catch (error) {
    return errorResult(error)
  }
}

export async function createDocsPageAction(input: {
  locale: string
  parentId?: string | null
  title: string
  slug: string
  isHome?: boolean
}): Promise<ActionResult<Awaited<ReturnType<typeof createDocsPage>>>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const locale = safeLocale(input.locale)
    const page = await createDocsPage(supabase, {
      locale,
      parentId: input.parentId ?? null,
      title: input.title,
      slug: input.slug,
      isHome: Boolean(input.isHome),
      userId,
    })
    return { success: true, data: page }
  } catch (error) {
    return errorResult(error)
  }
}

export async function updateDocsPageMetaAction(input: {
  locale: string
  pageId: string
  title: string
  slug: string
  parentId?: string | null
  isHome: boolean
  seo?: DocsSeo
}): Promise<ActionResult<Awaited<ReturnType<typeof updateDocsPageMeta>>>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const locale = safeLocale(input.locale)

    const page = await updateDocsPageMeta(supabase, {
      pageId: input.pageId,
      locale,
      title: input.title,
      slug: input.slug,
      parentId: input.parentId ?? null,
      isHome: Boolean(input.isHome),
      userId,
    })
    return { success: true, data: page }
  } catch (error) {
    return errorResult(error)
  }
}

export async function moveDocsPageAction(input: {
  locale: string
  pageId: string
  newParentId?: string | null
  sortOrder?: number
}): Promise<ActionResult<true>> {
  try {
    const { supabase, userId } = await getAdminContext()
    await moveDocsPage(supabase, {
      pageId: input.pageId,
      locale: safeLocale(input.locale),
      newParentId: input.newParentId ?? null,
      sortOrder: input.sortOrder,
      userId,
    })
    return { success: true, data: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function reorderDocsSiblingsAction(input: {
  locale: string
  parentId?: string | null
  orderedPageIds: string[]
}): Promise<ActionResult<true>> {
  try {
    const { supabase, userId } = await getAdminContext()
    await reorderDocsSiblings(supabase, {
      locale: safeLocale(input.locale),
      parentId: input.parentId ?? null,
      orderedPageIds: input.orderedPageIds,
      userId,
    })
    return { success: true, data: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function saveDocsDraftAction(input: {
  locale: string
  pageId: string
  titleSnapshot: string
  blocks: DocsBlock[]
  seo?: DocsSeo
  changeNote?: string | null
}): Promise<ActionResult<Awaited<ReturnType<typeof saveDocsDraft>>>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const locale = safeLocale(input.locale)
    const validate = validateDocsBlocksByMode(input.blocks as never, 'draft')
    if (!validate.valid) {
      throw new Error(validate.errors.join(' '))
    }
    const revision = await saveDocsDraft(supabase, {
      pageId: input.pageId,
      titleSnapshot: input.titleSnapshot,
      blocks: input.blocks,
      seo: input.seo || {},
      changeNote: input.changeNote || null,
      userId,
    })
    revalidateDocsPaths(locale)
    return { success: true, data: revision }
  } catch (error) {
    return errorResult(error)
  }
}

export async function publishDocsPageAction(input: {
  locale: string
  pageId: string
  changeNote?: string | null
}): Promise<ActionResult<Awaited<ReturnType<typeof publishDocsPage>>>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const locale = safeLocale(input.locale)
    const payload = await getDocsEditorPayload(supabase, locale, input.pageId)
    if (!payload) {
      throw new Error('Page not found')
    }
    const validate = validateDocsBlocksByMode(payload.draft.blocks as never, 'publish')
    if (!validate.valid) {
      throw new Error(validate.errors.join(' '))
    }

    // Quick garbage collection for this page's unreferenced media
    const allBlocksText = JSON.stringify(payload.draft.blocks)
    const { data: mediaAssets } = await supabase
      .from('docs_media_assets')
      .select('id, object_path, public_url')
      .eq('page_id', input.pageId)

    if (mediaAssets && mediaAssets.length > 0) {
      const pathsToDelete: string[] = []
      const idsToDelete: string[] = []
      for (const asset of mediaAssets) {
        if (!allBlocksText.includes(asset.public_url)) {
          pathsToDelete.push(asset.object_path)
          idsToDelete.push(asset.id)
        }
      }
      if (pathsToDelete.length > 0) {
        await supabase.storage.from('docs-media').remove(pathsToDelete)
        await supabase.from('docs_media_assets').delete().in('id', idsToDelete)
      }
    }

    const revision = await publishDocsPage(supabase, {
      pageId: input.pageId,
      userId,
      changeNote: input.changeNote || null,
    })
    revalidateDocsPaths(locale)
    return { success: true, data: revision }
  } catch (error) {
    return errorResult(error)
  }
}

export async function restoreDocsRevisionAction(input: {
  locale: string
  pageId: string
  revisionId: string
}): Promise<ActionResult<Awaited<ReturnType<typeof restoreDocsRevision>>>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const locale = safeLocale(input.locale)
    const revision = await restoreDocsRevision(supabase, {
      pageId: input.pageId,
      revisionId: input.revisionId,
      userId,
    })
    revalidateDocsPaths(locale)
    return { success: true, data: revision }
  } catch (error) {
    return errorResult(error)
  }
}

export async function deleteDocsPageAction(input: {
  locale: string
  pageId: string
}): Promise<ActionResult<true>> {
  try {
    const { supabase } = await getAdminContext()
    const locale = safeLocale(input.locale)

    // Cleanup media assets
    const { data: mediaAssets } = await supabase
      .from('docs_media_assets')
      .select('id, object_path')
      .eq('page_id', input.pageId)

    if (mediaAssets && mediaAssets.length > 0) {
      const paths = mediaAssets.map((a) => a.object_path)
      const ids = mediaAssets.map((a) => a.id)

      const { error: storageError } = await supabase.storage
        .from('docs-media')
        .remove(paths)

      if (!storageError) {
        await supabase.from('docs_media_assets').delete().in('id', ids)
      }
    }

    await deleteDocsPage(supabase, {
      pageId: input.pageId,
      locale,
    })
    revalidateDocsPaths(locale)
    return { success: true, data: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function createRedirectAction(input: {
  locale: string
  fromPath: string
  toPageId: string
}): Promise<ActionResult<true>> {
  try {
    const { supabase, userId } = await getAdminContext()
    await createDocsRedirect(supabase, {
      locale: safeLocale(input.locale),
      fromPath: normalizePath(input.fromPath),
      toPageId: input.toPageId,
      userId,
    })
    revalidateDocsPaths(safeLocale(input.locale))
    return { success: true, data: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function deleteRedirectAction(
  redirectId: string,
  locale?: string
): Promise<ActionResult<true>> {
  try {
    const { supabase } = await getAdminContext()
    await deleteDocsRedirect(supabase, { redirectId })
    if (locale) {
      revalidateDocsPaths(safeLocale(locale))
    }
    return { success: true, data: true }
  } catch (error) {
    return errorResult(error)
  }
}

export async function uploadDocsMediaAction(formData: FormData): Promise<ActionResult<{
  assetId: string
  url: string
  mimeType: string
  sizeBytes: number
  objectPath: string
}>> {
  try {
    const { supabase, userId } = await getAdminContext()

    const locale = safeLocale(String(formData.get('locale') || 'ru'))
    const pageIdRaw = String(formData.get('pageId') || '').trim()
    const pageId = pageIdRaw || null
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new Error('File is required')
    }
    if (!file.size || file.size <= 0) {
      throw new Error('File is empty')
    }
    if (file.size > MAX_DOCS_MEDIA_BYTES) {
      throw new Error('File exceeds max 500MB')
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Only images and videos are allowed.`)
    }

    const safeName = String(file.name || 'asset')
      .replace(/[^\w.\-]+/g, '_')
      .slice(-120)
    const objectPath = `docs/${locale}/${pageId || 'unassigned'}/${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(DOCS_MEDIA_BUCKET)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicData } = supabase.storage
      .from(DOCS_MEDIA_BUCKET)
      .getPublicUrl(objectPath)

    const publicUrl = publicData.publicUrl
    if (!publicUrl) {
      throw new Error('Failed to resolve public URL')
    }

    const { data: insertedAsset, error: insertError } = await supabase
      .from('docs_media_assets')
      .insert({
        locale,
        page_id: pageId,
        bucket: DOCS_MEDIA_BUCKET,
        object_path: objectPath,
        public_url: publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        meta: {},
        created_by: userId,
      })
      .select('id, public_url, mime_type, size_bytes, object_path')
      .single()

    if (insertError) {
      throw insertError
    }

    return {
      success: true,
      data: {
        assetId: insertedAsset.id,
        url: insertedAsset.public_url,
        mimeType: insertedAsset.mime_type,
        sizeBytes: Number(insertedAsset.size_bytes || 0),
        objectPath: insertedAsset.object_path,
      },
    }
  } catch (error) {
    return errorResult(error)
  }
}

export async function bootstrapDocsCmsFromLegacyAction(): Promise<ActionResult<{ importedLocales: DocsLocale[] }>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const result = await bootstrapDocsFromLegacy(supabase, { userId, overwriteExisting: false })
    for (const locale of result.importedLocales) {
      revalidateDocsPaths(locale)
    }
    return { success: true, data: result }
  } catch (error) {
    return errorResult(error)
  }
}

export async function syncDocsCmsFromLegacyAction(): Promise<ActionResult<{ importedLocales: DocsLocale[] }>> {
  try {
    const { supabase, userId } = await getAdminContext()
    const result = await bootstrapDocsFromLegacy(supabase, { userId, overwriteExisting: true })
    for (const locale of result.importedLocales) {
      revalidateDocsPaths(locale)
    }
    return { success: true, data: result }
  } catch (error) {
    return errorResult(error)
  }
}
