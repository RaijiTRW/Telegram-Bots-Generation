import type { BotConfig } from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'
import {
  handleTelegramWorkflowUpdate,
  type TelegramUpdate,
} from '@/lib/bot-editor/runtime/workflow-runtime'

interface PollerState {
  active: boolean
  timer: ReturnType<typeof setTimeout> | null
  botToken: string
  config: BotConfig
  offset: number
}

const pollers = new Map<string, PollerState>()

function schedulePoll(botId: string, delayMs: number) {
  const state = pollers.get(botId)
  if (!state || !state.active) return

  state.timer = setTimeout(() => {
    void runPollingCycle(botId)
  }, delayMs)
}

async function runPollingCycle(botId: string): Promise<void> {
  const state = pollers.get(botId)
  if (!state || !state.active) return

  try {
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

    schedulePoll(botId, 0)
  } catch (error) {
    console.error('Polling cycle failed:', error)
    schedulePoll(botId, 1500)
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
}) {
  stopTelegramPolling(args.botId)

  pollers.set(args.botId, {
    active: true,
    timer: null,
    botToken: args.botToken,
    config: args.config,
    offset: 0,
  })

  schedulePoll(args.botId, 0)
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
