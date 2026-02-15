import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard/dashboard-nav'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { getServerUser } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-[#05070A]">
      <DashboardNav />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
