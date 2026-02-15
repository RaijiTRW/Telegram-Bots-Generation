'use client'

import { usePathname, useRouter } from 'next/navigation'
import { MessageSquare, Workflow, Settings, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EditorSection = 'ai-chat' | 'canvas' | 'settings' | 'system'

interface EditorNavProps {
  botId: string
  activeSection: EditorSection
  onSectionChange: (section: EditorSection) => void
  isDirty?: boolean
}

interface NavItem {
  id: EditorSection
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
}

const navItems: NavItem[] = [
  {
    id: 'canvas',
    icon: Workflow,
    label: 'Canvas',
    description: 'Visual workflow editor',
  },
  {
    id: 'ai-chat',
    icon: MessageSquare,
    label: 'AI Assistant',
    description: 'Chat with AI to build your bot',
  },
  {
    id: 'system',
    icon: Cpu,
    label: 'System',
    description: 'Bot logic and triggers',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    description: 'Configuration and options',
  },
]

export function EditorNav({ botId, activeSection, onSectionChange, isDirty = false }: EditorNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSectionChange = (section: EditorSection) => {
    if (isDirty) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!confirmLeave) return
    }
    onSectionChange(section)
    // Extract locale from pathname (e.g., /ru/dashboard/bots/123/editor -> /ru)
    const locale = pathname.split('/')[1] || 'ru'
    router.push(`/${locale}/dashboard/bots/${botId}/editor/${section}`, { scroll: false })
  }

  return (
    <nav className="w-64 min-h-screen p-4 flex flex-col border-r border-white/10 bg-zinc-950/50 backdrop-blur-xl">
      {/* Header */}
      <div className="mb-6 px-2">
        <h2 className="text-lg font-semibold text-white">Bot Editor</h2>
        {isDirty && (
          <span className="inline-flex items-center mt-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse" />
            <span className="text-xs text-amber-400">Unsaved changes</span>
          </span>
        )}
      </div>

      {/* Navigation items */}
      <div className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-[#24A1DE]/20 to-[#8B5CF6]/10 border border-[#24A1DE]/30 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg transition-colors',
                  isActive ? 'bg-[#24A1DE]/20' : 'bg-white/5 group-hover:bg-white/10'
                )}>
                  <Icon className={cn(
                    'w-4 h-4',
                    isActive ? 'text-[#24A1DE]' : 'text-zinc-400 group-hover:text-white'
                  )} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-0.5">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#24A1DE] shadow-[0_0_8px_rgba(36,161,222,0.5)]" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer info */}
      <div className="pt-4 border-t border-white/10 px-2">
        <div className="text-xs text-zinc-500 text-center">
          Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Cmd+S</kbd> to save
        </div>
      </div>
    </nav>
  )
}
