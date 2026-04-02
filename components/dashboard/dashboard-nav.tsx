'use client'

import { startTransition, useEffect, useMemo, type ComponentType } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, User, Settings, LogOut, Bot, BookOpen, Shield, Users, FileText, Lock, BarChart3, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { CompactLogo } from '@/components/logo'
import type { ViewerAccess } from '@/lib/billing/types'
import { prefetchHrefOnce } from '@/lib/navigation/prefetch'
import { preloadDashboardSection, type DashboardSection } from '@/components/dashboard/layout/dashboard-section-viewport'
import {
  type AppAccessControls,
  type ManagedDashboardSection,
  resolveDashboardSectionAccess,
} from '@/lib/admin-access/config'

interface DashboardNavProps {
  viewerAccess: ViewerAccess
  accessControls: AppAccessControls
  activeSection?: DashboardSection | 'docs' | null
  onSectionChange?: (section: DashboardSection, href: string) => void
}

type DashboardNavItem = {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  section?: DashboardSection
  managedSection?: ManagedDashboardSection
  localeAgnostic?: boolean
  disabled?: boolean
  locked?: boolean
  badge?: string
}

export function DashboardNav({
  viewerAccess,
  accessControls,
  activeSection = null,
  onSectionChange,
}: DashboardNavProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = viewerAccess.isAdmin

  // Get locale from pathname
  const locale = pathname?.split('/')[1] || 'ru'
  const navLocale = locale === 'en' ? 'en' : 'ru'

  const navItems = useMemo<DashboardNavItem[]>(() => {
    const applyManagedSectionAccess = (item: DashboardNavItem): DashboardNavItem | null => {
      if (!item.managedSection) {
        return item
      }

      const access = resolveDashboardSectionAccess(
        item.managedSection,
        accessControls,
        isAdmin,
        navLocale
      )

      if (!access.visible) {
        return null
      }

      return {
        ...item,
        disabled: item.disabled || !access.accessible,
        locked: access.mode !== 'default',
        badge: access.badge || undefined,
      }
    }

    const rawBaseItems: DashboardNavItem[] = [
      { href: '/dashboard', icon: Home, label: 'dashboard.nav.home', section: 'home' },
      {
        href: '/dashboard/bots',
        icon: Bot,
        label: 'dashboard.nav.bots',
        section: 'bots',
        managedSection: 'bots',
      },
      {
        href: '/dashboard/statistics',
        icon: BarChart3,
        label: 'dashboard.nav.statistics',
        section: 'statistics',
        managedSection: 'statistics',
      },
      {
        href: '/dashboard/subscription',
        icon: CreditCard,
        label: 'dashboard.nav.subscription',
        section: 'subscription',
        managedSection: 'subscription',
      },
      {
        href: '/dashboard/crm',
        icon: Users,
        label: 'dashboard.nav.crm',
        section: 'crm',
        managedSection: 'crm',
      },
      {
        href: '/dashboard/docs',
        icon: BookOpen,
        label: 'dashboard.nav.docs',
        managedSection: 'docs',
      },
      {
        href: '/dashboard/profile',
        icon: User,
        label: 'dashboard.nav.profile',
        section: 'profile',
        managedSection: 'profile',
      },
      {
        href: '/dashboard/settings',
        icon: Settings,
        label: 'dashboard.nav.settings',
        section: 'settings',
        managedSection: 'settings',
      },
    ]
    const baseItems = rawBaseItems
      .map(applyManagedSectionAccess)
      .filter(Boolean) as DashboardNavItem[]

    if (!isAdmin) {
      return baseItems
    }

    return [
      baseItems[0],
      baseItems[1],
      baseItems[2],
      baseItems[3],
      baseItems[4],
      { href: '/dashboard/cms', icon: FileText, label: 'dashboard.nav.cms', localeAgnostic: true },
      { href: '/dashboard/admin', icon: Shield, label: 'dashboard.nav.admin', section: 'admin' },
      baseItems[5],
      baseItems[6],
      baseItems[7],
    ]
  }, [accessControls, isAdmin, navLocale])

  useEffect(() => {
    for (const item of navItems) {
      if (item.section) {
        void preloadDashboardSection(item.section)
      }
    }
  }, [navItems])

  const prefetchRoute = (href: string, section?: DashboardSection, disabled?: boolean) => {
    if (disabled) {
      return
    }
    const targetHref = href.startsWith('/dashboard/cms') ? href : `/${locale}${href}`
    prefetchHrefOnce(router, targetHref)
    if (section) {
      void preloadDashboardSection(section)
    }
  }

  const handleSectionNavigation = (href: string, section: DashboardSection) => {
    const fullHref = `/${locale}${href}`
    onSectionChange?.(section, fullHref)
    prefetchRoute(href, section)
    startTransition(() => {
      router.push(fullHref)
    })
  }

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
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
        <Link href={`/${locale}`} className="mb-8 rounded-xl border border-white/10 bg-linear-to-r from-blue-500/10 to-purple-500/10 px-4 py-3 hover:from-blue-500/20 hover:to-purple-500/20 transition-colors">
          <div className="flex min-h-[56px] items-center gap-3.5">
            <CompactLogo className="size-12 shrink-0" idPrefix="dashboard-nav-logo" />
            <h1 className="text-[2.15rem] font-bold leading-none text-white tracking-tight">CBTooll</h1>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const fullPath = item.localeAgnostic ? item.href : `/${locale}${item.href}`
            // Exact match for home, or starts with for other pages (but not just the parent)
            const isActive = item.section
              ? activeSection === item.section
              : pathname === fullPath || (item.href !== '/dashboard' && pathname?.startsWith(fullPath + '/'))

            if (item.disabled) {
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  disabled
                  className={cn(
                    'relative w-full justify-start cursor-not-allowed',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 text-white border border-white/10'
                      : 'text-zinc-400/90 hover:text-zinc-400/90 hover:bg-transparent'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6]" />
                  )}
                  <span className="flex items-center w-full">
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{t(item.label)}</span>
                    {item.locked ? <Lock className="w-3.5 h-3.5 ml-2 text-zinc-400" /> : null}
                    {item.badge ? (
                      <span className="ml-auto rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                </Button>
              )
            }

            if (item.section) {
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={cn(
                    'relative w-full justify-start',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/10 text-white border border-white/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  )}
                  onClick={() => handleSectionNavigation(item.href, item.section as DashboardSection)}
                  onMouseEnter={() => prefetchRoute(item.href, item.section, item.disabled)}
                  onFocus={() => prefetchRoute(item.href, item.section, item.disabled)}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6]" />
                  )}
                  <span className="flex items-center w-full">
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{t(item.label)}</span>
                    {item.locked ? <Lock className="w-3.5 h-3.5 ml-2 text-zinc-400" /> : null}
                    {item.badge ? (
                      <span className="ml-auto rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                </Button>
              )
            }

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
                onMouseEnter={() => prefetchRoute(item.href, item.section, item.disabled)}
                onFocus={() => prefetchRoute(item.href, item.section, item.disabled)}
                asChild
              >
                <Link href={fullPath} prefetch={false} className="flex items-center relative">
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6]" />
                  )}
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{t(item.label)}</span>
                  {item.locked ? <Lock className="w-3.5 h-3.5 ml-2 text-zinc-400" /> : null}
                  {item.badge ? (
                    <span className="ml-auto rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {item.badge}
                    </span>
                  ) : null}
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
            onMouseEnter={() => prefetchHrefOnce(router, `/${locale}/auth/login`)}
            onFocus={() => prefetchHrefOnce(router, `/${locale}/auth/login`)}
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
