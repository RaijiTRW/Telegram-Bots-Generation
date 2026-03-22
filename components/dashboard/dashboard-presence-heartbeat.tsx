'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getSafeClientUser } from '@/lib/supabase/client-auth'

const PRESENCE_HEARTBEAT_MS = 90_000

export function DashboardPresenceHeartbeat() {
  const pathname = usePathname()
  const locale = useLocale()

  useEffect(() => {
    const supabase = createClient()
    const presenceTable = supabase.from('user_presence') as unknown as {
      upsert: (
        values: {
          user_id: string
          last_seen_at: string
          locale: string | null
          page_path: string | null
        },
        options: { onConflict: string }
      ) => Promise<unknown>
    }
    let disposed = false
    let currentUserId: string | null = null

    const pingPresence = async () => {
      if (disposed) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

      try {
        if (!currentUserId) {
          const user = await getSafeClientUser(supabase)
          currentUserId = user?.id || null
        }

        if (!currentUserId) return

        await presenceTable.upsert(
          {
            user_id: currentUserId,
            last_seen_at: new Date().toISOString(),
            locale: String(locale || '').slice(0, 12) || null,
            page_path: String(pathname || '').slice(0, 256) || null,
          },
          { onConflict: 'user_id' }
        )
      } catch {
        // Presence should never break the UI.
      }
    }

    void pingPresence()

    const intervalId = window.setInterval(() => {
      void pingPresence()
    }, PRESENCE_HEARTBEAT_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pingPresence()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      currentUserId = session?.user?.id || null
      if (currentUserId) {
        void pingPresence()
      }
    })

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription.unsubscribe()
    }
  }, [locale, pathname])

  return null
}
