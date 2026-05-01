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
const EDGE_DELETE_BUTTON_OFFSET_PX = 24

type EdgePoint = { x: number; y: number }

function extractPathPoints(path: string): EdgePoint[] {
  const matches = path.matchAll(/[MLQ]\s*(-?\d+(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)/g)
  return Array.from(matches, (match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
}

function getDeleteButtonPosition(path: string, fallback: EdgePoint): EdgePoint {
  const points = extractPathPoints(path)
  let bestStart: EdgePoint | null = null
  let bestEnd: EdgePoint | null = null
  let bestLength = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length > bestLength) {
      bestStart = start
      bestEnd = end
      bestLength = length
    }
  }

  if (!bestStart || !bestEnd || bestLength < 1) {
    return fallback
  }

  const midX = (bestStart.x + bestEnd.x) / 2
  const midY = (bestStart.y + bestEnd.y) / 2
  const isSegmentMostlyVertical = Math.abs(bestEnd.y - bestStart.y) >= Math.abs(bestEnd.x - bestStart.x)

  return isSegmentMostlyVertical
    ? { x: midX + EDGE_DELETE_BUTTON_OFFSET_PX, y: midY }
    : { x: midX, y: midY - EDGE_DELETE_BUTTON_OFFSET_PX }
}

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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const deleteButtonPosition = getDeleteButtonPosition(edgePath, { x: labelX, y: labelY })
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
              transform: `translate(-50%, -50%) translate(${deleteButtonPosition.x}px, ${deleteButtonPosition.y}px)`,
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
