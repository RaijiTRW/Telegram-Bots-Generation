'use client'

import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getSafeClientUser } from '@/lib/supabase/client-auth'
import { useEffect, useState } from 'react'
import { LanguageSwitcher } from '@/components/dashboard/language-switcher'
import packageJson from '@/package.json'

const APP_VERSION = packageJson.version

export function DashboardHeader() {
  const t = useTranslations()
  const [userName, setUserName] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const setUserPreview = async (user?: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null) => {
      const resolvedUser = user === undefined ? await getSafeClientUser(supabase) : user

      if (!resolvedUser) {
        setUserName('')
        setAvatarUrl(null)
        return
      }

      const metadata =
        resolvedUser.user_metadata && typeof resolvedUser.user_metadata === 'object'
          ? (resolvedUser.user_metadata as Record<string, unknown>)
          : {}

      const fallbackName =
        (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
        resolvedUser.email?.split('@')[0] ||
        ''

      const fallbackAvatar =
        typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
          ? metadata.avatar_url
          : null

      setUserName(fallbackName)
      setAvatarUrl(fallbackAvatar)

      try {
        const { data: profileRow } = await ((supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', resolvedUser.id)
          .maybeSingle()) as unknown as Promise<{
          data: { full_name: string | null; avatar_url: string | null } | null
        }>)

        if (profileRow?.full_name?.trim()) {
          setUserName(profileRow.full_name)
        }
        if (typeof profileRow?.avatar_url === 'string') {
          setAvatarUrl(profileRow.avatar_url)
        }
      } catch {
        // Keep auth metadata fallback when profile query is unavailable.
      }
    }

    void setUserPreview()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void setUserPreview(session?.user ?? null)
      }, 0)
    })

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fullName?: string; avatarUrl?: string | null }>).detail
      if (detail?.fullName !== undefined) {
        setUserName(detail.fullName || '')
      }
      if (detail && 'avatarUrl' in detail) {
        setAvatarUrl(detail.avatarUrl ?? null)
      }
    }

    window.addEventListener('cbtooll:profile-updated', handleProfileUpdated as EventListener)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('cbtooll:profile-updated', handleProfileUpdated as EventListener)
    }
  }, [])

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      data-tour="dashboard-header"
      className="h-16 shrink-0 px-6 flex items-center justify-between sticky top-0 z-50"
    >
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-zinc-950/70 backdrop-blur-xl border-b border-white/10" />
      
      <div className="relative z-10 flex items-center justify-between w-full gap-4">
        <div>
          <p className="text-sm text-zinc-500 font-medium">{t('header.welcomeBack')}</p>
          <h2 className="text-lg font-semibold text-white">
            {userName || t('dashboard.welcome', { name: '' })}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <div
            className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-300"
            title={`CBTooll v${APP_VERSION}`}
            aria-label={t('header.appVersionAria', { version: APP_VERSION })}
          >
            v{APP_VERSION}
          </div>
          {/* Avatar with gradient border */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] blur-sm opacity-70" />
            <Avatar className="relative bg-zinc-900 border-2 border-zinc-800 shadow-xl">
              <AvatarImage
                src={avatarUrl || undefined}
                alt={userName || t('header.userAvatarAlt')}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-white font-semibold text-sm">
                {initials || <User className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  )
}
