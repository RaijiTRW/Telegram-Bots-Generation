import Link from 'next/link'
import { ArrowRight, Briefcase, Clock3, MessageSquareText, Sparkles, Wand2 } from 'lucide-react'

import type { Locale } from '@/app/i18n'

const content = {
  ru: {
    eyebrow: 'Что можно сделать в сервисе',
    title: 'Конструктор Telegram-ботов для задач, где бизнесу важны скорость и конверсия.',
    subtitle:
      'Эти ответы помогают и пользователю, и поиску быстро понять, для чего нужен CBTooll: заявки, запись, FAQ, продажи, прогрев и запуск без тяжёлой разработки.',
    cards: [
      {
        icon: MessageSquareText,
        title: 'Что это такое',
        body: 'CBTooll — сервис для создания Telegram-ботов без кода: от первых сценариев до запуска и аналитики.',
        href: '/telegram-bot-builder',
        label: 'Открыть обзор конструктора',
      },
      {
        icon: Briefcase,
        title: 'Для кого подходит',
        body: 'Для бизнеса, экспертов, агентств, онлайн-школ и команд, которым нужен бот для заявок, записи или поддержки.',
        href: '/telegram-bot-for-business',
        label: 'Посмотреть бизнес-сценарии',
      },
      {
        icon: Wand2,
        title: 'Что можно автоматизировать',
        body: 'Лидогенерацию, FAQ, автоворонки, выдачу материалов, каталог, уведомления и базовые оплаты в Telegram.',
        href: '/create-telegram-bot',
        label: 'Посмотреть, как создать бота',
      },
      {
        icon: Clock3,
        title: 'Сколько времени занимает запуск',
        body: 'Для типовых сценариев — заметно меньше, чем при отдельной кастомной разработке и ручной сборке инфраструктуры.',
        href: '/no-code-telegram-bot',
        label: 'Перейти к no-code запуску',
      },
    ],
  },
  en: {
    eyebrow: 'What you can build here',
    title: 'A Telegram bot builder for teams that care about speed, clarity, and conversion.',
    subtitle:
      'These short answers help users and search engines understand the product fast: leads, booking, FAQ, funnels, and launch without a heavy custom build.',
    cards: [
      {
        icon: MessageSquareText,
        title: 'What it is',
        body: 'CBTooll is a no-code Telegram bot builder for launch, iteration, and analytics in one workflow.',
        href: '/telegram-bot-builder',
        label: 'Open builder overview',
      },
      {
        icon: Briefcase,
        title: 'Who it is for',
        body: 'It fits business teams, experts, agencies, schools, and service companies that need leads, booking, or support flows.',
        href: '/telegram-bot-for-business',
        label: 'See business use cases',
      },
      {
        icon: Wand2,
        title: 'What you can automate',
        body: 'Lead capture, FAQ, warm-up funnels, content delivery, catalog flows, notifications, and basic payments inside Telegram.',
        href: '/create-telegram-bot',
        label: 'See how to create a bot',
      },
      {
        icon: Clock3,
        title: 'How fast it launches',
        body: 'For standard flows, teams can launch much faster than with a separate custom build and manual infrastructure setup.',
        href: '/no-code-telegram-bot',
        label: 'Open no-code launch page',
      },
    ],
  },
} as const

export function SeoIntentSection({
  locale,
  semanticOnly = false,
}: {
  locale: Locale
  semanticOnly?: boolean
}) {
  const isRu = locale === 'ru'
  const copy = isRu ? content.ru : content.en

  if (semanticOnly) {
    return (
      <section className="sr-only" aria-label={copy.title}>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
        <ul>
          {copy.cards.map((card) => (
            <li key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <Link href={`/${locale}${card.href}`}>{card.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="relative px-4 py-12 md:py-16">
      <div className="mx-auto max-w-7xl rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,18,0.96),rgba(7,10,16,0.98))] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.24)] md:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/78">
            <Sparkles className="h-4 w-4 text-[#38BDF8]" />
            <span>{copy.eyebrow}</span>
          </div>
          <h2 className="mt-5 text-3xl font-bold text-white md:text-5xl">{copy.title}</h2>
          <p className="mt-4 text-base leading-7 text-white/68 md:text-lg">{copy.subtitle}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.cards.map((card) => {
            const Icon = card.icon

            return (
              <article
                key={card.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#24A1DE]/25 bg-[#24A1DE]/10">
                  <Icon className="h-5 w-5 text-[#8FD8FF]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/66">{card.body}</p>
                <Link
                  href={`/${locale}${card.href}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#8FD8FF] transition-opacity hover:opacity-80"
                >
                  <span>{card.label}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
