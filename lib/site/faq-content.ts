import type { Locale } from '@/app/i18n'
import type { SeoFaqItem } from '@/lib/site/seo'

const landingFaqItems: Record<Locale, SeoFaqItem[]> = {
  ru: [
    {
      question: 'Можно ли создать Telegram-бота для бизнеса без разработчика?',
      answer:
        'Да. CBTooll подходит для типовых бизнес-сценариев: заявки, запись, FAQ, автоворонки, выдача материалов и базовые оплаты без длинной кастомной разработки.',
    },
    {
      question: 'Для каких задач подходит конструктор Telegram-ботов?',
      answer:
        'Сервис подходит для лидогенерации, записи клиентов, FAQ, прогрева, каталога, поддержки, выдачи материалов и других сценариев, где нужен быстрый запуск Telegram-бота.',
    },
    {
      question: 'Можно ли потом перейти на кастомную разработку?',
      answer:
        'Да. Вы можете использовать платформу как быстрый старт, проверить гипотезу на живом трафике, а затем перейти к более тяжёлому custom-стеку, если это понадобится.',
    },
    {
      question: 'Нужен ли отдельный сервер и DevOps для запуска?',
      answer:
        'Нет. Для первого релиза отдельный хостинг и ручная DevOps-настройка не обязательны: вы можете запускать бота на стороне сервиса.',
    },
    {
      question: 'Сколько времени нужно, чтобы создать бота в Telegram?',
      answer:
        'Если сценарий типовой, первую рабочую версию можно собрать и запустить заметно быстрее, чем при классической разработке через ТЗ, подрядчиков и отдельный backend.',
    },
  ],
  en: [
    {
      question: 'Can you create a Telegram bot for business without a developer?',
      answer:
        'Yes. CBTooll is built for standard business flows like leads, booking, FAQ, funnels, content delivery, and basic payments without a long custom build.',
    },
    {
      question: 'What use cases fit a Telegram bot builder best?',
      answer:
        'The platform works well for lead capture, booking, FAQ, warm-up flows, support, catalogs, and other business cases where teams need a fast Telegram launch.',
    },
    {
      question: 'Can we move to custom development later?',
      answer:
        'Yes. You can use the platform to validate the workflow fast, launch on real traffic, and later move to a custom stack if you outgrow the standard setup.',
    },
    {
      question: 'Do we need separate hosting or DevOps to launch?',
      answer:
        'No. You can launch the first working version on the platform and avoid separate hosting and DevOps setup just to get started.',
    },
    {
      question: 'How fast can a team create a Telegram bot?',
      answer:
        'For standard flows, teams can get to a working Telegram bot much faster than with the usual custom route of specs, calls, backend setup, and long revision cycles.',
    },
  ],
}

const pricingFaqItems: Record<Locale, SeoFaqItem[]> = {
  ru: [
    {
      question: 'Есть ли бесплатный тариф для создания Telegram-бота?',
      answer:
        'Да. Тариф Base даёт бесплатный старт после регистрации: до 3 ботов, canvas-редактор, настройки и ZIP-экспорт кода.',
    },
    {
      question: 'Какой тариф подходит для бизнеса?',
      answer:
        'Для большинства команд подходит Business: CRM, базовая аналитика dashboard, AI-ноды и размещение ботов на стороне сервиса.',
    },
    {
      question: 'Что входит в Enterprise?',
      answer:
        'Enterprise рассчитан на более высокий объём работы и расширенную аналитику: retention, XLSX-отчёты, email-алерты и повышенные лимиты.',
    },
    {
      question: 'Есть ли скидка при оплате за год?',
      answer:
        'Да. При годовой оплате текущие цены пересчитываются со скидкой 75% от помесячной стоимости на весь период.',
    },
  ],
  en: [
    {
      question: 'Is there a free plan to create a Telegram bot?',
      answer:
        'Yes. The Base plan gives teams a free start after signup with up to 3 bots, the canvas editor, settings, and ZIP code export.',
    },
    {
      question: 'Which plan fits a business team best?',
      answer:
        'Most teams will start with Business because it includes CRM, basic dashboard analytics, AI nodes, and managed bot hosting.',
    },
    {
      question: 'What is included in Enterprise?',
      answer:
        'Enterprise is aimed at larger usage with stronger analytics, including retention, XLSX reports, email alerts, and higher limits.',
    },
    {
      question: 'Is there a yearly discount?',
      answer:
        'Yes. Annual billing currently applies a 75% discount compared with the monthly price over the full period.',
    },
  ],
}

export function getLandingFaqItems(locale: Locale) {
  return landingFaqItems[locale]
}

export function getPricingFaqItems(locale: Locale) {
  return pricingFaqItems[locale]
}

