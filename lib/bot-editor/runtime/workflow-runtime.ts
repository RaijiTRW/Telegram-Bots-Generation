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

declare global {
  // Shared runtime sessions across Next.js module reloads (dev HMR).
  var __tflowRuntimeSessions: Map<string, RuntimeSession> | undefined
}

const runtimeSessions: Map<string, RuntimeSession> =
  globalThis.__tflowRuntimeSessions || new Map<string, RuntimeSession>()
if (!globalThis.__tflowRuntimeSessions) {
  globalThis.__tflowRuntimeSessions = runtimeSessions
}

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

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeCallbackToken(value: unknown): string {
  const normalized = normalizeText(value).toLowerCase()
  return normalized.startsWith('btn:') ? normalized.slice(4) : normalized
}

const NOOP_CALLBACK_PREFIX = '__noop__:'

function isNoopCallback(value: unknown): boolean {
  return normalizeText(value).startsWith(NOOP_CALLBACK_PREFIX)
}

function toCallbackSlug(value: string): string {
  const compact = value.toLowerCase().trim().replace(/\s+/g, '_')
  if (!compact) return ''
  const encoded = encodeURIComponent(compact).replace(/%/g, '')
  return encoded.replace(/[^a-z0-9_:-]/g, '').slice(0, 52)
}

function isSupportedButtonUrl(value: string): boolean {
  return /^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(value)
}

function asKeyboardButtonRecord(button: unknown): Record<string, unknown> | null {
  if (button === null || button === undefined) {
    return null
  }

  if (typeof button === 'string' || typeof button === 'number' || typeof button === 'boolean') {
    return {
      text: String(button),
      callbackData: String(button),
    }
  }

  if (typeof button === 'object') {
    return button as Record<string, unknown>
  }

  return null
}

function normalizeKeyboardRows(keyboard: unknown): Record<string, unknown>[][] {
  if (!keyboard) return []

  if (Array.isArray(keyboard)) {
    if (keyboard.length > 0 && Array.isArray(keyboard[0])) {
      return keyboard.map((row) =>
        (Array.isArray(row) ? row : [])
          .map((button) => asKeyboardButtonRecord(button))
          .filter((button): button is Record<string, unknown> => Boolean(button))
      )
    }

    return [
      keyboard
        .map((button) => asKeyboardButtonRecord(button))
        .filter((button): button is Record<string, unknown> => Boolean(button)),
    ]
  }

  if (typeof keyboard !== 'object') {
    return []
  }

  const keyboardRecord = keyboard as Record<string, unknown>
  const rowsRaw = Array.isArray(keyboardRecord.rows)
    ? keyboardRecord.rows
    : Array.isArray(keyboardRecord.inline_keyboard)
      ? keyboardRecord.inline_keyboard
      : Array.isArray(keyboardRecord.buttons)
        ? [keyboardRecord.buttons]
        : []

  return rowsRaw.map((row) => {
    if (Array.isArray(row)) {
      return row
        .map((button) => asKeyboardButtonRecord(button))
        .filter((button): button is Record<string, unknown> => Boolean(button))
    }

    const buttons = (row as Record<string, unknown>)?.buttons
    if (!Array.isArray(buttons)) return []
    return buttons
      .map((button) => asKeyboardButtonRecord(button))
      .filter((button): button is Record<string, unknown> => Boolean(button))
  })
}

function resolveKeyboardData(data: Record<string, unknown>): unknown {
  if (data.keyboard !== undefined) {
    return data.keyboard
  }

  if (data.inlineKeyboard !== undefined) {
    return data.inlineKeyboard
  }

  if (Array.isArray(data.buttons)) {
    return data.buttons
  }

  return undefined
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

type HttpPair = { key: string; value: string }

function normalizeHttpPairs(value: unknown): HttpPair[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const pair = (item || {}) as Record<string, unknown>
      return {
        key: normalizeText(pair.key),
        value: String(pair.value ?? ''),
      }
    })
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, rawValue]) => ({
      key: normalizeText(key),
      value: String(rawValue ?? ''),
    }))
  }

  return []
}

function interpolateUnknown(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return interpolateTemplate(value, variables)
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateUnknown(item, variables))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        interpolateUnknown(nestedValue, variables),
      ])
    )
  }

  return value
}

function appendQueryParams(url: string, queryParams: HttpPair[]): string {
  const validPairs = queryParams.filter((pair) => pair.key)
  if (validPairs.length === 0) {
    return url
  }

  const params = new URLSearchParams()
  for (const pair of validPairs) {
    params.append(pair.key, pair.value)
  }

  const query = params.toString()
  if (!query) {
    return url
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

function buildHeadersRecord(
  rawHeaders: unknown,
  variables: Record<string, unknown>
): Record<string, string> {
  const headers: Record<string, string> = {}
  const headerPairs = normalizeHttpPairs(rawHeaders)

  for (const pair of headerPairs) {
    if (!pair.key) continue
    headers[pair.key] = interpolateTemplate(pair.value, variables)
  }

  return headers
}

function buildHttpRequestBody(args: {
  method: string
  bodyType: string
  rawBody: unknown
  variables: Record<string, unknown>
  headers: Record<string, string>
}): BodyInit | undefined {
  const { method, bodyType, rawBody, variables, headers } = args

  if (method === 'GET' || method === 'HEAD') {
    return undefined
  }

  if (rawBody === undefined || rawBody === null || bodyType === 'none') {
    return undefined
  }

  if (bodyType === 'raw') {
    if (typeof rawBody === 'string') {
      return interpolateTemplate(rawBody, variables)
    }
    return JSON.stringify(interpolateUnknown(rawBody, variables))
  }

  if (bodyType === 'form') {
    const params = new URLSearchParams()
    for (const pair of normalizeHttpPairs(rawBody)) {
      if (!pair.key) continue
      params.append(pair.key, interpolateTemplate(pair.value, variables))
    }

    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
    if (!hasContentType) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    return params.toString()
  }

  // Default: json
  if (typeof rawBody === 'string') {
    const interpolated = interpolateTemplate(rawBody, variables)
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json'
    }

    try {
      const parsed = JSON.parse(interpolated)
      return JSON.stringify(parsed)
    } catch {
      return interpolated
    }
  }

  const interpolatedObject = interpolateUnknown(rawBody, variables)
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')
  if (!hasContentType) {
    headers['Content-Type'] = 'application/json'
  }
  return JSON.stringify(interpolatedObject)
}

function buildInlineKeyboardMarkup(keyboard: unknown): InlineKeyboardMarkup | undefined {
  const rows = normalizeKeyboardRows(keyboard)
  if (rows.length === 0) {
    return undefined
  }

  const inlineKeyboard: InlineKeyboardButton[][] = []

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const buttons = rows[rowIndex]
    if (buttons.length === 0) {
      continue
    }

    const normalizedRow: InlineKeyboardButton[] = []

    for (let buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      const buttonRecord = buttons[buttonIndex]
      const text =
        normalizeText(buttonRecord.text) ||
        normalizeText(buttonRecord.label) ||
        normalizeText(buttonRecord.title)
      if (!text) continue

      const callbackDataRaw =
        normalizeText(buttonRecord.callbackData) ||
        normalizeText(buttonRecord.callback_data) ||
        normalizeText(buttonRecord.data) ||
        normalizeText(buttonRecord.action) ||
        normalizeText(buttonRecord.value)
      const url = normalizeText(buttonRecord.url)
      if (url && isSupportedButtonUrl(url)) {
        normalizedRow.push({
          text,
          url,
        })
        continue
      }

      const hasExplicitCallback = callbackDataRaw.length > 0
      const fallbackNoopFromId = toCallbackSlug(normalizeText(buttonRecord.id))
      const fallbackNoop =
        `${NOOP_CALLBACK_PREFIX}${
          fallbackNoopFromId || `r${rowIndex + 1}b${buttonIndex + 1}`
        }`

      const callbackData = (hasExplicitCallback ? callbackDataRaw : fallbackNoop).slice(0, 64)
      if (!callbackData) {
        continue
      }

      normalizedRow.push({
        text,
        callback_data: callbackData,
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
  const hasCallbackUpdate = Boolean(update.callback_query)

  if (hasCallbackUpdate) {
    if (!callbackData || isNoopCallback(callbackData)) {
      return null
    }

    const callbackDataLower = callbackData.toLowerCase()
    const normalizedIncoming = normalizeCallbackToken(callbackData)
    const callbackTriggers = triggers.filter((trigger) => {
      const data = (trigger.data || {}) as Record<string, unknown>
      return String(data.trigger || 'command') === 'callbackQuery'
    })

    if (callbackTriggers.length === 0) {
      return null
    }

    const matches: Array<{
      node: BotNode
      score: number
    }> = []

    for (const trigger of callbackTriggers) {
      const data = (trigger.data || {}) as Record<string, unknown>
      const pattern = normalizeText(data.pattern)
      if (!pattern) {
        // Strict mode: empty callback pattern is ignored.
        continue
      }

      let score = 0
      if (callbackData === pattern) {
        score = 300
      } else if (callbackDataLower === pattern.toLowerCase()) {
        score = 250
      } else if (normalizedIncoming && normalizedIncoming === pattern) {
        score = 200
      } else if (normalizedIncoming && normalizedIncoming === pattern.toLowerCase()) {
        score = 150
      }

      if (score > 0) {
        matches.push({
          node: trigger,
          score,
        })
      }
    }

    if (matches.length === 0) {
      return null
    }

    matches.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.node.id.localeCompare(right.node.id)
    })

    if (matches.length > 1 && matches[0].score === matches[1].score) {
      // Ambiguous callback mapping: several triggers match equally.
      // In strict mode we skip execution to avoid wrong branch.
      return null
    }

    return matches[0].node
  }

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

    if (triggerType === 'callbackQuery') continue

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

  // Legacy compatibility: old flows may still have HTTP inside Action node.
  if (actionType === 'httpRequest') {
    await executeHttpRequestData(action, session, contextVariables)
  }
}

async function executeHttpRequestData(
  data: Record<string, unknown>,
  session: RuntimeSession,
  contextVariables: Record<string, unknown>
): Promise<void> {
  const urlTemplate = normalizeText(data.url || data.endpoint)
  if (!urlTemplate) return

  const method = normalizeText(data.method || 'GET').toUpperCase() || 'GET'
  const queryPairs = normalizeHttpPairs(data.queryParams).map((pair) => ({
    key: pair.key,
    value: interpolateTemplate(pair.value, contextVariables),
  }))
  const url = appendQueryParams(interpolateTemplate(urlTemplate, contextVariables), queryPairs)

  const headers = buildHeadersRecord(data.headers, contextVariables)
  const bodyType = normalizeText(data.bodyType || 'json').toLowerCase()
  const body = buildHttpRequestBody({
    method,
    bodyType,
    rawBody: data.body,
    variables: contextVariables,
    headers,
  })

  const timeoutMs = Math.min(Math.max(Number(data.timeout || 30000), 100), 120000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body,
      cache: 'no-store',
      signal: controller.signal,
    })

    const responseText = await response.text()

    const saveToVariable = normalizeText(data.saveToVariable)
    if (saveToVariable) {
      session.variables[saveToVariable] = responseText
    }
  } finally {
    clearTimeout(timer)
  }
}

async function executeHttpNode(
  node: BotNode,
  session: RuntimeSession,
  contextVariables: Record<string, unknown>
): Promise<void> {
  const data = (node.data || {}) as Record<string, unknown>
  await executeHttpRequestData(data, session, contextVariables)
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
      await sendMessage(botToken, chatId, text, data.parseMode, resolveKeyboardData(data))
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'input') {
      const data = (node.data || {}) as Record<string, unknown>
      const rawQuestion = normalizeText(data.question || 'Введите данные')
      const question = interpolateTemplate(rawQuestion, contextVariables)
      const placeholder = normalizeText(data.inputPlaceholder || data.variableName || 'Введите ответ')
      const shouldUseForceReply = data.forceReply !== false
      const keyboard = resolveKeyboardData(data)

      if (shouldUseForceReply) {
        try {
          await sendMessage(botToken, chatId, question, data.parseMode, keyboard, {
            forceReply: true,
            inputPlaceholder: placeholder,
          })
        } catch (error) {
          console.error('Failed to send input with force-reply, fallback to plain message:', error)
          await sendMessage(botToken, chatId, question, data.parseMode, keyboard)
        }
      } else {
        await sendMessage(botToken, chatId, question, data.parseMode, keyboard)
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

    if (node.type === 'http' || node.type === 'webhook') {
      await executeHttpNode(node, session, contextVariables)
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

  const hasAnyTrigger = context.config.nodes.some((node) => node.type === 'trigger')
  if (!hasAnyTrigger) {
    // Strict mode: without trigger nodes workflow must not execute any actions.
    return
  }

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

  const runFromTriggerNode = async (triggerNode: BotNode) => {
    // Start every trigger execution from a clean state to avoid stale variable leaks
    resetSessionState(session)

    const nextNodeId = getDefaultNextNodeId(context.config, triggerNode.id)
    if (!nextNodeId) {
      return
    }

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

  let callbackAcknowledged = !callback?.id
  if (callback?.id) {
    try {
      await callTelegramApi(context.botToken, 'answerCallbackQuery', {
        callback_query_id: callback.id,
      })
      callbackAcknowledged = true
    } catch {
      callbackAcknowledged = false
    }
  }

  const triggerNode = findMatchingTrigger(context.config, context.update)

  if (callback && process.env.NODE_ENV !== 'production') {
    const triggerData = (triggerNode?.data || {}) as Record<string, unknown>
    console.info('[WorkflowRuntime] callback update', {
      botId: context.botId,
      callbackData,
      matchedTriggerId: triggerNode?.id || null,
      matchedTriggerType: triggerData.trigger || null,
      matchedPattern: triggerData.pattern || null,
    })
  }

  // Callback updates are handled only by callback triggers in strict mode.
  // If no callback trigger matched, callback is ignored.
  if (callback) {
    if (!callbackAcknowledged) {
      return
    }

    if (triggerNode) {
      await runFromTriggerNode(triggerNode)
    }
    return
  }

  if (session.waitingForNodeId) {
    const waitingNode = nodeMap.get(session.waitingForNodeId)
    const waitingNodeId = session.waitingForNodeId
    if (!waitingNodeId) {
      return
    }

    if (waitingNode?.type === 'input' && !messageText) {
      // Ignore callback clicks while waiting for plain text input.
      return
    }

    if (waitingNode?.type === 'wait') {
      const waitData = (waitingNode.data || {}) as Record<string, unknown>
      const waitFor = normalizeText(waitData.waitFor || 'message')
      const matchedWaitType =
        (waitFor === 'callbackQuery' && Boolean(callback)) ||
        ((waitFor === 'message' || waitFor === 'text') && Boolean(messageText)) ||
        (waitFor === 'any' && Boolean(messageText || callback))

      if (!matchedWaitType) {
        return
      }

      const saveToVariable = normalizeText(waitData.saveToVariable)
      if (saveToVariable) {
        session.variables[saveToVariable] = callbackData || messageText
      }
    }

    session.waitingForNodeId = undefined
    if (waitingNode?.type === 'input') {
      const variableName = normalizeText((waitingNode.data as Record<string, unknown>)?.variableName)
      if (variableName) {
        session.variables[variableName] = messageText
      }
    }

    session.updatedAt = Date.now()

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
    return
  }

  if (triggerNode) {
    await runFromTriggerNode(triggerNode)
    return
  }
}
