import 'server-only'

import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requestOpenRouterJson,
  requestOpenRouterJsonStream,
} from '@/lib/bot-editor/quick-start/openrouter'
import { createBotService, validateBotConfig } from '@/lib/bot-editor/services/bot-service'
import { appendBotTestLog, setBotTestLogRunContext } from '@/lib/bot-editor/runtime/test-log-store'
import { updateTelegramPollingConfig } from '@/lib/bot-editor/runtime/polling-runtime'
import { clearRuntimeSessionsForBot } from '@/lib/bot-editor/runtime/workflow-runtime'
import {
  clearAgentRunPreview,
  publishAgentRunPreview,
  publishAgentRunSnapshot,
} from '@/lib/bot-editor/agent/events'
import {
  appendMessageToThread,
  createAiChatThread,
  getActiveChatThread,
  getAiChatState,
  mergeAiChatMetadata,
  pickChatTitleFromPrompt,
  replaceThreadInState,
} from '@/lib/bot-editor/ai-chat/metadata'
import {
  canUseNodeAsIncomingTarget,
  canUseNodeAsOutgoingSource,
  getNodeCapabilityCatalog,
  isValidSourceHandleForNode,
  sanitizeNodeDataForAgent,
} from '@/lib/bot-editor/agent/catalog'
import type {
  AiAgentAttachment,
  AiChatStoredMessage,
  AiChatThread,
  AiAgentCommandEnvelope,
  AiAgentLivePreview,
  AiAgentOperation,
  AiAgentRunMode,
  AiAgentRunSnapshot,
  AiAgentRunStatus,
  AiAgentTaskItem,
  Bot,
  BotConfig,
  BotMetadata,
  BotStatus,
  BotVariable,
  Edge,
  Node,
  NodeType,
} from '@/lib/bot-editor/types/bot.types'

declare global {
  var __tflowBotAgentRegistry: Map<string, AgentRegistryEntry> | undefined
}

type AgentRegistryEntry = {
  botId: string
  runId: string
  cancelled: boolean
  controller: AbortController
  promise: Promise<void>
}

type StartAgentRunInput = {
  botId: string
  prompt: string
  locale?: string
  chatId?: string
  attachments?: AiAgentAttachment[]
  runId?: string
  suppressUserMessage?: boolean
}

type AgentExecutionContext = {
  botId: string
  runId: string
  chatId: string
  prompt: string
  locale: 'ru' | 'en'
  attachments: AiAgentAttachment[]
  chatContext?: AgentChatContext
  snapshot: AiAgentRunSnapshot
}

type AgentChatContext = {
  threadTitle: string
  summary?: string
  recentMessages: Array<{
    role: AiChatStoredMessage['role']
    content: string
    createdAt: string
    attachments?: Array<Pick<AiAgentAttachment, 'name' | 'kind'>>
  }>
}

type AgentRouteDecision = {
  mode: AiAgentRunMode
  reason?: string
}

type AgentResponseEnvelope = {
  answer: string
}

type ChatSummaryEnvelope = {
  summary: string
}

type AgentOperationApplyResult = {
  config: BotConfig
  botPatch?: Partial<Pick<Bot, 'name' | 'description' | 'status'>> & {
    metadata?: BotMetadata
  }
  summaryOverride?: string
}

const AGENT_MODEL_ID = 'z-ai/glm-5.1'
const ACTIVE_AGENT_STATUSES = new Set<AiAgentRunStatus>(['planning', 'running', 'verifying'])
const AGENT_MAX_STEPS = 14
const ORPHAN_ACTIVE_RUN_TIMEOUT_MS = 45_000
const AGENT_LAYOUT_X_START = 80
const AGENT_LAYOUT_Y_START = 80
const AGENT_LAYOUT_X_GAP = 320
const AGENT_LAYOUT_Y_GAP = 180
const CHAT_SUMMARY_THRESHOLD = 20
const CHAT_RECENT_CONTEXT_COUNT = 8
const AGENT_VARIABLE_TYPES = new Set<BotVariable['type']>([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'user',
  'message',
  'date',
])
const AGENT_VARIABLE_SCOPES = new Set<NonNullable<BotVariable['scope']>>([
  'global',
  'user',
  'chat',
  'temporary',
])
const AGENT_BOT_STATUSES = new Set<BotStatus>(['draft', 'active', 'archived', 'error'])
const AGENT_NODE_TYPES = new Set<NodeType>([
  'trigger',
  'message',
  'input',
  'condition',
  'router',
  'scheduler',
  'replyKeyboard',
  'script',
  'action',
  'http',
  'webhook',
  'paymentYookassa',
  'paymentStripe',
  'paymentRobokassa',
  'paymentStars',
  'wait',
  'comment',
])
const AGENT_COMMAND_ENVELOPE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['currentAction', 'operations', 'done'],
  properties: {
    plan: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
    currentAction: { type: 'string' },
    completedTasksDelta: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' },
    },
    analysis: { type: 'string' },
    nextAction: { type: 'string' },
    operations: {
      type: 'array',
      maxItems: 8,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'nodeKey', 'nodeType'],
            properties: {
              type: { const: 'addNode' },
              nodeKey: { type: 'string' },
              nodeType: {
                type: 'string',
                enum: [...AGENT_NODE_TYPES],
              },
              data: { type: 'object' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'nodeRef'],
            properties: {
              type: { const: 'updateNode' },
              nodeRef: { type: 'string' },
              data: { type: 'object' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'nodeRef'],
            properties: {
              type: { const: 'deleteNode' },
              nodeRef: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'sourceRef', 'targetRef'],
            properties: {
              type: { const: 'connectNodes' },
              sourceRef: { type: 'string' },
              targetRef: { type: 'string' },
              sourceHandle: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
              label: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'sourceRef', 'targetRef'],
            properties: {
              type: { const: 'disconnectEdge' },
              sourceRef: { type: 'string' },
              targetRef: { type: 'string' },
              sourceHandle: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'nodeRef', 'x', 'y'],
            properties: {
              type: { const: 'moveNode' },
              nodeRef: { type: 'string' },
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'variables'],
            properties: {
              type: { const: 'upsertVariables' },
              variables: {
                type: 'array',
                maxItems: 20,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'type'],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: {
                      type: 'string',
                      enum: [...AGENT_VARIABLE_TYPES],
                    },
                    default_value: {},
                    description: { type: 'string' },
                    scope: {
                      type: 'string',
                      enum: [...AGENT_VARIABLE_SCOPES],
                    },
                  },
                },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { const: 'updateBotSettings' },
              name: { type: 'string' },
              description: { type: 'string' },
              status: {
                type: 'string',
                enum: ['draft', 'active', 'archived', 'error'],
              },
              webhookUrl: { type: 'string' },
              profileStyle: { type: 'object' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'features'],
            properties: {
              type: { const: 'updateSystemFeatures' },
              features: { type: 'object' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { const: 'finishRun' },
              summary: { type: 'string' },
            },
          },
        ],
      },
    },
    done: { type: 'boolean' },
    summary: { type: 'string' },
  },
}
const AGENT_ROUTE_DECISION_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['mode'],
  properties: {
    mode: {
      type: 'string',
      enum: ['build', 'respond'],
    },
    reason: {
      type: 'string',
    },
  },
}
const AGENT_RESPONSE_ENVELOPE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['answer'],
  properties: {
    answer: {
      type: 'string',
    },
  },
}
const CHAT_SUMMARY_ENVELOPE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary'],
  properties: {
    summary: {
      type: 'string',
    },
  },
}

const agentRegistry: Map<string, AgentRegistryEntry> =
  globalThis.__tflowBotAgentRegistry || new Map<string, AgentRegistryEntry>()

if (!globalThis.__tflowBotAgentRegistry) {
  globalThis.__tflowBotAgentRegistry = agentRegistry
}

function getAdminBotService() {
  return createBotService(createAdminClient())
}

function toLocale(locale?: string): 'ru' | 'en' {
  return locale === 'en' ? 'en' : 'ru'
}

function normalizeText(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function normalizeIdentifier(value: unknown, fallback = 'node'): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w:-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)

  return normalized || fallback
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function isActiveStatus(status?: AiAgentRunStatus | null): boolean {
  return status ? ACTIVE_AGENT_STATUSES.has(status) : false
}

function isLegacyInterruptedRunError(error: unknown) {
  const normalized = String(error || '').trim().toLowerCase()
  return normalized.includes('server restart') || normalized.includes('process reload')
}

function getCurrentRun(bot: Bot | null | undefined): AiAgentRunSnapshot | null {
  if (!bot?.metadata?.aiAgent || typeof bot.metadata.aiAgent !== 'object') {
    return null
  }

  const currentRun = (bot.metadata.aiAgent as { currentRun?: AiAgentRunSnapshot | null }).currentRun
  return currentRun || null
}

function mergeAgentSnapshotMetadata(bot: Bot, snapshot: AiAgentRunSnapshot | null) {
  const currentAiAgent =
    bot.metadata?.aiAgent && typeof bot.metadata.aiAgent === 'object'
      ? (bot.metadata.aiAgent as Record<string, unknown>)
      : {}

  const shouldClearPending =
    !snapshot ||
    snapshot.status === 'completed' ||
    snapshot.status === 'failed' ||
    snapshot.status === 'cancelled'

  return {
    ...(bot.metadata || {}),
    aiAgent: {
      ...currentAiAgent,
      currentRun: snapshot,
      ...(shouldClearPending ? { pendingClarification: null } : {}),
    },
  }
}

function mergeAgentAndChatMetadata(
  bot: Bot,
  snapshot: AiAgentRunSnapshot | null,
  aiChatState: ReturnType<typeof getAiChatState>
) {
  const metadataWithChat = mergeAiChatMetadata(bot, aiChatState)
  return mergeAgentSnapshotMetadata(
    {
      ...bot,
      metadata: metadataWithChat,
    },
    snapshot
  )
}

function formatChatMessageForContext(message: AiChatStoredMessage) {
  const attachmentText = (message.attachments || [])
    .map((attachment) => `${attachment.kind}:${attachment.name}`)
    .join(', ')

  const content = normalizeText(message.content, 1200)
  if (attachmentText && content) {
    return `${content}\n[attachments: ${attachmentText}]`
  }

  if (attachmentText) {
    return `[attachments: ${attachmentText}]`
  }

  return content
}

function buildRunMessageContent(snapshot: AiAgentRunSnapshot) {
  const parts = [
    snapshot.summary,
    snapshot.responseText,
    snapshot.error,
    snapshot.analysis,
    snapshot.currentAction,
  ]
    .map((value) => normalizeText(value, 4000))
    .filter(Boolean)

  return parts.join('\n\n')
}

function buildFinalRunSummaryContent(snapshot: AiAgentRunSnapshot, locale: 'ru' | 'en') {
  const summary = normalizeText(snapshot.summary || snapshot.responseText, 1000)
  if (summary) {
    return locale === 'en' ? `Done. ${summary}` : `Готово. ${summary}`
  }

  return locale === 'en'
    ? 'Done. I finished the work and saved the bot changes.'
    : 'Готово. Я завершил работу и сохранил изменения бота.'
}

async function appendAssistantRunMessage(
  botId: string,
  snapshot: AiAgentRunSnapshot,
  options?: {
    appendFinalSummary?: boolean
    locale?: 'ru' | 'en'
  }
) {
  const chatId = normalizeText(snapshot.chatId, 160)
  if (!chatId) {
    return
  }

  const botService = getAdminBotService()
  const bot = await botService.getBot(botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  const aiChatState = getAiChatState(bot.metadata)
  const thread = aiChatState.chats.find((item) => item.id === chatId)
  if (!thread) {
    return
  }

  const hasRunMessage = thread.messages.some((message) => message.runId === snapshot.runId && message.role === 'assistant')

  let nextThread = hasRunMessage
    ? thread
    : appendMessageToThread(thread, {
        runId: snapshot.runId,
        role: 'assistant',
        content: buildRunMessageContent(snapshot),
        model: snapshot.model,
        renderMode: snapshot.mode === 'build' ? 'agent-run' : 'plain',
        agentRun: snapshot.mode === 'build' ? snapshot : undefined,
      })

  const finalSummaryRunId = `${snapshot.runId}:summary`
  const hasFinalSummaryMessage = thread.messages.some((message) => message.runId === finalSummaryRunId && message.role === 'assistant')
  if (
    options?.appendFinalSummary &&
    snapshot.status === 'completed' &&
    snapshot.mode === 'build' &&
    !hasFinalSummaryMessage
  ) {
    nextThread = appendMessageToThread(nextThread, {
      runId: finalSummaryRunId,
      role: 'assistant',
      content: buildFinalRunSummaryContent(snapshot, options.locale || 'ru'),
      model: snapshot.model,
      renderMode: 'plain',
    })
  }

  await botService.updateBot(botId, {
    metadata: mergeAiChatMetadata(bot, replaceThreadInState(aiChatState, nextThread)),
  })
}

function buildEffectivePrompt(
  prompt: string,
  attachments: AiAgentAttachment[],
  locale: 'ru' | 'en'
) {
  const normalizedPrompt = normalizeText(prompt, 8000)
  if (normalizedPrompt) {
    return normalizedPrompt
  }

  const attachmentNames = attachments
    .map((attachment) => normalizeText(attachment.name, 160))
    .filter(Boolean)

  if (attachmentNames.length === 0) {
    return ''
  }

  return locale === 'en'
    ? `Analyze the attached files and continue the current chat context. Files: ${attachmentNames.join(', ')}`
    : `Проанализируй приложенные файлы и продолжи текущий чат. Файлы: ${attachmentNames.join(', ')}`
}

function buildChatContextPayload(thread: AiChatThread): AgentChatContext {
  const summary = normalizeText(thread.summary, 4000) || undefined
  const summarizedMessageCount = Math.max(0, Number(thread.summarizedMessageCount || 0) || 0)
  const recentMessages = thread.messages
    .slice(summary ? summarizedMessageCount : 0)
    .slice(-CHAT_RECENT_CONTEXT_COUNT)
    .map((message) => ({
      role: message.role,
      content: formatChatMessageForContext(message),
      createdAt: message.createdAt,
      attachments: (message.attachments || []).map((attachment) => ({
        name: attachment.name,
        kind: attachment.kind,
      })),
    }))

  return {
    threadTitle: thread.title,
    summary,
    recentMessages,
  }
}

async function summarizeChatThread(
  locale: 'ru' | 'en',
  previousSummary: string | undefined,
  nextMessages: AiChatStoredMessage[],
  signal?: AbortSignal
) {
  const systemPrompt = locale === 'en'
    ? [
        'You compress a bot-builder conversation into a short working memory summary.',
        'Return JSON only as {"summary":"..."}',
        'Keep only stable facts: user goals, business context, constraints, chosen style, important decisions, unresolved requests, current bot state notes.',
        'Do not copy the whole chat. Keep it dense and practical. Maximum 1400 characters.',
      ].join('\n')
    : [
        'Ты сжимаешь разговор в редакторе ботов в короткую рабочую память.',
        'Верни только JSON в формате {"summary":"..."}',
        'Сохраняй только устойчивые факты: цель пользователя, бизнес-контекст, ограничения, выбранный стиль, важные решения, незавершённые запросы и важные заметки о текущем боте.',
        'Не копируй весь чат. Сделай кратко и по делу. Максимум 1400 символов.',
      ].join('\n')

  const payload = {
    previousSummary: normalizeText(previousSummary, 4000),
    newMessages: nextMessages.map((message) => ({
      role: message.role,
      content: formatChatMessageForContext(message),
      createdAt: message.createdAt,
    })),
  }

  const response = await requestOpenRouterJson<ChatSummaryEnvelope>({
    model: AGENT_MODEL_ID,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(payload, null, 2) },
    ],
    schema: CHAT_SUMMARY_ENVELOPE_SCHEMA,
    temperature: 0.1,
    maxTokens: 900,
    signal,
  })

  return normalizeText(response.parsed?.summary, 1400)
}

async function ensureChatContext(botId: string, chatId: string, locale: 'ru' | 'en') {
  const botService = getAdminBotService()
  const bot = await botService.getBot(botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  const aiChatState = getAiChatState(bot.metadata)
  const thread = aiChatState.chats.find((item) => item.id === chatId)

  if (!thread) {
    return null
  }

  if (thread.messages.length <= CHAT_SUMMARY_THRESHOLD) {
    return buildChatContextPayload(thread)
  }

  const targetSummarizedCount = Math.max(0, thread.messages.length - CHAT_RECENT_CONTEXT_COUNT)
  const currentSummarizedCount = Math.max(0, Number(thread.summarizedMessageCount || 0) || 0)

  if (thread.summary && currentSummarizedCount >= targetSummarizedCount) {
    return buildChatContextPayload(thread)
  }

  const newSummary = await summarizeChatThread(
    locale,
    thread.summary,
    thread.messages.slice(currentSummarizedCount, targetSummarizedCount),
    agentRegistry.get(botId)?.controller.signal
  )

  if (!newSummary) {
    return buildChatContextPayload(thread)
  }

  const nextThread: AiChatThread = {
    ...thread,
    summary: newSummary,
    summarizedMessageCount: targetSummarizedCount,
  }

  await botService.updateBot(botId, {
    metadata: mergeAiChatMetadata(bot, replaceThreadInState(aiChatState, nextThread)),
  })

  return buildChatContextPayload(nextThread)
}

async function persistRunSnapshot(botId: string, snapshot: AiAgentRunSnapshot | null) {
  const botService = getAdminBotService()
  const bot = await botService.getBot(botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  await botService.updateBot(botId, {
    metadata: mergeAgentSnapshotMetadata(bot, snapshot),
  })

  publishAgentRunSnapshot(botId, snapshot)
}

function appendAgentLog(botId: string, runId: string, message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
  appendBotTestLog(botId, 'agent', message, level, { runId })
}

function makeTaskItems(previous: AiAgentTaskItem[], delta: string[] | undefined, timestamp: string): AiAgentTaskItem[] {
  const next = [...previous]
  const seen = new Set(previous.map((item) => item.text.trim().toLowerCase()))

  for (const taskTextRaw of delta || []) {
    const taskText = normalizeText(taskTextRaw, 240)
    if (!taskText) continue
    const comparable = taskText.toLowerCase()
    if (seen.has(comparable)) continue

    next.push({
      id: randomUUID(),
      text: taskText,
      completedAt: timestamp,
    })
    seen.add(comparable)
  }

  return next
}

function buildBaseSnapshot(input: StartAgentRunInput, runId: string): AiAgentRunSnapshot {
  const now = new Date().toISOString()

  return {
    runId,
    chatId: normalizeText(input.chatId, 160) || undefined,
    status: 'planning',
    model: AGENT_MODEL_ID,
    startedAt: now,
    updatedAt: now,
    currentAction: input.locale === 'en' ? 'Analyzing the request' : 'Анализирую запрос',
    nextAction: input.locale === 'en' ? 'Choose the correct work mode' : 'Выбираю правильный режим работы',
    completedTasks: [],
    analysis: input.locale === 'en'
      ? 'The agent is determining whether this request needs a direct answer or workflow development.'
      : 'Определяю, нужен ли для этого запроса обычный ответ или разработка сценария.',
    locked: true,
    prompt: normalizeText(input.prompt, 8000),
    attachments: cloneValue(input.attachments || []),
    plan: [],
    stepCount: 0,
  }
}

function normalizeCallbackValue(value: unknown) {
  return normalizeText(value, 120)
}

function collectCallbackButtons(config: BotConfig) {
  const buttons: Array<{
    nodeId: string
    nodeLabel: string
    text: string
    callbackData: string
  }> = []

  for (const node of config.nodes) {
    if (node.type !== 'message' && node.type !== 'input') {
      continue
    }

    const data = node.data && typeof node.data === 'object'
      ? (node.data as Record<string, unknown>)
      : {}
    const keyboard = data.keyboard || data.inlineKeyboard || (Array.isArray(data.buttons) ? { rows: [{ buttons: data.buttons }] } : null)
    const rows = keyboard && typeof keyboard === 'object' && !Array.isArray(keyboard)
      ? (Array.isArray((keyboard as Record<string, unknown>).rows)
        ? ((keyboard as Record<string, unknown>).rows as unknown[])
        : (Array.isArray((keyboard as Record<string, unknown>).inline_keyboard)
          ? ((keyboard as Record<string, unknown>).inline_keyboard as unknown[])
          : []))
      : []

    for (const row of rows) {
      const rawButtons = Array.isArray(row)
        ? row
        : (row && typeof row === 'object' && Array.isArray((row as Record<string, unknown>).buttons)
          ? ((row as Record<string, unknown>).buttons as unknown[])
          : [])

      for (const rawButton of rawButtons) {
        const button = rawButton && typeof rawButton === 'object' && !Array.isArray(rawButton)
          ? (rawButton as Record<string, unknown>)
          : {}
        const actionType = normalizeText(button.actionType ?? button.kind ?? button.type, 40)
        const callbackData = normalizeCallbackValue(
          button.callbackData ?? button.callback_data ?? button.data ?? button.value ?? button.action
        )
        const url = normalizeText(button.url ?? button.starsUrl ?? button.paymentUrl ?? button.payment_url, 500)

        if ((actionType && actionType !== 'callback') || url || !callbackData) {
          continue
        }

        buttons.push({
          nodeId: node.id,
          nodeLabel:
            normalizeText(data.__label, 120) ||
            normalizeText(data.label, 120) ||
            node.id,
          text:
            normalizeText(button.text, 80) ||
            normalizeText(button.label, 80) ||
            callbackData,
          callbackData,
        })
      }
    }
  }

  return buttons
}

function buildCallbackAudit(config: BotConfig) {
  const callbackButtons = collectCallbackButtons(config)
  const callbackTriggers = config.nodes
    .filter((node) => node.type === 'trigger')
    .map((node) => ({
      node,
      data: node.data && typeof node.data === 'object' ? (node.data as Record<string, unknown>) : {},
    }))
    .filter((item) => normalizeText(item.data.trigger || 'command', 40) === 'callbackQuery')

  const routerById = new Map(config.nodes.filter((node) => node.type === 'router').map((node) => [node.id, node]))
  const outgoingBySource = new Map<string, Edge[]>()
  for (const edge of config.edges) {
    const outgoing = outgoingBySource.get(edge.source) || []
    outgoing.push(edge)
    outgoingBySource.set(edge.source, outgoing)
  }

  const issues: string[] = []

  for (const button of callbackButtons) {
    const exactTrigger = callbackTriggers.find((item) => normalizeCallbackValue(item.data.pattern) === button.callbackData)
    const catchAllTrigger = callbackTriggers.find((item) => !normalizeCallbackValue(item.data.pattern))
    const trigger = exactTrigger || catchAllTrigger

    if (!trigger) {
      issues.push(
        `Inline button "${button.text}" in node "${button.nodeId}" has callbackData "${button.callbackData}" but no callbackQuery trigger handles it.`
      )
      continue
    }

    const triggerOutgoing = outgoingBySource.get(trigger.node.id) || []
    if (triggerOutgoing.length === 0) {
      issues.push(
        `Callback trigger "${trigger.node.id}" handles "${button.callbackData}" but is not connected to the workflow.`
      )
      continue
    }

    const routerEdge = triggerOutgoing.find((edge) => routerById.has(edge.target))
    const router = routerEdge ? routerById.get(routerEdge.target) : null
    if (!router) {
      continue
    }

    const routerData = router.data && typeof router.data === 'object'
      ? (router.data as Record<string, unknown>)
      : {}
    const variable = normalizeText(routerData.variable, 120)
    const cases = Array.isArray(routerData.cases) ? routerData.cases : []
    const matchedCase = cases.find((item) => (
      item &&
      typeof item === 'object' &&
      normalizeCallbackValue((item as Record<string, unknown>).value) === button.callbackData
    )) as Record<string, unknown> | undefined

    if (variable !== 'callback.data') {
      issues.push(
        `Router "${router.id}" is connected after callback trigger "${trigger.node.id}" but routes by "${variable || '(empty)'}" instead of callback.data.`
      )
    }

    if (!matchedCase) {
      issues.push(
        `Router "${router.id}" has no case with value "${button.callbackData}" for inline button "${button.text}".`
      )
      continue
    }

    const caseHandle = `case:${normalizeText(matchedCase.id, 80)}`
    const hasCaseEdge = (outgoingBySource.get(router.id) || []).some((edge) => edge.sourceHandle === caseHandle)
    if (!hasCaseEdge) {
      issues.push(
        `Router "${router.id}" case "${caseHandle}" for callbackData "${button.callbackData}" is not connected to a target node.`
      )
    }
  }

  return {
    callbackButtons,
    callbackTriggers: callbackTriggers.map((item) => ({
      nodeId: item.node.id,
      pattern: normalizeCallbackValue(item.data.pattern),
      connectedTargets: (outgoingBySource.get(item.node.id) || []).map((edge) => edge.target),
    })),
    issues,
  }
}

function dedupeAgentMessages(messages: string[]) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const message of messages) {
    const normalized = normalizeText(message, 500)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(normalized)
  }

  return next
}

function buildCallbackValidationErrors(config: BotConfig) {
  return buildCallbackAudit(config).issues.map((issue) => `Callback wiring: ${issue}`)
}

function shouldAuditCallbackWiring(prompt: string) {
  const normalized = normalizeText(prompt, 1000).toLowerCase()
  return /callback|inline|кноп|меню|подключ|роут|router|case|ветк|сценари|граф|холст/.test(normalized)
}

function buildAgentValidationErrors(config: BotConfig, validationErrors: string[], includeCallbackAudit: boolean) {
  return dedupeAgentMessages([
    ...validationErrors,
    ...(includeCallbackAudit ? buildCallbackValidationErrors(config) : []),
  ])
}

function removeAgentSecretMetadata(metadata: Record<string, unknown> | undefined | null) {
  const next = { ...(metadata || {}) }
  delete next.telegramToken
  delete next.webhookSecret
  return next
}

function normalizeAgentUrl(value: unknown, maxLength = 512) {
  const normalized = normalizeText(value, maxLength)
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) return normalized
  return ''
}

function sanitizeAgentProfileStyle(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const displayName = normalizeText(raw.displayName, 64)
  const desiredUsername = normalizeText(raw.desiredUsername, 32).replace(/^@+/, '').toLowerCase()
  const avatarUrl = normalizeAgentUrl(raw.avatarUrl)
  const about = normalizeText(raw.about, 512)
  const shortDescription = normalizeText(raw.shortDescription, 120)

  return {
    ...(displayName ? { displayName } : {}),
    ...(desiredUsername ? { desiredUsername } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(about ? { about } : {}),
    ...(shortDescription ? { shortDescription } : {}),
  }
}

function sanitizeAgentReplyKeyboardRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row, rowIndex) => {
      if (!Array.isArray(row)) return []
      return row
        .map((button, buttonIndex) => {
          const raw = typeof button === 'string'
            ? { text: button }
            : (button && typeof button === 'object' && !Array.isArray(button) ? button as Record<string, unknown> : {})
          const text = normalizeText(raw.text, 64)
          const emoji = normalizeText(raw.emoji, 8)
          if (!text && !emoji) return null
          const styleRaw = normalizeText(raw.style, 20)
          const style = styleRaw === 'primary' || styleRaw === 'success' || styleRaw === 'danger' ? styleRaw : 'default'
          return {
            id: normalizeText(raw.id, 48) || `b_${rowIndex + 1}_${buttonIndex + 1}`,
            text,
            ...(emoji ? { emoji } : {}),
            style,
            ...(normalizeText(raw.iconCustomEmojiId, 128) ? { iconCustomEmojiId: normalizeText(raw.iconCustomEmojiId, 128) } : {}),
          }
        })
        .filter(Boolean)
        .slice(0, 10)
    })
    .filter((row) => row.length > 0)
    .slice(0, 12)
}

function sanitizeAgentReplyKeyboardRule(value: unknown, index: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const allowedOperators = new Set(['equals', 'notEquals', 'contains', 'notContains', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty'])
  const operator = normalizeText(raw.operator, 40)
  return {
    id: normalizeText(raw.id, 48) || `rule_${index + 1}`,
    name: normalizeText(raw.name, 80) || `Rule ${index + 1}`,
    enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    variable: normalizeText(raw.variable, 120),
    operator: allowedOperators.has(operator) ? operator : 'equals',
    value: normalizeText(raw.value, 256),
    rows: sanitizeAgentReplyKeyboardRows(raw.rows),
  }
}

function sanitizeAgentFeaturesPatch(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value as Record<string, unknown>
  const next: Record<string, unknown> = {}

  if (raw.autoReactions && typeof raw.autoReactions === 'object' && !Array.isArray(raw.autoReactions)) {
    const auto = raw.autoReactions as Record<string, unknown>
    const cooldownRaw = Number(auto.cooldownSeconds)
    next.autoReactions = {
      enabled: Boolean(auto.enabled),
      onlyTextMessages: auto.onlyTextMessages === undefined ? true : Boolean(auto.onlyTextMessages),
      cooldownSeconds: Number.isFinite(cooldownRaw) ? Math.max(0, Math.min(3600, Math.round(cooldownRaw))) : 15,
      mode: 'rule-based',
    }
  }

  if (raw.messageDrafts && typeof raw.messageDrafts === 'object' && !Array.isArray(raw.messageDrafts)) {
    const drafts = raw.messageDrafts as Record<string, unknown>
    next.messageDrafts = { enabled: Boolean(drafts.enabled) }
  }

  if (raw.subscriberMode && typeof raw.subscriberMode === 'object' && !Array.isArray(raw.subscriberMode)) {
    const subscribers = raw.subscriberMode as Record<string, unknown>
    next.subscriberMode = {
      enabled: Boolean(subscribers.enabled),
      privateChatsOnly: subscribers.privateChatsOnly === undefined ? true : Boolean(subscribers.privateChatsOnly),
      trackCallbacks: subscribers.trackCallbacks === undefined ? true : Boolean(subscribers.trackCallbacks),
    }
  }

  if (raw.replyKeyboard && typeof raw.replyKeyboard === 'object' && !Array.isArray(raw.replyKeyboard)) {
    const keyboard = raw.replyKeyboard as Record<string, unknown>
    const rulesRaw = Array.isArray(keyboard.rules) ? keyboard.rules : []
    next.replyKeyboard = {
      enabled: Boolean(keyboard.enabled),
      resizeKeyboard: keyboard.resizeKeyboard === undefined ? true : Boolean(keyboard.resizeKeyboard),
      oneTimeKeyboard: Boolean(keyboard.oneTimeKeyboard),
      isPersistent: keyboard.isPersistent === undefined ? true : Boolean(keyboard.isPersistent),
      baseRows: sanitizeAgentReplyKeyboardRows(keyboard.baseRows),
      rules: rulesRaw
        .map((rule, index) => sanitizeAgentReplyKeyboardRule(rule, index))
        .filter(Boolean)
        .slice(0, 20),
    }
  }

  return next
}

function compactBotSettingsForPrompt(bot: Bot | null | undefined) {
  const metadata = removeAgentSecretMetadata((bot?.metadata || {}) as Record<string, unknown>)
  const features = metadata.features && typeof metadata.features === 'object' && !Array.isArray(metadata.features)
    ? metadata.features as Record<string, unknown>
    : {}
  const profileStyle = metadata.profileStyle && typeof metadata.profileStyle === 'object' && !Array.isArray(metadata.profileStyle)
    ? metadata.profileStyle as Record<string, unknown>
    : {}

  return {
    name: bot?.name || '',
    description: bot?.description || '',
    status: bot?.status || 'draft',
    webhookUrl: normalizeText(metadata.webhookUrl, 512),
    hasTelegramToken: Boolean(metadata.hasTelegramToken),
    profileStyle,
    systemFeatures: {
      autoReactions: features.autoReactions || null,
      messageDrafts: features.messageDrafts || null,
      replyKeyboard: features.replyKeyboard || null,
      subscriberMode: features.subscriberMode || null,
    },
  }
}

function compactGraphForPrompt(config: BotConfig) {
  return {
    nodes: config.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label:
        normalizeText((node.data as Record<string, unknown>)?.__label, 120) ||
        normalizeText((node.data as Record<string, unknown>)?.label, 120) ||
        node.type,
      allowedSourceHandles: node.type === 'comment'
        ? []
        : (node.type === 'condition'
          ? ['default', 'false']
          : (node.type === 'router'
            ? [
                'default',
                ...(
                  Array.isArray((node.data as Record<string, unknown>)?.cases)
                    ? ((node.data as Record<string, unknown>).cases as Array<Record<string, unknown>>)
                        .map((routerCase) => normalizeText(routerCase.id, 80))
                        .filter(Boolean)
                        .map((caseId) => `case:${caseId}`)
                    : []
                ),
              ]
            : (node.type === 'action' &&
              normalizeText(((node.data as Record<string, unknown>)?.action as Record<string, unknown> | undefined)?.type, 80) === 'random')
              ? ['a', 'b']
              : ['default'])),
      data: node.data,
    })),
    edges: config.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      label: edge.label || null,
    })),
    variables: config.variables,
    callbackAudit: buildCallbackAudit(config),
  }
}

function extractQuotedJsonString(source: string, startQuoteIndex: number) {
  let value = ''
  let escaped = false
  let closed = false

  for (let index = startQuoteIndex + 1; index < source.length; index += 1) {
    const char = source[index]

    if (escaped) {
      switch (char) {
        case 'n':
          value += '\n'
          break
        case 'r':
          value += '\r'
          break
        case 't':
          value += '\t'
          break
        case '"':
        case '\\':
        case '/':
          value += char
          break
        case 'b':
          value += '\b'
          break
        case 'f':
          value += '\f'
          break
        case 'u': {
          const code = source.slice(index + 1, index + 5)
          if (/^[0-9a-fA-F]{4}$/.test(code)) {
            value += String.fromCharCode(Number.parseInt(code, 16))
            index += 4
          }
          break
        }
        default:
          value += char
      }
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      closed = true
      break
    }

    value += char
  }

  return {
    value: value.trim(),
    closed,
  }
}

function extractPartialStringField(buffer: string, key: string): string | undefined {
  const keyToken = `"${key}"`
  const keyIndex = buffer.indexOf(keyToken)
  if (keyIndex === -1) {
    return undefined
  }

  const colonIndex = buffer.indexOf(':', keyIndex + keyToken.length)
  if (colonIndex === -1) {
    return undefined
  }

  const startQuoteIndex = buffer.indexOf('"', colonIndex + 1)
  if (startQuoteIndex === -1) {
    return undefined
  }

  const { value } = extractQuotedJsonString(buffer, startQuoteIndex)
  return value || undefined
}

function extractPartialStringArrayField(buffer: string, key: string): string[] | undefined {
  const keyToken = `"${key}"`
  const keyIndex = buffer.indexOf(keyToken)
  if (keyIndex === -1) {
    return undefined
  }

  const arrayStartIndex = buffer.indexOf('[', keyIndex + keyToken.length)
  if (arrayStartIndex === -1) {
    return undefined
  }

  const result: string[] = []
  let index = arrayStartIndex + 1

  while (index < buffer.length) {
    while (index < buffer.length && /[\s,]/.test(buffer[index])) {
      index += 1
    }

    if (index >= buffer.length || buffer[index] === ']') {
      break
    }

    if (buffer[index] !== '"') {
      break
    }

    const { value, closed } = extractQuotedJsonString(buffer, index)
    if (!value) {
      break
    }

    result.push(value)
    if (!closed) {
      break
    }

    let nextQuoteIndex = index + 1
    let escaped = false
    while (nextQuoteIndex < buffer.length) {
      const char = buffer[nextQuoteIndex]
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        nextQuoteIndex += 1
        break
      }
      nextQuoteIndex += 1
    }

    index = nextQuoteIndex
  }

  return result.length > 0 ? result : undefined
}

function buildLivePreviewFromBuffer(
  runId: string,
  rawText: string
): AiAgentLivePreview {
  return {
    runId,
    mode: 'build',
    updatedAt: new Date().toISOString(),
    rawText,
    plan: extractPartialStringArrayField(rawText, 'plan'),
    currentAction: extractPartialStringField(rawText, 'currentAction'),
    completedTasksDelta: extractPartialStringArrayField(rawText, 'completedTasksDelta'),
    analysis: extractPartialStringField(rawText, 'analysis'),
    nextAction: extractPartialStringField(rawText, 'nextAction'),
    summary: extractPartialStringField(rawText, 'summary'),
  }
}

function buildResponsePreviewFromBuffer(
  runId: string,
  rawText: string
): AiAgentLivePreview {
  return {
    runId,
    mode: 'respond',
    updatedAt: new Date().toISOString(),
    rawText,
    responseText: extractPartialStringField(rawText, 'answer') || '',
  }
}

function buildAgentFewShotMessages(locale: 'ru' | 'en') {
  const firstStepUser = {
    goal: locale === 'en' ? 'Build a lead bot for a dental clinic.' : 'Собери лид-бота для стоматологии.',
    locale,
    model: AGENT_MODEL_ID,
    stepIndex: 0,
    attachments: [],
    previousProgress: {
      completedTasks: [],
      currentAction: '',
      nextAction: '',
      analysis: '',
      plan: [],
    },
    validationErrors: [],
    currentGraph: {
      nodes: [],
      edges: [],
      variables: [],
    },
  }

  const firstStepAssistant = {
    plan: locale === 'en'
      ? ['Create entry trigger', 'Send the first business message', 'Add lead capture steps', 'Confirm the request']
      : ['Создать входной trigger', 'Отправить первое сообщение', 'Добавить сбор заявки', 'Подтвердить заявку'],
    currentAction: locale === 'en' ? 'Creating the entry point and the first message' : 'Создаю входную точку и первое сообщение',
    completedTasksDelta: locale === 'en'
      ? ['Prepared the first workflow skeleton']
      : ['Подготовил первый каркас сценария'],
    analysis: locale === 'en'
      ? 'The graph is empty, so I start with a minimal executable skeleton: trigger plus a user-facing message.'
      : 'Граф пустой, поэтому сначала создаю минимальный исполняемый каркас: trigger и пользовательское сообщение.',
    nextAction: locale === 'en' ? 'Add lead capture nodes' : 'Добавить ноды сбора заявки',
    operations: [
      {
        type: 'addNode',
        nodeKey: 'start_trigger',
        nodeType: 'trigger',
        data: {
          type: 'trigger',
          trigger: 'command',
          pattern: '/start',
          __label: locale === 'en' ? 'Start' : 'Старт',
        },
      },
      {
        type: 'addNode',
        nodeKey: 'welcome_message',
        nodeType: 'message',
        data: {
          type: 'message',
          text: locale === 'en' ? 'Welcome! Leave a request and we will contact you shortly.' : 'Здравствуйте! Оставьте заявку, и мы свяжемся с вами в ближайшее время.',
          parseMode: 'None',
          __label: locale === 'en' ? 'Welcome' : 'Приветствие',
        },
      },
      {
        type: 'connectNodes',
        sourceRef: 'start_trigger',
        targetRef: 'welcome_message',
      },
    ],
    done: false,
  }

  const routerStepUser = {
    goal: locale === 'en' ? 'Add branching by inline buttons.' : 'Добавь ветвление по inline-кнопкам.',
    locale,
    model: AGENT_MODEL_ID,
    stepIndex: 2,
    attachments: [],
    previousProgress: {
      completedTasks: firstStepAssistant.completedTasksDelta,
      currentAction: firstStepAssistant.currentAction,
      nextAction: firstStepAssistant.nextAction,
      analysis: firstStepAssistant.analysis,
      plan: firstStepAssistant.plan,
    },
    validationErrors: [],
    currentGraph: {
      nodes: [
        {
          id: 'start_trigger',
          type: 'trigger',
          label: locale === 'en' ? 'Start' : 'Старт',
          allowedSourceHandles: ['default'],
          data: {
            type: 'trigger',
            trigger: 'command',
            pattern: '/start',
          },
        },
        {
          id: 'welcome_message',
          type: 'message',
          label: locale === 'en' ? 'Welcome' : 'Приветствие',
          allowedSourceHandles: ['default'],
          data: {
            type: 'message',
            text: locale === 'en' ? 'Choose a section.' : 'Выберите раздел.',
            keyboard: {
              rows: [
                {
                  buttons: [
                    { id: 'services', text: locale === 'en' ? 'Services' : 'Услуги', actionType: 'callback', callbackData: 'services' },
                    { id: 'contact', text: locale === 'en' ? 'Contact' : 'Контакты', actionType: 'callback', callbackData: 'contact' },
                  ],
                },
              ],
            },
          },
        },
      ],
      edges: [
        {
          id: 'edge:start_trigger:default:welcome_message',
          source: 'start_trigger',
          target: 'welcome_message',
          sourceHandle: null,
          label: null,
        },
      ],
      variables: [],
    },
  }

  const routerStepAssistant = {
    currentAction: locale === 'en' ? 'Adding callback branching from button selection' : 'Добавляю ветвление по callback после выбора кнопки',
    completedTasksDelta: locale === 'en'
      ? ['Prepared a callback router for the main menu']
      : ['Подготовил callback-ветвление для главного меню'],
    analysis: locale === 'en'
      ? 'The existing message already contains inline buttons, so I add one callback trigger and route user choices by callback.data.'
      : 'В текущем сообщении уже есть inline-кнопки, поэтому добавляю callback-trigger и развожу выбор пользователя по callback.data.',
    nextAction: locale === 'en' ? 'Add target messages for each branch' : 'Добавить сообщения для каждой ветки',
    operations: [
      {
        type: 'addNode',
        nodeKey: 'callback_trigger',
        nodeType: 'trigger',
        data: {
          type: 'trigger',
          trigger: 'callbackQuery',
          pattern: '',
          __label: locale === 'en' ? 'Menu callback' : 'Callback меню',
        },
      },
      {
        type: 'addNode',
        nodeKey: 'callback_router',
        nodeType: 'router',
        data: {
          type: 'router',
          variable: 'callback.data',
          operator: 'equals',
          cases: [
            { id: 'services', label: locale === 'en' ? 'Services' : 'Услуги', value: 'services' },
            { id: 'contact', label: locale === 'en' ? 'Contact' : 'Контакты', value: 'contact' },
          ],
          defaultLabel: locale === 'en' ? 'Default' : 'По умолчанию',
          __label: locale === 'en' ? 'Menu router' : 'Роутер меню',
        },
      },
      {
        type: 'connectNodes',
        sourceRef: 'callback_trigger',
        targetRef: 'callback_router',
      },
    ],
    done: false,
  }

  return [
    { role: 'user' as const, content: JSON.stringify(firstStepUser, null, 2) },
    { role: 'assistant' as const, content: JSON.stringify(firstStepAssistant, null, 2) },
    { role: 'user' as const, content: JSON.stringify(routerStepUser, null, 2) },
    { role: 'assistant' as const, content: JSON.stringify(routerStepAssistant, null, 2) },
  ]
}

function buildRouteDecisionMessages(args: {
  prompt: string
  locale: 'ru' | 'en'
  config: BotConfig
  bot?: Bot | null
  chatContext?: AgentChatContext
}) {
  const systemPrompt = args.locale === 'en'
    ? [
        'You classify user requests for a Telegram bot builder assistant.',
        'Return JSON only.',
        'Choose mode "build" only when the user explicitly wants to create, modify, debug, connect, generate, rebuild, or otherwise change the bot canvas/workflow, bot settings, or system features.',
        'Choose mode "respond" when the user is greeting, chatting, asking a general question, asking how something works, asking for explanation, or expecting only an informational answer.',
        'If the user asks about the current bot logic without requesting edits, choose "respond".',
        'Short greetings like "hello", "hi", "привет", "как дела", "что умеешь" must be classified as "respond".',
        'If the user asks to add, change, fix, connect, generate, rebuild bot logic, or change Settings/System, choose "build".',
        'When uncertain, prefer "respond" unless the request clearly asks for bot changes.',
      ].join('\n')
    : [
        'Ты классифицируешь запрос пользователя для ассистента редактора Telegram-ботов.',
        'Верни только JSON.',
        'Выбирай mode "build" только когда пользователь явно хочет создать, изменить, починить, соединить, настроить, доработать, сгенерировать или пересобрать сценарий/логику на холсте, настройки бота или системные функции.',
        'Выбирай mode "respond", когда пользователь просто здоровается, общается, задаёт общий вопрос, спрашивает как что-то работает, просит объяснение, или ожидает только информационный ответ без изменений в боте.',
        'Если пользователь спрашивает про текущую логику бота без запроса на правки, выбирай "respond".',
        'Короткие запросы вроде "привет", "как дела", "что умеешь" всегда классифицируй как "respond".',
        'Если пользователь просит добавить, изменить, исправить, соединить, сгенерировать, пересобрать логику или поменять раздел Настройки/Система, выбирай "build".',
        'Если есть сомнение, выбирай "respond", пока нет явного запроса на изменения бота.',
      ].join('\n')

  const userPayload = {
    prompt: args.prompt,
    locale: args.locale,
    chatContext: args.chatContext || null,
    botSettings: compactBotSettingsForPrompt(args.bot),
    currentGraph: compactGraphForPrompt(args.config),
  }

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: JSON.stringify(userPayload, null, 2) },
  ]
}

function buildRespondMessages(args: {
  prompt: string
  locale: 'ru' | 'en'
  config: BotConfig
  bot?: Bot | null
  snapshot: AiAgentRunSnapshot
  chatContext?: AgentChatContext
}) {
  const systemPrompt = args.locale === 'en'
    ? [
        'You are a helpful assistant inside a Telegram bot builder.',
        'Return JSON only in the form {"answer":"..."}',
        'Follow this internal path: analyze the request, find relevant information from the current graph and available context, then answer the user.',
        'Do not propose canvas changes unless the user explicitly asks for them.',
        'Keep the answer direct, practical, and easy to read.',
        'All user-facing text must be in English.',
      ].join('\n')
    : [
        'Ты полезный ассистент внутри редактора Telegram-ботов.',
        'Верни только JSON в формате {"answer":"..."}',
        'Следуй внутреннему пути: проанализируй запрос, найди релевантную информацию в текущем графе и доступном контексте, затем ответь пользователю.',
        'Не предлагай изменения холста, если пользователь прямо этого не просит.',
        'Ответ должен быть прямым, практичным и легко читаемым.',
        'Весь пользовательский текст должен быть на русском языке.',
      ].join('\n')

  const userPayload = {
    prompt: args.prompt,
    locale: args.locale,
    chatContext: args.chatContext || null,
    botSettings: compactBotSettingsForPrompt(args.bot),
    currentGraph: compactGraphForPrompt(args.config),
    previousProgress: {
      currentAction: args.snapshot.currentAction,
      analysis: args.snapshot.analysis || '',
    },
    nodeCapabilityCatalog: getNodeCapabilityCatalog(),
  }

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: JSON.stringify(userPayload, null, 2) },
  ]
}

function buildAgentMessages(args: {
  prompt: string
  locale: 'ru' | 'en'
  attachments: AiAgentAttachment[]
  chatContext?: AgentChatContext
  snapshot: AiAgentRunSnapshot
  config: BotConfig
  bot?: Bot | null
  stepIndex: number
  validationErrors: string[]
}) {
  const isRepairStep = args.validationErrors.length > 0
  const systemPrompt = [
    'You are a server-side bot-canvas agent for a Telegram bot builder.',
    'Return JSON only. No markdown, no prose outside the JSON object, no code fences.',
    'Your output must match the command-envelope format exactly.',
    'Think internally, but expose only: plan, currentAction, completedTasksDelta, analysis, nextAction, operations, done, summary.',
    'Before doing build operations, produce a short stable plan. Treat plan as the task queue: keep unfinished plan items in plan until done, put the currently executed item in currentAction, and move finished items into completedTasksDelta.',
    'After previousProgress.plan is present, execute the plan with concrete operations. Do not keep returning an empty operations array.',
    'Advance in small deterministic steps. Prefer 1-4 focused operations per step.',
    'If the graph is empty, first create a minimal executable skeleton with at least one trigger and one user-facing node.',
    'When the graph already exists, prefer incremental edits instead of recreating large parts of the flow.',
    'Do not delete or replace valid graph sections unless they clearly conflict with the user goal or validation errors.',
    'Use only supported node types and fields from the provided catalog.',
    'Never invent unsupported source handles or runtime-only fields.',
    'You may also change Settings and System by operations: updateBotSettings changes bot name, description, status, webhookUrl, profileStyle; updateSystemFeatures changes features.autoReactions, features.messageDrafts, features.replyKeyboard, and features.subscriberMode.',
    'Do not write or expose Telegram bot tokens. If a token is required, explain that the user must add it manually in Settings.',
    'Trigger nodes and comment nodes cannot be targets of edges.',
    'Comment nodes must stay disconnected.',
    'Condition nodes: true/default branch uses no sourceHandle, false branch uses sourceHandle "false".',
    'Router nodes: case branches use sourceHandle "case:<caseId>", default branch uses no sourceHandle.',
    'Action nodes with action.type="random" use handles "a" and "b". Other action nodes use only the default edge.',
    'Keep the graph acyclic and connected for executable nodes.',
    'For inline callback menus, do not stop at adding buttons. Every callback button must have a callbackData value handled by a callbackQuery trigger, then usually a router with variable "callback.data", a matching case.value, and an outgoing edge from sourceHandle "case:<caseId>" to the intended branch.',
    'When the user says a callback menu/button is not connected, first inspect currentGraph.callbackAudit. Fix existing callbackData/trigger/router/case/edge wiring instead of creating duplicate buttons.',
    'Use nodeKey only for nodes created in the current step. For existing nodes in later steps, always reference actual node ids from currentGraph.',
    'Set done=true only when the flow is already coherent, all essential branches are connected, and no obvious next build step remains.',
    isRepairStep
      ? 'You are in repair mode. Prioritize fixing the listed validation errors with the smallest safe patch. Prefer updateNode, connectNodes, disconnectEdge, or deleteNode over adding new nodes.'
      : 'You are in build mode. Grow the graph in coherent stages: entry, user-facing flow, branching, data capture, integrations, final confirmation.',
    `All user-facing bot text must be localized to ${args.locale === 'en' ? 'English' : 'Russian'}.`,
  ].join('\n')

  const userPayload = {
    mode: isRepairStep ? 'repair' : 'build',
    goal: args.prompt,
    locale: args.locale,
    chatContext: args.chatContext || null,
    model: AGENT_MODEL_ID,
    stepIndex: args.stepIndex,
    attachments: args.attachments.map((attachment) => ({
      name: attachment.name,
      mimeType: attachment.mimeType,
      kind: attachment.kind,
      path: attachment.path,
    })),
    previousProgress: {
      completedTasks: args.snapshot.completedTasks.map((task) => task.text),
      currentAction: args.snapshot.currentAction,
      nextAction: args.snapshot.nextAction || '',
      analysis: args.snapshot.analysis || '',
      plan: args.snapshot.plan || [],
    },
    validationErrors: args.validationErrors,
    validationErrorCount: args.validationErrors.length,
    botSettings: compactBotSettingsForPrompt(args.bot),
    currentGraph: compactGraphForPrompt(args.config),
    nodeCapabilityCatalog: getNodeCapabilityCatalog(),
    envelopeRules: {
      operationsAllowed: [
        'addNode',
        'updateNode',
        'deleteNode',
        'connectNodes',
        'disconnectEdge',
        'moveNode',
        'upsertVariables',
        'updateBotSettings',
        'updateSystemFeatures',
        'finishRun',
      ],
      commandRules: [
        'For addNode use nodeKey as the temporary reference for this step.',
        'For later steps use actual existing node ids from currentGraph.',
        'Use updateSystemFeatures for the System section instead of making fake nodes for global reply keyboard, auto reactions, message drafts, or subscriber tracking.',
        'Use updateBotSettings for the Settings section instead of making fake nodes for bot name, description, status, webhook URL, or profile style.',
        'If the graph is complete and valid, set done=true and include finishRun or summary.',
      ],
    },
    strategyHints: isRepairStep
      ? [
          'Fix existing invalid handles, node fields, or broken links before adding more logic.',
          'If one invalid node blocks the graph and cannot be repaired safely, delete or replace only that part.',
          'Do not re-plan the whole bot during repair mode.',
        ]
      : [
          'Step 1: create the entry skeleton.',
          'Step 2+: add business branches, user inputs, actions, and confirmations.',
          'Add variables only when they are actually used by the flow.',
          'Avoid speculative nodes that are not clearly required by the prompt.',
        ],
  }

  return [
    { role: 'system' as const, content: systemPrompt },
    ...buildAgentFewShotMessages(args.locale),
    { role: 'user' as const, content: JSON.stringify(userPayload, null, 2) },
  ]
}

function sanitizeAgentOperation(value: unknown): AiAgentOperation | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
  const type = normalizeText(record.type, 40)

  if (type === 'addNode') {
    const nodeType = normalizeText(record.nodeType, 40) as NodeType
    if (!AGENT_NODE_TYPES.has(nodeType)) return null
    return {
      type: 'addNode',
      nodeKey: normalizeIdentifier(record.nodeKey, 'node'),
      nodeType,
      data:
        record.data && typeof record.data === 'object' && !Array.isArray(record.data)
          ? cloneValue(record.data as Record<string, unknown>)
          : {},
    }
  }

  if (type === 'updateNode') {
    return {
      type: 'updateNode',
      nodeRef: normalizeText(record.nodeRef, 120),
      data:
        record.data && typeof record.data === 'object' && !Array.isArray(record.data)
          ? cloneValue(record.data as Record<string, unknown>)
          : {},
    }
  }

  if (type === 'deleteNode') {
    return {
      type: 'deleteNode',
      nodeRef: normalizeText(record.nodeRef, 120),
    }
  }

  if (type === 'connectNodes') {
    return {
      type: 'connectNodes',
      sourceRef: normalizeText(record.sourceRef, 120),
      targetRef: normalizeText(record.targetRef, 120),
      sourceHandle: record.sourceHandle == null ? null : normalizeText(record.sourceHandle, 120),
      label: normalizeText(record.label, 120) || undefined,
    }
  }

  if (type === 'disconnectEdge') {
    return {
      type: 'disconnectEdge',
      sourceRef: normalizeText(record.sourceRef, 120),
      targetRef: normalizeText(record.targetRef, 120),
      sourceHandle: record.sourceHandle == null ? null : normalizeText(record.sourceHandle, 120),
    }
  }

  if (type === 'moveNode') {
    return {
      type: 'moveNode',
      nodeRef: normalizeText(record.nodeRef, 120),
      x: Number(record.x || 0),
      y: Number(record.y || 0),
    }
  }

  if (type === 'upsertVariables') {
    const variables = Array.isArray(record.variables) ? record.variables : []
    return {
      type: 'upsertVariables',
      variables: variables
        .map((item) => {
          const variableRecord = item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : {}
          const name = normalizeText(variableRecord.name, 120)
          const type = normalizeText(variableRecord.type, 30) as BotVariable['type']
          if (!name || !AGENT_VARIABLE_TYPES.has(type)) {
            return null
          }

          const scope = normalizeText(variableRecord.scope, 20)
          return {
            ...(normalizeText(variableRecord.id, 120) ? { id: normalizeText(variableRecord.id, 120) } : {}),
            name,
            type,
            default_value: cloneValue(variableRecord.default_value ?? ''),
            description: normalizeText(variableRecord.description, 240) || undefined,
            scope: AGENT_VARIABLE_SCOPES.has(scope as NonNullable<BotVariable['scope']>)
              ? (scope as NonNullable<BotVariable['scope']>)
              : undefined,
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    }
  }

  if (type === 'finishRun') {
    return {
      type: 'finishRun',
      summary: normalizeText(record.summary, 1200) || undefined,
    }
  }

  return null
}

function ensureCommandEnvelope(value: unknown): AiAgentCommandEnvelope {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  return {
    plan: Array.isArray(record.plan)
      ? record.plan.map((item) => normalizeText(item, 180)).filter(Boolean).slice(0, 10)
      : undefined,
    currentAction: normalizeText(record.currentAction, 240) || 'Planning next step',
    completedTasksDelta: Array.isArray(record.completedTasksDelta)
      ? record.completedTasksDelta.map((item) => normalizeText(item, 240)).filter(Boolean).slice(0, 8)
      : [],
    analysis: normalizeText(record.analysis, 1500) || undefined,
    nextAction: normalizeText(record.nextAction, 240) || undefined,
    operations: Array.isArray(record.operations)
      ? record.operations
          .map((item) => sanitizeAgentOperation(item))
          .filter((item): item is AiAgentOperation => Boolean(item))
      : [],
    done: Boolean(record.done),
    summary: normalizeText(record.summary, 1200) || undefined,
  }
}

function createUniqueNodeId(nodeKey: string, nodes: Node[]): string {
  const baseId = normalizeIdentifier(nodeKey, 'node')
  let candidate = baseId
  let suffix = 2

  while (nodes.some((node) => node.id === candidate)) {
    candidate = `${baseId}_${suffix}`
    suffix += 1
  }

  return candidate
}

function createUniqueVariableId(name: string, variables: BotVariable[]) {
  const baseId = `var_${normalizeIdentifier(name, 'value')}`
  let candidate = baseId
  let suffix = 2

  while (variables.some((item) => item.id === candidate)) {
    candidate = `${baseId}_${suffix}`
    suffix += 1
  }

  return candidate
}

function applyDeterministicLayout(nodes: Node[], edges: Edge[]): Node[] {
  const outgoingMap = new Map<string, string[]>()
  const orderIndex = new Map<string, number>()
  const depthMap = new Map<string, number>()

  for (const [index, node] of nodes.entries()) {
    outgoingMap.set(node.id, [])
    orderIndex.set(node.id, index)
  }

  for (const edge of edges) {
    const outgoing = outgoingMap.get(edge.source)
    if (outgoing) {
      outgoing.push(edge.target)
    }
  }

  const triggerIds = nodes.filter((node) => node.type === 'trigger').map((node) => node.id)
  const queue = [...triggerIds]
  for (const triggerId of triggerIds) {
    depthMap.set(triggerId, 0)
  }

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue
    const nextDepth = (depthMap.get(currentId) || 0) + 1
    const outgoing = outgoingMap.get(currentId) || []
    for (const targetId of outgoing) {
      if (!depthMap.has(targetId) || nextDepth < (depthMap.get(targetId) || 0)) {
        depthMap.set(targetId, nextDepth)
        queue.push(targetId)
      }
    }
  }

  const maxDepth = Math.max(0, ...depthMap.values(), 0)
  const grouped = new Map<number, Node[]>()

  for (const node of nodes) {
    const depth = depthMap.get(node.id) ?? (node.type === 'comment' ? maxDepth + 1 : maxDepth + 1)
    const group = grouped.get(depth) || []
    group.push(node)
    grouped.set(depth, group)
  }

  const positioned: Node[] = []
  for (const [depth, group] of [...grouped.entries()].sort((left, right) => left[0] - right[0])) {
    const sorted = group.sort(
      (left, right) => (orderIndex.get(left.id) || 0) - (orderIndex.get(right.id) || 0)
    )
    sorted.forEach((node, rowIndex) => {
      positioned.push({
        ...node,
        position: {
          x: AGENT_LAYOUT_X_START + depth * AGENT_LAYOUT_X_GAP,
          y: AGENT_LAYOUT_Y_START + rowIndex * AGENT_LAYOUT_Y_GAP,
        },
      })
    })
  }

  return positioned
}

function resolveNodeRef(ref: string, nodes: Node[], createdNodeMap: Map<string, string>): string | null {
  const normalized = normalizeText(ref, 120)
  if (!normalized) return null

  const createdId = createdNodeMap.get(normalized)
  if (createdId) {
    return createdId
  }

  const existing = nodes.find((node) => node.id === normalized)
  return existing?.id || null
}

function applyBotOperations(bot: Bot | null | undefined, operations: AiAgentOperation[]) {
  if (!bot) return undefined

  let nextName = bot.name
  let nextDescription = bot.description || ''
  let nextStatus = bot.status
  let nextMetadata = removeAgentSecretMetadata((bot.metadata || {}) as Record<string, unknown>) as BotMetadata
  let changed = false

  for (const operation of operations) {
    if (operation.type === 'updateBotSettings') {
      if (operation.name !== undefined) {
        nextName = normalizeText(operation.name, 120) || nextName
        changed = true
      }

      if (operation.description !== undefined) {
        nextDescription = normalizeText(operation.description, 800)
        changed = true
      }

      if (operation.status && AGENT_BOT_STATUSES.has(operation.status)) {
        nextStatus = operation.status
        changed = true
      }

      if (operation.webhookUrl !== undefined) {
        nextMetadata = {
          ...nextMetadata,
          webhookUrl: normalizeAgentUrl(operation.webhookUrl),
        }
        changed = true
      }

      const profileStyle = sanitizeAgentProfileStyle(operation.profileStyle)
      if (profileStyle && Object.keys(profileStyle).length > 0) {
        const currentProfileStyle =
          nextMetadata.profileStyle && typeof nextMetadata.profileStyle === 'object' && !Array.isArray(nextMetadata.profileStyle)
            ? nextMetadata.profileStyle as Record<string, unknown>
            : {}
        nextMetadata = {
          ...nextMetadata,
          profileStyle: {
            ...currentProfileStyle,
            ...profileStyle,
          },
        }
        changed = true
      }
      continue
    }

    if (operation.type === 'updateSystemFeatures') {
      const featuresPatch = sanitizeAgentFeaturesPatch(operation.features)
      if (Object.keys(featuresPatch).length === 0) {
        continue
      }

      const currentFeatures =
        nextMetadata.features && typeof nextMetadata.features === 'object' && !Array.isArray(nextMetadata.features)
          ? nextMetadata.features as Record<string, unknown>
          : {}

      nextMetadata = {
        ...nextMetadata,
        features: {
          ...currentFeatures,
          ...featuresPatch,
        },
      }
      changed = true
    }
  }

  if (!changed) return undefined

  return {
    name: nextName,
    description: nextDescription,
    status: nextStatus,
    metadata: nextMetadata,
  } satisfies NonNullable<AgentOperationApplyResult['botPatch']>
}

function applyOperationsToConfig(currentConfig: BotConfig, operations: AiAgentOperation[]): AgentOperationApplyResult {
  let nodes = cloneValue(currentConfig.nodes || [])
  let edges = cloneValue(currentConfig.edges || [])
  const variables = cloneValue(currentConfig.variables || [])
  const createdNodeMap = new Map<string, string>()
  let summaryOverride: string | undefined
  let hasStructuralChange = false
  let hasManualMove = false

  for (const operation of operations) {
    if (operation.type === 'updateBotSettings' || operation.type === 'updateSystemFeatures') {
      continue
    }

    if (operation.type === 'addNode') {
      const nodeId = createUniqueNodeId(operation.nodeKey, nodes)
      createdNodeMap.set(operation.nodeKey, nodeId)
      const nextNode: Node = {
        id: nodeId,
        type: operation.nodeType,
        position: { x: 0, y: 0 },
        data: sanitizeNodeDataForAgent(operation.nodeType, operation.data),
      }
      nodes.push(nextNode)
      hasStructuralChange = true
      continue
    }

    if (operation.type === 'updateNode') {
      const nodeId = resolveNodeRef(operation.nodeRef, nodes, createdNodeMap)
      if (!nodeId) {
        throw new Error(`Unknown node ref for updateNode: ${operation.nodeRef}`)
      }

      nodes = nodes.map((node) => (
        node.id === nodeId
          ? {
              ...node,
              data: sanitizeNodeDataForAgent(node.type, {
                ...(node.data as Record<string, unknown>),
                ...((operation.data || {}) as Record<string, unknown>),
              }),
            }
          : node
      ))
      continue
    }

    if (operation.type === 'deleteNode') {
      const nodeId = resolveNodeRef(operation.nodeRef, nodes, createdNodeMap)
      if (!nodeId) {
        throw new Error(`Unknown node ref for deleteNode: ${operation.nodeRef}`)
      }

      nodes = nodes.filter((node) => node.id !== nodeId)
      edges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      hasStructuralChange = true
      continue
    }

    if (operation.type === 'connectNodes') {
      const sourceId = resolveNodeRef(operation.sourceRef, nodes, createdNodeMap)
      const targetId = resolveNodeRef(operation.targetRef, nodes, createdNodeMap)
      if (!sourceId || !targetId) {
        throw new Error(`Unknown node refs for connectNodes: ${operation.sourceRef} -> ${operation.targetRef}`)
      }

      if (sourceId === targetId) {
        throw new Error(`Node ${sourceId} cannot connect to itself`)
      }

      const sourceNode = nodes.find((node) => node.id === sourceId)
      const targetNode = nodes.find((node) => node.id === targetId)
      if (!sourceNode || !targetNode) {
        throw new Error('Source or target node was not found during connectNodes')
      }

      if (!canUseNodeAsOutgoingSource(sourceNode.type)) {
        throw new Error(`Node ${sourceNode.id} cannot have outgoing edges`)
      }

      if (!canUseNodeAsIncomingTarget(targetNode.type)) {
        throw new Error(`Node ${targetNode.id} cannot have incoming edges`)
      }

      const normalizedSourceHandle = operation.sourceHandle == null
        ? null
        : normalizeText(operation.sourceHandle, 120)

      if (!isValidSourceHandleForNode(sourceNode, normalizedSourceHandle)) {
        throw new Error(`Unsupported sourceHandle "${normalizedSourceHandle || 'default'}" for node ${sourceNode.id}`)
      }

      const edgeId = `edge:${sourceId}:${normalizedSourceHandle || 'default'}:${targetId}`
      if (!edges.some((edge) => edge.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: normalizedSourceHandle,
          targetHandle: null,
          label: operation.label || undefined,
        })
        hasStructuralChange = true
      }
      continue
    }

    if (operation.type === 'disconnectEdge') {
      const sourceId = resolveNodeRef(operation.sourceRef, nodes, createdNodeMap)
      const targetId = resolveNodeRef(operation.targetRef, nodes, createdNodeMap)
      if (!sourceId || !targetId) {
        throw new Error(`Unknown node refs for disconnectEdge: ${operation.sourceRef} -> ${operation.targetRef}`)
      }

      const normalizedSourceHandle = operation.sourceHandle == null
        ? null
        : normalizeText(operation.sourceHandle, 120)
      const beforeLength = edges.length
      edges = edges.filter((edge) => !(
        edge.source === sourceId &&
        edge.target === targetId &&
        (edge.sourceHandle ?? null) === normalizedSourceHandle
      ))

      if (edges.length !== beforeLength) {
        hasStructuralChange = true
      }
      continue
    }

    if (operation.type === 'moveNode') {
      const nodeId = resolveNodeRef(operation.nodeRef, nodes, createdNodeMap)
      if (!nodeId) {
        throw new Error(`Unknown node ref for moveNode: ${operation.nodeRef}`)
      }

      nodes = nodes.map((node) => (
        node.id === nodeId
          ? {
              ...node,
              position: {
                x: Number.isFinite(operation.x) ? Math.round(operation.x) : 0,
                y: Number.isFinite(operation.y) ? Math.round(operation.y) : 0,
              },
            }
          : node
      ))
      hasManualMove = true
      continue
    }

    if (operation.type === 'upsertVariables') {
      for (const inputVariable of operation.variables) {
        const variableName = normalizeText(inputVariable.name, 120)
        if (!variableName || !AGENT_VARIABLE_TYPES.has(inputVariable.type)) {
          continue
        }

        const nextVariable: BotVariable = {
          id: normalizeText(inputVariable.id, 120) || createUniqueVariableId(variableName, variables),
          name: variableName,
          type: inputVariable.type,
          default_value: cloneValue(inputVariable.default_value),
          description: normalizeText(inputVariable.description, 240) || undefined,
          scope: inputVariable.scope && AGENT_VARIABLE_SCOPES.has(inputVariable.scope)
            ? inputVariable.scope
            : undefined,
        }

        const existingIndex = variables.findIndex((item) => (
          item.id === nextVariable.id ||
          item.name.toLowerCase() === nextVariable.name.toLowerCase()
        ))

        if (existingIndex >= 0) {
          variables[existingIndex] = {
            ...variables[existingIndex],
            ...nextVariable,
          }
        } else {
          variables.push(nextVariable)
        }
      }
      continue
    }

    if (operation.type === 'finishRun') {
      summaryOverride = normalizeText(operation.summary, 1200) || summaryOverride
    }
  }

  const repaired = repairDisconnectedExecutableNodes(nodes, edges)
  if (repaired.repaired) {
    nodes = repaired.nodes
    edges = repaired.edges
    hasStructuralChange = true
  }

  if (hasStructuralChange && !hasManualMove) {
    nodes = applyDeterministicLayout(nodes, edges)
  }

  return {
    config: {
      nodes,
      edges,
      variables,
      version: currentConfig.version || '1.0.0',
    },
    summaryOverride,
  }
}

function repairDisconnectedExecutableNodes(nodes: Node[], edges: Edge[]) {
  const triggerNodes = nodes.filter((node) => node.type === 'trigger')
  if (triggerNodes.length === 0) {
    return { nodes, edges, repaired: false }
  }

  const nextEdges = [...edges]
  const connectedNodeIds = new Set<string>([
    ...triggerNodes.map((node) => node.id),
    ...nextEdges.map((edge) => edge.target),
  ])
  let repaired = false

  const findRepairSource = (targetId: string) => {
    const outgoingCounts = new Map<string, number>()
    for (const edge of nextEdges) {
      outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) || 0) + 1)
    }

    const candidates = nodes.filter((node) => (
      node.id !== targetId &&
      connectedNodeIds.has(node.id) &&
      canUseNodeAsOutgoingSource(node.type) &&
      isValidSourceHandleForNode(node, null)
    ))

    return (
      candidates.find((node) => !outgoingCounts.has(node.id)) ||
      candidates[candidates.length - 1] ||
      null
    )
  }

  for (const node of nodes) {
    if (node.type === 'trigger' || node.type === 'comment' || connectedNodeIds.has(node.id)) {
      continue
    }

    if (!canUseNodeAsIncomingTarget(node.type)) {
      continue
    }

    const sourceNode = findRepairSource(node.id)
    if (!sourceNode) {
      continue
    }

    const edgeId = `edge:${sourceNode.id}:default:${node.id}`
    if (!nextEdges.some((edge) => edge.id === edgeId || (edge.source === sourceNode.id && edge.target === node.id && !edge.sourceHandle))) {
      nextEdges.push({
        id: edgeId,
        source: sourceNode.id,
        target: node.id,
        sourceHandle: null,
        targetHandle: null,
      })
      repaired = true
    }

    connectedNodeIds.add(node.id)
  }

  return {
    nodes,
    edges: nextEdges,
    repaired,
  }
}

async function saveConfigSnapshot(botId: string, config: BotConfig) {
  const botService = getAdminBotService()
  const bot = await botService.getBot(botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  await botService.saveBotConfig(botId, config)

  if (bot.metadata?.testActive && bot.metadata?.testMode === 'polling') {
    updateTelegramPollingConfig(botId, config)
    clearRuntimeSessionsForBot(botId)
  }
}

function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  return record.name === 'AbortError' || record.code === 20
}

function isOpenRouterJsonError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /OpenRouter did not return valid JSON|valid JSON/i.test(message)
}

function buildJsonRepairPrompt(locale: 'ru' | 'en', validationErrors: string[]) {
  return JSON.stringify({
    systemCorrection: locale === 'en'
      ? 'Your previous response was not parseable JSON. Return exactly one valid JSON object matching the command envelope. No markdown, comments, code fences, or prose outside JSON.'
      : 'Предыдущий ответ был невалидным JSON. Верни ровно один валидный JSON-объект формата command envelope. Без markdown, комментариев, code fence и текста вне JSON.',
    requiredShape: {
      plan: ['string'],
      currentAction: 'string',
      completedTasksDelta: ['string'],
      analysis: 'string',
      nextAction: 'string',
      operations: ['operation objects'],
      done: false,
      summary: 'string when done',
    },
    important: locale === 'en'
      ? 'If done is false, operations must contain concrete build operations unless the graph is already complete.'
      : 'Если done=false, operations должен содержать конкретные операции сборки, кроме случая когда граф уже полностью готов.',
    validationErrors,
  })
}

function buildJsonRecoveryEnvelope(context: AgentExecutionContext, validationErrors: string[]): AiAgentCommandEnvelope {
  return ensureCommandEnvelope({
    plan: context.snapshot.plan?.length
      ? context.snapshot.plan
      : [
          context.locale === 'en' ? 'Recover structured agent response' : 'Восстановить структурированный ответ агента',
          context.locale === 'en' ? 'Execute the next concrete graph change' : 'Выполнить следующее конкретное изменение графа',
        ],
    currentAction: context.locale === 'en' ? 'Recovering structured response' : 'Восстанавливаю структурированный ответ',
    completedTasksDelta: [],
    analysis: context.locale === 'en'
      ? 'The model returned invalid JSON twice. I keep the run alive and request the next step in a stricter structured mode.'
      : 'Модель дважды вернула невалидный JSON. Я сохраняю работу активной и запрашиваю следующий шаг в более строгом структурированном режиме.',
    nextAction: context.locale === 'en' ? 'Retry with concrete operations' : 'Повторить с конкретными операциями',
    operations: [],
    done: false,
    validationErrors,
  })
}

async function requestAgentStep(context: AgentExecutionContext, config: BotConfig, bot: Bot | null, validationErrors: string[]) {
  const messages = buildAgentMessages({
    prompt: context.prompt,
    locale: context.locale,
    attachments: context.attachments,
    chatContext: context.chatContext,
    snapshot: context.snapshot,
    config,
    bot,
    stepIndex: context.snapshot.stepCount || 0,
    validationErrors,
  })
  const signal = agentRegistry.get(context.botId)?.controller.signal

  try {
    const response = await requestOpenRouterJsonStream<AiAgentCommandEnvelope>({
      model: AGENT_MODEL_ID,
      messages,
      schema: AGENT_COMMAND_ENVELOPE_SCHEMA,
      temperature: 0.15,
      maxTokens: 4500,
      signal,
      onDelta: ({ accumulated }) => {
        publishAgentRunPreview(
          context.botId,
          buildLivePreviewFromBuffer(context.runId, accumulated)
        )
      },
    })

    return ensureCommandEnvelope(response.parsed)
  } catch (error) {
    if (isAbortLikeError(error) || !isOpenRouterJsonError(error)) {
      throw error
    }

    appendAgentLog(
      context.botId,
      context.runId,
      'OpenRouter returned invalid JSON; retrying with strict non-stream JSON',
      'warn'
    )
  }

  try {
    const response = await requestOpenRouterJson<AiAgentCommandEnvelope>({
      model: AGENT_MODEL_ID,
      messages: [
        ...messages,
        { role: 'user' as const, content: buildJsonRepairPrompt(context.locale, validationErrors) },
      ],
      schema: AGENT_COMMAND_ENVELOPE_SCHEMA,
      temperature: 0,
      maxTokens: 4500,
      signal,
    })

    return ensureCommandEnvelope(response.parsed)
  } catch (error) {
    if (isAbortLikeError(error) || !isOpenRouterJsonError(error)) {
      throw error
    }

    appendAgentLog(
      context.botId,
      context.runId,
      'OpenRouter returned invalid JSON again; keeping run alive for another structured step',
      'warn'
    )

    return buildJsonRecoveryEnvelope(context, validationErrors)
  }
}

async function requestRouteDecision(context: AgentExecutionContext, config: BotConfig) {
  try {
    const response = await requestOpenRouterJson<AgentRouteDecision>({
      model: AGENT_MODEL_ID,
      messages: buildRouteDecisionMessages({
        prompt: context.prompt,
        locale: context.locale,
        chatContext: context.chatContext,
        config,
        bot: (await getAdminBotService().getBot(context.botId)) || null,
      }),
      schema: AGENT_ROUTE_DECISION_SCHEMA,
      temperature: 0,
      maxTokens: 500,
      signal: agentRegistry.get(context.botId)?.controller.signal,
    })

    const mode = response.parsed?.mode === 'respond' ? 'respond' : 'build'
    return {
      mode,
      reason: normalizeText(response.parsed?.reason, 400) || undefined,
    } satisfies AgentRouteDecision
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendAgentLog(context.botId, context.runId, `Route decision fallback to build: ${message}`, 'warn')

    return {
      mode: 'build',
      reason: context.locale === 'en'
        ? 'The request will be handled as a bot workflow change because the initial route check could not return structured JSON.'
        : 'Запрос будет обработан как изменение сценария бота, потому что первичная проверка режима не вернула корректный JSON.',
    } satisfies AgentRouteDecision
  }
}

async function requestRespondStep(context: AgentExecutionContext, config: BotConfig, bot: Bot | null) {
  const response = await requestOpenRouterJsonStream<AgentResponseEnvelope>({
    model: AGENT_MODEL_ID,
    messages: buildRespondMessages({
      prompt: context.prompt,
      locale: context.locale,
      config,
      bot,
      chatContext: context.chatContext,
      snapshot: context.snapshot,
    }),
    schema: AGENT_RESPONSE_ENVELOPE_SCHEMA,
    temperature: 0.2,
    maxTokens: 2200,
    signal: agentRegistry.get(context.botId)?.controller.signal,
    onDelta: ({ accumulated }) => {
      publishAgentRunPreview(
        context.botId,
        buildResponsePreviewFromBuffer(context.runId, accumulated)
      )
    },
  })

  return {
    answer: normalizeText(response.parsed?.answer, 8000),
  } satisfies AgentResponseEnvelope
}

async function markRunFailed(botId: string, snapshot: AiAgentRunSnapshot, error: unknown) {
  const failedSnapshot: AiAgentRunSnapshot = {
    ...snapshot,
    status: 'failed',
    locked: false,
    error: error instanceof Error ? error.message : String(error),
    updatedAt: new Date().toISOString(),
    nextAction: undefined,
  }

  await persistRunSnapshot(botId, failedSnapshot)
  await appendAssistantRunMessage(botId, failedSnapshot)
  clearAgentRunPreview(botId, snapshot.runId)
  appendAgentLog(botId, snapshot.runId, `Run failed: ${failedSnapshot.error}`, 'error')
  setBotTestLogRunContext(botId, null)
}

async function markRunCancelled(botId: string, snapshot: AiAgentRunSnapshot) {
  const cancelledSnapshot: AiAgentRunSnapshot = {
    ...snapshot,
    status: 'cancelled',
    locked: false,
    updatedAt: new Date().toISOString(),
    currentAction: snapshot.currentAction || 'Cancelled',
    nextAction: undefined,
    analysis: snapshot.analysis || undefined,
    error: undefined,
  }

  await persistRunSnapshot(botId, cancelledSnapshot)
  await appendAssistantRunMessage(botId, cancelledSnapshot)
  clearAgentRunPreview(botId, snapshot.runId)
  appendAgentLog(botId, snapshot.runId, 'Run cancelled by user', 'warn')
  setBotTestLogRunContext(botId, null)
}

async function markRunCompleted(botId: string, snapshot: AiAgentRunSnapshot, summary?: string, locale: 'ru' | 'en' = 'ru') {
  const completedSnapshot: AiAgentRunSnapshot = {
    ...snapshot,
    status: 'completed',
    locked: false,
    summary: normalizeText(summary, 1200) || snapshot.summary,
    updatedAt: new Date().toISOString(),
    nextAction: undefined,
    error: undefined,
  }

  await persistRunSnapshot(botId, completedSnapshot)
  await appendAssistantRunMessage(botId, completedSnapshot, {
    appendFinalSummary: true,
    locale,
  })
  clearAgentRunPreview(botId, snapshot.runId)
  appendAgentLog(botId, snapshot.runId, 'Run completed successfully', 'info')
  setBotTestLogRunContext(botId, null)
}

async function executeBuildRun(context: AgentExecutionContext) {
  const botService = getAdminBotService()
  let bot = await botService.getBot(context.botId)
  let config = bot?.config || {
    nodes: [],
    edges: [],
    variables: [],
    version: '1.0.0',
  }
  let latestSnapshot = context.snapshot
  let validationErrors: string[] = []
  let emptyOperationSteps = 0
  let touchedCanvas = false
  let touchedBotSettings = false
  const includeCallbackAudit = shouldAuditCallbackWiring(context.prompt)

  for (let stepIndex = 0; stepIndex < AGENT_MAX_STEPS; stepIndex += 1) {
    const registryEntry = agentRegistry.get(context.botId)
    if (!registryEntry || registryEntry.runId !== context.runId) {
      return
    }

    if (registryEntry.cancelled) {
      await markRunCancelled(context.botId, latestSnapshot)
      return
    }

    const stepValidationErrors = buildAgentValidationErrors(config, validationErrors, includeCallbackAudit || touchedCanvas)
    const envelope = await requestAgentStep(
      {
        ...context,
        snapshot: latestSnapshot,
      },
      config,
      bot,
      stepValidationErrors
    )

    const timestamp = new Date().toISOString()
    const nextCompletedTasks = makeTaskItems(
      latestSnapshot.completedTasks,
      envelope.completedTasksDelta,
      timestamp
    )

    latestSnapshot = {
      ...latestSnapshot,
      status: stepIndex === 0 ? 'running' : latestSnapshot.status,
      currentAction: envelope.currentAction || latestSnapshot.currentAction,
      nextAction: envelope.nextAction || latestSnapshot.nextAction,
      analysis: envelope.analysis || latestSnapshot.analysis,
      plan: envelope.plan?.length ? envelope.plan : latestSnapshot.plan,
      completedTasks: nextCompletedTasks,
      updatedAt: timestamp,
      stepCount: stepIndex + 1,
    }

    await persistRunSnapshot(context.botId, latestSnapshot)
    appendAgentLog(context.botId, context.runId, `Step ${stepIndex + 1}: ${latestSnapshot.currentAction}`, 'info')

    if (!envelope.done && envelope.operations.length === 0) {
      emptyOperationSteps += 1
      validationErrors = [
        context.locale === 'en'
          ? 'The previous response only planned and returned no operations. Continue now with concrete operations. Do not return an empty operations array unless done=true and the graph is complete.'
          : 'Предыдущий ответ только составил план и вернул пустой operations. Теперь выполни конкретные операции. Не возвращай пустой operations, если done=true не выставлен и граф не завершен.',
      ]
      latestSnapshot = {
        ...latestSnapshot,
        status: 'running',
        nextAction: context.locale === 'en' ? 'Execute the first plan step' : 'Выполняю первый шаг плана',
        updatedAt: new Date().toISOString(),
      }
      await persistRunSnapshot(context.botId, latestSnapshot)
      appendAgentLog(
        context.botId,
        context.runId,
        `Planning-only step ${emptyOperationSteps}; requesting concrete operations`,
        'warn'
      )
      continue
    }

    emptyOperationSteps = 0

    if (registryEntry.cancelled) {
      await markRunCancelled(context.botId, latestSnapshot)
      return
    }

    if (envelope.operations.length > 0) {
      const hasCanvasOperations = envelope.operations.some((operation) => (
        operation.type !== 'updateBotSettings' &&
        operation.type !== 'updateSystemFeatures' &&
        operation.type !== 'finishRun'
      ))
      const botPatch = applyBotOperations(bot, envelope.operations)
      const result = applyOperationsToConfig(config, envelope.operations)
      const validation = hasCanvasOperations
        ? validateBotConfig(result.config)
        : { valid: true, errors: [] }
      if (!validation.valid) {
        validationErrors = validation.errors
        latestSnapshot = {
          ...latestSnapshot,
          status: 'running',
          nextAction: context.locale === 'en' ? 'Repair generated graph issues' : 'Исправляю ошибки графа',
          updatedAt: new Date().toISOString(),
        }
        await persistRunSnapshot(context.botId, latestSnapshot)
        appendAgentLog(
          context.botId,
          context.runId,
          `Validation needs repair: ${validation.errors[0] || 'Generated graph is invalid'}`,
          'warn'
        )
        continue
      }

      if (botPatch) {
        await botService.updateBot(context.botId, botPatch)
        bot = await botService.getBot(context.botId)
        touchedBotSettings = true
      }

      config = result.config
      touchedCanvas = touchedCanvas || hasCanvasOperations
      validationErrors = (includeCallbackAudit || touchedCanvas) && hasCanvasOperations
        ? buildCallbackValidationErrors(config)
        : []

      latestSnapshot = {
        ...latestSnapshot,
        status: envelope.done && validationErrors.length === 0 ? 'verifying' : 'running',
        summary: result.summaryOverride || envelope.summary || latestSnapshot.summary,
        nextAction: validationErrors.length > 0
          ? (context.locale === 'en' ? 'Connect callback menu wiring' : 'Подключаю callback-меню')
          : latestSnapshot.nextAction,
        updatedAt: new Date().toISOString(),
      }

      if (hasCanvasOperations) {
        await saveConfigSnapshot(context.botId, config)
      }
      await persistRunSnapshot(context.botId, latestSnapshot)
      appendAgentLog(
        context.botId,
        context.runId,
        hasCanvasOperations
          ? `Canvas saved: ${config.nodes.length} nodes, ${config.edges.length} edges, ${config.variables.length} variables`
          : 'Bot settings saved',
        'debug'
      )

      if (validationErrors.length > 0) {
        appendAgentLog(context.botId, context.runId, `Callback audit needs repair: ${validationErrors[0]}`, 'warn')
        continue
      }
    }

    if (envelope.done) {
      const finalValidation = touchedCanvas
        ? validateBotConfig(config)
        : { valid: true, errors: [] }
      if (!finalValidation.valid) {
        throw new Error(finalValidation.errors[0] || 'Final graph is invalid')
      }
      const finalCallbackErrors = (includeCallbackAudit || touchedCanvas) && touchedCanvas
        ? buildCallbackValidationErrors(config)
        : []
      if (finalCallbackErrors.length > 0) {
        validationErrors = finalCallbackErrors
        appendAgentLog(context.botId, context.runId, `Final callback audit needs repair: ${finalCallbackErrors[0]}`, 'warn')
        continue
      }

      await markRunCompleted(
        context.botId,
        {
          ...latestSnapshot,
          currentAction: context.locale === 'en' ? 'Final validation completed' : 'Финальная проверка завершена',
          analysis: envelope.analysis || latestSnapshot.analysis,
          noChangesRequired: !touchedCanvas && !touchedBotSettings,
        },
        envelope.summary || latestSnapshot.summary,
        context.locale
      )
      return
    }
  }

  throw new Error('AI agent reached the step limit before completion')
}

async function executeRespondRun(context: AgentExecutionContext) {
  const bot = await getAdminBotService().getBot(context.botId)
  const config = bot?.config || {
    nodes: [],
    edges: [],
    variables: [],
    version: '1.0.0',
  }

  const runningSnapshot: AiAgentRunSnapshot = {
    ...context.snapshot,
    mode: 'respond',
    status: 'running',
    currentAction: context.locale === 'en' ? 'Analyzing the request and gathering context' : 'Анализирую запрос и собираю контекст',
    analysis: context.locale === 'en'
      ? 'Path: analyze the request, find relevant information in the current bot context, then answer without changing canvas.'
      : 'Путь ответа: анализирую запрос, нахожу релевантную информацию в текущем контексте бота и отвечаю без изменений холста.',
    nextAction: undefined,
    updatedAt: new Date().toISOString(),
    stepCount: 1,
    error: undefined,
  }

  await persistRunSnapshot(context.botId, runningSnapshot)
  appendAgentLog(context.botId, context.runId, 'Mode selected: respond', 'info')

  const response = await requestRespondStep(
    {
      ...context,
      snapshot: runningSnapshot,
    },
    config,
    bot
  )

  const completedSnapshot: AiAgentRunSnapshot = {
    ...runningSnapshot,
    status: 'completed',
    locked: false,
    responseText: response.answer,
    updatedAt: new Date().toISOString(),
    currentAction: context.locale === 'en' ? 'Answer prepared' : 'Ответ подготовлен',
    analysis: undefined,
    nextAction: undefined,
    error: undefined,
  }

  await persistRunSnapshot(context.botId, completedSnapshot)
  await appendAssistantRunMessage(context.botId, completedSnapshot)
  clearAgentRunPreview(context.botId, context.runId)
  appendAgentLog(context.botId, context.runId, 'Respond mode completed', 'info')
  setBotTestLogRunContext(context.botId, null)
}

async function executeRun(context: AgentExecutionContext) {
  const initialConfig = (await getAdminBotService().getBot(context.botId))?.config || {
    nodes: [],
    edges: [],
    variables: [],
    version: '1.0.0',
  }

  const chatContext = await ensureChatContext(context.botId, context.chatId, context.locale)
  const contextWithChat: AgentExecutionContext = {
    ...context,
    chatContext: chatContext || undefined,
  }

  const routeDecision = await requestRouteDecision(contextWithChat, initialConfig)
  const routedSnapshot: AiAgentRunSnapshot = {
    ...contextWithChat.snapshot,
    mode: routeDecision.mode,
    currentAction:
      routeDecision.mode === 'build'
        ? (contextWithChat.locale === 'en' ? 'Composing the plan' : 'Составляю план')
        : (contextWithChat.locale === 'en' ? 'Analyzing the request and gathering context' : 'Анализирую запрос и собираю контекст'),
    analysis:
      routeDecision.reason ||
      (routeDecision.mode === 'build'
        ? (contextWithChat.locale === 'en'
          ? 'The request requires bot workflow development on canvas.'
          : 'Запрос требует разработки сценария бота на холсте.')
        : (contextWithChat.locale === 'en'
          ? 'The request requires only an informational answer without canvas changes.'
          : 'Запрос требует только обычного ответа без изменений на холсте.')),
    nextAction:
      routeDecision.mode === 'build'
        ? (contextWithChat.locale === 'en' ? 'Start the first task' : 'Начать первую задачу')
        : undefined,
    updatedAt: new Date().toISOString(),
  }

  await persistRunSnapshot(contextWithChat.botId, routedSnapshot)
  appendAgentLog(contextWithChat.botId, contextWithChat.runId, `Mode selected: ${routeDecision.mode}`, 'info')

  const nextContext: AgentExecutionContext = {
    ...contextWithChat,
    snapshot: routedSnapshot,
  }

  if (routeDecision.mode === 'respond') {
    await executeRespondRun(nextContext)
    return
  }

  await executeBuildRun(nextContext)
}

export async function startBotAgentRun(input: StartAgentRunInput) {
  const botService = getAdminBotService()
  const bot = await botService.getBot(input.botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  const locale = toLocale(input.locale)
  const effectivePrompt = buildEffectivePrompt(
    input.prompt,
    cloneValue(input.attachments || []),
    locale
  )

  if (!effectivePrompt) {
    throw new Error(locale === 'en' ? 'Prompt or attachments are required' : 'Нужен текст запроса или вложение')
  }

  const existingRun = getCurrentRun(bot)
  if (existingRun && isActiveStatus(existingRun.status)) {
    const registryEntry = agentRegistry.get(input.botId)
    if (registryEntry?.runId === existingRun.runId) {
      throw new Error('AI agent is already running for this bot')
    }

    if (input.runId && existingRun.runId === input.runId) {
      // Continue a background clarification run after the user answered.
    } else {

      await persistRunSnapshot(input.botId, {
        ...existingRun,
        status: 'cancelled',
        locked: false,
        updatedAt: new Date().toISOString(),
        currentAction: input.locale === 'en'
          ? 'The previous run was interrupted'
          : 'Предыдущий запуск был прерван',
        analysis: input.locale === 'en'
          ? 'The previous run was stopped after a server restart or process reload. Saved canvas changes were preserved.'
          : 'Предыдущий запуск остановился после перезапуска сервера или перезагрузки процесса. Сохранённые изменения холста не потерялись.',
        nextAction: undefined,
        error: undefined,
      })
    }
  }

  const runId = normalizeText(input.runId, 160) || randomUUID()
  const rawSnapshot = buildBaseSnapshot(input, runId)
  const aiChatState = getAiChatState(bot.metadata)
  let activeChat =
    (normalizeText(input.chatId, 160) && aiChatState.chats.find((chat) => chat.id === normalizeText(input.chatId, 160))) ||
    getActiveChatThread(aiChatState)

  if (!activeChat) {
    activeChat = createAiChatThread(locale, pickChatTitleFromPrompt(input.prompt, locale), runId)
  }

  const shouldRetitleActiveChat =
    activeChat.messages.length === 0 &&
    normalizeText(activeChat.title, 80).toLowerCase().startsWith(locale === 'en' ? 'new chat' : 'новый чат') &&
    Boolean(normalizeText(input.prompt, 80))

  const preparedChat: AiChatThread = shouldRetitleActiveChat
    ? {
        ...activeChat,
        title: pickChatTitleFromPrompt(input.prompt, locale),
      }
    : activeChat

  const nextChat = input.suppressUserMessage
    ? {
        ...preparedChat,
        updatedAt: new Date().toISOString(),
      }
    : appendMessageToThread(preparedChat, {
        runId,
        role: 'user',
        content: normalizeText(input.prompt, 12000),
        model: AGENT_MODEL_ID,
        attachments: cloneValue(input.attachments || []),
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
    ...rawSnapshot,
    chatId: nextChat.id,
  }

  const entry: AgentRegistryEntry = {
    botId: input.botId,
    runId,
    cancelled: false,
    controller: new AbortController(),
    promise: Promise.resolve(),
  }
  agentRegistry.set(input.botId, entry)

  try {
    await botService.updateBot(input.botId, {
      metadata: mergeAgentAndChatMetadata(bot, snapshot, nextAiChatState),
    })
    publishAgentRunSnapshot(input.botId, snapshot)
  } catch (error) {
    agentRegistry.delete(input.botId)
    throw error
  }

  setBotTestLogRunContext(input.botId, runId)
  appendAgentLog(input.botId, runId, 'Run started', 'info')

  const context: AgentExecutionContext = {
    botId: input.botId,
    runId,
    chatId: nextChat.id,
    prompt: effectivePrompt,
    locale,
    attachments: cloneValue(input.attachments || []),
    snapshot,
  }

  entry.promise = executeRun(context)
    .catch(async (error) => {
      const latestBot = await getAdminBotService().getBot(input.botId)
      const latestSnapshot = getCurrentRun(latestBot) || snapshot
      const latestEntry = agentRegistry.get(input.botId)
      if (latestEntry?.cancelled || latestSnapshot.status === 'cancelled') {
        if (latestSnapshot.status !== 'cancelled') {
          await markRunCancelled(input.botId, latestSnapshot)
        }
        return
      }
      await markRunFailed(input.botId, latestSnapshot, error)
    })
    .finally(() => {
      const currentEntry = agentRegistry.get(input.botId)
      if (currentEntry?.runId === runId) {
        agentRegistry.delete(input.botId)
      }
    })

  return snapshot
}

export async function cancelBotAgentRun(botId: string, runId?: string | null) {
  const registryEntry = agentRegistry.get(botId)
  const bot = await getAdminBotService().getBot(botId)
  const snapshot = getCurrentRun(bot)

  if (!snapshot) {
    return null
  }

  if (runId && snapshot.runId !== runId) {
    throw new Error('AI run ID mismatch')
  }

  if (registryEntry && registryEntry.runId === snapshot.runId) {
    registryEntry.cancelled = true
    registryEntry.controller.abort()
  }

  const cancelledSnapshot: AiAgentRunSnapshot = {
    ...snapshot,
    status: 'cancelled',
    locked: false,
    updatedAt: new Date().toISOString(),
    nextAction: undefined,
    error: undefined,
  }
  await markRunCancelled(botId, cancelledSnapshot)

  if (registryEntry?.runId === snapshot.runId) {
    agentRegistry.delete(botId)
  }

  return cancelledSnapshot
}

export async function getBotAgentRunStatus(botId: string) {
  const botService = getAdminBotService()
  const bot = await botService.getBot(botId)
  if (!bot) {
    throw new Error('Bot not found')
  }

  const snapshot = getCurrentRun(bot)
  if (!snapshot) {
    return {
      snapshot: null,
      config: bot.config,
    }
  }

  if (snapshot.status === 'failed' && isLegacyInterruptedRunError(snapshot.error)) {
    const cancelledSnapshot: AiAgentRunSnapshot = {
      ...snapshot,
      status: 'cancelled',
      locked: false,
      updatedAt: new Date().toISOString(),
      currentAction: snapshot.currentAction || 'Run interrupted',
      analysis: snapshot.analysis || 'The server was restarted or the process was reloaded. All already saved canvas changes were preserved.',
      nextAction: undefined,
      error: undefined,
    }
    await persistRunSnapshot(botId, cancelledSnapshot)
    await appendAssistantRunMessage(botId, cancelledSnapshot)
    clearAgentRunPreview(botId, snapshot.runId)
    return {
      snapshot: cancelledSnapshot,
      config: bot.config,
    }
  }

  if (isActiveStatus(snapshot.status)) {
    const registryEntry = agentRegistry.get(botId)
    if (!registryEntry || registryEntry.runId !== snapshot.runId) {
      const pendingClarification = bot.metadata?.aiAgent?.pendingClarification
      if (
        pendingClarification &&
        typeof pendingClarification === 'object' &&
        pendingClarification.runId === snapshot.runId
      ) {
        if (Date.parse(pendingClarification.expiresAt) > Date.now()) {
          return {
            snapshot,
            config: bot.config,
          }
        }

        const pendingLocale = pendingClarification.locale === 'en' ? 'en' : 'ru'
        const cancelledSnapshot: AiAgentRunSnapshot = {
          ...snapshot,
          status: 'cancelled',
          locked: false,
          updatedAt: new Date().toISOString(),
          currentAction: pendingLocale === 'en'
            ? 'Clarification timed out'
            : 'Ожидание ответа истекло',
          analysis: pendingLocale === 'en'
            ? 'The AI agent stopped because there was no clarification answer for 12 hours.'
            : 'ИИ остановлен: ответа на уточнение не было 12 часов.',
          nextAction: undefined,
          error: undefined,
        }
        await persistRunSnapshot(botId, cancelledSnapshot)
        await appendAssistantRunMessage(botId, cancelledSnapshot)
        clearAgentRunPreview(botId, snapshot.runId)
        return {
          snapshot: cancelledSnapshot,
          config: bot.config,
        }
      }

      const activeStartedAt = Date.parse(snapshot.startedAt || snapshot.updatedAt || '')
      const activeAgeMs = Number.isFinite(activeStartedAt) ? Date.now() - activeStartedAt : ORPHAN_ACTIVE_RUN_TIMEOUT_MS + 1
      if (activeAgeMs <= ORPHAN_ACTIVE_RUN_TIMEOUT_MS) {
        return {
          snapshot,
          config: bot.config,
        }
      }

      const cancelledSnapshot: AiAgentRunSnapshot = {
        ...snapshot,
        status: 'cancelled',
        locked: false,
        updatedAt: new Date().toISOString(),
        currentAction: snapshot.currentAction || 'Run interrupted',
        analysis: snapshot.analysis || 'The server was restarted or the process was reloaded. All already saved canvas changes were preserved.',
        nextAction: undefined,
        error: undefined,
      }
      await persistRunSnapshot(botId, cancelledSnapshot)
      await appendAssistantRunMessage(botId, cancelledSnapshot)
      clearAgentRunPreview(botId, snapshot.runId)
      return {
        snapshot: cancelledSnapshot,
        config: bot.config,
      }
    }
  }

  return {
    snapshot,
    config: bot.config,
  }
}
