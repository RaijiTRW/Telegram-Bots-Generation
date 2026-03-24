import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from './types'
import { getSupabasePublicEnv } from './config'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const { url, anonKey, isConfigured } = getSupabasePublicEnv()
  if (!isConfigured || !url || !anonKey) {
    return response
  }

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          response = NextResponse.next({
            request: { headers: request.headers },
          })

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Get user with session - this validates the session properly
  const { data: { user } } = await supabase.auth.getUser()

  // If no valid user, don't set any auth headers
  if (!user) {
    return response
  }

  // Set user data in response header for server components to use
  response.headers.set('x-user-id', user.id)
  response.headers.set('x-user-email', user.email || '')

  return response
}
