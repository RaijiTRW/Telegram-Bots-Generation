import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getViewerAccess } from '@/lib/billing/server'
import { normalizeDashboardSettingsLocale, parseDashboardSettings } from '@/lib/dashboard-settings'
import type { ViewerAccess } from '@/lib/billing/types'
import type { DashboardAnalyticsEmailKind, DashboardGlobalStats, DashboardGlobalStatsPeriod } from '@/lib/bot-editor/types/analytics.types'
import { exportDashboardGlobalAnalyticsCsvAction, getDashboardGlobalStatsAction } from '@/lib/bot-editor/actions/editor-actions'
import { hasAnalyticsEmailTransportConfig, sendAnalyticsEmail } from '@/lib/dashboard-analytics/email'

type DigestCandidate = {
  userId: string
  email: string
  fullName: string
  locale: 'ru' | 'en'
  timeZone: string
  viewerAccess: ViewerAccess
  settings: ReturnType<typeof parseDashboardSettings>
}

type DigestRunCounters = {
  candidates: number
  weeklySent: number
  monthlySent: number
  anomalySent: number
  skipped: number
  failed: number
  transportConfigured: boolean
}

type DashboardAnalyticsDigestResult = DigestRunCounters & {
  details: Array<{ userId: string; email: string; kind: string; status: string; reason?: string }>
}

const DIGEST_SECRET_HEADER = 'x-analytics-digest-secret'

function getNowInTimeZone(timeZone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  })

  const parts = formatter.formatToParts(now)
  const read = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
    weekday: read('weekday'),
  }
}

function getIsoWeekPeriodKey(year: number, month: number, day: number) {
  const utcDate = new Date(Date.UTC(year, month - 1, day))
  const target = new Date(utcDate)
  const dayNr = (utcDate.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNr + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function getMonthlyPeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function getDailyPeriodKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function createDigestFingerprint(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

function buildAnalyticsEmailSubject(kind: DashboardAnalyticsEmailKind, locale: 'ru' | 'en') {
  if (locale === 'en') {
    if (kind === 'weekly_digest') return 'CBTooll weekly analytics digest'
    if (kind === 'monthly_summary') return 'CBTooll monthly analytics summary'
    return 'CBTooll anomaly alert'
  }

  if (kind === 'weekly_digest') return 'CBTooll: еженедельный аналитический дайджест'
  if (kind === 'monthly_summary') return 'CBTooll: ежемесячная аналитическая сводка'
  return 'CBTooll: обнаружены аномалии в аналитике'
}

function formatPercent(value: number, locale: 'ru' | 'en') {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSummaryLine(stats: DashboardGlobalStats, locale: 'ru' | 'en') {
  const money =
    stats.currencyMode === 'single'
      ? `${formatPercent(stats.basic.revenue, locale)} ${stats.currencies[0] || ''}`.trim()
      : locale === 'ru'
        ? 'смешанные валюты'
        : 'mixed currencies'

  if (locale === 'en') {
    return `Revenue: ${money}, successful payments: ${stats.basic.successfulPayments}, active users: ${stats.basic.activeSubscribers}, new users: ${stats.basic.newSubscribers}.`
  }

  return `Выручка: ${money}, успешные оплаты: ${stats.basic.successfulPayments}, активные пользователи: ${stats.basic.activeSubscribers}, новые пользователи: ${stats.basic.newSubscribers}.`
}

function buildDigestHtml(params: {
  kind: DashboardAnalyticsEmailKind
  locale: 'ru' | 'en'
  stats: DashboardGlobalStats
  fullName: string
}) {
  const { kind, locale, stats, fullName } = params
  const greeting = locale === 'en' ? `Hello${fullName ? `, ${fullName}` : ''}` : `Здравствуйте${fullName ? `, ${fullName}` : ''}`
  const heading =
    kind === 'weekly_digest'
      ? (locale === 'en' ? 'Weekly analytics digest' : 'Еженедельный аналитический дайджест')
      : kind === 'monthly_summary'
        ? (locale === 'en' ? 'Monthly analytics summary' : 'Ежемесячная аналитическая сводка')
        : (locale === 'en' ? 'Anomaly alert' : 'Обнаружены аномалии')

  const anomalyList = kind === 'anomaly_alert'
    ? stats.anomalies
        .map((item) => `<li>${locale === 'en' ? item.key.replace(/_/g, ' ') : item.key.replace(/_/g, ' ')}</li>`)
        .join('')
    : ''

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#0a0b0f;color:#ffffff;padding:24px">
      <div style="max-width:680px;margin:0 auto;border:1px solid rgba(255,255,255,.08);background:#111217;border-radius:20px;padding:28px">
        <div style="font-size:14px;color:#a1a1aa;margin-bottom:12px">${greeting}</div>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">${heading}</h1>
        <p style="margin:0 0 18px;color:#c4c4cc;line-height:1.6">${formatSummaryLine(stats, locale)}</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px">
          <div style="border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.02)">
            <div style="font-size:12px;color:#a1a1aa;margin-bottom:8px">${locale === 'en' ? 'Successful payments' : 'Успешные оплаты'}</div>
            <div style="font-size:28px;font-weight:700">${stats.basic.successfulPayments}</div>
          </div>
          <div style="border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:16px;background:rgba(255,255,255,.02)">
            <div style="font-size:12px;color:#a1a1aa;margin-bottom:8px">${locale === 'en' ? 'Active users' : 'Активные пользователи'}</div>
            <div style="font-size:28px;font-weight:700">${stats.basic.activeSubscribers}</div>
          </div>
        </div>
        ${
          kind === 'anomaly_alert'
            ? `<div style="border:1px solid rgba(239,68,68,.24);background:rgba(239,68,68,.10);border-radius:16px;padding:16px"><div style="font-size:14px;font-weight:600;margin-bottom:8px">${locale === 'en' ? 'What needs attention' : 'Что требует внимания'}</div><ul style="margin:0;padding-left:18px;color:#f4f4f5">${anomalyList || `<li>${locale === 'en' ? 'Revenue or conversion changed sharply.' : 'Выручка или доля оплат заметно изменились.'}</li>`}</ul></div>`
            : `<div style="font-size:13px;color:#a1a1aa">${locale === 'en' ? 'The attachment contains the full export for payments, subscribers, rankings, lost revenue, and retention.' : 'Во вложении лежит полный экспорт по оплатам, подписчикам, рейтингам ботов, потерянной выручке и удержанию.'}</div>`
        }
      </div>
    </div>
  `
}

function buildDigestText(params: {
  kind: DashboardAnalyticsEmailKind
  locale: 'ru' | 'en'
  stats: DashboardGlobalStats
}) {
  const { kind, locale, stats } = params
  const header =
    kind === 'weekly_digest'
      ? (locale === 'en' ? 'Weekly analytics digest' : 'Еженедельный аналитический дайджест')
      : kind === 'monthly_summary'
        ? (locale === 'en' ? 'Monthly analytics summary' : 'Ежемесячная аналитическая сводка')
        : (locale === 'en' ? 'Anomaly alert' : 'Обнаружены аномалии')

  const summary = formatSummaryLine(stats, locale)
  if (kind !== 'anomaly_alert') {
    return `${header}\n\n${summary}`
  }

  const anomalyLines = stats.anomalies.length
    ? stats.anomalies.map((item) => `- ${item.key}: ${item.deltaPercent ?? '—'}%`).join('\n')
    : (locale === 'en' ? '- Revenue or conversion changed sharply.' : '- Выручка или доля оплат заметно изменились.')

  return `${header}\n\n${summary}\n\n${anomalyLines}`
}

async function listAllAuthUsersById(targetUserIds: string[]) {
  const admin = createAdminClient()
  const targetSet = new Set(targetUserIds)
  const result = new Map<string, { email: string | null; userMetadata: unknown }>()
  let page = 1

  while (targetSet.size > 0) {
    const response = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (response.error) {
      throw new Error(`Failed to list auth users: ${response.error.message}`)
    }

    const users = response.data?.users || []
    if (!users.length) break

    for (const user of users) {
      if (!targetSet.has(user.id)) continue
      result.set(user.id, {
        email: user.email ?? null,
        userMetadata: user.user_metadata,
      })
      targetSet.delete(user.id)
    }

    if (users.length < 1000) break
    page += 1
  }

  return result
}

async function loadDigestCandidates(): Promise<DigestCandidate[]> {
  const admin = createAdminClient()
  const [{ data: subscriptions, error: subscriptionsError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      admin
        .from('user_subscriptions')
        .select('user_id, plan_code, status'),
      admin
        .from('profiles')
        .select('id, email, full_name, language, role'),
    ])

  if (subscriptionsError) {
    throw new Error(`Failed to load subscriptions: ${subscriptionsError.message}`)
  }
  if (profilesError) {
    throw new Error(`Failed to load profiles: ${profilesError.message}`)
  }

  const profileById = new Map(
    (profiles || []).map((profile) => [
      profile.id,
      {
        email: profile.email,
        fullName: profile.full_name || '',
        language: profile.language === 'en' ? 'en' : 'ru',
        role: profile.role,
      },
    ])
  )

  const candidateUserIds = new Set<string>()
  for (const row of subscriptions || []) {
    if (row.plan_code === 'enterprise') {
      candidateUserIds.add(row.user_id)
    }
  }
  for (const row of profiles || []) {
    if (row.role === 'admin') {
      candidateUserIds.add(row.id)
    }
  }

  if (!candidateUserIds.size) {
    return []
  }

  const authUsersById = await listAllAuthUsersById(Array.from(candidateUserIds))
  const candidates: DigestCandidate[] = []

  for (const userId of candidateUserIds) {
    const authUser = authUsersById.get(userId)
    const profile = profileById.get(userId)
    const viewerAccess = await getViewerAccess(userId)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.dashboardStatisticsPro)) continue

    const locale = normalizeDashboardSettingsLocale(profile?.language, 'ru')
    const settings = parseDashboardSettings(authUser?.userMetadata, locale)
    const email = authUser?.email || profile?.email || ''
    if (!email) continue

    candidates.push({
      userId,
      email,
      fullName: profile?.fullName || '',
      locale,
      timeZone: settings.preferences.timezone || 'UTC',
      viewerAccess,
      settings,
    })
  }

  return candidates
}

async function upsertDeliveryStatus(input: {
  userId: string
  kind: DashboardAnalyticsEmailKind
  periodKey: string
  fingerprint: string
  status: 'pending' | 'sent' | 'failed'
  error?: string | null
}) {
  const admin = createAdminClient()
  const payload = {
    user_id: input.userId,
    kind: input.kind,
    period_key: input.periodKey,
    fingerprint: input.fingerprint,
    delivery_channel: 'email',
    status: input.status,
    error: input.error || null,
    sent_at: input.status === 'sent' ? new Date().toISOString() : null,
  }

  const result = await admin
    .from('analytics_email_deliveries')
    .upsert(payload, {
      onConflict: 'user_id,kind,period_key,fingerprint',
      ignoreDuplicates: false,
    })

  if (result.error) {
    throw new Error(`Failed to write analytics delivery audit: ${result.error.message}`)
  }
}

async function hasDeliveryAlreadySent(input: {
  userId: string
  kind: DashboardAnalyticsEmailKind
  periodKey: string
  fingerprint: string
}) {
  const admin = createAdminClient()
  const result = await admin
    .from('analytics_email_deliveries')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('kind', input.kind)
    .eq('period_key', input.periodKey)
    .eq('fingerprint', input.fingerprint)
    .maybeSingle()

  if (result.error) {
    throw new Error(`Failed to check analytics delivery audit: ${result.error.message}`)
  }

  return Boolean(result.data && result.data.status === 'sent')
}

async function buildAttachment(
  candidate: DigestCandidate,
  period: DashboardGlobalStatsPeriod
) {
  const format = candidate.settings.notifications.digestFormat
  const exportResult = await exportDashboardGlobalAnalyticsCsvAction(
    'rankings',
    { period },
    format,
    {
      userId: candidate.userId,
      viewerAccess: candidate.viewerAccess,
    }
  )

  if (!exportResult.success) {
    throw new Error(exportResult.error || 'Failed to build digest attachment')
  }

  if (
    !('contentBase64' in exportResult)
    || !exportResult.contentBase64
    || !exportResult.filename
    || !exportResult.mimeType
  ) {
    throw new Error('Failed to build digest attachment')
  }

  const successExportResult = exportResult

  return {
    filename: successExportResult.filename,
    content: Buffer.from(successExportResult.contentBase64, 'base64'),
    contentType: successExportResult.mimeType,
  }
}

async function sendDigestEmail(input: {
  candidate: DigestCandidate
  kind: DashboardAnalyticsEmailKind
  period: DashboardGlobalStatsPeriod
  periodKey: string
  fingerprint: string
  attachWorkbook: boolean
}) {
  const { candidate, kind, period, periodKey, fingerprint, attachWorkbook } = input
  const statsResult = await getDashboardGlobalStatsAction(
    { period },
    { userId: candidate.userId, viewerAccess: candidate.viewerAccess }
  )

  if (!statsResult.success || !statsResult.stats) {
    throw new Error(statsResult.error || 'Failed to build analytics digest stats')
  }

  if (kind === 'anomaly_alert' && !statsResult.stats.anomalies.length) {
    return { sent: false, reason: 'no_anomalies' as const }
  }

  if (await hasDeliveryAlreadySent({
    userId: candidate.userId,
    kind,
    periodKey,
    fingerprint,
  })) {
    return { sent: false, reason: 'already_sent' as const }
  }

  await upsertDeliveryStatus({
    userId: candidate.userId,
    kind,
    periodKey,
    fingerprint,
    status: 'pending',
  })

  const attachment = attachWorkbook ? [await buildAttachment(candidate, period)] : undefined

  try {
    await sendAnalyticsEmail({
      to: candidate.email,
      subject: buildAnalyticsEmailSubject(kind, candidate.locale),
      text: buildDigestText({
        kind,
        locale: candidate.locale,
        stats: statsResult.stats,
      }),
      html: buildDigestHtml({
        kind,
        locale: candidate.locale,
        stats: statsResult.stats,
        fullName: candidate.fullName,
      }),
      attachments: attachment,
    })

    await upsertDeliveryStatus({
      userId: candidate.userId,
      kind,
      periodKey,
      fingerprint,
      status: 'sent',
    })

    return { sent: true, reason: 'sent' as const, stats: statsResult.stats }
  } catch (error) {
    await upsertDeliveryStatus({
      userId: candidate.userId,
      kind,
      periodKey,
      fingerprint,
      status: 'failed',
      error: String(error),
    })
    throw error
  }
}

export function getAnalyticsDigestSecretHeaderName() {
  return DIGEST_SECRET_HEADER
}

export async function runAnalyticsDigests(now = new Date()): Promise<DashboardAnalyticsDigestResult> {
  const transportConfigured = hasAnalyticsEmailTransportConfig()
  const counters: DashboardAnalyticsDigestResult = {
    candidates: 0,
    weeklySent: 0,
    monthlySent: 0,
    anomalySent: 0,
    skipped: 0,
    failed: 0,
    transportConfigured,
    details: [],
  }

  const candidates = await loadDigestCandidates()
  counters.candidates = candidates.length

  if (!transportConfigured) {
    counters.skipped = candidates.length
    counters.details = candidates.map((candidate) => ({
      userId: candidate.userId,
      email: candidate.email,
      kind: 'all',
      status: 'skipped',
      reason: 'transport_not_configured',
    }))
    return counters
  }

  for (const candidate of candidates) {
    const zonedNow = getNowInTimeZone(candidate.timeZone, now)

    if (candidate.settings.notifications.emailNotifications && candidate.settings.notifications.weeklyDigest && zonedNow.weekday === 'Mon' && zonedNow.hour === 9) {
      const periodKey = getIsoWeekPeriodKey(zonedNow.year, zonedNow.month, zonedNow.day)
      const fingerprint = createDigestFingerprint(`weekly:${periodKey}:7d`)
      try {
        const result = await sendDigestEmail({
          candidate,
          kind: 'weekly_digest',
          period: '7d',
          periodKey,
          fingerprint,
          attachWorkbook: true,
        })
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'weekly_digest',
          status: result.sent ? 'sent' : 'skipped',
          reason: result.reason,
        })
        if (result.sent) counters.weeklySent += 1
        else counters.skipped += 1
      } catch (error) {
        counters.failed += 1
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'weekly_digest',
          status: 'failed',
          reason: String(error),
        })
      }
    }

    if (candidate.settings.notifications.emailNotifications && candidate.settings.notifications.monthlyDigest && zonedNow.day === 1 && zonedNow.hour === 9) {
      const periodKey = getMonthlyPeriodKey(zonedNow.year, zonedNow.month)
      const fingerprint = createDigestFingerprint(`monthly:${periodKey}:30d`)
      try {
        const result = await sendDigestEmail({
          candidate,
          kind: 'monthly_summary',
          period: '30d',
          periodKey,
          fingerprint,
          attachWorkbook: true,
        })
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'monthly_summary',
          status: result.sent ? 'sent' : 'skipped',
          reason: result.reason,
        })
        if (result.sent) counters.monthlySent += 1
        else counters.skipped += 1
      } catch (error) {
        counters.failed += 1
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'monthly_summary',
          status: 'failed',
          reason: String(error),
        })
      }
    }

    if (candidate.settings.notifications.emailNotifications && candidate.settings.notifications.anomalyEmails) {
      const statsResult = await getDashboardGlobalStatsAction(
        { period: '24h' },
        { userId: candidate.userId, viewerAccess: candidate.viewerAccess }
      )

      if (!statsResult.success || !statsResult.stats) {
        counters.failed += 1
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'anomaly_alert',
          status: 'failed',
          reason: statsResult.error || 'Failed to compute anomaly stats',
        })
      } else if (!statsResult.stats.anomalies.length) {
        counters.skipped += 1
        counters.details.push({
          userId: candidate.userId,
          email: candidate.email,
          kind: 'anomaly_alert',
          status: 'skipped',
          reason: 'no_anomalies',
        })
      } else {
        const periodKey = getDailyPeriodKey(zonedNow.year, zonedNow.month, zonedNow.day)
        const fingerprint = createDigestFingerprint(
          statsResult.stats.anomalies.map((item) => `${item.key}:${item.deltaPercent ?? ''}`).sort().join('|')
        )

        try {
          const result = await sendDigestEmail({
            candidate,
            kind: 'anomaly_alert',
            period: '24h',
            periodKey,
            fingerprint,
            attachWorkbook: false,
          })
          counters.details.push({
            userId: candidate.userId,
            email: candidate.email,
            kind: 'anomaly_alert',
            status: result.sent ? 'sent' : 'skipped',
            reason: result.reason,
          })
          if (result.sent) counters.anomalySent += 1
          else counters.skipped += 1
        } catch (error) {
          counters.failed += 1
          counters.details.push({
            userId: candidate.userId,
            email: candidate.email,
            kind: 'anomaly_alert',
            status: 'failed',
            reason: String(error),
          })
        }
      }
    }
  }

  return counters
}
