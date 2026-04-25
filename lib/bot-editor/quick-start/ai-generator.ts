import {
  DEFAULT_NODE_DATA,
  type ComparisonOperator,
  type HttpMethod,
  type KeyboardData,
  type KeyboardRow,
  type ParseMode,
  type TriggerType,
} from '@/lib/bot-editor/types/component-schemas'
import type {
  AllowedQuickStartAiNodeType,
  BotConfig,
  BotVariable,
  Edge,
  Node,
  QuickStartAiAnswers,
  QuickStartAiGraphDraft,
  QuickStartAiGraphSummaryDraft,
} from '@/lib/bot-editor/types/bot.types'
import { QUICK_START_AI_GENERATOR_VERSION, sanitizeQuickStartAiAnswers } from '@/lib/bot-editor/quick-start/utils'
import { requestOpenRouterJson } from '@/lib/bot-editor/quick-start/openrouter'

type GeneratorLocale = 'ru' | 'en'

type GenerateQuickStartAiDraftInput = {
  answers: QuickStartAiAnswers
  locale?: string
}

type RepairQuickStartAiDraftInput = {
  answers: QuickStartAiAnswers
  locale?: string
  previousDraft: QuickStartAiGraphDraft
  errors: string[]
}

type AiDraftResponse = {
  draft: QuickStartAiGraphDraft
  model: string
}

type NormalizeDraftResult = {
  config: BotConfig
  errors: string[]
  summary?: QuickStartAiGraphSummaryDraft
}

const QUICK_START_AI_ALLOWED_NODE_TYPES: AllowedQuickStartAiNodeType[] = [
  'trigger',
  'message',
  'input',
  'condition',
  'router',
  'action',
  'replyKeyboard',
  'wait',
  'scheduler',
  'http',
  'comment',
]

const QUICK_START_AI_ALLOWED_NODE_TYPE_SET = new Set<AllowedQuickStartAiNodeType>(
  QUICK_START_AI_ALLOWED_NODE_TYPES
)
const QUICK_START_AI_ALLOWED_VARIABLE_TYPES = new Set(['string', 'number', 'boolean', 'object', 'array'])
const QUICK_START_AI_ALLOWED_TRIGGER_TYPES = new Set(['command', 'text', 'callbackQuery', 'photo', 'any', 'schedule'])
const QUICK_START_AI_ALLOWED_OPERATORS = new Set<ComparisonOperator>([
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
const QUICK_START_AI_ALLOWED_WAIT_TYPES = new Set(['message', 'text', 'callbackQuery', 'any'])
const QUICK_START_AI_ALLOWED_HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
])
const QUICK_START_AI_ALLOWED_REPLY_KEYBOARD_MODES = new Set(['system', 'clear'])
const QUICK_START_AI_ALLOWED_ACTION_TYPES = new Set(['setVariable'])
const QUICK_START_AI_ALLOWED_PARSE_MODES = new Set<ParseMode>(['None', 'Markdown', 'MarkdownV2', 'HTML'])
const QUICK_START_AI_ALLOWED_TRIGGER_SCHEDULE_MODES = new Set(['hourly', 'daily'] as const)
const QUICK_START_AI_ALLOWED_DELAY_UNITS = new Set(['seconds', 'minutes', 'hours', 'days'] as const)
const QUICK_START_AI_ALLOWED_HTTP_BODY_TYPES = new Set(['json', 'form', 'raw', 'none'] as const)
const QUICK_START_AI_LAYOUT_X_GAP = 320
const QUICK_START_AI_LAYOUT_Y_GAP = 180
const QUICK_START_AI_LAYOUT_X_START = 80
const QUICK_START_AI_LAYOUT_Y_START = 80

const QUICK_START_AI_GRAPH_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['nodes', 'edges'],
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        highlights: {
          type: 'array',
          maxItems: 6,
          items: { type: 'string' },
        },
      },
    },
    nodes: {
      type: 'array',
      minItems: 1,
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'data'],
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: QUICK_START_AI_ALLOWED_NODE_TYPES,
          },
          data: { type: 'object' },
        },
      },
    },
    edges: {
      type: 'array',
      maxItems: 80,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'target'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          sourceHandle: {
            anyOf: [
              { type: 'string' },
              { type: 'null' },
            ],
          },
          label: { type: 'string' },
        },
      },
    },
    variables: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'type', 'default_value'],
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'object', 'array'],
          },
          default_value: {
            anyOf: [
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'object' },
              { type: 'array' },
              { type: 'null' },
            ],
          },
          description: { type: 'string' },
          scope: {
            type: 'string',
            enum: ['global', 'user', 'chat', 'temporary'],
          },
        },
      },
    },
  },
}

function toLocale(locale?: string): GeneratorLocale {
  return locale === 'en' ? 'en' : 'ru'
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeScalarOrJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeScalarOrJson(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [key, sanitizeScalarOrJson(nestedValue)])
    )
  }

  return null
}

function pickText(locale: GeneratorLocale, ru: string, en: string): string {
  return locale === 'en' ? en : ru
}

function slugifyId(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё:_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || fallback
}

function ensureUniqueId(baseId: string, usedIds: Set<string>): string {
  let nextId = baseId
  let suffix = 2
  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`
    suffix += 1
  }
  usedIds.add(nextId)
  return nextId
}

function cloneDefaultNodeData(type: AllowedQuickStartAiNodeType): Record<string, unknown> {
  return JSON.parse(JSON.stringify((DEFAULT_NODE_DATA[type] || {}) as Record<string, unknown>))
}

function sanitizeSummary(value: unknown): QuickStartAiGraphSummaryDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const title = normalizeText(record.title)
  const description = normalizeText(record.description)
  const highlights = Array.isArray(record.highlights)
    ? record.highlights
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .slice(0, 6)
    : []

  if (!title && !description && highlights.length === 0) {
    return undefined
  }

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(highlights.length > 0 ? { highlights } : {}),
  }
}

function sanitizeKeyboard(data: Record<string, unknown>, nodeId: string, errors: string[]): KeyboardData | undefined {
  const keyboard = data.keyboard
  if (!keyboard || typeof keyboard !== 'object' || Array.isArray(keyboard)) {
    return undefined
  }

  const keyboardRecord = keyboard as Record<string, unknown>
  const rows = Array.isArray(keyboardRecord.rows) ? keyboardRecord.rows : []
  const sanitizedRows: KeyboardRow[] = rows
    .map((row, rowIndex) => {
      const rowRecord = row && typeof row === 'object' && !Array.isArray(row)
        ? (row as Record<string, unknown>)
        : {}
      const buttons = Array.isArray(rowRecord.buttons) ? rowRecord.buttons : []
      const sanitizedButtons = buttons
        .map((button, buttonIndex) => {
          const buttonRecord = button && typeof button === 'object' && !Array.isArray(button)
            ? (button as Record<string, unknown>)
            : {}
          const text = normalizeText(buttonRecord.text)
          if (!text) {
            errors.push(`Node "${nodeId}" has a keyboard button without text`)
            return null
          }

          const callbackData = normalizeText(buttonRecord.callbackData || buttonRecord.callback_data)
          const url = normalizeText(buttonRecord.url)
          const actionType = normalizeText(buttonRecord.actionType) || (callbackData ? 'callback' : (url ? 'url' : 'callback'))

          return {
            id: slugifyId(normalizeText(buttonRecord.id) || `${nodeId}-btn-${rowIndex + 1}-${buttonIndex + 1}`, `${nodeId}-btn-${rowIndex + 1}-${buttonIndex + 1}`),
            text,
            ...(actionType ? { actionType } : {}),
            ...(callbackData ? { callbackData: callbackData.slice(0, 64) } : {}),
            ...(url ? { url } : {}),
          }
        })
        .filter((button): button is NonNullable<typeof button> => Boolean(button))

      return sanitizedButtons.length > 0 ? { buttons: sanitizedButtons } : null
    })
    .filter((row): row is KeyboardRow => Boolean(row))

  if (rows.length > 0 && sanitizedRows.length === 0) {
    errors.push(`Node "${nodeId}" has an invalid keyboard definition`)
    return undefined
  }

  return sanitizedRows.length > 0
    ? {
        rows: sanitizedRows,
      }
    : undefined
}

function sanitizeMessageAttachments(data: Record<string, unknown>, nodeId: string, errors: string[]) {
  const attachments = Array.isArray(data.attachments) ? data.attachments : []
  return attachments
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const type = normalizeText(record.type)
      const source = normalizeText(record.source)

      if (!type || !source) {
        errors.push(`Node "${nodeId}" has an attachment without type or source`)
        return null
      }

      if (!['photo', 'video', 'document', 'audio'].includes(type)) {
        errors.push(`Node "${nodeId}" has unsupported attachment type "${type}"`)
        return null
      }

      return {
        type,
        source,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function sanitizeVariables(variables: unknown): BotVariable[] {
  if (!Array.isArray(variables)) {
    return []
  }

  return variables.reduce<BotVariable[]>((acc, item, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const name = normalizeText(record.name)
      const type = normalizeText(record.type)
      if (!name || !QUICK_START_AI_ALLOWED_VARIABLE_TYPES.has(type)) {
        return acc
      }

      acc.push({
        id: normalizeText(record.id) || `var_${slugifyId(name, `variable-${index + 1}`)}`,
        name,
        type: type as BotVariable['type'],
        default_value: sanitizeScalarOrJson(record.default_value),
        description: normalizeText(record.description) || undefined,
        scope: ['global', 'user', 'chat', 'temporary'].includes(normalizeText(record.scope))
          ? (normalizeText(record.scope) as BotVariable['scope'])
          : undefined,
      })

      return acc
    }, [])
}

function sanitizeStringOrNumber(value: unknown, fallback = ''): string | number {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'boolean') {
    return String(value)
  }

  return fallback
}

function validateSourceHandle(
  sourceNode: Node,
  sourceHandle: string | null | undefined,
  errors: string[],
  targetId: string
) {
  const normalizedHandle = normalizeText(sourceHandle)

  if (sourceNode.type === 'condition') {
    if (normalizedHandle && normalizedHandle !== 'false') {
      errors.push(`Condition node "${sourceNode.id}" has unsupported sourceHandle "${normalizedHandle}" for target "${targetId}"`)
    }
    return
  }

  if (sourceNode.type === 'router') {
    if (!normalizedHandle) {
      return
    }

    const cases = Array.isArray((sourceNode.data as Record<string, unknown>).cases)
      ? ((sourceNode.data as Record<string, unknown>).cases as Array<Record<string, unknown>>)
      : []
    const allowedHandles = new Set(
      cases
        .map((item) => normalizeText(item.id))
        .filter(Boolean)
        .map((caseId) => `case:${caseId}`)
    )
    if (!allowedHandles.has(normalizedHandle)) {
      errors.push(`Router node "${sourceNode.id}" has unsupported sourceHandle "${normalizedHandle}" for target "${targetId}"`)
    }
    return
  }

  if (normalizedHandle) {
    errors.push(`Node "${sourceNode.id}" of type "${sourceNode.type}" cannot use sourceHandle "${normalizedHandle}"`)
  }
}

function normalizeNode(
  node: unknown,
  index: number,
  usedIds: Set<string>,
  nodeIdAliases: Map<string, string>,
  locale: GeneratorLocale,
  errors: string[]
): Node | null {
  const record = node && typeof node === 'object' && !Array.isArray(node)
    ? (node as Record<string, unknown>)
    : {}
  const rawId = normalizeText(record.id)
  const type = normalizeText(record.type) as AllowedQuickStartAiNodeType

  if (!QUICK_START_AI_ALLOWED_NODE_TYPE_SET.has(type)) {
    errors.push(`Node "${rawId || `#${index + 1}`}" has unsupported type "${type || 'unknown'}"`)
    return null
  }

  const nodeId = ensureUniqueId(
    slugifyId(rawId || `${type}-${index + 1}`, `${type}-${index + 1}`),
    usedIds
  )
  if (rawId) {
    nodeIdAliases.set(rawId, nodeId)
  }
  nodeIdAliases.set(nodeId, nodeId)

  const rawData = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? (record.data as Record<string, unknown>)
    : {}
  const label = normalizeText(rawData.__label)
  const description = normalizeText(rawData.__description)
  const baseData = cloneDefaultNodeData(type)

  const commonMeta = {
    ...(label ? { __label: label } : {}),
    ...(description ? { __description: description } : {}),
  }

  if (type === 'trigger') {
    const triggerType = normalizeText(rawData.trigger || baseData.trigger)
    const normalizedTriggerType: TriggerType = QUICK_START_AI_ALLOWED_TRIGGER_TYPES.has(triggerType)
      ? (triggerType as TriggerType)
      : 'command'
    const scheduleModeRaw = normalizeText(rawData.scheduleMode || baseData.scheduleMode)
    const scheduleMode: 'hourly' | 'daily' | undefined = QUICK_START_AI_ALLOWED_TRIGGER_SCHEDULE_MODES.has(
      scheduleModeRaw as 'hourly' | 'daily'
    )
      ? (scheduleModeRaw as 'hourly' | 'daily')
      : undefined
    if (!QUICK_START_AI_ALLOWED_TRIGGER_TYPES.has(triggerType)) {
      errors.push(`Trigger node "${nodeId}" has unsupported trigger type "${triggerType || 'unknown'}"`)
    }

    const pattern = normalizeText(rawData.pattern || baseData.pattern)
    if (normalizedTriggerType === 'command' && !pattern) {
      errors.push(`Trigger node "${nodeId}" with command trigger must define a pattern`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        trigger: normalizedTriggerType,
        pattern,
        scheduleMode,
        everyHours: Number(rawData.everyHours || baseData.everyHours || 1),
        atMinute: Number(rawData.atMinute || baseData.atMinute || 0),
        atTime: normalizeText(rawData.atTime || baseData.atTime),
        timeZone: normalizeText(rawData.timeZone || baseData.timeZone),
        targetChatId: normalizeText(rawData.targetChatId),
        targetUserId: normalizeText(rawData.targetUserId),
        ...commonMeta,
      },
    }
  }

  if (type === 'message') {
    const text = typeof rawData.text === 'string' ? rawData.text.trim() : ''
    const keyboard = sanitizeKeyboard(rawData, nodeId, errors)
    const attachments = sanitizeMessageAttachments(rawData, nodeId, errors)
    const parseModeRaw = normalizeText(rawData.parseMode || baseData.parseMode)
    const parseMode: ParseMode | undefined = QUICK_START_AI_ALLOWED_PARSE_MODES.has(parseModeRaw as ParseMode)
      ? (parseModeRaw as ParseMode)
      : undefined
    if (!text && attachments.length === 0) {
      errors.push(`Message node "${nodeId}" must contain text or attachments`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        text,
        parseMode,
        ...(keyboard ? { keyboard } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
        ...commonMeta,
      },
    }
  }

  if (type === 'input') {
    const question = typeof rawData.question === 'string' ? rawData.question.trim() : ''
    const variableName = normalizeText(rawData.variableName)
    if (!question) {
      errors.push(`Input node "${nodeId}" must contain a question`)
    }
    if (!variableName) {
      errors.push(`Input node "${nodeId}" must define variableName`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        question,
        variableName,
        inputPlaceholder: normalizeText(rawData.inputPlaceholder || baseData.inputPlaceholder),
        forceReply: rawData.forceReply === false ? false : true,
        skipButton: Boolean(rawData.skipButton),
        ...(rawData.skipValue !== undefined ? { skipValue: sanitizeScalarOrJson(rawData.skipValue) } : {}),
        ...commonMeta,
      },
    }
  }

  if (type === 'condition') {
    const variable = normalizeText(rawData.variable)
    const operator = normalizeText(rawData.operator || baseData.operator) as ComparisonOperator
    const conditionValue = sanitizeStringOrNumber(rawData.value ?? baseData.value, '')
    if (!variable) {
      errors.push(`Condition node "${nodeId}" must define variable`)
    }
    if (!QUICK_START_AI_ALLOWED_OPERATORS.has(operator)) {
      errors.push(`Condition node "${nodeId}" has unsupported operator "${operator || 'unknown'}"`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        variable,
        operator: QUICK_START_AI_ALLOWED_OPERATORS.has(operator) ? operator : 'equals',
        value: conditionValue,
        trueLabel: normalizeText(rawData.trueLabel || baseData.trueLabel) || pickText(locale, 'Да', 'Yes'),
        falseLabel: normalizeText(rawData.falseLabel || baseData.falseLabel) || pickText(locale, 'Нет', 'No'),
        ...commonMeta,
      },
    }
  }

  if (type === 'router') {
    const variable = normalizeText(rawData.variable)
    const operator = normalizeText(rawData.operator || baseData.operator) as ComparisonOperator
    const rawCases = Array.isArray(rawData.cases) ? rawData.cases : []
    const caseUsedIds = new Set<string>()
    const cases = rawCases
      .map((item, caseIndex) => {
        const caseRecord = item && typeof item === 'object' && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {}
        const caseId = ensureUniqueId(
          slugifyId(
            normalizeText(caseRecord.id) || `case-${caseIndex + 1}`,
            `case-${caseIndex + 1}`
          ),
          caseUsedIds
        )
        return {
          id: caseId,
          label: normalizeText(caseRecord.label) || `${pickText(locale, 'Вариант', 'Case')} ${caseIndex + 1}`,
          value: sanitizeScalarOrJson(caseRecord.value),
        }
      })
      .slice(0, 8)

    if (!variable) {
      errors.push(`Router node "${nodeId}" must define variable`)
    }
    if (cases.length === 0) {
      errors.push(`Router node "${nodeId}" must contain at least one case`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        variable,
        operator: QUICK_START_AI_ALLOWED_OPERATORS.has(operator) ? operator : 'equals',
        cases,
        defaultLabel: normalizeText(rawData.defaultLabel || baseData.defaultLabel) || pickText(locale, 'Иначе', 'Default'),
        ...commonMeta,
      },
    }
  }

  if (type === 'action') {
    const actionRecord = rawData.action && typeof rawData.action === 'object' && !Array.isArray(rawData.action)
      ? (rawData.action as Record<string, unknown>)
      : {}
    const actionType = normalizeText(actionRecord.type)
    const variableName = normalizeText(actionRecord.variableName)

    if (!QUICK_START_AI_ALLOWED_ACTION_TYPES.has(actionType)) {
      errors.push(`Action node "${nodeId}" has unsupported action type "${actionType || 'unknown'}"`)
    }
    if (actionType === 'setVariable' && !variableName) {
      errors.push(`Action node "${nodeId}" with setVariable must define variableName`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        action: {
          type: 'setVariable',
          variableName,
          value: sanitizeScalarOrJson(actionRecord.value),
        },
        ...commonMeta,
      },
    }
  }

  if (type === 'replyKeyboard') {
    const mode = normalizeText(rawData.mode || baseData.mode)
    const normalizedMode: 'system' | 'clear' = QUICK_START_AI_ALLOWED_REPLY_KEYBOARD_MODES.has(mode)
      ? (mode as 'system' | 'clear')
      : 'system'
    if (!QUICK_START_AI_ALLOWED_REPLY_KEYBOARD_MODES.has(mode)) {
      errors.push(`Reply keyboard node "${nodeId}" supports only "system" or "clear" mode in Quick Start`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        mode: normalizedMode,
        ...commonMeta,
      },
    }
  }

  if (type === 'wait') {
    const waitFor = normalizeText(rawData.waitFor || baseData.waitFor)
    if (!QUICK_START_AI_ALLOWED_WAIT_TYPES.has(waitFor)) {
      errors.push(`Wait node "${nodeId}" has unsupported waitFor "${waitFor || 'unknown'}"`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        waitFor: QUICK_START_AI_ALLOWED_WAIT_TYPES.has(waitFor) ? waitFor : 'message',
        timeout: Number(rawData.timeout || baseData.timeout || 300000),
        saveToVariable: normalizeText(rawData.saveToVariable),
        ...commonMeta,
      },
    }
  }

  if (type === 'scheduler') {
    const mode = normalizeText(rawData.mode || baseData.mode)
    const delayUnitRaw = normalizeText(rawData.delayUnit || baseData.delayUnit)
    const delayUnit: 'seconds' | 'minutes' | 'hours' | 'days' | undefined = QUICK_START_AI_ALLOWED_DELAY_UNITS.has(
      delayUnitRaw as 'seconds' | 'minutes' | 'hours' | 'days'
    )
      ? (delayUnitRaw as 'seconds' | 'minutes' | 'hours' | 'days')
      : undefined
    if (!['delay', 'dateTime'].includes(mode)) {
      errors.push(`Scheduler node "${nodeId}" has unsupported mode "${mode || 'unknown'}"`)
    }
    if ((mode || 'delay') === 'dateTime' && !normalizeText(rawData.dateTime)) {
      errors.push(`Scheduler node "${nodeId}" in dateTime mode must define dateTime`)
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        mode: mode === 'dateTime' ? 'dateTime' : 'delay',
        delayValue: Number(rawData.delayValue || baseData.delayValue || 5),
        delayUnit,
        dateTime: normalizeText(rawData.dateTime),
        timeZone: normalizeText(rawData.timeZone || baseData.timeZone || 'UTC'),
        saveToVariable: normalizeText(rawData.saveToVariable),
        ...commonMeta,
      },
    }
  }

  if (type === 'http') {
    const method = normalizeText(rawData.method || baseData.method).toUpperCase() as HttpMethod
    const url = normalizeText(rawData.url)
    const bodyTypeRaw = normalizeText(rawData.bodyType || baseData.bodyType)
    const bodyType: 'json' | 'form' | 'raw' | 'none' | undefined = QUICK_START_AI_ALLOWED_HTTP_BODY_TYPES.has(
      bodyTypeRaw as 'json' | 'form' | 'raw' | 'none'
    )
      ? (bodyTypeRaw as 'json' | 'form' | 'raw' | 'none')
      : undefined
    if (!url) {
      errors.push(`HTTP node "${nodeId}" must define url`)
    }
    if (!QUICK_START_AI_ALLOWED_HTTP_METHODS.has(method)) {
      errors.push(`HTTP node "${nodeId}" has unsupported method "${method || 'unknown'}"`)
    }

    const sanitizeKeyValuePairs = (value: unknown) => {
      if (!Array.isArray(value)) return []
      return value
        .map((item) => {
          const record = item && typeof item === 'object' && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : {}
          const key = normalizeText(record.key)
          const pairValue = normalizeText(record.value)
          return key ? { key, value: pairValue } : null
        })
        .filter((item): item is { key: string; value: string } => Boolean(item))
    }

    return {
      id: nodeId,
      type,
      position: { x: 0, y: 0 },
      data: {
        type,
        ...baseData,
        url,
        method: QUICK_START_AI_ALLOWED_HTTP_METHODS.has(method) ? method : 'GET',
        headers: sanitizeKeyValuePairs(rawData.headers),
        queryParams: sanitizeKeyValuePairs(rawData.queryParams),
        body: sanitizeScalarOrJson(rawData.body),
        bodyType,
        saveToVariable: normalizeText(rawData.saveToVariable),
        timeout: Number(rawData.timeout || baseData.timeout || 30000),
        ...commonMeta,
      },
    }
  }

  return {
    id: nodeId,
    type,
    position: { x: 0, y: 0 },
    data: {
      type,
      ...baseData,
      text: typeof rawData.text === 'string' ? rawData.text.trim() : '',
      color: normalizeText(rawData.color),
      ...commonMeta,
    },
  }
}

function applyDeterministicLayout(nodes: Node[], edges: Edge[]): Node[] {
  const incomingCount = new Map<string, number>()
  const outgoingMap = new Map<string, string[]>()
  const orderIndex = new Map<string, number>()

  for (const [index, node] of nodes.entries()) {
    orderIndex.set(node.id, index)
    incomingCount.set(node.id, 0)
    outgoingMap.set(node.id, [])
  }

  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1)
    const outgoing = outgoingMap.get(edge.source)
    if (outgoing) {
      outgoing.push(edge.target)
    }
  }

  const triggerIds = nodes
    .filter((node) => node.type === 'trigger')
    .map((node) => node.id)

  const depthMap = new Map<string, number>()
  const queue = [...triggerIds]
  for (const triggerId of triggerIds) {
    depthMap.set(triggerId, 0)
  }

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (!currentId) continue
    const currentDepth = depthMap.get(currentId) || 0
    const outgoing = outgoingMap.get(currentId) || []
    for (const nextId of outgoing) {
      const nextDepth = currentDepth + 1
      if (!depthMap.has(nextId) || nextDepth < (depthMap.get(nextId) || 0)) {
        depthMap.set(nextId, nextDepth)
        queue.push(nextId)
      }
    }
  }

  const maxDepth = Math.max(0, ...depthMap.values(), 0)
  const grouped = new Map<number, Node[]>()
  for (const node of nodes) {
    const depth = depthMap.get(node.id) ?? (node.type === 'comment' ? maxDepth + 1 : maxDepth + 1)
    const current = grouped.get(depth) || []
    current.push(node)
    grouped.set(depth, current)
  }

  const positionedNodes: Node[] = []
  for (const [depth, depthNodes] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    const sortedNodes = depthNodes.sort(
      (left, right) => (orderIndex.get(left.id) || 0) - (orderIndex.get(right.id) || 0)
    )
    sortedNodes.forEach((node, rowIndex) => {
      positionedNodes.push({
        ...node,
        position: {
          x: QUICK_START_AI_LAYOUT_X_START + depth * QUICK_START_AI_LAYOUT_X_GAP,
          y: QUICK_START_AI_LAYOUT_Y_START + rowIndex * QUICK_START_AI_LAYOUT_Y_GAP,
        },
      })
    })
  }

  return positionedNodes
}

function buildMessages(
  answers: QuickStartAiAnswers,
  locale: GeneratorLocale,
  repairContext?: { previousDraft: QuickStartAiGraphDraft; errors: string[] }
) {
  const localizedSystemPrompt = locale === 'en'
    ? [
        'You are generating a Telegram bot workflow draft for a visual bot builder.',
        'Return JSON only. Do not include markdown, explanations, or code fences.',
        'Allowed node types: trigger, message, input, condition, router, action, replyKeyboard, wait, scheduler, http, comment.',
        'Forbidden node types: script, webhook, payment nodes, AI-only nodes.',
        'Every node.data must include a "type" field matching node.type.',
        'At least one trigger node is mandatory.',
        'The graph must be connected and acyclic, except disconnected comment nodes are allowed.',
        'Use business-friendly flow structure with a clear entry point and user-facing messages.',
        'Only safe action nodes are allowed, and only with action.type = "setVariable".',
        'For condition nodes, use default output for true and sourceHandle "false" for false.',
        'For router nodes, each case must have a unique case.id and router branch handles use "case:<caseId>". Default router branch must omit sourceHandle.',
        'Do not use targetHandle.',
        'Prefer inline buttons in message.keyboard rows when branching from user choices.',
        'If you use replyKeyboard nodes in Quick Start, only use mode "system" or "clear".',
        'All user-facing text must be localized to English.',
      ].join('\n')
    : [
        'Ты генерируешь draft Telegram-бота для визуального редактора.',
        'Верни только JSON. Без markdown, пояснений и code fences.',
        'Разрешённые типы нод: trigger, message, input, condition, router, action, replyKeyboard, wait, scheduler, http, comment.',
        'Запрещённые типы нод: script, webhook, payment-ноды, AI-ноды.',
        'В каждом node.data обязательно должно быть поле "type", совпадающее с node.type.',
        'Минимум одна trigger-нода обязательна.',
        'Граф должен быть связным и без циклов, кроме disconnected comment-нод.',
        'Строй понятный бизнесовый сценарий с явной точкой входа и человеческими сообщениями.',
        'Action-ноды разрешены только безопасные, только action.type = "setVariable".',
        'У condition true-ветка идёт через default output, false-ветка через sourceHandle "false".',
        'У router каждый кейс обязан иметь уникальный case.id, а ветки используют sourceHandle "case:<caseId>". Default-ветка router должна быть без sourceHandle.',
        'Не используй targetHandle.',
        'Для выбора пользователя предпочитай inline-кнопки в message.keyboard rows.',
        'Если используешь replyKeyboard в Quick Start, разрешены только mode "system" или "clear".',
        'Весь пользовательский текст должен быть на русском языке.',
      ].join('\n')

  const localizedUserPrompt = repairContext
    ? JSON.stringify({
        task: locale === 'en'
          ? 'Fix the previous workflow draft so it becomes valid for the bot builder.'
          : 'Исправь предыдущий draft workflow так, чтобы он стал валидным для редактора ботов.',
        brief: answers,
        previousDraft: repairContext.previousDraft,
        validationErrors: repairContext.errors,
        requirements: locale === 'en'
          ? [
              'Keep the business intent and user flow.',
              'Fix only invalid structure, unsupported nodes, unsupported handles, or missing required fields.',
              'Return the full corrected JSON draft.',
            ]
          : [
              'Сохрани бизнес-смысл и пользовательский сценарий.',
              'Исправь только невалидную структуру, unsupported-ноды, unsupported-handle и обязательные поля.',
              'Верни полный исправленный JSON draft.',
            ],
      }, null, 2)
    : JSON.stringify({
        task: locale === 'en'
          ? 'Create a visual workflow draft for a business Telegram bot.'
          : 'Создай draft визуального workflow для бизнес Telegram-бота.',
        brief: answers,
        requirements: locale === 'en'
          ? [
              'Design a practical business-ready flow.',
              'Use only allowed node types.',
              'Include at least one trigger.',
              'Make branching and buttons consistent.',
              'Return a complete JSON draft.',
            ]
          : [
              'Сделай практичный рабочий бизнес-сценарий.',
              'Используй только разрешённые типы нод.',
              'Обязательно добавь хотя бы один trigger.',
              'Сделай согласованные ветки и кнопки.',
              'Верни полный JSON draft.',
            ],
      }, null, 2)

  return [
    { role: 'system' as const, content: localizedSystemPrompt },
    { role: 'user' as const, content: localizedUserPrompt },
  ]
}

function ensureDraftShape(value: unknown): QuickStartAiGraphDraft {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  return {
    nodes: Array.isArray(record.nodes) ? (record.nodes as QuickStartAiGraphDraft['nodes']) : [],
    edges: Array.isArray(record.edges) ? (record.edges as QuickStartAiGraphDraft['edges']) : [],
    variables: Array.isArray(record.variables) ? (record.variables as QuickStartAiGraphDraft['variables']) : [],
    summary: sanitizeSummary(record.summary),
  }
}

export async function generateQuickStartAiGraphDraft(input: GenerateQuickStartAiDraftInput): Promise<AiDraftResponse> {
  const locale = toLocale(input.locale)
  const sanitizedAnswers = sanitizeQuickStartAiAnswers(input.answers)
  const response = await requestOpenRouterJson<QuickStartAiGraphDraft>({
    messages: buildMessages(sanitizedAnswers, locale),
    schema: QUICK_START_AI_GRAPH_SCHEMA,
    temperature: 0.2,
    maxTokens: 5000,
  })

  return {
    draft: ensureDraftShape(response.parsed),
    model: response.model,
  }
}

export async function repairQuickStartAiGraphDraft(input: RepairQuickStartAiDraftInput): Promise<AiDraftResponse> {
  const locale = toLocale(input.locale)
  const sanitizedAnswers = sanitizeQuickStartAiAnswers(input.answers)
  const response = await requestOpenRouterJson<QuickStartAiGraphDraft>({
    messages: buildMessages(sanitizedAnswers, locale, {
      previousDraft: input.previousDraft,
      errors: input.errors,
    }),
    schema: QUICK_START_AI_GRAPH_SCHEMA,
    temperature: 0.1,
    maxTokens: 5000,
  })

  return {
    draft: ensureDraftShape(response.parsed),
    model: response.model,
  }
}

export function normalizeQuickStartAiGraphDraft(
  draft: QuickStartAiGraphDraft,
  localeInput?: string
): NormalizeDraftResult {
  const errors: string[] = []
  const usedNodeIds = new Set<string>()
  const nodeIdAliases = new Map<string, string>()
  const locale = toLocale(localeInput)
  const normalizedNodes = draft.nodes
    .map((node, index) => normalizeNode(node, index, usedNodeIds, nodeIdAliases, locale, errors))
    .filter((node): node is Node => Boolean(node))

  const nodeMap = new Map(normalizedNodes.map((node) => [node.id, node]))
  const normalizedEdges: Edge[] = []
  const seenEdges = new Set<string>()

  for (const edge of draft.edges || []) {
    const sourceRaw = normalizeText(edge?.source)
    const targetRaw = normalizeText(edge?.target)
    const sourceId = nodeIdAliases.get(sourceRaw)
    const targetId = nodeIdAliases.get(targetRaw)

    if (!sourceId || !targetId) {
      errors.push(`Edge "${sourceRaw}" -> "${targetRaw}" references a missing node`)
      continue
    }

    if (sourceId === targetId) {
      errors.push(`Edge "${sourceId}" cannot target itself`)
      continue
    }

    const sourceNode = nodeMap.get(sourceId)
    if (!sourceNode) {
      errors.push(`Edge source node "${sourceId}" was not normalized`)
      continue
    }

    const sourceHandle = edge.sourceHandle == null ? null : normalizeText(edge.sourceHandle)
    validateSourceHandle(sourceNode, sourceHandle, errors, targetId)
    const normalizedId = `edge:${sourceId}:${sourceHandle || 'default'}:${targetId}`
    if (seenEdges.has(normalizedId)) {
      continue
    }

    seenEdges.add(normalizedId)
    normalizedEdges.push({
      id: normalizedId,
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle || null,
      targetHandle: null,
      label: normalizeText(edge.label) || undefined,
    })
  }

  const nonCommentNodes = normalizedNodes.filter((node) => node.type !== 'comment')
  if (nonCommentNodes.length === 0) {
    errors.push('Workflow must contain at least one executable node')
  }

  const triggerNodes = normalizedNodes.filter((node) => node.type === 'trigger')
  if (triggerNodes.length === 0) {
    errors.push('Workflow must contain at least one trigger node')
  }

  const variables = sanitizeVariables(draft.variables)
  const positionedNodes = applyDeterministicLayout(normalizedNodes, normalizedEdges)

  return {
    config: {
      nodes: positionedNodes,
      edges: normalizedEdges,
      variables,
      version: QUICK_START_AI_GENERATOR_VERSION,
    },
    errors,
    summary: sanitizeSummary(draft.summary),
  }
}
