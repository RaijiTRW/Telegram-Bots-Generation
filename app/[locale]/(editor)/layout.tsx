import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase/server'

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login')
  }

  // This layout does NOT include DashboardNav and DashboardHeader
  // The editor has its own navigation
  return (
    <div className="min-h-screen bg-[#05070A]">
      {children}
    </div>
  )
}
