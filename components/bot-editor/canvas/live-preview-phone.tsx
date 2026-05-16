'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Send, Smartphone, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from '@/components/motion-wrapper'
import { cn } from '@/lib/utils'
import type { BotConfig, BotMetadata } from '@/lib/bot-editor/types/bot.types'
import { moveCrmCardAction, upsertCrmCardAction } from '@/lib/bot-editor/actions/editor-actions'

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
  botId: string
  config: BotConfig
  metadata?: BotMetadata
  isOpen: boolean
  isOnline?: boolean
  startSignal?: number
  onExecutionVisit?: (visit: { nodeId: string; nodeType: string; ts: number }) => void
  onOnlineChange?: (online: boolean) => void
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
    if (typeof resolvedValue === 'object') {
      const textValue = (resolvedValue as Record<string, unknown>).__text
      return typeof textValue === 'string' ? textValue : JSON.stringify(resolvedValue)
    }
    return String(resolvedValue)
  })
}

type PreviewDatabaseEntry = {
  id: string
  text: string
}

function normalizeDatabaseEntryId(value: unknown, fallback: string) {
  return String(value || '')
    .trim()
    .replace(/[.[\]{}]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64)
    .replace(/^_+|_+$/g, '') || fallback
}

function readBotDatabaseEntries(metadata?: BotMetadata): PreviewDatabaseEntry[] {
  const raw =
    metadata?.database && typeof metadata.database === 'object' && !Array.isArray(metadata.database)
      ? (metadata.database as Record<string, unknown>)
      : null
  const rawRows = Array.isArray(raw?.rows) ? raw.rows : []
  const rows = rawRows
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        id: normalizeDatabaseEntryId(record.id, `row_${index + 1}`),
        text: String(record.text || ''),
      }
    })
    .filter((row) => row.id || row.text.trim())

  if (rows.length) {
    return rows
  }

  const legacyText = String(raw?.text || '')
  return legacyText.trim() ? [{ id: 'main', text: legacyText }] : []
}

function serializeBotDatabaseEntries(entries: PreviewDatabaseEntry[]): string {
  return entries.map((entry) => entry.text.trim()).filter(Boolean).join('\n\n')
}

function buildDatabaseVariable(entries: PreviewDatabaseEntry[], result: string, query: string): Record<string, unknown> {
  const allText = serializeBotDatabaseEntries(entries)
  const rowValues = entries.reduce<Record<string, string>>((acc, entry) => {
    acc[entry.id] = entry.text
    return acc
  }, {})

  return {
    ...rowValues,
    __text: allText,
    all: allText,
    ids: entries.map((entry) => entry.id).join(', '),
    result,
    query,
  }
}

function queryBotDatabaseEntries(entries: PreviewDatabaseEntry[], query: string, maxMatches: number): string {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(20, maxMatches || 5))

  if (!entries.length) return ''
  if (!normalizedQuery) return serializeBotDatabaseEntries(entries)

  const matches = entries.filter((entry) => (
    entry.id.toLowerCase().includes(normalizedQuery) ||
    entry.text.toLowerCase().includes(normalizedQuery)
  ))

  return matches.slice(0, limit).map((entry) => entry.text.trim()).filter(Boolean).join('\n\n')
}

function resolveActionConfig(data: Record<string, unknown>): Record<string, unknown> | null {
  const nestedAction = data.action && typeof data.action === 'object' && !Array.isArray(data.action)
    ? data.action as Record<string, unknown>
    : null

  if (nestedAction) {
    return nestedAction
  }

  const actionType = textOf(data.actionType || data.action)
  if (!actionType) return null

  return {
    type: actionType,
    variableName: data.variableName || data.variable || data.key,
    value: data.value,
  }
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

export function LivePreviewPhone({
  botId,
  config,
  metadata,
  isOpen,
  isOnline = false,
  startSignal = 0,
  onExecutionVisit,
  onOnlineChange,
  onOpenChange,
}: LivePreviewPhoneProps) {
  const tShell = useTranslations('editor.shell')
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const [input, setInput] = useState('')
  const [waitingNodeId, setWaitingNodeId] = useState<string | null>(null)
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [isStarted, setIsStarted] = useState(false)
  const [replyKeyboardMode, setReplyKeyboardMode] = useState<'system' | 'hidden' | 'variant'>('system')
  const [replyKeyboardVariantKey, setReplyKeyboardVariantKey] = useState('base')
  const [replyKeyboardRows, setReplyKeyboardRows] = useState<ReplyKeyboardPreviewButton[][]>([])
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)

  const nodeMap = useMemo(() => new Map(config.nodes.map((node) => [node.id, node])), [config.nodes])
  const resetSession = useCallback(() => {
    setMessages([])
    setInput('')
    setWaitingNodeId(null)
    setVariables({})
    setIsStarted(false)
    setReplyKeyboardMode('system')
    setReplyKeyboardVariantKey('base')
    setReplyKeyboardRows([])
  }, [])
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
      user: { firstName: tShell('livePreviewUserFirstName'), username: 'preview_user' },
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
      if (!node) {
        setVariables({ ...localVariables })
        return
      }
      const data = (node.data || {}) as Record<string, unknown>
      onExecutionVisit?.({
        nodeId: node.id,
        nodeType: node.type || 'message',
        ts: Date.now(),
      })

      if (node.type === 'trigger') {
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'message') {
        const text = textOf(interpolateTemplate(data.text || data.__label || tShell('livePreviewDefaultMessage'), localContext))
        pushMessage({ role: 'bot', text, buttons: resolveButtons(data, localContext) })
        syncReplyKeyboard()
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'input') {
        pushMessage({
          role: 'bot',
          text: textOf(interpolateTemplate(data.question || tShell('livePreviewInputQuestion'), localContext)),
          buttons: resolveButtons(data, localContext),
        })
        syncReplyKeyboard()
        setVariables({ ...localVariables })
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

      const action =
        node.type === 'setVariable'
          ? { type: 'setVariable', variableName: data.variableName || data.variable || data.key, value: data.value }
          : node.type === 'action'
            ? resolveActionConfig(data)
            : null
      if (textOf(action?.type) === 'setVariable') {
        const key = textOf(action?.variableName || action?.variable || action?.key)
        if (key) {
          const rawValue = action?.value ?? ''
          const value = typeof rawValue === 'string' ? interpolateTemplate(rawValue, localContext) : rawValue
          localVariables[key] = value
          setPathValue(localContext, key, value)
        }
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'database') {
        const mode = textOf(data.mode || 'search') || 'search'
        const query = interpolateTemplate(data.query || '', localContext)
        const maxMatches = Math.max(1, Math.min(20, Number(data.maxMatches || 5)))
        const databaseEntries = readBotDatabaseEntries(metadata)
        const result =
          mode === 'all'
            ? serializeBotDatabaseEntries(databaseEntries)
            : queryBotDatabaseEntries(databaseEntries, query, maxMatches)
        const fallback = interpolateTemplate(data.fallbackText || '', localContext)
        const value = result || fallback
        const key = textOf(data.saveToVariable || 'database.result') || 'database.result'
        const databaseVariable = buildDatabaseVariable(databaseEntries, value, query)

        localVariables.database = databaseVariable
        localContext.database = databaseVariable
        localVariables[key] = value
        setPathValue(localVariables, key, value)
        setPathValue(localVariables, 'database.result', value)
        setPathValue(localVariables, 'database.query', query)
        setPathValue(localContext, key, value)
        setPathValue(localContext, 'database.result', value)
        setPathValue(localContext, 'database.query', query)
        currentNodeId = getNextNodeId(config, node.id)
        continue
      }

      if (node.type === 'crm') {
        const operation = textOf(data.operation || 'create_or_update') || 'create_or_update'
        if (operation === 'move_stage') {
          const rawCardTarget = interpolateTemplate(data.cardId || '{{crm.cardId}}', localContext).trim()
          const cardId = rawCardTarget.includes('{{')
            ? interpolateTemplate('{{user.id}}', localContext).trim()
            : rawCardTarget
          const stageId = textOf(data.stageId) || textOf(data.stageKey || 'new') || 'new'
          const previousCrm = localVariables.crm && typeof localVariables.crm === 'object'
            ? localVariables.crm as Record<string, unknown>
            : {}
          const previewCard = {
            ...((previousCrm.card && typeof previousCrm.card === 'object') ? previousCrm.card as Record<string, unknown> : {}),
            id: cardId || 'preview-crm-card',
            stageId,
            stageKey: textOf(data.stageKey || stageId) || stageId,
          }
          const moveVariable = {
            card: previewCard,
            cardId: previewCard.id,
            stageId: previewCard.stageId,
            stageKey: previewCard.stageKey,
          }

          if (botId && cardId && stageId) {
            void moveCrmCardAction(cardId, stageId).then((result) => {
              if (!result.success) {
                pushMessage({
                  role: 'system',
                  text: `CRM: ${('error' in result ? result.error : '') || tShell('livePreviewCrmMoveError')}`,
                })
              }
            }).catch((error) => {
              pushMessage({
                role: 'system',
                text: `CRM: ${error instanceof Error ? error.message : String(error)}`,
              })
            })
          }

          const key = textOf(data.saveToVariable || 'crm.move') || 'crm.move'
          localVariables.crm = { ...previousCrm, card: previewCard, cardId: previewCard.id, move: moveVariable }
          localContext.crm = localVariables.crm
          setPathValue(localVariables, 'crm.card', previewCard)
          setPathValue(localVariables, 'crm.cardId', previewCard.id)
          setPathValue(localVariables, 'crm.move', moveVariable)
          setPathValue(localContext, 'crm.card', previewCard)
          setPathValue(localContext, 'crm.cardId', previewCard.id)
          setPathValue(localContext, 'crm.move', moveVariable)
          setPathValue(localVariables, key, moveVariable)
          setPathValue(localContext, key, moveVariable)
          currentNodeId = getNextNodeId(config, node.id)
          continue
        }

        const mappings = Array.isArray(data.fieldMappings) ? data.fieldMappings : []
        const fieldValues = mappings.reduce<Record<string, unknown>>((acc, mapping) => {
          if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return acc
          const record = mapping as Record<string, unknown>
          const fieldKey = textOf(record.fieldKey)
          if (!fieldKey) return acc
          acc[fieldKey] = interpolateTemplate(record.value || '', localContext)
          return acc
        }, {})
        const card = {
          id: 'preview-crm-card',
          title: interpolateTemplate(data.title || tShell('livePreviewDefaultCrmTitle'), localContext),
          externalKey: interpolateTemplate(
            typeof data.externalKey === 'string' ? data.externalKey : '{{user.id}}',
            localContext
          ),
          stageKey: textOf(data.stageKey || 'new') || 'new',
          fieldValues,
          tags: interpolateTemplate(data.tags || '', localContext)
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          notes: interpolateTemplate(data.notes || '', localContext),
        }
        if (botId) {
          void upsertCrmCardAction({
            scope: textOf(data.scope || 'bot') === 'global' ? 'global' : 'bot',
            botId: textOf(data.scope || 'bot') === 'global' ? null : botId,
            pipelineId: textOf(data.pipelineId) || null,
            stageId: textOf(data.stageId) || null,
            stageKey: textOf(data.stageKey || 'new') || 'new',
            title: card.title,
            externalKey: card.externalKey,
            telegramUserId: 10001,
            telegramChatId: 10001,
            fieldValues,
            tags: card.tags,
            notes: card.notes,
          }).then((result) => {
            if (!result.success) {
              pushMessage({
                role: 'system',
                text: `CRM: ${('error' in result ? result.error : '') || tShell('livePreviewCrmSaveError')}`,
              })
            }
          }).catch((error) => {
            pushMessage({
              role: 'system',
              text: `CRM: ${error instanceof Error ? error.message : String(error)}`,
            })
          })
        }
        const crmVariable = { card, cardId: card.id }
        const key = textOf(data.saveToVariable || 'crm.card') || 'crm.card'
        localVariables.crm = crmVariable
        localContext.crm = crmVariable
        setPathValue(localVariables, 'crm.card', card)
        setPathValue(localVariables, 'crm.cardId', card.id)
        setPathValue(localContext, 'crm.card', card)
        setPathValue(localContext, 'crm.cardId', card.id)
        setPathValue(localVariables, key, key === 'crm.card' ? card : crmVariable)
        setPathValue(localContext, key, key === 'crm.card' ? card : crmVariable)
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

    setVariables({ ...localVariables })
  }, [botId, config, metadata, nodeMap, onExecutionVisit, pushMessage, replyKeyboardMode, replyKeyboardVariantKey, tShell, variables])

  useEffect(() => {
    if (isOnline) return
    const timer = window.setTimeout(() => resetSession(), 0)
    return () => window.clearTimeout(timer)
  }, [isOnline, resetSession])

  useEffect(() => {
    const scrollContainer = messagesScrollRef.current
    if (!scrollContainer) return

    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, replyKeyboardRows, isStarted])

  const restart = useCallback(() => {
    setMessages([])
    setVariables({})
    setWaitingNodeId(null)
    setReplyKeyboardMode('system')
    setReplyKeyboardVariantKey('base')
    setReplyKeyboardRows([])
    setIsStarted(true)
    onOnlineChange?.(true)
    const trigger = findStartNode(config, { text: '/start' })
    pushMessage({ role: 'user', text: '/start' })
    runFrom(trigger?.id || null, {})
  }, [config, onOnlineChange, pushMessage, runFrom])

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
    if (!isOnline) {
      pushMessage({ role: 'system', text: tShell('livePreviewTestStopped') })
      setInput('')
      return
    }
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
      pushMessage({ role: 'system', text: tShell('livePreviewNoMatchingTrigger') })
    }
  }, [config, isOnline, nodeMap, pushMessage, runFrom, tShell, variables, waitingNodeId])

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          'pointer-events-auto fixed right-0 top-1/2 inline-flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-[#24A1DE]/45 bg-zinc-950/96 text-[#9DE0FF]',
          'shadow-[0_0_0_1px_rgba(36,161,222,0.14),0_16px_38px_rgba(0,0,0,0.45),0_0_24px_rgba(36,161,222,0.16)] backdrop-blur-xl transition',
          'hover:w-9 hover:border-[#24A1DE]/75 hover:bg-[#0C1621] hover:text-white',
          isOpen ? 'border-[#24A1DE]/80 bg-[#0C1621] text-white' : ''
        )}
        title={tShell('testLaunchLivePreview')}
      >
        <Smartphone className="h-4 w-4" strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {isOpen ? (
        <motion.div
          key="live-preview-phone"
          initial={{ opacity: 0, y: 720, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 720, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.9 }}
          className="pointer-events-auto fixed bottom-6 right-12 z-50 w-[342px] max-w-[calc(100vw-5rem)]"
        >
          <div className="rounded-[42px] border border-zinc-700/80 bg-[#111318] p-2.5 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
            <div className="relative overflow-hidden rounded-[34px] border border-white/8 bg-[#080B10]">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="flex h-[640px] max-h-[72vh] flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-white/8 bg-[#17212B] px-4 pb-3 pt-8">
                  <div>
                    <div className="text-sm font-semibold text-white">{tShell('livePreviewTitle')}</div>
                    <div className={cn('text-[11px]', isOnline ? 'text-[#7FA7C4]' : 'text-zinc-500')}>
                      {tShell(isOnline ? 'livePreviewBotOnline' : 'livePreviewBotOffline')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                      <button
                        onClick={startPreviewTest}
                        className="rounded-full p-2 text-zinc-300 hover:bg-white/10"
                        title={tShell(isOnline ? 'livePreviewRestart' : 'livePreviewStartTitle')}
                      >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button onClick={() => onOpenChange(false)} className="rounded-full p-2 text-zinc-300 hover:bg-white/10" title={tShell('livePreviewClose')}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={messagesScrollRef}
                  className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.12),transparent_32%),#0E1621] px-3 py-4"
                >
                  {!isStarted ? (
                    <div className="flex h-full items-end justify-center pb-4">
                      <button
                        onClick={startPreviewTest}
                        className="rounded-full bg-[#2AABEE] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-950/50 transition hover:bg-[#1f9edc]"
                      >
                        {tShell('livePreviewStartButton')}
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
                    placeholder={tShell('livePreviewMessagePlaceholder')}
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
        </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
