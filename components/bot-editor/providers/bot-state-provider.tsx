'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import type { Bot, BotConfig, EditorSection, BotState } from '@/lib/bot-editor/types/bot.types'
import type { ViewerAccess } from '@/lib/billing/types'
import {
  serializeWorkflowEdges,
  serializeWorkflowNodes,
} from '@/lib/bot-editor/utils/workflow-serialization'

interface BotStateContextValue extends BotState {
  isAdmin: boolean
  viewerAccess: ViewerAccess
  setBot: (bot: Bot | null) => void
  updateBotDraft: (patch: Partial<Bot>) => void
  setConfig: (config: BotConfig) => void
  setActiveSection: (section: EditorSection) => void
  setIsDirty: (dirty: boolean) => void
  updateNode: (nodeId: string, data: Record<string, unknown>) => void
  updateEdge: (edgeId: string, data: Record<string, unknown>) => void
  addVariable: (variable: Omit<import('@/lib/bot-editor/types/bot.types').BotVariable, 'id'>) => void
  removeVariable: (variableId: string) => void
  autoOpenTelegramAfterTest: boolean
  setAutoOpenTelegramAfterTest: (value: boolean) => void
}

const BotStateContext = createContext<BotStateContextValue | null>(null)

const initialConfig: BotConfig = {
  nodes: [],
  edges: [],
  variables: [],
}

const initialState: BotState = {
  bot: null,
  config: initialConfig,
  activeSection: 'canvas',
  isDirty: false,
  isLoading: false,
  error: null,
  selectedNodeId: null,
}

const AUTO_OPEN_TELEGRAM_AFTER_TEST_STORAGE_KEY = 'tflow.editor.autoOpenTelegramAfterTest'

function readAutoOpenTelegramAfterTestPreference(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const stored = window.localStorage.getItem(AUTO_OPEN_TELEGRAM_AFTER_TEST_STORAGE_KEY)
    if (stored === null) return true
    return stored === '1'
  } catch {
    return true
  }
}

function writeAutoOpenTelegramAfterTestPreference(value: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      AUTO_OPEN_TELEGRAM_AFTER_TEST_STORAGE_KEY,
      value ? '1' : '0'
    )
  } catch {
    // ignore localStorage access issues
  }
}

function normalizeComparable(value: unknown): unknown {
  if (value === undefined || typeof value === 'function') {
    return undefined
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeComparable(item))
      .filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    const normalizedObject: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey)
    )

    for (const [key, nestedValue] of entries) {
      const normalizedValue = normalizeComparable(nestedValue)
      if (normalizedValue !== undefined) {
        normalizedObject[key] = normalizedValue
      }
    }

    return normalizedObject
  }

  return String(value)
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeComparable(value))
}

function getConfigComparableSnapshot(config: BotConfig): string {
  return stableStringify({
    nodes: serializeWorkflowNodes((config.nodes || []) as unknown[]),
    edges: serializeWorkflowEdges((config.edges || []) as unknown[]),
    variables: config.variables || [],
    version: String(config.version || '1.0.0'),
  })
}

function isSameConfig(left: BotConfig, right: BotConfig): boolean {
  return getConfigComparableSnapshot(left) === getConfigComparableSnapshot(right)
}

function getComparableBotDraft(bot: Bot | null): unknown {
  if (!bot) return null

  return {
    id: bot.id || null,
    name: bot.name || '',
    description: bot.description ?? null,
    status: bot.status || 'draft',
    metadata: bot.metadata || {},
  }
}

function getBotDraftComparableSnapshot(bot: Bot | null): string {
  return stableStringify(getComparableBotDraft(bot))
}

interface BotStateProviderProps {
  children: ReactNode
  initialBot?: Bot | null
  viewerAccess: ViewerAccess
}

export function BotStateProvider({ children, initialBot = null, viewerAccess }: BotStateProviderProps) {
  const botBaselineSnapshotRef = useRef(getBotDraftComparableSnapshot(initialBot))
  const configBaselineSnapshotRef = useRef(getConfigComparableSnapshot(initialBot?.config ?? initialConfig))
  const [state, setState] = useState<BotState>({
    ...initialState,
    bot: initialBot,
    config: initialBot?.config ?? initialConfig,
  })
  const [autoOpenTelegramAfterTest, setAutoOpenTelegramAfterTestState] = useState(
    readAutoOpenTelegramAfterTestPreference
  )

  useEffect(() => {
    // Rehydrate from localStorage after mount to avoid SSR/default-value drift.
    const nextValue = readAutoOpenTelegramAfterTestPreference()
    const timer = window.setTimeout(() => {
      setAutoOpenTelegramAfterTestState(nextValue)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const setAutoOpenTelegramAfterTest = useCallback((value: boolean) => {
    setAutoOpenTelegramAfterTestState(value)
    writeAutoOpenTelegramAfterTestPreference(value)
  }, [])

  const getIsDirtyAgainstBaseline = useCallback((bot: Bot | null, config: BotConfig) => {
    if (getBotDraftComparableSnapshot(bot) !== botBaselineSnapshotRef.current) {
      return true
    }

    return getConfigComparableSnapshot(config) !== configBaselineSnapshotRef.current
  }, [])

  const setBot = useCallback((bot: Bot | null) => {
    botBaselineSnapshotRef.current = getBotDraftComparableSnapshot(bot)
    configBaselineSnapshotRef.current = getConfigComparableSnapshot(bot?.config ?? initialConfig)
    setState((prev) => ({
      ...prev,
      bot,
      config: bot?.config ?? initialConfig,
      isDirty: false,
    }))
  }, [])

  const updateBotDraft = useCallback((patch: Partial<Bot>) => {
    setState((prev) => {
      if (!prev.bot) return prev

      const nextBot = {
        ...prev.bot,
        ...patch,
        metadata: {
          ...(prev.bot.metadata || {}),
          ...((patch.metadata as Record<string, unknown>) || {}),
        },
      }

      return {
        ...prev,
        bot: nextBot,
        isDirty: getIsDirtyAgainstBaseline(nextBot, prev.config),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const setConfig = useCallback((config: BotConfig) => {
    setState((prev) => {
      if (isSameConfig(prev.config, config)) {
        return prev
      }

      return {
        ...prev,
        config,
        isDirty: getIsDirtyAgainstBaseline(prev.bot, config),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const setActiveSection = useCallback((section: EditorSection) => {
    setState((prev) => ({
      ...prev,
      activeSection: section,
    }))
  }, [])

  const setIsDirty = useCallback((dirty: boolean) => {
    setState((prev) => {
      if (!dirty) {
        botBaselineSnapshotRef.current = getBotDraftComparableSnapshot(prev.bot)
        configBaselineSnapshotRef.current = getConfigComparableSnapshot(prev.config)
      }

      return {
        ...prev,
        isDirty: dirty,
      }
    })
  }, [])

  const updateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setState((prev) => {
      const nextConfig = {
        ...prev.config,
        nodes: prev.config.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        ),
      }

      return {
        ...prev,
        config: nextConfig,
        isDirty: getIsDirtyAgainstBaseline(prev.bot, nextConfig),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const updateEdge = useCallback((edgeId: string, data: Record<string, unknown>) => {
    setState((prev) => {
      const nextConfig = {
        ...prev.config,
        edges: prev.config.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...data } } : edge
        ),
      }

      return {
        ...prev,
        config: nextConfig,
        isDirty: getIsDirtyAgainstBaseline(prev.bot, nextConfig),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const addVariable = useCallback((variable: Omit<import('@/lib/bot-editor/types/bot.types').BotVariable, 'id'>) => {
    const id = `var-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    setState((prev) => {
      const nextConfig = {
        ...prev.config,
        variables: [...prev.config.variables, { ...variable, id }],
      }

      return {
        ...prev,
        config: nextConfig,
        isDirty: getIsDirtyAgainstBaseline(prev.bot, nextConfig),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const removeVariable = useCallback((variableId: string) => {
    setState((prev) => {
      const nextConfig = {
        ...prev.config,
        variables: prev.config.variables.filter((v) => v.id !== variableId),
      }

      return {
        ...prev,
        config: nextConfig,
        isDirty: getIsDirtyAgainstBaseline(prev.bot, nextConfig),
      }
    })
  }, [getIsDirtyAgainstBaseline])

  const value: BotStateContextValue = {
    ...state,
    isAdmin: viewerAccess.isAdmin,
    viewerAccess,
    setBot,
    updateBotDraft,
    setConfig,
    setActiveSection,
    setIsDirty,
    updateNode,
    updateEdge,
    addVariable,
    removeVariable,
    autoOpenTelegramAfterTest,
    setAutoOpenTelegramAfterTest,
  }

  return (
    <BotStateContext.Provider value={value}>
      {children}
    </BotStateContext.Provider>
  )
}

export function useBotState() {
  const context = useContext(BotStateContext)
  if (!context) {
    throw new Error('useBotState must be used within a BotStateProvider')
  }
  return context
}
