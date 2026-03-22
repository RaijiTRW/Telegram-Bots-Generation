'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { SubscriptionPageClient } from '@/components/billing/subscription-page-client'
import { getCurrentSubscriptionAction } from '@/lib/billing/actions'
import type { SubscriptionSummary } from '@/lib/billing/types'

interface SubscriptionScreenProps {
  initialSubscription?: SubscriptionSummary
}

export default function SubscriptionScreen({ initialSubscription }: SubscriptionScreenProps) {
  const locale = useLocale()
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(initialSubscription ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!initialSubscription)

  useEffect(() => {
    if (subscription) {
      return
    }

    let isMounted = true

    const loadSubscription = async () => {
      setIsLoading(true)
      setError(null)

      const result = await getCurrentSubscriptionAction()
      if (!isMounted) {
        return
      }

      if (!result.success || !result.subscription) {
        setError(result.error || (locale === 'en' ? 'Failed to load subscription.' : 'Не удалось загрузить подписку.'))
        setIsLoading(false)
        return
      }

      setSubscription(result.subscription)
      setIsLoading(false)
    }

    void loadSubscription()

    return () => {
      isMounted = false
    }
  }, [locale, subscription])

  if (subscription) {
    return <SubscriptionPageClient locale={locale} initialSubscription={subscription} />
  }

  if (error) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
        <span>{isLoading ? (locale === 'en' ? 'Loading subscription...' : 'Загрузка подписки...') : ''}</span>
      </div>
    </div>
  )
}
