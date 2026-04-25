'use server'

import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService, validateBotConfig } from '@/lib/bot-editor/services/bot-service'
import {
  generateQuickStartAiGraphDraft,
  normalizeQuickStartAiGraphDraft,
  repairQuickStartAiGraphDraft,
} from '@/lib/bot-editor/quick-start/ai-generator'
import {
  QUICK_START_AI_GENERATOR_VERSION,
  getDefaultQuickStartAiAnswers,
  isBotConfigMeaningfullyEmpty,
  sanitizeQuickStartAiAnswers,
  sanitizeQuickStartDraft,
} from '@/lib/bot-editor/quick-start/utils'
import type { Bot, QuickStartAiAnswers, QuickStartAiDraft } from '@/lib/bot-editor/types/bot.types'

type QuickStartDraftInput = {
  answers: QuickStartAiAnswers | Record<string, unknown>
}

function toPlainServerActionPayload<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function getAuthorizedBot(botId: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false as const, error: 'Not authenticated' }
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bot = await botService.getBot(botId)

  if (!bot) {
    return { success: false as const, error: 'Bot not found' }
  }

  return {
    success: true as const,
    user,
    botService,
    bot,
  }
}

function mergeFastStartDraft(bot: Bot, nextDraft: QuickStartAiDraft) {
  return {
    ...(bot.metadata || {}),
    fastStart: sanitizeQuickStartDraft(nextDraft),
  }
}

function toUniqueErrors(errors: string[]): string[] {
  return [...new Set(errors.map((item) => item.trim()).filter(Boolean))]
}

function getGenerationValidationErrors(botConfigErrors: string[], normalizeErrors: string[]): string[] {
  return toUniqueErrors([...normalizeErrors, ...botConfigErrors])
}

export async function saveQuickStartDraftAction(botId: string, draft: QuickStartDraftInput) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const nextDraft: QuickStartAiDraft = {
      mode: 'ai',
      status: 'draft',
      answers: sanitizeQuickStartAiAnswers(draft.answers),
      generatorVersion: QUICK_START_AI_GENERATOR_VERSION,
    }

    await access.botService.updateBot(botId, {
      metadata: mergeFastStartDraft(access.bot, nextDraft),
    })

    const refreshedBot = await access.botService.getBot(botId)
    return toPlainServerActionPayload({
      success: true,
      bot: refreshedBot || access.bot,
    })
  } catch (error) {
    console.error('Failed to save quick start AI draft:', error)
    return { success: false, error: String(error) }
  }
}

export async function generateQuickStartAiAction(
  botId: string,
  input: {
    answers: QuickStartAiAnswers | Record<string, unknown>
    locale?: string
    overwrite?: boolean
  }
) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  const answers = sanitizeQuickStartAiAnswers(input.answers)

  if (!answers.businessName) {
    return { success: false, error: 'Business name is required' }
  }

  if (!answers.primaryGoal) {
    return { success: false, error: 'Primary goal is required' }
  }

  if (!input.overwrite && !isBotConfigMeaningfullyEmpty(access.bot.config)) {
    return { success: false, error: 'Bot already has a workflow. Confirm overwrite first.' }
  }

  try {
    const initialGeneration = await generateQuickStartAiGraphDraft({
      answers,
      locale: input.locale,
    })

    let normalized = normalizeQuickStartAiGraphDraft(initialGeneration.draft, input.locale)
    let validationErrors = getGenerationValidationErrors(
      validateBotConfig(normalized.config).errors,
      normalized.errors
    )
    let modelUsed = initialGeneration.model

    if (validationErrors.length > 0) {
      const repairedGeneration = await repairQuickStartAiGraphDraft({
        answers,
        locale: input.locale,
        previousDraft: initialGeneration.draft,
        errors: validationErrors.slice(0, 12),
      })

      normalized = normalizeQuickStartAiGraphDraft(repairedGeneration.draft, input.locale)
      validationErrors = getGenerationValidationErrors(
        validateBotConfig(normalized.config).errors,
        normalized.errors
      )
      modelUsed = repairedGeneration.model
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: validationErrors[0] || 'Generated workflow is invalid',
      }
    }

    await access.botService.saveBotConfig(botId, normalized.config)

    const generatedAt = new Date().toISOString()
    await access.botService.updateBot(botId, {
      metadata: mergeFastStartDraft(access.bot, {
        mode: 'ai',
        status: 'completed',
        answers,
        generatorVersion: QUICK_START_AI_GENERATOR_VERSION,
        completedAt: generatedAt,
        lastGeneration: {
          provider: 'openrouter',
          model: modelUsed,
          generatedAt,
        },
      }),
    })

    const refreshedBot = await access.botService.getBot(botId)
    return toPlainServerActionPayload({
      success: true,
      bot: refreshedBot || access.bot,
      summary: normalized.summary,
      model: modelUsed,
    })
  } catch (error) {
    console.error('Failed to generate quick start AI workflow:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function skipQuickStartAction(botId: string) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    await access.botService.updateBot(botId, {
      metadata: mergeFastStartDraft(access.bot, {
        mode: 'ai',
        status: 'skipped',
        answers: getDefaultQuickStartAiAnswers(),
        generatorVersion: QUICK_START_AI_GENERATOR_VERSION,
      }),
    })

    const refreshedBot = await access.botService.getBot(botId)
    return toPlainServerActionPayload({
      success: true,
      bot: refreshedBot || access.bot,
    })
  } catch (error) {
    console.error('Failed to skip quick start:', error)
    return { success: false, error: String(error) }
  }
}
