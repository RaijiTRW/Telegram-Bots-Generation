import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { CmsBlockRenderer } from '@/components/docs/cms-block-renderer'
import type { DocsPageNode, DocsRevision } from '@/lib/docs-cms/types'

function flatten(nodes: DocsPageNode[], out: DocsPageNode[] = []): DocsPageNode[] {
  for (const node of nodes) {
    out.push(node)
    if (node.children.length > 0) {
      flatten(node.children, out)
    }
  }
  return out
}

export function CmsDocsPage({
  locale,
  basePath,
  page,
  revision,
  tree,
}: {
  locale: string
  basePath: string
  page: DocsPageNode
  revision: DocsRevision
  tree: DocsPageNode[]
}) {
  const flat = flatten(tree)
  const currentIndex = flat.findIndex((item) => item.id === page.id)
  const previous = currentIndex > 0 ? flat[currentIndex - 1] : null
  const next = currentIndex >= 0 && currentIndex < flat.length - 1 ? flat[currentIndex + 1] : null
  const isRu = locale === 'ru'

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
