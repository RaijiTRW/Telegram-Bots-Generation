import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { DashboardAdminPageClient } from '@/components/admin/dashboard-admin-page-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createServerClientWrapper } from '@/lib/supabase/server'

export default async function DashboardAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const isRu = locale !== 'en'
  const supabase = await createServerClientWrapper()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              {isRu ? 'Доступ запрещен' : 'Access denied'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300">{isRu ? 'Требуется вход в аккаунт.' : 'Login required.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              {isRu ? 'Доступ запрещен' : 'Access denied'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>{isRu ? 'Только администратор может открыть admin-панель.' : 'Only admins can open the admin panel.'}</p>
            <Button asChild variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-200">
              <Link href={`/${locale}/dashboard`}>{isRu ? 'Назад в дэшборд' : 'Back to dashboard'}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <DashboardAdminPageClient />
}
