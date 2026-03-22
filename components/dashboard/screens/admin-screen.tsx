'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Loader2, ShieldAlert } from 'lucide-react'
import { DashboardAdminPageClient } from '@/components/admin/dashboard-admin-page-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type AccessState = 'checking' | 'granted' | 'denied'

export default function AdminScreen() {
  const locale = useLocale()
  const isRu = locale !== 'en'
  const [accessState, setAccessState] = useState<AccessState>('checking')

  useEffect(() => {
    let isMounted = true

    const verifyAccess = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (!user) {
        setAccessState('denied')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      setAccessState(profile?.role === 'admin' ? 'granted' : 'denied')
    }

    void verifyAccess()

    return () => {
      isMounted = false
    }
  }, [])

  if (accessState === 'granted') {
    return <DashboardAdminPageClient />
  }

  if (accessState === 'checking') {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
          <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
          <span>{isRu ? 'Проверка доступа...' : 'Checking access...'}</span>
        </div>
      </div>
    )
  }

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
