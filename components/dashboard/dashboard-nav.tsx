'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, User, Settings, LogOut, Bot, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { CompactLogo } from '@/components/logo'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'dashboard.nav.home' },
  { href: '/dashboard/bots', icon: Bot, label: 'dashboard.nav.bots' },
  { href: '/dashboard/docs', icon: BookOpen, label: 'dashboard.nav.docs' },
  { href: '/dashboard/profile', icon: User, label: 'dashboard.nav.profile' },
  { href: '/dashboard/settings', icon: Settings, label: 'dashboard.nav.settings' },
]

export function DashboardNav() {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()

  // Get locale from pathname
  const locale = pathname?.split('/')[1] || 'ru'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push(`/${locale}/auth/login`)
  }

  return (
    <aside className="w-64 h-screen overflow-hidden p-4 flex flex-col relative">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 to-zinc-900/60 backdrop-blur-xl border-r border-white/10" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Logo area with gradient accent */}
        <Link href={`/${locale}`} className="mb-8 px-4 py-3 rounded-xl bg-linear-to-r from-blue-500/10 to-purple-500/10 border border-white/10 hover:from-blue-500/20 hover:to-purple-500/20 transition-colors">
          <div className="flex items-center gap-3">
            <CompactLogo className="w-10 h-8 shrink-0" />
            <h1 className="text-xl font-bold text-white tracking-tight">CBTooll</h1>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const fullPath = `/${locale}${item.href}`
            // Exact match for home, or starts with for other pages (but not just the parent)
            const isActive = pathname === fullPath || (item.href !== '/dashboard' && pathname?.startsWith(fullPath + '/'))

            return (
              <Button
                key={item.href}
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  isActive
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 text-white border border-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                )}
                asChild
              >
                <Link href={fullPath} className="flex items-center relative">
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6]" />
                  )}
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{t(item.label)}</span>
                </Link>
              </Button>
            )
          })}
        </nav>

        {/* Logout button */}
        <div className="pt-4 border-t border-white/10 px-2">
          <Button
            variant="ghost"
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 group"
            onClick={handleLogout}
          >
            <span className="flex items-center">
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">{t('dashboard.nav.logout')}</span>
            </span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
