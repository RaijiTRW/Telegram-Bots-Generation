import {
  DEFAULT_NODE_DATA,
  NODE_CONFIGS,
  type ActionType,
  type ComparisonOperator,
  type HttpMethod,
  type ParseMode,
  type TriggerType,
} from '@/lib/bot-editor/types/component-schemas'
import type {
  Node,
  NodeCapabilityCatalogEntry,
  NodeType,
} from '@/lib/bot-editor/types/bot.types'

type NodeAgentSpec = {
  purpose: string
  requiredDataFields: string[]
  optionalDataFields: string[]
  allowedSourceHandles: string[]
  connectionRules: string[]
  runtimeBehavior: string
  exampleData: Record<string, unknown>
}

const ALLOWED_PARSE_MODES = new Set<ParseMode>(['None', 'Markdown', 'MarkdownV2', 'HTML'])
const ALLOWED_HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'HEAD',
  'OPTIONS',
])
const ALLOWED_TRIGGER_TYPES = new Set<TriggerType>([
  'command',
  'text',
  'callbackQuery',
  'photo',
  'any',
  'schedule',
])
const ALLOWED_ACTION_TYPES = new Set<ActionType>([
  'setVariable',
  'delay',
  'deleteMessage',
  'random',
])
const ALLOWED_OPERATORS = new Set<ComparisonOperator>([
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
const ALLOWED_SCRIPT_LANGUAGES = new Set(['javascript', 'python'])
const ALLOWED_WAIT_FOR = new Set(['message', 'text', 'callbackQuery', 'any'])
const ALLOWED_SCHEDULER_MODES = new Set(['delay', 'dateTime'])
const ALLOWED_DELAY_UNITS = new Set(['seconds', 'minutes', 'hours', 'days'])
const ALLOWED_REPLY_KEYBOARD_MODES = new Set(['system', 'variant', 'clear', 'condition'])
const ALLOWED_REPLY_KEYBOARD_BRANCH_MODES = new Set(['system', 'variant', 'clear'])
const ALLOWED_BODY_TYPES = new Set(['json', 'form', 'raw', 'none'])
const ALLOWED_WEBHOOK_BODY_TYPES = new Set(['json', 'form', 'raw'])
const ALLOWED_ATTACHMENT_TYPES = new Set(['photo', 'video', 'document', 'audio'])
const ALLOWED_COMMENT_COLORS = new Set(['default', 'blue', 'green', 'yellow', 'red', 'purple'])
const AGENT_META_FIELDS = ['__label', '__description'] as const

const NODE_AGENT_SPECS: Record<NodeType, NodeAgentSpec> = {
  trigger: {
    purpose: 'Starts a workflow from command, text, callback, photo, any update, or schedule.',
    requiredDataFields: ['trigger'],
    optionalDataFields: ['pattern', 'description', 'scheduleMode', 'everyHours', 'atMinute', 'atTime', 'timeZone', 'targetChatId', 'targetUserId', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: [
      'Trigger nodes must not have incoming edges.',
      'Use one default outgoing edge without sourceHandle.',
      'For callback triggers leave pattern empty to catch any callback.',
    ],
    runtimeBehavior: 'Matches Telegram updates and starts execution from this node.',
    exampleData: {
      type: 'trigger',
      trigger: 'command',
      pattern: '/start',
      __label: 'Start Trigger',
    },
  },
  message: {
    purpose: 'Sends a Telegram message, media attachments, and optional inline keyboard.',
    requiredDataFields: ['text'],
    optionalDataFields: ['parseMode', 'typingDraft', 'disableWebPagePreview', 'disableNotification', 'keyboard', 'attachments', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: [
      'Uses only one default outgoing edge.',
      'Inline keyboard branching should still continue through the default edge.',
    ],
    runtimeBehavior: 'Sends a message to the user and then continues to the next node.',
    exampleData: {
      type: 'message',
      text: 'Здравствуйте! Чем могу помочь?',
      parseMode: 'None',
      keyboard: {
        rows: [
          {
            buttons: [
              { id: 'services', text: 'Услуги', actionType: 'callback', callbackData: 'services' },
            ],
          },
        ],
      },
      __label: 'Приветствие',
    },
  },
  input: {
    purpose: 'Asks the user a question and stores the answer into a variable.',
    requiredDataFields: ['question', 'variableName'],
    optionalDataFields: ['parseMode', 'validation', 'errorMessage', 'keyboard', 'forceReply', 'inputPlaceholder', 'skipButton', 'skipValue', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: [
      'Input nodes use a single default outgoing edge.',
      'Use variableName to store the next user answer.',
    ],
    runtimeBehavior: 'Waits for the next user message, validates it, saves it, and resumes through the default edge.',
    exampleData: {
      type: 'input',
      question: 'Как вас зовут?',
      variableName: 'client_name',
      forceReply: true,
      __label: 'Имя клиента',
    },
  },
  condition: {
    purpose: 'Branches the flow into true/default and false paths based on a variable comparison.',
    requiredDataFields: ['variable', 'operator', 'value'],
    optionalDataFields: ['trueLabel', 'falseLabel', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default(true)', 'false'],
    connectionRules: [
      'True branch uses the default outgoing edge without sourceHandle.',
      'False branch uses sourceHandle "false".',
    ],
    runtimeBehavior: 'Evaluates the comparison and follows either the true/default edge or the false edge.',
    exampleData: {
      type: 'condition',
      variable: 'callback.data',
      operator: 'equals',
      value: 'services',
      trueLabel: 'Да',
      falseLabel: 'Нет',
      __label: 'Выбор услуг',
    },
  },
  router: {
    purpose: 'Branches the flow across multiple cases using a variable value.',
    requiredDataFields: ['variable', 'cases'],
    optionalDataFields: ['operator', 'defaultLabel', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default', 'case:<caseId>'],
    connectionRules: [
      'Each case must have a unique id.',
      'Case branches use sourceHandle "case:<caseId>".',
      'Default branch omits sourceHandle.',
    ],
    runtimeBehavior: 'Matches a router case and follows the matching case handle, otherwise the default edge.',
    exampleData: {
      type: 'router',
      variable: 'lead_stage',
      operator: 'equals',
      cases: [
        { id: 'new', label: 'Новый', value: 'new' },
        { id: 'hot', label: 'Горячий', value: 'hot' },
      ],
      defaultLabel: 'Иначе',
      __label: 'Маршрутизация заявки',
    },
  },
  scheduler: {
    purpose: 'Delays continuation or resumes at a specific date/time in a timezone.',
    requiredDataFields: ['mode'],
    optionalDataFields: ['delayValue', 'delayUnit', 'dateTime', 'timeZone', 'saveToVariable', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: [
      'Scheduler uses a single default outgoing edge.',
      'Use mode "delay" for relative waits and "dateTime" for fixed resume time.',
    ],
    runtimeBehavior: 'Pauses execution and resumes later through the default edge.',
    exampleData: {
      type: 'scheduler',
      mode: 'delay',
      delayValue: 10,
      delayUnit: 'minutes',
      __label: 'Напомнить позже',
    },
  },
  replyKeyboard: {
    purpose: 'Controls the Telegram reply keyboard state using system, variant, clear, or condition modes.',
    requiredDataFields: ['mode'],
    optionalDataFields: ['variantKey', 'variable', 'operator', 'value', 'trueMode', 'trueVariantKey', 'falseMode', 'falseVariantKey', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Reply keyboard nodes use only one default outgoing edge.'],
    runtimeBehavior: 'Changes the current reply keyboard state and continues to the next node.',
    exampleData: {
      type: 'replyKeyboard',
      mode: 'system',
      variantKey: 'base',
      __label: 'Клавиатура',
    },
  },
  script: {
    purpose: 'Runs JavaScript or Python code to transform data or compute values.',
    requiredDataFields: ['code'],
    optionalDataFields: ['language', 'inputPath', 'saveToVariable', 'timeoutMs', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Script nodes use a single default outgoing edge.'],
    runtimeBehavior: 'Executes script code with input/context vars and optionally stores the result.',
    exampleData: {
      type: 'script',
      language: 'javascript',
      saveToVariable: 'normalized_name',
      code: "result = String(input ?? '').trim().toUpperCase()",
      __label: 'Нормализация имени',
    },
  },
  action: {
    purpose: 'Performs built-in utility actions like delay, deleteMessage, and random split. Use setVariable node for variable assignment.',
    requiredDataFields: ['action'],
    optionalDataFields: ['onError', 'retryCount', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default', 'a', 'b'],
    connectionRules: [
      'Most action nodes use the default outgoing edge.',
      'When action.type is "random", branch A uses sourceHandle "a" and branch B uses sourceHandle "b".',
    ],
    runtimeBehavior: 'Executes a built-in action and optionally branches for random split.',
    exampleData: {
      type: 'action',
      action: {
        type: 'delay',
        duration: 1000,
      },
      __label: 'Пауза',
    },
  },
  setVariable: {
    purpose: 'Assigns a value to a bot variable and continues through the default edge.',
    requiredDataFields: ['variableName'],
    optionalDataFields: ['value', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Set Variable nodes use one default outgoing edge.'],
    runtimeBehavior: 'Interpolates template variables in value, saves the result into variableName, then continues.',
    exampleData: {
      type: 'setVariable',
      variableName: 'lead_source',
      value: 'telegram',
      __label: 'Записать источник',
    },
  },
  database: {
    purpose: 'Reads text from the bot database and stores the result in a variable.',
    requiredDataFields: ['saveToVariable'],
    optionalDataFields: ['mode', 'query', 'maxMatches', 'fallbackText', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Database nodes use one default outgoing edge.'],
    runtimeBehavior: 'Searches or returns bot database text, saves it to saveToVariable, then continues.',
    exampleData: {
      type: 'database',
      mode: 'search',
      query: '{{message.text}}',
      saveToVariable: 'database.result',
      maxMatches: 5,
      __label: 'Поиск в базе',
    },
  },
  crm: {
    purpose: 'Creates, updates, or moves a flexible CRM card from workflow variables.',
    requiredDataFields: ['title', 'saveToVariable'],
    optionalDataFields: ['operation', 'scope', 'pipelineId', 'stageId', 'stageKey', 'cardId', 'externalKey', 'fieldMappings', 'tags', 'notes', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['CRM nodes use one default outgoing edge.'],
    runtimeBehavior: 'Upserts a CRM card by externalKey or moves an existing card to another stage, then continues.',
    exampleData: {
      type: 'crm',
      operation: 'create_or_update',
      scope: 'bot',
      stageKey: 'new',
      title: 'Заявка от {{user.firstName}}',
      externalKey: '{{user.id}}',
      fieldMappings: [
        { fieldKey: 'name', value: '{{user.firstName}}' },
        { fieldKey: 'comment', value: '{{message.text}}' },
      ],
      tags: 'telegram',
      saveToVariable: 'crm.card',
      __label: 'Создать заявку',
    },
  },
  http: {
    purpose: 'Calls an external HTTP API and optionally saves the response.',
    requiredDataFields: ['url', 'method'],
    optionalDataFields: ['headers', 'queryParams', 'body', 'bodyType', 'saveToVariable', 'timeout', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['HTTP nodes use one default outgoing edge.'],
    runtimeBehavior: 'Executes an HTTP request and optionally stores the response body.',
    exampleData: {
      type: 'http',
      url: 'https://api.example.com/leads',
      method: 'POST',
      bodyType: 'json',
      saveToVariable: 'api_response',
      __label: 'Отправка в CRM',
    },
  },
  webhook: {
    purpose: 'Calls an external webhook endpoint with body, headers, and retries.',
    requiredDataFields: ['url', 'method'],
    optionalDataFields: ['headers', 'body', 'bodyType', 'saveToVariable', 'timeout', 'retryOnFailure', 'maxRetries', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Webhook nodes use one default outgoing edge.'],
    runtimeBehavior: 'Sends a webhook request and optionally stores the response.',
    exampleData: {
      type: 'webhook',
      url: 'https://example.com/webhook',
      method: 'POST',
      bodyType: 'json',
      __label: 'Webhook',
    },
  },
  paymentYookassa: {
    purpose: 'Creates a YooKassa payment link and optionally auto-sends it.',
    requiredDataFields: ['shopId', 'secretKey', 'amount', 'currency'],
    optionalDataFields: ['description', 'returnUrl', 'capture', 'saveToVariable', 'autoSendPaymentLink', 'messageTemplate', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Payment nodes use one default outgoing edge.'],
    runtimeBehavior: 'Creates a YooKassa payment and optionally sends the payment URL to the user.',
    exampleData: {
      type: 'paymentYookassa',
      shopId: '123456',
      secretKey: 'secret',
      amount: '1490.00',
      currency: 'RUB',
      saveToVariable: 'payment',
      __label: 'Оплата YooKassa',
    },
  },
  paymentStripe: {
    purpose: 'Creates a Stripe Checkout payment link and optionally auto-sends it.',
    requiredDataFields: ['secretKey', 'amount', 'currency'],
    optionalDataFields: ['productName', 'description', 'successUrl', 'cancelUrl', 'saveToVariable', 'autoSendPaymentLink', 'messageTemplate', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Payment nodes use one default outgoing edge.'],
    runtimeBehavior: 'Creates a Stripe Checkout session and optionally sends the URL.',
    exampleData: {
      type: 'paymentStripe',
      secretKey: 'sk_live_...',
      amount: '49.00',
      currency: 'usd',
      productName: 'Consultation',
      __label: 'Оплата Stripe',
    },
  },
  paymentRobokassa: {
    purpose: 'Creates a Robokassa payment URL and optionally auto-sends it.',
    requiredDataFields: ['merchantLogin', 'password1', 'amount', 'currency'],
    optionalDataFields: ['description', 'invoiceId', 'successUrl', 'failUrl', 'isTest', 'saveToVariable', 'autoSendPaymentLink', 'messageTemplate', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Payment nodes use one default outgoing edge.'],
    runtimeBehavior: 'Builds a Robokassa payment URL and optionally sends it.',
    exampleData: {
      type: 'paymentRobokassa',
      merchantLogin: 'merchant',
      password1: 'secret',
      amount: '1990.00',
      currency: 'RUB',
      isTest: true,
      __label: 'Оплата Robokassa',
    },
  },
  paymentStars: {
    purpose: 'Creates a Telegram Stars invoice link and optionally auto-sends it.',
    requiredDataFields: ['amount'],
    optionalDataFields: ['title', 'currency', 'description', 'payload', 'saveToVariable', 'autoSendPaymentLink', 'messageTemplate', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Payment nodes use one default outgoing edge.'],
    runtimeBehavior: 'Calls createInvoiceLink and optionally sends the Telegram Stars payment URL.',
    exampleData: {
      type: 'paymentStars',
      title: 'Оплата в Stars',
      amount: '100',
      currency: 'XTR',
      saveToVariable: 'payment',
      __label: 'Оплата Stars',
    },
  },
  wait: {
    purpose: 'Pauses the workflow until a matching event arrives.',
    requiredDataFields: ['waitFor'],
    optionalDataFields: ['timeout', 'saveToVariable', 'onTimeout', ...AGENT_META_FIELDS],
    allowedSourceHandles: ['default'],
    connectionRules: ['Wait nodes use one default outgoing edge.'],
    runtimeBehavior: 'Suspends execution until message, callback, or any event is received.',
    exampleData: {
      type: 'wait',
      waitFor: 'callbackQuery',
      saveToVariable: 'callback_choice',
      __label: 'Ждём нажатие',
    },
  },
  comment: {
    purpose: 'Documents the workflow for humans and should stay visually disconnected.',
    requiredDataFields: ['text'],
    optionalDataFields: ['color', ...AGENT_META_FIELDS],
    allowedSourceHandles: [],
    connectionRules: [
      'Comment nodes must not have incoming edges.',
      'Comment nodes must not have outgoing edges.',
    ],
    runtimeBehavior: 'Does not execute at runtime.',
    exampleData: {
      type: 'comment',
      text: 'Сюда менеджер добавляет ручные уточнения по сценарию.',
      color: 'default',
      __label: 'Комментарий',
    },
  },
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeText(value: unknown, maxLength = 1000): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes'].includes(normalized)) return true
    if (['false', '0', 'no'].includes(normalized)) return false
  }
  return fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function sanitizeKeyValuePairs(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const key = normalizeText(record.key, 120)
      if (!key) return null
      return {
        key,
        value: normalizeText(record.value, 4000),
      }
    })
    .filter((item): item is { key: string; value: string } => Boolean(item))
}

function sanitizeKeyboard(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const rows = Array.isArray(record.rows) ? record.rows : []
  const sanitizedRows = rows
    .map((row, rowIndex) => {
      if (!Array.isArray((row as Record<string, unknown>)?.buttons)) return null
      const buttons = ((row as Record<string, unknown>).buttons as unknown[])
        .map((button, buttonIndex) => {
          const buttonRecord = button && typeof button === 'object' && !Array.isArray(button)
            ? (button as Record<string, unknown>)
            : {}
          const text = normalizeText(buttonRecord.text, 80)
          if (!text) return null
          return {
            id: normalizeText(buttonRecord.id, 80) || `btn_${rowIndex + 1}_${buttonIndex + 1}`,
            text,
            ...(normalizeText(buttonRecord.actionType, 40) ? { actionType: normalizeText(buttonRecord.actionType, 40) } : {}),
            ...(normalizeText(buttonRecord.callbackData ?? buttonRecord.callback_data, 120)
              ? { callbackData: normalizeText(buttonRecord.callbackData ?? buttonRecord.callback_data, 120) }
              : {}),
            ...(normalizeText(buttonRecord.url, 500) ? { url: normalizeText(buttonRecord.url, 500) } : {}),
            ...(normalizeText(buttonRecord.starsUrl, 500) ? { starsUrl: normalizeText(buttonRecord.starsUrl, 500) } : {}),
            ...(buttonRecord.payStars !== undefined ? { payStars: normalizeBoolean(buttonRecord.payStars) } : {}),
            ...(normalizeText(buttonRecord.switchInlineQuery, 120)
              ? { switchInlineQuery: normalizeText(buttonRecord.switchInlineQuery, 120) }
              : {}),
            ...(normalizeText(buttonRecord.switchInlineQueryCurrentChat, 120)
              ? { switchInlineQueryCurrentChat: normalizeText(buttonRecord.switchInlineQueryCurrentChat, 120) }
              : {}),
          }
        })
        .filter(Boolean) as Array<Record<string, unknown>>

      return buttons.length > 0 ? { buttons } : null
    })
    .filter((row): row is { buttons: Record<string, unknown>[] } => Boolean(row))

  if (sanitizedRows.length === 0) {
    return undefined
  }

  return {
    rows: sanitizedRows,
    ...(record.resize !== undefined ? { resize: normalizeBoolean(record.resize) } : {}),
    ...(record.oneTime !== undefined ? { oneTime: normalizeBoolean(record.oneTime) } : {}),
    ...(record.selective !== undefined ? { selective: normalizeBoolean(record.selective) } : {}),
  }
}

function sanitizeAttachments(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const type = normalizeText(record.type, 20)
      const source = normalizeText(record.source, 1200)
      if (!type || !source || !ALLOWED_ATTACHMENT_TYPES.has(type)) {
        return null
      }
      return { type, source }
    })
    .filter((item): item is { type: string; source: string } => Boolean(item))
}

function sanitizeRouterCases(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
      const id = normalizeText(record.id, 80) || `case_${index + 1}`
      return {
        id,
        label: normalizeText(record.label, 80) || `Case ${index + 1}`,
        value: record.value ?? '',
      }
    })
    .filter((item) => Boolean(item.id))
}

function sanitizeActionPayload(value: unknown): Record<string, unknown> {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
  const actionType = normalizeText(record.type, 40)
  const fallback = {
    type: 'setVariable',
    variableName: '',
    value: '',
  }

  if (!ALLOWED_ACTION_TYPES.has(actionType as ActionType)) {
    return fallback
  }

  if (actionType === 'setVariable') {
    return {
      type: 'setVariable',
      variableName: normalizeText(record.variableName, 120),
      value: record.value ?? '',
    }
  }

  if (actionType === 'delay') {
    return {
      type: 'delay',
      duration: Math.max(0, Math.min(normalizeNumber(record.duration, 1000), 10000)),
    }
  }

  if (actionType === 'deleteMessage') {
    return { type: 'deleteMessage' }
  }

  return {
    type: 'random',
    aPercent: Math.max(0, Math.min(normalizeNumber(record.aPercent ?? record.percent, 50), 100)),
    ...(normalizeText(record.saveToVariable, 120) ? { saveToVariable: normalizeText(record.saveToVariable, 120) } : {}),
  }
}

export function getNodeCapabilityCatalog(): NodeCapabilityCatalogEntry[] {
  return (Object.keys(NODE_AGENT_SPECS) as NodeType[]).map((nodeType) => {
    const spec = NODE_AGENT_SPECS[nodeType]
    const config = NODE_CONFIGS[nodeType]

    return {
      nodeType,
      label: config?.label || nodeType,
      description: config?.description || spec.purpose,
      category: config?.category || 'advanced',
      purpose: spec.purpose,
      requiredDataFields: spec.requiredDataFields,
      optionalDataFields: spec.optionalDataFields,
      allowedSourceHandles: spec.allowedSourceHandles,
      connectionRules: spec.connectionRules,
      runtimeBehavior: spec.runtimeBehavior,
      exampleData: cloneValue(spec.exampleData),
    }
  })
}

export function canUseNodeAsIncomingTarget(nodeType: NodeType): boolean {
  return nodeType !== 'trigger' && nodeType !== 'comment'
}

export function canUseNodeAsOutgoingSource(nodeType: NodeType): boolean {
  return nodeType !== 'comment'
}

export function getAllowedSourceHandlesForNode(node: Node): string[] {
  if (node.type === 'condition') {
    return ['', 'false']
  }

  if (node.type === 'router') {
    const data = node.data && typeof node.data === 'object'
      ? (node.data as Record<string, unknown>)
      : {}
    const cases = sanitizeRouterCases(data.cases)
    return ['', ...cases.map((routerCase) => `case:${routerCase.id}`)]
  }

  if (node.type === 'action') {
    const data = node.data && typeof node.data === 'object'
      ? (node.data as Record<string, unknown>)
      : {}
    const action = data.action && typeof data.action === 'object'
      ? (data.action as Record<string, unknown>)
      : {}

    if (normalizeText(action.type, 40) === 'random') {
      return ['a', 'b']
    }
  }

  if (node.type === 'comment') {
    return []
  }

  return ['']
}

export function isValidSourceHandleForNode(node: Node, sourceHandle?: string | null): boolean {
  const normalized = normalizeText(sourceHandle, 120)
  const allowed = getAllowedSourceHandlesForNode(node)

  if (!normalized) {
    return allowed.includes('')
  }

  return allowed.includes(normalized)
}

export function sanitizeNodeDataForAgent(nodeType: NodeType, rawData: unknown): Record<string, unknown> {
  const source = rawData && typeof rawData === 'object' && !Array.isArray(rawData)
    ? (rawData as Record<string, unknown>)
    : {}
  const defaults = cloneValue((DEFAULT_NODE_DATA[nodeType] || {}) as Record<string, unknown>)
  const sanitized: Record<string, unknown> = {
    ...defaults,
    type: nodeType,
  }

  const label = normalizeText(source.__label, 80)
  const description = normalizeText(source.__description, 160)
  if (label) sanitized.__label = label
  if (description) sanitized.__description = description

  switch (nodeType) {
    case 'message':
      sanitized.text = normalizeText(source.text, 5000)
      sanitized.parseMode = ALLOWED_PARSE_MODES.has(String(source.parseMode) as ParseMode) ? source.parseMode : defaults.parseMode
      sanitized.typingDraft = normalizeBoolean(source.typingDraft, Boolean(defaults.typingDraft))
      sanitized.disableWebPagePreview = normalizeBoolean(source.disableWebPagePreview, Boolean(defaults.disableWebPagePreview))
      sanitized.disableNotification = normalizeBoolean(source.disableNotification, Boolean(defaults.disableNotification))
      sanitized.keyboard = sanitizeKeyboard(source.keyboard) || defaults.keyboard
      sanitized.attachments = sanitizeAttachments(source.attachments)
      break
    case 'input':
      sanitized.question = normalizeText(source.question, 5000)
      sanitized.variableName = normalizeText(source.variableName, 120)
      sanitized.parseMode = ALLOWED_PARSE_MODES.has(String(source.parseMode) as ParseMode) ? source.parseMode : defaults.parseMode
      sanitized.validation = Array.isArray(source.validation) ? cloneValue(source.validation) : defaults.validation
      sanitized.errorMessage = normalizeText(source.errorMessage, 500)
      sanitized.keyboard = sanitizeKeyboard(source.keyboard) || defaults.keyboard
      sanitized.forceReply = normalizeBoolean(source.forceReply, Boolean(defaults.forceReply))
      sanitized.inputPlaceholder = normalizeText(source.inputPlaceholder, 160)
      sanitized.skipButton = normalizeBoolean(source.skipButton, Boolean(defaults.skipButton))
      if (source.skipValue !== undefined) {
        sanitized.skipValue = source.skipValue
      }
      break
    case 'condition':
      sanitized.variable = normalizeText(source.variable, 120)
      sanitized.operator = ALLOWED_OPERATORS.has(String(source.operator) as ComparisonOperator) ? source.operator : defaults.operator
      sanitized.value = source.value ?? ''
      sanitized.trueLabel = normalizeText(source.trueLabel, 60) || defaults.trueLabel
      sanitized.falseLabel = normalizeText(source.falseLabel, 60) || defaults.falseLabel
      break
    case 'router':
      sanitized.variable = normalizeText(source.variable, 120)
      sanitized.operator = ALLOWED_OPERATORS.has(String(source.operator) as ComparisonOperator) ? source.operator : defaults.operator
      sanitized.cases = sanitizeRouterCases(source.cases)
      sanitized.defaultLabel = normalizeText(source.defaultLabel, 60) || defaults.defaultLabel
      break
    case 'action':
      sanitized.action = sanitizeActionPayload(source.action)
      sanitized.onError = normalizeText(source.onError, 40) || defaults.onError
      sanitized.retryCount = Math.max(0, Math.min(normalizeNumber(source.retryCount, Number(defaults.retryCount || 0)), 5))
      break
    case 'setVariable':
      sanitized.variableName = normalizeText(source.variableName ?? source.variable ?? source.key, 120)
      sanitized.value = source.value ?? ''
      break
    case 'database':
      sanitized.mode = normalizeText(source.mode, 20) === 'all' ? 'all' : 'search'
      sanitized.query = normalizeText(source.query, 500)
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || defaults.saveToVariable
      sanitized.maxMatches = Math.max(1, Math.min(normalizeNumber(source.maxMatches, Number(defaults.maxMatches || 5)), 20))
      sanitized.fallbackText = normalizeText(source.fallbackText, 1000)
      break
    case 'crm':
      sanitized.operation = normalizeText(source.operation, 30) === 'move_stage' ? 'move_stage' : 'create_or_update'
      sanitized.scope = normalizeText(source.scope, 20) === 'global' ? 'global' : 'bot'
      sanitized.pipelineId = normalizeText(source.pipelineId, 120)
      sanitized.stageId = normalizeText(source.stageId, 120)
      sanitized.stageKey = normalizeText(source.stageKey, 80) || defaults.stageKey
      sanitized.cardId = normalizeText(source.cardId, 500)
      sanitized.title = normalizeText(source.title, 500) || defaults.title
      sanitized.externalKey = normalizeText(source.externalKey, 500) || defaults.externalKey
      sanitized.tags = normalizeText(source.tags, 300)
      sanitized.notes = normalizeText(source.notes, 1000)
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || (sanitized.operation === 'move_stage' ? 'crm.move' : defaults.saveToVariable)
      sanitized.fieldMappings = Array.isArray(source.fieldMappings)
        ? source.fieldMappings
          .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null
            const record = item as Record<string, unknown>
            const fieldKey = normalizeText(record.fieldKey, 80)
            if (!fieldKey) return null
            return { fieldKey, value: normalizeText(record.value, 500) }
          })
          .filter(Boolean)
          .slice(0, 30)
        : defaults.fieldMappings
      break
    case 'script':
      sanitized.language = ALLOWED_SCRIPT_LANGUAGES.has(normalizeText(source.language, 20))
        ? normalizeText(source.language, 20)
        : defaults.language
      sanitized.code = normalizeText(source.code, 12000) || defaults.code
      sanitized.inputPath = normalizeText(source.inputPath, 120)
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120)
      sanitized.timeoutMs = Math.max(100, Math.min(normalizeNumber(source.timeoutMs, Number(defaults.timeoutMs || 1000)), 30000))
      break
    case 'http':
      sanitized.url = normalizeText(source.url, 2000)
      sanitized.method = ALLOWED_HTTP_METHODS.has(String(source.method).toUpperCase() as HttpMethod)
        ? String(source.method).toUpperCase()
        : defaults.method
      sanitized.headers = sanitizeKeyValuePairs(source.headers)
      sanitized.queryParams = sanitizeKeyValuePairs(source.queryParams)
      sanitized.body = cloneValue(source.body ?? defaults.body ?? '')
      sanitized.bodyType = ALLOWED_BODY_TYPES.has(normalizeText(source.bodyType, 20)) ? normalizeText(source.bodyType, 20) : defaults.bodyType
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120)
      sanitized.timeout = Math.max(100, Math.min(normalizeNumber(source.timeout, Number(defaults.timeout || 30000)), 120000))
      break
    case 'webhook':
      sanitized.url = normalizeText(source.url, 2000)
      sanitized.method = ALLOWED_HTTP_METHODS.has(String(source.method).toUpperCase() as HttpMethod)
        ? String(source.method).toUpperCase()
        : defaults.method
      sanitized.headers = sanitizeKeyValuePairs(source.headers)
      sanitized.body = cloneValue(source.body ?? defaults.body ?? '')
      sanitized.bodyType = ALLOWED_WEBHOOK_BODY_TYPES.has(normalizeText(source.bodyType, 20))
        ? normalizeText(source.bodyType, 20)
        : defaults.bodyType
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120)
      sanitized.timeout = Math.max(100, Math.min(normalizeNumber(source.timeout, Number(defaults.timeout || 30000)), 120000))
      sanitized.retryOnFailure = normalizeBoolean(source.retryOnFailure)
      sanitized.maxRetries = Math.max(0, Math.min(normalizeNumber(source.maxRetries, 0), 5))
      break
    case 'paymentYookassa':
      sanitized.shopId = normalizeText(source.shopId, 160)
      sanitized.secretKey = normalizeText(source.secretKey, 500)
      sanitized.amount = normalizeText(source.amount, 32) || defaults.amount
      sanitized.currency = normalizeText(source.currency, 8) || defaults.currency
      sanitized.description = normalizeText(source.description, 500)
      sanitized.returnUrl = normalizeText(source.returnUrl, 1200)
      sanitized.capture = normalizeBoolean(source.capture, Boolean(defaults.capture))
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || defaults.saveToVariable
      sanitized.autoSendPaymentLink = normalizeBoolean(source.autoSendPaymentLink, Boolean(defaults.autoSendPaymentLink))
      sanitized.messageTemplate = normalizeText(source.messageTemplate, 1000) || defaults.messageTemplate
      break
    case 'paymentStripe':
      sanitized.secretKey = normalizeText(source.secretKey, 500)
      sanitized.amount = normalizeText(source.amount, 32) || defaults.amount
      sanitized.currency = normalizeText(source.currency, 8) || defaults.currency
      sanitized.productName = normalizeText(source.productName, 160) || defaults.productName
      sanitized.description = normalizeText(source.description, 500)
      sanitized.successUrl = normalizeText(source.successUrl, 1200)
      sanitized.cancelUrl = normalizeText(source.cancelUrl, 1200)
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || defaults.saveToVariable
      sanitized.autoSendPaymentLink = normalizeBoolean(source.autoSendPaymentLink, Boolean(defaults.autoSendPaymentLink))
      sanitized.messageTemplate = normalizeText(source.messageTemplate, 1000) || defaults.messageTemplate
      break
    case 'paymentRobokassa':
      sanitized.merchantLogin = normalizeText(source.merchantLogin, 160)
      sanitized.password1 = normalizeText(source.password1, 500)
      sanitized.amount = normalizeText(source.amount, 32) || defaults.amount
      sanitized.currency = normalizeText(source.currency, 8) || defaults.currency
      sanitized.description = normalizeText(source.description, 500)
      sanitized.invoiceId = normalizeText(source.invoiceId, 120)
      sanitized.successUrl = normalizeText(source.successUrl, 1200)
      sanitized.failUrl = normalizeText(source.failUrl, 1200)
      sanitized.isTest = normalizeBoolean(source.isTest, Boolean(defaults.isTest))
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || defaults.saveToVariable
      sanitized.autoSendPaymentLink = normalizeBoolean(source.autoSendPaymentLink, Boolean(defaults.autoSendPaymentLink))
      sanitized.messageTemplate = normalizeText(source.messageTemplate, 1000) || defaults.messageTemplate
      break
    case 'paymentStars':
      sanitized.title = normalizeText(source.title, 160) || defaults.title
      sanitized.amount = normalizeText(source.amount, 32) || defaults.amount
      sanitized.currency = normalizeText(source.currency, 8) || defaults.currency
      sanitized.description = normalizeText(source.description, 500) || defaults.description
      sanitized.payload = normalizeText(source.payload, 120)
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120) || defaults.saveToVariable
      sanitized.autoSendPaymentLink = normalizeBoolean(source.autoSendPaymentLink, Boolean(defaults.autoSendPaymentLink))
      sanitized.messageTemplate = normalizeText(source.messageTemplate, 1000) || defaults.messageTemplate
      break
    case 'trigger':
      sanitized.trigger = ALLOWED_TRIGGER_TYPES.has(normalizeText(source.trigger, 30) as TriggerType)
        ? normalizeText(source.trigger, 30)
        : defaults.trigger
      sanitized.pattern = normalizeText(source.pattern, 120)
      sanitized.description = normalizeText(source.description, 200)
      sanitized.scheduleMode = normalizeText(source.scheduleMode, 20) || defaults.scheduleMode
      sanitized.everyHours = Math.max(1, Math.min(normalizeNumber(source.everyHours, Number(defaults.everyHours || 1)), 24))
      sanitized.atMinute = Math.max(0, Math.min(normalizeNumber(source.atMinute, Number(defaults.atMinute || 0)), 59))
      sanitized.atTime = normalizeText(source.atTime, 16)
      sanitized.timeZone = normalizeText(source.timeZone, 80) || defaults.timeZone
      sanitized.targetChatId = normalizeText(source.targetChatId, 80)
      sanitized.targetUserId = normalizeText(source.targetUserId, 80)
      break
    case 'wait':
      sanitized.waitFor = ALLOWED_WAIT_FOR.has(normalizeText(source.waitFor, 30))
        ? normalizeText(source.waitFor, 30)
        : defaults.waitFor
      sanitized.timeout = Math.max(0, Math.min(normalizeNumber(source.timeout, Number(defaults.timeout || 300000)), 86400000))
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120)
      sanitized.onTimeout = normalizeText(source.onTimeout, 120)
      break
    case 'scheduler':
      sanitized.mode = ALLOWED_SCHEDULER_MODES.has(normalizeText(source.mode, 20))
        ? normalizeText(source.mode, 20)
        : defaults.mode
      sanitized.delayValue = Math.max(0, Math.min(normalizeNumber(source.delayValue, Number(defaults.delayValue || 5)), 100000))
      sanitized.delayUnit = ALLOWED_DELAY_UNITS.has(normalizeText(source.delayUnit, 20))
        ? normalizeText(source.delayUnit, 20)
        : defaults.delayUnit
      sanitized.dateTime = normalizeText(source.dateTime, 40)
      sanitized.timeZone = normalizeText(source.timeZone, 80) || defaults.timeZone
      sanitized.saveToVariable = normalizeText(source.saveToVariable, 120)
      break
    case 'replyKeyboard':
      sanitized.mode = ALLOWED_REPLY_KEYBOARD_MODES.has(normalizeText(source.mode, 20))
        ? normalizeText(source.mode, 20)
        : defaults.mode
      sanitized.variantKey = normalizeText(source.variantKey, 80) || defaults.variantKey
      sanitized.variable = normalizeText(source.variable, 120)
      sanitized.operator = ALLOWED_OPERATORS.has(normalizeText(source.operator, 20) as ComparisonOperator)
        ? normalizeText(source.operator, 20)
        : defaults.operator
      sanitized.value = source.value ?? ''
      sanitized.trueMode = ALLOWED_REPLY_KEYBOARD_BRANCH_MODES.has(normalizeText(source.trueMode, 20))
        ? normalizeText(source.trueMode, 20)
        : defaults.trueMode
      sanitized.trueVariantKey = normalizeText(source.trueVariantKey, 80) || defaults.trueVariantKey
      sanitized.falseMode = ALLOWED_REPLY_KEYBOARD_BRANCH_MODES.has(normalizeText(source.falseMode, 20))
        ? normalizeText(source.falseMode, 20)
        : defaults.falseMode
      sanitized.falseVariantKey = normalizeText(source.falseVariantKey, 80) || defaults.falseVariantKey
      break
    case 'comment':
      sanitized.text = normalizeText(source.text, 4000)
      sanitized.color = ALLOWED_COMMENT_COLORS.has(normalizeText(source.color, 20))
        ? normalizeText(source.color, 20)
        : defaults.color
      break
  }

  if (!sanitized.__label) {
    sanitized.__label = NODE_CONFIGS[nodeType]?.label || nodeType
  }

  return sanitized
}
