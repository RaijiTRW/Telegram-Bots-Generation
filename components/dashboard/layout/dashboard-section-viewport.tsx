'use client'

import { Loader2 } from 'lucide-react'
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import type { ViewerAccess } from '@/lib/billing/types'

export type DashboardSection =
  | 'home'
  | 'bots'
  | 'statistics'
  | 'subscription'
  | 'crm'
  | 'admin'
  | 'profile'
  | 'settings'

type DashboardSectionComponent = ComponentType
type DashboardSectionModule = { default: DashboardSectionComponent }

interface DashboardSectionViewportProps {
  activeSection: DashboardSection
  initialSection: DashboardSection
  initialContent: ReactNode | null
  viewerAccess: ViewerAccess
  className?: string
}

const DASHBOARD_WARM_ORDER: DashboardSection[] = [
  'home',
  'bots',
  'statistics',
  'subscription',
  'profile',
  'settings',
  'crm',
  'admin',
]

const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  home: 'Dashboard',
  bots: 'Bots',
  statistics: 'Statistics',
  subscription: 'Subscription',
  crm: 'CRM',
  admin: 'Admin',
  profile: 'Profile',
  settings: 'Settings',
}

const dashboardSectionLoaders: Record<DashboardSection, () => Promise<DashboardSectionModule>> = {
  home: () => import('@/components/dashboard/screens/home-screen'),
  bots: () => import('@/components/dashboard/screens/bots-screen'),
  statistics: () => import('@/components/dashboard/screens/statistics-screen'),
  subscription: () => import('@/components/dashboard/screens/subscription-screen'),
  crm: () => import('@/components/dashboard/screens/crm-screen'),
  admin: () => import('@/components/dashboard/screens/admin-screen'),
  profile: () => import('@/components/dashboard/screens/profile-screen'),
  settings: () => import('@/components/dashboard/screens/settings-screen'),
}

const dashboardSectionComponentCache = new Map<DashboardSection, DashboardSectionComponent>()
const dashboardSectionPromiseCache = new Map<DashboardSection, Promise<DashboardSectionComponent>>()

function readCachedDashboardSection(section: DashboardSection) {
  return dashboardSectionComponentCache.get(section) ?? null
}

function canWarmSection(section: DashboardSection, viewerAccess: ViewerAccess) {
  if (section === 'admin' || section === 'crm') {
    return viewerAccess.isAdmin
  }

  return true
}

export function preloadDashboardSection(section: DashboardSection): Promise<DashboardSectionComponent> {
  const cached = dashboardSectionComponentCache.get(section)
  if (cached) {
    return Promise.resolve(cached)
  }

  const existingPromise = dashboardSectionPromiseCache.get(section)
  if (existingPromise) {
    return existingPromise
  }

  const promise = dashboardSectionLoaders[section]().then((module) => {
    dashboardSectionComponentCache.set(section, module.default)
    dashboardSectionPromiseCache.delete(section)
    return module.default
  })

  dashboardSectionPromiseCache.set(section, promise)
  return promise
}

function DashboardSectionFallback({ section }: { section: DashboardSection }) {
  return (
    <div className="h-full w-full bg-[#05070A] flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
        <span>{DASHBOARD_SECTION_LABELS[section]}</span>
      </div>
    </div>
  )
}

export function DashboardSectionViewport({
  activeSection,
  initialSection,
  initialContent,
  viewerAccess,
  className,
}: DashboardSectionViewportProps) {
  const [stableInitialContent] = useState(initialContent)
  const hasStableInitialContent = stableInitialContent !== null
  const [mountedSections, rememberMountedSection] = useReducer(
    (state: DashboardSection[], section: DashboardSection) => (
      state.includes(section)
        ? state
        : [...state, section]
    ),
    [initialSection]
  )
  const [loadedSections, setLoadedSections] = useState<Partial<Record<DashboardSection, DashboardSectionComponent>>>(() => {
    const nextState: Partial<Record<DashboardSection, DashboardSectionComponent>> = {}
    for (const section of DASHBOARD_WARM_ORDER) {
      const cached = readCachedDashboardSection(section)
      if (cached) {
        nextState[section] = cached
      }
    }
    return nextState
  })

  const loadSection = useCallback(async (section: DashboardSection) => {
    if (!canWarmSection(section, viewerAccess)) {
      return
    }

    if (section === initialSection) {
      rememberMountedSection(section)
      return
    }

    const cached = readCachedDashboardSection(section)
    if (cached) {
      rememberMountedSection(section)
      setLoadedSections((prev) => (prev[section] ? prev : { ...prev, [section]: cached }))
      return
    }

    const LoadedSection = await preloadDashboardSection(section)
    rememberMountedSection(section)
    setLoadedSections((prev) => (prev[section] ? prev : { ...prev, [section]: LoadedSection }))
  }, [initialSection, viewerAccess])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      rememberMountedSection(activeSection)
      void loadSection(activeSection)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeSection, loadSection])

  return (
    <div className={cn('h-full w-full min-w-0', className)}>
      {mountedSections.map((section) => {
        const isActive = section === activeSection
        const LoadedSection = loadedSections[section]
        const content =
          section === initialSection && hasStableInitialContent
            ? stableInitialContent
            : LoadedSection
            ? <LoadedSection />
            : <DashboardSectionFallback section={section} />

        return (
          <div
            key={section}
            aria-hidden={!isActive}
            className={cn('h-full w-full min-w-0', isActive ? 'block' : 'hidden')}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
