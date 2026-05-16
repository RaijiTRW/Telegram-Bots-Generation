'use client'

import { memo, type MouseEvent } from 'react'
import { useLocale } from 'next-intl'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  type EdgeProps,
  type Node,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow'
import { Trash2 } from 'lucide-react'

export const CANVAS_EDGE_TYPE = 'canvas-edge'
export const CANVAS_EDGE_STYLE = { stroke: '#24A1DE', strokeWidth: 2 } as const
const EDGE_DELETE_BUTTON_OFFSET_PX = 24

type EdgePoint = { x: number; y: number }
type RouterCaseLane = { index: number; count: number }
type NodeObstacle = {
  id: string
  left: number
  right: number
  top: number
  bottom: number
}
type NodeRect = NodeObstacle & {
  width: number
  height: number
  centerX: number
  centerY: number
}
type EdgeAnchor = EdgePoint & {
  position?: Position
}

type NodeWithAbsolutePosition = Node & {
  positionAbsolute?: EdgePoint
  measured?: {
    width?: number
    height?: number
  }
}

const NODE_OBSTACLE_PADDING = 30
const NODE_SIDE_ANCHOR_PADDING = 24
const NODE_SIDE_ANCHOR_MIN_GAP = 36
const FALLBACK_NODE_WIDTH = 200
const FALLBACK_NODE_HEIGHT = 72

function extractPathPoints(path: string): EdgePoint[] {
  const numbers = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0]))
  const points: EdgePoint[] = []

  for (let index = 0; index < numbers.length - 1; index += 2) {
    const x = numbers[index]
    const y = numbers[index + 1]
    if (Number.isFinite(x) && Number.isFinite(y)) {
      points.push({ x, y })
    }
  }

  return points
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

function getNodePosition(node: Node | undefined): EdgePoint | null {
  if (!node) {
    return null
  }

  const nodeWithAbsolutePosition = node as NodeWithAbsolutePosition
  return nodeWithAbsolutePosition.positionAbsolute || node.position || null
}

function getNodeDimension(node: Node | undefined, dimension: 'width' | 'height', fallback: number): number {
  if (!node) {
    return fallback
  }

  const directValue = node[dimension]
  if (typeof directValue === 'number' && Number.isFinite(directValue) && directValue > 0) {
    return directValue
  }

  const measuredValue = (node as NodeWithAbsolutePosition).measured?.[dimension]
  if (typeof measuredValue === 'number' && Number.isFinite(measuredValue) && measuredValue > 0) {
    return measuredValue
  }

  const styleValue = node.style?.[dimension]
  if (typeof styleValue === 'number' && Number.isFinite(styleValue) && styleValue > 0) {
    return styleValue
  }

  if (typeof styleValue === 'string') {
    const parsedValue = Number.parseFloat(styleValue)
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue
    }
  }

  return fallback
}

function getNodeRect(node: Node | undefined): NodeRect | null {
  if (!node) {
    return null
  }

  const data = node.data && typeof node.data === 'object' && !Array.isArray(node.data)
    ? (node.data as Record<string, unknown>)
    : null

  if (node.type === 'comment' && data?.commentMode === 'group') {
    return null
  }

  const position = getNodePosition(node)
  if (!position) {
    return null
  }

  const width = getNodeDimension(node, 'width', FALLBACK_NODE_WIDTH)
  const height = getNodeDimension(node, 'height', FALLBACK_NODE_HEIGHT)

  return {
    id: node.id,
    left: position.x,
    right: position.x + width,
    top: position.y,
    bottom: position.y + height,
    width,
    height,
    centerX: position.x + width / 2,
    centerY: position.y + height / 2,
  }
}

function getNodeObstacle(node: Node, padding = NODE_OBSTACLE_PADDING): NodeObstacle | null {
  const rect = getNodeRect(node)
  if (!rect) {
    return null
  }

  return {
    id: rect.id,
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding,
  }
}

function getAdaptiveNodeAnchor({
  node,
  fallback,
  opposite,
  fallbackPosition,
  preserveActualHandle,
}: {
  node: Node | undefined
  fallback: EdgePoint
  opposite: EdgePoint
  fallbackPosition?: Position
  preserveActualHandle?: boolean
}): EdgeAnchor {
  if (preserveActualHandle) {
    return { ...fallback, position: fallbackPosition }
  }

  const rect = getNodeRect(node)
  if (!rect) {
    return { ...fallback, position: fallbackPosition }
  }

  const dx = opposite.x - rect.centerX
  const dy = opposite.y - rect.centerY
  const horizontalDistance = Math.abs(dx) - rect.width / 2
  const shouldUseSide =
    horizontalDistance > NODE_SIDE_ANCHOR_MIN_GAP &&
    Math.abs(dx) > Math.abs(dy) * 0.75

  if (!shouldUseSide) {
    return { ...fallback, position: fallbackPosition }
  }

  const position = dx >= 0 ? Position.Right : Position.Left
  const minY = rect.top + Math.min(NODE_SIDE_ANCHOR_PADDING, rect.height / 3)
  const maxY = rect.bottom - Math.min(NODE_SIDE_ANCHOR_PADDING, rect.height / 3)

  return {
    x: position === Position.Right ? rect.right : rect.left,
    y: clamp(opposite.y, minY, maxY),
    position,
  }
}

function getRouterCaseLane(sourceNode: Node | undefined, sourceHandleId?: string | null): RouterCaseLane | null {
  if (!sourceHandleId?.startsWith('case:')) {
    return null
  }

  const caseId = sourceHandleId.slice('case:'.length)
  const sourceData =
    sourceNode?.data && typeof sourceNode.data === 'object' && !Array.isArray(sourceNode.data)
      ? (sourceNode.data as Record<string, unknown>)
      : {}
  const routerCases = Array.isArray(sourceData.cases) ? sourceData.cases : []
  const index = routerCases.findIndex((routerCase) => {
    if (!routerCase || typeof routerCase !== 'object') {
      return false
    }

    return String((routerCase as Record<string, unknown>).id || '') === caseId
  })

  return {
    index: Math.max(0, index),
    count: Math.max(1, routerCases.length || 1),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getPointDistance(start: EdgePoint, end: EdgePoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y)
}

function getSegmentLength(start: EdgePoint, end: EdgePoint): number {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y)
}

function segmentIntersectsObstacle(start: EdgePoint, end: EdgePoint, obstacle: NodeObstacle): boolean {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxY = Math.max(start.y, end.y)
  const isVertical = Math.abs(start.x - end.x) < 0.5
  const isHorizontal = Math.abs(start.y - end.y) < 0.5

  if (isVertical) {
    return start.x >= obstacle.left && start.x <= obstacle.right && maxY >= obstacle.top && minY <= obstacle.bottom
  }

  if (isHorizontal) {
    return start.y >= obstacle.top && start.y <= obstacle.bottom && maxX >= obstacle.left && minX <= obstacle.right
  }

  return maxX >= obstacle.left && minX <= obstacle.right && maxY >= obstacle.top && minY <= obstacle.bottom
}

function scoreOrthogonalPath(
  points: EdgePoint[],
  obstacles: NodeObstacle[],
  preferredChannelX: number,
  preferredApproachY: number
): number {
  let score = 0
  let crossings = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    score += getSegmentLength(start, end)

    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) {
        crossings += 1
      }
    }
  }

  const channelX = points[3]?.x ?? preferredChannelX
  const approachY = points[4]?.y ?? preferredApproachY
  score += Math.abs(channelX - preferredChannelX) * 0.35
  score += Math.abs(approachY - preferredApproachY) * 0.25

  return score + crossings * 100_000
}

function uniqueNumbers(values: number[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []

  for (const value of values) {
    if (!Number.isFinite(value)) continue
    const roundedValue = Math.round(value)
    if (seen.has(roundedValue)) continue
    seen.add(roundedValue)
    result.push(roundedValue)
  }

  return result
}

function getRoundedOrthogonalPath(points: EdgePoint[], radius = 16): string {
  const normalizedPoints = points.filter((point, index) => {
    const previous = points[index - 1]
    return !previous || getPointDistance(previous, point) > 0.5
  })

  const [firstPoint, ...remainingPoints] = normalizedPoints
  if (!firstPoint) {
    return ''
  }

  if (remainingPoints.length === 0) {
    return `M ${firstPoint.x} ${firstPoint.y}`
  }

  let path = `M ${firstPoint.x} ${firstPoint.y}`

  for (let index = 1; index < normalizedPoints.length - 1; index += 1) {
    const previousPoint = normalizedPoints[index - 1]
    const currentPoint = normalizedPoints[index]
    const nextPoint = normalizedPoints[index + 1]
    const distanceToPrevious = getPointDistance(currentPoint, previousPoint)
    const distanceToNext = getPointDistance(currentPoint, nextPoint)
    const cornerRadius = Math.min(radius, distanceToPrevious / 2, distanceToNext / 2)

    if (cornerRadius < 1) {
      path += ` L ${currentPoint.x} ${currentPoint.y}`
      continue
    }

    const beforeCorner = {
      x: currentPoint.x + ((previousPoint.x - currentPoint.x) / distanceToPrevious) * cornerRadius,
      y: currentPoint.y + ((previousPoint.y - currentPoint.y) / distanceToPrevious) * cornerRadius,
    }
    const afterCorner = {
      x: currentPoint.x + ((nextPoint.x - currentPoint.x) / distanceToNext) * cornerRadius,
      y: currentPoint.y + ((nextPoint.y - currentPoint.y) / distanceToNext) * cornerRadius,
    }

    path += ` L ${beforeCorner.x} ${beforeCorner.y} Q ${currentPoint.x} ${currentPoint.y} ${afterCorner.x} ${afterCorner.y}`
  }

  const lastPoint = normalizedPoints[normalizedPoints.length - 1]
  path += ` L ${lastPoint.x} ${lastPoint.y}`

  return path
}

function getLongestSegmentMidpoint(points: EdgePoint[], fallback: EdgePoint): EdgePoint {
  let bestPoint = fallback
  let bestLength = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const length = getPointDistance(start, end)

    if (length > bestLength) {
      bestLength = length
      bestPoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }
    }
  }

  return bestPoint
}

function getRouterCasePath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceNode,
  targetNode,
  sourceHandleId,
  obstacles = [],
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: Position
  targetPosition?: Position
  sourceNode?: Node
  targetNode?: Node
  sourceHandleId?: string | null
  obstacles?: NodeObstacle[]
}): [path: string, labelX: number, labelY: number] | null {
  if (sourcePosition !== Position.Right || targetPosition !== Position.Top) {
    return null
  }

  const lane = getRouterCaseLane(sourceNode, sourceHandleId)
  const targetPositionPoint = getNodePosition(targetNode)
  if (!lane || !targetPositionPoint) {
    return null
  }

  const targetLeft = targetPositionPoint.x
  const targetWidth = getNodeDimension(targetNode, 'width', FALLBACK_NODE_WIDTH)
  const sourceExitX = sourceX + 28
  const laneIndex = clamp(lane.index, 0, lane.count - 1)
  const preferredChannelX = sourceX + 132 + laneIndex * 72
  const sourceLaneY = sourceY - 34 - Math.min(24, laneIndex * 8)
  const preferredApproachY = targetY - 76 - Math.min(26, laneIndex * 8)
  const minChannelX = Math.min(sourceX, targetLeft, targetX) - 180
  const maxChannelX = Math.max(sourceX, targetLeft + targetWidth, targetX) + 180
  const channelCandidates = uniqueNumbers([
    preferredChannelX,
    sourceExitX + 52,
    targetX - 88,
    targetX + 88,
    targetLeft - NODE_OBSTACLE_PADDING * 1.35,
    targetLeft + targetWidth + NODE_OBSTACLE_PADDING * 1.35,
    ...obstacles.flatMap((obstacle) => [
      obstacle.left - NODE_OBSTACLE_PADDING,
      obstacle.right + NODE_OBSTACLE_PADDING,
    ]),
  ]).map((value) => clamp(value, minChannelX, maxChannelX))
  const minApproachY = Math.min(sourceLaneY, targetY) - 180
  const maxApproachY = targetY - 42
  const approachCandidates = uniqueNumbers([
    preferredApproachY,
    targetY - 58,
    sourceLaneY,
    ...obstacles.flatMap((obstacle) => [
      obstacle.top - NODE_OBSTACLE_PADDING,
      obstacle.bottom + NODE_OBSTACLE_PADDING,
    ]),
  ]).map((value) => clamp(value, minApproachY, maxApproachY))
  const makePoints = (channelX: number, approachY: number) => [
    { x: sourceX, y: sourceY },
    { x: sourceExitX, y: sourceY },
    { x: sourceExitX, y: sourceLaneY },
    { x: channelX, y: sourceLaneY },
    { x: channelX, y: approachY },
    { x: targetX, y: approachY },
    { x: targetX, y: targetY },
  ]
  let points = makePoints(preferredChannelX, preferredApproachY)
  let bestScore = Number.POSITIVE_INFINITY

  for (const channelX of channelCandidates) {
    for (const approachY of approachCandidates) {
      const candidatePoints = makePoints(channelX, approachY)
      const candidateScore = scoreOrthogonalPath(candidatePoints, obstacles, preferredChannelX, preferredApproachY)

      if (candidateScore < bestScore) {
        bestScore = candidateScore
        points = candidatePoints
      }
    }
  }

  const path = getRoundedOrthogonalPath(points)
  const label = getLongestSegmentMidpoint(points, { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 })

  return [path, label.x, label.y]
}

function pathIntersectsObstacles(path: string, obstacles: NodeObstacle[]): boolean {
  if (!obstacles.length) {
    return false
  }

  const points = extractPathPoints(path)

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]

    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) {
        return true
      }
    }
  }

  return false
}

function getOffsetPoint(x: number, y: number, position: Position | undefined, distance: number): EdgePoint {
  switch (position) {
    case Position.Left:
      return { x: x - distance, y }
    case Position.Right:
      return { x: x + distance, y }
    case Position.Top:
      return { x, y: y - distance }
    case Position.Bottom:
    default:
      return { x, y: y + distance }
  }
}

function getObstacleAwareFallbackPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  obstacles,
}: {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition?: Position
  targetPosition?: Position
  obstacles: NodeObstacle[]
}): [path: string, labelX: number, labelY: number] {
  const sourceExit = getOffsetPoint(sourceX, sourceY, sourcePosition, 44)
  const targetEntry = getOffsetPoint(targetX, targetY, targetPosition, 44)
  const preferredMidX = (sourceExit.x + targetEntry.x) / 2
  const preferredMidY = (sourceExit.y + targetEntry.y) / 2
  const minX = Math.min(sourceX, sourceExit.x, targetX, targetEntry.x, ...obstacles.map((obstacle) => obstacle.left)) - 140
  const maxX = Math.max(sourceX, sourceExit.x, targetX, targetEntry.x, ...obstacles.map((obstacle) => obstacle.right)) + 140
  const minY = Math.min(sourceY, sourceExit.y, targetY, targetEntry.y, ...obstacles.map((obstacle) => obstacle.top)) - 140
  const maxY = Math.max(sourceY, sourceExit.y, targetY, targetEntry.y, ...obstacles.map((obstacle) => obstacle.bottom)) + 140
  const xCandidates = uniqueNumbers([
    preferredMidX,
    sourceExit.x,
    targetEntry.x,
    sourceExit.x - 88,
    sourceExit.x + 88,
    targetEntry.x - 88,
    targetEntry.x + 88,
    ...obstacles.flatMap((obstacle) => [
      obstacle.left - NODE_OBSTACLE_PADDING,
      obstacle.right + NODE_OBSTACLE_PADDING,
    ]),
  ]).map((value) => clamp(value, minX, maxX))
  const yCandidates = uniqueNumbers([
    preferredMidY,
    sourceExit.y,
    targetEntry.y,
    sourceExit.y - 88,
    sourceExit.y + 88,
    targetEntry.y - 88,
    targetEntry.y + 88,
    ...obstacles.flatMap((obstacle) => [
      obstacle.top - NODE_OBSTACLE_PADDING,
      obstacle.bottom + NODE_OBSTACLE_PADDING,
    ]),
  ]).map((value) => clamp(value, minY, maxY))
  const makeVerticalChannelPoints = (midX: number) => [
    { x: sourceX, y: sourceY },
    sourceExit,
    { x: midX, y: sourceExit.y },
    { x: midX, y: targetEntry.y },
    targetEntry,
    { x: targetX, y: targetY },
  ]
  const makeHorizontalChannelPoints = (midY: number) => [
    { x: sourceX, y: sourceY },
    sourceExit,
    { x: sourceExit.x, y: midY },
    { x: targetEntry.x, y: midY },
    targetEntry,
    { x: targetX, y: targetY },
  ]
  let points = makeVerticalChannelPoints(preferredMidX)
  let bestScore = Number.POSITIVE_INFINITY

  for (const midX of xCandidates) {
    const candidatePoints = makeVerticalChannelPoints(midX)
    const candidateScore = scoreOrthogonalPath(candidatePoints, obstacles, preferredMidX, preferredMidY)

    if (candidateScore < bestScore) {
      bestScore = candidateScore
      points = candidatePoints
    }
  }

  for (const midY of yCandidates) {
    const candidatePoints = makeHorizontalChannelPoints(midY)
    const candidateScore = scoreOrthogonalPath(candidatePoints, obstacles, preferredMidX, preferredMidY)

    if (candidateScore < bestScore) {
      bestScore = candidateScore
      points = candidatePoints
    }
  }

  const path = getRoundedOrthogonalPath(points)
  const label = getLongestSegmentMidpoint(points, { x: preferredMidX, y: preferredMidY })

  return [path, label.x, label.y]
}

const CanvasEdge = memo(function CanvasEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  markerEnd,
  style,
  selected,
  data,
}: EdgeProps) {
  const locale = useLocale()
  const { getNode, getNodes, setEdges } = useReactFlow()
  const sourceNode = getNode(source)
  const targetNode = getNode(target)
  const sourceRect = getNodeRect(sourceNode)
  const targetRect = getNodeRect(targetNode)
  const sourceAnchor = getAdaptiveNodeAnchor({
    node: sourceNode,
    fallback: { x: sourceX, y: sourceY },
    opposite: targetRect ? { x: targetRect.centerX, y: targetRect.centerY } : { x: targetX, y: targetY },
    fallbackPosition: sourcePosition,
    preserveActualHandle: Boolean(sourceHandleId?.startsWith('case:') || sourceHandleId?.startsWith('adaptive-source:')),
  })
  const targetAnchor = getAdaptiveNodeAnchor({
    node: targetNode,
    fallback: { x: targetX, y: targetY },
    opposite: sourceRect ? { x: sourceRect.centerX, y: sourceRect.centerY } : { x: sourceX, y: sourceY },
    fallbackPosition: targetPosition,
    preserveActualHandle: Boolean(targetHandleId?.startsWith('adaptive-target:')),
  })
  const obstacleNodes = getNodes()
    .filter((node) => node.id !== source && node.id !== target)
    .map((node) => getNodeObstacle(node))
    .filter((obstacle): obstacle is NodeObstacle => Boolean(obstacle))
  const smoothStepPath = getSmoothStepPath({
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    sourcePosition: sourceAnchor.position,
    targetX: targetAnchor.x,
    targetY: targetAnchor.y,
    targetPosition: targetAnchor.position,
  })
  const obstacleAwareFallbackPath = pathIntersectsObstacles(smoothStepPath[0], obstacleNodes)
    ? getObstacleAwareFallbackPath({
      sourceX: sourceAnchor.x,
      sourceY: sourceAnchor.y,
      sourcePosition: sourceAnchor.position,
      targetX: targetAnchor.x,
      targetY: targetAnchor.y,
      targetPosition: targetAnchor.position,
      obstacles: obstacleNodes,
    })
    : smoothStepPath
  const [edgePath, labelX, labelY] =
    getRouterCasePath({
      sourceX: sourceAnchor.x,
      sourceY: sourceAnchor.y,
      sourcePosition: sourceAnchor.position,
      targetX: targetAnchor.x,
      targetY: targetAnchor.y,
      targetPosition: targetAnchor.position,
      sourceHandleId,
      sourceNode,
      targetNode,
      obstacles: obstacleNodes,
    }) ||
    obstacleAwareFallbackPath
  const deleteButtonPosition = getDeleteButtonPosition(edgePath, { x: labelX, y: labelY })
  const deleteLabel = locale === 'en' ? 'Delete connection' : 'Удалить связь'
  const executionState =
    data && typeof data === 'object' && !Array.isArray(data)
      ? String((data as Record<string, unknown>).__executionState || '')
      : ''
  const shouldShowDeleteButton =
    selected ||
    Boolean(
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      (data as Record<string, unknown>).__showDeleteButton
    )
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
      {shouldShowDeleteButton ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute left-0 top-0 z-[1000]"
            style={{
              transform: `translate(-50%, -50%) translate(${deleteButtonPosition.x}px, ${deleteButtonPosition.y}px)`,
            }}
          >
            <button
              type="button"
              title={deleteLabel}
              aria-label={deleteLabel}
              className="pointer-events-auto nodrag nopan flex h-8 w-8 items-center justify-center rounded-full border border-red-400/40 bg-red-500/20 text-red-200 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-red-300/70 hover:bg-red-500/35 hover:text-white"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
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
