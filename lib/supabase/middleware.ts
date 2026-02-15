import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Database } from './types'

export async function updateSession(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
      },
    }
  )

  // Get user with session - this validates the session properly
  const { data: { user } } = await supabase.auth.getUser()

  // If no valid user, don't set any auth headers
  if (!user) {
    return NextResponse.next({
      request: { headers: request.headers },
    })
  }

  // Create response with user info for server components
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Set user data in response header for server components to use
  response.headers.set('x-user-id', user.id)
  response.headers.set('x-user-email', user.email || '')

  return response
}
