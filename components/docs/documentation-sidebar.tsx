'use client'

import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import {
  BookOpen,
  Bot,
  CircleHelp,
  Database,
  FileVideo,
  Keyboard,
  PlayCircle,
  Rocket,
  Search,
  Workflow,
  X,
} from 'lucide-react'

import { DocsInlineText } from '@/components/docs/docs-inline-text'
import { Input } from '@/components/ui/input'
import type { DocsContent } from '@/lib/docs/docs-content'
import type { DocsPageDefinition, DocsPageSlug } from '@/lib/docs/docs-pages'

type SearchKind = 'page' | 'section' | 'step' | 'node' | 'issue' | 'ui' | 'area'

type SearchEntry = {
  id: string
  href: string
  title: string
  snippet: string
  kind: SearchKind
  haystack: string
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function compactSnippet(value: string, max = 120) {
  const v = value.replace(/\s+/g, ' ').trim()
  if (v.length <= max) return v
  return `${v.slice(0, max - 1).trimEnd()}…`
}

function getPageIcon(slug: DocsPageSlug): ComponentType<{ className?: string }> {
  switch (slug) {
    case 'getting-started':
      return PlayCircle
    case 'how-it-works':
      return Workflow
    case 'nodes':
      return Bot
    case 'keyboards-triggers':
      return Keyboard
    case 'data-security':
      return Database
    case 'testing-deploy':
      return Rocket
    case 'troubleshooting':
      return CircleHelp
    case 'video-plan':
      return FileVideo
    default:
      return BookOpen
  }
}

export function DocumentationSidebar({
  content,
  locale,
  pages,
  currentPageSlug,
  basePath,
}: {
  content: DocsContent
  locale: string
  pages: DocsPageDefinition[]
  currentPageSlug: DocsPageSlug | null
  basePath?: string
}) {
  const [query, setQuery] = useState('')
  const isRu = content.locale === 'ru'
  const baseDocsPath = basePath ?? `/${locale}/docs`

  const searchIndex = useMemo<SearchEntry[]>(() => {
    const pageBySection = new Map<string, DocsPageDefinition>()
    for (const page of pages) {
      for (const sectionId of page.sections) {
        pageBySection.set(sectionId, page)
      }
    }

    const entries: SearchEntry[] = []

    const pushEntry = (entry: Omit<SearchEntry, 'haystack'>) => {
      entries.push({
        ...entry,
        haystack: normalizeForSearch(`${entry.title} ${entry.snippet}`),
      })
    }

    for (const page of pages) {
      pushEntry({
        id: `page-${page.slug}`,
        href: `${baseDocsPath}/${page.slug}`,
        title: page.title,
        snippet: page.description,
        kind: 'page',
      })
    }

    for (const section of content.sections) {
      const page = pageBySection.get(section.id)
      if (!page) continue

      pushEntry({
        id: `section-${section.id}`,
        href: `${baseDocsPath}/${page.slug}#${section.id}`,
        title: section.title,
        snippet: section.description,
        kind: 'section',
      })
    }

    const quickStartPage = pageBySection.get('quick-start')
    if (quickStartPage) {
      for (const step of content.quickStart.steps) {
        pushEntry({
          id: `quick-${step.id}`,
          href: `${baseDocsPath}/${quickStartPage.slug}#quickstart-${step.id}`,
          title: step.title,
          snippet: [step.goal, ...step.actions.slice(0, 2)].join(' '),
          kind: 'step',
        })
      }
    }

    const areasPage = pageBySection.get('editor-areas')
    if (areasPage) {
      for (const area of content.editorAreas.cards) {
        pushEntry({
          id: `area-${area.id}`,
          href: `${baseDocsPath}/${areasPage.slug}#editor-areas`,
          title: area.title,
          snippet: `${area.subtitle}. ${area.whenToUse}`,
          kind: 'area',
        })
      }
    }

    const uiPage = pageBySection.get('ui-components')
    if (uiPage) {
      for (const component of content.uiComponents.cards) {
        pushEntry({
          id: `ui-${component.id}`,
          href: `${baseDocsPath}/${uiPage.slug}#ui-${component.id}`,
          title: component.title,
          snippet: `${component.location}. ${component.purpose}`,
          kind: 'ui',
        })
      }
    }

    const nodesPage = pageBySection.get('nodes-reference')
    if (nodesPage) {
      for (const group of content.nodes.groups) {
        for (const node of group.items) {
          pushEntry({
            id: `node-${node.id}`,
            href: `${baseDocsPath}/${nodesPage.slug}#node-${node.id}`,
            title: node.name,
            snippet: `${group.title}. ${node.purpose} ${node.whenToUse}`,
            kind: 'node',
          })
        }
      }
    }

    const troublePage = pageBySection.get('troubleshooting')
    if (troublePage) {
      for (const item of content.troubleshooting.items) {
        pushEntry({
          id: `issue-${item.id}`,
          href: `${baseDocsPath}/${troublePage.slug}#troubleshoot-${item.id}`,
          title: item.question,
          snippet: item.answer.join(' '),
          kind: 'issue',
        })
      }
    }

    return entries
  }, [baseDocsPath, content, pages])

  const normalizedQuery = normalizeForSearch(query)
  const results = useMemo(() => {
    if (!normalizedQuery) return []

    return searchIndex
      .filter((entry) => entry.haystack.includes(normalizedQuery))
      .sort((a, b) => {
        const aStarts = a.haystack.startsWith(normalizedQuery) ? 1 : 0
        const bStarts = b.haystack.startsWith(normalizedQuery) ? 1 : 0
        if (aStarts !== bStarts) return bStarts - aStarts
        return a.title.length - b.title.length
      })
      .slice(0, 10)
  }, [normalizedQuery, searchIndex])

  const kindLabels: Record<SearchKind, string> = isRu
    ? { page: 'Стр.', section: 'Раздел', step: 'Шаг', node: 'Нода', issue: 'Ошибка', ui: 'UI', area: 'Зона' }
    : { page: 'Page', section: 'Section', step: 'Step', node: 'Node', issue: 'Issue', ui: 'UI', area: 'Area' }

  return (
    <aside className="lg:sticky lg:top-24 space-y-4">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl p-3 sm:p-4 overflow-hidden shadow-md">
        <div className="text-sm sm:text-base font-semibold text-white mb-1.5">{content.tocTitle}</div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3 hidden 2xl:block line-clamp-3">
          <DocsInlineText text={content.tocHint} />
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isRu ? 'Поиск по docs…' : 'Search docs…'}
            className="pl-9 pr-9 py-4 bg-zinc-950/60 border-white/10 text-white placeholder:text-zinc-500 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-[#24A1DE]/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={isRu ? 'Очистить поиск' : 'Clear search'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-2">
          {!normalizedQuery ? (
            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1">
              <a
                href={baseDocsPath}
                className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 border transition-all duration-200 ${currentPageSlug === null ? 'bg-white/10 border-white/20 shadow-sm' : 'border-transparent hover:bg-white/5 hover:border-white/10'
                  }`}
              >
                <div className="rounded-md border border-white/10 bg-white/5 p-1.5 shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-zinc-300 group-hover:text-white" />
                </div>
                <span className={`text-xs sm:text-sm tracking-wide min-w-0 line-clamp-1 ${currentPageSlug === null ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white'}`}>
                  {isRu ? 'Обзор документации' : 'Documentation Overview'}
                </span>
              </a>

              {pages.map((page) => {
                const Icon = getPageIcon(page.slug)
                const isActive = currentPageSlug === page.slug

                return (
                  <a
                    key={page.slug}
                    href={`${baseDocsPath}/${page.slug}`}
                    title={page.description}
                    className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 border transition-all duration-200 ${isActive ? 'bg-white/10 border-white/20 shadow-sm' : 'border-transparent hover:bg-white/5 hover:border-white/10'
                      }`}
                  >
                    <div className="rounded-md border border-white/10 bg-white/5 p-1.5 shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#24A1DE]' : 'text-zinc-300 group-hover:text-white'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs sm:text-sm tracking-wide line-clamp-1 ${isActive ? 'text-white font-medium' : 'text-zinc-300 group-hover:text-white'}`}>{page.title}</div>
                    </div>
                    <div className="shrink-0 text-[10px] text-zinc-500 tabular-nums hidden xl:block">
                      {page.sections.length}
                    </div>
                  </a>
                )
              })}
            </nav>
          ) : results.length > 0 ? (
            <div className="space-y-2">
              {results.map((result) => (
                <a
                  key={result.id}
                  href={result.href}
                  className="block rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 px-3 py-2.5 transition-colors"
                  title={result.snippet}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-zinc-400 shrink-0 uppercase tracking-wider">
                      {kindLabels[result.kind]}
                    </span>
                    <div className="text-sm font-medium text-zinc-100 truncate">{result.title}</div>
                  </div>
                  <div className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {compactSnippet(result.snippet)}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-400 px-3 py-4 text-center">
              {isRu ? 'Ничего не найдено. Попробуй название ноды, раздела или ошибки.' : 'Nothing found. Try a node name, section title, or issue keyword.'}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-zinc-500 leading-relaxed hidden">
          {isRu
            ? 'Слева — навигация и поиск. Основная прокрутка страницы идёт в контенте.'
            : 'Left side is navigation + search. Main page scrolling happens in the content area.'}
        </div>
      </div>
    </aside>
  )
}
