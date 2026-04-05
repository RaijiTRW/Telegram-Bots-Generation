'use server'

import { headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getViewerAccess } from '@/lib/billing/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import { appendBotAuditEventSafe } from '@/lib/bot-editor/services/bot-audit-service'
import { getBotSubscribersStats } from '@/lib/bot-editor/services/bot-subscriber-service'
import {
  getDashboardCrmOverview,
  getDashboardCrmLeads,
  getLeadTimeline,
  updateLeadStage,
} from '@/lib/bot-editor/services/bot-crm-service'
import type {
  BotConfig,
  BotVariable,
  BotStatus,
  Edge as WorkflowEdge,
  Node as WorkflowNode,
  VariableType,
} from '@/lib/bot-editor/types/bot.types'
import type {
  BotPaymentHistory,
  BotPaymentHistoryFilters,
  BotPaymentHistoryItem,
  BotPaymentHistoryPeriod,
  BotSubscribersAnalytics,
  BotSubscribersPeriod,
  BotSubscribersSource,
  BotTechnicalStats,
  BotTechnicalStatsRange,
  BotTechnicalStatsSummary,
  CrmFilters,
  DashboardGlobalAnomaly,
  DashboardGlobalBotRankingRow,
  DashboardGlobalCurrencyTotal,
  DashboardGlobalMoneySummary,
  DashboardGlobalPaymentItem,
  DashboardGlobalPayments,
  DashboardGlobalPaymentsFilters,
  DashboardGlobalReportFormat,
  DashboardGlobalRetentionBlock,
  DashboardGlobalRetentionCohortRow,
  DashboardGlobalRetentionWindow,
  DashboardRetentionWindowKey,
  DashboardGlobalStats,
  DashboardGlobalStatsFilters,
  DashboardGlobalStatsPeriod,
  DashboardGlobalSubscriberItem,
  DashboardGlobalSubscribers,
  DashboardGlobalSubscribersFilters,
  LeadStage,
} from '@/lib/bot-editor/types/analytics.types'
import type { ViewerAccess } from '@/lib/billing/types'
import { buildBase64CsvPayload, buildBase64XlsxPayload, type DashboardExportSheet } from '@/lib/dashboard-analytics/export'
import { callTelegramApi, callTelegramApiFormData } from '@/lib/bot-editor/runtime/telegram-api'
import {
  startTelegramPolling,
  stopTelegramPolling,
  updateTelegramPollingConfig,
} from '@/lib/bot-editor/runtime/polling-runtime'
import { clearRuntimeSessionsForBot } from '@/lib/bot-editor/runtime/workflow-runtime'
import {
  appendBotTestLog,
  clearBotTestLogs,
  getPersistentBotTestLogs,
  getBotTestLogs,
  mergeBotTestLogs,
  setBotTestLogRunContext,
  type BotTestLogEntry,
} from '@/lib/bot-editor/runtime/test-log-store'
import {
  generatePythonBotCode,
  generatePythonRequirements,
  generatePythonEnvTemplate,
  generateWorkflowJson,
} from '@/lib/bot-editor/code-generator'

type CanvasNode = {
  id: string
  type?: string | null
  position?: { x: number; y: number }
  data?: Record<string, unknown>
  [key: string]: unknown
}

type CanvasEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  [key: string]: unknown
}

type CanvasVariable = {
  id?: string
  name?: string
  type?: string
  default_value?: unknown
  description?: string
  scope?: string
  [key: string]: unknown
}

const LOCAL_BOT_MEDIA_ROOT_DIR = '.tflow-media'
const MAX_LOCAL_ATTACHMENT_BYTES = 50 * 1024 * 1024
const MAX_TELEGRAM_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024
const ZIP_CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[i] = crc >>> 0
  }
  return table
})()

interface SaveSettingsInput {
  name: string
  description: string
  status: BotStatus
  telegramToken: string
  webhookUrl: string
  metadataPatch?: Record<string, unknown>
}

interface SyncTelegramBotStyleInput {
  displayName?: string
  about?: string
  shortDescription?: string
  desiredUsername?: string
  avatarUrl?: string
}

function isTelegramApiReachabilityError(error: unknown): boolean {
  const message = String(error || '')
  return (
    message.includes('Telegram API network error') &&
    (
      message.includes('UND_ERR_CONNECT_TIMEOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('api.telegram.org')
    )
  )
}

function toTelegramTestStartErrorMessage(error: unknown): string {
  if (isTelegramApiReachabilityError(error)) {
    return 'Сервер не может подключиться к Telegram Bot API (api.telegram.org:443). Это проблема сети или хостинга, а не Bot Token. Разрешите исходящие HTTPS-подключения к Telegram на сервере или укажите TELEGRAM_PROXY_URL на сервере, чтобы пустить Telegram через прокси.'
  }

  return String(error)
}

function sanitizeAttachmentFileName(name: string): string {
  const trimmed = String(name || '').trim() || 'attachment'
  const extension = extname(trimmed).slice(0, 16)
  const base = trimmed.slice(0, Math.max(0, trimmed.length - extension.length))
  const safeBase = base
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'attachment'

  const safeExt = extension
    .replace(/[^\w.]+/g, '')
    .slice(0, 16)

  return `${safeBase}${safeExt}`
}

function sanitizeArchiveBaseName(name: string): string {
  const normalized = String(name || '')
    .trim()
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return normalized || 'telegram-bot'
}

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i += 1) {
    crc = ZIP_CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear())
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = Math.floor(date.getSeconds() / 2)

  const dosTime = (hours << 11) | (minutes << 5) | seconds
  const dosDate = ((year - 1980) << 9) | (month << 5) | day
  return { dosTime, dosDate }
}

function createZipArchive(
  entries: Array<{ name: string; content: string }>,
  createdAt = new Date()
): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  const { dosTime, dosDate } = toDosDateTime(createdAt)

  for (const entry of entries) {
    const fileNameBytes = Buffer.from(entry.name, 'utf8')
    const contentBytes = Buffer.from(entry.content, 'utf8')
    const crc32 = computeCrc32(contentBytes)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // local file header signature
    localHeader.writeUInt16LE(20, 4) // version needed to extract
    localHeader.writeUInt16LE(0, 6) // general purpose bit flag
    localHeader.writeUInt16LE(0, 8) // compression method (0 = store)
    localHeader.writeUInt16LE(dosTime, 10) // last mod file time
    localHeader.writeUInt16LE(dosDate, 12) // last mod file date
    localHeader.writeUInt32LE(crc32, 14) // crc-32
    localHeader.writeUInt32LE(contentBytes.length, 18) // compressed size
    localHeader.writeUInt32LE(contentBytes.length, 22) // uncompressed size
    localHeader.writeUInt16LE(fileNameBytes.length, 26) // file name length
    localHeader.writeUInt16LE(0, 28) // extra field length

    localParts.push(localHeader, fileNameBytes, contentBytes)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0) // central file header signature
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed to extract
    centralHeader.writeUInt16LE(0, 8) // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10) // compression method
    centralHeader.writeUInt16LE(dosTime, 12) // last mod file time
    centralHeader.writeUInt16LE(dosDate, 14) // last mod file date
    centralHeader.writeUInt32LE(crc32, 16) // crc-32
    centralHeader.writeUInt32LE(contentBytes.length, 20) // compressed size
    centralHeader.writeUInt32LE(contentBytes.length, 24) // uncompressed size
    centralHeader.writeUInt16LE(fileNameBytes.length, 28) // file name length
    centralHeader.writeUInt16LE(0, 30) // extra field length
    centralHeader.writeUInt16LE(0, 32) // file comment length
    centralHeader.writeUInt16LE(0, 34) // disk number start
    centralHeader.writeUInt16LE(0, 36) // internal file attributes
    centralHeader.writeUInt32LE(0, 38) // external file attributes
    centralHeader.writeUInt32LE(offset, 42) // relative offset of local header

    centralParts.push(centralHeader, fileNameBytes)
    offset += localHeader.length + fileNameBytes.length + contentBytes.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const localDirectory = Buffer.concat(localParts)

  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0) // end of central dir signature
  endOfCentralDirectory.writeUInt16LE(0, 4) // number of this disk
  endOfCentralDirectory.writeUInt16LE(0, 6) // number of the disk with start of central directory
  endOfCentralDirectory.writeUInt16LE(entries.length, 8) // total entries on this disk
  endOfCentralDirectory.writeUInt16LE(entries.length, 10) // total entries
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12) // size of central dir
  endOfCentralDirectory.writeUInt32LE(localDirectory.length, 16) // offset of central dir
  endOfCentralDirectory.writeUInt16LE(0, 20) // zip comment length

  return Buffer.concat([localDirectory, centralDirectory, endOfCentralDirectory])
}

type SecretsClient = Parameters<typeof createBotSecretsService>[0]
type AuditClient = Parameters<typeof appendBotAuditEventSafe>[0]
type SubscribersClient = Parameters<typeof getBotSubscribersStats>[0]

const ALLOWED_NODE_TYPES = new Set<WorkflowNode['type']>([
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
  'trigger',
  'wait',
  'comment',
])

const ALLOWED_VARIABLE_TYPES = new Set<VariableType>([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'user',
  'message',
  'date',
])

const ALLOWED_VARIABLE_SCOPES = new Set<NonNullable<BotVariable['scope']>>([
  'global',
  'user',
  'chat',
  'temporary',
])

const PUBLIC_BOT_LOG_SOURCE_ALLOWLIST = new Set<BotTestLogEntry['source']>([
  'system',
  'runtime',
  'workflow',
  'telegram',
  'polling',
])

function isInternalBotTestLogMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('supabase_service_role_key') ||
    normalized.includes('next_public_supabase_url') ||
    normalized.includes('ошибка проверки состояния poller')
  )
}

function toPublicBotTestLogEntries(entries: BotTestLogEntry[]): BotTestLogEntry[] {
  return entries.filter((entry) => {
    if (!PUBLIC_BOT_LOG_SOURCE_ALLOWLIST.has(entry.source)) {
      return false
    }

    if (isInternalBotTestLogMessage(entry.message)) {
      return false
    }

    return true
  })
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function removeSecretFieldsFromMetadata(metadata: Record<string, unknown> | undefined | null) {
  const next = { ...(metadata || {}) }
  delete next.telegramToken
  delete next.webhookSecret
  return next
}

function sanitizeAutoReactionsFeatureConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const cooldownRaw = Number(raw.cooldownSeconds)
  const cooldownSeconds = Number.isFinite(cooldownRaw)
    ? Math.max(0, Math.min(3600, Math.round(cooldownRaw)))
    : 15

  return {
    enabled: Boolean(raw.enabled),
    onlyTextMessages: raw.onlyTextMessages === undefined ? true : Boolean(raw.onlyTextMessages),
    cooldownSeconds,
    mode: 'rule-based',
  }
}

function sanitizeMessageDraftsFeatureConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  return {
    enabled: Boolean(raw.enabled),
  }
}

function sanitizeSubscriberModeFeatureConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  return {
    enabled: Boolean(raw.enabled),
    privateChatsOnly: raw.privateChatsOnly === undefined ? true : Boolean(raw.privateChatsOnly),
    trackCallbacks: raw.trackCallbacks === undefined ? true : Boolean(raw.trackCallbacks),
  }
}

type SanitizedReplyKeyboardRule = {
  id: string
  name: string
  enabled: boolean
  variable: string
  operator: string
  value: string
  rows: Array<
    Array<{
      id: string
      text: string
      emoji?: string
      style?: 'default' | 'primary' | 'success' | 'danger'
      iconCustomEmojiId?: string
    }>
  >
}

type SanitizedReplyKeyboardButton = {
  id: string
  text: string
  emoji?: string
  style?: 'default' | 'primary' | 'success' | 'danger'
  iconCustomEmojiId?: string
}

function sanitizeReplyKeyboardButton(input: unknown, rowIndex: number, buttonIndex: number): SanitizedReplyKeyboardButton | null {
  const allowedStyles = new Set(['default', 'primary', 'success', 'danger'] as const)

  if (typeof input === 'string') {
    const text = input.trim().slice(0, 64)
    if (!text) return null
    return {
      id: `b_${rowIndex + 1}_${buttonIndex + 1}`,
      text,
      style: 'default',
    }
  }

  if (!input || typeof input !== 'object') {
    return null
  }

  const raw = input as Record<string, unknown>
  const text = String(raw.text ?? '').trim().slice(0, 64)
  const emoji = String(raw.emoji ?? '').trim().slice(0, 8)
  const iconCustomEmojiId = String(raw.iconCustomEmojiId ?? raw.icon_custom_emoji_id ?? '').trim().slice(0, 128)
  if (!text && !emoji) {
    return null
  }

  const styleRaw = String(raw.style || 'default').trim()
  const style = allowedStyles.has(styleRaw as 'default' | 'primary' | 'success' | 'danger')
    ? (styleRaw as 'default' | 'primary' | 'success' | 'danger')
    : 'default'

  return {
    id: String(raw.id || `b_${rowIndex + 1}_${buttonIndex + 1}`).trim().slice(0, 48) || `b_${rowIndex + 1}_${buttonIndex + 1}`,
    text,
    ...(emoji ? { emoji } : {}),
    ...(style !== 'default' ? { style } : { style: 'default' as const }),
    ...(iconCustomEmojiId ? { iconCustomEmojiId } : {}),
  }
}

function sanitizeReplyKeyboardRows(value: unknown): SanitizedReplyKeyboardButton[][] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows: SanitizedReplyKeyboardButton[][] = []
  for (let rowIndex = 0; rowIndex < value.length; rowIndex += 1) {
    const rawRow = value[rowIndex]
    if (!Array.isArray(rawRow)) continue
    const row = rawRow
      .map((button, buttonIndex) => sanitizeReplyKeyboardButton(button, rowIndex, buttonIndex))
      .filter((button): button is SanitizedReplyKeyboardButton => Boolean(button))
      .slice(0, 10)
    if (row.length > 0) {
      rows.push(row)
    }
    if (rows.length >= 12) break
  }

  return rows
}

function sanitizeReplyKeyboardRule(value: unknown, index: number): SanitizedReplyKeyboardRule | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const rawId = String(raw.id || '').trim()
  const id = (rawId || `rule_${index + 1}`).replace(/[^\w:-]+/g, '_').slice(0, 48)
  if (!id) return null

  const operatorRaw = String(raw.operator || 'equals').trim()
  const allowedOperators = new Set([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'gt',
    'lt',
    'gte',
    'lte',
    'isEmpty',
    'isNotEmpty',
  ])
  const operator = allowedOperators.has(operatorRaw) ? operatorRaw : 'equals'

  return {
    id,
    name: String(raw.name || '').trim().slice(0, 80) || `Rule ${index + 1}`,
    enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    variable: String(raw.variable || '').trim().slice(0, 120),
    operator,
    value: String(raw.value ?? '').slice(0, 256),
    rows: sanitizeReplyKeyboardRows(raw.rows),
  }
}

function sanitizeReplyKeyboardFeatureConfig(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : []
  const rules = rulesRaw
    .map((rule, index) => sanitizeReplyKeyboardRule(rule, index))
    .filter((rule): rule is SanitizedReplyKeyboardRule => Boolean(rule))

  return {
    enabled: Boolean(raw.enabled),
    resizeKeyboard: raw.resizeKeyboard === undefined ? true : Boolean(raw.resizeKeyboard),
    oneTimeKeyboard: Boolean(raw.oneTimeKeyboard),
    isPersistent: raw.isPersistent === undefined ? true : Boolean(raw.isPersistent),
    baseRows: sanitizeReplyKeyboardRows(raw.baseRows),
    rules,
  }
}

function normalizeTelegramUsernameCandidate(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const causeRecord =
      error.cause && typeof error.cause === 'object'
        ? (error.cause as Record<string, unknown>)
        : null
    const causeCode = typeof causeRecord?.code === 'string' ? causeRecord.code : ''
    const causeMessage = typeof causeRecord?.message === 'string' ? causeRecord.message : ''
    const details = [causeCode, causeMessage].filter(Boolean).join(' ')
    return details ? `${error.message} [${details}]` : error.message
  }
  return String(error)
}

function isTelegramChatNotFoundError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return message.includes('chat not found')
}

function isTelegramUsernameInvalidError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('chat username is invalid') ||
    message.includes('username is invalid') ||
    message.includes('username invalid')
  )
}

function validateTelegramBotUsernameCandidate(username: string): {
  valid: boolean
  reason?: 'format' | 'suffix'
} {
  if (!/^[a-z][a-z0-9_]{4,31}$/.test(username)) {
    return { valid: false, reason: 'format' }
  }

  if (!username.endsWith('bot')) {
    return { valid: false, reason: 'suffix' }
  }

  return { valid: true }
}

function sanitizeBotStyleMetadataPatch(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const displayName = String(raw.displayName || '').trim().slice(0, 64)
  const desiredUsername = normalizeTelegramUsernameCandidate(raw.desiredUsername).slice(0, 32)
  const avatarUrlRaw = String(raw.avatarUrl || '').trim().slice(0, 512)
  const about = String(raw.about || '').trim().slice(0, 512)
  const shortDescription = String(raw.shortDescription || '').trim().slice(0, 120)

  const isHttpAvatar = /^https?:\/\//i.test(avatarUrlRaw)
  const isLocalAvatarPath = isLocalBotMediaPath(avatarUrlRaw)

  const avatarUrl =
    avatarUrlRaw && (isHttpAvatar || isLocalAvatarPath)
      ? avatarUrlRaw
      : ''

  return {
    displayName,
    desiredUsername,
    avatarUrl,
    about,
    shortDescription,
  }
}

function isLocalBotMediaPath(value: string): boolean {
  const normalized = String(value || '').trim().replace(/\\/g, '/')
  if (!normalized) {
    return false
  }

  return (
    normalized.startsWith(`${LOCAL_BOT_MEDIA_ROOT_DIR}/`) ||
    normalized.startsWith(`.${LOCAL_BOT_MEDIA_ROOT_DIR}/`)
  )
}

function resolveLocalBotMediaAbsolutePath(value: string): string | null {
  const normalized = String(value || '').trim().replace(/\\/g, '/')
  if (!isLocalBotMediaPath(normalized)) {
    return null
  }

  const relativePath = normalized.startsWith('./')
    ? normalized.slice(2)
    : normalized.startsWith('/')
      ? normalized.slice(1)
      : normalized

  return join(process.cwd(), relativePath)
}

function sanitizeSettingsMetadataPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const patch = input as Record<string, unknown>
  const profileStyle = sanitizeBotStyleMetadataPatch(patch.profileStyle)
  const features = patch.features
  const featureRecord =
    features && typeof features === 'object'
      ? (features as Record<string, unknown>)
      : null
  const autoReactions = featureRecord
    ? sanitizeAutoReactionsFeatureConfig(featureRecord.autoReactions)
    : null
  const messageDrafts = featureRecord
    ? sanitizeMessageDraftsFeatureConfig(featureRecord.messageDrafts)
    : null
  const replyKeyboard = featureRecord
    ? sanitizeReplyKeyboardFeatureConfig(featureRecord.replyKeyboard)
    : null
  const subscriberMode = featureRecord
    ? sanitizeSubscriberModeFeatureConfig(featureRecord.subscriberMode)
    : null

  if (!autoReactions && !messageDrafts && !replyKeyboard && !subscriberMode && !profileStyle) {
    return {}
  }

  return {
    ...(autoReactions || messageDrafts || replyKeyboard || subscriberMode
      ? {
          features: {
            ...(autoReactions ? { autoReactions } : {}),
            ...(messageDrafts ? { messageDrafts } : {}),
            ...(replyKeyboard ? { replyKeyboard } : {}),
            ...(subscriberMode ? { subscriberMode } : {}),
          },
        }
      : {}),
    ...(profileStyle ? { profileStyle } : {}),
  }
}

function normalizeNodeType(value: string | null | undefined): WorkflowNode['type'] {
  if (value && ALLOWED_NODE_TYPES.has(value as WorkflowNode['type'])) {
    return value as WorkflowNode['type']
  }
  return 'message'
}

function normalizeNodes(nodes: CanvasNode[]): WorkflowNode[] {
  return nodes.map((node) => ({
    id: String(node.id),
    type: normalizeNodeType(node.type || undefined),
    position: node.position || { x: 0, y: 0 },
    data: node.data || {},
  }))
}

function hasTriggerNode(nodes: WorkflowNode[]): boolean {
  return nodes.some((node) => node.type === 'trigger')
}

function normalizeEdges(edges: CanvasEdge[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: String(edge.id),
    source: String(edge.source),
    target: String(edge.target),
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    label: typeof edge.label === 'string' ? edge.label : undefined,
    data:
      edge.data && typeof edge.data === 'object'
        ? (edge.data as Record<string, unknown>)
        : undefined,
    animated: Boolean(edge.animated),
    type: typeof edge.type === 'string' ? edge.type : undefined,
  }))
}

function normalizeVariableType(value: string | null | undefined): VariableType {
  if (value && ALLOWED_VARIABLE_TYPES.has(value as VariableType)) {
    return value as VariableType
  }
  return 'string'
}

function normalizeVariableScope(
  value: string | null | undefined
): BotVariable['scope'] | undefined {
  if (value && ALLOWED_VARIABLE_SCOPES.has(value as NonNullable<BotVariable['scope']>)) {
    return value as NonNullable<BotVariable['scope']>
  }
  return undefined
}

function normalizeVariables(variables: CanvasVariable[]): BotVariable[] {
  const result: BotVariable[] = []

  for (let index = 0; index < variables.length; index++) {
    const variable = variables[index]
    const name = String(variable.name || '').trim()
    if (!name) {
      continue
    }

    result.push({
      id: String(variable.id || `var_${index}_${Date.now()}`),
      name,
      type: normalizeVariableType(variable.type),
      default_value: variable.default_value ?? '',
      description:
        typeof variable.description === 'string' && variable.description.trim().length > 0
          ? variable.description.trim()
          : undefined,
      scope: normalizeVariableScope(variable.scope),
    })
  }

  return result
}

async function resolveBaseUrl(): Promise<string> {
  const fromEnv =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL

  if (fromEnv) {
    return trimTrailingSlash(fromEnv)
  }

  const requestHeaders = await headers()
  const forwardedHost = requestHeaders.get('x-forwarded-host')
  const host = forwardedHost || requestHeaders.get('host')
  const proto =
    requestHeaders.get('x-forwarded-proto') ||
    (host?.includes('localhost') ? 'http' : 'https')

  if (host) {
    return `${proto}://${host}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${trimTrailingSlash(process.env.VERCEL_URL)}`
  }

  throw new Error('Cannot resolve app URL. Set APP_URL in environment.')
}

async function resolveBaseUrlSafe(): Promise<string | null> {
  try {
    return await resolveBaseUrl()
  } catch {
    return null
  }
}

function canUseWebhook(baseUrl: string | null): boolean {
  if (!baseUrl) return false

  try {
    const parsed = new URL(baseUrl)
    const host = parsed.hostname.toLowerCase()
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.localhost')

    return parsed.protocol === 'https:' && !isLocalHost
  } catch {
    return false
  }
}

function toPlainServerActionPayload<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value, (_key, nestedValue) => {
    if (nestedValue instanceof Date) {
      return nestedValue.toISOString()
    }

    if (typeof nestedValue === 'bigint') {
      return nestedValue.toString()
    }

    if (typeof nestedValue === 'function' || nestedValue === undefined) {
      return undefined
    }

    return nestedValue
  })) as T
}

export async function getEditorBotAction(botId: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    return toPlainServerActionPayload({ success: true, bot })
  } catch (error) {
    console.error('Failed to load editor bot:', error)
    return { success: false, error: String(error) }
  }
}

export async function getBotSubscribersStatsAction(botId: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const stats = await getBotSubscribersStats(supabase as unknown as SubscribersClient, normalizedBotId)
    return { success: true, stats }
  } catch (error) {
    console.error('Failed to load bot subscribers stats:', error)
    return { success: false, error: String(error) }
  }
}

export async function saveCanvasAction(
  botId: string,
  input: {
    nodes: CanvasNode[]
    edges: CanvasEdge[]
    variables?: CanvasVariable[]
    version?: string
  }
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const normalizedConfig: BotConfig = {
      nodes: normalizeNodes(input.nodes),
      edges: normalizeEdges(input.edges),
      variables: input.variables ? normalizeVariables(input.variables) : bot.config.variables || [],
      version: input.version || bot.config.version || '1.0.0',
    }

    await botService.saveBotConfig(botId, normalizedConfig)

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'canvas.saved',
      payload: {
        nodesCount: normalizedConfig.nodes.length,
        edgesCount: normalizedConfig.edges.length,
        variablesCount: normalizedConfig.variables.length,
        version: normalizedConfig.version || '1.0.0',
      },
    })

    if (bot.metadata?.testActive && bot.metadata?.testMode === 'polling') {
      updateTelegramPollingConfig(botId, normalizedConfig)
      // Prevent stale wait/input state from old graph after live config updates.
      clearRuntimeSessionsForBot(botId)
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to save canvas:', error)
    return { success: false, error: String(error) }
  }
}

export async function saveBotSettingsAction(botId: string, input: SaveSettingsInput) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(supabase as unknown as SecretsClient)
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const requestedToken = input.telegramToken.trim()
    const webhookUrl = input.webhookUrl.trim()
    const existingToken = await botSecretsService.getTelegramToken(botId)
    const effectiveToken = requestedToken || existingToken || ''

    if (effectiveToken) {
      // Migrates legacy metadata token into encrypted storage on first save too.
      await botSecretsService.setTelegramToken(botId, effectiveToken)
    }

    const safeMetadataBase = removeSecretFieldsFromMetadata(
      (bot.metadata || {}) as Record<string, unknown>
    )
    const safeSettingsMetadataPatch = sanitizeSettingsMetadataPatch(input.metadataPatch)
    const profileStylePatch =
      safeSettingsMetadataPatch.profileStyle &&
      typeof safeSettingsMetadataPatch.profileStyle === 'object'
        ? (safeSettingsMetadataPatch.profileStyle as Record<string, unknown>)
        : null
    const mergedFeatures =
      safeMetadataBase.features && typeof safeMetadataBase.features === 'object'
        ? {
            ...(safeMetadataBase.features as Record<string, unknown>),
            ...((safeSettingsMetadataPatch.features as Record<string, unknown> | undefined) || {}),
          }
        : ((safeSettingsMetadataPatch.features as Record<string, unknown> | undefined) || undefined)
    const mergedProfileStyle = profileStylePatch
      ? safeMetadataBase.profileStyle && typeof safeMetadataBase.profileStyle === 'object'
        ? {
            ...(safeMetadataBase.profileStyle as Record<string, unknown>),
            ...profileStylePatch,
          }
        : profileStylePatch
      : undefined

    const updatedBot = await botService.updateBot(botId, {
      name: input.name.trim(),
      description: input.description.trim(),
      status: input.status,
      metadata: {
        ...safeMetadataBase,
        ...(mergedFeatures ? { features: mergedFeatures } : {}),
        ...(mergedProfileStyle ? { profileStyle: mergedProfileStyle } : {}),
        webhookUrl,
        hasTelegramToken: Boolean(effectiveToken),
        testActive: requestedToken && requestedToken !== existingToken ? false : bot.metadata?.testActive,
      },
    })

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'settings.saved',
      payload: {
        status: input.status,
        hasTelegramToken: Boolean(effectiveToken),
        tokenUpdated: Boolean(requestedToken),
        webhookUrlSet: Boolean(webhookUrl),
      },
    })

    const withConfig = await botService.getBot(botId)

    return toPlainServerActionPayload({
      success: true,
      bot: withConfig || { ...updatedBot, config: bot.config },
    })
  } catch (error) {
    console.error('Failed to save bot settings:', error)
    return { success: false, error: String(error) }
  }
}

export async function checkTelegramUsernameAvailabilityAction(botId: string, username: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const normalizedUsername = normalizeTelegramUsernameCandidate(username)
  if (!normalizedUsername) {
    return {
      success: true,
      status: 'invalid' as const,
      reason: 'format' as const,
      normalizedUsername,
    }
  }

  const validation = validateTelegramBotUsernameCandidate(normalizedUsername)
  if (!validation.valid) {
    return {
      success: true,
      status: 'invalid' as const,
      reason: validation.reason || 'format',
      normalizedUsername,
    }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(supabase as unknown as SecretsClient)
    const bot = await botService.getBot(normalizedBotId)

    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    const token = String(await botSecretsService.getTelegramToken(normalizedBotId) || '').trim()
    if (!token) {
      return { success: false, error: 'Bot token is missing' as const }
    }

    const me = await callTelegramApi<{ username?: string }>(token, 'getMe')
    const currentUsername = normalizeTelegramUsernameCandidate(me.username)
    if (currentUsername && currentUsername === normalizedUsername) {
      return {
        success: true,
        status: 'unchanged' as const,
        normalizedUsername,
        currentUsername,
      }
    }

    try {
      const chat = await callTelegramApi<{ username?: string }>(token, 'getChat', {
        chat_id: `@${normalizedUsername}`,
      })
      const foundUsername = normalizeTelegramUsernameCandidate(chat.username)
      if (foundUsername && currentUsername && foundUsername === currentUsername) {
        return {
          success: true,
          status: 'unchanged' as const,
          normalizedUsername,
          currentUsername,
        }
      }

      return {
        success: true,
        status: 'taken' as const,
        normalizedUsername,
        currentUsername,
      }
    } catch (error) {
      if (isTelegramChatNotFoundError(error)) {
        return {
          success: true,
          status: 'available' as const,
          normalizedUsername,
          currentUsername,
        }
      }

      if (isTelegramUsernameInvalidError(error)) {
        return {
          success: true,
          status: 'invalid' as const,
          reason: 'format' as const,
          normalizedUsername,
          currentUsername,
        }
      }

      return {
        success: false,
        error: getErrorMessage(error),
      }
    }
  } catch (error) {
    console.error('Failed to check Telegram username availability:', error)
    return {
      success: false,
      error: getErrorMessage(error),
    }
  }
}

export async function syncTelegramBotStyleAction(
  botId: string,
  input: SyncTelegramBotStyleInput
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(supabase as unknown as SecretsClient)
    const bot = await botService.getBot(normalizedBotId)

    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    const token = String(await botSecretsService.getTelegramToken(normalizedBotId) || '').trim()
    if (!token) {
      return { success: false, error: 'Bot token is missing' as const }
    }

    const safeProfileStyle = sanitizeBotStyleMetadataPatch(input) || {
      displayName: '',
      desiredUsername: '',
      avatarUrl: '',
      about: '',
      shortDescription: '',
    }
    const existingProfileStyle =
      bot.metadata?.profileStyle && typeof bot.metadata.profileStyle === 'object'
        ? (bot.metadata.profileStyle as Record<string, unknown>)
        : {}

    const warnings: string[] = []
    const syncErrors: string[] = []
    const applied: string[] = []

    const me = await callTelegramApi<{ username?: string }>(token, 'getMe')
    const currentUsername = normalizeTelegramUsernameCandidate(me.username)
    const desiredUsername = normalizeTelegramUsernameCandidate(safeProfileStyle.desiredUsername)
    const avatarUrl = String(safeProfileStyle.avatarUrl || '').trim()
    const previousAvatarUrl = String(existingProfileStyle.avatarUrl || '').trim()

    const displayName = String(safeProfileStyle.displayName || '').trim()
    if (displayName) {
      try {
        await callTelegramApi(token, 'setMyName', { name: displayName })
        applied.push('displayName')
      } catch (error) {
        syncErrors.push(getErrorMessage(error))
      }
    }

    const about = String(safeProfileStyle.about || '')
    try {
      await callTelegramApi(token, 'setMyDescription', {
        description: about,
      })
      applied.push('about')
    } catch (error) {
      syncErrors.push(getErrorMessage(error))
    }

    const shortDescription = String(safeProfileStyle.shortDescription || '')
    try {
      await callTelegramApi(token, 'setMyShortDescription', {
        short_description: shortDescription,
      })
      applied.push('shortDescription')
    } catch (error) {
      syncErrors.push(getErrorMessage(error))
    }

    if (desiredUsername && desiredUsername !== currentUsername) {
      warnings.push('Username change is managed by @BotFather.')
    }

    if (avatarUrl || previousAvatarUrl) {
      try {
        if (!avatarUrl) {
          await callTelegramApi(token, 'removeMyProfilePhoto')
          applied.push('avatarUrl')
        } else {
          const localAvatarPath = resolveLocalBotMediaAbsolutePath(avatarUrl)

          if (!localAvatarPath) {
            warnings.push('Profile photo sync supports uploaded files from this editor.')
          } else {
            const fileBytes = await readFile(localAvatarPath)
            if (!fileBytes.length) {
              throw new Error('Profile photo file is empty.')
            }

            if (fileBytes.length > MAX_TELEGRAM_PROFILE_PHOTO_BYTES) {
              throw new Error(
                `Profile photo is too large (max ${Math.floor(MAX_TELEGRAM_PROFILE_PHOTO_BYTES / (1024 * 1024))} MB).`
              )
            }

            const attachField = 'profile_photo'
            const fileArrayBuffer = fileBytes.buffer.slice(
              fileBytes.byteOffset,
              fileBytes.byteOffset + fileBytes.byteLength
            ) as ArrayBuffer
            const formData = new FormData()
            formData.append(
              'photo',
              JSON.stringify({
                type: 'static',
                photo: `attach://${attachField}`,
              })
            )
            formData.append(
              attachField,
              new Blob([fileArrayBuffer], { type: 'application/octet-stream' }),
              basename(localAvatarPath) || 'profile_photo.jpg'
            )

            await callTelegramApiFormData(token, 'setMyProfilePhoto', formData)
            applied.push('avatarUrl')
          }
        }
      } catch (error) {
        syncErrors.push(getErrorMessage(error))
      }
    }

    const safeMetadataBase = removeSecretFieldsFromMetadata(
      (bot.metadata || {}) as Record<string, unknown>
    )
    const mergedProfileStyle =
      safeMetadataBase.profileStyle && typeof safeMetadataBase.profileStyle === 'object'
        ? {
            ...(safeMetadataBase.profileStyle as Record<string, unknown>),
            ...safeProfileStyle,
            lastSyncAt: new Date().toISOString(),
          }
        : {
            ...safeProfileStyle,
            lastSyncAt: new Date().toISOString(),
          }

    const updatedBot = await botService.updateBot(normalizedBotId, {
      metadata: {
        ...safeMetadataBase,
        profileStyle: mergedProfileStyle,
      },
    })

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId: normalizedBotId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'settings.telegram_style_synced',
      payload: {
        applied,
        warnings,
        hasErrors: syncErrors.length > 0,
      },
    })

    if (syncErrors.length > 0) {
      return toPlainServerActionPayload({
        success: false,
        error: syncErrors.join('; '),
        warnings,
        applied,
        currentUsername,
        profileStyle: mergedProfileStyle,
        bot: updatedBot,
      })
    }

    return toPlainServerActionPayload({
      success: true,
      warnings,
      applied,
      currentUsername,
      profileStyle: mergedProfileStyle,
      bot: updatedBot,
    })
  } catch (error) {
    console.error('Failed to sync Telegram bot style:', error)
    return {
      success: false,
      error: getErrorMessage(error),
    }
  }
}

export async function startBotTestAction(
  botId: string,
  input?: {
    nodes: CanvasNode[]
    edges: CanvasEdge[]
    variables?: CanvasVariable[]
    version?: string
  }
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(supabase as unknown as SecretsClient)
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const testRunId = randomUUID()
    setBotTestLogRunContext(botId, testRunId)
    clearBotTestLogs(botId)
    appendBotTestLog(botId, 'system', 'Запуск теста бота...')

    const token = String(await botSecretsService.getTelegramToken(botId) || '').trim()
    if (!token) {
      appendBotTestLog(
        botId,
        'system',
        'Не указан Bot Token в настройках Telegram Integration.',
        'error'
      )
      setBotTestLogRunContext(botId, null)
      return {
        success: false,
        error: 'Укажите Bot Token в Settings -> Telegram Integration, затем сохраните настройки.',
      }
    }

    if (input?.nodes && input?.edges) {
      await botService.saveBotConfig(botId, {
        nodes: normalizeNodes(input.nodes),
        edges: normalizeEdges(input.edges),
        variables: input.variables ? normalizeVariables(input.variables) : bot.config.variables || [],
        version: input.version || bot.config.version || '1.0.0',
      })
    }

    clearRuntimeSessionsForBot(botId)

    const runtimeConfig: BotConfig = {
      nodes: input?.nodes ? normalizeNodes(input.nodes) : bot.config.nodes,
      edges: input?.edges ? normalizeEdges(input.edges) : bot.config.edges,
      variables: input?.variables ? normalizeVariables(input.variables) : bot.config.variables || [],
      version: input?.version || bot.config.version || '1.0.0',
    }

    if (!hasTriggerNode(runtimeConfig.nodes)) {
      appendBotTestLog(botId, 'system', 'Нет Trigger-ноды на Canvas. Запуск остановлен.', 'warn')
      setBotTestLogRunContext(botId, null)
      return {
        success: false,
        error:
          'Добавьте хотя бы один Trigger на Canvas (например Command Trigger /start). Без Trigger бот не запускает сценарий.',
      }
    }

    const me = await callTelegramApi<{ id: number; username?: string }>(token, 'getMe')
    if (!me.username) {
      appendBotTestLog(botId, 'telegram', 'У бота нет username в @BotFather.', 'error')
      setBotTestLogRunContext(botId, null)
      return { success: false, error: 'У бота нет username. Настройте бота в @BotFather.' }
    }

    appendBotTestLog(botId, 'telegram', `Bot @${me.username} успешно проверен`)

    const baseUrl = await resolveBaseUrlSafe()

    if (canUseWebhook(baseUrl)) {
      stopTelegramPolling(botId)

      const webhookUrl = `${baseUrl}/api/telegram/webhook/${botId}`
      const webhookSecret = randomUUID()
      await botSecretsService.setWebhookSecret(botId, webhookSecret)

      await callTelegramApi(token, 'setWebhook', {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      })
      appendBotTestLog(botId, 'runtime', `Тест запущен в режиме webhook: ${webhookUrl}`)

      await botService.updateBot(botId, {
        status: 'active',
        metadata: {
          ...removeSecretFieldsFromMetadata((bot.metadata || {}) as Record<string, unknown>),
          botUsername: me.username,
          telegramBotId: me.id,
          webhookUrl,
          hasTelegramToken: true,
          hasWebhookSecret: true,
          testActive: true,
          testMode: 'webhook',
          testRunId,
          testStartedAt: new Date().toISOString(),
        },
      })

      const updatedBot = await botService.getBot(botId)

      await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
        botId,
        actorUserId: user.id,
        source: 'editor',
        eventType: 'test.started',
        payload: {
          mode: 'webhook',
          runId: testRunId,
          botUsername: me.username,
          webhookUrl,
        },
      })

      return toPlainServerActionPayload({
        success: true,
        mode: 'webhook',
        deepLink: `https://t.me/${me.username}?start=test`,
        botUsername: me.username,
        webhookUrl,
        bot: updatedBot,
      })
    }

    await callTelegramApi(token, 'deleteWebhook', {
      drop_pending_updates: true,
    })
    appendBotTestLog(botId, 'telegram', 'Webhook отключен. Переход в polling-режим.')
    await botSecretsService.setWebhookSecret(botId, null)

    const pollingRuntimeMetadata = {
      ...removeSecretFieldsFromMetadata((bot.metadata || {}) as Record<string, unknown>),
      botUsername: me.username,
      telegramBotId: me.id,
      webhookUrl: '',
      hasTelegramToken: true,
      hasWebhookSecret: false,
      testActive: true,
      testMode: 'polling',
      testRunId,
      testStartedAt: new Date().toISOString(),
    }

    await botService.updateBot(botId, {
      status: 'active',
      metadata: pollingRuntimeMetadata,
    })

    startTelegramPolling({
      botId,
      botToken: token,
      config: runtimeConfig,
      metadata: pollingRuntimeMetadata,
      testRunId,
    })
    appendBotTestLog(botId, 'runtime', 'Тест запущен в polling-режиме (локально)')

    const updatedBot = await botService.getBot(botId)

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'test.started',
      payload: {
        mode: 'polling',
        runId: testRunId,
        botUsername: me.username,
      },
    })

    return toPlainServerActionPayload({
      success: true,
      mode: 'polling',
      deepLink: `https://t.me/${me.username}?start=test`,
      botUsername: me.username,
      webhookUrl: '',
      info: 'Локальный тест запущен в polling-режиме',
      bot: updatedBot,
    })
  } catch (error) {
    console.error('Failed to start bot test:', error)
    const userFacingError = toTelegramTestStartErrorMessage(error)
    appendBotTestLog(botId, 'system', `Ошибка запуска теста: ${userFacingError}`, 'error')
    try {
      const supabase = await createServerClientWrapper()
      await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
        botId,
        actorUserId: user.id,
        source: 'editor',
        eventType: 'test.start_failed',
        payload: {
          error: userFacingError,
          rawError: String(error),
        },
      })
    } catch {
      // ignore audit write errors on failure path
    }
    setBotTestLogRunContext(botId, null)
    return { success: false, error: userFacingError }
  }
}

export async function stopBotTestAction(botId: string) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const botSecretsService = createBotSecretsService(supabase as unknown as SecretsClient)
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    setBotTestLogRunContext(botId, String(bot.metadata?.testRunId || ''))
    appendBotTestLog(botId, 'system', 'Остановка теста бота...')

    stopTelegramPolling(botId)
    clearRuntimeSessionsForBot(botId)

    const token = String(await botSecretsService.getTelegramToken(botId) || '').trim()
    if (token) {
      try {
        await callTelegramApi(token, 'deleteWebhook', {
          drop_pending_updates: true,
        })
      } catch (error) {
        console.error('Failed to delete webhook during stop:', error)
        appendBotTestLog(botId, 'telegram', `Ошибка удаления webhook: ${String(error)}`, 'warn')
      }
    }

    await botSecretsService.setWebhookSecret(botId, null)

    await botService.updateBot(botId, {
      metadata: {
        ...removeSecretFieldsFromMetadata((bot.metadata || {}) as Record<string, unknown>),
        testActive: false,
        testMode: 'stopped',
        testRunId: null,
        testStoppedAt: new Date().toISOString(),
        hasWebhookSecret: false,
      },
    })

    const updatedBot = await botService.getBot(botId)
    setBotTestLogRunContext(botId, null)

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'test.stopped',
      payload: {
        previousRunId: String(bot.metadata?.testRunId || '') || null,
      },
    })

    return toPlainServerActionPayload({
      success: true,
      bot: updatedBot,
    })
  } catch (error) {
    console.error('Failed to stop bot test:', error)
    appendBotTestLog(botId, 'system', `Ошибка остановки теста: ${String(error)}`, 'error')
    return { success: false, error: String(error) }
  }
}

export async function getBotTestLogsAction(
  botId: string,
  options?: { sinceTs?: number; limit?: number }
) {
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found', entries: [] as ReturnType<typeof getBotTestLogs> }
  }

  // Logs are stored in local runtime memory for the currently running test session.
  // Polling this endpoint every second should not hard-fail the UI if auth cookies
  // are temporarily unavailable during dev/HMR/session refresh. We still try to
  // validate access when possible, but fall back to returning in-memory logs.
  let canValidateAccess = false
  let currentRunId: string | null = null

  try {
    const user = await getServerUser()
    if (user) {
      canValidateAccess = true
      const supabase = await createServerClientWrapper()
      const botService = createBotService(supabase)
      const bot = await botService.getBot(normalizedBotId)
      if (!bot) {
        const entries = toPublicBotTestLogEntries(getBotTestLogs(normalizedBotId, options))
        return { success: true, entries }
      }
      currentRunId = String(bot.metadata?.testRunId || '').trim() || null
    }
  } catch {
    // Ignore auth/db transient errors for log polling; return in-memory entries below.
  }

  const persistentEntries = toPublicBotTestLogEntries(
    canValidateAccess
      ? await getPersistentBotTestLogs(normalizedBotId, {
          ...options,
          runId: currentRunId,
        })
      : []
  )
  const memoryEntries = toPublicBotTestLogEntries(getBotTestLogs(normalizedBotId, options))
  const mergedEntries = mergeBotTestLogs(persistentEntries, memoryEntries)
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 500))
  const entries =
    mergedEntries.length > limit
      ? mergedEntries.slice(mergedEntries.length - limit)
      : mergedEntries
  if (!canValidateAccess && entries.length === 0) {
    // Keep response successful to avoid noisy UI errors while polling before the
    // first log line appears or during temporary auth refresh.
    return { success: true, entries }
  }

  return { success: true, entries }
}

export async function clearBotTestLogsAction(botId: string) {
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    clearBotTestLogs(normalizedBotId)

    const { error } = await supabase
      .from('bot_test_logs')
      .delete()
      .eq('bot_id', normalizedBotId)

    if (error) {
      return { success: false, error: String(error) } as const
    }

    await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
      botId: normalizedBotId,
      actorUserId: user.id,
      source: 'editor',
      eventType: 'logs.cleared',
      payload: {
        clearedAt: new Date().toISOString(),
      },
    })

    return { success: true } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function uploadBotMessageAttachmentAction(botId: string, file: File) {
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    if (!(file instanceof File)) {
      return { success: false, error: 'Invalid file' as const }
    }

    if (!file.size || file.size <= 0) {
      return { success: false, error: 'Empty file' as const }
    }

    if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
      return {
        success: false,
        error: `File is too large (max ${Math.floor(MAX_LOCAL_ATTACHMENT_BYTES / (1024 * 1024))} MB)` as const,
      }
    }

    const safeFileName = sanitizeAttachmentFileName(file.name)
    const fileId = `${Date.now()}_${randomUUID().slice(0, 8)}`
    const botDir = join(process.cwd(), LOCAL_BOT_MEDIA_ROOT_DIR, normalizedBotId)
    await mkdir(botDir, { recursive: true })

    const storedFileName = `${fileId}_${safeFileName}`
    const absolutePath = join(botDir, storedFileName)
    const relativePath = `${LOCAL_BOT_MEDIA_ROOT_DIR}/${normalizedBotId}/${storedFileName}`

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(absolutePath, bytes)

    return {
      success: true,
      path: relativePath,
      fileName: safeFileName,
      size: bytes.length,
      mimeType: file.type || '',
    } as const
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function exportBotZipAction(botId: string) {
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    const pythonCode = generatePythonBotCode()
    const requirementsTxt = generatePythonRequirements()
    const envTemplate = generatePythonEnvTemplate()
    const workflowJson = generateWorkflowJson(bot.config)
    const readme = `# ${bot.name || 'Telegram Bot'}

Generated by TFlow.

## Run
1. Create virtual environment:
\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
\`\`\`

2. Install dependencies:
\`\`\`bash
pip install -r requirements.txt
\`\`\`

3. Add token to \`.env\`:
\`\`\`env
BOT_TOKEN=your_telegram_bot_token_here
\`\`\`

4. Start:
\`\`\`bash
python3 main.py
\`\`\`
`

    const zipBuffer = createZipArchive([
      { name: 'main.py', content: pythonCode },
      { name: 'workflow.json', content: workflowJson },
      { name: 'requirements.txt', content: requirementsTxt },
      { name: '.env.example', content: envTemplate },
      { name: 'README.md', content: readme },
    ])

    const fileName = `${sanitizeArchiveBaseName(bot.name || normalizedBotId)}.zip`

    return {
      success: true,
      fileName,
      zipBase64: zipBuffer.toString('base64'),
    } as const
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

type BotTestLogStatsRow = {
  id: string
  source: string | null
  level: string | null
  message: string | null
  created_at: string | null
  ts_ms: number | null
}

type BotAuditStatsRow = {
  id: string
  event_type: string | null
  created_at: string | null
  payload: unknown
}

const TECH_RANGE_MS: Record<BotTechnicalStatsRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

function getTechRangeSinceIso(range: BotTechnicalStatsRange): string {
  return new Date(Date.now() - TECH_RANGE_MS[range]).toISOString()
}

function normalizeRange(rawRange: string | undefined): BotTechnicalStatsRange {
  if (rawRange === '1h' || rawRange === '7d') {
    return rawRange
  }
  return '24h'
}

function parseTimestampMs(row: BotTestLogStatsRow): number | null {
  if (Number.isFinite(Number(row.ts_ms))) {
    return Number(row.ts_ms)
  }
  if (typeof row.created_at === 'string' && row.created_at) {
    const parsed = Date.parse(row.created_at)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getBucketSizeMs(range: BotTechnicalStatsRange): number {
  if (range === '1h') return 5 * 60 * 1000
  if (range === '24h') return 60 * 60 * 1000
  return 6 * 60 * 60 * 1000
}

function buildTimeline(
  rows: BotTestLogStatsRow[],
  range: BotTechnicalStatsRange,
  sinceMs: number
) {
  const bucketSizeMs = getBucketSizeMs(range)
  const buckets = new Map<number, { total: number; error: number; warn: number }>()

  for (const row of rows) {
    const timestampMs = parseTimestampMs(row)
    if (!Number.isFinite(timestampMs)) continue
    if ((timestampMs as number) < sinceMs) continue
    const bucketStartMs = Math.floor((timestampMs as number) / bucketSizeMs) * bucketSizeMs
    const existing = buckets.get(bucketStartMs) || { total: 0, error: 0, warn: 0 }
    existing.total += 1
    const level = String(row.level || '').toLowerCase()
    if (level === 'error') existing.error += 1
    if (level === 'warn') existing.warn += 1
    buckets.set(bucketStartMs, existing)
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([bucketStartMs, values]) => ({
      bucketStart: new Date(bucketStartMs).toISOString(),
      total: values.total,
      error: values.error,
      warn: values.warn,
    }))
}

function createEmptyTechnicalSummary(): BotTechnicalStatsSummary {
  return {
    totalEvents: 0,
    errorCount: 0,
    warnCount: 0,
    errorRatePercent: 0,
    telegramErrors: 0,
    eventsPerMinute: 0,
    testStarts: 0,
    testStops: 0,
    canvasSaves: 0,
    settingsSaves: 0,
    totalSubscribers: 0,
    active7dSubscribers: 0,
    activeRangeSubscribers: 0,
  }
}

const PAYMENT_PERIOD_MS: Record<Exclude<BotPaymentHistoryPeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const PAYMENT_AUDIT_EVENT_TYPES = [
  'payment.created',
  'payment.updated',
  'payment.completed',
  'payment.failed',
  'payment.status_changed',
] as const

const PAYMENT_SUCCESS_STATUSES = new Set(['succeeded', 'success', 'paid', 'completed'])
const PAYMENT_PENDING_STATUSES = new Set(['pending', 'open', 'created', 'processing', 'waiting_for_capture'])
const PAYMENT_FAILED_STATUSES = new Set(['failed', 'canceled', 'cancelled', 'expired', 'refunded', 'error'])

function normalizePaymentPeriod(rawPeriod: string | undefined): BotPaymentHistoryPeriod {
  if (rawPeriod === '24h' || rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === 'all') {
    return rawPeriod
  }
  return '30d'
}

function getPaymentPeriodSinceIso(period: BotPaymentHistoryPeriod): string | null {
  if (period === 'all') {
    return null
  }
  return new Date(Date.now() - PAYMENT_PERIOD_MS[period]).toISOString()
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(',', '.'))
    return Number.isFinite(normalized) ? normalized : null
  }
  return null
}

function toIntegerOrNull(value: unknown): number | null {
  const normalized = toNumberOrNull(value)
  if (!Number.isFinite(Number(normalized))) {
    return null
  }
  const rounded = Math.round(Number(normalized))
  return Number.isFinite(rounded) ? rounded : null
}

function toText(value: unknown): string {
  return String(value || '').trim()
}

function normalizePaymentMethod(value: unknown): string {
  const normalized = toText(value).toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized === 'telegram-stars' || normalized === 'telegram stars') return 'telegram_stars'
  return normalized
}

function normalizePaymentStatus(value: unknown): string {
  const normalized = toText(value).toLowerCase()
  return normalized || 'unknown'
}

function classifyPaymentStatus(status: string): 'success' | 'pending' | 'failed' | 'other' {
  if (PAYMENT_SUCCESS_STATUSES.has(status)) return 'success'
  if (PAYMENT_PENDING_STATUSES.has(status)) return 'pending'
  if (PAYMENT_FAILED_STATUSES.has(status)) return 'failed'
  return 'other'
}

function parsePaymentItemFromAuditRow(row: BotAuditStatsRow): BotPaymentHistoryItem | null {
  if (!row || typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) {
    return null
  }

  const payload = row.payload as Record<string, unknown>
  const paymentId = toText(payload.paymentId || payload.invoiceId || payload.id) || String(row.id || '')
  const method = normalizePaymentMethod(payload.method || payload.provider || payload.paymentProvider)
  const status = normalizePaymentStatus(payload.status || payload.paymentStatus)
  const amount = toNumberOrNull(payload.amount)
  const currency = toText(payload.currency).toUpperCase()

  const payerId = toIntegerOrNull(payload.telegramUserId || payload.userId || payload.payerId)
  const payerUsername = toText(payload.username || payload.payerUsername)
  const payerFirstName = toText(payload.firstName || payload.first_name || payload.payerFirstName)
  const payerLastName = toText(payload.lastName || payload.last_name || payload.payerLastName)
  const payerName = [payerFirstName, payerLastName].filter(Boolean).join(' ').trim()

  return {
    id: String(row.id || ''),
    paymentId,
    method,
    status,
    amount,
    currency,
    payerId,
    payerUsername,
    payerName,
    createdAt: toText(row.created_at),
  }
}

function matchesPaymentSearch(item: BotPaymentHistoryItem, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  const searchableParts = [
    item.id,
    item.paymentId,
    item.method,
    item.status,
    item.payerName,
    item.payerUsername,
    item.payerId ? String(item.payerId) : '',
  ]

  return searchableParts.some((part) => part.toLowerCase().includes(search))
}

export async function getDashboardCrmOverviewAction(filters: CrmFilters = {}) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const viewerAccess = await getViewerAccess(user.id)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.crm)) {
      return { success: false, error: 'CRM is not available on the current plan' as const }
    }

    const supabase = await createServerClientWrapper()
    const overview = await getDashboardCrmOverview(
      supabase as unknown as Parameters<typeof getDashboardCrmOverview>[0],
      user.id,
      filters
    )
    return { success: true, overview } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getDashboardCrmLeadsAction(
  filters: CrmFilters = {},
  page = 1,
  pageSize = 25
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const viewerAccess = await getViewerAccess(user.id)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.crm)) {
      return { success: false, error: 'CRM is not available on the current plan' as const }
    }

    const supabase = await createServerClientWrapper()
    const result = await getDashboardCrmLeads(
      supabase as unknown as Parameters<typeof getDashboardCrmLeads>[0],
      user.id,
      filters,
      {
        page,
        pageSize,
      }
    )

    return { success: true, result } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getLeadTimelineAction(
  botId: string,
  telegramUserId: number,
  cursor?: string | null,
  limit = 60
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const viewerAccess = await getViewerAccess(user.id)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.crm)) {
      return { success: false, error: 'CRM is not available on the current plan' as const }
    }

    const supabase = await createServerClientWrapper()
    const timeline = await getLeadTimeline(
      supabase as unknown as Parameters<typeof getLeadTimeline>[0],
      user.id,
      botId,
      telegramUserId,
      {
        cursor: cursor || null,
        limit,
      }
    )
    return { success: true, timeline } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function updateLeadStageAction(input: {
  botId: string
  telegramUserId: number
  stage: LeadStage
  notes?: string
  tags?: string[]
}) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const viewerAccess = await getViewerAccess(user.id)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.crm)) {
      return { success: false, error: 'CRM is not available on the current plan' as const }
    }

    const supabase = await createServerClientWrapper()
    const lead = await updateLeadStage(
      supabase as unknown as Parameters<typeof updateLeadStage>[0],
      user.id,
      input
    )
    return { success: true, lead } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getBotTechnicalStatsAction(
  botId: string,
  range: BotTechnicalStatsRange = '24h'
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const normalizedRange = normalizeRange(range)
  const sinceIso = getTechRangeSinceIso(normalizedRange)
  const sinceMs = Date.parse(sinceIso)
  const active7dSinceIso = new Date(Date.now() - TECH_RANGE_MS['7d']).toISOString()

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    const [
      logsResult,
      auditResult,
      totalSubscribersResult,
      active7dSubscribersResult,
      activeRangeSubscribersResult,
    ] = await Promise.all([
      supabase
        .from('bot_test_logs')
        .select('id, source, level, message, created_at, ts_ms')
        .eq('bot_id', normalizedBotId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(5000),
      supabase
        .from('bot_audit_events')
        .select('id, event_type, payload, created_at')
        .eq('bot_id', normalizedBotId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('bot_subscribers')
        .select('id', { head: true, count: 'exact' })
        .eq('bot_id', normalizedBotId),
      supabase
        .from('bot_subscribers')
        .select('id', { head: true, count: 'exact' })
        .eq('bot_id', normalizedBotId)
        .gte('last_seen_at', active7dSinceIso),
      supabase
        .from('bot_subscribers')
        .select('id', { head: true, count: 'exact' })
        .eq('bot_id', normalizedBotId)
        .gte('last_seen_at', sinceIso),
    ])

    if (logsResult.error) {
      return { success: false, error: String(logsResult.error) } as const
    }
    if (auditResult.error) {
      return { success: false, error: String(auditResult.error) } as const
    }
    if (totalSubscribersResult.error) {
      return { success: false, error: String(totalSubscribersResult.error) } as const
    }
    if (active7dSubscribersResult.error) {
      return { success: false, error: String(active7dSubscribersResult.error) } as const
    }
    if (activeRangeSubscribersResult.error) {
      return { success: false, error: String(activeRangeSubscribersResult.error) } as const
    }

    const logRows = (Array.isArray(logsResult.data) ? logsResult.data : []) as BotTestLogStatsRow[]
    const auditRows = (Array.isArray(auditResult.data) ? auditResult.data : []) as BotAuditStatsRow[]

    const summary = createEmptyTechnicalSummary()
    summary.totalEvents = logRows.length
    summary.errorCount = logRows.filter((row) => String(row.level || '').toLowerCase() === 'error').length
    summary.warnCount = logRows.filter((row) => String(row.level || '').toLowerCase() === 'warn').length
    summary.telegramErrors = logRows.filter((row) => {
      return (
        String(row.level || '').toLowerCase() === 'error' &&
        String(row.source || '').toLowerCase() === 'telegram'
      )
    }).length
    summary.errorRatePercent =
      summary.totalEvents > 0
        ? Number(((summary.errorCount / summary.totalEvents) * 100).toFixed(2))
        : 0
    summary.eventsPerMinute = Number(
      (summary.totalEvents / Math.max(1, TECH_RANGE_MS[normalizedRange] / (60 * 1000))).toFixed(2)
    )

    summary.testStarts = auditRows.filter((row) => String(row.event_type || '') === 'test.started').length
    summary.testStops = auditRows.filter((row) => String(row.event_type || '') === 'test.stopped').length
    summary.canvasSaves = auditRows.filter((row) => String(row.event_type || '') === 'canvas.saved').length
    summary.settingsSaves = auditRows.filter((row) => String(row.event_type || '') === 'settings.saved').length
    summary.totalSubscribers = Number(totalSubscribersResult.count || 0)
    summary.active7dSubscribers = Number(active7dSubscribersResult.count || 0)
    summary.activeRangeSubscribers = Number(activeRangeSubscribersResult.count || 0)

    const topErrorSourceMap = new Map<string, number>()
    for (const row of logRows) {
      if (String(row.level || '').toLowerCase() !== 'error') continue
      const source = String(row.source || 'unknown').trim() || 'unknown'
      topErrorSourceMap.set(source, (topErrorSourceMap.get(source) || 0) + 1)
    }

    const topErrorSources = Array.from(topErrorSourceMap.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }))

    const stats: BotTechnicalStats = {
      range: normalizedRange,
      summary,
      timeline: buildTimeline(logRows, normalizedRange, Number.isFinite(sinceMs) ? sinceMs : 0),
      topErrorSources,
      recentAuditEvents: auditRows.slice(0, 20).map((row) => ({
        id: String(row.id || ''),
        eventType: String(row.event_type || ''),
        createdAt: String(row.created_at || ''),
        payload:
          row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>)
            : {},
      })),
    }

    return {
      success: true,
      stats,
    } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getBotPaymentHistoryAction(
  botId: string,
  filters: BotPaymentHistoryFilters = {}
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const period = normalizePaymentPeriod(filters.period)
  const search = String(filters.search || '').trim()
  const methodFilter = normalizePaymentMethod(filters.method)
  const statusFilter = normalizePaymentStatus(filters.status)
  const sinceIso = getPaymentPeriodSinceIso(period)

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    let query = supabase
      .from('bot_audit_events')
      .select('id, event_type, payload, created_at')
      .eq('bot_id', normalizedBotId)
      .in('event_type', [...PAYMENT_AUDIT_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(2000)

    if (sinceIso) {
      query = query.gte('created_at', sinceIso)
    }

    const auditResult = await query
    if (auditResult.error) {
      return { success: false, error: String(auditResult.error) } as const
    }

    const parsedItems = ((Array.isArray(auditResult.data) ? auditResult.data : []) as BotAuditStatsRow[])
      .map(parsePaymentItemFromAuditRow)
      .filter((item): item is BotPaymentHistoryItem => Boolean(item))

    const methods = Array.from(
      new Set(parsedItems.map((item) => item.method).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))
    const statuses = Array.from(
      new Set(parsedItems.map((item) => item.status).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))

    const filteredItems = parsedItems.filter((item) => {
      if (search && !matchesPaymentSearch(item, search)) {
        return false
      }
      if (methodFilter !== 'unknown' && methodFilter !== 'all' && item.method !== methodFilter) {
        return false
      }
      if (statusFilter !== 'unknown' && statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      return true
    })

    const summary = filteredItems.reduce<BotPaymentHistory['summary']>(
      (acc, item) => {
        acc.totalCount += 1
        if (item.amount !== null) {
          acc.totalAmount += item.amount
        }

        const classification = classifyPaymentStatus(item.status)
        if (classification === 'success') acc.successCount += 1
        if (classification === 'pending') acc.pendingCount += 1
        if (classification === 'failed') acc.failedCount += 1
        return acc
      },
      {
        totalCount: 0,
        totalAmount: 0,
        successCount: 0,
        pendingCount: 0,
        failedCount: 0,
      }
    )

    const history: BotPaymentHistory = {
      period,
      methods,
      statuses,
      summary: {
        ...summary,
        totalAmount: Number(summary.totalAmount.toFixed(2)),
      },
      items: filteredItems.slice(0, 500),
    }

    return {
      success: true,
      history,
    } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getBotSubscribersAnalyticsAction(
  botId: string,
  filters: {
    period?: BotSubscribersPeriod
    source?: 'all' | BotSubscribersSource
    search?: string
  } = {},
  page = 1,
  pageSize = 25
) {
  const user = await getServerUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return { success: false, error: 'Bot not found' as const }
  }

  const normalizedPage = normalizeDashboardGlobalPage(page)
  const normalizedPageSize = normalizeDashboardGlobalPageSize(pageSize)
  const period = normalizeDashboardGlobalPeriod(filters.period) as BotSubscribersPeriod
  const source = normalizeDashboardGlobalSource(filters.source)
  const search = normalizeDashboardSearch(filters.search)
  const sinceIso = getDashboardGlobalSinceIso(period)

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const bot = await botService.getBot(normalizedBotId)
    if (!bot) {
      return { success: false, error: 'Bot not found' as const }
    }

    const totalQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)

    let activeQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)

    let newQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .eq('bot_id', normalizedBotId)

    if (source !== 'all') {
      activeQuery = activeQuery.eq('source', source)
      newQuery = newQuery.eq('source', source)
    }
    if (sinceIso) {
      activeQuery = activeQuery.gte('last_seen_at', sinceIso)
      newQuery = newQuery.gte('first_seen_at', sinceIso)
    }

    let analyticsQuery = supabase
      .from('bot_subscribers')
      .select('source, language_code, last_seen_at')
      .eq('bot_id', normalizedBotId)
      .order('last_seen_at', { ascending: false })
      .limit(5000)

    if (source !== 'all') {
      analyticsQuery = analyticsQuery.eq('source', source)
    }
    if (sinceIso) {
      analyticsQuery = analyticsQuery.gte('last_seen_at', sinceIso)
    }

    let listQuery = supabase
      .from('bot_subscribers')
      .select(
        'telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at',
        { count: 'exact' }
      )
      .eq('bot_id', normalizedBotId)
      .order('last_seen_at', { ascending: false })

    if (source !== 'all') {
      listQuery = listQuery.eq('source', source)
    }
    if (sinceIso) {
      listQuery = listQuery.gte('last_seen_at', sinceIso)
    }
    if (search) {
      const numericSearch = Number(search)
      if (Number.isFinite(numericSearch)) {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,telegram_user_id.eq.${Math.round(numericSearch)}`
        )
      } else {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
        )
      }
    }

    const from = (normalizedPage - 1) * normalizedPageSize
    const to = from + normalizedPageSize - 1

    const [totalResult, activeResult, newResult, analyticsResult, listResult] = await Promise.all([
      totalQuery,
      activeQuery,
      newQuery,
      analyticsQuery,
      listQuery.range(from, to),
    ])

    if (totalResult.error) {
      return { success: false, error: String(totalResult.error) } as const
    }
    if (activeResult.error) {
      return { success: false, error: String(activeResult.error) } as const
    }
    if (newResult.error) {
      return { success: false, error: String(newResult.error) } as const
    }
    if (analyticsResult.error) {
      return { success: false, error: String(analyticsResult.error) } as const
    }
    if (listResult.error) {
      return { success: false, error: String(listResult.error) } as const
    }

    const analyticsRows = (Array.isArray(analyticsResult.data) ? analyticsResult.data : []) as Array<Record<string, unknown>>
    const listRows = (Array.isArray(listResult.data) ? listResult.data : []) as DashboardGlobalSubscriberRow[]

    const sourceCounts: Record<BotSubscribersSource, number> = {
      message: 0,
      callback_query: 0,
      unknown: 0,
    }
    const languageCounts = new Map<string, number>()

    for (const row of analyticsRows) {
      const sourceKey = normalizeDashboardSubscriberSource(row.source)
      sourceCounts[sourceKey] += 1

      const code = String(row.language_code || '').trim().toLowerCase()
      if (code) {
        languageCounts.set(code, (languageCounts.get(code) || 0) + 1)
      }
    }

    const data: BotSubscribersAnalytics = {
      period,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: Number(listResult.count || 0),
      summary: {
        totalSubscribers: Number(totalResult.count || 0),
        activeInPeriod: Number(activeResult.count || 0),
        newInPeriod: Number(newResult.count || 0),
        lastSeenAt: analyticsRows.length
          ? (toText((analyticsRows[0] as Record<string, unknown>).last_seen_at) || null)
          : null,
      },
      sourceCounts,
      topLanguages: Array.from(languageCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([code, count]) => ({ code, count })),
      items: listRows.map((row) => ({
        telegramUserId: Number(row.telegram_user_id || 0),
        telegramChatId: Number.isFinite(Number(row.telegram_chat_id)) ? Number(row.telegram_chat_id) : null,
        username: toText(row.username),
        firstName: toText(row.first_name),
        lastName: toText(row.last_name),
        languageCode: toText(row.language_code),
        source: normalizeDashboardSubscriberSource(row.source),
        firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
        lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
      })),
    }

    return { success: true, data } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

type DashboardOwnedBot = {
  id: string
  name: string
}

type DashboardGlobalPaymentAuditRow = {
  id: string | null
  bot_id: string | null
  event_type: string | null
  payload: unknown
  created_at: string | null
}

type DashboardGlobalSubscriberRow = {
  bot_id: string | null
  telegram_user_id: number | null
  telegram_chat_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  language_code: string | null
  source: string | null
  first_seen_at: string | null
  last_seen_at: string | null
}

type DashboardGlobalContactRow = {
  bot_id?: string | null
  telegram_user_id?: number | null
  created_at: string | null
}

type DashboardGlobalRetentionSubscriberRow = {
  bot_id: string | null
  telegram_user_id: number | null
  first_seen_at: string | null
}

type DashboardParsedPaymentRecord = DashboardGlobalPaymentItem & {
  createdAtMs: number
}

type DashboardGlobalPaymentAggregate = DashboardGlobalPaymentItem & {
  latestAtMs: number
}

type DashboardGlobalPeriodRange = {
  comparisonAvailable: boolean
  currentSinceIso: string | null
  currentSinceMs: number | null
  previousSinceIso: string | null
  previousSinceMs: number | null
  previousUntilMs: number | null
}

const DASHBOARD_GLOBAL_PERIOD_MS: Record<Exclude<DashboardGlobalStatsPeriod, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function normalizeDashboardGlobalPeriod(rawPeriod: string | undefined): DashboardGlobalStatsPeriod {
  if (rawPeriod === '24h' || rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === 'all') {
    return rawPeriod
  }
  return '30d'
}

function getDashboardGlobalSinceIso(period: DashboardGlobalStatsPeriod): string | null {
  if (period === 'all') {
    return null
  }
  return new Date(Date.now() - DASHBOARD_GLOBAL_PERIOD_MS[period]).toISOString()
}

function getDashboardGlobalPeriodRange(period: DashboardGlobalStatsPeriod): DashboardGlobalPeriodRange {
  if (period === 'all') {
    return {
      comparisonAvailable: false,
      currentSinceIso: null,
      currentSinceMs: null,
      previousSinceIso: null,
      previousSinceMs: null,
      previousUntilMs: null,
    }
  }

  const nowMs = Date.now()
  const durationMs = DASHBOARD_GLOBAL_PERIOD_MS[period]
  const currentSinceMs = nowMs - durationMs
  const previousSinceMs = currentSinceMs - durationMs

  return {
    comparisonAvailable: true,
    currentSinceIso: new Date(currentSinceMs).toISOString(),
    currentSinceMs,
    previousSinceIso: new Date(previousSinceMs).toISOString(),
    previousSinceMs,
    previousUntilMs: currentSinceMs,
  }
}

function normalizeDashboardGlobalPage(page: number): number {
  const normalized = Number(page)
  if (!Number.isFinite(normalized) || normalized < 1) return 1
  return Math.floor(normalized)
}

function normalizeDashboardGlobalPageSize(pageSize: number): number {
  const normalized = Number(pageSize)
  if (!Number.isFinite(normalized) || normalized < 1) return 25
  return Math.min(100, Math.floor(normalized))
}

function normalizeDashboardGlobalSource(value: string | undefined): BotSubscribersSource | 'all' {
  if (value === 'message' || value === 'callback_query' || value === 'unknown') {
    return value
  }
  return 'all'
}

function normalizeDashboardSearch(value: string | undefined): string {
  return String(value || '')
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDashboardTimestampMs(value: string | null | undefined): number {
  const parsed = Date.parse(String(value || ''))
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return 0
}

function normalizeDashboardSubscriberSource(rawSource: unknown): BotSubscribersSource {
  const normalized = String(rawSource || '').trim().toLowerCase()
  if (normalized === 'message' || normalized === 'callback_query') {
    return normalized
  }
  return 'unknown'
}

function roundTo(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(digits))
}

function normalizeDeltaDirection(
  current: number,
  previous: number
): DashboardGlobalStats['comparison']['revenue']['direction'] {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'none'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

function divideNumbersSafe(numerator: number, denominator: number, digits = 2): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0
  return roundTo(numerator / denominator, digits)
}

function toPercentSafe(numerator: number, denominator: number, digits = 2): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0
  return roundTo((numerator / denominator) * 100, digits)
}

function buildDashboardGlobalDelta(
  current: number,
  previous: number,
  options: {
    available?: boolean
    allowZeroBaseline?: boolean
    digits?: number
  } = {}
): DashboardGlobalStats['comparison']['revenue'] {
  const available = options.available ?? true
  const digits = options.digits ?? 2

  if (!available) {
    return {
      current: roundTo(current, digits),
      previous: roundTo(previous, digits),
      deltaPercent: null,
      direction: 'none',
      available: false,
    }
  }

  const deltaPercent =
    previous > 0
      ? roundTo(((current - previous) / previous) * 100, digits)
      : options.allowZeroBaseline && current === 0
        ? 0
        : null

  return {
    current: roundTo(current, digits),
    previous: roundTo(previous, digits),
    deltaPercent,
    direction: normalizeDeltaDirection(current, previous),
    available: true,
  }
}

function buildCurrencyTotals(
  items: Array<{ amount: number | null; currency: string | null | undefined }>
): DashboardGlobalCurrencyTotal[] {
  const totals = new Map<string, number>()

  for (const item of items) {
    if (item.amount === null || !Number.isFinite(item.amount)) continue
    const currency = toText(item.currency).toUpperCase() || 'UNKNOWN'
    totals.set(currency, (totals.get(currency) || 0) + item.amount)
  }

  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount: roundTo(amount, 2) }))
    .sort((left, right) => right.amount - left.amount)
}

function buildDashboardMoneySummary(
  items: Array<{ amount: number | null; currency: string | null | undefined }>
): DashboardGlobalMoneySummary {
  return {
    count: items.length,
    totalAmount: roundTo(
      items.reduce((sum, item) => sum + (item.amount !== null && Number.isFinite(item.amount) ? item.amount : 0), 0),
      2
    ),
    currencyTotals: buildCurrencyTotals(items),
  }
}

function calculateMedian(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middleIndex = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return roundTo((sorted[middleIndex - 1] + sorted[middleIndex]) / 2, 2)
  }
  return roundTo(sorted[middleIndex], 2)
}

async function getOwnedDashboardBots(
  supabase: Awaited<ReturnType<typeof createServerClientWrapper>> | ReturnType<typeof createAdminClient>,
  userId: string,
  botId?: string
): Promise<DashboardOwnedBot[]> {
  let query = supabase
    .from('bots')
    .select('id, name')
    .eq('user_id', userId)

  const normalizedBotId = String(botId || '').trim()
  if (normalizedBotId && normalizedBotId !== 'all') {
    query = query.eq('id', normalizedBotId)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) {
    throw new Error(String(error))
  }

  return (Array.isArray(data) ? data : [])
    .map((item) => ({
      id: String((item as Record<string, unknown>).id || ''),
      name: toText((item as Record<string, unknown>).name) || String((item as Record<string, unknown>).id || ''),
    }))
    .filter((item) => item.id)
}

function parseDashboardPaymentFromAuditRow(
  row: DashboardGlobalPaymentAuditRow,
  botNames: Map<string, string>
): DashboardParsedPaymentRecord | null {
  if (!row || typeof row.payload !== 'object' || row.payload === null || Array.isArray(row.payload)) {
    return null
  }

  const botId = toText(row.bot_id)
  if (!botId) return null

  const payload = row.payload as Record<string, unknown>
  const paymentId = toText(payload.paymentId || payload.invoiceId || payload.id) || String(row.id || '')
  const method = normalizePaymentMethod(payload.method || payload.provider || payload.paymentProvider)
  const status = normalizePaymentStatus(payload.status || payload.paymentStatus)
  const amount = toNumberOrNull(payload.amount)
  const currency = toText(payload.currency).toUpperCase()

  const payerId = toIntegerOrNull(payload.telegramUserId || payload.userId || payload.payerId)
  const payerUsername = toText(payload.username || payload.payerUsername)
  const payerFirstName = toText(payload.firstName || payload.first_name || payload.payerFirstName)
  const payerLastName = toText(payload.lastName || payload.last_name || payload.payerLastName)
  const payerName = [payerFirstName, payerLastName].filter(Boolean).join(' ').trim()
  const createdAt = toText(row.created_at)

  return {
    id: String(row.id || ''),
    paymentId,
    botId,
    botName: botNames.get(botId) || botId,
    method,
    status,
    amount,
    currency,
    payerId,
    payerUsername,
    payerName,
    createdAt,
    createdAtMs: parseDashboardTimestampMs(createdAt),
  }
}

function aggregateDashboardPayments(records: DashboardParsedPaymentRecord[]): DashboardGlobalPaymentAggregate[] {
  const aggregated = new Map<string, DashboardGlobalPaymentAggregate>()

  for (const record of records) {
    const key = `${record.method}:${record.paymentId || record.id}`
    const existing = aggregated.get(key)
    if (!existing) {
      aggregated.set(key, {
        id: record.id,
        paymentId: record.paymentId,
        botId: record.botId,
        botName: record.botName,
        method: record.method,
        status: record.status,
        amount: record.amount,
        currency: record.currency,
        payerId: record.payerId,
        payerUsername: record.payerUsername,
        payerName: record.payerName,
        createdAt: record.createdAt,
        latestAtMs: record.createdAtMs,
      })
      continue
    }

    if (record.createdAtMs >= existing.latestAtMs) {
      existing.id = record.id
      existing.paymentId = record.paymentId
      existing.botId = record.botId
      existing.botName = record.botName
      existing.method = record.method
      existing.status = record.status
      existing.amount = record.amount
      existing.currency = record.currency
      existing.payerId = record.payerId
      existing.payerUsername = record.payerUsername
      existing.payerName = record.payerName
      existing.createdAt = record.createdAt
      existing.latestAtMs = record.createdAtMs
    }
  }

  return Array.from(aggregated.values()).sort((left, right) => right.latestAtMs - left.latestAtMs)
}

function filterDashboardPaymentsByRange(
  items: DashboardGlobalPaymentAggregate[],
  sinceMs: number | null,
  untilMs: number | null = null
): DashboardGlobalPaymentAggregate[] {
  return items.filter((item) => {
    if (!Number.isFinite(item.latestAtMs) || item.latestAtMs <= 0) return false
    if (sinceMs !== null && item.latestAtMs < sinceMs) return false
    if (untilMs !== null && item.latestAtMs >= untilMs) return false
    return true
  })
}

function buildDashboardGlobalAnomalies(input: {
  comparison: DashboardGlobalStats['comparison']
  currentPendingFailedCount: number
  previousPendingFailedCount: number
  currentPendingFailedAmount: number
  previousPendingFailedAmount: number
  currentNewSubscribers: number
  previousNewSubscribers: number
}): DashboardGlobalAnomaly[] {
  const anomalies: DashboardGlobalAnomaly[] = []

  if (
    input.comparison.revenue.available &&
    input.comparison.revenue.previous > 0 &&
    input.comparison.revenue.current <= input.comparison.revenue.previous * 0.8
  ) {
    anomalies.push({
      key: 'revenue_drop',
      severity: input.comparison.revenue.current <= input.comparison.revenue.previous * 0.5 ? 'critical' : 'warning',
      currentValue: input.comparison.revenue.current,
      previousValue: input.comparison.revenue.previous,
      deltaPercent: input.comparison.revenue.deltaPercent,
    })
  }

  if (
    input.comparison.conversionPercent.available &&
    input.comparison.conversionPercent.previous >= 5 &&
    input.comparison.conversionPercent.current <= input.comparison.conversionPercent.previous * 0.8
  ) {
    anomalies.push({
      key: 'conversion_drop',
      severity:
        input.comparison.conversionPercent.current <= input.comparison.conversionPercent.previous * 0.5
          ? 'critical'
          : 'warning',
      currentValue: input.comparison.conversionPercent.current,
      previousValue: input.comparison.conversionPercent.previous,
      deltaPercent: input.comparison.conversionPercent.deltaPercent,
    })
  }

  const pendingFailedCountGrowth =
    input.previousPendingFailedCount > 0
      ? roundTo(((input.currentPendingFailedCount - input.previousPendingFailedCount) / input.previousPendingFailedCount) * 100, 2)
      : null
  const pendingFailedAmountGrowth =
    input.previousPendingFailedAmount > 0
      ? roundTo(((input.currentPendingFailedAmount - input.previousPendingFailedAmount) / input.previousPendingFailedAmount) * 100, 2)
      : null

  if (
    (input.previousPendingFailedCount >= 2 && input.currentPendingFailedCount >= input.previousPendingFailedCount * 1.5) ||
    (input.previousPendingFailedAmount > 0 && input.currentPendingFailedAmount >= input.previousPendingFailedAmount * 1.5)
  ) {
    anomalies.push({
      key: 'payment_issues_growth',
      severity:
        input.previousPendingFailedCount > 0 && input.currentPendingFailedCount >= input.previousPendingFailedCount * 2
          ? 'critical'
          : 'warning',
      currentValue: input.currentPendingFailedCount,
      previousValue: input.previousPendingFailedCount,
      deltaPercent: pendingFailedAmountGrowth ?? pendingFailedCountGrowth,
    })
  }

  if (
    input.comparison.activeSubscribers.available &&
    input.comparison.activeSubscribers.previous >= 10 &&
    input.comparison.activeSubscribers.current <= input.comparison.activeSubscribers.previous * 0.8
  ) {
    anomalies.push({
      key: 'active_audience_drop',
      severity:
        input.comparison.activeSubscribers.current <= input.comparison.activeSubscribers.previous * 0.5
          ? 'critical'
          : 'warning',
      currentValue: input.comparison.activeSubscribers.current,
      previousValue: input.comparison.activeSubscribers.previous,
      deltaPercent: input.comparison.activeSubscribers.deltaPercent,
    })
  }

  const newSubscribersDelta =
    input.previousNewSubscribers > 0
      ? roundTo(((input.currentNewSubscribers - input.previousNewSubscribers) / input.previousNewSubscribers) * 100, 2)
      : null
  if (
    input.previousNewSubscribers >= 5 &&
    input.currentNewSubscribers <= input.previousNewSubscribers * 0.8
  ) {
    anomalies.push({
      key: 'new_audience_drop',
      severity:
        input.currentNewSubscribers <= input.previousNewSubscribers * 0.5 ? 'critical' : 'warning',
      currentValue: input.currentNewSubscribers,
      previousValue: input.previousNewSubscribers,
      deltaPercent: newSubscribersDelta,
    })
  }

  return anomalies
}

function matchesDashboardGlobalPaymentSearch(item: DashboardGlobalPaymentItem, rawSearch: string): boolean {
  const search = rawSearch.trim().toLowerCase()
  if (!search) return true

  const searchableParts = [
    item.id,
    item.paymentId,
    item.method,
    item.status,
    item.botName,
    item.payerName,
    item.payerUsername,
    item.payerId ? String(item.payerId) : '',
  ]

  return searchableParts.some((part) => part.toLowerCase().includes(search))
}

function resolvePayerIdentity(item: DashboardGlobalPaymentItem): string {
  if (Number.isFinite(Number(item.payerId)) && Number(item.payerId) > 0) {
    return `id:${String(item.payerId)}`
  }
  if (item.payerUsername) {
    return `username:${item.payerUsername.toLowerCase()}`
  }
  if (item.payerName) {
    return `name:${item.payerName.toLowerCase()}`
  }
  return `payment:${item.paymentId || item.id}`
}

function buildDashboardPayerFrequency(items: DashboardGlobalPaymentItem[]): Map<string, number> {
  const frequency = new Map<string, number>()
  for (const item of items) {
    const key = resolvePayerIdentity(item)
    frequency.set(key, (frequency.get(key) || 0) + 1)
  }
  return frequency
}

function getDashboardGlobalBucketSizeMs(period: DashboardGlobalStatsPeriod): number {
  if (period === '24h') return 2 * 60 * 60 * 1000
  if (period === '7d') return 12 * 60 * 60 * 1000
  if (period === '30d') return 24 * 60 * 60 * 1000
  return 7 * 24 * 60 * 60 * 1000
}

function buildDashboardGlobalTrend(
  payments: DashboardGlobalPaymentAggregate[],
  contactRows: DashboardGlobalContactRow[],
  period: DashboardGlobalStatsPeriod,
  sinceIso: string | null
): DashboardGlobalStats['trend'] {
  const bucketSizeMs = getDashboardGlobalBucketSizeMs(period)
  const buckets = new Map<number, { revenue: number; activity: number }>()
  const nowMs = Date.now()
  const minPaymentMs = payments.reduce<number>((acc, item) => {
    const timestampMs = parseDashboardTimestampMs(item.createdAt)
    if (!timestampMs) return acc
    if (acc === 0) return timestampMs
    return Math.min(acc, timestampMs)
  }, 0)
  const minContactMs = contactRows.reduce<number>((acc, item) => {
    const timestampMs = parseDashboardTimestampMs(item.created_at)
    if (!timestampMs) return acc
    if (acc === 0) return timestampMs
    return Math.min(acc, timestampMs)
  }, 0)
  const minObservedMs = [minPaymentMs, minContactMs].filter((value) => value > 0)
  const fallbackSinceMs = minObservedMs.length ? Math.min(...minObservedMs) : (nowMs - DASHBOARD_GLOBAL_PERIOD_MS['30d'])
  const sinceMs = parseDashboardTimestampMs(sinceIso) || fallbackSinceMs

  for (const payment of payments) {
    if (classifyPaymentStatus(payment.status) !== 'success') continue
    const timestampMs = parseDashboardTimestampMs(payment.createdAt)
    if (!Number.isFinite(timestampMs) || timestampMs < sinceMs) continue
    const bucketStartMs = Math.floor(timestampMs / bucketSizeMs) * bucketSizeMs
    const existing = buckets.get(bucketStartMs) || { revenue: 0, activity: 0 }
    if (payment.amount !== null) {
      existing.revenue += payment.amount
    }
    buckets.set(bucketStartMs, existing)
  }

  for (const row of contactRows) {
    const timestampMs = parseDashboardTimestampMs(row.created_at)
    if (!Number.isFinite(timestampMs) || timestampMs < sinceMs) continue
    const bucketStartMs = Math.floor(timestampMs / bucketSizeMs) * bucketSizeMs
    const existing = buckets.get(bucketStartMs) || { revenue: 0, activity: 0 }
    existing.activity += 1
    buckets.set(bucketStartMs, existing)
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([bucketStartMs, values]) => ({
      bucketStart: new Date(bucketStartMs).toISOString(),
      revenue: roundTo(values.revenue, 2),
      activity: values.activity,
    }))
}

const RETENTION_WINDOW_DAYS: Record<DashboardRetentionWindowKey, number> = {
  d1: 1,
  d3: 3,
  d7: 7,
  d30: 30,
}

function startOfUtcDayMs(valueMs: number) {
  const date = new Date(valueMs)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function startOfUtcWeekMs(valueMs: number) {
  const dayStartMs = startOfUtcDayMs(valueMs)
  const date = new Date(dayStartMs)
  const utcDay = date.getUTCDay()
  const diffToMonday = utcDay === 0 ? 6 : utcDay - 1
  return dayStartMs - diffToMonday * 24 * 60 * 60 * 1000
}

function createEmptyRetentionWindow(
  key: DashboardRetentionWindowKey,
  cohortUsers = 0
): DashboardGlobalRetentionWindow {
  return {
    key,
    label: key.toUpperCase(),
    retainedUsers: 0,
    cohortUsers,
    retentionPercent: 0,
  }
}

function createEmptyRetentionBlock(recentOnly = false): DashboardGlobalRetentionBlock {
  return {
    available: false,
    recentOnly,
    cohortCount: 0,
    summary: {
      d1: createEmptyRetentionWindow('d1'),
      d3: createEmptyRetentionWindow('d3'),
      d7: createEmptyRetentionWindow('d7'),
      d30: createEmptyRetentionWindow('d30'),
    },
    cohorts: [],
  }
}

function buildDashboardRetentionBuckets(
  period: DashboardGlobalStatsPeriod,
  range: DashboardGlobalPeriodRange
) {
  const nowMs = Date.now()

  if (period === 'all') {
    const currentWeekStartMs = startOfUtcWeekMs(nowMs)
    const buckets = Array.from({ length: 8 }, (_item, index) => {
      const endMs = currentWeekStartMs - index * 7 * 24 * 60 * 60 * 1000
      const startMs = endMs - 7 * 24 * 60 * 60 * 1000
      return { startMs, endMs }
    }).reverse()

    return {
      recentOnly: true,
      minStartMs: buckets[0]?.startMs || currentWeekStartMs,
      maxEndMs: buckets[buckets.length - 1]?.endMs || currentWeekStartMs,
      buckets,
    }
  }

  const startMs = range.currentSinceMs || (nowMs - DASHBOARD_GLOBAL_PERIOD_MS['30d'])
  const firstBucketStartMs = startOfUtcDayMs(startMs)
  const endBoundaryMs = nowMs
  const buckets: Array<{ startMs: number; endMs: number }> = []
  let cursor = firstBucketStartMs

  while (cursor < endBoundaryMs) {
    const endMs = cursor + 24 * 60 * 60 * 1000
    buckets.push({ startMs: cursor, endMs })
    cursor = endMs
  }

  return {
    recentOnly: false,
    minStartMs: firstBucketStartMs,
    maxEndMs: endBoundaryMs,
    buckets,
  }
}

function buildDashboardRetentionBlock(input: {
  period: DashboardGlobalStatsPeriod
  range: DashboardGlobalPeriodRange
  subscriberRows: DashboardGlobalRetentionSubscriberRow[]
  activityEventsByUser: Map<string, number[]>
  paymentEventsByUserId: Map<number, number[]>
  mode: 'activity' | 'payment'
}): DashboardGlobalRetentionBlock {
  const retentionBuckets = buildDashboardRetentionBuckets(input.period, input.range)
  const cohortRows = new Map<number, { members: Array<{ userId: number; firstSeenMs: number }> }>()

  for (const bucket of retentionBuckets.buckets) {
    cohortRows.set(bucket.startMs, { members: [] })
  }

  for (const row of input.subscriberRows) {
    const firstSeenMs = parseDashboardTimestampMs(row.first_seen_at)
    const userId = Number(row.telegram_user_id || 0)
    const botId = toText(row.bot_id)
    if (!firstSeenMs || !userId || !botId) continue
    if (firstSeenMs < retentionBuckets.minStartMs || firstSeenMs >= retentionBuckets.maxEndMs) continue

    const bucket = retentionBuckets.buckets.find((item) => firstSeenMs >= item.startMs && firstSeenMs < item.endMs)
    if (!bucket) continue
    const holder = cohortRows.get(bucket.startMs)
    if (!holder) continue
    holder.members.push({ userId, firstSeenMs })
  }

  const summaryCounts: Record<DashboardRetentionWindowKey, { retained: number; cohort: number }> = {
    d1: { retained: 0, cohort: 0 },
    d3: { retained: 0, cohort: 0 },
    d7: { retained: 0, cohort: 0 },
    d30: { retained: 0, cohort: 0 },
  }

  const cohorts: DashboardGlobalRetentionCohortRow[] = retentionBuckets.buckets.map((bucket) => {
    const members = cohortRows.get(bucket.startMs)?.members || []
    const windows = Object.keys(RETENTION_WINDOW_DAYS).reduce((acc, key) => {
      const typedKey = key as DashboardRetentionWindowKey
      const maxWindowMs = RETENTION_WINDOW_DAYS[typedKey] * 24 * 60 * 60 * 1000

      let retainedUsers = 0
      for (const member of members) {
        const matched =
          input.mode === 'activity'
            ? (input.activityEventsByUser.get(String(member.userId)) || []).some(
                (eventMs) => eventMs > member.firstSeenMs && eventMs <= member.firstSeenMs + maxWindowMs
              )
            : (input.paymentEventsByUserId.get(member.userId) || []).some(
                (eventMs) => eventMs > member.firstSeenMs && eventMs <= member.firstSeenMs + maxWindowMs
              )

        if (matched) {
          retainedUsers += 1
        }
      }

      summaryCounts[typedKey].retained += retainedUsers
      summaryCounts[typedKey].cohort += members.length

      acc[typedKey] = {
        key: typedKey,
        label: typedKey.toUpperCase(),
        retainedUsers,
        cohortUsers: members.length,
        retentionPercent: toPercentSafe(retainedUsers, members.length, 2),
      }

      return acc
    }, {} as Record<DashboardRetentionWindowKey, DashboardGlobalRetentionWindow>)

    return {
      cohortStart: new Date(bucket.startMs).toISOString(),
      cohortEnd: new Date(bucket.endMs).toISOString(),
      cohortUsers: members.length,
      windows,
    }
  })

  const cohortCount = cohorts.reduce((sum, item) => sum + item.cohortUsers, 0)
  if (!cohortCount) {
    return createEmptyRetentionBlock(retentionBuckets.recentOnly)
  }

  return {
    available: true,
    recentOnly: retentionBuckets.recentOnly,
    cohortCount,
    summary: {
      d1: {
        key: 'd1',
        label: 'D1',
        retainedUsers: summaryCounts.d1.retained,
        cohortUsers: summaryCounts.d1.cohort,
        retentionPercent: toPercentSafe(summaryCounts.d1.retained, summaryCounts.d1.cohort, 2),
      },
      d3: {
        key: 'd3',
        label: 'D3',
        retainedUsers: summaryCounts.d3.retained,
        cohortUsers: summaryCounts.d3.cohort,
        retentionPercent: toPercentSafe(summaryCounts.d3.retained, summaryCounts.d3.cohort, 2),
      },
      d7: {
        key: 'd7',
        label: 'D7',
        retainedUsers: summaryCounts.d7.retained,
        cohortUsers: summaryCounts.d7.cohort,
        retentionPercent: toPercentSafe(summaryCounts.d7.retained, summaryCounts.d7.cohort, 2),
      },
      d30: {
        key: 'd30',
        label: 'D30',
        retainedUsers: summaryCounts.d30.retained,
        cohortUsers: summaryCounts.d30.cohort,
        retentionPercent: toPercentSafe(summaryCounts.d30.retained, summaryCounts.d30.cohort, 2),
      },
    },
    cohorts,
  }
}

export async function getDashboardGlobalStatsAction(
  filters: DashboardGlobalStatsFilters = {},
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const internalUserId = internal?.userId?.trim()
  const user = internalUserId ? null : await getServerUser()
  const resolvedUserId = internalUserId || user?.id
  if (!resolvedUserId) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const period = normalizeDashboardGlobalPeriod(filters.period)
  const range = getDashboardGlobalPeriodRange(period)

  try {
    const viewerAccess = internal?.viewerAccess || await getViewerAccess(resolvedUserId)
    const basicAllowed = viewerAccess.isAdmin || viewerAccess.entitlements.dashboardStatisticsBasic
    const proAllowed = viewerAccess.isAdmin || viewerAccess.entitlements.dashboardStatisticsPro
    const emptyMoneySummary = (): DashboardGlobalMoneySummary => ({
      count: 0,
      totalAmount: 0,
      currencyTotals: [],
    })
    const empty: DashboardGlobalStats = {
      period,
      entitlements: {
        basic: basicAllowed,
        pro: proAllowed,
      },
      currencyMode: 'none',
      currencies: [],
      basic: {
        revenue: 0,
        profit: 0,
        successfulPayments: 0,
        pendingAndFailedPayments: 0,
        totalSubscribers: 0,
        activeSubscribers: 0,
        newSubscribers: 0,
        avgUserActivity: 0,
      },
      pro: {
        arpu: 0,
        arppu: 0,
        averageCheck: 0,
        conversionPercent: 0,
        repeatPayerRatePercent: 0,
        uniquePayers: 0,
        repeatPayers: 0,
      },
      comparison: {
        available: false,
        revenueComparable: false,
        revenue: buildDashboardGlobalDelta(0, 0, { available: false }),
        successfulPayments: buildDashboardGlobalDelta(0, 0, { available: false }),
        activeSubscribers: buildDashboardGlobalDelta(0, 0, { available: false }),
        conversionPercent: buildDashboardGlobalDelta(0, 0, { available: false }),
      },
      funnel: {
        firstContactUsers: 0,
        activeUsers: 0,
        paidUsers: 0,
        repeatPayers: 0,
      },
      retention: {
        activity: createEmptyRetentionBlock(),
        payment: createEmptyRetentionBlock(),
      },
      lostRevenue: {
        pending: emptyMoneySummary(),
        failed: emptyMoneySummary(),
        byBot: [],
        byMethod: [],
      },
      repeat: {
        repeatRevenueAmount: null,
        repeatRevenueSharePercent: null,
        repeatRevenueCurrencyTotals: [],
        repeatPayers: 0,
        returnedPayers: 0,
        medianDaysToSecondPayment: null,
      },
      rankings: {
        items: [],
        bestGrowthBotId: null,
        worstDeclineBotId: null,
        bestConversionBotId: null,
        mostProblematicBotId: null,
      },
      anomalies: [],
      trend: [],
      topBots: [],
      methodBreakdown: [],
      statusBreakdown: [],
    }

    if (!basicAllowed) {
      return { success: true, stats: empty } as const
    }

    const supabase = createAdminClient()
    const bots = await getOwnedDashboardBots(supabase, resolvedUserId, filters.botId)
    if (!bots.length) {
      return { success: true, stats: empty } as const
    }

    const botIds = bots.map((bot) => bot.id)
    const botNameMap = new Map<string, string>(bots.map((bot) => [bot.id, bot.name || bot.id]))

    const totalSubscribersQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    let activeSubscribersQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    let currentNewSubscribersQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    if (range.currentSinceIso) {
      activeSubscribersQuery = activeSubscribersQuery.gte('last_seen_at', range.currentSinceIso)
      currentNewSubscribersQuery = currentNewSubscribersQuery.gte('first_seen_at', range.currentSinceIso)
    }

    const previousActiveSubscribersQuery = range.comparisonAvailable
      ? supabase
          .from('bot_subscribers')
          .select('id', { head: true, count: 'exact' })
          .in('bot_id', botIds)
          .gte('last_seen_at', range.previousSinceIso!)
          .lt('last_seen_at', range.currentSinceIso!)
      : Promise.resolve({ count: 0, error: null } as const)

    const previousNewSubscribersQuery = range.comparisonAvailable
      ? supabase
          .from('bot_subscribers')
          .select('id', { head: true, count: 'exact' })
          .in('bot_id', botIds)
          .gte('first_seen_at', range.previousSinceIso!)
          .lt('first_seen_at', range.currentSinceIso!)
      : Promise.resolve({ count: 0, error: null } as const)

    let contactEventsQuery = supabase
      .from('bot_contact_events')
      .select('bot_id, telegram_user_id, created_at')
      .in('bot_id', botIds)
      .order('created_at', { ascending: false })
      .limit(40000)

    let retentionSubscribersQuery = supabase
      .from('bot_subscribers')
      .select('bot_id, telegram_user_id, first_seen_at')
      .in('bot_id', botIds)
      .order('first_seen_at', { ascending: false })
      .limit(40000)

    const paymentsQuery = supabase
      .from('bot_audit_events')
      .select('id, bot_id, event_type, payload, created_at')
      .in('bot_id', botIds)
      .in('event_type', [...PAYMENT_AUDIT_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(40000)

    if (range.currentSinceIso) {
      contactEventsQuery = contactEventsQuery.gte('created_at', range.currentSinceIso)
      retentionSubscribersQuery = retentionSubscribersQuery.gte('first_seen_at', range.currentSinceIso)
    }

    if (period === 'all') {
      const retentionBounds = buildDashboardRetentionBuckets(period, range)
      retentionSubscribersQuery = retentionSubscribersQuery
        .gte('first_seen_at', new Date(retentionBounds.minStartMs).toISOString())
        .lt('first_seen_at', new Date(retentionBounds.maxEndMs).toISOString())
    }

    const activePerBotQueries = botIds.map(async (botId) => {
      let query = supabase
        .from('bot_subscribers')
        .select('id', { head: true, count: 'exact' })
        .eq('bot_id', botId)

      if (range.currentSinceIso) {
        query = query.gte('last_seen_at', range.currentSinceIso)
      }

      const result = await query
      return { botId, result }
    })

    const [
      totalSubscribersResult,
      activeSubscribersResult,
      currentNewSubscribersResult,
      previousActiveSubscribersResult,
      previousNewSubscribersResult,
      contactEventsResult,
      retentionSubscribersResult,
      paymentsResult,
      ...activePerBotResults
    ] = await Promise.all([
      totalSubscribersQuery,
      activeSubscribersQuery,
      currentNewSubscribersQuery,
      previousActiveSubscribersQuery,
      previousNewSubscribersQuery,
      contactEventsQuery,
      retentionSubscribersQuery,
      paymentsQuery,
      ...activePerBotQueries,
    ])

    if (totalSubscribersResult.error) {
      return { success: false, error: String(totalSubscribersResult.error) } as const
    }
    if (activeSubscribersResult.error) {
      return { success: false, error: String(activeSubscribersResult.error) } as const
    }
    if (currentNewSubscribersResult.error) {
      return { success: false, error: String(currentNewSubscribersResult.error) } as const
    }
    if (previousActiveSubscribersResult.error) {
      return { success: false, error: String(previousActiveSubscribersResult.error) } as const
    }
    if (previousNewSubscribersResult.error) {
      return { success: false, error: String(previousNewSubscribersResult.error) } as const
    }
    if (contactEventsResult.error) {
      return { success: false, error: String(contactEventsResult.error) } as const
    }
    if (retentionSubscribersResult.error) {
      return { success: false, error: String(retentionSubscribersResult.error) } as const
    }
    if (paymentsResult.error) {
      return { success: false, error: String(paymentsResult.error) } as const
    }

    for (const item of activePerBotResults) {
      if (item.result.error) {
        return { success: false, error: String(item.result.error) } as const
      }
    }

    const paymentRows = (Array.isArray(paymentsResult.data) ? paymentsResult.data : []) as DashboardGlobalPaymentAuditRow[]
    const parsedPayments = paymentRows
      .map((row) => parseDashboardPaymentFromAuditRow(row, botNameMap))
      .filter((item): item is DashboardParsedPaymentRecord => Boolean(item))
    const aggregatedPayments = aggregateDashboardPayments(parsedPayments)
    const currentPayments = filterDashboardPaymentsByRange(aggregatedPayments, range.currentSinceMs)
    const previousPayments = range.comparisonAvailable
      ? filterDashboardPaymentsByRange(aggregatedPayments, range.previousSinceMs, range.previousUntilMs)
      : []

    const successfulPayments = currentPayments.filter((item) => classifyPaymentStatus(item.status) === 'success')
    const previousSuccessfulPayments = previousPayments.filter((item) => classifyPaymentStatus(item.status) === 'success')
    const pendingOrFailedPayments = currentPayments.filter((item) => {
      const classification = classifyPaymentStatus(item.status)
      return classification === 'pending' || classification === 'failed'
    })
    const previousPendingOrFailedPayments = previousPayments.filter((item) => {
      const classification = classifyPaymentStatus(item.status)
      return classification === 'pending' || classification === 'failed'
    })
    const pendingPayments = currentPayments.filter((item) => classifyPaymentStatus(item.status) === 'pending')
    const failedPayments = currentPayments.filter((item) => classifyPaymentStatus(item.status) === 'failed')

    const revenue = roundTo(
      successfulPayments.reduce((sum, item) => {
        if (item.amount === null) return sum
        return sum + item.amount
      }, 0),
      2
    )
    const previousRevenue = roundTo(
      previousSuccessfulPayments.reduce((sum, item) => {
        if (item.amount === null) return sum
        return sum + item.amount
      }, 0),
      2
    )
    const profit = revenue
    const totalSubscribers = Number(totalSubscribersResult.count || 0)
    const activeSubscribers = Number(activeSubscribersResult.count || 0)
    const previousActiveSubscribers = Number(previousActiveSubscribersResult.count || 0)
    const newSubscribers = Number(currentNewSubscribersResult.count || 0)
    const previousNewSubscribers = Number(previousNewSubscribersResult.count || 0)
    const contactEventRows = (Array.isArray(contactEventsResult.data) ? contactEventsResult.data : []) as DashboardGlobalContactRow[]
    const retentionSubscriberRows = (Array.isArray(retentionSubscribersResult.data) ? retentionSubscribersResult.data : []) as DashboardGlobalRetentionSubscriberRow[]
    const activityCount = contactEventRows.length
    const avgUserActivity = divideNumbersSafe(activityCount, activeSubscribers, 2)

    const payerFrequency = buildDashboardPayerFrequency(successfulPayments)
    const previousPayerFrequency = buildDashboardPayerFrequency(previousSuccessfulPayments)
    const uniquePayers = payerFrequency.size
    const previousUniquePayers = previousPayerFrequency.size
    const previousConversionPercent = toPercentSafe(previousUniquePayers, previousActiveSubscribers, 2)

    const currencySet = new Set(
      successfulPayments
        .map((item) => toText(item.currency).toUpperCase())
        .filter(Boolean)
    )
    const currencies = Array.from(currencySet).sort((left, right) => left.localeCompare(right))
    const currencyMode: DashboardGlobalStats['currencyMode'] =
      currencies.length === 0 ? 'none' : currencies.length === 1 ? 'single' : 'mixed'
    const comparisonCurrencies = Array.from(
      new Set(
        [...successfulPayments, ...previousSuccessfulPayments]
          .map((item) => toText(item.currency).toUpperCase())
          .filter(Boolean)
      )
    )
    const revenueComparable = range.comparisonAvailable && comparisonCurrencies.length <= 1

    const successfulHistoryByPayer = new Map<string, DashboardGlobalPaymentAggregate[]>()
    for (const item of aggregatedPayments
      .filter((payment) => classifyPaymentStatus(payment.status) === 'success')
      .sort((left, right) => left.latestAtMs - right.latestAtMs)) {
      const key = resolvePayerIdentity(item)
      const bucket = successfulHistoryByPayer.get(key) || []
      bucket.push(item)
      successfulHistoryByPayer.set(key, bucket)
    }

    const repeatRevenuePayments: DashboardGlobalPaymentAggregate[] = []
    const returnedPayers = new Set<string>()
    const secondPaymentIntervalsDays: number[] = []
    for (const [payerKey, history] of successfulHistoryByPayer.entries()) {
      if (history.length >= 2) {
        secondPaymentIntervalsDays.push((history[1].latestAtMs - history[0].latestAtMs) / (24 * 60 * 60 * 1000))
      }

      history.forEach((payment, index) => {
        if (range.currentSinceMs !== null && payment.latestAtMs < range.currentSinceMs) {
          return
        }
        if (index > 0) {
          repeatRevenuePayments.push(payment)
          returnedPayers.add(payerKey)
        }
      })
    }

    const repeatRevenueCurrencyTotals = buildCurrencyTotals(repeatRevenuePayments)
    const repeatRevenueAmountComparable = currencyMode !== 'mixed'
    const repeatRevenueAmount = repeatRevenueAmountComparable
      ? roundTo(
          repeatRevenuePayments.reduce((sum, item) => sum + (item.amount !== null ? item.amount : 0), 0),
          2
        )
      : null
    const repeatRevenueSharePercent = repeatRevenueAmountComparable
      ? toPercentSafe(repeatRevenueAmount || 0, revenue, 2)
      : null
    const repeatPayers = returnedPayers.size

    const arpu = divideNumbersSafe(revenue, totalSubscribers, 2)
    const arppu = divideNumbersSafe(revenue, uniquePayers, 2)
    const averageCheck = divideNumbersSafe(revenue, successfulPayments.length, 2)
    const conversionPercent = toPercentSafe(uniquePayers, activeSubscribers, 2)
    const repeatPayerRatePercent = toPercentSafe(repeatPayers, uniquePayers, 2)

    const activityEventsByUser = new Map<string, number[]>()
    for (const row of contactEventRows) {
      const userId = Number(row.telegram_user_id || 0)
      const createdAtMs = parseDashboardTimestampMs(row.created_at)
      if (!userId || !createdAtMs) continue
      const bucket = activityEventsByUser.get(String(userId)) || []
      bucket.push(createdAtMs)
      activityEventsByUser.set(String(userId), bucket)
    }
    for (const bucket of activityEventsByUser.values()) {
      bucket.sort((left, right) => left - right)
    }

    const paymentEventsByUserId = new Map<number, number[]>()
    for (const item of aggregatedPayments) {
      if (classifyPaymentStatus(item.status) !== 'success') continue
      const payerId = Number(item.payerId || 0)
      if (!payerId) continue
      const bucket = paymentEventsByUserId.get(payerId) || []
      bucket.push(item.latestAtMs)
      paymentEventsByUserId.set(payerId, bucket)
    }
    for (const bucket of paymentEventsByUserId.values()) {
      bucket.sort((left, right) => left - right)
    }

    const retention = {
      activity: buildDashboardRetentionBlock({
        period,
        range,
        subscriberRows: retentionSubscriberRows,
        activityEventsByUser,
        paymentEventsByUserId,
        mode: 'activity',
      }),
      payment: buildDashboardRetentionBlock({
        period,
        range,
        subscriberRows: retentionSubscriberRows,
        activityEventsByUser,
        paymentEventsByUserId,
        mode: 'payment',
      }),
    }

    const methodMap = new Map<string, { count: number; revenue: number }>()
    const statusMap = new Map<string, number>()
    for (const item of currentPayments) {
      const methodRecord = methodMap.get(item.method) || { count: 0, revenue: 0 }
      methodRecord.count += 1
      if (classifyPaymentStatus(item.status) === 'success' && item.amount !== null) {
        methodRecord.revenue += item.amount
      }
      methodMap.set(item.method, methodRecord)
      statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1)
    }

    const activeSubscribersByBot = new Map<string, number>()
    for (const item of activePerBotResults) {
      activeSubscribersByBot.set(item.botId, Number(item.result.count || 0))
    }

    const topBotsMap = new Map<string, {
      revenue: number
      successfulPayments: number
      payers: Set<string>
    }>()
    for (const item of successfulPayments) {
      const bucket = topBotsMap.get(item.botId) || {
        revenue: 0,
        successfulPayments: 0,
        payers: new Set<string>(),
      }
      if (item.amount !== null) {
        bucket.revenue += item.amount
      }
      bucket.successfulPayments += 1
      bucket.payers.add(resolvePayerIdentity(item))
      topBotsMap.set(item.botId, bucket)
    }

    const topBots = Array.from(topBotsMap.entries())
      .map(([botId, value]) => {
        const activeCount = activeSubscribersByBot.get(botId) || 0
        const uniqueBotPayers = value.payers.size
        return {
          botId,
          botName: botNameMap.get(botId) || botId,
          revenue: roundTo(value.revenue, 2),
          conversionPercent: toPercentSafe(uniqueBotPayers, activeCount, 2),
          successfulPayments: value.successfulPayments,
          uniquePayers: uniqueBotPayers,
          activeSubscribers: activeCount,
        }
      })
      .sort((left, right) => {
        if (right.revenue !== left.revenue) return right.revenue - left.revenue
        return right.conversionPercent - left.conversionPercent
      })
      .slice(0, 8)

    const lostRevenueByBotMap = new Map<string, { pending: DashboardGlobalPaymentAggregate[]; failed: DashboardGlobalPaymentAggregate[] }>()
    const lostRevenueByMethodMap = new Map<string, { pending: DashboardGlobalPaymentAggregate[]; failed: DashboardGlobalPaymentAggregate[] }>()
    for (const item of pendingPayments) {
      const byBot = lostRevenueByBotMap.get(item.botId) || { pending: [], failed: [] }
      byBot.pending.push(item)
      lostRevenueByBotMap.set(item.botId, byBot)
      const byMethod = lostRevenueByMethodMap.get(item.method) || { pending: [], failed: [] }
      byMethod.pending.push(item)
      lostRevenueByMethodMap.set(item.method, byMethod)
    }
    for (const item of failedPayments) {
      const byBot = lostRevenueByBotMap.get(item.botId) || { pending: [], failed: [] }
      byBot.failed.push(item)
      lostRevenueByBotMap.set(item.botId, byBot)
      const byMethod = lostRevenueByMethodMap.get(item.method) || { pending: [], failed: [] }
      byMethod.failed.push(item)
      lostRevenueByMethodMap.set(item.method, byMethod)
    }

    const lostRevenue = {
      pending: buildDashboardMoneySummary(pendingPayments),
      failed: buildDashboardMoneySummary(failedPayments),
      byBot: Array.from(lostRevenueByBotMap.entries())
        .map(([botId, value]) => ({
          botId,
          botName: botNameMap.get(botId) || botId,
          pending: buildDashboardMoneySummary(value.pending),
          failed: buildDashboardMoneySummary(value.failed),
        }))
        .sort(
          (left, right) =>
            (right.pending.count + right.failed.count) - (left.pending.count + left.failed.count)
        ),
      byMethod: Array.from(lostRevenueByMethodMap.entries())
        .map(([method, value]) => ({
          method,
          pending: buildDashboardMoneySummary(value.pending),
          failed: buildDashboardMoneySummary(value.failed),
        }))
        .sort(
          (left, right) =>
            (right.pending.count + right.failed.count) - (left.pending.count + left.failed.count)
        ),
    }

    const rankingMap = new Map<string, {
      currentRevenue: number
      previousRevenue: number
      successfulPayments: number
      previousSuccessfulPayments: number
      currentPayers: Set<string>
      pendingCount: number
      failedCount: number
      pendingAmount: number
      failedAmount: number
    }>()

    for (const bot of bots) {
      rankingMap.set(bot.id, {
        currentRevenue: 0,
        previousRevenue: 0,
        successfulPayments: 0,
        previousSuccessfulPayments: 0,
        currentPayers: new Set<string>(),
        pendingCount: 0,
        failedCount: 0,
        pendingAmount: 0,
        failedAmount: 0,
      })
    }

    for (const item of successfulPayments) {
      const bucket = rankingMap.get(item.botId)
      if (!bucket) continue
      bucket.successfulPayments += 1
      bucket.currentPayers.add(resolvePayerIdentity(item))
      if (item.amount !== null) {
        bucket.currentRevenue += item.amount
      }
    }

    for (const item of previousSuccessfulPayments) {
      const bucket = rankingMap.get(item.botId)
      if (!bucket) continue
      bucket.previousSuccessfulPayments += 1
      if (item.amount !== null) {
        bucket.previousRevenue += item.amount
      }
    }

    for (const item of pendingPayments) {
      const bucket = rankingMap.get(item.botId)
      if (!bucket) continue
      bucket.pendingCount += 1
      if (item.amount !== null) {
        bucket.pendingAmount += item.amount
      }
    }

    for (const item of failedPayments) {
      const bucket = rankingMap.get(item.botId)
      if (!bucket) continue
      bucket.failedCount += 1
      if (item.amount !== null) {
        bucket.failedAmount += item.amount
      }
    }

    const rankingItems: DashboardGlobalBotRankingRow[] = Array.from(rankingMap.entries())
      .map(([botId, value]) => {
        const activeCount = activeSubscribersByBot.get(botId) || 0
        return {
          botId,
          botName: botNameMap.get(botId) || botId,
          currentRevenue: roundTo(value.currentRevenue, 2),
          previousRevenue: roundTo(value.previousRevenue, 2),
          revenueDeltaPercent:
            value.previousRevenue > 0
              ? roundTo(((value.currentRevenue - value.previousRevenue) / value.previousRevenue) * 100, 2)
              : null,
          successfulPayments: value.successfulPayments,
          previousSuccessfulPayments: value.previousSuccessfulPayments,
          uniquePayers: value.currentPayers.size,
          activeSubscribers: activeCount,
          conversionPercent: toPercentSafe(value.currentPayers.size, activeCount, 2),
          pendingCount: value.pendingCount,
          failedCount: value.failedCount,
          pendingAmount: roundTo(value.pendingAmount, 2),
          failedAmount: roundTo(value.failedAmount, 2),
        }
      })
      .sort((left, right) => {
        if (right.currentRevenue !== left.currentRevenue) return right.currentRevenue - left.currentRevenue
        return right.conversionPercent - left.conversionPercent
      })

    const growthCandidates = rankingItems.filter((item) => item.revenueDeltaPercent !== null)
    const bestGrowthBotId = growthCandidates.length
      ? [...growthCandidates].sort((left, right) => (right.revenueDeltaPercent || 0) - (left.revenueDeltaPercent || 0))[0].botId
      : null
    const declineCandidates = growthCandidates.filter((item) => (item.revenueDeltaPercent || 0) < 0)
    const worstDeclineBotId = declineCandidates.length
      ? [...declineCandidates].sort((left, right) => (left.revenueDeltaPercent || 0) - (right.revenueDeltaPercent || 0))[0].botId
      : null
    const conversionCandidates = rankingItems.filter((item) => item.activeSubscribers > 0)
    const bestConversionBotId = conversionCandidates.length
      ? [...conversionCandidates].sort((left, right) => right.conversionPercent - left.conversionPercent)[0].botId
      : null
    const problemCandidates = rankingItems.filter((item) => item.pendingCount > 0 || item.failedCount > 0)
    const mostProblematicBotId = problemCandidates.length
      ? [...problemCandidates].sort((left, right) => {
          const rightScore = right.failedCount * 2 + right.pendingCount
          const leftScore = left.failedCount * 2 + left.pendingCount
          if (rightScore !== leftScore) return rightScore - leftScore
          return (right.failedAmount + right.pendingAmount) - (left.failedAmount + left.pendingAmount)
        })[0].botId
      : null

    const comparison = {
      available: range.comparisonAvailable,
      revenueComparable,
      revenue: buildDashboardGlobalDelta(revenue, previousRevenue, {
        available: range.comparisonAvailable && revenueComparable,
        allowZeroBaseline: true,
      }),
      successfulPayments: buildDashboardGlobalDelta(successfulPayments.length, previousSuccessfulPayments.length, {
        available: range.comparisonAvailable,
        allowZeroBaseline: true,
      }),
      activeSubscribers: buildDashboardGlobalDelta(activeSubscribers, previousActiveSubscribers, {
        available: range.comparisonAvailable,
        allowZeroBaseline: true,
      }),
      conversionPercent: buildDashboardGlobalDelta(conversionPercent, previousConversionPercent, {
        available: range.comparisonAvailable,
        allowZeroBaseline: true,
      }),
    }

    const anomalies = buildDashboardGlobalAnomalies({
      comparison,
      currentPendingFailedCount: pendingOrFailedPayments.length,
      previousPendingFailedCount: previousPendingOrFailedPayments.length,
      currentPendingFailedAmount: roundTo(
        pendingOrFailedPayments.reduce((sum, item) => sum + (item.amount !== null ? item.amount : 0), 0),
        2
      ),
      previousPendingFailedAmount: roundTo(
        previousPendingOrFailedPayments.reduce((sum, item) => sum + (item.amount !== null ? item.amount : 0), 0),
        2
      ),
      currentNewSubscribers: newSubscribers,
      previousNewSubscribers,
    })

    const stats: DashboardGlobalStats = {
      period,
      entitlements: { basic: basicAllowed, pro: proAllowed },
      currencyMode,
      currencies,
      basic: {
        revenue,
        profit,
        successfulPayments: successfulPayments.length,
        pendingAndFailedPayments: pendingOrFailedPayments.length,
        totalSubscribers,
        activeSubscribers,
        newSubscribers,
        avgUserActivity,
      },
      pro: {
        arpu,
        arppu,
        averageCheck,
        conversionPercent,
        repeatPayerRatePercent,
        uniquePayers,
        repeatPayers,
      },
      comparison,
      funnel: {
        firstContactUsers: totalSubscribers,
        activeUsers: activeSubscribers,
        paidUsers: uniquePayers,
        repeatPayers,
      },
      retention,
      lostRevenue,
      repeat: {
        repeatRevenueAmount,
        repeatRevenueSharePercent,
        repeatRevenueCurrencyTotals,
        repeatPayers,
        returnedPayers: repeatPayers,
        medianDaysToSecondPayment: calculateMedian(secondPaymentIntervalsDays),
      },
      rankings: {
        items: rankingItems,
        bestGrowthBotId,
        worstDeclineBotId,
        bestConversionBotId,
        mostProblematicBotId,
      },
      anomalies,
      trend: buildDashboardGlobalTrend(
        currentPayments,
        contactEventRows,
        period,
        range.currentSinceIso
      ),
      topBots,
      methodBreakdown: Array.from(methodMap.entries())
        .map(([method, value]) => ({
          method,
          count: value.count,
          revenue: roundTo(value.revenue, 2),
        }))
        .sort((left, right) => right.count - left.count),
      statusBreakdown: Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((left, right) => right.count - left.count),
    }

    return { success: true, stats } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getDashboardGlobalPaymentsAction(
  filters: DashboardGlobalPaymentsFilters = {},
  page = 1,
  pageSize = 25,
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const internalUserId = internal?.userId?.trim()
  const user = internalUserId ? null : await getServerUser()
  const resolvedUserId = internalUserId || user?.id
  if (!resolvedUserId) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedPage = normalizeDashboardGlobalPage(page)
  const normalizedPageSize = normalizeDashboardGlobalPageSize(pageSize)
  const period = normalizeDashboardGlobalPeriod(filters.period)
  const sinceIso = getDashboardGlobalSinceIso(period)
  const search = normalizeDashboardSearch(filters.search)
  const methodFilter = normalizePaymentMethod(filters.method)
  const statusFilter = normalizePaymentStatus(filters.status)

  try {
    const viewerAccess = internal?.viewerAccess || await getViewerAccess(resolvedUserId)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.dashboardStatisticsBasic)) {
      return { success: false, error: 'Dashboard statistics are not available on the current plan' as const }
    }

    const supabase = createAdminClient()
    const bots = await getOwnedDashboardBots(supabase, resolvedUserId, filters.botId)
    if (!bots.length) {
      const empty: DashboardGlobalPayments = {
        period,
        methods: [],
        statuses: [],
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: 0,
        summary: {
          totalCount: 0,
          totalAmount: 0,
          successCount: 0,
          pendingCount: 0,
          failedCount: 0,
          currencyTotals: [],
        },
        items: [],
      }
      return { success: true, history: empty } as const
    }

    const botIds = bots.map((bot) => bot.id)
    const botNameMap = new Map<string, string>(bots.map((bot) => [bot.id, bot.name || bot.id]))

    let paymentsQuery = supabase
      .from('bot_audit_events')
      .select('id, bot_id, event_type, payload, created_at')
      .in('bot_id', botIds)
      .in('event_type', [...PAYMENT_AUDIT_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(20000)

    if (sinceIso) {
      paymentsQuery = paymentsQuery.gte('created_at', sinceIso)
    }

    const paymentsResult = await paymentsQuery
    if (paymentsResult.error) {
      return { success: false, error: String(paymentsResult.error) } as const
    }

    const paymentRows = (Array.isArray(paymentsResult.data) ? paymentsResult.data : []) as DashboardGlobalPaymentAuditRow[]
    const parsedPayments = paymentRows
      .map((row) => parseDashboardPaymentFromAuditRow(row, botNameMap))
      .filter((item): item is DashboardParsedPaymentRecord => Boolean(item))
    const aggregatedPayments = aggregateDashboardPayments(parsedPayments)

    const methods = Array.from(
      new Set(aggregatedPayments.map((item) => item.method).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))
    const statuses = Array.from(
      new Set(aggregatedPayments.map((item) => item.status).filter((value) => value && value !== 'unknown'))
    ).sort((left, right) => left.localeCompare(right))

    const filteredItems = aggregatedPayments.filter((item) => {
      if (search && !matchesDashboardGlobalPaymentSearch(item, search)) {
        return false
      }
      if (methodFilter !== 'unknown' && methodFilter !== 'all' && item.method !== methodFilter) {
        return false
      }
      if (statusFilter !== 'unknown' && statusFilter !== 'all' && item.status !== statusFilter) {
        return false
      }
      return true
    })

    const currencyTotalsMap = new Map<string, number>()
    const summary = filteredItems.reduce<DashboardGlobalPayments['summary']>(
      (acc, item) => {
        acc.totalCount += 1
        if (item.amount !== null) {
          acc.totalAmount += item.amount
          const currency = toText(item.currency).toUpperCase() || 'UNKNOWN'
          currencyTotalsMap.set(currency, (currencyTotalsMap.get(currency) || 0) + item.amount)
        }
        const classification = classifyPaymentStatus(item.status)
        if (classification === 'success') acc.successCount += 1
        if (classification === 'pending') acc.pendingCount += 1
        if (classification === 'failed') acc.failedCount += 1
        return acc
      },
      {
        totalCount: 0,
        totalAmount: 0,
        successCount: 0,
        pendingCount: 0,
        failedCount: 0,
        currencyTotals: [],
      }
    )

    const total = filteredItems.length
    const from = (normalizedPage - 1) * normalizedPageSize
    const to = from + normalizedPageSize

    const history: DashboardGlobalPayments = {
      period,
      methods,
      statuses,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      summary: {
        ...summary,
        totalAmount: roundTo(summary.totalAmount, 2),
        currencyTotals: Array.from(currencyTotalsMap.entries())
          .map(([currency, amount]) => ({ currency, amount: roundTo(amount, 2) }))
          .sort((left, right) => right.amount - left.amount),
      },
      items: filteredItems.slice(from, to),
    }

    return { success: true, history } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

export async function getDashboardGlobalSubscribersAction(
  filters: DashboardGlobalSubscribersFilters = {},
  page = 1,
  pageSize = 25,
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const internalUserId = internal?.userId?.trim()
  const user = internalUserId ? null : await getServerUser()
  const resolvedUserId = internalUserId || user?.id
  if (!resolvedUserId) {
    return { success: false, error: 'Not authenticated' as const }
  }

  const normalizedPage = normalizeDashboardGlobalPage(page)
  const normalizedPageSize = normalizeDashboardGlobalPageSize(pageSize)
  const period = normalizeDashboardGlobalPeriod(filters.period)
  const source = normalizeDashboardGlobalSource(filters.source)
  const search = normalizeDashboardSearch(filters.search)
  const sinceIso = getDashboardGlobalSinceIso(period)

  try {
    const viewerAccess = internal?.viewerAccess || await getViewerAccess(resolvedUserId)
    if (!(viewerAccess.isAdmin || viewerAccess.entitlements.dashboardStatisticsBasic)) {
      return { success: false, error: 'Dashboard statistics are not available on the current plan' as const }
    }

    const supabase = createAdminClient()
    const bots = await getOwnedDashboardBots(supabase, resolvedUserId, filters.botId)
    if (!bots.length) {
      const empty: DashboardGlobalSubscribers = {
        period,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: 0,
        summary: {
          totalSubscribers: 0,
          activeInPeriod: 0,
          newInPeriod: 0,
          lastSeenAt: null,
        },
        sourceCounts: {
          message: 0,
          callback_query: 0,
          unknown: 0,
        },
        topLanguages: [],
        items: [],
      }
      return { success: true, data: empty } as const
    }

    const botIds = bots.map((bot) => bot.id)
    const botNameMap = new Map<string, string>(bots.map((bot) => [bot.id, bot.name || bot.id]))

    const totalQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    let activeQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    let newQuery = supabase
      .from('bot_subscribers')
      .select('id', { head: true, count: 'exact' })
      .in('bot_id', botIds)

    if (source !== 'all') {
      activeQuery = activeQuery.eq('source', source)
      newQuery = newQuery.eq('source', source)
    }
    if (sinceIso) {
      activeQuery = activeQuery.gte('last_seen_at', sinceIso)
      newQuery = newQuery.gte('first_seen_at', sinceIso)
    }

    let analyticsQuery = supabase
      .from('bot_subscribers')
      .select('source, language_code, last_seen_at')
      .in('bot_id', botIds)
      .order('last_seen_at', { ascending: false })
      .limit(5000)

    if (source !== 'all') {
      analyticsQuery = analyticsQuery.eq('source', source)
    }
    if (sinceIso) {
      analyticsQuery = analyticsQuery.gte('last_seen_at', sinceIso)
    }

    let listQuery = supabase
      .from('bot_subscribers')
      .select(
        'bot_id, telegram_user_id, telegram_chat_id, username, first_name, last_name, language_code, source, first_seen_at, last_seen_at',
        { count: 'exact' }
      )
      .in('bot_id', botIds)
      .order('last_seen_at', { ascending: false })

    if (source !== 'all') {
      listQuery = listQuery.eq('source', source)
    }
    if (sinceIso) {
      listQuery = listQuery.gte('last_seen_at', sinceIso)
    }
    if (search) {
      const numericSearch = Number(search)
      if (Number.isFinite(numericSearch)) {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,telegram_user_id.eq.${Math.round(numericSearch)}`
        )
      } else {
        listQuery = listQuery.or(
          `username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`
        )
      }
    }

    const from = (normalizedPage - 1) * normalizedPageSize
    const to = from + normalizedPageSize - 1

    const [totalResult, activeResult, newResult, analyticsResult, listResult] = await Promise.all([
      totalQuery,
      activeQuery,
      newQuery,
      analyticsQuery,
      listQuery.range(from, to),
    ])

    if (totalResult.error) {
      return { success: false, error: String(totalResult.error) } as const
    }
    if (activeResult.error) {
      return { success: false, error: String(activeResult.error) } as const
    }
    if (newResult.error) {
      return { success: false, error: String(newResult.error) } as const
    }
    if (analyticsResult.error) {
      return { success: false, error: String(analyticsResult.error) } as const
    }
    if (listResult.error) {
      return { success: false, error: String(listResult.error) } as const
    }

    const analyticsRows = (Array.isArray(analyticsResult.data) ? analyticsResult.data : []) as Array<Record<string, unknown>>
    const listRows = (Array.isArray(listResult.data) ? listResult.data : []) as DashboardGlobalSubscriberRow[]

    const sourceCounts: Record<BotSubscribersSource, number> = {
      message: 0,
      callback_query: 0,
      unknown: 0,
    }
    const languageCounts = new Map<string, number>()

    for (const row of analyticsRows) {
      const sourceKey = normalizeDashboardSubscriberSource(row.source)
      sourceCounts[sourceKey] += 1

      const code = String(row.language_code || '').trim().toLowerCase()
      if (code) {
        languageCounts.set(code, (languageCounts.get(code) || 0) + 1)
      }
    }

    const items: DashboardGlobalSubscriberItem[] = listRows.map((row) => {
      const botId = toText(row.bot_id)
      return {
        botId,
        botName: botNameMap.get(botId) || botId,
        telegramUserId: Number(row.telegram_user_id || 0),
        telegramChatId: Number.isFinite(Number(row.telegram_chat_id)) ? Number(row.telegram_chat_id) : null,
        username: toText(row.username),
        firstName: toText(row.first_name),
        lastName: toText(row.last_name),
        languageCode: toText(row.language_code),
        source: normalizeDashboardSubscriberSource(row.source),
        firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
        lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
      }
    })

    const data: DashboardGlobalSubscribers = {
      period,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: Number(listResult.count || 0),
      summary: {
        totalSubscribers: Number(totalResult.count || 0),
        activeInPeriod: Number(activeResult.count || 0),
        newInPeriod: Number(newResult.count || 0),
        lastSeenAt: analyticsRows.length
          ? (toText((analyticsRows[0] as Record<string, unknown>).last_seen_at) || null)
          : null,
      },
      sourceCounts,
      topLanguages: Array.from(languageCounts.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([code, count]) => ({ code, count })),
      items,
    }

    return { success: true, data } as const
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}

async function collectDashboardGlobalPaymentsForExport(
  filters: DashboardGlobalPaymentsFilters,
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const firstPage = await getDashboardGlobalPaymentsAction(filters, 1, 100, internal)
  if (!firstPage.success || !firstPage.history) {
    return firstPage
  }

  const items = [...firstPage.history.items]
  const totalPages = Math.max(1, Math.ceil(firstPage.history.total / firstPage.history.pageSize))

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await getDashboardGlobalPaymentsAction(filters, page, 100, internal)
    if (!nextPage.success || !nextPage.history) {
      return nextPage
    }
    items.push(...nextPage.history.items)
  }

  return {
    success: true as const,
    history: {
      ...firstPage.history,
      page: 1,
      pageSize: items.length || firstPage.history.pageSize,
      total: items.length,
      items,
    },
  }
}

async function collectDashboardGlobalSubscribersForExport(
  filters: DashboardGlobalSubscribersFilters,
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const firstPage = await getDashboardGlobalSubscribersAction(filters, 1, 100, internal)
  if (!firstPage.success || !firstPage.data) {
    return firstPage
  }

  const items = [...firstPage.data.items]
  const totalPages = Math.max(1, Math.ceil(firstPage.data.total / firstPage.data.pageSize))

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await getDashboardGlobalSubscribersAction(filters, page, 100, internal)
    if (!nextPage.success || !nextPage.data) {
      return nextPage
    }
    items.push(...nextPage.data.items)
  }

  return {
    success: true as const,
    data: {
      ...firstPage.data,
      page: 1,
      pageSize: items.length || firstPage.data.pageSize,
      total: items.length,
      items,
    },
  }
}

function formatCsvCurrencyTotals(currencyTotals: DashboardGlobalCurrencyTotal[]): string {
  if (!currencyTotals.length) return ''
  return currencyTotals.map((item) => `${item.currency} ${item.amount}`).join(' | ')
}

function buildDashboardRetentionSheetRows(
  block: DashboardGlobalRetentionBlock
): Array<Array<string | number | null | undefined>> {
  return block.cohorts.map((item) => [
    item.cohortStart,
    item.cohortEnd,
    item.cohortUsers,
    item.windows.d1.retainedUsers,
    item.windows.d1.retentionPercent,
    item.windows.d3.retainedUsers,
    item.windows.d3.retentionPercent,
    item.windows.d7.retainedUsers,
    item.windows.d7.retentionPercent,
    item.windows.d30.retainedUsers,
    item.windows.d30.retentionPercent,
  ])
}

function buildDashboardWorkbookSheets(input: {
  stats: DashboardGlobalStats
  payments: DashboardGlobalPayments
  subscribers: DashboardGlobalSubscribers
}): DashboardExportSheet[] {
  return [
    {
      name: 'Payments',
      headers: ['Bot', 'Payer', 'Payment ID', 'Amount', 'Currency', 'Method', 'Status', 'Created At'],
      rows: input.payments.items.map((item) => [
        item.botName,
        item.payerName || (item.payerUsername ? `@${item.payerUsername}` : item.payerId || ''),
        item.paymentId || item.id,
        item.amount,
        item.currency,
        item.method,
        item.status,
        item.createdAt,
      ]),
    },
    {
      name: 'Subscribers',
      headers: ['Bot', 'User', 'User ID', 'Language', 'Source', 'First Seen', 'Last Seen'],
      rows: input.subscribers.items.map((item) => [
        item.botName,
        [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || (item.username ? `@${item.username}` : ''),
        item.telegramUserId || '',
        item.languageCode,
        item.source,
        item.firstSeenAt,
        item.lastSeenAt,
      ]),
    },
    {
      name: 'Lost revenue by bot',
      headers: [
        'Bot',
        'Pending count',
        'Pending amount',
        'Pending currency totals',
        'Failed count',
        'Failed amount',
        'Failed currency totals',
      ],
      rows: input.stats.lostRevenue.byBot.map((item) => [
        item.botName,
        item.pending.count,
        item.pending.totalAmount,
        formatCsvCurrencyTotals(item.pending.currencyTotals),
        item.failed.count,
        item.failed.totalAmount,
        formatCsvCurrencyTotals(item.failed.currencyTotals),
      ]),
    },
    {
      name: 'Lost revenue by method',
      headers: [
        'Method',
        'Pending count',
        'Pending amount',
        'Pending currency totals',
        'Failed count',
        'Failed amount',
        'Failed currency totals',
      ],
      rows: input.stats.lostRevenue.byMethod.map((item) => [
        item.method,
        item.pending.count,
        item.pending.totalAmount,
        formatCsvCurrencyTotals(item.pending.currencyTotals),
        item.failed.count,
        item.failed.totalAmount,
        formatCsvCurrencyTotals(item.failed.currencyTotals),
      ]),
    },
    {
      name: 'Bot rankings',
      headers: [
        'Bot',
        'Current revenue',
        'Previous revenue',
        'Revenue delta %',
        'Successful payments',
        'Previous successful payments',
        'Unique payers',
        'Active subscribers',
        'Conversion %',
        'Pending count',
        'Failed count',
      ],
      rows: input.stats.rankings.items.map((item) => [
        item.botName,
        item.currentRevenue,
        item.previousRevenue,
        item.revenueDeltaPercent,
        item.successfulPayments,
        item.previousSuccessfulPayments,
        item.uniquePayers,
        item.activeSubscribers,
        item.conversionPercent,
        item.pendingCount,
        item.failedCount,
      ]),
    },
    {
      name: 'Retention activity',
      headers: [
        'Cohort start',
        'Cohort end',
        'Cohort users',
        'D1 retained',
        'D1 %',
        'D3 retained',
        'D3 %',
        'D7 retained',
        'D7 %',
        'D30 retained',
        'D30 %',
      ],
      rows: buildDashboardRetentionSheetRows(input.stats.retention.activity),
    },
    {
      name: 'Retention payment',
      headers: [
        'Cohort start',
        'Cohort end',
        'Cohort users',
        'D1 retained',
        'D1 %',
        'D3 retained',
        'D3 %',
        'D7 retained',
        'D7 %',
        'D30 retained',
        'D30 %',
      ],
      rows: buildDashboardRetentionSheetRows(input.stats.retention.payment),
    },
  ]
}

export async function exportDashboardGlobalAnalyticsCsvAction(
  kind: 'payments' | 'subscribers' | 'lost_revenue_bots' | 'lost_revenue_methods' | 'rankings',
  filters: {
    period?: DashboardGlobalStatsPeriod
    botId?: string
    paymentSearch?: string
    paymentMethod?: string
    paymentStatus?: string
    subscriberSearch?: string
    subscriberSource?: BotSubscribersSource | 'all'
  } = {},
  format: DashboardGlobalReportFormat = 'csv',
  internal?: { userId?: string; viewerAccess?: ViewerAccess }
) {
  const internalUserId = internal?.userId?.trim()
  const user = internalUserId ? null : await getServerUser()
  const resolvedUserId = internalUserId || user?.id
  if (!resolvedUserId) {
    return { success: false, error: 'Not authenticated' as const }
  }

  try {
    const sharedFilters = {
      period: filters.period,
      botId: filters.botId,
    }

    if (format === 'xlsx') {
      const [statsResult, paymentsResult, subscribersResult] = await Promise.all([
        getDashboardGlobalStatsAction(sharedFilters, internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined),
        collectDashboardGlobalPaymentsForExport(
          {
            period: filters.period,
            botId: filters.botId,
            search: filters.paymentSearch,
            method: filters.paymentMethod,
            status: filters.paymentStatus,
          },
          internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined
        ),
        collectDashboardGlobalSubscribersForExport(
          {
            period: filters.period,
            botId: filters.botId,
            search: filters.subscriberSearch,
            source: filters.subscriberSource,
          },
          internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined
        ),
      ])

      if (!statsResult.success || !statsResult.stats) {
        return { success: false, error: statsResult.error || 'Failed to export analytics' } as const
      }
      if (!paymentsResult.success || !paymentsResult.history) {
        return { success: false, error: paymentsResult.error || 'Failed to export payments' } as const
      }
      if (!subscribersResult.success || !subscribersResult.data) {
        return { success: false, error: subscribersResult.error || 'Failed to export subscribers' } as const
      }

      return {
        success: true as const,
        ...buildBase64XlsxPayload(
          `dashboard-analytics-${statsResult.stats.period}.xlsx`,
          buildDashboardWorkbookSheets({
            stats: statsResult.stats,
            payments: paymentsResult.history,
            subscribers: subscribersResult.data,
          })
        ),
      }
    }

    if (kind === 'payments') {
      const result = await collectDashboardGlobalPaymentsForExport({
        period: filters.period,
        botId: filters.botId,
        search: filters.paymentSearch,
        method: filters.paymentMethod,
        status: filters.paymentStatus,
      }, internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined)

      if (!result.success || !result.history) {
        return { success: false, error: result.error || 'Failed to export payments' } as const
      }

      return {
        success: true as const,
        ...buildBase64CsvPayload(
          `dashboard-payments-${result.history.period}.csv`,
          ['Bot', 'Payer', 'Payment ID', 'Amount', 'Currency', 'Method', 'Status', 'Created At'],
          result.history.items.map((item) => [
            item.botName,
            item.payerName || (item.payerUsername ? `@${item.payerUsername}` : item.payerId || ''),
            item.paymentId || item.id,
            item.amount,
            item.currency,
            item.method,
            item.status,
            item.createdAt,
          ])
        ),
      }
    }

    if (kind === 'subscribers') {
      const result = await collectDashboardGlobalSubscribersForExport({
        period: filters.period,
        botId: filters.botId,
        search: filters.subscriberSearch,
        source: filters.subscriberSource,
      }, internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined)

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to export subscribers' } as const
      }

      return {
        success: true as const,
        ...buildBase64CsvPayload(
          `dashboard-subscribers-${result.data.period}.csv`,
          ['Bot', 'User', 'User ID', 'Language', 'Source', 'First Seen', 'Last Seen'],
          result.data.items.map((item) => [
            item.botName,
            [item.firstName, item.lastName].filter(Boolean).join(' ').trim() || (item.username ? `@${item.username}` : ''),
            item.telegramUserId || '',
            item.languageCode,
            item.source,
            item.firstSeenAt,
            item.lastSeenAt,
          ])
        ),
      }
    }

    const statsResult = await getDashboardGlobalStatsAction(sharedFilters, internal ? { userId: resolvedUserId, viewerAccess: internal.viewerAccess } : undefined)
    if (!statsResult.success || !statsResult.stats) {
      return { success: false, error: statsResult.error || 'Failed to export analytics' } as const
    }

    if (kind === 'lost_revenue_bots') {
      return {
        success: true as const,
        ...buildBase64CsvPayload(
          `dashboard-lost-revenue-bots-${statsResult.stats.period}.csv`,
          [
            'Bot',
            'Pending count',
            'Pending amount',
            'Pending currency totals',
            'Failed count',
            'Failed amount',
            'Failed currency totals',
          ],
          statsResult.stats.lostRevenue.byBot.map((item) => [
            item.botName,
            item.pending.count,
            item.pending.totalAmount,
            formatCsvCurrencyTotals(item.pending.currencyTotals),
            item.failed.count,
            item.failed.totalAmount,
            formatCsvCurrencyTotals(item.failed.currencyTotals),
          ])
        ),
      }
    }

    if (kind === 'lost_revenue_methods') {
      return {
        success: true as const,
        ...buildBase64CsvPayload(
          `dashboard-lost-revenue-methods-${statsResult.stats.period}.csv`,
          [
            'Method',
            'Pending count',
            'Pending amount',
            'Pending currency totals',
            'Failed count',
            'Failed amount',
            'Failed currency totals',
          ],
          statsResult.stats.lostRevenue.byMethod.map((item) => [
            item.method,
            item.pending.count,
            item.pending.totalAmount,
            formatCsvCurrencyTotals(item.pending.currencyTotals),
            item.failed.count,
            item.failed.totalAmount,
            formatCsvCurrencyTotals(item.failed.currencyTotals),
          ])
        ),
      }
    }

    return {
      success: true as const,
      ...buildBase64CsvPayload(
        `dashboard-rankings-${statsResult.stats.period}.csv`,
        [
          'Bot',
          'Current revenue',
          'Previous revenue',
          'Revenue delta %',
          'Successful payments',
          'Previous successful payments',
          'Unique payers',
          'Active subscribers',
          'Conversion %',
          'Pending count',
          'Failed count',
        ],
        statsResult.stats.rankings.items.map((item) => [
          item.botName,
          item.currentRevenue,
          item.previousRevenue,
          item.revenueDeltaPercent,
          item.successfulPayments,
          item.previousSuccessfulPayments,
          item.uniquePayers,
          item.activeSubscribers,
          item.conversionPercent,
          item.pendingCount,
          item.failedCount,
        ])
      ),
    }
  } catch (error) {
    return { success: false, error: String(error) } as const
  }
}
