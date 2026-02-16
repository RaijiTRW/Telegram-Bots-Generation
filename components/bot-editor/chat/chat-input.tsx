'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  quickPrompts?: Array<{
    id: string
    label: string
    prompt: string
    icon?: string
  }>
  className?: string
}

export function ChatInput({
  onSendMessage,
  isLoading = false,
  disabled = false,
  placeholder,
  quickPrompts,
  className
}: ChatInputProps) {
  const t = useTranslations('editor.chat')
  const [input, setInput] = useState('')
  const [showQuickPrompts, setShowQuickPrompts] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSend = () => {
    const trimmed = input.trim()
    if (trimmed && !isLoading && !disabled) {
      onSendMessage(trimmed)
      setInput('')
      setShowQuickPrompts(false)
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    if (!isLoading && !disabled) {
      onSendMessage(prompt)
      setShowQuickPrompts(false)
    }
  }

  return (
    <div className={cn("border-t border-white/10 bg-zinc-950/50 backdrop-blur-xl", className)}>
      <div className="p-4">
        {/* Quick Prompts */}
        {quickPrompts && quickPrompts.length > 0 && showQuickPrompts && (
          <div className="mb-3 p-3 rounded-xl bg-zinc-900/50 border border-white/5">
            <p className="text-xs text-zinc-500 mb-2">{t('quickActions')}:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((qp) => (
                <button
                  key={qp.id}
                  onClick={() => handleQuickPrompt(qp.prompt)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm transition-all duration-200",
                    "bg-white/5 border border-white/10 text-zinc-400",
                    "hover:text-white hover:bg-white/10 hover:border-[#24A1DE]/30",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  disabled={isLoading || disabled}
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || t('placeholder')}
              disabled={isLoading || disabled}
              rows={1}
              className={cn(
                "w-full px-4 py-3 rounded-xl resize-none",
                "bg-zinc-900/50 border border-white/10",
                "text-white text-sm placeholder:text-zinc-500",
                "focus:outline-none focus:border-[#24A1DE] focus:ring-1 focus:ring-[#24A1DE]/30",
                "transition-all duration-200",
                "min-h-[44px] max-h-[200px]",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || disabled}
            className={cn(
              "h-11 px-4 rounded-xl",
              "bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6]",
              "hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Footer with Quick Prompts Toggle */}
        <div className="flex items-center justify-center mt-3 gap-4">
          {quickPrompts && quickPrompts.length > 0 && (
            <button
              onClick={() => setShowQuickPrompts(!showQuickPrompts)}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                showQuickPrompts ? "text-[#24A1DE]" : "text-zinc-500 hover:text-zinc-400"
              )}
            >
              <Sparkles className="w-3 h-3" />
              {showQuickPrompts ? 'Hide' : 'Show'} {t('quickActions')}
            </button>
          )}
          <p className="text-xs text-zinc-600">
            {t('enterToSend')}
          </p>
        </div>
      </div>
    </div>
  )
}
