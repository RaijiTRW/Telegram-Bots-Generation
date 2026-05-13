import { NextResponse } from 'next/server'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

const BOT_SECRET_ROUTE_TIMEOUT_MS = 8_000

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withBotSecretTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label}: Supabase не ответил за ${BOT_SECRET_ROUTE_TIMEOUT_MS / 1000} сек.`))
        }, BOT_SECRET_ROUTE_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
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
    const bot = await botService.getBot(botId)

    if (!bot) {
      return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 })
    }

    const botSecretsService = createBotSecretsService(
      createAdminClient() as unknown as Parameters<typeof createBotSecretsService>[0]
    )

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

    let token = ''
    try {
      token = String(
        await withBotSecretTimeout(
          botSecretsService.getTelegramToken(botId),
          'Чтение Telegram token'
        ) || ''
      ).trim()
    } catch (error) {
      appendBotTestLog(botId, 'telegram', `Не удалось быстро прочитать token при автостопе: ${getErrorMessage(error)}`, 'warn')
    }
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

    try {
      await withBotSecretTimeout(
        botSecretsService.setWebhookSecret(botId, null),
        'Очистка webhook secret'
      )
    } catch (error) {
      appendBotTestLog(botId, 'telegram', `Не удалось быстро очистить webhook secret: ${getErrorMessage(error)}`, 'warn')
    }

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
