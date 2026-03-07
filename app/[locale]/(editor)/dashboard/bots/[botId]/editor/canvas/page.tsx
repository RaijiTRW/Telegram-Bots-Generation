'use client'

import { useState, useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { Node, Edge } from 'reactflow'
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Terminal, Trash2 } from 'lucide-react'
import FlowCanvas from '@/components/bot-editor/canvas/flow-canvas'
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

export default function CanvasPage() {
  const t = useTranslations('editor.canvas')
  const { bot, config, setConfig, setIsDirty, setBot, autoOpenTelegramAfterTest, viewerAccess } = useBotState()
  const botId = String(bot?.id || '')
  const isTestActive = Boolean(bot?.metadata?.testActive)
  const canUseAiNodes = viewerAccess.isAdmin || viewerAccess.entitlements.aiNodes

  const [isTesting, setIsTesting] = useState(false)
  const [testTransition, setTestTransition] = useState<'starting' | 'stopping' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<BotTestLogEntry[]>([])
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const [logsPaneHeight, setLogsPaneHeight] = useState(220)
  const [isLogsCopyMenuOpen, setIsLogsCopyMenuOpen] = useState(false)
  const [copiedLogsMode, setCopiedLogsMode] = useState<'text' | 'json' | null>(null)
  const [isClearingLogs, setIsClearingLogs] = useState(false)
  const [logsFetchError, setLogsFetchError] = useState<string | null>(null)
  const [logsFetchErrorTs, setLogsFetchErrorTs] = useState<number | null>(null)
  const pageContainerRef = useRef<HTMLDivElement | null>(null)
  const logsBodyRef = useRef<HTMLDivElement | null>(null)
  const latestLogTsRef = useRef<number | null>(null)
  const isResizingLogsRef = useRef(false)
  const logsCopyFeedbackTimerRef = useRef<number | null>(null)

  const fetchLogs = useCallback(async (reset = false, force = false) => {
    if (!botId) return
    if (!force && typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const result = await getBotTestLogsAction(botId, {
      sinceTs: reset ? undefined : (latestLogTsRef.current ?? undefined),
      limit: 200,
    })

    if (!result.success) {
      setLogsFetchError(result.error || 'logs_error')
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

    setIsTesting(true)
    setError(null)
    setLogsFetchError(null)

    if (isTestActive) {
      setTestTransition('stopping')
      const stopResult = await stopBotTestAction(botId)
      setIsTesting(false)
      setTestTransition(null)
      await fetchLogs(false)

      if (!stopResult.success) {
        setError(stopResult.error || t('errorStopFallback'))
        return
      }

      if (stopResult.bot) {
        setBot(stopResult.bot)
      }
      setIsDirty(false)

      return
    }

    setTestTransition('starting')
    latestLogTsRef.current = null
    setLogs([])
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
      setError(result.error || t('errorStartFallback'))
      return
    }

    if (result.bot) {
      setBot(result.bot)
    }
    setIsDirty(false)

    if (result.deepLink && autoOpenTelegramAfterTest) {
      window.open(result.deepLink, '_blank', 'noopener,noreferrer')
    }
  }, [botId, config.variables, config.version, isTestActive, setBot, setIsDirty, fetchLogs, autoOpenTelegramAfterTest, t])

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
      setError(result.error || t('errorSaveFallback'))
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

  const showLogConsole = isTesting || isTestActive || logs.length > 0

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
        setError(result.error || t('logsClearError'))
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
    <div ref={pageContainerRef} className="h-full w-full bg-[#05070A]">
      <div className="h-full w-full flex flex-col min-h-0">
        <div className="relative flex-1 min-h-0">
          {(error || isTesting || isTestActive) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
              <div className={`px-4 py-2 rounded-lg border text-sm ${
                error
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : isTestActive && !isTesting
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-zinc-900/90 border-white/10 text-zinc-200'
              }`}>
                {error ? (
                  error
                ) : isTestActive && !isTesting ? (
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
            onTest={handleTest}
            onSave={handleSaveCanvas}
            testButtonLabel={isTestActive ? t('stop') : t('test')}
            isTestActive={isTestActive}
            isAdmin={canUseAiNodes}
          />
        </div>

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
                      {isTestActive ? t('online') : testTransition === 'stopping' ? t('stoppingBot') : t('offline')}
                    </div>
                    <div className="text-xs text-zinc-500">{logs.length}</div>
                  </div>
                  <div className="flex items-center gap-1">
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
