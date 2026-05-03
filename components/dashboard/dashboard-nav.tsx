'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Home, User, Settings, LogOut, Bot, BookOpen, Shield, Users, FileText, Lock, BarChart3, CreditCard, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from '@/components/motion-wrapper'
import type { ViewerAccess } from '@/lib/billing/types'
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

const mobileGlassFilter = 'url("#dashboard-liquid-glass-noise") blur(2px) saturate(1.5) contrast(1.06) brightness(1.08)'
const mobileGlassShellWidth = 208

const mobileGlassShellStyle: CSSProperties = {
  width: mobileGlassShellWidth,
  height: 60,
  borderRadius: 28,
  backgroundColor: 'rgba(255, 255, 255, 0)',
  backdropFilter: mobileGlassFilter,
  WebkitBackdropFilter: mobileGlassFilter,
  boxShadow:
    'inset 0 0 17px -4px #000000, inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(255,255,255,0.08), 0 18px 42px rgba(0,0,0,0.28)',
}

const mobileGlassActiveStyle: CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.075)',
  backdropFilter: mobileGlassFilter,
  WebkitBackdropFilter: mobileGlassFilter,
  boxShadow:
    'inset 0 0 17px -4px #000000, inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.06)',
}

const mobileGlassSheetStyle: CSSProperties = {
  backgroundColor: 'rgba(7, 10, 16, 0.34)',
  backdropFilter: 'blur(18px) saturate(1.55) contrast(1.05) brightness(1.04)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.55) contrast(1.05) brightness(1.04)',
  boxShadow:
    'inset 0 0 17px -4px #000000, inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.08), 0 22px 58px rgba(0,0,0,0.38)',
}

const mobileGlassSlots = 4
const mobileGlassItemWidth = 41
const mobileGlassGap = 10
const mobileGlassLensSize = 48
const mobileGlassLensVisualOffsetX = -1
const mobileGlassContentWidth = mobileGlassItemWidth * mobileGlassSlots + mobileGlassGap * (mobileGlassSlots - 1)
const mobileGlassEdge = (mobileGlassShellWidth - mobileGlassContentWidth) / 2
const mobileGlassStep = mobileGlassItemWidth + mobileGlassGap
const mobileGlassLensMinX = mobileGlassEdge + (mobileGlassItemWidth - mobileGlassLensSize) / 2
const mobileGlassLensMaxX = mobileGlassLensMinX + mobileGlassStep * (mobileGlassSlots - 1)
const getMobileGlassLensX = (index: number) =>
  mobileGlassLensMinX + mobileGlassLensVisualOffsetX + Math.max(0, Math.min(mobileGlassSlots - 1, index)) * mobileGlassStep
const clampMobileGlassX = (x: number) => Math.max(mobileGlassLensMinX, Math.min(mobileGlassLensMaxX, x))
const mobilePrimarySections: DashboardSection[] = ['home', 'bots', 'statistics']

export function DashboardNav({
  viewerAccess,
  accessControls,
  activeSection = null,
  onSectionChange,
}: DashboardNavProps) {
  const t = useTranslations()
  const pathname = usePathname()
  const isAdmin = viewerAccess.isAdmin
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileLensDragX, setMobileLensDragX] = useState<number | null>(null)
  const [mobileLensLifted, setMobileLensLifted] = useState(false)
  const [optimisticMobileGlassIndex, setOptimisticMobileGlassIndex] = useState<number | null>(null)
  const mobileGestureRef = useRef<{ pointerId: number; moved: boolean; startX: number } | null>(null)
  const suppressMobileClickRef = useRef(false)
  const mobileLensSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileScrollUnlockRef = useRef<(() => void) | null>(null)

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
    setMobileMenuOpen(false)
    setOptimisticMobileGlassIndex(null)
  }, [pathname, activeSection])

  useEffect(() => {
    return () => {
      if (mobileLensSettleTimeoutRef.current) {
        clearTimeout(mobileLensSettleTimeoutRef.current)
      }
      mobileScrollUnlockRef.current?.()
      mobileScrollUnlockRef.current = null
    }
  }, [])

  const getFullPath = (item: DashboardNavItem) =>
    item.localeAgnostic ? item.href : `/${locale}${item.href}`

  const isItemActive = (item: DashboardNavItem) => {
    const fullPath = getFullPath(item)
    const pathMatches =
      pathname === fullPath || (item.href !== '/dashboard' && pathname?.startsWith(fullPath + '/'))

    return item.section
      ? activeSection ? activeSection === item.section : pathMatches
      : pathMatches
  }

  const prefetchRoute = (href: string, section?: DashboardSection, disabled?: boolean) => {
    if (disabled) {
      return
    }
    if (section) {
      void preloadDashboardSection(section)
      return
    }
  }

  const handleSectionNavigation = (href: string, section: DashboardSection) => {
    const fullHref = `/${locale}${href}`
    onSectionChange?.(section, fullHref)
    prefetchRoute(href, section)
  }

  const navigateToItem = (item: DashboardNavItem) => {
    if (item.disabled) {
      return
    }
    setMobileMenuOpen(false)
    if (item.section) {
      handleSectionNavigation(item.href, item.section)
      return
    }
    const fullPath = getFullPath(item)
    window.location.assign(fullPath)
  }

  const mobilePrimaryItems = navItems.filter(
    (item) => item.section && mobilePrimarySections.includes(item.section)
  )
  const mobileOverflowItems = navItems.filter(
    (item) => !item.section || !mobilePrimarySections.includes(item.section)
  )
  const isOverflowActive = mobileOverflowItems.some(isItemActive)

  const activePrimaryMobileIndex = mobilePrimaryItems.findIndex(isItemActive)
  const resolvedMobileGlassIndex =
    mobileMenuOpen || isOverflowActive ? 3 : activePrimaryMobileIndex >= 0 ? activePrimaryMobileIndex : 0
  const activeMobileGlassIndex = optimisticMobileGlassIndex ?? resolvedMobileGlassIndex
  const mobileLensX = mobileLensDragX ?? getMobileGlassLensX(activeMobileGlassIndex)

  const setOptimisticMobileIndex = (index: number) => {
    setOptimisticMobileGlassIndex(index)
    setMobileLensDragX(getMobileGlassLensX(index))
  }

  const liftMobileLensBriefly = () => {
    setMobileLensLifted(true)
    if (mobileLensSettleTimeoutRef.current) {
      clearTimeout(mobileLensSettleTimeoutRef.current)
    }
    mobileLensSettleTimeoutRef.current = setTimeout(() => {
      setMobileLensLifted(false)
      setMobileLensDragX(null)
      mobileLensSettleTimeoutRef.current = null
    }, 260)
  }

  const getMobileGlassIndexFromX = (x: number) =>
    Math.max(0, Math.min(mobileGlassSlots - 1, Math.round((x - mobileGlassLensMinX) / mobileGlassStep)))

  const lockMobilePageScroll = () => {
    if (mobileScrollUnlockRef.current || typeof document === 'undefined') {
      return
    }

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverscroll = html.style.overscrollBehavior
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousBodyTouchAction = body.style.touchAction
    const preventPageGesture = (nativeEvent: Event) => {
      nativeEvent.preventDefault()
    }
    const listenerOptions: AddEventListenerOptions = { capture: true, passive: false }

    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    body.style.touchAction = 'none'
    document.addEventListener('touchmove', preventPageGesture, listenerOptions)
    document.addEventListener('wheel', preventPageGesture, listenerOptions)

    mobileScrollUnlockRef.current = () => {
      html.style.overscrollBehavior = previousHtmlOverscroll
      body.style.overscrollBehavior = previousBodyOverscroll
      body.style.touchAction = previousBodyTouchAction
      document.removeEventListener('touchmove', preventPageGesture, listenerOptions)
      document.removeEventListener('wheel', preventPageGesture, listenerOptions)
    }
  }

  const unlockMobilePageScroll = () => {
    mobileScrollUnlockRef.current?.()
    mobileScrollUnlockRef.current = null
  }

  const handleMobileGlassPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    event.preventDefault()
    lockMobilePageScroll()
    mobileGestureRef.current = { pointerId: event.pointerId, moved: false, startX: event.clientX }
    setMobileLensDragX(getMobileGlassLensX(activeMobileGlassIndex))
    setMobileLensLifted(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMobileGlassPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = mobileGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextX = clampMobileGlassX(event.clientX - bounds.left - mobileGlassLensSize / 2)
    if (Math.abs(event.clientX - gesture.startX) > 8) {
      gesture.moved = true
    }
    if (gesture.moved) {
      setMobileLensDragX(nextX)
    }
  }

  const completeMobileGlassGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = mobileGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return
    }
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const finalX = clampMobileGlassX(event.clientX - bounds.left - mobileGlassLensSize / 2)
    const targetIndex = getMobileGlassIndexFromX(finalX)
    suppressMobileClickRef.current = true
    mobileGestureRef.current = null
    unlockMobilePageScroll()
    setOptimisticMobileIndex(targetIndex)
    liftMobileLensBriefly()
    window.setTimeout(() => {
      suppressMobileClickRef.current = false
    }, 0)

    if (targetIndex === 3) {
      setMobileMenuOpen((value) => !value)
      return
    }

    const targetItem = mobilePrimaryItems[targetIndex]
    if (targetItem) {
      navigateToItem(targetItem)
    }
  }

  const cancelMobileGlassGesture = (event?: ReactPointerEvent<HTMLElement>) => {
    const gesture = mobileGestureRef.current
    if (event && (!gesture || gesture.pointerId !== event.pointerId)) {
      return
    }
    event?.preventDefault()
    mobileGestureRef.current = null
    setMobileLensDragX(null)
    setMobileLensLifted(false)
    unlockMobilePageScroll()
  }

  const handleMobileGlassButtonClick = (item: DashboardNavItem) => {
    if (suppressMobileClickRef.current) {
      return
    }
    const targetIndex = mobilePrimaryItems.findIndex((primaryItem) => primaryItem.href === item.href)
    if (targetIndex >= 0) {
      setOptimisticMobileIndex(targetIndex)
    }
    liftMobileLensBriefly()
    navigateToItem(item)
  }

  const handleMobileGlassMenuClick = () => {
    if (suppressMobileClickRef.current) {
      return
    }
    setOptimisticMobileIndex(3)
    liftMobileLensBriefly()
    setMobileMenuOpen((value) => !value)
  }

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign(`/${locale}/auth/login`)
  }

  return (
    <>
      <aside
        data-tour="dashboard-nav"
        className="hidden w-64 h-screen overflow-hidden p-4 lg:flex flex-col relative"
      >
        {/* Glassmorphism background */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 to-zinc-900/60 backdrop-blur-xl border-r border-white/10" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const fullPath = getFullPath(item)
              const isActive = isItemActive(item)

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
                  asChild
                >
                  <a href={fullPath} className="flex items-center relative">
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

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:hidden">
        <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
          <filter id="dashboard-liquid-glass-noise" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.01"
              numOctaves="3"
              seed="49"
              result="noise"
            />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="49" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(8px)' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto absolute bottom-[78px] w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-[26px] border border-white/15 bg-white/0 p-2"
            style={mobileGlassSheetStyle}
          >
            <div className="relative grid gap-1">
              {mobileOverflowItems.map((item) => {
                const Icon = item.icon
                const isActive = isItemActive(item)

                return (
                  <button
                    key={item.href}
                    type="button"
                    disabled={item.disabled}
                    className={cn(
                      'flex h-12 items-center rounded-[18px] px-3 text-left text-sm transition duration-200 active:scale-[0.98]',
                      isActive
                        ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-sky-300/28'
                        : 'text-zinc-300 hover:bg-white/[0.07] hover:text-white',
                      item.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-zinc-300'
                    )}
                    onClick={() => {
                      setOptimisticMobileIndex(3)
                      navigateToItem(item)
                    }}
                  >
                    <Icon className="mr-3 h-5 w-5 text-sky-300" />
                    <span className="min-w-0 flex-1 truncate font-medium">{t(item.label)}</span>
                    {item.locked ? <Lock className="ml-2 h-3.5 w-3.5 text-zinc-500" /> : null}
                    {item.badge ? (
                      <span className="ml-2 rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              <button
                type="button"
                className="flex h-12 items-center rounded-[18px] px-3 text-left text-sm text-red-200/90 transition hover:bg-red-500/10 hover:text-red-100"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5" />
                <span className="font-medium">{t('dashboard.nav.logout')}</span>
              </button>
            </div>
          </motion.div>
        ) : null}

        <nav
          className="pointer-events-auto relative isolate flex items-center justify-center gap-2.5 overflow-hidden border border-white/20 bg-white/0 p-1 text-white/80 transition-transform duration-200 ease-out active:scale-[0.985]"
          style={{
            ...mobileGlassShellStyle,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          aria-label={t('dashboard.nav.home')}
          onPointerDown={handleMobileGlassPointerDown}
          onPointerMove={handleMobileGlassPointerMove}
          onPointerUp={completeMobileGlassGesture}
          onPointerCancel={cancelMobileGlassGesture}
          onLostPointerCapture={cancelMobileGlassGesture}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-[6px] z-10 h-12 w-12 rounded-full border border-white/20"
            style={mobileGlassActiveStyle}
            animate={{
              x: mobileLensX,
              y: 0,
              scale: mobileLensLifted ? 1.18 : 1,
            }}
            transition={{
              type: 'spring',
              stiffness: mobileLensLifted ? 560 : 680,
              damping: mobileLensLifted ? 34 : 46,
              mass: 0.56,
            }}
          />
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon
            const isActive = isItemActive(item)

            return (
              <button
                key={item.href}
                type="button"
                disabled={item.disabled}
                aria-label={t(item.label)}
                className={cn(
                  'relative z-10 grid h-11 w-[41px] place-items-center rounded-full text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.34)] transition-[transform,color,opacity] duration-200 ease-out active:scale-[0.88] active:opacity-85',
                  isActive && 'text-white',
                  !isActive && !item.disabled && 'hover:text-white',
                  item.disabled && 'cursor-not-allowed opacity-40'
                )}
                onClick={() => handleMobileGlassButtonClick(item)}
              >
                <Icon className="relative h-5 w-5" />
              </button>
            )
          })}
          <button
            type="button"
            aria-label="Открыть остальные разделы"
            aria-expanded={mobileMenuOpen}
            className={cn(
              'relative z-10 grid h-11 w-[41px] place-items-center rounded-full text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.34)] transition-[transform,color,opacity] duration-200 ease-out hover:text-white active:scale-[0.88] active:opacity-85',
              (mobileMenuOpen || isOverflowActive) && 'text-white'
            )}
            onClick={handleMobileGlassMenuClick}
          >
            <Menu className="relative h-5 w-5" />
          </button>
        </nav>
      </div>
    </>
  )
}
