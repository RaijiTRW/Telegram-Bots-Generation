'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Controls,
  MiniMap,
  ConnectionMode,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
  Background as BackgroundComponent,
  OnSelectionChangeParams,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { nodeTypes, nodeTemplates } from './node-types'
import type { NodeTemplate } from './node-types'
import { Workflow, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NodeSettingsPanel } from './node-settings-panel'
import { useTranslations } from 'next-intl'
import type { NodeData } from '@/lib/bot-editor/types/component-schemas'
import { DEFAULT_NODE_DATA } from '@/lib/bot-editor/types/component-schemas'

interface FlowCanvasProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onChange?: (nodes: Node[], edges: Edge[]) => void
  onTest?: (nodes: Node[], edges: Edge[]) => void
  testButtonLabel?: string
  isTestActive?: boolean
}

const createUniqueNodeId = (existingNodes: Node[]): string => {
  let id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  while (existingNodes.some((node) => node.id === id)) {
    id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
  return id
}

const INPUT_NODE_WRAPPER_STYLE = {
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  padding: 0,
  boxShadow: 'none',
  width: 'auto',
} as const

const applyNodeWrapperStyle = (node: Node): Node => {
  if (node.type !== 'input') return node

  return {
    ...node,
    style: {
      ...node.style,
      ...INPUT_NODE_WRAPPER_STYLE,
    },
  }
}

const getFallbackNodePosition = (index: number) => {
  const baseY = 100
  const spacingY = 120
  return { x: 350, y: baseY + (index * spacingY) }
}

const mergeTemplateData = (type: string, templateData?: Record<string, unknown>) => {
  const defaultData = DEFAULT_NODE_DATA[type] || {}
  if (!templateData) {
    return defaultData
  }

  return {
    ...defaultData,
    ...templateData,
  }
}

const migrateLegacyHttpActionNode = (node: Node): Node => {
  if (node.type !== 'action') {
    return node
  }

  const nodeData = (node.data || {}) as Record<string, unknown>
  const actionRaw = nodeData.action
  if (!actionRaw || typeof actionRaw !== 'object') {
    return node
  }

  const action = actionRaw as Record<string, unknown>
  if (String(action.type) !== 'httpRequest') {
    return node
  }

  const httpDefaults = mergeTemplateData('http')
  return {
    ...node,
    type: 'http',
    data: {
      ...httpDefaults,
      ...nodeData,
      url: action.url || '',
      method: action.method || 'GET',
      headers: action.headers || [],
      body: action.body ?? '',
      bodyType: action.bodyType || 'json',
      saveToVariable: action.saveToVariable || '',
      timeout: action.timeout || 30000,
      __label: nodeData.__label || 'HTTP',
      __description: nodeData.__description || 'Migrated from legacy Action HTTP',
    },
  }
}

// Get available variable names from nodes
const extractVariableNames = (nodes: Node[]): string[] => {
  const variables: string[] = []

  // Add default user variables
  variables.push('user.id', 'user.username', 'user.firstName', 'user.lastName', 'user.languageCode')

  // Extract variables from Input nodes
  nodes.forEach((node) => {
    if (node.type === 'input') {
      const data = node.data as { variableName?: string }
      if (data.variableName) {
        variables.push(data.variableName)
      }
    }
    if (node.type === 'action') {
      const data = node.data as { action?: { variableName?: string } }
      if (data.action?.variableName) {
        variables.push(data.action.variableName)
      }
    }
    if (node.type === 'http' || node.type === 'webhook') {
      const data = node.data as { saveToVariable?: string }
      if (data.saveToVariable) {
        variables.push(data.saveToVariable)
      }
    }
  })

  return [...new Set(variables)]
}

function FlowCanvasInner({
  initialNodes = [],
  initialEdges = [],
  onChange,
  onTest,
  testButtonLabel = 'Тест',
  isTestActive = false,
}: FlowCanvasProps) {
  const t = useTranslations('editor.canvas')
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
  const { screenToFlowPosition } = useReactFlow()
  const preparedInitialNodes = useMemo(
    () => initialNodes.map(migrateLegacyHttpActionNode).map(applyNodeWrapperStyle),
    [initialNodes]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(preparedInitialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  useEffect(() => {
    onChange?.(nodes, edges)
  }, [nodes, edges, onChange])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null)
      setSettingsPanelOpen(false)
    }
  }, [setNodes, setEdges, selectedNode])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const getVisibleCanvasCenterPosition = useCallback(() => {
    if (!canvasWrapperRef.current) {
      return null
    }

    const bounds = canvasWrapperRef.current.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null
    }

    return screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    })
  }, [screenToFlowPosition])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const templatePayload = event.dataTransfer.getData('application/reactflow-template')
      let template: { type?: string; data?: Record<string, unknown> } | null = null
      if (templatePayload) {
        try {
          template = JSON.parse(templatePayload) as { type?: string; data?: Record<string, unknown> }
        } catch {
          template = null
        }
      }

      const type = template?.type || event.dataTransfer.getData('application/reactflow')
      if (!type) return

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const defaultData = mergeTemplateData(type, template?.data)

      setNodes((nds) => {
        const newNode: Node = {
          id: createUniqueNodeId(nds),
          type,
          position,
          data: {
            ...defaultData,
            onDelete: (id: string) => handleDeleteNode(id),
          },
        }

        return [...nds, applyNodeWrapperStyle(newNode)]
      })
    },
    [setNodes, handleDeleteNode, screenToFlowPosition]
  )

  const handleAddNode = useCallback((template: NodeTemplate) => {
    const defaultData = mergeTemplateData(template.type, template.data)

    setNodes((nds) => {
      const visibleCenter = getVisibleCanvasCenterPosition()
      const fallbackPosition = getFallbackNodePosition(nds.length)
      const basePosition = visibleCenter || fallbackPosition
      const stackOffset = (nds.length % 5) * 20

      const newNode: Node = {
        id: createUniqueNodeId(nds),
        type: template.type,
        position: {
          x: basePosition.x + stackOffset,
          y: basePosition.y + stackOffset,
        },
        data: {
          ...defaultData,
          onDelete: (id: string) => handleDeleteNode(id),
        },
      }

      return [...nds, applyNodeWrapperStyle(newNode)]
    })
  }, [setNodes, handleDeleteNode, getVisibleCanvasCenterPosition])

  const handleClearCanvas = useCallback(() => {
    if (confirm(t('clearConfirm'))) {
      setNodes([])
      setEdges([])
      setSelectedNode(null)
      setSettingsPanelOpen(false)
    }
  }, [setNodes, setEdges, t])

  const handleNodeUpdate = useCallback((nodeId: string, newData: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...newData, onDelete: (id: string) => handleDeleteNode(id) } }
          : n
      )
    )
  }, [setNodes, handleDeleteNode])

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    if (selectedNodes.length === 1) {
      setSelectedNode(selectedNodes[0] as Node)
      setSettingsPanelOpen(true)
    } else {
      setSelectedNode(null)
      setSettingsPanelOpen(false)
    }
  }, [])

  const availableVariables = useMemo(() => extractVariableNames(nodes), [nodes])

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: { stroke: '#24A1DE', strokeWidth: 2 },
    type: 'smoothstep'
  }), [])

  return (
    <div className="w-full h-full flex">
      {/* Canvas Area */}
      <div className="flex-1" ref={canvasWrapperRef}>
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-[#05070A]"
        proOptions={{ hideAttribution: true }}
      >
        {/* Custom Grid Background */}
        <BackgroundComponent
          variant={BackgroundVariant.Lines}
          gap={24}
          size={1}
          color="rgba(255, 255, 255, 0.06)"
        />

        {/* Controls */}
        <Controls
          className="!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/10"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        />

        {/* Mini Map */}
        <MiniMap
          nodeColor={(node) => {
            const colors = {
              message: '#24A1DE',
              condition: '#F59E0B',
              action: '#8B5CF6',
              input: '#10B981',
              http: '#F43F5E',
              webhook: '#EF4444',
              trigger: '#6366F1',
            }
            return colors[node.type as keyof typeof colors] || '#71717A'
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          className="!bg-zinc-900/80 !backdrop-blur-xl !border !border-white/10"
        />

        {/* Action Buttons - Top Right */}
        <Panel position="top-right" className="!transform-none !right-4 !top-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-zinc-900/80 backdrop-blur-xl border-white/10"
              onClick={handleClearCanvas}
            >
              <Trash2 className="w-4 h-4" />
              {t('clearCanvas')}
            </Button>
            <Button
              size="sm"
              className={`gap-2 ${
                isTestActive
                  ? 'bg-red-600 hover:bg-red-600/85'
                  : 'bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80'
              }`}
              onClick={() => onTest?.(nodes, edges)}
            >
              <Play className="w-4 h-4" />
              {testButtonLabel}
            </Button>
          </div>
        </Panel>

        {/* Left Panel - Node Palette */}
        <Panel position="top-left" className="!transform-none !left-4 !top-4">
          <div className="w-44 rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-3">
            <h3 className="text-xs font-semibold text-white mb-3">{t('nodes')}</h3>
            <div className="space-y-1.5">
              {nodeTemplates.map((node) => (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', node.type)
                    e.dataTransfer.setData('application/reactflow-template', JSON.stringify({
                      type: node.type,
                      data: node.data || {},
                    }))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onClick={() => handleAddNode(node)}
                  className={`p-2 rounded-lg bg-gradient-to-r ${node.gradient} ${node.border} cursor-grab hover:scale-[1.02] transition-transform active:cursor-grabbing`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1 rounded"
                      style={{ background: `${node.color}20` }}
                    >
                      <node.icon className="w-3.5 h-3.5" style={{ color: node.color }} />
                    </div>
                    <div className="text-xs font-medium text-white">{node.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-[10px] text-zinc-500 space-y-1">
                <div className="flex justify-between">
                  <span>{t('nodes')}:</span>
                  <span className="text-white">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('connections')}:</span>
                  <span className="text-white">{edges.length}</span>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Empty State */}
        {nodes.length === 0 && (
          <Panel position="top-right" className="!transform-none !left-1/2 !-translate-x-1/2 !top-1/2 !-translate-y-1/2 pointer-events-none">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/10 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Workflow className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('canvasEmpty')}</h3>
              <p className="text-zinc-400 text-sm mb-4 max-w-sm mx-auto">
                {t('startBuilding')}
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>
      </div>

      {/* Settings Panel */}
      {settingsPanelOpen && (
        <NodeSettingsPanel
          node={selectedNode}
          onUpdate={handleNodeUpdate}
          onClose={() => {
            setSettingsPanelOpen(false)
            setSelectedNode(null)
          }}
          variables={availableVariables}
        />
      )}
    </div>
  )
}

// Wrapper component with ReactFlowProvider
export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

// Export hooks for external use
export { useNodesState, useEdgesState }
