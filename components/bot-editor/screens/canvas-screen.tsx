'use client'

import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Node, Edge } from 'reactflow'
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Terminal, Trash2 } from 'lucide-react'
import FlowCanvas, { type CanvasExecutionTrace } from '@/components/bot-editor/canvas/flow-canvas'
import { LivePreviewPhone } from '@/components/bot-editor/canvas/live-preview-phone'
import {
  clearBotTestLogsAction,
  getBotTestLogsAction,
  saveCanvasAction,
  startBotTestAction,
  stopBotTestAction,
} from '@/lib/bot-editor/actions/editor-actions'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import {
  serializeWorkflowNodes,
  serializeWorkflowEdges,
} from '@/lib/bot-editor/utils/workflow-serialization'
import { useTranslations } from 'next-intl'

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

type BotTestLogEntry = {
  id: string
  ts: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
}

type ParsedExecutionVisit = {
  nodeId: string
  nodeType: string
  ts: number
}

const WORKFLOW_NODE_TRACE_RE = /^Node\s+(.+?)\s*->\s*([A-Za-z0-9:_-]+)\s*$/
const WAITING_TRACE_NODE_TYPES = new Set(['input', 'wait', 'scheduler'])
const EXECUTION_ACTIVE_WINDOW_MS = 2_600
const EXECUTION_RECENT_WINDOW_MS = 14_000

function normalizeTraceNodeType(value: string): string {
  return value.replace(/\(.+?\)/g, '').trim().toLowerCase()
}

function parseExecutionVisit(entry: BotTestLogEntry): ParsedExecutionVisit | null {
  if (entry.source !== 'workflow') {
    return null
  }

  const match = entry.message.match(WORKFLOW_NODE_TRACE_RE)
  if (!match) {
    return null
  }

  const rawNodeType = String(match[1] || '').trim()
  const nodeId = String(match[2] || '').trim()
  if (!rawNodeType || !nodeId) {
    return null
  }

  return {
    nodeId,
    nodeType: normalizeTraceNodeType(rawNodeType),
    ts: entry.ts,
  }
}

export default function CanvasPage() {
  const t = useTranslations('editor.canvas')
  const tChat = useTranslations('editor.chat')
  const {
    bot,
    config,
    setConfig,
    setIsDirty,
    setBot,
    autoOpenTelegramAfterTest,
    testLaunchMode,
    viewerAccess,
    agentRun,
    isAgentRunActive,
  } = useBotState()
  const botId = String(bot?.id || '')
  const isTestActive = Boolean(bot?.metadata?.testActive)
  const canUseAiNodes = viewerAccess.isAdmin || viewerAccess.entitlements.aiNodes

  const [isTesting, setIsTesting] = useState(false)
  const [testTransition, setTestTransition] = useState<'starting' | 'stopping' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<BotTestLogEntry[]>([])
  const [isLogConsoleOpen, setIsLogConsoleOpen] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const [logsPaneHeight, setLogsPaneHeight] = useState(220)
  const [isLogsCopyMenuOpen, setIsLogsCopyMenuOpen] = useState(false)
  const [copiedLogsMode, setCopiedLogsMode] = useState<'text' | 'json' | null>(null)
  const [isClearingLogs, setIsClearingLogs] = useState(false)
  const [logsFetchError, setLogsFetchError] = useState<string | null>(null)
  const [logsFetchErrorTs, setLogsFetchErrorTs] = useState<number | null>(null)
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(false)
  const [livePreviewStartSignal, setLivePreviewStartSignal] = useState(0)
  const [isLivePreviewTestActive, setIsLivePreviewTestActive] = useState(false)
  const [livePreviewVisits, setLivePreviewVisits] = useState<ParsedExecutionVisit[]>([])
  const pageContainerRef = useRef<HTMLDivElement | null>(null)
  const logsBodyRef = useRef<HTMLDivElement | null>(null)
  const latestLogTsRef = useRef<number | null>(null)
  const isResizingLogsRef = useRef(false)
  const logsCopyFeedbackTimerRef = useRef<number | null>(null)

  const fetchLogs = useCallback(async (reset = false, force = false) => {
    if (!botId) return
    if (!force && typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    let result:
      | Awaited<ReturnType<typeof getBotTestLogsAction>>
      | null = null

    try {
      result = await getBotTestLogsAction(botId, {
        sinceTs: reset ? undefined : (latestLogTsRef.current ?? undefined),
        limit: 200,
      })
    } catch (actionError) {
      setLogsFetchError(
        actionError instanceof Error
          ? actionError.message || 'logs_error'
          : 'logs_error'
      )
      setLogsFetchErrorTs(Date.now())
      return
    }

    if (!result.success) {
      setLogsFetchError(('error' in result ? result.error : null) || 'logs_error')
      setLogsFetchErrorTs(Date.now())
      return
    }

    setLogsFetchError(null)
    setLogsFetchErrorTs(null)
    const entries = (result.entries || []) as BotTestLogEntry[]
    if (entries.length === 0) {
      return
    }

    setLogs((prev) => {
      if (reset) {
        return entries
      }
      const seen = new Set(prev.map((entry) => entry.id))
      const appended = entries.filter((entry) => !seen.has(entry.id))
      return appended.length > 0 ? [...prev, ...appended] : prev
    })

    const lastTs = entries[entries.length - 1]?.ts
    if (typeof lastTs === 'number') {
      latestLogTsRef.current = Math.max(latestLogTsRef.current ?? 0, lastTs)
    }
  }, [botId])

  const logsPollIntervalMs = useMemo(() => {
    if (!logsFetchError) {
      return 1_500
    }

    const normalized = logsFetchError.toLowerCase()
    if (normalized.includes('rate limit') || normalized.includes('over_request_rate_limit')) {
      return 10_000
    }

    return 3_000
  }, [logsFetchError])

  const edgeLookupByTransition = useMemo(() => {
    const lookup = new Map<string, string>()
    for (const edge of (config.edges || []) as CanvasEdge[]) {
      const source = String(edge.source || '').trim()
      const target = String(edge.target || '').trim()
      const edgeId = String(edge.id || '').trim()
      if (!source || !target || !edgeId) {
        continue
      }

      const key = `${source}=>${target}`
      if (!lookup.has(key)) {
        lookup.set(key, edgeId)
      }
    }
    return lookup
  }, [config.edges])

  const isLivePreviewOnline = testLaunchMode === 'live-preview' && isLivePreviewTestActive

  const executionTrace = useMemo<CanvasExecutionTrace | null>(() => {
    const visits = isLivePreviewOnline
      ? livePreviewVisits
      : logs
          .map(parseExecutionVisit)
          .filter((visit): visit is ParsedExecutionVisit => Boolean(visit))

    if (visits.length === 0) {
      return null
    }

    const now = Date.now()
    const latestVisit = visits[visits.length - 1] || null
    const previousVisit = visits.length > 1 ? visits[visits.length - 2] : null
    const recentNodeIds = new Set<string>()
    const recentEdgeIds = new Set<string>()

    for (const visit of visits) {
      if (now - visit.ts > EXECUTION_RECENT_WINDOW_MS) {
        continue
      }

      recentNodeIds.add(visit.nodeId)
    }

    for (let index = 1; index < visits.length; index += 1) {
      const previous = visits[index - 1]
      const current = visits[index]
      if (now - current.ts > EXECUTION_RECENT_WINDOW_MS) {
        continue
      }

      const edgeId = edgeLookupByTransition.get(`${previous.nodeId}=>${current.nodeId}`)
      if (edgeId) {
        recentEdgeIds.add(edgeId)
      }
    }

    let activeNodeId: string | null = null
    let activeNodeState: CanvasExecutionTrace['activeNodeState'] = null
    let activeEdgeId: string | null = null

    if (latestVisit) {
      const latestAge = now - latestVisit.ts
      const isWaitingNode = WAITING_TRACE_NODE_TYPES.has(latestVisit.nodeType)

      if (isWaitingNode && (isTestActive || isTesting || isLivePreviewOnline)) {
        activeNodeId = latestVisit.nodeId
        activeNodeState = 'waiting'
      } else if (latestAge <= EXECUTION_ACTIVE_WINDOW_MS) {
        activeNodeId = latestVisit.nodeId
        activeNodeState = 'active'
      }

      if (activeNodeState === 'active' && latestAge <= EXECUTION_ACTIVE_WINDOW_MS && previousVisit) {
        activeEdgeId =
          edgeLookupByTransition.get(`${previousVisit.nodeId}=>${latestVisit.nodeId}`) || null
      }
    }

    return {
      isLive: Boolean(isTestActive || isTesting || isLivePreviewOnline),
      activeNodeId,
      activeNodeState,
      recentNodeIds: [...recentNodeIds],
      activeEdgeId,
      recentEdgeIds: [...recentEdgeIds],
      lastEventTs: latestVisit?.ts ?? null,
    }
  }, [edgeLookupByTransition, isLivePreviewOnline, isTestActive, isTesting, livePreviewVisits, logs])

  useEffect(() => {
    latestLogTsRef.current = null
    const resetTimer = window.setTimeout(() => {
      setLogs([])
      setLogsFetchError(null)
      setLogsFetchErrorTs(null)
      if (botId) {
        void fetchLogs(true, true)
      }
    }, 0)

    return () => {
      window.clearTimeout(resetTimer)
    }
  }, [botId, fetchLogs])

  useEffect(() => {
    if (!botId || (!isTestActive && !isTesting)) {
      return
    }

    const initialTimer = window.setTimeout(() => {
      void fetchLogs(false, true)
    }, 0)
    const timer = window.setInterval(() => {
      void fetchLogs(false)
    }, logsPollIntervalMs)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [botId, isTestActive, isTesting, fetchLogs, logsPollIntervalMs])

  useEffect(() => {
    if (!botId || (!isTestActive && !isTesting)) {
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchLogs(false, true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [botId, isTestActive, isTesting, fetchLogs])

  useEffect(() => {
    if (logsCollapsed) return
    const body = logsBodyRef.current
    if (!body) return
    body.scrollTop = body.scrollHeight
  }, [logs, logsCollapsed])

  useEffect(() => {
    return () => {
      if (logsCopyFeedbackTimerRef.current !== null) {
        window.clearTimeout(logsCopyFeedbackTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingLogsRef.current) return
      const container = pageContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const nextHeight = rect.bottom - event.clientY
      const minLogsHeight = 120
      const maxLogsHeight = Math.max(minLogsHeight, Math.min(Math.floor(rect.height * 0.65), rect.height - 180))
      const clamped = Math.max(minLogsHeight, Math.min(nextHeight, maxLogsHeight))
      setLogsPaneHeight(Math.round(clamped))
    }

    const stopResize = () => {
      isResizingLogsRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
    }
  }, [])

  const handleCanvasChange = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    const serialNodes = serializeWorkflowNodes(currentNodes)
    const serialEdges = serializeWorkflowEdges(currentEdges)
    const existingNodes = serializeWorkflowNodes(config.nodes as unknown[])
    const existingEdges = serializeWorkflowEdges(config.edges as unknown[])

    if (
      JSON.stringify(existingNodes) === JSON.stringify(serialNodes) &&
      JSON.stringify(existingEdges) === JSON.stringify(serialEdges)
    ) {
      return
    }

    setConfig({
      ...config,
      nodes: serialNodes as unknown as typeof config.nodes,
      edges: serialEdges as unknown as typeof config.edges,
    })
  }, [config, setConfig])

  const handleTest = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    if (!botId) return

    if (testLaunchMode === 'live-preview') {
      if (isLivePreviewTestActive) {
        setIsLivePreviewTestActive(false)
        setLivePreviewVisits([])
        setError(null)
        return
      }

      const serialNodes = serializeWorkflowNodes(currentNodes)
      const serialEdges = serializeWorkflowEdges(currentEdges)
      setConfig({
        ...config,
        nodes: serialNodes as unknown as typeof config.nodes,
        edges: serialEdges as unknown as typeof config.edges,
      })
      setLivePreviewVisits([])
      setIsLivePreviewTestActive(true)
      setIsLivePreviewOpen(true)
      setLivePreviewStartSignal((value) => value + 1)
      setError(null)
      return
    }

    setIsTesting(true)
    setError(null)
    setLogsFetchError(null)

    if (isTestActive) {
      setTestTransition('stopping')
      const stopResult = await stopBotTestAction(botId, {
        source: 'canvas_button',
      })
      setIsTesting(false)
      setTestTransition(null)
      await fetchLogs(false)

      if (!stopResult.success) {
        const actionError = ('error' in stopResult ? stopResult.error : null) || ''
        setError(actionError || t('errorStopFallback'))
        return
      }

      const stoppedBot = stopResult.success && 'bot' in stopResult ? stopResult.bot : null
      if (stoppedBot) {
        setBot(stoppedBot)
      }
      setIsDirty(false)

      return
    }

    setTestTransition('starting')
    latestLogTsRef.current = null
    setLogs([])
    const preparedTelegramWindow =
      autoOpenTelegramAfterTest && typeof window !== 'undefined'
        ? window.open('', '_blank')
        : null

    if (preparedTelegramWindow) {
      try {
        preparedTelegramWindow.opener = null
        preparedTelegramWindow.document.write(
          '<!doctype html><title>Telegram</title><body style="margin:0;padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;">Opening Telegram...</body>'
        )
        preparedTelegramWindow.document.close()
      } catch {
        // Ignore placeholder rendering issues and keep the reserved window handle.
      }
    }

    const serialNodes = serializeWorkflowNodes(currentNodes)
    const serialEdges = serializeWorkflowEdges(currentEdges)

    const result = await startBotTestAction(botId, {
      nodes: serialNodes as CanvasNode[],
      edges: serialEdges as CanvasEdge[],
      variables: config.variables as CanvasVariable[],
      version: config.version,
    })

    setIsTesting(false)
    setTestTransition(null)
    await fetchLogs(false)

    if (!result.success) {
      if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
        preparedTelegramWindow.close()
      }
      setError(('error' in result ? result.error : null) || t('errorStartFallback'))
      return
    }

    const startedBot = result.success && 'bot' in result ? result.bot : null
    if (startedBot) {
      setBot(startedBot)
    }
    setIsDirty(false)

    const deepLink = result.success && 'deepLink' in result ? result.deepLink : null
    if (deepLink && autoOpenTelegramAfterTest) {
      let openedViaPreparedWindow = false

      if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
        try {
          preparedTelegramWindow.location.replace(deepLink)
          openedViaPreparedWindow = true
        } catch {
          openedViaPreparedWindow = false
        }
      }

      if (!openedViaPreparedWindow) {
        window.open(deepLink, '_blank', 'noopener,noreferrer')
      }
    } else if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
      preparedTelegramWindow.close()
    }
  }, [botId, config, isLivePreviewTestActive, isTestActive, setConfig, setBot, setIsDirty, fetchLogs, autoOpenTelegramAfterTest, testLaunchMode, t])

  const handleLivePreviewOnlineChange = useCallback((online: boolean) => {
    setIsLivePreviewTestActive(online)
    setLivePreviewVisits([])
  }, [])

  const handleLivePreviewExecutionVisit = useCallback((visit: ParsedExecutionVisit) => {
    setLivePreviewVisits((current) => {
      const cutoff = Date.now() - EXECUTION_RECENT_WINDOW_MS
      return [...current.filter((item) => item.ts >= cutoff), visit]
    })
  }, [])

  const handleSaveCanvas = useCallback(async (currentNodes: Node[], currentEdges: Edge[]) => {
    if (!botId) return false

    setError(null)

    const serialNodes = serializeWorkflowNodes(currentNodes)
    const serialEdges = serializeWorkflowEdges(currentEdges)

    const result = await saveCanvasAction(botId, {
      nodes: serialNodes as CanvasNode[],
      edges: serialEdges as CanvasEdge[],
      variables: config.variables as CanvasVariable[],
      version: config.version,
    })

    if (!result.success) {
      setError(('error' in result ? result.error : null) || t('errorSaveFallback'))
      return false
    }

    setIsDirty(false)
    return true
  }, [botId, config.variables, config.version, setIsDirty, t])

  const startLogsResize = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (logsCollapsed) return
    isResizingLogsRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [logsCollapsed])

  if (!bot) {
    return (
      <div className="h-full w-full bg-[#05070A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#24A1DE] animate-spin" />
      </div>
    )
  }

  const effectiveTestActive = isTestActive || isLivePreviewOnline
  const hasLogConsoleActivity = isTesting || effectiveTestActive || logs.length > 0 || Boolean(logsFetchError)
  const showLogConsole = isLogConsoleOpen || hasLogConsoleActivity

  const formatLogTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString()
    } catch {
      return '--:--:--'
    }
  }

  const levelClassMap: Record<BotTestLogEntry['level'], string> = {
    info: 'text-zinc-200',
    debug: 'text-cyan-300/90',
    warn: 'text-amber-300',
    error: 'text-red-300',
  }

  const writeToClipboard = async (value: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  const buildLogsCopyPayload = (mode: 'text' | 'json') => {
    if (mode === 'json') {
      return JSON.stringify(logs, null, 2)
    }

    return logs
      .map((entry) => `[${formatLogTime(entry.ts)}] [${entry.source}] ${entry.message}`)
      .join('\n')
  }

  const handleCopyLogs = async (mode: 'text' | 'json') => {
    try {
      await writeToClipboard(buildLogsCopyPayload(mode))
      setCopiedLogsMode(mode)

      if (logsCopyFeedbackTimerRef.current !== null) {
        window.clearTimeout(logsCopyFeedbackTimerRef.current)
      }

      logsCopyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedLogsMode(null)
      }, 1400)
    } catch {
      setCopiedLogsMode(null)
    }
  }

  const handleClearLogs = async () => {
    if (!botId || isClearingLogs) return

    setIsClearingLogs(true)
    try {
      const result = await clearBotTestLogsAction(botId)
      if (!result.success) {
        setError(('error' in result ? result.error : null) || t('logsClearError'))
        return
      }

      latestLogTsRef.current = null
      setLogs([])
      setLogsFetchError(null)
      setLogsFetchErrorTs(null)
      setCopiedLogsMode(null)
      setIsLogsCopyMenuOpen(false)
    } finally {
      setIsClearingLogs(false)
    }
  }

  return (
    <div ref={pageContainerRef} className="relative h-full w-full bg-[#05070A]">
      <div className="h-full w-full flex flex-col min-h-0">
        <div className="relative flex-1 min-h-0">
          {(error || isTesting || effectiveTestActive) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
              <div className={`px-4 py-2 rounded-lg border text-sm ${
                error
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : effectiveTestActive && !isTesting
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-zinc-900/90 border-white/10 text-zinc-200'
              }`}>
                {error ? (
                  error
                ) : effectiveTestActive && !isTesting ? (
                  <span className="flex items-center gap-2">
                    <span className="status-online" />
                    {t('online')}
                  </span>
                ) : (
                  testTransition === 'stopping' ? t('stoppingBot') : t('startingBot')
                )}
              </div>
            </div>
          )}

          <FlowCanvas
            initialNodes={(config.nodes || []) as Node[]}
            initialEdges={(config.edges || []) as Edge[]}
            onChange={handleCanvasChange}
            onStartTest={handleTest}
            onStopTest={handleTest}
            onSave={handleSaveCanvas}
            isTestActive={effectiveTestActive}
            isTestButtonDisabled={isTesting}
            isAdmin={canUseAiNodes}
            executionTrace={executionTrace}
            suppressTelegramTokenIssue={testLaunchMode === 'live-preview'}
          />

          {isAgentRunActive ? (
            <div className="absolute inset-0 z-40 flex items-start justify-center bg-[#05070A]/18 backdrop-blur-[1px]">
              <div className="mt-4 rounded-full border border-[#24A1DE]/25 bg-[#0D141D]/92 px-4 py-2 text-sm text-zinc-100 shadow-xl shadow-black/30">
                <span className="text-[#8ED8FF]">{tChat('statusRunning')}:</span>{' '}
                {agentRun?.currentAction || tChat('working')}
              </div>
            </div>
          ) : null}

          {!showLogConsole && (
            <div className="absolute bottom-4 left-4 z-40">
              <button
                type="button"
                onClick={() => setIsLogConsoleOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs font-medium text-zinc-200 shadow-xl shadow-black/30 transition-colors hover:border-[#24A1DE]/30 hover:bg-zinc-900 hover:text-white"
              >
                <Terminal className="h-4 w-4 text-[#24A1DE]" />
                {t('logsTitle')}
              </button>
            </div>
          )}
        </div>

        {testLaunchMode === 'live-preview' ? (
          <LivePreviewPhone
            config={config}
            metadata={bot?.metadata}
            isOpen={isLivePreviewOpen}
            isOnline={isLivePreviewTestActive}
            startSignal={livePreviewStartSignal}
            onExecutionVisit={handleLivePreviewExecutionVisit}
            onOnlineChange={handleLivePreviewOnlineChange}
            onOpenChange={setIsLivePreviewOpen}
          />
        ) : null}

        {showLogConsole && (
          <>
            {!logsCollapsed && (
              <div
                role="separator"
                aria-orientation="horizontal"
                onMouseDown={startLogsResize}
                className="h-2 shrink-0 cursor-row-resize bg-transparent group px-4"
              >
                <div className="h-full flex items-center justify-center">
                  <div className="h-1 w-full max-w-24 rounded-full bg-white/10 group-hover:bg-[#24A1DE]/40 transition-colors" />
                </div>
              </div>
            )}

            <div
              className="shrink-0 px-4 pb-4"
              style={logsCollapsed ? undefined : { height: `${logsPaneHeight}px` }}
            >
              <div className="h-full rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Terminal className="w-4 h-4 text-[#24A1DE]" />
                    <div className="text-sm font-medium text-white">{t('logsTitle')}</div>
                    <div className="text-xs text-zinc-400">
                      {effectiveTestActive ? t('online') : testTransition === 'stopping' ? t('stoppingBot') : t('offline')}
                    </div>
                    <div className="text-xs text-zinc-500">{logs.length}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isLogConsoleOpen && !hasLogConsoleActivity && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsLogConsoleOpen(false)
                          setLogsCollapsed(false)
                          setIsLogsCopyMenuOpen(false)
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {t('logsHide')}
                      </button>
                    )}
                    {!logsCollapsed && (
                      <>
                        <div
                          className="relative"
                          onMouseEnter={() => {
                            if (logs.length === 0) return
                            setIsLogsCopyMenuOpen(true)
                          }}
                          onMouseLeave={() => setIsLogsCopyMenuOpen(false)}
                        >
                          <button
                            type="button"
                            title={t('copyLogsTitle')}
                            disabled={logs.length === 0}
                            className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-300 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {isLogsCopyMenuOpen && logs.length > 0 && (
                            <div className="absolute right-0 top-[calc(100%-2px)] z-20 min-w-[132px] rounded-lg border border-white/10 bg-zinc-950/95 backdrop-blur-xl shadow-xl shadow-black/40 p-1.5">
                              <button
                                type="button"
                                onClick={() => void handleCopyLogs('text')}
                                className="w-full h-8 px-2 rounded-md text-xs text-zinc-200 hover:bg-white/5 flex items-center justify-between transition-colors"
                              >
                                {copiedLogsMode === 'text' ? (
                                  <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <>
                                    <span>{t('copyLogsText')}</span>
                                    <span className="text-zinc-500">.txt</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyLogs('json')}
                                className="w-full h-8 px-2 rounded-md text-xs text-zinc-200 hover:bg-white/5 flex items-center justify-between transition-colors"
                              >
                                {copiedLogsMode === 'json' ? (
                                  <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                ) : (
                                  <>
                                    <span>{t('copyLogsJson')}</span>
                                    <span className="text-zinc-500">{'{ }'}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          title={t('clearLogsTitle')}
                          disabled={logs.length === 0 || isClearingLogs}
                          onClick={() => void handleClearLogs()}
                          className="flex items-center justify-center w-8 h-8 rounded-md text-zinc-300 hover:text-red-200 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsLogsCopyMenuOpen(false)
                        setLogsCollapsed((prev) => !prev)
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {logsCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {logsCollapsed ? t('logsShow') : t('logsHide')}
                    </button>
                  </div>
                </div>

                {!logsCollapsed && (
                  <div
                    ref={logsBodyRef}
                    className="flex-1 min-h-0 overflow-y-auto px-3 py-2 font-mono text-xs leading-5 bg-black/20"
                  >
                    {logsFetchError && (
                      <div className="mb-2 text-red-300">
                        [{formatLogTime(logsFetchErrorTs ?? 0)}] [client] {t('logsLoadError')}: {logsFetchError}
                      </div>
                    )}

                    {logs.length === 0 ? (
                      <div className="text-zinc-500">{t('logsEmpty')}</div>
                    ) : (
                      logs.map((entry) => (
                        <div key={entry.id} className={`${levelClassMap[entry.level]} break-words`}>
                          <span className="text-zinc-500">[{formatLogTime(entry.ts)}]</span>{' '}
                          <span className="text-zinc-400">[{entry.source}]</span>{' '}
                          <span>{entry.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
