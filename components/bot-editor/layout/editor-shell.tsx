'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Bot, Save, Rocket } from 'lucide-react'
import { EditorNav } from './editor-nav'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { Button } from '@/components/ui/button'
import {
  saveCanvasAction,
  saveBotSettingsAction,
} from '@/lib/bot-editor/actions/editor-actions'
import {
  serializeWorkflowNodes,
  serializeWorkflowEdges,
} from '@/lib/bot-editor/utils/workflow-serialization'

type CanvasNode = {
  id: string
  type?: string | null
  position?: { x: number; y: number }
  data?: Record<string, unknown>
  [key: string]: unknown
}

type CanvasEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  [key: string]: unknown
}

type CanvasVariable = {
  id?: string
  name?: string
  type?: string
  default_value?: unknown
  description?: string
  scope?: string
  [key: string]: unknown
}

interface EditorShellProps {
  botId: string
  children: React.ReactNode
}

export function EditorShell({ botId, children }: EditorShellProps) {
  const t = useTranslations('editor.shell')
  const tNav = useTranslations('editor.nav')
  const pathname = usePathname()
  const router = useRouter()
  const { setActiveSection, isDirty, bot, config, setBot, setIsDirty } = useBotState()
  const [isSaving, setIsSaving] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const exitEditor = useCallback(() => {
    const locale = pathname.split('/')[1] || 'ru'
    router.push(`/${locale}/dashboard/bots`)
  }, [pathname, router])

  const handleBack = () => {
    if (isDirty) {
      setShowExitModal(true)
      return
    }

    exitEditor()
  }

  const saveAllChanges = useCallback(async (): Promise<boolean> => {
    if (!bot?.id) {
      setActionError(t('botNotLoaded'))
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
        nodes: serialNodes as CanvasNode[],
        edges: serialEdges as CanvasEdge[],
        variables: serialVariables as CanvasVariable[],
        version: configVersion,
      })

      if (!canvasResult.success) {
        setActionError(canvasResult.error || t('saveError'))
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
        setActionError(settingsResult.error || t('settingsError'))
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
  }, [bot, config, setBot, setIsDirty, t])

  const handleDeploy = async () => {
    if (!bot?.id) return

    setIsDeploying(true)
    setActionError(null)

    const saved = await saveAllChanges()
    if (!saved) {
      setIsDeploying(false)
      return
    }

    // TODO: Replace with real deployment action
    console.log('Deploying bot:', bot.id)
    setIsDirty(false)
    setIsDeploying(false)
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
              <h1 className="text-white font-semibold">{tNav('botEditor')}</h1>
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
            disabled={isSaving || isDeploying}
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('saving') : t('save')}
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            onClick={() => void handleDeploy()}
            disabled={isSaving || isDeploying}
          >
            <Rocket className="w-4 h-4" />
            {isDeploying ? t('deploying') : t('deploy')}
          </Button>
          {isDirty && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs text-amber-400">{tNav('unsavedChanges')}</span>
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

      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{t('exitConfirm')}</h3>
            <p className="mt-2 text-sm text-zinc-400">
              {t('exitDesc')}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowExitModal(false)}
              >
                {t('stay')}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-600/85 text-white"
                onClick={() => {
                  setShowExitModal(false)
                  exitEditor()
                }}
              >
                {t('exit')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
