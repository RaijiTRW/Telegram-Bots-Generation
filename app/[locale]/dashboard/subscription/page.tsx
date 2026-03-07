import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'
import { SubscriptionPageClient } from '@/components/billing/subscription-page-client'

export default async function DashboardSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { locale } = await params
  const subscription = await getViewerAccess(user.id)

  return <SubscriptionPageClient locale={locale} initialSubscription={subscription} />
}
