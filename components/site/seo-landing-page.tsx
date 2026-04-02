import Link from 'next/link'
import { ArrowRight, BadgeCheck, Sparkles } from 'lucide-react'

import type { Locale } from '@/app/i18n'
import { Footer } from '@/components/footer/footer'
import { Header } from '@/components/header/header'
import { SeoFaqSection } from '@/components/site/seo-faq-section'
import { JsonLd } from '@/components/seo/json-ld'
import { PUBLIC_SITE } from '@/lib/site/public-config'
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
} from '@/lib/site/seo'
import type { SeoLandingPageContent } from '@/lib/site/seo-landing-pages'

export function SeoLandingPage({
  locale,
  page,
}: {
  locale: Locale
  page: SeoLandingPageContent
}) {
  const isRu = locale === 'ru'

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <JsonLd
        data={[
          buildWebPageSchema(locale, `/${page.slug}`, page.title, page.description),
          buildSoftwareApplicationSchema(locale),
          buildBreadcrumbSchema(locale, [
            { name: isRu ? 'Главная' : 'Home', path: '' },
            { name: page.h1, path: `/${page.slug}` },
          ]),
          buildFaqSchema(locale, page.faq),
        ]}
      />
      <Header />
      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(36,161,222,0.2),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,230,118,0.12),transparent_34%),rgba(8,11,18,0.94)] p-7 md:p-10">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/78">
                <Sparkles className="h-4 w-4 text-[#38BDF8]" />
                <span>{page.eyebrow}</span>
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">{page.h1}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">{page.lead}</p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={PUBLIC_SITE.primaryConversionPath(locale)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(36,161,222,0.25)]"
                >
                  <span>{isRu ? 'Создать бота' : 'Create a bot'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={PUBLIC_SITE.pricingPath(locale)}
                  className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/82 transition-colors hover:bg-white/[0.07]"
                >
                  {isRu ? 'Посмотреть тарифы' : 'View pricing'}
                </Link>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {page.explainer.map((item) => (
              <article key={item.title} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#24A1DE]/20 bg-[#24A1DE]/10">
                  <BadgeCheck className="h-5 w-5 text-[#8FD8FF]" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-5">
            {page.sections.map((section) => (
              <article key={section.title} className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 md:p-8">
                <h2 className="text-2xl font-semibold text-white md:text-3xl">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-zinc-300 md:text-base">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.bullets?.length ? (
                  <ul className="mt-5 grid gap-3 md:grid-cols-2">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>

          <SeoFaqSection
            title={isRu ? 'Частые вопросы' : 'Frequently asked questions'}
            subtitle={
              isRu
                ? 'Короткие ответы для тех, кто ищет понятный способ создать Telegram-бота и быстрее выйти в рабочий запуск.'
                : 'Short answers for teams looking for a practical way to launch a Telegram bot faster.'
            }
            items={page.faq}
          />

          <section className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">
                  {isRu ? 'Куда идти дальше' : 'Where to go next'}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                  {isRu
                    ? 'Откройте соседние страницы кластера, чтобы сравнить сценарии, тарифы и способ запуска Telegram-бота под вашу задачу.'
                    : 'Open the related pages to compare use cases, pricing, and the best launch path for your Telegram bot.'}
                </p>
              </div>
              <Link
                href={PUBLIC_SITE.primaryConversionPath(locale)}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#8FD8FF] transition-opacity hover:opacity-80"
              >
                <span>{isRu ? 'Перейти к созданию бота' : 'Go to bot creation'}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {page.relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={`/${locale}${link.href}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-200 transition-colors hover:bg-white/[0.06]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
