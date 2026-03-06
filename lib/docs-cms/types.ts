import type { Json } from '@/lib/supabase/types'

export type DocsLocale = 'ru' | 'en'

export type DocsBlockHeading = {
  id: string
  type: 'heading'
  level: 1 | 2 | 3 | 4 | 5 | 6
  text: string
}

export type DocsBlockParagraph = {
  id: string
  type: 'paragraph'
  richText: string
}

export type DocsBlockList = {
  id: string
  type: 'list'
  ordered: boolean
  items: string[]
}

export type DocsBlockCallout = {
  id: string
  type: 'callout'
  tone: 'info' | 'success' | 'warning' | 'danger'
  title: string
  text: string
}

export type DocsBlockTable = {
  id: string
  type: 'table'
  columns: string[]
  rows: string[][]
}

export type DocsBlockImage = {
  id: string
  type: 'image'
  assetId: string | null
  url: string
  alt: string
  caption: string
}

export type DocsBlockVideo = {
  id: string
  type: 'video'
  assetId: string | null
  url: string
  caption: string
  posterUrl: string
}

export type DocsBlockVideoEmbed = {
  id: string
  type: 'videoEmbed'
  provider: 'youtube' | 'vimeo' | 'other'
  url: string
  caption: string
}

export type DocsBlockButton = {
  id: string
  type: 'button'
  label: string
  url: string
  variant: 'default' | 'outline' | 'ghost'
}

export type DocsBlockDivider = {
  id: string
  type: 'divider'
}

export type DocsBlockCode = {
  id: string
  type: 'code'
  language: string
  code: string
}

export type DocsBlockRichText = {
  id: string
  type: 'richText'
  content: string
}

export type DocsBlock =
  | DocsBlockHeading
  | DocsBlockParagraph
  | DocsBlockList
  | DocsBlockCallout
  | DocsBlockTable
  | DocsBlockImage
  | DocsBlockVideo
  | DocsBlockVideoEmbed
  | DocsBlockButton
  | DocsBlockDivider
  | DocsBlockCode
  | DocsBlockRichText

export type DocsSeo = {
  title?: string
  description?: string
  ogImage?: string
  noIndex?: boolean
}

export type DocsRevisionStatus = 'draft' | 'published' | 'archived'

export type DocsRevision = {
  id: string
  pageId: string
  revisionNo: number
  status: DocsRevisionStatus
  titleSnapshot: string
  blocks: DocsBlock[]
  seo: DocsSeo
  changeNote: string | null
  createdBy: string
  createdAt: string
}

export type DocsPageNode = {
  id: string
  locale: DocsLocale
  parentId: string | null
  title: string
  slug: string
  path: string
  sortOrder: number
  isHome: boolean
  latestRevisionId: string | null
  publishedRevisionId: string | null
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  children: DocsPageNode[]
}

export type DocsTree = {
  locale: DocsLocale
  pages: DocsPageNode[]
}

export type DocsEditorPayload = {
  page: DocsPageNode
  draft: DocsRevision
  revisions: DocsRevision[]
  redirects: Array<{
    id: string
    fromPath: string
    isActive: boolean
    createdAt: string
  }>
}

export type DocsPageMetaUpdateInput = {
  pageId: string
  title: string
  slug: string
  parentId: string | null
  isHome: boolean
  seo: DocsSeo
}

export function isDocsLocale(value: string): value is DocsLocale {
  return value === 'ru' || value === 'en'
}

export function toDocsBlocks(value: Json): DocsBlock[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item) => item && typeof item === 'object') as DocsBlock[]
}
