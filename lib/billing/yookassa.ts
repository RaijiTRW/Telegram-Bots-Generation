import 'server-only'

import { randomUUID } from 'crypto'
import type { BillingCurrency, PlanCode } from '@/lib/billing/types'

type YooKassaRecord = Record<string, unknown>

function safeParseJsonObject(value: string): YooKassaRecord | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as YooKassaRecord)
      : null
  } catch {
    return null
  }
}

function getSubscriptionCredentials() {
  const shopId =
    process.env.YOOKASSA_SUBSCRIPTION_SHOP_ID ||
    process.env.YOOKASSA_SHOP_ID ||
    ''
  const secretKey =
    process.env.YOOKASSA_SUBSCRIPTION_SECRET_KEY ||
    process.env.YOOKASSA_SECRET_KEY ||
    ''

  if (!shopId || !secretKey) {
    throw new Error('YooKassa subscription credentials are not configured')
  }

  return { shopId, secretKey }
}

async function yookassaRequest(
  path: string,
  input: {
    method?: 'GET' | 'POST'
    idempotenceKey?: string
    body?: YooKassaRecord
  } = {}
) {
  const { shopId, secretKey } = getSubscriptionCredentials()
  const response = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method: input.method || (input.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...(input.idempotenceKey ? { 'Idempotence-Key': input.idempotenceKey } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
    cache: 'no-store',
  })

  const responseText = await response.text()
  const body = safeParseJsonObject(responseText)
  if (!response.ok) {
    const code = String(body?.code || '').trim()
    const description = String(body?.description || '').trim()
    throw new Error(
      `YooKassa HTTP ${response.status}${code ? ` ${code}` : ''}${description ? `: ${description}` : ''}`
    )
  }

  return body || {}
}

export function buildSubscriptionDescription(planCode: PlanCode, locale = 'ru') {
  const prefix = locale === 'en' ? 'CBTooll subscription' : 'Подписка CBTooll'
  if (planCode === 'business') {
    return `${prefix}: Business`
  }
  if (planCode === 'enterprise') {
    return `${prefix}: Enterprise`
  }
  return `${prefix}: Base`
}

export async function createYooKassaSubscriptionCheckout(input: {
  amount: number
  currency: BillingCurrency
  returnUrl: string
  planCode: PlanCode
  userId: string
  transactionId: string
  locale?: string
}) {
  const idempotenceKey = randomUUID()
  const body = await yookassaRequest('/payments', {
    method: 'POST',
    idempotenceKey,
    body: {
      amount: {
        value: input.amount.toFixed(2),
        currency: input.currency,
      },
      capture: true,
      save_payment_method: true,
      confirmation: {
        type: 'redirect',
        return_url: input.returnUrl,
      },
      description: buildSubscriptionDescription(input.planCode, input.locale),
      metadata: {
        scope: 'subscription',
        userId: input.userId,
        planCode: input.planCode,
        transactionId: input.transactionId,
      },
    },
  })

  const confirmation = body.confirmation && typeof body.confirmation === 'object'
    ? (body.confirmation as YooKassaRecord)
    : null

  return {
    idempotenceKey,
    paymentId: String(body.id || ''),
    status: String(body.status || 'pending'),
    confirmationUrl: String(confirmation?.confirmation_url || ''),
    paymentMethodId: body.payment_method && typeof body.payment_method === 'object'
      ? String((body.payment_method as YooKassaRecord).id || '')
      : '',
    raw: body,
  }
}

export async function getYooKassaPayment(paymentId: string) {
  return yookassaRequest(`/payments/${paymentId}`, { method: 'GET' })
}

export async function chargeSavedYooKassaPaymentMethod(input: {
  amount: number
  currency: BillingCurrency
  paymentMethodId: string
  planCode: PlanCode
  userId: string
  transactionId: string
  locale?: string
}) {
  const idempotenceKey = randomUUID()
  const body = await yookassaRequest('/payments', {
    method: 'POST',
    idempotenceKey,
    body: {
      amount: {
        value: input.amount.toFixed(2),
        currency: input.currency,
      },
      capture: true,
      payment_method_id: input.paymentMethodId,
      description: buildSubscriptionDescription(input.planCode, input.locale),
      metadata: {
        scope: 'subscription-renewal',
        userId: input.userId,
        planCode: input.planCode,
        transactionId: input.transactionId,
      },
    },
  })

  return {
    idempotenceKey,
    paymentId: String(body.id || ''),
    status: String(body.status || 'pending'),
    paymentMethodId: body.payment_method && typeof body.payment_method === 'object'
      ? String((body.payment_method as YooKassaRecord).id || '')
      : input.paymentMethodId,
    raw: body,
  }
}
