import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'

import { CmsBlockRenderer } from '@/components/docs/cms-block-renderer'
import { DocsInlineText } from '@/components/docs/docs-inline-text'
import type { DocsBlock, DocsPageNode, DocsRevision } from '@/lib/docs-cms/types'

function flatten(nodes: DocsPageNode[], out: DocsPageNode[] = []): DocsPageNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0) {
      flatten(node.children, out)
    }
  }
  return out
}

function parseTocCardItem(item: string) {
  const normalized = String(item || '').trim()
  if (!normalized) {
    return null
  }

  const separatorIndex = normalized.indexOf(':')
  if (separatorIndex === -1) {
    return {
      title: normalized,
      description: '',
    }
  }

  return {
    title: normalized.slice(0, separatorIndex).trim(),
    description: normalized.slice(separatorIndex + 1).trim(),
  }
}

function findPageDescription(page: DocsPageNode, revision?: DocsRevision | null) {
  const summary = typeof page.summary === 'string' ? page.summary.trim() : ''
  if (summary) {
    return summary
  }

  const firstParagraph = revision?.blocks.find(
    (block): block is Extract<DocsBlock, { type: 'paragraph' }> =>
      block.type === 'paragraph' && block.richText.trim().length > 0
  )

  return firstParagraph?.richText || ''
}

function isHeadingBlock(block: DocsBlock | undefined): block is Extract<DocsBlock, { type: 'heading' }> {
  return block?.type === 'heading'
}

function isParagraphBlock(block: DocsBlock | undefined): block is Extract<DocsBlock, { type: 'paragraph' }> {
  return block?.type === 'paragraph'
}

export function CmsDocsPage({
  locale,
  basePath,
  page,
  revision,
  tree,
  revisionsByPageId,
}: {
  locale: string
  basePath: string
  page: DocsPageNode
  revision: DocsRevision
  tree: DocsPageNode[]
  revisionsByPageId?: Record<string, DocsRevision>
}) {
  const flat = flatten(tree)
  const currentIndex = flat.findIndex((item) => item.id === page.id)
  const previous = currentIndex > 0 ? flat[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null
  const isRu = locale === 'ru'

  if (page.isHome) {
    const listIndex = revision.blocks.findIndex((block) => block.type === 'list')
    let tocHeadingIndex = -1
    let tocHintIndex = -1

    if (
      listIndex >= 2 &&
      revision.blocks[listIndex - 2]?.type === 'heading' &&
      revision.blocks[listIndex - 1]?.type === 'paragraph'
    ) {
      tocHeadingIndex = listIndex - 2
      tocHintIndex = listIndex - 1
    } else {
      for (let index = 0; index < revision.blocks.length - 1; index += 1) {
        const current = revision.blocks[index]
        const next = revision.blocks[index + 1]
        if (current?.type === 'heading' && next?.type === 'paragraph') {
          tocHeadingIndex = index
          tocHintIndex = index + 1
        }
      }
    }

    const tocHeadingCandidate = tocHeadingIndex >= 0 ? revision.blocks[tocHeadingIndex] : undefined
    const tocHintCandidate = tocHintIndex >= 0 ? revision.blocks[tocHintIndex] : undefined
    const tocHeading: Extract<DocsBlock, { type: 'heading' }> | null = isHeadingBlock(tocHeadingCandidate)
      ? tocHeadingCandidate
      : null
    const tocHint: Extract<DocsBlock, { type: 'paragraph' }> | null = isParagraphBlock(tocHintCandidate)
      ? tocHintCandidate
      : null
    const heroBlocks = revision.blocks.slice(0, tocHeadingIndex >= 0 ? tocHeadingIndex : listIndex >= 0 ? listIndex : revision.blocks.length)
    const trailingBlocks =
      listIndex >= 0
        ? revision.blocks.slice(listIndex + 1)
        : tocHintIndex >= 0
          ? revision.blocks.slice(tocHintIndex + 1)
          : []
    const pages = flat.filter((item) => !item.isHome)
    const tocList = listIndex >= 0 && revision.blocks[listIndex]?.type === 'list'
      ? revision.blocks[listIndex]
      : null
    const fallbackCards = tocList
      ? tocList.items.map(parseTocCardItem).filter((item): item is NonNullable<ReturnType<typeof parseTocCardItem>> => Boolean(item))
      : []

    return (
      <>
        {heroBlocks.length > 0 ? (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
            <CmsBlockRenderer blocks={heroBlocks} locale={locale} />
          </section>
        ) : null}

        <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <BookOpen className="w-6 h-6 text-[#24A1DE]" />
            <h2 className="text-3xl font-semibold text-white">
              {tocHeading?.text || (isRu ? 'Разделы документации' : 'Documentation sections')}
            </h2>
          </div>
          <p className="text-base text-zinc-400 leading-relaxed mb-8">
            <DocsInlineText
              text={
                tocHint?.richText ||
                (isRu
                  ? 'Используйте карточки ниже для быстрого перехода по разделам.'
                  : 'Use the cards below to move quickly between documentation sections.')
              }
            />
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {pages.length > 0
              ? pages.map((docsPage) => {
                  const pageRevision = revisionsByPageId?.[docsPage.id]
                  const description = findPageDescription(docsPage, pageRevision)

                  return (
                    <Link
                      key={docsPage.id}
                      href={docsPage.isHome ? basePath : `${basePath}/${docsPage.path}`}
                      className="group rounded-2xl border border-white/10 bg-zinc-950/40 p-5 hover:border-[#24A1DE]/40 hover:bg-zinc-900 transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white group-hover:text-[#8fd8ff] transition-colors">
                            {docsPage.title}
                          </h3>
                          {description ? (
                            <p className="mt-2 text-base text-zinc-400 leading-relaxed">
                              <DocsInlineText text={description} />
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-zinc-500 group-hover:text-[#24A1DE] transition-transform group-hover:translate-x-1 duration-300">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </Link>
                  )
                })
              : fallbackCards.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="rounded-2xl border border-white/10 bg-zinc-950/40 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                        {item.description ? (
                          <p className="mt-2 text-base text-zinc-400 leading-relaxed">
                            <DocsInlineText text={item.description} />
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </section>

        {trailingBlocks.length > 0 ? (
          <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
            <CmsBlockRenderer blocks={trailingBlocks} locale={locale} />
          </section>
        ) : null}
      </>
    )
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400 mb-4 tracking-wide">
          <Link href={basePath} className="hover:text-zinc-200 hover:underline transition-all">
            {isRu ? 'Документация' : 'Documentation'}
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-200 font-medium">{page.title}</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white leading-tight">{page.title}</h1>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
        <CmsBlockRenderer blocks={revision.blocks} locale={locale} />
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 mt-12 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">
              {isRu ? 'Навигация по документации' : 'Documentation navigation'}
            </h2>
            <p className="text-base text-zinc-400 mt-2 leading-relaxed">
              {isRu
                ? 'Переходите по страницам по порядку, как по учебному маршруту.'
                : 'Move through pages step by step as a guided learning path.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-3 shrink-0">
            <Link
              href={previous ? (previous.isHome ? basePath : `${basePath}/${previous.path}`) : '#'}
              className={`inline-flex items-center justify-center rounded-md border px-5 h-11 text-sm ${
                previous
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-100'
                  : 'pointer-events-none border-white/10 bg-zinc-900/40 text-zinc-500'
              }`}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {previous ? previous.title : isRu ? 'Нет предыдущей' : 'No previous'}
            </Link>
            <Link
              href={next ? (next.isHome ? basePath : `${basePath}/${next.path}`) : '#'}
              className={`inline-flex items-center justify-center rounded-md border px-5 h-11 text-sm ${
                next
                  ? 'border-[#24A1DE]/30 bg-gradient-to-r from-[#24A1DE]/20 to-[#8B5CF6]/20 hover:opacity-90 text-white'
                  : 'pointer-events-none border-white/10 bg-zinc-900/40 text-zinc-500'
              }`}
            >
              {next ? next.title : isRu ? 'Конец маршрута' : 'End of sequence'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
