import { request as httpsRequest } from 'node:https'

import { hasTelegramProxy, withTelegramDispatcher } from '@/lib/telegram/network'

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org'
const TELEGRAM_REQUEST_TIMEOUT_MS = 15_000
const TELEGRAM_GET_UPDATES_GRACE_MS = 10_000
const TELEGRAM_MAX_ATTEMPTS = 3
const TELEGRAM_DIRECT_IP_HOST = 'api.telegram.org'
const TELEGRAM_DIRECT_IP_FALLBACKS = (() => {
  const raw = String(process.env.TELEGRAM_DIRECT_IP_FALLBACKS || '149.154.167.220').trim()
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
})()

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryByStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function resolveRetryDelayMs(response: Response | null, attempt: number): number {
  const defaultDelay = 300 * (attempt + 1)
  if (!response) {
    return defaultDelay
  }

  const retryAfterRaw = Number(response.headers.get('retry-after') || '')
  if (Number.isFinite(retryAfterRaw) && retryAfterRaw > 0) {
    return Math.max(defaultDelay, retryAfterRaw * 1000)
  }

  return defaultDelay
}

function formatNetworkError(method: string, error: unknown): Error {
  if (error instanceof Error) {
    const causeRecord =
      error.cause && typeof error.cause === 'object'
        ? (error.cause as Record<string, unknown>)
        : null
    const causeCode = typeof causeRecord?.code === 'string' ? causeRecord.code : ''
    const causeMessage = typeof causeRecord?.message === 'string' ? causeRecord.message : ''
    const details = [causeCode, causeMessage].filter(Boolean).join(' ')
    return new Error(
      details
        ? `Telegram API network error (${method}): ${error.message} [${details}]`
        : `Telegram API network error (${method}): ${error.message}`
    )
  }

  return new Error(`Telegram API network error (${method}): ${String(error)}`)
}

function isTelegramReachabilityError(error: unknown): boolean {
  const message = String(error || '')
  return (
    message.includes('UND_ERR_CONNECT_TIMEOUT') ||
    message.includes('ENOTFOUND') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('fetch failed')
  )
}

function normalizeRequestHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const normalized: Record<string, string> = {}
  if (!headers) return normalized

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value
    })
    return normalized
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      normalized[String(key)] = String(value)
    }
    return normalized
  }

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    normalized[key] = String(value)
  }

  return normalized
}

async function serializeRequestBody(
  init: Omit<RequestInit, 'cache'> & { cache?: RequestCache }
): Promise<{ body: Buffer | null; headers: Record<string, string> }> {
  const headers = normalizeRequestHeaders(init.headers)
  const body = init.body

  if (body == null) {
    return { body: null, headers }
  }

  if (typeof body === 'string') {
    const serialized = Buffer.from(body)
    headers['content-length'] = String(serialized.byteLength)
    return { body: serialized, headers }
  }

  if (body instanceof URLSearchParams) {
    const serialized = Buffer.from(body.toString())
    if (!headers['content-type']) {
      headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
    }
    headers['content-length'] = String(serialized.byteLength)
    return { body: serialized, headers }
  }

  if (body instanceof ArrayBuffer) {
    const serialized = Buffer.from(body)
    headers['content-length'] = String(serialized.byteLength)
    return { body: serialized, headers }
  }

  if (ArrayBuffer.isView(body)) {
    const serialized = Buffer.from(body.buffer, body.byteOffset, body.byteLength)
    headers['content-length'] = String(serialized.byteLength)
    return { body: serialized, headers }
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const request = new Request('https://telegram-direct-ip-fallback.invalid', {
      method: init.method || 'POST',
      body,
    })
    const serialized = Buffer.from(await request.arrayBuffer())
    request.headers.forEach((value, key) => {
      if (!headers[key]) {
        headers[key] = value
      }
    })
    headers['content-length'] = String(serialized.byteLength)
    return { body: serialized, headers }
  }

  throw new Error('Unsupported Telegram request body for direct IP fallback')
}

function requestTelegramApiByDirectIp(
  ip: string,
  token: string,
  method: string,
  init: Omit<RequestInit, 'cache'> & { cache?: RequestCache },
  timeoutMs: number
): Promise<Response> {
  return new Promise(async (resolve, reject) => {
    try {
      const { body, headers } = await serializeRequestBody(init)
      const req = httpsRequest(
        {
          host: ip,
          port: 443,
          path: `/bot${token}/${method}`,
          method: init.method || 'POST',
          headers: {
            ...headers,
            Host: TELEGRAM_DIRECT_IP_HOST,
          },
          // Fallback works around providers blocking TLS/SNI to api.telegram.org.
          rejectUnauthorized: false,
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })
          res.on('end', () => {
            const responseHeaders = new Headers()
            for (const [key, value] of Object.entries(res.headers)) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  responseHeaders.append(key, item)
                }
              } else if (value !== undefined) {
                responseHeaders.set(key, String(value))
              }
            }
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode || 500,
                headers: responseHeaders,
              })
            )
          })
        }
      )

      req.on('timeout', () => {
        req.destroy(new Error(`Direct IP fallback timeout (${ip}:${443})`))
      })
      req.on('error', reject)

      if (body) {
        req.write(body)
      }

      req.end()
    } catch (error) {
      reject(error)
    }
  })
}

async function requestTelegramApiWithDirectIpFallback(
  token: string,
  method: string,
  init: Omit<RequestInit, 'cache'> & { cache?: RequestCache },
  timeoutMs: number
): Promise<Response> {
  let lastError: Error | null = null

  for (const ip of TELEGRAM_DIRECT_IP_FALLBACKS) {
    try {
      return await requestTelegramApiByDirectIp(ip, token, method, init, timeoutMs)
    } catch (error) {
      lastError = formatNetworkError(method, error)
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error(`Telegram API direct IP fallback failed (${method})`)
}

async function requestTelegramApi(
  token: string,
  method: string,
  init: Omit<RequestInit, 'cache'> & { cache?: RequestCache },
  timeoutMs: number = TELEGRAM_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const url = `${TELEGRAM_API_BASE_URL}/bot${token}/${method}`
  let lastNetworkError: Error | null = null

  for (let attempt = 0; attempt < TELEGRAM_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(
        url,
        withTelegramDispatcher({
          ...init,
          cache: 'no-store',
          signal: controller.signal,
        })
      )

      if (shouldRetryByStatus(response.status) && attempt < TELEGRAM_MAX_ATTEMPTS - 1) {
        await sleep(resolveRetryDelayMs(response, attempt))
        continue
      }

      return response
    } catch (error) {
      lastNetworkError = formatNetworkError(method, error)
      if (
        !hasTelegramProxy() &&
        TELEGRAM_DIRECT_IP_FALLBACKS.length > 0 &&
        isTelegramReachabilityError(lastNetworkError)
      ) {
        try {
          return await requestTelegramApiWithDirectIpFallback(token, method, init, timeoutMs)
        } catch (fallbackError) {
          lastNetworkError = formatNetworkError(method, fallbackError)
        }
      }
      if (attempt < TELEGRAM_MAX_ATTEMPTS - 1) {
        await sleep(resolveRetryDelayMs(null, attempt))
        continue
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  if (lastNetworkError) {
    throw lastNetworkError
  }

  throw new Error(`Telegram API request failed (${method})`)
}

async function parseTelegramApiResponse<T>(response: Response, method: string): Promise<T> {
  let data: { ok?: boolean; result?: T; description?: string } | null = null

  try {
    const parsed = await response.json()
    if (parsed && typeof parsed === 'object') {
      data = parsed as { ok?: boolean; result?: T; description?: string }
    }
  } catch {
    // ignore parse errors, response is handled below
  }

  if (!response.ok || !data?.ok) {
    const description =
      data?.description ||
      `Telegram API request failed (${method}, HTTP ${response.status})`
    throw new Error(description)
  }

  return data.result as T
}

export async function callTelegramApi<T = unknown>(
  token: string,
  method: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const requestTimeoutMs =
    method === 'getUpdates'
      ? Math.max(
          TELEGRAM_REQUEST_TIMEOUT_MS,
          (Number(payload.timeout || 0) > 0 ? Number(payload.timeout || 0) * 1000 : 0) +
            TELEGRAM_GET_UPDATES_GRACE_MS
        )
      : TELEGRAM_REQUEST_TIMEOUT_MS

  const response = await requestTelegramApi(token, method, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, requestTimeoutMs)

  return parseTelegramApiResponse<T>(response, method)
}

export async function callTelegramApiFormData<T = unknown>(
  token: string,
  method: string,
  formData: FormData
): Promise<T> {
  const response = await requestTelegramApi(token, method, {
    method: 'POST',
    body: formData,
  })

  return parseTelegramApiResponse<T>(response, method)
}
