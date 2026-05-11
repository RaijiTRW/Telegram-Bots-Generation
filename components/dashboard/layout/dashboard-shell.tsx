'use client'

import { useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardOnboardingTour } from '@/components/onboarding/dashboard-onboarding-tour'
import { VersionUpdateToast } from '@/components/system/version-update-toast'
import { SubscriptionEndedModal } from '@/components/billing/subscription-ended-modal'
import { DashboardSectionViewport, type DashboardSection } from './dashboard-section-viewport'
import type { ViewerAccess } from '@/lib/billing/types'
import type { AppAccessControls } from '@/lib/admin-access/config'

interface DashboardShellProps {
  viewerAccess: ViewerAccess
  accessControls: AppAccessControls
  children: React.ReactNode
}

type PendingDashboardNavigation = {
  section: DashboardSection
  href: string
  sourcePathname: string | null
} | null

type DashboardRouteSection = DashboardSection | 'docs'

const getDashboardSectionFromPathname = (pathname: string | null): DashboardRouteSection => {
  const segments = (pathname || '').split('/').filter(Boolean)
  const section = segments[2]

  switch (section) {
    case undefined:
      return 'home'
    case 'bots':
      return 'bots'
    case 'statistics':
      return 'statistics'
    case 'subscription':
      return 'subscription'
    case 'crm':
      return 'crm'
    case 'admin':
      return 'admin'
    case 'profile':
      return 'profile'
    case 'settings':
      return 'settings'
    case 'docs':
      return 'docs'
    default:
      return 'home'
  }
}

export function DashboardShell({ viewerAccess, accessControls, children }: DashboardShellProps) {
  const pathname = usePathname()
  const isEmbeddedFrame = useSyncExternalStore(
    () => () => {},
    () => window.self !== window.top,
    () => false
  )
  const currentSection = getDashboardSectionFromPathname(pathname)
  const pathSegments = (pathname || '').split('/').filter(Boolean)
  const isDashboardRoot =
    pathSegments.length === 2
    && (pathSegments[1] === 'dashboard' || pathSegments[1] === 'workspace')
  const [pendingNavigation, setPendingNavigation] = useState<PendingDashboardNavigation>(null)
  const [initialSection] = useState<DashboardSection>(currentSection === 'docs' ? 'home' : currentSection)
  const [initialContent] = useState<React.ReactNode | null>(currentSection === 'docs' ? null : children)
  const effectivePendingNavigation =
    pendingNavigation
    && pathname === pendingNavigation.sourcePathname
    && pathname !== pendingNavigation.href
    && currentSection !== 'docs'
      ? pendingNavigation
      : null
  const displayedSection =
    effectivePendingNavigation
      ? effectivePendingNavigation.section
      : currentSection
  const viewportActiveSection = displayedSection === 'docs' ? 'home' : displayedSection
  const isDocsRoute = currentSection === 'docs'

  if (isDocsRoute && isEmbeddedFrame) {
    return (
      <div className="min-h-screen bg-[#05070A] p-4 text-white sm:p-6">
        {children}
      </div>
    )
  }

  if (isDashboardRoot) {
    return (
      <div className="min-h-screen bg-[#05070A]">
        {children}
        <SubscriptionEndedModal viewerAccess={viewerAccess} />
        <VersionUpdateToast />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#05070A]">
      <DashboardNav
        viewerAccess={viewerAccess}
        accessControls={accessControls}
        activeSection={displayedSection}
        onSectionChange={(section, href) => {
          setPendingNavigation({ section, href, sourcePathname: pathname })
        }}
      />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        <main
          data-tour="dashboard-content"
          className="flex-1 min-h-0 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6"
        >
          {isDocsRoute ? (
            children
          ) : (
            <DashboardSectionViewport
              activeSection={viewportActiveSection}
              initialSection={initialSection}
              initialContent={initialContent}
              viewerAccess={viewerAccess}
            />
          )}
        </main>
      </div>
      <DashboardOnboardingTour />
      <SubscriptionEndedModal viewerAccess={viewerAccess} />
      <VersionUpdateToast />
    </div>
  )
}
