'use server'

import { createServerClientWrapper } from '@/lib/supabase/server'
import type { Locale } from '@/app/i18n'

export async function setUserLocale(locale: Locale) {
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
