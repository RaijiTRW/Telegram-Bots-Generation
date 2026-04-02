import type { Metadata } from 'next'

import type { Locale } from '@/app/i18n'
import { INFO_PAGE_SLUGS } from '@/lib/site/info-pages'
import { PUBLIC_SITE, getPublicSocialUrls, withLocalePath } from '@/lib/site/public-config'
import { PLAN_ORDER, getPlanDefinition, getPlanPrice } from '@/lib/billing/plans'

export type SeoFaqItem = {
  question: string
  answer: string
}

type MetadataInput = {
  locale: Locale
  path?: string
  title: string
  description: string
  keywords?: string[]
  noIndex?: boolean
  type?: 'website' | 'article'
}

type BreadcrumbItem = {
  name: string
  path: string
}

const DEFAULT_OG_IMAGE_PATH = '/opengraph-image'

const COMMON_KEYWORDS = {
  ru: [
    'создание telegram ботов',
    'конструктор telegram ботов',
    'создать бота тг',
    'создание чат-ботов для бизнеса',
    'telegram bot builder',
    'cbtooll',
  ],
  en: [
    'telegram bot builder',
    'telegram chatbot builder',
    'no-code telegram bot',
    'telegram bot for business',
    'ai bot builder',
    'cbtooll',
  ],
} as const

const LOCALE_OG = {
  ru: 'ru_RU',
  en: 'en_US',
} as const

export function absoluteUrl(path = '') {
  const base = PUBLIC_SITE.siteUrl.replace(/\/+$/, '')
  if (!path || path === '/') {
    return base
  }

  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildLocaleAlternates(path = '') {
  return Object.fromEntries(
    PUBLIC_SITE.supportedLocales.map((locale) => [locale, absoluteUrl(withLocalePath(locale, path))])
  )
}

export function buildPageMetadata({
  locale,
  path = '',
  title,
  description,
  keywords = [],
  noIndex = false,
  type = 'website',
}: MetadataInput): Metadata {
  const canonicalPath = withLocalePath(locale, path)
  const allKeywords = [...COMMON_KEYWORDS[locale], ...keywords]

  return {
    title,
    description,
    keywords: allKeywords,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      languages: buildLocaleAlternates(path),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonicalPath),
      siteName: PUBLIC_SITE.siteName,
      locale: LOCALE_OG[locale],
      type,
      images: [absoluteUrl(DEFAULT_OG_IMAGE_PATH)],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl(DEFAULT_OG_IMAGE_PATH)],
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  }
}

export function buildNoIndexMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  }
}

export function buildOrganizationSchema() {
  const socialUrls = getPublicSocialUrls()

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${absoluteUrl()}/#organization`,
    name: PUBLIC_SITE.brandName,
    url: absoluteUrl(),
    logo: absoluteUrl('/icon.png'),
    email: PUBLIC_SITE.supportEmail || undefined,
    sameAs: socialUrls.length ? socialUrls : undefined,
  }
}

export function buildWebSiteSchema(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${absoluteUrl()}/#website`,
    name: PUBLIC_SITE.siteName,
    url: absoluteUrl(withLocalePath(locale)),
    inLanguage: locale,
    description:
      locale === 'ru'
        ? 'CBTooll помогает создавать Telegram-ботов для бизнеса без кода, с быстрым запуском, оплатами и аналитикой.'
        : 'CBTooll helps teams build Telegram bots for business without code, with fast launch, payments, and analytics.',
    publisher: {
      '@id': `${absoluteUrl()}/#organization`,
    },
  }
}

export function buildSoftwareApplicationSchema(locale: Locale) {
  const currency = locale === 'ru' ? 'RUB' : 'USD'
  const lowPrice = getPlanPrice('base', currency, 'month')
  const highPrice = getPlanPrice(PLAN_ORDER[PLAN_ORDER.length - 1], currency, 'month')
  const businessPlan = getPlanDefinition('business', locale)

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${absoluteUrl()}/#software`,
    name: PUBLIC_SITE.brandName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: locale,
    url: absoluteUrl(withLocalePath(locale)),
    image: absoluteUrl('/icon.png'),
    description:
      locale === 'ru'
        ? 'Конструктор Telegram-ботов для бизнеса: заявки, запись, FAQ, автоворонки, оплаты и аналитика в одном сервисе.'
        : 'Telegram bot builder for business: leads, booking, FAQ, funnels, payments, and analytics in one service.',
    brand: {
      '@type': 'Brand',
      name: PUBLIC_SITE.brandName,
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: currency,
      lowPrice,
      highPrice,
      offerCount: PLAN_ORDER.length,
      availability: 'https://schema.org/InStock',
      description: businessPlan.description,
    },
  }
}

export function buildBreadcrumbSchema(locale: Locale, items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(withLocalePath(locale, item.path)),
    })),
  }
}

export function buildFaqSchema(locale: Locale, items: SeoFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function buildWebPageSchema(locale: Locale, path: string, title: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: absoluteUrl(withLocalePath(locale, path)),
    inLanguage: locale,
    isPartOf: {
      '@id': `${absoluteUrl()}/#website`,
    },
  }
}

export function getHomeMetadata(locale: Locale) {
  return buildPageMetadata({
    locale,
    title:
      locale === 'ru'
        ? 'Создание Telegram-ботов для бизнеса без кода | CBTooll'
        : 'Telegram Bot Builder for Business | CBTooll',
    description:
      locale === 'ru'
        ? 'Создавайте Telegram-ботов для заявок, записи, FAQ, оплат и автоворонок без кода. Конструктор ботов для бизнеса с быстрым запуском, аналитикой и хостингом.'
        : 'Build Telegram bots for leads, booking, FAQ, payments, and funnels without code. A fast Telegram bot builder for business with analytics and hosting.',
    keywords:
      locale === 'ru'
        ? [
            'создание чат ботов для тг',
            'создание ботов тг',
            'создать бота тг для бизнеса',
            'конструктор тг ботов',
          ]
        : ['telegram bot builder', 'create telegram bot', 'telegram bot for business', 'no-code telegram bot'],
  })
}

export function getPricingMetadata(locale: Locale) {
  return buildPageMetadata({
    locale,
    path: '/pricing',
    title:
      locale === 'ru'
        ? 'Цены на конструктор Telegram-ботов | CBTooll'
        : 'Telegram Bot Builder Pricing | CBTooll',
    description:
      locale === 'ru'
        ? 'Сравните тарифы на создание Telegram-ботов: бесплатный старт, Business для роста и Enterprise для максимальной аналитики и лимитов.'
        : 'Compare Telegram bot builder pricing: free start, Business for growth, and Enterprise for higher analytics and limits.',
    keywords:
      locale === 'ru'
        ? ['цены на telegram бота', 'тарифы конструктора telegram ботов', 'стоимость создания бота тг']
        : ['telegram bot pricing', 'telegram bot builder pricing', 'telegram chatbot pricing'],
  })
}

export function getDocsMetadata(locale: Locale, title?: string, description?: string, path = '/docs', noIndex = false) {
  return buildPageMetadata({
    locale,
    path,
    title:
      title ||
      (locale === 'ru'
        ? 'Документация по Telegram-ботам и запуску | CBTooll'
        : 'Telegram Bot Documentation and Launch Guides | CBTooll'),
    description:
      description ||
      (locale === 'ru'
        ? 'Инструкции по созданию, настройке, запуску и тестированию Telegram-ботов в CBTooll.'
        : 'Guides for building, configuring, launching, and testing Telegram bots in CBTooll.'),
    keywords:
      locale === 'ru'
        ? ['документация telegram боты', 'как создать бота тг', 'настройка telegram бота']
        : ['telegram bot documentation', 'how to create telegram bot', 'telegram bot setup guide'],
    noIndex,
    type: 'article',
  })
}

export function getInfoPageMetadata(locale: Locale, infoPage: (typeof INFO_PAGE_SLUGS)[number], title: string, description: string) {
  return buildPageMetadata({
    locale,
    path: `/${infoPage}`,
    title: `${title} | ${PUBLIC_SITE.brandName}`,
    description,
    keywords:
      locale === 'ru'
        ? ['cbtooll', 'контакты', 'безопасность', 'условия использования', 'конфиденциальность']
        : ['cbtooll', 'contact', 'security', 'terms', 'privacy'],
    type: 'article',
  })
}

