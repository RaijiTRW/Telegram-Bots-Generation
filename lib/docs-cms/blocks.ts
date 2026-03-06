import { randomUUID } from 'node:crypto'

import type { Json } from '@/lib/supabase/types'
import type {
  DocsBlock,
  DocsBlockButton,
  DocsBlockCallout,
  DocsBlockCode,
  DocsBlockDivider,
  DocsBlockHeading,
  DocsBlockImage,
  DocsBlockList,
  DocsBlockParagraph,
  DocsBlockTable,
  DocsBlockVideo,
  DocsBlockVideoEmbed,
  DocsBlockRichText,
} from '@/lib/docs-cms/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeId(value: unknown): string {
  const candidate = asString(value).trim()
  return candidate || randomUUID()
}

function sanitizeHeading(block: Record<string, unknown>): DocsBlockHeading {
  const levelRaw = Number(block.level)
  const level =
    Number.isFinite(levelRaw) && levelRaw >= 1 && levelRaw <= 6
      ? (levelRaw as DocsBlockHeading['level'])
      : 2

  return {
    id: sanitizeId(block.id),
    type: 'heading',
    level,
    text: asString(block.text).trim(),
  }
}

function sanitizeParagraph(block: Record<string, unknown>): DocsBlockParagraph {
  return {
    id: sanitizeId(block.id),
    type: 'paragraph',
    richText: asString(block.richText || block.text).trim(),
  }
}

function sanitizeRichText(block: Record<string, unknown>): DocsBlockRichText {
  return {
    id: sanitizeId(block.id),
    type: 'richText',
    content: asString(block.content).trim(),
  }
}

function sanitizeList(block: Record<string, unknown>): DocsBlockList {
  const rawItems = Array.isArray(block.items) ? block.items : []
  const items = rawItems.map((item) => asString(item).trim()).filter(Boolean)

  return {
    id: sanitizeId(block.id),
    type: 'list',
    ordered: asBoolean(block.ordered, false),
    items,
  }
}

function sanitizeCallout(block: Record<string, unknown>): DocsBlockCallout {
  const toneRaw = asString(block.tone).toLowerCase()
  const tone: DocsBlockCallout['tone'] =
    toneRaw === 'success' || toneRaw === 'warning' || toneRaw === 'danger' ? toneRaw : 'info'

  return {
    id: sanitizeId(block.id),
    type: 'callout',
    tone,
    title: asString(block.title).trim(),
    text: asString(block.text).trim(),
  }
}

function sanitizeTable(block: Record<string, unknown>): DocsBlockTable {
  const columns = (Array.isArray(block.columns) ? block.columns : [])
    .map((value) => asString(value).trim())
    .filter(Boolean)

  const rows = (Array.isArray(block.rows) ? block.rows : [])
    .map((row) => (Array.isArray(row) ? row.map((value) => asString(value)) : []))
    .filter((row) => row.length > 0)

  return {
    id: sanitizeId(block.id),
    type: 'table',
    columns,
    rows,
  }
}

function sanitizeImage(block: Record<string, unknown>): DocsBlockImage {
  return {
    id: sanitizeId(block.id),
    type: 'image',
    assetId: asString(block.assetId).trim() || null,
    url: asString(block.url).trim(),
    alt: asString(block.alt).trim(),
    caption: asString(block.caption).trim(),
  }
}

function sanitizeVideo(block: Record<string, unknown>): DocsBlockVideo {
  return {
    id: sanitizeId(block.id),
    type: 'video',
    assetId: asString(block.assetId).trim() || null,
    url: asString(block.url).trim(),
    caption: asString(block.caption).trim(),
    posterUrl: asString(block.posterUrl).trim(),
  }
}

function sanitizeVideoEmbed(block: Record<string, unknown>): DocsBlockVideoEmbed {
  const providerRaw = asString(block.provider).toLowerCase()
  const provider: DocsBlockVideoEmbed['provider'] =
    providerRaw === 'youtube' || providerRaw === 'vimeo' ? providerRaw : 'other'

  return {
    id: sanitizeId(block.id),
    type: 'videoEmbed',
    provider,
    url: asString(block.url).trim(),
    caption: asString(block.caption).trim(),
  }
}

function sanitizeButton(block: Record<string, unknown>): DocsBlockButton {
  const variantRaw = asString(block.variant).toLowerCase()
  const variant: DocsBlockButton['variant'] =
    variantRaw === 'outline' || variantRaw === 'ghost' ? variantRaw : 'default'

  return {
    id: sanitizeId(block.id),
    type: 'button',
    label: asString(block.label).trim(),
    url: asString(block.url).trim(),
    variant,
  }
}

function sanitizeDivider(block: Record<string, unknown>): DocsBlockDivider {
  return {
    id: sanitizeId(block.id),
    type: 'divider',
  }
}

function sanitizeCode(block: Record<string, unknown>): DocsBlockCode {
  return {
    id: sanitizeId(block.id),
    type: 'code',
    language: asString(block.language).trim() || 'text',
    code: asString(block.code),
  }
}

export function normalizeDocsBlocks(value: Json): DocsBlock[] {
  if (!Array.isArray(value)) {
    return []
  }

  const result: DocsBlock[] = []

  for (const item of value) {
    const block = asRecord(item)
    if (!block) continue

    const type = asString(block.type)
    if (!type) continue

    switch (type) {
      case 'heading':
        result.push(sanitizeHeading(block))
        break
      case 'paragraph':
        result.push(sanitizeParagraph(block))
        break
      case 'list':
        result.push(sanitizeList(block))
        break
      case 'callout':
        result.push(sanitizeCallout(block))
        break
      case 'table':
        result.push(sanitizeTable(block))
        break
      case 'image':
        result.push(sanitizeImage(block))
        break
      case 'video':
        result.push(sanitizeVideo(block))
        break
      case 'videoEmbed':
        result.push(sanitizeVideoEmbed(block))
        break
      case 'button':
        result.push(sanitizeButton(block))
        break
      case 'divider':
        result.push(sanitizeDivider(block))
        break
      case 'code':
        result.push(sanitizeCode(block))
        break
      case 'richText':
        result.push(sanitizeRichText(block))
        break
      default:
        break
    }
  }

  return result
}

export function validateDocsBlocks(value: Json): { valid: boolean; errors: string[] } {
  const mode: 'draft' | 'publish' = 'publish'
  return validateDocsBlocksByMode(value, mode)
}

export function validateDocsBlocksByMode(
  value: Json,
  mode: 'draft' | 'publish'
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const blocks = normalizeDocsBlocks(value)

  if (!Array.isArray(value)) {
    errors.push('Blocks payload must be an array.')
  }

  if (mode === 'publish' && blocks.length === 0) {
    errors.push('At least one block is required.')
  }

  if (mode === 'draft') {
    return { valid: errors.length === 0, errors }
  }

  for (const block of blocks) {
    if (block.type === 'heading' && !block.text.trim()) {
      errors.push(`Heading block ${block.id} has empty text.`)
    }
    if (block.type === 'paragraph' && !block.richText.trim()) {
      errors.push(`Paragraph block ${block.id} has empty richText.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function extractDocsBlocksText(blocks: DocsBlock[]): string {
  const parts: string[] = []

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        parts.push(block.text)
        break
      case 'paragraph':
        parts.push(block.richText.replace(/<[^>]+>/g, ' '))
        break
      case 'list':
        parts.push(...block.items)
        break
      case 'callout':
        parts.push(block.title, block.text)
        break
      case 'table':
        parts.push(...block.columns)
        for (const row of block.rows) {
          parts.push(...row)
        }
        break
      case 'image':
        parts.push(block.alt, block.caption)
        break
      case 'video':
        parts.push(block.caption)
        break
      case 'videoEmbed':
        parts.push(block.caption, block.url)
        break
      case 'button':
        parts.push(block.label, block.url)
        break
      case 'code':
        parts.push(block.language, block.code)
        break
      case 'richText':
        parts.push(block.content.replace(/<[^>]+>/g, ' '))
        break
      case 'divider':
        break
      default:
        break
    }
  }

  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
