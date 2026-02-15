/**
 * Bot Editor Type Definitions
 * Phase 1: Foundation
 */

import type { NodeData } from './component-schemas'

export type BotStatus = 'draft' | 'active' | 'archived' | 'error'

export type EditorSection = 'ai-chat' | 'canvas' | 'settings' | 'system'

export type NodeType = 'message' | 'input' | 'condition' | 'action' | 'webhook' | 'trigger' | 'wait' | 'comment'

export interface Bot {
  id: string
  name: string
  description: string | null
  status: BotStatus
  config: BotConfig
  metadata?: BotMetadata
  createdAt?: string
  updatedAt?: string
}

export interface BotMetadata {
  telegramToken?: string
  webhookUrl?: string
  botUsername?: string
  [key: string]: any
}

export interface BotConfig {
  nodes: Node[]
  edges: Edge[]
  variables: BotVariable[]
  version?: string
}

export interface Node {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: any // Using any to support mock data and runtime flexibility
}

export interface Edge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null // 'true' | 'false' for condition nodes
  targetHandle?: string | null
  label?: string
  data?: Record<string, any>
  animated?: boolean
  type?: string
}

export interface BotVariable {
  id: string
  name: string
  type: VariableType
  default_value: any
  description?: string
  scope?: 'global' | 'user' | 'chat' | 'temporary'
}

export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'user' | 'message' | 'date'

export interface BotState {
  bot: Bot | null
  config: BotConfig
  activeSection: EditorSection
  isDirty: boolean
  isLoading: boolean
  error: string | null
  selectedNodeId: string | null
}

// Workflow execution state
export interface WorkflowSession {
  id: string
  userId: number
  chatId: number
  currentNodeId: string
  variables: Record<string, any>
  history: SessionHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface SessionHistoryEntry {
  nodeId: string
  timestamp: string
  data?: Record<string, any>
}
