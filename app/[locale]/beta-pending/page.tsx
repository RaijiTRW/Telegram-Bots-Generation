import { redirect } from 'next/navigation'
import { BetaPendingPage } from '@/components/auth/beta-pending-page'
import { getServerUser } from '@/lib/supabase/server'
import { getCurrentProfileAccessStatus } from '@/lib/profile-access'

export default async function BetaPendingRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const status = await getCurrentProfileAccessStatus(user.id)
  if (status === 'active') {
    redirect(`/${locale}/dashboard`)
  }

  return <BetaPendingPage locale={locale} status={status} />
}
