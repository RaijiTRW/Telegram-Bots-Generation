'use server'

import { headers } from 'next/headers'
import { randomUUID } from 'crypto'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
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

interface SaveSettingsInput {
  name: string
  description: string
  status: BotStatus
  telegramToken: string
  webhookUrl: string
}

const ALLOWED_NODE_TYPES = new Set<WorkflowNode['type']>([
  'message',
  'input',
  'condition',
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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
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
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const token = input.telegramToken.trim()
    const webhookUrl = input.webhookUrl.trim()

    const updatedBot = await botService.updateBot(botId, {
      name: input.name.trim(),
      description: input.description.trim(),
      status: input.status,
      metadata: {
        ...bot.metadata,
        telegramToken: token,
        webhookUrl,
        testActive: token === bot.metadata?.telegramToken ? bot.metadata?.testActive : false,
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
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    const token = String(bot.metadata?.telegramToken || '').trim()
    if (!token) {
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
    const testRunId = randomUUID()

    const runtimeConfig: BotConfig = {
      nodes: input?.nodes ? normalizeNodes(input.nodes) : bot.config.nodes,
      edges: input?.edges ? normalizeEdges(input.edges) : bot.config.edges,
      variables: input?.variables ? normalizeVariables(input.variables) : bot.config.variables || [],
      version: input?.version || bot.config.version || '1.0.0',
    }

    if (!hasTriggerNode(runtimeConfig.nodes)) {
      return {
        success: false,
        error:
          'Добавьте хотя бы один Trigger на Canvas (например Command Trigger /start). Без Trigger бот не запускает сценарий.',
      }
    }

    const me = await callTelegramApi<{ id: number; username?: string }>(token, 'getMe')
    if (!me.username) {
      return { success: false, error: 'У бота нет username. Настройте бота в @BotFather.' }
    }

    const baseUrl = await resolveBaseUrlSafe()

    if (canUseWebhook(baseUrl)) {
      stopTelegramPolling(botId)

      const webhookUrl = `${baseUrl}/api/telegram/webhook/${botId}`
      const webhookSecret = randomUUID()

      await callTelegramApi(token, 'setWebhook', {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      })

      await botService.updateBot(botId, {
        status: 'active',
        metadata: {
          ...bot.metadata,
          telegramToken: token,
          botUsername: me.username,
          telegramBotId: me.id,
          webhookUrl,
          webhookSecret,
          testActive: true,
          testMode: 'webhook',
          testRunId,
          testStartedAt: new Date().toISOString(),
        },
      })

      const updatedBot = await botService.getBot(botId)

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

    startTelegramPolling({
      botId,
      botToken: token,
      config: runtimeConfig,
      testRunId,
    })

    await botService.updateBot(botId, {
      status: 'active',
      metadata: {
        ...bot.metadata,
        telegramToken: token,
        botUsername: me.username,
        telegramBotId: me.id,
        webhookUrl: '',
        webhookSecret: null,
        testActive: true,
        testMode: 'polling',
        testRunId,
        testStartedAt: new Date().toISOString(),
      },
    })

    const updatedBot = await botService.getBot(botId)

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
    const bot = await botService.getBot(botId)

    if (!bot) {
      return { success: false, error: 'Bot not found' }
    }

    stopTelegramPolling(botId)
    clearRuntimeSessionsForBot(botId)

    const token = String(bot.metadata?.telegramToken || '').trim()
    if (token) {
      try {
        await callTelegramApi(token, 'deleteWebhook', {
          drop_pending_updates: true,
        })
      } catch (error) {
        console.error('Failed to delete webhook during stop:', error)
      }
    }

    await botService.updateBot(botId, {
      metadata: {
        ...bot.metadata,
        testActive: false,
        testMode: 'stopped',
        testRunId: null,
        testStoppedAt: new Date().toISOString(),
        webhookSecret: null,
      },
    })

    const updatedBot = await botService.getBot(botId)

    return {
      success: true,
      bot: updatedBot,
    }
  } catch (error) {
    console.error('Failed to stop bot test:', error)
    return { success: false, error: String(error) }
  }
}
