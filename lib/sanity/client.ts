import { createClient } from 'next-sanity'

import {
  SANITY_API_VERSION,
  createMissingSanityConfigError,
  getSanityEnv,
} from '@/lib/sanity/config'

type CreateSanityClientOptions = {
  perspective?: 'published' | 'raw'
  token?: string | null
  useCdn?: boolean
}

function createSanityClient(options: CreateSanityClientOptions = {}) {
  const { projectId, dataset, readToken } = getSanityEnv()

  if (!projectId || !dataset) {
    throw createMissingSanityConfigError()
  }

  return createClient({
    projectId,
    dataset,
    apiVersion: SANITY_API_VERSION,
    useCdn: options.useCdn ?? false,
    perspective: options.perspective ?? 'published',
    token: options.token === undefined ? readToken || undefined : options.token || undefined,
    stega: false,
  })
}

export function getSanityReadClient(options: Omit<CreateSanityClientOptions, 'token'> = {}) {
  return createSanityClient(options)
}

export function getSanityWriteClient() {
  const { writeToken, readToken } = getSanityEnv()
  const token = writeToken || readToken

  if (!token) {
    throw new Error('Sanity write access is not configured. Set SANITY_API_WRITE_TOKEN or SANITY_API_READ_TOKEN.')
  }

  return createSanityClient({
    perspective: 'raw',
    useCdn: false,
    token,
  })
}
