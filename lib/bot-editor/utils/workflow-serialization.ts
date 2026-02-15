type PlainObject = Record<string, unknown>

export interface SerializableWorkflowNode {
  id: string
  type?: string | null
  position?: { x: number; y: number }
  data?: PlainObject
}

export interface SerializableWorkflowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
  data?: PlainObject
  animated?: boolean
  type?: string
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'function' || value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    const sanitizedArray: unknown[] = []
    for (const item of value) {
      const sanitizedItem = sanitizeValue(item)
      if (sanitizedItem !== undefined) {
        sanitizedArray.push(sanitizedItem)
      }
    }
    return sanitizedArray
  }

  if (typeof value === 'object') {
    const sanitizedObject: PlainObject = {}
    const entries = Object.entries(value as PlainObject).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey)
    )

    for (const [key, nestedValue] of entries) {
      const sanitizedNestedValue = sanitizeValue(nestedValue)
      if (sanitizedNestedValue !== undefined) {
        sanitizedObject[key] = sanitizedNestedValue
      }
    }
    return sanitizedObject
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  return String(value)
}

export function serializeWorkflowNodes(nodes: unknown[]): SerializableWorkflowNode[] {
  return nodes.map((rawNode) => {
    const node = (rawNode || {}) as PlainObject
    const position = (node.position || {}) as PlainObject
    const data = sanitizeValue(node.data || {}) as PlainObject

    return {
      id: String(node.id || ''),
      type: typeof node.type === 'string' ? node.type : undefined,
      position: {
        x: Number(position.x || 0),
        y: Number(position.y || 0),
      },
      data,
    }
  })
}

export function serializeWorkflowEdges(edges: unknown[]): SerializableWorkflowEdge[] {
  return edges.map((rawEdge) => {
    const edge = (rawEdge || {}) as PlainObject
    const data = sanitizeValue(edge.data || {}) as PlainObject
    const sourceHandle =
      typeof edge.sourceHandle === 'string' || edge.sourceHandle === null
        ? (edge.sourceHandle as string | null)
        : null
    const targetHandle =
      typeof edge.targetHandle === 'string' || edge.targetHandle === null
        ? (edge.targetHandle as string | null)
        : null

    return {
      id: String(edge.id || ''),
      source: String(edge.source || ''),
      target: String(edge.target || ''),
      sourceHandle,
      targetHandle,
      label: typeof edge.label === 'string' ? edge.label : undefined,
      data,
      animated: Boolean(edge.animated),
      type: typeof edge.type === 'string' ? edge.type : undefined,
    }
  })
}
