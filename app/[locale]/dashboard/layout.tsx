import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/layout/dashboard-shell'
import { getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'

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

  return <DashboardShell viewerAccess={viewerAccess}>{children}</DashboardShell>
}
