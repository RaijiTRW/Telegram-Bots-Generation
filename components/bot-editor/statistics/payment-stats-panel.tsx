'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, CheckCircle2, Clock3, CreditCard, RefreshCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { getBotPaymentHistoryAction } from '@/lib/bot-editor/actions/editor-actions'
import type { BotPaymentHistory, BotPaymentHistoryPeriod } from '@/lib/bot-editor/types/analytics.types'

const PERIOD_OPTIONS: BotPaymentHistoryPeriod[] = ['24h', '7d', '30d', 'all']

const SUCCESS_STATUSES = new Set(['succeeded', 'success', 'paid', 'completed'])
const PENDING_STATUSES = new Set(['pending', 'open', 'created', 'processing', 'waiting_for_capture'])
const FAILED_STATUSES = new Set(['failed', 'canceled', 'cancelled', 'expired', 'refunded', 'error'])

function classifyStatus(status: string): 'success' | 'pending' | 'failed' | 'other' {
  const normalized = String(status || '').toLowerCase()
  if (SUCCESS_STATUSES.has(normalized)) return 'success'
  if (PENDING_STATUSES.has(normalized)) return 'pending'
  if (FAILED_STATUSES.has(normalized)) return 'failed'
  return 'other'
}

export function PaymentStatsPanel() {
  const t = useTranslations('editor.statistics')
  const locale = useLocale()
  const { bot } = useBotState()
  const botId = String(bot?.id || '')

  const [period, setPeriod] = useState<BotPaymentHistoryPeriod>('30d')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const [history, setHistory] = useState<BotPaymentHistory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const loadHistory = useCallback(async () => {
    if (!botId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getBotPaymentHistoryAction(botId, {
        period,
        search,
        method,
        status,
      })

      if (!result.success || !result.history) {
        setHistory(null)
        setError(result.error || t('payment.loadError'))
        return
      }

      setHistory(result.history)
    } catch (loadError) {
      setHistory(null)
      setError(String(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [botId, method, period, search, status, t])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const formatDateTime = useCallback((value: string) => {
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed))
  }, [locale])

  const formatAmount = useCallback((amount: number | null, currency: string) => {
    if (amount === null || !Number.isFinite(Number(amount))) {
      return '—'
    }
    const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
    return currency ? `${formatted} ${currency}` : formatted
  }, [locale])

  const totalAmountLabel = useMemo(() => {
    const totalAmount = Number(history?.summary.totalAmount || 0)
    const currencies = Array.from(
      new Set(
        (history?.items || [])
          .map((item) => String(item.currency || '').trim())
          .filter(Boolean)
      )
    )

    const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(totalAmount)

    if (currencies.length === 1) {
      return `${formatted} ${currencies[0]}`
    }
    if (currencies.length > 1) {
      return `${formatted} (${t('payment.mixedCurrencies')})`
    }
    return formatted
  }, [history, locale, t])

  const renderMethodLabel = useCallback((methodValue: string) => {
    const normalized = String(methodValue || '').toLowerCase()
    if (normalized === 'yookassa') return t('payment.methods.yookassa')
    if (normalized === 'stripe') return t('payment.methods.stripe')
    if (normalized === 'robokassa') return t('payment.methods.robokassa')
    if (normalized === 'telegram_stars') return t('payment.methods.telegram_stars')
    if (!normalized || normalized === 'unknown') return t('payment.methods.unknown')
    return methodValue
  }, [t])

  const renderStatusLabel = useCallback((statusValue: string) => {
    const normalized = String(statusValue || '').toLowerCase()
    const statusGroup = classifyStatus(normalized)
    if (statusGroup === 'success') return t('payment.statusLabels.success')
    if (statusGroup === 'pending') return t('payment.statusLabels.pending')
    if (statusGroup === 'failed') return t('payment.statusLabels.failed')
    return normalized || t('payment.statusLabels.unknown')
  }, [t])

  const getStatusClassName = useCallback((statusValue: string) => {
    const statusGroup = classifyStatus(statusValue)
    if (statusGroup === 'success') {
      return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
    }
    if (statusGroup === 'pending') {
      return 'border-amber-400/30 bg-amber-500/15 text-amber-200'
    }
    if (statusGroup === 'failed') {
      return 'border-rose-400/30 bg-rose-500/15 text-rose-200'
    }
    return 'border-white/15 bg-zinc-800/70 text-zinc-200'
  }, [])

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('payment.filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="xl:col-span-2">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t('payment.filters.searchPlaceholder')}
                  className="pl-9 border-white/10 bg-zinc-900/60 text-white"
                />
              </div>
            </div>

            <Select value={period} onValueChange={(value) => setPeriod(value as BotPaymentHistoryPeriod)}>
              <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                <SelectValue placeholder={t('payment.filters.period')} />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`payment.period.${option}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                <SelectValue placeholder={t('payment.filters.method')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payment.filters.allMethods')}</SelectItem>
                {history?.methods.map((methodValue) => (
                  <SelectItem key={methodValue} value={methodValue}>
                    {renderMethodLabel(methodValue)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                <SelectValue placeholder={t('payment.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('payment.filters.allStatuses')}</SelectItem>
                {history?.statuses.map((statusValue) => (
                  <SelectItem key={statusValue} value={statusValue}>
                    {renderStatusLabel(statusValue)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              className="border-white/10 text-zinc-300"
              onClick={() => void loadHistory()}
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('payment.summary.total')}</p>
                <p className="text-2xl font-semibold text-white mt-1">{history?.summary.totalCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#24A1DE]/15 border border-[#24A1DE]/25 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#24A1DE]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('payment.summary.amount')}</p>
                <p className="text-2xl font-semibold text-white mt-1">{totalAmountLabel}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
                <Clock3 className="w-5 h-5 text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('payment.summary.success')}</p>
                <p className="text-2xl font-semibold text-emerald-300 mt-1">{history?.summary.successCount || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('payment.summary.pendingOrFailed')}</p>
                <p className="text-2xl font-semibold text-amber-200 mt-1">
                  {(history?.summary.pendingCount || 0) + (history?.summary.failedCount || 0)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/25 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('payment.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-zinc-900/70 text-zinc-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.payer')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.id')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.amount')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.method')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.status')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('payment.columns.time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history?.items.length ? (
                  history.items.map((item) => {
                    const payerPrimary =
                      item.payerName ||
                      (item.payerUsername ? `@${item.payerUsername}` : '') ||
                      (item.payerId ? String(item.payerId) : '')
                    const payerSecondary = item.payerName
                      ? item.payerUsername
                        ? `@${item.payerUsername}`
                        : item.payerId
                          ? String(item.payerId)
                          : ''
                      : item.payerId && item.payerUsername
                        ? String(item.payerId)
                        : ''

                    return (
                      <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-3 py-2">
                          <div className="text-white">{payerPrimary || '—'}</div>
                          {payerSecondary ? (
                            <div className="text-xs text-zinc-500 mt-0.5">{payerSecondary}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-zinc-200 font-mono text-xs">{item.paymentId || item.id}</div>
                        </td>
                        <td className="px-3 py-2 text-zinc-200">{formatAmount(item.amount, item.currency)}</td>
                        <td className="px-3 py-2 text-zinc-200">{renderMethodLabel(item.method)}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${getStatusClassName(item.status)}`}>
                            {renderStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.createdAt)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
                      {t('payment.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
