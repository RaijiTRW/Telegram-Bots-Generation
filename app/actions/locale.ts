'use server'

import { createServerClientWrapper } from '@/lib/supabase/server'
import type { Locale } from '@/app/i18n'
import { cookies } from 'next/headers'

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE'
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export async function setUserLocale(locale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: LOCALE_COOKIE_MAX_AGE,
  })

  const supabase = await createServerClientWrapper()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Save to database
    await supabase
      .from('profiles')
      .update({ language: locale } as never)
      .eq('id', user.id)
  }

  return { success: true }
}

export async function getUserLocale(): Promise<Locale> {
  const supabase = await createServerClientWrapper()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .single() as { data: { language: Locale } | null }

    return data?.language || 'ru'
  }

  return 'ru'
}
