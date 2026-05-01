/**
 * Bot Editor Type Definitions
 * Phase 1: Foundation
 */

import type { NodeData } from './component-schemas'

export type BotStatus = 'draft' | 'active' | 'archived' | 'error'

export type QuickStartTemplateId = 'lead-gen' | 'faq' | 'booking' | 'services'
export type QuickStartMode = 'template' | 'ai'

export type QuickStartStatus = 'draft' | 'completed' | 'skipped'

export type AiAgentRunStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AiAgentRunMode = 'build' | 'respond'

export type AiChatMessageRole = 'user' | 'assistant' | 'system'

export interface AiChatStoredMessage {
  id: string
  runId?: string
  role: AiChatMessageRole
  content: string
  createdAt: string
  model?: string
  attachments?: AiAgentAttachment[]
  renderMode?: 'plain' | 'agent-run'
  agentRun?: AiAgentRunSnapshot
}

export interface AiChatThreadSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface AiChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  summary?: string
  summarizedMessageCount?: number
  messages: AiChatStoredMessage[]
}

export interface AiChatState {
  activeChatId: string | null
  chats: AiChatThread[]
}

export interface AiAgentAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  path: string
  kind: 'image' | 'file'
}

export interface AiAgentClarificationOption {
  label: string
  description: string
  recommended?: boolean
}

export interface AiAgentClarificationQuestion {
  id: string
  header: string
  question: string
  options: AiAgentClarificationOption[]
}

export interface AiAgentClarificationRequest {
  id: string
  thought: string
  questions: AiAgentClarificationQuestion[]
}

export interface AiAgentClarificationAnswer {
  questionId: string
  question: string
  answer: string
}

export interface AiAgentPendingClarification {
  id: string
  runId: string
  prompt: string
  model?: string
  locale?: string
  chatId?: string | null
  attachments: AiAgentAttachment[]
  request: AiAgentClarificationRequest
  answers: AiAgentClarificationAnswer[]
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface AiAgentTaskItem {
  id: string
  text: string
  completedAt: string
}

export interface AiAgentLivePreview {
  runId: string
  mode: AiAgentRunMode
  updatedAt: string
  rawText: string
  plan?: string[]
  currentAction?: string
  completedTasksDelta?: string[]
  analysis?: string
  nextAction?: string
  summary?: string
  responseText?: string
}

export type AiAgentOperation =
  | {
      type: 'addNode'
      nodeKey: string
      nodeType: NodeType
      data?: Record<string, unknown>
    }
  | {
      type: 'updateNode'
      nodeRef: string
      data?: Record<string, unknown>
    }
  | {
      type: 'deleteNode'
      nodeRef: string
    }
  | {
      type: 'connectNodes'
      sourceRef: string
      targetRef: string
      sourceHandle?: string | null
      label?: string
    }
  | {
      type: 'disconnectEdge'
      sourceRef: string
      targetRef: string
      sourceHandle?: string | null
    }
  | {
      type: 'moveNode'
      nodeRef: string
      x: number
      y: number
    }
  | {
      type: 'upsertVariables'
      variables: Array<
        Pick<BotVariable, 'name' | 'type' | 'default_value' | 'description' | 'scope'> & {
          id?: string
        }
      >
    }
  | {
      type: 'updateBotSettings'
      name?: string
      description?: string
      status?: BotStatus
      webhookUrl?: string
      profileStyle?: Record<string, unknown>
    }
  | {
      type: 'updateSystemFeatures'
      features: Record<string, unknown>
    }
  | {
      type: 'finishRun'
      summary?: string
    }

export interface AiAgentCommandEnvelope {
  plan?: string[]
  currentAction: string
  completedTasksDelta?: string[]
  analysis?: string
  nextAction?: string
  operations: AiAgentOperation[]
  done: boolean
  summary?: string
}

export interface NodeCapabilityCatalogEntry {
  nodeType: NodeType
  label: string
  description: string
  category: string
  purpose: string
  requiredDataFields: string[]
  optionalDataFields: string[]
  allowedSourceHandles: string[]
  connectionRules: string[]
  runtimeBehavior: string
  exampleData: Record<string, unknown>
}

export interface AiAgentRunSnapshot {
  runId: string
  chatId?: string
  status: AiAgentRunStatus
  mode?: AiAgentRunMode
  model: string
  startedAt: string
  updatedAt: string
  currentAction: string
  nextAction?: string
  completedTasks: AiAgentTaskItem[]
  analysis?: string
  error?: string
  locked: boolean
  prompt?: string
  attachments?: AiAgentAttachment[]
  summary?: string
  responseText?: string
  plan?: string[]
  stepCount?: number
  noChangesRequired?: boolean
}

export type AllowedQuickStartAiNodeType =
  | 'trigger'
  | 'message'
  | 'input'
  | 'condition'
  | 'router'
  | 'action'
  | 'setVariable'
  | 'replyKeyboard'
  | 'wait'
  | 'scheduler'
  | 'http'
  | 'comment'

export interface QuickStartAiAnswers {
  businessName: string
  businessDescription: string
  primaryGoal: string
  targetAudience: string
  requiredSections: string
  leadCaptureFields: string
  offerings: string
  faq: string
  contactDetails: string
  tone: string
  extraInstructions: string
}

export interface QuickStartLastGeneration {
  provider: 'openrouter'
  model: string
  generatedAt: string
}

export interface QuickStartAiGraphNodeDraft {
  id: string
  type: AllowedQuickStartAiNodeType
  data: Record<string, unknown>
}

export interface QuickStartAiGraphEdgeDraft {
  source: string
  target: string
  sourceHandle?: string | null
  label?: string
}

export interface QuickStartAiGraphSummaryDraft {
  title?: string
  description?: string
  highlights?: string[]
}

export interface QuickStartAiGraphDraft {
  nodes: QuickStartAiGraphNodeDraft[]
  edges: QuickStartAiGraphEdgeDraft[]
  variables?: BotVariable[]
  summary?: QuickStartAiGraphSummaryDraft
}

export interface QuickStartTemplateDraft {
  mode?: 'template'
  status: QuickStartStatus
  templateId: QuickStartTemplateId | null
  answers: Record<string, unknown>
  generatorVersion: 'v1'
  completedAt?: string
}

export interface QuickStartAiDraft {
  mode: 'ai'
  status: QuickStartStatus
  answers: QuickStartAiAnswers
  generatorVersion: 'v2'
  completedAt?: string
  lastGeneration?: QuickStartLastGeneration
}

export type QuickStartDraft = QuickStartTemplateDraft | QuickStartAiDraft

export type EditorSection = 'ai-chat' | 'ai-agents' | 'canvas' | 'settings' | 'system' | 'statistics'

export type NodeType =
  | 'message'
  | 'input'
  | 'condition'
  | 'router'
  | 'scheduler'
  | 'replyKeyboard'
  | 'script'
  | 'action'
  | 'setVariable'
  | 'http'
  | 'webhook'
  | 'paymentYookassa'
  | 'paymentStripe'
  | 'paymentRobokassa'
  | 'paymentStars'
  | 'trigger'
  | 'wait'
  | 'comment'

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
  fastStart?: QuickStartDraft
  aiChat?: AiChatState
  aiAgent?: {
    currentRun?: AiAgentRunSnapshot | null
    pendingClarification?: AiAgentPendingClarification | null
  }
  [key: string]: unknown
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
  data: NodeData | Record<string, unknown>
}

export interface Edge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null // 'true' | 'false' for condition nodes
  targetHandle?: string | null
  label?: string
  data?: Record<string, unknown>
  animated?: boolean
  type?: string
}

export interface BotVariable {
  id: string
  name: string
  type: VariableType
  default_value: unknown
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
  variables: Record<string, unknown>
  history: SessionHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface SessionHistoryEntry {
  nodeId: string
  timestamp: string
  data?: Record<string, unknown>
}
