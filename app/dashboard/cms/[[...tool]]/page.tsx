import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextStudio, metadata, viewport } from 'next-sanity/studio'

import config from '@/sanity.config'
import { getSanityEnv } from '@/lib/sanity/config'
import { createServerClientWrapper, getServerUser } from '@/lib/supabase/server'

export { metadata, viewport }

export const dynamic = 'force-dynamic'

function getRouteLocale(cookieValue: string | undefined) {
  return cookieValue === 'en' ? 'en' : 'ru'
}

export default async function DashboardCmsStudioPage() {
  const locale = getRouteLocale((await cookies()).get('NEXT_LOCALE')?.value)
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const supabase = await createServerClientWrapper()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`)
  }

  const { isConfigured } = getSanityEnv()
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#05070A] p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/10 p-6">
          <h1 className="text-2xl font-semibold">Sanity CMS is not configured</h1>
          <p className="mt-3 text-zinc-300">
            Set <code className="rounded bg-white/10 px-1 py-0.5">NEXT_PUBLIC_SANITY_PROJECT_ID</code> and{' '}
            <code className="rounded bg-white/10 px-1 py-0.5">NEXT_PUBLIC_SANITY_DATASET</code>, then reload this page.
          </p>
        </div>
      </div>
    )
  }

  return <NextStudio config={config} />
}
