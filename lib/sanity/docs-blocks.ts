import type { DocsBlock, DocsSeo } from '@/lib/docs-cms/types'

type SanityReference = {
  _type?: string
  _ref?: string
}

type SanityImageField = {
  _type?: string
  asset?: SanityReference
}

export type RawSanityDocsBlock = Record<string, unknown> & {
  _key?: string
  _type?: string
}

type SanityDocsBlockInput =
  | {
      _key?: string
      _type: 'docsHeading'
      level?: 1 | 2 | 3 | 4 | 5 | 6
      text?: string
    }
  | {
      _key?: string
      _type: 'docsParagraph'
      text?: string
    }
  | {
      _key?: string
      _type: 'docsList'
      ordered?: boolean
      items?: string[]
    }
  | {
      _key?: string
      _type: 'docsCallout'
      tone?: 'info' | 'success' | 'warning' | 'danger'
      title?: string
      text?: string
    }
  | {
      _key?: string
      _type: 'docsTable'
      columns?: string[]
      rows?: Array<{ _key?: string; _type?: 'docsTableRow'; cells?: string[] }>
    }
  | {
      _key?: string
      _type: 'docsImage'
      asset?: SanityReference | SanityImageField
      url?: string
      alt?: string
      caption?: string
    }
  | {
      _key?: string
      _type: 'docsVideo'
      asset?: SanityReference | SanityImageField
      poster?: SanityImageField
      url?: string
      posterUrl?: string
      caption?: string
    }
  | {
      _key?: string
      _type: 'docsVideoEmbed'
      provider?: 'youtube' | 'vimeo' | 'other'
      url?: string
      caption?: string
    }
  | {
      _key?: string
      _type: 'docsButton'
      label?: string
      url?: string
      variant?: 'default' | 'outline' | 'ghost'
    }
  | {
      _key?: string
      _type: 'docsDivider'
    }
  | {
      _key?: string
      _type: 'docsCode'
      language?: string
      code?: string
    }

type StudioAssetUrlMap = Record<string, string>

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function sanitizeRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  return value as Record<string, unknown>
}

function getSanityAssetRef(value: unknown) {
  const record = sanitizeRecord(value)
  if (!record) {
    return null
  }

  if (typeof record._ref === 'string' && record._ref.trim()) {
    return record._ref.trim()
  }

  const nestedAsset = sanitizeRecord(record.asset)
  if (nestedAsset && typeof nestedAsset._ref === 'string' && nestedAsset._ref.trim()) {
    return nestedAsset._ref.trim()
  }

  return null
}

function sanitizeReference(value: unknown) {
  const record = sanitizeRecord(value)
  if (!record) {
    return undefined
  }

  const ref = getSanityAssetRef(record)
  if (!ref) {
    return undefined
  }

  return compactRecord({
    _type: 'reference',
    _ref: ref,
  })
}

function sanitizeImageFieldValue(value: unknown) {
  const record = sanitizeRecord(value)
  if (!record) {
    return undefined
  }

  const reference = sanitizeReference(record)
  if (!reference) {
    return undefined
  }

  return compactRecord({
    _type: typeof record._type === 'string' && record._type.trim() ? record._type : 'image',
    asset: reference,
  })
}

function sanitizeFileFieldValue(value: unknown) {
  const record = sanitizeRecord(value)
  if (!record) {
    return undefined
  }

  const reference = sanitizeReference(record)
  if (!reference) {
    return undefined
  }

  return compactRecord({
    _type: typeof record._type === 'string' && record._type.trim() ? record._type : 'file',
    asset: reference,
  })
}

function sanitizeTableRows(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) =>
      compactRecord({
        _key: typeof row._key === 'string' && row._key.trim() ? row._key : `row-${index + 1}`,
        _type: 'docsTableRow',
        cells: sanitizeStringArray(row.cells),
      })
    )
}

export function sanitizeSanityDocsBlock(block: RawSanityDocsBlock): RawSanityDocsBlock {
  const key = typeof block._key === 'string' && block._key.trim() ? block._key : undefined

  switch (block._type) {
    case 'docsHeading':
      return compactRecord({
        _key: key,
        _type: 'docsHeading',
        level: typeof block.level === 'number' ? block.level : undefined,
        text: typeof block.text === 'string' ? block.text : undefined,
      })
    case 'docsParagraph':
      return compactRecord({
        _key: key,
        _type: 'docsParagraph',
        text: typeof block.text === 'string' ? block.text : undefined,
      })
    case 'docsList':
      return compactRecord({
        _key: key,
        _type: 'docsList',
        ordered: typeof block.ordered === 'boolean' ? block.ordered : undefined,
        items: sanitizeStringArray(block.items),
      })
    case 'docsCallout':
      return compactRecord({
        _key: key,
        _type: 'docsCallout',
        tone: typeof block.tone === 'string' ? block.tone : undefined,
        title: typeof block.title === 'string' ? block.title : undefined,
        text: typeof block.text === 'string' ? block.text : undefined,
      })
    case 'docsTable':
      return compactRecord({
        _key: key,
        _type: 'docsTable',
        columns: sanitizeStringArray(block.columns),
        rows: sanitizeTableRows(block.rows),
      })
    case 'docsImage':
      return compactRecord({
        _key: key,
        _type: 'docsImage',
        asset: sanitizeImageFieldValue(block.asset),
        url: typeof block.url === 'string' ? block.url : undefined,
        alt: typeof block.alt === 'string' ? block.alt : undefined,
        caption: typeof block.caption === 'string' ? block.caption : undefined,
      })
    case 'docsVideo':
      return compactRecord({
        _key: key,
        _type: 'docsVideo',
        asset: sanitizeFileFieldValue(block.asset),
        url: typeof block.url === 'string' ? block.url : undefined,
        poster: sanitizeImageFieldValue(block.poster),
        posterUrl: typeof block.posterUrl === 'string' ? block.posterUrl : undefined,
        caption: typeof block.caption === 'string' ? block.caption : undefined,
      })
    case 'docsVideoEmbed':
      return compactRecord({
        _key: key,
        _type: 'docsVideoEmbed',
        provider: typeof block.provider === 'string' ? block.provider : undefined,
        url: typeof block.url === 'string' ? block.url : undefined,
        caption: typeof block.caption === 'string' ? block.caption : undefined,
      })
    case 'docsButton':
      return compactRecord({
        _key: key,
        _type: 'docsButton',
        label: typeof block.label === 'string' ? block.label : undefined,
        url: typeof block.url === 'string' ? block.url : undefined,
        variant: typeof block.variant === 'string' ? block.variant : undefined,
      })
    case 'docsDivider':
      return compactRecord({
        _key: key,
        _type: 'docsDivider',
        marker: typeof block.marker === 'string' && block.marker.trim() ? block.marker : 'divider',
      })
    case 'docsCode':
      return compactRecord({
        _key: key,
        _type: 'docsCode',
        language: typeof block.language === 'string' ? block.language : undefined,
        code: typeof block.code === 'string' ? block.code : undefined,
      })
    default:
      return block
  }
}

function uniqueKey(value: string, index: number) {
  const trimmed = String(value || '').trim()
  return trimmed || `block-${index + 1}`
}

function isSanityAssetReference(value: string | null | undefined) {
  return typeof value === 'string' && /^(image|file)-/.test(value)
}

export function docsBlockToSanityBlock(block: DocsBlock, index: number) {
  const baseKey = uniqueKey(block.id, index)

  switch (block.type) {
    case 'heading':
      return {
        _key: baseKey,
        _type: 'docsHeading' as const,
        level: block.level,
        text: block.text,
      }
    case 'paragraph':
      return {
        _key: baseKey,
        _type: 'docsParagraph' as const,
        text: block.richText,
      }
    case 'list':
      return {
        _key: baseKey,
        _type: 'docsList' as const,
        ordered: block.ordered,
        items: block.items,
      }
    case 'callout':
      return {
        _key: baseKey,
        _type: 'docsCallout' as const,
        tone: block.tone,
        title: block.title,
        text: block.text,
      }
    case 'table':
      return {
        _key: baseKey,
        _type: 'docsTable' as const,
        columns: block.columns,
        rows: block.rows.map((cells, rowIndex) => ({
          _key: uniqueKey(`${baseKey}-row-${rowIndex + 1}`, rowIndex),
          _type: 'docsTableRow' as const,
          cells,
        })),
      }
    case 'image':
      return {
        _key: baseKey,
        _type: 'docsImage' as const,
        url: block.url || '',
        alt: block.alt,
        caption: block.caption,
        ...(isSanityAssetReference(block.assetId)
          ? { asset: { _type: 'image', asset: { _type: 'reference', _ref: block.assetId } } }
          : {}),
      }
    case 'video':
      return {
        _key: baseKey,
        _type: 'docsVideo' as const,
        url: block.url || '',
        posterUrl: block.posterUrl || '',
        caption: block.caption,
        ...(isSanityAssetReference(block.assetId)
          ? { asset: { _type: 'file', asset: { _type: 'reference', _ref: block.assetId } } }
          : {}),
      }
    case 'videoEmbed':
      return {
        _key: baseKey,
        _type: 'docsVideoEmbed' as const,
        provider: block.provider,
        url: block.url,
        caption: block.caption,
      }
    case 'button':
      return {
        _key: baseKey,
        _type: 'docsButton' as const,
        label: block.label,
        url: block.url,
        variant: block.variant,
      }
    case 'divider':
      return {
        _key: baseKey,
        _type: 'docsDivider' as const,
      }
    case 'code':
      return {
        _key: baseKey,
        _type: 'docsCode' as const,
        language: block.language,
        code: block.code,
      }
    case 'richText':
      return {
        _key: baseKey,
        _type: 'docsParagraph' as const,
        text: block.content,
      }
    default: {
      const exhaustiveCheck: never = block
      return exhaustiveCheck
    }
  }
}

export function normalizeSanityDocsSeo(value: unknown): DocsSeo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const record = value as Record<string, unknown>
  return {
    title: typeof record.title === 'string' ? record.title : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
    ogImage: typeof record.ogImage === 'string' ? record.ogImage : undefined,
    noIndex: typeof record.noIndex === 'boolean' ? record.noIndex : undefined,
  }
}

export function studioDocsBlockToAppBlock(
  block: SanityDocsBlockInput,
  index: number,
  assetUrls: StudioAssetUrlMap = {}
): DocsBlock | null {
  const id = uniqueKey(block._key || `${block._type}-${index + 1}`, index)

  switch (block._type) {
    case 'docsHeading':
      return {
        id,
        type: 'heading',
        level: typeof block.level === 'number' ? block.level : 2,
        text: typeof block.text === 'string' ? block.text : '',
      }
    case 'docsParagraph':
      return {
        id,
        type: 'paragraph',
        richText: typeof block.text === 'string' ? block.text : '',
      }
    case 'docsList':
      return {
        id,
        type: 'list',
        ordered: Boolean(block.ordered),
        items: Array.isArray(block.items) ? block.items.filter((item): item is string => typeof item === 'string') : [],
      }
    case 'docsCallout':
      return {
        id,
        type: 'callout',
        tone:
          block.tone === 'success' || block.tone === 'warning' || block.tone === 'danger'
            ? block.tone
            : 'info',
        title: typeof block.title === 'string' ? block.title : '',
        text: typeof block.text === 'string' ? block.text : '',
      }
    case 'docsTable':
      return {
        id,
        type: 'table',
        columns: Array.isArray(block.columns)
          ? block.columns.filter((item): item is string => typeof item === 'string')
          : [],
        rows: Array.isArray(block.rows)
          ? block.rows.map((row) =>
              Array.isArray(row?.cells)
                ? row.cells.filter((cell): cell is string => typeof cell === 'string')
                : []
            )
          : [],
      }
    case 'docsImage': {
      const assetId = getSanityAssetRef(block.asset) || null
      return {
        id,
        type: 'image',
        assetId,
        url: assetId ? assetUrls[assetId] || block.url || '' : block.url || '',
        alt: typeof block.alt === 'string' ? block.alt : '',
        caption: typeof block.caption === 'string' ? block.caption : '',
      }
    }
    case 'docsVideo': {
      const assetId = getSanityAssetRef(block.asset) || null
      const posterAssetId = getSanityAssetRef(block.poster) || null
      return {
        id,
        type: 'video',
        assetId,
        url: assetId ? assetUrls[assetId] || block.url || '' : block.url || '',
        caption: typeof block.caption === 'string' ? block.caption : '',
        posterUrl: posterAssetId ? assetUrls[posterAssetId] || block.posterUrl || '' : block.posterUrl || '',
      }
    }
    case 'docsVideoEmbed':
      return {
        id,
        type: 'videoEmbed',
        provider:
          block.provider === 'youtube' || block.provider === 'vimeo'
            ? block.provider
            : 'other',
        url: typeof block.url === 'string' ? block.url : '',
        caption: typeof block.caption === 'string' ? block.caption : '',
      }
    case 'docsButton':
      return {
        id,
        type: 'button',
        label: typeof block.label === 'string' ? block.label : '',
        url: typeof block.url === 'string' ? block.url : '',
        variant:
          block.variant === 'outline' || block.variant === 'ghost'
            ? block.variant
            : 'default',
      }
    case 'docsDivider':
      return {
        id,
        type: 'divider',
      }
    case 'docsCode':
      return {
        id,
        type: 'code',
        language: typeof block.language === 'string' ? block.language : 'text',
        code: typeof block.code === 'string' ? block.code : '',
      }
    default:
      return null
  }
}
