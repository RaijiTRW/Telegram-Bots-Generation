'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  Bot as BotIcon,
  BookOpen,
  CreditCard,
  Database,
  Download,
  FileText,
  LayoutDashboard,
  Loader2,
  Monitor,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AnimatePresence, motion } from '@/components/motion-wrapper'
import { AiChatPanel } from '@/components/bot-editor/chat/ai-chat-panel'
import CanvasScreen from '@/components/bot-editor/screens/canvas-screen'
import BotSettingsScreen from '@/components/bot-editor/screens/settings-screen'
import BotDatabaseScreen from '@/components/bot-editor/screens/database-screen'
import SystemScreen from '@/components/bot-editor/screens/system-screen'
import BotStatisticsScreen from '@/components/bot-editor/screens/statistics-screen'
import AiAgentsScreen from '@/components/bot-editor/screens/ai-agents-screen'
import DashboardCrmPage from '@/components/dashboard/screens/crm-screen'
import { CreateBotModal, EditBotModal, type CreateBotModalData } from '@/components/bot-editor/modals'
import { DashboardSectionViewport, type DashboardSection } from '@/components/dashboard/layout/dashboard-section-viewport'
import { EditorOnboardingTour } from '@/components/onboarding/editor-onboarding-tour'
import { VersionUpdateToast } from '@/components/system/version-update-toast'
import { SubscriptionEndedModal } from '@/components/billing/subscription-ended-modal'
import { useBotActivityFavicon } from './use-bot-activity-favicon'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { cn } from '@/lib/utils'
import {
  saveCanvasAction,
  saveBotSettingsAction,
  exportBotZipAction,
} from '@/lib/bot-editor/actions/editor-actions'
import { createBotAction, deleteBotAction, updateBotAction } from '@/lib/bot-editor/actions/bots-actions'
import {
  serializeWorkflowEdges,
  serializeWorkflowNodes,
} from '@/lib/bot-editor/utils/workflow-serialization'
import {
  resolveDashboardSectionAccess,
  type AppAccessControls,
  type ManagedDashboardSection,
} from '@/lib/admin-access/config'
import type { Bot, BotStatus, EditorSection } from '@/lib/bot-editor/types/bot.types'
import type { ViewerAccess } from '@/lib/billing/types'

export type WorkspaceMode = 'chat' | 'editor' | 'crm'

interface BotWorkspaceShellProps {
  botId: string
  viewerAccess: ViewerAccess
  accessControls: AppAccessControls
  bots: Bot[]
  children?: ReactNode
}

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

type BotSettingsSection = Extract<EditorSection, 'settings' | 'database' | 'system' | 'statistics' | 'ai-agents'>
type GlobalWorkspaceSection = DashboardSection | 'docs' | 'cms'
type GlobalNavItem = {
  id: GlobalWorkspaceSection
  icon: ComponentType<{ className?: string }>
  label: string
  managedSection?: ManagedDashboardSection
  route?: string
}

const LAST_BOT_STORAGE_KEY = 'cbtooll:lastBotId'
const LAST_BOT_COOKIE = 'cbtooll:lastBotId'
const LAST_WORKSPACE_MODE_STORAGE_KEY = 'cbtooll:lastWorkspaceMode'
const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'
const AUTO_STOP_TEST_ENDPOINT = '/api/bot-tests/stop-on-exit'
const CHAT_SIDEBAR_WIDTH = 292
const CHAT_SIDEBAR_COLLAPSED_WIDTH = 58
const GLOBAL_SETTINGS_SECTIONS = new Set<DashboardSection>([
  'statistics',
  'subscription',
  'admin',
  'profile',
  'settings',
])

const botSettingsSections: Array<{
  id: BotSettingsSection
  icon: ComponentType<{ className?: string }>
  labelKey: string
  descriptionKey: string
}> = [
  { id: 'settings', icon: Settings, labelKey: 'settings', descriptionKey: 'settingsDesc' },
  { id: 'database', icon: Database, labelKey: 'database', descriptionKey: 'databaseDesc' },
  { id: 'system', icon: SlidersHorizontal, labelKey: 'system', descriptionKey: 'systemDesc' },
  { id: 'statistics', icon: BarChart3, labelKey: 'statistics', descriptionKey: 'statisticsDesc' },
  { id: 'ai-agents', icon: BotIcon, labelKey: 'aiAgents', descriptionKey: 'aiAgentsDesc' },
]

const statusStyles: Record<BotStatus, string> = {
  active: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]',
  draft: 'bg-zinc-500',
  archived: 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.35)]',
  error: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.42)]',
}

function persistLastBot(botId: string) {
  try {
    window.localStorage.setItem(LAST_BOT_STORAGE_KEY, botId)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_BOT_COOKIE}=${encodeURIComponent(botId)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

function normalizeWorkspaceMode(value: string | null | undefined): WorkspaceMode | null {
  return value === 'editor' || value === 'chat' || value === 'crm' ? value : null
}

function getWorkspaceModeStorageKey(botId: string) {
  return `${LAST_WORKSPACE_MODE_STORAGE_KEY}:${botId}`
}

function getWorkspaceSectionForMode(mode: WorkspaceMode): Extract<EditorSection, 'ai-chat' | 'canvas'> {
  return mode === 'editor' ? 'canvas' : 'ai-chat'
}

function buildWorkspaceModeHref(locale: string, botId: string, mode: WorkspaceMode) {
  const section = getWorkspaceSectionForMode(mode)
  const query = mode === 'crm' ? '?workspaceMode=crm' : ''
  return `/${locale}/workspace/bots/${botId}/editor/${section}${query}`
}

function readStoredWorkspaceMode(botId: string): WorkspaceMode | null {
  try {
    return (
      normalizeWorkspaceMode(window.localStorage.getItem(getWorkspaceModeStorageKey(botId))) ||
      normalizeWorkspaceMode(window.localStorage.getItem(LAST_WORKSPACE_MODE_STORAGE_KEY))
    )
  } catch {
    return null
  }
}

function persistWorkspaceMode(botId: string, mode: WorkspaceMode) {
  try {
    window.localStorage.setItem(getWorkspaceModeStorageKey(botId), mode)
    window.localStorage.setItem(LAST_WORKSPACE_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_WORKSPACE_MODE_COOKIE}=${encodeURIComponent(mode)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

function getCurrentSection(pathname: string | null): EditorSection {
  const sections = ['ai-chat', 'ai-agents', 'canvas', 'settings', 'database', 'system', 'statistics'] as const
  for (const section of sections) {
    if (pathname?.endsWith(`/${section}`)) {
      return section
    }
  }
  return 'ai-chat'
}

function getInitialMode(section: EditorSection, requestedMode?: WorkspaceMode | null): WorkspaceMode {
  if (requestedMode === 'crm') return 'crm'
  return section === 'canvas' ? 'editor' : 'chat'
}

function isBotSettingsSection(section: EditorSection): section is BotSettingsSection {
  return section === 'settings' || section === 'database' || section === 'system' || section === 'statistics' || section === 'ai-agents'
}

function formatBotStatus(status: BotStatus, locale: string) {
  if (locale === 'en') {
    return {
      active: 'Active',
      draft: 'Draft',
      archived: 'Archived',
      error: 'Error',
    }[status]
  }

  return {
    active: 'Активен',
    draft: 'Черновик',
    archived: 'Архивирован',
    error: 'Ошибка',
  }[status]
}

function getRequestedGlobalSection(value: string | null): DashboardSection | null {
  if (!value || !GLOBAL_SETTINGS_SECTIONS.has(value as DashboardSection)) {
    return null
  }

  return value as DashboardSection
}

function BotSettingsContent({ section }: { section: BotSettingsSection }) {
  const content =
    section === 'database' ? <BotDatabaseScreen />
    : section === 'system' ? <SystemScreen />
    : section === 'statistics' ? <BotStatisticsScreen />
    : section === 'ai-agents' ? <AiAgentsScreen />
    : <BotSettingsScreen />

  return (
    <div className="h-full w-full min-w-0 overflow-hidden">
      {content}
    </div>
  )
}

function WorkspaceDocsFrame({ locale }: { locale: string }) {
  return (
    <iframe
      title={locale === 'en' ? 'Documentation' : 'Документация'}
      src={`/${locale}/dashboard/docs`}
      className="h-full w-full border-0 bg-[#05070A]"
    />
  )
}

function syncWorkspaceBotListItem(
  currentBots: Bot[],
  liveBot: Pick<Bot, 'id' | 'name' | 'description' | 'status' | 'updatedAt'>
): Bot[] {
  let found = false
  let changed = false

  const nextBots = currentBots.map((item) => {
    if (item.id !== liveBot.id) {
      return item
    }

    found = true
    if (
      item.name === liveBot.name &&
      item.description === liveBot.description &&
      item.status === liveBot.status &&
      item.updatedAt === liveBot.updatedAt
    ) {
      return item
    }

    changed = true
    return {
      ...item,
      name: liveBot.name,
      description: liveBot.description,
      status: liveBot.status,
      updatedAt: liveBot.updatedAt,
    }
  })

  return found && changed ? nextBots : currentBots
}

export function BotWorkspaceShell({
  botId,
  viewerAccess,
  accessControls,
  bots,
}: BotWorkspaceShellProps) {
  const t = useTranslations()
  const tEditorShell = useTranslations('editor.shell')
  const tEditorNav = useTranslations('editor.nav')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isRu = locale !== 'en'
  const {
    setActiveSection,
    isDirty,
    bot,
    config,
    setBot,
    setIsDirty,
    isAgentRunActive,
  } = useBotState()
  const currentRouteSection = getCurrentSection(pathname)
  const requestedWorkspaceMode = normalizeWorkspaceMode(searchParams.get('workspaceMode'))
  const requestedGlobalSection = getRequestedGlobalSection(searchParams.get('globalSettings'))
  const requestedLegacyCrmSection = searchParams.get('globalSettings') === 'crm'
  const latestBotIdRef = useRef(botId)
  const hasSentAutoStopSignalRef = useRef(false)

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => getInitialMode(currentRouteSection, requestedWorkspaceMode))
  const [hasOpenedEditor, setHasOpenedEditor] = useState(() => getInitialMode(currentRouteSection, requestedWorkspaceMode) === 'editor')
  const [hasOpenedCrm, setHasOpenedCrm] = useState(() => getInitialMode(currentRouteSection, requestedWorkspaceMode) === 'crm')
  const [botSettingsOpen, setBotSettingsOpen] = useState(() => isBotSettingsSection(currentRouteSection))
  const [botSettingsSection, setBotSettingsSection] = useState<BotSettingsSection>(
    isBotSettingsSection(currentRouteSection) ? currentRouteSection : 'settings'
  )
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false)
  const [globalSection, setGlobalSection] = useState<GlobalWorkspaceSection>('profile')
  const [isChatSidebarCollapsed, setIsChatSidebarCollapsed] = useState(false)
  const [botSearch, setBotSearch] = useState('')
  const [workspaceBots, setWorkspaceBots] = useState<Bot[]>(bots)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditBotModal, setShowEditBotModal] = useState(false)
  const [selectedSidebarBot, setSelectedSidebarBot] = useState<Bot | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [showZipRunGuideModal, setShowZipRunGuideModal] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null)
  const [isCreatingBot, setIsCreatingBot] = useState(false)
  const [isUpdatingSidebarBot, setIsUpdatingSidebarBot] = useState(false)
  const [isDeletingSidebarBot, setIsDeletingSidebarBot] = useState(false)

  const isBotActive = Boolean(bot?.metadata?.testActive)
  const hostedDeploySoonBadge = isRu ? 'Скоро' : 'Soon'
  const hostedDeploySoonDesc = isRu
    ? 'Развертывание на нашем сервере появится позже.'
    : 'Deployment on our managed hosting will be available later.'
  const zipRunCommands = [
    'python3 -m venv .venv',
    'source .venv/bin/activate',
    'pip install -r requirements.txt',
    `# ${tEditorShell('zipRunEnvComment')}`,
    'python3 main.py',
  ]

  useBotActivityFavicon(isBotActive)

  useEffect(() => {
    latestBotIdRef.current = botId
    hasSentAutoStopSignalRef.current = false
    persistLastBot(botId)
  }, [botId])

  useEffect(() => {
    setWorkspaceBots(bots)
  }, [bots])

  useEffect(() => {
    if (workspaceMode === 'editor') {
      setHasOpenedEditor(true)
    }
    if (workspaceMode === 'crm') {
      setHasOpenedCrm(true)
    }
  }, [workspaceMode])

  useEffect(() => {
    if (!bot?.id) {
      return
    }

    const currentBotListFields = {
      id: bot.id,
      name: bot.name,
      description: bot.description,
      status: bot.status,
      updatedAt: bot.updatedAt,
    }

    setWorkspaceBots((currentBots) => syncWorkspaceBotListItem(currentBots, currentBotListFields))
    setSelectedSidebarBot((currentBot) => {
      if (!currentBot || currentBot.id !== bot.id) {
        return currentBot
      }

      return {
        ...currentBot,
        name: bot.name,
        description: bot.description,
        status: bot.status,
        updatedAt: bot.updatedAt,
      }
    })
  }, [bot?.description, bot?.id, bot?.name, bot?.status, bot?.updatedAt])

  useEffect(() => {
    const nextRouteSection = getCurrentSection(pathname)
    setActiveSection(nextRouteSection)

    if (nextRouteSection === 'canvas') {
      persistWorkspaceMode(botId, 'editor')
      setWorkspaceMode('editor')
      return
    }

    if (nextRouteSection === 'ai-chat') {
      const nextMode = requestedWorkspaceMode === 'crm' ? 'crm' : 'chat'
      persistWorkspaceMode(botId, nextMode)
      setWorkspaceMode(nextMode)
      return
    }

    if (isBotSettingsSection(nextRouteSection)) {
      setWorkspaceMode('chat')
      setBotSettingsSection(nextRouteSection)
      setBotSettingsOpen(true)
    }
  }, [botId, pathname, requestedWorkspaceMode, setActiveSection])

  useEffect(() => {
    if (!requestedGlobalSection) {
      return
    }

    setWorkspaceMode('chat')
    setGlobalSection(requestedGlobalSection)
    setGlobalSettingsOpen(true)
    router.replace(pathname || `/${locale}/workspace/bots/${botId}/editor`, { scroll: false })
  }, [botId, locale, pathname, requestedGlobalSection, router])

  useEffect(() => {
    if (!requestedLegacyCrmSection) {
      return
    }

    persistWorkspaceMode(botId, 'crm')
    setWorkspaceMode('crm')
    setBotSettingsOpen(false)
    setGlobalSettingsOpen(false)
    router.replace(buildWorkspaceModeHref(locale, botId, 'crm'), { scroll: false })
  }, [botId, locale, requestedLegacyCrmSection, router])

  const sendAutoStopTestSignal = useCallback((reason: 'editor_exit') => {
    const currentBotId = String(latestBotIdRef.current || '').trim()
    if (!currentBotId || hasSentAutoStopSignalRef.current) {
      return
    }

    hasSentAutoStopSignalRef.current = true
    const payload = JSON.stringify({ botId: currentBotId, reason })
    const beaconPayload = new Blob([payload], { type: 'application/json' })

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(AUTO_STOP_TEST_ENDPOINT, beaconPayload)
      if (queued) {
        return
      }
    }

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

  useEffect(() => {
    if (isBotActive) {
      hasSentAutoStopSignalRef.current = false
    }
  }, [isBotActive])

  useEffect(() => {
    if (!isBotActive) {
      return
    }

    const handlePageHide = () => {
      sendAutoStopTestSignal('editor_exit')
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [isBotActive, sendAutoStopTestSignal])

  const filteredBots = useMemo(() => {
    const query = botSearch.trim().toLowerCase()
    if (!query) return workspaceBots

    return workspaceBots.filter((item) => (
      item.name.toLowerCase().includes(query) ||
      String(item.description || '').toLowerCase().includes(query)
    ))
  }, [botSearch, workspaceBots])

  const globalNavItems = useMemo(() => {
    const dashboardItems: GlobalNavItem[] = [
      { id: 'profile', icon: User, label: t('dashboard.nav.profile'), managedSection: 'profile' },
      { id: 'subscription', icon: CreditCard, label: t('dashboard.nav.subscription'), managedSection: 'subscription' },
      { id: 'statistics', icon: BarChart3, label: t('dashboard.nav.statistics'), managedSection: 'statistics' },
      { id: 'settings', icon: Settings, label: t('dashboard.nav.settings'), managedSection: 'settings' },
      { id: 'docs', icon: BookOpen, label: t('dashboard.nav.docs'), managedSection: 'docs' },
    ]

    const visibleItems = dashboardItems.filter((item) => {
      if (!item.managedSection) return true
      return resolveDashboardSectionAccess(
        item.managedSection,
        accessControls,
        viewerAccess.isAdmin,
        locale === 'en' ? 'en' : 'ru'
      ).visible
    })

    if (viewerAccess.isAdmin) {
      visibleItems.push(
        { id: 'admin', icon: Shield, label: t('dashboard.nav.admin') },
        { id: 'cms', icon: FileText, label: t('dashboard.nav.cms'), route: '/dashboard/cms' }
      )
    }

    return visibleItems
  }, [accessControls, locale, t, viewerAccess.isAdmin])

  const saveAllChanges = useCallback(async (): Promise<boolean> => {
    if (!bot?.id) {
      setActionError(tEditorShell('botNotLoaded'))
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
        setActionError(('error' in canvasResult ? canvasResult.error : null) || tEditorShell('saveError'))
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
          database:
            bot.metadata?.database && typeof bot.metadata.database === 'object'
              ? (bot.metadata.database as Record<string, unknown>)
              : undefined,
        },
      })

      const savedBot = settingsResult.success && 'bot' in settingsResult ? settingsResult.bot : null

      if (!settingsResult.success || !savedBot) {
        setActionError(('error' in settingsResult ? settingsResult.error : null) || tEditorShell('settingsError'))
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
  }, [bot, config, setBot, setIsDirty, tEditorShell])

  const handleDeployHosted = async () => {
    if (!bot?.id) return

    setIsDeploying(true)
    setActionError(null)

    const saved = await saveAllChanges()
    if (!saved) {
      setIsDeploying(false)
      return
    }

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
        setActionError(('error' in result ? result.error : null) || tEditorShell('downloadZipError'))
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

  const switchWorkspaceMode = (nextMode: WorkspaceMode) => {
    persistWorkspaceMode(botId, nextMode)
    setWorkspaceMode(nextMode)
    setBotSettingsOpen(false)
    setGlobalSettingsOpen(false)
    setActiveSection(getWorkspaceSectionForMode(nextMode))
    router.replace(buildWorkspaceModeHref(locale, botId, nextMode), { scroll: false })
  }

  const openBotSettings = (section: BotSettingsSection) => {
    setBotSettingsSection(section)
    setActiveSection(section)
    setBotSettingsOpen(true)
  }

  const navigateToBot = (nextBotId: string) => {
    if (nextBotId === botId) {
      return
    }

    const nextMode = readStoredWorkspaceMode(nextBotId) || workspaceMode
    const nextHref = buildWorkspaceModeHref(locale, nextBotId, nextMode)
    if (isDirty) {
      setPendingNavigationHref(nextHref)
      setShowExitModal(true)
      return
    }

    persistLastBot(nextBotId)
    router.push(nextHref)
  }

  const handleCreateBot = async (data: CreateBotModalData) => {
    setIsCreatingBot(true)
    const result = await createBotAction(data)
    if (!result.success || !result.bot) {
      setActionError(result.error || (isRu ? 'Не удалось создать бота' : 'Failed to create bot'))
      setIsCreatingBot(false)
      return
    }

    setShowCreateModal(false)
    setWorkspaceBots((currentBots) => [result.bot, ...currentBots.filter((item) => item.id !== result.bot.id)])
    persistLastBot(result.bot.id)
    persistWorkspaceMode(result.bot.id, 'chat')
    router.push(buildWorkspaceModeHref(locale, result.bot.id, 'chat'))
  }

  const openSidebarBotModal = (item: Bot) => {
    setSelectedSidebarBot(item)
    setShowEditBotModal(true)
  }

  const handleUpdateSidebarBot = async (data: { name: string; description: string }) => {
    if (!selectedSidebarBot) return

    setIsUpdatingSidebarBot(true)
    setActionError(null)

    try {
      const result = await updateBotAction(selectedSidebarBot.id, data)

      if (!result.success || !result.bot) {
        setActionError(result.error || (isRu ? 'Не удалось обновить бота' : 'Failed to update bot'))
        return
      }

      setWorkspaceBots((currentBots) =>
        currentBots.map((item) => item.id === result.bot.id ? result.bot : item)
      )

      if (bot?.id === result.bot.id) {
        setBot({
          ...bot,
          ...result.bot,
          config: bot.config,
        })
      }

      setShowEditBotModal(false)
      setSelectedSidebarBot(null)
      router.refresh()
    } catch (error) {
      setActionError(String(error))
    } finally {
      setIsUpdatingSidebarBot(false)
    }
  }

  const handleDeleteSidebarBot = async () => {
    if (!selectedSidebarBot) return

    const deletedBotId = selectedSidebarBot.id
    setIsDeletingSidebarBot(true)
    setActionError(null)

    try {
      const result = await deleteBotAction(deletedBotId)

      if (!result.success) {
        setActionError(result.error || (isRu ? 'Не удалось удалить бота' : 'Failed to delete bot'))
        return
      }

      const remainingBots = workspaceBots.filter((item) => item.id !== deletedBotId)
      setWorkspaceBots(remainingBots)
      setShowEditBotModal(false)
      setSelectedSidebarBot(null)

      if (deletedBotId === botId) {
        const nextBot = remainingBots[0]
        if (nextBot) {
          persistLastBot(nextBot.id)
          const nextMode = readStoredWorkspaceMode(nextBot.id) || workspaceMode
          router.push(buildWorkspaceModeHref(locale, nextBot.id, nextMode))
        } else {
          router.push(`/${locale}/workspace`)
        }
      } else {
        router.refresh()
      }
    } catch (error) {
      setActionError(String(error))
    } finally {
      setIsDeletingSidebarBot(false)
    }
  }

  const handleGlobalItemClick = (item: GlobalNavItem) => {
    if (item.route) {
      window.location.assign(item.route)
      return
    }

    if (item.id === 'cms') {
      return
    }

    setGlobalSection(item.id)
    setGlobalSettingsOpen(true)
  }

  const confirmPendingNavigation = () => {
    sendAutoStopTestSignal('editor_exit')
    setShowExitModal(false)
    if (pendingNavigationHref) {
      router.push(pendingNavigationHref)
      setPendingNavigationHref(null)
      return
    }
    router.push(`/${locale}/workspace`)
  }

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

  const activeStatus = bot?.status || 'draft'

  return (
    <div className="flex h-screen overflow-hidden bg-[#05070A] text-white">
      <motion.aside
        className="hidden shrink-0 overflow-hidden border-r border-white/10 bg-[#070A0F]/92 md:flex md:flex-col"
        animate={{
          width: isChatSidebarCollapsed ? CHAT_SIDEBAR_COLLAPSED_WIDTH : CHAT_SIDEBAR_WIDTH,
        }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence initial={false} mode="wait">
          {isChatSidebarCollapsed ? (
            <motion.div
              key="chat-sidebar-collapsed"
              className="flex h-full flex-col items-center px-2 py-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
            >
              <button
                type="button"
                aria-label={isRu ? 'Раскрыть чаты' : 'Expand chats'}
                title={isRu ? 'Раскрыть чаты' : 'Expand chats'}
                onClick={() => setIsChatSidebarCollapsed(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="chat-sidebar-expanded"
              className="flex h-full min-w-[292px] flex-col p-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
        <div className="flex h-12 items-center justify-between gap-3 px-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">CBTooll</div>
            <div className="truncate text-xs text-zinc-500">AI workspace</div>
          </div>
          <button
            type="button"
            aria-label={isRu ? 'Скрыть чаты' : 'Hide chats'}
            title={isRu ? 'Скрыть чаты' : 'Hide chats'}
            onClick={() => setIsChatSidebarCollapsed(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true)
            }}
            aria-label={isRu ? 'Создать нового бота' : 'Create new bot'}
            title={isRu ? 'Создать нового бота' : 'Create new bot'}
            className="flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <BotIcon className="h-4 w-4 text-zinc-400" />
            {isRu ? 'Новый бот' : 'New bot'}
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={botSearch}
              onChange={(event) => setBotSearch(event.target.value)}
              placeholder={isRu ? 'Поиск ботов' : 'Search bots'}
              className="h-11 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-sm text-white placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between px-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
          <span>{isRu ? 'Боты' : 'Bots'}</span>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg px-2 py-1 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            +
          </button>
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
          <div className="space-y-1">
            {filteredBots.map((item) => {
              const isSelected = item.id === botId
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToBot(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigateToBot(item.id)
                    }
                  }}
                  className={cn(
                    'group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#24A1DE]/70',
                    isSelected
                      ? 'border-[#24A1DE]/35 bg-[#24A1DE]/12 text-white'
                      : 'border-transparent text-zinc-400 hover:bg-white/[0.055] hover:text-white'
                  )}
                >
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', statusStyles[item.status || 'draft'])} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-600 group-hover:text-zinc-500">
                      {formatBotStatus(item.status || 'draft', locale)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={isRu ? `Настройки бота ${item.name}` : `Bot settings for ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      openSidebarBotModal(item)
                    }}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]/60 group-hover:opacity-100',
                      isSelected && 'opacity-100'
                    )}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => openBotSettings('settings')}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
            {isRu ? 'Настройки бота' : 'Bot settings'}
          </button>
          <button
            type="button"
            onClick={() => setGlobalSettingsOpen(true)}
            className="mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Settings className="h-4 w-4 text-zinc-500" />
            {isRu ? 'Настройки' : 'Settings'}
          </button>
        </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#070A0F]/90 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-sm font-semibold text-white sm:text-base">
                  {bot?.name || tEditorNav('botEditor')}
                </h1>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', statusStyles[activeStatus])} />
              </div>
              <div className="truncate text-xs text-zinc-500">
                {formatBotStatus(activeStatus, locale)}
                {isAgentRunActive ? ` · ${tEditorNav('workingBadge')}` : ''}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isSaving || isDirty ? (
              <motion.div
                key={isSaving ? 'workspace-saving-status' : 'workspace-unsaved-status'}
                className={cn(
                  'pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-[0_10px_30px_rgba(0,0,0,0.18)] md:flex',
                  isSaving
                    ? 'border border-sky-300/25 bg-sky-300/10 text-sky-100'
                    : 'border border-amber-300/25 bg-amber-300/10 text-amber-100'
                )}
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-200" />
                    {isRu ? 'Сохранение...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" />
                    {isRu ? 'Не сохранено' : 'Unsaved'}
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden rounded-2xl border border-white/10 bg-white/[0.04] p-1 sm:flex">
              {(['chat', 'editor', 'crm'] as WorkspaceMode[]).map((mode) => {
                const isActive = workspaceMode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchWorkspaceMode(mode)}
                    className={cn(
                      'relative rounded-xl px-3 py-2 text-sm font-medium transition',
                      isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="workspace-mode-active"
                        className="absolute inset-0 rounded-xl bg-white/[0.10] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative">
                      {mode === 'chat'
                        ? (isRu ? 'Чат' : 'Chat')
                        : mode === 'editor'
                        ? (isRu ? 'Редактор' : 'Editor')
                        : 'CRM'}
                    </span>
                  </button>
                )
              })}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setGlobalSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {actionError ? (
              <div className="hidden max-w-[240px] truncate rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 xl:block">
                {actionError}
              </div>
            ) : null}

            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 sm:inline-flex"
              onClick={() => void saveAllChanges()}
              disabled={isSaving || isDeploying}
            >
              <Save className="h-4 w-4" />
              {isSaving ? tEditorShell('saving') : tEditorShell('save')}
            </Button>
            <Button
              size="sm"
              className="hidden gap-2 bg-[#24A1DE] text-white hover:bg-[#1B8FC6] sm:inline-flex"
              onClick={() => {
                setActionError(null)
                setShowDeployModal(true)
              }}
              disabled={isSaving || isDeploying || isDownloadingZip}
            >
              <Rocket className="h-4 w-4" />
              {isDeploying ? tEditorShell('deploying') : isDownloadingZip ? tEditorShell('downloadingZip') : tEditorShell('deploy')}
            </Button>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {workspaceMode === 'chat' ? (
              <motion.div
                key="workspace-chat"
                className="absolute inset-0"
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -48 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <AiChatPanel
                  showHeader={false}
                  className="h-full"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {hasOpenedEditor ? (
            <motion.div
              key="workspace-editor"
              className="absolute inset-0"
              initial={{ opacity: 0, x: 48 }}
              animate={workspaceMode === 'editor'
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: 48 }
              }
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden={workspaceMode !== 'editor'}
              style={{
                pointerEvents: workspaceMode === 'editor' ? 'auto' : 'none',
                zIndex: workspaceMode === 'editor' ? 20 : 0,
              }}
            >
              <CanvasScreen />
            </motion.div>
          ) : null}

          {hasOpenedCrm ? (
              <motion.div
                key="workspace-crm"
                className="absolute inset-0"
                initial={{ opacity: 0, x: 48 }}
                animate={workspaceMode === 'crm'
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: 48 }
                }
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden={workspaceMode !== 'crm'}
                style={{
                  pointerEvents: workspaceMode === 'crm' ? 'auto' : 'none',
                  zIndex: workspaceMode === 'crm' ? 20 : 0,
                }}
              >
                <DashboardCrmPage key={botId} initialScope="bot" initialBotId={botId} />
              </motion.div>
          ) : null}

          {workspaceMode === 'editor' && !botSettingsOpen && !globalSettingsOpen ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#05070A]/35 p-5 backdrop-blur-3xl xl:hidden">
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
                    ? 'Чат и настройки доступны, но визуальный редактор пока лучше открывать на большом экране.'
                    : 'Chat and settings are available, but the visual editor currently works best on a larger screen.'}
                </p>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <AnimatePresence>
        {botSettingsOpen ? (
          <motion.div
            key="bot-settings-drawer"
            className="fixed inset-0 z-[120] flex justify-end bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={isRu ? 'Закрыть настройки бота' : 'Close bot settings'}
              className="absolute inset-0 cursor-default"
              onClick={() => setBotSettingsOpen(false)}
            />
            <motion.aside
              className="relative flex h-full w-[calc(100vw-12px)] max-w-none flex-col border-l border-white/10 bg-[#05070A] shadow-2xl shadow-black/50 sm:w-[calc(100vw-24px)] xl:w-[calc(100vw-56px)] 2xl:w-[1480px]"
              initial={{ x: 56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 56, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                    {isRu ? 'Настройки бота' : 'Bot settings'}
                  </div>
                  <div className="truncate text-sm font-semibold text-white">{bot?.name || botId}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setBotSettingsOpen(false)}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
                <nav className="min-h-0 min-w-0 overflow-y-auto border-b border-white/10 bg-[#080B11] p-3 md:border-b-0 md:border-r">
                  <div className="grid gap-1">
                    {botSettingsSections.map((item) => {
                      const Icon = item.icon
                      const isActive = item.id === botSettingsSection
                      const isDisabled = item.id === 'ai-agents' && !viewerAccess.isAdmin
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setBotSettingsSection(item.id)
                            setActiveSection(item.id)
                          }}
                          className={cn(
                            'flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition',
                            isDisabled
                              ? 'cursor-not-allowed border-transparent text-zinc-600 opacity-70'
                              : isActive
                              ? 'border-[#24A1DE]/35 bg-[#24A1DE]/12 text-white'
                              : 'border-transparent text-zinc-400 hover:bg-white/[0.055] hover:text-white'
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{tEditorNav(item.labelKey)}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-zinc-600">
                              {isDisabled ? tEditorNav('soonBadge') : tEditorNav(item.descriptionKey)}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </nav>
                <div className="min-h-0 min-w-0 overflow-hidden">
                  <BotSettingsContent section={botSettingsSection} />
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {globalSettingsOpen ? (
          <motion.div
            key="global-settings-drawer"
            className="fixed inset-0 z-[130] flex justify-end bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={isRu ? 'Закрыть настройки' : 'Close settings'}
              className="absolute inset-0 cursor-default"
              onClick={() => setGlobalSettingsOpen(false)}
            />
            <motion.aside
              className="relative flex h-full w-[calc(100vw-12px)] max-w-none flex-col border-l border-white/10 bg-[#05070A] shadow-2xl shadow-black/50 sm:w-[calc(100vw-24px)] xl:w-[calc(100vw-56px)] 2xl:w-[1560px]"
              initial={{ x: 56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 56, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
                    <LayoutDashboard className="h-4 w-4 text-[#8ED8FF]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{isRu ? 'Настройки' : 'Settings'}</div>
                    <div className="text-xs text-zinc-500">{isRu ? 'Разделы аккаунта и продукта' : 'Account and product sections'}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setGlobalSettingsOpen(false)}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)]">
                <nav className="min-w-0 border-b border-white/10 bg-[#080B11] p-3 md:border-b-0 md:border-r">
                  <div className="grid gap-1">
                    {globalNavItems.map((item) => {
                      const Icon = item.icon
                      const isActive = item.id === globalSection
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleGlobalItemClick(item)}
                          className={cn(
                            'flex h-11 items-center gap-3 rounded-xl border px-3 text-sm font-medium transition',
                            isActive
                              ? 'border-[#24A1DE]/35 bg-[#24A1DE]/12 text-white'
                              : 'border-transparent text-zinc-400 hover:bg-white/[0.055] hover:text-white'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </nav>
                <div className="min-h-0 min-w-0 overflow-y-auto p-4 pb-10 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
                  {globalSection === 'docs' ? (
                    <WorkspaceDocsFrame locale={locale} />
                  ) : globalSection === 'cms' ? null : (
                    <DashboardSectionViewport
                      activeSection={globalSection}
                      initialSection="profile"
                      initialContent={null}
                      viewerAccess={viewerAccess}
                    />
                  )}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CreateBotModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateBot}
        isLoading={isCreatingBot}
      />

      <EditBotModal
        isOpen={showEditBotModal}
        onClose={() => {
          setShowEditBotModal(false)
          setSelectedSidebarBot(null)
        }}
        onSave={handleUpdateSidebarBot}
        onDelete={handleDeleteSidebarBot}
        bot={selectedSidebarBot}
        isLoading={isUpdatingSidebarBot}
        isDeleting={isDeletingSidebarBot}
      />

      <AnimatePresence>
        {showExitModal ? (
          <motion.div
            key="workspace-exit-modal"
            className="fixed inset-0 z-[180] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-lg font-semibold text-white">{tEditorShell('exitConfirm')}</h3>
              <p className="mt-2 text-sm text-zinc-400">{tEditorShell('exitDesc')}</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowExitModal(false)
                    setPendingNavigationHref(null)
                  }}
                >
                  {tEditorShell('stay')}
                </Button>
                <Button className="bg-red-600 text-white hover:bg-red-600/85" onClick={confirmPendingNavigation}>
                  {tEditorShell('exit')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showDeployModal ? (
          <motion.div
            key="workspace-deploy-modal"
            className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="w-full max-w-lg rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-lg font-semibold text-white">{tEditorShell('deployModalTitle')}</h3>
              <p className="mt-2 text-sm text-zinc-400">{tEditorShell('deployModalDesc')}</p>
              <div className="mt-6 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => void handleDeployHosted()}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left opacity-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg border border-[#24A1DE]/30 bg-[#24A1DE]/15 p-2">
                      <Server className="h-4 w-4 text-[#24A1DE]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-white">{tEditorShell('deployHostedTitle')}</div>
                        <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                          {hostedDeploySoonBadge}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">{hostedDeploySoonDesc}</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDownloadZip()}
                  disabled={isSaving || isDeploying || isDownloadingZip}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 p-2">
                      <Download className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{tEditorShell('downloadZipTitle')}</div>
                      <div className="mt-1 text-xs text-zinc-400">{tEditorShell('downloadZipDesc')}</div>
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
                  {tEditorShell('cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showZipRunGuideModal ? (
          <motion.div
            key="workspace-zip-guide-modal"
            className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="w-full max-w-2xl rounded-xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="text-lg font-semibold text-white">{tEditorShell('zipRunGuideTitle')}</h3>
              <p className="mt-2 text-sm text-zinc-400">{tEditorShell('zipRunGuideDesc')}</p>
              <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/80 p-4">
                <pre className="overflow-x-auto whitespace-pre text-xs text-zinc-200 md:text-sm">
                  <code>{zipRunCommands.join('\n')}</code>
                </pre>
              </div>
              <div className="mt-5 flex items-center justify-end">
                <Button onClick={() => setShowZipRunGuideModal(false)}>
                  {tEditorShell('zipRunGuideClose')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <EditorOnboardingTour botId={botId} />
      <SubscriptionEndedModal viewerAccess={viewerAccess} />
      <VersionUpdateToast />
    </div>
  )
}
