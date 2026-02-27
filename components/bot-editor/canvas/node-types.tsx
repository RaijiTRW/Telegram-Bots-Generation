'use client'

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'
import { useTranslations } from 'next-intl'
import {
  MessageSquare,
  GitBranch,
  Zap,
  Code2,
  Keyboard,
  Webhook,
  Globe,
  Play,
  Clock,
  Trash2,
  Settings
} from 'lucide-react'

// Base node styles
const baseNodeStyles = `
  relative px-3 py-2 rounded-lg border
  transition-all duration-200
  hover:shadow-lg
  min-w-[140px] max-w-[200px]
`

const getNodeStyles = (type: string) => {
  switch (type) {
    case 'message':
      return `${baseNodeStyles} bg-blue-500/10 border-blue-500/30`
    case 'condition':
      return `${baseNodeStyles} bg-amber-500/10 border-amber-500/30`
    case 'router':
      return `${baseNodeStyles} bg-yellow-500/10 border-yellow-500/30`
    case 'scheduler':
      return `${baseNodeStyles} bg-emerald-500/10 border-emerald-500/30`
    case 'replyKeyboard':
      return `${baseNodeStyles} bg-sky-500/10 border-sky-500/30`
    case 'script':
      return `${baseNodeStyles} bg-cyan-500/10 border-cyan-500/30`
    case 'action':
      return `${baseNodeStyles} bg-purple-500/10 border-purple-500/30`
    case 'input':
      return `${baseNodeStyles} bg-green-500/10 border-green-500/30`
    case 'http':
      return `${baseNodeStyles} bg-rose-500/10 border-rose-500/30`
    case 'webhook':
      return `${baseNodeStyles} bg-red-500/10 border-red-500/30`
    case 'trigger':
      return `${baseNodeStyles} bg-indigo-500/10 border-indigo-500/30`
    default:
      return `${baseNodeStyles} bg-zinc-500/10 border-zinc-500/30`
  }
}

const getNodeIcon = (type: string) => {
  const iconClassName = "w-3.5 h-3.5"
  const nodeColor = getNodeColor(type)

  switch (type) {
    case 'message':
      return <MessageSquare className={iconClassName} style={{ color: nodeColor }} />
    case 'condition':
      return <GitBranch className={iconClassName} style={{ color: nodeColor }} />
    case 'router':
      return <GitBranch className={iconClassName} style={{ color: nodeColor }} />
    case 'scheduler':
      return <Clock className={iconClassName} style={{ color: nodeColor }} />
    case 'replyKeyboard':
      return <Keyboard className={iconClassName} style={{ color: nodeColor }} />
    case 'script':
      return <Code2 className={iconClassName} style={{ color: nodeColor }} />
    case 'action':
      return <Zap className={iconClassName} style={{ color: nodeColor }} />
    case 'input':
      return <Keyboard className={iconClassName} style={{ color: nodeColor }} />
    case 'http':
      return <Globe className={iconClassName} style={{ color: nodeColor }} />
    case 'webhook':
      return <Webhook className={iconClassName} style={{ color: nodeColor }} />
    case 'trigger':
      return <Play className={iconClassName} style={{ color: nodeColor }} />
    default:
      return <Settings className={iconClassName} style={{ color: nodeColor }} />
  }
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'message': return '#24A1DE'
    case 'condition': return '#F59E0B'
    case 'router': return '#EAB308'
    case 'scheduler': return '#22C55E'
    case 'replyKeyboard': return '#0EA5E9'
    case 'script': return '#06B6D4'
    case 'action': return '#8B5CF6'
    case 'input': return '#10B981'
    case 'http': return '#F43F5E'
    case 'webhook': return '#EF4444'
    case 'trigger': return '#6366F1'
    default: return '#71717A'
  }
}

interface RouterCasePreview {
  id: string
  label: string
  value: string
}

type CanvasT = (key: string, values?: Record<string, unknown>) => string

const getRouterCases = (data: Record<string, unknown>): RouterCasePreview[] => {
  if (!Array.isArray(data.cases)) {
    return []
  }

  return data.cases
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const id = String(record.id || `case_${index + 1}`).trim()
      if (!id) return null
      const label = String(record.label || '').trim() || `Case ${index + 1}`
      const value = record.value == null ? '' : String(record.value)
      return { id, label, value }
    })
    .filter((item): item is RouterCasePreview => Boolean(item))
}

const getTriggerNodeLabel = (data: Record<string, unknown>): string => {
  if (Boolean(data.aiEnabled)) {
    return 'AI Trigger'
  }

  const triggerType = String(data.trigger || 'command')

  switch (triggerType) {
    case 'callbackQuery':
      return 'Callback Trigger'
    case 'text':
      return 'Text Trigger'
    case 'photo':
      return 'Photo Trigger'
    case 'any':
      return 'Any Trigger'
    case 'schedule':
      return 'Schedule Trigger'
    case 'command':
    default:
      return 'Command Trigger'
  }
}

const getTriggerNodeDescription = (
  data: Record<string, unknown>,
  t?: CanvasT
): string => {
  const tr = (key: string, fallback: string, values?: Record<string, unknown>) => {
    if (!t) return fallback
    return t(`nodeDescriptions.trigger.${key}`, values)
  }

  if (Boolean(data.aiEnabled)) {
    const prompt = String(data.aiPrompt || '').trim()
    return prompt
      ? tr('aiIntentPrompt', `AI intent • ${prompt.slice(0, 42)}`, { prompt: prompt.slice(0, 42) })
      : tr('aiIntentSoon', 'AI intent / semantic match (soon)')
  }

  const triggerType = String(data.trigger || 'command')
  const pattern = String(data.pattern || '').trim()

  switch (triggerType) {
    case 'callbackQuery':
      return pattern
        ? tr('callbackPattern', `Callback: ${pattern}`, { pattern })
        : tr('anyCallback', 'Starts on any callback')
    case 'text':
      return pattern
        ? tr('textPattern', `Matches text: ${pattern}`, { pattern })
        : tr('incomingText', 'Matches incoming text')
    case 'photo':
      return tr('photo', 'Starts on photo')
    case 'any':
      return tr('anyUpdate', 'Starts on any update')
    case 'schedule': {
      const scheduleMode = String(data.scheduleMode || 'daily')
      const timeZone = String(data.timeZone || 'UTC').trim() || 'UTC'
      if (scheduleMode === 'hourly') {
        const everyHours = Math.max(1, Number(data.everyHours || 1) || 1)
        const atMinute = Math.max(0, Math.min(59, Number(data.atMinute || 0) || 0))
        const minute = String(atMinute).padStart(2, '0')
        return tr(
          'scheduleHourly',
          `Every ${everyHours}h at :${minute} • ${timeZone}`,
          { everyHours, minute, timeZone }
        )
      }
      const atTime = String(data.atTime || '10:00').trim() || '10:00'
      return tr('scheduleDaily', `Daily ${atTime} • ${timeZone}`, { atTime, timeZone })
    }
    case 'command':
    default:
      return tr('command', `Starts on ${pattern || '/start'}`, { pattern: pattern || '/start' })
  }
}

// Base Custom Node Component
const CustomNode = ({ id, data, type, selected }: NodeProps) => {
  const tCanvas = useTranslations('editor.canvas')
  const updateNodeInternals = useUpdateNodeInternals()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const routerCaseRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [routerCaseHandleTops, setRouterCaseHandleTops] = useState<Record<string, number>>({})
  const nodeColor = getNodeColor(type || data.type)
  const normalizedType = type || data.type
  const dataRecord = data as Record<string, unknown>
  const triggerData =
    normalizedType === 'trigger' ? dataRecord : null
  const actionType =
    normalizedType === 'action' && dataRecord.action && typeof dataRecord.action === 'object'
      ? String((dataRecord.action as Record<string, unknown>).type || '')
      : ''
  const scriptLanguage =
    normalizedType === 'script' ? String(dataRecord.language || 'javascript').trim() || 'javascript' : 'javascript'
  const scriptSaveToVariable =
    normalizedType === 'script' ? String(dataRecord.saveToVariable || '').trim() : ''
  const isRandomSplitAction = normalizedType === 'action' && actionType === 'random'
  const randomSplitAPercent = isRandomSplitAction
    ? Math.min(
      100,
      Math.max(
        0,
        Number(
          (dataRecord.action as Record<string, unknown> | undefined)?.aPercent ??
          (dataRecord.action as Record<string, unknown> | undefined)?.percent ??
          50
        ) || 0
      )
    )
    : 50
  const routerCases = useMemo(
    () => (normalizedType === 'router' ? getRouterCases(dataRecord) : []),
    [normalizedType, dataRecord]
  )
  const routerVariable =
    normalizedType === 'router' ? String(dataRecord.variable || '').trim() : ''
  const routerDefaultLabel =
    normalizedType === 'router'
      ? String(dataRecord.defaultLabel || '').trim() || tCanvas('nodeDescriptions.defaults.default')
      : tCanvas('nodeDescriptions.defaults.default')
  const routerCasesSignature =
    normalizedType === 'router'
      ? routerCases.map((routerCase) => `${routerCase.id}:${routerCase.label}:${routerCase.value}`).join('|')
      : ''
  const schedulerMode =
    normalizedType === 'scheduler' ? String(dataRecord.mode || 'delay') : 'delay'
  const schedulerDelayValue =
    normalizedType === 'scheduler' ? Number(dataRecord.delayValue ?? 0) : 0
  const schedulerDelayUnit =
    normalizedType === 'scheduler' ? String(dataRecord.delayUnit || 'minutes') : 'minutes'
  const schedulerDateTime =
    normalizedType === 'scheduler' ? String(dataRecord.dateTime || '').trim() : ''
  const schedulerTimeZone =
    normalizedType === 'scheduler' ? String(dataRecord.timeZone || '').trim() : ''
  const replyKeyboardMode =
    normalizedType === 'replyKeyboard' ? String(dataRecord.mode || 'system').trim() || 'system' : 'system'
  const replyKeyboardVariantKey =
    normalizedType === 'replyKeyboard' ? String(dataRecord.variantKey || '').trim() : ''
  const replyKeyboardVariable =
    normalizedType === 'replyKeyboard' ? String(dataRecord.variable || '').trim() : ''
  const schedulerDelayUnitLabel =
    normalizedType === 'scheduler'
      ? ({
        seconds: tCanvas('nodeDescriptions.scheduler.units.seconds'),
        minutes: tCanvas('nodeDescriptions.scheduler.units.minutes'),
        hours: tCanvas('nodeDescriptions.scheduler.units.hours'),
        days: tCanvas('nodeDescriptions.scheduler.units.days'),
      } as Record<string, string>)[schedulerDelayUnit] || schedulerDelayUnit
      : schedulerDelayUnit

  const nodeLabel =
    normalizedType === 'trigger' && triggerData
      ? getTriggerNodeLabel(triggerData)
      : String(dataRecord.__label ?? dataRecord.label ?? normalizedType)
  const nodeDescriptionRaw =
    normalizedType === 'router'
      ? tCanvas('nodeDescriptions.router.summary', {
        variable: routerVariable || tCanvas('nodeDescriptions.defaults.variable'),
        count: routerCases.length,
        casesWord: tCanvas('nodeDescriptions.defaults.cases'),
      })
      : isRandomSplitAction
        ? `A ${randomSplitAPercent}% • B ${100 - randomSplitAPercent}%`
        : normalizedType === 'scheduler'
          ? schedulerMode === 'dateTime'
            ? tCanvas('nodeDescriptions.scheduler.at', {
              dateTime: schedulerDateTime || tCanvas('nodeDescriptions.defaults.dateTime'),
              timeZoneSuffix: schedulerTimeZone ? ` • ${schedulerTimeZone}` : '',
            })
            : tCanvas('nodeDescriptions.scheduler.delay', {
              value: Number.isFinite(schedulerDelayValue) ? schedulerDelayValue : 0,
              unit: schedulerDelayUnitLabel,
            })
          : normalizedType === 'replyKeyboard'
            ? replyKeyboardMode === 'clear'
              ? tCanvas('nodeDescriptions.replyKeyboard.hide')
              : replyKeyboardMode === 'variant'
                ? tCanvas('nodeDescriptions.replyKeyboard.variant', {
                  variant: replyKeyboardVariantKey || 'base',
                })
                : replyKeyboardMode === 'condition'
                  ? tCanvas('nodeDescriptions.replyKeyboard.condition', {
                    variable: replyKeyboardVariable || tCanvas('nodeDescriptions.defaults.variable'),
                  })
                  : tCanvas('nodeDescriptions.replyKeyboard.system')
            : normalizedType === 'script'
              ? `${scriptLanguage === 'python' ? 'Python' : 'JavaScript'}${scriptSaveToVariable ? ` • -> ${scriptSaveToVariable}` : ''}`
              : normalizedType === 'trigger' && triggerData
                ? getTriggerNodeDescription(triggerData, tCanvas as any)
                : dataRecord.__description ?? dataRecord.description
  const nodeDescription =
    typeof nodeDescriptionRaw === 'string'
      ? nodeDescriptionRaw
      : nodeDescriptionRaw == null
        ? ''
        : String(nodeDescriptionRaw)

  const setRouterCaseRowRef = useCallback((caseId: string, element: HTMLDivElement | null) => {
    routerCaseRowRefs.current[caseId] = element
  }, [])

  useLayoutEffect(() => {
    if (normalizedType !== 'router') {
      return
    }

    const rootEl = rootRef.current
    if (!rootEl) {
      return
    }

    let rafId = 0
    const measureAndSync = () => {
      const nextTops: Record<string, number> = {}
      for (const routerCase of routerCases) {
        const rowEl = routerCaseRowRefs.current[routerCase.id]
        if (!rowEl) continue
        nextTops[routerCase.id] = rowEl.offsetTop + (rowEl.offsetHeight / 2)
      }

      setRouterCaseHandleTops((prev) => {
        const prevJson = JSON.stringify(prev)
        const nextJson = JSON.stringify(nextTops)
        return prevJson === nextJson ? prev : nextTops
      })

      updateNodeInternals(id)
    }

    rafId = window.requestAnimationFrame(measureAndSync)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        measureAndSync()
      })
      resizeObserver.observe(rootEl)
      for (const routerCase of routerCases) {
        const rowEl = routerCaseRowRefs.current[routerCase.id]
        if (rowEl) resizeObserver.observe(rowEl)
      }
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
    }
  }, [id, normalizedType, routerCases, routerCasesSignature, routerDefaultLabel, updateNodeInternals])

  return (
    <div
      ref={rootRef}
      className={`${getNodeStyles(normalizedType)} ${selected ? 'ring-2 ring-white/50' : ''}`}
    >
      {/* Input Handle */}
      {type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-2 !h-2 !border-2 !border-white/20 !bg-transparent"
          style={{ background: 'transparent' }}
        />
      )}

      {/* Node Header */}
      <div className="flex items-center gap-1.5">
        <div
          className="p-1 rounded"
          style={{ backgroundColor: `${nodeColor}33` }}
        >
          {getNodeIcon(normalizedType)}
        </div>
        <div className="text-xs font-medium text-white capitalize truncate">
          {nodeLabel}
        </div>
      </div>

      {/* Node Content */}
      {nodeDescription && (
        <div className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
          {nodeDescription}
        </div>
      )}

      {normalizedType === 'router' && (
        <div className="mt-2 space-y-1 pr-3">
          {routerCases.map((routerCase) => (
            <div
              key={routerCase.id}
              ref={(element) => setRouterCaseRowRef(routerCase.id, element)}
              className="rounded border border-white/10 bg-black/20 px-2 py-1 pr-6 text-[10px] text-zinc-300 flex items-center justify-between gap-2"
              title={routerCase.value}
            >
              <span className="block min-w-0 truncate">
                <span className="text-white">{routerCase.label}</span>
                {routerCase.value && (
                  <span className="text-zinc-500"> = {routerCase.value}</span>
                )}
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 text-[9px] text-cyan-300/90">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-300/90" />
                →
              </span>
            </div>
          ))}
          <div className="text-[10px] text-zinc-500 px-1">
            {tCanvas('nodeDescriptions.router.bottomOutput')}: <span className="text-zinc-300">{routerDefaultLabel}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {selected && (
        <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1">
          <button
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors"
            onClick={() => data.onDelete?.(id)}
          >
            <Trash2 className="w-2.5 h-2.5 text-red-400" />
          </button>
        </div>
      )}

      {/* Output Handle */}
      {type !== 'router' && type !== 'condition' && !isRandomSplitAction && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={true}
            className="!w-2 !h-2 !border-2 !border-white/20"
            style={{ background: 'transparent' }}
          />
        </>
      )}

      {isRandomSplitAction && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="a"
            isConnectable={true}
            className="!w-2 !h-2 !border-2 !border-sky-300/70"
            style={{ background: 'rgba(56, 189, 248, 0.9)', left: '38%' }}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-sky-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.12)]"
            style={{ left: '38%' }}
          >
            A
          </div>

          <Handle
            type="source"
            position={Position.Bottom}
            id="b"
            isConnectable={true}
            className="!w-2 !h-2 !border-2 !border-violet-300/70"
            style={{ background: 'rgba(167, 139, 250, 0.9)', left: '62%' }}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-violet-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.12)]"
            style={{ left: '62%' }}
          >
            B
          </div>
        </>
      )}

      {type === 'router' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={true}
            className="!w-2 !h-2 !border-2 !border-zinc-300/60"
            style={{ background: 'rgba(161, 161, 170, 0.9)' }}
          />
          {routerCases.map((routerCase, index) => {
            const fallbackTopPercent =
              routerCases.length === 1
                ? 58
                : 44 + ((index + 1) * 36) / (routerCases.length + 1)
            const measuredTopPx = routerCaseHandleTops[routerCase.id]
            const caseLabel = (routerCase.label || `Case ${index + 1}`).trim()
            const caseTooltip = routerCase.value
              ? `${caseLabel} = ${routerCase.value}`
              : caseLabel

            return (
              <div key={routerCase.id}>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`case:${routerCase.id}`}
                  className="!w-2 !h-2 !border-2 !border-cyan-300/70"
                  style={{
                    background: 'rgba(103, 232, 249, 0.9)',
                    top: measuredTopPx != null ? `${measuredTopPx}px` : `${fallbackTopPercent}%`,
                  }}
                />
                <div
                  className="pointer-events-none absolute z-20 left-full ml-2 -translate-y-1/2 max-w-[130px] truncate whitespace-nowrap rounded bg-black/85 border border-cyan-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-cyan-300 shadow-[0_0_10px_rgba(36,161,222,0.12)]"
                  style={{ top: measuredTopPx != null ? `${measuredTopPx}px` : `${fallbackTopPercent}%` }}
                  title={caseTooltip}
                >
                  {caseLabel}
                </div>
              </div>
            )
          })}
          <div
            className="pointer-events-none absolute z-20 left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-zinc-400/20 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.04)]"
            title={routerDefaultLabel}
          >
            {routerDefaultLabel}
          </div>
        </>
      )}

      {/* Condition outputs (bottom-left = true, bottom-right = false) */}
      {type === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={true}
            className="!w-2 !h-2 !border-2 !border-emerald-300/70"
            style={{ background: 'rgba(16, 185, 129, 0.9)', left: '38%' }}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-emerald-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.12)]"
            style={{ left: '38%' }}
          >
            {tCanvas('nodeDescriptions.condition.true')}
          </div>

          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className="!w-2 !h-2 !border-2 !border-rose-300/70"
            style={{ background: 'rgba(244, 63, 94, 0.9)', left: '62%' }}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-rose-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.12)]"
            style={{ left: '62%' }}
          >
            {tCanvas('nodeDescriptions.condition.false')}
          </div>
        </>
      )}
    </div>
  )
}

// Memoized node components for each type
const MessageNodeComponent = (props: NodeProps) => <CustomNode {...props} type="message" />
const ConditionNodeComponent = (props: NodeProps) => <CustomNode {...props} type="condition" />
const RouterNodeComponent = (props: NodeProps) => <CustomNode {...props} type="router" />
const SchedulerNodeComponent = (props: NodeProps) => <CustomNode {...props} type="scheduler" />
const ReplyKeyboardNodeComponent = (props: NodeProps) => <CustomNode {...props} type="replyKeyboard" />
const ScriptNodeComponent = (props: NodeProps) => <CustomNode {...props} type="script" />
const ActionNodeComponent = (props: NodeProps) => <CustomNode {...props} type="action" />
const InputNodeComponent = (props: NodeProps) => <CustomNode {...props} type="input" />
const HttpNodeComponent = (props: NodeProps) => <CustomNode {...props} type="http" />
const WebhookNodeComponent = (props: NodeProps) => <CustomNode {...props} type="webhook" />
const TriggerNodeComponent = (props: NodeProps) => <CustomNode {...props} type="trigger" />

MessageNodeComponent.displayName = 'MessageNodeComponent'
ConditionNodeComponent.displayName = 'ConditionNodeComponent'
RouterNodeComponent.displayName = 'RouterNodeComponent'
SchedulerNodeComponent.displayName = 'SchedulerNodeComponent'
ReplyKeyboardNodeComponent.displayName = 'ReplyKeyboardNodeComponent'
ScriptNodeComponent.displayName = 'ScriptNodeComponent'
ActionNodeComponent.displayName = 'ActionNodeComponent'
InputNodeComponent.displayName = 'InputNodeComponent'
HttpNodeComponent.displayName = 'HttpNodeComponent'
WebhookNodeComponent.displayName = 'WebhookNodeComponent'
TriggerNodeComponent.displayName = 'TriggerNodeComponent'

export const MessageNode = memo(MessageNodeComponent)
export const ConditionNode = memo(ConditionNodeComponent)
export const RouterNode = memo(RouterNodeComponent)
export const SchedulerNode = memo(SchedulerNodeComponent)
export const ReplyKeyboardNode = memo(ReplyKeyboardNodeComponent)
export const ScriptNode = memo(ScriptNodeComponent)
export const ActionNode = memo(ActionNodeComponent)
export const InputNode = memo(InputNodeComponent)
export const HttpNode = memo(HttpNodeComponent)
export const WebhookNode = memo(WebhookNodeComponent)
export const TriggerNode = memo(TriggerNodeComponent)

// Node type mapping for ReactFlow
export const nodeTypes = {
  message: MessageNode,
  condition: ConditionNode,
  router: RouterNode,
  scheduler: SchedulerNode,
  replyKeyboard: ReplyKeyboardNode,
  script: ScriptNode,
  action: ActionNode,
  input: InputNode,
  http: HttpNode,
  webhook: WebhookNode,
  trigger: TriggerNode,
}

export interface NodeTemplate {
  id: string
  type: string
  label: string
  description: string
  color: string
  gradient: string
  border: string
  icon: ComponentType<{ className?: string; style?: CSSProperties }>
  data?: Record<string, unknown>
}

// Node templates for palette
export const nodeTemplates: NodeTemplate[] = [
  {
    id: 'trigger-command',
    type: 'trigger',
    label: 'Command Trigger',
    description: 'Start workflow when user sends command',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'command',
      pattern: '/start',
      __label: 'Command Trigger',
      __description: 'Starts on command',
    },
  },
  {
    id: 'trigger-text',
    type: 'trigger',
    label: 'Text Trigger',
    description: 'Start workflow when incoming text matches pattern',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'text',
      pattern: '',
      __label: 'Text Trigger',
      __description: 'Starts on message text',
    },
  },
  {
    id: 'trigger-callback',
    type: 'trigger',
    label: 'Callback Trigger',
    description: 'Start workflow from inline button click',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'callbackQuery',
      pattern: '',
      __label: 'Callback Trigger',
      __description: 'Starts on callback query',
    },
  },
  {
    id: 'trigger-schedule',
    type: 'trigger',
    label: 'Schedule Trigger',
    description: 'Start workflow on recurring time schedule',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'schedule',
      scheduleMode: 'daily',
      everyHours: 1,
      atMinute: 0,
      atTime: '10:00',
      timeZone: 'UTC',
      targetChatId: '',
      targetUserId: '',
      __label: 'Schedule Trigger',
      __description: 'Starts on recurring schedule',
    },
  },
  {
    id: 'trigger-ai',
    type: 'trigger',
    label: 'AI Trigger',
    description: 'Start workflow by AI intent / semantic text match',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-indigo-600/10',
    border: 'border-indigo-500/30',
    icon: Play,
    data: {
      trigger: 'text',
      pattern: '',
      aiEnabled: true,
      aiNodeKind: 'trigger',
      aiPrompt: '',
      aiModel: 'auto',
      __label: 'AI Trigger',
      __description: 'AI intent / semantic trigger (soon)',
    },
  },
  {
    id: 'message',
    type: 'message',
    label: 'Message',
    description: 'Send text, images, or media to user',
    color: '#24A1DE',
    gradient: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/30',
    icon: MessageSquare
  },
  {
    id: 'message-ai',
    type: 'message',
    label: 'AI Message',
    description: 'Generate message text with AI (fallback text supported)',
    color: '#24A1DE',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    border: 'border-cyan-400/30',
    icon: MessageSquare,
    data: {
      aiEnabled: true,
      aiNodeKind: 'message',
      aiPrompt: '',
      aiSystemPrompt: '',
      aiModel: 'auto',
      text: 'AI Message (soon). Пока используйте этот fallback текст.',
      parseMode: 'None',
      __label: 'AI Message',
      __description: 'AI-generated reply (soon)',
    },
  },
  {
    id: 'condition',
    type: 'condition',
    label: 'Condition',
    description: 'Branch workflow based on conditions',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 to-amber-600/10',
    border: 'border-amber-500/30',
    icon: GitBranch
  },
  {
    id: 'condition-ai',
    type: 'condition',
    label: 'AI Logic',
    description: 'Branch by AI classification / intent (fallback condition available)',
    color: '#F59E0B',
    gradient: 'from-amber-500/20 to-orange-600/10',
    border: 'border-amber-400/30',
    icon: GitBranch,
    data: {
      aiEnabled: true,
      aiNodeKind: 'logic',
      aiPrompt: '',
      aiModel: 'auto',
      variable: 'message.text',
      operator: 'contains',
      value: '?',
      trueLabel: 'True',
      falseLabel: 'False',
      __label: 'AI Logic',
      __description: 'AI branching / classification (soon)',
    },
  },
  {
    id: 'router',
    type: 'router',
    label: 'Router / Switch',
    description: 'Branch to multiple paths by variable value',
    color: '#EAB308',
    gradient: 'from-yellow-500/20 to-amber-600/10',
    border: 'border-yellow-500/30',
    icon: GitBranch,
    data: {
      variable: '',
      operator: 'equals',
      cases: [
        { id: 'case_1', label: 'Case 1', value: '' },
        { id: 'case_2', label: 'Case 2', value: '' },
      ],
      defaultLabel: 'Default',
      __label: 'Router / Switch',
      __description: 'Branch by variable value',
    },
  },
  {
    id: 'scheduler',
    type: 'scheduler',
    label: 'Date/Time Scheduler',
    description: 'Continue workflow later (timezone-aware)',
    color: '#22C55E',
    gradient: 'from-emerald-500/20 to-green-600/10',
    border: 'border-emerald-500/30',
    icon: Clock,
    data: {
      mode: 'delay',
      delayValue: 5,
      delayUnit: 'minutes',
      dateTime: '',
      timeZone: 'UTC',
      saveToVariable: '',
      __label: 'Date/Time Scheduler',
      __description: 'Continue later (timezone-aware)',
    },
  },
  {
    id: 'reply-keyboard',
    type: 'replyKeyboard',
    label: 'Reply Keyboard',
    description: 'Control Telegram base keyboard (system / variant / clear)',
    color: '#0EA5E9',
    gradient: 'from-sky-500/20 to-sky-600/10',
    border: 'border-sky-500/30',
    icon: Keyboard,
    data: {
      mode: 'system',
      variantKey: 'base',
      variable: '',
      operator: 'equals',
      value: '',
      trueMode: 'variant',
      trueVariantKey: 'base',
      falseMode: 'system',
      falseVariantKey: '',
      __label: 'Reply Keyboard',
      __description: 'Use system reply keyboard',
    },
  },
  {
    id: 'script',
    type: 'script',
    label: 'Script',
    description: 'Run JavaScript or Python transform code',
    color: '#06B6D4',
    gradient: 'from-cyan-500/20 to-cyan-600/10',
    border: 'border-cyan-500/30',
    icon: Code2,
    data: {
      language: 'javascript',
      inputPath: '',
      saveToVariable: '',
      timeoutMs: 1000,
      code: [
        '// Use `input`, `context`, `vars` and assign to `result`.',
        '// Example:',
        "result = String(input ?? '').toUpperCase()",
      ].join('\n'),
      __label: 'Script',
      __description: 'Run JS/Python code',
    },
  },
  {
    id: 'action',
    type: 'action',
    label: 'Action',
    description: 'Perform custom actions',
    color: '#8B5CF6',
    gradient: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    icon: Zap
  },
  {
    id: 'input',
    type: 'input',
    label: 'Input',
    description: 'Request user input or data',
    color: '#10B981',
    gradient: 'from-green-500/20 to-green-600/10',
    border: 'border-green-500/30',
    icon: Keyboard
  },
  {
    id: 'http',
    type: 'http',
    label: 'HTTP',
    description: 'Make HTTP requests to external APIs',
    color: '#F43F5E',
    gradient: 'from-rose-500/20 to-rose-600/10',
    border: 'border-rose-500/30',
    icon: Globe,
  },
  // Legacy 'webhook' node type is still supported in runtime/config,
  // but hidden from palette in favor of the dedicated HTTP node.
]
