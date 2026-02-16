'use client'

import { useState, useCallback } from 'react'
import { Node, Edge } from 'reactflow'
import { Loader2 } from 'lucide-react'
import FlowCanvas from '@/components/bot-editor/canvas/flow-canvas'
import {
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

export default function CanvasPage() {
  const t = useTranslations('editor.canvas')
  const { bot, config, setConfig, setIsDirty, setBot } = useBotState()
  const botId = String(bot?.id || '')
  const isTestActive = Boolean(bot?.metadata?.testActive)

  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    if (isTestActive) {
      const stopResult = await stopBotTestAction(botId)
      setIsTesting(false)

      if (!stopResult.success) {
        setError(stopResult.error || 'Не удалось остановить тест')
        return
      }

      if (stopResult.bot) {
        setBot(stopResult.bot)
      }
      setIsDirty(false)

      return
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

    if (!result.success) {
      setError(result.error || 'Не удалось запустить тест')
      return
    }

    if (result.bot) {
      setBot(result.bot)
    }
    setIsDirty(false)

    const modeLabel = result.mode === 'polling' ? 'polling (локально)' : 'webhook'
    const message = result.deepLink
      ? `Тест запущен (${modeLabel}). Откройте бота: ${result.deepLink}`
      : `Тест запущен (${modeLabel}).`

    if (result.deepLink) {
      window.open(result.deepLink, '_blank', 'noopener,noreferrer')
    }

    alert(message)
  }, [botId, config.variables, config.version, isTestActive, setBot, setIsDirty])

  if (!bot) {
    return (
      <div className="h-full w-full bg-[#05070A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#24A1DE] animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-[#05070A] relative">
      {(error || isTesting) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-4 py-2 rounded-lg border text-sm ${
            error
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-zinc-900/90 border-white/10 text-zinc-200'
          }`}>
            {error || t('startingTest')}
          </div>
        </div>
      )}
      <FlowCanvas
        initialNodes={(config.nodes || []) as Node[]}
        initialEdges={(config.edges || []) as Edge[]}
        onChange={handleCanvasChange}
        onTest={handleTest}
        testButtonLabel={isTestActive ? t('stop') : t('test')}
        isTestActive={isTestActive}
      />
    </div>
  )
}
