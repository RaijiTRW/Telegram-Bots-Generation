'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Loader2, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { AiSectionIcon } from './ai-section-icon'
import type { ChatAttachment, ChatMessage, ChatSendPayload } from './types'
import type {
  AiAgentClarificationAnswer,
  AiAgentPendingClarification,
  AiAgentClarificationRequest,
  AiAgentLivePreview,
  AiAgentRunSnapshot,
  AiChatState,
  AiChatThread,
} from '@/lib/bot-editor/types/bot.types'
import {
  cancelBotAgentRunAction,
  createAiChatThreadAction,
  deleteAiChatThreadAction,
  getBotAgentRunStatusAction,
  renameAiChatThreadAction,
  switchAiChatThreadAction,
  startBotAgentRunAction,
} from '@/lib/bot-editor/actions/agent-actions'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import { HELP_GUIDE_KEYS } from '@/lib/bot-editor/help/help-guide-keys'

interface AiChatPanelProps {
  onClose?: () => void
  className?: string
  showHeader?: boolean
  createChatSignal?: number
}

type AiLimitNotice = {
  code: 'ai_limit_exceeded'
  planCode: 'base' | 'business' | 'enterprise'
  used: number
  limit: number
  cost: number
  resetsAt: string
  upgradePlanCode: 'business' | 'enterprise' | null
}

function hasBuildPreviewContent(preview: AiAgentLivePreview | null | undefined) {
  if (!preview || preview.mode !== 'build') {
    return false
  }

  return Boolean(
    preview.currentAction?.trim() ||
    preview.plan?.some((task) => task.trim().length > 0) ||
    preview.analysis?.trim() ||
    preview.nextAction?.trim() ||
    preview.summary?.trim() ||
    preview.completedTasksDelta?.some((task) => task.trim().length > 0)
  )
}

function buildRespondFallbackContent(run: AiAgentRunSnapshot) {
  const parts = [
    run.error,
    run.analysis,
    run.currentAction,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return parts.join('\n\n')
}

function getAiChatStateFromBot(bot: { metadata?: Record<string, unknown> } | null | undefined): AiChatState {
  const rawState =
    bot?.metadata?.aiChat && typeof bot.metadata.aiChat === 'object' && !Array.isArray(bot.metadata.aiChat)
      ? (bot.metadata.aiChat as Partial<AiChatState>)
      : null

  const chats = Array.isArray(rawState?.chats)
    ? [...rawState.chats].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    : []
  const activeChatId =
    rawState?.activeChatId && chats.some((chat) => chat.id === rawState.activeChatId)
      ? rawState.activeChatId
      : (chats[0]?.id || null)

  return {
    activeChatId,
    chats,
  }
}

function getActiveChatThread(state: AiChatState): AiChatThread | null {
  if (!state.activeChatId) {
    return state.chats[0] || null
  }

  return state.chats.find((chat) => chat.id === state.activeChatId) || state.chats[0] || null
}

function isPendingClarificationExpired(pending: AiAgentPendingClarification) {
  return Date.parse(pending.expiresAt) <= Date.now()
}

function getRestaurantQuickPrompts(locale: string) {
  const isRu = locale !== 'en'

  return [
    {
      id: 'restaurant-menu',
      label: isRu ? 'Меню' : 'Menu',
      prompt: isRu
        ? 'Собери Telegram-бота для ресторана, который показывает меню по категориям, помогает выбрать блюдо, отвечает на вопросы по составу и может передать заказ администратору. Сделай понятный сценарий для гостя ресторана.'
        : 'Build a Telegram bot for a restaurant that shows a categorized menu, helps guests choose dishes, answers ingredient questions, and can pass an order to the manager. Make the guest flow clear.',
    },
    {
      id: 'restaurant-booking',
      label: isRu ? 'Бронирование' : 'Booking',
      prompt: isRu
        ? 'Собери Telegram-бота для бронирования столиков в ресторане. Бот должен спросить дату, время, количество гостей, имя и телефон, подтвердить заявку и отправить данные администратору.'
        : 'Build a Telegram bot for restaurant table booking. It should ask for date, time, number of guests, name and phone, confirm the request, and send the details to the manager.',
    },
    {
      id: 'restaurant-delivery',
      label: isRu ? 'Доставка' : 'Delivery',
      prompt: isRu
        ? 'Собери Telegram-бота для доставки и самовывоза из ресторана. Бот должен показать меню, собрать заказ, адрес или выбор самовывоза, телефон клиента и передать заказ администратору.'
        : 'Build a Telegram bot for restaurant delivery and pickup. It should show the menu, collect the order, address or pickup choice, customer phone, and pass the order to the manager.',
    },
  ]
}

export function AiChatPanel({
  onClose,
  className,
  showHeader = true,
  createChatSignal,
}: AiChatPanelProps) {
  const tChat = useTranslations('editor.chat')
  const tNav = useTranslations('editor.nav')
  const locale = useLocale()
  const {
    bot,
    agentRun,
    isAgentRunActive,
    currentUserProfile,
    syncServerState,
  } = useBotState()
  const docsBasePath = `/${locale}/dashboard/docs`
  const [panelError, setPanelError] = useState<string | null>(null)
  const [limitNotice, setLimitNotice] = useState<AiLimitNotice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [streamPreview, setStreamPreview] = useState<AiAgentLivePreview | null>(null)
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<ChatMessage | null>(null)
  const [optimisticChatId, setOptimisticChatId] = useState<string | null>(null)
  const [isOptimisticThinking, setIsOptimisticThinking] = useState(false)
  const [pendingClarification, setPendingClarification] = useState<{
    chatId?: string | null
    prompt: string
    model?: string
    attachments: ChatAttachment[]
    request: AiAgentClarificationRequest
    answers: AiAgentClarificationAnswer[]
  } | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const latestAgentRunIdRef = useRef<string | null>(null)
  const handledCreateChatSignalRef = useRef(createChatSignal)
  const aiChatState = useMemo(() => getAiChatStateFromBot(bot), [bot])
  const activeChat = useMemo(() => getActiveChatThread(aiChatState), [aiChatState])
  const activeChatId = activeChat?.id || null
  const storedPendingClarification = bot?.metadata?.aiAgent?.pendingClarification || null
  const isRunForActiveChat = Boolean(agentRun && (!agentRun.chatId || agentRun.chatId === activeChatId))
  const isActiveChatAgentRunActive = Boolean(isAgentRunActive && isRunForActiveChat)
  const activePendingClarification = pendingClarification && (!pendingClarification.chatId || pendingClarification.chatId === activeChatId)
    ? pendingClarification
    : null
  const showRestaurantQuickPrompts = Boolean(
    (!activeChat || activeChat.messages.length === 0) &&
    !optimisticUserMessage &&
    !isActiveChatAgentRunActive
  )
  const restaurantQuickPrompts = useMemo(
    () => showRestaurantQuickPrompts ? getRestaurantQuickPrompts(locale) : [],
    [locale, showRestaurantQuickPrompts]
  )

  useEffect(() => {
    if (!storedPendingClarification || isPendingClarificationExpired(storedPendingClarification)) {
      setPendingClarification(null)
      return
    }

    setPendingClarification((current) => {
      if (current?.request.id === storedPendingClarification.request.id) {
        return current
      }

      return {
        chatId: storedPendingClarification.chatId,
        prompt: storedPendingClarification.prompt,
        model: storedPendingClarification.model,
        attachments: storedPendingClarification.attachments.map((attachment) => ({ ...attachment } as ChatAttachment)),
        request: storedPendingClarification.request,
        answers: storedPendingClarification.answers,
      }
    })
  }, [storedPendingClarification])

  useEffect(() => {
    const botId = String(bot?.id || '').trim()
    if (!botId || !storedPendingClarification) {
      return
    }

    const delay = Math.max(0, Date.parse(storedPendingClarification.expiresAt) - Date.now())
    const timeout = window.setTimeout(() => {
      void getBotAgentRunStatusAction(botId).then((result) => {
        if (!result.success) return
        setPendingClarification(null)
        syncServerState({
          config: result.config,
          botPatch: {
            metadata: result.metadata,
          },
        })
      })
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [bot?.id, storedPendingClarification, syncServerState])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [activeChatId, activeChat?.messages.length, agentRun?.runId, agentRun?.updatedAt, panelError])

  useEffect(() => {
    if (!agentRun) {
      return
    }

    if (latestAgentRunIdRef.current !== agentRun.runId) {
      latestAgentRunIdRef.current = agentRun.runId
      setPanelError(null)
      setLimitNotice(null)
      setStreamPreview(null)
      return
    }

    if (agentRun.status === 'failed' && agentRun.error) {
      setPanelError(agentRun.error)
    }
  }, [agentRun])

  const limitBanner = useMemo(() => {
    if (!limitNotice) return null

    const resetTime = Number.isFinite(Date.parse(limitNotice.resetsAt))
      ? new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          day: limitNotice.planCode === 'base' ? '2-digit' : undefined,
          month: limitNotice.planCode === 'base' ? 'short' : undefined,
        }).format(new Date(limitNotice.resetsAt))
      : null
    const isBase = limitNotice.planCode === 'base'
    const title = locale === 'en'
      ? (isBase ? 'Daily AI limit is over' : '5-hour AI limit is over')
      : (isBase ? 'Лимит AI на сегодня закончился' : '5-часовой лимит AI закончился')
    const details = locale === 'en'
      ? `Used ${limitNotice.used}/${limitNotice.limit} requests.${resetTime ? ` Resets at ${resetTime}.` : ''}`
      : `Использовано ${limitNotice.used}/${limitNotice.limit} запросов.${resetTime ? ` Обновится в ${resetTime}.` : ''}`
    const cta = limitNotice.upgradePlanCode
      ? (locale === 'en'
          ? `Upgrade to ${limitNotice.upgradePlanCode === 'business' ? 'Business' : 'Enterprise'}`
          : `Перейти на ${limitNotice.upgradePlanCode === 'business' ? 'Business' : 'Enterprise'}`)
      : (locale === 'en' ? 'Open subscription' : 'Открыть подписку')

    return {
      title,
      details,
      cta,
    }
  }, [limitNotice, locale])

  useEffect(() => {
    const botId = String(bot?.id || '').trim()
    const runId = String(agentRun?.runId || '').trim()

    if (!botId || !runId || !isAgentRunActive || typeof EventSource === 'undefined') {
      return
    }

    const eventSource = new EventSource(
      `/api/bot-agent-runs/${encodeURIComponent(botId)}/stream?runId=${encodeURIComponent(runId)}`
    )

    const handlePreview = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { preview?: AiAgentLivePreview | null }
        if (payload.preview?.runId === runId) {
          setStreamPreview(payload.preview)
        }
      } catch {
        // ignore malformed preview events
      }
    }

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { snapshot?: typeof agentRun | null }
        if (!payload.snapshot || payload.snapshot.runId !== runId) {
          return
        }

        syncServerState({
          botPatch: {
            metadata: {
              ...((bot?.metadata as Record<string, unknown> | undefined) || {}),
              aiAgent: {
                ...(((bot?.metadata?.aiAgent as Record<string, unknown> | undefined) || {})),
                currentRun: payload.snapshot,
              },
            },
          },
        })

        if (['completed', 'failed', 'cancelled'].includes(payload.snapshot.status)) {
          setStreamPreview(null)
          eventSource.close()
        }
      } catch {
        // ignore malformed snapshot events
      }
    }

    const handleEnd = () => {
      setStreamPreview(null)
      eventSource.close()
    }

    eventSource.addEventListener('preview', handlePreview as EventListener)
    eventSource.addEventListener('snapshot', handleSnapshot as EventListener)
    eventSource.addEventListener('end', handleEnd as EventListener)
    eventSource.onerror = () => {
      // Let EventSource retry on transient transport errors.
    }

    return () => {
      eventSource.removeEventListener('preview', handlePreview as EventListener)
      eventSource.removeEventListener('snapshot', handleSnapshot as EventListener)
      eventSource.removeEventListener('end', handleEnd as EventListener)
      eventSource.close()
    }
  }, [agentRun?.runId, bot?.id, bot?.metadata, isAgentRunActive, syncServerState])

  const renderedAgentRun = useMemo(() => {
    if (!agentRun || (activeChatId && agentRun.chatId && agentRun.chatId !== activeChatId)) {
      return null
    }

    if (!streamPreview || streamPreview.runId !== agentRun.runId) {
      return agentRun
    }

    if ((agentRun.mode ?? streamPreview.mode) === 'respond') {
      return {
        ...agentRun,
        mode: 'respond' as const,
        responseText: streamPreview.responseText || agentRun.responseText,
        streamingPreview: streamPreview,
      }
    }

    const previewTasks = (streamPreview.completedTasksDelta || []).map((text, index) => ({
      id: `preview-${index}-${text}`,
      text,
      completedAt: streamPreview.updatedAt,
    }))

    return {
      ...agentRun,
      currentAction: streamPreview.currentAction || agentRun.currentAction,
      plan: streamPreview.plan?.length ? streamPreview.plan : agentRun.plan,
      analysis: streamPreview.analysis || agentRun.analysis,
      nextAction: streamPreview.nextAction || agentRun.nextAction,
      summary: streamPreview.summary || agentRun.summary,
      completedTasks: previewTasks.length > 0
        ? [
            ...agentRun.completedTasks,
            ...previewTasks.filter((previewTask) => (
              !agentRun.completedTasks.some((task) => task.text.trim().toLowerCase() === previewTask.text.trim().toLowerCase())
            )),
          ]
        : agentRun.completedTasks,
      streamingPreview: streamPreview,
    }
  }, [activeChatId, agentRun, streamPreview])

  const hasPersistedAssistantRunMessage = useMemo(() => (
    renderedAgentRun
      ? (activeChat?.messages || []).some((message) => (
          message.role === 'assistant' &&
          message.runId === renderedAgentRun.runId
        ))
      : false
  ), [activeChat?.messages, renderedAgentRun])

  const isThinking = useMemo(() => {
    if (
      (isOptimisticThinking && optimisticChatId === activeChatId) ||
      (isSubmitting && !agentRun && optimisticChatId === activeChatId)
    ) {
      return true
    }

    if (hasPersistedAssistantRunMessage) {
      return false
    }

    if (!agentRun || !isActiveChatAgentRunActive) {
      return false
    }

    if (!streamPreview || streamPreview.runId !== agentRun.runId) {
      return true
    }

    if ((agentRun.mode ?? streamPreview.mode) === 'respond') {
      return !String(streamPreview.responseText || '').trim()
    }

    return !hasBuildPreviewContent(streamPreview)
  }, [activeChatId, agentRun, hasPersistedAssistantRunMessage, isActiveChatAgentRunActive, isOptimisticThinking, isSubmitting, optimisticChatId, streamPreview])

  const thinkingLines = useMemo(() => {
    const lines: string[] = []
    const addLine = (value: unknown) => {
      const line = String(value || '').trim()
      if (line && !lines.some((existing) => existing.toLowerCase() === line.toLowerCase())) {
        lines.push(line)
      }
    }

    if (renderedAgentRun) {
      addLine(renderedAgentRun.currentAction)
      addLine(renderedAgentRun.analysis)
      if (renderedAgentRun.plan?.length) {
        addLine(`${tChat('completedTitle')}: ${renderedAgentRun.plan.slice(0, 3).join(', ')}`)
      }
      addLine(renderedAgentRun.nextAction)
    }

    const matchingStreamPreview = streamPreview?.runId === agentRun?.runId ? streamPreview : null
    if (matchingStreamPreview) {
      addLine(matchingStreamPreview.currentAction)
      addLine(matchingStreamPreview.analysis)
      if (matchingStreamPreview.plan?.length) {
        addLine(`${tChat('completedTitle')}: ${matchingStreamPreview.plan.slice(0, 3).join(', ')}`)
      }
      addLine(matchingStreamPreview.nextAction)
    }

    if (activePendingClarification) {
      addLine(activePendingClarification.request.thought)
    }

    if (lines.length === 0) {
      addLine(tChat('thinkingDetails'))
    }

    return lines
  }, [activePendingClarification, agentRun?.runId, renderedAgentRun, streamPreview, tChat])

  const messages = useMemo<ChatMessage[]>(() => {
    const nextMessages: ChatMessage[] = (activeChat?.messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.createdAt),
      model: message.model,
      avatarUrl: message.role === 'user' ? currentUserProfile.avatarUrl : undefined,
      attachments: (message.attachments || []).map((attachment) => ({ ...attachment } as ChatAttachment)),
      renderMode: message.renderMode === 'agent-run' ? 'agent-run' : 'plain',
      agentRun: message.agentRun
        ? {
            ...message.agentRun,
            streamingPreview: null,
          }
        : undefined,
    }))

    if (
      optimisticUserMessage &&
      optimisticChatId === activeChatId &&
      !nextMessages.some((message) => message.id === optimisticUserMessage.id)
    ) {
      nextMessages.push(optimisticUserMessage)
    }

    if (renderedAgentRun && !hasPersistedAssistantRunMessage) {
      const runMode = renderedAgentRun.mode ?? streamPreview?.mode

      if (runMode === 'respond') {
        const responseText = String(renderedAgentRun.responseText || '').trim()
        const fallbackText = buildRespondFallbackContent(renderedAgentRun)
        const shouldRenderResponse = Boolean(responseText) || (!isActiveChatAgentRunActive && Boolean(fallbackText))

        if (shouldRenderResponse) {
          nextMessages.push({
            id: `agent-run-${renderedAgentRun.runId}`,
            role: renderedAgentRun.status === 'failed' ? 'system' : 'assistant',
            content: responseText || fallbackText,
            timestamp: new Date(renderedAgentRun.updatedAt || renderedAgentRun.startedAt),
            isTyping: isActiveChatAgentRunActive && Boolean(responseText),
            model: renderedAgentRun.model,
            attachments: (renderedAgentRun.attachments || []).map((attachment) => ({ ...attachment } as ChatAttachment)),
          })
        }
      } else {
        const shouldShowAgentRunBubble =
          !isActiveChatAgentRunActive ||
          hasBuildPreviewContent(streamPreview) ||
          renderedAgentRun.status === 'completed' ||
          renderedAgentRun.status === 'failed' ||
          renderedAgentRun.status === 'cancelled'

        if (shouldShowAgentRunBubble) {
          nextMessages.push({
            id: `agent-run-${renderedAgentRun.runId}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(renderedAgentRun.updatedAt || renderedAgentRun.startedAt),
            renderMode: 'agent-run',
            agentRun: renderedAgentRun,
          })
        }
      }
    }

    if (!renderedAgentRun && panelError) {
      nextMessages.push({
        id: 'agent-panel-error',
        role: 'system',
        content: panelError,
        timestamp: new Date(),
      })
    }

    return nextMessages
  }, [activeChat?.messages, activeChatId, currentUserProfile.avatarUrl, hasPersistedAssistantRunMessage, isActiveChatAgentRunActive, optimisticChatId, optimisticUserMessage, panelError, renderedAgentRun, streamPreview])

  const handleSendMessage = useCallback(async (payload: ChatSendPayload) => {
    if (!bot?.id) {
      setPanelError(tChat('botMissing'))
      return
    }

    const optimisticRunId = `optimistic-${Date.now()}`
    const now = new Date().toISOString()
    setPanelError(null)
    setLimitNotice(null)
    setPendingClarification(null)
    setOptimisticChatId(activeChatId)
    setOptimisticUserMessage({
      id: `optimistic-user-${optimisticRunId}`,
      role: 'user',
      content: payload.content,
      timestamp: new Date(now),
      model: payload.model,
      avatarUrl: currentUserProfile.avatarUrl,
      attachments: payload.attachments.map((attachment) => ({ ...attachment })),
    })
    setIsOptimisticThinking(true)
    setIsSubmitting(true)

    try {
      const result = await startBotAgentRunAction(bot.id, {
        prompt: payload.content,
        model: payload.model,
        locale,
        chatId: activeChatId,
        attachments: payload.attachments,
      })

      if (!result.success) {
        setIsOptimisticThinking(false)
        setOptimisticUserMessage(null)
        setOptimisticChatId(null)
        if ('metadata' in result && result.metadata) {
          syncServerState({
            botPatch: {
              metadata: result.metadata,
            },
          })
          setPendingClarification(null)
        }
        if ('limitNotice' in result && result.limitNotice) {
          setLimitNotice(result.limitNotice as AiLimitNotice)
          setPanelError(null)
          return
        }
        setPanelError(result.error || tChat('errorFallback'))
        return
      }

      if ('needsClarification' in result && result.needsClarification && result.clarification) {
        const pendingFromServer = 'pendingClarification' in result ? result.pendingClarification : null
        setIsOptimisticThinking(false)
        setOptimisticUserMessage(null)
        setOptimisticChatId(null)
        setPendingClarification({
          chatId: pendingFromServer?.chatId || activeChatId,
          prompt: pendingFromServer?.prompt || payload.content,
          model: pendingFromServer?.model || payload.model,
          attachments: (pendingFromServer?.attachments || payload.attachments).map((attachment) => ({ ...attachment } as ChatAttachment)),
          request: pendingFromServer?.request || result.clarification,
          answers: pendingFromServer?.answers || [],
        })
        syncServerState({
          botPatch: {
            metadata: result.metadata,
          },
        })
        return
      }

      if (!('snapshot' in result)) {
        return
      }

      setIsOptimisticThinking(false)
      setOptimisticUserMessage(null)
      setOptimisticChatId(null)
      syncServerState({
        botPatch: {
          metadata: {
            ...(((result.metadata as Record<string, unknown> | undefined) || {})),
            aiAgent: {
              ...(((result.metadata?.aiAgent as Record<string, unknown> | undefined) || {})),
              currentRun: result.snapshot || null,
            },
          },
        },
      })
      setStreamPreview(null)
    } catch (error) {
      setIsOptimisticThinking(false)
      setOptimisticUserMessage(null)
      setOptimisticChatId(null)
      setPanelError(error instanceof Error ? error.message : tChat('errorFallback'))
    } finally {
      setIsSubmitting(false)
    }
  }, [activeChatId, bot?.id, currentUserProfile.avatarUrl, locale, syncServerState, tChat])

  const handleAnswerClarification = useCallback(async (answers: AiAgentClarificationAnswer[]) => {
    if (!bot?.id || !activePendingClarification) {
      return
    }

    const nextAnswers = [...activePendingClarification.answers, ...answers]
    setPanelError(null)
    setLimitNotice(null)
    setIsSubmitting(true)

    try {
      const result = await startBotAgentRunAction(bot.id, {
        prompt: activePendingClarification.prompt,
        model: activePendingClarification.model,
        locale,
        chatId: activeChatId,
        attachments: activePendingClarification.attachments,
        clarificationAnswers: nextAnswers,
      })

      if (!result.success) {
        if ('metadata' in result && result.metadata) {
          syncServerState({
            botPatch: {
              metadata: result.metadata,
            },
          })
          setPendingClarification(null)
        }
        if ('limitNotice' in result && result.limitNotice) {
          setLimitNotice(result.limitNotice as AiLimitNotice)
          setPanelError(null)
          return
        }
        setPanelError(result.error || tChat('errorFallback'))
        return
      }

      if ('needsClarification' in result && result.needsClarification && result.clarification) {
        const pendingFromServer = 'pendingClarification' in result ? result.pendingClarification : null
        setPendingClarification({
          chatId: pendingFromServer?.chatId || activePendingClarification.chatId || activeChatId,
          prompt: pendingFromServer?.prompt || activePendingClarification.prompt,
          model: pendingFromServer?.model || activePendingClarification.model,
          attachments: (pendingFromServer?.attachments || activePendingClarification.attachments).map((attachment) => ({ ...attachment } as ChatAttachment)),
          request: pendingFromServer?.request || result.clarification,
          answers: pendingFromServer?.answers || nextAnswers,
        })
        syncServerState({
          botPatch: {
            metadata: result.metadata,
          },
        })
        return
      }

      if (!('snapshot' in result)) {
        return
      }

      setPendingClarification(null)
      syncServerState({
        botPatch: {
          metadata: {
            ...(((result.metadata as Record<string, unknown> | undefined) || {})),
            aiAgent: {
              ...(((result.metadata?.aiAgent as Record<string, unknown> | undefined) || {})),
              currentRun: result.snapshot || null,
            },
          },
        },
      })
      setStreamPreview(null)
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : tChat('errorFallback'))
    } finally {
      setIsSubmitting(false)
    }
  }, [activeChatId, activePendingClarification, bot?.id, locale, syncServerState, tChat])

  const handleCreateChat = useCallback(async () => {
    if (!bot?.id) {
      setPanelError(tChat('botMissing'))
      return
    }

    const result = await createAiChatThreadAction(bot.id, { locale })
    if (!result.success) {
      setPanelError(result.error || tChat('chatActionFailed'))
      return
    }

    setPanelError(null)
    setLimitNotice(null)
    syncServerState({
      botPatch: {
        metadata: result.metadata,
      },
    })
  }, [bot?.id, locale, syncServerState, tChat])

  useEffect(() => {
    if (createChatSignal === undefined || createChatSignal === handledCreateChatSignalRef.current) {
      return
    }

    handledCreateChatSignalRef.current = createChatSignal
    void handleCreateChat()
  }, [createChatSignal, handleCreateChat])

  const handleSwitchChat = useCallback(async (chatId: string) => {
    if (!bot?.id) {
      setPanelError(tChat('botMissing'))
      return
    }

    const result = await switchAiChatThreadAction(bot.id, chatId)
    if (!result.success) {
      setPanelError(result.error || tChat('chatActionFailed'))
      return
    }

    setPanelError(null)
    setLimitNotice(null)
    setStreamPreview(null)
    syncServerState({
      botPatch: {
        metadata: result.metadata,
      },
    })
  }, [bot?.id, syncServerState, tChat])

  const handleRenameChat = useCallback(async (chatId: string, title: string) => {
    if (!bot?.id) {
      setPanelError(tChat('botMissing'))
      return
    }

    const result = await renameAiChatThreadAction(bot.id, { chatId, title })
    if (!result.success) {
      setPanelError(result.error || tChat('chatActionFailed'))
      return
    }

    setPanelError(null)
    setLimitNotice(null)
    syncServerState({
      botPatch: {
        metadata: result.metadata,
      },
    })
  }, [bot?.id, syncServerState, tChat])

  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!bot?.id) {
      setPanelError(tChat('botMissing'))
      return
    }

    const result = await deleteAiChatThreadAction(bot.id, chatId)
    if (!result.success) {
      setPanelError(result.error || tChat('chatActionFailed'))
      return
    }

    setPanelError(null)
    setLimitNotice(null)
    setStreamPreview(null)
    syncServerState({
      botPatch: {
        metadata: result.metadata,
      },
    })
  }, [bot?.id, syncServerState, tChat])

  const handleCancelRun = useCallback(async () => {
    if (!bot?.id || !agentRun?.runId) {
      return
    }

    setPanelError(null)
    setIsCancelling(true)

    try {
      const result = await cancelBotAgentRunAction(bot.id, agentRun.runId)
      if (!result.success) {
        setPanelError(result.error || tChat('cancelRunError'))
        return
      }

      syncServerState({
        botPatch: {
          metadata: {
            ...(((result.metadata as Record<string, unknown> | undefined) || {})),
            aiAgent: {
              ...(((result.metadata?.aiAgent as Record<string, unknown> | undefined) || {})),
              currentRun: result.snapshot || null,
            },
          },
        },
      })
      setStreamPreview(null)
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : tChat('cancelRunError'))
    } finally {
      setIsCancelling(false)
    }
  }, [agentRun?.runId, bot?.id, syncServerState, tChat])

  return (
    <div className={cn('flex h-full flex-col bg-[#05070A]', className)}>
      {showHeader ? (
      <header className="shrink-0 border-b border-white/8 bg-[#06080D]/90 px-6 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <AiSectionIcon className="h-4 w-4 shrink-0" />
            <h1 className="truncate text-white font-semibold">{tNav('aiAssistant')}</h1>
            {isAgentRunActive ? (
              <span
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#24A1DE]/25 bg-[#24A1DE]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8ED8FF]"
                title={tChat('statusRunning')}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">{tChat('statusRunning')}</span>
              </span>
            ) : null}
            <HelpGuideButton
              guideKey={HELP_GUIDE_KEYS.editorAiChatOverview}
              title={tNav('aiAssistant')}
              summary={tChat('helpSummary')}
              steps={[tChat('helpStep1'), tChat('helpStep2'), tChat('helpStep3')]}
              notes={[tChat('helpNote')]}
              docsHref={`${docsBasePath}/how-it-works#editor-areas`}
            />
            <span className="hidden text-zinc-600 md:inline">|</span>
            <span className="hidden truncate text-sm text-zinc-400 md:inline">
              {tChat('panelSubtitle')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </header>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.08),transparent_28%),radial-gradient(circle_at_bottom,rgba(139,92,246,0.08),transparent_30%)]" />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <ChatMessages
            messages={messages}
            isLoading={isThinking}
            thinkingLines={thinkingLines}
            containerRef={messagesContainerRef}
            className="px-6 pb-4 pt-7 md:px-8"
          />

          {limitBanner ? (
            <div className="relative z-10 mx-6 mb-3 rounded-2xl border border-[#24A1DE]/30 bg-[#08131D]/95 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:mx-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{limitBanner.title}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-400">{limitBanner.details}</div>
                </div>
                <Link
                  href={`/${locale}/dashboard/subscription`}
                  className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#24A1DE] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1B8FC6]"
                >
                  {limitBanner.cta}
                </Link>
              </div>
            </div>
          ) : null}

          <ChatInput
            botId={bot?.id ? String(bot.id) : undefined}
            onSendMessage={handleSendMessage}
            quickPrompts={restaurantQuickPrompts}
            chatThreads={aiChatState.chats.map((chat) => ({
              id: chat.id,
              title: chat.title,
              messageCount: chat.messages.length,
              isWorking: Boolean(isAgentRunActive && agentRun?.chatId === chat.id),
            }))}
            activeChatId={activeChatId}
            onCreateChat={handleCreateChat}
            onSwitchChat={handleSwitchChat}
            onRenameChat={handleRenameChat}
            onDeleteChat={handleDeleteChat}
            onStopRun={isAgentRunActive && agentRun?.runId ? handleCancelRun : undefined}
            clarification={activePendingClarification?.request || null}
            onAnswerClarification={handleAnswerClarification}
            isChatMenuDisabled={false}
            isLoading={isSubmitting || isCancelling}
            disabled={isAgentRunActive || isSubmitting}
          />
        </div>
      </div>
    </div>
  )
}
