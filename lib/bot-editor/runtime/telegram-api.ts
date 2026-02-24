async function parseTelegramApiResponse<T>(
  response: Response,
  method: string
): Promise<T> {
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
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  return parseTelegramApiResponse<T>(response, method)
}

export async function callTelegramApiFormData<T = unknown>(
  token: string,
  method: string,
  formData: FormData
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  })

  return parseTelegramApiResponse<T>(response, method)
}
