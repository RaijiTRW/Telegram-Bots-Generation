import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import type {
  BotPaymentHistory,
  BotPaymentHistoryFilters,
  BotPaymentHistoryItem,
  BotPaymentHistoryPeriod,
} from '@/lib/bot-editor/types/analytics.types'

type BotAuditStatsRow = {
  id: string
  event_type: string | null
  created_at: string | null
  payload: unknown
}

const PAYMENT_PERIOD_MS: Record<Exclude<BotPaymentHistoryPeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const PAYMENT_AUDIT_EVENT_TYPES = [
  'payment.created',
  'payment.updated',
  'payment.completed',
  'payment.failed',
  'payment.status_changed',
] as const
const PAYMENT_AUTO_CANCEL_AFTER_MS = 4 * 60 * 60 * 1000

const PAYMENT_SUCCESS_STATUSES = new Set(['succeeded', 'success', 'paid', 'completed'])
const PAYMENT_PENDING_STATUSES = new Set(['pending', 'open', 'created', 'processing', 'waiting_for_capture'])
const PAYMENT_FAILED_STATUSES = new Set(['failed', 'canceled', 'cancelled', 'expired', 'refunded', 'error'])

function normalizePaymentPeriod(rawPeriod: string | undefined): BotPaymentHistoryPeriod {
  if (rawPeriod === '24h' || rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === 'all') {
    return rawPeriod
  }
  return '30d'
}

function getPaymentPeriodSinceIso(period: BotPaymentHistoryPeriod): string | null {
  if (period === 'all') {
    return null
  }
  return new Date(Date.now() - PAYMENT_PERIOD_MS[period]).toISOString()
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(',', '.'))
    return Number.isFinite(normalized) ? normalized : null
  }
  return null
}

function toIntegerOrNull(value: unknown): number | null {
  const normalized = toNumberOrNull(value)
  if (!Number.isFinite(Number(normalized))) {
    return null
  }
  const rounded = Math.round(Number(normalized))
  return Number.isFinite(rounded) ? rounded : null
}

function toText(value: unknown): string {
  return String(value || '').trim()
}

function normalizePaymentMethod(value: unknown): string {
  const normalized = toText(value).toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized === 'telegram-stars' || normalized === 'telegram stars') return 'telegram_stars'
  return normalized
}

function normalizePaymentStatus(value: unknown): string {
  const normalized = toText(value).toLowerCase()
  return normalized || 'unknown'
}

function classifyPaymentStatus(status: string): 'success' | 'pending' | 'failed' | 'other' {
  if (PAYMENT_SUCCESS_STATUSES.has(status)) return 'success'
  if (PAYMENT_PENDING_STATUSES.has(status)) return 'pending'
  if (PAYMENT_FAILED_STATUSES.has(status)) return 'failed'
  return 'other'
}

type ParsedPaymentAuditRecord = BotPaymentHistoryItem & {
  eventType: string
  createdAtMs: number
}

type PaymentAggregateRecord = BotPaymentHistoryItem & {
  latestAtMs: number
  firstSeenAtMs: number
}

function parseTimestampMs(value: string): number {
  const parsed = Date.parse(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return 0
}

function parsePaymentItemFromAuditRow(row: BotAuditStatsRow): ParsedPaymentAuditRecord | null {
  if (!row || typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) {
    return null
  }

  const payload = row.payload as Record<string, unknown>
  const createdAt = toText(row.created_at)
  const createdAtMs = parseTimestampMs(createdAt)
  const paymentId = toText(payload.paymentId || payload.invoiceId || payload.id) || String(row.id || '')
  const method = normalizePaymentMethod(payload.method || payload.provider || payload.paymentProvider)
  const status = normalizePaymentStatus(payload.status || payload.paymentStatus)
  const amount = toNumberOrNull(payload.amount)
  const currency = toText(payload.currency).toUpperCase()

  const payerId = toIntegerOrNull(payload.telegramUserId || payload.userId || payload.payerId)
  const payerUsername = toText(payload.username || payload.payerUsername)
  const payerFirstName = toText(payload.firstName || payload.first_name || payload.payerFirstName)
  const payerLastName = toText(payload.lastName || payload.last_name || payload.payerLastName)
  const payerName = [payerFirstName, payerLastName].filter(Boolean).join(' ').trim()

  return {
    id: String(row.id || ''),
    paymentId,
    method,
    status,
    amount,
    currency,
    payerId,
    payerUsername,
    payerName,
    createdAt,
    eventType: toText(row.event_type),
    createdAtMs,
  }
}

function matchesPaymentSearch(item: BotPaymentHistoryItem, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  const searchableParts = [
    item.id,
    item.paymentId,
    item.method,
    item.status,
    item.payerName,
    item.payerUsername,
    item.payerId ? String(item.payerId) : '',
  ]

  return searchableParts.some((part) => part.toLowerCase().includes(search))
}

function aggregatePaymentRecords(records: ParsedPaymentAuditRecord[]): PaymentAggregateRecord[] {
  const map = new Map<string, PaymentAggregateRecord>()

  for (const record of records) {
    const aggregateKey = `${record.method}:${record.paymentId || record.id}`
    const existing = map.get(aggregateKey)

    if (!existing) {
      map.set(aggregateKey, {
        id: record.id,
        paymentId: record.paymentId,
        method: record.method,
        status: record.status,
        amount: record.amount,
        currency: record.currency,
        payerId: record.payerId,
        payerUsername: record.payerUsername,
        payerName: record.payerName,
        createdAt: record.createdAt,
        latestAtMs: record.createdAtMs,
        firstSeenAtMs: record.createdAtMs,
      })
      continue
    }

    if (record.createdAtMs > 0 && (existing.firstSeenAtMs === 0 || record.createdAtMs < existing.firstSeenAtMs)) {
      existing.firstSeenAtMs = record.createdAtMs
    }

    if (record.createdAtMs >= existing.latestAtMs) {
      existing.id = record.id
      existing.paymentId = record.paymentId
      existing.method = record.method
      existing.status = record.status
      existing.amount = record.amount
      existing.currency = record.currency
      existing.payerId = record.payerId
      existing.payerUsername = record.payerUsername
      existing.payerName = record.payerName
      existing.createdAt = record.createdAt
      existing.latestAtMs = record.createdAtMs
    }
  }

  return Array.from(map.values()).sort((left, right) => right.latestAtMs - left.latestAtMs)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const { botId } = await params
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const filters: BotPaymentHistoryFilters = {
    period: normalizePaymentPeriod(searchParams.get('period') || undefined),
    search: searchParams.get('search') || undefined,
    method: searchParams.get('method') || undefined,
    status: searchParams.get('status') || undefined,
  }

  const period = normalizePaymentPeriod(filters.period)
  const search = String(filters.search || '').trim()
  const methodFilter = normalizePaymentMethod(filters.method)
  const statusFilter = normalizePaymentStatus(filters.status)
  const sinceIso = getPaymentPeriodSinceIso(period)

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 })
    }

    let query = supabase
      .from('bot_audit_events')
      .select('id, event_type, payload, created_at')
      .eq('bot_id', normalizedBotId)
      .in('event_type', [...PAYMENT_AUDIT_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(2000)

    if (sinceIso) {
      query = query.gte('created_at', sinceIso)
    }

    const auditResult = await query
    if (auditResult.error) {
      return NextResponse.json({ success: false, error: String(auditResult.error) }, { status: 500 })
    }

    const parsedRecords = ((Array.isArray(auditResult.data) ? auditResult.data : []) as BotAuditStatsRow[])
      .map(parsePaymentItemFromAuditRow)
      .filter((item): item is ParsedPaymentAuditRecord => Boolean(item))

    const aggregatedRecords = aggregatePaymentRecords(parsedRecords)

    const nowMs = Date.now()
    const expiredPendingRecords = aggregatedRecords.filter((item) => {
      const isPending = classifyPaymentStatus(item.status) === 'pending'
      const hasValidTimestamp = Number.isFinite(item.firstSeenAtMs) && item.firstSeenAtMs > 0
      if (!isPending || !hasValidTimestamp) {
        return false
      }
      return nowMs - item.firstSeenAtMs >= PAYMENT_AUTO_CANCEL_AFTER_MS
    })

    if (expiredPendingRecords.length > 0) {
      const autoCanceledAt = new Date(nowMs).toISOString()
      const cancelRows = expiredPendingRecords.map((item) => ({
        bot_id: normalizedBotId,
        source: 'system',
        event_type: 'payment.status_changed',
        payload: {
          paymentId: item.paymentId,
          method: item.method,
          provider: item.method,
          status: 'canceled',
          previousStatus: item.status,
          reason: 'timeout_4h',
          amount: item.amount,
          currency: item.currency,
          telegramUserId: item.payerId,
          username: item.payerUsername,
          autoCanceledAt,
        },
      }))

      const cancelResult = await supabase
        .from('bot_audit_events')
        .insert(cancelRows)

      if (!cancelResult.error) {
        for (const item of expiredPendingRecords) {
          item.status = 'canceled'
          item.createdAt = autoCanceledAt
          item.latestAtMs = nowMs
        }
      }
    }

    const parsedItems: BotPaymentHistoryItem[] = aggregatedRecords.map((item) => ({
      id: item.id,
      paymentId: item.paymentId,
      method: item.method,
      status: item.status,
      amount: item.amount,
      currency: item.currency,
      payerId: item.payerId,
      payerUsername: item.payerUsername,
      payerName: item.payerName,
      createdAt: item.createdAt,
    }))

    const methods = Array.from(
      new Set(parsedItems.map((item) => item.method).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))
    const statuses = Array.from(
      new Set(parsedItems.map((item) => item.status).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))

    const filteredItems = parsedItems.filter((item) => {
      if (search && !matchesPaymentSearch(item, search)) {
        return false
      }
      if (methodFilter !== 'unknown' && methodFilter !== 'all' && item.method !== methodFilter) {
        return false
      }
      if (statusFilter !== 'unknown' && statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      return true
    })

    const summary = filteredItems.reduce<BotPaymentHistory['summary']>(
      (acc, item) => {
        acc.totalCount += 1
        if (item.amount !== null) {
          acc.totalAmount += item.amount
        }

        const classification = classifyPaymentStatus(item.status)
        if (classification === 'success') acc.successCount += 1
        if (classification === 'pending') acc.pendingCount += 1
        if (classification === 'failed') acc.failedCount += 1
        return acc
      },
      {
        totalCount: 0,
        totalAmount: 0,
        successCount: 0,
        pendingCount: 0,
        failedCount: 0,
      }
    )

    const history: BotPaymentHistory = {
      period,
      methods,
      statuses,
      summary: {
        ...summary,
        totalAmount: Number(summary.totalAmount.toFixed(2)),
      },
      items: filteredItems.slice(0, 500),
    }

    return NextResponse.json({ success: true, history })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
