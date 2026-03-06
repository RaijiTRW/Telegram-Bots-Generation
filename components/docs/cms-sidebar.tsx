'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { BookOpen, Search } from 'lucide-react'

import type { DocsPageNode } from '@/lib/docs-cms/types'
import type { DocsSearchEntry } from '@/lib/docs-cms/search-index'
import { Input } from '@/components/ui/input'

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function CmsDocsSidebar({
  locale,
  basePath,
  tree,
  currentPath,
  searchIndex,
}: {
  locale: string
  basePath: string
  tree: DocsPageNode[]
  currentPath: string
  searchIndex: DocsSearchEntry[]
}) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalize(query)
  const isRu = locale === 'ru'

  const results = useMemo(() => {
    if (!normalizedQuery) return []
    return searchIndex
      .filter((entry) => entry.scoreHint.includes(normalizedQuery))
      .slice(0, 12)
  }, [searchIndex, normalizedQuery])

  const renderTreeNode = (node: DocsPageNode, depth = 0) => {
    const href = node.isHome ? basePath : `${basePath}/${node.path}`
    const active = node.path === currentPath || (node.isHome && currentPath === '')

    return (
      <div key={node.id} className="space-y-1">
        <Link
          href={href}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] border transition ${
            active
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-transparent text-zinc-300 hover:bg-white/5 hover:border-white/10 hover:text-white'
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
        >
          <span className="truncate">{node.title}</span>
        </Link>
        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="lg:sticky lg:top-24 lg:max-w-[280px] space-y-3">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl p-2.5 sm:p-3 overflow-hidden shadow-md">
        <div className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[#24A1DE]" />
          {isRu ? 'Разделы документации' : 'Documentation'}
        </div>

        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isRu ? 'Поиск...' : 'Search...'}
            className="pl-9 h-9 bg-zinc-950/60 border-white/10 text-white placeholder:text-zinc-500 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-[#24A1DE]/40"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-1.5 max-h-[70vh] overflow-y-auto">
          {!normalizedQuery ? (
            <nav className="space-y-1">{tree.map((node) => renderTreeNode(node))}</nav>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result) => (
                <Link
                  key={result.pageId}
                  href={result.path ? `${basePath}/${result.path}` : basePath}
                  className="block rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 px-2.5 py-2 transition-colors"
                >
                  <div className="text-sm font-medium text-zinc-100 truncate">{result.title}</div>
                  <div className="mt-1 text-xs text-zinc-400 line-clamp-2">{result.snippet}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500 px-3 py-4 text-center">
              {isRu ? 'Ничего не найдено' : 'Nothing found'}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
