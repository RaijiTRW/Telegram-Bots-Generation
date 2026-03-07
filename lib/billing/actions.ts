'use server'

import { getServerUser } from '@/lib/supabase/server'
import { cancelSubscriptionAtPeriodEnd, changeSubscriptionPlan, getCurrentSubscription, resumeSubscription, startSubscriptionCheckout } from '@/lib/billing/service'
import type { BillingCurrency, PlanCode } from '@/lib/billing/types'

export async function getCurrentSubscriptionAction() {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const subscription = await getCurrentSubscription(user.id)
    return { success: true, subscription } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function startSubscriptionCheckoutAction(planCode: PlanCode, currency: BillingCurrency, locale?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await startSubscriptionCheckout({
      userId: user.id,
      planCode,
      currency,
      locale,
    })

    return {
      success: true,
      confirmationUrl: result.confirmationUrl,
      transactionId: result.transactionId,
    } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function changeSubscriptionPlanAction(planCode: PlanCode, currency: BillingCurrency, locale?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await changeSubscriptionPlan({
      userId: user.id,
      planCode,
      currency,
      locale,
    })

    return { success: true, ...result } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function cancelSubscriptionAtPeriodEndAction() {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const subscription = await cancelSubscriptionAtPeriodEnd(user.id)
    return { success: true, subscription } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function resumeSubscriptionAction() {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const subscription = await resumeSubscription(user.id)
    return { success: true, subscription } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}
