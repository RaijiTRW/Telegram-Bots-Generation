'use client'

import { startTransition, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BarChart3, Bot, Cpu, Loader2, Settings, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorSection as EditorSectionType } from '@/lib/bot-editor/types/bot.types'
import type { ViewerAccess } from '@/lib/billing/types'
import { preloadEditorSection } from './editor-section-viewport'
import { prefetchHrefOnce, schedulePrefetchHref } from '@/lib/navigation/prefetch'
import { AiSectionIcon } from '@/components/bot-editor/chat/ai-section-icon'

export type EditorSection = EditorSectionType

interface EditorNavProps {
  botId: string
  viewerAccess: ViewerAccess
  activeSection: EditorSection
  onSectionChange: (section: EditorSection) => void
  isDirty?: boolean
  isAiAssistantWorking?: boolean
  mode?: 'full' | 'compact'
  className?: string
}

interface NavItem {
  id: EditorSection
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
  descKey: string
  disabled?: boolean
  badgeKey?: string
}

const staticNavItems: Omit<NavItem, 'labelKey' | 'descKey'>[] = [
  {
    id: 'ai-chat',
    icon: AiSectionIcon,
  },
  {
    id: 'ai-agents',
    icon: Bot,
  },
  {
    id: 'canvas',
    icon: Workflow,
  },
  {
    id: 'system',
    icon: Cpu,
  },
  {
    id: 'statistics',
    icon: BarChart3,
  },
  {
    id: 'settings',
    icon: Settings,
  },
]

const buildSectionHref = (locale: string, botId: string, section: EditorSection) =>
  `/${locale}/dashboard/bots/${botId}/editor/${section}`

export function EditorNav({
  botId,
  viewerAccess,
  activeSection,
  onSectionChange,
  isDirty = false,
  isAiAssistantWorking = false,
  mode = 'full',
  className,
}: EditorNavProps) {
  const t = useTranslations('editor.nav')
  const locale = useLocale()
  const router = useRouter()
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
        case 'ai-agents':
          labelKey = 'aiAgents'
          descKey = 'aiAgentsDesc'
          break
        case 'ai-chat':
          labelKey = 'aiAssistant'
          descKey = 'aiAssistantDesc'
          break
        case 'system':
          labelKey = 'system'
          descKey = 'systemDesc'
          break
        case 'statistics':
          labelKey = 'statistics'
          descKey = 'statisticsDesc'
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
        disabled: item.id === 'ai-agents' ? !viewerAccess.isAdmin : false,
        badgeKey: item.id === 'ai-agents' && !viewerAccess.isAdmin ? 'soonBadge' : undefined,
      }
    })
  }, [viewerAccess.isAdmin])

  const sectionHrefs = useMemo<Record<EditorSection, string>>(
    () => ({
      'ai-chat': buildSectionHref(locale, botId, 'ai-chat'),
      'ai-agents': buildSectionHref(locale, botId, 'ai-agents'),
      canvas: buildSectionHref(locale, botId, 'canvas'),
      system: buildSectionHref(locale, botId, 'system'),
      statistics: buildSectionHref(locale, botId, 'statistics'),
      settings: buildSectionHref(locale, botId, 'settings'),
    }),
    [botId, locale]
  )

  useEffect(() => {
    for (const item of navItems) {
      if (item.disabled) {
        continue
      }
      schedulePrefetchHref(router, sectionHrefs[item.id], item.id === activeSection ? 180 : 420)
      void preloadEditorSection(item.id)
    }
  }, [activeSection, navItems, router, sectionHrefs])

  const prefetchSection = (section: EditorSection) => {
    prefetchHrefOnce(router, sectionHrefs[section])
    void preloadEditorSection(section)
  }

  const handleSectionChange = (section: EditorSection) => {
    onSectionChange(section)
    const targetHref = sectionHrefs[section]
    prefetchSection(section)
    startTransition(() => {
      router.push(targetHref, { scroll: false })
    })
  }

  return (
    <nav
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-zinc-950/50 p-4 backdrop-blur-xl',
        isCompact ? 'items-center px-2' : 'px-4',
        className
      )}
    >
      {/* Header */}
      <div className={cn('mb-6 shrink-0', isCompact ? 'w-full px-0' : 'px-2')}>
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
      <div
        className={cn(
          'flex-1 min-h-0 w-full space-y-1 overflow-y-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5',
          isCompact ? 'px-0' : 'px-2 pr-1'
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          const isDisabled = Boolean(item.disabled)
          const label = t(item.labelKey as NavTranslationKey)
          const description = t(item.descKey as NavTranslationKey)
          const isAiAssistantItemWorking = item.id === 'ai-chat' && isAiAssistantWorking
          const disabledHint = isDisabled
            ? item.id === 'ai-agents'
              ? t('aiAgentsLocked')
              : t('subscriptionRequired')
            : undefined

          return (
            <button
              key={item.id}
              disabled={isDisabled}
              onClick={() => handleSectionChange(item.id)}
              onMouseEnter={() => prefetchSection(item.id)}
              onFocus={() => prefetchSection(item.id)}
              title={isCompact ? (disabledHint ? `${label}: ${disabledHint}` : label) : disabledHint}
              className={cn(
                'w-full text-left rounded-xl transition-all duration-200 group border relative',
                isCompact ? 'px-2 py-2.5' : 'px-4 py-3',
                isDisabled
                  ? 'cursor-not-allowed text-zinc-500 border-transparent opacity-75'
                  : isActive
                  ? 'bg-gradient-to-r from-[#24A1DE]/28 via-[#24A1DE]/12 to-[#8B5CF6]/18 border-[#24A1DE]/45 text-white shadow-[inset_0_0_0_1px_rgba(36,161,222,0.14),0_8px_20px_rgba(36,161,222,0.10)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
              )}
            >
              {isActive && (
                <div
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#24A1DE] to-[#8B5CF6] opacity-80',
                    isCompact ? 'left-1.5 h-6 w-[3px]' : 'left-1.5 h-8 w-[3px]'
                  )}
                />
              )}
              <div className={cn('flex items-center', isCompact ? 'justify-center' : 'gap-3')}>
                <div className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDisabled
                    ? 'bg-white/5'
                    : isActive
                    ? 'bg-[#24A1DE]/24 ring-1 ring-[#24A1DE]/35 shadow-[0_0_12px_rgba(36,161,222,0.18)]'
                    : 'bg-white/5 group-hover:bg-white/10'
                )}>
                  <Icon className={cn(
                    'w-4 h-4',
                    isDisabled
                      ? 'text-zinc-500'
                      : isActive
                      ? 'text-[#24A1DE]'
                      : 'text-zinc-400 group-hover:text-white'
                  )} />
                </div>
                {!isCompact && (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="line-clamp-2 text-sm font-medium leading-5">{label}</div>
                      {isAiAssistantItemWorking ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#24A1DE]/25 bg-[#24A1DE]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8ED8FF]">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('workingBadge' as NavTranslationKey)}
                        </span>
                      ) : null}
                      {item.badgeKey && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
                          {t(item.badgeKey as NavTranslationKey)}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 line-clamp-3 text-xs leading-5',
                        isActive ? 'text-zinc-300/90' : 'text-zinc-500 group-hover:text-zinc-400'
                      )}
                    >
                      {description}
                    </div>
                  </div>
                )}
                {isActive && !isCompact && (
                  <div
                    className={cn(
                      'rounded-full bg-[#24A1DE] shadow-[0_0_8px_rgba(36,161,222,0.5)]',
                      'w-1.5 h-1.5'
                    )}
                  />
                )}
                {isAiAssistantItemWorking && isCompact ? (
                  <Loader2 className="absolute right-1 top-1 h-3 w-3 animate-spin text-[#8ED8FF]" />
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer info */}
      {!isCompact ? (
        <div className="shrink-0 border-t border-white/10 px-2 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
            {t('press')} <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Cmd/Ctrl+S</kbd> {t('toSave')}
          </div>
        </div>
      ) : (
        <div className="flex w-full shrink-0 items-center justify-center border-t border-white/10 pt-4">
          <kbd
            className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 text-[10px]"
            title={t('saveShortcutTitle')}
          >
            Cmd/Ctrl+S
          </kbd>
        </div>
      )}
    </nav>
  )
}
