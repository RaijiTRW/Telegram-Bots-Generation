import type { Locale } from '@/app/i18n'
import { locales } from '@/app/i18n'
import { trimTrailingSlash } from '@/lib/app-url'

const DEFAULT_SITE_URL = 'https://cbtooll.com'

function getEnvUrl() {
  const value =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL

  if (!value) {
    return DEFAULT_SITE_URL
  }

  return trimTrailingSlash(value)
}

function readOptionalUrl(...values: Array<string | undefined>) {
  const value = values.find((item) => typeof item === 'string' && item.trim())
  return value ? trimTrailingSlash(value) : null
}

function readOptionalEmail(...values: Array<string | undefined>) {
  const value = values.find((item) => typeof item === 'string' && item.trim())
  return value ? value.trim() : null
}

const SOCIAL_LINKS = {
  vk: readOptionalUrl(process.env.NEXT_PUBLIC_VK_URL, process.env.VK_URL),
  instagram: readOptionalUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL, process.env.INSTAGRAM_URL),
  youtube: readOptionalUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL, process.env.YOUTUBE_URL),
  telegram: readOptionalUrl(process.env.NEXT_PUBLIC_TELEGRAM_URL, process.env.TELEGRAM_URL),
} as const

export const PUBLIC_SITE = {
  brandName: 'CBTooll',
  siteName: 'CBTooll',
  defaultLocale: 'ru' as Locale,
  supportedLocales: locales,
  siteUrl: getEnvUrl(),
  primaryConversionPath(locale: Locale) {
    return `/${locale}/auth/signup`
  },
  pricingPath(locale: Locale) {
    return `/${locale}/pricing`
  },
  docsPath(locale: Locale) {
    return `/${locale}/docs`
  },
  contactPath(locale: Locale) {
    return `/${locale}/contact`
  },
  supportEmail: readOptionalEmail(process.env.PUBLIC_SUPPORT_EMAIL, process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
  socialLinks: SOCIAL_LINKS,
} as const

export function toLocale(value: string): Locale {
  return value === 'en' ? 'en' : 'ru'
}

export function withLocalePath(locale: Locale, path = '') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return cleanPath === '/' ? `/${locale}` : `/${locale}${cleanPath}`
}

export function getPublicSocialUrls() {
  return Object.values(PUBLIC_SITE.socialLinks).filter((value): value is string => Boolean(value))
}

