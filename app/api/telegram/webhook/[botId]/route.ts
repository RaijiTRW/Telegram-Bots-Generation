import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import {
  handleTelegramWorkflowUpdate,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'
import { setBotTestLogRunContext } from '@/lib/bot-editor/runtime/test-log-store'

export const dynamic = 'force-dynamic'

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
