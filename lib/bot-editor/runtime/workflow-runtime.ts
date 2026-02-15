import type { BotConfig, Edge as BotEdge, Node as BotNode } from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
}

interface TelegramChat {
  id: number
}

interface TelegramMessage {
  message_id: number
  chat: TelegramChat
  from?: TelegramUser
  text?: string
}

interface TelegramCallbackQuery {
  id: string
  data?: string
  from: TelegramUser
  message?: TelegramMessage
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

interface RuntimeSession {
  variables: Record<string, unknown>
  waitingForNodeId?: string
  updatedAt: number
}

interface RuntimeContext {
  botId: string
  botToken: string
  config: BotConfig
  update: TelegramUpdate
}

interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

interface ForceReplyMarkup {
  force_reply: true
  input_field_placeholder?: string
}

const runtimeSessions = new Map<string, RuntimeSession>()

const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const MAX_WORKFLOW_STEPS = 64
type WorkflowRunState = 'waiting' | 'completed'

function createSessionKey(botId: string, chatId: number, userId: number): string {
  return `${botId}:${chatId}:${userId}`
}

export function clearRuntimeSessionsForBot(botId: string) {
  const prefix = `${botId}:`
  for (const key of runtimeSessions.keys()) {
    if (key.startsWith(prefix)) {
      runtimeSessions.delete(key)
    }
  }
}

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [key, session] of runtimeSessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      runtimeSessions.delete(key)
    }
  }
}

function resetSessionState(session: RuntimeSession) {
  session.variables = {}
  session.waitingForNodeId = undefined
  session.updatedAt = Date.now()
}

function getOrCreateSession(key: string): RuntimeSession {
  const existing = runtimeSessions.get(key)
  if (existing) {
    existing.updatedAt = Date.now()
    return existing
  }

  const session: RuntimeSession = {
    variables: {},
    updatedAt: Date.now(),
  }
  runtimeSessions.set(key, session)
  return session
}

function getOutgoingEdges(config: BotConfig, nodeId: string): BotEdge[] {
  return config.edges.filter((edge) => edge.source === nodeId)
}

function getDefaultNextNodeId(config: BotConfig, nodeId: string): string | null {
  const outgoingEdges = getOutgoingEdges(config, nodeId)
  if (outgoingEdges.length === 0) return null

  const defaultEdge = outgoingEdges.find((edge) => !edge.sourceHandle)
  return (defaultEdge || outgoingEdges[0])?.target || null
}

function getConditionNextNodeId(
  config: BotConfig,
  nodeId: string,
  conditionResult: boolean
): string | null {
  const outgoingEdges = getOutgoingEdges(config, nodeId)
  const explicitEdge = outgoingEdges.find(
    (edge) => edge.sourceHandle === (conditionResult ? 'true' : 'false')
  )

  if (explicitEdge) return explicitEdge.target

  const defaultEdge = outgoingEdges.find((edge) => !edge.sourceHandle)
  return defaultEdge?.target || null
}

function buildNodeMap(config: BotConfig): Map<string, BotNode> {
  return new Map(config.nodes.map((node) => [node.id, node]))
}

function getFirstExecutableNode(config: BotConfig): BotNode | null {
  const candidates = config.nodes.filter((node) => node.type !== 'trigger' && node.type !== 'comment')
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    const yDiff = (a.position?.y || 0) - (b.position?.y || 0)
    if (yDiff !== 0) return yDiff
    return (a.position?.x || 0) - (b.position?.x || 0)
  })[0]
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function resolvePath(source: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.').map((segment) => segment.trim()).filter(Boolean)
  let current: unknown = source

  for (const key of keys) {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

function interpolateTemplate(template: string, variables: Record<string, unknown>): string {
  if (!template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (match, rawPath) => {
    const value = resolvePath(variables, String(rawPath).trim())
    return value === undefined || value === null ? match : String(value)
  })
}

function buildInlineKeyboardMarkup(keyboard: unknown): InlineKeyboardMarkup | undefined {
  if (!keyboard || typeof keyboard !== 'object') {
    return undefined
  }

  const rows = (keyboard as Record<string, unknown>).rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return undefined
  }

  const inlineKeyboard: InlineKeyboardButton[][] = []

  for (const row of rows) {
    const buttons = (row as Record<string, unknown>)?.buttons
    if (!Array.isArray(buttons) || buttons.length === 0) {
      continue
    }

    const normalizedRow: InlineKeyboardButton[] = []

    for (const button of buttons) {
      const buttonRecord = (button || {}) as Record<string, unknown>
      const text = normalizeText(buttonRecord.text)
      if (!text) continue

      const callbackData = normalizeText(buttonRecord.callbackData)
      const url = normalizeText(buttonRecord.url)

      normalizedRow.push({
        text,
        ...(callbackData ? { callback_data: callbackData } : {}),
        ...(url ? { url } : {}),
      })
    }

    if (normalizedRow.length > 0) {
      inlineKeyboard.push(normalizedRow)
    }
  }

  if (inlineKeyboard.length === 0) {
    return undefined
  }

  return {
    inline_keyboard: inlineKeyboard,
  }
}

function normalizeParseMode(value: unknown): 'Markdown' | 'MarkdownV2' | 'HTML' | undefined {
  if (value === 'Markdown' || value === 'MarkdownV2' || value === 'HTML') {
    return value
  }
  return undefined
}

function evaluateConditionValue(operator: string, left: unknown, right: unknown): boolean {
  switch (operator) {
    case 'equals':
      return String(left ?? '') === String(right ?? '')
    case 'notEquals':
      return String(left ?? '') !== String(right ?? '')
    case 'contains':
      return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase())
    case 'notContains':
      return !String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase())
    case 'gt':
      return Number(left) > Number(right)
    case 'lt':
      return Number(left) < Number(right)
    default:
      return String(left ?? '') === String(right ?? '')
  }
}

function findMatchingTrigger(config: BotConfig, update: TelegramUpdate): BotNode | null {
  const triggers = config.nodes.filter((node) => node.type === 'trigger')
  const messageText = normalizeText(update.message?.text)
  const callbackData = normalizeText(update.callback_query?.data)

  for (const trigger of triggers) {
    const data = (trigger.data || {}) as Record<string, unknown>
    const triggerType = String(data.trigger || 'command')
    const pattern = normalizeText(data.pattern)

    if (triggerType === 'command') {
      const command = pattern || '/start'
      if (messageText.startsWith(command)) return trigger
      continue
    }

    if (triggerType === 'text') {
      if (!pattern) continue
      if (messageText.toLowerCase().includes(pattern.toLowerCase())) return trigger
      continue
    }

    if (triggerType === 'callbackQuery') {
      if (pattern && callbackData === pattern) return trigger
      continue
    }

    if (triggerType === 'photo') {
      // photo trigger is not implemented in this simplified runtime
      continue
    }

    if (triggerType === 'any') {
      if (messageText || callbackData) return trigger
      continue
    }
  }

  return null
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  parseMode?: unknown,
  keyboard?: unknown,
  options?: {
    forceReply?: boolean
    inputPlaceholder?: string
  }
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: text || '...',
  }

  const normalizedParseMode = normalizeParseMode(parseMode)
  if (normalizedParseMode) {
    payload.parse_mode = normalizedParseMode
  }

  if (options?.forceReply) {
    const forceReply: ForceReplyMarkup = { force_reply: true }
    const inputPlaceholder = normalizeText(options.inputPlaceholder)
    if (inputPlaceholder) {
      forceReply.input_field_placeholder = inputPlaceholder.slice(0, 64)
    }
    payload.reply_markup = forceReply
  } else {
    const replyMarkup = buildInlineKeyboardMarkup(keyboard)
    if (replyMarkup) {
      payload.reply_markup = replyMarkup
    }
  }

  await callTelegramApi(token, 'sendMessage', payload)
}

async function executeActionNode(
  node: BotNode,
  session: RuntimeSession,
  contextVariables: Record<string, unknown>,
  update: TelegramUpdate,
  botToken: string
): Promise<void> {
  const data = (node.data || {}) as Record<string, unknown>
  const actionRaw = data.action

  if (!actionRaw || typeof actionRaw !== 'object') return

  const action = actionRaw as Record<string, unknown>
  const actionType = String(action.type || '')

  if (actionType === 'setVariable') {
    const variableName = normalizeText(action.variableName)
    if (!variableName) return

    const rawValue = action.value
    const value =
      typeof rawValue === 'string'
        ? interpolateTemplate(rawValue, contextVariables)
        : rawValue

    session.variables[variableName] = value
    return
  }

  if (actionType === 'delay') {
    const delayMs = Math.min(Math.max(Number(action.duration || 1000), 0), 10000)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return
  }

  if (actionType === 'deleteMessage') {
    const messageId = update.message?.message_id || update.callback_query?.message?.message_id
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id
    if (!messageId || !chatId) return

    try {
      await callTelegramApi(botToken, 'deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
      })
    } catch {
      // ignore non-critical delete errors
    }
    return
  }

  if (actionType === 'httpRequest') {
    const url = normalizeText(action.url)
    if (!url) return

    const method = normalizeText(action.method || 'GET') || 'GET'
    const headers =
      action.headers && typeof action.headers === 'object'
        ? (action.headers as HeadersInit)
        : undefined

    let body: BodyInit | undefined
    if (action.body !== undefined && action.body !== null) {
      body = typeof action.body === 'string' ? action.body : JSON.stringify(action.body)
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      cache: 'no-store',
    })

    const responseText = await response.text()
    const saveToVariable = normalizeText(action.saveToVariable)
    if (saveToVariable) {
      session.variables[saveToVariable] = responseText
    }
  }
}

async function executeWebhookNode(
  node: BotNode,
  session: RuntimeSession,
  contextVariables: Record<string, unknown>
): Promise<void> {
  const data = (node.data || {}) as Record<string, unknown>
  const urlTemplate = normalizeText(data.url)
  if (!urlTemplate) return

  const url = interpolateTemplate(urlTemplate, contextVariables)
  const method = normalizeText(data.method || 'GET') || 'GET'
  const headers =
    data.headers && typeof data.headers === 'object'
      ? (data.headers as HeadersInit)
      : undefined

  let body: BodyInit | undefined
  if (data.body !== undefined && data.body !== null) {
    body = typeof data.body === 'string' ? data.body : JSON.stringify(data.body)
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    cache: 'no-store',
  })
  const responseText = await response.text()

  const saveToVariable = normalizeText(data.saveToVariable)
  if (saveToVariable) {
    session.variables[saveToVariable] = responseText
  }
}

async function executeFromNode(args: {
  startNodeId: string
  botToken: string
  chatId: number
  config: BotConfig
  session: RuntimeSession
  update: TelegramUpdate
  user: TelegramUser | null
}): Promise<WorkflowRunState> {
  const { botToken, chatId, config, session, update, user } = args
  const nodeMap = buildNodeMap(config)

  let currentNodeId: string | null = args.startNodeId
  let steps = 0

  while (currentNodeId && steps < MAX_WORKFLOW_STEPS) {
    steps += 1

    const node = nodeMap.get(currentNodeId)
    if (!node) return 'completed'

    const contextVariables: Record<string, unknown> = {
      ...session.variables,
      user: {
        id: user?.id,
        username: user?.username,
        firstName: user?.first_name,
        lastName: user?.last_name,
        languageCode: user?.language_code,
      },
    }

    if (node.type === 'message') {
      const data = (node.data || {}) as Record<string, unknown>
      const rawText = normalizeText(data.text || data.__label || data._label || '')
      const text = interpolateTemplate(rawText, contextVariables)
      await sendMessage(botToken, chatId, text, data.parseMode, data.keyboard)
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'input') {
      const data = (node.data || {}) as Record<string, unknown>
      const rawQuestion = normalizeText(data.question || 'Введите данные')
      const question = interpolateTemplate(rawQuestion, contextVariables)
      const placeholder = normalizeText(data.variableName || data.inputPlaceholder || 'Введите ответ')

      try {
        await sendMessage(botToken, chatId, question, data.parseMode, data.keyboard, {
          forceReply: true,
          inputPlaceholder: placeholder,
        })
      } catch (error) {
        console.error('Failed to send input with force-reply, fallback to plain message:', error)
        await sendMessage(botToken, chatId, question, data.parseMode, data.keyboard)
      }
      session.waitingForNodeId = node.id
      session.updatedAt = Date.now()
      return 'waiting'
    }

    if (node.type === 'condition') {
      const data = (node.data || {}) as Record<string, unknown>
      const variableName = normalizeText(data.variable)
      const operator = normalizeText(data.operator || 'equals')
      const compareTo = data.value

      const leftValue = variableName ? resolvePath(contextVariables, variableName) : undefined
      const result = evaluateConditionValue(operator, leftValue, compareTo)
      currentNodeId = getConditionNextNodeId(config, node.id, result)
      continue
    }

    if (node.type === 'action') {
      await executeActionNode(node, session, contextVariables, update, botToken)
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'webhook') {
      await executeWebhookNode(node, session, contextVariables)
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'wait') {
      session.waitingForNodeId = node.id
      session.updatedAt = Date.now()
      return 'waiting'
    }

    currentNodeId = getDefaultNextNodeId(config, node.id)
  }

  return 'completed'
}

export async function handleTelegramWorkflowUpdate(context: RuntimeContext): Promise<void> {
  cleanupExpiredSessions()

  const message = context.update.message
  const callback = context.update.callback_query

  const chatId = message?.chat.id || callback?.message?.chat.id
  const user = message?.from || callback?.from || null

  if (!chatId || !user?.id) {
    return
  }

  const sessionKey = createSessionKey(context.botId, chatId, user.id)
  const session = getOrCreateSession(sessionKey)
  const nodeMap = buildNodeMap(context.config)
  const messageText = normalizeText(message?.text)
  const callbackData = normalizeText(callback?.data)
  const incomingInputValue = messageText || callbackData || null

  if (callback?.id) {
    try {
      await callTelegramApi(context.botToken, 'answerCallbackQuery', {
        callback_query_id: callback.id,
      })
    } catch {
      // ignore answer callback errors
    }
  }

  if (session.waitingForNodeId && incomingInputValue) {
    const waitingNode = nodeMap.get(session.waitingForNodeId)
    const waitingNodeId = session.waitingForNodeId
    session.waitingForNodeId = undefined

    if (waitingNode?.type === 'input') {
      const variableName = normalizeText((waitingNode.data as Record<string, unknown>)?.variableName)
      if (variableName) {
        session.variables[variableName] = incomingInputValue
      }
    }

    session.updatedAt = Date.now()

    if (waitingNodeId) {
      const nextNodeId = getDefaultNextNodeId(context.config, waitingNodeId)
      if (nextNodeId) {
        const runState = await executeFromNode({
          startNodeId: nextNodeId,
          botToken: context.botToken,
          chatId,
          config: context.config,
          session,
          update: context.update,
          user,
        })

        if (runState === 'completed' && !session.waitingForNodeId) {
          resetSessionState(session)
        }
      } else {
        resetSessionState(session)
      }
    }
    return
  }

  const triggerNode = findMatchingTrigger(context.config, context.update)

  if (triggerNode) {
    // Start every trigger execution from a clean state to avoid stale variable leaks
    resetSessionState(session)

    const nextNodeId = getDefaultNextNodeId(context.config, triggerNode.id)
    if (nextNodeId) {
      const runState = await executeFromNode({
        startNodeId: nextNodeId,
        botToken: context.botToken,
        chatId,
        config: context.config,
        session,
        update: context.update,
        user,
      })

      if (runState === 'completed' && !session.waitingForNodeId) {
        resetSessionState(session)
      }
    }
    return
  }

  if (context.config.nodes.every((node) => node.type !== 'trigger')) {
    const firstNode = getFirstExecutableNode(context.config)
    if (firstNode) {
      resetSessionState(session)

      const runState = await executeFromNode({
        startNodeId: firstNode.id,
        botToken: context.botToken,
        chatId,
        config: context.config,
        session,
        update: context.update,
        user,
      })

      if (runState === 'completed' && !session.waitingForNodeId) {
        resetSessionState(session)
      }
    }
  }
}
