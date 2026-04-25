/**
 * AI Chat Type Definitions
 * Phase 3: AI Chat Implementation
 */

import type { Node } from '@/lib/bot-editor/types/bot.types'
import type {
  AiAgentClarificationRequest,
  AiAgentLivePreview,
  AiAgentRunSnapshot,
} from '@/lib/bot-editor/types/bot.types'

export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatAttachmentKind = 'image' | 'file'

export interface ChatAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  path: string
  kind: ChatAttachmentKind
  previewUrl?: string
}

export interface ChatModelOption {
  id: string
  label: string
  locked?: boolean
  badge?: 'recommended' | 'soon'
}

export interface ChatSendPayload {
  content: string
  model: string
  attachments: ChatAttachment[]
}

export type ChatClarificationRequest = AiAgentClarificationRequest

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  timestamp: Date
  isTyping?: boolean
  model?: string
  avatarUrl?: string | null
  attachments?: ChatAttachment[]
  generatedNodes?: Node[]
  renderMode?: 'plain' | 'agent-run'
  clarification?: ChatClarificationRequest | null
  agentRun?: AiAgentRunSnapshot & {
    streamingPreview?: AiAgentLivePreview | null
  }
}

export interface QuickPrompt {
  id: string
  label: string
  prompt: string
  icon?: string
}

export interface AIResponse {
  message: string
  nodes: Node[]
  suggestions?: string[]
}

export interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
}

// Mock AI generation result
export interface GeneratedFlow {
  nodes: Node[]
  explanation: string
  suggestions: string[]
}
