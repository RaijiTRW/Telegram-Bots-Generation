'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'

const ANALYTICS_SESSION_KEY = 'cbtooll.analytics.sessionId'
const ANALYTICS_SENT_PREFIX = 'cbtooll.analytics.landing.sent'

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const random = Math.random().toString(36).slice(2)
  return `sess_${Date.now().toString(36)}_${random}`
}

function getOrCreateSessionId() {
  try {
    const existing = window.localStorage.getItem(ANALYTICS_SESSION_KEY)
    if (existing && existing.length >= 8) {
      return existing
    }
    const next = createSessionId()
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, next)
    return next
  } catch {
    return createSessionId()
  }
}

export function LandingViewTracker() {
  const pathname = usePathname()
  const locale = useLocale()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const path = pathname || `/${locale}`
    const day = new Date().toISOString().slice(0, 10)
    const sentKey = `${ANALYTICS_SENT_PREFIX}:${day}:${path}`

    try {
      if (window.sessionStorage.getItem(sentKey) === '1') {
        return
      }
      window.sessionStorage.setItem(sentKey, '1')
    } catch {
      // ignore sessionStorage issues
    }

    const payload = JSON.stringify({
      sessionId: getOrCreateSessionId(),
      locale,
      path,
      referrer: document.referrer || '',
    })

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/analytics/landing-view', blob)
      return
    }

    void fetch('/api/analytics/landing-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  }, [locale, pathname])

  return null
}
