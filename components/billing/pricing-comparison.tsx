'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, Loader2, Lock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PLAN_ORDER,
  getAllPlanDefinitions,
  getPlanFullYearPriceWithoutDiscount,
  getPlanMonthlyEquivalent,
  getPlanPrice,
  getPricingFeatureGroups,
} from '@/lib/billing/plans'
import type {
  BillingCurrency,
  BillingInterval,
  PlanCode,
  PricingFeatureCell,
} from '@/lib/billing/types'

export type PricingComparisonAction = {
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'default' | 'outline' | 'ghost'
}

interface PricingComparisonProps {
  locale: string
  currency: BillingCurrency
  billingInterval: BillingInterval
  currentPlanCode?: PlanCode | null
  title?: string
  subtitle?: string
  headerControl?: ReactNode
  actions?: Partial<Record<PlanCode, PricingComparisonAction>>
}

function formatPrice(value: number, currency: BillingCurrency, locale: string) {
  if (value === 0) {
    return locale === 'en' ? 'Free' : 'Бесплатно'
  }

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)
}

function formatPerMonth(locale: string) {
  return locale === 'en' ? '/ month' : '/ мес'
}

function formatPerYear(locale: string) {
  return locale === 'en' ? '/ year' : '/ год'
}

function renderComparisonCell(cell: PricingFeatureCell, locale: string) {
  switch (cell.kind) {
    case 'included':
      return <Check className="mx-auto h-4 w-4 text-emerald-300" />
    case 'excluded':
      return <X className="mx-auto h-4 w-4 text-zinc-600" />
    case 'soon':
      return (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
          {locale === 'en' ? 'Soon' : 'Скоро'}
        </span>
      )
    case 'limit':
    case 'text':
      return <span className="text-sm font-semibold text-white">{cell.value}</span>
    default:
      return <span className="text-zinc-600">-</span>
  }
}

export function PricingComparison({
  locale,
  currency,
  billingInterval,
  currentPlanCode,
  title,
  subtitle,
  headerControl,
  actions,
}: PricingComparisonProps) {
  const plans = getAllPlanDefinitions(locale)
  const groups = getPricingFeatureGroups(locale)

  return (
    <section className="space-y-6">
      {title || subtitle ? (
        <div className="space-y-2">
          {title ? <h2 className="text-2xl font-semibold text-white">{title}</h2> : null}
          {subtitle ? <p className="max-w-3xl text-sm leading-6 text-zinc-400">{subtitle}</p> : null}
        </div>
      ) : null}

      {headerControl ? <div className="flex justify-center">{headerControl}</div> : null}

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {PLAN_ORDER.map((planCode) => {
              const plan = plans.find((item) => item.code === planCode)
              if (!plan) return null
              const action = actions?.[planCode]
              const isCurrent = currentPlanCode === planCode
              const planPrice = getPlanPrice(plan.code, currency, billingInterval)
              const fullYearPrice = getPlanFullYearPriceWithoutDiscount(plan.code, currency)
              const monthlyEquivalent = getPlanMonthlyEquivalent(plan.code, currency, billingInterval)

              return (
                <div
                  key={`card-${plan.code}`}
                  className={cn(
                    'h-full rounded-3xl border p-6 text-left',
                    plan.popular
                      ? 'border-[#24A1DE]/35 bg-gradient-to-br from-[#24A1DE]/18 via-[#0A1020] to-[#8B5CF6]/18 shadow-[0_20px_60px_rgba(36,161,222,0.14)]'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  <div className="flex min-h-[24px] items-center justify-between gap-2">
                    {plan.badge || plan.recommendedBadge ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {plan.badge ? (
                          <span className="rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#9EDFFF]">
                            {plan.badge}
                          </span>
                        ) : null}
                        {plan.recommendedBadge ? (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                            {plan.recommendedBadge}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span />
                    )}
                    {isCurrent ? (
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                        {locale === 'en' ? 'Current' : 'Текущий'}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <div className="text-2xl font-semibold text-white">{plan.name}</div>
                    <div className="mt-1 text-sm text-zinc-400">{plan.tagline}</div>
                  </div>

                  <div className="mt-6 flex items-end gap-2">
                    <div className="text-3xl font-bold text-white">
                      {formatPrice(planPrice, currency, locale)}
                    </div>
                    <div className="pb-1 text-sm text-zinc-500">
                      {billingInterval === 'year' ? formatPerYear(locale) : formatPerMonth(locale)}
                    </div>
                  </div>
                  {billingInterval === 'year' && planPrice > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-500 line-through">
                        {formatPrice(fullYearPrice, currency, locale)}
                      </span>
                      <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        -75%
                      </span>
                      <span className="text-xs text-zinc-400">
                        {locale === 'en'
                          ? `Equivalent to ${formatPrice(monthlyEquivalent, currency, locale)} / month`
                          : `Эквивалент ${formatPrice(monthlyEquivalent, currency, locale)} / мес`}
                      </span>
                    </div>
                  ) : null}

                  <ul className="mt-4 space-y-2">
                    {plan.spotlightFeatures.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-zinc-200">
                        <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {action ? (
                    action.href && !action.onClick ? (
                      <Button
                        asChild
                        variant={action.variant || (plan.popular ? 'default' : 'outline')}
                        className="mt-6 w-full"
                      >
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant={action.variant || (plan.popular ? 'default' : 'outline')}
                        className="mt-6 w-full"
                        onClick={action.onClick}
                        disabled={action.disabled || action.loading}
                      >
                        {action.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {action.label}
                      </Button>
                    )
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/10 px-4 py-5 md:px-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">
                {locale === 'en' ? 'Feature comparison' : 'Сравнение функций'}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                {locale === 'en' ? 'A compact table for quick plan matching.' : 'Короткая таблица, чтобы быстро сравнить тарифы по строкам.'}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0B0D12]/80">
            <table className="min-w-[880px] w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="w-[320px] px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    {locale === 'en' ? 'Feature' : 'Функция'}
                  </th>
                  {PLAN_ORDER.map((planCode) => {
                    const plan = plans.find((item) => item.code === planCode)
                    if (!plan) return null

                    return (
                      <th key={`table-head-${plan.code}`} className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-white">{plan.name}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={`table-group-${group.id}`}>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <td colSpan={PLAN_ORDER.length + 1} className="px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#8ED8FF]/80">
                        {group.label}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={`table-row-${row.id}`} className="border-b border-white/[0.06] last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zinc-100">{row.label}</span>
                            {row.soon ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-300">
                                {locale === 'en' ? 'Soon' : 'Скоро'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {PLAN_ORDER.map((planCode) => (
                          <td key={`table-cell-${row.id}-${planCode}`} className="px-4 py-3 text-center">
                            {renderComparisonCell(row.values[planCode], locale)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-6 py-4 text-xs text-zinc-500">
          <Lock className="h-3.5 w-3.5 text-zinc-600" />
          {locale === 'en'
            ? 'Features marked as "Soon" are already assigned to plans, and their access rules and limits are fixed in advance.'
            : 'Разделы и функции со статусом «Скоро» уже закреплены за тарифами, а доступы и лимиты по ним зафиксированы заранее.'}
        </div>
      </div>
    </section>
  )
}
