import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import {
  appendInboundCrmEvent,
  trackSubscriberFromUpdate,
} from '@/lib/bot-editor/runtime/telegram-update-ingest'
import {
  handleTelegramWorkflowUpdate,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'
import { appendBotTestLog } from '@/lib/bot-editor/runtime/test-log-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    botId: string
  }>
}

function describeUpdate(update: TelegramUpdate): string {
  if (update.callback_query?.data) {
    return `callback: ${String(update.callback_query.data).slice(0, 80)}`
  }

  if (typeof update.message?.text === 'string') {
    return `message: ${String(update.message.text).slice(0, 80)}`
  }

  if (typeof update.message?.caption === 'string') {
    return `caption: ${String(update.message.caption).slice(0, 80)}`
  }

  return 'service update'
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { botId } = await context.params
  const normalizedBotId = String(botId || '').trim()

  if (!normalizedBotId) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const botService = createBotService(supabase)
  const botSecretsService = createBotSecretsService(
    supabase as unknown as Parameters<typeof createBotSecretsService>[0]
  )

  const bot = await botService.getBot(normalizedBotId)
  if (!bot) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 })
  }

  const [token, webhookSecret] = await Promise.all([
    botSecretsService.getTelegramToken(normalizedBotId),
    botSecretsService.getWebhookSecret(normalizedBotId),
  ])

  if (!String(token || '').trim()) {
    appendBotTestLog(normalizedBotId, 'webhook', 'Webhook ignored: missing telegram token', 'warn')
    return NextResponse.json({ success: true, ignored: 'missing_token' })
  }

  const receivedSecret = String(
    request.headers.get('x-telegram-bot-api-secret-token') || ''
  ).trim()
  const expectedSecret = String(webhookSecret || '').trim()
  if (expectedSecret && receivedSecret !== expectedSecret) {
    appendBotTestLog(normalizedBotId, 'webhook', 'Webhook rejected: invalid secret token', 'warn')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    appendBotTestLog(normalizedBotId, 'webhook', 'Webhook rejected: invalid JSON payload', 'warn')
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })
  }

  appendBotTestLog(
    normalizedBotId,
    'webhook',
    `Получен update #${String(update.update_id ?? '?')} (${describeUpdate(update)})`,
    'debug'
  )

  try {
    await trackSubscriberFromUpdate({
      supabase,
      botId: normalizedBotId,
      metadata: (bot.metadata || {}) as Record<string, unknown>,
      update,
    })
  } catch (error) {
    appendBotTestLog(
      normalizedBotId,
      'webhook',
      `Не удалось обновить список подписчиков: ${String(error)}`,
      'warn'
    )
  }

  try {
    await appendInboundCrmEvent({
      supabase,
      botId: normalizedBotId,
      update,
    })
  } catch (error) {
    appendBotTestLog(
      normalizedBotId,
      'webhook',
      `Не удалось записать CRM-событие: ${String(error)}`,
      'warn'
    )
  }

  try {
    await handleTelegramWorkflowUpdate({
      botId: normalizedBotId,
      botToken: String(token).trim(),
      config: bot.config,
      metadata: ((bot.metadata || {}) as Record<string, unknown>) || {},
      update,
    })
  } catch (error) {
    appendBotTestLog(
      normalizedBotId,
      'webhook',
      `Ошибка обработки update: ${String(error)}`,
      'error'
    )
  }

  return NextResponse.json({ success: true })
}
