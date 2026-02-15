import { createServerClient } from '@supabase/ssr'
import { Database } from '@/lib/supabase/types'
import { cookies } from 'next/headers'

/**
 * Get authenticated user from request headers
 * Used in Server Actions to access current user
 */
export async function getServerUser() {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  // Get user from session (validates JWT server-side)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return user
}

/**
 * Create a Supabase client for use in Server Actions
 */
export async function createServerClientWrapper() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
}
