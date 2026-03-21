type AsyncResult<T> = PromiseLike<T>

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string, options?: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => AsyncResult<{ data: unknown; error: unknown }>
          select: (columns?: string) => {
            limit: (value: number) => AsyncResult<{ error: unknown }>
          }
        }
        gte: (column: string, value: unknown) => {
          limit: (value: number) => AsyncResult<{ data: unknown; error: unknown; count?: number | null }>
        }
        order: (column: string, options?: { ascending?: boolean }) => {
          limit: (value: number) => AsyncResult<{ data: unknown; error: unknown }>
        }
        limit: (value: number) => AsyncResult<{ data: unknown; error: unknown; count?: number | null }>
      }
    }
    insert: (value: Record<string, unknown>) => AsyncResult<{ error: unknown }>
    update: (value: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          select: (columns?: string) => {
            limit: (value: number) => AsyncResult<{ error: unknown }>
          }
        }
      }
    }
  }
}

export interface SubscriberUserInput {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
}

export interface TrackBotSubscriberInput {
  botId: string
  chatId?: number | null
  source?: 'message' | 'callback_query' | 'unknown'
  user: SubscriberUserInput
}

export interface BotSubscriberPreview {
  telegramUserId: number
  username: string
  firstName: string
  lastName: string
  languageCode: string
  lastSeenAt: string
}

export interface BotSubscribersStats {
  totalSubscribers: number
  activeLast7Days: number
  lastSubscriberAt: string | null
  recentSubscribers: BotSubscriberPreview[]
}

function isNoRowsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = String((error as Record<string, unknown>).code || '')
  return code === 'PGRST116'
}

function normalizeSource(
  value: string | undefined
): 'message' | 'callback_query' | 'unknown' {
  if (value === 'message' || value === 'callback_query') {
    return value
  }
  return 'unknown'
}

export async function trackBotSubscriber(
  supabase: SupabaseLike,
  input: TrackBotSubscriberInput
): Promise<{ isNew: boolean }> {
  const botId = String(input.botId || '').trim()
  if (!botId) {
    throw new Error('botId is required')
  }

  const userId = Number(input.user?.id)
  if (!Number.isFinite(userId)) {
    throw new Error('user.id is required')
  }

  const nowIso = new Date().toISOString()
  const telegramChatId =
    input.chatId !== undefined && input.chatId !== null
      ? Number(input.chatId)
      : null

  const username = String(input.user.username || '').trim().slice(0, 128)
  const firstName = String(input.user.first_name || '').trim().slice(0, 128)
  const lastName = String(input.user.last_name || '').trim().slice(0, 128)
  const languageCode = String(input.user.language_code || '').trim().slice(0, 16)
  const source = normalizeSource(input.source)

  const findResult = await supabase
    .from('bot_subscribers')
    .select('id', { head: false })
    .eq('bot_id', botId)
    .eq('telegram_user_id', userId)
    .maybeSingle()

  if (findResult.error && !isNoRowsError(findResult.error)) {
    throw new Error(`Failed to find subscriber: ${String(findResult.error)}`)
  }

  const hasExistingRow = Boolean(findResult.data && typeof findResult.data === 'object')

  if (hasExistingRow) {
    const { error } = await supabase
      .from('bot_subscribers')
      .update({
        telegram_chat_id: Number.isFinite(telegramChatId as number) ? telegramChatId : null,
        username: username || null,
        first_name: firstName || null,
        last_name: lastName || null,
        language_code: languageCode || null,
        source,
        last_seen_at: nowIso,
      })
      .eq('bot_id', botId)
      .eq('telegram_user_id', userId)
      .select('id')
      .limit(1)

    if (error) {
      throw new Error(`Failed to update subscriber: ${String(error)}`)
    }

    return { isNew: false }
  }

  const { error } = await supabase
    .from('bot_subscribers')
    .insert({
      bot_id: botId,
      telegram_user_id: userId,
      telegram_chat_id: Number.isFinite(telegramChatId as number) ? telegramChatId : null,
      username: username || null,
      first_name: firstName || null,
      last_name: lastName || null,
      language_code: languageCode || null,
      source,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    })

  if (error) {
    throw new Error(`Failed to insert subscriber: ${String(error)}`)
  }

  return { isNew: true }
}

export async function getBotSubscribersStats(
  supabase: SupabaseLike,
  botId: string
): Promise<BotSubscribersStats> {
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    throw new Error('botId is required')
  }

  const totalResult = await supabase
    .from('bot_subscribers')
    .select('id', { head: true, count: 'exact' })
    .eq('bot_id', normalizedBotId)
    .limit(1)

  if (totalResult.error) {
    throw new Error(`Failed to fetch subscribers total: ${String(totalResult.error)}`)
  }

  const activeSinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeResult = await supabase
    .from('bot_subscribers')
    .select('id', { head: true, count: 'exact' })
    .eq('bot_id', normalizedBotId)
    .gte('last_seen_at', activeSinceIso)
    .limit(1)

  if (activeResult.error) {
    throw new Error(`Failed to fetch active subscribers: ${String(activeResult.error)}`)
  }

  const recentResult = await supabase
    .from('bot_subscribers')
    .select('telegram_user_id, username, first_name, last_name, language_code, last_seen_at')
    .eq('bot_id', normalizedBotId)
    .order('last_seen_at', { ascending: false })
    .limit(8)

  if (recentResult.error) {
    throw new Error(`Failed to fetch recent subscribers: ${String(recentResult.error)}`)
  }

  const rows = Array.isArray(recentResult.data) ? recentResult.data : []
  const recentSubscribers = rows.map((row) => {
    const record = (row || {}) as Record<string, unknown>
    return {
      telegramUserId: Number(record.telegram_user_id || 0),
      username: String(record.username || ''),
      firstName: String(record.first_name || ''),
      lastName: String(record.last_name || ''),
      languageCode: String(record.language_code || ''),
      lastSeenAt: String(record.last_seen_at || ''),
    }
  })

  return {
    totalSubscribers: Number(totalResult.count || 0),
    activeLast7Days: Number(activeResult.count || 0),
    lastSubscriberAt: recentSubscribers[0]?.lastSeenAt || null,
    recentSubscribers,
  }
}
