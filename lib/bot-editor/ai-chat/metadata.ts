import { randomUUID } from 'node:crypto'
import type {
  AiAgentAttachment,
  AiChatState,
  AiChatStoredMessage,
  AiChatThread,
  Bot,
  BotMetadata,
} from '@/lib/bot-editor/types/bot.types'

const DEFAULT_CHAT_TITLE_RU = 'Новый чат'
const DEFAULT_CHAT_TITLE_EN = 'New chat'
const MAX_CHAT_TITLE_LENGTH = 80
const MAX_CHAT_MESSAGES_PER_THREAD = 80

function normalizeText(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
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

      const id = normalizeText(record.id, 160)
      const name = normalizeText(record.name, 240)
      const mimeType = normalizeText(record.mimeType, 160)
      const path = normalizeText(record.path, 512)
      const kind = normalizeText(record.kind, 32)

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

function sanitizeStoredMessage(value: unknown): AiChatStoredMessage | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  const id = normalizeText(record.id, 160)
  const role = normalizeText(record.role, 32)
  const content = normalizeText(record.content, 12000)
  const createdAt = normalizeText(record.createdAt, 64)

  if (!id || (role !== 'user' && role !== 'assistant' && role !== 'system') || !createdAt) {
    return null
  }

  return {
    id,
    runId: normalizeText(record.runId, 160) || undefined,
    role,
    content,
    createdAt,
    model: normalizeText(record.model, 160) || undefined,
    attachments: sanitizeAttachments(record.attachments),
    renderMode: normalizeText(record.renderMode, 32) === 'agent-run' ? 'agent-run' : 'plain',
    agentRun:
      record.agentRun && typeof record.agentRun === 'object' && !Array.isArray(record.agentRun)
        ? cloneValue(record.agentRun) as AiChatStoredMessage['agentRun']
        : undefined,
  }
}

function sanitizeThread(value: unknown): AiChatThread | null {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  const id = normalizeText(record.id, 160)
  const title = normalizeText(record.title, MAX_CHAT_TITLE_LENGTH)
  const createdAt = normalizeText(record.createdAt, 64)
  const updatedAt = normalizeText(record.updatedAt, 64)

  if (!id || !title || !createdAt || !updatedAt) {
    return null
  }

  return {
    id,
    title,
    createdAt,
    updatedAt,
    summary: normalizeText(record.summary, 4000) || undefined,
    summarizedMessageCount: Math.max(0, Number(record.summarizedMessageCount || 0) || 0),
    messages: Array.isArray(record.messages)
      ? record.messages
          .map((item) => sanitizeStoredMessage(item))
          .filter((item): item is AiChatStoredMessage => Boolean(item))
          .slice(-MAX_CHAT_MESSAGES_PER_THREAD)
      : [],
  }
}

export function getAiChatState(metadata: BotMetadata | undefined | null): AiChatState {
  const rawAiChat =
    metadata?.aiChat && typeof metadata.aiChat === 'object' && !Array.isArray(metadata.aiChat)
      ? (metadata.aiChat as unknown as Record<string, unknown>)
      : {}

  const chats = Array.isArray(rawAiChat.chats)
    ? rawAiChat.chats
        .map((item) => sanitizeThread(item))
        .filter((item): item is AiChatThread => Boolean(item))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : []

  const rawActiveChatId = normalizeText(rawAiChat.activeChatId, 160)
  const activeChatId = rawActiveChatId && chats.some((chat) => chat.id === rawActiveChatId)
    ? rawActiveChatId
    : (chats[0]?.id || null)

  return {
    activeChatId,
    chats,
  }
}

export function getDefaultChatTitle(locale: string | undefined, index = 0) {
  const baseTitle = locale === 'en' ? DEFAULT_CHAT_TITLE_EN : DEFAULT_CHAT_TITLE_RU
  return index > 0 ? `${baseTitle} ${index + 1}` : baseTitle
}

export function createAiChatThread(locale?: string, title?: string, id?: string): AiChatThread {
  const now = new Date().toISOString()
  return {
    id: normalizeText(id, 160) || randomUUID(),
    title: normalizeText(title, MAX_CHAT_TITLE_LENGTH) || getDefaultChatTitle(locale),
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

export function pickChatTitleFromPrompt(prompt: string, locale?: string) {
  const normalized = normalizeText(prompt, MAX_CHAT_TITLE_LENGTH)
  if (!normalized) {
    return getDefaultChatTitle(locale)
  }

  return normalized
}

export function getActiveChatThread(state: AiChatState): AiChatThread | null {
  if (!state.activeChatId) {
    return null
  }

  return state.chats.find((chat) => chat.id === state.activeChatId) || null
}

export function upsertAiChatThread(state: AiChatState, thread: AiChatThread, makeActive = false): AiChatState {
  const chats = [
    thread,
    ...state.chats.filter((existingChat) => existingChat.id !== thread.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return {
    activeChatId: makeActive ? thread.id : (state.activeChatId && chats.some((chat) => chat.id === state.activeChatId)
      ? state.activeChatId
      : (chats[0]?.id || null)),
    chats,
  }
}

export function appendMessageToThread(
  thread: AiChatThread,
  input: Omit<AiChatStoredMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): AiChatThread {
  const message: AiChatStoredMessage = {
    id: normalizeText(input.id, 160) || randomUUID(),
    runId: normalizeText(input.runId, 160) || undefined,
    role: input.role,
    content: normalizeText(input.content, 12000),
    createdAt: normalizeText(input.createdAt, 64) || new Date().toISOString(),
    model: normalizeText(input.model, 160) || undefined,
    attachments: sanitizeAttachments(input.attachments),
    renderMode: input.renderMode === 'agent-run' ? 'agent-run' : 'plain',
    agentRun: input.agentRun ? cloneValue(input.agentRun) : undefined,
  }

  return {
    ...thread,
    updatedAt: new Date().toISOString(),
    messages: [...thread.messages, message].slice(-MAX_CHAT_MESSAGES_PER_THREAD),
  }
}

export function replaceThreadInState(state: AiChatState, thread: AiChatThread): AiChatState {
  return {
    activeChatId: state.activeChatId === thread.id ? thread.id : state.activeChatId,
    chats: state.chats
      .map((existingChat) => (existingChat.id === thread.id ? thread : existingChat))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  }
}

export function renameThreadInState(state: AiChatState, threadId: string, title: string): AiChatState {
  const normalizedTitle = normalizeText(title, MAX_CHAT_TITLE_LENGTH)
  if (!normalizedTitle) {
    return state
  }

  return {
    ...state,
    chats: state.chats.map((chat) => (
      chat.id === threadId
        ? {
            ...chat,
            title: normalizedTitle,
            updatedAt: new Date().toISOString(),
          }
        : chat
    )),
  }
}

export function deleteThreadFromState(state: AiChatState, threadId: string): AiChatState {
  const chats = state.chats.filter((chat) => chat.id !== threadId)

  return {
    activeChatId:
      state.activeChatId === threadId
        ? (chats[0]?.id || null)
        : (state.activeChatId && chats.some((chat) => chat.id === state.activeChatId)
          ? state.activeChatId
          : (chats[0]?.id || null)),
    chats,
  }
}

export function switchActiveChat(state: AiChatState, threadId: string): AiChatState {
  if (!state.chats.some((chat) => chat.id === threadId)) {
    return state
  }

  return {
    ...state,
    activeChatId: threadId,
  }
}

export function mergeAiChatMetadata(bot: Bot, nextState: AiChatState): BotMetadata {
  return {
    ...(bot.metadata || {}),
    aiChat: nextState,
  }
}
