import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve as resolvePathFs } from 'node:path'
import { homedir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createContext as createVmContext, Script as VmScript } from 'node:vm'
import type { BotConfig, Edge as BotEdge, Node as BotNode } from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi, callTelegramApiFormData } from '@/lib/bot-editor/runtime/telegram-api'
import { appendBotTestLog } from '@/lib/bot-editor/runtime/test-log-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendOutboundContactEvent } from '@/lib/bot-editor/services/bot-crm-service'
import { appendBotAuditEventSafe } from '@/lib/bot-editor/services/bot-audit-service'

interface TelegramUser {
  id: number
  is_bot?: boolean
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
  caption?: string
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
  scheduledResumeAtMs?: number
  replyKeyboardState?: {
    mode: 'system' | 'variant' | 'hidden'
    variantKey?: string
    pendingRemove?: boolean
  }
  updatedAt: number
}

interface RuntimeContext {
  botId: string
  botToken: string
  config: BotConfig
  update: TelegramUpdate
  metadata?: Record<string, unknown> | null
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

interface ReplyKeyboardMarkup {
  keyboard: Array<Array<ReplyKeyboardButton>>
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
  is_persistent?: boolean
}

interface ReplyKeyboardRemoveMarkup {
  remove_keyboard: true
}

type AnyReplyMarkup = InlineKeyboardMarkup | ForceReplyMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemoveMarkup

interface ReplyKeyboardButton {
  text: string
  style?: 'default' | 'primary' | 'success' | 'danger'
  icon_custom_emoji_id?: string
}

type SupportedMediaAttachmentType = 'photo' | 'video' | 'document' | 'audio'

interface ResolvedMessageAttachment {
  type: SupportedMediaAttachmentType
  source: string
}

declare global {
  // Shared runtime sessions across Next.js module reloads (dev HMR).
  var __tflowRuntimeSessions: Map<string, RuntimeSession> | undefined
  var __tflowRuntimeSchedulerTimers: Map<string, ReturnType<typeof setTimeout>> | undefined
  var __tflowScheduleTriggerDedupe: Map<string, string> | undefined
  var __tflowAutoReactionCooldowns: Map<string, number> | undefined
}

const runtimeSessions: Map<string, RuntimeSession> =
  globalThis.__tflowRuntimeSessions || new Map<string, RuntimeSession>()
if (!globalThis.__tflowRuntimeSessions) {
  globalThis.__tflowRuntimeSessions = runtimeSessions
}

const runtimeSchedulerTimers: Map<string, ReturnType<typeof setTimeout>> =
  globalThis.__tflowRuntimeSchedulerTimers || new Map<string, ReturnType<typeof setTimeout>>()
if (!globalThis.__tflowRuntimeSchedulerTimers) {
  globalThis.__tflowRuntimeSchedulerTimers = runtimeSchedulerTimers
}

const scheduleTriggerDedupe: Map<string, string> =
  globalThis.__tflowScheduleTriggerDedupe || new Map<string, string>()
if (!globalThis.__tflowScheduleTriggerDedupe) {
  globalThis.__tflowScheduleTriggerDedupe = scheduleTriggerDedupe
}

const autoReactionCooldowns: Map<string, number> =
  globalThis.__tflowAutoReactionCooldowns || new Map<string, number>()
if (!globalThis.__tflowAutoReactionCooldowns) {
  globalThis.__tflowAutoReactionCooldowns = autoReactionCooldowns
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12
const MAX_WORKFLOW_STEPS = 64
const MAX_TIMEOUT_CHUNK_MS = 2_147_483_647
type WorkflowRunState = 'waiting' | 'completed'
const DEFAULT_AUTO_REACTION_COOLDOWN_SECONDS = 15
const AUTO_REACTION_MAX_COOLDOWN_SECONDS = 3600
const DEFAULT_SCRIPT_TIMEOUT_MS = 1000
const MAX_SCRIPT_TIMEOUT_MS = 30_000
const SCRIPT_NODES_ENABLED =
  process.env.TFLOW_ENABLE_UNSAFE_SCRIPT_NODES === '1' || process.env.NODE_ENV !== 'production'
const PYTHON_RESULT_MARKER = '__TFLOW_SCRIPT_RESULT__:'
const hasCrmIngestionConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

const PYTHON_NODE_WRAPPER_CODE = `
import json, sys
payload = json.load(sys.stdin)
scope = {
  "input": payload.get("input"),
  "context": payload.get("context"),
  "vars": payload.get("vars"),
  "result": None,
}
try:
  exec(payload.get("code", ""), {"__builtins__": __builtins__}, scope)
  print("${PYTHON_RESULT_MARKER}" + json.dumps({"ok": True, "result": scope.get("result")}, ensure_ascii=False, default=str))
except Exception as e:
  print("${PYTHON_RESULT_MARKER}" + json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
`.trim()

type AutoReactionsRuntimeConfig = {
  enabled: boolean
  cooldownSeconds: number
  onlyTextMessages: boolean
  mode: 'rule-based'
}

type ReplyKeyboardRuleRuntimeConfig = {
  id: string
  name: string
  enabled: boolean
  variable: string
  operator: string
  value: unknown
  rows: ReplyKeyboardButtonRuntime[][]
}

type ReplyKeyboardRuntimeConfig = {
  enabled: boolean
  resizeKeyboard: boolean
  oneTimeKeyboard: boolean
  isPersistent: boolean
  baseRows: ReplyKeyboardButtonRuntime[][]
  rules: ReplyKeyboardRuleRuntimeConfig[]
}

type ReplyKeyboardButtonRuntime = {
  text: string
  emoji?: string
  style?: 'default' | 'primary' | 'success' | 'danger'
  iconCustomEmojiId?: string
}

function readAutoReactionsRuntimeConfig(
  metadata: Record<string, unknown> | null | undefined
): AutoReactionsRuntimeConfig | null {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  const features =
    metadata.features && typeof metadata.features === 'object'
      ? (metadata.features as Record<string, unknown>)
      : null
  if (!features) return null

  const auto =
    features.autoReactions && typeof features.autoReactions === 'object'
      ? (features.autoReactions as Record<string, unknown>)
      : null
  if (!auto) return null

  const cooldownRaw = Number(auto.cooldownSeconds)
  const cooldownSeconds = Number.isFinite(cooldownRaw)
    ? Math.max(0, Math.min(AUTO_REACTION_MAX_COOLDOWN_SECONDS, Math.round(cooldownRaw)))
    : DEFAULT_AUTO_REACTION_COOLDOWN_SECONDS

  return {
    enabled: Boolean(auto.enabled),
    onlyTextMessages: auto.onlyTextMessages === undefined ? true : Boolean(auto.onlyTextMessages),
    cooldownSeconds,
    mode: 'rule-based',
  }
}

function normalizeReplyKeyboardButtonStyleRuntime(
  value: unknown
): 'default' | 'primary' | 'success' | 'danger' {
  const raw = normalizeText(value || 'default')
  if (raw === 'primary' || raw === 'success' || raw === 'danger') {
    return raw
  }
  return 'default'
}

function sanitizeReplyKeyboardRowsRuntime(value: unknown): ReplyKeyboardButtonRuntime[][] {
  if (!Array.isArray(value)) return []

  const rows: ReplyKeyboardButtonRuntime[][] = []
  for (const rawRow of value) {
    if (!Array.isArray(rawRow)) continue
    const row = (rawRow
      .map((button) => {
        if (typeof button === 'string') {
          const text = normalizeText(button)
          return text ? ({ text, style: 'default' as const }) : null
        }

        if (!button || typeof button !== 'object') {
          return null
        }

        const record = button as Record<string, unknown>
        const text = normalizeText(record.text)
        const emoji = normalizeText(record.emoji)
        const iconCustomEmojiId = normalizeText(record.iconCustomEmojiId ?? record.icon_custom_emoji_id)
        if (!text && !emoji) {
          return null
        }

        return {
          text,
          ...(emoji ? { emoji } : {}),
          style: normalizeReplyKeyboardButtonStyleRuntime(record.style),
          ...(iconCustomEmojiId ? { iconCustomEmojiId } : {}),
        }
      })
      .filter(Boolean) as ReplyKeyboardButtonRuntime[])
      .slice(0, 10)
    if (row.length > 0) {
      rows.push(row)
    }
    if (rows.length >= 12) break
  }
  return rows
}

function readReplyKeyboardRuntimeConfig(
  metadata: Record<string, unknown> | null | undefined
): ReplyKeyboardRuntimeConfig | null {
  if (!metadata || typeof metadata !== 'object') {
    return null
  }

  const features =
    metadata.features && typeof metadata.features === 'object'
      ? (metadata.features as Record<string, unknown>)
      : null
  if (!features) return null

  const raw =
    features.replyKeyboard && typeof features.replyKeyboard === 'object'
      ? (features.replyKeyboard as Record<string, unknown>)
      : null
  if (!raw) return null

  const rawRules = Array.isArray(raw.rules) ? raw.rules : []
  const rules: ReplyKeyboardRuleRuntimeConfig[] = []
  for (let index = 0; index < rawRules.length; index += 1) {
    const item = rawRules[index]
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = normalizeText(record.id) || `rule_${index + 1}`
    const variable = normalizeText(record.variable)
    const operator = normalizeText(record.operator || 'equals') || 'equals'
    const rows = sanitizeReplyKeyboardRowsRuntime(record.rows)
    if (!id || rows.length === 0) {
      continue
    }
    rules.push({
      id,
      name: normalizeText(record.name) || `Rule ${index + 1}`,
      enabled: record.enabled === undefined ? true : Boolean(record.enabled),
      variable,
      operator,
      value: record.value,
      rows,
    })
  }

  return {
    enabled: Boolean(raw.enabled),
    resizeKeyboard: raw.resizeKeyboard === undefined ? true : Boolean(raw.resizeKeyboard),
    oneTimeKeyboard: Boolean(raw.oneTimeKeyboard),
    isPersistent: raw.isPersistent === undefined ? true : Boolean(raw.isPersistent),
    baseRows: sanitizeReplyKeyboardRowsRuntime(raw.baseRows),
    rules,
  }
}

function getReplyKeyboardVariantRows(
  config: ReplyKeyboardRuntimeConfig,
  variantKey: string | undefined
): ReplyKeyboardButtonRuntime[][] | null {
  const normalizedVariantKey = normalizeText(variantKey || 'base') || 'base'
  if (normalizedVariantKey === 'base') {
    return config.baseRows.length > 0 ? config.baseRows : null
  }

  if (normalizedVariantKey.startsWith('rule:')) {
    const ruleId = normalizedVariantKey.slice('rule:'.length).trim()
    const rule = config.rules.find((item) => item.id === ruleId)
    return rule?.rows?.length ? rule.rows : null
  }

  return null
}

function buildReplyKeyboardMarkup(
  config: ReplyKeyboardRuntimeConfig,
  rows: ReplyKeyboardButtonRuntime[][],
  variables?: Record<string, unknown>
): ReplyKeyboardMarkup | undefined {
  if (!rows.length) return undefined

  const keyboard = rows
    .map((row) =>
      row
        .map((button) => {
          const baseText = normalizeText(button.text)
          const emojiText = normalizeText(button.emoji)
          const composedTextRaw = [emojiText, baseText].filter(Boolean).join(' ')
          const text = variables ? interpolateTemplate(composedTextRaw, variables).trim() : composedTextRaw.trim()
          if (!text) {
            return null
          }

          const replyButton: ReplyKeyboardButton = { text }
          const style = normalizeReplyKeyboardButtonStyleRuntime(button.style)
          if (style && style !== 'default') {
            replyButton.style = style
          }
          const iconCustomEmojiId = normalizeText(button.iconCustomEmojiId)
          if (iconCustomEmojiId) {
            replyButton.icon_custom_emoji_id = iconCustomEmojiId
          }

          return replyButton
        })
        .filter((button): button is ReplyKeyboardButton => Boolean(button))
    )
    .filter((row) => row.length > 0)

  if (!keyboard.length) return undefined

  const markup: ReplyKeyboardMarkup = { keyboard }
  if (config.resizeKeyboard) {
    markup.resize_keyboard = true
  }
  if (config.oneTimeKeyboard) {
    markup.one_time_keyboard = true
  }
  if (config.isPersistent) {
    markup.is_persistent = true
  }

  return markup
}

function resolveSystemReplyKeyboardMarkupForSend(args: {
  metadata?: Record<string, unknown> | null
  session: RuntimeSession
  contextVariables: Record<string, unknown>
}): ReplyKeyboardMarkup | ReplyKeyboardRemoveMarkup | undefined {
  const { metadata, session, contextVariables } = args
  const config = readReplyKeyboardRuntimeConfig(metadata)
  const state = session.replyKeyboardState

  if (state?.mode === 'hidden') {
    if (state.pendingRemove) {
      state.pendingRemove = false
      return { remove_keyboard: true }
    }
    return undefined
  }

  if (!config?.enabled) {
    return undefined
  }

  if (state?.mode === 'variant') {
    const variantRows = getReplyKeyboardVariantRows(config, state.variantKey)
    return variantRows ? buildReplyKeyboardMarkup(config, variantRows, contextVariables) : undefined
  }

  for (const rule of config.rules) {
    if (!rule.enabled || !rule.variable) continue
    const leftValue = resolvePath(contextVariables, rule.variable)
    if (evaluateConditionValue(rule.operator || 'equals', leftValue, rule.value)) {
      return buildReplyKeyboardMarkup(config, rule.rows, contextVariables)
    }
  }

  return buildReplyKeyboardMarkup(config, config.baseRows, contextVariables)
}

function getIncomingMessageReactionText(message: TelegramMessage): string {
  return normalizeText(message.text || message.caption || '')
}

function selectRuleBasedReactionEmoji(message: TelegramMessage): string {
  const text = getIncomingMessageReactionText(message).toLowerCase()

  if (!text) {
    return '👍'
  }

  if (/^\/start(?:\s|$)/i.test(text)) {
    return '👋'
  }

  if (/^\/[a-z0-9_]+/i.test(text)) {
    return '⚡'
  }

  if (
    /(спасибо|благодар|thanks|thank you|thx|мерси)/i.test(text)
  ) {
    return '❤️'
  }

  if (
    /(ошибк|error|bug|не работает|сломал|сломалось|проблем|issue|fail|не могу)/i.test(text)
  ) {
    return '👀'
  }

  if (/\?/.test(text) || /\b(как|почему|зачем|when|what|why|how|can i|help)\b/i.test(text)) {
    return '🤔'
  }

  if (
    /(круто|супер|отлично|класс|топ|awesome|great|nice|perfect|cool|super|love)/i.test(text)
  ) {
    return '🔥'
  }

  return '👍'
}

function canApplyAutoReactionNow(
  botId: string,
  chatId: number,
  userId: number,
  cooldownSeconds: number
): boolean {
  const cooldownMs = Math.max(0, cooldownSeconds) * 1000
  if (cooldownMs <= 0) {
    return true
  }

  const key = `${botId}:${chatId}:${userId}`
  const now = Date.now()
  const lastAppliedAt = autoReactionCooldowns.get(key) || 0
  if (now - lastAppliedAt < cooldownMs) {
    return false
  }

  autoReactionCooldowns.set(key, now)
  return true
}

async function tryApplySystemAutoReaction(
  context: RuntimeContext,
  message: TelegramMessage | undefined,
  user: TelegramUser | null
): Promise<void> {
  if (!message || !message.chat?.id || !message.message_id || !user?.id) {
    return
  }

  const config = readAutoReactionsRuntimeConfig(context.metadata)
  if (!config?.enabled) {
    return
  }

  if (user.is_bot) {
    return
  }

  const botTelegramIdRaw = Number((context.metadata as Record<string, unknown> | undefined)?.telegramBotId)
  if (Number.isFinite(botTelegramIdRaw) && botTelegramIdRaw === user.id) {
    return
  }

  const reactionText = getIncomingMessageReactionText(message)
  if (config.onlyTextMessages && !reactionText) {
    return
  }

  if (!canApplyAutoReactionNow(context.botId, message.chat.id, user.id, config.cooldownSeconds)) {
    return
  }

  const emoji = selectRuleBasedReactionEmoji(message)

  try {
    await callTelegramApi(context.botToken, 'setMessageReaction', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reaction: [{ type: 'emoji', emoji }],
    })
  } catch (error) {
    const fallbackEmoji = emoji === '👍' ? null : '👍'
    if (fallbackEmoji) {
      try {
        await callTelegramApi(context.botToken, 'setMessageReaction', {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reaction: [{ type: 'emoji', emoji: fallbackEmoji }],
        })
        return
      } catch {
        // Fall through to warning log below.
      }
    }

    appendBotTestLog(
      context.botId,
      'telegram',
      `setMessageReaction error: ${String(error)}`,
      'warn'
    )
  }
}

function clearScheduledResumeTimer(sessionKey: string, session?: RuntimeSession) {
  const timer = runtimeSchedulerTimers.get(sessionKey)
  if (timer) {
    clearTimeout(timer)
    runtimeSchedulerTimers.delete(sessionKey)
  }

  if (session) {
    session.scheduledResumeAtMs = undefined
  }
}

function createSessionKey(botId: string, chatId: number, userId: number): string {
  return `${botId}:${chatId}:${userId}`
}

export function clearRuntimeSessionsForBot(botId: string) {
  const prefix = `${botId}:`
  for (const key of runtimeSessions.keys()) {
    if (key.startsWith(prefix)) {
      clearScheduledResumeTimer(key, runtimeSessions.get(key))
      runtimeSessions.delete(key)
    }
  }

  for (const key of scheduleTriggerDedupe.keys()) {
    if (key.startsWith(`${botId}:`)) {
      scheduleTriggerDedupe.delete(key)
    }
  }
}

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [key, session] of runtimeSessions.entries()) {
    if (session.scheduledResumeAtMs && session.scheduledResumeAtMs > now) {
      continue
    }
    if (now - session.updatedAt > SESSION_TTL_MS) {
      clearScheduledResumeTimer(key, session)
      runtimeSessions.delete(key)
    }
  }
}

function resetSessionState(session: RuntimeSession, sessionKey?: string) {
  if (sessionKey) {
    clearScheduledResumeTimer(sessionKey, session)
  } else {
    session.scheduledResumeAtMs = undefined
  }
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

function getNextNodeIdBySourceHandle(
  config: BotConfig,
  nodeId: string,
  sourceHandle: string
): string | null {
  if (!sourceHandle) return null
  const outgoingEdges = getOutgoingEdges(config, nodeId)
  const explicitEdge = outgoingEdges.find((edge) => edge.sourceHandle === sourceHandle)
  return explicitEdge?.target || null
}

function getRouterNextNodeId(
  config: BotConfig,
  nodeId: string,
  matchedCaseId?: string
): string | null {
  if (matchedCaseId) {
    const matchedTarget = getNextNodeIdBySourceHandle(config, nodeId, `case:${matchedCaseId}`)
    if (matchedTarget) {
      return matchedTarget
    }
  }

  const outgoingEdges = getOutgoingEdges(config, nodeId)
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

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  if (typeof value === 'number') return value === 1
  return false
}

function isHttpLikeMediaSource(value: string): boolean {
  return /^(https?:\/\/|tg:\/\/)/i.test(value)
}

function isLikelyLocalFilePath(value: string): boolean {
  if (!value) return false
  if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/') || value.startsWith('~/')) {
    return true
  }

  // Windows absolute path support (for generated/runtime compatibility)
  if (/^[a-zA-Z]:[\\/]/.test(value)) {
    return true
  }

  if (value.includes('/') || value.includes('\\')) {
    return true
  }

  return false
}

function resolveLocalFilePath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed

  if (trimmed.startsWith('~/')) {
    return resolvePathFs(homedir(), trimmed.slice(2))
  }

  if (isAbsolute(trimmed) || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return trimmed
  }

  return resolvePathFs(process.cwd(), trimmed)
}

function extractFirstHttpUrl(text: string): string | undefined {
  if (!text) return undefined

  // HTML mode: extract URL from href safely instead of raw markup text.
  const hrefMatch = text.match(/href=(['"])(https?:\/\/[^'"]+)\1/i)
  if (hrefMatch?.[2]) {
    return hrefMatch[2]
  }

  // Plain text / markdown: stop on common markup delimiters too.
  const match = text.match(/https?:\/\/[^\s)"'<>\]]+/i)
  return match?.[0]
}

function sanitizeUnsupportedHtmlAnchors(text: string): string {
  if (!text || !/<a\s/i.test(text)) {
    return text
  }

  return text.replace(
    /<a\b([^>]*?)\bhref=(['"])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (fullMatch, beforeHref, quote, rawHref, afterHref, label) => {
      const href = String(rawHref || '').trim()
      const normalizedHref = href.toLowerCase()

      const isSupported =
        normalizedHref.startsWith('http://') ||
        normalizedHref.startsWith('https://') ||
        normalizedHref.startsWith('tg://')

      if (isSupported) {
        return `<a${String(beforeHref || '')}href=${String(quote || '"')}${href}${String(quote || '"')}${String(afterHref || '')}>${String(label || '')}</a>`
      }

      // Telegram parse mode may reject unsupported protocols like tel:/mailto:.
      // Keep visible label instead of failing the whole message.
      return String(label || '')
    }
  )
}

function escapeMarkdownV2Text(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

function escapeMarkdownV2PreservingFormatting(text: string): string {
  if (!text) return text

  const placeholders: string[] = []
  const reserve = (value: string) => {
    // Use a token without MarkdownV2 special characters so it survives escaping
    // and can be restored after escaping the remaining plain text.
    const token = `@@TFLOWMD2TOKEN${placeholders.length}@@`
    placeholders.push(value)
    return token
  }

  // Preserve common MarkdownV2 formatting blocks (basic non-nested fallback).
  let prepared = text
    .replace(/\|\|([\s\S]+?)\|\|/g, (match) => reserve(match))
    .replace(/__([\s\S]+?)__/g, (match) => reserve(match))
    .replace(/\*([\s\S]+?)\*/g, (match) => reserve(match))
    .replace(/_([\s\S]+?)_/g, (match) => reserve(match))
    .replace(/~([\s\S]+?)~/g, (match) => reserve(match))
    .replace(/`([\s\S]+?)`/g, (match) => reserve(match))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => reserve(match))

  prepared = escapeMarkdownV2Text(prepared)

  return prepared.replace(/@@TFLOWMD2TOKEN(\d+)@@/g, (_, rawIndex) => {
    const index = Number(rawIndex)
    return placeholders[index] ?? ''
  })
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

function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    // Throws RangeError for invalid zone.
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function parseDateTimeLocalString(value: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} | null {
  const match =
    value.trim().match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/
    )
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] || 0)

  if (
    !Number.isFinite(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null
  }

  return { year, month, day, hour, minute, second }
}

function getZonedDateTimeParts(
  timestampMs: number,
  timeZone: string
): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const parts = formatter.formatToParts(new Date(timestampMs))
    const values: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value
    }

    const year = Number(values.year)
    const month = Number(values.month)
    const day = Number(values.day)
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    const second = Number(values.second)
    if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) {
      return null
    }

    return { year, month, day, hour, minute, second }
  } catch {
    return null
  }
}

function getTimeZoneOffsetMs(timestampMs: number, timeZone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const parts = formatter.formatToParts(new Date(timestampMs))
    const values: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value
      }
    }

    const year = Number(values.year)
    const month = Number(values.month)
    const day = Number(values.day)
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    const second = Number(values.second)
    if ([year, month, day, hour, minute, second].some((value) => !Number.isFinite(value))) {
      return null
    }

    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
    return asUtc - timestampMs
  } catch {
    return null
  }
}

function zonedDateTimeLocalToUtcMs(dateTimeLocal: string, timeZone: string): number | null {
  const parsed = parseDateTimeLocalString(dateTimeLocal)
  if (!parsed) return null
  if (!isValidIanaTimeZone(timeZone)) return null

  const utcGuess = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second
  )

  let timestamp = utcGuess
  for (let i = 0; i < 4; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(timestamp, timeZone)
    if (offsetMs == null) {
      return null
    }
    const nextTimestamp = utcGuess - offsetMs
    if (nextTimestamp === timestamp) {
      timestamp = nextTimestamp
      break
    }
    timestamp = nextTimestamp
  }

  // Validate exact round-trip to avoid DST gap/invalid local time ambiguity.
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const parts = formatter.formatToParts(new Date(timestamp))
    const values: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value
    }
    const same =
      Number(values.year) === parsed.year &&
      Number(values.month) === parsed.month &&
      Number(values.day) === parsed.day &&
      Number(values.hour) === parsed.hour &&
      Number(values.minute) === parsed.minute &&
      Number(values.second) === parsed.second
    return same ? timestamp : null
  } catch {
    return null
  }
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

function normalizeInlineButtonActionType(value: unknown): 'callback' | 'url' | 'stars' {
  const normalized = normalizeText(value).toLowerCase()
  if (normalized === 'url' || normalized === 'link') return 'url'
  if (normalized === 'stars' || normalized === 'starspay' || normalized === 'stars_pay') {
    return 'stars'
  }
  return 'callback'
}

function buildInlineKeyboardMarkup(
  keyboard: unknown,
  templateVariables?: Record<string, unknown>
): InlineKeyboardMarkup | undefined {
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
      const rawText =
        normalizeText(buttonRecord.text) ||
        normalizeText(buttonRecord.label) ||
        normalizeText(buttonRecord.title)
      const text = templateVariables
        ? interpolateTemplate(rawText, templateVariables).trim()
        : rawText
      if (!text) continue

      const callbackDataRawBase =
        normalizeText(buttonRecord.callbackData) ||
        normalizeText(buttonRecord.callback_data) ||
        normalizeText(buttonRecord.data) ||
        normalizeText(buttonRecord.action) ||
        normalizeText(buttonRecord.value)
      const callbackDataRaw = templateVariables
        ? interpolateTemplate(callbackDataRawBase, templateVariables).trim()
        : callbackDataRawBase
      const actionTypeRaw = normalizeText(
        buttonRecord.actionType ?? buttonRecord.kind ?? buttonRecord.type
      )
      const actionType = normalizeInlineButtonActionType(actionTypeRaw)
      const isStarsPayButton = actionType === 'stars' || normalizeBoolean(buttonRecord.payStars)
      const rawUrl =
        normalizeText(buttonRecord.url) ||
        (isStarsPayButton
          ? normalizeText(buttonRecord.starsUrl || buttonRecord.paymentUrl || buttonRecord.payment_url)
          : '')
      const url = templateVariables
        ? interpolateTemplate(rawUrl, templateVariables).trim()
        : rawUrl

      const shouldUseUrlButton =
        isStarsPayButton ||
        actionType === 'url' ||
        (!actionTypeRaw && rawUrl.length > 0)

      if (shouldUseUrlButton && url && isSupportedButtonUrl(url)) {
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
  let rawValue: unknown = value

  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    const record = rawValue as Record<string, unknown>
    if (typeof record.value === 'string') {
      rawValue = record.value
    } else if (typeof record.mode === 'string') {
      rawValue = record.mode
    } else if (typeof record.parseMode === 'string') {
      rawValue = record.parseMode
    }
  }

  if (typeof rawValue !== 'string') {
    return undefined
  }

  const normalized = rawValue.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!normalized || normalized === 'none' || normalized === 'plain' || normalized === 'off') {
    return undefined
  }

  if (normalized === 'markdown' || normalized === 'md') {
    return 'Markdown'
  }

  if (normalized === 'markdownv2' || normalized === 'markdown2' || normalized === 'mdv2') {
    return 'MarkdownV2'
  }

  if (normalized === 'html') {
    return 'HTML'
  }

  return undefined
}

function resolveNodeParseMode(data: Record<string, unknown>): 'Markdown' | 'MarkdownV2' | 'HTML' | undefined {
  const directCandidates: unknown[] = [
    data.parseMode,
    data.parse_mode,
    data.formatting,
    data.format,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeParseMode(candidate)
    if (normalized) {
      return normalized
    }
  }

  const nestedCandidates = [
    data.formatting,
    data.messageFormatting,
    data.options,
    data.settings,
  ]

  for (const candidate of nestedCandidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue
    }

    const record = candidate as Record<string, unknown>
    const normalized =
      normalizeParseMode(record.parseMode) ||
      normalizeParseMode(record.parse_mode) ||
      normalizeParseMode(record.mode) ||
      normalizeParseMode(record.value)

    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function normalizeMediaAttachmentType(value: unknown): SupportedMediaAttachmentType | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'photo' ||
    normalized === 'video' ||
    normalized === 'document' ||
    normalized === 'audio'
  ) {
    return normalized
  }
  return undefined
}

function resolveMessageAttachment(data: Record<string, unknown>): ResolvedMessageAttachment | undefined {
  const attachments = Array.isArray(data.attachments) ? data.attachments : []

  for (const rawAttachment of attachments) {
    if (!rawAttachment || typeof rawAttachment !== 'object') {
      continue
    }

    const record = rawAttachment as Record<string, unknown>
    const type = normalizeMediaAttachmentType(
      record.type ?? record.kind ?? record.mediaType ?? record.media_type
    )
    if (!type) {
      continue
    }

    const sourceCandidate =
      record.source ??
      record.url ??
      record.media ??
      record.fileId ??
      record.file_id ??
      record.value
    const source = normalizeText(sourceCandidate)
    if (!source) {
      continue
    }

    return { type, source }
  }

  const fallbackType = normalizeMediaAttachmentType(data.attachmentType ?? data.mediaType)
  const fallbackSource = normalizeText(
    data.attachmentSource ?? data.attachmentUrl ?? data.mediaSource ?? data.media
  )

  if (fallbackType && fallbackSource) {
    return { type: fallbackType, source: fallbackSource }
  }

  return undefined
}

function evaluateConditionValue(operator: string, left: unknown, right: unknown): boolean {
  if (operator === 'isEmpty') {
    if (left === undefined || left === null) return true
    if (typeof left === 'string') return left.trim().length === 0
    if (Array.isArray(left)) return left.length === 0
    return false
  }

  if (operator === 'isNotEmpty') {
    return !evaluateConditionValue('isEmpty', left, right)
  }

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
    case 'gte':
      return Number(left) >= Number(right)
    case 'lte':
      return Number(left) <= Number(right)
    default:
      return String(left ?? '') === String(right ?? '')
  }
}

function normalizeRouterCases(
  rawCases: unknown
): Array<{ id: string; label?: string; value: unknown }> {
  if (!Array.isArray(rawCases)) {
    return []
  }

  const normalized: Array<{ id: string; label?: string; value: unknown }> = []

  for (const item of rawCases) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = normalizeText(record.id)
    if (!id) continue

    const label = normalizeText(record.label)
    normalized.push({
      id,
      label: label || undefined,
      value: record.value,
    })
  }

  return normalized
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
      if (!pattern) {
        if (Boolean(data.aiEnabled) && messageText) return trigger
        continue
      }
      if (messageText.toLowerCase().includes(pattern.toLowerCase())) return trigger
      continue
    }

    if (triggerType === 'callbackQuery') continue
    if (triggerType === 'schedule') continue

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

function parseScheduleTime(value: string): { hour: number; minute: number } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }
  return { hour, minute }
}

function getScheduleTriggerBucketKey(
  botId: string,
  triggerNode: BotNode,
  nowMs: number
): string | null {
  const data = (triggerNode.data || {}) as Record<string, unknown>
  const triggerType = String(data.trigger || '')
  if (triggerType !== 'schedule') return null

  const timeZone = normalizeText(data.timeZone || 'UTC') || 'UTC'
  if (!isValidIanaTimeZone(timeZone)) return null

  const local = getZonedDateTimeParts(nowMs, timeZone)
  if (!local) return null

  const scheduleMode = normalizeText(data.scheduleMode || 'daily').toLowerCase()

  if (scheduleMode === 'hourly') {
    const everyHours = Math.min(24, Math.max(1, Number(data.everyHours || 1) || 1))
    const atMinute = Math.min(59, Math.max(0, Number(data.atMinute || 0) || 0))
    if (local.minute !== atMinute) return null
    if (local.hour % everyHours !== 0) return null
    return `${botId}:${triggerNode.id}:hourly:${timeZone}:${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`
  }

  const parsedTime = parseScheduleTime(normalizeText(data.atTime || '10:00') || '10:00')
  if (!parsedTime) return null
  if (local.hour !== parsedTime.hour || local.minute !== parsedTime.minute) return null

  return `${botId}:${triggerNode.id}:daily:${timeZone}:${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`
}

export async function handleScheduledWorkflowTriggersTick(args: {
  botId: string
  botToken: string
  config: BotConfig
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  const { botId, botToken, config, metadata } = args
  const nowMs = Date.now()

  const scheduleTriggers = config.nodes.filter((node) => {
    if (node.type !== 'trigger') return false
    const data = (node.data || {}) as Record<string, unknown>
    return String(data.trigger || '') === 'schedule'
  })

  if (scheduleTriggers.length === 0) {
    return
  }

  for (const triggerNode of scheduleTriggers) {
    const bucketKey = getScheduleTriggerBucketKey(botId, triggerNode, nowMs)
    if (!bucketKey) continue

    const dedupeKey = `${botId}:${triggerNode.id}`
    if (scheduleTriggerDedupe.get(dedupeKey) === bucketKey) {
      continue
    }

    const data = (triggerNode.data || {}) as Record<string, unknown>
    const chatIdRaw = normalizeText(data.targetChatId)
    const userIdRaw = normalizeText(data.targetUserId)
    const chatId = Number(chatIdRaw)
    const userId = Number(userIdRaw || 0)

    if (!chatIdRaw || !Number.isFinite(chatId)) {
      appendBotTestLog(
        botId,
        'workflow',
        `Schedule Trigger skipped (${triggerNode.id}): targetChatId is missing/invalid`,
        'warn'
      )
      scheduleTriggerDedupe.set(dedupeKey, bucketKey)
      continue
    }

    scheduleTriggerDedupe.set(dedupeKey, bucketKey)

    const sessionUserId = Number.isFinite(userId) && userId > 0 ? userId : 0
    const sessionKey = createSessionKey(botId, chatId, sessionUserId)
    const session = getOrCreateSession(sessionKey)
    const nextNodeId = getDefaultNextNodeId(config, triggerNode.id)

    if (!nextNodeId) {
      appendBotTestLog(botId, 'workflow', `Schedule Trigger ${triggerNode.id}: no next node`, 'warn')
      continue
    }

    resetSessionState(session, sessionKey)
    session.variables.schedule = {
      triggeredAt: new Date(nowMs).toISOString(),
      bucket: bucketKey,
      mode: String(data.scheduleMode || 'daily'),
      timeZone: String(data.timeZone || 'UTC') || 'UTC',
    }

    appendBotTestLog(
      botId,
      'workflow',
      `Schedule Trigger fired: ${triggerNode.id} -> chat ${chatId} (${new Date(nowMs).toISOString()})`,
      'info'
    )

    const syntheticUpdate: TelegramUpdate = { update_id: 0 }
    const syntheticUser: TelegramUser | null =
      Number.isFinite(userId) && userId > 0
        ? { id: userId }
        : null

    try {
      const runState = await executeFromNode({
        startNodeId: nextNodeId,
        botId,
        botToken,
        chatId,
        config,
        metadata,
        session,
        sessionKey,
        update: syntheticUpdate,
        user: syntheticUser,
      })

      if (runState === 'completed' && !session.waitingForNodeId) {
        resetSessionState(session, sessionKey)
      }
    } catch (error) {
      appendBotTestLog(
        botId,
        'workflow',
        `Schedule Trigger runtime error (${triggerNode.id}): ${String(error)}`,
        'error'
      )
    }
  }
}

async function appendOutboundCrmEventSafe(input: {
  botId: string
  telegramUserId?: number | null
  telegramChatId?: number | null
  eventKind: 'message_text' | 'media' | 'service'
  messageText?: string
  payload?: Record<string, unknown>
}) {
  const telegramUserId = Number(input.telegramUserId)
  if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
    return
  }
  if (!hasCrmIngestionConfig()) {
    return
  }

  try {
    const supabase = createAdminClient()
    await appendOutboundContactEvent(
      supabase as unknown as Parameters<typeof appendOutboundContactEvent>[0],
      {
        botId: input.botId,
        telegramUserId,
        telegramChatId: Number.isFinite(Number(input.telegramChatId))
          ? Number(input.telegramChatId)
          : null,
        eventKind: input.eventKind,
        messageText: input.messageText,
        payload: input.payload,
      }
    )
  } catch (error) {
    appendBotTestLog(input.botId, 'workflow', `CRM outbound log failed: ${String(error)}`, 'warn')
  }
}

async function appendPaymentAuditEventSafe(input: {
  botId: string
  nodeId: string
  provider: string
  paymentId: string
  status: string
  amount: string
  currency: string
  chatId: number
  telegramUserId?: number | null
  username?: string
  firstName?: string
  lastName?: string
}) {
  try {
    const supabase = createAdminClient()
    await appendBotAuditEventSafe(
      supabase as unknown as Parameters<typeof appendBotAuditEventSafe>[0],
      {
        botId: input.botId,
        source: 'runtime',
        eventType: 'payment.created',
        payload: {
          nodeId: input.nodeId,
          provider: input.provider,
          method: input.provider,
          paymentId: input.paymentId,
          status: input.status,
          amount: input.amount,
          currency: input.currency,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId || null,
          username: input.username || '',
          firstName: input.firstName || '',
          lastName: input.lastName || '',
        },
      }
    )
  } catch (error) {
    appendBotTestLog(input.botId, 'workflow', `Payment audit write failed: ${String(error)}`, 'warn')
  }
}

async function sendMessage(
  token: string,
  botId: string,
  chatId: number,
  text: string,
  parseMode?: unknown,
  keyboard?: unknown,
  systemReplyMarkup?: AnyReplyMarkup,
  options?: {
    forceReply?: boolean
    inputPlaceholder?: string
    disableWebPagePreview?: boolean
    disableNotification?: boolean
  },
  telegramUserId?: number | null,
  templateVariables?: Record<string, unknown>
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: text || '...',
  }

  const normalizedParseMode = normalizeParseMode(parseMode)
  if (normalizedParseMode) {
    payload.parse_mode = normalizedParseMode
  }

  if (typeof options?.disableWebPagePreview === 'boolean') {
    const shouldDisablePreview = options.disableWebPagePreview
    if (shouldDisablePreview) {
      // Legacy and current API fields together for best compatibility.
      payload.disable_web_page_preview = true
      payload.link_preview_options = { is_disabled: true }
    } else {
      const detectedUrl = extractFirstHttpUrl(text)
      payload.link_preview_options = detectedUrl
        ? { is_disabled: false, url: detectedUrl }
        : { is_disabled: false }
    }
  }

  if (options?.disableNotification) {
    payload.disable_notification = true
  }

  if (options?.forceReply) {
    const forceReply: ForceReplyMarkup = { force_reply: true }
    const inputPlaceholder = normalizeText(options.inputPlaceholder)
    if (inputPlaceholder) {
      forceReply.input_field_placeholder = inputPlaceholder.slice(0, 64)
    }
    payload.reply_markup = forceReply
  } else {
    const inlineReplyMarkup = buildInlineKeyboardMarkup(keyboard, templateVariables)
    if (inlineReplyMarkup) {
      payload.reply_markup = inlineReplyMarkup
    } else if (systemReplyMarkup) {
      payload.reply_markup = systemReplyMarkup
    }
  }

  const trackSuccess = async (actualText?: string) => {
    await appendOutboundCrmEventSafe({
      botId,
      telegramUserId,
      telegramChatId: chatId,
      eventKind: 'message_text',
      messageText: typeof actualText === 'string' ? actualText : text,
      payload: {
        parseMode: normalizedParseMode || null,
        hasReplyMarkup: Boolean(payload.reply_markup),
        forceReply: Boolean(options?.forceReply),
        disableNotification: Boolean(options?.disableNotification),
      },
    })
  }

  try {
    await callTelegramApi(token, 'sendMessage', payload)
    appendBotTestLog(
      botId,
      'telegram',
      `sendMessage ok (${normalizedParseMode || 'plain'}): ${String(text || '').replace(/\s+/g, ' ').slice(0, 140)}`
    )
    await trackSuccess(typeof payload.text === 'string' ? payload.text : text)
  } catch (error) {
    appendBotTestLog(botId, 'telegram', `sendMessage error: ${String(error)}`, 'error')
    if (normalizedParseMode === 'MarkdownV2' && typeof payload.text === 'string') {
      const escapedText = escapeMarkdownV2PreservingFormatting(payload.text)
      if (escapedText !== payload.text) {
        try {
          const retryPayload: Record<string, unknown> = {
            ...payload,
            text: escapedText,
          }

          // MarkdownV2 fallback often escapes URL punctuation, which can break
          // link_preview_options.url validation in Telegram. Disable preview on retry
          // to maximize delivery reliability.
          retryPayload.disable_web_page_preview = true
          retryPayload.link_preview_options = { is_disabled: true }

          await callTelegramApi(token, 'sendMessage', retryPayload)
          appendBotTestLog(botId, 'telegram', 'sendMessage retry ok (MarkdownV2 escaped)', 'warn')
          await trackSuccess(typeof retryPayload.text === 'string' ? retryPayload.text : text)
          return
        } catch {
          // Last resort: send plain text without parse mode so the bot still responds.
          try {
            const plainPayload: Record<string, unknown> = {
              ...payload,
              text: payload.text,
            }
            delete plainPayload.parse_mode
            plainPayload.disable_web_page_preview = true
            plainPayload.link_preview_options = { is_disabled: true }

            await callTelegramApi(token, 'sendMessage', plainPayload)
            appendBotTestLog(botId, 'telegram', 'sendMessage fallback ok (plain text)', 'warn')
            await trackSuccess(typeof plainPayload.text === 'string' ? plainPayload.text : text)
            return
          } catch {
            // continue to HTML fallback / original error
          }
        }
      }
    }

    if (normalizedParseMode === 'HTML' && typeof payload.text === 'string') {
      const sanitizedText = sanitizeUnsupportedHtmlAnchors(payload.text)
      if (sanitizedText !== payload.text) {
        try {
          const retryPayload: Record<string, unknown> = {
            ...payload,
            text: sanitizedText,
          }

          const retryPreview = retryPayload.link_preview_options as
            | { is_disabled?: boolean; url?: string }
            | undefined
          if (retryPreview && retryPreview.is_disabled !== true) {
            const detectedUrl = extractFirstHttpUrl(sanitizedText)
            retryPayload.link_preview_options = detectedUrl
              ? { is_disabled: false, url: detectedUrl }
              : { is_disabled: false }
          }

          await callTelegramApi(token, 'sendMessage', {
            ...retryPayload,
          })
          appendBotTestLog(botId, 'telegram', 'sendMessage retry ok (HTML sanitized)', 'warn')
          await trackSuccess(typeof retryPayload.text === 'string' ? retryPayload.text : text)
          return
        } catch {
          // fall through to original error below
        }
      }
    }

    throw error
  }
}

async function sendMediaMessage(
  token: string,
  botId: string,
  chatId: number,
  attachment: ResolvedMessageAttachment,
  caption: string,
  parseMode?: unknown,
  keyboard?: unknown,
  systemReplyMarkup?: AnyReplyMarkup,
  options?: {
    disableNotification?: boolean
  },
  telegramUserId?: number | null,
  templateVariables?: Record<string, unknown>
): Promise<void> {
  const methodMap: Record<SupportedMediaAttachmentType, { apiMethod: string; payloadField: string }> = {
    photo: { apiMethod: 'sendPhoto', payloadField: 'photo' },
    video: { apiMethod: 'sendVideo', payloadField: 'video' },
    document: { apiMethod: 'sendDocument', payloadField: 'document' },
    audio: { apiMethod: 'sendAudio', payloadField: 'audio' },
  }

  const mapped = methodMap[attachment.type]
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    [mapped.payloadField]: attachment.source,
  }
  const localFilePath =
    !isHttpLikeMediaSource(attachment.source) && isLikelyLocalFilePath(attachment.source)
      ? resolveLocalFilePath(attachment.source)
      : null
  let localFileBuffer: Buffer | null = null
  const localFileName = localFilePath ? basename(localFilePath) || `${attachment.type}.bin` : null

  const normalizedCaption = String(caption || '').trim()
  const normalizedParseMode = normalizeParseMode(parseMode)

  if (normalizedCaption) {
    payload.caption = normalizedCaption
    if (normalizedParseMode) {
      payload.parse_mode = normalizedParseMode
    }
  }

  if (options?.disableNotification) {
    payload.disable_notification = true
  }

  const inlineReplyMarkup = buildInlineKeyboardMarkup(keyboard, templateVariables)
  if (inlineReplyMarkup) {
    payload.reply_markup = inlineReplyMarkup
  } else if (systemReplyMarkup) {
    payload.reply_markup = systemReplyMarkup
  }

  const ensureLocalFileBuffer = async () => {
    if (!localFilePath) return null
    if (localFileBuffer) return localFileBuffer
    try {
      localFileBuffer = await readFile(localFilePath)
      return localFileBuffer
    } catch (error) {
      throw new Error(`Не удалось прочитать локальный файл: ${localFilePath} (${String(error)})`)
    }
  }

  const sendPayload = async (currentPayload: Record<string, unknown>) => {
    if (!localFilePath) {
      await callTelegramApi(token, mapped.apiMethod, currentPayload)
      return
    }

    const fileBuffer = await ensureLocalFileBuffer()
    const fileArrayBuffer =
      fileBuffer && fileBuffer.byteLength > 0
        ? (fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength
          ) as ArrayBuffer)
        : new ArrayBuffer(0)
    const formData = new FormData()

    for (const [key, value] of Object.entries(currentPayload)) {
      if (value === undefined || value === null) {
        continue
      }

      if (key === mapped.payloadField) {
        continue
      }

      if (key === 'reply_markup' && typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
        continue
      }

      formData.append(key, String(value))
    }

    formData.append(
      mapped.payloadField,
      new Blob([fileArrayBuffer]),
      localFileName || `${attachment.type}.bin`
    )

    await callTelegramApiFormData(token, mapped.apiMethod, formData)
  }

  const trackSuccess = async (actualCaption?: string) => {
    await appendOutboundCrmEventSafe({
      botId,
      telegramUserId,
      telegramChatId: chatId,
      eventKind: 'media',
      messageText: actualCaption ?? normalizedCaption,
      payload: {
        apiMethod: mapped.apiMethod,
        mediaType: attachment.type,
        parseMode: normalizedParseMode || null,
        hasReplyMarkup: Boolean(payload.reply_markup),
        disableNotification: Boolean(options?.disableNotification),
      },
    })
  }

  try {
    await sendPayload(payload)
    appendBotTestLog(
      botId,
      'telegram',
      `${mapped.apiMethod} ok (${normalizedParseMode || 'plain'}): ${attachment.source.slice(0, 96)}${normalizedCaption ? ` | ${normalizedCaption.replace(/\s+/g, ' ').slice(0, 80)}` : ''}`
    )
    await trackSuccess(typeof payload.caption === 'string' ? payload.caption : normalizedCaption)
  } catch (error) {
    appendBotTestLog(botId, 'telegram', `${mapped.apiMethod} error: ${String(error)}`, 'error')

    if (normalizedParseMode === 'MarkdownV2' && typeof payload.caption === 'string') {
      const escapedCaption = escapeMarkdownV2PreservingFormatting(payload.caption)
      if (escapedCaption !== payload.caption) {
        try {
          const retryPayload: Record<string, unknown> = {
            ...payload,
            caption: escapedCaption,
          }

          await sendPayload(retryPayload)
          appendBotTestLog(botId, 'telegram', `${mapped.apiMethod} retry ok (MarkdownV2 escaped)`, 'warn')
          await trackSuccess(typeof retryPayload.caption === 'string' ? retryPayload.caption : normalizedCaption)
          return
        } catch {
          try {
            const plainPayload: Record<string, unknown> = {
              ...payload,
            }
            delete plainPayload.parse_mode
            await sendPayload(plainPayload)
            appendBotTestLog(botId, 'telegram', `${mapped.apiMethod} fallback ok (plain caption)`, 'warn')
            await trackSuccess(typeof plainPayload.caption === 'string' ? plainPayload.caption : normalizedCaption)
            return
          } catch {
            // continue to HTML fallback / original error
          }
        }
      }
    }

    if (normalizedParseMode === 'HTML' && typeof payload.caption === 'string') {
      const sanitizedCaption = sanitizeUnsupportedHtmlAnchors(payload.caption)
      if (sanitizedCaption !== payload.caption) {
        try {
          const retryPayload: Record<string, unknown> = {
            ...payload,
            caption: sanitizedCaption,
          }
          await sendPayload(retryPayload)
          appendBotTestLog(botId, 'telegram', `${mapped.apiMethod} retry ok (HTML sanitized)`, 'warn')
          await trackSuccess(typeof retryPayload.caption === 'string' ? retryPayload.caption : normalizedCaption)
          return
        } catch {
          // fall through
        }
      }
    }

    throw error
  }
}

async function executeActionNode(
  node: BotNode,
  session: RuntimeSession,
  contextVariables: Record<string, unknown>,
  update: TelegramUpdate,
  botToken: string,
  botId?: string
): Promise<string | null> {
  const data = (node.data || {}) as Record<string, unknown>
  const actionRaw = data.action

  if (!actionRaw || typeof actionRaw !== 'object') return null

  const action = actionRaw as Record<string, unknown>
  const actionType = String(action.type || '')

  if (actionType === 'setVariable') {
    const variableName = normalizeText(action.variableName)
    if (!variableName) return null

    const rawValue = action.value
    const value =
      typeof rawValue === 'string'
        ? interpolateTemplate(rawValue, contextVariables)
        : rawValue

    session.variables[variableName] = value
    return null
  }

  if (actionType === 'delay') {
    const delayMs = Math.min(Math.max(Number(action.duration || 1000), 0), 10000)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return null
  }

  if (actionType === 'deleteMessage') {
    const messageId = update.message?.message_id || update.callback_query?.message?.message_id
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id
    if (!messageId || !chatId) return null

    try {
      await callTelegramApi(botToken, 'deleteMessage', {
        chat_id: chatId,
        message_id: messageId,
      })
    } catch {
      // ignore non-critical delete errors
    }
    return null
  }

  if (actionType === 'random') {
    const rawPercent = Number(action.aPercent ?? action.percent ?? 50)
    const aPercent = Number.isFinite(rawPercent)
      ? Math.min(100, Math.max(0, rawPercent))
      : 50
    const roll = Math.random() * 100
    const selectedHandle = roll < aPercent ? 'a' : 'b'

    const saveToVariable = normalizeText(action.saveToVariable)
    if (saveToVariable) {
      session.variables[saveToVariable] = selectedHandle.toUpperCase()
    }

    if (botId) {
      appendBotTestLog(
        botId,
        'workflow',
        `Action random -> ${node.id} ${selectedHandle.toUpperCase()} (roll=${roll.toFixed(1)}, A=${aPercent}%)`,
        'info'
      )
    }

    return selectedHandle
  }

  // Legacy compatibility: old flows may still have HTTP inside Action node.
  if (actionType === 'httpRequest') {
    await executeHttpRequestData(action, session, contextVariables)
  }

  return null
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

type PaymentProvider = 'yookassa' | 'stripe' | 'robokassa' | 'telegram_stars'

type PaymentNodeExecutionResult = {
  provider: PaymentProvider
  paymentId: string
  status: string
  url: string
  amount: string
  currency: string
  invoiceId?: string
  raw?: Record<string, unknown> | null
}

function safeParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeMoneyAmount(value: unknown, fallback = '100.00'): string {
  const raw = String(value ?? '').trim().replace(',', '.')
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback
  }
  return amount.toFixed(2)
}

function normalizeStarsAmount(value: unknown, fallback = 1): number {
  const raw = String(value ?? '').trim().replace(',', '.')
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.max(1, Math.round(parsed))
}

function toMinorUnits(amount: string): number {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100
  }
  return Math.max(1, Math.round(parsed * 100))
}

function normalizeCurrencyCode(
  value: unknown,
  fallback: string,
  mode: 'upper' | 'lower' = 'upper'
): string {
  const raw = String(value ?? '').trim()
  const match = raw.match(/[a-zA-Z]{3}/)
  const base = (match?.[0] || fallback).slice(0, 3)
  return mode === 'lower' ? base.toLowerCase() : base.toUpperCase()
}

function resolvePaymentTextField(
  source: unknown,
  contextVariables: Record<string, unknown>
): string {
  return interpolateTemplate(String(source ?? ''), contextVariables).trim()
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizeAbsoluteHttpUrl(value: string): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return trimTrailingSlash(parsed.toString())
  } catch {
    return null
  }
}

function resolveRuntimeBaseUrlForPayments(): string | null {
  const fromEnv =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL

  const normalizedEnvUrl = normalizeAbsoluteHttpUrl(fromEnv || '')
  if (normalizedEnvUrl) {
    return normalizedEnvUrl
  }

  if (process.env.VERCEL_URL) {
    const vercelUrl = normalizeAbsoluteHttpUrl(process.env.VERCEL_URL)
    if (vercelUrl) return vercelUrl
  }

  return null
}

function resolvePreferredLocaleFromContext(contextVariables: Record<string, unknown>): 'ru' | 'en' {
  const languageCode = String(resolvePath(contextVariables, 'user.languageCode') || '')
    .trim()
    .toLowerCase()
  return languageCode.startsWith('en') ? 'en' : 'ru'
}

function resolveYookassaReturnUrl(args: {
  configuredReturnUrl: string
  contextVariables: Record<string, unknown>
  botId: string
}): string {
  const configured = normalizeAbsoluteHttpUrl(args.configuredReturnUrl)
  if (configured) {
    return configured
  }

  const baseUrl = resolveRuntimeBaseUrlForPayments()
  if (baseUrl) {
    const locale = resolvePreferredLocaleFromContext(args.contextVariables)
    const botId = encodeURIComponent(String(args.botId || '').trim())
    const query = botId ? `?botId=${botId}` : ''
    return `${baseUrl}/${locale}/payment/return${query}`
  }

  return 'https://t.me'
}

function resolveStripeReturnUrl(args: {
  configuredUrl: string
  contextVariables: Record<string, unknown>
  botId: string
  state: 'success' | 'cancel'
}): string {
  const configured = normalizeAbsoluteHttpUrl(args.configuredUrl)
  if (configured) {
    return configured
  }

  const baseUrl = resolveRuntimeBaseUrlForPayments()
  if (baseUrl) {
    const locale = resolvePreferredLocaleFromContext(args.contextVariables)
    const params = new URLSearchParams()
    const botId = String(args.botId || '').trim()
    if (botId) {
      params.set('botId', botId)
    }
    params.set('provider', 'stripe')
    params.set('state', args.state)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return `${baseUrl}/${locale}/payment/return${query}`
  }

  return 'https://t.me'
}

function resolveRobokassaReturnUrl(args: {
  configuredUrl: string
  contextVariables: Record<string, unknown>
  botId: string
  state: 'success' | 'fail'
}): string {
  const configured = normalizeAbsoluteHttpUrl(args.configuredUrl)
  if (configured) {
    return configured
  }

  const baseUrl = resolveRuntimeBaseUrlForPayments()
  if (baseUrl) {
    const locale = resolvePreferredLocaleFromContext(args.contextVariables)
    const params = new URLSearchParams()
    const botId = String(args.botId || '').trim()
    if (botId) {
      params.set('botId', botId)
    }
    params.set('provider', 'robokassa')
    params.set('state', args.state)
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return `${baseUrl}/${locale}/payment/return${query}`
  }

  return 'https://t.me'
}

async function createYookassaPayment(input: {
  data: Record<string, unknown>
  contextVariables: Record<string, unknown>
  botId: string
}): Promise<PaymentNodeExecutionResult> {
  const { data, contextVariables, botId } = input
  const shopId = resolvePaymentTextField(data.shopId, contextVariables).replace(/\s+/g, '')
  const secretKey = resolvePaymentTextField(data.secretKey, contextVariables).replace(/\s+/g, '')
  const returnUrl = resolveYookassaReturnUrl({
    configuredReturnUrl: resolvePaymentTextField(data.returnUrl, contextVariables),
    contextVariables,
    botId,
  })
  const description = resolvePaymentTextField(data.description, contextVariables)
  const amount = normalizeMoneyAmount(resolvePaymentTextField(data.amount, contextVariables), '100.00')
  const currency = normalizeCurrencyCode(
    resolvePaymentTextField(data.currency || 'RUB', contextVariables),
    'RUB',
    'upper'
  )
  const capture = data.capture !== false

  if (!shopId || !secretKey) {
    throw new Error('YooKassa: shopId или secretKey не заполнены')
  }

  const payload = {
    amount: {
      value: amount,
      currency,
    },
    capture,
    confirmation: {
      type: 'redirect',
      return_url: returnUrl,
    },
    ...(description ? { description } : {}),
  }

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Idempotence-Key': randomUUID(),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const responseText = await response.text()
  const body = safeParseJsonObject(responseText)

  if (!response.ok) {
    const errorCode = normalizeText(body?.code).toLowerCase()
    const errorDescription = normalizeText(body?.description)

    if (response.status === 401 || errorCode === 'invalid_credentials') {
      throw new Error(
        'YooKassa: неверные shopId/secretKey. Проверьте API-ключ в кабинете YooKassa и вставьте значения без пробелов/переносов.'
      )
    }

    if (errorCode || errorDescription) {
      throw new Error(
        `YooKassa ${response.status}: ${errorCode || 'request_failed'}${errorDescription ? ` (${errorDescription})` : ''}`
      )
    }

    throw new Error(`YooKassa HTTP ${response.status}: ${responseText.slice(0, 260)}`)
  }

  const confirmation = body?.confirmation && typeof body.confirmation === 'object'
    ? (body.confirmation as Record<string, unknown>)
    : null
  const url = normalizeText(confirmation?.confirmation_url)
  if (!url) {
    throw new Error('YooKassa: confirmation_url отсутствует в ответе')
  }

  return {
    provider: 'yookassa',
    paymentId: normalizeText(body?.id) || 'unknown',
    status: normalizeText(body?.status) || 'pending',
    url,
    amount,
    currency,
    raw: body,
  }
}

async function createStripePayment(input: {
  data: Record<string, unknown>
  contextVariables: Record<string, unknown>
  botId: string
}): Promise<PaymentNodeExecutionResult> {
  const { data, contextVariables, botId } = input
  const secretKey = resolvePaymentTextField(data.secretKey, contextVariables)
  const successUrl = resolveStripeReturnUrl({
    configuredUrl: resolvePaymentTextField(data.successUrl, contextVariables),
    contextVariables,
    botId,
    state: 'success',
  })
  const cancelUrl = resolveStripeReturnUrl({
    configuredUrl: resolvePaymentTextField(data.cancelUrl, contextVariables),
    contextVariables,
    botId,
    state: 'cancel',
  })
  const productName = resolvePaymentTextField(data.productName, contextVariables) || 'Order payment'
  const description = resolvePaymentTextField(data.description, contextVariables)
  const amount = normalizeMoneyAmount(resolvePaymentTextField(data.amount, contextVariables), '1.00')
  const currency = normalizeCurrencyCode(
    resolvePaymentTextField(data.currency || 'usd', contextVariables),
    'usd',
    'lower'
  )

  if (!secretKey) {
    throw new Error('Stripe: secretKey не заполнен')
  }

  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', successUrl)
  form.set('cancel_url', cancelUrl)
  form.set('line_items[0][price_data][currency]', currency)
  form.set('line_items[0][price_data][unit_amount]', String(toMinorUnits(amount)))
  form.set('line_items[0][price_data][product_data][name]', productName)
  form.set('line_items[0][quantity]', '1')
  if (description) {
    form.set('payment_intent_data[description]', description.slice(0, 500))
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    cache: 'no-store',
  })

  const responseText = await response.text()
  const body = safeParseJsonObject(responseText)

  if (!response.ok) {
    throw new Error(`Stripe HTTP ${response.status}: ${responseText.slice(0, 260)}`)
  }

  const url = normalizeText(body?.url)
  if (!url) {
    throw new Error('Stripe: checkout URL отсутствует в ответе')
  }

  return {
    provider: 'stripe',
    paymentId: normalizeText(body?.id) || 'unknown',
    status: normalizeText(body?.status) || 'open',
    url,
    amount,
    currency: currency.toUpperCase(),
    raw: body,
  }
}

function createRobokassaPayment(input: {
  data: Record<string, unknown>
  contextVariables: Record<string, unknown>
  botId: string
}): PaymentNodeExecutionResult {
  const { data, contextVariables, botId } = input
  const merchantLogin = resolvePaymentTextField(data.merchantLogin, contextVariables)
  const password1 = resolvePaymentTextField(data.password1, contextVariables)
  const amount = normalizeMoneyAmount(resolvePaymentTextField(data.amount, contextVariables), '100.00')
  const description = resolvePaymentTextField(data.description, contextVariables)
  const invoiceId = resolvePaymentTextField(data.invoiceId, contextVariables) || String(Date.now())
  const successUrl = resolveRobokassaReturnUrl({
    configuredUrl: resolvePaymentTextField(data.successUrl, contextVariables),
    contextVariables,
    botId,
    state: 'success',
  })
  const failUrl = resolveRobokassaReturnUrl({
    configuredUrl: resolvePaymentTextField(data.failUrl, contextVariables),
    contextVariables,
    botId,
    state: 'fail',
  })
  const isTest = Boolean(data.isTest)
  const currency = normalizeCurrencyCode(
    resolvePaymentTextField(data.currency || 'RUB', contextVariables),
    'RUB',
    'upper'
  )

  if (!merchantLogin || !password1) {
    throw new Error('Robokassa: merchantLogin или password1 не заполнены')
  }

  const signatureValue = createHash('md5')
    .update(`${merchantLogin}:${amount}:${invoiceId}:${password1}`)
    .digest('hex')

  const params = new URLSearchParams()
  params.set('MerchantLogin', merchantLogin)
  params.set('OutSum', amount)
  params.set('InvId', invoiceId)
  params.set('SignatureValue', signatureValue)
  params.set('Culture', 'ru')
  if (description) params.set('Description', description.slice(0, 100))
  if (successUrl) params.set('SuccessURL', successUrl)
  if (failUrl) params.set('FailURL', failUrl)
  if (isTest) params.set('IsTest', '1')

  const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`

  return {
    provider: 'robokassa',
    paymentId: invoiceId,
    status: 'pending',
    url,
    amount,
    currency,
    invoiceId,
    raw: {
      merchantLogin,
      outSum: amount,
      invId: invoiceId,
      isTest,
    },
  }
}

async function createTelegramStarsPayment(input: {
  data: Record<string, unknown>
  contextVariables: Record<string, unknown>
  botToken: string
}): Promise<PaymentNodeExecutionResult> {
  const { data, contextVariables, botToken } = input
  const title = resolvePaymentTextField(data.title, contextVariables) || 'Telegram Stars payment'
  const description =
    resolvePaymentTextField(data.description, contextVariables) ||
    'Payment via Telegram Stars'
  const payload =
    resolvePaymentTextField(data.payload, contextVariables) ||
    `stars_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const amountStars = normalizeStarsAmount(
    resolvePaymentTextField(data.amount, contextVariables),
    1
  )
  const label = title.slice(0, 32) || 'Payment'
  const prices = [{ label, amount: amountStars }]

  const url = await callTelegramApi<string>(botToken, 'createInvoiceLink', {
    title: title.slice(0, 32),
    description: description.slice(0, 255),
    payload: payload.slice(0, 128),
    currency: 'XTR',
    provider_token: '',
    prices,
  })

  const normalizedUrl = normalizeText(url)
  if (!normalizedUrl || !isSupportedButtonUrl(normalizedUrl)) {
    throw new Error('Telegram Stars: createInvoiceLink вернул пустой или некорректный URL')
  }

  return {
    provider: 'telegram_stars',
    paymentId: payload,
    status: 'pending',
    url: normalizedUrl,
    amount: String(amountStars),
    currency: 'XTR',
    raw: {
      payload,
      title,
      description,
      prices,
    },
  }
}

async function executePaymentNode(args: {
  node: BotNode
  session: RuntimeSession
  contextVariables: Record<string, unknown>
  botToken: string
  botId: string
  chatId: number
  telegramUserId?: number | null
  telegramUser?: TelegramUser | null
}): Promise<void> {
  const {
    node,
    session,
    contextVariables,
    botToken,
    botId,
    chatId,
    telegramUserId,
    telegramUser,
  } = args
  const data = (node.data || {}) as Record<string, unknown>

  let result: PaymentNodeExecutionResult
  if (node.type === 'paymentYookassa') {
    result = await createYookassaPayment({ data, contextVariables, botId })
  } else if (node.type === 'paymentStripe') {
    result = await createStripePayment({ data, contextVariables, botId })
  } else if (node.type === 'paymentRobokassa') {
    result = createRobokassaPayment({ data, contextVariables, botId })
  } else if (node.type === 'paymentStars') {
    result = await createTelegramStarsPayment({ data, contextVariables, botToken })
  } else {
    throw new Error(`Unsupported payment node type: ${node.type}`)
  }

  const saveToVariable = normalizeText(data.saveToVariable || '')
  if (saveToVariable) {
    session.variables[saveToVariable] = result
  }

  await appendPaymentAuditEventSafe({
    botId,
    nodeId: node.id,
    provider: result.provider,
    paymentId: result.paymentId,
    status: result.status,
    amount: result.amount,
    currency: result.currency,
    chatId,
    telegramUserId,
    username: telegramUser?.username,
    firstName: telegramUser?.first_name,
    lastName: telegramUser?.last_name,
  })

  if (data.autoSendPaymentLink !== false) {
    const defaultTemplate =
      node.type === 'paymentStars'
        ? 'Оплатите заказ в Telegram Stars: {{payment.url}}'
        : 'Оплатите заказ по ссылке: {{payment.url}}'
    const template = String(data.messageTemplate || '').trim() || defaultTemplate
    const messageText = interpolateTemplate(template, {
      ...contextVariables,
      payment: result,
      paymentUrl: result.url,
      paymentId: result.paymentId,
      paymentStatus: result.status,
    })

    await sendMessage(
      botToken,
      botId,
      chatId,
      messageText,
      undefined,
      undefined,
      undefined,
      { disableWebPagePreview: false },
      telegramUserId,
      {
        ...contextVariables,
        payment: result,
        paymentUrl: result.url,
        paymentId: result.paymentId,
        paymentStatus: result.status,
      }
    )
  }

  appendBotTestLog(
    botId,
    'workflow',
    `Payment ${result.provider} -> ${node.id} (${result.amount} ${result.currency}) status=${result.status} id=${result.paymentId}${saveToVariable ? ` saved to ${saveToVariable}` : ''}`,
    'info'
  )
}

function normalizeScriptTimeoutMs(value: unknown): number {
  const raw = Number(value || DEFAULT_SCRIPT_TIMEOUT_MS)
  if (!Number.isFinite(raw)) return DEFAULT_SCRIPT_TIMEOUT_MS
  return Math.min(MAX_SCRIPT_TIMEOUT_MS, Math.max(100, Math.round(raw)))
}

function createScriptExecutionContext(args: {
  contextVariables: Record<string, unknown>
  update: TelegramUpdate
  user: TelegramUser | null
  chatId: number
}): Record<string, unknown> {
  const { contextVariables, update, user, chatId } = args

  return {
    ...contextVariables,
    chat: {
      id: chatId,
    },
    message: update.message
      ? {
          messageId: update.message.message_id,
          text: update.message.text,
          caption: update.message.caption,
          chatId: update.message.chat?.id,
          from: update.message.from
            ? {
                id: update.message.from.id,
                isBot: Boolean(update.message.from.is_bot),
                username: update.message.from.username,
                firstName: update.message.from.first_name,
                lastName: update.message.from.last_name,
                languageCode: update.message.from.language_code,
              }
            : undefined,
        }
      : undefined,
    callback: update.callback_query
      ? {
          id: update.callback_query.id,
          data: update.callback_query.data,
          from: {
            id: update.callback_query.from.id,
            isBot: Boolean(update.callback_query.from.is_bot),
            username: update.callback_query.from.username,
            firstName: update.callback_query.from.first_name,
            lastName: update.callback_query.from.last_name,
            languageCode: update.callback_query.from.language_code,
          },
          message: update.callback_query.message
            ? {
                messageId: update.callback_query.message.message_id,
                chatId: update.callback_query.message.chat?.id,
                text: update.callback_query.message.text,
                caption: update.callback_query.message.caption,
              }
            : undefined,
        }
      : undefined,
    update: {
      updateId: update.update_id,
      hasMessage: Boolean(update.message),
      hasCallback: Boolean(update.callback_query),
    },
    user: {
      id: user?.id,
      username: user?.username,
      firstName: user?.first_name,
      lastName: user?.last_name,
      languageCode: user?.language_code,
      isBot: Boolean(user?.is_bot),
    },
  }
}

function safeJsonClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function runJavascriptScript(args: {
  code: string
  inputValue: unknown
  executionContext: Record<string, unknown>
  sessionVariables: Record<string, unknown>
  timeoutMs: number
}): unknown {
  const { code, inputValue, executionContext, sessionVariables, timeoutMs } = args

  const sandbox: Record<string, unknown> = {
    input: safeJsonClone(inputValue),
    context: safeJsonClone(executionContext),
    vars: safeJsonClone(sessionVariables),
    result: null,
    Math,
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
  }

  const context = createVmContext(sandbox)
  const compiled = new VmScript(String(code || ''), {
    filename: 'tflow-script-node.js',
  })
  compiled.runInContext(context, { timeout: timeoutMs })
  return sandbox.result
}

async function runPythonScriptProcess(
  command: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-c', PYTHON_NODE_WRAPPER_CODE], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let finished = false

    const timeout = setTimeout(() => {
      if (finished) return
      finished = true
      child.kill('SIGKILL')
      reject(new Error(`Python script timeout (${timeoutMs}ms)`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      reject(error)
    })

    child.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)

      const markerLine = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .reverse()
        .find((line) => line.startsWith(PYTHON_RESULT_MARKER))

      if (!markerLine) {
        reject(
          new Error(
            stderr.trim()
              ? `Python script failed: ${stderr.trim().slice(0, 500)}`
              : `Python script failed (exit ${code ?? 'unknown'})`
          )
        )
        return
      }

      try {
        const parsed = JSON.parse(markerLine.slice(PYTHON_RESULT_MARKER.length)) as {
          ok?: boolean
          result?: unknown
          error?: string
        }
        if (!parsed.ok) {
          reject(new Error(parsed.error || 'Python script execution failed'))
          return
        }
        resolve(parsed.result)
      } catch (error) {
        reject(new Error(`Invalid Python script response: ${String(error)}`))
      }
    })

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  })
}

async function runPythonScript(args: {
  code: string
  inputValue: unknown
  executionContext: Record<string, unknown>
  sessionVariables: Record<string, unknown>
  timeoutMs: number
}): Promise<unknown> {
  const payload = {
    code: String(args.code || ''),
    input: safeJsonClone(args.inputValue),
    context: safeJsonClone(args.executionContext),
    vars: safeJsonClone(args.sessionVariables),
  }

  try {
    return await runPythonScriptProcess('python3', payload, args.timeoutMs)
  } catch (error) {
    const message = String(error)
    if (!/ENOENT/i.test(message)) {
      throw error
    }
  }

  return runPythonScriptProcess('python', payload, args.timeoutMs)
}

async function executeScriptNode(args: {
  node: BotNode
  session: RuntimeSession
  contextVariables: Record<string, unknown>
  update: TelegramUpdate
  user: TelegramUser | null
  chatId: number
  botId: string
}): Promise<void> {
  if (!SCRIPT_NODES_ENABLED) {
    throw new Error(
      'Script node disabled in production. Set TFLOW_ENABLE_UNSAFE_SCRIPT_NODES=1 to enable.'
    )
  }

  const { node, session, contextVariables, update, user, chatId, botId } = args
  const data = (node.data || {}) as Record<string, unknown>
  const language = normalizeText(data.language || 'javascript').toLowerCase()
  const code = String(data.code || '')
  const timeoutMs = normalizeScriptTimeoutMs(data.timeoutMs)
  const saveToVariable = normalizeText(data.saveToVariable)
  const inputPath = normalizeText(data.inputPath)

  if (!code.trim()) {
    appendBotTestLog(botId, 'workflow', `Script -> ${node.id} skipped: empty code`, 'warn')
    return
  }

  const executionContext = createScriptExecutionContext({
    contextVariables,
    update,
    user,
    chatId,
  })
  const inputValue = inputPath ? resolvePath(executionContext, inputPath) : executionContext

  let result: unknown
  if (language === 'python') {
    result = await runPythonScript({
      code,
      inputValue,
      executionContext,
      sessionVariables: session.variables,
      timeoutMs,
    })
  } else {
    result = runJavascriptScript({
      code,
      inputValue,
      executionContext,
      sessionVariables: session.variables,
      timeoutMs,
    })
  }

  if (saveToVariable) {
    session.variables[saveToVariable] = result
  }

  appendBotTestLog(
    botId,
    'workflow',
    `Script -> ${node.id} (${language === 'python' ? 'python' : 'js'})${saveToVariable ? ` saved to ${saveToVariable}` : ''}`,
    'info'
  )
}

function resolveSchedulerDelayMs(data: Record<string, unknown>): number {
  const rawValue = Number(data.delayValue ?? 0)
  const safeValue = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0
  const unit = normalizeText(data.delayUnit || 'minutes').toLowerCase()

  switch (unit) {
    case 'seconds':
    case 'second':
      return Math.round(safeValue * 1000)
    case 'hours':
    case 'hour':
      return Math.round(safeValue * 60 * 60 * 1000)
    case 'days':
    case 'day':
      return Math.round(safeValue * 24 * 60 * 60 * 1000)
    case 'minutes':
    case 'minute':
    default:
      return Math.round(safeValue * 60 * 1000)
  }
}

function resolveSchedulerDueAtMs(
  data: Record<string, unknown>,
  contextVariables: Record<string, unknown>
): { dueAtMs: number | null; reason?: string } {
  const mode = normalizeText(data.mode || 'delay')

  if (mode === 'datetime' || mode === 'dateTime') {
    const dateTimeLocal = interpolateTemplate(String(data.dateTime || ''), contextVariables).trim()
    const timeZone = interpolateTemplate(String(data.timeZone || 'UTC'), contextVariables).trim() || 'UTC'

    if (!dateTimeLocal) {
      return { dueAtMs: null, reason: 'scheduler: dateTime is empty' }
    }
    if (!isValidIanaTimeZone(timeZone)) {
      return { dueAtMs: null, reason: `scheduler: invalid timezone "${timeZone}"` }
    }

    const dueAtMs = zonedDateTimeLocalToUtcMs(dateTimeLocal, timeZone)
    if (dueAtMs == null) {
      return {
        dueAtMs: null,
        reason: `scheduler: invalid date/time "${dateTimeLocal}" for zone "${timeZone}"`,
      }
    }
    return { dueAtMs }
  }

  return { dueAtMs: Date.now() + resolveSchedulerDelayMs(data) }
}

function scheduleSchedulerResume(args: {
  sessionKey: string
  botId: string
  botToken: string
  config: BotConfig
  metadata?: Record<string, unknown> | null
  session: RuntimeSession
  schedulerNodeId: string
  nextNodeId: string
  dueAtMs: number
  chatId: number
  update: TelegramUpdate
  user: TelegramUser | null
}) {
  const {
    sessionKey,
    botId,
    botToken,
    config,
    metadata,
    session,
    schedulerNodeId,
    nextNodeId,
    dueAtMs,
    chatId,
    update,
    user,
  } = args

  clearScheduledResumeTimer(sessionKey, session)
  session.scheduledResumeAtMs = dueAtMs

  const scheduleChunk = () => {
    const remainingMs = dueAtMs - Date.now()
    if (remainingMs <= 0) {
      void (async () => {
        try {
          runtimeSchedulerTimers.delete(sessionKey)

          if (session.waitingForNodeId !== schedulerNodeId) {
            appendBotTestLog(
              botId,
              'workflow',
              `Scheduler resume skipped: waiting node changed (${schedulerNodeId})`,
              'debug'
            )
            return
          }

          session.waitingForNodeId = undefined
          session.scheduledResumeAtMs = undefined
          session.updatedAt = Date.now()

          appendBotTestLog(botId, 'workflow', `Scheduler resume -> ${schedulerNodeId}`, 'info')

          const runState = await executeFromNode({
            startNodeId: nextNodeId,
            botId,
            botToken,
            chatId,
            config,
            metadata,
            session,
            sessionKey,
            update,
            user,
          })

          if (runState === 'completed' && !session.waitingForNodeId) {
            resetSessionState(session, sessionKey)
          }
        } catch (error) {
          appendBotTestLog(
            botId,
            'workflow',
            `Scheduler resume error (${schedulerNodeId}): ${String(error)}`,
            'error'
          )
        }
      })()
      return
    }

    const timeoutMs = Math.min(remainingMs, MAX_TIMEOUT_CHUNK_MS)
    const timer = setTimeout(() => {
      if (timeoutMs < remainingMs) {
        scheduleChunk()
        return
      }
      scheduleChunk()
    }, timeoutMs)
    runtimeSchedulerTimers.set(sessionKey, timer)
  }

  scheduleChunk()
}

async function executeFromNode(args: {
  startNodeId: string
  botId: string
  botToken: string
  chatId: number
  config: BotConfig
  metadata?: Record<string, unknown> | null
  session: RuntimeSession
  sessionKey: string
  update: TelegramUpdate
  user: TelegramUser | null
}): Promise<WorkflowRunState> {
  const { botId, botToken, chatId, config, metadata, session, sessionKey, update, user } = args
  const nodeMap = buildNodeMap(config)

  let currentNodeId: string | null = args.startNodeId
  let steps = 0

  while (currentNodeId && steps < MAX_WORKFLOW_STEPS) {
    steps += 1

    const node = nodeMap.get(currentNodeId)
    if (!node) return 'completed'

    const contextVariables: Record<string, unknown> = {
      ...session.variables,
      chat: {
        id: chatId,
      },
      message: update.message
        ? {
            messageId: update.message.message_id,
            text: update.message.text,
            caption: update.message.caption,
            chatId: update.message.chat?.id,
          }
        : undefined,
      callback: update.callback_query
        ? {
            id: update.callback_query.id,
            data: update.callback_query.data,
            messageId: update.callback_query.message?.message_id,
            chatId: update.callback_query.message?.chat?.id,
          }
        : undefined,
      update: {
        updateId: update.update_id,
      },
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
      const attachment = resolveMessageAttachment(data)
      const systemReplyMarkup = resolveSystemReplyKeyboardMarkupForSend({
        metadata,
        session,
        contextVariables,
      })
      appendBotTestLog(botId, 'workflow', `Node message -> ${node.id}`, 'debug')

      if (attachment) {
        const attachmentSource = interpolateTemplate(attachment.source, contextVariables).trim()
        if (attachmentSource) {
          await sendMediaMessage(
            botToken,
            botId,
            chatId,
            { ...attachment, source: attachmentSource },
            text,
            resolveNodeParseMode(data),
            resolveKeyboardData(data),
            systemReplyMarkup,
            {
              disableNotification: normalizeBoolean(data.disableNotification),
            },
            user?.id,
            contextVariables
          )
        } else {
          await sendMessage(
            botToken,
            botId,
            chatId,
            text,
            resolveNodeParseMode(data),
            resolveKeyboardData(data),
            systemReplyMarkup,
            {
              disableWebPagePreview: normalizeBoolean(data.disableWebPagePreview),
              disableNotification: normalizeBoolean(data.disableNotification),
            },
            user?.id,
            contextVariables
          )
        }
      } else {
        await sendMessage(
          botToken,
          botId,
          chatId,
          text,
          resolveNodeParseMode(data),
          resolveKeyboardData(data),
          systemReplyMarkup,
          {
            disableWebPagePreview: normalizeBoolean(data.disableWebPagePreview),
            disableNotification: normalizeBoolean(data.disableNotification),
          },
          user?.id,
          contextVariables
        )
      }
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
      const parseMode = resolveNodeParseMode(data)
      const systemReplyMarkup = resolveSystemReplyKeyboardMarkupForSend({
        metadata,
        session,
        contextVariables,
      })
      const messageOptions = {
        disableWebPagePreview: normalizeBoolean(data.disableWebPagePreview),
        disableNotification: normalizeBoolean(data.disableNotification),
      }

      if (shouldUseForceReply) {
        try {
          appendBotTestLog(botId, 'workflow', `Node input(forceReply) -> ${node.id}`, 'debug')
          await sendMessage(botToken, botId, chatId, question, parseMode, keyboard, systemReplyMarkup, {
            forceReply: true,
            inputPlaceholder: placeholder,
            ...messageOptions,
          }, user?.id, contextVariables)
        } catch (error) {
          console.error('Failed to send input with force-reply, fallback to plain message:', error)
          appendBotTestLog(botId, 'workflow', `Input forceReply fallback: ${String(error)}`, 'warn')
          await sendMessage(botToken, botId, chatId, question, parseMode, keyboard, systemReplyMarkup, messageOptions, user?.id, contextVariables)
        }
      } else {
        appendBotTestLog(botId, 'workflow', `Node input -> ${node.id}`, 'debug')
        await sendMessage(botToken, botId, chatId, question, parseMode, keyboard, systemReplyMarkup, messageOptions, user?.id, contextVariables)
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

    if (node.type === 'router') {
      const data = (node.data || {}) as Record<string, unknown>
      const variableName = normalizeText(data.variable)
      const operator = normalizeText(data.operator || 'equals')
      const routerCases = normalizeRouterCases(data.cases)

      const leftValue = variableName ? resolvePath(contextVariables, variableName) : undefined

      const matchedCase = routerCases.find((routerCase) =>
        evaluateConditionValue(operator, leftValue, routerCase.value)
      )

      if (matchedCase) {
        appendBotTestLog(
          botId,
          'workflow',
          `Router -> ${node.id} matched case:${matchedCase.id} (${matchedCase.label || String(matchedCase.value ?? '') || '-'})`,
          'info'
        )
      } else {
        appendBotTestLog(
          botId,
          'workflow',
          `Router -> ${node.id} default branch (${variableName || 'variable'} unmatched)`,
          'debug'
        )
      }

      currentNodeId = getRouterNextNodeId(config, node.id, matchedCase?.id)
      continue
    }

    if (node.type === 'scheduler') {
      const data = (node.data || {}) as Record<string, unknown>
      const nextNodeId = getDefaultNextNodeId(config, node.id)
      if (!nextNodeId) {
        appendBotTestLog(botId, 'workflow', `Scheduler -> ${node.id}: no next node`, 'warn')
        return 'completed'
      }

      const { dueAtMs, reason } = resolveSchedulerDueAtMs(data, contextVariables)
      if (dueAtMs == null || !Number.isFinite(dueAtMs)) {
        appendBotTestLog(
          botId,
          'workflow',
          `Scheduler -> ${node.id} invalid schedule (${reason || 'unknown'})`,
          'warn'
        )
        currentNodeId = nextNodeId
        continue
      }

      const saveToVariable = normalizeText(data.saveToVariable)
      if (saveToVariable) {
        session.variables[saveToVariable] = new Date(dueAtMs).toISOString()
      }

      const delayMs = dueAtMs - Date.now()
      if (delayMs <= 0) {
        appendBotTestLog(
          botId,
          'workflow',
          `Scheduler -> ${node.id} due time already passed, continue now`,
          'debug'
        )
        currentNodeId = nextNodeId
        continue
      }

      session.waitingForNodeId = node.id
      session.updatedAt = Date.now()

      scheduleSchedulerResume({
        sessionKey,
        botId,
        botToken,
        config,
        metadata,
        session,
        schedulerNodeId: node.id,
        nextNodeId,
        dueAtMs,
        chatId,
        update,
        user,
      })

      appendBotTestLog(
        botId,
        'workflow',
        `Scheduler -> ${node.id} scheduled in ${Math.max(1, Math.round(delayMs / 1000))}s (${new Date(dueAtMs).toISOString()})`,
        'info'
      )
      return 'waiting'
    }

    if (node.type === 'replyKeyboard') {
      const data = (node.data || {}) as Record<string, unknown>
      const mode = normalizeText(data.mode || 'system') || 'system'

      const applyReplyKeyboardMode = (
        nextModeRaw: string,
        nextVariantKeyRaw?: unknown
      ) => {
        const nextMode = normalizeText(nextModeRaw || 'system') || 'system'
        if (nextMode === 'clear') {
          session.replyKeyboardState = {
            mode: 'hidden',
            pendingRemove: true,
          }
          appendBotTestLog(botId, 'workflow', `ReplyKeyboard -> ${node.id} clear`, 'info')
          return
        }

        if (nextMode === 'variant') {
          const variantKey = normalizeText(nextVariantKeyRaw || 'base') || 'base'
          session.replyKeyboardState = {
            mode: 'variant',
            variantKey,
            pendingRemove: false,
          }
          appendBotTestLog(botId, 'workflow', `ReplyKeyboard -> ${node.id} variant ${variantKey}`, 'info')
          return
        }

        session.replyKeyboardState = {
          mode: 'system',
          pendingRemove: false,
        }
        appendBotTestLog(botId, 'workflow', `ReplyKeyboard -> ${node.id} system`, 'debug')
      }

      if (mode === 'condition') {
        const variableName = normalizeText(data.variable)
        const operator = normalizeText(data.operator || 'equals') || 'equals'
        const compareTo = data.value
        const leftValue = variableName ? resolvePath(contextVariables, variableName) : undefined
        const matched = evaluateConditionValue(operator, leftValue, compareTo)

        if (matched) {
          applyReplyKeyboardMode(String(data.trueMode || 'variant'), data.trueVariantKey)
        } else {
          applyReplyKeyboardMode(String(data.falseMode || 'system'), data.falseVariantKey)
        }
      } else if (mode === 'variant') {
        applyReplyKeyboardMode('variant', data.variantKey)
      } else if (mode === 'clear') {
        applyReplyKeyboardMode('clear')
      } else {
        applyReplyKeyboardMode('system')
      }

      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'action') {
      appendBotTestLog(botId, 'workflow', `Node action -> ${node.id}`, 'debug')
      const selectedActionHandle = await executeActionNode(
        node,
        session,
        contextVariables,
        update,
        botToken,
        botId
      )
      currentNodeId = selectedActionHandle
        ? getNextNodeIdBySourceHandle(config, node.id, selectedActionHandle) || getDefaultNextNodeId(config, node.id)
        : getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'script') {
      appendBotTestLog(botId, 'workflow', `Node script -> ${node.id}`, 'debug')
      await executeScriptNode({
        node,
        session,
        contextVariables,
        update,
        user,
        chatId,
        botId,
      })
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'http' || node.type === 'webhook') {
      appendBotTestLog(botId, 'workflow', `Node ${node.type} -> ${node.id}`, 'debug')
      await executeHttpNode(node, session, contextVariables)
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (
      node.type === 'paymentYookassa' ||
      node.type === 'paymentStripe' ||
      node.type === 'paymentRobokassa' ||
      node.type === 'paymentStars'
    ) {
      appendBotTestLog(botId, 'workflow', `Node ${node.type} -> ${node.id}`, 'debug')
      await executePaymentNode({
        node,
        session,
        contextVariables,
        botToken,
        botId,
        chatId,
        telegramUserId: user?.id,
        telegramUser: user || null,
      })
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
    }

    if (node.type === 'wait') {
      appendBotTestLog(botId, 'workflow', `Node wait -> ${node.id}`, 'debug')
      session.waitingForNodeId = node.id
      session.updatedAt = Date.now()
      return 'waiting'
    }

    if (node.type === 'comment') {
      appendBotTestLog(botId, 'workflow', `Node comment -> ${node.id} (noop)`, 'debug')
      currentNodeId = getDefaultNextNodeId(config, node.id)
      continue
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
    appendBotTestLog(context.botId, 'workflow', 'Игнор update: trigger-ноды отсутствуют', 'warn')
    return
  }

  const message = context.update.message
  const callback = context.update.callback_query

  const chatId = message?.chat.id || callback?.message?.chat.id
  const user = message?.from || callback?.from || null

  if (!chatId || !user?.id) {
    appendBotTestLog(context.botId, 'workflow', 'Игнор update: нет chatId или userId', 'warn')
    return
  }

  await tryApplySystemAutoReaction(context, message, user)

  const sessionKey = createSessionKey(context.botId, chatId, user.id)
  const session = getOrCreateSession(sessionKey)
  const nodeMap = buildNodeMap(context.config)
  const messageText = normalizeText(message?.text)
  const callbackData = normalizeText(callback?.data)
  const activeWaitingNode = session.waitingForNodeId ? nodeMap.get(session.waitingForNodeId) : undefined

  if (activeWaitingNode?.type === 'scheduler') {
    if (callback?.id) {
      try {
        await callTelegramApi(context.botToken, 'answerCallbackQuery', {
          callback_query_id: callback.id,
        })
      } catch {
        // ignore callback ack errors while scheduler is waiting
      }
    }
    appendBotTestLog(
      context.botId,
      'workflow',
      `Scheduler waiting: ${activeWaitingNode.id}${session.scheduledResumeAtMs ? ` until ${new Date(session.scheduledResumeAtMs).toISOString()}` : ''}`,
      'debug'
    )
    return
  }

  const runFromTriggerNode = async (triggerNode: BotNode) => {
    // Start every trigger execution from a clean state to avoid stale variable leaks
    resetSessionState(session, sessionKey)

    const triggerData = (triggerNode.data || {}) as Record<string, unknown>
    appendBotTestLog(
      context.botId,
      'workflow',
      `Trigger matched: ${String(triggerData.trigger || 'unknown')} | pattern=${String(triggerData.pattern || '').slice(0, 80) || '-'}`,
      'info'
    )

    const nextNodeId = getDefaultNextNodeId(context.config, triggerNode.id)
    if (!nextNodeId) {
      appendBotTestLog(context.botId, 'workflow', 'У trigger-ноды нет следующего соединения', 'warn')
      return
    }

    const runState = await executeFromNode({
      startNodeId: nextNodeId,
      botId: context.botId,
      botToken: context.botToken,
      chatId,
      config: context.config,
      metadata: context.metadata,
      session,
      sessionKey,
      update: context.update,
      user,
    })

    if (runState === 'completed' && !session.waitingForNodeId) {
      resetSessionState(session, sessionKey)
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
      appendBotTestLog(context.botId, 'telegram', 'answerCallbackQuery error', 'warn')
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
    } else {
      appendBotTestLog(context.botId, 'workflow', `Callback ignored: ${callbackData || '(empty)'}`, 'debug')
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
        appendBotTestLog(context.botId, 'workflow', `Wait saved: ${saveToVariable}`, 'debug')
      }
    }

    session.waitingForNodeId = undefined
    if (waitingNode?.type === 'input') {
      const variableName = normalizeText((waitingNode.data as Record<string, unknown>)?.variableName)
      if (variableName) {
        session.variables[variableName] = messageText
        appendBotTestLog(context.botId, 'workflow', `Input captured: ${variableName}=${messageText.slice(0, 80)}`, 'info')
      }
    }

    session.updatedAt = Date.now()

    const nextNodeId = getDefaultNextNodeId(context.config, waitingNodeId)
    if (nextNodeId) {
      const runState = await executeFromNode({
        startNodeId: nextNodeId,
        botId: context.botId,
        botToken: context.botToken,
        chatId,
        config: context.config,
        metadata: context.metadata,
        session,
        sessionKey,
        update: context.update,
        user,
      })

      if (runState === 'completed' && !session.waitingForNodeId) {
        resetSessionState(session, sessionKey)
      }
    } else {
      resetSessionState(session, sessionKey)
    }
    return
  }

  if (triggerNode) {
    await runFromTriggerNode(triggerNode)
    return
  }

  appendBotTestLog(context.botId, 'workflow', `No trigger matched for: ${messageText.slice(0, 80)}`, 'debug')
}
