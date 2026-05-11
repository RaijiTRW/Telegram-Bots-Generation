import type {
  CrmFilters,
  CrmBoard,
  CrmBoardFilters,
  CrmCard,
  CrmCardEvent,
  CrmField,
  CrmFieldType,
  CrmLeadRecord,
  CrmLeadTimelineEvent,
  CrmLeadsResponse,
  CrmOverview,
  CrmPipeline,
  CrmScope,
  CrmStage,
  LeadStage,
  UpsertCrmCardInput,
  UpsertCrmFieldInput,
  UpsertCrmStageInput,
} from '@/lib/bot-editor/types/analytics.types'

type SupabaseQueryLike = PromiseLike<{
  data?: unknown
  error?: unknown
  count?: number | null
}> & {
  select: (columns: string, options?: Record<string, unknown>) => SupabaseQueryLike
  insert: (values: Record<string, unknown> | Array<Record<string, unknown>>) => SupabaseQueryLike
  update: (values: Record<string, unknown>) => SupabaseQueryLike
  delete: () => SupabaseQueryLike
  eq: (column: string, value: unknown) => SupabaseQueryLike
  in: (column: string, values: unknown[]) => SupabaseQueryLike
  is: (column: string, value: unknown) => SupabaseQueryLike
  gte: (column: string, value: unknown) => SupabaseQueryLike
  lt: (column: string, value: unknown) => SupabaseQueryLike
  or: (filters: string) => SupabaseQueryLike
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryLike
  range: (from: number, to: number) => SupabaseQueryLike
  limit: (count: number) => SupabaseQueryLike
  maybeSingle: () => Promise<{ data?: unknown; error?: unknown }>
  single: () => Promise<{ data?: unknown; error?: unknown }>
}

type SupabaseLike = {
  from: (table: string) => SupabaseQueryLike
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
const DEFAULT_CRM_STAGES = [
  { key: 'new', name: 'Новая', color: '#38bdf8', sortOrder: 10, isTerminal: false },
  { key: 'in_progress', name: 'В работе', color: '#8b5cf6', sortOrder: 20, isTerminal: false },
  { key: 'waiting', name: 'Ожидает', color: '#f59e0b', sortOrder: 30, isTerminal: false },
  { key: 'won', name: 'Успешно', color: '#10b981', sortOrder: 40, isTerminal: true },
  { key: 'lost', name: 'Потеряно', color: '#ef4444', sortOrder: 50, isTerminal: true },
]

const DEFAULT_CRM_FIELDS: Array<{
  key: string
  name: string
  type: CrmFieldType
  sortOrder: number
}> = [
  { key: 'name', name: 'Имя', type: 'text', sortOrder: 10 },
  { key: 'phone', name: 'Телефон', type: 'phone', sortOrder: 20 },
  { key: 'comment', name: 'Комментарий', type: 'textarea', sortOrder: 30 },
  { key: 'date_time', name: 'Дата/время', type: 'datetime', sortOrder: 40 },
  { key: 'amount', name: 'Сумма', type: 'number', sortOrder: 50 },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function formatSupabaseError(error: unknown): string {
  if (!error) return 'unknown error'
  if (error instanceof Error) return error.message
  if (isRecord(error)) {
    const parts = [
      typeof error.code === 'string' ? error.code : '',
      typeof error.message === 'string' ? error.message : '',
      typeof error.details === 'string' ? error.details : '',
      typeof error.hint === 'string' ? error.hint : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' — ')
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown object error'
    }
  }
  return String(error)
}

function isCrmSchemaMissingError(error: unknown): boolean {
  const formatted = formatSupabaseError(error).toLowerCase()
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : ''
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (
      formatted.includes('crm_pipelines') &&
      (
        formatted.includes('schema cache') ||
        formatted.includes('does not exist') ||
        formatted.includes('could not find the table')
      )
    )
  )
}

function createMissingCrmSchemaError(error: unknown): Error {
  return new Error(
    `CRM tables are not installed in Supabase. Apply migration supabase/migrations/20260510175753_create_flexible_crm.sql and run "notify pgrst, 'reload schema';". Supabase: ${formatSupabaseError(error)}`
  )
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
    throw new Error(`Failed to load owned bots: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to fetch subscriber: ${formatSupabaseError(error)}`)
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
      throw new Error(`Failed to update subscriber inbound stats: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to insert subscriber inbound stats: ${formatSupabaseError(error)}`)
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
      throw new Error(`Failed to update subscriber outbound stats: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to insert subscriber outbound stats: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to insert contact event: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to fetch CRM leads: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to fetch lead timeline: ${formatSupabaseError(error)}`)
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
    throw new Error(`Failed to update lead stage: ${formatSupabaseError(error)}`)
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

function normalizeCrmScope(value: unknown): CrmScope {
  return String(value || '').trim() === 'bot' ? 'bot' : 'global'
}

function normalizeFieldType(value: unknown): CrmFieldType {
  const raw = String(value || '').trim()
  if (
    raw === 'textarea' ||
    raw === 'number' ||
    raw === 'date' ||
    raw === 'datetime' ||
    raw === 'phone' ||
    raw === 'email' ||
    raw === 'select' ||
    raw === 'checkbox'
  ) {
    return raw
  }
  return 'text'
}

function normalizeKey(value: unknown, fallback: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
  return normalized || fallback
}

function normalizeFieldValues(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  return { ...value }
}

function normalizeStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const normalized = normalizeText(item, 80)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
    if (result.length >= 50) break
  }
  return result
}

function mapCrmPipeline(row: Record<string, unknown>): CrmPipeline {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    botId: row.bot_id ? String(row.bot_id) : null,
    scope: normalizeCrmScope(row.scope),
    name: normalizeText(row.name, 160) || 'CRM',
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

function mapCrmStage(row: Record<string, unknown>): CrmStage {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    pipelineId: String(row.pipeline_id || ''),
    key: normalizeKey(row.key, 'stage'),
    name: normalizeText(row.name, 120) || 'Этап',
    color: normalizeText(row.color, 32) || '#38bdf8',
    sortOrder: toNumber(row.sort_order),
    isTerminal: Boolean(row.is_terminal),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

function mapCrmField(row: Record<string, unknown>): CrmField {
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    pipelineId: String(row.pipeline_id || ''),
    key: normalizeKey(row.key, 'field'),
    name: normalizeText(row.name, 120) || 'Поле',
    type: normalizeFieldType(row.type),
    options: normalizeStringOptions(row.options),
    required: Boolean(row.required),
    sortOrder: toNumber(row.sort_order),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

function mapCrmCard(
  row: Record<string, unknown>,
  stagesById: Map<string, CrmStage>,
  botsById: Map<string, string>
): CrmCard {
  const stageId = String(row.stage_id || '')
  const stage = stagesById.get(stageId)
  const botId = row.bot_id ? String(row.bot_id) : null
  return {
    id: String(row.id || ''),
    userId: String(row.user_id || ''),
    botId,
    botName: botId ? botsById.get(botId) || botId : null,
    pipelineId: String(row.pipeline_id || ''),
    stageId,
    stageKey: stage?.key || 'new',
    stageName: stage?.name || 'Новая',
    stageColor: stage?.color || '#38bdf8',
    title: normalizeText(row.title, 220) || 'Новая карточка',
    externalKey: normalizeText(row.external_key, 180),
    telegramUserId: Number.isFinite(Number(row.telegram_user_id)) ? Number(row.telegram_user_id) : null,
    telegramChatId: Number.isFinite(Number(row.telegram_chat_id)) ? Number(row.telegram_chat_id) : null,
    fieldValues: normalizeFieldValues(row.field_values),
    tags: normalizeTags(row.tags || []),
    notes: normalizeText(row.notes, MAX_LEAD_NOTES_LENGTH),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    stageUpdatedAt: String(row.stage_updated_at || row.updated_at || ''),
  }
}

function mapCrmCardEvent(row: Record<string, unknown>): CrmCardEvent {
  return {
    id: String(row.id || ''),
    cardId: String(row.card_id || ''),
    userId: String(row.user_id || ''),
    botId: row.bot_id ? String(row.bot_id) : null,
    eventType: normalizeText(row.event_type, 80) || 'event',
    payload: isRecord(row.payload) ? row.payload : {},
    createdAt: String(row.created_at || ''),
  }
}

async function loadCrmPipeline(
  supabase: SupabaseLike,
  userId: string,
  scope: CrmScope,
  botId?: string | null
): Promise<CrmPipeline | null> {
  let query = supabase.from('crm_pipelines')
    .select('id, user_id, bot_id, scope, name, is_default, created_at, updated_at')
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('is_default', true)

  query = scope === 'bot'
    ? query.eq('bot_id', botId)
    : query.is('bot_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) {
    if (isCrmSchemaMissingError(error)) {
      throw createMissingCrmSchemaError(error)
    }
    throw new Error(`Failed to load CRM pipeline: ${formatSupabaseError(error)}`)
  }

  return data && isRecord(data) ? mapCrmPipeline(data) : null
}

async function insertCrmPipeline(
  supabase: SupabaseLike,
  userId: string,
  scope: CrmScope,
  botId?: string | null,
  name?: string
): Promise<CrmPipeline> {
  const { data, error } = await supabase.from('crm_pipelines')
    .insert({
      user_id: userId,
      bot_id: scope === 'bot' ? botId : null,
      scope,
      name: normalizeText(name, 160) || (scope === 'bot' ? 'CRM бота' : 'Общая CRM'),
      is_default: true,
    })
    .select('id, user_id, bot_id, scope, name, is_default, created_at, updated_at')
    .single()

  if (error || !data || !isRecord(data)) {
    throw new Error(`Failed to create CRM pipeline: ${formatSupabaseError(error)}`)
  }

  return mapCrmPipeline(data)
}

async function ensureCrmDefaults(
  supabase: SupabaseLike,
  userId: string,
  scope: CrmScope,
  botId?: string | null,
  botName?: string | null
): Promise<{
  pipeline: CrmPipeline
  stages: CrmStage[]
  fields: CrmField[]
}> {
  let pipeline = await loadCrmPipeline(supabase, userId, scope, botId)
  if (!pipeline) {
    pipeline = await insertCrmPipeline(
      supabase,
      userId,
      scope,
      scope === 'bot' ? botId : null,
      scope === 'bot' ? `${normalizeText(botName, 120) || 'Бот'} CRM` : 'Общая CRM'
    )
  }

  const [stagesResult, fieldsResult] = await Promise.all([
    supabase.from('crm_stages')
      .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
      .eq('pipeline_id', pipeline.id)
      .order('sort_order', { ascending: true }),
    supabase.from('crm_fields')
      .select('id, user_id, pipeline_id, key, name, type, options, required, sort_order, created_at, updated_at')
      .eq('pipeline_id', pipeline.id)
      .order('sort_order', { ascending: true }),
  ])

  if (stagesResult.error) {
    throw new Error(`Failed to load CRM stages: ${String(stagesResult.error)}`)
  }
  if (fieldsResult.error) {
    throw new Error(`Failed to load CRM fields: ${String(fieldsResult.error)}`)
  }

  let stages = (Array.isArray(stagesResult.data) ? stagesResult.data : [])
    .filter(isRecord)
    .map(mapCrmStage)

  let fields = (Array.isArray(fieldsResult.data) ? fieldsResult.data : [])
    .filter(isRecord)
    .map(mapCrmField)

  if (stages.length === 0) {
    const { data, error } = await supabase.from('crm_stages')
      .insert(DEFAULT_CRM_STAGES.map((stage) => ({
        user_id: userId,
        pipeline_id: pipeline.id,
        key: stage.key,
        name: stage.name,
        color: stage.color,
        sort_order: stage.sortOrder,
        is_terminal: stage.isTerminal,
      })))
      .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
      .order('sort_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to create CRM stages: ${formatSupabaseError(error)}`)
    }
    stages = (Array.isArray(data) ? data : []).filter(isRecord).map(mapCrmStage)
  }

  if (fields.length === 0) {
    const { data, error } = await supabase.from('crm_fields')
      .insert(DEFAULT_CRM_FIELDS.map((field) => ({
        user_id: userId,
        pipeline_id: pipeline.id,
        key: field.key,
        name: field.name,
        type: field.type,
        options: [],
        required: false,
        sort_order: field.sortOrder,
      })))
      .select('id, user_id, pipeline_id, key, name, type, options, required, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to create CRM fields: ${formatSupabaseError(error)}`)
    }
    fields = (Array.isArray(data) ? data : []).filter(isRecord).map(mapCrmField)
  }

  return { pipeline, stages, fields }
}

async function getBotById(supabase: SupabaseLike, userId: string, botId: string): Promise<BotRow | null> {
  const normalizedBotId = normalizeText(botId, 80)
  if (!normalizedBotId) return null

  const { data, error } = await supabase.from('bots')
    .select('id, name')
    .eq('user_id', userId)
    .eq('id', normalizedBotId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load bot: ${formatSupabaseError(error)}`)
  }
  if (!data || !isRecord(data)) return null
  return { id: String(data.id || ''), name: data.name ? String(data.name) : null }
}

async function loadAllCrmStagesForPipelines(
  supabase: SupabaseLike,
  pipelineIds: string[]
): Promise<CrmStage[]> {
  if (pipelineIds.length === 0) return []
  const { data, error } = await supabase.from('crm_stages')
    .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
    .in('pipeline_id', pipelineIds)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Failed to load CRM board stages: ${formatSupabaseError(error)}`)
  }

  return (Array.isArray(data) ? data : []).filter(isRecord).map(mapCrmStage)
}

function mergeBoardStages(primaryStages: CrmStage[], allStages: CrmStage[]): CrmStage[] {
  const byKey = new Map<string, CrmStage>()
  for (const stage of primaryStages) {
    byKey.set(stage.key, stage)
  }
  for (const stage of allStages) {
    if (!byKey.has(stage.key)) {
      byKey.set(stage.key, stage)
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getFlexibleCrmBoard(
  supabase: SupabaseLike,
  userId: string,
  filters: CrmBoardFilters = {}
): Promise<CrmBoard> {
  const scope = normalizeCrmScope(filters.scope)
  const bots = await getOwnedBots(supabase, userId)
  const botsById = new Map<string, string>(
    bots.map((bot) => [bot.id, normalizeText(bot.name, 128) || bot.id])
  )
  const normalizedSearch = normalizeText(filters.search, 160)
  const botId = scope === 'bot' ? normalizeText(filters.botId, 80) : ''
  const selectedBot = scope === 'bot' ? await getBotById(supabase, userId, botId) : null

  if (scope === 'bot' && !selectedBot) {
    const fallback = bots[0] || null
    if (!fallback) {
      const defaults = await ensureCrmDefaults(supabase, userId, 'global', null)
      return {
        scope: 'global',
        botId: null,
        pipeline: defaults.pipeline,
        stages: defaults.stages,
        fields: defaults.fields,
        cards: [],
        bots: [],
      }
    }
    const board = await getFlexibleCrmBoard(supabase, userId, {
      scope: 'bot',
      botId: fallback.id,
      search: filters.search,
    })
    return board
  }

  const defaults = await ensureCrmDefaults(
    supabase,
    userId,
    scope,
    scope === 'bot' ? selectedBot?.id || null : null,
    selectedBot?.name || null
  )

  let pipelineIds = [defaults.pipeline.id]
  let allStages = defaults.stages
  if (scope === 'global') {
    const { data, error } = await supabase.from('crm_pipelines')
      .select('id')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to load CRM pipelines: ${formatSupabaseError(error)}`)
    }
    pipelineIds = (Array.isArray(data) ? data : [])
      .map((row) => (isRecord(row) ? String(row.id || '') : ''))
      .filter(Boolean)
    allStages = mergeBoardStages(defaults.stages, await loadAllCrmStagesForPipelines(supabase, pipelineIds))
  }

  const allStagesById = new Map<string, CrmStage>(allStages.map((stage) => [stage.id, stage]))
  let cardQuery = supabase.from('crm_cards')
    .select('id, user_id, bot_id, pipeline_id, stage_id, title, external_key, telegram_user_id, telegram_chat_id, field_values, tags, notes, created_at, updated_at, stage_updated_at')
    .eq('user_id', userId)
    .in('pipeline_id', pipelineIds)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (scope === 'bot' && selectedBot) {
    cardQuery = cardQuery.eq('bot_id', selectedBot.id)
  }

  if (normalizedSearch) {
    const escaped = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    cardQuery = cardQuery.or(`title.ilike.%${escaped}%,notes.ilike.%${escaped}%,external_key.ilike.%${escaped}%`)
  }

  const { data: cardData, error: cardError } = await cardQuery
  if (cardError) {
    throw new Error(`Failed to load CRM cards: ${formatSupabaseError(cardError)}`)
  }

  const cards = (Array.isArray(cardData) ? cardData : [])
    .filter(isRecord)
    .map((row) => mapCrmCard(row, allStagesById, botsById))

  return {
    scope,
    botId: scope === 'bot' ? selectedBot?.id || null : null,
    pipeline: defaults.pipeline,
    stages: allStages,
    fields: defaults.fields,
    cards,
    bots: bots.map((bot) => ({ id: bot.id, name: normalizeText(bot.name, 128) || bot.id })),
  }
}

export async function getCrmCardTimeline(
  supabase: SupabaseLike,
  userId: string,
  cardId: string,
  limit = 80
): Promise<CrmCardEvent[]> {
  const normalizedCardId = normalizeText(cardId, 80)
  if (!normalizedCardId) return []

  const { data, error } = await supabase.from('crm_card_events')
    .select('id, user_id, bot_id, card_id, event_type, payload, created_at')
    .eq('user_id', userId)
    .eq('card_id', normalizedCardId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(200, Number(limit) || 80)))

  if (error) {
    throw new Error(`Failed to load CRM card timeline: ${formatSupabaseError(error)}`)
  }

  return (Array.isArray(data) ? data : []).filter(isRecord).map(mapCrmCardEvent)
}

async function resolveCrmStage(
  supabase: SupabaseLike,
  userId: string,
  pipelineId: string,
  input?: { stageId?: string | null; stageKey?: string | null }
): Promise<CrmStage> {
  const stageId = normalizeText(input?.stageId, 80)
  const stageKey = normalizeKey(input?.stageKey, 'new')
  let query = supabase.from('crm_stages')
    .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
    .eq('user_id', userId)
    .eq('pipeline_id', pipelineId)

  query = stageId ? query.eq('id', stageId) : query.eq('key', stageKey)
  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(`Failed to resolve CRM stage: ${formatSupabaseError(error)}`)
  }

  if (data && isRecord(data)) {
    return mapCrmStage(data)
  }

  const fallback = await supabase.from('crm_stages')
    .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
    .eq('user_id', userId)
    .eq('pipeline_id', pipelineId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallback.error || !fallback.data || !isRecord(fallback.data)) {
    throw new Error(`CRM stage is not configured: ${String(fallback.error)}`)
  }

  return mapCrmStage(fallback.data)
}

async function insertCrmCardEvent(
  supabase: SupabaseLike,
  input: {
    userId: string
    botId?: string | null
    cardId: string
    eventType: string
    payload?: Record<string, unknown>
  }
) {
  await supabase.from('crm_card_events').insert({
    user_id: input.userId,
    bot_id: input.botId || null,
    card_id: input.cardId,
    event_type: normalizeText(input.eventType, 80) || 'event',
    payload: input.payload || {},
  })
}

export async function upsertCrmCard(
  supabase: SupabaseLike,
  userId: string,
  input: UpsertCrmCardInput
): Promise<CrmCard> {
  const title = normalizeText(input.title, 220) || 'Новая карточка'
  const scope = normalizeCrmScope(input.scope)
  const botId = normalizeText(input.botId, 80) || null
  const bot = botId ? await getBotById(supabase, userId, botId) : null
  const defaults = input.pipelineId
    ? null
    : await ensureCrmDefaults(supabase, userId, bot ? 'bot' : scope, bot?.id || null, bot?.name || null)
  const pipelineId = normalizeText(input.pipelineId, 80) || defaults?.pipeline.id || ''
  if (!pipelineId) {
    throw new Error('CRM pipeline is required')
  }
  const stage = await resolveCrmStage(supabase, userId, pipelineId, {
    stageId: input.stageId,
    stageKey: input.stageKey,
  })
  const externalKey = normalizeText(input.externalKey, 180) || null
  const nowIso = new Date().toISOString()
  const patch = {
    user_id: userId,
    bot_id: bot?.id || botId || null,
    pipeline_id: pipelineId,
    stage_id: stage.id,
    title,
    external_key: externalKey,
    telegram_user_id: Number.isFinite(Number(input.telegramUserId)) ? Number(input.telegramUserId) : null,
    telegram_chat_id: Number.isFinite(Number(input.telegramChatId)) ? Number(input.telegramChatId) : null,
    field_values: normalizeFieldValues(input.fieldValues),
    tags: normalizeTags(input.tags || []),
    notes: normalizeText(input.notes, MAX_LEAD_NOTES_LENGTH) || null,
    updated_at: nowIso,
    stage_updated_at: nowIso,
  }

  let existingId = normalizeText(input.id, 80)
  if (!existingId && externalKey) {
    const { data, error } = await supabase.from('crm_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('pipeline_id', pipelineId)
      .eq('external_key', externalKey)
      .maybeSingle()
    if (error) {
      throw new Error(`Failed to find CRM card: ${formatSupabaseError(error)}`)
    }
    if (data && isRecord(data)) {
      existingId = String(data.id || '')
    }
  }

  const mutation = existingId
    ? await supabase.from('crm_cards')
      .update(patch)
      .eq('user_id', userId)
      .eq('id', existingId)
      .select('id, user_id, bot_id, pipeline_id, stage_id, title, external_key, telegram_user_id, telegram_chat_id, field_values, tags, notes, created_at, updated_at, stage_updated_at')
      .single()
    : await supabase.from('crm_cards')
      .insert({
        ...patch,
        created_at: nowIso,
      })
      .select('id, user_id, bot_id, pipeline_id, stage_id, title, external_key, telegram_user_id, telegram_chat_id, field_values, tags, notes, created_at, updated_at, stage_updated_at')
      .single()

  if (mutation.error || !mutation.data || !isRecord(mutation.data)) {
    throw new Error(`Failed to save CRM card: ${String(mutation.error)}`)
  }

  await insertCrmCardEvent(supabase, {
    userId,
    botId: bot?.id || botId || null,
    cardId: String(mutation.data.id || ''),
    eventType: existingId ? 'card_updated' : 'card_created',
    payload: {
      title,
      externalKey,
      stageKey: stage.key,
    },
  })

  return mapCrmCard(mutation.data, new Map([[stage.id, stage]]), new Map(bot ? [[bot.id, bot.name || bot.id]] : []))
}

export async function moveCrmCard(
  supabase: SupabaseLike,
  userId: string,
  cardId: string,
  stageTarget: string
): Promise<CrmCard | null> {
  const normalizedCardId = normalizeText(cardId, 80)
  const normalizedStageTarget = normalizeText(stageTarget, 80)
  if (!normalizedCardId || !normalizedStageTarget) return null

  const { data: initialCardRow, error: cardError } = await supabase.from('crm_cards')
    .select('id, bot_id, pipeline_id')
    .eq('user_id', userId)
    .eq('id', normalizedCardId)
    .maybeSingle()
  if (cardError) {
    throw new Error(`Failed to load CRM card: ${formatSupabaseError(cardError)}`)
  }
  let cardRow: Record<string, unknown> | null = initialCardRow && isRecord(initialCardRow) ? initialCardRow : null
  if (!cardRow) {
    const fallbackResult = await supabase.from('crm_cards')
      .select('id, bot_id, pipeline_id')
      .eq('user_id', userId)
      .eq('external_key', normalizedCardId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (fallbackResult.error) {
      throw new Error(`Failed to load CRM card by external key: ${formatSupabaseError(fallbackResult.error)}`)
    }
    if (!fallbackResult.data || !isRecord(fallbackResult.data)) return null
    cardRow = fallbackResult.data
  }

  const targetStageResult = await supabase.from('crm_stages')
    .select('id, key, pipeline_id')
    .eq('user_id', userId)
    .eq('id', normalizedStageTarget)
    .maybeSingle()
  if (targetStageResult.error) {
    throw new Error(`Failed to resolve target CRM stage: ${String(targetStageResult.error)}`)
  }
  const targetStage = targetStageResult.data && isRecord(targetStageResult.data) ? targetStageResult.data : null
  const resolvedCardId = String(cardRow.id || normalizedCardId)
  const cardPipelineId = String(cardRow.pipeline_id || '')
  const stage = await resolveCrmStage(
    supabase,
    userId,
    cardPipelineId,
    targetStage && String(targetStage.pipeline_id || '') === cardPipelineId
      ? { stageId: normalizedStageTarget }
      : { stageKey: targetStage ? String(targetStage.key || 'new') : normalizedStageTarget }
  )

  const { data, error } = await supabase.from('crm_cards')
    .update({
      stage_id: stage.id,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', resolvedCardId)
    .select('id, user_id, bot_id, pipeline_id, stage_id, title, external_key, telegram_user_id, telegram_chat_id, field_values, tags, notes, created_at, updated_at, stage_updated_at')
    .single()

  if (error || !data || !isRecord(data)) {
    throw new Error(`Failed to move CRM card: ${formatSupabaseError(error)}`)
  }

  await insertCrmCardEvent(supabase, {
    userId,
    botId: data.bot_id ? String(data.bot_id) : null,
    cardId: resolvedCardId,
    eventType: 'stage_changed',
    payload: { stageId: stage.id, stageKey: stage.key, stageName: stage.name },
  })

  const bots = await getOwnedBots(supabase, userId)
  return mapCrmCard(
    data,
    new Map([[stage.id, stage]]),
    new Map(bots.map((bot) => [bot.id, normalizeText(bot.name, 128) || bot.id]))
  )
}

export async function upsertCrmStage(
  supabase: SupabaseLike,
  userId: string,
  input: UpsertCrmStageInput
): Promise<CrmStage> {
  const id = normalizeText(input.id, 80)
  const pipelineId = normalizeText(input.pipelineId, 80)
  if (!pipelineId) throw new Error('CRM pipeline is required')
  const payload = {
    user_id: userId,
    pipeline_id: pipelineId,
    key: normalizeKey(input.key || input.name, `stage_${Date.now()}`),
    name: normalizeText(input.name, 120) || 'Этап',
    color: normalizeText(input.color, 32) || '#38bdf8',
    sort_order: toNumber(input.sortOrder),
    is_terminal: Boolean(input.isTerminal),
    updated_at: new Date().toISOString(),
  }

  const mutation = id
    ? await supabase.from('crm_stages')
      .update(payload)
      .eq('user_id', userId)
      .eq('id', id)
      .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
      .single()
    : await supabase.from('crm_stages')
      .insert(payload)
      .select('id, user_id, pipeline_id, key, name, color, sort_order, is_terminal, created_at, updated_at')
      .single()

  if (mutation.error || !mutation.data || !isRecord(mutation.data)) {
    throw new Error(`Failed to save CRM stage: ${String(mutation.error)}`)
  }

  return mapCrmStage(mutation.data)
}

export async function deleteCrmStage(
  supabase: SupabaseLike,
  userId: string,
  stageId: string
): Promise<boolean> {
  const normalizedStageId = normalizeText(stageId, 80)
  if (!normalizedStageId) return false
  const { error } = await supabase.from('crm_stages')
    .delete()
    .eq('user_id', userId)
    .eq('id', normalizedStageId)
  if (error) {
    throw new Error(`Failed to delete CRM stage: ${formatSupabaseError(error)}`)
  }
  return true
}

export async function upsertCrmField(
  supabase: SupabaseLike,
  userId: string,
  input: UpsertCrmFieldInput
): Promise<CrmField> {
  const id = normalizeText(input.id, 80)
  const pipelineId = normalizeText(input.pipelineId, 80)
  if (!pipelineId) throw new Error('CRM pipeline is required')
  const payload = {
    user_id: userId,
    pipeline_id: pipelineId,
    key: normalizeKey(input.key || input.name, `field_${Date.now()}`),
    name: normalizeText(input.name, 120) || 'Поле',
    type: normalizeFieldType(input.type),
    options: normalizeStringOptions(input.options || []),
    required: Boolean(input.required),
    sort_order: toNumber(input.sortOrder),
    updated_at: new Date().toISOString(),
  }

  const mutation = id
    ? await supabase.from('crm_fields')
      .update(payload)
      .eq('user_id', userId)
      .eq('id', id)
      .select('id, user_id, pipeline_id, key, name, type, options, required, sort_order, created_at, updated_at')
      .single()
    : await supabase.from('crm_fields')
      .insert(payload)
      .select('id, user_id, pipeline_id, key, name, type, options, required, sort_order, created_at, updated_at')
      .single()

  if (mutation.error || !mutation.data || !isRecord(mutation.data)) {
    throw new Error(`Failed to save CRM field: ${String(mutation.error)}`)
  }

  return mapCrmField(mutation.data)
}

export async function deleteCrmField(
  supabase: SupabaseLike,
  userId: string,
  fieldId: string
): Promise<boolean> {
  const normalizedFieldId = normalizeText(fieldId, 80)
  if (!normalizedFieldId) return false
  const { error } = await supabase.from('crm_fields')
    .delete()
    .eq('user_id', userId)
    .eq('id', normalizedFieldId)
  if (error) {
    throw new Error(`Failed to delete CRM field: ${formatSupabaseError(error)}`)
  }
  return true
}
