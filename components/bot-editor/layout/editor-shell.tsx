'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, Bot, Save, Rocket, Download, Server, ChevronDown, Check, Monitor, Send } from 'lucide-react'
import { EditorNav } from './editor-nav'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { Button } from '@/components/ui/button'
import { useBotActivityFavicon } from './use-bot-activity-favicon'
import { EditorSectionViewport } from './editor-section-viewport'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import { EditorOnboardingTour } from '@/components/onboarding/editor-onboarding-tour'
import { VersionUpdateToast } from '@/components/system/version-update-toast'
import { SubscriptionEndedModal } from '@/components/billing/subscription-ended-modal'
import { HELP_GUIDE_KEYS } from '@/lib/bot-editor/help/help-guide-keys'
import {
  saveCanvasAction,
  saveBotSettingsAction,
  exportBotZipAction,
} from '@/lib/bot-editor/actions/editor-actions'
import {
  serializeWorkflowNodes,
  serializeWorkflowEdges,
} from '@/lib/bot-editor/utils/workflow-serialization'
import type { EditorSection } from '@/lib/bot-editor/types/bot.types'
import type { ViewerAccess } from '@/lib/billing/types'

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
  viewerAccess: ViewerAccess
  children: React.ReactNode
}

const NAV_PANEL_DEFAULT_WIDTH = 256
const NAV_PANEL_MAX_WIDTH = 420
const NAV_PANEL_MIN_WIDTH = 56
const NAV_PANEL_COMPACT_THRESHOLD = 220
const NAV_PANEL_HIDDEN_THRESHOLD = 72
const NAV_PANEL_HIDDEN_STRIP_WIDTH = 14
const NAV_PANEL_STORAGE_KEY = 'tflow.editor.sectionsPanelWidth'
const NAV_PANEL_STORAGE_KEY_PREFIX = 'tflow.editor.sectionsPanelWidthByBot'
const AUTO_STOP_TEST_ENDPOINT = '/api/bot-tests/stop-on-exit'

const clampNavPanelWidth = (width: number) =>
  Math.min(NAV_PANEL_MAX_WIDTH, Math.max(NAV_PANEL_MIN_WIDTH, Math.round(width)))

const getBotSpecificNavPanelStorageKey = (botId: string) => `${NAV_PANEL_STORAGE_KEY_PREFIX}:${botId}`

export function EditorShell({ botId, viewerAccess, children }: EditorShellProps) {
  const t = useTranslations('editor.shell')
  const tNav = useTranslations('editor.nav')
  const locale = useLocale()
  const isRu = locale !== 'en'
  const pathname = usePathname()
  const router = useRouter()
  const {
    setActiveSection,
    isDirty,
    bot,
    config,
    setBot,
    setIsDirty,
    testLaunchMode,
    setTestLaunchMode,
    isAgentRunActive,
  } = useBotState()
  const [isSaving, setIsSaving] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [showZipRunGuideModal, setShowZipRunGuideModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [isTestLaunchMenuOpen, setIsTestLaunchMenuOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingSection, setPendingSection] = useState<EditorSection | null>(null)
  const [sectionsPanelWidth, setSectionsPanelWidth] = useState(NAV_PANEL_DEFAULT_WIDTH)
  const [isResizingSectionsPanel, setIsResizingSectionsPanel] = useState(false)
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null)
  const testLaunchMenuCloseTimeoutRef = useRef<number | null>(null)
  const hasLoadedSectionsPanelWidthRef = useRef(false)
  const pendingRestoreSectionsPanelWidthRef = useRef<number | null>(null)
  const isBotActive = Boolean(bot?.metadata?.testActive)
  const hostedDeploySoonBadge = isRu ? 'Скоро' : 'Soon'
  const hostedDeploySoonDesc = isRu
    ? 'Развертывание на нашем сервере появится позже.'
    : 'Deployment on our managed hosting will be available later.'
  const latestBotIdRef = useRef(botId)
  const hasSentAutoStopSignalRef = useRef(false)

  useBotActivityFavicon(isBotActive)

  // Extract active section from pathname
  const getCurrentSection = (): EditorSection => {
    const sections = ['ai-chat', 'ai-agents', 'canvas', 'settings', 'system', 'statistics'] as const
    for (const section of sections) {
      if (pathname?.endsWith(`/${section}`)) {
        return section
      }
    }
    return 'ai-chat'
  }

  const currentSection = getCurrentSection()
  const displayedSection = pendingSection ?? currentSection
  const activeTestLaunchLabel =
    testLaunchMode === 'telegram'
      ? t('testLaunchTelegram')
      : t('testLaunchLivePreview')
  const testLaunchOptions = [
    {
      id: 'telegram' as const,
      label: t('testLaunchTelegram'),
      description: t('testLaunchTelegramDesc'),
      icon: Send,
    },
    {
      id: 'live-preview' as const,
      label: t('testLaunchLivePreview'),
      description: t('testLaunchLivePreviewDesc'),
      icon: Monitor,
    },
  ]
  const initialSectionRef = useRef<EditorSection>(currentSection)
  const initialContentRef = useRef(children)
  const zipRunCommands = [
    'python3 -m venv .venv',
    'source .venv/bin/activate',
    'pip install -r requirements.txt',
    `# ${t('zipRunEnvComment')}`,
    'python3 main.py',
  ]

  const sendAutoStopTestSignal = useCallback((reason: 'editor_exit') => {
    const currentBotId = String(latestBotIdRef.current || '').trim()
    if (!currentBotId || hasSentAutoStopSignalRef.current) {
      return
    }

    hasSentAutoStopSignalRef.current = true
    const payload = JSON.stringify({ botId: currentBotId, reason })

    void fetch(AUTO_STOP_TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      body: payload,
    }).catch(() => {
      hasSentAutoStopSignalRef.current = false
    })
  }, [])

  const openTestLaunchMenu = useCallback(() => {
    if (testLaunchMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(testLaunchMenuCloseTimeoutRef.current)
      testLaunchMenuCloseTimeoutRef.current = null
    }
    setIsTestLaunchMenuOpen(true)
  }, [])

  const closeTestLaunchMenu = useCallback(() => {
    if (testLaunchMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(testLaunchMenuCloseTimeoutRef.current)
      testLaunchMenuCloseTimeoutRef.current = null
    }
    setIsTestLaunchMenuOpen(false)
  }, [])

  const closeTestLaunchMenuWithDelay = useCallback(() => {
    if (testLaunchMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(testLaunchMenuCloseTimeoutRef.current)
    }

    testLaunchMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsTestLaunchMenuOpen(false)
      testLaunchMenuCloseTimeoutRef.current = null
    }, 160)
  }, [])

  const exitEditor = useCallback(() => {
    sendAutoStopTestSignal('editor_exit')
    router.push(`/${locale}/dashboard/bots`)
  }, [locale, router, sendAutoStopTestSignal])

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
        setActionError(('error' in canvasResult ? canvasResult.error : null) || t('saveError'))
        return false
      }

      const settingsResult = await saveBotSettingsAction(bot.id, {
        name: bot.name || '',
        description: bot.description || '',
        status: bot.status,
        telegramToken: String(bot.metadata?.telegramToken || ''),
        webhookUrl: '',
        metadataPatch: {
          features:
            bot.metadata?.features && typeof bot.metadata.features === 'object'
              ? (bot.metadata.features as Record<string, unknown>)
              : undefined,
          profileStyle:
            bot.metadata?.profileStyle && typeof bot.metadata.profileStyle === 'object'
              ? (bot.metadata.profileStyle as Record<string, unknown>)
              : undefined,
        },
      })

      const savedBot = settingsResult.success && 'bot' in settingsResult ? settingsResult.bot : null

      if (!settingsResult.success || !savedBot) {
        setActionError(('error' in settingsResult ? settingsResult.error : null) || t('settingsError'))
        return false
      }

      setBot({
        ...savedBot,
        config: {
          ...(savedBot.config || config),
          nodes: serialNodes as typeof savedBot.config.nodes,
          edges: serialEdges as typeof savedBot.config.edges,
          variables: config.variables,
          version: config.version || savedBot.config?.version || '1.0.0',
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

  const handleDeployHosted = async () => {
    if (!bot?.id) return

    setIsDeploying(true)
    setActionError(null)

    const saved = await saveAllChanges()
    if (!saved) {
      setIsDeploying(false)
      return
    }

    // TODO: Replace with real deployment action
    console.log('Deploying bot on hosted server:', bot.id)
    setIsDirty(false)
    setShowDeployModal(false)
    setIsDeploying(false)
  }

  const handleDownloadZip = async () => {
    if (!bot?.id) return

    setIsDownloadingZip(true)
    setActionError(null)

    try {
      const saved = await saveAllChanges()
      if (!saved) {
        return
      }

      const result = await exportBotZipAction(bot.id)
      if (!result.success || !result.zipBase64 || !result.fileName) {
        setActionError(('error' in result ? result.error : null) || t('downloadZipError'))
        return
      }

      const binary = window.atob(result.zipBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }

      const blob = new Blob([bytes], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
      setShowDeployModal(false)
      setShowZipRunGuideModal(true)
    } catch (error) {
      setActionError(String(error))
    } finally {
      setIsDownloadingZip(false)
    }
  }

  useEffect(() => {
    latestBotIdRef.current = botId
    hasSentAutoStopSignalRef.current = false
  }, [botId])

  useEffect(() => {
    return () => {
      if (testLaunchMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(testLaunchMenuCloseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setPendingSection(null)
    setActiveSection(currentSection)
  }, [currentSection, setActiveSection])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) &&
        (event.code === 'KeyS' || event.key.toLowerCase() === 's')

      if (isSaveShortcut) {
        event.preventDefault()
        void saveAllChanges()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveAllChanges])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const botKey = getBotSpecificNavPanelStorageKey(botId)
      const storedWidth =
        window.localStorage.getItem(botKey) ||
        window.localStorage.getItem(NAV_PANEL_STORAGE_KEY)
      if (!storedWidth) {
        hasLoadedSectionsPanelWidthRef.current = true
        return
      }
      const parsed = Number(storedWidth)
      if (Number.isFinite(parsed)) {
        const nextWidth = clampNavPanelWidth(parsed)
        pendingRestoreSectionsPanelWidthRef.current = nextWidth
        setSectionsPanelWidth(nextWidth)
      } else {
        pendingRestoreSectionsPanelWidthRef.current = null
      }
    } catch {
      // ignore storage errors
    } finally {
      hasLoadedSectionsPanelWidthRef.current = true
    }
  }, [botId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasLoadedSectionsPanelWidthRef.current) return
    const pendingRestoreWidth = pendingRestoreSectionsPanelWidthRef.current
    if (pendingRestoreWidth !== null && sectionsPanelWidth !== pendingRestoreWidth) {
      return
    }
    if (pendingRestoreWidth !== null && sectionsPanelWidth === pendingRestoreWidth) {
      pendingRestoreSectionsPanelWidthRef.current = null
    }
    try {
      window.localStorage.setItem(getBotSpecificNavPanelStorageKey(botId), String(sectionsPanelWidth))
      window.localStorage.setItem(NAV_PANEL_STORAGE_KEY, String(sectionsPanelWidth))
    } catch {
      // ignore storage errors
    }
  }, [botId, sectionsPanelWidth])

  useEffect(() => {
    if (!isResizingSectionsPanel) return

    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStartRef.current) return
      const delta = event.clientX - resizeStartRef.current.x
      setSectionsPanelWidth(clampNavPanelWidth(resizeStartRef.current.width + delta))
    }

    const stopResize = () => {
      resizeStartRef.current = null
      setIsResizingSectionsPanel(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
    window.addEventListener('mouseleave', stopResize)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
      window.removeEventListener('mouseleave', stopResize)
    }
  }, [isResizingSectionsPanel])

  const startSectionsPanelResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStartRef.current = {
      x: event.clientX,
      width: sectionsPanelWidth,
    }
    setIsResizingSectionsPanel(true)
  }

  const resetSectionsPanelSize = () => {
    setSectionsPanelWidth(NAV_PANEL_DEFAULT_WIDTH)
  }

  const sectionsPanelMode: 'full' | 'compact' | 'hidden' =
    sectionsPanelWidth <= NAV_PANEL_HIDDEN_THRESHOLD
      ? 'hidden'
      : sectionsPanelWidth <= NAV_PANEL_COMPACT_THRESHOLD
      ? 'compact'
      : 'full'

  const sectionsPanelRenderWidth =
    sectionsPanelMode === 'hidden' ? NAV_PANEL_HIDDEN_STRIP_WIDTH : sectionsPanelWidth

  return (
    <div className="flex flex-col h-screen">
      {/* Top Header */}
      <header
        data-tour="editor-header"
        className="relative z-[80] h-16 shrink-0 overflow-visible border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between px-6"
      >
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
              <div className="flex items-center gap-2">
                <h1 className="text-white font-semibold">{tNav('botEditor')}</h1>
                <HelpGuideButton
                  guideKey={HELP_GUIDE_KEYS.editorBotHeader}
                  title={tNav('botEditor')}
                  summary={tNav('helpSummary')}
                  steps={[tNav('helpStep1'), tNav('helpStep2'), tNav('helpStep3')]}
                  docsHref={`/${locale}/dashboard/docs/getting-started`}
                />
              </div>
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
          {currentSection === 'canvas' && (
            <div
              className="relative z-[90]"
              onMouseEnter={openTestLaunchMenu}
              onMouseLeave={closeTestLaunchMenuWithDelay}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isTestLaunchMenuOpen}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:text-white"
                onClick={(event) => {
                  event.preventDefault()
                  openTestLaunchMenu()
                }}
              >
                <span>{activeTestLaunchLabel}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${isTestLaunchMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isTestLaunchMenuOpen && (
                <div className="absolute right-0 top-full z-[95] h-3 w-[320px]" />
              )}

              <div
                className={`absolute right-0 top-[calc(100%+8px)] z-[100] w-[320px] origin-top-right rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200 ${
                  isTestLaunchMenuOpen
                    ? 'translate-y-0 opacity-100 pointer-events-auto'
                    : '-translate-y-1 opacity-0 pointer-events-none'
                }`}
              >
                <div className="px-2 pb-1 pt-0.5 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {t('testLaunchMode')}
                </div>
                <div className="space-y-1">
                  {testLaunchOptions.map((option) => {
                    const Icon = option.icon
                    const isSelected = testLaunchMode === option.id

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setTestLaunchMode(option.id)
                          closeTestLaunchMenu()
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                          isSelected
                            ? 'border-[#24A1DE]/35 bg-[#24A1DE]/10'
                            : 'border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-[#24A1DE]/50 bg-[#24A1DE]/20 text-[#7fd6ff]'
                            : 'border-white/10 bg-white/5 text-transparent'
                        }`}>
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-zinc-400" />
                            <div className="text-sm font-medium text-white">{option.label}</div>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-zinc-500">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <Button
            data-tour="editor-save"
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
            data-tour="editor-deploy"
            size="sm"
            className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            onClick={() => {
              setActionError(null)
              setShowDeployModal(true)
            }}
            disabled={isSaving || isDeploying || isDownloadingZip}
          >
            <Rocket className="w-4 h-4" />
            {isDeploying ? t('deploying') : isDownloadingZip ? t('downloadingZip') : t('deploy')}
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
        <div
          data-tour="editor-nav"
          className="relative shrink-0 h-full"
          style={{ width: `${sectionsPanelRenderWidth}px` }}
        >
          {sectionsPanelMode === 'hidden' ? (
            <div className="h-full w-full border-r border-white/10 bg-zinc-950/30 backdrop-blur-xl" />
          ) : (
            <EditorNav
              botId={botId}
              viewerAccess={viewerAccess}
              activeSection={displayedSection}
              onSectionChange={(section) => {
                setPendingSection(section)
                setActiveSection(section)
              }}
              isDirty={isDirty}
              isAiAssistantWorking={isAgentRunActive}
              mode={sectionsPanelMode}
              className="w-full border-r border-white/10"
            />
          )}

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('resizeSectionsPanel')}
            onMouseDown={startSectionsPanelResize}
            onDoubleClick={resetSectionsPanelSize}
            className="absolute top-0 -right-1 z-20 h-full w-2 cursor-col-resize group"
            title={t('resizeSectionsPanelHint')}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10 group-hover:bg-[#24A1DE]/40 group-active:bg-[#24A1DE]/60 transition-colors" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-1.5 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-active:bg-[#24A1DE]/20 transition-colors" />
          </div>
        </div>

        <div data-tour="editor-workspace" className="flex-1 overflow-hidden min-w-0">
          <EditorSectionViewport
            activeSection={displayedSection}
            initialSection={initialSectionRef.current}
            initialContent={initialContentRef.current}
          />
        </div>
      </div>

      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05070A]/35 p-5 backdrop-blur-3xl xl:hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(36,161,222,0.18),transparent_38%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.16),transparent_42%)]" />
        <div className="relative w-full max-w-sm rounded-[28px] border border-white/15 bg-zinc-950/45 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#24A1DE]/25 bg-[#24A1DE]/10 text-[#8ED8FF]">
            <Monitor className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            {isRu ? 'Экран слишком маленький' : 'Screen is too small'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {isRu
              ? 'Вход выполнен, но редактор пока доступен только на большом экране. Версия для телефонов и планшетов появится позже.'
              : 'You are signed in, but the editor is currently available only on larger screens. Phone and tablet support is coming soon.'}
          </p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs leading-5 text-zinc-400">
            {isRu
              ? 'Откройте редактор с ноутбука или увеличьте окно браузера.'
              : 'Open the editor on a laptop or make the browser window wider.'}
          </div>
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

      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{t('deployModalTitle')}</h3>
            <p className="mt-2 text-sm text-zinc-400">
              {t('deployModalDesc')}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => void handleDeployHosted()}
                disabled
                className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-4 py-3 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-[#24A1DE]/15 border border-[#24A1DE]/30">
                    <Server className="w-4 h-4 text-[#24A1DE]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-white">{t('deployHostedTitle')}</div>
                      <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                        {hostedDeploySoonBadge}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {hostedDeploySoonDesc}
                    </div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => void handleDownloadZip()}
                disabled={isSaving || isDeploying || isDownloadingZip}
                className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-4 py-3 text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{t('downloadZipTitle')}</div>
                    <div className="text-xs text-zinc-400 mt-1">{t('downloadZipDesc')}</div>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeployModal(false)}
                disabled={isSaving || isDeploying || isDownloadingZip}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showZipRunGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{t('zipRunGuideTitle')}</h3>
            <p className="mt-2 text-sm text-zinc-400">{t('zipRunGuideDesc')}</p>

            <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/80 p-4">
              <pre className="text-xs md:text-sm text-zinc-200 overflow-x-auto whitespace-pre">
                <code>{zipRunCommands.join('\n')}</code>
              </pre>
            </div>

            <div className="mt-5 flex items-center justify-end">
              <Button onClick={() => setShowZipRunGuideModal(false)}>
                {t('zipRunGuideClose')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <EditorOnboardingTour botId={botId} />
      <SubscriptionEndedModal viewerAccess={viewerAccess} />
      <VersionUpdateToast />
    </div>
  )
}
