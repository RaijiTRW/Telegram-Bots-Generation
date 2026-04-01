import 'server-only'

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export type BrowserPushSubscriptionPayload = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export type BrowserPushNotificationPayload = {
  title: string
  body: string
  tag?: string
  url?: string
  icon?: string
  badge?: string
  requireInteraction?: boolean
}

let webPushConfigured = false

function getWebPushSubject() {
  return String(process.env.WEB_PUSH_SUBJECT || 'mailto:notifications@cbtooll.com').trim()
}

export function getWebPushPublicKey() {
  return String(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || '').trim()
}

function getWebPushPrivateKey() {
  return String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim()
}

export function hasWebPushConfig() {
  return Boolean(getWebPushPublicKey() && getWebPushPrivateKey())
}

function ensureWebPushConfigured() {
  if (!hasWebPushConfig()) {
    throw new Error('Web push is not configured')
  }

  if (!webPushConfigured) {
    webpush.setVapidDetails(
      getWebPushSubject(),
      getWebPushPublicKey(),
      getWebPushPrivateKey()
    )
    webPushConfigured = true
  }
}

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function normalizeBrowserPushSubscription(
  value: unknown
): BrowserPushSubscriptionPayload | null {
  const record = readRecord(value)
  if (!record) return null

  const endpoint = String(record.endpoint || '').trim()
  const keys = readRecord(record.keys)
  const p256dh = String(keys?.p256dh || '').trim()
  const auth = String(keys?.auth || '').trim()

  if (!endpoint || !p256dh || !auth) {
    return null
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  }
}

export async function upsertBrowserPushSubscription(input: {
  userId: string
  subscription: BrowserPushSubscriptionPayload
  locale?: string | null
  userAgent?: string | null
}) {
  const admin = createAdminClient()
  const result = await admin
    .from('browser_push_subscriptions')
    .upsert(
      {
        user_id: input.userId,
        endpoint: input.subscription.endpoint,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        locale: input.locale || null,
        user_agent: input.userAgent || null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'endpoint',
        ignoreDuplicates: false,
      }
    )

  if (result.error) {
    throw new Error(`Failed to save browser push subscription: ${result.error.message}`)
  }
}

export async function removeBrowserPushSubscription(input: {
  userId?: string
  endpoint: string
}) {
  const admin = createAdminClient()
  let query = admin
    .from('browser_push_subscriptions')
    .delete()
    .eq('endpoint', input.endpoint)

  if (input.userId) {
    query = query.eq('user_id', input.userId)
  }

  const result = await query
  if (result.error) {
    throw new Error(`Failed to remove browser push subscription: ${result.error.message}`)
  }
}

export async function listBrowserPushSubscriptions(userId: string) {
  const admin = createAdminClient()
  const result = await admin
    .from('browser_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (result.error) {
    throw new Error(`Failed to load browser push subscriptions: ${result.error.message}`)
  }

  return (result.data || []).map((item) => ({
    endpoint: item.endpoint,
    keys: {
      p256dh: item.p256dh,
      auth: item.auth,
    },
  })) satisfies BrowserPushSubscriptionPayload[]
}

export async function sendBrowserPushNotification(input: {
  subscription: BrowserPushSubscriptionPayload
  payload: BrowserPushNotificationPayload
}) {
  ensureWebPushConfigured()

  try {
    await webpush.sendNotification(input.subscription, JSON.stringify(input.payload))
  } catch (error) {
    const record = error as { statusCode?: number }
    if (record?.statusCode === 404 || record?.statusCode === 410) {
      await removeBrowserPushSubscription({ endpoint: input.subscription.endpoint })
    }
    throw error
  }
}
