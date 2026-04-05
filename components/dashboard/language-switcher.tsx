'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { motion } from '@/components/motion-wrapper'
import { setUserLocale } from '@/app/actions/locale'
import { type Locale } from '@/app/i18n'
import { useTransition } from 'react'
import { prefetchHrefOnce } from '@/lib/navigation/prefetch'
import { getAlternateLocale, getLocaleFlag } from '@/lib/i18n/locale-flags'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const nextLocale = getAlternateLocale(locale as Locale)

  const switchLocale = () => {
    const newLocale = nextLocale
    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/'
    }

    const nextHref = `/${newLocale}${pathWithoutLocale}`
    prefetchHrefOnce(router, nextHref)

    startTransition(() => {
      router.push(nextHref)
    })

    void setUserLocale(newLocale).catch(() => {
      // The route already changes immediately; this only persists preference.
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
      <span className="text-base leading-none">{getLocaleFlag(nextLocale)}</span>
    </motion.button>
  )
}
