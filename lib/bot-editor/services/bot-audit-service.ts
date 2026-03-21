type AsyncResult<T> = PromiseLike<T>

type SupabaseLike = {
  from: (table: string) => {
    insert: (value: Record<string, unknown> | Record<string, unknown>[]) => AsyncResult<{ error: unknown }>
  }
}

export interface BotAuditEventInput {
  botId: string
  actorUserId?: string | null
  source?: string
  eventType: string
  payload?: Record<string, unknown>
}

export async function appendBotAuditEvent(
  supabase: SupabaseLike,
  input: BotAuditEventInput
): Promise<void> {
  const { error } = await supabase
    .from('bot_audit_events')
    .insert({
      bot_id: input.botId,
      actor_user_id: input.actorUserId || null,
      source: String(input.source || 'editor'),
      event_type: input.eventType,
      payload: input.payload || {},
    })

  if (error) {
    throw new Error(`Failed to insert bot audit event: ${String(error)}`)
  }
}

export async function appendBotAuditEventSafe(
  supabase: SupabaseLike,
  input: BotAuditEventInput
) {
  try {
    await appendBotAuditEvent(supabase, input)
  } catch (error) {
    console.error('Bot audit event write failed:', error)
  }
}
