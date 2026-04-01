'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Download,
  Lock,
  Minus,
  RefreshCcw,
  Search,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import {
  exportDashboardGlobalAnalyticsCsvAction,
  getDashboardGlobalPaymentsAction,
  getDashboardGlobalStatsAction,
  getDashboardGlobalSubscribersAction,
} from '@/lib/bot-editor/actions/editor-actions'
import type {
  DashboardGlobalPayments,
  DashboardGlobalReportFormat,
  DashboardGlobalRetentionBlock,
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
  const isEnglish = locale === 'en'

  const [period, setPeriod] = useState<DashboardGlobalStatsPeriod>('30d')
  const [botFilter, setBotFilter] = useState('all')
  const [bots, setBots] = useState<BotOption[]>([])

  const [stats, setStats] = useState<DashboardGlobalStats | null>(null)
  const [payments, setPayments] = useState<DashboardGlobalPayments | null>(null)
  const [subscribers, setSubscribers] = useState<DashboardGlobalSubscribers | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [exportingKind, setExportingKind] = useState<string | null>(null)
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

  const handleExport = useCallback(async (
    kind: 'payments' | 'subscribers' | 'lost_revenue_bots' | 'lost_revenue_methods' | 'rankings',
    format: DashboardGlobalReportFormat = 'csv'
  ) => {
    setExportingKind(kind)
    try {
      const result = await exportDashboardGlobalAnalyticsCsvAction(kind, {
        period,
        botId: botFilter !== 'all' ? botFilter : undefined,
        paymentSearch: paymentSearch || undefined,
        paymentMethod,
        paymentStatus,
        subscriberSearch: subscriberSearch || undefined,
        subscriberSource,
      }, format)

      if (!result.success) {
        setError(result.error || t('loadError'))
        return
      }

      if (!('contentBase64' in result) || !result.contentBase64 || !result.filename || !result.mimeType) {
        setError(t('loadError'))
        return
      }

      const successResult = result

      const binary = window.atob(successResult.contentBase64)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }

      const blob = new Blob([bytes], { type: successResult.mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = successResult.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(String(exportError))
    } finally {
      setExportingKind(null)
    }
  }, [
    botFilter,
    paymentMethod,
    paymentSearch,
    paymentStatus,
    period,
    subscriberSearch,
    subscriberSource,
    t,
  ])

  const formatDateTime = useCallback((value: string | null) => {
    if (!value) return '—'
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'
    return new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed))
  }, [isEnglish])

  const formatShortDate = useCallback((value: string | null) => {
    if (!value) return '—'
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'
    return new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(parsed))
  }, [isEnglish])

  const formatTrendLabel = useCallback((value: string) => {
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'

    const options: Intl.DateTimeFormatOptions =
      period === '24h'
        ? { hour: '2-digit', minute: '2-digit' }
        : period === 'all'
          ? { month: 'short', year: '2-digit' }
          : { day: '2-digit', month: 'short' }

    return new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'ru-RU', options).format(new Date(parsed))
  }, [isEnglish, period])

  const formatNumber = useCallback((value: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-US' : 'ru-RU', {
      maximumFractionDigits: 2,
    }).format(value)
  }, [isEnglish])

  const formatPercent = useCallback((value: number) => `${formatNumber(value)}%`, [formatNumber])

  const formatAmount = useCallback((value: number, currency?: string) => {
    const formatted = formatNumber(value)
    return currency ? `${formatted} ${currency}` : formatted
  }, [formatNumber])

  const formatDelta = useCallback((value: number | null) => {
    if (value === null || !Number.isFinite(value)) return '—'
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${formatNumber(value)}%`
  }, [formatNumber])

  const formatCurrencyTotals = useCallback((items: Array<{ currency: string; amount: number }>) => {
    if (!items.length) return '—'
    return items.map((item) => `${item.currency} ${formatAmount(item.amount)}`).join(' · ')
  }, [formatAmount])

  const formatMethodLabel = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase()

    switch (normalized) {
      case 'yookassa':
        return 'YooKassa'
      case 'telegram_stars':
      case 'telegram-stars':
        return 'Telegram Stars'
      case 'crypto_bot':
      case 'crypto-bot':
        return 'Crypto Bot'
      case 'manual':
        return isEnglish ? 'Manual payment' : 'Ручной платеж'
      case 'invoice':
        return isEnglish ? 'Invoice' : 'Инвойс'
      default:
        return value
    }
  }, [isEnglish])

  const formatStatusLabel = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase()

    switch (normalized) {
      case 'pending':
        return isEnglish ? 'Pending' : 'В ожидании'
      case 'succeeded':
      case 'success':
        return isEnglish ? 'Successful' : 'Успешно'
      case 'paid':
        return isEnglish ? 'Paid' : 'Оплачено'
      case 'failed':
        return isEnglish ? 'Failed' : 'Ошибка'
      case 'canceled':
      case 'cancelled':
        return isEnglish ? 'Canceled' : 'Отменено'
      case 'refunded':
        return isEnglish ? 'Refunded' : 'Возврат'
      case 'waiting_for_capture':
        return isEnglish ? 'Waiting for capture' : 'Ожидает подтверждения'
      default:
        return value
    }
  }, [isEnglish])

  const formatSubscriberSourceLabel = useCallback((value: string) => {
    switch (value) {
      case 'message':
        return isEnglish ? 'Messages' : 'Сообщения'
      case 'callback_query':
        return 'Callback'
      case 'unknown':
        return isEnglish ? 'Unknown' : 'Неизвестно'
      default:
        return value
    }
  }, [isEnglish])

  const safePercent = useCallback((value: number, total: number) => {
    if (total <= 0) return 0
    return (value / total) * 100
  }, [])

  const paymentTotalPages = useMemo(() => {
    if (!payments?.total) return 1
    return Math.max(1, Math.ceil(payments.total / payments.pageSize))
  }, [payments])

  const subscribersTotalPages = useMemo(() => {
    if (!subscribers?.total) return 1
    return Math.max(1, Math.ceil(subscribers.total / subscribers.pageSize))
  }, [subscribers])

  const topRevenueMax = useMemo(() => {
    if (!stats?.topBots.length) return 1
    return Math.max(...stats.topBots.map((bot) => bot.revenue), 1)
  }, [stats?.topBots])

  const topBotsByConversion = useMemo(() => {
    return [...(stats?.topBots || [])].sort((left, right) => right.conversionPercent - left.conversionPercent)
  }, [stats?.topBots])

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === botFilter) || null,
    [botFilter, bots]
  )

  const basicIsLocked = stats ? !stats.entitlements.basic : false
  const proIsLocked = stats ? !stats.entitlements.pro : false

  const totalPaymentAttempts = (stats?.basic.successfulPayments || 0) + (stats?.basic.pendingAndFailedPayments || 0)
  const paymentSuccessRate = safePercent(stats?.basic.successfulPayments || 0, totalPaymentAttempts)
  const activeSubscriberRate = safePercent(
    stats?.basic.activeSubscribers || 0,
    Math.max(stats?.basic.totalSubscribers || 0, 1)
  )
  const topRevenueBot = stats?.topBots[0] || null
  const topConversionBot = topBotsByConversion[0] || null
  const paymentSummary = payments?.summary
  const subscriberSummary = subscribers?.summary
  const selectedRankingBot = useMemo(
    () => stats?.rankings.items.find((item) => item.botId === botFilter) || stats?.rankings.items[0] || null,
    [botFilter, stats?.rankings.items]
  )
  const bestGrowthBot = useMemo(
    () => stats?.rankings.items.find((item) => item.botId === stats?.rankings.bestGrowthBotId) || null,
    [stats?.rankings.bestGrowthBotId, stats?.rankings.items]
  )
  const worstDeclineBot = useMemo(
    () => stats?.rankings.items.find((item) => item.botId === stats?.rankings.worstDeclineBotId) || null,
    [stats?.rankings.items, stats?.rankings.worstDeclineBotId]
  )
  const bestConversionRankingBot = useMemo(
    () => stats?.rankings.items.find((item) => item.botId === stats?.rankings.bestConversionBotId) || null,
    [stats?.rankings.bestConversionBotId, stats?.rankings.items]
  )
  const mostProblematicBot = useMemo(
    () => stats?.rankings.items.find((item) => item.botId === stats?.rankings.mostProblematicBotId) || null,
    [stats?.rankings.items, stats?.rankings.mostProblematicBotId]
  )

  const overviewCards = [
    {
      key: 'profit',
      icon: Wallet,
      label: t('kpi.profit'),
      value: formatAmount(stats?.basic.profit || 0),
      tone: 'text-emerald-300',
    },
    {
      key: 'successfulPayments',
      icon: CreditCard,
      label: t('kpi.successfulPayments'),
      value: formatNumber(stats?.basic.successfulPayments || 0),
      tone: 'text-white',
    },
    {
      key: 'activeSubscribers',
      icon: Users,
      label: t('kpi.activeSubscribers'),
      value: formatNumber(stats?.basic.activeSubscribers || 0),
      tone: 'text-white',
    },
    {
      key: 'newSubscribers',
      icon: UserPlus,
      label: t('kpi.newSubscribers'),
      value: formatNumber(stats?.basic.newSubscribers || 0),
      tone: 'text-[#9EDFFF]',
    },
  ]

  const insightRows = [
    {
      key: 'topRevenue',
      title: isEnglish ? 'Highest-revenue bot' : 'Бот с самой большой выручкой',
      value: topRevenueBot?.botName || '—',
      detail: topRevenueBot
        ? `${formatAmount(topRevenueBot.revenue)} · ${formatNumber(topRevenueBot.successfulPayments)}`
        : t('empty'),
    },
    {
      key: 'topConversion',
      title: isEnglish ? 'Highest paid conversion' : 'Бот с самой высокой долей оплат',
      value: topConversionBot?.botName || '—',
      detail: topConversionBot
        ? `${formatPercent(topConversionBot.conversionPercent)} · ${formatNumber(topConversionBot.uniquePayers)}`
        : t('empty'),
    },
    {
      key: 'paymentHealth',
      title: isEnglish ? 'Payment success rate' : 'Успешность оплат',
      value: formatPercent(paymentSuccessRate),
      detail: isEnglish
        ? `${formatNumber(stats?.basic.pendingAndFailedPayments || 0)} pending/failed`
        : `${formatNumber(stats?.basic.pendingAndFailedPayments || 0)} в ожидании / с ошибкой`,
    },
    {
      key: 'audiencePulse',
      title: isEnglish ? 'Audience activity' : 'Активность аудитории',
      value: formatPercent(activeSubscriberRate),
      detail: isEnglish
        ? `${formatNumber(stats?.basic.avgUserActivity || 0)} avg actions per user`
        : `${formatNumber(stats?.basic.avgUserActivity || 0)} средняя активность на пользователя`,
    },
  ]
  const filledTrend = useMemo(() => {
    if (!stats?.trend?.length) return []
    
    const sorted = [...stats.trend].sort((a, b) => new Date(a.bucketStart).getTime() - new Date(b.bucketStart).getTime())
    const msStep = period === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 1 hour or 1 day

    if (sorted.length === 1) {
      return [
        { bucketStart: new Date(new Date(sorted[0].bucketStart).getTime() - msStep).toISOString(), revenue: 0, activity: 0 },
        sorted[0],
        { bucketStart: new Date(new Date(sorted[0].bucketStart).getTime() + msStep).toISOString(), revenue: 0, activity: 0 }
      ]
    }

    const result = []
    
    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i])
      
      if (i < sorted.length - 1) {
        const nextMs = new Date(sorted[i + 1].bucketStart).getTime()
        let cursor = new Date(sorted[i].bucketStart).getTime() + msStep
        let iters = 0

        while (cursor < nextMs && iters < 1000) {
          if (nextMs - cursor > msStep * 0.1) {
            result.push({
              bucketStart: new Date(cursor).toISOString(),
              revenue: 0,
              activity: 0
            })
          }
          cursor += msStep
          iters++
        }
      }
    }
    
    return result
  }, [stats?.trend, period])


  const comparisonCards = useMemo(() => {
    if (!stats) return []

    return [
      {
        key: 'revenue',
        label: isEnglish ? 'Revenue vs previous period' : 'Выручка к прошлому периоду',
        value: stats.comparison.revenue.available ? formatAmount(stats.comparison.revenue.current) : '—',
        previous: stats.comparison.revenue.available ? formatAmount(stats.comparison.revenue.previous) : '—',
        delta: formatDelta(stats.comparison.revenue.deltaPercent),
        available: stats.comparison.revenue.available,
      },
      {
        key: 'payments',
        label: isEnglish ? 'Successful payments vs previous period' : 'Успешные оплаты к прошлому периоду',
        value: formatNumber(stats.comparison.successfulPayments.current),
        previous: formatNumber(stats.comparison.successfulPayments.previous),
        delta: formatDelta(stats.comparison.successfulPayments.deltaPercent),
        available: stats.comparison.successfulPayments.available,
      },
      {
        key: 'activeSubscribers',
        label: isEnglish ? 'Active users vs previous period' : 'Активные пользователи к прошлому периоду',
        value: formatNumber(stats.comparison.activeSubscribers.current),
        previous: formatNumber(stats.comparison.activeSubscribers.previous),
        delta: formatDelta(stats.comparison.activeSubscribers.deltaPercent),
        available: stats.comparison.activeSubscribers.available,
      },
      {
        key: 'conversion',
        label: isEnglish ? 'Paid share vs previous period' : 'Доля оплат к прошлому периоду',
        value: formatPercent(stats.comparison.conversionPercent.current),
        previous: formatPercent(stats.comparison.conversionPercent.previous),
        delta: formatDelta(stats.comparison.conversionPercent.deltaPercent),
        available: stats.comparison.conversionPercent.available,
      },
    ]
  }, [formatAmount, formatDelta, formatNumber, formatPercent, isEnglish, stats])

  const funnelSteps = useMemo(() => {
    if (!stats) return []

    return [
      {
        key: 'firstContact',
        label: isEnglish ? 'Users who have written to bots' : 'Пользователи, которые писали ботам',
        value: formatNumber(stats.funnel.firstContactUsers),
      },
      {
        key: 'active',
        label: isEnglish ? 'Active in current period' : 'Активные в текущем периоде',
        value: formatNumber(stats.funnel.activeUsers),
      },
      {
        key: 'paid',
        label: isEnglish ? 'Paid in current period' : 'Оплатили в текущем периоде',
        value: formatNumber(stats.funnel.paidUsers),
      },
      {
        key: 'repeat',
        label: isEnglish ? 'Came back and paid again' : 'Вернулись и оплатили снова',
        value: formatNumber(stats.funnel.repeatPayers),
      },
    ]
  }, [formatNumber, isEnglish, stats])

  const repeatCards = useMemo(() => {
    if (!stats) return []

    return [
      {
        key: 'repeatRevenue',
        label: isEnglish ? 'Revenue from repeat payers' : 'Выручка от повторных плательщиков',
        value:
          stats.repeat.repeatRevenueAmount !== null
            ? formatAmount(stats.repeat.repeatRevenueAmount)
            : formatCurrencyTotals(stats.repeat.repeatRevenueCurrencyTotals),
      },
      {
        key: 'repeatShare',
        label: isEnglish ? 'Share of repeat revenue' : 'Доля повторной выручки',
        value:
          stats.repeat.repeatRevenueSharePercent !== null
            ? formatPercent(stats.repeat.repeatRevenueSharePercent)
            : '—',
      },
      {
        key: 'returnedPayers',
        label: isEnglish ? 'Users who came back and paid again' : 'Пользователи, которые вернулись и оплатили снова',
        value: formatNumber(stats.repeat.returnedPayers),
      },
      {
        key: 'medianDays',
        label: isEnglish ? 'Median days to second payment' : 'Медиана дней до второй оплаты',
        value:
          stats.repeat.medianDaysToSecondPayment !== null
            ? formatNumber(stats.repeat.medianDaysToSecondPayment)
            : '—',
      },
    ]
  }, [formatAmount, formatCurrencyTotals, formatNumber, formatPercent, isEnglish, stats])

  const anomalyRows = useMemo(() => {
    if (!stats?.anomalies.length) return []

    return stats.anomalies.map((item) => {
      switch (item.key) {
        case 'revenue_drop':
          return {
            key: item.key,
            title: isEnglish ? 'Revenue dropped' : 'Выручка просела',
            detail: isEnglish
              ? `${formatDelta(item.deltaPercent)} vs previous period`
              : `${formatDelta(item.deltaPercent)} к прошлому периоду`,
            severity: item.severity,
          }
        case 'conversion_drop':
          return {
            key: item.key,
            title: isEnglish ? 'Paid share dropped' : 'Доля оплат просела',
            detail: isEnglish
              ? `${formatDelta(item.deltaPercent)} vs previous period`
              : `${formatDelta(item.deltaPercent)} к прошлому периоду`,
            severity: item.severity,
          }
        case 'payment_issues_growth':
          return {
            key: item.key,
            title: isEnglish ? 'Problem payments grew' : 'Проблемных оплат стало больше',
            detail: isEnglish
              ? `${formatDelta(item.deltaPercent)} vs previous period`
              : `${formatDelta(item.deltaPercent)} к прошлому периоду`,
            severity: item.severity,
          }
        case 'active_audience_drop':
          return {
            key: item.key,
            title: isEnglish ? 'Active users decreased' : 'Активных пользователей стало меньше',
            detail: isEnglish
              ? `${formatDelta(item.deltaPercent)} vs previous period`
              : `${formatDelta(item.deltaPercent)} к прошлому периоду`,
            severity: item.severity,
          }
        case 'new_audience_drop':
          return {
            key: item.key,
            title: isEnglish ? 'New users decreased' : 'Новых пользователей стало меньше',
            detail: isEnglish
              ? `${formatDelta(item.deltaPercent)} vs previous period`
              : `${formatDelta(item.deltaPercent)} к прошлому периоду`,
            severity: item.severity,
          }
        default:
          return {
            key: item.key,
            title: isEnglish ? 'Needs attention' : 'Требует внимания',
            detail: formatDelta(item.deltaPercent),
            severity: item.severity,
          }
      }
    })
  }, [formatDelta, isEnglish, stats?.anomalies])

  const retentionBlocks = useMemo(() => {
    if (!stats) return []

    return [
      {
        key: 'activity',
        title: isEnglish ? 'Do users come back' : 'Возвращаются ли пользователи',
        description: isEnglish
          ? 'Shows how many users from the current cohort come back and interact again.'
          : 'Показывает, сколько пользователей из текущих когорт возвращаются и снова взаимодействуют с ботами.',
        data: stats.retention.activity,
      },
      {
        key: 'payment',
        title: isEnglish ? 'Do they come back to pay again' : 'Возвращаются ли к оплате',
        description: isEnglish
          ? 'Shows how many users from the current cohort return to a second successful payment.'
          : 'Показывает, сколько пользователей из текущих когорт возвращаются ко второй успешной оплате.',
        data: stats.retention.payment,
      },
    ] satisfies Array<{
      key: string
      title: string
      description: string
      data: DashboardGlobalRetentionBlock
    }>
  }, [isEnglish, stats])

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="mt-1 text-zinc-400">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onValueChange={(value) => setPeriod(value as DashboardGlobalStatsPeriod)}>
            <SelectTrigger className="w-[140px] border-white/10 bg-zinc-900/60 text-white">
              <SelectValue placeholder={t('filters.period')} />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{t(`period.${option}` as never)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={botFilter} onValueChange={setBotFilter}>
            <SelectTrigger className="w-[180px] border-white/10 bg-zinc-900/60 text-white">
              <SelectValue placeholder={t('filters.bot')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allBots')}</SelectItem>
              {bots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>{bot.name || bot.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="border-white/10 text-zinc-300" onClick={() => void loadAll()} disabled={isLoading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>
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
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10"><Lock className="h-5 w-5 text-amber-300" /></div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">{isEnglish ? 'Dashboard analytics require Business' : 'Dashboard-аналитика доступна с Business'}</h2>
                  <p className="max-w-2xl text-sm leading-6 text-zinc-300">{isEnglish ? 'Your current plan keeps editor technical statistics available, but account-wide analytics, payments, and subscriber views are unlocked starting from Business.' : 'На текущем тарифе у вас остается техническая статистика внутри редактора, а общая аналитика по аккаунту, платежам и подписчикам открывается начиная с Business.'}</p>
                </div>
              </div>
              <Button asChild className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white"><Link href={`/${locale}/dashboard/subscription`}>{isEnglish ? 'Open subscription' : 'Открыть подписку'}</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
            <BarChart3 className="h-4 w-4 text-[#9EDFFF]" />
            <span>
              {selectedBot ? (isEnglish ? `Bot: ${selectedBot.name || selectedBot.id}` : `Бот: ${selectedBot.name || selectedBot.id}`) : (isEnglish ? 'Across all bots in the account' : 'По всем ботам аккаунта')}
            </span>
            <span className="mx-2 text-zinc-600">|</span>
            <span>
              {stats?.currencyMode === 'mixed' ? t('currency.mixed') : stats?.currencyMode === 'single' ? t('currency.single', { currency: stats.currencies[0] || '' }) : t('currency.none')}
            </span>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-white/10 bg-zinc-900/40 backdrop-blur-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-zinc-400">{isEnglish ? 'Total Revenue' : 'Общая выручка'}</div>
                  <Wallet className="h-4 w-4 text-zinc-500" />
                </div>
                <div className="mt-3 text-3xl font-semibold text-white">{formatAmount(stats?.basic.revenue || 0)}</div>
                <div className="mt-1 flex items-center gap-2">
                  {stats?.comparison.revenue.available ? (
                    <div className={`flex items-center gap-1 text-xs font-medium ${(stats.comparison.revenue.deltaPercent ?? 0) > 0 ? 'text-emerald-400' : (stats.comparison.revenue.deltaPercent ?? 0) < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                      {(stats.comparison.revenue.deltaPercent ?? 0) > 0 ? <ArrowUpRight className="h-3 w-3" /> : (stats.comparison.revenue.deltaPercent ?? 0) < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {formatDelta(stats.comparison.revenue.deltaPercent ?? null)}
                    </div>
                  ) : null}
                  <div className="text-xs text-zinc-500">{t(`period.${period}` as never)}</div>
                </div>
              </CardContent>
            </Card>

            {overviewCards.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.key} className="border-white/10 bg-zinc-900/40 backdrop-blur-md">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-400">{item.label}</div>
                      <Icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          {anomalyRows.length > 0 && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {anomalyRows.slice(0, 4).map((item) => (
                <div key={item.key} className={`flex items-start gap-3 rounded-2xl border p-4 ${item.severity === 'critical' ? 'border-red-500/20 bg-red-500/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                  <Activity className={`mt-0.5 h-4 w-4 shrink-0 ${item.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                  <div>
                    <div className={`text-sm font-medium ${item.severity === 'critical' ? 'text-red-200' : 'text-amber-200'}`}>{item.title}</div>
                    <div className={`mt-1 text-xs ${item.severity === 'critical' ? 'text-red-200/70' : 'text-amber-200/70'}`}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">

            <Card className="min-w-0 border-white/10 bg-zinc-950/50 backdrop-blur-md">
              <CardHeader className="pb-3 border-b border-white/5">
                <CardTitle className="text-base font-semibold text-white">{t('trend.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {filledTrend.length ? (
                  <>
                    <div className="h-72 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filledTrend}
                          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#24A1DE" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#24A1DE" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="bucketStart"
                            tickFormatter={formatTrendLabel}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={30}
                            tick={{ fontSize: 10, fill: '#71717a', textAnchor: 'middle', letterSpacing: '0.14em' }}
                            dy={10}
                          />
                          <YAxis yAxisId="left" hide domain={[0, 'dataMax']} />
                          <YAxis yAxisId="right" orientation="right" hide domain={[0, 'dataMax']} />
                          <Tooltip
                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="rounded-xl border border-white/10 bg-zinc-950/90 p-3 shadow-xl backdrop-blur-md">
                                    <p className="mb-2 text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{formatTrendLabel(label as string)}</p>
                                    <div className="flex flex-col gap-2">
                                      {payload.map((entry: { name?: string; color?: string; value?: number | string }) => (
                                        <div key={entry.name} className="flex items-center justify-between gap-6 text-sm">
                                          <span className="flex items-center gap-2 text-zinc-300">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                            {entry.name === 'revenue' ? t('trend.revenue') : t('trend.activity')}
                                          </span>
                                          <span className="font-semibold text-white">
                                            {entry.name === 'revenue' ? formatAmount(entry.value as number) : formatNumber(entry.value as number)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#24A1DE"
                            fill="url(#colorRevenue)"
                            strokeWidth={3}
                            activeDot={{ r: 6, fill: '#24A1DE', stroke: '#18181b', strokeWidth: 2 }}
                          />
                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="activity"
                            stroke="#8B5CF6"
                            fill="url(#colorActivity)"
                            strokeWidth={3}
                            activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#18181b', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 justify-center">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#24A1DE]" />
                        {t('trend.revenue')}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" />
                        {t('trend.activity')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-zinc-400 py-10 text-center">{t('empty')}</div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="min-w-0 border-white/10 bg-zinc-950/50 flex-1">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-base font-semibold text-white">
                    {isEnglish ? 'Revenue leaders' : 'Лидеры по выручке'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  {stats?.topBots.length ? (
                    <div className="space-y-4">
                      {stats.topBots.slice(0, 5).map((bot, index) => (
                        <div key={bot.botId} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-xs font-medium text-zinc-400">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <div className="truncate text-sm font-medium text-white">{bot.botName}</div>
                              <div className="text-sm font-semibold text-white">{formatAmount(bot.revenue)}</div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div className="text-xs text-zinc-500">{formatNumber(bot.successfulPayments)} {isEnglish ? 'payments' : 'оплат'}</div>
                              <div className="text-xs text-emerald-400">{formatPercent(bot.conversionPercent)}</div>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6]"
                                style={{ width: `${Math.max(6, Math.round((bot.revenue / topRevenueMax) * 100))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-400 py-4 text-center">{t('empty')}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 border-white/10 bg-zinc-950/50">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-[#9EDFFF]" />
                    {isEnglish ? 'Insights' : 'Инсайты'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 grid grid-cols-2 gap-3">
                   {insightRows.slice(0, 4).map((item) => (
                    <div key={item.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                      <div className="text-xs text-zinc-500 mb-1">{item.title}</div>
                      <div className="font-semibold text-white truncate">{item.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {isEnglish ? 'Operational detail' : 'Операционный слой'}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {isEnglish
                        ? 'Detailed payment and subscriber data for manual review, filtering, and support work.'
                      : 'Детальные платежи и подписчики для ручной проверки, фильтрации и оперативной работы.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => void handleExport('payments', 'csv')}
                      disabled={exportingKind !== null}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      {isEnglish ? 'CSV payments' : 'CSV платежей'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => void handleExport('subscribers', 'csv')}
                      disabled={exportingKind !== null}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      {isEnglish ? 'CSV subscribers' : 'CSV подписчиков'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => void handleExport('payments', 'xlsx')}
                      disabled={exportingKind !== null}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      {isEnglish ? 'XLSX full report' : 'XLSX полный отчет'}
                    </Button>
                    {payments?.summary.currencyTotals.length ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                        <Wallet className="h-3.5 w-3.5 text-zinc-500" />
                        {payments.summary.currencyTotals.map((entry) => `${entry.currency}: ${formatAmount(entry.amount)}`).join(' · ')}
                      </span>
                    ) : null}
                    {subscriberSummary ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                        {t('subscribers.summary', {
                          total: subscriberSummary.totalSubscribers || 0,
                          active: subscriberSummary.activeInPeriod || 0,
                          newValue: subscriberSummary.newInPeriod || 0,
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>

                <Card className="border-white/10 bg-zinc-950/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">{t('payments.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2 relative" suppressHydrationWarning>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={paymentSearchInput}
                      onChange={(event) => setPaymentSearchInput(event.target.value)}
                      placeholder={t('payments.searchPlaceholder')}
                      autoComplete="off"
                      data-lpignore="true"
                      data-form-type="other"
                      className="border-white/10 bg-zinc-900/60 pl-9 text-white"
                    />
                  </div>

                  <Select value={paymentMethod} onValueChange={(value) => {
                    setPaymentMethod(value)
                    setPaymentPage(1)
                  }}>
                    <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                      <SelectValue placeholder={t('payments.method')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('payments.allMethods')}</SelectItem>
                      {(payments?.methods || []).map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={paymentStatus} onValueChange={(value) => {
                    setPaymentStatus(value)
                    setPaymentPage(1)
                  }}>
                    <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                      <SelectValue placeholder={t('payments.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('payments.allStatuses')}</SelectItem>
                      {(payments?.statuses || []).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{isEnglish ? 'Total' : 'Всего'}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatNumber(paymentSummary?.totalCount || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.revenue')}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatAmount(paymentSummary?.totalAmount || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.successfulPayments')}</div>
                    <div className="mt-2 text-xl font-semibold text-emerald-300">{formatNumber(paymentSummary?.successCount || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.pendingFailed')}</div>
                    <div className="mt-2 text-xl font-semibold text-amber-200">
                      {formatNumber((paymentSummary?.pendingCount || 0) + (paymentSummary?.failedCount || 0))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead className="bg-zinc-900/70 text-zinc-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.bot')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.payer')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.id')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.amount')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.method')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.status')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('payments.columns.time')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {payments?.items.length ? (
                        payments.items.map((item) => (
                          <tr key={`${item.id}-${item.botId}`} className="hover:bg-white/[0.03]">
                            <td className="px-3 py-2 text-white">{item.botName}</td>
                            <td className="px-3 py-2 text-zinc-200">
                              {item.payerName || (item.payerUsername ? `@${item.payerUsername}` : item.payerId || '—')}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-zinc-300">{item.paymentId || item.id}</td>
                            <td className="px-3 py-2 text-zinc-200">
                              {item.amount !== null ? formatAmount(item.amount, item.currency) : '—'}
                            </td>
                            <td className="px-3 py-2 text-zinc-200">{formatMethodLabel(item.method)}</td>
                            <td className="px-3 py-2 text-zinc-200">{formatStatusLabel(item.status)}</td>
                            <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.createdAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
                            {t('payments.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    {t('pagination.pageOf', {
                      page: payments?.page || paymentPage,
                      totalPages: paymentTotalPages,
                      total: payments?.total || 0,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => setPaymentPage((prev) => Math.max(1, prev - 1))}
                      disabled={(payments?.page || paymentPage) <= 1 || isLoading}
                    >
                      {t('pagination.prev')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => setPaymentPage((prev) => Math.min(paymentTotalPages, prev + 1))}
                      disabled={(payments?.page || paymentPage) >= paymentTotalPages || isLoading}
                    >
                      {t('pagination.next')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-zinc-950/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">{t('subscribers.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="xl:col-span-2 relative" suppressHydrationWarning>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      value={subscriberSearchInput}
                      onChange={(event) => setSubscriberSearchInput(event.target.value)}
                      placeholder={t('subscribers.searchPlaceholder')}
                      autoComplete="off"
                      data-lpignore="true"
                      data-form-type="other"
                      className="border-white/10 bg-zinc-900/60 pl-9 text-white"
                    />
                  </div>

                  <Select value={subscriberSource} onValueChange={(value) => {
                    setSubscriberSource(value as typeof subscriberSource)
                    setSubscriberPage(1)
                  }}>
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

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
                    {t('subscribers.summary', {
                      total: subscribers?.summary.totalSubscribers || 0,
                      active: subscribers?.summary.activeInPeriod || 0,
                      newValue: subscribers?.summary.newInPeriod || 0,
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.totalSubscribers')}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatNumber(subscriberSummary?.totalSubscribers || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.activeSubscribers')}</div>
                    <div className="mt-2 text-xl font-semibold text-white">{formatNumber(subscriberSummary?.activeInPeriod || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{t('kpi.newSubscribers')}</div>
                    <div className="mt-2 text-xl font-semibold text-[#9EDFFF]">{formatNumber(subscriberSummary?.newInPeriod || 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      {isEnglish ? 'Last activity' : 'Последняя активность'}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">{formatDateTime(subscriberSummary?.lastSeenAt || null)}</div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-zinc-900/70 text-zinc-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.bot')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.user')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.userId')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.language')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.source')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.firstSeen')}</th>
                        <th className="px-3 py-2 text-left font-medium">{t('subscribers.columns.lastSeen')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {subscribers?.items.length ? (
                        subscribers.items.map((item) => (
                          <tr
                            key={`${item.botId}-${item.telegramUserId}-${item.lastSeenAt || item.firstSeenAt || 'row'}`}
                            className="hover:bg-white/[0.03]"
                          >
                            <td className="px-3 py-2 text-white">{item.botName}</td>
                            <td className="px-3 py-2 text-zinc-200">{resolveSubscriberDisplayName(item)}</td>
                            <td className="px-3 py-2 text-zinc-200">{item.telegramUserId || '—'}</td>
                            <td className="px-3 py-2 uppercase text-zinc-200">{item.languageCode || '—'}</td>
                            <td className="px-3 py-2 text-zinc-200">{formatSubscriberSourceLabel(item.source)}</td>
                            <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.firstSeenAt)}</td>
                            <td className="px-3 py-2 text-zinc-100">{formatDateTime(item.lastSeenAt)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-6 text-center text-zinc-500" colSpan={7}>
                            {t('subscribers.empty')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    {t('pagination.pageOf', {
                      page: subscribers?.page || subscriberPage,
                      totalPages: subscribersTotalPages,
                      total: subscribers?.total || 0,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => setSubscriberPage((prev) => Math.max(1, prev - 1))}
                      disabled={(subscribers?.page || subscriberPage) <= 1 || isLoading}
                    >
                      {t('pagination.prev')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-zinc-300"
                      onClick={() => setSubscriberPage((prev) => Math.min(subscribersTotalPages, prev + 1))}
                      disabled={(subscribers?.page || subscriberPage) >= subscribersTotalPages || isLoading}
                    >
                      {t('pagination.next')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#D9C4FF]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {isEnglish ? 'Professional analytics' : 'Профессиональная аналитика'}
                </div>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  {isEnglish ? 'Advanced payment analytics' : 'Расширенная аналитика по оплатам'}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {isEnglish
                    ? 'Shows payment efficiency, repeat purchases, average checks, and which bots monetize best.'
                    : 'Показывает, насколько хорошо проходят оплаты, как часто платят повторно, какой средний чек и какие боты зарабатывают лучше всего.'}
                </p>
              </div>
            </div>

            {proIsLocked ? (
              <Card className="border-amber-500/30 bg-amber-500/10">
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
                      <Lock className="h-4 w-4 text-amber-200" />
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {isEnglish ? 'Unlock professional analytics' : 'Откройте профессиональную аналитику'}
                    </div>
                    <div className="max-w-2xl text-sm leading-6 text-amber-100/90">
                      {isEnglish
                        ? 'ARPU, ARPPU, average check, repeat payer share, payment method mix, status quality, and conversion leaders are kept in the premium layer.'
                        : 'ARPU, ARPPU, средний чек, доля повторных плательщиков, срез по методам и статусам оплат, а также лидеры по конверсии остаются в premium-слое.'}
                    </div>
                  </div>

                  <Button asChild className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white">
                    <Link href={`/${locale}/dashboard/subscription`}>
                      {isEnglish ? 'Upgrade plan' : 'Открыть подписку'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300"
                    onClick={() => void handleExport('rankings', 'csv')}
                    disabled={exportingKind !== null}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {isEnglish ? 'CSV bot rankings' : 'CSV рейтинга ботов'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300"
                    onClick={() => void handleExport('lost_revenue_bots', 'csv')}
                    disabled={exportingKind !== null}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {isEnglish ? 'CSV lost revenue by bot' : 'CSV потерь по ботам'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300"
                    onClick={() => void handleExport('lost_revenue_methods', 'csv')}
                    disabled={exportingKind !== null}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {isEnglish ? 'CSV lost revenue by method' : 'CSV потерь по методам'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300"
                    onClick={() => void handleExport('rankings', 'xlsx')}
                    disabled={exportingKind !== null}
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    {isEnglish ? 'XLSX enterprise report' : 'XLSX enterprise-отчет'}
                  </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="border-white/10 bg-zinc-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'What changed vs previous period' : 'Что изменилось к прошлому периоду'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {stats?.comparison.available ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {comparisonCards.map((item) => {
                            const DeltaIcon =
                              item.delta.startsWith('+') ? ArrowUpRight : item.delta.startsWith('-') ? ArrowDownRight : Minus

                            return (
                              <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="text-sm text-zinc-300">{item.label}</div>
                                <div className="mt-3 flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-2xl font-semibold text-white">{item.value}</div>
                                    <div className="mt-1 text-sm text-zinc-500">
                                      {isEnglish ? 'Previous:' : 'Было:'} {item.previous}
                                    </div>
                                  </div>
                                  <div
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                      item.delta.startsWith('+')
                                        ? 'bg-emerald-400/15 text-emerald-200'
                                        : item.delta.startsWith('-')
                                          ? 'bg-red-500/15 text-red-200'
                                          : 'bg-white/10 text-zinc-300'
                                    }`}
                                  >
                                    <DeltaIcon className="h-3.5 w-3.5" />
                                    {item.available ? item.delta : '—'}
                                  </div>
                                </div>
                                {!item.available ? (
                                  <div className="mt-3 text-xs text-zinc-500">
                                    {period === 'all'
                                      ? (isEnglish ? 'Not shown for all-time range.' : 'Не показывается для периода за всё время.')
                                      : (isEnglish ? 'Unavailable for mixed currencies.' : 'Недоступно при смешанных валютах.')}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                          {isEnglish
                            ? 'Comparison with the previous period is not shown for the all-time range.'
                            : 'Сравнение с прошлым периодом не показывается для диапазона за всё время.'}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-zinc-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'Monetization funnel' : 'Воронка монетизации'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      {funnelSteps.map((item, index) => (
                        <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                            {index + 1}
                          </div>
                          <div className="mt-3 text-sm text-zinc-300">{item.label}</div>
                          <div className="mt-4 text-3xl font-semibold text-white">{item.value}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <Card className="border-white/10 bg-zinc-950/50 xl:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'Retention and return to payment' : 'Удержание и возврат к оплате'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 xl:grid-cols-2">
                      {retentionBlocks.map((block) => (
                        <div key={block.key} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="space-y-1">
                            <div className="text-lg font-semibold text-white">{block.title}</div>
                            <div className="text-sm text-zinc-400">{block.description}</div>
                          </div>

                          {block.data.available ? (
                            <div className="mt-4 space-y-4">
                              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                {(['d1', 'd3', 'd7', 'd30'] as const).map((windowKey) => (
                                  <div key={windowKey} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                                      {isEnglish ? `Day ${windowKey.replace('d', '')}` : `День ${windowKey.replace('d', '')}`}
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold text-white">
                                      {formatPercent(block.data.summary[windowKey].retentionPercent)}
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                      {formatNumber(block.data.summary[windowKey].retainedUsers)} / {formatNumber(block.data.summary[windowKey].cohortUsers)}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="overflow-x-auto rounded-2xl border border-white/10">
                                <table className="w-full min-w-[680px] text-sm">
                                  <thead className="bg-zinc-900/70 text-zinc-400">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-medium">
                                        {isEnglish ? 'Cohort' : 'Когорта'}
                                      </th>
                                      <th className="px-3 py-2 text-left font-medium">
                                        {isEnglish ? 'Users' : 'Пользователи'}
                                      </th>
                                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{isEnglish ? 'Day 1' : 'День 1'}</th>
                                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{isEnglish ? 'Day 3' : 'День 3'}</th>
                                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{isEnglish ? 'Day 7' : 'День 7'}</th>
                                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{isEnglish ? 'Day 30' : 'День 30'}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {block.data.cohorts.map((cohort) => (
                                      <tr key={`${block.key}-${cohort.cohortStart}`} className="hover:bg-white/[0.03]">
                                        <td className="px-3 py-2 text-zinc-200">
                                          {formatShortDate(cohort.cohortStart)}
                                          {' — '}
                                          {formatShortDate(cohort.cohortEnd)}
                                        </td>
                                        <td className="px-3 py-2 text-white">
                                          {formatNumber(cohort.cohortUsers)}
                                        </td>
                                        <td className="px-3 py-2 text-zinc-200">{formatPercent(cohort.windows.d1.retentionPercent)}</td>
                                        <td className="px-3 py-2 text-zinc-200">{formatPercent(cohort.windows.d3.retentionPercent)}</td>
                                        <td className="px-3 py-2 text-zinc-200">{formatPercent(cohort.windows.d7.retentionPercent)}</td>
                                        <td className="px-3 py-2 text-zinc-200">{formatPercent(cohort.windows.d30.retentionPercent)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {block.data.recentOnly ? (
                                <div className="text-xs text-zinc-500">
                                  {isEnglish
                                    ? 'For all-time range, the view shows the last 8 completed weekly cohorts.'
                                    : 'Для периода за всё время показываются последние 8 завершенных недельных когорт.'}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                              {isEnglish
                                ? 'There is not enough cohort data for the selected filters yet.'
                                : 'Пока недостаточно данных по когортам для выбранных фильтров.'}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-zinc-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'Where money is getting stuck' : 'Где теряются деньги'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                          <div className="text-sm text-amber-100">{isEnglish ? 'Pending payments' : 'Платежи в ожидании'}</div>
                          <div className="mt-2 text-2xl font-semibold text-white">
                            {formatNumber(stats?.lostRevenue.pending.count || 0)}
                          </div>
                          <div className="mt-2 text-sm text-amber-100/80">
                            {stats?.currencyMode === 'mixed'
                              ? formatCurrencyTotals(stats?.lostRevenue.pending.currencyTotals || [])
                              : formatAmount(stats?.lostRevenue.pending.totalAmount || 0)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                          <div className="text-sm text-red-100">{isEnglish ? 'Failed payments' : 'Ошибочные платежи'}</div>
                          <div className="mt-2 text-2xl font-semibold text-white">
                            {formatNumber(stats?.lostRevenue.failed.count || 0)}
                          </div>
                          <div className="mt-2 text-sm text-red-100/80">
                            {stats?.currencyMode === 'mixed'
                              ? formatCurrencyTotals(stats?.lostRevenue.failed.currencyTotals || [])
                              : formatAmount(stats?.lostRevenue.failed.totalAmount || 0)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div className="text-sm font-medium text-zinc-300">
                            {isEnglish ? 'By bot' : 'По ботам'}
                          </div>
                          {(stats?.lostRevenue.byBot || []).slice(0, 4).map((item) => (
                            <div key={item.botId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-white">{item.botName}</div>
                              <div className="mt-2 text-sm text-zinc-400">
                                {isEnglish ? 'Pending:' : 'В ожидании:'} {formatNumber(item.pending.count)} ·{' '}
                                {stats?.currencyMode === 'mixed'
                                  ? formatCurrencyTotals(item.pending.currencyTotals)
                                  : formatAmount(item.pending.totalAmount)}
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">
                                {isEnglish ? 'Failed:' : 'Ошибки:'} {formatNumber(item.failed.count)} ·{' '}
                                {stats?.currencyMode === 'mixed'
                                  ? formatCurrencyTotals(item.failed.currencyTotals)
                                  : formatAmount(item.failed.totalAmount)}
                              </div>
                            </div>
                          ))}
                          {!stats?.lostRevenue.byBot.length ? (
                            <div className="text-sm text-zinc-400">{t('empty')}</div>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="text-sm font-medium text-zinc-300">
                            {isEnglish ? 'By payment method' : 'По способам оплаты'}
                          </div>
                          {(stats?.lostRevenue.byMethod || []).slice(0, 4).map((item) => (
                            <div key={item.method} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-white">{formatMethodLabel(item.method)}</div>
                              <div className="mt-2 text-sm text-zinc-400">
                                {isEnglish ? 'Pending:' : 'В ожидании:'} {formatNumber(item.pending.count)} ·{' '}
                                {stats?.currencyMode === 'mixed'
                                  ? formatCurrencyTotals(item.pending.currencyTotals)
                                  : formatAmount(item.pending.totalAmount)}
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">
                                {isEnglish ? 'Failed:' : 'Ошибки:'} {formatNumber(item.failed.count)} ·{' '}
                                {stats?.currencyMode === 'mixed'
                                  ? formatCurrencyTotals(item.failed.currencyTotals)
                                  : formatAmount(item.failed.totalAmount)}
                              </div>
                            </div>
                          ))}
                          {!stats?.lostRevenue.byMethod.length ? (
                            <div className="text-sm text-zinc-400">{t('empty')}</div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-zinc-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'Repeat purchases and return rate' : 'Повторные оплаты и возвратность'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {repeatCards.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm text-zinc-300">{item.label}</div>
                          <div className="mt-3 text-2xl font-semibold text-white">{item.value}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {botFilter !== 'all' ? (
                  <Card className="border-white/10 bg-zinc-950/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white">
                        {isEnglish ? 'Selected bot diagnostics' : 'Диагностика выбранного бота'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm text-zinc-300">{isEnglish ? 'Revenue change' : 'Изменение выручки'}</div>
                        <div className="mt-3 text-2xl font-semibold text-white">
                          {formatDelta(selectedRankingBot?.revenueDeltaPercent ?? null)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm text-zinc-300">{isEnglish ? 'Paid share' : 'Доля оплат'}</div>
                        <div className="mt-3 text-2xl font-semibold text-white">
                          {formatPercent(selectedRankingBot?.conversionPercent || 0)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm text-zinc-300">{isEnglish ? 'Pending / failed' : 'В ожидании / с ошибкой'}</div>
                        <div className="mt-3 text-2xl font-semibold text-white">
                          {formatNumber((selectedRankingBot?.pendingCount || 0) + (selectedRankingBot?.failedCount || 0))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm text-zinc-300">{isEnglish ? 'Returned payers' : 'Вернувшиеся плательщики'}</div>
                        <div className="mt-3 text-2xl font-semibold text-white">{formatNumber(stats?.repeat.returnedPayers || 0)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="border-white/10 bg-zinc-950/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white">
                          {isEnglish ? 'Strong bots right now' : 'Сильные боты сейчас'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm text-zinc-300">{isEnglish ? 'Best revenue growth' : 'Лучший рост выручки'}</div>
                          <div className="mt-3 text-lg font-semibold text-white">{bestGrowthBot?.botName || '—'}</div>
                          <div className="mt-1 text-sm text-zinc-400">{formatDelta(bestGrowthBot?.revenueDeltaPercent ?? null)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm text-zinc-300">{isEnglish ? 'Best paid share' : 'Лучшая доля оплат'}</div>
                          <div className="mt-3 text-lg font-semibold text-white">{bestConversionRankingBot?.botName || '—'}</div>
                          <div className="mt-1 text-sm text-zinc-400">
                            {bestConversionRankingBot ? formatPercent(bestConversionRankingBot.conversionPercent) : '—'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-zinc-950/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white">
                          {isEnglish ? 'Weak spots right now' : 'Слабые места сейчас'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm text-zinc-300">{isEnglish ? 'Worst revenue drop' : 'Худшее падение выручки'}</div>
                          <div className="mt-3 text-lg font-semibold text-white">{worstDeclineBot?.botName || '—'}</div>
                          <div className="mt-1 text-sm text-zinc-400">{formatDelta(worstDeclineBot?.revenueDeltaPercent ?? null)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="text-sm text-zinc-300">{isEnglish ? 'Most problematic bot' : 'Самый проблемный бот'}</div>
                          <div className="mt-3 text-lg font-semibold text-white">{mostProblematicBot?.botName || '—'}</div>
                          <div className="mt-1 text-sm text-zinc-400">
                            {mostProblematicBot
                              ? `${formatNumber(mostProblematicBot.pendingCount + mostProblematicBot.failedCount)} ${isEnglish ? 'problem payments' : 'проблемных оплат'}`
                              : '—'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <BarChart3 className="h-3.5 w-3.5 text-zinc-600" />
            {t('note')}
          </div>
        </div>
      )}
    </div>
  )
}
