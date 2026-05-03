import { decryptSecret, encryptSecret } from '@/lib/security/secret-encryption'

const BOT_SECRETS_TABLE = 'bot_secrets'

type AsyncResult<T> = PromiseLike<T>

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => unknown
    upsert: (
      values: Record<string, unknown> | Record<string, unknown>[],
      options?: Record<string, unknown>
    ) => AsyncResult<{ error: unknown }>
    delete: () => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => AsyncResult<{ error: unknown }>
      }
    }
  }
}

type SelectManyQuery = {
  eq: (column: string, value: unknown) => AsyncResult<{ data: unknown; error: unknown }>
}

type SelectSingleBaseQuery = {
  single: () => AsyncResult<{ data: unknown; error: unknown }>
}

type SelectSingleQuery = {
  eq: (column: string, value: unknown) => SelectSingleBaseQuery
}

type SecretName = 'telegram_token' | 'webhook_secret'

type SecretRow = {
  bot_id: string
  secret_name: SecretName
  algorithm: string | null
  key_version: number | null
  iv: string | null
  ciphertext: string | null
  auth_tag: string | null
  created_at?: string
  updated_at?: string
}

async function fetchSecretRows(supabase: SupabaseLike, botId: string): Promise<SecretRow[]> {
  const query = (supabase
    .from(BOT_SECRETS_TABLE)
    .select('bot_id, secret_name, algorithm, key_version, iv, ciphertext, auth_tag')) as SelectManyQuery
  const { data, error } = await query.eq('bot_id', botId)

  if (error || !Array.isArray(data)) {
    return []
  }

  return data as SecretRow[]
}

async function fetchBotMetadataRaw(
  supabase: SupabaseLike,
  botId: string
): Promise<Record<string, unknown>> {
  const query = (supabase
    .from('bots')
    .select('metadata')) as SelectSingleQuery
  const { data, error } = await query
    .eq('id', botId)
    .single()

  if (error || !data || typeof data !== 'object') {
    return {}
  }

  const metadata = (data as { metadata?: unknown }).metadata
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  return metadata as Record<string, unknown>
}

async function fallbackFromBotMetadata(
  supabase: SupabaseLike,
  botId: string,
  secretName: SecretName
): Promise<string | null> {
  const metadata = await fetchBotMetadataRaw(supabase, botId)

  if (secretName === 'telegram_token') {
    const token = String(metadata.telegramToken || '').trim()
    return token || null
  }

  if (secretName === 'webhook_secret') {
    const secret = String(metadata.webhookSecret || '').trim()
    return secret || null
  }

  return null
}

export class BotSecretsService {
  constructor(private readonly supabase: SupabaseLike) {}

  async getSecret(botId: string, secretName: SecretName): Promise<string | null> {
    const rows = await fetchSecretRows(this.supabase, botId)
    const row = rows.find((item) => item.secret_name === secretName)

    if (row) {
      const decrypted = decryptSecret(row)
      if (decrypted !== null) {
        return decrypted
      }
    }

    // Backward compatibility with old metadata storage.
    return fallbackFromBotMetadata(this.supabase, botId, secretName)
  }

  async getTelegramToken(botId: string): Promise<string | null> {
    return this.getSecret(botId, 'telegram_token')
  }

  async getWebhookSecret(botId: string): Promise<string | null> {
    return this.getSecret(botId, 'webhook_secret')
  }

  async setSecret(botId: string, secretName: SecretName, plaintext: string | null | undefined): Promise<void> {
    const normalized = String(plaintext || '').trim()

    if (!normalized) {
      const { error } = await this.supabase
        .from(BOT_SECRETS_TABLE)
        .delete()
        .eq('bot_id', botId)
        .eq('secret_name', secretName)
      if (error) {
        throw new Error(`Failed to delete secret row(s): ${String(error)}`)
      }
      return
    }

    const encrypted = encryptSecret(normalized)

    const { error } = await this.supabase
      .from(BOT_SECRETS_TABLE)
      .upsert(
        {
          bot_id: botId,
          secret_name: secretName,
          ...encrypted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bot_id,secret_name' }
      )

    if (error) {
      throw new Error(`Failed to save secret: ${String(error)}`)
    }
  }

  async setTelegramToken(botId: string, token: string | null | undefined): Promise<void> {
    await this.setSecret(botId, 'telegram_token', token)
  }

  async setWebhookSecret(botId: string, secret: string | null | undefined): Promise<void> {
    await this.setSecret(botId, 'webhook_secret', secret)
  }

  async getSecrets(botId: string): Promise<{ telegramToken: string | null; webhookSecret: string | null }> {
    const [telegramToken, webhookSecret] = await Promise.all([
      this.getTelegramToken(botId),
      this.getWebhookSecret(botId),
    ])

    return { telegramToken, webhookSecret }
  }
}

export function createBotSecretsService(supabaseClient: SupabaseLike) {
  return new BotSecretsService(supabaseClient)
}
