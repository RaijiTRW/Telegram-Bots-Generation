import { NextRequest, NextResponse } from 'next/server'
import { syncSubscriptionFromWebhook } from '@/lib/billing/service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { status: 400 }
    )
  }

  try {
    const result = await syncSubscriptionFromWebhook(payload)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[billing:yookassa:webhook]', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
