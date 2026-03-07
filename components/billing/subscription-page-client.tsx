'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { PricingComparison, type PricingComparisonAction } from '@/components/billing/pricing-comparison'
import {
  cancelSubscriptionAtPeriodEndAction,
  changeSubscriptionPlanAction,
  getCurrentSubscriptionAction,
  resumeSubscriptionAction,
} from '@/lib/billing/actions'
import type {
  BillingCurrency,
  PlanCode,
  PlanStatus,
  SubscriptionSummary,
} from '@/lib/billing/types'
import { getPlanDefinition } from '@/lib/billing/plans'

interface SubscriptionPageClientProps {
  locale: string
  initialSubscription: SubscriptionSummary
}

function formatDate(locale: string, value: string | null) {
  if (!value) return locale === 'en' ? 'Not set' : 'Не задано'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return locale === 'en' ? 'Not set' : 'Не задано'
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  }).format(new Date(parsed))
}

function formatAmount(locale: string, amount: number, currency: BillingCurrency) {
  if (amount === 0) return locale === 'en' ? 'Free' : 'Бесплатно'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(amount)
}

function getStatusMeta(locale: string, status: PlanStatus) {
  if (status === 'past_due') {
    return {
      label: locale === 'en' ? 'Past due' : 'Просрочен платеж',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    }
  }

  if (status === 'canceled') {
    return {
      label: locale === 'en' ? 'Canceled' : 'Отменен',
      className: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300',
    }
  }

  if (status === 'expired') {
    return {
      label: locale === 'en' ? 'Expired' : 'Истек',
      className: 'border-red-500/25 bg-red-500/10 text-red-300',
    }
  }

  if (status === 'incomplete') {
    return {
      label: locale === 'en' ? 'Incomplete' : 'Не завершен',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    }
  }

  return {
    label: locale === 'en' ? 'Active' : 'Активна',
    className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  }
}

function getRestrictionLabel(locale: string, restriction: string) {
  switch (restriction) {
    case 'payment_past_due':
      return locale === 'en'
        ? 'Renewal failed. Restricted sections are soft-locked until payment succeeds.'
        : 'Автосписание не прошло. Недоступные разделы мягко заблокированы до успешной оплаты.'
    case 'subscription_expired':
      return locale === 'en'
        ? 'The paid period ended. Access has fallen back to Base rules.'
        : 'Оплаченный период завершился. Доступ переведен на правила Base.'
    case 'payment_incomplete':
      return locale === 'en'
        ? 'Subscription payment has not been completed yet.'
        : 'Оплата подписки пока не завершена.'
    case 'bots_over_limit':
      return locale === 'en'
        ? 'You are above the bot limit for the current effective plan.'
        : 'Количество ботов превышает лимит текущего тарифа.'
    case 'hosting_over_limit':
      return locale === 'en'
        ? 'You are above the hosted-bot limit for the current effective plan.'
        : 'Количество размещенных ботов превышает лимит текущего тарифа.'
    default:
      return restriction
  }
}

export function SubscriptionPageClient({
  locale,
  initialSubscription,
}: SubscriptionPageClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription)
  const [currency, setCurrency] = useState<BillingCurrency>(initialSubscription.currency)
  const [error, setError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isRu = locale !== 'en'

  const currentPlan = getPlanDefinition(subscription.planCode, locale)
  const effectivePlan = getPlanDefinition(subscription.effectivePlanCode, locale)
  const visiblePlan = subscription.isAdmin ? currentPlan : effectivePlan
  const statusMeta = getStatusMeta(locale, subscription.status)

  const refreshSubscription = () => {
    startTransition(async () => {
      setError(null)
      const result = await getCurrentSubscriptionAction()
      if (!result.success || !result.subscription) {
        setError(result.error || (isRu ? 'Не удалось обновить подписку.' : 'Failed to refresh subscription.'))
        return
      }
      setSubscription(result.subscription)
      setCurrency((prev) => (result.subscription.availableCurrencies.includes(prev) ? prev : result.subscription.currency))
    })
  }

  const handlePlanChange = (planCode: PlanCode) => {
    startTransition(async () => {
      setError(null)
      setActiveAction(`plan:${planCode}`)

      const result = await changeSubscriptionPlanAction(planCode, currency, locale)
      if (!result.success) {
        setError(result.error || (isRu ? 'Не удалось изменить тариф.' : 'Failed to change plan.'))
        setActiveAction(null)
        return
      }

      if ('confirmationUrl' in result && result.confirmationUrl) {
        window.location.assign(result.confirmationUrl)
        return
      }

      const refreshed = await getCurrentSubscriptionAction()
      if (!refreshed.success || !refreshed.subscription) {
        setError(refreshed.error || (isRu ? 'Тариф изменен, но обновление состояния не удалось.' : 'Plan changed, but refresh failed.'))
      } else {
        setSubscription(refreshed.subscription)
      }
      setActiveAction(null)
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      setError(null)
      setActiveAction('cancel')
      const result = await cancelSubscriptionAtPeriodEndAction()
      if (!result.success || !result.subscription) {
        setError(result.error || (isRu ? 'Не удалось отключить продление.' : 'Failed to disable renewal.'))
      } else {
        setSubscription(result.subscription)
      }
      setActiveAction(null)
    })
  }

  const handleResume = () => {
    startTransition(async () => {
      setError(null)
      setActiveAction('resume')
      const result = await resumeSubscriptionAction()
      if (!result.success || !result.subscription) {
        setError(result.error || (isRu ? 'Не удалось возобновить продление.' : 'Failed to resume renewal.'))
      } else {
        setSubscription(result.subscription)
      }
      setActiveAction(null)
    })
  }

  const pendingTransaction = subscription.pendingTransaction

  const buildPlanAction = (planCode: PlanCode): PricingComparisonAction => {
    if (pendingTransaction?.planCode === planCode && pendingTransaction.confirmationUrl) {
      return {
        label: isRu ? 'Продолжить оплату' : 'Continue payment',
        onClick: () => {
          window.location.assign(pendingTransaction.confirmationUrl as string)
        },
        disabled: false,
        loading: false,
      }
    }

    if (subscription.planCode === planCode && subscription.status === 'active' && !subscription.cancelAtPeriodEnd) {
      return {
        label: isRu ? 'Текущий тариф' : 'Current plan',
        disabled: true,
        variant: 'outline',
      }
    }

    if (planCode === 'base') {
      return {
        label: isRu ? 'Переключить на Base' : 'Switch to Base',
        onClick: () => handlePlanChange('base'),
        disabled: activeAction !== null && activeAction !== 'plan:base',
        loading: activeAction === 'plan:base',
        variant: 'outline',
      }
    }

    return {
      label:
        subscription.planCode === 'base'
          ? isRu ? `Выбрать ${getPlanDefinition(planCode, locale).name}` : `Choose ${getPlanDefinition(planCode, locale).name}`
          : isRu ? `Перейти на ${getPlanDefinition(planCode, locale).name}` : `Switch to ${getPlanDefinition(planCode, locale).name}`,
      onClick: () => handlePlanChange(planCode),
      disabled: activeAction !== null && activeAction !== `plan:${planCode}`,
      loading: activeAction === `plan:${planCode}`,
      variant: planCode === 'business' ? 'default' : 'outline',
    }
  }

  const planActions: Partial<Record<PlanCode, PricingComparisonAction>> = {
    base: buildPlanAction('base'),
    business: buildPlanAction('business'),
    enterprise: buildPlanAction('enterprise'),
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9EDFFF]">
            <CreditCard className="h-3.5 w-3.5" />
            {isRu ? 'Подписка' : 'Subscription'}
          </div>
          <h1 className="text-3xl font-bold text-white">
            {isRu ? 'Тарифы и подписка' : 'Plans and subscription'}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            {isRu
              ? 'Управляйте ежемесячной подпиской, лимитами аккаунта и доступом к CRM, аналитике, AI и managed hosting.'
              : 'Manage the monthly subscription, account limits, and access to CRM, analytics, AI, and managed hosting.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {subscription.availableCurrencies.map((availableCurrency) => (
            <Button
              key={availableCurrency}
              type="button"
              variant={currency === availableCurrency ? 'default' : 'outline'}
              onClick={() => setCurrency(availableCurrency)}
              disabled={isPending}
            >
              {availableCurrency}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={refreshSubscription}
            disabled={isPending}
          >
            <RefreshCcw className={cn('h-4 w-4', isPending ? 'animate-spin' : '')} />
            {isRu ? 'Обновить' : 'Refresh'}
          </Button>
        </div>
      </header>

      {subscription.pendingTransaction?.confirmationUrl ? (
        <Card className="border-[#24A1DE]/25 bg-[#24A1DE]/10">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">
                {isRu ? 'Есть незавершенная оплата подписки' : 'There is a pending subscription payment'}
              </div>
              <div className="text-sm text-zinc-300">
                {isRu
                  ? `Платеж для тарифа ${getPlanDefinition(subscription.pendingTransaction.planCode, locale).name} уже создан.`
                  : `A payment for ${getPlanDefinition(subscription.pendingTransaction.planCode, locale).name} is already waiting for completion.`}
              </div>
            </div>
            <Button onClick={() => window.location.assign(subscription.pendingTransaction?.confirmationUrl as string)}>
              {isRu ? 'Открыть оплату' : 'Open payment'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {subscription.softLocked || subscription.restrictions.length ? (
        <Card className="border-amber-500/25 bg-amber-500/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="space-y-2">
                <div className="text-sm font-medium text-white">
                  {isRu ? 'Есть активные ограничения по подписке' : 'Subscription restrictions are active'}
                </div>
                <ul className="space-y-1 text-sm text-amber-100/90">
                  {subscription.restrictions.map((restriction) => (
                    <li key={restriction}>{getRestrictionLabel(locale, restriction)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.85fr]">
        <Card className="border-white/10 bg-zinc-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-3 text-white">
              <span>{isRu ? 'Текущий тариф' : 'Current plan'}</span>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide', statusMeta.className)}>
                {statusMeta.label}
              </span>
              {subscription.cancelAtPeriodEnd ? (
                <span className="rounded-full border border-zinc-500/25 bg-zinc-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-zinc-300">
                  {isRu ? 'Продление отключено' : 'Renewal disabled'}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-bold text-white">{currentPlan.name}</div>
                <div className="mt-2 text-sm text-zinc-400">{currentPlan.description}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isRu ? 'Стоимость' : 'Price'}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {formatAmount(locale, subscription.priceAmount, subscription.currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isRu ? 'Следующая дата' : 'Next billing date'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {formatDate(locale, subscription.currentPeriodEnd)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isRu ? 'Боты' : 'Bots'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {subscription.usage.bots} / {visiblePlan.entitlements.maxBots}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isRu ? 'Хостинг-слоты' : 'Hosting slots'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {subscription.usage.hostedBots} / {visiblePlan.entitlements.maxHostedBots}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {subscription.planCode !== 'base' && !subscription.cancelAtPeriodEnd ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={activeAction !== null}
                >
                  {activeAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isRu ? 'Отключить продление' : 'Cancel at period end'}
                </Button>
              ) : null}

              {subscription.planCode !== 'base' && subscription.cancelAtPeriodEnd ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResume}
                  disabled={activeAction !== null}
                >
                  {activeAction === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isRu ? 'Возобновить продление' : 'Resume renewal'}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-[#24A1DE]" />
              {subscription.isAdmin
                ? isRu ? 'Что входит в тариф' : 'Included in the plan'
                : isRu ? 'Что доступно сейчас' : 'Included right now'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visiblePlan.spotlightFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                <span>{feature}</span>
              </div>
            ))}

            <div className="rounded-2xl border border-[#24A1DE]/20 bg-[#24A1DE]/10 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-[#9EDFFF]" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">
                    {isRu ? 'Business — основной тариф для апгрейда' : 'Business is the default upgrade path'}
                  </div>
                  <div className="text-sm leading-6 text-zinc-300">
                    {isRu
                      ? 'Если нужен CRM, базовая dashboard-аналитика, AI-ноды и managed hosting, хватит Business. Enterprise нужен, когда нужен AI Chat, докупка токенов и полная аналитика.'
                      : 'Business covers CRM, basic dashboard analytics, AI nodes, and managed hosting. Move to Enterprise when you need AI Chat, token top-ups, and full analytics.'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PricingComparison
        locale={locale}
        currency={currency}
        currentPlanCode={subscription.planCode}
        title={isRu ? 'Сравнение тарифов' : 'Plan comparison'}
        subtitle={isRu
          ? 'Business визуально и продуктово выделен как основной тариф для большинства команд. Таблица ниже напрямую связана с реальными лимитами и доступами в приложении.'
          : 'Business is intentionally highlighted as the default plan for most teams. The table below is wired to the real limits and entitlements used in the app.'}
        actions={planActions}
      />
    </div>
  )
}
