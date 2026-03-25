import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingIntervalMonthCount, getPlanEntitlements, getPlanPrice } from '@/lib/billing/plans'
import type {
  BillingCurrency,
  BillingInterval,
  PlanCode,
  PlanEntitlements,
  PendingSubscriptionTransaction,
  PlanStatus,
  SubscriptionUsage,
  UserRole,
  ViewerAccess,
} from '@/lib/billing/types'
import type {
  BotRow,
  Json,
  SubscriptionTransactionRow,
  UserSubscriptionRow,
} from '@/lib/supabase/types'

const ACTIVE_STATUSES = new Set<PlanStatus>(['active'])

function nowIso() {
  return new Date().toISOString()
}

function addMonths(isoValue: string, months: number) {
  const date = new Date(isoValue)
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next.toISOString()
}

function normalizeCurrency(value: unknown): BillingCurrency {
  return String(value || '').toUpperCase() === 'USD' ? 'USD' : 'RUB'
}

function normalizeBillingInterval(value: unknown): BillingInterval {
  return String(value || '').trim().toLowerCase() === 'year' ? 'year' : 'month'
}

function normalizeRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'user'
}

function isUsdBillingEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.YOOKASSA_SUBSCRIPTION_ENABLE_USD || '').toLowerCase())
}

export function getAvailableBillingCurrencies(): BillingCurrency[] {
  return isUsdBillingEnabled() ? ['RUB', 'USD'] : ['RUB']
}

function buildAdminEntitlements(): PlanEntitlements {
  return {
    ...getPlanEntitlements('enterprise'),
    crm: true,
    dashboardStatisticsBasic: true,
    dashboardStatisticsPro: true,
    aiNodes: true,
    aiChat: true,
    ownAiApiKeys: true,
    tokenTopUps: true,
    hosting: true,
    prioritySupport: true,
    maxBots: Number.MAX_SAFE_INTEGER,
    maxHostedBots: Number.MAX_SAFE_INTEGER,
  }
}

function resolveDerivedStatus(row: UserSubscriptionRow | null): PlanStatus {
  if (!row) return 'active'
  if (row.plan_code === 'base') return 'active'

  const storedStatus = row.status as PlanStatus
  if (storedStatus === 'past_due' || storedStatus === 'expired' || storedStatus === 'incomplete') {
    return storedStatus
  }

  const now = Date.now()
  const periodEnd = row.current_period_end ? Date.parse(row.current_period_end) : NaN
  if (Number.isFinite(periodEnd) && now >= periodEnd) {
    if (row.cancel_at_period_end || storedStatus === 'canceled') {
      return 'canceled'
    }
    return 'past_due'
  }

  return storedStatus
}

function resolveEffectivePlanCode(row: UserSubscriptionRow | null, derivedStatus: PlanStatus): PlanCode {
  if (!row) return 'base'
  return ACTIVE_STATUSES.has(derivedStatus) ? row.plan_code : 'base'
}

function extractHostedBotsCount(bots: Pick<BotRow, 'metadata'>[]) {
  return bots.reduce((total, bot) => {
    const metadata = bot.metadata && typeof bot.metadata === 'object'
      ? (bot.metadata as Record<string, unknown>)
      : null

    const deploymentMode = String(
      metadata?.deploymentMode ||
      metadata?.deployment_mode ||
      metadata?.hostingMode ||
      metadata?.hosting_mode ||
      metadata?.deployedVia ||
      ''
    ).toLowerCase()

    if (deploymentMode === 'hosted' || deploymentMode === 'managed' || deploymentMode === 'cbtooll') {
      return total + 1
    }

    return total
  }, 0)
}

function buildPendingTransaction(row: SubscriptionTransactionRow | null): PendingSubscriptionTransaction | null {
  if (!row) return null
  return {
    id: row.id,
    planCode: row.plan_code,
    billingInterval: normalizeBillingInterval(row.billing_interval),
    kind: row.kind,
    amount: Number(row.amount || 0),
    currency: row.currency,
    confirmationUrl: row.confirmation_url,
    createdAt: row.created_at,
  }
}

function buildFallbackViewerAccess(): ViewerAccess {
  const currency: BillingCurrency = 'RUB'
  const billingInterval: BillingInterval = 'month'
  const availableCurrencies = getAvailableBillingCurrencies()
  const entitlements = getPlanEntitlements('base')

  return {
    role: 'user',
    isAdmin: false,
    planCode: 'base',
    effectivePlanCode: 'base',
    status: 'active',
    currency,
    priceAmount: getPlanPrice('base', currency, billingInterval),
    billingInterval,
    billingProvider: 'yookassa',
    cancelAtPeriodEnd: false,
    startedAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    canceledAt: null,
    pastDueAt: null,
    usage: {
      bots: 0,
      hostedBots: 0,
    },
    entitlements,
    softLocked: false,
    usageExceeded: false,
    restrictions: [],
    availableCurrencies,
    pendingTransaction: null,
  }
}

export async function ensureUserSubscription(userId: string): Promise<UserSubscriptionRow> {
  const admin = createAdminClient()

  const { data: existing, error: selectError } = await admin
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Failed to load subscription: ${selectError.message}`)
  }

  if (existing) {
    return existing
  }

  const inserted = await admin
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_code: 'base',
      status: 'active',
      currency: 'RUB',
      billing_interval: 'month',
      billing_provider: 'yookassa',
      price_amount: 0,
      started_at: nowIso(),
    })
    .select('*')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(`Failed to create default subscription: ${inserted.error?.message || 'unknown error'}`)
  }

  return inserted.data
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load profile role: ${error.message}`)
  }

  return normalizeRole(data?.role)
}

export async function getSubscriptionUsage(userId: string): Promise<SubscriptionUsage> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bots')
    .select('id, metadata')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to load bot usage: ${error.message}`)
  }

  const bots = (data || []) as Pick<BotRow, 'metadata'>[]
  return {
    bots: bots.length,
    hostedBots: extractHostedBotsCount(bots),
  }
}

export async function getCurrentSubscriptionRow(userId: string): Promise<UserSubscriptionRow> {
  return ensureUserSubscription(userId)
}

export async function getLatestPendingSubscriptionTransaction(userId: string): Promise<SubscriptionTransactionRow | null> {
  const admin = createAdminClient()
  const result = await admin
    .from('subscription_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (result.error) {
    throw new Error(`Failed to load pending transaction: ${result.error.message}`)
  }

  return result.data
}

export async function getViewerAccess(userId: string): Promise<ViewerAccess> {
  let role: UserRole
  let subscriptionRow: UserSubscriptionRow | null
  let usage: SubscriptionUsage
  let pendingTransaction: SubscriptionTransactionRow | null

  try {
    ;[role, subscriptionRow, usage, pendingTransaction] = await Promise.all([
      getUserRole(userId),
      getCurrentSubscriptionRow(userId),
      getSubscriptionUsage(userId),
      getLatestPendingSubscriptionTransaction(userId),
    ])
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      console.error('Failed to load viewer access, using base fallback:', error)
    }
    return buildFallbackViewerAccess()
  }

  const isAdmin = role === 'admin'
  const derivedStatus = resolveDerivedStatus(subscriptionRow)
  const effectivePlanCode = isAdmin
    ? 'enterprise'
    : resolveEffectivePlanCode(subscriptionRow, derivedStatus)
  const entitlements = isAdmin ? buildAdminEntitlements() : getPlanEntitlements(effectivePlanCode)
  const usageExceeded = usage.bots > entitlements.maxBots || usage.hostedBots > entitlements.maxHostedBots
  const softLocked = !isAdmin && (derivedStatus === 'past_due' || derivedStatus === 'expired' || derivedStatus === 'incomplete' || usageExceeded)
  const restrictions: string[] = []

  if (derivedStatus === 'past_due') restrictions.push('payment_past_due')
  if (derivedStatus === 'expired') restrictions.push('subscription_expired')
  if (derivedStatus === 'incomplete') restrictions.push('payment_incomplete')
  if (usage.bots > entitlements.maxBots) restrictions.push('bots_over_limit')
  if (usage.hostedBots > entitlements.maxHostedBots) restrictions.push('hosting_over_limit')

  const currentPlanCode = subscriptionRow?.plan_code || 'base'
  const currentCurrency = normalizeCurrency(subscriptionRow?.currency)
  const currentBillingInterval = normalizeBillingInterval(subscriptionRow?.billing_interval)
  const availableCurrencies = getAvailableBillingCurrencies()

  return {
    role,
    isAdmin,
    planCode: currentPlanCode,
    effectivePlanCode,
    status: isAdmin ? 'active' : derivedStatus,
    currency: availableCurrencies.includes(currentCurrency) ? currentCurrency : 'RUB',
    priceAmount: Number(subscriptionRow?.price_amount ?? getPlanPrice(currentPlanCode, currentCurrency, currentBillingInterval)),
    billingInterval: currentBillingInterval,
    billingProvider: 'yookassa',
    cancelAtPeriodEnd: Boolean(subscriptionRow?.cancel_at_period_end),
    startedAt: subscriptionRow?.started_at || null,
    currentPeriodStart: subscriptionRow?.current_period_start || null,
    currentPeriodEnd: subscriptionRow?.current_period_end || null,
    canceledAt: subscriptionRow?.canceled_at || null,
    pastDueAt: subscriptionRow?.past_due_at || null,
    usage,
    entitlements,
    softLocked,
    usageExceeded,
    restrictions,
    availableCurrencies,
    pendingTransaction: buildPendingTransaction(pendingTransaction),
  }
}

export function getNextPeriodRangeForInterval(interval: BillingInterval, fromIso = nowIso()) {
  return {
    currentPeriodStart: fromIso,
    currentPeriodEnd: addMonths(fromIso, getBillingIntervalMonthCount(interval)),
  }
}

export function getNextPeriodRange(fromIso = nowIso(), interval: BillingInterval = 'month') {
  return getNextPeriodRangeForInterval(interval, fromIso)
}

export function subscriptionPriceFor(planCode: PlanCode, currency: BillingCurrency, interval: BillingInterval = 'month') {
  return getPlanPrice(planCode, currency, interval)
}

export function mergeJson(
  left: Json | null | undefined,
  right: Record<string, unknown>
): Json {
  const base = left && typeof left === 'object' && !Array.isArray(left)
    ? { ...(left as Record<string, unknown>) }
    : {}

  return {
    ...base,
    ...right,
  } as Json
}
