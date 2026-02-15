/**
 * AI Chat Type Definitions
 * Phase 3: AI Chat Implementation
 */

import type { Node } from '@/lib/bot-editor/types/bot.types'

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  timestamp: Date
  isTyping?: boolean
  generatedNodes?: Node[]
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
