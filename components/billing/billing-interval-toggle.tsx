'use client'

import { BadgePercent, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BillingInterval } from '@/lib/billing/types'

interface BillingIntervalToggleProps {
  locale: string
  value: BillingInterval
  onChange: (value: BillingInterval) => void
  disabled?: boolean
  className?: string
}

export function BillingIntervalToggle({
  locale,
  value,
  onChange,
  disabled = false,
  className,
}: BillingIntervalToggleProps) {
  const isRu = locale !== 'en'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/70 p-1',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange('month')}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          value === 'month'
            ? 'bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white shadow-lg shadow-[#24A1DE]/15'
            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
        )}
      >
        <CalendarClock className="h-4 w-4" />
        <span>{isRu ? 'Месяц' : 'Monthly'}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('year')}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          value === 'year'
            ? 'bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white shadow-lg shadow-[#24A1DE]/15'
            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
        )}
      >
        <CalendarClock className="h-4 w-4" />
        <span>{isRu ? 'Год' : 'Yearly'}</span>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          <span className="inline-flex items-center gap-1">
            <BadgePercent className="h-3 w-3" />
            -75%
          </span>
        </span>
      </button>
    </div>
  )
}
