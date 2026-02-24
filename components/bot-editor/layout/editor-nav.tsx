'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare, Workflow, Settings, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export type EditorSection = 'ai-chat' | 'canvas' | 'settings' | 'system'

interface EditorNavProps {
  botId: string
  activeSection: EditorSection
  onSectionChange: (section: EditorSection) => void
  isDirty?: boolean
  mode?: 'full' | 'compact'
  className?: string
}

interface NavItem {
  id: EditorSection
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
  descKey: string
}

const staticNavItems: Omit<NavItem, 'labelKey' | 'descKey'>[] = [
  {
    id: 'canvas',
    icon: Workflow,
  },
  {
    id: 'ai-chat',
    icon: MessageSquare,
  },
  {
    id: 'system',
    icon: Cpu,
  },
  {
    id: 'settings',
    icon: Settings,
  },
]

export function EditorNav({
  botId,
  activeSection,
  onSectionChange,
  isDirty = false,
  mode = 'full',
  className,
}: EditorNavProps) {
  const t = useTranslations('editor.nav')
  const router = useRouter()
  const pathname = usePathname()
  const isCompact = mode === 'compact'
  type NavTranslationKey = Parameters<typeof t>[0]

  const navItems = useMemo(() => {
    return staticNavItems.map((item) => {
      let labelKey = ''
      let descKey = ''

      switch (item.id) {
        case 'canvas':
          labelKey = 'canvas'
          descKey = 'canvasDesc'
          break
        case 'ai-chat':
          labelKey = 'aiAssistant'
          descKey = 'aiAssistantDesc'
          break
        case 'system':
          labelKey = 'system'
          descKey = 'systemDesc'
          break
        case 'settings':
          labelKey = 'settings'
          descKey = 'settingsDesc'
          break
      }

      return {
        ...item,
        labelKey,
        descKey,
      }
    })
  }, [])

  const handleSectionChange = (section: EditorSection) => {
    onSectionChange(section)
    // Extract locale from pathname (e.g., /ru/dashboard/bots/123/editor -> /ru)
    const locale = pathname.split('/')[1] || 'ru'
    router.push(`/${locale}/dashboard/bots/${botId}/editor/${section}`, { scroll: false })
  }

  return (
    <nav
      className={cn(
        'h-full min-h-0 p-4 flex flex-col bg-zinc-950/50 backdrop-blur-xl',
        isCompact ? 'items-center px-2' : 'px-4',
        className
      )}
    >
      {/* Header */}
      <div className={cn('mb-6', isCompact ? 'w-full px-0' : 'px-2')}>
        {isCompact ? (
          <div className="w-full flex items-center justify-center">
            <div
              className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white"
              title={t('botEditor')}
            >
              <Workflow className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-semibold text-white">{t('botEditor')}</h2>
        )}
        {isDirty && (
          isCompact ? (
            <div className="mt-2 flex items-center justify-center">
              <span
                className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-md bg-amber-500/10 border border-amber-500/20"
                title={t('unsavedChanges')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center mt-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse" />
              <span className="text-xs text-amber-400">{t('unsavedChanges')}</span>
            </span>
          )
        )}
      </div>

      {/* Navigation items */}
      <div className={cn('flex-1 space-y-1 w-full', isCompact ? 'px-0' : 'px-2')}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          const label = t(item.labelKey as NavTranslationKey)
          const description = t(item.descKey as NavTranslationKey)

          return (
            <button
              key={item.id}
              onClick={() => handleSectionChange(item.id)}
              title={isCompact ? label : undefined}
              className={cn(
                'w-full text-left rounded-xl transition-all duration-200 group border relative',
                isCompact ? 'px-2 py-2.5' : 'px-4 py-3',
                isActive
                  ? 'bg-gradient-to-r from-[#24A1DE]/20 to-[#8B5CF6]/10 border-[#24A1DE]/30 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
              )}
            >
              <div className={cn('flex items-center', isCompact ? 'justify-center' : 'gap-3')}>
                <div className={cn(
                  'p-2 rounded-lg transition-colors',
                  isActive ? 'bg-[#24A1DE]/20' : 'bg-white/5 group-hover:bg-white/10'
                )}>
                  <Icon className={cn(
                    'w-4 h-4',
                    isActive ? 'text-[#24A1DE]' : 'text-zinc-400 group-hover:text-white'
                  )} />
                </div>
                {!isCompact && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-zinc-500 group-hover:text-zinc-400 mt-0.5">
                      {description}
                    </div>
                  </div>
                )}
                {isActive && (
                  <div
                    className={cn(
                      'rounded-full bg-[#24A1DE] shadow-[0_0_8px_rgba(36,161,222,0.5)]',
                      isCompact ? 'absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5' : 'w-1.5 h-1.5'
                    )}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer info */}
      {!isCompact ? (
        <div className="pt-4 border-t border-white/10 px-2">
          <div className="text-xs text-zinc-500 text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Cmd+S</kbd> {t('toSave')}
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-white/10 w-full flex items-center justify-center">
          <kbd
            className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 text-[10px]"
            title={`Cmd+S ${t('toSave')}`}
          >
            ⌘S
          </kbd>
        </div>
      )}
    </nav>
  )
}
