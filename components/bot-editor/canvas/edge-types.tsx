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
  const deleteLabel = locale === 'en' ? 'Delete connection' : 'Удалить связь'

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setEdges((edges) => edges.filter((edge) => edge.id !== id))
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {selected ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute left-0 top-0"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 18}px)`,
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
