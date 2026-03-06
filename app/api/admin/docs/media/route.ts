import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createServerClientWrapper } from '@/lib/supabase/server'
import { isDocsLocale } from '@/lib/docs-cms/types'

export const dynamic = 'force-dynamic'

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

function safeLocale(locale: string) {
  return isDocsLocale(locale) ? locale : 'ru'
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown error'
  }
  return String(error || 'Unknown error')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClientWrapper()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const locale = safeLocale(String(formData.get('locale') || 'ru'))
    const pageIdRaw = String(formData.get('pageId') || '').trim()
    const pageId = pageIdRaw || null
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'File is required' }, { status: 400 })
    }
    if (!file.size || file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'File is empty' }, { status: 400 })
    }
    if (file.size > MAX_DOCS_MEDIA_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'File exceeds max 500MB' },
        { status: 400 }
      )
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ ok: false, error: 'Unsupported file type. Only images and videos are allowed.' }, { status: 400 })
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
      return NextResponse.json(
        { ok: false, error: uploadError.message || 'Failed to upload file' },
        { status: 500 }
      )
    }

    const { data: publicData } = supabase.storage
      .from(DOCS_MEDIA_BUCKET)
      .getPublicUrl(objectPath)

    const publicUrl = publicData.publicUrl
    if (!publicUrl) {
      return NextResponse.json(
        { ok: false, error: 'Failed to resolve public URL' },
        { status: 500 }
      )
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
        created_by: user.id,
      })
      .select('id, public_url, mime_type, size_bytes, object_path')
      .single()

    if (insertError) {
      return NextResponse.json(
        { ok: false, error: insertError.message || 'Failed to save media record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        assetId: insertedAsset.id,
        url: insertedAsset.public_url,
        mimeType: insertedAsset.mime_type,
        sizeBytes: Number(insertedAsset.size_bytes || 0),
        objectPath: insertedAsset.object_path,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(error) },
      { status: 500 }
    )
  }
}
