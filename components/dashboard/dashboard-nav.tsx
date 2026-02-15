'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, User, Settings, LogOut, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'dashboard.nav.home' },
  { href: '/dashboard/bots', icon: Bot, label: 'dashboard.nav.bots' },
  { href: '/dashboard/profile', icon: User, label: 'dashboard.nav.profile' },
  { href: '/dashboard/settings', icon: Settings, label: 'dashboard.nav.settings' },
]

export function DashboardNav() {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-64 min-h-screen p-4 flex flex-col relative">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 to-zinc-900/60 backdrop-blur-xl border-r border-white/10" />
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Logo area with gradient accent */}
        <div className="mb-8 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">TFlow</h1>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            
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
                <a href={item.href} className="flex items-center">
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6]" />
                  )}
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{t(item.label)}</span>
                </a>
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
