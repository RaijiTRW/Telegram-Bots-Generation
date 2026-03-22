'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { motion } from '@/components/motion-wrapper'
import { setUserLocale } from '@/app/actions/locale'
import { type Locale } from '@/app/i18n'
import { useTransition } from 'react'
import { prefetchHrefOnce } from '@/lib/navigation/prefetch'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const switchLocale = () => {
    const newLocale: Locale = locale === 'ru' ? 'en' : 'ru'
    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/'
    }

    const nextHref = `/${newLocale}${pathWithoutLocale}`
    const maxAge = 60 * 60 * 24 * 365
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax`
    prefetchHrefOnce(router, nextHref)

    startTransition(() => {
      router.push(nextHref)
    })

    void setUserLocale(newLocale).catch(() => {
      // Locale cookie already updates the UI path immediately.
    })
  }

  return (
    <motion.button
      onClick={switchLocale}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white disabled:opacity-50"
      aria-label={t('header.switchLanguage')}
      whileHover={{ scale: isPending ? 1 : 1.05 }}
      whileTap={{ scale: isPending ? 1 : 0.95 }}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {locale === 'ru' ? 'RU' : 'EN'}
      </span>
    </motion.button>
  )
}
