import 'server-only'

import { resolveAppBaseUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAvailableBillingCurrencies,
  getCurrentSubscriptionRow,
  getNextPeriodRange,
  getViewerAccess,
  mergeJson,
  subscriptionPriceFor,
} from '@/lib/billing/server'
import type {
  BillingCurrency,
  PlanCode,
  SubscriptionSummary,
  SubscriptionTransactionKind,
  SubscriptionTransactionStatus,
} from '@/lib/billing/types'
import {
  chargeSavedYooKassaPaymentMethod,
  createYooKassaSubscriptionCheckout,
  getYooKassaPayment,
} from '@/lib/billing/yookassa'

const PENDING_SUBSCRIPTION_STATUSES = new Set(['pending', 'waiting_for_capture'])
const SUCCESS_SUBSCRIPTION_STATUSES = new Set(['succeeded'])
const FAILED_SUBSCRIPTION_STATUSES = new Set(['canceled', 'cancelled', 'failed'])

function normalizePlanCode(value: string): PlanCode {
  if (value === 'business' || value === 'enterprise') return value
  return 'base'
}

function normalizeBillingCurrency(value: string): BillingCurrency {
  return value.toUpperCase() === 'USD' ? 'USD' : 'RUB'
}

function ensureSupportedCurrency(currency: BillingCurrency) {
  if (!getAvailableBillingCurrencies().includes(currency)) {
    throw new Error(`Currency ${currency} is not enabled for subscriptions`)
  }
}

function classifyPaymentStatus(value: unknown): SubscriptionTransactionStatus {
  const normalized = String(value || '').trim().toLowerCase()
  if (SUCCESS_SUBSCRIPTION_STATUSES.has(normalized)) return 'succeeded'
  if (FAILED_SUBSCRIPTION_STATUSES.has(normalized)) return 'failed'
  if (PENDING_SUBSCRIPTION_STATUSES.has(normalized)) return 'pending'
  return 'pending'
}

async function insertTransaction(input: {
  userId: string
  planCode: PlanCode
  kind: SubscriptionTransactionKind
  amount: number
  currency: BillingCurrency
  returnUrl?: string | null
}) {
  const admin = createAdminClient()
  const result = await admin
    .from('subscription_transactions')
    .insert({
      user_id: input.userId,
      plan_code: input.planCode,
      kind: input.kind,
      status: 'pending',
      amount: input.amount,
      currency: input.currency,
      billing_provider: 'yookassa',
      return_url: input.returnUrl || null,
      payload: {},
    })
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to create subscription transaction: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

async function updateTransaction(
  transactionId: string,
  patch: Record<string, unknown>
) {
  const admin = createAdminClient()
  const result = await admin
    .from('subscription_transactions')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to update subscription transaction: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

async function activatePaidSubscription(input: {
  userId: string
  planCode: PlanCode
  currency: BillingCurrency
  amount: number
  providerPaymentId: string
  providerPaymentMethodId: string | null
  payload: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(input.userId)
  const period = getNextPeriodRange()

  const result = await admin
    .from('user_subscriptions')
    .update({
      plan_code: input.planCode,
      status: 'active',
      currency: input.currency,
      billing_provider: 'yookassa',
      price_amount: input.amount,
      started_at: current.plan_code === 'base' ? period.currentPeriodStart : (current.started_at || period.currentPeriodStart),
      current_period_start: period.currentPeriodStart,
      current_period_end: period.currentPeriodEnd,
      cancel_at_period_end: false,
      canceled_at: null,
      past_due_at: null,
      provider_payment_method_id: input.providerPaymentMethodId,
      provider_last_payment_id: input.providerPaymentId,
      provider_metadata: mergeJson(current.provider_metadata, {
        lastPaymentStatus: 'succeeded',
        lastPaymentId: input.providerPaymentId,
        lastSyncedAt: new Date().toISOString(),
        lastPayload: input.payload,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to activate subscription: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

async function downgradeToBaseNow(userId: string) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(userId)
  const result = await admin
    .from('user_subscriptions')
    .update({
      plan_code: 'base',
      status: 'active',
      currency: 'RUB',
      billing_provider: 'yookassa',
      price_amount: 0,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      canceled_at: new Date().toISOString(),
      past_due_at: null,
      provider_customer_id: null,
      provider_payment_method_id: null,
      provider_last_payment_id: null,
      provider_metadata: mergeJson(current.provider_metadata, {
        lastDowngradedAt: new Date().toISOString(),
        downgradedFromPlan: current.plan_code,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to downgrade subscription: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

async function setSubscriptionPastDue(userId: string, reason: string, paymentId?: string | null) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(userId)
  const result = await admin
    .from('user_subscriptions')
    .update({
      status: 'past_due',
      past_due_at: new Date().toISOString(),
      provider_last_payment_id: paymentId || current.provider_last_payment_id,
      provider_metadata: mergeJson(current.provider_metadata, {
        lastPaymentStatus: 'failed',
        lastFailureReason: reason,
        lastSyncedAt: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to mark subscription past_due: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

export async function getCurrentSubscription(userId: string): Promise<SubscriptionSummary> {
  return getViewerAccess(userId)
}

export async function startSubscriptionCheckout(input: {
  userId: string
  planCode: PlanCode
  currency: BillingCurrency
  locale?: string
}) {
  if (input.planCode === 'base') {
    throw new Error('Base plan does not require checkout')
  }

  ensureSupportedCurrency(input.currency)

  const access = await getViewerAccess(input.userId)
  if (!access.isAdmin && access.planCode === input.planCode && access.status === 'active' && !access.cancelAtPeriodEnd) {
    throw new Error('Selected plan is already active')
  }

  if (access.pendingTransaction && access.pendingTransaction.planCode === input.planCode && access.pendingTransaction.confirmationUrl) {
    return {
      confirmationUrl: access.pendingTransaction.confirmationUrl,
      transactionId: access.pendingTransaction.id,
    }
  }

  const amount = subscriptionPriceFor(input.planCode, input.currency)
  const baseUrl = await resolveAppBaseUrl()
  const locale = input.locale || 'ru'
  const returnUrl = `${baseUrl}/${locale}/payment/return?source=subscription&plan=${input.planCode}`
  const kind: SubscriptionTransactionKind = access.planCode === 'base' ? 'initial' : 'change'
  const transaction = await insertTransaction({
    userId: input.userId,
    planCode: input.planCode,
    kind,
    amount,
    currency: input.currency,
    returnUrl,
  })

  const checkout = await createYooKassaSubscriptionCheckout({
    amount,
    currency: input.currency,
    returnUrl,
    planCode: input.planCode,
    userId: input.userId,
    transactionId: transaction.id,
    locale,
  })

  await updateTransaction(transaction.id, {
    provider_payment_id: checkout.paymentId || null,
    provider_payment_method_id: checkout.paymentMethodId || null,
    provider_idempotence_key: checkout.idempotenceKey,
    confirmation_url: checkout.confirmationUrl || null,
    payload: checkout.raw,
    status: classifyPaymentStatus(checkout.status),
  })

  if (!checkout.confirmationUrl) {
    throw new Error('YooKassa did not return confirmation_url')
  }

  return {
    confirmationUrl: checkout.confirmationUrl,
    transactionId: transaction.id,
  }
}

export async function changeSubscriptionPlan(input: {
  userId: string
  planCode: PlanCode
  currency: BillingCurrency
  locale?: string
}) {
  if (input.planCode === 'base') {
    await downgradeToBaseNow(input.userId)
    return {
      mode: 'immediate' as const,
      confirmationUrl: null,
    }
  }

  const checkout = await startSubscriptionCheckout(input)
  return {
    mode: 'checkout' as const,
    confirmationUrl: checkout.confirmationUrl,
  }
}

export async function cancelSubscriptionAtPeriodEnd(userId: string) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(userId)
  if (current.plan_code === 'base') {
    throw new Error('Base plan cannot be canceled')
  }

  const result = await admin
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to cancel subscription: ${result.error?.message || 'unknown error'}`)
  }

  return getViewerAccess(userId)
}

export async function resumeSubscription(userId: string) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(userId)
  if (current.plan_code === 'base') {
    throw new Error('Base plan does not require resume')
  }

  const result = await admin
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to resume subscription: ${result.error?.message || 'unknown error'}`)
  }

  return getViewerAccess(userId)
}

async function findTransactionForWebhook(paymentId: string, transactionIdHint: string | null) {
  const admin = createAdminClient()
  if (transactionIdHint) {
    const byId = await admin
      .from('subscription_transactions')
      .select('*')
      .eq('id', transactionIdHint)
      .maybeSingle()
    if (!byId.error && byId.data) {
      return byId.data
    }
  }

  const byPayment = await admin
    .from('subscription_transactions')
    .select('*')
    .eq('provider_payment_id', paymentId)
    .maybeSingle()

  if (byPayment.error) {
    throw new Error(`Failed to load transaction by provider_payment_id: ${byPayment.error.message}`)
  }

  return byPayment.data
}

export async function syncSubscriptionFromWebhook(payload: Record<string, unknown>) {
  const objectRecord = payload.object && typeof payload.object === 'object'
    ? (payload.object as Record<string, unknown>)
    : null
  const paymentId = String(objectRecord?.id || '').trim()

  if (!paymentId) {
    throw new Error('Webhook payload does not contain payment id')
  }

  const payment = await getYooKassaPayment(paymentId)
  const metadata = payment.metadata && typeof payment.metadata === 'object'
    ? (payment.metadata as Record<string, unknown>)
    : {}
  const paymentMethod = payment.payment_method && typeof payment.payment_method === 'object'
    ? (payment.payment_method as Record<string, unknown>)
    : {}
  const transaction = await findTransactionForWebhook(paymentId, String(metadata.transactionId || '').trim() || null)

  if (!transaction) {
    throw new Error(`Subscription transaction not found for payment ${paymentId}`)
  }

  const txStatus = classifyPaymentStatus(payment.status)
  const amountRecord = payment.amount && typeof payment.amount === 'object'
    ? (payment.amount as Record<string, unknown>)
    : {}
  const amount = Number(amountRecord.value || transaction.amount || 0)
  const currency = normalizeBillingCurrency(String(amountRecord.currency || transaction.currency || 'RUB'))

  await updateTransaction(transaction.id, {
    status: txStatus,
    provider_payment_id: paymentId,
    provider_payment_method_id: String(paymentMethod.id || transaction.provider_payment_method_id || '') || null,
    payload: payment,
    failure_reason: txStatus === 'failed' ? String(payment.cancellation_details || payment.status || 'payment_failed') : null,
    succeeded_at: txStatus === 'succeeded' ? new Date().toISOString() : transaction.succeeded_at,
    failed_at: txStatus === 'failed' ? new Date().toISOString() : transaction.failed_at,
  })

  if (txStatus === 'succeeded') {
    await activatePaidSubscription({
      userId: transaction.user_id,
      planCode: normalizePlanCode(transaction.plan_code),
      currency,
      amount,
      providerPaymentId: paymentId,
      providerPaymentMethodId: String(paymentMethod.id || transaction.provider_payment_method_id || '') || null,
      payload: payment,
    })
  } else if (transaction.kind === 'renewal') {
    await setSubscriptionPastDue(transaction.user_id, String(payment.status || 'renewal_failed'), paymentId)
  }

  return {
    transactionId: transaction.id,
    paymentId,
    status: txStatus,
  }
}

export async function runDueRenewals(options: { locale?: string } = {}) {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const dueRowsResult = await admin
    .from('user_subscriptions')
    .select('*')
    .in('plan_code', ['business', 'enterprise'])
    .eq('status', 'active')
    .eq('cancel_at_period_end', false)
    .lte('current_period_end', now)

  if (dueRowsResult.error) {
    throw new Error(`Failed to load due subscriptions: ${dueRowsResult.error.message}`)
  }

  const processed: Array<{ userId: string; status: string; transactionId?: string }> = []
  for (const row of dueRowsResult.data || []) {
    const paymentMethodId = String(row.provider_payment_method_id || '').trim()
    if (!paymentMethodId) {
      await setSubscriptionPastDue(row.user_id, 'missing_saved_payment_method')
      processed.push({ userId: row.user_id, status: 'past_due' })
      continue
    }

    const transaction = await insertTransaction({
      userId: row.user_id,
      planCode: row.plan_code,
      kind: 'renewal',
      amount: Number(row.price_amount || subscriptionPriceFor(row.plan_code, row.currency)),
      currency: row.currency,
    })

    try {
      const renewal = await chargeSavedYooKassaPaymentMethod({
        amount: Number(row.price_amount || subscriptionPriceFor(row.plan_code, row.currency)),
        currency: row.currency,
        paymentMethodId,
        planCode: row.plan_code,
        userId: row.user_id,
        transactionId: transaction.id,
        locale: options.locale || 'ru',
      })

      const nextStatus = classifyPaymentStatus(renewal.status)
      await updateTransaction(transaction.id, {
        provider_payment_id: renewal.paymentId || null,
        provider_payment_method_id: renewal.paymentMethodId || paymentMethodId,
        provider_idempotence_key: renewal.idempotenceKey,
        payload: renewal.raw,
        status: nextStatus,
        succeeded_at: nextStatus === 'succeeded' ? new Date().toISOString() : null,
      })

      if (nextStatus === 'succeeded') {
        await activatePaidSubscription({
          userId: row.user_id,
          planCode: row.plan_code,
          currency: row.currency,
          amount: Number(row.price_amount || 0),
          providerPaymentId: renewal.paymentId,
          providerPaymentMethodId: renewal.paymentMethodId || paymentMethodId,
          payload: renewal.raw,
        })
        processed.push({ userId: row.user_id, status: 'renewed', transactionId: transaction.id })
      } else {
        await setSubscriptionPastDue(row.user_id, renewal.status || 'renewal_pending_or_failed', renewal.paymentId || null)
        processed.push({ userId: row.user_id, status: 'past_due', transactionId: transaction.id })
      }
    } catch (error) {
      await updateTransaction(transaction.id, {
        status: 'failed',
        failure_reason: String(error),
        failed_at: new Date().toISOString(),
      })
      await setSubscriptionPastDue(row.user_id, String(error))
      processed.push({ userId: row.user_id, status: 'past_due', transactionId: transaction.id })
    }
  }

  return {
    processed,
  }
}

export async function backfillBaseSubscriptions() {
  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')

  if (error) {
    throw new Error(`Failed to load profiles for billing backfill: ${error.message}`)
  }

  let created = 0
  for (const profile of profiles || []) {
    const { data: existing, error: existingError } = await admin
      .from('user_subscriptions')
      .select('id, plan_code, price_amount')
      .eq('user_id', profile.id)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to check subscription for ${profile.id}: ${existingError.message}`)
    }

    if (existing) {
      continue
    }

    const row = await getCurrentSubscriptionRow(profile.id)
    if (row.plan_code === 'base' && Number(row.price_amount || 0) === 0) {
      created += 1
    }
  }

  return { created }
}
