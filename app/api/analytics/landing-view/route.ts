import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClientWrapper } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function toSafeString(value: unknown, maxLength: number): string {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function normalizeSessionId(value: unknown): string {
  return toSafeString(value, 128).replace(/[^\w:-]+/g, '')
}

function normalizeLocale(value: unknown): string | null {
  const locale = toSafeString(value, 12).toLowerCase()
  if (!locale) return null
  return locale
}

function normalizePath(value: unknown): string | null {
  const path = toSafeString(value, 256)
  if (!path) return null
  if (!path.startsWith('/')) return null
  return path
}

export async function POST(request: NextRequest) {
  try {
    let payload: Record<string, unknown> | null = null
    try {
      payload = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 })
    }

    const sessionId = normalizeSessionId(payload.sessionId)
    if (sessionId.length < 8) {
      return NextResponse.json({ ok: false, error: 'invalid_session_id' }, { status: 400 })
    }

    const locale = normalizeLocale(payload.locale)
    const path = normalizePath(payload.path)
    const referrer = toSafeString(payload.referrer, 512) || null

    let userId: string | null = null
    try {
      const supabase = await createServerClientWrapper()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch {
      userId = null
    }

    const admin = createAdminClient()
    const landingViewsTable = admin.from('landing_page_views') as unknown as {
      insert: (values: {
        session_id: string
        user_id: string | null
        locale: string | null
        path: string | null
        referrer: string | null
      }) => Promise<{ error: { message?: string } | null }>
    }
    const { error } = await landingViewsTable.insert({
      session_id: sessionId,
      user_id: userId,
      locale,
      path,
      referrer,
    })

    if (error) {
      console.error('Failed to insert landing view:', error)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Landing view analytics error:', error)
    return NextResponse.json({ ok: false, error: 'unknown_error' }, { status: 500 })
  }
}
