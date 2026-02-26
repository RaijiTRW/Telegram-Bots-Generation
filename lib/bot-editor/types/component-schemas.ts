/**
 * Component Schemas for Telegram Bot Builder
 * Simplified types using 'any' to avoid compilation issues
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type ParseMode = 'None' | 'Markdown' | 'MarkdownV2' | 'HTML'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export type ComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'

export type ActionType =
  | 'setVariable'
  | 'delay'
  | 'deleteMessage'
  | 'random'

export type TriggerType = 'command' | 'text' | 'callbackQuery' | 'photo' | 'any' | 'schedule'
export type MessageAttachmentType = 'photo' | 'video' | 'document' | 'audio'
export type ScriptLanguage = 'javascript' | 'python'

// ============================================================================
// NODE DATA TYPES (simplified with 'any')
// ============================================================================

export interface BaseNodeData {
  __label?: string
  __description?: string
  aiEnabled?: boolean
  aiNodeKind?: 'message' | 'logic' | 'trigger'
  aiPrompt?: string
  aiSystemPrompt?: string
  aiModel?: string
}

export interface MessageNodeData extends BaseNodeData {
  type: 'message'
  text: string
  parseMode?: ParseMode
  disableWebPagePreview?: boolean
  disableNotification?: boolean
  keyboard?: any
  attachments?: Array<{
    type: MessageAttachmentType
    source: string // URL or Telegram file_id
  }>
}

export interface InputNodeData extends BaseNodeData {
  type: 'input'
  question: string
  variableName: string
  parseMode?: ParseMode
  validation?: any[]
  errorMessage?: string
  keyboard?: any
  forceReply?: boolean
  inputPlaceholder?: string
  skipButton?: boolean
  skipValue?: any
}

export interface ConditionNodeData extends BaseNodeData {
  type: 'condition'
  variable: string
  operator: ComparisonOperator
  value: any
  trueLabel?: string
  falseLabel?: string
}

export interface RouterCase {
  id: string
  label?: string
  value: any
}

export interface RouterNodeData extends BaseNodeData {
  type: 'router'
  variable: string
  operator?: ComparisonOperator
  cases?: RouterCase[]
  defaultLabel?: string
}

export interface ActionNodeData extends BaseNodeData {
  type: 'action'
  action: any
  onError?: string
  retryCount?: number
}

export interface ScriptNodeData extends BaseNodeData {
  type: 'script'
  language?: ScriptLanguage
  code?: string
  inputPath?: string
  saveToVariable?: string
  timeoutMs?: number
}

export interface HttpNodeData extends BaseNodeData {
  type: 'http'
  url: string
  method: HttpMethod
  headers?: Array<{ key: string; value: string }>
  queryParams?: Array<{ key: string; value: string }>
  body?: any
  bodyType?: 'json' | 'form' | 'raw' | 'none'
  saveToVariable?: string
  timeout?: number
}

export interface WebhookNodeData extends BaseNodeData {
  type: 'webhook'
  url: string
  method: HttpMethod
  headers?: any
  body?: any
  bodyType?: 'json' | 'form' | 'raw'
  saveToVariable?: string
  timeout?: number
  retryOnFailure?: boolean
  maxRetries?: number
}

export interface TriggerNodeData extends BaseNodeData {
  type: 'trigger'
  trigger: TriggerType
  pattern?: string
  description?: string
  scheduleMode?: 'hourly' | 'daily'
  everyHours?: number
  atMinute?: number
  atTime?: string // HH:mm for daily mode
  timeZone?: string // IANA timezone
  targetChatId?: string
  targetUserId?: string
}

export interface WaitNodeData extends BaseNodeData {
  type: 'wait'
  waitFor: string
  timeout?: number
  saveToVariable?: string
  onTimeout?: string
}

export interface SchedulerNodeData extends BaseNodeData {
  type: 'scheduler'
  mode?: 'delay' | 'dateTime'
  delayValue?: number
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days'
  dateTime?: string // local datetime string: YYYY-MM-DDTHH:mm (interpreted in selected timezone)
  timeZone?: string // IANA timezone, e.g. Europe/Moscow
  saveToVariable?: string // stores scheduled ISO timestamp
}

export interface ReplyKeyboardNodeData extends BaseNodeData {
  type: 'replyKeyboard'
  mode?: 'system' | 'variant' | 'clear' | 'condition'
  variantKey?: string // `base` or `rule:<id>`
  variable?: string
  operator?: ComparisonOperator
  value?: any
  trueMode?: 'system' | 'variant' | 'clear'
  trueVariantKey?: string
  falseMode?: 'system' | 'variant' | 'clear'
  falseVariantKey?: string
}

export interface CommentNodeData extends BaseNodeData {
  type: 'comment'
  text: string
  color?: string
}

// Union type for all node data
export type NodeData =
  | MessageNodeData
  | InputNodeData
  | ConditionNodeData
  | RouterNodeData
  | ActionNodeData
  | ScriptNodeData
  | HttpNodeData
  | WebhookNodeData
  | TriggerNodeData
  | WaitNodeData
  | SchedulerNodeData
  | ReplyKeyboardNodeData
  | CommentNodeData

// ============================================================================
// NODE CONFIG
// ============================================================================

export interface NodeConfig {
  type: string
  label: string
  description: string
  color: string
  icon: string
  category: 'trigger' | 'logic' | 'messaging' | 'data' | 'advanced'
  editable: boolean
  hasMultipleOutputs?: boolean
  outputLabels?: string[]
}

export const NODE_CONFIGS: Record<string, NodeConfig> = {
  message: {
    type: 'message',
    label: 'Сообщение',
    description: 'Отправить текст, фото или файл пользователю',
    color: '#24A1DE',
    icon: 'MessageSquare',
    category: 'messaging',
    editable: true,
  },
  input: {
    type: 'input',
    label: 'Ввод данных',
    description: 'Запросить данные у пользователя',
    color: '#10B981',
    icon: 'Keyboard',
    category: 'messaging',
    editable: true,
  },
  condition: {
    type: 'condition',
    label: 'Условие',
    description: 'Разветвить логику на основе условия',
    color: '#F59E0B',
    icon: 'GitBranch',
    category: 'logic',
    editable: true,
    hasMultipleOutputs: true,
    outputLabels: ['Да', 'Нет'],
  },
  router: {
    type: 'router',
    label: 'Router / Switch',
    description: 'Разветвить по нескольким вариантам значения переменной',
    color: '#EAB308',
    icon: 'GitBranch',
    category: 'logic',
    editable: true,
    hasMultipleOutputs: true,
  },
  action: {
    type: 'action',
    label: 'Действие',
    description: 'Выполнить действие (переменные, задержки, удаление сообщений)',
    color: '#8B5CF6',
    icon: 'Zap',
    category: 'data',
    editable: true,
  },
  script: {
    type: 'script',
    label: 'Скрипт',
    description: 'Выполнить JS/Python скрипт (self-host / local test)',
    color: '#06B6D4',
    icon: 'Code2',
    category: 'advanced',
    editable: true,
  },
  http: {
    type: 'http',
    label: 'HTTP',
    description: 'HTTP запрос во внешний API (GET, POST и т.д.)',
    color: '#F43F5E',
    icon: 'Globe',
    category: 'data',
    editable: true,
  },
  webhook: {
    type: 'webhook',
    label: 'Webhook',
    description: 'Вызов внешнего API',
    color: '#EF4444',
    icon: 'Webhook',
    category: 'data',
    editable: true,
  },
  trigger: {
    type: 'trigger',
    label: 'Триггер',
    description: 'Точка входа (команда, текст и т.д.)',
    color: '#6366F1',
    icon: 'Play',
    category: 'trigger',
    editable: true,
  },
  wait: {
    type: 'wait',
    label: 'Ожидание',
    description: 'Ждать события от пользователя',
    color: '#14B8A6',
    icon: 'Clock',
    category: 'logic',
    editable: true,
  },
  scheduler: {
    type: 'scheduler',
    label: 'Date/Time Scheduler',
    description: 'Продолжить сценарий в указанное время (timezone-aware)',
    color: '#22C55E',
    icon: 'Clock',
    category: 'logic',
    editable: true,
  },
  replyKeyboard: {
    type: 'replyKeyboard',
    label: 'Reply Keyboard',
    description: 'Управление базовой клавиатурой под input (system/variant/clear)',
    color: '#0EA5E9',
    icon: 'Keyboard',
    category: 'messaging',
    editable: true,
  },
  comment: {
    type: 'comment',
    label: 'Комментарий',
    description: 'Заметка для документации',
    color: '#6B7280',
    icon: 'MessageCircle',
    category: 'advanced',
    editable: true,
  },
}

// ============================================================================
// DEFAULT DATA
// ============================================================================

export const DEFAULT_NODE_DATA: Record<string, any> = {
  message: {
    text: '',
    parseMode: 'None',
    disableWebPagePreview: false,
    disableNotification: false,
    attachments: [],
  },
  input: {
    question: '',
    variableName: '',
    parseMode: 'None',
    forceReply: true,
    inputPlaceholder: '',
    skipButton: false,
  },
  condition: {
    variable: '',
    operator: 'equals',
    value: '',
    trueLabel: 'Да',
    falseLabel: 'Нет',
  },
  router: {
    variable: '',
    operator: 'equals',
    cases: [
      { id: 'case_1', label: 'Вариант 1', value: '' },
      { id: 'case_2', label: 'Вариант 2', value: '' },
    ],
    defaultLabel: 'Иначе',
  },
  action: {
    action: { type: 'setVariable', variableName: '', value: '' },
    onError: 'continue',
  },
  http: {
    url: '',
    method: 'GET',
    headers: [],
    queryParams: [],
    body: '',
    bodyType: 'json',
    saveToVariable: '',
    timeout: 30000,
  },
  webhook: {
    url: '',
    method: 'GET',
  },
  trigger: {
    trigger: 'command',
    pattern: '/start',
  },
  wait: {
    waitFor: 'message',
    timeout: 300000,
  },
  scheduler: {
    mode: 'delay',
    delayValue: 5,
    delayUnit: 'minutes',
    dateTime: '',
    timeZone: 'UTC',
    saveToVariable: '',
  },
  replyKeyboard: {
    mode: 'system',
    variantKey: 'base',
    variable: '',
    operator: 'equals',
    value: '',
    trueMode: 'variant',
    trueVariantKey: 'base',
    falseMode: 'system',
    falseVariantKey: '',
  },
  comment: {
    text: '',
    color: 'default',
  },
}
