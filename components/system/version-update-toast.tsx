'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import packageJson from '@/package.json'

const CURRENT_VERSION = packageJson.version
const POLL_INTERVAL_MS = 60_000
const DISMISSED_VERSION_KEY = 'cbtooll:dismissed-update-version'

type VersionResponse = {
  version?: string
}

function isDifferentVersion(nextVersion: string | undefined): nextVersion is string {
  return Boolean(nextVersion && nextVersion !== CURRENT_VERSION)
}

export function VersionUpdateToast() {
  const locale = useLocale()
  const isRu = locale !== 'en'
  const [latestVersion, setLatestVersion] = useState<string | null>(null)

  const checkVersion = useCallback(async () => {
    try {
      const response = await fetch(`/api/app-version?t=${Date.now()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        return
      }

      const data = (await response.json()) as VersionResponse
      if (!isDifferentVersion(data.version)) {
        setLatestVersion(null)
        return
      }

      const dismissedVersion = window.sessionStorage.getItem(DISMISSED_VERSION_KEY)
      if (dismissedVersion === data.version) {
        return
      }

      setLatestVersion(data.version)
    } catch {
      // Version checks are best-effort and should never interrupt the app.
    }
  }, [])

  useEffect(() => {
    const initialCheckId = window.setTimeout(() => {
      void checkVersion()
    }, 0)

    const intervalId = window.setInterval(() => {
      void checkVersion()
    }, POLL_INTERVAL_MS)

    const handleFocus = () => {
      void checkVersion()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkVersion()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(initialCheckId)
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkVersion])

  if (!latestVersion) {
    return null
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-[420] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#24A1DE]/30 bg-zinc-950/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#24A1DE]/35 bg-[#24A1DE]/15 text-[#7fd6ff]">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">
            {isRu ? 'Доступно обновление' : 'Update available'}
          </div>
          <p className="mt-1 text-sm leading-5 text-zinc-300">
            {isRu
              ? 'Вышла новая версия. Перезагрузите страницу, чтобы применить изменения.'
              : 'A new version is available. Reload the page to apply the changes.'}
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                window.sessionStorage.setItem(DISMISSED_VERSION_KEY, latestVersion)
                setLatestVersion(null)
              }}
            >
              {isRu ? 'Позже' : 'Later'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white hover:from-[#24A1DE]/85 hover:to-[#8B5CF6]/85"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isRu ? 'Перезагрузить' : 'Reload'}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
