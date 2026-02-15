'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Bot, Save, RefreshCw, Square } from 'lucide-react'
import { EditorNav } from './editor-nav'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { Button } from '@/components/ui/button'
import {
  saveCanvasAction,
  saveBotSettingsAction,
  startBotTestAction,
  stopBotTestAction,
} from '@/lib/bot-editor/actions/editor-actions'
import {
  serializeWorkflowNodes,
  serializeWorkflowEdges,
} from '@/lib/bot-editor/utils/workflow-serialization'

interface EditorShellProps {
  botId: string
  children: React.ReactNode
}

export function EditorShell({ botId, children }: EditorShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setActiveSection, isDirty, bot, config, setBot, setIsDirty } = useBotState()
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const isTestActive = Boolean(bot?.metadata?.testActive)

  // Extract active section from pathname
  const getCurrentSection = (): 'ai-chat' | 'canvas' | 'settings' | 'system' => {
    const sections = ['ai-chat', 'canvas', 'settings', 'system'] as const
    for (const section of sections) {
      if (pathname?.endsWith(`/${section}`)) {
        return section
      }
    }
    return 'canvas'
  }

  const currentSection = getCurrentSection()

  const handleBack = () => {
    if (isDirty) {
      const confirmLeave = confirm('У вас есть несохранённые изменения. Вы уверены, что хотите выйти?')
      if (!confirmLeave) return
    }
    const locale = pathname.split('/')[1] || 'ru'
    router.push(`/${locale}/dashboard/bots`)
  }

  const saveAllChanges = useCallback(async (): Promise<boolean> => {
    if (!bot?.id) {
      setActionError('Бот не загружен')
      return false
    }

    try {
      setActionError(null)
      setIsSaving(true)

      const serialNodes = serializeWorkflowNodes(config.nodes as unknown[])
      const serialEdges = serializeWorkflowEdges(config.edges as unknown[])
      const serialVariables = config.variables as unknown[]
      const configVersion = config.version

      const canvasResult = await saveCanvasAction(bot.id, {
        nodes: serialNodes,
        edges: serialEdges,
        variables: serialVariables,
        version: configVersion,
      })

      if (!canvasResult.success) {
        setActionError(canvasResult.error || 'Ошибка сохранения canvas')
        return false
      }

      const settingsResult = await saveBotSettingsAction(bot.id, {
        name: bot.name || '',
        description: bot.description || '',
        status: bot.status,
        telegramToken: String(bot.metadata?.telegramToken || ''),
        webhookUrl: String(bot.metadata?.webhookUrl || ''),
      })

      if (!settingsResult.success || !settingsResult.bot) {
        setActionError(settingsResult.error || 'Ошибка сохранения настроек')
        return false
      }

      setBot({
        ...settingsResult.bot,
        config: {
          ...(settingsResult.bot.config || config),
          nodes: serialNodes as typeof settingsResult.bot.config.nodes,
          edges: serialEdges as typeof settingsResult.bot.config.edges,
          variables: config.variables,
          version: config.version || settingsResult.bot.config?.version || '1.0.0',
        },
      })
      setIsDirty(false)
      return true
    } catch (error) {
      setActionError(String(error))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [bot, config, setBot, setIsDirty])

  const handleTest = async () => {
    if (!bot?.id) return

    setIsTesting(true)
    setActionError(null)

    if (isTestActive) {
      const stopResult = await stopBotTestAction(bot.id)
      setIsTesting(false)

      if (!stopResult.success) {
        setActionError(stopResult.error || 'Не удалось остановить тест')
        return
      }

      if (stopResult.bot) {
        setBot(stopResult.bot)
      }
      setIsDirty(false)

      return
    }

    const saved = await saveAllChanges()
    if (!saved) {
      setIsTesting(false)
      return
    }

    const serialNodes = serializeWorkflowNodes(config.nodes as unknown[])
    const serialEdges = serializeWorkflowEdges(config.edges as unknown[])
    const serialVariables = config.variables as unknown[]

    const result = await startBotTestAction(bot.id, {
      nodes: serialNodes,
      edges: serialEdges,
      variables: serialVariables,
      version: config.version,
    })

    setIsTesting(false)

    if (!result.success) {
      setActionError(result.error || 'Не удалось запустить тест')
      return
    }

    if (result.bot) {
      setBot(result.bot)
    }
    setIsDirty(false)

    if (result.deepLink) {
      window.open(result.deepLink, '_blank', 'noopener,noreferrer')
    }

    const modeLabel = result.mode === 'polling' ? 'polling (локально)' : 'webhook'
    alert(result.deepLink ? `Тест запущен (${modeLabel}): ${result.deepLink}` : `Тест запущен (${modeLabel})`)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveAllChanges()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveAllChanges])

  return (
    <div className="flex flex-col h-screen">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
              <Bot className="w-4 h-4 text-[#24A1DE]" />
            </div>
            <div>
              <h1 className="text-white font-semibold">Bot Editor</h1>
              <p className="text-xs text-zinc-500">ID: {botId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actionError && (
            <div className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-300">
              {actionError}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void saveAllChanges()}
            disabled={isSaving || isTesting}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Сохраняем...' : 'Сохранить'}
          </Button>
          <Button
            size="sm"
            className={`gap-2 ${
              isTestActive
                ? 'bg-red-600 hover:bg-red-600/85'
                : 'bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80'
            }`}
            onClick={handleTest}
            disabled={isSaving || isTesting}
          >
            {isTestActive ? (
              <Square className="w-4 h-4" />
            ) : (
              <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
            )}
            {isTesting ? 'Обработка...' : isTestActive ? 'Стоп' : 'Тест'}
          </Button>
          {isDirty && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-400">Несохранённые изменения</span>
            </div>
          )}
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex flex-1 overflow-hidden">
        <EditorNav
          botId={botId}
          activeSection={currentSection}
          onSectionChange={setActiveSection}
          isDirty={isDirty}
        />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}
