/**
 * Component Schemas for Telegram Bot Builder
 * Each node type has strict schema for its data field
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type ParseMode = 'None' | 'Markdown' | 'MarkdownV2' | 'HTML'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export type ComparisonOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'lt' | 'gte' | 'lte' | 'isEmpty' | 'isNotEmpty'

export type ActionType = 'setVariable' | 'httpRequest' | 'sendEmail' | 'delay' | 'random' | 'deleteMessage' | 'editMessage'

// ============================================================================
// KEYBOARD & BUTTONS
// ============================================================================

export interface InlineButton {
  id: string
  text: string
  url?: string
  callbackData?: string
  switchInlineQuery?: string
  switchInlineQueryCurrentChat?: string
}

export interface KeyboardRow {
  buttons: InlineButton[]
}

export interface KeyboardData {
  rows: KeyboardRow[]
  resize?: boolean
  oneTime?: boolean
  selective?: boolean
}

// ============================================================================
// ATTACHMENTS
// ============================================================================

export interface PhotoAttachment {
  type: 'photo'
  url?: string
  fileId?: string
  caption?: string
}

export interface DocumentAttachment {
  type: 'document'
  url?: string
  fileId?: string
  fileName?: string
  caption?: string
}

export interface VideoAttachment {
  type: 'video'
  url?: string
  fileId?: string
  caption?: string
  width?: number
  height?: number
  duration?: number
}

export interface AudioAttachment {
  type: 'audio'
  url?: string
  fileId?: string
  caption?: string
  duration?: number
  title?: string
  performer?: string
}

export type Attachment = PhotoAttachment | DocumentAttachment | VideoAttachment | AudioAttachment

// ============================================================================
// VALIDATION RULES
// ============================================================================

export interface ValidationRule {
  type: 'regex' | 'minLength' | 'maxLength' | 'email' | 'phone' | 'number' | 'custom'
  value?: any
  errorMessage?: string
}

// ============================================================================
// NODE DATA SCHEMAS
// ============================================================================

/**
 * Message Node - Sends a message to the user
 */
export interface MessageNodeData {
  text: string
  parseMode?: ParseMode
  disableWebPagePreview?: boolean
  disableNotification?: boolean
  keyboard?: KeyboardData
  attachments?: Attachment[]
  _label?: string // Display label in editor
  _description?: string // Display description in editor
}

/**
 * Input Node - Requests input from user
 */
export interface InputNodeData {
  question: string
  variableName: string
  parseMode?: ParseMode
  validation?: ValidationRule[]
  errorMessage?: string
  keyboard?: KeyboardData
  skipButton?: boolean // Allow user to skip
  skipValue?: any // Value to use when skipped
  _label?: string
  _description?: string
}

/**
 * Condition Node - Branch workflow based on condition
 */
export interface ConditionNodeData {
  variable: string // Variable path (e.g., user.name, {{user.age}})
  operator: ComparisonOperator
  value: any // Value to compare against
  trueLabel?: string // Label for true branch
  falseLabel?: string // Label for false branch
  _label?: string
  _description?: string
}

/**
 * Action Node - Perform various actions
 */
export interface SetVariableAction {
  type: 'setVariable'
  variableName: string
  value: string // Can use {{variable}} syntax
  valueSource?: 'static' | 'variable' | 'expression'
}

export interface HttpRequestAction {
  type: 'httpRequest'
  url: string
  method: HttpMethod
  headers?: Record<string, string>
  body?: any
  saveToVariable?: string
  timeout?: number
}

export interface DelayAction {
  type: 'delay'
  duration: number // in milliseconds
}

export interface DeleteMessageAction {
  type: 'deleteMessage'
  delay?: number // delete after X ms
}

export interface RandomAction {
  type: 'random'
  options: Array<{
    weight?: number // probability weight
    value: any
  }>
  saveToVariable?: string
}

export type ActionData = SetVariableAction | HttpRequestAction | DelayAction | DeleteMessageAction | RandomAction

export interface ActionNodeData {
  action: ActionData
  onError?: 'continue' | 'stop' | 'retry'
  retryCount?: number
  _label?: string
  _description?: string
}

/**
 * Webhook Node - Call external API
 */
export interface WebhookNodeData {
  url: string
  method: HttpMethod
  headers?: Record<string, string>
  body?: any
  bodyType?: 'json' | 'form' | 'raw'
  saveToVariable?: string // Save response to variable
  timeout?: number
  retryOnFailure?: boolean
  maxRetries?: number
  _label?: string
  _description?: string
}

/**
 * Trigger Node - Entry point for bot scenarios
 */
export type TriggerType = 'command' | 'text' | 'callbackQuery' | 'inlineQuery' | 'photo' | 'sticker' | 'any'

export interface TriggerNodeData {
  trigger: TriggerType
  pattern?: string // For command (/start) or text matching
  description?: string
  _label?: string
  _description?: string
}

/**
 * Wait Node - Wait for specific event
 */
export interface WaitNodeData {
  waitFor: 'message' | 'callbackQuery' | 'photo' | 'contact' | 'location' | 'custom'
  timeout?: number // milliseconds
  onTimeout?: string // node ID to go to on timeout
  saveToVariable?: string
  _label?: string
  _description?: string
}

/**
 * Comment Node - Just for documentation
 */
export interface CommentNodeData {
  text: string
  color?: 'default' | 'info' | 'warning' | 'error'
  _label?: string
}

// ============================================================================
// UNION TYPE FOR ALL NODE DATA
// ============================================================================

export type NodeData =
  | MessageNodeData
  | InputNodeData
  | ConditionNodeData
  | ActionNodeData
  | WebhookNodeData
  | TriggerNodeData
  | WaitNodeData
  | CommentNodeData

// ============================================================================
// NODE CONFIGURATION FOR EDITOR
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
  outputLabels?: string[] // For condition nodes: ['True', 'False']
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
  action: {
    type: 'action',
    label: 'Действие',
    description: 'Выполнить действие (установить переменную, HTTP запрос и т.д.)',
    color: '#8B5CF6',
    icon: 'Zap',
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
// DEFAULT DATA FOR NODE TYPES
// ============================================================================

export const DEFAULT_NODE_DATA: Record<string, Partial<NodeData>> = {
  message: {
    text: '',
    parseMode: 'None',
    disableWebPagePreview: false,
    disableNotification: false,
    _label: 'Сообщение',
    _description: 'Отправить сообщение',
  },
  input: {
    question: '',
    variableName: '',
    parseMode: 'None',
    skipButton: false,
    _label: 'Ввод данных',
    _description: 'Запросить ввод',
  },
  condition: {
    variable: '',
    operator: 'equals',
    value: '',
    trueLabel: 'Да',
    falseLabel: 'Нет',
    _label: 'Условие',
    _description: 'Если... то...',
  },
  action: {
    action: { type: 'setVariable', variableName: '', value: '' },
    onError: 'continue',
    _label: 'Действие',
    _description: 'Выполнить действие',
  },
  webhook: {
    url: '',
    method: 'GET',
    bodyType: 'json',
    _label: 'Webhook',
    _description: 'HTTP запрос',
  },
  trigger: {
    trigger: 'command',
    pattern: '/start',
    _label: 'Триггер',
    _description: 'Начало сценария',
  },
  wait: {
    waitFor: 'message',
    timeout: 300000,
    _label: 'Ожидание',
    _description: 'Ждать ответа',
  },
  comment: {
    text: '',
    color: 'default',
    _label: 'Комментарий',
    _description: 'Заметка',
  },
}
