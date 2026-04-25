'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Send, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BotConfig, BotMetadata } from '@/lib/bot-editor/types/bot.types'

type PreviewMessage = {
  id: string
  role: 'bot' | 'user' | 'system'
  text: string
  buttons?: PreviewButton[][]
}

type PreviewButton = {
  text: string
  callbackData?: string
  url?: string
}

type ReplyKeyboardPreviewButton = {
  text: string
}

type ReplyKeyboardPreviewRule = {
  id: string
  variable: string
  operator: string
  value: unknown
  rows: ReplyKeyboardPreviewButton[][]
}

type ReplyKeyboardPreviewConfig = {
  enabled: boolean
  baseRows: ReplyKeyboardPreviewButton[][]
  rules: ReplyKeyboardPreviewRule[]
}

interface LivePreviewPhoneProps {
  config: BotConfig
  metadata?: BotMetadata
  isOpen: boolean
  startSignal?: number
  onOpenChange: (open: boolean) => void
}

const MAX_STEPS = 80

const textOf = (value: unknown) => String(value ?? '').trim()

function createPreviewMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `preview-${crypto.randomUUID()}`
  }

  return `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeRows(keyboard: unknown): Array<Array<Record<string, unknown>>> {
  if (!keyboard || typeof keyboard !== 'object') return []
  const record = keyboard as Record<string, unknown>
  const rawRows = Array.isArray(record.rows)
    ? record.rows
    : Array.isArray(record.inline_keyboard)
      ? record.inline_keyboard
      : Array.isArray(record.buttons)
        ? [record.buttons]
        : []

  return rawRows
    .map((row) => {
      const buttons: unknown[] = Array.isArray(row)
        ? row
        : Array.isArray((row as Record<string, unknown>)?.buttons)
          ? ((row as Record<string, unknown>).buttons as unknown[])
          : []
      return buttons.filter((button): button is Record<string, unknown> => Boolean(button && typeof button === 'object'))
    })
    .filter((row) => row.length > 0)
}

function resolveButtons(data: Record<string, unknown>, variables?: Record<string, unknown>): PreviewButton[][] | undefined {
  const keyboard = data.keyboard ?? data.inlineKeyboard ?? (Array.isArray(data.buttons) ? data.buttons : undefined)
  const rows = normalizeRows(keyboard)
  if (!rows.length) return undefined

  const normalizedRows: PreviewButton[][] = rows
    .map((row) => {
      const normalizedRow: PreviewButton[] = row
        .map((button): PreviewButton | null => {
          const text = textOf(interpolateTemplate(button.text || button.label || button.title, variables))
          if (!text) return null
          return {
            text,
            callbackData: textOf(interpolateTemplate(button.callbackData || button.callback_data || button.data || button.value || button.action, variables)),
            url: textOf(interpolateTemplate(button.url || button.starsUrl || button.paymentUrl || button.payment_url, variables)),
          }
        })
        .filter((button): button is PreviewButton => Boolean(button))
      return normalizedRow
    })
    .filter((row) => row.length > 0)

  return normalizedRows.length ? normalizedRows : undefined
}

function normalizeReplyKeyboardPreviewRows(value: unknown): ReplyKeyboardPreviewButton[][] {
  if (!Array.isArray(value)) return []

  return value
    .map((row) => {
      if (!Array.isArray(row)) return []
      return row
        .map((button): ReplyKeyboardPreviewButton | null => {
          if (typeof button === 'string') {
            const text = textOf(button)
            return text ? { text } : null
          }

          if (!button || typeof button !== 'object') return null
          const record = button as Record<string, unknown>
          const text = textOf(record.text || record.label || record.title)
          const emoji = textOf(record.emoji)
          const label = `${emoji ? `${emoji} ` : ''}${text}`.trim()
          return label ? { text: label } : null
        })
        .filter((button): button is ReplyKeyboardPreviewButton => Boolean(button))
    })
    .filter((row) => row.length > 0)
}

function readReplyKeyboardPreviewConfig(metadata?: BotMetadata): ReplyKeyboardPreviewConfig | null {
  const features = metadata?.features && typeof metadata.features === 'object'
    ? metadata.features as Record<string, unknown>
    : {}
  const raw = features.replyKeyboard && typeof features.replyKeyboard === 'object'
    ? features.replyKeyboard as Record<string, unknown>
    : null

  if (!raw || !raw.enabled) return null

  const rules = Array.isArray(raw.rules)
    ? raw.rules
        .map((item, index): ReplyKeyboardPreviewRule | null => {
          if (!item || typeof item !== 'object') return null
          const record = item as Record<string, unknown>
          const rows = normalizeReplyKeyboardPreviewRows(record.rows)
          if (!rows.length) return null
          return {
            id: textOf(record.id) || `rule_${index + 1}`,
            variable: textOf(record.variable),
            operator: textOf(record.operator || 'equals'),
            value: record.value,
            rows,
          }
        })
        .filter((rule): rule is ReplyKeyboardPreviewRule => Boolean(rule))
    : []

  return {
    enabled: true,
    baseRows: normalizeReplyKeyboardPreviewRows(raw.baseRows),
    rules,
  }
}

function resolveReplyKeyboardRows(args: {
  metadata?: BotMetadata
  mode: 'system' | 'hidden' | 'variant'
  variantKey?: string
  variables: Record<string, unknown>
}): ReplyKeyboardPreviewButton[][] {
  const keyboard = readReplyKeyboardPreviewConfig(args.metadata)
  if (!keyboard || args.mode === 'hidden') return []

  if (args.mode === 'variant') {
    const variantKey = args.variantKey || 'base'
    if (variantKey === 'base') return keyboard.baseRows
    return keyboard.rules.find((rule) => rule.id === variantKey)?.rows || keyboard.baseRows
  }

  const matchedRule = keyboard.rules.find((rule) => {
    if (!rule.variable) return false
    return evaluate(rule.operator || 'equals', resolvePath(args.variables, rule.variable), rule.value)
  })

  return matchedRule?.rows || keyboard.baseRows
}

function getNextNodeId(config: BotConfig, sourceId: string, handle?: string | null) {
  const edges = config.edges.filter((edge) => edge.source === sourceId)
  if (handle) {
    const exact = edges.find((edge) => edge.sourceHandle === handle)
    if (exact) return exact.target
    if (handle !== 'default') return null
    return edges.find((edge) => !edge.sourceHandle || edge.sourceHandle === 'default')?.target || null
  }
  return edges.find((edge) => !edge.sourceHandle || edge.sourceHandle === 'default')?.target || edges[0]?.target || null
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return

  let current = target
  for (const part of parts.slice(0, -1)) {
    const next = current[part]
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
}

function resolvePath(source: Record<string, unknown>, path: string): unknown {
  let current: unknown = source
  for (const key of path.split('.').map((part) => part.trim()).filter(Boolean)) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function interpolateTemplate(value: unknown, variables?: Record<string, unknown>): string {
  const template = String(value ?? '')
  if (!template || !variables) return template

  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, rawPath) => {
    const path = String(rawPath || '').trim()
    if (!path) return ''
    const directValue = variables[path]
    const resolvedValue = directValue !== undefined ? directValue : resolvePath(variables, path)
    if (resolvedValue === undefined || resolvedValue === null) return match
    if (typeof resolvedValue === 'object') return JSON.stringify(resolvedValue)
    return String(resolvedValue)
  })
}

function evaluate(operator: string, left: unknown, right: unknown) {
  const leftText = textOf(left).toLowerCase()
  const rightText = textOf(right).toLowerCase()
  switch (operator) {
    case 'contains':
      return leftText.includes(rightText)
    case 'notContains':
      return !leftText.includes(rightText)
    case 'notEquals':
      return leftText !== rightText
    case 'isEmpty':
      return !leftText
    case 'isNotEmpty':
      return Boolean(leftText)
    default:
      return leftText === rightText
  }
}

function findStartNode(config: BotConfig, input?: { text?: string; callbackData?: string }) {
  const triggers = config.nodes.filter((node) => node.type === 'trigger')
  const callbackData = textOf(input?.callbackData)
  const incomingText = textOf(input?.text)

  if (callbackData) {
    return triggers.find((node) => {
      const data = node.data as Record<string, unknown>
      return textOf(data.trigger || 'command') === 'callbackQuery' && (!textOf(data.pattern) || textOf(data.pattern) === callbackData)
    }) || null
  }

  if (incomingText) {
    const command = incomingText.startsWith('/') ? incomingText.slice(1) : incomingText
    return triggers.find((node) => {
      const data = node.data as Record<string, unknown>
      const trigger = textOf(data.trigger || 'command')
      const pattern = textOf(data.pattern).replace(/^\//, '')
      if (trigger === 'command') return pattern ? pattern === command : incomingText === '/start'
      if (trigger === 'text') return !pattern || incomingText.toLowerCase().includes(pattern.toLowerCase())
      if (trigger === 'any') return true
      return false
    }) || null
  }

  return triggers.find((node) => {
    const data = node.data as Record<string, unknown>
    return textOf(data.trigger || 'command') === 'command' && (!textOf(data.pattern) || textOf(data.pattern).replace(/^\//, '') === 'start')
  }) || triggers[0] || null
}

export function LivePreviewPhone({ config, metadata, isOpen, startSignal = 0, onOpenChange }: LivePreviewPhoneProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [input, setInput] = useState('')
  const [waitingNodeId, setWaitingNodeId] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [isStarted, setIsStarted] = useState(false)
  const [replyKeyboardMode, setReplyKeyboardMode] = useState<'system' | 'hidden' | 'variant'>('system')
  const [replyKeyboardVariantKey, setReplyKeyboardVariantKey] = useState('base')
  const [replyKeyboardRows, setReplyKeyboardRows] = useState<ReplyKeyboardPreviewButton[][]>([])

  const nodeMap = useMemo(() => new Map(config.nodes.map((node) => [node.id, node])), [config.nodes])
  const pushMessage = useCallback((message: Omit<PreviewMessage, 'id'>) => {
    setMessages((current) => [...current, { ...message, id: createPreviewMessageId() }])
  }, [])

  const runFrom = useCallback((startNodeId: string | null, nextVariables?: Record<string, unknown>) => {
    let currentNodeId = startNodeId
    const localVariables = { ...(nextVariables || variables) }
    const callback = localVariables.callback && typeof localVariables.callback === 'object' && !Array.isArray(localVariables.callback)
      ? { ...(localVariables.callback as Record<string, unknown>) }
      : {}
    const callbackData = textOf(localVariables['callback.data'] ?? callback.data)
    if (callbackData) callback.data = callbackData
    const localContext: Record<string, unknown> = {
      ...localVariables,
      callback: Object.keys(callback).length ? callback : undefined,
      message: { text: localVariables['message.text'] || '' },
      user: { firstName: 'Алексей', username: 'preview_user' },
      chat: { id: 10001 },
    }
    let localKeyboardMode = replyKeyboardMode
    let localKeyboardVariantKey = replyKeyboardVariantKey
    const syncReplyKeyboard = () => {
      setReplyKeyboardRows(resolveReplyKeyboardRows({
        metadata,
        mode: localKeyboardMode,
        variantKey: localKeyboardVariantKey,
        variables: localContext,
      }))
    }

    for (let step = 0; currentNodeId && step < MAX_STEPS; step += 1) {
      const node = nodeMap.get(currentNodeId)
      if (!node) return
      const data = (node.data || {}) as Record<string, unknown>

      if (node.type === 'trigger') {
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'message') {
        const text = textOf(interpolateTemplate(data.text || data.__label || 'Сообщение', localContext))
        pushMessage({ role: 'bot', text, buttons: resolveButtons(data, localContext) })
        syncReplyKeyboard()
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'input') {
        pushMessage({
          role: 'bot',
          text: textOf(interpolateTemplate(data.question || 'Введите данные', localContext)),
          buttons: resolveButtons(data, localContext),
        })
        syncReplyKeyboard()
        setWaitingNodeId(node.id)
        return
      }

      if (node.type === 'condition') {
        const result = evaluate(textOf(data.operator || 'equals'), resolvePath(localContext, textOf(data.variable)), data.value)
        currentNodeId = getNextNodeId(config, node.id, result ? 'true' : 'false')
        continue
      }

      if (node.type === 'router') {
        const cases = Array.isArray(data.cases) ? data.cases : []
        const matched = cases.find((item) => item && typeof item === 'object' && evaluate(
          textOf(data.operator || 'equals'),
          resolvePath(localContext, textOf(data.variable)),
          (item as Record<string, unknown>).value
        )) as Record<string, unknown> | undefined
        currentNodeId = getNextNodeId(config, node.id, matched ? `case:${textOf(matched.id)}` : 'default')
        continue
      }

      if (node.type === 'action' && textOf(data.actionType || data.action) === 'setVariable') {
        const key = textOf(data.variableName || data.variable || data.key)
        if (key) {
          const value = data.value ?? ''
          localVariables[key] = value
          setPathValue(localContext, key, value)
        }
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'replyKeyboard') {
        const mode = textOf(data.mode || 'system') || 'system'
        if (mode === 'clear') {
          localKeyboardMode = 'hidden'
          localKeyboardVariantKey = 'base'
        } else if (mode === 'variant') {
          localKeyboardMode = 'variant'
          localKeyboardVariantKey = textOf(data.variantKey || 'base') || 'base'
        } else if (mode === 'condition') {
          const matched = evaluate(
            textOf(data.operator || 'equals'),
            resolvePath(localContext, textOf(data.variable)),
            data.value
          )
          const nextMode = matched ? textOf(data.trueMode || 'variant') : textOf(data.falseMode || 'system')
          const nextVariantKey = matched ? data.trueVariantKey : data.falseVariantKey
          if (nextMode === 'clear') {
            localKeyboardMode = 'hidden'
            localKeyboardVariantKey = 'base'
          } else if (nextMode === 'variant') {
            localKeyboardMode = 'variant'
            localKeyboardVariantKey = textOf(nextVariantKey || 'base') || 'base'
          } else {
            localKeyboardMode = 'system'
            localKeyboardVariantKey = 'base'
          }
        } else {
          localKeyboardMode = 'system'
          localKeyboardVariantKey = 'base'
        }
        setReplyKeyboardMode(localKeyboardMode)
        setReplyKeyboardVariantKey(localKeyboardVariantKey)
        setReplyKeyboardRows(resolveReplyKeyboardRows({
          metadata,
          mode: localKeyboardMode,
          variantKey: localKeyboardVariantKey,
          variables: localContext,
        }))
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      currentNodeId = getNextNodeId(config, node.id)
    }
  }, [config, metadata, nodeMap, pushMessage, replyKeyboardMode, replyKeyboardVariantKey, variables])

  const restart = useCallback(() => {
    setMessages([])
    setVariables({})
    setWaitingNodeId(null)
    setReplyKeyboardMode('system')
    setReplyKeyboardVariantKey('base')
    setReplyKeyboardRows([])
    setIsStarted(true)
    const trigger = findStartNode(config, { text: '/start' })
    pushMessage({ role: 'user', text: '/start' })
    runFrom(trigger?.id || null, {})
  }, [config, pushMessage, runFrom])

  const startPreviewTest = useCallback(() => {
    restart()
  }, [restart])

  useEffect(() => {
    if (!isOpen || startSignal <= 0) return
    const timer = window.setTimeout(() => {
      restart()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isOpen, restart, startSignal])

  const sendUserText = useCallback((text: string, callbackData?: string, options?: { silentUserMessage?: boolean }) => {
    const value = text.trim()
    if (!value) return
    if (!options?.silentUserMessage) {
      pushMessage({ role: 'user', text: value })
    }
    setInput('')

    if (waitingNodeId) {
      const waitingNode = nodeMap.get(waitingNodeId)
      const data = (waitingNode?.data || {}) as Record<string, unknown>
      const variableName = textOf(data.variableName || data.saveToVariable)
      const nextVariables = {
        ...variables,
        'message.text': value,
        ...(variableName ? { [variableName]: value } : {}),
      }
      setVariables(nextVariables)
      setWaitingNodeId(null)
      runFrom(getNextNodeId(config, waitingNodeId), nextVariables)
      return
    }

    const trigger = findStartNode(config, callbackData ? { callbackData } : { text: value })
    if (trigger) {
      const nextVariables = {
        ...variables,
        'message.text': value,
        ...(callbackData ? { 'callback.data': callbackData, callback: { data: callbackData } } : { 'callback.data': '' }),
      }
      setVariables(nextVariables)
      runFrom(trigger.id, nextVariables)
    } else {
      pushMessage({ role: 'system', text: 'В этом сценарии нет подходящего триггера для такого сообщения.' })
    }
  }, [config, nodeMap, pushMessage, runFrom, variables, waitingNodeId])

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#24A1DE]/55 bg-zinc-950 text-[#9DE0FF] shadow-[0_0_0_1px_rgba(36,161,222,0.18),0_18px_45px_rgba(0,0,0,0.55),0_0_34px_rgba(36,161,222,0.22)] transition hover:scale-[1.04] hover:border-[#24A1DE]/85 hover:bg-[#0C1621]"
        title="Live Preview"
      >
        <Smartphone className="h-8 w-8" strokeWidth={2.2} />
      </button>

      {isOpen ? (
        <div className="absolute bottom-16 right-4 z-50 w-[342px] max-w-[calc(100vw-2rem)]">
          <div className="rounded-[42px] border border-zinc-700/80 bg-[#111318] p-2.5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="relative overflow-hidden rounded-[34px] border border-white/8 bg-[#080B10]">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="flex h-[640px] max-h-[72vh] flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-white/8 bg-[#17212B] px-4 pb-3 pt-8">
                  <div>
                    <div className="text-sm font-semibold text-white">Telegram Preview</div>
                    <div className="text-[11px] text-[#7FA7C4]">бот онлайн</div>
                  </div>
                  <div className="flex items-center gap-1">
                      <button onClick={startPreviewTest} className="rounded-full p-2 text-zinc-300 hover:bg-white/10" title="Перезапустить">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-zinc-300 hover:bg-white/10" title="Закрыть">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.12),transparent_32%),#0E1621] px-3 py-4">
                  {!isStarted ? (
                    <div className="flex h-full items-end justify-center pb-4">
                      <button onClick={startPreviewTest} className="rounded-full bg-[#2AABEE] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/50">
                        START
                      </button>
                    </div>
                  ) : messages.map((message) => (
                    <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-5',
                        message.role === 'user'
                          ? 'rounded-br-md bg-[#2B5278] text-white'
                          : message.role === 'system'
                            ? 'bg-black/25 text-zinc-400'
                            : 'rounded-bl-md bg-[#182533] text-zinc-100'
                      )}>
                        <div className="whitespace-pre-wrap">{message.text}</div>
                        {message.buttons?.length ? (
                          <div className="mt-2 space-y-1">
                            {message.buttons.map((row, rowIndex) => (
                              <div key={rowIndex} className="flex flex-wrap gap-1">
                                {row.map((button, index) => (
                                  <button
                                    key={`${button.text}-${index}`}
                                    onClick={() => button.url ? window.open(button.url, '_blank', 'noopener,noreferrer') : sendUserText(button.text, button.callbackData || button.text, { silentUserMessage: true })}
                                    className="rounded-lg border border-[#2AABEE]/35 bg-[#2AABEE]/10 px-2 py-1 text-xs font-medium text-[#7DD3FC]"
                                  >
                                    {button.text}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  className="flex shrink-0 items-center gap-2 border-t border-white/8 bg-[#17212B] px-3 py-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    sendUserText(input)
                  }}
                >
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Сообщение"
                    className="min-w-0 flex-1 rounded-full border border-white/8 bg-[#0E1621] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#2AABEE]/50"
                  />
                  <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2AABEE] text-white">
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                {replyKeyboardRows.length ? (
                  <div className="shrink-0 space-y-1.5 border-t border-white/8 bg-[#111B26] px-3 py-2">
                    {replyKeyboardRows.map((row, rowIndex) => (
                      <div key={`reply-row-${rowIndex}`} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(row.length, 1)}, minmax(0, 1fr))` }}>
                        {row.map((button, buttonIndex) => (
                          <button
                            key={`reply-${rowIndex}-${buttonIndex}-${button.text}`}
                            type="button"
                            onClick={() => sendUserText(button.text)}
                            className="min-h-9 rounded-lg border border-white/8 bg-[#253443] px-2 py-1.5 text-center text-sm font-medium text-zinc-100 shadow-sm transition hover:bg-[#2E4356]"
                          >
                            <span className="line-clamp-2 break-words">{button.text}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
