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
import {
  Workflow,
  Play,
  Trash2,
  MessageSquare,
  GitBranch,
  Database,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NodeSettingsPanel } from './node-settings-panel'
import { useTranslations } from 'next-intl'
import type { NodeData } from '@/lib/bot-editor/types/component-schemas'
import { DEFAULT_NODE_DATA, NODE_CONFIGS } from '@/lib/bot-editor/types/component-schemas'
import {
  serializeWorkflowEdges,
  serializeWorkflowNodes,
  type SerializableWorkflowEdge,
  type SerializableWorkflowNode,
} from '@/lib/bot-editor/utils/workflow-serialization'

interface FlowCanvasProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onChange?: (nodes: Node[], edges: Edge[]) => void
  onTest?: (nodes: Node[], edges: Edge[]) => void
  onSave?: (nodes: Node[], edges: Edge[]) => Promise<boolean> | boolean
  testButtonLabel?: string
  isTestActive?: boolean
}

type CanvasHistorySnapshot = {
  nodes: SerializableWorkflowNode[]
  edges: SerializableWorkflowEdge[]
}

type CanvasClipboardSnapshot = {
  nodes: SerializableWorkflowNode[]
  edges: SerializableWorkflowEdge[]
}

const createUniqueNodeId = (existingNodes: Node[]): string => {
  let id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  while (existingNodes.some((node) => node.id === id)) {
    id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
  return id
}

const createUniqueEdgeId = (existingEdges: Edge[]): string => {
  let id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  while (existingEdges.some((edge) => edge.id === id)) {
    id = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
  return id
}

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const isEditableElement = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  if (!element) return false

  if (element.isContentEditable) return true

  const tagName = element.tagName?.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
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
      const data = node.data as { action?: { variableName?: string; saveToVariable?: string } }
      if (data.action?.variableName) {
        variables.push(data.action.variableName)
      }
      if (data.action?.saveToVariable) {
        variables.push(data.action.saveToVariable)
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

type PaletteCategoryId = 'trigger' | 'messaging' | 'logic' | 'data' | 'advanced' | 'other'

type PaletteCategoryMeta = {
  id: PaletteCategoryId
  label: string
  shortLabel: string
  hint?: string
  icon: LucideIcon
}

const PALETTE_CATEGORY_ORDER: PaletteCategoryId[] = [
  'trigger',
  'messaging',
  'logic',
  'data',
  'advanced',
  'other',
]

const PALETTE_CATEGORY_META: Record<PaletteCategoryId, PaletteCategoryMeta> = {
  trigger: {
    id: 'trigger',
    label: 'Триггеры',
    shortLabel: 'Триг',
    hint: 'Точки входа: команда, callback, расписание, AI',
    icon: Play,
  },
  messaging: {
    id: 'messaging',
    label: 'Сообщения',
    shortLabel: 'Сообщ',
    hint: 'Отправка сообщений и запрос данных',
    icon: MessageSquare,
  },
  logic: {
    id: 'logic',
    label: 'Логика',
    shortLabel: 'Логика',
    hint: 'Условия, ветвления, switch / AI logic',
    icon: GitBranch,
  },
  data: {
    id: 'data',
    label: 'Данные',
    shortLabel: 'Данные',
    hint: 'Переменные, действия, HTTP',
    icon: Database,
  },
  advanced: {
    id: 'advanced',
    label: 'Доп.',
    shortLabel: 'Доп',
    hint: 'Расширенные ноды (например Script)',
    icon: LayoutGrid,
  },
  other: {
    id: 'other',
    label: 'Другое',
    shortLabel: 'Другое',
    hint: 'Служебные и прочие ноды',
    icon: Workflow,
  },
}

function getPaletteCategoryLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  categoryId: PaletteCategoryId
): string {
  const keyMap: Record<PaletteCategoryId, string> = {
    trigger: 'palette.categories.trigger.label',
    messaging: 'palette.categories.messaging.label',
    logic: 'palette.categories.logic.label',
    data: 'palette.categories.data.label',
    advanced: 'palette.categories.advanced.label',
    other: 'palette.categories.other.label',
  }

  return t(keyMap[categoryId])
}

function getPaletteCategoryHint(
  t: (key: string, values?: Record<string, unknown>) => string,
  categoryId: PaletteCategoryId
): string {
  const keyMap: Record<PaletteCategoryId, string> = {
    trigger: 'palette.categories.trigger.hint',
    messaging: 'palette.categories.messaging.hint',
    logic: 'palette.categories.logic.hint',
    data: 'palette.categories.data.hint',
    advanced: 'palette.categories.advanced.hint',
    other: 'palette.categories.other.hint',
  }

  return t(keyMap[categoryId])
}

function getNodeTemplateDescription(
  t: (key: string, values?: Record<string, unknown>) => string,
  template: NodeTemplate
): string {
  const keyMap: Record<string, string> = {
    'trigger-command': 'nodeTemplateDescriptions.triggerCommand',
    'trigger-text': 'nodeTemplateDescriptions.triggerText',
    'trigger-callback': 'nodeTemplateDescriptions.triggerCallback',
    'trigger-schedule': 'nodeTemplateDescriptions.triggerSchedule',
    'trigger-ai': 'nodeTemplateDescriptions.triggerAI',
    message: 'nodeTemplateDescriptions.message',
    'message-ai': 'nodeTemplateDescriptions.messageAI',
    condition: 'nodeTemplateDescriptions.condition',
    'condition-ai': 'nodeTemplateDescriptions.conditionAI',
    router: 'nodeTemplateDescriptions.router',
    scheduler: 'nodeTemplateDescriptions.scheduler',
    'reply-keyboard': 'nodeTemplateDescriptions.replyKeyboard',
    script: 'nodeTemplateDescriptions.script',
    action: 'nodeTemplateDescriptions.action',
    input: 'nodeTemplateDescriptions.input',
    http: 'nodeTemplateDescriptions.http',
  }

  const key = keyMap[template.id]
  return key ? t(key) : template.description
}

function getTemplatePaletteCategory(template: NodeTemplate): PaletteCategoryId {
  const rawCategory = NODE_CONFIGS[template.type]?.category
  if (rawCategory === 'trigger') return 'trigger'
  if (rawCategory === 'messaging') return 'messaging'
  if (rawCategory === 'logic') return 'logic'
  if (rawCategory === 'data') return 'data'
  if (rawCategory === 'advanced') return 'advanced'
  return 'other'
}

function createCanvasHistorySnapshot(nodes: Node[], edges: Edge[]): CanvasHistorySnapshot {
  return {
    nodes: serializeWorkflowNodes(nodes as unknown[]),
    edges: serializeWorkflowEdges(edges as unknown[]),
  }
}

function getCanvasHistorySnapshotKey(snapshot: CanvasHistorySnapshot): string {
  return JSON.stringify(snapshot)
}

function FlowCanvasInner({
  initialNodes = [],
  initialEdges = [],
  onChange,
  onTest,
  onSave,
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
  const [pinnedPaletteCategory, setPinnedPaletteCategory] = useState<PaletteCategoryId | null>(null)
  const [hoveredPaletteCategory, setHoveredPaletteCategory] = useState<PaletteCategoryId | null>(null)
  const historyRef = useRef<CanvasHistorySnapshot[]>([])
  const historyIndexRef = useRef(-1)
  const skipNextHistoryCaptureRef = useRef(false)
  const lastHistorySnapshotKeyRef = useRef('')
  const clipboardRef = useRef<CanvasClipboardSnapshot | null>(null)
  const clipboardPasteCountRef = useRef(0)

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

  const applyRuntimeNodeData = useCallback((node: Node): Node => {
    const existingData = (node.data || {}) as Record<string, unknown>

    return applyNodeWrapperStyle({
      ...node,
      data: {
        ...existingData,
        onDelete: (id: string) => handleDeleteNode(id),
      },
    })
  }, [handleDeleteNode])

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

  const restoreSnapshot = useCallback((snapshot: CanvasHistorySnapshot) => {
    skipNextHistoryCaptureRef.current = true

    const restoredNodes = snapshot.nodes.map((serializedNode) =>
      applyRuntimeNodeData({
        id: serializedNode.id,
        type: (serializedNode.type || 'message') as Node['type'],
        position: {
          x: Number(serializedNode.position?.x || 0),
          y: Number(serializedNode.position?.y || 0),
        },
        data: (serializedNode.data || {}) as Node['data'],
      } as Node)
    )

    const restoredEdges = snapshot.edges.map((serializedEdge) => ({
      id: serializedEdge.id,
      source: serializedEdge.source,
      target: serializedEdge.target,
      sourceHandle: serializedEdge.sourceHandle ?? null,
      targetHandle: serializedEdge.targetHandle ?? null,
      label: serializedEdge.label,
      data: serializedEdge.data as Edge['data'],
      animated: Boolean(serializedEdge.animated),
      type: serializedEdge.type,
    })) as Edge[]

    setNodes(restoredNodes)
    setEdges(restoredEdges)

    if (selectedNode) {
      const restoredSelectedNode = restoredNodes.find((node) => node.id === selectedNode.id) || null
      if (!restoredSelectedNode) {
        setSelectedNode(null)
        setSettingsPanelOpen(false)
      } else {
        setSelectedNode(restoredSelectedNode)
      }
    }
  }, [applyRuntimeNodeData, selectedNode, setEdges, setNodes])

  const copySelectedNodesToClipboard = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    if (selectedNodes.length === 0) {
      return false
    }

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
    const selectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    )

    clipboardRef.current = {
      nodes: serializeWorkflowNodes(selectedNodes as unknown[]),
      edges: serializeWorkflowEdges(selectedEdges as unknown[]),
    }
    clipboardPasteCountRef.current = 0
    return true
  }, [edges, nodes])

  const cutSelectedNodesToClipboard = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected)
    if (selectedNodes.length === 0) {
      return false
    }

    const didCopy = copySelectedNodesToClipboard()
    if (!didCopy) {
      return false
    }

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id))
    setNodes(nodes.filter((node) => !selectedNodeIds.has(node.id)))
    setEdges(edges.filter((edge) => !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)))

    setSelectedNode(null)
    setSettingsPanelOpen(false)

    return true
  }, [copySelectedNodesToClipboard, edges, nodes, setEdges, setNodes])

  const pasteClipboardNodes = useCallback(() => {
    const clipboard = clipboardRef.current
    if (!clipboard || clipboard.nodes.length === 0) {
      return false
    }

    const nextPasteIndex = clipboardPasteCountRef.current + 1
    clipboardPasteCountRef.current = nextPasteIndex

    const offset = 40 * nextPasteIndex
    const existingNodes = [...nodes]
    const existingEdges = [...edges]
    const idMap = new Map<string, string>()

    const pastedNodes = clipboard.nodes.map((serializedNode) => {
      const newId = createUniqueNodeId(existingNodes)
      idMap.set(serializedNode.id, newId)

      const restoredNode = applyRuntimeNodeData({
        id: newId,
        type: (serializedNode.type || 'message') as Node['type'],
        position: {
          x: Number(serializedNode.position?.x || 0) + offset,
          y: Number(serializedNode.position?.y || 0) + offset,
        },
        data: cloneValue((serializedNode.data || {}) as Node['data']),
        selected: true,
      } as Node)

      existingNodes.push(restoredNode)
      return restoredNode
    })

    const pastedEdges = clipboard.edges
      .map((serializedEdge) => {
        const source = idMap.get(serializedEdge.source)
        const target = idMap.get(serializedEdge.target)
        if (!source || !target) {
          return null
        }

        const edge: Edge = {
          id: createUniqueEdgeId(existingEdges),
          source,
          target,
          sourceHandle: serializedEdge.sourceHandle ?? null,
          targetHandle: serializedEdge.targetHandle ?? null,
          label: serializedEdge.label,
          data: cloneValue(serializedEdge.data as Edge['data']),
          animated: Boolean(serializedEdge.animated),
          type: serializedEdge.type,
        }

        existingEdges.push(edge)
        return edge
      })
      .filter((edge): edge is Edge => Boolean(edge))

    const nextNodes = [
      ...nodes.map((node) => (node.selected ? { ...node, selected: false } : node)),
      ...pastedNodes,
    ]

    setNodes(nextNodes)
    setEdges([
      ...edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
      ...pastedEdges,
    ])

    if (pastedNodes.length === 1) {
      setSelectedNode(pastedNodes[0])
      setSettingsPanelOpen(true)
    } else {
      setSelectedNode(null)
      setSettingsPanelOpen(false)
    }

    return true
  }, [applyRuntimeNodeData, edges, nodes, setEdges, setNodes])

  const undoCanvasChange = useCallback(() => {
    const nextIndex = historyIndexRef.current - 1
    if (nextIndex < 0) return

    const snapshot = historyRef.current[nextIndex]
    if (!snapshot) return

    historyIndexRef.current = nextIndex
    lastHistorySnapshotKeyRef.current = getCanvasHistorySnapshotKey(snapshot)
    restoreSnapshot(snapshot)
  }, [restoreSnapshot])

  const redoCanvasChange = useCallback(() => {
    const nextIndex = historyIndexRef.current + 1
    if (nextIndex >= historyRef.current.length) return

    const snapshot = historyRef.current[nextIndex]
    if (!snapshot) return

    historyIndexRef.current = nextIndex
    lastHistorySnapshotKeyRef.current = getCanvasHistorySnapshotKey(snapshot)
    restoreSnapshot(snapshot)
  }, [restoreSnapshot])

  useEffect(() => {
    const snapshot = createCanvasHistorySnapshot(nodes, edges)
    const snapshotKey = getCanvasHistorySnapshotKey(snapshot)

    if (skipNextHistoryCaptureRef.current) {
      skipNextHistoryCaptureRef.current = false
      lastHistorySnapshotKeyRef.current = snapshotKey
      return
    }

    if (snapshotKey === lastHistorySnapshotKeyRef.current) {
      return
    }

    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1)
    nextHistory.push(snapshot)

    const MAX_HISTORY_SIZE = 100
    if (nextHistory.length > MAX_HISTORY_SIZE) {
      nextHistory.splice(0, nextHistory.length - MAX_HISTORY_SIZE)
    }

    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
    lastHistorySnapshotKeyRef.current = snapshotKey
  }, [nodes, edges])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) {
        return
      }

      const isMetaOrCtrl = event.metaKey || event.ctrlKey
      if (!isMetaOrCtrl) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'c') {
        if (copySelectedNodesToClipboard()) {
          event.preventDefault()
        }
        return
      }

      if (key === 'x') {
        if (cutSelectedNodesToClipboard()) {
          event.preventDefault()
        }
        return
      }

      if (key === 'v') {
        if (pasteClipboardNodes()) {
          event.preventDefault()
        }
        return
      }

      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redoCanvasChange()
        } else {
          undoCanvasChange()
        }
        return
      }

      // Windows/Linux conventional redo shortcut
      if (!event.metaKey && key === 'y') {
        event.preventDefault()
        redoCanvasChange()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    copySelectedNodesToClipboard,
    cutSelectedNodesToClipboard,
    pasteClipboardNodes,
    redoCanvasChange,
    undoCanvasChange,
  ])

  const availableVariables = useMemo(() => extractVariableNames(nodes), [nodes])

  const paletteCategories = useMemo(() => {
    const grouped = new Map<PaletteCategoryId, NodeTemplate[]>()

    for (const template of nodeTemplates) {
      const categoryId = getTemplatePaletteCategory(template)
      const current = grouped.get(categoryId) || []
      current.push(template)
      grouped.set(categoryId, current)
    }

    return PALETTE_CATEGORY_ORDER
      .map((categoryId) => {
        const templates = grouped.get(categoryId) || []
        if (templates.length === 0) return null
        return {
          ...PALETTE_CATEGORY_META[categoryId],
          label: getPaletteCategoryLabel(t as any, categoryId),
          hint: getPaletteCategoryHint(t as any, categoryId),
          templates,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [t])

  const validPinnedPaletteCategory =
    pinnedPaletteCategory &&
      paletteCategories.some((category) => category.id === pinnedPaletteCategory)
      ? pinnedPaletteCategory
      : null

  const validHoveredPaletteCategory =
    hoveredPaletteCategory &&
      paletteCategories.some((category) => category.id === hoveredPaletteCategory)
      ? hoveredPaletteCategory
      : null

  const activePaletteCategoryId =
    validHoveredPaletteCategory || validPinnedPaletteCategory || null

  const activePaletteCategory =
    paletteCategories.find((category) => category.id === activePaletteCategoryId) || null
  const isPaletteExpanded = Boolean(activePaletteCategory)

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: { stroke: '#24A1DE', strokeWidth: 2 },
    type: 'smoothstep'
  }), [])

  const handleSettingsSave = useCallback(async () => {
    if (!onSave) return true
    const result = await onSave(nodes, edges)
    return result !== false
  }, [onSave, nodes, edges])

  const handleTemplateDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, template: NodeTemplate) => {
      event.dataTransfer.setData('application/reactflow', template.type)
      event.dataTransfer.setData(
        'application/reactflow-template',
        JSON.stringify({
          type: template.type,
          data: template.data || {},
        })
      )
      event.dataTransfer.effectAllowed = 'move'
    },
    []
  )

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
            className="tflow-canvas-controls !bg-zinc-900/80 !backdrop-blur-xl !border !border-white/10"
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
                router: '#EAB308',
                scheduler: '#22C55E',
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
                className={`gap-2 ${isTestActive
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
            <div
              className={`${isPaletteExpanded ? 'w-[328px] sm:w-[360px]' : 'w-[136px]'
                } max-w-[calc(100vw-2rem)] rounded-xl bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-2.5 transition-[width] duration-200`}
            >
              <h3 className="text-xs font-semibold text-white mb-2.5">{t('nodes')}</h3>
              <div
                className={`grid ${isPaletteExpanded ? 'grid-cols-[74px_minmax(0,1fr)]' : 'grid-cols-1'} gap-2.5`}
                onMouseLeave={() => setHoveredPaletteCategory(null)}
              >
                <div
                  className="space-y-1 rounded-lg border border-white/10 bg-zinc-800/20 p-1"
                >
                  {paletteCategories.map((category) => {
                    if (!category) return null;

                    const isPinned = validPinnedPaletteCategory === category.id
                    const isActive = activePaletteCategoryId === category.id
                    const CategoryIcon = category.icon

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onMouseEnter={() => setHoveredPaletteCategory(category.id)}
                        onFocus={() => setHoveredPaletteCategory(category.id)}
                        onClick={() =>
                          setPinnedPaletteCategory((prev) => (prev === category.id ? null : category.id))
                        }
                        aria-label={`${category.label}${isPinned ? ` (${t('palette.pinned')})` : ''}`}
                        title={`${category.label}${category.hint ? ` • ${category.hint}` : ''}${isPinned ? ` • ${t('palette.pinned')}` : ''}`}
                        className={`w-full text-left rounded-lg px-1.5 py-1.5 transition-colors border ${isActive
                          ? 'bg-white/10 border-white/20 text-white'
                          : 'bg-transparent border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="relative shrink-0">
                            <CategoryIcon className="w-3.5 h-3.5" />
                            {isPinned && (
                              <span className="absolute -top-1 -right-1 block h-1.5 w-1.5 rounded-full bg-[#24A1DE] ring-1 ring-zinc-900" />
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-1 py-0.5 text-[9px] leading-none border ${isActive
                              ? 'border-white/20 bg-white/10 text-zinc-200'
                              : 'border-white/10 bg-zinc-900/40 text-zinc-400'
                              }`}
                          >
                            {category.templates.length}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {activePaletteCategory && (
                  <div className="min-w-0 rounded-lg border border-white/10 bg-zinc-800/20 p-2">
                    <>
                      <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-white/10">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate">
                            {activePaletteCategory.label}
                          </div>
                          <div className="text-[10px] text-zinc-500">{t('palette.hoverPreviewClickPin')}</div>
                        </div>
                        <div className="text-[10px] text-zinc-400 shrink-0">
                          {t('palette.nodesCount', { count: activePaletteCategory.templates.length })}
                        </div>
                      </div>

                      <div className="mt-2 space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {activePaletteCategory.templates.map((node) => (
                          <div
                            key={node.id}
                            draggable
                            onDragStart={(event) => handleTemplateDragStart(event, node)}
                            onClick={() => handleAddNode(node)}
                            className={`p-2 rounded-lg bg-gradient-to-r ${node.gradient} ${node.border} cursor-grab hover:scale-[1.02] transition-transform active:cursor-grabbing`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className="p-1 rounded mt-0.5"
                                style={{ background: `${node.color}20` }}
                              >
                                <node.icon className="w-3.5 h-3.5" style={{ color: node.color }} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-white truncate">{node.label}</div>
                                <div className="text-[10px] text-zinc-300/90 line-clamp-2">
                                  {getNodeTemplateDescription(t as any, node)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  </div>
                )}
              </div>

              {!isPaletteExpanded && (
                <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-zinc-800/10 px-2 py-1.5 text-[10px] text-zinc-500 leading-tight text-center">
                  {t('palette.hoverClickPin')}
                </div>
              )}

              {/* Quick Stats */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className={`text-[10px] text-zinc-500 ${isPaletteExpanded ? 'space-y-1' : 'flex items-center justify-between gap-2'}`}>
                  <div className="flex justify-between gap-2">
                    <span>{t('nodes')}:</span>
                    <span className="text-white">{nodes.length}</span>
                  </div>
                  <div className="flex justify-between gap-2">
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
          onSave={handleSettingsSave}
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
