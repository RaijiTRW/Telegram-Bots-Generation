'use server'

import { getServerUser } from '@/lib/supabase/server'
import {
  cancelSubscriptionAtPeriodEnd,
  changeSubscriptionPlan,
  getCurrentSubscriptionWithPendingSync,
  resumeSubscription,
  startCardBindingCheckout,
  startSubscriptionCheckout,
  syncCardBindingForUser,
  syncLatestPendingSubscriptionForUser,
} from '@/lib/billing/service'
import type { BillingCurrency, BillingInterval, PlanCode } from '@/lib/billing/types'

export async function getCurrentSubscriptionAction() {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const subscription = await getCurrentSubscriptionWithPendingSync(user.id)
    return { success: true, subscription } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function syncPendingSubscriptionAction() {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await syncLatestPendingSubscriptionForUser(user.id)
    return { success: true, ...result } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function syncCardBindingAction(transactionId?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await syncCardBindingForUser(user.id, transactionId)
    return { success: true, ...result } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function startSubscriptionCheckoutAction(planCode: PlanCode, currency: BillingCurrency, billingInterval: BillingInterval, locale?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await startSubscriptionCheckout({
      userId: user.id,
      planCode,
      currency,
      billingInterval,
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

export async function changeSubscriptionPlanAction(planCode: PlanCode, currency: BillingCurrency, billingInterval: BillingInterval, locale?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await changeSubscriptionPlan({
      userId: user.id,
      planCode,
      currency,
      billingInterval,
      locale,
    })

    return { success: true, ...result } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function startCardBindingCheckoutAction(locale?: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const result = await startCardBindingCheckout({
      userId: user.id,
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
