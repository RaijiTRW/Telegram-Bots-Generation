import Link from 'next/link'
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react'

import { DocsInlineText } from '@/components/docs/docs-inline-text'
import { Button } from '@/components/ui/button'
import type { DocsContent } from '@/lib/docs/docs-content'
import type { DocsPageDefinition } from '@/lib/docs/docs-pages'

export function DocsHomePage({
  locale,
  content,
  pages,
  basePath,
}: {
  locale: string
  content: DocsContent
  pages: DocsPageDefinition[]
  basePath?: string
}) {
  const isRu = content.locale === 'ru'
  const docsBasePath = basePath ?? `/${locale}/docs`

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 backdrop-blur-xl p-6 md:p-8">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#24A1DE]/10 blur-3xl opacity-70" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[#8B5CF6]/10 blur-3xl opacity-70" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#24A1DE]" />
            {content.hero.badge}
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
            {content.hero.title}
          </h1>
          <p className="mt-6 text-xl md:text-2xl text-zinc-200 max-w-4xl leading-relaxed">
            {content.hero.subtitle}
          </p>
          <p className="mt-4 text-base md:text-lg text-zinc-300 max-w-4xl leading-relaxed">
            <DocsInlineText text={content.hero.description} />
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button asChild className="gap-2">
              <Link href={`${docsBasePath}/getting-started`}>
                {content.hero.actions.quickStart}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
              <Link href={`/${locale}/pricing`}>{content.hero.actions.openDashboard}</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
              <Link href={`/${locale}/auth/signup`}>{content.hero.actions.createBot}</Link>
            </Button>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {content.hero.notes.map((note) => (
              <div key={note} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4 text-base text-zinc-300 leading-relaxed shadow-sm">
                <DocsInlineText text={note} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 mt-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-white">
          {isRu ? 'Документация для быстрого запуска Telegram-бота' : 'Documentation for a faster Telegram bot launch'}
        </h2>
        <p className="mt-3 max-w-4xl text-base leading-7 text-zinc-300">
          {isRu
            ? 'Если вы ищете, как создать Telegram-бота для заявок, записи, FAQ, автоворонок и запуска без тяжёлой разработки, начните с этого раздела. Здесь собраны шаги по настройке, логике, тестированию, публикации и безопасной работе с данными.'
            : 'If you are looking for a practical way to create a Telegram bot for leads, booking, FAQ, funnels, and no-code launch, start here. This section covers setup, logic, testing, publishing, and safe handling of data.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
            <Link href={`/${locale}/telegram-bot-builder`}>
              {isRu ? 'Открыть обзор конструктора' : 'Open builder overview'}
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10">
            <Link href={`/${locale}/create-telegram-bot`}>
              {isRu ? 'Как создать бота' : 'How to create a bot'}
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl p-6 md:p-8 mt-6">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-6 h-6 text-[#24A1DE]" />
          <h2 className="text-3xl font-semibold text-white">{content.tocTitle}</h2>
        </div>
        <p className="text-base text-zinc-400 leading-relaxed mb-8">
          <DocsInlineText text={content.tocHint} />
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {pages.map((page) => (
            <Link
              key={page.slug}
              href={`${docsBasePath}/${page.slug}`}
              className="group rounded-2xl border border-white/10 bg-zinc-950/40 p-5 hover:border-[#24A1DE]/40 hover:bg-zinc-900 transition-all duration-300 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white group-hover:text-[#8fd8ff] transition-colors">
                    {page.title}
                  </h3>
                  <p className="mt-2 text-base text-zinc-400 leading-relaxed">
                    <DocsInlineText text={page.description} />
                  </p>
                </div>
                <div className="shrink-0 text-zinc-500 group-hover:text-[#24A1DE] transition-transform group-hover:translate-x-1 duration-300">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 text-sm text-zinc-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-zinc-700 group-hover:bg-[#24A1DE] transition-colors" />
                {page.sections.length} {isRu ? 'разделов внутри' : 'sections inside'}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
