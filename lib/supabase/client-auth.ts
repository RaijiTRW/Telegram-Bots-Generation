import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export async function getSafeClientUser(supabase: SupabaseClient<Database>): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error) {
      return user ?? null
    }
  } catch {
    // Ignore Auth API network failures on the client and fall back to session.
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.user ?? null
  } catch {
    return null
  }
}
