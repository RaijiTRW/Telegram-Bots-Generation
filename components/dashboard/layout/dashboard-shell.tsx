'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
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
  const currentSection = getDashboardSectionFromPathname(pathname)
  const [pendingNavigation, setPendingNavigation] = useState<PendingDashboardNavigation>(null)
  const [initialSection] = useState<DashboardSection>(currentSection === 'docs' ? 'home' : currentSection)
  const [initialContent] = useState<React.ReactNode | null>(currentSection === 'docs' ? null : children)
  const effectivePendingNavigation =
    pendingNavigation && pathname !== pendingNavigation.href && currentSection !== 'docs'
      ? pendingNavigation
      : null
  const displayedSection =
    effectivePendingNavigation
      ? effectivePendingNavigation.section
      : currentSection
  const viewportActiveSection = displayedSection === 'docs' ? 'home' : displayedSection
  const isDocsRoute = currentSection === 'docs'

  return (
    <div className="flex h-screen overflow-hidden bg-[#05070A]">
      <DashboardNav
        viewerAccess={viewerAccess}
        accessControls={accessControls}
        activeSection={displayedSection}
        onSectionChange={(section, href) => {
          setPendingNavigation({ section, href })
        }}
      />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
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
    </div>
  )
}
