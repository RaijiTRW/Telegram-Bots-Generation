import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import type {
  BotSubscriberItem,
  BotSubscribersAnalytics,
  BotSubscribersPeriod,
  BotSubscribersSource,
} from '@/lib/bot-editor/types/analytics.types'

type BotSubscriberRow = {
  telegram_user_id: number | null
  telegram_chat_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  source: string | null
  first_seen_at: string | null
  last_seen_at: string | null
}

const SUBSCRIBERS_PERIOD_MS: Record<Exclude<BotSubscribersPeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function normalizePeriod(rawPeriod: string | undefined): BotSubscribersPeriod {
  if (rawPeriod === '24h' || rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === 'all') {
    return rawPeriod
  }
  return '30d'
}

function normalizeSource(rawSource: string | undefined): BotSubscribersSource | 'all' {
  if (rawSource === 'message' || rawSource === 'callback_query' || rawSource === 'unknown') {
    return rawSource
  }
  return 'all'
}

function normalizePage(rawPage: string | undefined): number {
  const page = Number(rawPage)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.floor(page)
}

function normalizePageSize(rawPageSize: string | undefined): number {
  const pageSize = Number(rawPageSize)
  if (!Number.isFinite(pageSize) || pageSize < 1) return 25
  return Math.min(100, Math.floor(pageSize))
}

function getSinceIso(period: BotSubscribersPeriod): string | null {
  if (period === 'all') return null
  return new Date(Date.now() - SUBSCRIBERS_PERIOD_MS[period]).toISOString()
}

function sanitizeSearch(rawSearch: string): string {
  return rawSearch
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeSourceValue(rawSource: unknown): BotSubscribersSource {
  const normalized = String(rawSource || '').trim().toLowerCase()
  if (normalized === 'message' || normalized === 'callback_query') {
    return normalized
  }
  return 'unknown'
}

function rowToSubscriberItem(row: BotSubscriberRow): BotSubscriberItem {
  return {
    telegramUserId: Number(row.telegram_user_id || 0),
    telegramChatId: Number.isFinite(Number(row.telegram_chat_id)) ? Number(row.telegram_chat_id) : null,
    username: String(row.username || ''),
    firstName: String(row.first_name || ''),
    lastName: String(row.last_name || ''),
    languageCode: String(row.language_code || ''),
    source: normalizeSourceValue(row.source),
    firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  }
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
  const period = normalizePeriod(searchParams.get('period') || undefined)
  const sourceFilter = normalizeSource(searchParams.get('source') || undefined)
  const search = sanitizeSearch(String(searchParams.get('search') || ''))
  const page = normalizePage(searchParams.get('page') || undefined)
  const pageSize = normalizePageSize(searchParams.get('pageSize') || undefined)
  const sinceIso = getSinceIso(period)

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 })
    }

    const totalResult = await supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)
      .limit(1)

    if (totalResult.error) {
      return NextResponse.json({ success: false, error: String(totalResult.error) }, { status: 500 })
    }

    let activeQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)
      .limit(1)

    if (sinceIso) {
      activeQuery = activeQuery.gte('last_seen_at', sinceIso)
    }

    if (sourceFilter !== 'all') {
      activeQuery = activeQuery.eq('source', sourceFilter)
    }

    const activeResult = await activeQuery
    if (activeResult.error) {
      return NextResponse.json({ success: false, error: String(activeResult.error) }, { status: 500 })
    }

    let newQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)
      .limit(1)

    if (sinceIso) {
      newQuery = newQuery.gte('first_seen_at', sinceIso)
    }

    if (sourceFilter !== 'all') {
      newQuery = newQuery.eq('source', sourceFilter)
    }

    const newResult = await newQuery
    if (newResult.error) {
      return NextResponse.json({ success: false, error: String(newResult.error) }, { status: 500 })
    }

    let analyticsQuery = supabase
      .from('bot_subscribers')
      .select('source, language_code, last_seen_at')
      .eq('bot_id', normalizedBotId)
      .order('last_seen_at', { ascending: false })
      .limit(2000)

    if (sinceIso) {
      analyticsQuery = analyticsQuery.gte('last_seen_at', sinceIso)
    }

    if (sourceFilter !== 'all') {
      analyticsQuery = analyticsQuery.eq('source', sourceFilter)
    }

    const analyticsResult = await analyticsQuery
    if (analyticsResult.error) {
      return NextResponse.json({ success: false, error: String(analyticsResult.error) }, { status: 500 })
    }

    let listQuery = supabase
      .from('bot_subscribers')
      .select(
        'telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at',
        { count: 'exact' }
      )
      .eq('bot_id', normalizedBotId)
      .order('last_seen_at', { ascending: false })

    if (sinceIso) {
      listQuery = listQuery.gte('last_seen_at', sinceIso)
    }

    if (sourceFilter !== 'all') {
      listQuery = listQuery.eq('source', sourceFilter)
    }

    if (search) {
      const numericSearch = Number(search)
      if (Number.isFinite(numericSearch)) {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,telegram_user_id.eq.${Math.round(numericSearch)}`
        )
      } else {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
        )
      }
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const listResult = await listQuery.range(from, to)
    if (listResult.error) {
      return NextResponse.json({ success: false, error: String(listResult.error) }, { status: 500 })
    }

    const analyticsRows = (Array.isArray(analyticsResult.data) ? analyticsResult.data : []) as Array<Record<string, unknown>>
    const listRows = (Array.isArray(listResult.data) ? listResult.data : []) as BotSubscriberRow[]

    const sourceCounts: Record<BotSubscribersSource, number> = {
      message: 0,
      callback_query: 0,
      unknown: 0,
    }
    const languageCounts = new Map<string, number>()

    for (const row of analyticsRows) {
      const source = normalizeSourceValue(row.source)
      sourceCounts[source] += 1

      const languageCode = String(row.language_code || '').trim().toLowerCase()
      if (languageCode) {
        languageCounts.set(languageCode, (languageCounts.get(languageCode) || 0) + 1)
      }
    }

    const topLanguages = Array.from(languageCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([code, count]) => ({ code, count }))

    const items = listRows.map(rowToSubscriberItem)
    const lastSeenAt = analyticsRows.length
      ? String((analyticsRows[0] as Record<string, unknown>).last_seen_at || '') || null
      : null

    const payload: BotSubscribersAnalytics = {
      period,
      page,
      pageSize,
      total: Number(listResult.count || 0),
      summary: {
        totalSubscribers: Number(totalResult.count || 0),
        activeInPeriod: Number(activeResult.count || 0),
        newInPeriod: Number(newResult.count || 0),
        lastSeenAt,
      },
      sourceCounts,
      topLanguages,
      items,
    }

    return NextResponse.json({ success: true, data: payload })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
