'use client'

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow'
import { useTranslations } from 'next-intl'
import {
  MessageSquare,
  MessageCircle,
  GitBranch,
  Zap,
  Code2,
  Keyboard,
  Webhook,
  Globe,
  Play,
  Clock,
  CreditCard,
  Star,
  Trash2,
  Settings,
  Plus,
  Variable,
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
    case 'wait':
      return `${baseNodeStyles} bg-teal-500/10 border-teal-500/30`
    case 'script':
      return `${baseNodeStyles} bg-cyan-500/10 border-cyan-500/30`
    case 'action':
      return `${baseNodeStyles} bg-purple-500/10 border-purple-500/30`
    case 'setVariable':
      return `${baseNodeStyles} bg-emerald-500/10 border-emerald-500/30`
    case 'input':
      return `${baseNodeStyles} bg-green-500/10 border-green-500/30`
    case 'http':
      return `${baseNodeStyles} bg-rose-500/10 border-rose-500/30`
    case 'webhook':
      return `${baseNodeStyles} bg-red-500/10 border-red-500/30`
    case 'paymentYookassa':
      return `${baseNodeStyles} bg-sky-500/10 border-sky-500/30`
    case 'paymentStripe':
      return `${baseNodeStyles} bg-indigo-500/10 border-indigo-500/30`
    case 'paymentRobokassa':
      return `${baseNodeStyles} bg-orange-500/10 border-orange-500/30`
    case 'paymentStars':
      return `${baseNodeStyles} bg-yellow-400/10 border-yellow-400/30`
    case 'trigger':
      return `${baseNodeStyles} bg-indigo-500/10 border-indigo-500/30`
    case 'comment':
      return `${baseNodeStyles} bg-zinc-500/10 border-zinc-500/30 border-dashed`
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
    case 'wait':
      return <Clock className={iconClassName} style={{ color: nodeColor }} />
    case 'script':
      return <Code2 className={iconClassName} style={{ color: nodeColor }} />
    case 'action':
      return <Zap className={iconClassName} style={{ color: nodeColor }} />
    case 'setVariable':
      return <Variable className={iconClassName} style={{ color: nodeColor }} />
    case 'input':
      return <Keyboard className={iconClassName} style={{ color: nodeColor }} />
    case 'http':
      return <Globe className={iconClassName} style={{ color: nodeColor }} />
    case 'webhook':
      return <Webhook className={iconClassName} style={{ color: nodeColor }} />
    case 'paymentYookassa':
    case 'paymentStripe':
    case 'paymentRobokassa':
      return <CreditCard className={iconClassName} style={{ color: nodeColor }} />
    case 'paymentStars':
      return <Star className={iconClassName} style={{ color: nodeColor }} />
    case 'trigger':
      return <Play className={iconClassName} style={{ color: nodeColor }} />
    case 'comment':
      return <MessageCircle className={iconClassName} style={{ color: nodeColor }} />
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
    case 'wait': return '#14B8A6'
    case 'script': return '#06B6D4'
    case 'action': return '#8B5CF6'
    case 'setVariable': return '#10B981'
    case 'input': return '#10B981'
    case 'http': return '#F43F5E'
    case 'webhook': return '#EF4444'
    case 'paymentYookassa': return '#38BDF8'
    case 'paymentStripe': return '#6366F1'
    case 'paymentRobokassa': return '#F97316'
    case 'paymentStars': return '#FACC15'
    case 'trigger': return '#6366F1'
    case 'comment': return '#6B7280'
    default: return '#71717A'
  }
}

interface RouterCasePreview {
  id: string
  label: string
  value: string
}

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

type InsertMenuDirection = 'top' | 'bottom' | 'right'

type InsertMenuRequest = {
  clientX: number
  clientY: number
  nodeId: string
  direction: InsertMenuDirection
  sourceHandle?: string | null
}

type InsertMenuOpener = (request: InsertMenuRequest) => void
const CONNECTION_HANDLE_POINTER_DOWN_EVENT = 'bot-flow-connection-handle-pointer-down'
const DEFAULT_HANDLE_KEY = '__default__'

function getHandleKey(handleId?: string | null): string {
  return handleId && handleId.trim() ? handleId : DEFAULT_HANDLE_KEY
}

function getInsertButtonPositionStyle(
  direction: InsertMenuDirection,
  anchorStyle?: CSSProperties
): CSSProperties {
  const baseStyle = { ...(anchorStyle || {}) }

  if (direction === 'top') {
    return {
      ...baseStyle,
      left: baseStyle.left ?? '50%',
      top: baseStyle.top ?? 0,
      transform: 'translate(-50%, calc(-100% - 10px))',
    }
  }

  if (direction === 'right') {
    return {
      ...baseStyle,
      left: '100%',
      transform: 'translate(10px, -50%)',
    }
  }

  return {
    ...baseStyle,
    left: baseStyle.left ?? '50%',
    top: '100%',
    transform: 'translate(-50%, 10px)',
  }
}

interface HandleInsertButtonProps {
  nodeId: string
  direction: InsertMenuDirection
  handleType: 'source' | 'target'
  handlePosition: Position
  nodeColor: string
  ariaLabel: string
  onOpen?: InsertMenuOpener
  style?: CSSProperties
  sourceHandle?: string | null
  isConnected?: boolean
}

function HandleInsertButton({
  nodeId,
  direction,
  handleType,
  handlePosition,
  nodeColor,
  ariaLabel,
  onOpen,
  style,
  sourceHandle,
  isConnected = false,
}: HandleInsertButtonProps) {
  if (!onOpen) {
    return null
  }

  return (
    <Handle
      type={handleType}
      position={handlePosition}
      id={handleType === 'source' ? sourceHandle || undefined : undefined}
      isConnectable={true}
      className={`!absolute !z-30 !flex !items-center !justify-center !rounded-full !border !transition-all !duration-150 ${
        isConnected
          ? '!h-[10px] !w-[10px] !border-cyan-300/70 !bg-cyan-300 !text-transparent !shadow-[0_0_0_3px_rgba(34,211,238,0.12),0_0_12px_rgba(34,211,238,0.38)]'
          : '!h-[18px] !w-[18px] !border-white/15 !bg-black/90 !text-white/75 !shadow-[0_6px_18px_rgba(0,0,0,0.28)] hover:!scale-105 hover:!text-white'
      }`}
      style={{
        ...getInsertButtonPositionStyle(direction, style),
        boxShadow: isConnected
          ? `0 0 0 3px ${nodeColor}18, 0 0 12px ${nodeColor}55`
          : `0 0 0 1px ${nodeColor}25, 0 8px 20px rgba(0, 0, 0, 0.28)`,
      }}
      aria-label={ariaLabel}
      onPointerDownCapture={() => {
        window.dispatchEvent(new CustomEvent(CONNECTION_HANDLE_POINTER_DOWN_EVENT, {
          detail: {
            nodeId,
            handleId: handleType === 'source' ? (sourceHandle || null) : null,
            handleType,
          },
        }))
      }}
      onClick={(event) => {
        if (isConnected) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        const bounds = event.currentTarget.getBoundingClientRect()
        onOpen({
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2,
          nodeId,
          direction,
          sourceHandle,
        })
      }}
    >
      {isConnected ? null : <Plus className="pointer-events-none h-2.5 w-2.5" />}
    </Handle>
  )
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
  const openInsertMenu =
    typeof dataRecord.onOpenInsertMenu === 'function'
      ? (dataRecord.onOpenInsertMenu as InsertMenuOpener)
      : undefined
  const actionType =
    normalizedType === 'action' && dataRecord.action && typeof dataRecord.action === 'object'
      ? String((dataRecord.action as Record<string, unknown>).type || '')
      : ''
  const isRandomSplitAction = normalizedType === 'action' && actionType === 'random'
  const routerCases = useMemo(
    () => (normalizedType === 'router' ? getRouterCases(dataRecord) : []),
    [normalizedType, dataRecord]
  )
  const routerDefaultLabel =
    normalizedType === 'router'
      ? String(dataRecord.defaultLabel || '').trim() || tCanvas('nodeDescriptions.defaults.default')
      : tCanvas('nodeDescriptions.defaults.default')
  const routerCasesSignature =
    normalizedType === 'router'
      ? routerCases.map((routerCase) => `${routerCase.id}:${routerCase.label}:${routerCase.value}`).join('|')
      : ''
  const customNodeLabel = String(dataRecord.__label || '').trim()
  const nodeLabel = customNodeLabel || (
    normalizedType === 'trigger'
      ? getTriggerNodeLabel(dataRecord)
      : String(dataRecord.label ?? normalizedType)
  )
  const commentPreview =
    normalizedType === 'comment'
      ? String(dataRecord.text || '').trim()
      : ''
  const isGroupComment = normalizedType === 'comment' && dataRecord.commentMode === 'group'
  const groupCommentWidth = Math.max(180, Number(dataRecord.width || 260))
  const groupCommentHeight = Math.max(120, Number(dataRecord.height || 180))
  const waitPreview =
    normalizedType === 'wait'
      ? String(dataRecord.waitFor || '').trim()
      : ''
  const connectedSourceHandles = new Set(
    Array.isArray(dataRecord.__connectedSourceHandles)
      ? dataRecord.__connectedSourceHandles.map((handle) => String(handle))
      : []
  )
  const connectedTargetHandles = new Set(
    Array.isArray(dataRecord.__connectedTargetHandles)
      ? dataRecord.__connectedTargetHandles.map((handle) => String(handle))
      : []
  )
  const isSourceHandleConnected = (handleId?: string | null) =>
    connectedSourceHandles.has(getHandleKey(handleId))
  const isTargetHandleConnected = (handleId?: string | null) =>
    connectedTargetHandles.has(getHandleKey(handleId))
  const executionState = String(dataRecord.__executionState || '').trim()
  const isExecutionActive = executionState === 'active' || executionState === 'waiting'
  const isExecutionRecent = executionState === 'recent'
  const executionNodeClassName =
    executionState === 'waiting'
      ? 'border-emerald-300/60 shadow-[0_0_0_1px_rgba(52,211,153,0.34),0_0_24px_rgba(16,185,129,0.16)]'
      : executionState === 'active'
        ? 'border-cyan-300/65 shadow-[0_0_0_1px_rgba(103,232,249,0.36),0_0_26px_rgba(56,189,248,0.18)]'
        : executionState === 'recent'
          ? 'border-sky-300/45 shadow-[0_0_0_1px_rgba(56,189,248,0.2),0_0_16px_rgba(36,161,222,0.12)]'
          : ''
  const executionDotClassName =
    executionState === 'waiting'
      ? 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse'
      : executionState === 'active'
        ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.55)] animate-pulse'
        : executionState === 'recent'
          ? 'bg-sky-300/90 shadow-[0_0_8px_rgba(56,189,248,0.35)]'
          : ''

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
  }, [id, normalizedType, routerCases, routerCasesSignature, updateNodeInternals])

  if (isGroupComment) {
    return (
      <div
        ref={rootRef}
        className={`group/node relative rounded-xl border border-cyan-300/20 bg-cyan-300/[0.045] shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_18px_50px_rgba(0,0,0,0.18)] ${
          selected ? 'ring-2 ring-cyan-200/45' : ''
        }`}
        style={{
          width: groupCommentWidth,
          height: groupCommentHeight,
        }}
      >
        <div className="pointer-events-none absolute -top-7 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-md border border-cyan-300/20 bg-zinc-950/90 px-2 py-1 text-[11px] font-medium text-cyan-100 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
          {commentPreview || 'Комментарий'}
        </div>

        {selected && (
          <div className="absolute right-2 top-2 z-20 flex gap-1">
            <button
              type="button"
              className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors"
              onClick={() => data.onDelete?.(id)}
            >
              <Trash2 className="w-2.5 h-2.5 text-red-400" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`${getNodeStyles(normalizedType)} group/node ${selected ? 'ring-2 ring-white/50' : ''} ${executionNodeClassName}`}
    >
      {(isExecutionActive || isExecutionRecent) && (
        <div
          className={`pointer-events-none absolute inset-0 rounded-lg ${
            executionState === 'waiting'
              ? 'bg-emerald-400/6'
              : executionState === 'active'
                ? 'bg-cyan-400/6'
                : 'bg-sky-400/5'
          }`}
        />
      )}

      {/* Input Handle */}
      {type !== 'trigger' && type !== 'comment' && (
        <HandleInsertButton
          nodeId={id}
          direction="top"
          handleType="target"
          handlePosition={Position.Top}
          nodeColor={nodeColor}
          ariaLabel={tCanvas('insertNodeHere')}
          onOpen={openInsertMenu}
          isConnected={isTargetHandleConnected(null)}
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
        {(isExecutionActive || isExecutionRecent) && (
          <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${executionDotClassName}`} />
        )}
      </div>

      {normalizedType === 'wait' && waitPreview && (
        <div className="mt-1.5 text-[10px] text-zinc-400">
          Wait for: <span className="text-zinc-200">{waitPreview}</span>
        </div>
      )}

      {normalizedType === 'comment' && commentPreview && (
        <div className="mt-1.5 max-h-16 overflow-hidden whitespace-pre-wrap break-words text-[10px] leading-4 text-zinc-300">
          {commentPreview}
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
        </div>
      )}

      {/* Actions */}
      {selected && (
        <div
          className={
            normalizedType === 'router'
              ? 'absolute -right-6 top-3 flex flex-col gap-1'
              : 'absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col gap-1'
          }
        >
          <button
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors"
            onClick={() => data.onDelete?.(id)}
          >
            <Trash2 className="w-2.5 h-2.5 text-red-400" />
          </button>
        </div>
      )}

      {/* Output Handle */}
      {type !== 'router' && type !== 'condition' && type !== 'comment' && !isRandomSplitAction && (
        <HandleInsertButton
          nodeId={id}
          direction="bottom"
          handleType="source"
          handlePosition={Position.Bottom}
          nodeColor={nodeColor}
          ariaLabel={tCanvas('insertNodeHere')}
          onOpen={openInsertMenu}
          isConnected={isSourceHandleConnected(null)}
        />
      )}

      {isRandomSplitAction && (
        <>
          <HandleInsertButton
            nodeId={id}
            direction="bottom"
            handleType="source"
            handlePosition={Position.Bottom}
            nodeColor={nodeColor}
            ariaLabel={tCanvas('insertNodeHere')}
            onOpen={openInsertMenu}
            style={{ left: '38%' }}
            sourceHandle="a"
            isConnected={isSourceHandleConnected('a')}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-sky-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.12)]"
            style={{ left: '38%' }}
          >
            A
          </div>

          <HandleInsertButton
            nodeId={id}
            direction="bottom"
            handleType="source"
            handlePosition={Position.Bottom}
            nodeColor={nodeColor}
            ariaLabel={tCanvas('insertNodeHere')}
            onOpen={openInsertMenu}
            style={{ left: '62%' }}
            sourceHandle="b"
            isConnected={isSourceHandleConnected('b')}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-violet-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-violet-300 shadow-[0_0_10px_rgba(167,139,250,0.12)]"
            style={{ left: '62%' }}
          >
            B
          </div>
        </>
      )}

      {type === 'router' && (
        <>
          <HandleInsertButton
            nodeId={id}
            direction="bottom"
            handleType="source"
            handlePosition={Position.Bottom}
            nodeColor={nodeColor}
            ariaLabel={tCanvas('insertNodeHere')}
            onOpen={openInsertMenu}
            isConnected={isSourceHandleConnected(null)}
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
                <HandleInsertButton
                  nodeId={id}
                  direction="right"
                  handleType="source"
                  handlePosition={Position.Right}
                  nodeColor={nodeColor}
                  ariaLabel={tCanvas('insertNodeHere')}
                  onOpen={openInsertMenu}
                  style={{
                    top: measuredTopPx != null ? `${measuredTopPx}px` : `${fallbackTopPercent}%`,
                  }}
                  sourceHandle={`case:${routerCase.id}`}
                  isConnected={isSourceHandleConnected(`case:${routerCase.id}`)}
                />
                <div
                  className="pointer-events-none absolute z-20 left-full ml-8 -translate-y-1/2 max-w-[124px] truncate whitespace-nowrap rounded bg-black/85 border border-cyan-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-cyan-300 shadow-[0_0_10px_rgba(36,161,222,0.12)]"
                  style={{ top: measuredTopPx != null ? `${measuredTopPx}px` : `${fallbackTopPercent}%` }}
                  title={caseTooltip}
                >
                  {caseLabel}
                </div>
              </div>
            )
          })}
          <div
            className="pointer-events-none absolute z-20 left-1/2 top-full mt-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-zinc-400/20 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.04)]"
            title={routerDefaultLabel}
          >
            {routerDefaultLabel}
          </div>
        </>
      )}

      {/* Condition outputs (bottom-left = true, bottom-right = false) */}
      {type === 'condition' && (
        <>
          <HandleInsertButton
            nodeId={id}
            direction="bottom"
            handleType="source"
            handlePosition={Position.Bottom}
            nodeColor={nodeColor}
            ariaLabel={tCanvas('insertNodeHere')}
            onOpen={openInsertMenu}
            style={{ left: '38%' }}
            isConnected={isSourceHandleConnected(null)}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-emerald-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.12)]"
            style={{ left: '38%' }}
          >
            {tCanvas('nodeDescriptions.condition.true')}
          </div>

          <HandleInsertButton
            nodeId={id}
            direction="bottom"
            handleType="source"
            handlePosition={Position.Bottom}
            nodeColor={nodeColor}
            ariaLabel={tCanvas('insertNodeHere')}
            onOpen={openInsertMenu}
            style={{ left: '62%' }}
            sourceHandle="false"
            isConnected={isSourceHandleConnected('false')}
          />
          <div
            className="pointer-events-none absolute z-20 top-full mt-8 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 border border-rose-400/25 px-1.5 py-0.5 text-[8px] font-semibold leading-none text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.12)]"
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
const WaitNodeComponent = (props: NodeProps) => <CustomNode {...props} type="wait" />
const ScriptNodeComponent = (props: NodeProps) => <CustomNode {...props} type="script" />
const ActionNodeComponent = (props: NodeProps) => <CustomNode {...props} type="action" />
const SetVariableNodeComponent = (props: NodeProps) => <CustomNode {...props} type="setVariable" />
const InputNodeComponent = (props: NodeProps) => <CustomNode {...props} type="input" />
const HttpNodeComponent = (props: NodeProps) => <CustomNode {...props} type="http" />
const WebhookNodeComponent = (props: NodeProps) => <CustomNode {...props} type="webhook" />
const PaymentYookassaNodeComponent = (props: NodeProps) => <CustomNode {...props} type="paymentYookassa" />
const PaymentStripeNodeComponent = (props: NodeProps) => <CustomNode {...props} type="paymentStripe" />
const PaymentRobokassaNodeComponent = (props: NodeProps) => <CustomNode {...props} type="paymentRobokassa" />
const PaymentStarsNodeComponent = (props: NodeProps) => <CustomNode {...props} type="paymentStars" />
const TriggerNodeComponent = (props: NodeProps) => <CustomNode {...props} type="trigger" />
const CommentNodeComponent = (props: NodeProps) => <CustomNode {...props} type="comment" />

MessageNodeComponent.displayName = 'MessageNodeComponent'
ConditionNodeComponent.displayName = 'ConditionNodeComponent'
RouterNodeComponent.displayName = 'RouterNodeComponent'
SchedulerNodeComponent.displayName = 'SchedulerNodeComponent'
ReplyKeyboardNodeComponent.displayName = 'ReplyKeyboardNodeComponent'
WaitNodeComponent.displayName = 'WaitNodeComponent'
ScriptNodeComponent.displayName = 'ScriptNodeComponent'
ActionNodeComponent.displayName = 'ActionNodeComponent'
SetVariableNodeComponent.displayName = 'SetVariableNodeComponent'
InputNodeComponent.displayName = 'InputNodeComponent'
HttpNodeComponent.displayName = 'HttpNodeComponent'
WebhookNodeComponent.displayName = 'WebhookNodeComponent'
PaymentYookassaNodeComponent.displayName = 'PaymentYookassaNodeComponent'
PaymentStripeNodeComponent.displayName = 'PaymentStripeNodeComponent'
PaymentRobokassaNodeComponent.displayName = 'PaymentRobokassaNodeComponent'
PaymentStarsNodeComponent.displayName = 'PaymentStarsNodeComponent'
TriggerNodeComponent.displayName = 'TriggerNodeComponent'
CommentNodeComponent.displayName = 'CommentNodeComponent'

export const MessageNode = memo(MessageNodeComponent)
export const ConditionNode = memo(ConditionNodeComponent)
export const RouterNode = memo(RouterNodeComponent)
export const SchedulerNode = memo(SchedulerNodeComponent)
export const ReplyKeyboardNode = memo(ReplyKeyboardNodeComponent)
export const WaitNode = memo(WaitNodeComponent)
export const ScriptNode = memo(ScriptNodeComponent)
export const ActionNode = memo(ActionNodeComponent)
export const SetVariableNode = memo(SetVariableNodeComponent)
export const InputNode = memo(InputNodeComponent)
export const HttpNode = memo(HttpNodeComponent)
export const WebhookNode = memo(WebhookNodeComponent)
export const PaymentYookassaNode = memo(PaymentYookassaNodeComponent)
export const PaymentStripeNode = memo(PaymentStripeNodeComponent)
export const PaymentRobokassaNode = memo(PaymentRobokassaNodeComponent)
export const PaymentStarsNode = memo(PaymentStarsNodeComponent)
export const TriggerNode = memo(TriggerNodeComponent)
export const CommentNode = memo(CommentNodeComponent)

// Node type mapping for ReactFlow
export const nodeTypes = {
  message: MessageNode,
  condition: ConditionNode,
  router: RouterNode,
  scheduler: SchedulerNode,
  replyKeyboard: ReplyKeyboardNode,
  wait: WaitNode,
  script: ScriptNode,
  action: ActionNode,
  setVariable: SetVariableNode,
  input: InputNode,
  http: HttpNode,
  webhook: WebhookNode,
  paymentYookassa: PaymentYookassaNode,
  paymentStripe: PaymentStripeNode,
  paymentRobokassa: PaymentRobokassaNode,
  paymentStars: PaymentStarsNode,
  trigger: TriggerNode,
  comment: CommentNode,
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
    id: 'wait',
    type: 'wait',
    label: 'Wait',
    description: 'Pause workflow until the next user event',
    color: '#14B8A6',
    gradient: 'from-teal-500/20 to-emerald-500/10',
    border: 'border-teal-500/30',
    icon: Clock,
    data: {
      waitFor: 'message',
      timeout: 300000,
      __label: 'Wait',
      __description: 'Pause until next user event',
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
    description: 'Delay, delete message, random split',
    color: '#8B5CF6',
    gradient: 'from-purple-500/20 to-purple-600/10',
    border: 'border-purple-500/30',
    icon: Zap
  },
  {
    id: 'set-variable',
    type: 'setVariable',
    label: 'Set Variable',
    description: 'Assign a value to a variable',
    color: '#10B981',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
    border: 'border-emerald-500/30',
    icon: Variable,
    data: {
      __label: 'Set Variable',
      __description: 'Assign value to variable',
      variableName: '',
      value: '',
    },
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
  {
    id: 'payment-yookassa',
    type: 'paymentYookassa',
    label: 'YooKassa',
    description: 'Create payment link via YooKassa',
    color: '#38BDF8',
    gradient: 'from-sky-500/20 to-blue-500/10',
    border: 'border-sky-500/30',
    icon: CreditCard,
    data: {
      shopId: '',
      secretKey: '',
      amount: '100.00',
      currency: 'RUB',
      description: '',
      returnUrl: '',
      capture: true,
      saveToVariable: 'payment',
      autoSendPaymentLink: true,
      messageTemplate: 'Оплатите заказ по ссылке: {{payment.url}}',
      __label: 'YooKassa',
      __description: 'Create redirect payment link',
    },
  },
  {
    id: 'payment-stripe',
    type: 'paymentStripe',
    label: 'Stripe',
    description: 'Create Checkout Session link via Stripe',
    color: '#6366F1',
    gradient: 'from-indigo-500/20 to-violet-500/10',
    border: 'border-indigo-500/30',
    icon: CreditCard,
    data: {
      secretKey: '',
      amount: '100.00',
      currency: 'usd',
      productName: 'Order payment',
      description: '',
      successUrl: '',
      cancelUrl: '',
      saveToVariable: 'payment',
      autoSendPaymentLink: true,
      messageTemplate: 'Complete payment here: {{payment.url}}',
      __label: 'Stripe',
      __description: 'Create hosted checkout link',
    },
  },
  {
    id: 'payment-robokassa',
    type: 'paymentRobokassa',
    label: 'Robokassa',
    description: 'Create payment link via Robokassa',
    color: '#F97316',
    gradient: 'from-orange-500/20 to-amber-500/10',
    border: 'border-orange-500/30',
    icon: CreditCard,
    data: {
      merchantLogin: '',
      password1: '',
      amount: '100.00',
      currency: 'RUB',
      description: '',
      invoiceId: '',
      successUrl: '',
      failUrl: '',
      isTest: true,
      saveToVariable: 'payment',
      autoSendPaymentLink: true,
      messageTemplate: 'Оплатите заказ по ссылке: {{payment.url}}',
      __label: 'Robokassa',
      __description: 'Create redirect payment link',
    },
  },
  {
    id: 'payment-stars',
    type: 'paymentStars',
    label: 'Telegram Stars',
    description: 'Create Telegram Stars payment link',
    color: '#FACC15',
    gradient: 'from-yellow-400/20 to-amber-500/10',
    border: 'border-yellow-400/30',
    icon: Star,
    data: {
      title: 'Telegram Stars payment',
      amount: '100',
      currency: 'XTR',
      description: 'Payment via Telegram Stars',
      payload: '',
      saveToVariable: 'payment',
      autoSendPaymentLink: true,
      messageTemplate: 'Оплатите заказ в Telegram Stars: {{payment.url}}',
      __label: 'Telegram Stars',
      __description: 'Create Telegram Stars invoice link',
    },
  },
  // Legacy 'webhook' node type is still supported in runtime/config,
  // but hidden from palette in favor of the dedicated HTTP node.
]
