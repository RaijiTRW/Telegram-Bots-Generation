import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  const viewerAccess = await getViewerAccess(user.id)

  return (
    <div className="flex h-screen overflow-hidden bg-[#05070A]">
      <DashboardNav viewerAccess={viewerAccess} />
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardHeader />
        <main className="flex-1 min-h-0 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
