import { createBrowserClient } from '@supabase/ssr'
import { Database } from './types'
import { createMissingSupabaseConfigError, getSupabasePublicEnv } from './config'
import { isClientAbortLikeError } from './client-auth'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null
let fallbackClient: ReturnType<typeof createBrowserClient<Database>> | null = null

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
  if (init?.signal?.aborted) {
    return createAbortedAuthResponse()
  }

  try {
    return await fetch(input, init)
  } catch (error) {
    if (!isAbortLikeError(error) && !isClientAbortLikeError(error)) {
      throw error
    }

    return createAbortedAuthResponse()
  }
}

function createAbortedAuthResponse() {
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

function patchAbortSafeAuthMethods(target: ReturnType<typeof createBrowserClient<Database>>) {
  const originalGetUser = target.auth.getUser.bind(target.auth)
  const originalGetSession = target.auth.getSession.bind(target.auth)

  target.auth.getUser = (async (...args: Parameters<typeof originalGetUser>) => {
    try {
      return await originalGetUser(...args)
    } catch (error) {
      if (!isAbortLikeError(error) && !isClientAbortLikeError(error)) {
        throw error
      }
      return {
        data: { user: null },
        error: null,
      }
    }
  }) as typeof target.auth.getUser

  target.auth.getSession = (async (...args: Parameters<typeof originalGetSession>) => {
    try {
      return await originalGetSession(...args)
    } catch (error) {
      if (!isAbortLikeError(error) && !isClientAbortLikeError(error)) {
        throw error
      }
      return {
        data: { session: null },
        error: null,
      }
    }
  }) as typeof target.auth.getSession

  return target
}

function createMissingQueryBuilder() {
  const resultPromise = Promise.resolve({
    data: null,
    error: createMissingSupabaseConfigError(),
    count: 0,
    status: 503,
    statusText: 'Supabase not configured',
  })

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return resultPromise.then.bind(resultPromise)
        if (prop === 'catch') return resultPromise.catch.bind(resultPromise)
        if (prop === 'finally') return resultPromise.finally.bind(resultPromise)
        if (prop === Symbol.toStringTag) return 'Promise'
        return () => createMissingQueryBuilder()
      },
    }
  )
}

function createFallbackClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      signOut: async () => ({
        error: null,
      }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: createMissingSupabaseConfigError(),
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: createMissingSupabaseConfigError(),
      }),
      updateUser: async () => ({
        data: { user: null },
        error: createMissingSupabaseConfigError(),
      }),
      mfa: {
        listFactors: async () => ({
          data: { all: [] },
          error: createMissingSupabaseConfigError(),
        }),
        getAuthenticatorAssuranceLevel: async () => ({
          data: {
            currentLevel: null,
            nextLevel: null,
            currentAuthenticationMethods: [],
          },
          error: createMissingSupabaseConfigError(),
        }),
        enroll: async () => ({
          data: null,
          error: createMissingSupabaseConfigError(),
        }),
        unenroll: async () => ({
          data: null,
          error: createMissingSupabaseConfigError(),
        }),
        challengeAndVerify: async () => ({
          data: null,
          error: createMissingSupabaseConfigError(),
        }),
      },
    },
    from: () => createMissingQueryBuilder(),
  } as unknown as ReturnType<typeof createBrowserClient<Database>>
}

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv()

  if (!isConfigured || !url || !anonKey) {
    if (!fallbackClient) {
      fallbackClient = createFallbackClient()
    }
    return fallbackClient
  }

  if (!client) {
    client = patchAbortSafeAuthMethods(createBrowserClient<Database>(
      url,
      anonKey,
      {
        isSingleton: true,
        global: {
          fetch: safeSupabaseBrowserFetch,
        },
      }
    ))
  }
  return client
}
