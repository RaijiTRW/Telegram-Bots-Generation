import { cache } from 'react'

import type { Locale } from '@/app/i18n'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AnalyticsEmailDeliveryRow,
  BotAuditEventRow,
  BotTestLogRow,
  LandingPageView,
  SubscriptionTransactionRow,
} from '@/lib/supabase/types'

const STATUS_HISTORY_DAYS = 30
const STATUS_HISTORY_TIMEZONE = 'Europe/Moscow'
const PAGE_SIZE = 5000
const MAX_PAGES = 20

type HistoryTone = 'healthy' | 'degraded' | 'critical' | 'no_data'

type DailyCounters = {
  landingViews: number
  auditEvents: number
  runtimeLogs: number
  warningCount: number
  errorCount: number
  billingTransactions: number
  failedTransactions: number
  emailDeliveries: number
  failedEmailDeliveries: number
}

export type PublicStatusHistoryDay = DailyCounters & {
  dayKey: string
  shortLabel: string
  fullLabel: string
  tone: HistoryTone
  signalCount: number
  issueCount: number
}

export type PublicStatusHistory = {
  generatedAtIso: string
  updatedAtLabel: string
  telemetryAvailable: boolean
  timezone: string
  days: PublicStatusHistoryDay[]
  summary: {
    healthyDays: number
    degradedDays: number
    criticalDays: number
    noDataDays: number
    totalSignals: number
    totalIssues: number
  }
}

function createDailyCounters(): DailyCounters {
  return {
    landingViews: 0,
    auditEvents: 0,
    runtimeLogs: 0,
    warningCount: 0,
    errorCount: 0,
    billingTransactions: 0,
    failedTransactions: 0,
    emailDeliveries: 0,
    failedEmailDeliveries: 0,
  }
}

function getDayKey(value: Date | string, timeZone = STATUS_HISTORY_TIMEZONE) {
  const date = typeof value === 'string' ? new Date(value) : value
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value || '0000'
  const month = parts.find((part) => part.type === 'month')?.value || '00'
  const day = parts.find((part) => part.type === 'day')?.value || '00'

  return `${year}-${month}-${day}`
}

function getDayKeys() {
  const now = Date.now()
  const keys: string[] = []

  for (let offset = STATUS_HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    keys.push(getDayKey(new Date(now - offset * 24 * 60 * 60 * 1000)))
  }

  return keys
}

function getShortLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dayKey}T12:00:00.000Z`))
}

function getFullLabel(dayKey: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dayKey}T12:00:00.000Z`))
}

function getUpdatedAtLabel(value: string, locale: Locale) {
  const prefix = locale === 'en' ? 'Updated' : 'Обновлено'
  const formatted = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: STATUS_HISTORY_TIMEZONE,
  }).format(new Date(value))

  return `${prefix} ${formatted}`
}

function createEmptyHistory(locale: Locale): PublicStatusHistory {
  const generatedAtIso = new Date().toISOString()
  const days = getDayKeys().map((dayKey) => ({
    dayKey,
    shortLabel: getShortLabel(dayKey, locale),
    fullLabel: getFullLabel(dayKey, locale),
    tone: 'no_data' as const,
    signalCount: 0,
    issueCount: 0,
    ...createDailyCounters(),
  }))

  return {
    generatedAtIso,
    updatedAtLabel: getUpdatedAtLabel(generatedAtIso, locale),
    telemetryAvailable: false,
    timezone: STATUS_HISTORY_TIMEZONE,
    days,
    summary: {
      healthyDays: 0,
      degradedDays: 0,
      criticalDays: 0,
      noDataDays: days.length,
      totalSignals: 0,
      totalIssues: 0,
    },
  }
}

async function loadPagedRows<Row>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>
) {
  const rows: Row[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, error } = await queryPage(from, to)
    if (error) {
      throw new Error(error.message || 'Failed to load status telemetry')
    }

    const chunk = Array.isArray(data) ? data : []
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) {
      break
    }
  }

  return rows
}

function normalizeTransactionEventAt(row: Pick<SubscriptionTransactionRow, 'failed_at' | 'succeeded_at' | 'updated_at' | 'created_at'>) {
  return row.failed_at || row.succeeded_at || row.updated_at || row.created_at
}

function normalizeEmailEventAt(row: Pick<AnalyticsEmailDeliveryRow, 'sent_at' | 'created_at'>) {
  return row.sent_at || row.created_at
}

function isFailedTransaction(status: SubscriptionTransactionRow['status']) {
  return status === 'failed' || status === 'canceled'
}

function resolveTone(counters: DailyCounters): HistoryTone {
  const signalCount =
    counters.landingViews +
    counters.auditEvents +
    counters.runtimeLogs +
    counters.billingTransactions +
    counters.emailDeliveries

  const issueCount =
    counters.warningCount +
    counters.errorCount +
    counters.failedTransactions +
    counters.failedEmailDeliveries

  if (signalCount === 0) {
    return 'no_data'
  }

  if (issueCount === 0) {
    return 'healthy'
  }

  const weightedIssueScore =
    counters.warningCount +
    counters.errorCount * 3 +
    counters.failedTransactions * 4 +
    counters.failedEmailDeliveries * 3

  const issueRatio = weightedIssueScore / Math.max(signalCount, 1)
  const hardFailureCount = counters.failedTransactions + counters.failedEmailDeliveries

  if (
    counters.errorCount >= 4 ||
    hardFailureCount >= 2 ||
    (issueRatio >= 0.12 && issueCount >= 3)
  ) {
    return 'critical'
  }

  return 'degraded'
}

export const getPublicStatusHistory = cache(async (locale: Locale): Promise<PublicStatusHistory> => {
  try {
    const admin = createAdminClient()
    const generatedAtIso = new Date().toISOString()
    const sinceIso = new Date(Date.now() - STATUS_HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const [
      landingViews,
      auditEvents,
      runtimeLogs,
      billingTransactions,
      analyticsEmailDeliveries,
    ] = await Promise.all([
      loadPagedRows<Pick<LandingPageView, 'created_at'>>((from, to) =>
        admin
          .from('landing_page_views')
          .select('created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      loadPagedRows<Pick<BotAuditEventRow, 'created_at'>>((from, to) =>
        admin
          .from('bot_audit_events')
          .select('created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      loadPagedRows<Pick<BotTestLogRow, 'created_at' | 'level'>>((from, to) =>
        admin
          .from('bot_test_logs')
          .select('created_at, level')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      loadPagedRows<Pick<SubscriptionTransactionRow, 'created_at' | 'updated_at' | 'failed_at' | 'succeeded_at' | 'status'>>((from, to) =>
        admin
          .from('subscription_transactions')
          .select('created_at, updated_at, failed_at, succeeded_at, status')
          .or(`created_at.gte.${sinceIso},updated_at.gte.${sinceIso},failed_at.gte.${sinceIso},succeeded_at.gte.${sinceIso}`)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      loadPagedRows<Pick<AnalyticsEmailDeliveryRow, 'created_at' | 'sent_at' | 'status'>>((from, to) =>
        admin
          .from('analytics_email_deliveries')
          .select('created_at, sent_at, status')
          .or(`created_at.gte.${sinceIso},sent_at.gte.${sinceIso}`)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
    ])

    const countersByDay = new Map<string, DailyCounters>(
      getDayKeys().map((dayKey) => [dayKey, createDailyCounters()])
    )

    for (const row of landingViews) {
      const dayKey = getDayKey(row.created_at)
      const counters = countersByDay.get(dayKey)
      if (counters) counters.landingViews += 1
    }

    for (const row of auditEvents) {
      const dayKey = getDayKey(row.created_at)
      const counters = countersByDay.get(dayKey)
      if (counters) counters.auditEvents += 1
    }

    for (const row of runtimeLogs) {
      const dayKey = getDayKey(row.created_at)
      const counters = countersByDay.get(dayKey)
      if (!counters) continue

      counters.runtimeLogs += 1
      const level = String(row.level || '').toLowerCase()
      if (level === 'warn') counters.warningCount += 1
      if (level === 'error') counters.errorCount += 1
    }

    for (const row of billingTransactions) {
      const eventAt = normalizeTransactionEventAt(row)
      const dayKey = getDayKey(eventAt)
      const counters = countersByDay.get(dayKey)
      if (!counters) continue

      counters.billingTransactions += 1
      if (isFailedTransaction(row.status)) {
        counters.failedTransactions += 1
      }
    }

    for (const row of analyticsEmailDeliveries) {
      const eventAt = normalizeEmailEventAt(row)
      const dayKey = getDayKey(eventAt)
      const counters = countersByDay.get(dayKey)
      if (!counters) continue

      counters.emailDeliveries += 1
      if (row.status === 'failed') {
        counters.failedEmailDeliveries += 1
      }
    }

    const days = Array.from(countersByDay.entries()).map(([dayKey, counters]) => {
      const signalCount =
        counters.landingViews +
        counters.auditEvents +
        counters.runtimeLogs +
        counters.billingTransactions +
        counters.emailDeliveries

      const issueCount =
        counters.warningCount +
        counters.errorCount +
        counters.failedTransactions +
        counters.failedEmailDeliveries

      return {
        dayKey,
        shortLabel: getShortLabel(dayKey, locale),
        fullLabel: getFullLabel(dayKey, locale),
        tone: resolveTone(counters),
        signalCount,
        issueCount,
        ...counters,
      }
    })

    const summary = days.reduce<PublicStatusHistory['summary']>(
      (acc, day) => {
        if (day.tone === 'healthy') acc.healthyDays += 1
        if (day.tone === 'degraded') acc.degradedDays += 1
        if (day.tone === 'critical') acc.criticalDays += 1
        if (day.tone === 'no_data') acc.noDataDays += 1
        acc.totalSignals += day.signalCount
        acc.totalIssues += day.issueCount
        return acc
      },
      {
        healthyDays: 0,
        degradedDays: 0,
        criticalDays: 0,
        noDataDays: 0,
        totalSignals: 0,
        totalIssues: 0,
      }
    )

    return {
      generatedAtIso,
      updatedAtLabel: getUpdatedAtLabel(generatedAtIso, locale),
      telemetryAvailable: true,
      timezone: STATUS_HISTORY_TIMEZONE,
      days,
      summary,
    }
  } catch {
    return createEmptyHistory(locale)
  }
})
