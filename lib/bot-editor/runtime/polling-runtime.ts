import type { BotConfig } from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'
import {
  handleTelegramWorkflowUpdate,
  handleScheduledWorkflowTriggersTick,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import { appendBotTestLog } from '@/lib/bot-editor/runtime/test-log-store'

interface PollerState {
  active: boolean
  timer: ReturnType<typeof setTimeout> | null
  botToken: string
  config: BotConfig
  metadata: Record<string, unknown> | null
  offset: number
  runId: string
  expectedTestRunId: string
  lastControlCheckAt: number
}

declare global {
  // Shared polling registry across Next.js module reloads (dev HMR).
  var __tflowPollers: Map<string, PollerState> | undefined
}

const pollers: Map<string, PollerState> =
  globalThis.__tflowPollers || new Map<string, PollerState>()
if (!globalThis.__tflowPollers) {
  globalThis.__tflowPollers = pollers
}

function createRunId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

const CONTROL_CHECK_INTERVAL_MS = 4000
const hasPollingControlStoreConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

async function refreshPollerControlState(botId: string, state: PollerState): Promise<boolean> {
  const now = Date.now()
  if (now - state.lastControlCheckAt < CONTROL_CHECK_INTERVAL_MS) {
    return true
  }
  state.lastControlCheckAt = now

  // Local test mode may run without service-role access to Supabase.
  // In that case we skip remote control-state checks and keep the poller alive.
  if (!hasPollingControlStoreConfig()) {
    return true
  }

  try {
    const supabase = createAdminClient()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(
      supabase as unknown as Parameters<typeof createBotSecretsService>[0]
    )
    const bot = await botService.getBot(botId)
    if (!bot) {
      return false
    }

    const metadata = (bot.metadata || {}) as Record<string, unknown>
    const testMode = String(metadata.testMode || '').trim().toLowerCase()
    const runId = String(metadata.testRunId || '').trim()
    const token = String(await botSecretsService.getTelegramToken(botId) || '').trim()
    const isActive = Boolean(metadata.testActive) && testMode === 'polling'

    if (!isActive || !runId || runId !== state.expectedTestRunId || token !== state.botToken) {
      return false
    }

    state.config = bot.config
    state.metadata = ((bot.metadata || {}) as Record<string, unknown>) || {}
    return true
  } catch (error) {
    // Temporary DB issues should not immediately kill local polling test loop.
    console.error('Polling control check failed:', error)
    appendBotTestLog(botId, 'polling', 'Внутренняя ошибка проверки состояния poller', 'warn')
    return true
  }
}

function schedulePoll(botId: string, delayMs: number, runId: string) {
  const state = pollers.get(botId)
  if (!state || !state.active || state.runId !== runId) return

  state.timer = setTimeout(() => {
    void runPollingCycle(botId, runId)
  }, delayMs)
}

async function runPollingCycle(botId: string, runId: string): Promise<void> {
  const state = pollers.get(botId)
  if (!state || !state.active || state.runId !== runId) return

  try {
    const canContinue = await refreshPollerControlState(botId, state)
    if (!canContinue) {
      appendBotTestLog(botId, 'polling', 'Poller остановлен: тест неактивен или runId изменился.', 'warn')
      stopTelegramPolling(botId)
      return
    }

    await handleScheduledWorkflowTriggersTick({
      botId,
      botToken: state.botToken,
      config: state.config,
      metadata: state.metadata,
    })

    const updates = await callTelegramApi<TelegramUpdate[]>(
      state.botToken,
      'getUpdates',
      {
        offset: state.offset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query'],
      }
    )

    for (const update of updates || []) {
      state.offset = Math.max(state.offset, update.update_id + 1)
      appendBotTestLog(
        botId,
        'polling',
        `Получен update #${update.update_id}${update.callback_query ? ' (callback)' : update.message?.text ? ` (message: ${String(update.message.text).slice(0, 80)})` : ''}`,
        'debug'
      )

      await handleTelegramWorkflowUpdate({
        botId,
        botToken: state.botToken,
        config: state.config,
        metadata: state.metadata,
        update,
      })
    }

    schedulePoll(botId, 0, runId)
  } catch (error) {
    console.error('Polling cycle failed:', error)
    appendBotTestLog(botId, 'polling', `Ошибка polling-цикла: ${String(error)}`, 'error')
    schedulePoll(botId, 1500, runId)
  }
}

export function stopTelegramPolling(botId: string) {
  const state = pollers.get(botId)
  if (!state) return

  state.active = false
  if (state.timer) {
    clearTimeout(state.timer)
  }

  pollers.delete(botId)
  appendBotTestLog(botId, 'polling', 'Polling остановлен')
}

export function startTelegramPolling(args: {
  botId: string
  botToken: string
  config: BotConfig
  metadata?: Record<string, unknown> | null
  testRunId?: string
}) {
  stopTelegramPolling(args.botId)
  const runId = createRunId()
  const expectedTestRunId = String(args.testRunId || '').trim() || runId

  pollers.set(args.botId, {
    active: true,
    timer: null,
    botToken: args.botToken,
    config: args.config,
    metadata: (args.metadata as Record<string, unknown> | null) || null,
    offset: 0,
    runId,
    expectedTestRunId,
    // Skip the very first remote control check to avoid race with metadata persistence
    // right after test-start action updates bot.testActive/testRunId.
    lastControlCheckAt: Date.now(),
  })

  appendBotTestLog(args.botId, 'polling', 'Polling запущен')

  schedulePoll(args.botId, 0, runId)
}

export function isTelegramPollingActive(botId: string): boolean {
  const state = pollers.get(botId)
  return Boolean(state?.active)
}

export function updateTelegramPollingConfig(botId: string, config: BotConfig): boolean {
  const state = pollers.get(botId)
  if (!state || !state.active) {
    return false
  }

  state.config = config
  return true
}
