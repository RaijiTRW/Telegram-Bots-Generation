'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PLAN_ORDER, getAllPlanDefinitions, getPricingFeatureGroups } from '@/lib/billing/plans'
import type {
  BillingCurrency,
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
  currentPlanCode?: PlanCode | null
  title?: string
  subtitle?: string
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

function renderCell(cell: PricingFeatureCell, locale: string) {
  switch (cell.kind) {
    case 'included':
      return (
        <span className="inline-flex items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 p-1.5">
          <Check className="h-4 w-4 text-emerald-300" />
        </span>
      )
    case 'excluded':
      return (
        <span className="inline-flex items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 p-1.5">
          <X className="h-4 w-4 text-red-300" />
        </span>
      )
    case 'soon':
      return (
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-wide text-zinc-300">
          {locale === 'en' ? 'Soon' : 'Скоро'}
        </span>
      )
    case 'limit':
    case 'text':
      return <span className="text-sm font-medium text-white">{cell.value}</span>
    default:
      return <span className="text-sm text-zinc-500">-</span>
  }
}

export function PricingComparison({
  locale,
  currency,
  currentPlanCode,
  title,
  subtitle,
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

      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="border-b border-white/10 p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {PLAN_ORDER.map((planCode) => {
              const plan = plans.find((item) => item.code === planCode)
              if (!plan) return null
              const action = actions?.[planCode]
              const isCurrent = currentPlanCode === planCode

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
                    {plan.badge ? (
                      <span className="rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[#9EDFFF]">
                        {plan.badge}
                      </span>
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
                      {formatPrice(plan.monthlyPrice[currency], currency, locale)}
                    </div>
                    <div className="pb-1 text-sm text-zinc-500">{formatPerMonth(locale)}</div>
                  </div>

                  <p className="mt-4 min-h-[72px] text-sm leading-6 text-zinc-300">
                    {plan.description}
                  </p>

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

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] align-middle">
                <th className="w-[280px] px-6 py-4 text-left text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                  {locale === 'en' ? 'Feature' : 'Функция'}
                </th>
                {PLAN_ORDER.map((planCode) => {
                  const plan = plans.find((item) => item.code === planCode)
                  if (!plan) return null

                  return (
                    <th key={plan.code} className="px-4 py-4 text-center align-middle">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{plan.name}</span>
                        {plan.popular ? (
                          <span className="rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#9EDFFF]">
                            {locale === 'en' ? 'Popular' : 'Популярный'}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {groups.map((group) => (
                <Fragment key={group.id}>
                  <tr className="border-y border-white/10 bg-white/[0.02]">
                    <td colSpan={PLAN_ORDER.length + 1} className="px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                      {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.06] align-middle">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">{row.label}</div>
                        {row.description ? (
                          <div className="mt-1 text-xs text-zinc-500">{row.description}</div>
                        ) : null}
                      </td>
                      {PLAN_ORDER.map((planCode) => (
                        <td key={`${row.id}-${planCode}`} className="px-4 py-4 text-center">
                          {renderCell(row.values[planCode], locale)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 px-6 py-4 text-xs text-zinc-500">
          <Lock className="h-3.5 w-3.5 text-zinc-600" />
          {locale === 'en'
            ? 'Managed hosting limits are plan-based now. Full hosting orchestration is prepared as a separate rollout.'
            : 'Лимиты managed hosting уже завязаны на тариф. Полная оркестрация хостинга будет добавлена отдельным этапом.'}
        </div>
      </div>
    </section>
  )
}
