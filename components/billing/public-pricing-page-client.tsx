'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, CreditCard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PricingComparison, type PricingComparisonAction } from '@/components/billing/pricing-comparison'
import type { BillingCurrency, PlanCode } from '@/lib/billing/types'

interface PublicPricingPageClientProps {
  locale: string
  availableCurrencies: BillingCurrency[]
}

export function PublicPricingPageClient({
  locale,
  availableCurrencies,
}: PublicPricingPageClientProps) {
  const [currency, setCurrency] = useState<BillingCurrency>(availableCurrencies[0] || 'RUB')
  const isRu = locale !== 'en'

  const actions = useMemo<Partial<Record<PlanCode, PricingComparisonAction>>>(() => ({
    base: {
      label: isRu ? 'Начать бесплатно' : 'Start free',
      href: `/${locale}/auth/signup`,
      variant: 'outline',
    },
    business: {
      label: isRu ? 'Выбрать Business' : 'Choose Business',
      href: `/${locale}/auth/signup`,
      variant: 'default',
    },
    enterprise: {
      label: isRu ? 'Выбрать Enterprise' : 'Choose Enterprise',
      href: `/${locale}/auth/signup`,
      variant: 'outline',
    },
  }), [isRu, locale])

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/75 px-6 py-12 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(36,161,222,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_32%)]" />
        <div className="relative z-10 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9EDFFF]">
              <CreditCard className="h-3.5 w-3.5" />
              {isRu ? 'Тарифы' : 'Pricing'}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              {isRu ? 'Подберите тариф под текущий этап роста' : 'Choose a plan that matches your growth stage'}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-300">
              {isRu
                ? 'Base закрывает старт и ZIP-экспорт. Business сделан основным тарифом для продаж: CRM, базовая dashboard-аналитика, AI-ноды и managed hosting. Enterprise нужен, когда уже важны полная аналитика, AI Chat и высокий лимит по ботам.'
                : 'Base covers the starting point and ZIP export. Business is intentionally positioned as the main sales plan with CRM, dashboard analytics, AI nodes, and managed hosting. Enterprise is for full analytics, AI Chat, and higher scale.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {availableCurrencies.map((availableCurrency) => (
              <Button
                key={availableCurrency}
                type="button"
                variant={currency === availableCurrency ? 'default' : 'outline'}
                onClick={() => setCurrency(availableCurrency)}
              >
                {availableCurrency}
              </Button>
            ))}
            <Button asChild className="gap-2">
              <Link href={`/${locale}/auth/signup`}>
                {isRu ? 'Создать аккаунт' : 'Create account'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

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
                {isRu ? 'CRM, AI-ноды, dashboard-аналитика и managed hosting в одном тарифе.' : 'CRM, AI nodes, dashboard analytics, and managed hosting in one plan.'}
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
                {isRu ? 'Полная аналитика, AI Chat и максимальные лимиты.' : 'Full analytics, AI Chat, and the highest limits.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PricingComparison
        locale={locale}
        currency={currency}
        title={isRu ? 'Подробное сравнение тарифов' : 'Detailed plan comparison'}
        subtitle={isRu
          ? 'Таблица ниже показывает реальное распределение возможностей по тарифам. Здесь же видно, где есть ограничения, где доступ открыт, а где функция пока появится позже.'
          : 'The table below reflects the real entitlement matrix used by the product. It shows what is available, restricted, or coming later.'}
        actions={actions}
      />
    </div>
  )
}
