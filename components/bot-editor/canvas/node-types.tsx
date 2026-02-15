'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import {
  MessageSquare,
  GitBranch,
  Zap,
  Keyboard,
  Webhook,
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
    case 'webhook':
      return `${baseNodeStyles} bg-red-500/10 border-red-500/30`
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
    case 'webhook':
      return <Webhook className={iconClassName} style={{ color: nodeColor }} />
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
    case 'webhook': return '#EF4444'
    default: return '#71717A'
  }
}

// Base Custom Node Component
const CustomNode = ({ data, type, selected }: NodeProps) => {
  const nodeColor = getNodeColor(type || data.type)

  return (
    <div className={`${getNodeStyles(type || data.type)} ${selected ? 'ring-2 ring-white/50' : ''}`}>
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
          {getNodeIcon(type || data.type)}
        </div>
        <div className="text-xs font-medium text-white capitalize truncate">
          {data.__label || data.label || type}
        </div>
      </div>

      {/* Node Content */}
      {(data.__description || data.description) && (
        <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
          {data.__description || data.description}
        </div>
      )}

      {/* Actions */}
      {selected && (
        <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <button
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors"
            onClick={() => data.onDelete?.(data.id)}
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
export const MessageNode = memo((props: NodeProps) => <CustomNode {...props} type="message" />)
export const ConditionNode = memo((props: NodeProps) => <CustomNode {...props} type="condition" />)
export const ActionNode = memo((props: NodeProps) => <CustomNode {...props} type="action" />)
export const InputNode = memo((props: NodeProps) => <CustomNode {...props} type="input" />)
export const WebhookNode = memo((props: NodeProps) => <CustomNode {...props} type="webhook" />)

// Node type mapping for ReactFlow
export const nodeTypes = {
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  input: InputNode,
  webhook: WebhookNode,
}

// Node templates for palette
export const nodeTemplates = [
  {
    type: 'message',
    label: 'Message',
    description: 'Send text, images, or media to user',
    color: '#24A1DE',
    gradient: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    icon: MessageSquare
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch workflow based on conditions',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30',
    icon: GitBranch
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Perform custom actions',
    color: '#8B5CF6',
    gradient: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    icon: Zap
  },
  {
    type: 'input',
    label: 'Input',
    description: 'Request user input or data',
    color: '#10B981',
    gradient: 'from-green-500/20 to-green-600/10',
    border: 'border-green-500/30',
    icon: Keyboard
  },
  {
    type: 'webhook',
    label: 'Webhook',
    description: 'Call external APIs or services',
    color: '#EF4444',
    gradient: 'from-red-500/20 to-red-600/10',
    border: 'border-red-500/30',
    icon: Webhook
  }
]
