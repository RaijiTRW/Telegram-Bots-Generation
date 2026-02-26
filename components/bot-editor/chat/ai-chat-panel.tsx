'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MessageSquare, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import type { ChatMessage } from './types'
import { mockAIResponse, QUICK_PROMPTS } from '@/lib/bot-editor/services/mock-ai-service'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'

interface AiChatPanelProps {
  onClose?: () => void
  className?: string
}

export function AiChatPanel({ onClose, className }: AiChatPanelProps) {
  const tChat = useTranslations('editor.chat')
  const tNav = useTranslations('editor.nav')
  const { config, setConfig } = useBotState()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll only inside chat container to avoid page jump
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  const createMessage = useCallback((
    role: ChatMessage['role'],
    content: string,
    generatedNodes?: ChatMessage['generatedNodes']
  ): ChatMessage => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    role,
    content,
    timestamp: new Date(),
    generatedNodes
  }), [])

  const handleSendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage = createMessage('user', content)
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Get AI response
      const response = await mockAIResponse(content)

      // Create assistant message with generated nodes
      const assistantMessage = createMessage(
        'assistant',
        response.message,
        response.nodes
      )

      setMessages(prev => [...prev, assistantMessage])

      // Add generated nodes to the canvas config
      if (response.nodes && response.nodes.length > 0) {
        const newNodes = [...config.nodes]
        const newEdges = [...config.edges]

        response.nodes.forEach((node, index) => {
          // Offset new nodes to avoid overlapping with existing ones
          const existingNodesInRow = newNodes.filter(n => Math.abs(n.position.y - node.position.y) < 50)
          const offsetX = existingNodesInRow.length * 250

          newNodes.push({
            ...node,
            position: { x: node.position.x + offsetX, y: node.position.y }
          })

          // Create edges between consecutive nodes
          if (index > 0) {
            const prevNode = response.nodes[index - 1]
            newEdges.push({
              id: `edge-${prevNode.id}-${node.id}`,
              source: prevNode.id,
              target: node.id
            })
          }
        })

        // Update config with new nodes and edges
        setConfig({
          ...config,
          nodes: newNodes,
          edges: newEdges
        })
      }

      // Add suggestions as system message if available
      if (response.suggestions && response.suggestions.length > 0) {
        const suggestionMessage = createMessage(
          'system',
          `${tChat('suggestionsPrefix')}: ${response.suggestions.map((s, i) => `${i + 1}. ${s}`).join(' | ')}`
        )
        setMessages(prev => [...prev, suggestionMessage])
      }
    } catch {
      // Add error message
      const errorMessage = createMessage(
        'assistant',
        tChat('errorFallback')
      )
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [createMessage, config, setConfig, tChat])

  return (
    <div className={cn("h-full flex flex-col bg-[#05070A]", className)}>
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="text-white font-semibold">{tNav('aiAssistant')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{tChat('panelSubtitle')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#8B5CF6]/10 border border-[#8B5CF6]/30">
            <Sparkles className="w-3 h-3 text-[#8B5CF6]" />
            <span className="text-xs text-[#8B5CF6]">{tChat('poweredByAI')}</span>
          </span>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            containerRef={messagesContainerRef}
          />
        </div>

        {/* Input area */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          quickPrompts={messages.length === 0 ? QUICK_PROMPTS : undefined}
        />
      </div>
    </div>
  )
}
