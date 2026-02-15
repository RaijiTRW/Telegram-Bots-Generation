'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { Bot, BotConfig, EditorSection, BotState } from '@/lib/bot-editor/types/bot.types'
import {
  serializeWorkflowEdges,
  serializeWorkflowNodes,
} from '@/lib/bot-editor/utils/workflow-serialization'

interface BotStateContextValue extends BotState {
  setBot: (bot: Bot | null) => void
  updateBotDraft: (patch: Partial<Bot>) => void
  setConfig: (config: BotConfig) => void
  setActiveSection: (section: EditorSection) => void
  setIsDirty: (dirty: boolean) => void
  updateNode: (nodeId: string, data: Record<string, unknown>) => void
  updateEdge: (edgeId: string, data: Record<string, unknown>) => void
  addVariable: (variable: Omit<import('@/lib/bot-editor/types/bot.types').BotVariable, 'id'>) => void
  removeVariable: (variableId: string) => void
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

function isSameConfig(left: BotConfig, right: BotConfig): boolean {
  const leftNodes = serializeWorkflowNodes((left.nodes || []) as unknown[])
  const rightNodes = serializeWorkflowNodes((right.nodes || []) as unknown[])
  if (stableStringify(leftNodes) !== stableStringify(rightNodes)) {
    return false
  }

  const leftEdges = serializeWorkflowEdges((left.edges || []) as unknown[])
  const rightEdges = serializeWorkflowEdges((right.edges || []) as unknown[])
  if (stableStringify(leftEdges) !== stableStringify(rightEdges)) {
    return false
  }

  if (stableStringify(left.variables || []) !== stableStringify(right.variables || [])) {
    return false
  }

  return String(left.version || '1.0.0') === String(right.version || '1.0.0')
}

interface BotStateProviderProps {
  children: ReactNode
  initialBot?: Bot | null
}

export function BotStateProvider({ children, initialBot = null }: BotStateProviderProps) {
  const [state, setState] = useState<BotState>({
    ...initialState,
    bot: initialBot,
    config: initialBot?.config ?? initialConfig,
  })

  const setBot = useCallback((bot: Bot | null) => {
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

      return {
        ...prev,
        bot: {
          ...prev.bot,
          ...patch,
          metadata: {
            ...(prev.bot.metadata || {}),
            ...((patch.metadata as Record<string, unknown>) || {}),
          },
        },
        isDirty: true,
      }
    })
  }, [])

  const setConfig = useCallback((config: BotConfig) => {
    setState((prev) => {
      if (isSameConfig(prev.config, config)) {
        return prev
      }

      return {
        ...prev,
        config,
        isDirty: true,
      }
    })
  }, [])

  const setActiveSection = useCallback((section: EditorSection) => {
    setState((prev) => ({
      ...prev,
      activeSection: section,
    }))
  }, [])

  const setIsDirty = useCallback((dirty: boolean) => {
    setState((prev) => ({
      ...prev,
      isDirty: dirty,
    }))
  }, [])

  const updateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        nodes: prev.config.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        ),
      },
      isDirty: true,
    }))
  }, [])

  const updateEdge = useCallback((edgeId: string, data: Record<string, unknown>) => {
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        edges: prev.config.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...data } } : edge
        ),
      },
      isDirty: true,
    }))
  }, [])

  const addVariable = useCallback((variable: Omit<import('@/lib/bot-editor/types/bot.types').BotVariable, 'id'>) => {
    const id = `var-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        variables: [...prev.config.variables, { ...variable, id }],
      },
      isDirty: true,
    }))
  }, [])

  const removeVariable = useCallback((variableId: string) => {
    setState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        variables: prev.config.variables.filter((v) => v.id !== variableId),
      },
      isDirty: true,
    }))
  }, [])

  const value: BotStateContextValue = {
    ...state,
    setBot,
    updateBotDraft,
    setConfig,
    setActiveSection,
    setIsDirty,
    updateNode,
    updateEdge,
    addVariable,
    removeVariable,
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
