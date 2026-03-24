export const SUPABASE_MISSING_PUBLIC_ENV_MESSAGE =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

export type MissingSupabaseConfigError = Error & {
  code: 'SUPABASE_NOT_CONFIGURED'
  status: 503
}

function readEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function getSupabasePublicEnv() {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

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
