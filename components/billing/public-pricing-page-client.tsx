'use client'

import { useMemo, useState } from 'react'
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            {isRu ? 'Тарифы' : 'Pricing'}
          </h1>
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
