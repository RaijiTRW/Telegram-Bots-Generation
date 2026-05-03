import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/layout/dashboard-shell'
import { getServerUser } from '@/lib/supabase/server'
import { buildFallbackViewerAccess, getViewerAccess } from '@/lib/billing/server'
import { getAppAccessControls } from '@/lib/admin-access/server'
import { createDefaultAppAccessControls } from '@/lib/admin-access/config'
import { buildNoIndexMetadata } from '@/lib/site/seo'

export const metadata = buildNoIndexMetadata(
  'CBTooll Dashboard',
  'Private dashboard for managing bots, analytics, and subscription settings.'
)

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getServerUser()
  
  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const [viewerAccess, accessControls] = await Promise.all([
    withTimeout(getViewerAccess(user.id), 4500, buildFallbackViewerAccess()),
    withTimeout(getAppAccessControls(), 2500, createDefaultAppAccessControls()),
  ])

  return (
    <DashboardShell viewerAccess={viewerAccess} accessControls={accessControls}>
      {children}
    </DashboardShell>
  )
}
