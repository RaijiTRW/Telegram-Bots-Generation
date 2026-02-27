import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import { trackBotSubscriber } from '@/lib/bot-editor/services/bot-subscriber-service'
import {
  handleTelegramWorkflowUpdate,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'
import { setBotTestLogRunContext } from '@/lib/bot-editor/runtime/test-log-store'

export const dynamic = 'force-dynamic'

function readSubscriberModeConfig(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== 'object') return null

  const features =
    metadata.features && typeof metadata.features === 'object'
      ? (metadata.features as Record<string, unknown>)
      : null
  if (!features) return null

  const mode =
    features.subscriberMode && typeof features.subscriberMode === 'object'
      ? (features.subscriberMode as Record<string, unknown>)
      : null
  if (!mode) return null

  return {
    enabled: Boolean(mode.enabled),
    privateChatsOnly: mode.privateChatsOnly === undefined ? true : Boolean(mode.privateChatsOnly),
    trackCallbacks: mode.trackCallbacks === undefined ? true : Boolean(mode.trackCallbacks),
  }
}

async function trackSubscriberIfEnabled(args: {
  supabase: ReturnType<typeof createAdminClient>
  botId: string
  metadata: Record<string, unknown> | null | undefined
  update: TelegramUpdate
}) {
  const { supabase, botId, metadata, update } = args
  const config = readSubscriberModeConfig(metadata)
  if (!config?.enabled) return

  const message = update.message
  const callback = update.callback_query
  const source = message ? 'message' : callback ? 'callback_query' : 'unknown'
  if (!config.trackCallbacks && source === 'callback_query') {
    return
  }

  const user = message?.from || callback?.from
  const chat = message?.chat || callback?.message?.chat
  const chatType = String((chat as Record<string, unknown> | undefined)?.type || '')

  if (!user?.id || user.is_bot) return
  if (!chat?.id) return
  if (config.privateChatsOnly && chatType && chatType !== 'private') return

  try {
    await trackBotSubscriber(supabase as unknown as Parameters<typeof trackBotSubscriber>[0], {
      botId,
      chatId: chat.id,
      source: source === 'message' || source === 'callback_query' ? source : 'unknown',
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        language_code: user.language_code,
      },
    })
  } catch (error) {
    console.error('Failed to track bot subscriber (webhook):', error)
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params

    let update: TelegramUpdate | null = null
    try {
      update = (await request.json()) as TelegramUpdate
    } catch {
      return NextResponse.json({ ok: true })
    }

    if (!update) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createAdminClient()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(
      supabase as unknown as Parameters<typeof createBotSecretsService>[0]
    )
    const bot = await botService.getBot(botId)

    if (!bot) {
      return NextResponse.json({ ok: true })
    }

    const token = String(await botSecretsService.getTelegramToken(botId) || '').trim()
    if (!token) {
      return NextResponse.json({ ok: true })
    }

    if (!bot.metadata?.testActive) {
      return NextResponse.json({ ok: true })
    }

    setBotTestLogRunContext(botId, String(bot.metadata?.testRunId || ''))

    const expectedSecret = String(await botSecretsService.getWebhookSecret(botId) || '').trim()
    if (expectedSecret) {
      const providedSecret =
        request.headers.get('x-telegram-bot-api-secret-token') ||
        request.nextUrl.searchParams.get('secret') ||
        ''

      if (providedSecret !== expectedSecret) {
        return NextResponse.json({ ok: false }, { status: 401 })
      }
    }

    await trackSubscriberIfEnabled({
      supabase,
      botId,
      metadata: (bot.metadata || {}) as Record<string, unknown>,
      update,
    })

    await handleTelegramWorkflowUpdate({
      botId,
      botToken: token,
      config: bot.config,
      metadata: (bot.metadata || {}) as Record<string, unknown>,
      update,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    // Return 200 to avoid aggressive retry loops from Telegram during runtime errors
    return NextResponse.json({ ok: false, error: 'runtime_error' })
  }
}
