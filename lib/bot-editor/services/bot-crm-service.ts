import type {
  CrmFilters,
  CrmLeadRecord,
  CrmLeadTimelineEvent,
  CrmLeadsResponse,
  CrmOverview,
  LeadStage,
} from '@/lib/bot-editor/types/analytics.types'

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string, options?: Record<string, unknown>) => any
    insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => Promise<{ error: unknown }>
    update: (values: Record<string, unknown>) => any
  }
}

type BotRow = {
  id: string
  name: string | null
}

type SubscriberRow = {
  bot_id: string
  telegram_user_id: number
  telegram_chat_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  source: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  lead_stage: string | null
  lead_notes: string | null
  lead_tags: string[] | null
  lead_stage_updated_at: string | null
  last_incoming_at: string | null
  last_outgoing_at: string | null
  inbound_count: number | null
  outbound_count: number | null
}

const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'qualified', 'won', 'lost']

const MAX_LEAD_NOTES_LENGTH = 4000
const MAX_TAGS = 16
const MAX_TAG_LENGTH = 40
const MAX_EVENT_TEXT_LENGTH = 4000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value: unknown, maxLength = 255): string {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeLeadStage(value: unknown): LeadStage {
  const raw = String(value || '').trim().toLowerCase()
  if (LEAD_STAGES.includes(raw as LeadStage)) {
    return raw as LeadStage
  }
  return 'new'
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const result: string[] = []

  for (const tag of value) {
    const normalized = normalizeText(tag, MAX_TAG_LENGTH)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
    if (result.length >= MAX_TAGS) break
  }

  return result
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function periodToSinceIso(period: CrmFilters['period']): string | null {
  const now = Date.now()
  if (period === '24h') {
    return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  }
  if (period === '7d') {
    return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (period === '30d') {
    return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  return null
}

function mapSubscriberToLead(row: SubscriberRow, botName: string): CrmLeadRecord {
  return {
    botId: String(row.bot_id),
    botName,
    telegramUserId: toNumber(row.telegram_user_id),
    telegramChatId: row.telegram_chat_id ? toNumber(row.telegram_chat_id) : null,
    username: normalizeText(row.username, 128),
    firstName: normalizeText(row.first_name, 128),
    lastName: normalizeText(row.last_name, 128),
    languageCode: normalizeText(row.language_code, 16),
    leadStage: normalizeLeadStage(row.lead_stage),
    leadNotes: normalizeText(row.lead_notes, MAX_LEAD_NOTES_LENGTH),
    leadTags: normalizeTags(row.lead_tags),
    firstSeenAt: row.first_seen_at || null,
    lastSeenAt: row.last_seen_at || null,
    lastIncomingAt: row.last_incoming_at || null,
    lastOutgoingAt: row.last_outgoing_at || null,
    inboundCount: toNumber(row.inbound_count),
    outboundCount: toNumber(row.outbound_count),
  }
}

async function getOwnedBots(
  supabase: SupabaseLike,
  userId: string,
  filterBotId?: string
): Promise<BotRow[]> {
  let query = supabase
    .from('bots')
    .select('id, name')
    .eq('user_id', userId)

  if (filterBotId && filterBotId !== 'all') {
    query = query.eq('id', filterBotId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load owned bots: ${String(error)}`)
  }

  return (Array.isArray(data) ? data : []) as BotRow[]
}

async function findSubscriber(
  supabase: SupabaseLike,
  botId: string,
  telegramUserId: number
): Promise<SubscriberRow | null> {
  const { data, error } = await supabase
    .from('bot_subscribers')
    .select(
      'bot_id, telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at, lead_stage, lead_notes, lead_tags, lead_stage_updated_at, last_incoming_at, last_outgoing_at, inbound_count, outbound_count'
    )
    .eq('bot_id', botId)
    .eq('telegram_user_id', telegramUserId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch subscriber: ${String(error)}`)
  }

  if (!data || !isRecord(data)) return null
  return data as unknown as SubscriberRow
}

async function upsertInboundSubscriber(
  supabase: SupabaseLike,
  input: {
    botId: string
    telegramUserId: number
    telegramChatId?: number | null
    username?: string
    firstName?: string
    lastName?: string
    languageCode?: string
    source: 'message' | 'callback_query' | 'unknown'
  }
) {
  const existing = await findSubscriber(supabase, input.botId, input.telegramUserId)
  const nowIso = new Date().toISOString()

  if (existing) {
    const { error } = await supabase
      .from('bot_subscribers')
      .update({
        telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : existing.telegram_chat_id,
        username: input.username ? normalizeText(input.username, 128) : existing.username,
        first_name: input.firstName ? normalizeText(input.firstName, 128) : existing.first_name,
        last_name: input.lastName ? normalizeText(input.lastName, 128) : existing.last_name,
        language_code: input.languageCode ? normalizeText(input.languageCode, 16) : existing.language_code,
        source: input.source,
        last_seen_at: nowIso,
        last_incoming_at: nowIso,
        inbound_count: toNumber(existing.inbound_count) + 1,
      })
      .eq('bot_id', input.botId)
      .eq('telegram_user_id', input.telegramUserId)

    if (error) {
      throw new Error(`Failed to update subscriber inbound stats: ${String(error)}`)
    }
    return
  }

  const { error } = await supabase
    .from('bot_subscribers')
    .insert({
      bot_id: input.botId,
      telegram_user_id: input.telegramUserId,
      telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : null,
      username: input.username ? normalizeText(input.username, 128) : null,
      first_name: input.firstName ? normalizeText(input.firstName, 128) : null,
      last_name: input.lastName ? normalizeText(input.lastName, 128) : null,
      language_code: input.languageCode ? normalizeText(input.languageCode, 16) : null,
      source: input.source,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      lead_stage: 'new',
      lead_notes: null,
      lead_tags: [],
      lead_stage_updated_at: nowIso,
      last_incoming_at: nowIso,
      inbound_count: 1,
      outbound_count: 0,
    })

  if (error) {
    throw new Error(`Failed to insert subscriber inbound stats: ${String(error)}`)
  }
}

async function upsertOutboundSubscriber(
  supabase: SupabaseLike,
  input: {
    botId: string
    telegramUserId: number
    telegramChatId?: number | null
  }
) {
  const existing = await findSubscriber(supabase, input.botId, input.telegramUserId)
  const nowIso = new Date().toISOString()

  if (existing) {
    const { error } = await supabase
      .from('bot_subscribers')
      .update({
        telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : existing.telegram_chat_id,
        last_seen_at: nowIso,
        last_outgoing_at: nowIso,
        outbound_count: toNumber(existing.outbound_count) + 1,
      })
      .eq('bot_id', input.botId)
      .eq('telegram_user_id', input.telegramUserId)

    if (error) {
      throw new Error(`Failed to update subscriber outbound stats: ${String(error)}`)
    }
    return
  }

  const { error } = await supabase
    .from('bot_subscribers')
    .insert({
      bot_id: input.botId,
      telegram_user_id: input.telegramUserId,
      telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : null,
      source: 'unknown',
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      lead_stage: 'new',
      lead_notes: null,
      lead_tags: [],
      lead_stage_updated_at: nowIso,
      last_outgoing_at: nowIso,
      inbound_count: 0,
      outbound_count: 1,
    })

  if (error) {
    throw new Error(`Failed to insert subscriber outbound stats: ${String(error)}`)
  }
}

async function insertContactEvent(
  supabase: SupabaseLike,
  input: {
    botId: string
    telegramUserId: number
    telegramChatId?: number | null
    direction: 'inbound' | 'outbound'
    eventKind: 'message_text' | 'callback' | 'media' | 'service'
    messageText?: string
    payload?: Record<string, unknown>
  }
) {
  const { error } = await supabase
    .from('bot_contact_events')
    .insert({
      bot_id: input.botId,
      telegram_user_id: input.telegramUserId,
      telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : null,
      direction: input.direction,
      event_kind: input.eventKind,
      message_text: normalizeText(input.messageText, MAX_EVENT_TEXT_LENGTH) || null,
      payload: isRecord(input.payload) ? input.payload : {},
      created_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to insert contact event: ${String(error)}`)
  }
}

export async function appendInboundContactEvent(
  supabase: SupabaseLike,
  input: {
    botId: string
    telegramUserId: number
    telegramChatId?: number | null
    username?: string
    firstName?: string
    lastName?: string
    languageCode?: string
    eventKind: 'message_text' | 'callback' | 'media' | 'service'
    messageText?: string
    payload?: Record<string, unknown>
  }
) {
  const botId = normalizeText(input.botId, 64)
  const telegramUserId = Number(input.telegramUserId)
  if (!botId || !Number.isFinite(telegramUserId) || telegramUserId <= 0) {
    return
  }

  const source: 'message' | 'callback_query' | 'unknown' =
    input.eventKind === 'callback' ? 'callback_query' : 'message'

  await upsertInboundSubscriber(supabase, {
    botId,
    telegramUserId,
    telegramChatId: input.telegramChatId ?? null,
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    languageCode: input.languageCode,
    source,
  })

  await insertContactEvent(supabase, {
    botId,
    telegramUserId,
    telegramChatId: input.telegramChatId ?? null,
    direction: 'inbound',
    eventKind: input.eventKind,
    messageText: input.messageText,
    payload: input.payload,
  })
}

export async function appendOutboundContactEvent(
  supabase: SupabaseLike,
  input: {
    botId: string
    telegramUserId: number
    telegramChatId?: number | null
    eventKind: 'message_text' | 'callback' | 'media' | 'service'
    messageText?: string
    payload?: Record<string, unknown>
  }
) {
  const botId = normalizeText(input.botId, 64)
  const telegramUserId = Number(input.telegramUserId)
  if (!botId || !Number.isFinite(telegramUserId) || telegramUserId <= 0) {
    return
  }

  await upsertOutboundSubscriber(supabase, {
    botId,
    telegramUserId,
    telegramChatId: input.telegramChatId ?? null,
  })

  await insertContactEvent(supabase, {
    botId,
    telegramUserId,
    telegramChatId: input.telegramChatId ?? null,
    direction: 'outbound',
    eventKind: input.eventKind,
    messageText: input.messageText,
    payload: input.payload,
  })
}

export async function getDashboardCrmOverview(
  supabase: SupabaseLike,
  userId: string,
  filters: CrmFilters = {}
): Promise<CrmOverview> {
  const bots = await getOwnedBots(supabase, userId, filters.botId)
  const botIds = bots.map((bot) => bot.id)

  if (botIds.length === 0) {
    return {
      totalLeads: 0,
      stageCounts: {
        new: 0,
        contacted: 0,
        qualified: 0,
        won: 0,
        lost: 0,
      },
      activeDialogs24h: 0,
      inbound24h: 0,
      outbound24h: 0,
    }
  }

  const sinceByPeriod = periodToSinceIso(filters.period)
  const active24hSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const totalQuery = supabase
    .from('bot_subscribers')
    .select('id', { head: true, count: 'exact' })
    .in('bot_id', botIds)

  const totalWithPeriodQuery = sinceByPeriod ? totalQuery.gte('last_seen_at', sinceByPeriod) : totalQuery

  const [totalResult, activeResult, inboundResult, outboundResult, ...stageResults] = await Promise.all([
    totalWithPeriodQuery,
    supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)
      .gte('last_seen_at', active24hSince),
    supabase
      .from('bot_contact_events')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)
      .eq('direction', 'inbound')
      .gte('created_at', active24hSince),
    supabase
      .from('bot_contact_events')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)
      .eq('direction', 'outbound')
      .gte('created_at', active24hSince),
    ...LEAD_STAGES.map((stage) => {
      let query = supabase
        .from('bot_subscribers')
        .select('id', { head: true, count: 'exact' })
        .in('bot_id', botIds)
        .eq('lead_stage', stage)

      if (sinceByPeriod) {
        query = query.gte('last_seen_at', sinceByPeriod)
      }

      return query
    }),
  ])

  const stageCounts = LEAD_STAGES.reduce<Record<LeadStage, number>>((acc, stage, index) => {
    acc[stage] = toNumber((stageResults[index] as { count?: number | null })?.count, 0)
    return acc
  }, {
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  })

  return {
    totalLeads: toNumber((totalResult as { count?: number | null })?.count, 0),
    stageCounts,
    activeDialogs24h: toNumber((activeResult as { count?: number | null })?.count, 0),
    inbound24h: toNumber((inboundResult as { count?: number | null })?.count, 0),
    outbound24h: toNumber((outboundResult as { count?: number | null })?.count, 0),
  }
}

export async function getDashboardCrmLeads(
  supabase: SupabaseLike,
  userId: string,
  filters: CrmFilters = {},
  pagination?: { page?: number; pageSize?: number }
): Promise<CrmLeadsResponse> {
  const page = Math.max(1, Number(pagination?.page || 1))
  const pageSize = Math.max(1, Math.min(100, Number(pagination?.pageSize || 25)))
  const bots = await getOwnedBots(supabase, userId, filters.botId)
  const botIds = bots.map((bot) => bot.id)

  if (botIds.length === 0) {
    return { items: [], total: 0, page, pageSize }
  }

  const botsMap = new Map<string, string>(bots.map((bot) => [bot.id, normalizeText(bot.name, 128) || bot.id]))
  const sinceIso = periodToSinceIso(filters.period)
  const normalizedSearch = normalizeText(filters.search, 128).replace(/,/g, ' ')
  const maybeUserIdSearch = Number(normalizedSearch)

  let query = supabase
    .from('bot_subscribers')
    .select(
      'bot_id, telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at, lead_stage, lead_notes, lead_tags, lead_stage_updated_at, last_incoming_at, last_outgoing_at, inbound_count, outbound_count',
      { count: 'exact' }
    )
    .in('bot_id', botIds)

  if (filters.stage && filters.stage !== 'all') {
    query = query.eq('lead_stage', normalizeLeadStage(filters.stage))
  }

  if (sinceIso) {
    query = query.gte('last_seen_at', sinceIso)
  }

  if (normalizedSearch) {
    const escaped = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const clauses = [
      `username.ilike.%${escaped}%`,
      `first_name.ilike.%${escaped}%`,
      `last_name.ilike.%${escaped}%`,
    ]
    if (Number.isFinite(maybeUserIdSearch) && maybeUserIdSearch > 0) {
      clauses.push(`telegram_user_id.eq.${Math.round(maybeUserIdSearch)}`)
    }
    query = query.or(clauses.join(','))
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query
    .order('last_seen_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(`Failed to fetch CRM leads: ${String(error)}`)
  }

  const rows = (Array.isArray(data) ? data : []) as SubscriberRow[]
  const items = rows.map((row) => mapSubscriberToLead(row, botsMap.get(String(row.bot_id)) || String(row.bot_id)))

  return {
    items,
    total: toNumber(count, 0),
    page,
    pageSize,
  }
}

export async function getLeadTimeline(
  supabase: SupabaseLike,
  userId: string,
  botId: string,
  telegramUserId: number,
  pagination?: { cursor?: string | null; limit?: number }
): Promise<CrmLeadTimelineEvent[]> {
  const normalizedBotId = normalizeText(botId, 64)
  const normalizedTelegramUserId = Number(telegramUserId)
  if (!normalizedBotId || !Number.isFinite(normalizedTelegramUserId) || normalizedTelegramUserId <= 0) {
    return []
  }

  const ownedBots = await getOwnedBots(supabase, userId, normalizedBotId)
  if (ownedBots.length === 0) {
    return []
  }

  const limit = Math.max(1, Math.min(200, Number(pagination?.limit || 60)))
  const cursor = normalizeText(pagination?.cursor || '', 64)

  let query = supabase
    .from('bot_contact_events')
    .select('id, bot_id, telegram_user_id, telegram_chat_id, direction, event_kind, message_text, payload, created_at')
    .eq('bot_id', normalizedBotId)
    .eq('telegram_user_id', normalizedTelegramUserId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch lead timeline: ${String(error)}`)
  }

  const rows = Array.isArray(data) ? data : []
  return rows.map((row) => {
    const record = (row || {}) as Record<string, unknown>
    return {
      id: String(record.id || ''),
      botId: String(record.bot_id || normalizedBotId),
      telegramUserId: toNumber(record.telegram_user_id),
      telegramChatId: Number.isFinite(Number(record.telegram_chat_id))
        ? Number(record.telegram_chat_id)
        : null,
      direction: String(record.direction || 'inbound') === 'outbound' ? 'outbound' : 'inbound',
      eventKind: (() => {
        const raw = String(record.event_kind || '')
        if (raw === 'callback' || raw === 'media' || raw === 'service') return raw
        return 'message_text'
      })(),
      messageText: normalizeText(record.message_text, MAX_EVENT_TEXT_LENGTH),
      payload: isRecord(record.payload) ? record.payload : {},
      createdAt: String(record.created_at || ''),
    }
  })
}

export async function updateLeadStage(
  supabase: SupabaseLike,
  userId: string,
  input: {
    botId: string
    telegramUserId: number
    stage: LeadStage
    notes?: string
    tags?: string[]
  }
): Promise<CrmLeadRecord | null> {
  const normalizedBotId = normalizeText(input.botId, 64)
  const normalizedTelegramUserId = Number(input.telegramUserId)
  if (!normalizedBotId || !Number.isFinite(normalizedTelegramUserId) || normalizedTelegramUserId <= 0) {
    return null
  }

  const ownedBots = await getOwnedBots(supabase, userId, normalizedBotId)
  if (ownedBots.length === 0) {
    return null
  }
  const botName = normalizeText(ownedBots[0]?.name, 128) || normalizedBotId

  const notes = normalizeText(input.notes, MAX_LEAD_NOTES_LENGTH) || null
  const tags = normalizeTags(input.tags || [])
  const stage = normalizeLeadStage(input.stage)
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('bot_subscribers')
    .update({
      lead_stage: stage,
      lead_notes: notes,
      lead_tags: tags,
      lead_stage_updated_at: nowIso,
    })
    .eq('bot_id', normalizedBotId)
    .eq('telegram_user_id', normalizedTelegramUserId)
    .select(
      'bot_id, telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at, lead_stage, lead_notes, lead_tags, lead_stage_updated_at, last_incoming_at, last_outgoing_at, inbound_count, outbound_count'
    )
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to update lead stage: ${String(error)}`)
  }

  if (!data || !isRecord(data)) {
    return null
  }

  await insertContactEvent(supabase, {
    botId: normalizedBotId,
    telegramUserId: normalizedTelegramUserId,
    telegramChatId: Number.isFinite(Number((data as Record<string, unknown>).telegram_chat_id))
      ? Number((data as Record<string, unknown>).telegram_chat_id)
      : null,
    direction: 'outbound',
    eventKind: 'service',
    messageText: `Lead stage changed to ${stage}`,
    payload: {
      stage,
      notes,
      tags,
      source: 'crm',
    },
  })

  return mapSubscriberToLead(data as unknown as SubscriberRow, botName)
}
