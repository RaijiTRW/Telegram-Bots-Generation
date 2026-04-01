import type {
  ConditionNodeData,
  MessageNodeData,
  NodeData,
  TriggerNodeData,
} from '@/lib/bot-editor/types/component-schemas'
import type { NodeType } from '@/lib/bot-editor/types/bot.types'

export const NODE_HELP_TEMPLATE_LABELS: Record<string, string> = {
  'trigger-command': 'Command Trigger',
  'trigger-text': 'Text Trigger',
  'trigger-callback': 'Callback Trigger',
  'trigger-schedule': 'Schedule Trigger',
  'trigger-ai': 'AI Trigger',
  message: 'Message',
  'message-ai': 'AI Message',
  input: 'Input',
  condition: 'Condition',
  'condition-ai': 'AI Logic',
  router: 'Router / Switch',
  scheduler: 'Date/Time Scheduler',
  wait: 'Wait',
  'reply-keyboard': 'Reply Keyboard',
  action: 'Action',
  script: 'Script',
  http: 'HTTP',
  webhook: 'Webhook',
  comment: 'Comment',
  'payment-yookassa': 'YooKassa',
  'payment-stripe': 'Stripe',
  'payment-robokassa': 'Robokassa',
  'payment-stars': 'Telegram Stars',
}

export const NODE_HELP_TRANSLATION_SUFFIX_BY_TEMPLATE_ID: Record<string, string> = {
  'trigger-command': 'triggerCommand',
  'trigger-text': 'triggerText',
  'trigger-callback': 'triggerCallback',
  'trigger-schedule': 'triggerSchedule',
  'trigger-ai': 'triggerAI',
  message: 'message',
  'message-ai': 'messageAI',
  input: 'input',
  condition: 'condition',
  'condition-ai': 'conditionAI',
  router: 'router',
  scheduler: 'scheduler',
  wait: 'wait',
  'reply-keyboard': 'replyKeyboard',
  action: 'action',
  script: 'script',
  http: 'http',
  webhook: 'http',
  comment: 'comment',
  'payment-yookassa': 'paymentYookassa',
  'payment-stripe': 'paymentStripe',
  'payment-robokassa': 'paymentRobokassa',
  'payment-stars': 'paymentStars',
}

export const NODE_TEMPLATE_GUIDE_IDS = [
  'trigger-command',
  'trigger-text',
  'trigger-callback',
  'trigger-schedule',
  'trigger-ai',
  'message',
  'message-ai',
  'input',
  'condition',
  'condition-ai',
  'router',
  'scheduler',
  'reply-keyboard',
  'action',
  'script',
  'http',
  'webhook',
  'payment-yookassa',
  'payment-stripe',
  'payment-robokassa',
  'payment-stars',
] as const

export const CANVAS_PALETTE_TEMPLATE_IDS = [
  'trigger-command',
  'trigger-text',
  'trigger-callback',
  'trigger-schedule',
  'trigger-ai',
  'message',
  'message-ai',
  'condition',
  'condition-ai',
  'router',
  'scheduler',
  'wait',
  'reply-keyboard',
  'script',
  'action',
  'input',
  'http',
  'comment',
  'payment-yookassa',
  'payment-stripe',
  'payment-robokassa',
  'payment-stars',
] as const

export function resolveNodeHelpTemplateId(nodeType: NodeType, data: Partial<NodeData>): string | null {
  if (nodeType === 'trigger') {
    const raw = data as Partial<TriggerNodeData> & {
      trigger?: string
      triggerType?: string
      aiEnabled?: boolean
    }

    if (Boolean(raw.aiEnabled)) {
      return 'trigger-ai'
    }

    const triggerType = String(raw.trigger || raw.triggerType || 'command')
    if (triggerType === 'text') return 'trigger-text'
    if (triggerType === 'callbackQuery') return 'trigger-callback'
    if (triggerType === 'schedule') return 'trigger-schedule'
    return 'trigger-command'
  }

  if (nodeType === 'message') {
    const raw = data as Partial<MessageNodeData> & { aiEnabled?: boolean }
    return raw.aiEnabled ? 'message-ai' : 'message'
  }

  if (nodeType === 'condition') {
    const raw = data as Partial<ConditionNodeData> & { aiEnabled?: boolean }
    return raw.aiEnabled ? 'condition-ai' : 'condition'
  }

  if (nodeType === 'replyKeyboard') return 'reply-keyboard'
  if (nodeType === 'paymentYookassa') return 'payment-yookassa'
  if (nodeType === 'paymentStripe') return 'payment-stripe'
  if (nodeType === 'paymentRobokassa') return 'payment-robokassa'
  if (nodeType === 'paymentStars') return 'payment-stars'
  if (nodeType === 'wait') return 'scheduler'
  if (nodeType === 'webhook') return 'webhook'

  return nodeType
}
