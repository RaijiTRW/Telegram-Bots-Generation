'use server'

import { randomUUID } from 'node:crypto'
import { createServerClientWrapper, getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'
import { estimateAiRequestCost, getAiChatLimit } from '@/lib/billing/ai-limits'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import {
  cancelBotAgentRun,
  getBotAgentRunStatus,
  startBotAgentRun,
} from '@/lib/bot-editor/agent/runtime'
import { requestOpenRouterJson } from '@/lib/bot-editor/quick-start/openrouter'
import {
  appendMessageToThread,
  createAiChatThread,
  deleteThreadFromState,
  getActiveChatThread,
  getAiChatState,
  mergeAiChatMetadata,
  pickChatTitleFromPrompt,
  renameThreadInState,
  replaceThreadInState,
  switchActiveChat,
  upsertAiChatThread,
} from '@/lib/bot-editor/ai-chat/metadata'
import type {
  PlanCode,
  ViewerAccess,
} from '@/lib/billing/types'
import type {
  AiAgentAttachment,
  AiAgentClarificationAnswer,
  AiAgentPendingClarification,
  AiAgentClarificationQuestion,
  AiAgentClarificationRequest,
  AiAgentRunSnapshot,
  BotMetadata,
  BotConfig,
} from '@/lib/bot-editor/types/bot.types'

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
    bot,
    botService,
  }
}

type AiLimitNotice = {
  code: 'ai_limit_exceeded'
  planCode: PlanCode
  used: number
  limit: number
  cost: number
  resetsAt: string
  upgradePlanCode: Exclude<PlanCode, 'base'> | null
}

type AiUsageBucket = {
  windowStartedAt: string
  used: number
}

function readAiUsageBucket(metadata: BotMetadata | undefined | null, userId: string): AiUsageBucket | null {
  const usage = metadata?.aiChatUsage
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null
  const byUser = (usage as Record<string, unknown>).byUser
  if (!byUser || typeof byUser !== 'object' || Array.isArray(byUser)) return null
  const rawBucket = (byUser as Record<string, unknown>)[userId]
  if (!rawBucket || typeof rawBucket !== 'object' || Array.isArray(rawBucket)) return null

  const bucket = rawBucket as Record<string, unknown>
  const windowStartedAt = String(bucket.windowStartedAt || '').trim()
  const used = Number(bucket.used || 0)
  if (!windowStartedAt || !Number.isFinite(Date.parse(windowStartedAt))) return null

  return {
    windowStartedAt,
    used: Number.isFinite(used) ? Math.max(0, used) : 0,
  }
}

function writeAiUsageBucket(metadata: BotMetadata | undefined | null, userId: string, bucket: AiUsageBucket): BotMetadata {
  const usage = metadata?.aiChatUsage && typeof metadata.aiChatUsage === 'object' && !Array.isArray(metadata.aiChatUsage)
    ? (metadata.aiChatUsage as Record<string, unknown>)
    : {}
  const byUser = usage.byUser && typeof usage.byUser === 'object' && !Array.isArray(usage.byUser)
    ? { ...(usage.byUser as Record<string, unknown>) }
    : {}

  return {
    ...((metadata || {}) as BotMetadata),
    aiChatUsage: {
      ...usage,
      byUser: {
        ...byUser,
        [userId]: bucket,
      },
    },
  }
}

function resolveAiLimitPlan(access: ViewerAccess): PlanCode {
  if (access.isAdmin) return 'enterprise'
  return access.effectivePlanCode
}

async function reserveAiChatCredits(input: {
  userId: string
  metadata: BotMetadata | undefined | null
  viewerAccess: ViewerAccess
  cost: number
}) {
  const planCode = resolveAiLimitPlan(input.viewerAccess)
  const limit = getAiChatLimit(planCode)
  const now = Date.now()
  const windowMs = limit.windowHours * 60 * 60 * 1000
  const currentBucket = readAiUsageBucket(input.metadata, input.userId)
  const bucketStartedAt = currentBucket ? Date.parse(currentBucket.windowStartedAt) : NaN
  const shouldReset = !currentBucket || !Number.isFinite(bucketStartedAt) || now - bucketStartedAt >= windowMs
  const bucket: AiUsageBucket = shouldReset
    ? { windowStartedAt: new Date(now).toISOString(), used: 0 }
    : currentBucket
  const resetsAt = new Date(Date.parse(bucket.windowStartedAt) + windowMs).toISOString()
  const nextUsed = bucket.used + input.cost

  if (nextUsed > limit.requests) {
    return {
      allowed: false as const,
      notice: {
        code: 'ai_limit_exceeded',
        planCode,
        used: bucket.used,
        limit: limit.requests,
        cost: input.cost,
        resetsAt,
        upgradePlanCode: planCode === 'base' ? 'business' : planCode === 'business' ? 'enterprise' : null,
      } satisfies AiLimitNotice,
      metadata: writeAiUsageBucket(input.metadata, input.userId, bucket),
    }
  }

  return {
    allowed: true as const,
    notice: null,
    metadata: writeAiUsageBucket(input.metadata, input.userId, {
      ...bucket,
      used: nextUsed,
    }),
  }
}

function sanitizeAttachments(value: unknown): AiAgentAttachment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const id = String(record.id || '').trim()
      const name = String(record.name || '').trim()
      const mimeType = String(record.mimeType || '').trim()
      const path = String(record.path || '').trim()
      const kind = String(record.kind || '').trim()

      if (!id || !name || !path || (kind !== 'image' && kind !== 'file')) {
        return null
      }

      return {
        id,
        name,
        mimeType,
        size: Number(record.size || 0) || 0,
        path,
        kind,
      } satisfies AiAgentAttachment
    })
    .filter((item): item is AiAgentAttachment => Boolean(item))
}

function sanitizeSnapshot(snapshot: AiAgentRunSnapshot | null | undefined) {
  return snapshot || null
}

const CLARIFICATION_WAIT_TIMEOUT_MS = 12 * 60 * 60 * 1000
const CLARIFICATION_DECISION_TIMEOUT_MS = 12_000

type ClarificationDecision = {
  needsClarification: boolean
  thought?: string
  questions?: AiAgentClarificationQuestion[]
}

const CLARIFICATION_DECISION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['needsClarification', 'thought', 'questions'],
  properties: {
    needsClarification: { type: 'boolean' },
    thought: { type: 'string' },
    questions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'header', 'question', 'options'],
        properties: {
          id: { type: 'string' },
          header: { type: 'string' },
          question: { type: 'string' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'description'],
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                recommended: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  },
}

function normalizeText(value: unknown, maxLength = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function sanitizeClarificationAnswers(value: unknown): AiAgentClarificationAnswer[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const questionId = normalizeText(record.questionId, 80)
      const question = normalizeText(record.question, 240)
      const answer = normalizeText(record.answer, 1000)
      if (!questionId || !answer) return null
      return { questionId, question, answer } satisfies AiAgentClarificationAnswer
    })
    .filter((item): item is AiAgentClarificationAnswer => Boolean(item))
    .slice(0, 8)
}

function sanitizeClarificationDecision(value: ClarificationDecision, locale?: string): AiAgentClarificationRequest | null {
  if (!value.needsClarification || !Array.isArray(value.questions) || value.questions.length === 0) {
    return null
  }

  const questions: AiAgentClarificationQuestion[] = []
  for (const [questionIndex, question] of value.questions.entries()) {
    const id = normalizeText(question.id, 80)
      .toLowerCase()
      .replace(/[^\w]+/g, '_')
      .replace(/^_+|_+$/g, '') || `question_${questionIndex + 1}`
    const header = normalizeText(question.header, 12) || (locale === 'en' ? 'Question' : 'Вопрос')
    const prompt = normalizeText(question.question, 180)
    const options = Array.isArray(question.options)
      ? question.options.reduce<AiAgentClarificationQuestion['options']>((acc, option, optionIndex) => {
          if (acc.length >= 3) return acc
          const label = normalizeText(option.label, 42)
          const description = normalizeText(option.description, 160)
          if (!label || !description) return acc
          acc.push({
            label,
            description,
            recommended: optionIndex === 0 || Boolean(option.recommended),
          })
          return acc
        }, [])
      : []

    if (prompt && options.length >= 2) {
      questions.push({
        id,
        header,
        question: prompt,
        options,
      })
    }

    if (questions.length >= 3) break
  }

  if (questions.length === 0) return null

  return {
    id: `clarification-${Date.now()}`,
    thought: normalizeText(value.thought, 260) || (locale === 'en'
      ? 'I need a little more context before building the bot.'
      : 'Перед сборкой нужно уточнить несколько деталей.'),
    questions,
  }
}

function compactConfigForClarification(config: BotConfig) {
  return {
    nodes: (config.nodes || []).slice(0, 30).map((node) => ({
      id: node.id,
      type: node.type,
      label: normalizeText((node.data as Record<string, unknown> | undefined)?.__label, 80),
      description: normalizeText((node.data as Record<string, unknown> | undefined)?.__description, 120),
    })),
    edges: (config.edges || []).slice(0, 40).map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
    })),
    variables: (config.variables || []).slice(0, 20).map((variable) => ({
      name: variable.name,
      type: variable.type,
      scope: variable.scope || null,
    })),
  }
}

function buildClarifiedPrompt(prompt: string, answers: AiAgentClarificationAnswer[]) {
  if (answers.length === 0) return prompt

  const answerText = answers
    .map((answer) => `- ${answer.question || answer.questionId}: ${answer.answer}`)
    .join('\n')

  return `${prompt}\n\nУточнения пользователя:\n${answerText}`
}

function getPendingClarification(metadata: BotMetadata | undefined | null): AiAgentPendingClarification | null {
  const pending = metadata?.aiAgent?.pendingClarification
  if (!pending || typeof pending !== 'object') return null
  return pending
}

function isPendingClarificationExpired(pending: AiAgentPendingClarification) {
  return Date.parse(pending.expiresAt) <= Date.now()
}

function clearPendingClarificationMetadata(metadata: BotMetadata | undefined | null): BotMetadata {
  return {
    ...((metadata || {}) as BotMetadata),
    aiAgent: {
      ...(((metadata?.aiAgent || {}) as NonNullable<BotMetadata['aiAgent']>)),
      pendingClarification: null,
    },
  }
}

function createPendingClarification(input: {
  runId: string
  prompt: string
  model?: string
  locale?: string
  chatId?: string | null
  attachments: AiAgentAttachment[]
  request: AiAgentClarificationRequest
  answers: AiAgentClarificationAnswer[]
}): AiAgentPendingClarification {
  const now = new Date()
  return {
    id: input.request.id,
    runId: input.runId,
    prompt: input.prompt,
    model: input.model,
    locale: input.locale,
    chatId: input.chatId ?? null,
    attachments: input.attachments,
    request: input.request,
    answers: input.answers,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CLARIFICATION_WAIT_TIMEOUT_MS).toISOString(),
  }
}

function createClarificationAnswerMessage(answers: AiAgentClarificationAnswer[], locale?: string) {
  const prefix = locale === 'en' ? 'Answer' : 'Ответ'
  return answers
    .map((answer) => `${prefix}: ${answer.answer}`)
    .join('\n')
}

function prepareClarificationRun(input: {
  botId: string
  metadata: BotMetadata | undefined | null
  prompt: string
  model?: string
  locale?: string
  chatId?: string | null
  attachments: AiAgentAttachment[]
  request: AiAgentClarificationRequest
  answers: AiAgentClarificationAnswer[]
}) {
  const locale = input.locale === 'en' ? 'en' : 'ru'
  const runId = randomUUID()
  const now = new Date().toISOString()
  const aiChatState = getAiChatState(input.metadata)
  let activeChat =
    (normalizeText(input.chatId, 160) && aiChatState.chats.find((chat) => chat.id === normalizeText(input.chatId, 160))) ||
    getActiveChatThread(aiChatState)

  if (!activeChat) {
    activeChat = createAiChatThread(locale, pickChatTitleFromPrompt(input.prompt, locale), runId)
  }

  const preparedChat = activeChat.messages.length === 0
    ? {
        ...activeChat,
        title: pickChatTitleFromPrompt(input.prompt, locale),
      }
    : activeChat

  const nextChat = appendMessageToThread(preparedChat, {
    runId,
    role: 'user',
    content: normalizeText(input.prompt, 12000),
    model: 'z-ai/glm-5.1',
    attachments: input.attachments,
  })
  const nextAiChatState = replaceThreadInState(
    {
      ...aiChatState,
      chats: aiChatState.chats.some((chat) => chat.id === nextChat.id)
        ? aiChatState.chats
        : [nextChat, ...aiChatState.chats],
      activeChatId: nextChat.id,
    },
    nextChat
  )
  const snapshot: AiAgentRunSnapshot = {
    runId,
    chatId: nextChat.id,
    status: 'planning',
    mode: 'build',
    model: 'z-ai/glm-5.1',
    startedAt: now,
    updatedAt: now,
    currentAction: locale === 'en' ? 'Thinking...' : 'Думаю...',
    nextAction: locale === 'en' ? 'Clarify the missing details' : 'Уточнить недостающие детали',
    completedTasks: [],
    locked: true,
    prompt: input.prompt,
    attachments: input.attachments,
  }
  const pendingClarification = createPendingClarification({
    runId,
    prompt: input.prompt,
    model: input.model,
    locale: input.locale,
    chatId: nextChat.id,
    attachments: input.attachments,
    request: input.request,
    answers: input.answers,
  })

  const metadataWithChat = {
    ...((input.metadata || {}) as BotMetadata),
    aiChat: nextAiChatState,
    aiAgent: {
      ...(((input.metadata?.aiAgent || {}) as NonNullable<BotMetadata['aiAgent']>)),
      currentRun: snapshot,
      pendingClarification,
    },
  }

  return {
    snapshot,
    pendingClarification,
    metadata: metadataWithChat,
  }
}

function appendClarificationAnswerToMetadata(input: {
  metadata: BotMetadata
  pending: AiAgentPendingClarification
  answers: AiAgentClarificationAnswer[]
  locale?: string
}) {
  const aiChatState = getAiChatState(input.metadata)
  const activeChat = input.pending.chatId
    ? aiChatState.chats.find((chat) => chat.id === input.pending.chatId)
    : getActiveChatThread(aiChatState)

  if (!activeChat || input.answers.length === 0) {
    return input.metadata
  }

  const nextThread = appendMessageToThread(activeChat, {
    runId: input.pending.runId,
    role: 'system',
    content: createClarificationAnswerMessage(input.answers, input.locale),
  })

  const nextAiChatState = replaceThreadInState(aiChatState, nextThread)

  return {
    ...input.metadata,
    aiChat: nextAiChatState,
  }
}

async function requestClarificationDecision(input: {
  prompt: string
  locale?: string
  answers: AiAgentClarificationAnswer[]
  config: BotConfig
  attachments: AiAgentAttachment[]
}) {
  const locale = input.locale === 'en' ? 'en' : 'ru'
  const timeoutResult = Symbol('clarification-timeout')
  const clarificationRequest = requestOpenRouterJson<ClarificationDecision>({
    model: 'z-ai/glm-5.1',
    schema: CLARIFICATION_DECISION_SCHEMA,
    temperature: 0.15,
    maxTokens: 1600,
    messages: [
      {
        role: 'system',
        content: locale === 'en'
          ? [
              'You are a clarification layer for a Telegram bot builder.',
              'Before planning or editing, decide if the user gave enough business and technical context.',
              'Ask only questions that materially affect the bot structure, messages, variables, integrations, payments, routing, or fallback behavior.',
              'Return 0 questions when the request is clear enough to begin.',
              'If asking, return 1-3 short questions. Each question must have 2-3 mutually exclusive options. Put the recommended option first and mark recommended=true.',
              'The user may also provide a custom answer in the UI.',
              'Keep thought short and user-facing. No hidden chain-of-thought.',
            ].join('\n')
          : [
              'Ты слой уточнений для конструктора Telegram-ботов.',
              'Перед планом и изменениями реши, хватает ли бизнесового и технического контекста.',
              'Спрашивай только то, что реально влияет на структуру бота, тексты, переменные, интеграции, оплаты, маршрутизацию или fallback.',
              'Верни 0 вопросов, если уже можно начинать.',
              'Если спрашиваешь, верни 1-3 коротких вопроса. У каждого 2-3 взаимоисключающих варианта. Первый вариант должен быть рекомендованным и recommended=true.',
              'Пользователь также сможет написать свой ответ в UI.',
              'thought должен быть коротким и понятным пользователю. Не раскрывай скрытую цепочку рассуждений.',
            ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          prompt: input.prompt,
          locale,
          previousClarificationAnswers: input.answers,
          currentGraph: compactConfigForClarification(input.config),
          attachments: input.attachments.map((attachment) => ({
            name: attachment.name,
            kind: attachment.kind,
            mimeType: attachment.mimeType,
          })),
        }, null, 2),
      },
    ],
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    if (/aborted|abort/i.test(message)) {
      return timeoutResult
    }

    throw error
  })
  const timeoutPromise = new Promise<typeof timeoutResult>((resolve) => {
    setTimeout(() => resolve(timeoutResult), CLARIFICATION_DECISION_TIMEOUT_MS)
  })

  const response = await Promise.race([clarificationRequest, timeoutPromise])

  if (typeof response === 'symbol') {
    return null
  }

  return sanitizeClarificationDecision(response.parsed, locale)
}

export async function startBotAgentRunAction(
  botId: string,
  payload: {
    prompt: string
    model?: string
    locale?: string
    chatId?: string | null
    attachments?: AiAgentAttachment[] | Record<string, unknown>[]
    clarificationAnswers?: AiAgentClarificationAnswer[] | Record<string, unknown>[]
    skipClarification?: boolean
  }
) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  const prompt = String(payload.prompt || '').trim()
  const attachments = sanitizeAttachments(payload.attachments)
  if (!prompt && attachments.length === 0) {
    return { success: false as const, error: 'Prompt or attachment is required' }
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return {
      success: false as const,
      error: 'OPENROUTER_API_KEY is not configured',
    }
  }

  try {
    const clarificationAnswers = sanitizeClarificationAnswers(payload.clarificationAnswers)
    const effectivePrompt = buildClarifiedPrompt(prompt, clarificationAnswers)
    const storedPendingClarification = getPendingClarification(access.bot.metadata)
    const shouldChargeRequest = !storedPendingClarification
    let baseMetadata = access.bot.metadata || {}

    if (shouldChargeRequest) {
      const viewerAccess = await getViewerAccess(access.user.id)
      const reservation = await reserveAiChatCredits({
        userId: access.user.id,
        metadata: baseMetadata,
        viewerAccess,
        cost: estimateAiRequestCost({
          prompt,
          attachmentsCount: attachments.length,
          skipClarification: payload.skipClarification,
        }),
      })
      baseMetadata = reservation.metadata
      await access.botService.updateBot(botId, { metadata: baseMetadata })

      if (!reservation.allowed) {
        return toPlainServerActionPayload({
          success: false as const,
          error: 'AI_LIMIT_EXCEEDED',
          limitNotice: reservation.notice,
          metadata: baseMetadata,
        })
      }
    }

    const newClarificationAnswers = storedPendingClarification
      ? clarificationAnswers.slice(storedPendingClarification.answers.length)
      : clarificationAnswers
    const metadataWithAnswer = storedPendingClarification && newClarificationAnswers.length > 0
      ? appendClarificationAnswerToMetadata({
          metadata: baseMetadata,
          pending: storedPendingClarification,
          answers: newClarificationAnswers,
          locale: payload.locale,
        })
      : baseMetadata

    if (storedPendingClarification && isPendingClarificationExpired(storedPendingClarification)) {
      const clearedMetadata = clearPendingClarificationMetadata(access.bot.metadata)
      await access.botService.updateBot(botId, { metadata: clearedMetadata })

      return toPlainServerActionPayload({
        success: false as const,
        error: payload.locale === 'en'
          ? 'The clarification expired because there was no answer for 12 hours.'
          : 'Уточнение завершено: ответа не было 12 часов.',
        metadata: clearedMetadata,
      })
    }

    if (!payload.skipClarification) {
      const clarification = await requestClarificationDecision({
        prompt,
        locale: payload.locale,
        answers: clarificationAnswers,
        config: access.bot.config,
        attachments,
      })

      if (clarification) {
        const clarificationRun = storedPendingClarification
          ? (() => {
              const pendingClarification = createPendingClarification({
                runId: storedPendingClarification.runId,
                prompt,
                model: payload.model,
                locale: payload.locale,
                chatId: storedPendingClarification.chatId ?? payload.chatId ?? null,
                attachments,
                request: clarification,
                answers: clarificationAnswers,
              })
              const currentRun = metadataWithAnswer.aiAgent?.currentRun
              const snapshot = currentRun
                ? {
                    ...currentRun,
                    status: 'planning' as const,
                    locked: true,
                    updatedAt: new Date().toISOString(),
                    currentAction: payload.locale === 'en' ? 'Thinking...' : 'Думаю...',
                    nextAction: payload.locale === 'en' ? 'Clarify the next detail' : 'Уточнить следующий вопрос',
                  }
                : null
              return {
                snapshot,
                pendingClarification,
                metadata: {
                  ...metadataWithAnswer,
                  aiAgent: {
                    ...(((metadataWithAnswer.aiAgent || {}) as NonNullable<BotMetadata['aiAgent']>)),
                    currentRun: snapshot,
                    pendingClarification,
                  },
                },
              }
            })()
          : prepareClarificationRun({
              botId,
              metadata: baseMetadata,
              prompt,
              model: payload.model,
              locale: payload.locale,
              chatId: payload.chatId ?? null,
              attachments,
              request: clarification,
              answers: clarificationAnswers,
            })
        const metadata = clarificationRun.metadata
        await access.botService.updateBot(botId, { metadata })

        return toPlainServerActionPayload({
          success: true as const,
          needsClarification: true as const,
          clarification,
          snapshot: sanitizeSnapshot(clarificationRun.snapshot),
          pendingClarification: clarificationRun.pendingClarification,
          metadata,
        })
      }
    }

    if (storedPendingClarification) {
      await access.botService.updateBot(botId, {
        metadata: clearPendingClarificationMetadata(metadataWithAnswer),
      })
    }

    const snapshot = await startBotAgentRun({
      botId,
      prompt: effectivePrompt,
      locale: payload.locale,
      chatId: storedPendingClarification?.chatId ?? payload.chatId ?? undefined,
      attachments,
      runId: storedPendingClarification?.runId,
      suppressUserMessage: Boolean(storedPendingClarification),
    })

    const latestBot = await access.botService.getBot(botId)
    if (!latestBot) {
      throw new Error('Bot not found')
    }

    return toPlainServerActionPayload({
      success: true as const,
      snapshot: sanitizeSnapshot(snapshot),
      model: 'z-ai/glm-5.1',
      metadata: latestBot.metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getBotAgentRunStatusAction(botId: string) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const result = await getBotAgentRunStatus(botId)
    const latestBot = await access.botService.getBot(botId)

    return toPlainServerActionPayload({
      success: true as const,
      snapshot: sanitizeSnapshot(result.snapshot),
      config: result.config,
      metadata: latestBot?.metadata || access.bot.metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function cancelBotAgentRunAction(botId: string, runId?: string | null) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const snapshot = await cancelBotAgentRun(botId, runId)
    const latestBot = await access.botService.getBot(botId)

    return toPlainServerActionPayload({
      success: true as const,
      snapshot: sanitizeSnapshot(snapshot),
      metadata: latestBot?.metadata || access.bot.metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createAiChatThreadAction(botId: string, payload?: { title?: string; locale?: string }) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const aiChatState = getAiChatState(access.bot.metadata)
    const nextThread = createAiChatThread(payload?.locale, payload?.title)
    const nextState = upsertAiChatThread(aiChatState, nextThread, true)
    const metadata = mergeAiChatMetadata(access.bot, nextState)
    await access.botService.updateBot(botId, { metadata })

    return toPlainServerActionPayload({
      success: true as const,
      metadata,
      chatId: nextThread.id,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function switchAiChatThreadAction(botId: string, chatId: string) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const aiChatState = switchActiveChat(getAiChatState(access.bot.metadata), String(chatId || '').trim())
    const metadata = mergeAiChatMetadata(access.bot, aiChatState)
    await access.botService.updateBot(botId, { metadata })

    return toPlainServerActionPayload({
      success: true as const,
      metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function renameAiChatThreadAction(botId: string, payload: { chatId: string; title: string }) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    const aiChatState = renameThreadInState(
      getAiChatState(access.bot.metadata),
      String(payload.chatId || '').trim(),
      String(payload.title || '').trim()
    )
    const metadata = mergeAiChatMetadata(access.bot, aiChatState)
    await access.botService.updateBot(botId, { metadata })

    return toPlainServerActionPayload({
      success: true as const,
      metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteAiChatThreadAction(botId: string, chatId: string) {
  const access = await getAuthorizedBot(botId)
  if (!access.success) {
    return access
  }

  try {
    let aiChatState = deleteThreadFromState(getAiChatState(access.bot.metadata), String(chatId || '').trim())

    if (aiChatState.chats.length === 0) {
      const nextThread = createAiChatThread('ru')
      aiChatState = upsertAiChatThread(aiChatState, nextThread, true)
    }

    const metadata = mergeAiChatMetadata(access.bot, aiChatState)
    await access.botService.updateBot(botId, { metadata })

    return toPlainServerActionPayload({
      success: true as const,
      metadata,
    })
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
