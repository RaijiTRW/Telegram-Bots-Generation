import { AlertTriangle, Flame, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { PublicStatusHistory } from '@/lib/site/status-history'

type StatusHistoryStripProps = {
  locale: string
  history: PublicStatusHistory
}

const dayToneStyles = {
  healthy: 'bg-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.28)]',
  degraded: 'bg-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.32)]',
  critical: 'bg-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.36)]',
  no_data: 'bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
} as const

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(value)
}

export function StatusHistoryStrip({ locale, history }: StatusHistoryStripProps) {
  const isRu = locale === 'ru'

  const legend = [
    {
      key: 'healthy',
      label: isRu ? 'Стабильно' : 'Stable',
      color: dayToneStyles.healthy,
    },
    {
      key: 'degraded',
      label: isRu ? 'Просадка' : 'Degraded',
      color: dayToneStyles.degraded,
    },
    {
      key: 'critical',
      label: isRu ? 'Сбой' : 'Critical',
      color: dayToneStyles.critical,
    },
    {
      key: 'no_data',
      label: isRu ? 'Нет данных' : 'No data',
      color: dayToneStyles.no_data,
    },
  ] as const

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.92),rgba(5,7,10,0.98))] p-6 sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/8 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#7dd3fc]">
              <Sparkles className="h-3.5 w-3.5" />
              {isRu ? 'Последние 30 дней' : 'Last 30 days'}
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
              {isRu ? 'Стабильность ядра сервиса по дням' : 'Daily core-service stability'}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
              {isRu
                ? 'Полоса собирается из реальной телеметрии: посещения сайта, действия в редакторе, runtime-логи, биллинг и системные доставки. Цвет дня зависит от фактических сбоев и предупреждений.'
                : 'This strip is built from real telemetry: site visits, editor actions, runtime logs, billing activity, and system deliveries. Each day color reflects actual failures and warnings.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {legend.map((item) => (
              <div
                key={item.key}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
              >
                <span className={cn('h-2.5 w-2.5 rounded-[4px]', item.color)} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1.5">
              {history.days.map((day) => (
                <div
                  key={day.dayKey}
                  className={cn(
                    'h-14 rounded-lg transition-transform duration-150 hover:-translate-y-0.5',
                    dayToneStyles[day.tone]
                  )}
                  aria-label={`${day.fullLabel}: ${day.signalCount}`}
                  title={[
                    day.fullLabel,
                    isRu
                      ? day.tone === 'healthy'
                        ? 'Статус: стабильно'
                        : day.tone === 'degraded'
                          ? 'Статус: частичная просадка'
                          : day.tone === 'critical'
                            ? 'Статус: сбойный день'
                            : 'Статус: нет телеметрии'
                      : day.tone === 'healthy'
                        ? 'Status: stable'
                        : day.tone === 'degraded'
                          ? 'Status: degraded'
                          : day.tone === 'critical'
                            ? 'Status: critical'
                            : 'Status: no telemetry',
                    `${isRu ? 'Сигналы' : 'Signals'}: ${formatNumber(day.signalCount, locale)}`,
                    `${isRu ? 'Проблемы' : 'Issues'}: ${formatNumber(day.issueCount, locale)}`,
                    `${isRu ? 'Ошибки runtime' : 'Runtime errors'}: ${formatNumber(day.errorCount, locale)}`,
                    `${isRu ? 'Провалы биллинга' : 'Billing failures'}: ${formatNumber(day.failedTransactions, locale)}`,
                  ].join('\n')}
                />
              ))}
            </div>

            <div className="mt-2 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              {history.days.map((day, index) => (
                <div key={`${day.dayKey}-label`} className="text-center">
                  {index === 0 || index === history.days.length - 1 || index % 5 === 4 ? day.shortLabel : ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <AlertTriangle className="h-4 w-4 text-[#7dd3fc]" />
              {isRu ? 'Как читать эту полосу' : 'How to read this strip'}
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
              <p>
                {isRu
                  ? 'Зелёный день означает, что в наблюдаемой телеметрии не было заметных предупреждений и ошибок. Оранжевый показывает реальные частичные проблемы. Красный означает повышенную долю сбоев или несколько жёстких отказов.'
                  : 'A green day means no meaningful warnings or failures were detected in the observed telemetry. Orange shows real partial degradation. Red means a high failure share or multiple hard failures.'}
              </p>
              <p>
                {history.telemetryAvailable
                  ? isRu
                    ? 'Серая ячейка означает, что за этот день не было достаточного телеметрического сигнала для честной оценки.'
                    : 'A gray cell means there was not enough telemetry signal that day to make an honest health assessment.'
                  : isRu
                    ? 'Телеметрия сейчас недоступна, поэтому полоса временно показывает только отсутствие данных.'
                    : 'Telemetry is currently unavailable, so the strip temporarily shows no-data days only.'}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Flame className="h-4 w-4 text-emerald-300" />
              {isRu ? 'Сводка по окну' : 'Window summary'}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="text-zinc-500">{isRu ? 'Стабильных дней' : 'Stable days'}</div>
                <div className="mt-1 text-xl font-semibold text-white">{formatNumber(history.summary.healthyDays, locale)}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="text-zinc-500">{isRu ? 'Просадок' : 'Degraded days'}</div>
                <div className="mt-1 text-xl font-semibold text-white">{formatNumber(history.summary.degradedDays, locale)}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="text-zinc-500">{isRu ? 'Красных дней' : 'Critical days'}</div>
                <div className="mt-1 text-xl font-semibold text-white">{formatNumber(history.summary.criticalDays, locale)}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="text-zinc-500">{isRu ? 'Всего сигналов' : 'Total signals'}</div>
                <div className="mt-1 text-xl font-semibold text-white">{formatNumber(history.summary.totalSignals, locale)}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
              <div className="inline-flex rounded-full border border-amber-500/25 px-3 py-1 text-xs font-medium text-amber-200">
                {isRu ? 'AI скоро / выключено' : 'AI soon / disabled'}
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {isRu
                  ? 'AI Assistant и связанные AI-сценарии пока не входят в стабильный production-контур. Для обычных пользователей модуль остаётся выключенным.'
                  : 'AI Assistant and related AI flows are not part of the stable production perimeter yet. The module remains disabled for regular users.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
