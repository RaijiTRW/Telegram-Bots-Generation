import { NextRequest, NextResponse } from 'next/server'
import { runDueRenewals } from '@/lib/billing/service'

export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest) {
  const secret = process.env.BILLING_CRON_SECRET || ''
  if (!secret) {
    throw new Error('BILLING_CRON_SECRET is not configured')
  }

  const headerSecret = request.headers.get('x-billing-cron-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return headerSecret === secret || querySecret === secret
}

async function handleRenewal(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const locale = request.nextUrl.searchParams.get('locale') || 'ru'
    const result = await runDueRenewals({ locale })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[billing:yookassa:renew]', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleRenewal(request)
}

export async function POST(request: NextRequest) {
  return handleRenewal(request)
}
