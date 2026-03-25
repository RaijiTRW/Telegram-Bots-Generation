export const SANITY_API_VERSION = '2026-03-24'

export const SANITY_MISSING_PUBLIC_ENV_MESSAGE =
  'Sanity is not configured. Set NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET.'

export type MissingSanityConfigError = Error & {
  code: 'SANITY_NOT_CONFIGURED'
  status: 503
}

export function getSanityEnv() {
  const rawProjectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const rawDataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const projectId = typeof rawProjectId === 'string' && rawProjectId.trim() ? rawProjectId.trim() : null
  const dataset = typeof rawDataset === 'string' && rawDataset.trim() ? rawDataset.trim() : null
  const readToken =
    typeof process.env.SANITY_API_READ_TOKEN === 'string' && process.env.SANITY_API_READ_TOKEN.trim()
      ? process.env.SANITY_API_READ_TOKEN.trim()
      : null
  const writeToken =
    typeof process.env.SANITY_API_WRITE_TOKEN === 'string' && process.env.SANITY_API_WRITE_TOKEN.trim()
      ? process.env.SANITY_API_WRITE_TOKEN.trim()
      : null

  return {
    projectId,
    dataset,
    readToken,
    writeToken,
    isConfigured: Boolean(projectId && dataset),
  }
}

export function hasSanityEnv() {
  return getSanityEnv().isConfigured
}

export function createMissingSanityConfigError(): MissingSanityConfigError {
  return Object.assign(new Error(SANITY_MISSING_PUBLIC_ENV_MESSAGE), {
    name: 'SanityNotConfiguredError',
    code: 'SANITY_NOT_CONFIGURED' as const,
    status: 503 as const,
  })
}

export function isMissingSanityConfigurationError(error: unknown): error is MissingSanityConfigError {
  if (!error || typeof error !== 'object') {
    return false
  }

  const record = error as { code?: unknown; name?: unknown }

  return record.code === 'SANITY_NOT_CONFIGURED' || record.name === 'SanityNotConfiguredError'
}
