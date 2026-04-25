import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export function isClientAbortLikeError(error: unknown) {
  if (!error) return false

  if (typeof error === 'string') {
    return (
      error.includes('AbortError') ||
      error.includes('signal is aborted without reason') ||
      error.includes('The operation was aborted') ||
      error.includes('This operation was aborted')
    )
  }

  if (typeof error !== 'object') return false

  const record = error as {
    name?: unknown
    message?: unknown
    code?: unknown
  }
  const name = String(record.name || '')
  const message = String(record.message || '')
  const code = String(record.code || '')

  return (
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    message.includes('signal is aborted without reason') ||
    message.includes('The operation was aborted') ||
    message.includes('This operation was aborted')
  )
}

export async function getSafeClientUser(supabase: SupabaseClient<Database>): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error) {
      return user ?? null
    }
  } catch (error) {
    if (!isClientAbortLikeError(error)) {
      // Ignore Auth API network failures on the client and fall back to session.
    }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.user ?? null
  } catch (error) {
    if (!isClientAbortLikeError(error)) {
      // Keep the app stable when Auth storage/network is unavailable.
    }
    return null
  }
}
