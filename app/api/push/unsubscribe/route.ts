import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/server'
import { removeBrowserPushSubscription } from '@/lib/browser-push'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const endpoint = String(payload?.endpoint || '').trim()

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Invalid endpoint' }, { status: 400 })
    }

    await removeBrowserPushSubscription({
      userId: user.id,
      endpoint,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
