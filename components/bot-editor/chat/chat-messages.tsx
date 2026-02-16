'use client'

import { memo, RefObject } from 'react'
import { Sparkles, User, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from './types'
import type { Node } from '@/lib/bot-editor/types/bot.types'

interface ChatMessagesProps {
  messages: ChatMessage[]
  isLoading?: boolean
  className?: string
  containerRef?: RefObject<HTMLDivElement | null>
}

interface MessageBubbleProps {
  message: ChatMessage
  isLast?: boolean
}

const NodePreview = ({ nodes }: { nodes: Node[] }) => {
  if (!nodes || nodes.length === 0) return null

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'message': return 'from-blue-500/20 to-blue-600/10 border-blue-500/30'
      case 'condition': return 'from-amber-500/20 to-amber-600/10 border-amber-500/30'
      case 'action': return 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
      case 'input': return 'from-green-500/20 to-green-600/10 border-green-500/30'
      case 'http': return 'from-rose-500/20 to-rose-600/10 border-rose-500/30'
      case 'webhook': return 'from-red-500/20 to-red-600/10 border-red-500/30'
      default: return 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30'
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        <span className="text-xs text-zinc-400">Added {nodes.length} node{nodes.length > 1 ? 's' : ''} to canvas</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              "px-2 py-1 rounded-md border text-xs capitalize",
              "bg-gradient-to-br",
              getNodeColor(node.type)
            )}
          >
            {(node.data as any)?._label || (node.data as any)?.label || node.type}
          </div>
        ))}
      </div>
    </div>
  )
}

const UserMessage = ({ message, isLast }: MessageBubbleProps) => (
  <div className="flex justify-end gap-3 max-w-2xl ml-auto">
    <div className="flex-1 flex flex-col items-end">
      <div className="rounded-2xl rounded-tr-none bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30 p-4 max-w-full">
        <p className="text-white text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
      <span className="text-xs text-zinc-500 mt-1">
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
      <User className="w-4 h-4 text-white" />
    </div>
  </div>
)

const AssistantMessage = ({ message, isLast }: MessageBubbleProps) => (
  <div className="flex gap-3 max-w-2xl">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
      <Sparkles className="w-4 h-4 text-white" />
    </div>
    <div className="flex-1">
      <div className="rounded-2xl rounded-tl-none bg-zinc-900/80 border border-white/10 p-4">
        {message.isTyping ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
          </div>
        ) : (
          <>
            <p className="text-white text-sm whitespace-pre-wrap">{message.content}</p>
            {message.generatedNodes && message.generatedNodes.length > 0 && (
              <NodePreview nodes={message.generatedNodes} />
            )}
          </>
        )}
      </div>
      {!message.isTyping && (
        <span className="text-xs text-zinc-500 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  </div>
)

const SystemMessage = ({ message }: MessageBubbleProps) => (
  <div className="flex justify-center">
    <div className="px-4 py-2 rounded-full bg-zinc-900/50 border border-white/5">
      <p className="text-xs text-zinc-500">{message.content}</p>
    </div>
  </div>
)

const MessageBubble = memo(({ message, isLast }: MessageBubbleProps) => {
  switch (message.role) {
    case 'user':
      return <UserMessage message={message} isLast={isLast} />
    case 'assistant':
      return <AssistantMessage message={message} isLast={isLast} />
    case 'system':
      return <SystemMessage message={message} />
    default:
      return null
  }
})

MessageBubble.displayName = 'MessageBubble'

export const ChatMessages = memo(({ messages, isLoading, className, containerRef }: ChatMessagesProps) => {
  return (
    <div ref={containerRef} className={cn("flex-1 overflow-y-auto p-6 space-y-4", className)}>
      {messages.length === 0 ? (
        <div className="flex gap-3 max-w-2xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="rounded-2xl rounded-tl-none bg-zinc-900/80 border border-white/10 p-4">
              <p className="text-white text-sm">
                Hello! I'm your AI assistant for building Telegram bots. I can help you:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-[#24A1DE]">•</span>
                  <span>Create conversational flows and message handlers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#24A1DE]">•</span>
                  <span>Add conditions, actions, and HTTP requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#24A1DE]">•</span>
                  <span>Set up variables and data storage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#24A1DE]">•</span>
                  <span>Explain and debug existing bot logic</span>
                </li>
              </ul>
              <p className="mt-3 text-sm text-zinc-400">
                What would you like to build today?
              </p>
            </div>
          </div>
        </div>
      ) : (
        messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
          />
        ))
      )}

      {isLoading && (
        <div className="flex gap-3 max-w-2xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="rounded-2xl rounded-tl-none bg-zinc-900/80 border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#8B5CF6] animate-spin" />
                <span className="text-sm text-zinc-400">AI is thinking...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

ChatMessages.displayName = 'ChatMessages'
