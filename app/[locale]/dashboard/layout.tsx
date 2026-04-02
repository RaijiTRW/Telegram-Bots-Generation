import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/layout/dashboard-shell'
import { getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'
import { getAppAccessControls } from '@/lib/admin-access/server'
import { buildNoIndexMetadata } from '@/lib/site/seo'

export const metadata = buildNoIndexMetadata(
  'CBTooll Dashboard',
  'Private dashboard for managing bots, analytics, and subscription settings.'
)

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

  const viewerAccess = await getViewerAccess(user.id)
  const accessControls = await getAppAccessControls()

  return (
    <DashboardShell viewerAccess={viewerAccess} accessControls={accessControls}>
      {children}
    </DashboardShell>
  )
}
