import { createAdminClient } from '@/lib/supabase/admin'

export type BotTestLogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface BotTestLogEntry {
  id: string
  ts: number
  level: BotTestLogLevel
  source: string
  message: string
}

interface BotTestLogQueueItem {
  botId: string
  runId: string | null
  entry: BotTestLogEntry
}

interface BotTestLogPersistenceState {
  queue: BotTestLogQueueItem[]
  timer: ReturnType<typeof setTimeout> | null
  flushing: boolean
}

interface PersistentBotLogReadOptions {
  sinceTs?: number
  limit?: number
  runId?: string | null
}

interface AppendBotTestLogOptions {
  runId?: string | null
}

type BotTestLogsWriteClient = {
  from: (table: string) => {
    upsert: (
      rows: Record<string, unknown>[],
      options: { onConflict: string; ignoreDuplicates: boolean }
    ) => Promise<{ error: unknown }>
  }
}

type BotTestLogsReadRow = {
  id: string
  ts_ms: number
  level: string
  source: string
  message: string
}

type BotTestLogsReadQuery = {
  eq: (column: string, value: unknown) => BotTestLogsReadQuery
  gt: (column: string, value: unknown) => BotTestLogsReadQuery
  order: (column: string, options: { ascending: boolean }) => BotTestLogsReadQuery
  limit: (count: number) => Promise<{ data: BotTestLogsReadRow[] | null; error: unknown }>
}

type BotTestLogsReadClient = {
  from: (table: string) => {
    select: (columns: string) => BotTestLogsReadQuery
  }
}

declare global {
  // Shared bot test logs across Next.js module reloads (dev HMR).
  var __tflowBotTestLogs: Map<string, BotTestLogEntry[]> | undefined
  // Shared log persistence queue across module reloads.
  var __tflowBotTestLogPersistenceState: BotTestLogPersistenceState | undefined
  // Shared current run context per bot to keep DB log rows grouped by test run.
  var __tflowBotTestLogRunContexts: Map<string, string> | undefined
}

const logStore: Map<string, BotTestLogEntry[]> =
  globalThis.__tflowBotTestLogs || new Map<string, BotTestLogEntry[]>()

if (!globalThis.__tflowBotTestLogs) {
  globalThis.__tflowBotTestLogs = logStore
}

const persistenceState: BotTestLogPersistenceState =
  globalThis.__tflowBotTestLogPersistenceState || {
    queue: [],
    timer: null,
    flushing: false,
  }

if (!globalThis.__tflowBotTestLogPersistenceState) {
  globalThis.__tflowBotTestLogPersistenceState = persistenceState
}

const runContextStore: Map<string, string> =
  globalThis.__tflowBotTestLogRunContexts || new Map<string, string>()

if (!globalThis.__tflowBotTestLogRunContexts) {
  globalThis.__tflowBotTestLogRunContexts = runContextStore
}

const MAX_LOGS_PER_BOT = 400
const MAX_LOG_MESSAGE_LENGTH = 4000
const PERSIST_BATCH_SIZE = 100
const PERSIST_FLUSH_DEBOUNCE_MS = 250

function normalizeRunId(value: unknown): string | null {
  const normalized = String(value || '').trim()
  return normalized || null
}

function canPersistBotLogs(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function redactSensitiveTokens(message: string): string {
  let normalized = message

  // Telegram bot token pattern: 123456789:AA...
  normalized = normalized.replace(
    /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/g,
    '[REDACTED_TELEGRAM_TOKEN]'
  )

  // Authorization bearer tokens in plain text logs.
  normalized = normalized.replace(
    /\b(Bearer)\s+[A-Za-z0-9._~-]+\b/gi,
    '$1 [REDACTED]'
  )

  // Obvious key=value secrets
  normalized = normalized.replace(
    /\b(supabase_service_role_key|webhookSecret|secret_token)\s*[:=]\s*([^\s,]+)/gi,
    '$1=[REDACTED]'
  )

  return normalized
}

function normalizeMessage(input: unknown): string {
  let message = ''

  if (typeof input === 'string') {
    message = input
  } else if (input instanceof Error) {
    message = input.message || String(input)
  } else {
    try {
      message = JSON.stringify(input)
    } catch {
      message = String(input)
    }
  }

  const sanitized = redactSensitiveTokens(message)
  if (sanitized.length <= MAX_LOG_MESSAGE_LENGTH) {
    return sanitized
  }

  return `${sanitized.slice(0, MAX_LOG_MESSAGE_LENGTH)}…[truncated]`
}

function normalizeLimit(limit?: number): number {
  return Math.max(1, Math.min(limit ?? 200, 500))
}

function schedulePersistentLogFlush(delayMs = PERSIST_FLUSH_DEBOUNCE_MS) {
  if (!canPersistBotLogs()) return
  if (persistenceState.timer || persistenceState.flushing) return

  persistenceState.timer = setTimeout(() => {
    persistenceState.timer = null
    void flushPersistentBotLogs()
  }, delayMs)
}

async function flushPersistentBotLogs() {
  if (!canPersistBotLogs()) {
    persistenceState.queue.length = 0
    return
  }

  if (persistenceState.flushing) {
    return
  }

  persistenceState.flushing = true

  try {
    const supabase = createAdminClient() as unknown as BotTestLogsWriteClient

    while (persistenceState.queue.length > 0) {
      const batch = persistenceState.queue.splice(0, PERSIST_BATCH_SIZE)
      const rows = batch.map((item) => ({
        id: item.entry.id,
        bot_id: item.botId,
        run_id: item.runId,
        ts_ms: item.entry.ts,
        ts: new Date(item.entry.ts).toISOString(),
        level: item.entry.level,
        source: item.entry.source,
        message: item.entry.message,
      }))

      const { error } = await supabase
        .from('bot_test_logs')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })

      if (error) {
        console.error('Failed to persist bot test logs:', error)
        persistenceState.queue.unshift(...batch)
        schedulePersistentLogFlush(1000)
        break
      }
    }
  } catch (error) {
    console.error('Bot log persistence crashed:', error)
    schedulePersistentLogFlush(1000)
  } finally {
    persistenceState.flushing = false
    if (persistenceState.queue.length > 0) {
      schedulePersistentLogFlush()
    }
  }
}

function queuePersistentBotLog(botId: string, runId: string | null, entry: BotTestLogEntry) {
  if (!canPersistBotLogs()) return
  persistenceState.queue.push({ botId, runId, entry })
  schedulePersistentLogFlush()
}

export function setBotTestLogRunContext(botId: string, runId: string | null | undefined) {
  const normalizedRunId = normalizeRunId(runId)
  if (!normalizedRunId) {
    runContextStore.delete(botId)
    return
  }
  runContextStore.set(botId, normalizedRunId)
}

export function getBotTestLogRunContext(botId: string): string | null {
  return normalizeRunId(runContextStore.get(botId))
}

export function appendBotTestLog(
  botId: string,
  source: string,
  message: unknown,
  level: BotTestLogLevel = 'info',
  options?: AppendBotTestLogOptions
): BotTestLogEntry {
  const entry: BotTestLogEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    level,
    source,
    message: normalizeMessage(message),
  }

  const current = logStore.get(botId) || []
  const next = [...current, entry]
  if (next.length > MAX_LOGS_PER_BOT) {
    next.splice(0, next.length - MAX_LOGS_PER_BOT)
  }
  logStore.set(botId, next)

  queuePersistentBotLog(
    botId,
    normalizeRunId(options?.runId) || getBotTestLogRunContext(botId),
    entry
  )

  return entry
}

export async function getPersistentBotTestLogs(
  botId: string,
  options?: PersistentBotLogReadOptions
): Promise<BotTestLogEntry[]> {
  if (!canPersistBotLogs()) {
    return []
  }

  try {
    const supabase = createAdminClient() as unknown as BotTestLogsReadClient
    const limit = normalizeLimit(options?.limit)
    let query = supabase
      .from('bot_test_logs')
      .select('id, ts_ms, level, source, message')
      .eq('bot_id', botId)
      .order('ts_ms', { ascending: false })

    if (typeof options?.sinceTs === 'number') {
      query = query.gt('ts_ms', options.sinceTs)
    }

    const runId = normalizeRunId(options?.runId)
    if (runId) {
      query = query.eq('run_id', runId)
    }

    const { data, error } = await query.limit(limit)
    if (error) {
      console.error('Failed to read persistent bot test logs:', error)
      return []
    }

    const rows = Array.isArray(data) ? data : []
    return rows
      .map((row) => ({
        id: String(row.id),
        ts: Number(row.ts_ms || Date.now()),
        level: (String(row.level || 'info') as BotTestLogLevel),
        source: String(row.source || 'system'),
        message: normalizeMessage(row.message),
      }))
      .sort((left, right) => left.ts - right.ts)
  } catch (error) {
    console.error('Persistent bot test log read crashed:', error)
    return []
  }
}

export function getBotTestLogs(botId: string, options?: { sinceTs?: number; limit?: number }): BotTestLogEntry[] {
  const all = logStore.get(botId) || []
  const sinceTs = options?.sinceTs
  const filtered = typeof sinceTs === 'number'
    ? all.filter((entry) => entry.ts > sinceTs)
    : all

  const limit = normalizeLimit(options?.limit)
  if (filtered.length <= limit) {
    return filtered
  }
  return filtered.slice(filtered.length - limit)
}

export function mergeBotTestLogs(
  ...groups: BotTestLogEntry[][]
): BotTestLogEntry[] {
  const merged = new Map<string, BotTestLogEntry>()
  for (const group of groups) {
    for (const entry of group || []) {
      merged.set(entry.id, entry)
    }
  }

  return [...merged.values()].sort((left, right) => left.ts - right.ts)
}

export function clearBotTestLogs(botId: string) {
  logStore.delete(botId)
}
