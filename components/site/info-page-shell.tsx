import Link from 'next/link'
import { ArrowRight, Clock3, FileText, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'

import { Footer } from '@/components/footer/footer'
import { Header } from '@/components/header/header'
import { StatusHistoryStrip } from '@/components/site/status-history-strip'
import type { InfoPageContent } from '@/lib/site/info-pages'
import type { PublicStatusHistory } from '@/lib/site/status-history'

type InfoPageShellProps = {
  locale: string
  content: InfoPageContent
  statusHistory?: PublicStatusHistory | null
}

const pageIcons: Record<InfoPageContent['slug'], LucideIcon> = {
  privacy: ShieldCheck,
  security: ShieldCheck,
  status: Sparkles,
  terms: FileText,
  contact: FileText,
}

export function InfoPageShell({ locale, content, statusHistory = null }: InfoPageShellProps) {
  const Icon = pageIcons[content.slug]
  const isRu = locale === 'ru'

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(36,161,222,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(0,230,118,0.12),transparent_30%),rgba(9,12,18,0.92)] p-8 sm:p-10 lg:p-12">
            <div className="absolute inset-0 cyber-grid opacity-20" />
            <div className="relative flex flex-col gap-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#7dd3fc]">
                    <Icon className="h-3.5 w-3.5" />
                    {content.eyebrow}
                  </div>
                  <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {content.title}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                    {content.description}
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {isRu ? 'Актуальность' : 'Freshness'}
                  </div>
                  <div className="mt-3 text-sm font-medium text-zinc-100">{content.updatedAt}</div>
                </div>
              </div>

              {content.callout ? (
                <div className="max-w-3xl rounded-2xl border border-[#24A1DE]/20 bg-[#24A1DE]/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-[#7dd3fc]">
                    {content.callout.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">
                    {content.callout.description}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          {content.slug === 'status' && statusHistory ? (
            <StatusHistoryStrip locale={locale} history={statusHistory} />
          ) : null}

          <section className="mt-8 grid gap-6">
            {content.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-white/10 bg-zinc-950/55 p-6 sm:p-7"
              >
                <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-300 sm:text-base">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets?.length ? (
                  <ul className="mt-5 space-y-2 text-sm text-zinc-300 sm:text-base">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#24A1DE]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>

          <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/55 p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  {isRu ? 'Нужен другой раздел?' : 'Need a different section?'}
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {isRu
                    ? 'Вы можете вернуться на главную, открыть документацию, посмотреть тарифы или сразу перейти к созданию Telegram-бота.'
                    : 'You can return to the homepage, open the documentation, compare pricing, or go straight to Telegram bot creation.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}`}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {isRu ? 'На главную' : 'Home'}
                </Link>
                <Link
                  href={`/${locale}/docs`}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {isRu ? 'Документация' : 'Documentation'}
                </Link>
                <Link
                  href={`/${locale}/pricing`}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {isRu ? 'Тарифы' : 'Pricing'}
                </Link>
                <Link
                  href={`/${locale}/auth/signup`}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#24A1DE] to-[#00E676] px-4 py-2 text-sm font-medium text-white"
                >
                  {isRu ? 'Создать бота' : 'Create a bot'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
