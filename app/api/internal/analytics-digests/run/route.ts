import { NextRequest, NextResponse } from 'next/server'
import { getAnalyticsDigestSecretHeaderName, runAnalyticsDigests } from '@/lib/dashboard-analytics/digests'

function isAuthorized(request: NextRequest) {
  const expectedSecret = String(process.env.ANALYTICS_DIGEST_SECRET || '').trim()
  if (!expectedSecret) {
    return false
  }

  const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const headerToken = request.headers.get(getAnalyticsDigestSecretHeaderName())?.trim()

  return bearerToken === expectedSecret || headerToken === expectedSecret
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAnalyticsDigests()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    )
  }
}

export const POST = GET
