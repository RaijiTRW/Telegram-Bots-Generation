'use client'

import { useState, useRef, useEffect, KeyboardEvent, type ChangeEvent } from 'react'
import Image from 'next/image'
import {
  MessageSquareText,
  ChevronDown,
  FileText,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import type { ChatAttachment, ChatClarificationRequest, ChatModelOption, ChatSendPayload } from './types'
import { uploadBotMessageAttachmentAction } from '@/lib/bot-editor/actions/editor-actions'

interface ChatInputProps {
  botId?: string
  onSendMessage: (payload: ChatSendPayload) => void
  chatThreads?: Array<{
    id: string
    title: string
    messageCount: number
    isWorking?: boolean
  }>
  activeChatId?: string | null
  onCreateChat?: () => void | Promise<void>
  onSwitchChat?: (chatId: string) => void | Promise<void>
  onRenameChat?: (chatId: string, title: string) => void | Promise<void>
  onDeleteChat?: (chatId: string) => void | Promise<void>
  onStopRun?: () => void | Promise<void>
  clarification?: ChatClarificationRequest | null
  onAnswerClarification?: (answers: Array<{ questionId: string; question: string; answer: string }>) => void | Promise<void>
  isChatMenuDisabled?: boolean
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  { id: 'openai/gpt-5.4', label: 'GPT-5.4 (Рекомендуется)', badge: 'soon', locked: true },
  { id: 'z-ai/glm-5.1', label: 'GLM-5.1' },
  { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', badge: 'soon', locked: true },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', badge: 'soon', locked: true },
]

const DEFAULT_CHAT_MODEL = CHAT_MODEL_OPTIONS.find((option) => !option.locked)?.id ?? 'z-ai/glm-5.1'

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${Math.max(size, 1)} B`
}

function isImageFile(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith('image/')
}

function revokePreviewUrl(attachment: ChatAttachment) {
  if (attachment.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}

export function ChatInput({
  botId,
  onSendMessage,
  chatThreads = [],
  activeChatId = null,
  onCreateChat,
  onSwitchChat,
  onRenameChat,
  onDeleteChat,
  onStopRun,
  clarification,
  onAnswerClarification,
  isChatMenuDisabled = false,
  isLoading = false,
  disabled = false,
  placeholder,
  className,
}: ChatInputProps) {
  const t = useTranslations('editor.chat')
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)
  const [chatActionError, setChatActionError] = useState<string | null>(null)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false)
  const [clarificationSelections, setClarificationSelections] = useState<Record<string, string>>({})
  const [clarificationCustomAnswers, setClarificationCustomAnswers] = useState<Record<string, string>>({})
  const [isClarificationThoughtOpen, setIsClarificationThoughtOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stagedAttachmentsRef = useRef<ChatAttachment[]>([])

  useEffect(() => {
    stagedAttachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    return () => {
      stagedAttachmentsRef.current.forEach(revokePreviewUrl)
    }
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`
    }
  }, [input])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (composerRef.current?.contains(target)) {
        return
      }

      setIsAttachmentMenuOpen(false)
      setIsModelMenuOpen(false)
      setIsChatMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
    }
  }, [])

  const hasClarification = Boolean(clarification && clarification.questions.length > 0)
  const canSend =
    !disabled &&
    !hasClarification &&
    !isUploadingAttachment &&
    (input.trim().length > 0 || attachments.length > 0)
  const canStop = Boolean(onStopRun) && disabled && !isUploadingAttachment
  const canSubmitClarification =
    hasClarification &&
    !isLoading &&
    !isUploadingAttachment &&
    clarification!.questions.every((question) => {
      const selected = clarificationSelections[question.id]
      if (selected === '__custom__') {
        return Boolean((clarificationCustomAnswers[question.id] || '').trim())
      }
      return Boolean(selected)
    })

  const handleSend = () => {
    if (canStop) {
      setIsAttachmentMenuOpen(false)
      setIsModelMenuOpen(false)
      setIsChatMenuOpen(false)
      void Promise.resolve(onStopRun?.()).catch((error) => {
        setChatActionError(String(error) || t('cancelRunError'))
      })
      return
    }

    const trimmed = input.trim()
    if (!canSend) return

    onSendMessage({
      content: trimmed,
      model: selectedModel,
      attachments: attachments.map((attachment) => ({ ...attachment })),
    })

    setInput('')
    setAttachments([])
    setAttachmentUploadError(null)
    setChatActionError(null)
    setIsAttachmentMenuOpen(false)
    setIsModelMenuOpen(false)
    setIsChatMenuOpen(false)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleClarificationSubmit = () => {
    if (!clarification || !canSubmitClarification) return

    const answers = clarification.questions.map((question) => {
      const selected = clarificationSelections[question.id]
      const answer = selected === '__custom__'
        ? (clarificationCustomAnswers[question.id] || '').trim()
        : String(selected || '').trim()
      return {
        questionId: question.id,
        question: question.question,
        answer,
      }
    })

    void Promise.resolve(onAnswerClarification?.(answers)).catch((error) => {
      setChatActionError(String(error) || t('clarificationSubmitFailed'))
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId)
      if (target) {
        revokePreviewUrl(target)
      }

      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }

  const uploadAttachmentFile = async (file: File) => {
    if (!file) return

    if (!botId) {
      setAttachmentUploadError(t('attachmentUploadBotMissing'))
      return
    }

    setAttachmentUploadError(null)
    setIsUploadingAttachment(true)

    try {
      const result = await uploadBotMessageAttachmentAction(botId, file)

      if (!result.success || !result.path) {
        setAttachmentUploadError(result.error || t('attachmentUploadFailed'))
        return
      }

      const attachment: ChatAttachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: result.fileName || file.name,
        mimeType: result.mimeType || file.type || '',
        size: result.size || file.size,
        path: result.path,
        kind: isImageFile(result.mimeType || file.type || '') ? 'image' : 'file',
        previewUrl: isImageFile(result.mimeType || file.type || '')
          ? URL.createObjectURL(file)
          : undefined,
      }

      setAttachments((current) => [...current, attachment])
      setIsAttachmentMenuOpen(false)
    } catch (error) {
      setAttachmentUploadError(String(error) || t('attachmentUploadFailed'))
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handlePhotoPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.currentTarget.value = ''

    for (const file of files) {
      await uploadAttachmentFile(file)
    }
  }

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.currentTarget.value = ''

    for (const file of files) {
      await uploadAttachmentFile(file)
    }
  }

  const selectedModelLabel =
    CHAT_MODEL_OPTIONS.find((option) => option.id === selectedModel)?.label ||
    DEFAULT_CHAT_MODEL

  const activeChatTitle =
    chatThreads.find((thread) => thread.id === activeChatId)?.title ||
    t('chatList')

  const handleCreateChat = () => {
    setChatActionError(null)
    setIsAttachmentMenuOpen(false)
    setIsModelMenuOpen(false)
    void Promise.resolve(onCreateChat?.()).catch((error) => {
      setChatActionError(String(error) || t('chatActionFailed'))
    })
  }

  const handleSwitchChat = (chatId: string) => {
    setChatActionError(null)
    setIsAttachmentMenuOpen(false)
    setIsModelMenuOpen(false)
    setIsChatMenuOpen(false)
    void Promise.resolve(onSwitchChat?.(chatId)).catch((error) => {
      setChatActionError(String(error) || t('chatActionFailed'))
    })
  }

  const handleRenameChat = (chatId: string, currentTitle: string) => {
    const nextTitle = window.prompt(t('chatRenamePrompt'), currentTitle)
    if (nextTitle === null) {
      return
    }

    const normalizedTitle = nextTitle.trim()
    if (!normalizedTitle) {
      return
    }

    setChatActionError(null)
    void Promise.resolve(onRenameChat?.(chatId, normalizedTitle)).catch((error) => {
      setChatActionError(String(error) || t('chatActionFailed'))
    })
  }

  const handleDeleteChat = (chatId: string, title: string) => {
    const confirmed = window.confirm(t('chatDeleteConfirm', { title }))
    if (!confirmed) {
      return
    }

    setChatActionError(null)
    void Promise.resolve(onDeleteChat?.(chatId)).catch((error) => {
      setChatActionError(String(error) || t('chatActionFailed'))
    })
  }

  return (
    <div className={cn('relative z-10 px-6 pb-5 pt-2 md:px-8', className)}>
      <div className="mx-auto w-full max-w-[62rem]">
        <div
          ref={composerRef}
          className={cn(
            'relative overflow-visible rounded-[26px] border border-white/10 bg-[#10141B] p-2.5 shadow-[0_18px_80px_rgba(4,8,16,0.5)]',
            'transition-colors duration-200'
          )}
        >
          {attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 px-1 pt-1">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2 text-left',
                    attachment.kind === 'image' ? 'pr-2' : 'pr-3'
                  )}
                >
                  {attachment.kind === 'image' && attachment.previewUrl ? (
                    <Image
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="max-w-[180px] truncate text-sm font-medium text-white">
                      {attachment.name}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {formatFileSize(attachment.size)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label={t('removeAttachment')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {clarification ? (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-3 max-h-[52vh] overflow-y-auto rounded-[22px] border border-[#24A1DE]/25 bg-[#07101A] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.85)] [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/16 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8ED8FF]">
                    {t('clarificationTitle')}
                  </div>
                  <div className="mt-1 text-[13px] text-zinc-300">
                    {t('clarificationSubtitle')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClarificationThoughtOpen((current) => !current)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {isClarificationThoughtOpen ? t('clarificationHideThought') : t('clarificationShowThought')}
                </button>
              </div>

              {isClarificationThoughtOpen ? (
                <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-zinc-400">
                  {clarification.thought}
                </div>
              ) : null}

              <div className="mt-3 space-y-2.5">
                {clarification.questions.map((question) => {
                  const selected = clarificationSelections[question.id] || ''
                  const isCustom = selected === '__custom__'
                  return (
                    <div key={question.id} className="rounded-2xl border border-white/10 bg-[#0B1118] p-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="rounded-full border border-[#24A1DE]/25 bg-[#24A1DE]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8ED8FF]">
                          {question.header}
                        </div>
                        <div className="min-w-[14rem] flex-1 text-[13px] font-medium leading-5 text-white">
                          {question.question}
                        </div>
                      </div>

                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        {question.options.map((option, optionIndex) => (
                          <button
                            key={`${question.id}-${option.label}`}
                            type="button"
                            onClick={() => {
                              setClarificationSelections((current) => ({
                                ...current,
                                [question.id]: option.label,
                              }))
                            }}
                            className={cn(
                              'min-h-[54px] rounded-xl border px-3 py-2 text-left transition',
                              selected === option.label
                                ? 'border-[#24A1DE]/45 bg-[#24A1DE]/12 text-white'
                                : 'border-white/10 bg-[#070B10] text-zinc-300 hover:border-white/16 hover:bg-[#0D131B]'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium">{option.label}</span>
                              {option.recommended || optionIndex === 0 ? (
                                <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-300">
                                  {t('recommended')}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 max-h-8 overflow-hidden text-[11px] leading-4 text-zinc-500">
                              {option.description}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setClarificationSelections((current) => ({
                              ...current,
                              [question.id]: '__custom__',
                            }))
                          }}
                          className={cn(
                            'mb-2 rounded-full border px-3 py-1.5 text-[11px] transition',
                            isCustom
                              ? 'border-[#24A1DE]/35 bg-[#24A1DE]/10 text-[#8ED8FF]'
                              : 'border-white/8 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-white'
                          )}
                        >
                          {t('clarificationCustomAnswer')}
                        </button>
                        {isCustom ? (
                          <input
                            value={clarificationCustomAnswers[question.id] || ''}
                            onChange={(event) => {
                              setClarificationCustomAnswers((current) => ({
                                ...current,
                                [question.id]: event.target.value,
                              }))
                            }}
                            placeholder={t('clarificationCustomPlaceholder')}
                            className="h-9 min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-[#070B10] px-3 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-[#24A1DE]/40"
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleClarificationSubmit}
                  disabled={!canSubmitClarification}
                  className={cn(
                    'rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] px-4 py-2 text-[13px] font-medium text-white transition',
                    !canSubmitClarification && 'cursor-not-allowed opacity-45'
                  )}
                >
                  {isLoading ? t('clarificationChecking') : t('clarificationContinue')}
                </button>
              </div>
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('placeholder')}
            disabled={isLoading || disabled || hasClarification}
            rows={1}
            className={cn(
              'min-h-[62px] max-h-[180px] w-full resize-none bg-transparent px-2.5 pb-1.5 pt-1.5 text-[14px] leading-6 text-white outline-none placeholder:text-zinc-500',
              disabled && 'cursor-not-allowed'
            )}
          />

          <div className="mt-0.5 flex items-center justify-between gap-2.5 px-0.5 pb-0.5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen((current) => !current)
                    setIsModelMenuOpen(false)
                    setIsChatMenuOpen(false)
                  }}
                  disabled={isLoading || disabled || isUploadingAttachment || hasClarification}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300 transition',
                    'hover:border-[#24A1DE]/30 hover:bg-[#24A1DE]/10 hover:text-white',
                    (isLoading || disabled || isUploadingAttachment || hasClarification) && 'cursor-not-allowed opacity-50'
                  )}
                  aria-label={t('attachmentMenu')}
                >
                  {isUploadingAttachment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </button>

                {isAttachmentMenuOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-3 w-48 rounded-2xl border border-white/10 bg-[#0C1118]/96 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      <ImagePlus className="h-4 w-4 text-[#24A1DE]" />
                      <span>{t('attachPhoto')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      <FileText className="h-4 w-4 text-[#8B5CF6]" />
                      <span>{t('attachFile')}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsChatMenuOpen((current) => !current)
                    setIsAttachmentMenuOpen(false)
                    setIsModelMenuOpen(false)
                  }}
                  disabled={isChatMenuDisabled}
                  className={cn(
                    'inline-flex h-9 max-w-[11rem] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-zinc-200 transition',
                    'hover:border-[#24A1DE]/30 hover:bg-white/[0.07] hover:text-white',
                    isChatMenuDisabled && 'cursor-not-allowed opacity-50'
                  )}
                  aria-label={t('chatList')}
                >
                  <MessageSquareText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{activeChatTitle}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-500 transition-transform', isChatMenuOpen && 'rotate-180')} />
                </button>

                {isChatMenuOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-3 w-[22rem] rounded-[20px] border border-white/10 bg-[#0C1118]/96 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                    <div className="flex items-center justify-between gap-3 px-2.5 pb-1.5 pt-1">
                      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                        {t('chatList')}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateChat}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 text-[11px] text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t('newChat')}</span>
                      </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto px-1 pb-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
                      {chatThreads.length > 0 ? (
                        <div className="space-y-1">
                          {chatThreads.map((thread) => {
                            const isActive = thread.id === activeChatId
                            const isWorking = Boolean(thread.isWorking)
                            return (
                              <div
                                key={thread.id}
                                className={cn(
                                  'group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition',
                                  isActive
                                    ? 'border-[#24A1DE]/20 bg-[#24A1DE]/10'
                                    : 'border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSwitchChat(thread.id)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {isWorking ? (
                                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#8ED8FF]" />
                                    ) : null}
                                    <div className="truncate text-[13px] font-medium text-white">{thread.title}</div>
                                  </div>
                                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                                    <span>{t('chatMessagesCount', { count: thread.messageCount })}</span>
                                    {isWorking ? (
                                      <span className="rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#8ED8FF]">
                                        {t('taskInProgress')}
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRenameChat(thread.id, thread.title)}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
                                  aria-label={t('renameChat')}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteChat(thread.id, thread.title)}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-rose-400/12 hover:text-rose-200"
                                  aria-label={t('deleteChat')}
                                  disabled={chatThreads.length <= 1}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-zinc-400">
                          {t('noChats')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsModelMenuOpen((current) => !current)
                    setIsAttachmentMenuOpen(false)
                    setIsChatMenuOpen(false)
                  }}
                  disabled={isLoading || disabled || hasClarification}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-zinc-200 transition',
                    'hover:border-[#24A1DE]/30 hover:bg-white/[0.07] hover:text-white',
                    (isLoading || disabled || hasClarification) && 'cursor-not-allowed opacity-50'
                  )}
                  aria-label={t('modelSelector')}
                >
                  <span className="whitespace-nowrap">{selectedModelLabel}</span>
                  <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', isModelMenuOpen && 'rotate-180')} />
                </button>

                {isModelMenuOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-3 w-60 rounded-[20px] border border-white/10 bg-[#0C1118]/96 p-1.5 shadow-[0_16px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
                    <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
                      {t('modelSelector')}
                    </div>
                    {CHAT_MODEL_OPTIONS.map((option) => {
                      const isSelected = option.id === selectedModel
                      const isLocked = Boolean(option.locked)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            if (isLocked) return
                            setSelectedModel(option.id)
                            setIsModelMenuOpen(false)
                          }}
                          className={cn(
                            'flex w-full flex-col rounded-xl px-2.5 py-2 text-left transition',
                            isSelected
                              ? 'bg-[#24A1DE]/10 text-white ring-1 ring-[#24A1DE]/25'
                              : isLocked
                                ? 'cursor-not-allowed text-zinc-500'
                                : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium">{option.label}</span>
                            {option.badge === 'recommended' ? (
                              <span className="rounded-full border border-[#24A1DE]/25 bg-[#24A1DE]/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-[#24A1DE]">
                                {t('recommended')}
                              </span>
                            ) : null}
                            {isLocked ? (
                              <span className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                                {t('soon')}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[11px] text-zinc-500">{option.id}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={canStop ? isLoading : !canSend}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-[16px] text-white transition',
                canStop
                  ? 'bg-white/[0.08] ring-1 ring-white/12 hover:bg-white/[0.12]'
                  : 'bg-gradient-to-br from-[#24A1DE] via-[#3B82F6] to-[#8B5CF6] shadow-[0_14px_40px_rgba(79,70,229,0.35)] hover:scale-[1.02] hover:shadow-[0_18px_50px_rgba(79,70,229,0.45)]',
                (canStop ? isLoading : !canSend) && 'cursor-not-allowed opacity-45 shadow-none'
              )}
              aria-label={canStop ? t('stopRun') : t('sendMessage')}
              title={canStop ? t('stopRun') : t('sendMessage')}
            >
              {canStop ? (
                isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4 fill-current" />
              ) : (
                isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoPick}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilePick}
        />

        <div className="min-h-[20px] px-2 pt-3 text-xs">
          {isUploadingAttachment ? (
            <span className="text-zinc-400">{t('uploadingAttachment')}</span>
          ) : chatActionError ? (
            <span className="text-rose-300">{chatActionError}</span>
          ) : attachmentUploadError ? (
            <span className="text-rose-300">{attachmentUploadError}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
