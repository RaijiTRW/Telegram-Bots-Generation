'use server'

import { headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { createBotSecretsService } from '@/lib/bot-editor/services/bot-secrets-service'
import { appendBotAuditEventSafe } from '@/lib/bot-editor/services/bot-audit-service'
import type {
  BotConfig,
  BotVariable,
  BotStatus,
  Edge as WorkflowEdge,
  Node as WorkflowNode,
  VariableType,
} from '@/lib/bot-editor/types/bot.types'
import { callTelegramApi } from '@/lib/bot-editor/runtime/telegram-api'
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

interface SaveSettingsInput {
  name: string
  description: string
  status: BotStatus
  telegramToken: string
  webhookUrl: string
  metadataPatch?: Record<string, unknown>
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

type SecretsClient = Parameters<typeof createBotSecretsService>[0]
type AuditClient = Parameters<typeof appendBotAuditEventSafe>[0]

const ALLOWED_NODE_TYPES = new Set<WorkflowNode['type']>([
  'message',
  'input',
  'condition',
  'router',
  'scheduler',
  'action',
  'http',
  'webhook',
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

function sanitizeSettingsMetadataPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const patch = input as Record<string, unknown>
  const features = patch.features
  if (!features || typeof features !== 'object') {
    return {}
  }

  const featureRecord = features as Record<string, unknown>
  const autoReactions = sanitizeAutoReactionsFeatureConfig(featureRecord.autoReactions)

  if (!autoReactions) {
    return {}
  }

  return {
    features: {
      autoReactions,
    },
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

    return { success: true, bot }
  } catch (error) {
    console.error('Failed to load editor bot:', error)
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
    const mergedFeatures =
      safeMetadataBase.features && typeof safeMetadataBase.features === 'object'
        ? {
            ...(safeMetadataBase.features as Record<string, unknown>),
            ...((safeSettingsMetadataPatch.features as Record<string, unknown> | undefined) || {}),
          }
        : ((safeSettingsMetadataPatch.features as Record<string, unknown> | undefined) || undefined)

    const updatedBot = await botService.updateBot(botId, {
      name: input.name.trim(),
      description: input.description.trim(),
      status: input.status,
      metadata: {
        ...safeMetadataBase,
        ...(mergedFeatures ? { features: mergedFeatures } : {}),
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

    return { success: true, bot: withConfig || { ...updatedBot, config: bot.config } }
  } catch (error) {
    console.error('Failed to save bot settings:', error)
    return { success: false, error: String(error) }
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

      return {
        success: true,
        mode: 'webhook',
        deepLink: `https://t.me/${me.username}?start=test`,
        botUsername: me.username,
        webhookUrl,
        bot: updatedBot,
      }
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

    return {
      success: true,
      mode: 'polling',
      deepLink: `https://t.me/${me.username}?start=test`,
      botUsername: me.username,
      webhookUrl: '',
      info: 'Локальный тест запущен в polling-режиме',
      bot: updatedBot,
    }
  } catch (error) {
    console.error('Failed to start bot test:', error)
    appendBotTestLog(botId, 'system', `Ошибка запуска теста: ${String(error)}`, 'error')
    try {
      const supabase = await createServerClientWrapper()
      await appendBotAuditEventSafe(supabase as unknown as AuditClient, {
        botId,
        actorUserId: user.id,
        source: 'editor',
        eventType: 'test.start_failed',
        payload: {
          error: String(error),
        },
      })
    } catch {
      // ignore audit write errors on failure path
    }
    setBotTestLogRunContext(botId, null)
    return { success: false, error: String(error) }
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

    return {
      success: true,
      bot: updatedBot,
    }
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
