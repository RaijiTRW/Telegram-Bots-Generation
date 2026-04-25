'use client'

import { Fragment, memo, RefObject, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  User,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { ChatAttachment, ChatMessage } from './types'
import type { Node } from '@/lib/bot-editor/types/bot.types'
import { AiSectionIcon } from './ai-section-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading?: boolean
  thinkingLines?: string[]
  className?: string
  containerRef?: RefObject<HTMLDivElement | null>
}

interface MessageBubbleProps {
  message: ChatMessage
}

type MarkdownBlock =
  | { type: 'paragraph'; content: string }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'ordered-list'; items: string[] }

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index))
    }

    if (match[2]) {
      parts.push(
        <strong key={`strong-${match.index}`} className="font-semibold text-white">
          {match[2]}
        </strong>
      )
    } else if (match[3]) {
      parts.push(
        <code
          key={`code-${match.index}`}
          className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.95em] text-[#8ED8FF]"
        >
          {match[3]}
        </code>
      )
    } else if (match[4] && match[5]) {
      parts.push(
        <a
          key={`link-${match.index}`}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="text-[#6EC8FF] underline decoration-[#24A1DE]/40 underline-offset-4 transition hover:text-[#9EDBFF]"
        >
          {match[4]}
        </a>
      )
    } else {
      parts.push(match[0])
    }

    cursor = pattern.lastIndex
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }

  return parts.length > 0 ? parts : [text]
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*•]\s+(.+)$/)
    if (unorderedMatch) {
      const items: string[] = []
      while (index < lines.length) {
        const nextTrimmed = lines[index].trim()
        const nextMatch = nextTrimmed.match(/^[-*•]\s+(.+)$/)
        if (!nextMatch) break
        items.push(nextMatch[1])
        index += 1
      }
      blocks.push({ type: 'unordered-list', items })
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      const items: string[] = []
      while (index < lines.length) {
        const nextTrimmed = lines[index].trim()
        const nextMatch = nextTrimmed.match(/^\d+\.\s+(.+)$/)
        if (!nextMatch) break
        items.push(nextMatch[1])
        index += 1
      }
      blocks.push({ type: 'ordered-list', items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const nextLine = lines[index]
      const nextTrimmed = nextLine.trim()
      if (!nextTrimmed) break
      if (/^[-*•]\s+/.test(nextTrimmed) || /^\d+\.\s+/.test(nextTrimmed)) break
      paragraphLines.push(nextLine)
      index += 1
    }
    blocks.push({
      type: 'paragraph',
      content: paragraphLines.join('\n'),
    })
  }

  return blocks
}

function FormattedChatText({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const blocks = parseMarkdownBlocks(content)

  return (
    <div className={cn('space-y-2.5', className)}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'unordered-list') {
          return (
            <ul
              key={`block-${blockIndex}`}
              className="list-disc space-y-1.5 pl-5 marker:text-[#24A1DE]"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${blockIndex}-${itemIndex}`}>
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ordered-list') {
          return (
            <ol
              key={`block-${blockIndex}`}
              className="list-decimal space-y-1.5 pl-5 marker:text-[#24A1DE]"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`item-${blockIndex}-${itemIndex}`}>
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          )
        }

        return (
          <p key={`block-${blockIndex}`} className="whitespace-pre-wrap">
            {block.content.split('\n').map((line, lineIndex) => (
              <Fragment key={`line-${blockIndex}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineMarkdown(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function ThinkingBubble({ lines }: { lines?: string[] }) {
  const t = useTranslations('editor.chat')
  const [isOpen, setIsOpen] = useState(false)
  const visibleLines = lines?.map((line) => line.trim()).filter(Boolean).slice(0, 5) || []

  return (
    <div className="flex max-w-[42rem] gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]">
        <AiSectionIcon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 rounded-[20px] rounded-tl-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#8B5CF6]" />
            <span className="text-[12.5px] text-zinc-400">{t('thinking')}</span>
          </span>
          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[10px] text-zinc-500 transition hover:text-zinc-200">
            {isOpen ? t('hideThinking') : t('showThinking')}
          </span>
        </button>

        {isOpen ? (
          <div className="mt-2 space-y-2 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] leading-5 text-zinc-400">
            {visibleLines.length > 0 ? (
              visibleLines.map((line, index) => (
                <p key={`${index}-${line}`} className="whitespace-pre-wrap">
                  {line}
                </p>
              ))
            ) : (
              <p>{t('thinkingDetails')}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function TypewriterText({
  text,
  animate = true,
}: {
  text: string
  animate?: boolean
}) {
  if (!animate || !text) {
    return <>{text || ''}</>
  }

  return <TypewriterAnimatedText key={text} text={text} />
}

function TypewriterAnimatedText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState('')
  const visibleTextRef = useRef(visibleText)

  useEffect(() => {
    visibleTextRef.current = visibleText
  }, [visibleText])

  useEffect(() => {
    const targetText = text || ''
    let index = 0
    const interval = window.setInterval(() => {
      const remaining = targetText.length - index
      if (remaining <= 0) {
        window.clearInterval(interval)
        return
      }

      index = Math.min(index + Math.max(1, Math.ceil(remaining / 22)), targetText.length)
      const nextValue = targetText.slice(0, index)
      setVisibleText(nextValue)
      visibleTextRef.current = nextValue

      if (index >= targetText.length) {
        window.clearInterval(interval)
      }
    }, 16)

    return () => {
      window.clearInterval(interval)
    }
  }, [text])

  const isTyping = visibleText !== text

  return (
    <>
      {visibleText}
      {isTyping ? (
        <span className="ml-[1px] inline-block h-[1em] w-[1.5px] translate-y-[2px] rounded-full bg-current/70 align-baseline animate-pulse" />
      ) : null}
    </>
  )
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${Math.max(size, 1)} B`
}

function MessageTimestamp({
  timestamp,
  className,
}: {
  timestamp: Date
  className?: string
}) {
  const locale = useLocale()
  const formatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(timestamp))
    } catch {
      return '--:--'
    }
  }, [locale, timestamp])

  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  )
}

const AttachmentPreviewList = ({
  attachments,
  variant = 'message',
}: {
  attachments: ChatAttachment[]
  variant?: 'message' | 'inline'
}) => {
  if (!attachments.length) return null

  return (
    <div className={cn('flex flex-wrap gap-2', variant === 'message' ? 'mt-3' : '')}>
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className={cn(
            'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]',
            attachment.kind === 'image'
              ? 'w-[136px]'
              : 'flex max-w-[220px] items-center gap-2.5 px-2.5 py-2'
          )}
        >
          {attachment.kind === 'image' && attachment.previewUrl ? (
            <>
              <Image
                src={attachment.previewUrl}
                alt={attachment.name}
                width={136}
                height={92}
                unoptimized
                className="h-[92px] w-full object-cover"
              />
              <div className="px-2.5 py-2">
                <div className="truncate text-[13px] font-medium text-white">{attachment.name}</div>
                <div className="text-xs text-zinc-400">{formatFileSize(attachment.size)}</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-white">{attachment.name}</div>
                <div className="text-xs text-zinc-400">{formatFileSize(attachment.size)}</div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

const NodePreview = ({ nodes }: { nodes: Node[] }) => {
  const t = useTranslations('editor.chat')
  if (!nodes || nodes.length === 0) return null

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'from-blue-500/20 to-blue-600/10 border-blue-500/30'
      case 'condition':
        return 'from-amber-500/20 to-amber-600/10 border-amber-500/30'
      case 'action':
        return 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
      case 'input':
        return 'from-green-500/20 to-green-600/10 border-green-500/30'
      case 'http':
        return 'from-rose-500/20 to-rose-600/10 border-rose-500/30'
      case 'webhook':
        return 'from-red-500/20 to-red-600/10 border-red-500/30'
      default:
        return 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30'
    }
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs text-zinc-400">
          {nodes.length > 1 ? t('nodesAddedMany', { count: nodes.length }) : t('nodesAddedOne')}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              'rounded-md border bg-gradient-to-br px-2 py-1 text-xs capitalize',
              getNodeColor(node.type)
            )}
          >
            {String(
              (node.data as Record<string, unknown>)?._label ||
              (node.data as Record<string, unknown>)?.label ||
              node.type
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const UserMessage = ({ message }: MessageBubbleProps) => {
  const tHeader = useTranslations('header')

  return (
    <div className="ml-auto flex max-w-[38rem] justify-end gap-2.5">
      <div className="flex flex-1 flex-col items-end">
        <div className="max-w-full rounded-[20px] rounded-tr-[10px] border border-[#24A1DE]/20 bg-gradient-to-br from-[#24A1DE]/16 to-[#8B5CF6]/16 px-3 py-2.5 shadow-[0_10px_30px_rgba(36,161,222,0.08)]">
          {message.content ? (
            <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-white">{message.content}</p>
          ) : null}
          {message.attachments && message.attachments.length > 0 ? (
            <AttachmentPreviewList attachments={message.attachments} />
          ) : null}
        </div>
        <MessageTimestamp
          timestamp={message.timestamp}
          className="mt-1.5 text-xs text-zinc-500"
        />
      </div>
      {message.avatarUrl ? (
        <Avatar className="h-8 w-8 border border-white/10 shadow-[0_8px_24px_rgba(79,70,229,0.18)]">
          <AvatarImage
            src={message.avatarUrl}
            alt={tHeader('userAvatarAlt')}
            className="object-cover"
          />
          <AvatarFallback className="bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  )
}

function AgentRunSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function normalizeTaskText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function buildRunTaskRows(run: NonNullable<ChatMessage['agentRun']>, showWorking: boolean) {
  const completedTasks = run.completedTasks || []
  const completedKeys = new Set(completedTasks.map((task) => normalizeTaskText(task.text)))
  const rows: Array<{
    id: string
    text: string
    state: 'queued' | 'active' | 'done'
  }> = []
  const plan = (run.plan || []).map((task) => task.trim()).filter(Boolean)

  for (const [index, task] of plan.entries()) {
    const key = normalizeTaskText(task)
    const isDone = completedKeys.has(key) || index < completedTasks.length
    rows.push({
      id: `plan-${index}-${key}`,
      text: task,
      state: isDone ? 'done' : 'queued',
    })
  }

  for (const task of completedTasks) {
    const key = normalizeTaskText(task.text)
    if (!rows.some((row) => normalizeTaskText(row.text) === key)) {
      rows.push({
        id: task.id,
        text: task.text,
        state: 'done',
      })
    }
  }

  if (showWorking) {
    const activeIndex = rows.findIndex((row) => row.state === 'queued')
    if (activeIndex >= 0) {
      rows[activeIndex] = {
        ...rows[activeIndex],
        state: 'active',
      }
    } else if (run.currentAction) {
      rows.push({
        id: `active-${normalizeTaskText(run.currentAction)}`,
        text: run.currentAction,
        state: 'active',
      })
    }
  }

  return rows
}

function AgentRunMessage({ message }: MessageBubbleProps) {
  const t = useTranslations('editor.chat')
  const run = message.agentRun

  if (!run) {
    return null
  }

  const statusMeta = {
    planning: {
      label: t('statusPlanning'),
      className: 'border-white/10 bg-white/[0.05] text-zinc-200',
    },
    running: {
      label: t('statusRunning'),
      className: 'border-[#24A1DE]/30 bg-[#24A1DE]/10 text-[#8ED8FF]',
    },
    verifying: {
      label: t('statusVerifying'),
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    },
    completed: {
      label: t('statusCompleted'),
      className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    },
    failed: {
      label: t('statusFailed'),
      className: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    },
    cancelled: {
      label: t('statusCancelled'),
      className: 'border-zinc-400/20 bg-white/[0.05] text-zinc-300',
    },
    idle: {
      label: t('statusIdle'),
      className: 'border-white/10 bg-white/[0.05] text-zinc-200',
    },
  }[run.status]

  const isCancelled = run.status === 'cancelled'
  const showWorking = run.status === 'planning' || run.status === 'running' || run.status === 'verifying'
  const shouldAnimate = showWorking && !run.streamingPreview
  const workingStatusText = run.currentAction || t('working')
  const noChangesRequired = run.status === 'completed' && Boolean(run.noChangesRequired)
  const taskRows = noChangesRequired ? [] : buildRunTaskRows(run, showWorking)

  return (
    <div className="flex max-w-[42rem] gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]">
        <AiSectionIcon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1">
        <div
          className={cn(
            'relative overflow-hidden rounded-[24px] rounded-tl-[11px] border bg-[linear-gradient(180deg,rgba(20,27,36,0.96),rgba(11,15,23,0.98))] px-3.5 py-3.5 shadow-[0_18px_60px_rgba(5,10,18,0.28)] backdrop-blur-xl',
            showWorking
              ? 'border-[#24A1DE]/28 shadow-[0_18px_70px_rgba(36,161,222,0.12)]'
              : 'border-[#24A1DE]/16'
          )}
        >
          {showWorking ? (
            <div className="pointer-events-none absolute inset-0 ai-agent-card-shine" />
          ) : null}
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]',
              showWorking && 'animate-pulse',
              statusMeta.className
            )}>
              {statusMeta.label}
            </span>
          </div>

          {!isCancelled ? (
            <>
              <AgentRunSection title={t('currentActionTitle')}>
                <p className="text-[13px] leading-5 text-white">
                  <TypewriterText
                    text={run.currentAction || t('startingRun')}
                    animate={shouldAnimate}
                  />
                </p>
              </AgentRunSection>

              {showWorking ? (
                <div className="mt-2 text-[12px] font-medium text-zinc-500">
                  <span className="ai-agent-text-shimmer">{workingStatusText}</span>
                </div>
              ) : null}

              {noChangesRequired ? (
                <AgentRunSection title={t('completedTitle')}>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5 text-[12.5px] leading-5 text-zinc-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{t('noChangesRequired')}</span>
                  </div>
                </AgentRunSection>
              ) : taskRows.length > 0 ? (
                <AgentRunSection title={t('completedTitle')}>
                  <div className="space-y-2">
                    {taskRows.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-start gap-2 rounded-2xl border px-3 py-2.5 transition-colors',
                          task.state === 'done'
                            ? 'border-emerald-400/10 bg-black/30'
                            : task.state === 'active'
                              ? 'border-[#24A1DE]/24 bg-[#24A1DE]/8'
                              : 'border-white/8 bg-black/20 opacity-72'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                            task.state === 'done'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : task.state === 'active'
                                ? 'bg-[#24A1DE]/15 text-[#8ED8FF]'
                                : 'border border-white/12 bg-white/[0.03] text-zinc-500'
                          )}
                        >
                          {task.state === 'done' ? (
                            <Check className="h-3 w-3" />
                          ) : task.state === 'active' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cn(
                            'text-[12.5px] leading-5',
                            task.state === 'queued' ? 'text-zinc-400' : 'text-zinc-100'
                          )}>
                            <TypewriterText text={task.text} animate={shouldAnimate && task.state !== 'queued'} />
                          </div>
                        </div>
                        <div className={cn(
                          'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]',
                          task.state === 'done'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : task.state === 'active'
                              ? 'bg-[#24A1DE]/12 text-[#8ED8FF]'
                              : 'bg-white/[0.04] text-zinc-500'
                        )}>
                          {task.state === 'done'
                            ? t('taskDone')
                            : task.state === 'active'
                              ? t('taskInProgress')
                              : t('taskQueued')}
                        </div>
                      </div>
                    ))}
                  </div>
                </AgentRunSection>
              ) : null}

              {run.analysis ? (
                <AgentRunSection title={t('analysisTitle')}>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-zinc-300">
                    <TypewriterText text={run.analysis} animate={shouldAnimate} />
                  </p>
                </AgentRunSection>
              ) : null}

              {run.error ? (
                <AgentRunSection title={t('errorTitle')}>
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/8 px-3 py-2.5 text-[12.5px] leading-5 text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <span>
                      <TypewriterText text={run.error} animate={false} />
                    </span>
                  </div>
                </AgentRunSection>
              ) : null}

              {run.nextAction && run.status !== 'completed' && run.status !== 'failed' ? (
                <AgentRunSection title={t('nextActionTitle')}>
                  <p className="text-[12.5px] leading-5 text-zinc-200">
                    <TypewriterText text={run.nextAction} animate={shouldAnimate} />
                  </p>
                </AgentRunSection>
              ) : null}
            </>
          ) : null}
        </div>
        <MessageTimestamp
          timestamp={message.timestamp}
          className="mt-1.5 block text-xs text-zinc-500"
        />
      </div>
    </div>
  )
}

const AssistantMessage = ({ message }: MessageBubbleProps) => (
  <div className="flex max-w-[38rem] gap-2.5">
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]">
      <AiSectionIcon className="h-3.5 w-3.5 text-white" />
    </div>
    <div className="flex-1">
      <div className="rounded-[20px] rounded-tl-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-xl">
        {!message.content && message.isTyping ? (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
          </div>
        ) : (
          <>
            {message.isTyping ? (
              <p className="whitespace-pre-wrap text-[12.5px] leading-5 text-white">
                <TypewriterText text={message.content} animate />
              </p>
            ) : (
              <FormattedChatText
                content={message.content}
                className="text-[12.5px] leading-5 text-zinc-100"
              />
            )}
            {message.generatedNodes && message.generatedNodes.length > 0 ? (
              <NodePreview nodes={message.generatedNodes} />
            ) : null}
          </>
        )}
      </div>
      {!message.isTyping && (
        <MessageTimestamp
          timestamp={message.timestamp}
          className="mt-1.5 block text-xs text-zinc-500"
        />
      )}
    </div>
  </div>
)

const SystemMessage = ({ message }: MessageBubbleProps) => (
  <div className="flex justify-center">
    <div className="rounded-full border border-white/6 bg-white/[0.03] px-4 py-2">
      <p className="text-xs text-zinc-500">{message.content}</p>
    </div>
  </div>
)

const ClarificationMessage = ({ message }: MessageBubbleProps) => {
  const t = useTranslations('editor.chat')
  const clarification = message.clarification
  if (!clarification) return null

  return (
    <div className="flex max-w-[42rem] gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]">
        <AiSectionIcon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 rounded-[20px] rounded-tl-[10px] border border-[#24A1DE]/18 bg-[#07101A]/82 px-3 py-3 backdrop-blur-xl">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8ED8FF]">
          {t('clarificationTitle')}
        </div>
        <div className="mt-1 text-[12.5px] text-zinc-300">{t('clarificationSubtitle')}</div>
        <div className="mt-3 space-y-2">
          {clarification.questions.map((question) => (
            <div key={question.id} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
              <div className="text-[12.5px] font-medium text-white">{question.question}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {question.options.map((option, index) => (
                  <span
                    key={`${question.id}-${option.label}`}
                    className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-1 text-[11px] text-zinc-400"
                  >
                    {option.label}{option.recommended || index === 0 ? ` · ${t('recommended')}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <MessageTimestamp
          timestamp={message.timestamp}
          className="mt-1.5 block text-xs text-zinc-500"
        />
      </div>
    </div>
  )
}

const MessageBubble = memo(({ message }: MessageBubbleProps) => {
  switch (message.role) {
    case 'user':
      return <UserMessage message={message} />
    case 'assistant':
      if (message.clarification) {
        return <ClarificationMessage message={message} />
      }
      if (message.renderMode === 'agent-run') {
        return <AgentRunMessage message={message} />
      }
      return <AssistantMessage message={message} />
    case 'system':
      return <SystemMessage message={message} />
    default:
      return null
  }
})

MessageBubble.displayName = 'MessageBubble'

export const ChatMessages = memo(({
  messages,
  isLoading,
  thinkingLines,
  className,
  containerRef,
}: ChatMessagesProps) => {
  const t = useTranslations('editor.chat')

  return (
    <div
      ref={containerRef}
      className={cn('flex-1 overflow-y-auto pb-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2', className)}
    >
      <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-4">
        {messages.length === 0 ? (
          <div className="max-w-[46rem]">
            <div className="flex gap-3">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] text-white shadow-[0_10px_30px_rgba(79,70,229,0.24)]">
                <AiSectionIcon className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.035] px-4 py-3.5 backdrop-blur-xl">
                <p className="text-[14px] font-medium leading-6 text-white">{t('emptyIntro')}</p>
                <ul className="mt-3.5 space-y-2 text-[12.5px] leading-5 text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-[#24A1DE]">•</span>
                    <span>{t('emptyHelp1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#24A1DE]">•</span>
                    <span>{t('emptyHelp2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#24A1DE]">•</span>
                    <span>{t('emptyHelp3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#24A1DE]">•</span>
                    <span>{t('emptyHelp4')}</span>
                  </li>
                </ul>
                <p className="mt-3.5 text-[12.5px] text-zinc-400">{t('emptyQuestion')}</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {isLoading ? <ThinkingBubble lines={thinkingLines} /> : null}
      </div>
    </div>
  )
})

ChatMessages.displayName = 'ChatMessages'
