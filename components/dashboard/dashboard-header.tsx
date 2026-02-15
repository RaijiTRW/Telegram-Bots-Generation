'use client'

import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { LanguageSwitcher } from '@/components/dashboard/language-switcher'

export function DashboardHeader() {
  const t = useTranslations()
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUserName(data.user.user_metadata.full_name || data.user.email?.split('@')[0] || '')
      }
    }
    getUser()
  }, [])

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="h-16 px-6 flex items-center justify-between sticky top-0 z-50">
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
          {/* Avatar with gradient border */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] blur-sm opacity-70" />
            <Avatar className="relative bg-zinc-900 border-2 border-zinc-800 shadow-xl">
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
