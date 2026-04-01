'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import ReactFlow, {
  MiniMap,
  ConnectionMode,
  ConnectionLineType,
  PanOnScrollMode,
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
import { edgeTypes, CANVAS_EDGE_STYLE, CANVAS_EDGE_TYPE } from './edge-types'
import {
  Workflow,
  Play,
  Zap,
  Trash2,
  Lock,
  MessageSquare,
  Sparkles,
  GitBranch,
  Database,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NodeSettingsPanel } from './node-settings-panel'
import { useLocale, useTranslations } from 'next-intl'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import {
  HELP_GUIDE_KEYS,
  getCanvasPaletteGuideKey,
} from '@/lib/bot-editor/help/help-guide-keys'
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
  isAdmin?: boolean
}

type CanvasHistorySnapshot = {
  nodes: SerializableWorkflowNode[]
  edges: SerializableWorkflowEdge[]
}

type CanvasClipboardSnapshot = {
  nodes: SerializableWorkflowNode[]
  edges: SerializableWorkflowEdge[]
}

type CanvasContextMenuState = {
  clientX: number
  clientY: number
  flowPosition: { x: number; y: number }
}

const CANVAS_CONTEXT_MENU_DRAG_THRESHOLD = 6

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

const isCanvasPaneElement = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('.react-flow__pane'))
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

const CANVAS_MIN_ZOOM = 0.2
const CANVAS_MAX_ZOOM = 2
const CANVAS_WHEEL_ZOOM_STEP = 0.12
const AI_NODE_TEMPLATE_IDS = new Set(['trigger-ai', 'message-ai', 'condition-ai'])

const applyRuntimeEdgeStyle = (edge: Edge): Edge => ({
  ...edge,
  type: CANVAS_EDGE_TYPE,
  animated: edge.animated ?? true,
  style: {
    ...CANVAS_EDGE_STYLE,
    ...(edge.style || {}),
  },
})

function isAiTemplateCandidate(template: { id?: string; data?: Record<string, unknown> } | null | undefined): boolean {
  if (!template) return false
  if (template.id && AI_NODE_TEMPLATE_IDS.has(String(template.id))) return true
  return Boolean(template.data?.aiEnabled)
}

function isMouseWheelEvent(event: WheelEvent): boolean {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE || event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return true
  }

  // Pinch-to-zoom on macOS trackpads should stay untouched.
  if (event.ctrlKey) {
    return false
  }

  const absX = Math.abs(event.deltaX)
  const absY = Math.abs(event.deltaY)

  // Typical mouse wheels generate larger, stepped deltas mostly on one axis.
  if (absX === 0 && Number.isInteger(event.deltaY) && absY >= 40) {
    return true
  }

  return absX === 0 && absY >= 80
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
    if (
      node.type === 'paymentYookassa' ||
      node.type === 'paymentStripe' ||
      node.type === 'paymentRobokassa' ||
      node.type === 'paymentStars'
    ) {
      const data = node.data as { saveToVariable?: string }
      if (data.saveToVariable) {
        variables.push(data.saveToVariable)
      }
    }
  })

  return [...new Set(variables)]
}

type PaletteCategoryId = 'trigger' | 'messaging' | 'ai' | 'logic' | 'data' | 'payments' | 'advanced' | 'other'

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
  'ai',
  'logic',
  'data',
  'payments',
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
  ai: {
    id: 'ai',
    label: 'AI',
    shortLabel: 'AI',
    hint: 'AI-ноды: intent, AI message, AI logic',
    icon: Sparkles,
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
  payments: {
    id: 'payments',
    label: 'Оплата',
    shortLabel: 'Оплата',
    hint: 'Платежные ссылки: YooKassa, Stripe, Robokassa, Telegram Stars',
    icon: CreditCard,
  },
  advanced: {
    id: 'advanced',
    label: 'Действия',
    shortLabel: 'Действ',
    hint: 'Скрипты и продвинутые действия',
    icon: Zap,
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
    ai: 'palette.categories.ai.label',
    logic: 'palette.categories.logic.label',
    data: 'palette.categories.data.label',
    payments: 'palette.categories.payments.label',
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
    ai: 'palette.categories.ai.hint',
    logic: 'palette.categories.logic.hint',
    data: 'palette.categories.data.hint',
    payments: 'palette.categories.payments.hint',
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
    wait: 'nodeTemplateDescriptions.wait',
    'reply-keyboard': 'nodeTemplateDescriptions.replyKeyboard',
    script: 'nodeTemplateDescriptions.script',
    action: 'nodeTemplateDescriptions.action',
    input: 'nodeTemplateDescriptions.input',
    http: 'nodeTemplateDescriptions.http',
    comment: 'nodeTemplateDescriptions.comment',
    'payment-yookassa': 'nodeTemplateDescriptions.paymentYookassa',
    'payment-stripe': 'nodeTemplateDescriptions.paymentStripe',
    'payment-robokassa': 'nodeTemplateDescriptions.paymentRobokassa',
    'payment-stars': 'nodeTemplateDescriptions.paymentStars',
  }

  const key = keyMap[template.id]
  if (!key) return template.description
  try {
    return t(key)
  } catch {
    return template.description
  }
}

function getNodeTemplateShortDescription(
  t: (key: string, values?: Record<string, unknown>) => string,
  template: NodeTemplate
): string {
  const keyMap: Record<string, string> = {
    'trigger-command': 'nodeTemplateShortDescriptions.triggerCommand',
    'trigger-text': 'nodeTemplateShortDescriptions.triggerText',
    'trigger-callback': 'nodeTemplateShortDescriptions.triggerCallback',
    'trigger-schedule': 'nodeTemplateShortDescriptions.triggerSchedule',
    'trigger-ai': 'nodeTemplateShortDescriptions.triggerAI',
    message: 'nodeTemplateShortDescriptions.message',
    'message-ai': 'nodeTemplateShortDescriptions.messageAI',
    condition: 'nodeTemplateShortDescriptions.condition',
    'condition-ai': 'nodeTemplateShortDescriptions.conditionAI',
    router: 'nodeTemplateShortDescriptions.router',
    scheduler: 'nodeTemplateShortDescriptions.scheduler',
    wait: 'nodeTemplateShortDescriptions.wait',
    'reply-keyboard': 'nodeTemplateShortDescriptions.replyKeyboard',
    script: 'nodeTemplateShortDescriptions.script',
    action: 'nodeTemplateShortDescriptions.action',
    input: 'nodeTemplateShortDescriptions.input',
    http: 'nodeTemplateShortDescriptions.http',
    comment: 'nodeTemplateShortDescriptions.comment',
    'payment-yookassa': 'nodeTemplateShortDescriptions.paymentYookassa',
    'payment-stripe': 'nodeTemplateShortDescriptions.paymentStripe',
    'payment-robokassa': 'nodeTemplateShortDescriptions.paymentRobokassa',
    'payment-stars': 'nodeTemplateShortDescriptions.paymentStars',
  }

  const key = keyMap[template.id]
  if (!key) return template.label
  try {
    return t(key)
  } catch {
    return template.label
  }
}

function getNodeTemplateHelpSteps(
  t: (key: string, values?: Record<string, unknown>) => string,
  template: NodeTemplate
): string[] {
  const keyMap: Record<string, string> = {
    'trigger-command': 'nodeTemplateHelpSteps.triggerCommand',
    'trigger-text': 'nodeTemplateHelpSteps.triggerText',
    'trigger-callback': 'nodeTemplateHelpSteps.triggerCallback',
    'trigger-schedule': 'nodeTemplateHelpSteps.triggerSchedule',
    'trigger-ai': 'nodeTemplateHelpSteps.triggerAI',
    message: 'nodeTemplateHelpSteps.message',
    'message-ai': 'nodeTemplateHelpSteps.messageAI',
    condition: 'nodeTemplateHelpSteps.condition',
    'condition-ai': 'nodeTemplateHelpSteps.conditionAI',
    router: 'nodeTemplateHelpSteps.router',
    scheduler: 'nodeTemplateHelpSteps.scheduler',
    wait: 'nodeTemplateHelpSteps.wait',
    'reply-keyboard': 'nodeTemplateHelpSteps.replyKeyboard',
    script: 'nodeTemplateHelpSteps.script',
    action: 'nodeTemplateHelpSteps.action',
    input: 'nodeTemplateHelpSteps.input',
    http: 'nodeTemplateHelpSteps.http',
    comment: 'nodeTemplateHelpSteps.comment',
    'payment-yookassa': 'nodeTemplateHelpSteps.paymentYookassa',
    'payment-stripe': 'nodeTemplateHelpSteps.paymentStripe',
    'payment-robokassa': 'nodeTemplateHelpSteps.paymentRobokassa',
    'payment-stars': 'nodeTemplateHelpSteps.paymentStars',
  }

  const baseKey = keyMap[template.id]
  const defaultSteps = [
    t('palette.helpStepAddNode'),
    t('palette.helpStepOpenSettings'),
    t('palette.helpStepConnect'),
  ]

  if (!baseKey) {
    return defaultSteps
  }

  return [1, 2, 3].map((index) => {
    try {
      return t(`${baseKey}.step${index}`)
    } catch {
      return defaultSteps[index - 1] || ''
    }
  })
}

function getNodeTemplateDocsHref(docsBasePath: string, template: NodeTemplate): string {
  const anchorByTemplateId: Record<string, string> = {
    'trigger-command': 'node-trigger-command',
    'trigger-text': 'node-trigger-text',
    'trigger-callback': 'node-trigger-callback',
    'trigger-schedule': 'node-trigger-schedule',
    'trigger-ai': 'node-trigger-ai',
    message: 'node-message',
    'message-ai': 'node-message-ai',
    input: 'node-input',
    'reply-keyboard': 'node-reply-keyboard-node',
    condition: 'node-condition',
    'condition-ai': 'node-condition-ai',
    router: 'node-router',
    scheduler: 'node-date-scheduler',
    wait: 'nodes-reference',
    action: 'node-action',
    http: 'node-http',
    webhook: 'node-http',
    script: 'node-script',
    comment: 'nodes-reference',
    'payment-yookassa': 'node-payment-yookassa',
    'payment-stripe': 'node-payment-stripe',
    'payment-robokassa': 'node-payment-robokassa',
    'payment-stars': 'node-payment-stars',
  }

  const anchor = anchorByTemplateId[template.id] || 'nodes-reference'
  return `${docsBasePath}/nodes#${anchor}`
}

function getTemplatePaletteCategory(template: NodeTemplate): PaletteCategoryId {
  if (isAiTemplateCandidate(template)) return 'ai'

  const rawCategory = NODE_CONFIGS[template.type]?.category
  if (rawCategory === 'trigger') return 'trigger'
  if (rawCategory === 'messaging') return 'messaging'
  if (rawCategory === 'logic') return 'logic'
  if (rawCategory === 'data') return 'data'
  if (rawCategory === 'payments') return 'payments'
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
  isAdmin = false,
}: FlowCanvasProps) {
  const t = useTranslations('editor.canvas')
  const translateCanvas = t as unknown as (key: string, values?: Record<string, unknown>) => string
  const locale = useLocale()
  const docsBasePath = `/${locale}/dashboard/docs`
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null)
  const { screenToFlowPosition, getZoom, zoomTo } = useReactFlow()
  const preparedInitialNodes = useMemo(
    () => initialNodes.map(migrateLegacyHttpActionNode).map(applyNodeWrapperStyle),
    [initialNodes]
  )
  const preparedInitialEdges = useMemo(
    () => initialEdges.map(applyRuntimeEdgeStyle),
    [initialEdges]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(preparedInitialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(preparedInitialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [pinnedPaletteCategory, setPinnedPaletteCategory] = useState<PaletteCategoryId | null>(null)
  const [hoveredPaletteCategory, setHoveredPaletteCategory] = useState<PaletteCategoryId | null>(null)
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null)
  const [contextMenuCategory, setContextMenuCategory] = useState<PaletteCategoryId | null>(null)
  const [isSelectionModifierPressed, setIsSelectionModifierPressed] = useState(false)
  const historyRef = useRef<CanvasHistorySnapshot[]>([])
  const historyIndexRef = useRef(-1)
  const skipNextHistoryCaptureRef = useRef(false)
  const lastHistorySnapshotKeyRef = useRef('')
  const clipboardRef = useRef<CanvasClipboardSnapshot | null>(null)
  const clipboardPasteCountRef = useRef(0)
  const contextMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const rightClickOriginRef = useRef<{ x: number; y: number } | null>(null)
  const suppressNextCanvasContextMenuRef = useRef(false)

  useEffect(() => {
    onChange?.(nodes, edges)
  }, [nodes, edges, onChange])

  useEffect(() => {
    const syncSelectionModifier = (event: KeyboardEvent) => {
      setIsSelectionModifierPressed(event.shiftKey)
    }

    const resetSelectionModifier = () => {
      setIsSelectionModifierPressed(false)
    }

    window.addEventListener('keydown', syncSelectionModifier)
    window.addEventListener('keyup', syncSelectionModifier)
    window.addEventListener('blur', resetSelectionModifier)

    return () => {
      window.removeEventListener('keydown', syncSelectionModifier)
      window.removeEventListener('keyup', syncSelectionModifier)
      window.removeEventListener('blur', resetSelectionModifier)
    }
  }, [])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      type: CANVAS_EDGE_TYPE,
      animated: true,
      style: CANVAS_EDGE_STYLE,
    }, eds)),
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

  useEffect(() => {
    const wrapper = canvasWrapperRef.current
    if (!wrapper) return

    const flowElement = wrapper.querySelector<HTMLElement>('.react-flow')
    if (!flowElement) return

    const handleWheel = (event: Event) => {
      if (!(event instanceof WheelEvent)) {
        return
      }

      // Keep native trackpad two-finger pan and pinch gestures untouched.
      if (!isMouseWheelEvent(event)) {
        return
      }

      if (event.deltaY === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const direction = event.deltaY < 0 ? 1 : -1
      const currentZoom = getZoom()
      const nextZoom = Math.max(
        CANVAS_MIN_ZOOM,
        Math.min(CANVAS_MAX_ZOOM, currentZoom + direction * CANVAS_WHEEL_ZOOM_STEP)
      )

      if (Math.abs(nextZoom - currentZoom) < Number.EPSILON) {
        return
      }

      void zoomTo(nextZoom, { duration: 80 })
    }

    flowElement.addEventListener('wheel', handleWheel, { passive: false, capture: true })

    return () => {
      flowElement.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [getZoom, zoomTo])

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
      let template: { id?: string; type?: string; data?: Record<string, unknown> } | null = null
      if (templatePayload) {
        try {
          template = JSON.parse(templatePayload) as { id?: string; type?: string; data?: Record<string, unknown> }
        } catch {
          template = null
        }
      }

      if (!isAdmin && isAiTemplateCandidate(template)) {
        return
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
    [setNodes, handleDeleteNode, screenToFlowPosition, isAdmin]
  )

  const handleAddNode = useCallback((template: NodeTemplate, targetPosition?: { x: number; y: number }) => {
    if (!isAdmin && isAiTemplateCandidate(template)) {
      return
    }

    const defaultData = mergeTemplateData(template.type, template.data)

    setNodes((nds) => {
      const visibleCenter = getVisibleCanvasCenterPosition()
      const fallbackPosition = getFallbackNodePosition(nds.length)
      const basePosition = targetPosition || visibleCenter || fallbackPosition
      const stackOffset = targetPosition ? 0 : (nds.length % 5) * 20

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
  }, [setNodes, handleDeleteNode, getVisibleCanvasCenterPosition, isAdmin])

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

    const restoredEdges = snapshot.edges.map((serializedEdge) => applyRuntimeEdgeStyle({
      id: serializedEdge.id,
      source: serializedEdge.source,
      target: serializedEdge.target,
      sourceHandle: serializedEdge.sourceHandle ?? null,
      targetHandle: serializedEdge.targetHandle ?? null,
      label: serializedEdge.label,
      data: serializedEdge.data as Edge['data'],
      animated: Boolean(serializedEdge.animated),
      type: serializedEdge.type,
      style: undefined,
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

        const edge: Edge = applyRuntimeEdgeStyle({
          id: createUniqueEdgeId(existingEdges),
          source,
          target,
          sourceHandle: serializedEdge.sourceHandle ?? null,
          targetHandle: serializedEdge.targetHandle ?? null,
          label: serializedEdge.label,
          data: cloneValue(serializedEdge.data as Edge['data']),
          animated: Boolean(serializedEdge.animated),
          type: serializedEdge.type,
          style: undefined,
        })

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
        const isLocked = categoryId === 'ai' && !isAdmin
        return {
          ...PALETTE_CATEGORY_META[categoryId],
          label: getPaletteCategoryLabel(translateCanvas, categoryId),
          hint: getPaletteCategoryHint(translateCanvas, categoryId),
          templates,
          disabled: isLocked,
          badge: isLocked ? t('palette.aiSoonBadge') : null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [translateCanvas, isAdmin, t])

  const firstEnabledPaletteCategory =
    paletteCategories.find((category) => !category.disabled) ||
    paletteCategories[0] ||
    null

  const activeContextMenuCategory =
    (contextMenuCategory &&
      paletteCategories.find((category) => category.id === contextMenuCategory && !category.disabled)) ||
    firstEnabledPaletteCategory ||
    null

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handlePaneContextMenu = useCallback((event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const menuWidth = 360
    const menuHeight = 420
    const viewportPadding = 12
    const maxX = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    const maxY = Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding)
    const nextClientX = Math.max(viewportPadding, Math.min(event.clientX, maxX))
    const nextClientY = Math.max(viewportPadding, Math.min(event.clientY, maxY))

    setContextMenu({
      clientX: nextClientX,
      clientY: nextClientY,
      flowPosition: screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    })
    setContextMenuCategory((current) => {
      if (current && paletteCategories.some((category) => category.id === current && !category.disabled)) {
        return current
      }
      return firstEnabledPaletteCategory?.id ?? null
    })
  }, [paletteCategories, firstEnabledPaletteCategory, screenToFlowPosition])

  const handleCanvasMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2 || !isCanvasPaneElement(event.target)) {
      rightClickOriginRef.current = null
      suppressNextCanvasContextMenuRef.current = false
      return
    }

    rightClickOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
    suppressNextCanvasContextMenuRef.current = false
  }, [])

  const handleCanvasMouseMoveCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const origin = rightClickOriginRef.current
    if (!origin) {
      return
    }

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
    if (distance >= CANVAS_CONTEXT_MENU_DRAG_THRESHOLD) {
      suppressNextCanvasContextMenuRef.current = true
    }
  }, [])

  const handleCanvasMouseUpCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      rightClickOriginRef.current = null
    }
  }, [])

  const handleCanvasContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isCanvasPaneElement(event.target)) {
      return
    }

    if (suppressNextCanvasContextMenuRef.current) {
      suppressNextCanvasContextMenuRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }

    handlePaneContextMenu(event)
  }, [handlePaneContextMenu])

  const handleContextMenuAddNode = useCallback((template: NodeTemplate) => {
    if (!contextMenu) return
    if (!isAdmin && isAiTemplateCandidate(template)) return

    handleAddNode(template, contextMenu.flowPosition)
    closeContextMenu()
  }, [closeContextMenu, contextMenu, handleAddNode, isAdmin])

  const validPinnedPaletteCategory =
    pinnedPaletteCategory &&
      paletteCategories.some((category) => category.id === pinnedPaletteCategory && !category.disabled)
      ? pinnedPaletteCategory
      : null

  const validHoveredPaletteCategory =
    hoveredPaletteCategory &&
      paletteCategories.some((category) => category.id === hoveredPaletteCategory && !category.disabled)
      ? hoveredPaletteCategory
      : null

  const activePaletteCategoryId =
    validHoveredPaletteCategory || validPinnedPaletteCategory || null

  const activePaletteCategory =
    paletteCategories.find((category) => category.id === activePaletteCategoryId) || null
  const isPaletteExpanded = Boolean(activePaletteCategory)

  useEffect(() => {
    if (!contextMenu) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeContextMenu, contextMenu])

  const defaultEdgeOptions = useMemo(() => ({
    animated: true,
    style: CANVAS_EDGE_STYLE,
    type: CANVAS_EDGE_TYPE,
  }), [])
  const connectionLineStyle = useMemo<CSSProperties>(() => ({
    ...CANVAS_EDGE_STYLE,
    strokeDasharray: '6 6',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }), [])

  const handleSettingsSave = useCallback(async () => {
    if (!onSave) return true
    const result = await onSave(nodes, edges)
    return result !== false
  }, [onSave, nodes, edges])

  const handleTemplateDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, template: NodeTemplate) => {
      if (!isAdmin && isAiTemplateCandidate(template)) {
        event.preventDefault()
        return
      }

      event.dataTransfer.setData('application/reactflow', template.type)
      event.dataTransfer.setData(
        'application/reactflow-template',
        JSON.stringify({
          id: template.id,
          type: template.type,
          data: template.data || {},
        })
      )
      event.dataTransfer.effectAllowed = 'move'
    },
    [isAdmin]
  )

  return (
    <div
      className="flow-canvas-shell w-full h-full flex"
      data-selection-mode={isSelectionModifierPressed ? 'true' : 'false'}
    >
      {/* Canvas Area */}
      <div
        className="flex-1"
        ref={canvasWrapperRef}
        onMouseDownCapture={handleCanvasMouseDownCapture}
        onMouseMoveCapture={handleCanvasMouseMoveCapture}
        onMouseUpCapture={handleCanvasMouseUpCapture}
        onContextMenu={handleCanvasContextMenu}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={closeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={connectionLineStyle}
          defaultEdgeOptions={defaultEdgeOptions}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          panOnDrag={[2]}
          panActivationKeyCode={null}
          selectionKeyCode="Shift"
          zoomOnScroll={false}
          zoomOnPinch
          minZoom={CANVAS_MIN_ZOOM}
          maxZoom={CANVAS_MAX_ZOOM}
          fitView
          className="bot-flow-canvas bg-[#05070A]"
          proOptions={{ hideAttribution: true }}
        >
          {/* Custom Grid Background */}
          <BackgroundComponent
            variant={BackgroundVariant.Lines}
            gap={24}
            size={1}
            color="rgba(255, 255, 255, 0.06)"
          />

          {/* Mini Map */}
          <MiniMap
            nodeColor={(node) => {
              const colors = {
                message: '#24A1DE',
                condition: '#F59E0B',
                router: '#EAB308',
                scheduler: '#22C55E',
                wait: '#14B8A6',
                action: '#8B5CF6',
                input: '#10B981',
                http: '#F43F5E',
                webhook: '#EF4444',
                comment: '#6B7280',
                paymentYookassa: '#38BDF8',
                paymentStripe: '#6366F1',
                paymentRobokassa: '#F97316',
                paymentStars: '#FACC15',
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
              <HelpGuideButton
                guideKey={HELP_GUIDE_KEYS.editorCanvasOverview}
                title={t('nodes')}
                summary={t('helpSummary')}
                steps={[t('helpStep1'), t('helpStep2'), t('helpStep3')]}
                notes={[t('helpNote')]}
                docsHref={`${docsBasePath}/getting-started#quick-start`}
                compact={false}
                className="h-8 w-8 bg-zinc-900/80 backdrop-blur-xl"
              />
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
                    const isLocked = Boolean(category.disabled)
                    const CategoryIcon = category.icon

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onMouseEnter={() => {
                          if (isLocked) return
                          setHoveredPaletteCategory(category.id)
                        }}
                        onFocus={() => {
                          if (isLocked) return
                          setHoveredPaletteCategory(category.id)
                        }}
                        onClick={() => {
                          if (isLocked) return
                          setPinnedPaletteCategory((prev) => (prev === category.id ? null : category.id))
                        }}
                        aria-label={`${category.label}${isPinned ? ` (${t('palette.pinned')})` : ''}${isLocked ? ` (${t('palette.aiLockedHint')})` : ''}`}
                        title={`${category.label}${category.hint ? ` • ${category.hint}` : ''}${isLocked ? ` • ${t('palette.aiLockedHint')}` : ''}${isPinned ? ` • ${t('palette.pinned')}` : ''}`}
                        className={`w-full text-left rounded-lg px-1.5 py-1.5 transition-colors border ${isLocked
                          ? 'cursor-not-allowed bg-transparent border-transparent text-zinc-500'
                          : isActive
                          ? 'bg-white/10 border-white/20 text-white'
                          : 'bg-transparent border-transparent text-zinc-300 hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="relative shrink-0">
                            <CategoryIcon className="w-3.5 h-3.5" />
                            {isLocked && (
                              <Lock className="absolute -top-1 -right-1 h-2.5 w-2.5 text-zinc-500" />
                            )}
                            {isPinned && (
                              <span className="absolute -top-1 -right-1 block h-1.5 w-1.5 rounded-full bg-[#24A1DE] ring-1 ring-zinc-900" />
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-1 py-0.5 text-[8px] leading-none border ${isLocked
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : isActive
                              ? 'border-white/20 bg-white/10 text-zinc-200'
                              : 'border-white/10 bg-zinc-900/40 text-zinc-400'
                              }`}
                          >
                            {isLocked ? (category.badge || t('palette.aiSoonBadge')) : category.templates.length}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {activePaletteCategory && (
                  <div className="min-w-0 rounded-lg border border-white/10 bg-zinc-800/20 p-2">
                    {activePaletteCategory.disabled ? (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-amber-300" />
                          <div className="text-xs font-medium text-amber-200">
                            {activePaletteCategory.badge || t('palette.aiSoonBadge')}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-amber-100/80">
                          {t('palette.aiLockedHint')}
                        </div>
                      </div>
                    ) : (
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
                          {activePaletteCategory.templates.map((node) => {
                            const fullDescription = getNodeTemplateDescription(translateCanvas, node)
                            const shortDescription = getNodeTemplateShortDescription(translateCanvas, node)
                            const helpSteps = getNodeTemplateHelpSteps(translateCanvas, node)

                            return (
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
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div className="text-xs font-medium text-white truncate">{node.label}</div>
                                      <span
                                        className="shrink-0 inline-flex items-center justify-center"
                                        onClick={(event) => event.stopPropagation()}
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onDragStart={(event) => event.preventDefault()}
                                      >
                                        <HelpGuideButton
                                          guideKey={getCanvasPaletteGuideKey(node.id)}
                                          title={node.label}
                                          summary={fullDescription}
                                          steps={helpSteps}
                                          docsHref={getNodeTemplateDocsHref(docsBasePath, node)}
                                          compact
                                          className="h-4 w-4 border-white/25 text-zinc-400 hover:text-zinc-100 hover:border-white/45"
                                          iconClassName="h-3 w-3"
                                        />
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-zinc-300/90 line-clamp-1">
                                      {shortDescription}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
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

          {contextMenu && activeContextMenuCategory && (
            <div className="fixed inset-0 z-[120]">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                onMouseDown={closeContextMenu}
                onContextMenu={(event) => {
                  event.preventDefault()
                  closeContextMenu()
                }}
                aria-label={t('contextMenuClose')}
              />

              <div
                ref={contextMenuPanelRef}
                className="absolute w-[360px] max-w-[calc(100vw-1.5rem)] max-h-[min(72vh,520px)] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/60"
                style={{
                  left: `${contextMenu.clientX}px`,
                  top: `${contextMenu.clientY}px`,
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onContextMenu={(event) => event.preventDefault()}
              >
                <div className="px-3 py-2 border-b border-white/10 bg-white/[0.03]">
                  <div className="text-xs font-semibold text-white">{t('contextMenuTitle')}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{t('contextMenuHint')}</div>
                </div>

                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-0 min-h-[250px] max-h-[430px]">
                  <div className="border-r border-white/10 bg-zinc-950/45 p-1.5 space-y-1 overflow-y-auto">
                    {paletteCategories.map((category) => {
                      const isActive = category.id === activeContextMenuCategory.id
                      const isLocked = Boolean(category.disabled)
                      const CategoryIcon = category.icon
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            if (isLocked) return
                            setContextMenuCategory(category.id)
                          }}
                          className={`w-full rounded-md px-2 py-1.5 text-left transition-colors border ${
                            isLocked
                              ? 'cursor-not-allowed bg-transparent border-transparent text-zinc-500'
                              : isActive
                              ? 'bg-white/10 border-white/20 text-white'
                              : 'bg-transparent border-transparent text-zinc-300 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CategoryIcon className="w-3 h-3 shrink-0" />
                              <span className="truncate text-[11px]">{category.label}</span>
                            </div>
                            {isLocked ? (
                              <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] text-amber-300">
                                {category.badge || t('palette.aiSoonBadge')}
                              </span>
                            ) : (
                              <span className="shrink-0 text-[9px] text-zinc-400">{category.templates.length}</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div className="p-2 space-y-1.5 overflow-y-auto">
                    {activeContextMenuCategory.templates.map((template) => {
                      const shortDescription = getNodeTemplateShortDescription(translateCanvas, template)

                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleContextMenuAddNode(template)}
                          className={`w-full text-left p-2 rounded-lg bg-gradient-to-r ${template.gradient} ${template.border} hover:scale-[1.01] transition-transform`}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className="p-1 rounded mt-0.5"
                              style={{ background: `${template.color}20` }}
                            >
                              <template.icon className="w-3.5 h-3.5" style={{ color: template.color }} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-white truncate">{template.label}</div>
                              <div className="text-[10px] text-zinc-300/90 line-clamp-1">
                                {shortDescription}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

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
          key={selectedNode?.id || 'no-node'}
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
