'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BillingIntervalToggle } from '@/components/billing/billing-interval-toggle'
import { PricingComparison, type PricingComparisonAction } from '@/components/billing/pricing-comparison'
import {
  cancelSubscriptionAtPeriodEndAction,
  changeSubscriptionPlanAction,
  getCurrentSubscriptionAction,
  resumeSubscriptionAction,
} from '@/lib/billing/actions'
import type {
  BillingCurrency,
  BillingInterval,
  PlanCode,
  PlanStatus,
  SubscriptionSummary,
} from '@/lib/billing/types'
import {
  getPlanDefinition,
} from '@/lib/billing/plans'

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

function getBillingIntervalLabel(locale: string, interval: BillingInterval) {
  if (locale === 'en') {
    return interval === 'year' ? 'Yearly billing' : 'Monthly billing'
  }

  return interval === 'year' ? 'Годовая оплата' : 'Ежемесячная оплата'
}

function getBillingIntervalSuffix(locale: string, interval: BillingInterval) {
  if (locale === 'en') {
    return interval === 'year' ? '/ year' : '/ month'
  }

  return interval === 'year' ? '/ год' : '/ мес'
}

function getBillingIntervalSwitchLabel(locale: string, interval: BillingInterval) {
  if (locale === 'en') {
    return interval === 'year' ? 'yearly' : 'monthly'
  }

  return interval === 'year' ? 'на год' : 'на месяц'
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
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    initialSubscription.pendingTransaction?.billingInterval ?? initialSubscription.billingInterval
  )
  const [error, setError] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isRu = locale !== 'en'

  const currentPlan = getPlanDefinition(subscription.planCode, locale)
  const effectivePlan = getPlanDefinition(subscription.effectivePlanCode, locale)
  const visiblePlan = subscription.isAdmin ? currentPlan : effectivePlan
  const nextBillingDateLabel =
    subscription.planCode === 'base' && !subscription.currentPeriodEnd
      ? '∞'
      : formatDate(locale, subscription.currentPeriodEnd)
  const canSwitchCurrency = subscription.availableCurrencies.length > 1
  const statusMeta = getStatusMeta(locale, subscription.status)
  const currentPlanPriceSuffix = getBillingIntervalSuffix(locale, subscription.billingInterval)

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
      setBillingInterval(result.subscription.pendingTransaction?.billingInterval ?? result.subscription.billingInterval)
    })
  }

  const handlePlanChange = (planCode: PlanCode) => {
    startTransition(async () => {
      setError(null)
      setActiveAction(`plan:${planCode}`)

      const result = await changeSubscriptionPlanAction(planCode, currency, billingInterval, locale)
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
        setBillingInterval(refreshed.subscription.pendingTransaction?.billingInterval ?? refreshed.subscription.billingInterval)
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
        setBillingInterval(result.subscription.pendingTransaction?.billingInterval ?? result.subscription.billingInterval)
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
        setBillingInterval(result.subscription.pendingTransaction?.billingInterval ?? result.subscription.billingInterval)
      }
      setActiveAction(null)
    })
  }

  const pendingTransaction = subscription.pendingTransaction

  const buildPlanAction = (planCode: PlanCode): PricingComparisonAction => {
    const isBasePlan = planCode === 'base'
    const matchesCurrentPlan =
      subscription.planCode === planCode &&
      subscription.status === 'active' &&
      !subscription.cancelAtPeriodEnd &&
      (isBasePlan || (subscription.billingInterval === billingInterval && subscription.currency === currency))

    if (
      pendingTransaction?.planCode === planCode &&
      (isBasePlan || (pendingTransaction.billingInterval === billingInterval && pendingTransaction.currency === currency)) &&
      pendingTransaction.confirmationUrl
    ) {
      return {
        label: isRu ? 'Продолжить оплату' : 'Continue payment',
        onClick: () => {
          window.location.assign(pendingTransaction.confirmationUrl as string)
        },
        disabled: false,
        loading: false,
      }
    }

    if (matchesCurrentPlan) {
      return {
        label: isRu ? 'Текущий тариф' : 'Current plan',
        disabled: true,
        variant: 'outline',
      }
    }

    if (
      !isBasePlan &&
      subscription.planCode === planCode &&
      subscription.billingInterval === billingInterval &&
      subscription.currency === currency &&
      subscription.cancelAtPeriodEnd
    ) {
      return {
        label: isRu ? 'Оставить тариф активным' : 'Keep plan active',
        onClick: handleResume,
        disabled: activeAction !== null && activeAction !== 'resume',
        loading: activeAction === 'resume',
        variant: 'default',
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
          ? isRu
            ? `Выбрать ${getPlanDefinition(planCode, locale).name} ${getBillingIntervalSwitchLabel(locale, billingInterval)}`
            : `Choose ${getPlanDefinition(planCode, locale).name} ${getBillingIntervalSwitchLabel(locale, billingInterval)}`
          : subscription.planCode === planCode
            ? isRu
              ? `Переключить ${getPlanDefinition(planCode, locale).name} ${getBillingIntervalSwitchLabel(locale, billingInterval)}`
              : `Switch ${getPlanDefinition(planCode, locale).name} to ${getBillingIntervalSwitchLabel(locale, billingInterval)}`
            : isRu
              ? `Перейти на ${getPlanDefinition(planCode, locale).name} ${getBillingIntervalSwitchLabel(locale, billingInterval)}`
              : `Switch to ${getPlanDefinition(planCode, locale).name} ${getBillingIntervalSwitchLabel(locale, billingInterval)}`,
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
              ? 'Управляйте подпиской, биллинг-периодом, лимитами аккаунта и доступом к CRM, аналитике, AI и managed hosting.'
              : 'Manage the subscription, billing period, account limits, and access to CRM, analytics, AI, and managed hosting.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSwitchCurrency
            ? subscription.availableCurrencies.map((availableCurrency) => (
                <Button
                  key={availableCurrency}
                  type="button"
                  variant={currency === availableCurrency ? 'default' : 'outline'}
                  onClick={() => setCurrency(availableCurrency)}
                  disabled={isPending}
                >
                  {availableCurrency}
                </Button>
              ))
            : null}
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
                  ? `Платеж для тарифа ${getPlanDefinition(subscription.pendingTransaction.planCode, locale).name} (${getBillingIntervalLabel(locale, subscription.pendingTransaction.billingInterval).toLowerCase()}) уже создан.`
                  : `A payment for ${getPlanDefinition(subscription.pendingTransaction.planCode, locale).name} (${getBillingIntervalLabel(locale, subscription.pendingTransaction.billingInterval).toLowerCase()}) is already waiting for completion.`}
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
                  {isRu ? 'Стоимость за период' : 'Price per billing period'}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {getBillingIntervalLabel(locale, subscription.billingInterval)}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {formatAmount(locale, subscription.priceAmount, subscription.currency)}
                  <span className="ml-2 text-sm font-medium text-zinc-400">{currentPlanPriceSuffix}</span>
                </div>
                {subscription.billingInterval === 'year' && subscription.priceAmount > 0 ? (
                  <div className="mt-2 flex items-center justify-end gap-2 text-xs text-zinc-400">
                    <span>{isRu ? 'Эквивалент' : 'Equivalent'}</span>
                    <span className="text-white">
                      {formatAmount(locale, subscription.priceAmount / 12, subscription.currency)}
                    </span>
                    <span>{isRu ? '/ мес' : '/ month'}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {isRu ? 'Следующая дата' : 'Next billing date'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  {nextBillingDateLabel}
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
          </CardContent>
        </Card>
      </div>

      <PricingComparison
        locale={locale}
        currency={currency}
        billingInterval={billingInterval}
        currentPlanCode={subscription.planCode}
        title={isRu ? 'Все тарифы' : 'All plans'}
        headerControl={
          <div className="space-y-3 text-center">
            <BillingIntervalToggle
              locale={locale}
              value={billingInterval}
              onChange={setBillingInterval}
              disabled={isPending || activeAction !== null}
            />
            <div className="text-xs text-zinc-500">
              {isRu
                ? 'При оплате за год действует скидка 75% на все 12 месяцев.'
                : 'Annual billing applies a 75% discount across the full 12 months.'}
            </div>
          </div>
        }
        actions={planActions}
      />
    </div>
  )
}
