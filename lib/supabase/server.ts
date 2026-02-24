import { createServerClient } from '@supabase/ssr'
import { Database } from '@/lib/supabase/types'
import { cookies } from 'next/headers'

function isRateLimitAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  return record.status === 429 || record.code === 'over_request_rate_limit'
}

async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // In Server Components cookie writes are not allowed.
            // Server Actions / Route Handlers can still write and keep sessions fresh.
          }
        },
      },
    }
  )
}

/**
 * Get authenticated user from request headers
 * Used in Server Actions to access current user
 */
export async function getServerUser() {
  const supabase = await createServerSupabaseClient()

  // Get user from session (validates JWT server-side)
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (!error && user) {
      return user
    }

    if (error && !isRateLimitAuthError(error)) {
      return null
    }
  } catch (error) {
    if (!isRateLimitAuthError(error)) {
      return null
    }
  }

  // Fallback for temporary Auth API 429 during high-frequency log polling.
  // This avoids locking the UI (e.g. stopping test) while rate limit cools down.
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.user || null
  } catch {
    return null
  }
}

/**
 * Create a Supabase client for use in Server Actions
 */
export async function createServerClientWrapper() {
  return createServerSupabaseClient()
}
