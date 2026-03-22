import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== 'object') return false

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

async function safeSupabaseBrowserFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init)
  } catch (error) {
    if (!isAbortLikeError(error)) {
      throw error
    }

    return new Response(
      JSON.stringify({
        code: 'request_aborted',
        error_code: 'request_aborted',
        error: 'Request aborted',
        message: 'Request aborted',
        error_description: 'Request aborted',
      }),
      {
        status: 499,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        isSingleton: true,
        global: {
          fetch: safeSupabaseBrowserFetch,
        },
      }
    )
  }
  return client
}
