'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { AlertTriangle, CreditCard, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPlanDefinition } from '@/lib/billing/plans'
import type { ViewerAccess } from '@/lib/billing/types'

interface SubscriptionEndedModalProps {
  viewerAccess: ViewerAccess
}

const NOTICE_KEY_PREFIX = 'cbtooll:subscription-ended-notice'

function getNoticeReason(viewerAccess: ViewerAccess) {
  if (viewerAccess.isAdmin) return null
  if (viewerAccess.endedNotice) return viewerAccess.endedNotice.reason
  if (viewerAccess.restrictions.includes('payment_past_due')) return 'past_due'
  if (viewerAccess.restrictions.includes('subscription_expired')) return 'expired'
  if (viewerAccess.status === 'past_due') return 'past_due'
  if (viewerAccess.status === 'expired' || viewerAccess.status === 'canceled') return 'expired'
  return null
}

function buildNoticeStorageKey(viewerAccess: ViewerAccess, reason: string) {
  if (viewerAccess.endedNotice?.noticeKey) {
    return `${NOTICE_KEY_PREFIX}:${viewerAccess.endedNotice.noticeKey}`
  }
  const anchor = viewerAccess.currentPeriodEnd || viewerAccess.pastDueAt || viewerAccess.canceledAt || 'no-date'
  return `${NOTICE_KEY_PREFIX}:${viewerAccess.planCode}:${reason}:${anchor}`
}

function getLostFeatures(locale: string, viewerAccess: ViewerAccess) {
  const isRu = locale !== 'en'
  const plan = getPlanDefinition(viewerAccess.endedNotice?.planCode || viewerAccess.planCode, locale)
  const items = [
    isRu
      ? `Лимит ботов снижен до ${viewerAccess.entitlements.maxBots}.`
      : `Bot limit falls back to ${viewerAccess.entitlements.maxBots}.`,
    isRu
      ? 'Хостинг-слоты, CRM и расширенная статистика становятся недоступны.'
      : 'Hosting slots, CRM, and account analytics become unavailable.',
    isRu
      ? 'AI-узлы, собственные AI-ключи и приоритетная поддержка отключаются.'
      : 'AI nodes, custom AI keys, and priority support are disabled.',
  ]

  if (viewerAccess.usageExceeded) {
    items.unshift(
      isRu
        ? 'Часть текущих ботов или размещений превышает лимиты Base.'
        : 'Some existing bots or hosted deployments are above Base limits.'
    )
  }

  return {
    planName: plan.name,
    items,
  }
}

export function SubscriptionEndedModal({ viewerAccess }: SubscriptionEndedModalProps) {
  const locale = useLocale()
  const isRu = locale !== 'en'
  const reason = getNoticeReason(viewerAccess)
  const [isOpen, setIsOpen] = useState(false)
  const storageKey = useMemo(
    () => (reason ? buildNoticeStorageKey(viewerAccess, reason) : null),
    [reason, viewerAccess]
  )
  const lost = useMemo(
    () => getLostFeatures(locale, viewerAccess),
    [locale, viewerAccess]
  )

  useEffect(() => {
    if (!reason || !storageKey) return

    try {
      if (window.localStorage.getItem(storageKey) === 'seen') return
    } catch {
      // If storage is unavailable, still show the notice for this session.
    }

    setIsOpen(true)
  }, [reason, storageKey])

  const close = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, 'seen')
      } catch {
        // Ignore localStorage issues.
      }
    }
    setIsOpen(false)
  }

  const renew = () => {
    close()
    window.location.assign(`/${locale}/dashboard/subscription`)
  }

  if (!isOpen || !reason) return null

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={isRu ? 'Закрыть окно' : 'Close modal'}
        onClick={close}
      />

      <div className="relative z-[131] w-full max-w-lg rounded-3xl border border-red-500/25 bg-zinc-950/95 p-6 shadow-2xl shadow-black/60">
        <button
          type="button"
          onClick={close}
          aria-label={isRu ? 'Закрыть окно' : 'Close modal'}
          className="absolute right-5 top-5 rounded-full p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 pr-8">
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-red-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-red-300">
              {isRu ? 'Подписка не активна' : 'Subscription inactive'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {reason === 'past_due'
                ? (isRu ? 'Не удалось продлить подписку' : 'We could not renew your subscription')
                : (isRu ? 'Подписка закончилась' : 'Your subscription has ended')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              {isRu
                ? `Тариф ${lost.planName} больше не дает доступ к платным возможностям. Пока доступ работает по правилам Base.`
                : `${lost.planName} no longer unlocks paid features. Your access now follows the Base plan rules.`}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">
            {isRu ? 'Что временно потеряно' : 'What you temporarily lose'}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
            {lost.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={close} className="text-zinc-300 hover:bg-white/5 hover:text-white">
            {isRu ? 'Позже' : 'Later'}
          </Button>
          <Button type="button" onClick={renew}>
            <CreditCard className="h-4 w-4" />
            {isRu ? 'Продлить подписку' : 'Renew subscription'}
          </Button>
        </div>
      </div>
    </div>
  )
}
