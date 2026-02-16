import type { BotConfig } from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'
import {
  handleTelegramWorkflowUpdate,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBotService } from '@/lib/bot-editor/services/bot-service'

interface PollerState {
  active: boolean
  timer: ReturnType<typeof setTimeout> | null
  botToken: string
  config: BotConfig
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

async function refreshPollerControlState(botId: string, state: PollerState): Promise<boolean> {
  const now = Date.now()
  if (now - state.lastControlCheckAt < CONTROL_CHECK_INTERVAL_MS) {
    return true
  }
  state.lastControlCheckAt = now

  try {
    const supabase = createAdminClient()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(botId)
    if (!bot) {
      return false
    }

    const metadata = (bot.metadata || {}) as Record<string, unknown>
    const testMode = String(metadata.testMode || '').trim().toLowerCase()
    const runId = String(metadata.testRunId || '').trim()
    const token = String(metadata.telegramToken || '').trim()
    const isActive = Boolean(metadata.testActive) && testMode === 'polling'

    if (!isActive || !runId || runId !== state.expectedTestRunId || token !== state.botToken) {
      return false
    }

    state.config = bot.config
    return true
  } catch (error) {
    // Temporary DB issues should not immediately kill local polling test loop.
    console.error('Polling control check failed:', error)
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
      stopTelegramPolling(botId)
      return
    }

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

      await handleTelegramWorkflowUpdate({
        botId,
        botToken: state.botToken,
        config: state.config,
        update,
      })
    }

    schedulePoll(botId, 0, runId)
  } catch (error) {
    console.error('Polling cycle failed:', error)
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
}

export function startTelegramPolling(args: {
  botId: string
  botToken: string
  config: BotConfig
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
    offset: 0,
    runId,
    expectedTestRunId,
    lastControlCheckAt: 0,
  })

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
