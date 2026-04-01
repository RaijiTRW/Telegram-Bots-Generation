import 'server-only'

import { resolveAppBaseUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getAvailableBillingCurrencies,
  getCurrentSubscriptionRow,
  getNextPeriodRange,
  getLatestPendingCardBindingTransaction,
  getLatestPendingSubscriptionTransaction,
  getViewerAccess,
  mergeJson,
  subscriptionPriceFor,
} from '@/lib/billing/server'
import type {
  BillingCurrency,
  BillingInterval,
  PlanCode,
  SubscriptionSummary,
  SubscriptionTransactionKind,
  SubscriptionTransactionStatus,
} from '@/lib/billing/types'
import type { SubscriptionTransactionRow } from '@/lib/supabase/types'
import {
  chargeSavedYooKassaPaymentMethod,
  createYooKassaCardBindingCheckout,
  createYooKassaRefund,
  createYooKassaSubscriptionCheckout,
  getYooKassaPayment,
} from '@/lib/billing/yookassa'

const PENDING_SUBSCRIPTION_STATUSES = new Set(['pending', 'waiting_for_capture'])
const SUCCESS_SUBSCRIPTION_STATUSES = new Set(['succeeded'])
const FAILED_SUBSCRIPTION_STATUSES = new Set(['canceled', 'cancelled', 'failed'])
const CARD_BINDING_AMOUNT = 1
const SUBSCRIPTION_CHARGE_KINDS: SubscriptionTransactionKind[] = ['initial', 'renewal', 'change']

function normalizePlanCode(value: string): PlanCode {
  if (value === 'business' || value === 'enterprise') return value
  return 'base'
}

function normalizeBillingCurrency(value: string): BillingCurrency {
  return value.toUpperCase() === 'USD' ? 'USD' : 'RUB'
}

function normalizeBillingInterval(value: unknown): BillingInterval {
  return String(value || '').trim().toLowerCase() === 'year' ? 'year' : 'month'
}

function normalizeBillingLocale(value: string | undefined) {
  return String(value || '').trim().toLowerCase() === 'en' ? 'en' : 'ru'
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isSubscriptionChargeKind(kind: SubscriptionTransactionKind) {
  return SUBSCRIPTION_CHARGE_KINDS.includes(kind)
}

async function insertTransaction(input: {
  userId: string
  planCode: PlanCode
  billingInterval: BillingInterval
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
      billing_interval: input.billingInterval,
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
  billingInterval: BillingInterval
  amount: number
  providerPaymentId: string
  providerPaymentMethodId: string | null
  payload: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(input.userId)
  const period = getNextPeriodRange(undefined, input.billingInterval)

  const result = await admin
    .from('user_subscriptions')
    .update({
      plan_code: input.planCode,
      status: 'active',
      currency: input.currency,
      billing_interval: input.billingInterval,
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
      billing_interval: 'month',
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

async function savePaymentMethodForFutureRenewals(input: {
  userId: string
  paymentMethodId: string
  bindingPaymentId: string
  payload: Record<string, unknown>
}) {
  const admin = createAdminClient()
  const current = await getCurrentSubscriptionRow(input.userId)
  const result = await admin
    .from('user_subscriptions')
    .update({
      provider_payment_method_id: input.paymentMethodId,
      cancel_at_period_end: false,
      provider_metadata: mergeJson(current.provider_metadata, {
        lastCardBindingAt: new Date().toISOString(),
        lastCardBindingPaymentId: input.bindingPaymentId,
        autoRenewDisabledAt: null,
        lastCardBindingPayload: input.payload,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .select('*')
    .single()

  if (result.error || !result.data) {
    throw new Error(`Failed to save payment method: ${result.error?.message || 'unknown error'}`)
  }

  return result.data
}

async function refundCardBindingCharge(input: {
  transaction: SubscriptionTransactionRow
  paymentId: string
  currency: BillingCurrency
}) {
  const existingPayload = asRecord(input.transaction.payload)
  const existingRefund = asRecord(existingPayload.cardBindingRefund)
  if (String(existingRefund.id || '').trim()) {
    return {
      refundId: String(existingRefund.id || ''),
      status: String(existingRefund.status || 'succeeded'),
      raw: existingRefund,
      idempotenceKey: String(existingPayload.cardBindingRefundIdempotenceKey || ''),
    }
  }

  const refund = await createYooKassaRefund({
    paymentId: input.paymentId,
    amount: CARD_BINDING_AMOUNT,
    currency: input.currency,
    description: 'Возврат тестового списания за привязку карты',
    metadata: {
      scope: 'card-binding-refund',
      transactionId: input.transaction.id,
      userId: input.transaction.user_id,
    },
  })

  await updateTransaction(input.transaction.id, {
    payload: mergeJson(input.transaction.payload, {
      cardBindingRefund: refund.raw,
      cardBindingRefundIdempotenceKey: refund.idempotenceKey,
    }),
  })

  return refund
}

export async function getCurrentSubscription(userId: string): Promise<SubscriptionSummary> {
  return getViewerAccess(userId)
}

async function syncSubscriptionTransaction(transaction: SubscriptionTransactionRow) {
  const paymentId = String(transaction.provider_payment_id || '').trim()
  if (!paymentId) {
    return {
      transactionId: transaction.id,
      paymentId: null,
      status: classifyPaymentStatus(transaction.status),
      synced: false,
    } as const
  }

  const payment = await getYooKassaPayment(paymentId)
  const metadata = payment.metadata && typeof payment.metadata === 'object'
    ? (payment.metadata as Record<string, unknown>)
    : {}
  const paymentMethod = payment.payment_method && typeof payment.payment_method === 'object'
    ? (payment.payment_method as Record<string, unknown>)
    : {}
  const txStatus = classifyPaymentStatus(payment.status)
  const amountRecord = payment.amount && typeof payment.amount === 'object'
    ? (payment.amount as Record<string, unknown>)
    : {}
  const amount = Number(amountRecord.value || transaction.amount || 0)
  const currency = normalizeBillingCurrency(String(amountRecord.currency || transaction.currency || 'RUB'))
  const paymentMethodId = String(paymentMethod.id || transaction.provider_payment_method_id || '').trim() || null
  const basePayload = asRecord(payment)
  const transactionPayload = mergeJson(transaction.payload, basePayload)
  const transactionPayloadRecord = asRecord(transactionPayload)

  await updateTransaction(transaction.id, {
    status: txStatus,
    provider_payment_id: paymentId,
    provider_payment_method_id: paymentMethodId,
    payload: transactionPayload,
    failure_reason: txStatus === 'failed' ? String(payment.cancellation_details || payment.status || 'payment_failed') : null,
    succeeded_at: txStatus === 'succeeded' ? new Date().toISOString() : transaction.succeeded_at,
    failed_at: txStatus === 'failed' ? new Date().toISOString() : transaction.failed_at,
  })

  if (txStatus === 'succeeded') {
    if (isSubscriptionChargeKind(transaction.kind)) {
      await activatePaidSubscription({
        userId: transaction.user_id,
        planCode: normalizePlanCode(transaction.plan_code),
        currency,
        billingInterval: normalizeBillingInterval(transaction.billing_interval || metadata.billingInterval),
        amount,
        providerPaymentId: paymentId,
        providerPaymentMethodId: paymentMethodId,
        payload: transactionPayloadRecord,
      })
    } else if (transaction.kind === 'card_binding') {
      if (!paymentMethodId) {
        throw new Error('YooKassa did not return saved payment_method_id for card binding')
      }

      await savePaymentMethodForFutureRenewals({
        userId: transaction.user_id,
        paymentMethodId,
        bindingPaymentId: paymentId,
        payload: transactionPayloadRecord,
      })

      await refundCardBindingCharge({
        transaction: {
          ...transaction,
          payload: transactionPayload,
          provider_payment_method_id: paymentMethodId,
        },
        paymentId,
        currency,
      })
    }
  } else if (txStatus === 'failed' && transaction.kind === 'renewal') {
    await setSubscriptionPastDue(transaction.user_id, String(payment.status || 'renewal_failed'), paymentId)
  }

  return {
    transactionId: transaction.id,
    paymentId,
    status: txStatus,
    synced: true,
  } as const
}

async function getTransactionForUserById(userId: string, transactionId: string) {
  const admin = createAdminClient()
  const result = await admin
    .from('subscription_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (result.error) {
    throw new Error(`Failed to load subscription transaction: ${result.error.message}`)
  }

  return result.data
}

export async function syncCardBindingForUser(userId: string, transactionId?: string | null) {
  const transaction = transactionId
    ? await getTransactionForUserById(userId, transactionId)
    : await getLatestPendingCardBindingTransaction(userId)

  if (!transaction || transaction.kind !== 'card_binding') {
    return {
      synced: false,
      status: null,
      transactionId: null,
      paymentId: null,
      subscription: await getCurrentSubscription(userId),
    } as const
  }

  try {
    const result = await syncSubscriptionTransaction(transaction)
    return {
      ...result,
      subscription: await getCurrentSubscription(userId),
    } as const
  } catch (error) {
    return {
      synced: false,
      status: classifyPaymentStatus(transaction.status),
      transactionId: transaction.id,
      paymentId: String(transaction.provider_payment_id || '').trim() || null,
      error: String(error),
      subscription: await getCurrentSubscription(userId),
    } as const
  }
}

export async function syncLatestPendingSubscriptionForUser(userId: string) {
  const pendingTransaction = await getLatestPendingSubscriptionTransaction(userId)
  if (!pendingTransaction) {
    return {
      synced: false,
      status: null,
      transactionId: null,
      paymentId: null,
      subscription: await getCurrentSubscription(userId),
    } as const
  }

  try {
    const result = await syncSubscriptionTransaction(pendingTransaction)
    return {
      ...result,
      subscription: await getCurrentSubscription(userId),
    } as const
  } catch (error) {
    return {
      synced: false,
      status: classifyPaymentStatus(pendingTransaction.status),
      transactionId: pendingTransaction.id,
      paymentId: String(pendingTransaction.provider_payment_id || '').trim() || null,
      error: String(error),
      subscription: await getCurrentSubscription(userId),
    } as const
  }
}

export async function getCurrentSubscriptionWithPendingSync(userId: string): Promise<SubscriptionSummary> {
  const pendingTransaction = await getLatestPendingSubscriptionTransaction(userId)
  if (!pendingTransaction) {
    return getCurrentSubscription(userId)
  }

  try {
    await syncSubscriptionTransaction(pendingTransaction)
  } catch {
    // Keep the subscription page usable even if provider sync fails.
  }

  return getCurrentSubscription(userId)
}

export async function startSubscriptionCheckout(input: {
  userId: string
  planCode: PlanCode
  currency: BillingCurrency
  billingInterval: BillingInterval
  locale?: string
}) {
  if (input.planCode === 'base') {
    throw new Error('Base plan does not require checkout')
  }

  const locale = normalizeBillingLocale(input.locale)
  if (locale === 'en') {
    throw new Error('Subscription payments are not available for the English locale yet')
  }

  ensureSupportedCurrency(input.currency)

  const access = await getViewerAccess(input.userId)
  if (
    !access.isAdmin &&
    access.planCode === input.planCode &&
    access.billingInterval === input.billingInterval &&
    access.currency === input.currency &&
    access.status === 'active' &&
    !access.cancelAtPeriodEnd
  ) {
    throw new Error('Selected plan is already active')
  }

  if (
    access.pendingTransaction &&
    access.pendingTransaction.planCode === input.planCode &&
    access.pendingTransaction.billingInterval === input.billingInterval &&
    access.pendingTransaction.currency === input.currency &&
    access.pendingTransaction.confirmationUrl
  ) {
    return {
      confirmationUrl: access.pendingTransaction.confirmationUrl,
      transactionId: access.pendingTransaction.id,
    }
  }

  const amount = subscriptionPriceFor(input.planCode, input.currency, input.billingInterval)
  const baseUrl = await resolveAppBaseUrl()
  const returnUrl = `${baseUrl}/${locale}/payment/return?source=subscription&plan=${input.planCode}&billing=${input.billingInterval}`
  const kind: SubscriptionTransactionKind = access.planCode === 'base' ? 'initial' : 'change'
  const transaction = await insertTransaction({
    userId: input.userId,
    planCode: input.planCode,
    billingInterval: input.billingInterval,
    kind,
    amount,
    currency: input.currency,
    returnUrl,
  })

  const checkout = await createYooKassaSubscriptionCheckout({
    amount,
    currency: input.currency,
    billingInterval: input.billingInterval,
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
  billingInterval: BillingInterval
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

export async function startCardBindingCheckout(input: {
  userId: string
  locale?: string
}) {
  const locale = normalizeBillingLocale(input.locale)
  if (locale === 'en') {
    throw new Error('Card binding is not available for the English locale yet')
  }

  const current = await getCurrentSubscriptionRow(input.userId)
  if (current.plan_code === 'base') {
    throw new Error('Base plan does not require card binding for renewals')
  }

  const pendingTransaction = await getLatestPendingCardBindingTransaction(input.userId)
  if (pendingTransaction?.confirmation_url) {
    return {
      confirmationUrl: pendingTransaction.confirmation_url,
      transactionId: pendingTransaction.id,
    } as const
  }

  const baseUrl = await resolveAppBaseUrl()
  const transaction = await insertTransaction({
    userId: input.userId,
    planCode: normalizePlanCode(current.plan_code),
    billingInterval: normalizeBillingInterval(current.billing_interval),
    kind: 'card_binding',
    amount: CARD_BINDING_AMOUNT,
    currency: 'RUB',
    returnUrl: null,
  })

  const returnUrl = `${baseUrl}/${locale}/payment/return?source=card-binding&tx=${transaction.id}`
  await updateTransaction(transaction.id, { return_url: returnUrl })

  const checkout = await createYooKassaCardBindingCheckout({
    amount: CARD_BINDING_AMOUNT,
    currency: 'RUB',
    returnUrl,
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
    throw new Error('YooKassa did not return confirmation_url for card binding')
  }

  return {
    confirmationUrl: checkout.confirmationUrl,
    transactionId: transaction.id,
  } as const
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
      provider_payment_method_id: null,
      provider_metadata: mergeJson(current.provider_metadata, {
        autoRenewDisabledAt: new Date().toISOString(),
        autoRenewDisabledReason: 'user_requested',
      }),
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
  if (!String(current.provider_payment_method_id || '').trim()) {
    throw new Error('No saved card found. Bind a card again to resume auto-renewal.')
  }

  const result = await admin
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: false,
      provider_metadata: mergeJson(current.provider_metadata, {
        autoRenewDisabledAt: null,
        autoRenewDisabledReason: null,
        autoRenewResumedAt: new Date().toISOString(),
      }),
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

  const result = await syncSubscriptionTransaction({
    ...transaction,
    provider_payment_id: paymentId,
    provider_payment_method_id: String(paymentMethod.id || transaction.provider_payment_method_id || '') || null,
    billing_interval: normalizeBillingInterval(transaction.billing_interval || metadata.billingInterval),
  } as SubscriptionTransactionRow)

  return {
    transactionId: result.transactionId,
    paymentId: result.paymentId,
    status: result.status,
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
      billingInterval: normalizeBillingInterval(row.billing_interval),
      kind: 'renewal',
      amount: Number(row.price_amount || subscriptionPriceFor(row.plan_code, row.currency, normalizeBillingInterval(row.billing_interval))),
      currency: row.currency,
    })

    try {
      const renewal = await chargeSavedYooKassaPaymentMethod({
        amount: Number(row.price_amount || subscriptionPriceFor(row.plan_code, row.currency, normalizeBillingInterval(row.billing_interval))),
        currency: row.currency,
        paymentMethodId,
        planCode: row.plan_code,
        billingInterval: normalizeBillingInterval(row.billing_interval),
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
          billingInterval: normalizeBillingInterval(row.billing_interval),
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
