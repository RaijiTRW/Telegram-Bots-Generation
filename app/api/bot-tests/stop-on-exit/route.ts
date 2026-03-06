import { NextResponse } from 'next/server'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import { appendBotAuditEventSafe } from '@/lib/bot-editor/services/bot-audit-service'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'
import { stopTelegramPolling } from '@/lib/bot-editor/runtime/polling-runtime'
import { clearRuntimeSessionsForBot } from '@/lib/bot-editor/runtime/workflow-runtime'
import { appendBotTestLog, setBotTestLogRunContext } from '@/lib/bot-editor/runtime/test-log-store'

function removeSecretFieldsFromMetadata(metadata: Record<string, unknown> | undefined | null) {
  const next = { ...(metadata || {}) }
  delete next.telegramToken
  delete next.webhookSecret
  return next
}

type StopOnExitRequestBody = {
  botId?: unknown
  reason?: unknown
}

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  let payload: StopOnExitRequestBody = {}
  try {
    payload = (await request.json()) as StopOnExitRequestBody
  } catch {
    payload = {}
  }

  const botId = String(payload.botId || '').trim()
  const reason = String(payload.reason || 'exit').trim() || 'exit'

  if (!botId) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 400 })
  }

  let didSetRunContext = false
  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(
      supabase as unknown as Parameters<typeof createBotSecretsService>[0]
    )
    const bot = await botService.getBot(botId)

    if (!bot) {
      return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 })
    }

    const previousRunId = String(bot.metadata?.testRunId || '').trim() || null
    const isTestActive = Boolean(bot.metadata?.testActive)
    if (!isTestActive) {
      return NextResponse.json({ success: true, skipped: true, reason: 'not_active' })
    }

    setBotTestLogRunContext(botId, previousRunId || '')
    didSetRunContext = true
    appendBotTestLog(botId, 'system', 'Тест автоматически остановлен: пользователь покинул редактор.')

    stopTelegramPolling(botId)
    clearRuntimeSessionsForBot(botId)

    const token = String((await botSecretsService.getTelegramToken(botId)) || '').trim()
    if (token) {
      try {
        await callTelegramApi(token, 'deleteWebhook', {
          drop_pending_updates: true,
        })
      } catch (error) {
        console.error('Failed to delete webhook during auto-stop:', error)
        appendBotTestLog(botId, 'telegram', `Ошибка удаления webhook: ${String(error)}`, 'warn')
      }
    }

    await botSecretsService.setWebhookSecret(botId, null)

    await botService.updateBot(botId, {
      metadata: {
        ...removeSecretFieldsFromMetadata((bot.metadata || {}) as Record<string, unknown>),
        testActive: false,
        testMode: 'stopped',
        testRunId: null,
        testStoppedAt: new Date().toISOString(),
        hasWebhookSecret: false,
      },
    })

    setBotTestLogRunContext(botId, null)
    didSetRunContext = false

    await appendBotAuditEventSafe(supabase, {
      botId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'test.auto_stopped',
      payload: {
        reason,
        previousRunId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to auto-stop test on exit:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  } finally {
    if (didSetRunContext) {
      setBotTestLogRunContext(botId, null)
    }
  }
}
