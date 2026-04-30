type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type OpenRouterJsonRequest = {
  messages: OpenRouterMessage[]
  schema?: Record<string, unknown>
  temperature?: number
  maxTokens?: number
  model?: string
  signal?: AbortSignal
  onDelta?: (chunk: {
    delta: string
    accumulated: string
    model: string
  }) => void
}

type OpenRouterConfig = {
  apiKey?: string
  model: string
  baseUrl: string
  chatCompletionsUrl: string
  providerLabel: string
  supportsOpenRouterExtras: boolean
  httpReferer?: string
  appName?: string
}

type OpenRouterJsonResponse<T> = {
  model: string
  content: string
  parsed: T
}

function normalizeChatCompletionsUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/$/, '')

  if (/\/chat\/completions$/i.test(normalized)) {
    return normalized
  }

  if (/\/(?:api\/)?v1$/i.test(normalized)) {
    return `${normalized}/chat/completions`
  }

  return `${normalized}/api/v1/chat/completions`
}

export function getAiProviderConfigError(modelOverride?: string): string | null {
  const localBaseUrl =
    process.env.AI_API_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.LOCAL_AI_BASE_URL?.trim() ||
    ''
  const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() || ''
  const model =
    modelOverride?.trim() ||
    process.env.AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    ''

  if (!model) {
    return 'AI_MODEL is not configured'
  }

  if (!localBaseUrl && !openRouterApiKey) {
    return 'AI_API_BASE_URL is not configured'
  }

  return null
}

function readOpenRouterConfig(modelOverride?: string): OpenRouterConfig {
  const localBaseUrl =
    process.env.AI_API_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.LOCAL_AI_BASE_URL?.trim() ||
    ''
  const model =
    modelOverride?.trim() ||
    process.env.AI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    ''
  const configError = getAiProviderConfigError(modelOverride)

  if (configError) {
    throw new Error(configError)
  }

  if (localBaseUrl) {
    const apiKey =
      process.env.AI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.LOCAL_AI_API_KEY?.trim() ||
      undefined

    return {
      apiKey,
      model,
      baseUrl: localBaseUrl.replace(/\/$/, ''),
      chatCompletionsUrl: normalizeChatCompletionsUrl(localBaseUrl),
      providerLabel: 'AI provider',
      supportsOpenRouterExtras: false,
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || ''
  const baseUrl = (process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai').replace(/\/$/, '')

  return {
    apiKey,
    model,
    baseUrl,
    chatCompletionsUrl: normalizeChatCompletionsUrl(baseUrl),
    providerLabel: 'OpenRouter',
    supportsOpenRouterExtras: true,
    httpReferer: process.env.OPENROUTER_HTTP_REFERER?.trim() || undefined,
    appName: process.env.OPENROUTER_APP_NAME?.trim() || undefined,
  }
}

function extractAssistantContent(payload: unknown): string {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : {}
  const message = firstChoice.message && typeof firstChoice.message === 'object'
    ? (firstChoice.message as Record<string, unknown>)
    : {}
  const content = message.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const recordPart = part as Record<string, unknown>
        if (typeof recordPart.text === 'string') return recordPart.text
        if (
          recordPart.type === 'text' &&
          recordPart.text &&
          typeof recordPart.text === 'object' &&
          typeof (recordPart.text as Record<string, unknown>).value === 'string'
        ) {
          return String((recordPart.text as Record<string, unknown>).value)
        }
        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

function tryParseJson<T>(value: string): T | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parseCandidate = (candidate: string) => {
    const normalized = normalizeJsonCandidate(candidate)
    return JSON.parse(normalized) as T
  }

  try {
    return parseCandidate(trimmed)
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
    if (fencedMatch?.[1]) {
      try {
        return parseCandidate(fencedMatch[1])
      } catch {
        // Continue to balanced JSON extraction below.
      }
    }

    const candidates = extractJsonCandidates(trimmed)
    for (const candidate of candidates) {
      try {
        return parseCandidate(candidate)
      } catch {
        // Try the next balanced candidate.
      }
    }

    return null
  }
}

function normalizeJsonCandidate(value: string) {
  return value
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1')
}

function extractJsonCandidates(value: string): string[] {
  const candidates: string[] = []

  for (let start = 0; start < value.length; start += 1) {
    const opening = value[start]
    if (opening !== '{' && opening !== '[') {
      continue
    }

    const closing = opening === '{' ? '}' : ']'
    const stack: string[] = [closing]
    let inString = false
    let escaped = false

    for (let index = start + 1; index < value.length; index += 1) {
      const char = value[index]

      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') {
        stack.push('}')
      } else if (char === '[') {
        stack.push(']')
      } else if (char === stack[stack.length - 1]) {
        stack.pop()
        if (stack.length === 0) {
          candidates.push(value.slice(start, index + 1))
          break
        }
      }
    }
  }

  return candidates
}

function extractAssistantDeltaContent(payload: unknown): string {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0] && typeof choices[0] === 'object' ? (choices[0] as Record<string, unknown>) : {}
  const delta = firstChoice.delta && typeof firstChoice.delta === 'object'
    ? (firstChoice.delta as Record<string, unknown>)
    : {}
  const content = delta.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (!part || typeof part !== 'object') return ''
        const recordPart = part as Record<string, unknown>
        if (typeof recordPart.text === 'string') return recordPart.text
        if (
          recordPart.type === 'text' &&
          recordPart.text &&
          typeof recordPart.text === 'object' &&
          typeof (recordPart.text as Record<string, unknown>).value === 'string'
        ) {
          return String((recordPart.text as Record<string, unknown>).value)
        }
        return ''
      })
      .join('')
  }

  return ''
}

function buildRequestPayload(
  config: OpenRouterConfig,
  request: OpenRouterJsonRequest,
  forceJsonObject: boolean,
  streaming: boolean
) {
  return {
    model: config.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? 5000,
    ...(config.supportsOpenRouterExtras ? { plugins: [{ id: 'response-healing' }] } : {}),
    ...(streaming ? { stream: true } : {}),
    response_format:
      !forceJsonObject && request.schema
        ? {
            type: 'json_schema',
            json_schema: {
              name: 'quick_start_ai_graph_draft',
              strict: true,
              schema: request.schema,
            },
          }
        : { type: 'json_object' },
  } satisfies Record<string, unknown>
}

async function sendOpenRouterRequest<T>(
  config: OpenRouterConfig,
  request: OpenRouterJsonRequest,
  forceJsonObject = false
): Promise<OpenRouterJsonResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  if (config.httpReferer) {
    headers['HTTP-Referer'] = config.httpReferer
  }

  if (config.appName) {
    headers['X-Title'] = config.appName
  }

  const response = await fetch(config.chatCompletionsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildRequestPayload(config, request, forceJsonObject, false)),
    cache: 'no-store',
    signal: request.signal,
  })

  const responseText = await response.text()
  let responseJson: unknown = null
  try {
    responseJson = JSON.parse(responseText)
  } catch {
    responseJson = null
  }

  if (!response.ok) {
    const errorMessage =
      responseJson &&
      typeof responseJson === 'object' &&
      typeof (responseJson as Record<string, unknown>).error === 'object' &&
      typeof ((responseJson as Record<string, unknown>).error as Record<string, unknown>).message === 'string'
        ? String(((responseJson as Record<string, unknown>).error as Record<string, unknown>).message)
        : responseText

    throw new Error(`${config.providerLabel} error ${response.status}: ${errorMessage || 'Unknown error'}`)
  }

  const content = extractAssistantContent(responseJson)
  const parsed = tryParseJson<T>(content)
  if (!parsed) {
    throw new Error(`${config.providerLabel} did not return valid JSON`)
  }

  return {
    model: config.model,
    content,
    parsed,
  }
}

async function sendOpenRouterStreamingRequest<T>(
  config: OpenRouterConfig,
  request: OpenRouterJsonRequest,
  forceJsonObject = false
): Promise<OpenRouterJsonResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  if (config.httpReferer) {
    headers['HTTP-Referer'] = config.httpReferer
  }

  if (config.appName) {
    headers['X-Title'] = config.appName
  }

  const response = await fetch(config.chatCompletionsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildRequestPayload(config, request, forceJsonObject, true)),
    cache: 'no-store',
    signal: request.signal,
  })

  if (!response.ok) {
    const responseText = await response.text()
    let responseJson: unknown = null
    try {
      responseJson = JSON.parse(responseText)
    } catch {
      responseJson = null
    }

    const errorMessage =
      responseJson &&
      typeof responseJson === 'object' &&
      typeof (responseJson as Record<string, unknown>).error === 'object' &&
      typeof ((responseJson as Record<string, unknown>).error as Record<string, unknown>).message === 'string'
        ? String(((responseJson as Record<string, unknown>).error as Record<string, unknown>).message)
        : responseText

    throw new Error(`${config.providerLabel} error ${response.status}: ${errorMessage || 'Unknown error'}`)
  }

  if (!response.body) {
    throw new Error(`${config.providerLabel} did not return a streaming body`)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''

  const reader = response.body.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const boundaryIndex = buffer.search(/\r?\n\r?\n/)
      if (boundaryIndex === -1) {
        break
      }

      const rawEvent = buffer.slice(0, boundaryIndex)
      const boundaryLength = buffer.slice(boundaryIndex, boundaryIndex + 4).startsWith('\r\n\r\n') ? 4 : 2
      buffer = buffer.slice(boundaryIndex + boundaryLength)

      const dataLines = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s?/, ''))

      if (dataLines.length === 0) {
        continue
      }

      const eventPayload = dataLines.join('\n').trim()
      if (!eventPayload || eventPayload === '[DONE]') {
        continue
      }

      let parsedEvent: unknown = null
      try {
        parsedEvent = JSON.parse(eventPayload)
      } catch {
        continue
      }

      const delta = extractAssistantDeltaContent(parsedEvent)
      if (!delta) {
        continue
      }

      content += delta
      request.onDelta?.({
        delta,
        accumulated: content,
        model: config.model,
      })
    }
  }

  if (buffer.trim()) {
    const trailingLines = buffer
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s?/, ''))
    for (const line of trailingLines) {
      if (!line || line === '[DONE]') continue
      try {
        const parsedEvent = JSON.parse(line)
        const delta = extractAssistantDeltaContent(parsedEvent)
        if (!delta) continue
        content += delta
        request.onDelta?.({
          delta,
          accumulated: content,
          model: config.model,
        })
      } catch {
        continue
      }
    }
  }

  const parsed = tryParseJson<T>(content)
  if (!parsed) {
    throw new Error(`${config.providerLabel} did not return valid JSON`)
  }

  return {
    model: config.model,
    content,
    parsed,
  }
}

export async function requestOpenRouterJson<T>(
  request: OpenRouterJsonRequest
): Promise<OpenRouterJsonResponse<T>> {
  const config = readOpenRouterConfig(request.model)

  if (!request.schema) {
    return sendOpenRouterRequest<T>(config, request, true)
  }

  try {
    return await sendOpenRouterRequest<T>(config, request, false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const shouldFallbackToJsonObject =
      /json_schema|structured output|response_format|unsupported|valid JSON/i.test(message)

    if (!shouldFallbackToJsonObject) {
      throw error
    }

    return sendOpenRouterRequest<T>(config, request, true)
  }
}

export async function requestOpenRouterJsonStream<T>(
  request: OpenRouterJsonRequest
): Promise<OpenRouterJsonResponse<T>> {
  const config = readOpenRouterConfig(request.model)

  if (!request.schema) {
    return sendOpenRouterStreamingRequest<T>(config, request, true)
  }

  try {
    return await sendOpenRouterStreamingRequest<T>(config, request, false)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const shouldFallbackToJsonObject =
      /json_schema|structured output|response_format|unsupported|valid JSON/i.test(message)

    if (!shouldFallbackToJsonObject) {
      throw error
    }

    return sendOpenRouterRequest<T>(config, request, true)
  }
}
