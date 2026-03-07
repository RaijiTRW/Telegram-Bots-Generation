const TELEGRAM_API_BASE_URL = 'https://api.telegram.org'
const TELEGRAM_REQUEST_TIMEOUT_MS = 15_000
const TELEGRAM_GET_UPDATES_GRACE_MS = 10_000
const TELEGRAM_MAX_ATTEMPTS = 3

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
      const response = await fetch(url, {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
      })

      if (shouldRetryByStatus(response.status) && attempt < TELEGRAM_MAX_ATTEMPTS - 1) {
        await sleep(resolveRetryDelayMs(response, attempt))
        continue
      }

      return response
    } catch (error) {
      lastNetworkError = formatNetworkError(method, error)
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
