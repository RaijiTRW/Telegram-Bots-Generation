'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { BarChart3, Lock, RefreshCcw, Search, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getDashboardGlobalPaymentsAction,
  getDashboardGlobalStatsAction,
  getDashboardGlobalSubscribersAction,
} from '@/lib/bot-editor/actions/editor-actions'
import type {
  DashboardGlobalPayments,
  DashboardGlobalStats,
  DashboardGlobalStatsPeriod,
  DashboardGlobalSubscribers,
} from '@/lib/bot-editor/types/analytics.types'

type BotOption = {
  id: string
  name: string
}

const PERIOD_OPTIONS: DashboardGlobalStatsPeriod[] = ['24h', '7d', '30d', 'all']

function resolveSubscriberDisplayName(item: DashboardGlobalSubscribers['items'][number]): string {
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (item.username) return `@${item.username}`
  if (item.telegramUserId > 0) return String(item.telegramUserId)
  return '—'
}

export default function DashboardStatisticsPage() {
  const t = useTranslations('dashboard.globalStatistics')
  const locale = useLocale()

  const [activeTab, setActiveTab] = useState<'basic' | 'pro'>('basic')
  const [period, setPeriod] = useState<DashboardGlobalStatsPeriod>('30d')
  const [botFilter, setBotFilter] = useState('all')
  const [bots, setBots] = useState<BotOption[]>([])

  const [stats, setStats] = useState<DashboardGlobalStats | null>(null)
  const [payments, setPayments] = useState<DashboardGlobalPayments | null>(null)
  const [subscribers, setSubscribers] = useState<DashboardGlobalSubscribers | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [paymentSearchInput, setPaymentSearchInput] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [paymentPage, setPaymentPage] = useState(1)
  const paymentPageSize = 12

  const [subscriberSearchInput, setSubscriberSearchInput] = useState('')
  const [subscriberSearch, setSubscriberSearch] = useState('')
  const [subscriberSource, setSubscriberSource] = useState<'all' | 'message' | 'callback_query' | 'unknown'>('all')
  const [subscriberPage, setSubscriberPage] = useState(1)
  const subscriberPageSize = 12

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPaymentSearch(paymentSearchInput.trim())
      setPaymentPage(1)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [paymentSearchInput])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubscriberSearch(subscriberSearchInput.trim())
      setSubscriberPage(1)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [subscriberSearchInput])

  useEffect(() => {
    setPaymentPage(1)
    setSubscriberPage(1)
  }, [period, botFilter])

  const loadBots = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setBots([])
        return
      }

      const { data, error: botsError } = await supabase
        .from('bots')
        .select('id, name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (botsError) return

      const options = (Array.isArray(data) ? data : [])
        .map((item) => ({
          id: String((item as Record<string, unknown>).id || ''),
          name: String((item as Record<string, unknown>).name || ''),
        }))
        .filter((item) => item.id)

      setBots(options)
    } catch {
      // ignore
    }
  }, [])

  const loadAll = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sharedFilters = {
        period,
        botId: botFilter !== 'all' ? botFilter : undefined,
      }

      const statsResult = await getDashboardGlobalStatsAction(sharedFilters)

      if (!statsResult.success || !statsResult.stats) {
        throw new Error(statsResult.error || t('loadError'))
      }

      setStats(statsResult.stats)

      if (!statsResult.stats.entitlements.basic) {
        setPayments({
          period,
          methods: [],
          statuses: [],
          page: paymentPage,
          pageSize: paymentPageSize,
          total: 0,
          summary: {
            totalCount: 0,
            totalAmount: 0,
            successCount: 0,
            pendingCount: 0,
            failedCount: 0,
            currencyTotals: [],
          },
          items: [],
        })
        setSubscribers({
          period,
          page: subscriberPage,
          pageSize: subscriberPageSize,
          total: 0,
          summary: {
            totalSubscribers: 0,
            activeInPeriod: 0,
            newInPeriod: 0,
            lastSeenAt: null,
          },
          sourceCounts: {
            message: 0,
            callback_query: 0,
            unknown: 0,
          },
          topLanguages: [],
          items: [],
        })
        return
      }

      const [paymentsResult, subscribersResult] = await Promise.all([
        getDashboardGlobalPaymentsAction(
          {
            ...sharedFilters,
            search: paymentSearch || undefined,
            method: paymentMethod,
            status: paymentStatus,
          },
          paymentPage,
          paymentPageSize
        ),
        getDashboardGlobalSubscribersAction(
          {
            ...sharedFilters,
            search: subscriberSearch || undefined,
            source: subscriberSource,
          },
          subscriberPage,
          subscriberPageSize
        ),
      ])

      if (!paymentsResult.success || !paymentsResult.history) {
        throw new Error(paymentsResult.error || t('loadError'))
      }
      if (!subscribersResult.success || !subscribersResult.data) {
        throw new Error(subscribersResult.error || t('loadError'))
      }

      setPayments(paymentsResult.history)
      setSubscribers(subscribersResult.data)
    } catch (loadError) {
      setError(String(loadError))
      setStats(null)
      setPayments(null)
      setSubscribers(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    botFilter,
    paymentMethod,
    paymentPage,
    paymentSearch,
    paymentStatus,
    period,
    subscriberPage,
    subscriberSearch,
    subscriberSource,
    t,
  ])

  useEffect(() => {
    void loadBots()
  }, [loadBots])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!stats?.entitlements.pro && activeTab === 'pro') {
      setActiveTab('basic')
    }
  }, [activeTab, stats?.entitlements.pro])

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return '—'
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

  const formatNumber = useCallback((value: number) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      maximumFractionDigits: 2,
    }).format(value)
  }, [locale])

  const formatPercent = useCallback((value: number) => `${formatNumber(value)}%`, [formatNumber])

  const formatAmount = useCallback((value: number, currency?: string) => {
    const formatted = formatNumber(value)
    return currency ? `${formatted} ${currency}` : formatted
  }, [formatNumber])

  const paymentTotalPages = useMemo(() => {
    if (!payments?.total) return 1
    return Math.max(1, Math.ceil(payments.total / payments.pageSize))
  }, [payments])

  const subscribersTotalPages = useMemo(() => {
    if (!subscribers?.total) return 1
    return Math.max(1, Math.ceil(subscribers.total / subscribers.pageSize))
  }, [subscribers])

  const trendRevenueMax = useMemo(() => {
    if (!stats?.trend.length) return 1
    return Math.max(...stats.trend.map((point) => point.revenue), 1)
  }, [stats?.trend])

  const trendActivityMax = useMemo(() => {
    if (!stats?.trend.length) return 1
    return Math.max(...stats.trend.map((point) => point.activity), 1)
  }, [stats?.trend])

  const topBotsByConversion = useMemo(() => {
    return [...(stats?.topBots || [])].sort((left, right) => right.conversionPercent - left.conversionPercent)
  }, [stats?.topBots])

  const basicIsLocked = stats ? !stats.entitlements.basic : false
  const proIsLocked = stats ? !stats.entitlements.pro : false

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400 mt-1">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          className="border-white/10 text-zinc-300"
          onClick={() => void loadAll()}
          disabled={isLoading}
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </header>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      {basicIsLocked ? (
        <Card className="border-amber-500/30 bg-zinc-950/60">
          <CardContent className="p-6 md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10">
                  <Lock className="h-5 w-5 text-amber-300" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">
                    {locale === 'en' ? 'Dashboard analytics require Business' : 'Dashboard-аналитика доступна с Business'}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-300">
                    {locale === 'en'
                      ? 'Your current plan keeps editor technical statistics available, but account-wide analytics, payments, and subscriber views are unlocked starting from Business.'
                      : 'На текущем тарифе у вас остается техническая статистика внутри редактора, а общая аналитика по аккаунту, платежам и подписчикам открывается начиная с Business.'}
                  </p>
                </div>
              </div>
              <Button asChild className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white">
                <Link href={`/${locale}/dashboard/subscription`}>
                  {locale === 'en' ? 'Open subscription' : 'Открыть подписку'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('filters.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={period} onValueChange={(value) => setPeriod(value as DashboardGlobalStatsPeriod)}>
                <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                  <SelectValue placeholder={t('filters.period')} />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`period.${option}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={botFilter} onValueChange={setBotFilter}>
                <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                  <SelectValue placeholder={t('filters.bot')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.allBots')}</SelectItem>
                  {bots.map((bot) => (
                    <SelectItem key={bot.id} value={bot.id}>
                      {bot.name || bot.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="rounded-lg border border-[#24A1DE]/25 bg-[#24A1DE]/10 px-3 py-2 text-sm text-[#9EDFFF]">
                {stats?.currencyMode === 'mixed'
                  ? t('currency.mixed')
                  : stats?.currencyMode === 'single'
                    ? t('currency.single', { currency: stats.currencies[0] || '' })
                    : t('currency.none')}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => {
            if (value === 'pro' && proIsLocked) return
            setActiveTab(value as 'basic' | 'pro')
          }}>
        <TabsList className="grid w-full max-w-[460px] grid-cols-2 bg-zinc-900/60 border border-white/10">
          <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
          <TabsTrigger
            value="pro"
            className={proIsLocked ? 'opacity-60 cursor-not-allowed' : ''}
          >
            <span className="inline-flex items-center gap-1">
              {t('tabs.pro')}
              {proIsLocked ? <Lock className="w-3.5 h-3.5" /> : null}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.revenue')}</div><div className="text-2xl font-semibold text-white mt-1">{formatAmount(stats?.basic.revenue || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.profit')}</div><div className="text-2xl font-semibold text-white mt-1">{formatAmount(stats?.basic.profit || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.successfulPayments')}</div><div className="text-2xl font-semibold text-emerald-300 mt-1">{formatNumber(stats?.basic.successfulPayments || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.pendingFailed')}</div><div className="text-2xl font-semibold text-amber-200 mt-1">{formatNumber(stats?.basic.pendingAndFailedPayments || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.totalSubscribers')}</div><div className="text-2xl font-semibold text-white mt-1">{formatNumber(stats?.basic.totalSubscribers || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.activeSubscribers')}</div><div className="text-2xl font-semibold text-white mt-1">{formatNumber(stats?.basic.activeSubscribers || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.newSubscribers')}</div><div className="text-2xl font-semibold text-white mt-1">{formatNumber(stats?.basic.newSubscribers || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('kpi.avgActivity')}</div><div className="text-2xl font-semibold text-white mt-1">{formatNumber(stats?.basic.avgUserActivity || 0)}</div></CardContent></Card>
          </div>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('trend.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.trend.length ? (
                <div className="h-52 flex items-end gap-1">
                  {stats.trend.map((point) => (
                    <div key={point.bucketStart} className="flex-1 min-w-[8px] flex flex-col items-center justify-end gap-2">
                      <div className="w-full flex items-end gap-0.5 h-full">
                        <div
                          className="w-1/2 rounded-t bg-gradient-to-t from-[#24A1DE] to-[#5DD8FF]"
                          style={{ height: `${Math.max(4, Math.round((point.revenue / trendRevenueMax) * 100))}%` }}
                          title={`${t('trend.revenue')}: ${formatAmount(point.revenue)}`}
                        />
                        <div
                          className="w-1/2 rounded-t bg-gradient-to-t from-[#8B5CF6] to-[#C4A4FF]"
                          style={{ height: `${Math.max(4, Math.round((point.activity / trendActivityMax) * 100))}%` }}
                          title={`${t('trend.activity')}: ${formatNumber(point.activity)}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-400">{t('empty')}</div>
              )}

              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#24A1DE]" />{t('trend.revenue')}</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />{t('trend.activity')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('topBots.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topBots.length ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-zinc-900/70 text-zinc-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.bot')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.revenue')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.conversion')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.payments')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats.topBots.map((bot) => (
                        <tr key={bot.botId} className="hover:bg-white/[0.03]">
                          <td className="px-3 py-2 text-white">{bot.botName}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatAmount(bot.revenue)}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatPercent(bot.conversionPercent)}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatNumber(bot.successfulPayments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-zinc-400">{t('empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('payments.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="xl:col-span-2 relative" suppressHydrationWarning>
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={paymentSearchInput}
                    onChange={(event) => setPaymentSearchInput(event.target.value)}
                    placeholder={t('payments.searchPlaceholder')}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="pl-9 border-white/10 bg-zinc-900/60 text-white"
                  />
                </div>
                <Select value={paymentMethod} onValueChange={(value) => { setPaymentMethod(value); setPaymentPage(1) }}>
                  <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white"><SelectValue placeholder={t('payments.method')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('payments.allMethods')}</SelectItem>
                    {(payments?.methods || []).map((method) => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={paymentStatus} onValueChange={(value) => { setPaymentStatus(value); setPaymentPage(1) }}>
                  <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white"><SelectValue placeholder={t('payments.status')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('payments.allStatuses')}</SelectItem>
                    {(payments?.statuses || []).map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {payments?.summary.currencyTotals.length ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <Wallet className="w-4 h-4 text-zinc-500" />
                  {payments.summary.currencyTotals.map((entry) => (
                    <span key={entry.currency} className="rounded border border-white/10 bg-white/5 px-2 py-1">
                      {entry.currency}: {formatAmount(entry.amount)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-zinc-900/70 text-zinc-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.bot')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.payer')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.id')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.amount')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.method')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.status')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('payments.columns.time')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payments?.items.length ? (
                      payments.items.map((item) => (
                        <tr key={`${item.id}-${item.botId}`} className="hover:bg-white/[0.03]">
                          <td className="px-3 py-2 text-white">{item.botName}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.payerName || (item.payerUsername ? `@${item.payerUsername}` : item.payerId || '—')}</td>
                          <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{item.paymentId || item.id}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.amount !== null ? formatAmount(item.amount, item.currency) : '—'}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.method}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.status}</td>
                          <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>{t('payments.empty')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {t('pagination.pageOf', {
                    page: payments?.page || paymentPage,
                    totalPages: paymentTotalPages,
                    total: payments?.total || 0,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="border-white/10 text-zinc-300" onClick={() => setPaymentPage((prev) => Math.max(1, prev - 1))} disabled={(payments?.page || paymentPage) <= 1 || isLoading}>
                    {t('pagination.prev')}
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/10 text-zinc-300" onClick={() => setPaymentPage((prev) => Math.min(paymentTotalPages, prev + 1))} disabled={(payments?.page || paymentPage) >= paymentTotalPages || isLoading}>
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('subscribers.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="xl:col-span-2 relative" suppressHydrationWarning>
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={subscriberSearchInput}
                    onChange={(event) => setSubscriberSearchInput(event.target.value)}
                    placeholder={t('subscribers.searchPlaceholder')}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                    className="pl-9 border-white/10 bg-zinc-900/60 text-white"
                  />
                </div>
                <Select value={subscriberSource} onValueChange={(value) => { setSubscriberSource(value as typeof subscriberSource); setSubscriberPage(1) }}>
                  <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                    <SelectValue placeholder={t('subscribers.source')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('subscribers.allSources')}</SelectItem>
                    <SelectItem value="message">{t('subscribers.sourceMessage')}</SelectItem>
                    <SelectItem value="callback_query">{t('subscribers.sourceCallback')}</SelectItem>
                    <SelectItem value="unknown">{t('subscribers.sourceUnknown')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
                  {t('subscribers.summary', {
                    total: subscribers?.summary.totalSubscribers || 0,
                    active: subscribers?.summary.activeInPeriod || 0,
                    newValue: subscribers?.summary.newInPeriod || 0,
                  })}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-zinc-900/70 text-zinc-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.bot')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.user')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.userId')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.language')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.source')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.firstSeen')}</th>
                      <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.lastSeen')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subscribers?.items.length ? (
                      subscribers.items.map((item) => (
                        <tr key={`${item.botId}-${item.telegramUserId}-${item.lastSeenAt || item.firstSeenAt || 'row'}`} className="hover:bg-white/[0.03]">
                          <td className="px-3 py-2 text-white">{item.botName}</td>
                          <td className="px-3 py-2 text-zinc-200">{resolveSubscriberDisplayName(item)}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.telegramUserId || '—'}</td>
                          <td className="px-3 py-2 text-zinc-200 uppercase">{item.languageCode || '—'}</td>
                          <td className="px-3 py-2 text-zinc-200">{item.source}</td>
                          <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.firstSeenAt)}</td>
                          <td className="px-3 py-2 text-zinc-100">{formatDateTime(item.lastSeenAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>{t('subscribers.empty')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {t('pagination.pageOf', {
                    page: subscribers?.page || subscriberPage,
                    totalPages: subscribersTotalPages,
                    total: subscribers?.total || 0,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="border-white/10 text-zinc-300" onClick={() => setSubscriberPage((prev) => Math.max(1, prev - 1))} disabled={(subscribers?.page || subscriberPage) <= 1 || isLoading}>
                    {t('pagination.prev')}
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/10 text-zinc-300" onClick={() => setSubscriberPage((prev) => Math.min(subscribersTotalPages, prev + 1))} disabled={(subscribers?.page || subscriberPage) >= subscribersTotalPages || isLoading}>
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pro" className="space-y-6">
          {proIsLocked ? (
            <Card className="border-amber-500/30 bg-amber-500/10">
              <CardContent className="p-5 text-amber-100 inline-flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t('proLocked')}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">ARPU</div><div className="text-2xl font-semibold text-white mt-1">{formatAmount(stats?.pro.arpu || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">ARPPU</div><div className="text-2xl font-semibold text-white mt-1">{formatAmount(stats?.pro.arppu || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('pro.averageCheck')}</div><div className="text-2xl font-semibold text-white mt-1">{formatAmount(stats?.pro.averageCheck || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('pro.conversion')}</div><div className="text-2xl font-semibold text-white mt-1">{formatPercent(stats?.pro.conversionPercent || 0)}</div></CardContent></Card>
            <Card className="border-white/10 bg-zinc-950/40"><CardContent className="p-4"><div className="text-xs text-zinc-400">{t('pro.repeatPayerRate')}</div><div className="text-2xl font-semibold text-white mt-1">{formatPercent(stats?.pro.repeatPayerRatePercent || 0)}</div></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="border-white/10 bg-zinc-950/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">{t('pro.methodSlice')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.methodBreakdown.length ? (
                  stats.methodBreakdown.map((item) => (
                    <div key={item.method} className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{item.method}</span>
                      <span className="text-sm text-zinc-100">{formatNumber(item.count)} · {formatAmount(item.revenue)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-400">{t('empty')}</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-zinc-950/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">{t('pro.statusSlice')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats?.statusBreakdown.length ? (
                  stats.statusBreakdown.map((item) => (
                    <div key={item.status} className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{item.status}</span>
                      <span className="text-sm text-zinc-100">{formatNumber(item.count)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-400">{t('empty')}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('pro.topConversion')}</CardTitle>
            </CardHeader>
            <CardContent>
              {topBotsByConversion.length ? (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-zinc-900/70 text-zinc-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.bot')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('topBots.columns.conversion')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('pro.uniquePayers')}</th>
                        <th className="text-left px-3 py-2 font-medium">{t('kpi.activeSubscribers')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {topBotsByConversion.map((bot) => (
                        <tr key={`conversion-${bot.botId}`} className="hover:bg-white/[0.03]">
                          <td className="px-3 py-2 text-white">{bot.botName}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatPercent(bot.conversionPercent)}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatNumber(bot.uniquePayers)}</td>
                          <td className="px-3 py-2 text-zinc-200">{formatNumber(bot.activeSubscribers)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-zinc-400">{t('empty')}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

          <div className="text-xs text-zinc-500 inline-flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-zinc-600" />
            {t('note')}
          </div>
        </>
      )}
    </div>
  )
}
