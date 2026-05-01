const RETRYABLE_ERROR_PATTERNS = [
  'fetch failed',
  'HeadersTimeoutError',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
  'other side closed',
  'ECONNRESET',
  'ETIMEDOUT',
]

const DEFAULT_TIMEOUT_MS = 12_000
const DEFAULT_RETRIES = 2

function isRetryableSupabaseFetchError(error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const cause = error instanceof Error && error.cause ? String(error.cause) : ''
  const combined = `${message}\n${cause}`

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => combined.includes(pattern))
}

function canRetryRequest(init?: RequestInit) {
  if (!init?.body) return true
  return typeof init.body === 'string' || init.body instanceof URLSearchParams || init.body instanceof Blob
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTimeoutSignal(parentSignal: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Supabase request timed out')), timeoutMs)

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason)
    } else {
      parentSignal.addEventListener(
        'abort',
        () => controller.abort(parentSignal.reason),
        { once: true }
      )
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  }
}

export async function resilientSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const retries = canRetryRequest(init) ? DEFAULT_RETRIES : 0
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal, cleanup } = createTimeoutSignal(init?.signal, DEFAULT_TIMEOUT_MS)

    try {
      return await fetch(input, {
        ...init,
        signal,
      })
    } catch (error) {
      lastError = error

      if (attempt >= retries || !isRetryableSupabaseFetchError(error)) {
        throw error
      }

      await sleep(250 * (attempt + 1))
    } finally {
      cleanup()
    }
  }

  throw lastError
}
