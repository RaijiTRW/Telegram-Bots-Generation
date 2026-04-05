import type { Dispatcher } from 'undici'
import { ProxyAgent } from 'undici'

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: Dispatcher
}

const TELEGRAM_PROXY_ENV_KEYS = [
  'TELEGRAM_PROXY_URL',
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
] as const

let cachedTelegramProxyUrl: string | null | undefined
let cachedTelegramDispatcher: Dispatcher | null | undefined

function resolveTelegramProxyUrl(): string | null {
  for (const key of TELEGRAM_PROXY_ENV_KEYS) {
    const value = String(process.env[key] || '').trim()
    if (value) {
      return value
    }
  }

  return null
}

export function getTelegramProxyUrl(): string | null {
  if (cachedTelegramProxyUrl === undefined) {
    cachedTelegramProxyUrl = resolveTelegramProxyUrl()
  }

  return cachedTelegramProxyUrl
}

export function hasTelegramProxy(): boolean {
  return Boolean(getTelegramProxyUrl())
}

function createTelegramDispatcher(): Dispatcher | null {
  const proxyUrl = getTelegramProxyUrl()
  if (!proxyUrl) {
    return null
  }

  try {
    return new ProxyAgent(proxyUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid Telegram proxy configuration: ${message}`)
  }
}

export function getTelegramDispatcher(): Dispatcher | null {
  if (cachedTelegramDispatcher === undefined) {
    cachedTelegramDispatcher = createTelegramDispatcher()
  }

  return cachedTelegramDispatcher
}

export function withTelegramDispatcher(
  init: Omit<RequestInitWithDispatcher, 'dispatcher'> = {}
): RequestInitWithDispatcher {
  const dispatcher = getTelegramDispatcher()
  if (!dispatcher) {
    return init
  }

  return {
    ...init,
    dispatcher,
  }
}
