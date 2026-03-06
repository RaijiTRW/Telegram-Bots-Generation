import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RenderDocsSections } from '@/components/docs/docs-section-renderers'
import type { DocsContent } from '@/lib/docs/docs-content'
import type { DocsPageDefinition } from '@/lib/docs/docs-pages'

export function DocsSectionPage({
  locale,
  content,
  page,
  previousPage,
  nextPage,
  basePath,
}: {
  locale: string
  content: DocsContent
  page: DocsPageDefinition
  previousPage: DocsPageDefinition | null
  nextPage: DocsPageDefinition | null
  basePath?: string
}) {
  const isRu = content.locale === 'ru'
  const docsBasePath = basePath ?? `/${locale}/docs`

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400 mb-4 tracking-wide">
          <Link href={docsBasePath} className="hover:text-zinc-200 hover:underline transition-all">
            {isRu ? 'Документация' : 'Documentation'}
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-200 font-medium">{page.title}</span>
        </div>

        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white leading-tight">{page.title}</h1>
        <p className="mt-4 text-[15px] md:text-base text-zinc-300 leading-7 max-w-[72ch]">{page.description}</p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {page.sections.map((sectionId) => {
            const meta = content.sections.find((s) => s.id === sectionId)
            if (!meta) return null
            return (
              <a
                key={sectionId}
                href={`#${sectionId}`}
                className="text-xs px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:border-white/20 hover:text-white transition-all shadow-sm"
              >
                {meta.title}
              </a>
            )
          })}
        </div>
      </section>

      <RenderDocsSections content={content} sections={page.sections} />

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 mt-12 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">
              {isRu ? 'Навигация по документации' : 'Documentation navigation'}
            </h2>
            <p className="text-base text-zinc-400 mt-2 leading-relaxed">
              {isRu ? 'Переходи по страницам как по учебному курсу: слева — поиск, здесь — следующий шаг.' : 'Move through pages like a guided course: search on the left, next step below.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-3 shrink-0">
            <Button asChild variant="outline" size="lg" className="border-white/10 bg-white/5 hover:bg-white/10 text-sm h-12 px-6" disabled={!previousPage}>
              {previousPage ? (
                <Link href={`${docsBasePath}/${previousPage.slug}`}>
                  <ArrowLeft className="w-4 h-4" />
                  {previousPage.title}
                </Link>
              ) : (
                <span>
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  {isRu ? 'Нет предыдущей' : 'No previous'}
                </span>
              )}
            </Button>
            <Button asChild size="lg" className="shrink-0 h-12 px-6 text-sm" disabled={!nextPage}>
              {nextPage ? (
                <Link href={`${docsBasePath}/${nextPage.slug}`}>
                  {nextPage.title}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              ) : (
                <span>
                  {isRu ? 'Конец маршрута' : 'End of sequence'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </span>
              )}
            </Button>
          </div>
        </div>
      </section>

    </>
  )
}
