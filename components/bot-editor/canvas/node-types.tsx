'use client'

import { memo } from 'react'
import type { ComponentType } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  MessageSquare,
  GitBranch,
  Zap,
  Keyboard,
  Webhook,
  Globe,
  Play,
  Trash2,
  Settings
} from 'lucide-react'

// Base node styles
const baseNodeStyles = `
  relative px-3 py-2 rounded-lg border
  transition-all duration-200
  hover:shadow-lg
  min-w-[140px] max-w-[200px]
`

const getNodeStyles = (type: string) => {
  switch (type) {
    case 'message':
      return `${baseNodeStyles} bg-blue-500/10 border-blue-500/30`
    case 'condition':
      return `${baseNodeStyles} bg-amber-500/10 border-amber-500/30`
    case 'action':
      return `${baseNodeStyles} bg-purple-500/10 border-purple-500/30`
    case 'input':
      return `${baseNodeStyles} bg-green-500/10 border-green-500/30`
    case 'http':
      return `${baseNodeStyles} bg-rose-500/10 border-rose-500/30`
    case 'webhook':
      return `${baseNodeStyles} bg-red-500/10 border-red-500/30`
    case 'trigger':
      return `${baseNodeStyles} bg-indigo-500/10 border-indigo-500/30`
    default:
      return `${baseNodeStyles} bg-zinc-500/10 border-zinc-500/30`
  }
}

const getNodeIcon = (type: string) => {
  const iconClassName = "w-3.5 h-3.5"
  const nodeColor = getNodeColor(type)

  switch (type) {
    case 'message':
      return <MessageSquare className={iconClassName} style={{ color: nodeColor }} />
    case 'condition':
      return <GitBranch className={iconClassName} style={{ color: nodeColor }} />
    case 'action':
      return <Zap className={iconClassName} style={{ color: nodeColor }} />
    case 'input':
      return <Keyboard className={iconClassName} style={{ color: nodeColor }} />
    case 'http':
      return <Globe className={iconClassName} style={{ color: nodeColor }} />
    case 'webhook':
      return <Webhook className={iconClassName} style={{ color: nodeColor }} />
    case 'trigger':
      return <Play className={iconClassName} style={{ color: nodeColor }} />
    default:
      return <Settings className={iconClassName} style={{ color: nodeColor }} />
  }
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'message': return '#24A1DE'
    case 'condition': return '#F59E0B'
    case 'action': return '#8B5CF6'
    case 'input': return '#10B981'
    case 'http': return '#F43F5E'
    case 'webhook': return '#EF4444'
    case 'trigger': return '#6366F1'
    default: return '#71717A'
  }
}

const getTriggerNodeLabel = (data: Record<string, unknown>): string => {
  const triggerType = String(data.trigger || 'command')

  switch (triggerType) {
    case 'callbackQuery':
      return 'Callback Trigger'
    case 'text':
      return 'Text Trigger'
    case 'photo':
      return 'Photo Trigger'
    case 'any':
      return 'Any Trigger'
    case 'command':
    default:
      return 'Command Trigger'
  }
}

const getTriggerNodeDescription = (data: Record<string, unknown>): string => {
  const triggerType = String(data.trigger || 'command')
  const pattern = String(data.pattern || '').trim()

  switch (triggerType) {
    case 'callbackQuery':
      return pattern ? `Callback: ${pattern}` : 'Starts on any callback'
    case 'text':
      return pattern ? `Matches text: ${pattern}` : 'Matches incoming text'
    case 'photo':
      return 'Starts on photo'
    case 'any':
      return 'Starts on any update'
    case 'command':
    default:
      return `Starts on ${pattern || '/start'}`
  }
}

// Base Custom Node Component
const CustomNode = ({ id, data, type, selected }: NodeProps) => {
  const nodeColor = getNodeColor(type || data.type)
  const normalizedType = type || data.type
  const triggerData =
    normalizedType === 'trigger' ? (data as Record<string, unknown>) : null

  const nodeLabel =
    normalizedType === 'trigger' && triggerData
      ? getTriggerNodeLabel(triggerData)
      : data.__label || data.label || normalizedType
  const nodeDescription =
    normalizedType === 'trigger' && triggerData
      ? getTriggerNodeDescription(triggerData)
      : data.__description || data.description

  return (
    <div className={`${getNodeStyles(normalizedType)} ${selected ? 'ring-2 ring-white/50' : ''}`}>
      {/* Input Handle */}
      {type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !border-2 !border-white/20 !bg-transparent"
          style={{ background: 'transparent' }}
        />
      )}

      {/* Node Header */}
      <div className="flex items-center gap-1.5">
        <div
          className="p-1 rounded"
          style={{ backgroundColor: `${nodeColor}33` }}
        >
          {getNodeIcon(normalizedType)}
        </div>
        <div className="text-xs font-medium text-white capitalize truncate">
          {nodeLabel}
        </div>
      </div>

      {/* Node Content */}
      {nodeDescription && (
        <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
          {nodeDescription}
        </div>
      )}

      {/* Actions */}
      {selected && (
        <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <button
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors"
            onClick={() => data.onDelete?.(id)}
          >
            <Trash2 className="w-2.5 h-2.5 text-red-400" />
          </button>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={true}
        className="!w-2 !h-2 !border-2 !border-white/20"
        style={{ background: 'transparent' }}
      />

      {/* Extra output for condition nodes */}
      {type === 'condition' && (
        <Handle
          type="source"
          position={Position.Right}
          id="false"
          className="!w-2 !h-2 !border-2 !border-white/20"
          style={{ background: 'transparent', top: '60%' }}
        />
      )}
    </div>
  )
}

// Memoized node components for each type
const MessageNodeComponent = (props: NodeProps) => <CustomNode {...props} type="message" />
const ConditionNodeComponent = (props: NodeProps) => <CustomNode {...props} type="condition" />
const ActionNodeComponent = (props: NodeProps) => <CustomNode {...props} type="action" />
const InputNodeComponent = (props: NodeProps) => <CustomNode {...props} type="input" />
const HttpNodeComponent = (props: NodeProps) => <CustomNode {...props} type="http" />
const WebhookNodeComponent = (props: NodeProps) => <CustomNode {...props} type="webhook" />
const TriggerNodeComponent = (props: NodeProps) => <CustomNode {...props} type="trigger" />

MessageNodeComponent.displayName = 'MessageNodeComponent'
ConditionNodeComponent.displayName = 'ConditionNodeComponent'
ActionNodeComponent.displayName = 'ActionNodeComponent'
InputNodeComponent.displayName = 'InputNodeComponent'
HttpNodeComponent.displayName = 'HttpNodeComponent'
WebhookNodeComponent.displayName = 'WebhookNodeComponent'
TriggerNodeComponent.displayName = 'TriggerNodeComponent'

export const MessageNode = memo(MessageNodeComponent)
export const ConditionNode = memo(ConditionNodeComponent)
export const ActionNode = memo(ActionNodeComponent)
export const InputNode = memo(InputNodeComponent)
export const HttpNode = memo(HttpNodeComponent)
export const WebhookNode = memo(WebhookNodeComponent)
export const TriggerNode = memo(TriggerNodeComponent)

// Node type mapping for ReactFlow
export const nodeTypes = {
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  input: InputNode,
  http: HttpNode,
  webhook: WebhookNode,
  trigger: TriggerNode,
}

export interface NodeTemplate {
  id: string
  type: string
  label: string
  description: string
  color: string
  gradient: string
  border: string
  icon: ComponentType<{ className?: string }>
  data?: Record<string, unknown>
}

// Node templates for palette
export const nodeTemplates: NodeTemplate[] = [
  {
    id: 'trigger-command',
    type: 'trigger',
    label: 'Command Trigger',
    description: 'Start workflow when user sends command',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'command',
      pattern: '/start',
      __label: 'Command Trigger',
      __description: 'Starts on command',
    },
  },
  {
    id: 'trigger-callback',
    type: 'trigger',
    label: 'Callback Trigger',
    description: 'Start workflow from inline button click',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'callbackQuery',
      pattern: '',
      __label: 'Callback Trigger',
      __description: 'Starts on callback query',
    },
  },
  {
    id: 'message',
    type: 'message',
    label: 'Message',
    description: 'Send text, images, or media to user',
    color: '#24A1DE',
    gradient: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    icon: MessageSquare
  },
  {
    id: 'condition',
    type: 'condition',
    label: 'Condition',
    description: 'Branch workflow based on conditions',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30',
    icon: GitBranch
  },
  {
    id: 'action',
    type: 'action',
    label: 'Action',
    description: 'Perform custom actions',
    color: '#8B5CF6',
    gradient: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    icon: Zap
  },
  {
    id: 'input',
    type: 'input',
    label: 'Input',
    description: 'Request user input or data',
    color: '#10B981',
    gradient: 'from-green-500/20 to-green-600/10',
    border: 'border-green-500/30',
    icon: Keyboard
  },
  {
    id: 'http',
    type: 'http',
    label: 'HTTP',
    description: 'Make HTTP requests to external APIs',
    color: '#F43F5E',
    gradient: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/30',
    icon: Globe,
  },
  // Legacy 'webhook' node type is still supported in runtime/config,
  // but hidden from palette in favor of the dedicated HTTP node.
]
