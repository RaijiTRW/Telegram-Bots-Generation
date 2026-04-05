import type { Locale } from '@/app/i18n'

export const LOCALE_FLAGS: Record<Locale, string> = {
  ru: '🇷🇺',
  en: '🇺🇸',
}

export function getLocaleFlag(locale: Locale): string {
  return LOCALE_FLAGS[locale]
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'ru' ? 'en' : 'ru'
}
