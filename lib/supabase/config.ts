export const SUPABASE_MISSING_PUBLIC_ENV_MESSAGE =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

export type MissingSupabaseConfigError = Error & {
  code: 'SUPABASE_NOT_CONFIGURED'
  status: 503
}

export function getSupabasePublicEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const url = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : null
  const anonKey = typeof rawAnonKey === 'string' && rawAnonKey.trim() ? rawAnonKey.trim() : null

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  }
}

export function hasSupabasePublicEnv() {
  return getSupabasePublicEnv().isConfigured
}

export function createMissingSupabaseConfigError(): MissingSupabaseConfigError {
  return Object.assign(new Error(SUPABASE_MISSING_PUBLIC_ENV_MESSAGE), {
    name: 'SupabaseNotConfiguredError',
    code: 'SUPABASE_NOT_CONFIGURED' as const,
    status: 503 as const,
  })
}

export function isMissingSupabaseConfigurationError(error: unknown): error is MissingSupabaseConfigError {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: unknown; name?: unknown }

  return record.code === 'SUPABASE_NOT_CONFIGURED' || record.name === 'SupabaseNotConfiguredError'
}
