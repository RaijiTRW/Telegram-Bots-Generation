'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CmsScreen() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/cms')
  }, [router])

  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
        <span>Opening Sanity CMS...</span>
      </div>
    </div>
  )
}
