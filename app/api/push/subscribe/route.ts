import { NextRequest, NextResponse } from 'next/server'
import { normalizeDashboardSettingsLocale } from '@/lib/dashboard-settings'
import { getServerUser } from '@/lib/supabase/server'
import {
  hasWebPushConfig,
  normalizeBrowserPushSubscription,
  upsertBrowserPushSubscription,
} from '@/lib/browser-push'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  if (!hasWebPushConfig()) {
    return NextResponse.json({ success: false, error: 'Web push is not configured' }, { status: 503 })
  }

  try {
    const payload = await request.json()
    const subscription = normalizeBrowserPushSubscription(payload?.subscription)

    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Invalid push subscription' }, { status: 400 })
    }

    await upsertBrowserPushSubscription({
      userId: user.id,
      subscription,
      locale: normalizeDashboardSettingsLocale(payload?.locale, 'ru'),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
