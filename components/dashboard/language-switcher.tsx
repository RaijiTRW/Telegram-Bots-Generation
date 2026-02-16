'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Globe } from 'lucide-react'
import { motion } from '@/components/motion-wrapper'
import { setUserLocale } from '@/app/actions/locale'
import { type Locale } from '@/app/i18n'
import { useState, useTransition } from 'react'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)

  const switchLocale = () => {
    const newLocale: Locale = locale === 'ru' ? 'en' : 'ru'
    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/'
    }

    // Save to database and navigate
    setIsSaving(true)
    startTransition(async () => {
      await setUserLocale(newLocale)
      router.push(`/${newLocale}${pathWithoutLocale}`)
      setIsSaving(false)
    })
  }

  return (
    <motion.button
      onClick={switchLocale}
      disabled={isSaving || isPending}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white disabled:opacity-50"
      aria-label="Switch language"
      whileHover={{ scale: isSaving || isPending ? 1 : 1.05 }}
      whileTap={{ scale: isSaving || isPending ? 1 : 0.95 }}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {locale === 'ru' ? 'RU' : 'EN'}
      </span>
    </motion.button>
  )
}
