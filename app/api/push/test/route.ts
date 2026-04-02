import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import {
  hasWebPushConfig,
  listBrowserPushSubscriptions,
  normalizeBrowserPushSubscription,
  sendBrowserPushNotification,
} from '@/lib/browser-push'

export const dynamic = 'force-dynamic'

function getTitle(locale: string) {
  return locale === 'en' ? 'CBTooll browser notifications' : 'Браузерные уведомления CBTooll'
}

function getBody(locale: string) {
  return locale === 'en'
    ? 'Test push delivered successfully. Your browser notifications are configured correctly.'
    : 'Тестовый push успешно доставлен. Браузерные уведомления настроены корректно.'
}

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  if (!hasWebPushConfig()) {
    return NextResponse.json({ success: false, error: 'Web push is not configured' }, { status: 503 })
  }

  try {
    const payload = await request.json().catch(() => null)
    const locale = String(payload?.locale || 'ru').trim().toLowerCase() === 'en' ? 'en' : 'ru'
    const directSubscription = normalizeBrowserPushSubscription(payload?.subscription)
    const subscriptions = directSubscription
      ? [directSubscription]
      : await listBrowserPushSubscriptions(user.id)

    if (!subscriptions.length) {
      return NextResponse.json({ success: false, error: 'No browser push subscription found' }, { status: 404 })
    }

    const targetUrl = `/${locale}/dashboard/settings`
    await Promise.all(
      subscriptions.map((subscription) =>
        sendBrowserPushNotification({
          subscription,
          payload: {
            title: getTitle(locale),
            body: getBody(locale),
            tag: 'cbtooll-browser-push-test',
            url: targetUrl,
            icon: '/icon.png',
            badge: '/icon.png',
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
