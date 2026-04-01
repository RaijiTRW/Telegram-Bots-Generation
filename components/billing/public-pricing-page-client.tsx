'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BillingIntervalToggle } from '@/components/billing/billing-interval-toggle'
import { PaymentSoonModal } from '@/components/billing/payment-soon-modal'
import { PricingComparison, type PricingComparisonAction } from '@/components/billing/pricing-comparison'
import type { BillingCurrency, BillingInterval, PlanCode } from '@/lib/billing/types'

interface PublicPricingPageClientProps {
  locale: string
  availableCurrencies: BillingCurrency[]
}

export function PublicPricingPageClient({
  locale,
  availableCurrencies,
}: PublicPricingPageClientProps) {
  const isRu = locale !== 'en'
  const localeCurrencies: BillingCurrency[] = isRu ? ['RUB'] : ['USD']
  const [currency, setCurrency] = useState<BillingCurrency>(localeCurrencies[0] || availableCurrencies[0] || 'RUB')
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month')
  const [paymentSoonOpen, setPaymentSoonOpen] = useState(false)
  const canSwitchCurrency = localeCurrencies.length > 1

  const actions = useMemo<Partial<Record<PlanCode, PricingComparisonAction>>>(() => ({
    base: {
      label: isRu ? 'Начать бесплатно' : 'Start free',
      href: `/${locale}/auth/signup?plan=base&billingInterval=month`,
      variant: 'outline',
    },
    business: {
      label: isRu
        ? `Выбрать Business ${billingInterval === 'year' ? 'на год' : 'на месяц'}`
        : `Choose Business ${billingInterval === 'year' ? 'yearly' : 'monthly'}`,
      href: isRu ? `/${locale}/auth/signup?plan=business&billingInterval=${billingInterval}&currency=${currency}` : undefined,
      onClick: isRu ? undefined : () => setPaymentSoonOpen(true),
      variant: 'default',
    },
    enterprise: {
      label: isRu
        ? `Выбрать Enterprise ${billingInterval === 'year' ? 'на год' : 'на месяц'}`
        : `Choose Enterprise ${billingInterval === 'year' ? 'yearly' : 'monthly'}`,
      href: isRu ? `/${locale}/auth/signup?plan=enterprise&billingInterval=${billingInterval}&currency=${currency}` : undefined,
      onClick: isRu ? undefined : () => setPaymentSoonOpen(true),
      variant: 'outline',
    },
  }), [billingInterval, currency, isRu, locale])

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            {isRu ? 'Выберите удобный биллинг-период' : 'Choose the billing period that fits you'}
          </h1>
          <p className="text-sm leading-6 text-zinc-400">
            {isRu
              ? 'Годовая оплата даёт скидку 75% от текущей месячной цены на все 12 месяцев. Таблица и карточки ниже сразу пересчитываются под выбранный период.'
              : 'Annual billing gives a 75% discount from the current monthly price across all 12 months. The cards and comparison table below recalculate instantly for the selected period.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canSwitchCurrency
            ? localeCurrencies.map((availableCurrency) => (
                <Button
                  key={availableCurrency}
                  type="button"
                  variant={currency === availableCurrency ? 'default' : 'outline'}
                  onClick={() => setCurrency(availableCurrency)}
                >
                  {availableCurrency}
                </Button>
              ))
            : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
              <Sparkles className="h-5 w-5 text-[#24A1DE]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{isRu ? 'Base' : 'Base'}</div>
              <div className="text-sm text-zinc-400">
                {isRu ? 'Старт без оплаты, до 3 ботов и ZIP-экспорт.' : 'Free start, up to 3 bots and ZIP export.'}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-[#24A1DE]/25 bg-gradient-to-br from-[#24A1DE]/12 via-zinc-950/85 to-[#8B5CF6]/12 p-6 shadow-[0_16px_50px_rgba(36,161,222,0.14)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#24A1DE]/25 bg-[#24A1DE]/15 p-2.5">
              <CreditCard className="h-5 w-5 text-[#9EDFFF]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{isRu ? 'Business — основной выбор' : 'Business — default choice'}</div>
              <div className="text-sm text-zinc-300">
                {billingInterval === 'year'
                  ? isRu
                    ? 'При оплате за год этот тариф считается со скидкой 75% на все 12 месяцев.'
                    : 'With annual billing this plan is charged with a 75% discount across all 12 months.'
                  : isRu
                    ? 'CRM, AI-ноды, dashboard-аналитика и размещение на нашем хостинге в одном тарифе.'
                    : 'CRM, AI nodes, dashboard analytics, and managed hosting in one plan.'}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
              <Sparkles className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{isRu ? 'Enterprise' : 'Enterprise'}</div>
              <div className="text-sm text-zinc-400">
                {isRu ? 'Полная аналитика, AI Chat (скоро) и максимальные лимиты.' : 'Full analytics, AI Chat (coming soon), and the highest limits.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PricingComparison
        locale={locale}
        currency={currency}
        billingInterval={billingInterval}
        title={isRu ? 'Подробное сравнение тарифов' : 'Detailed plan comparison'}
        subtitle={isRu
          ? 'Таблица ниже показывает реальное распределение возможностей по тарифам и сразу пересчитывает стоимость под месяц или год.'
          : 'The table below reflects the real entitlement matrix and recalculates pricing for monthly or annual billing.'}
        headerControl={
          <BillingIntervalToggle
            locale={locale}
            value={billingInterval}
            onChange={setBillingInterval}
          />
        }
        actions={actions}
      />

      <PaymentSoonModal
        locale={locale}
        open={paymentSoonOpen}
        onClose={() => setPaymentSoonOpen(false)}
      />
    </div>
  )
}
