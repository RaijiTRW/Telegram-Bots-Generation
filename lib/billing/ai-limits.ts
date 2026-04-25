import type { PlanCode } from '@/lib/billing/types'

export type AiChatLimitConfig = {
  windowHours: number
  requests: number
  kind: 'daily' | 'five_hour'
}

export const AI_CHAT_LIMITS: Record<PlanCode, AiChatLimitConfig> = {
  base: {
    windowHours: 24,
    requests: 10,
    kind: 'daily',
  },
  business: {
    windowHours: 5,
    requests: 60,
    kind: 'five_hour',
  },
  enterprise: {
    windowHours: 5,
    requests: 140,
    kind: 'five_hour',
  },
}

export function getAiChatLimit(planCode: PlanCode): AiChatLimitConfig {
  return AI_CHAT_LIMITS[planCode] || AI_CHAT_LIMITS.base
}

export function formatAiChatLimit(planCode: PlanCode, locale: string) {
  const limit = getAiChatLimit(planCode)
  const ru = locale !== 'en'

  if (limit.kind === 'daily') {
    return ru ? `${limit.requests} запросов / 24 ч` : `${limit.requests} requests / 24h`
  }

  return ru ? `${limit.requests} запросов / 5 ч` : `${limit.requests} requests / 5h`
}

export function estimateAiRequestCost(input: {
  prompt: string
  attachmentsCount?: number
  skipClarification?: boolean
}) {
  const prompt = input.prompt.trim()
  const lowerPrompt = prompt.toLowerCase()
  let cost = 1

  if (prompt.length > 800) cost += 1
  if (prompt.length > 2000) cost += 1
  if ((input.attachmentsCount || 0) > 0) cost += Math.min(3, input.attachmentsCount || 0)

  const buildSignals = [
    'сделай',
    'создай',
    'исправь',
    'добавь',
    'убери',
    'поменяй',
    'подключи',
    'реализ',
    'build',
    'create',
    'fix',
    'add',
    'remove',
    'connect',
    'implement',
  ]

  if (buildSignals.some((signal) => lowerPrompt.includes(signal))) {
    cost += 2
  }

  if (input.skipClarification) {
    cost += 1
  }

  return Math.max(1, Math.min(cost, 8))
}
