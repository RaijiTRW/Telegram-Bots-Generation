import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase/server'

export default async function EditorLayout({
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

  // This layout does NOT include DashboardNav and DashboardHeader
  // The editor has its own navigation
  return (
    <div className="min-h-screen bg-[#05070A]">
      {children}
    </div>
  )
}
