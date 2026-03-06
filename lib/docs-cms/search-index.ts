import type { DocsBlock, DocsPageNode } from '@/lib/docs-cms/types'
import { extractDocsBlocksText } from '@/lib/docs-cms/blocks'

export type DocsSearchEntry = {
  pageId: string
  path: string
  title: string
  snippet: string
  scoreHint: string
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function snippet(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`
}

function flattenTree(nodes: DocsPageNode[], out: DocsPageNode[] = []): DocsPageNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0) {
      flattenTree(node.children, out)
    }
  }
  return out
}

export function buildDocsSearchIndex(
  pages: DocsPageNode[],
  blocksByPageId: Record<string, DocsBlock[]>
): DocsSearchEntry[] {
  const flatPages = flattenTree(pages)
  return flatPages.map((page) => {
    const blocks = blocksByPageId[page.id] || []
    const text = extractDocsBlocksText(blocks)
    return {
      pageId: page.id,
      path: page.path,
      title: page.title,
      snippet: snippet(text),
      scoreHint: normalize(`${page.title} ${page.path} ${text}`),
    }
  })
}

export function queryDocsSearchIndex(
  index: DocsSearchEntry[],
  query: string,
  limit = 20
): DocsSearchEntry[] {
  const needle = normalize(query)
  if (!needle) return []

  return index
    .filter((item) => item.scoreHint.includes(needle))
    .sort((a, b) => {
      const aStarts = a.scoreHint.startsWith(needle) ? 1 : 0
      const bStarts = b.scoreHint.startsWith(needle) ? 1 : 0
      if (aStarts !== bStarts) {
        return bStarts - aStarts
      }
      return a.title.length - b.title.length
    })
    .slice(0, Math.max(1, limit))
}
