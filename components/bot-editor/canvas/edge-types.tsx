'use client'

import { memo, type MouseEvent } from 'react'
import { useLocale } from 'next-intl'
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow'
import { Trash2 } from 'lucide-react'

export const CANVAS_EDGE_TYPE = 'canvas-edge'
export const CANVAS_EDGE_STYLE = { stroke: '#24A1DE', strokeWidth: 2 } as const
const EDGE_DELETE_BUTTON_OFFSET_PX = 18

const CanvasEdge = memo(function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps) {
  const locale = useLocale()
  const { setEdges } = useReactFlow()
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const isMostlyVertical = Math.abs(targetY - sourceY) >= Math.abs(targetX - sourceX)
  const deleteButtonX = isMostlyVertical ? midX + EDGE_DELETE_BUTTON_OFFSET_PX : midX
  const deleteButtonY = isMostlyVertical ? midY : midY - EDGE_DELETE_BUTTON_OFFSET_PX
  const deleteLabel = locale === 'en' ? 'Delete connection' : 'Удалить связь'
  const executionState =
    data && typeof data === 'object' && !Array.isArray(data)
      ? String((data as Record<string, unknown>).__executionState || '')
      : ''
  const executionGlowStyle =
    executionState === 'active'
      ? { stroke: '#67E8F9', strokeWidth: 7, opacity: 0.16 }
      : executionState === 'recent'
        ? { stroke: '#38BDF8', strokeWidth: 5, opacity: 0.1 }
        : null

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setEdges((edges) => edges.filter((edge) => edge.id !== id))
  }

  return (
    <>
      {executionGlowStyle ? (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={executionGlowStyle}
        />
      ) : null}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              transform: `translate(-50%, -50%) translate(${deleteButtonX}px, ${deleteButtonY}px)`,
            }}
          >
            <button
              type="button"
              title={deleteLabel}
              aria-label={deleteLabel}
              className="pointer-events-auto nodrag nopan rounded bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-colors p-1 shadow-[0_4px_18px_rgba(0,0,0,0.35)]"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handleDelete}
            >
              <Trash2 className="w-2.5 h-2.5 text-red-400" />
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
})

export const edgeTypes = {
  [CANVAS_EDGE_TYPE]: CanvasEdge,
}
