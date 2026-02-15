'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { motion } from '@/components/motion-wrapper'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = () => {
    const newLocale = locale === 'ru' ? 'en' : 'ru'
    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/'
    }
    router.push(`/${newLocale}${pathWithoutLocale}`)
  }

  return (
    <motion.button
      onClick={switchLocale}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
      aria-label="Switch language"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {locale === 'ru' ? 'RU' : 'EN'}
      </span>
    </motion.button>
  )
}
