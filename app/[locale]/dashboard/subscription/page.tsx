import { redirect } from 'next/navigation'
import SubscriptionScreen from '@/components/dashboard/screens/subscription-screen'
import { getViewerAccess } from '@/lib/billing/server'
import { getServerUser } from '@/lib/supabase/server'

export default async function DashboardSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const subscription = await getViewerAccess(user.id)

  return <SubscriptionScreen initialSubscription={subscription} />
}
