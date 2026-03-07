'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe2, RefreshCcw, Search, UserPlus, Users } from 'lucide-react'
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
import type {
  BotSubscriberItem,
  BotSubscribersAnalytics,
  BotSubscribersPeriod,
  BotSubscribersSource,
} from '@/lib/bot-editor/types/analytics.types'

const PERIOD_OPTIONS: BotSubscribersPeriod[] = ['24h', '7d', '30d', 'all']

function resolveSubscriberName(item: BotSubscriberItem): string {
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (item.username) return `@${item.username}`
  if (Number.isFinite(item.telegramUserId) && item.telegramUserId > 0) return String(item.telegramUserId)
  return '—'
}

export function SubscribersStatsPanel() {
  const t = useTranslations('editor.statistics')
  const locale = useLocale()
  const { bot } = useBotState()
  const botId = String(bot?.id || '')

  const [period, setPeriod] = useState<BotSubscribersPeriod>('30d')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<'all' | BotSubscribersSource>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [data, setData] = useState<BotSubscribersAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    if (!botId) return

    setIsLoading(true)
    setError(null)

    try {
      const query = new URLSearchParams()
      query.set('period', period)
      query.set('source', source)
      query.set('page', String(page))
      query.set('pageSize', String(pageSize))
      if (search) query.set('search', search)

      const response = await fetch(`/api/bots/${encodeURIComponent(botId)}/subscribers?${query.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      })

      const result = await response.json() as {
        success?: boolean
        error?: string
        data?: BotSubscribersAnalytics
      }

      if (!result.success || !result.data) {
        setData(null)
        setError(result.error || t('subscribers.loadError'))
        return
      }

      setData(result.data)
    } catch (loadError) {
      setData(null)
      setError(String(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [botId, page, pageSize, period, search, source, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totalPages = useMemo(() => {
    if (!data?.total || !data?.pageSize) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

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

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('subscribers.filtersTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="xl:col-span-2">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t('subscribers.filters.searchPlaceholder')}
                  className="pl-9 border-white/10 bg-zinc-900/60 text-white"
                />
              </div>
            </div>

            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value as BotSubscribersPeriod)
                setPage(1)
              }}
            >
              <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                <SelectValue placeholder={t('subscribers.filters.period')} />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`subscribers.period.${option}` as never)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={source}
              onValueChange={(value) => {
                setSource(value as 'all' | BotSubscribersSource)
                setPage(1)
              }}
            >
              <SelectTrigger className="border-white/10 bg-zinc-900/60 text-white">
                <SelectValue placeholder={t('subscribers.filters.source')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('subscribers.filters.allSources')}</SelectItem>
                <SelectItem value="message">{t('subscribers.source.message')}</SelectItem>
                <SelectItem value="callback_query">{t('subscribers.source.callbackQuery')}</SelectItem>
                <SelectItem value="unknown">{t('subscribers.source.unknown')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              className="border-white/10 text-zinc-300"
              onClick={() => void loadData()}
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
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('subscribers.summary.total')}</p>
                <p className="text-2xl font-semibold text-white mt-1">{data?.summary.totalSubscribers || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#24A1DE]/15 border border-[#24A1DE]/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#24A1DE]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('subscribers.summary.active')}</p>
                <p className="text-2xl font-semibold text-emerald-300 mt-1">{data?.summary.activeInPeriod || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('subscribers.summary.new')}</p>
                <p className="text-2xl font-semibold text-violet-300 mt-1">{data?.summary.newInPeriod || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">{t('subscribers.summary.lastSeen')}</p>
                <p className="text-sm font-semibold text-zinc-100 mt-1">
                  {formatDateTime(data?.summary.lastSeenAt || null)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-400/25 flex items-center justify-center">
                <Globe2 className="w-5 h-5 text-amber-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-zinc-950/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">{t('subscribers.analytics.sourceTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-zinc-300">{t('subscribers.source.message')}</span>
              <span className="text-sm font-semibold text-white">{data?.sourceCounts.message || 0}</span>
            </div>
            <div className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-zinc-300">{t('subscribers.source.callbackQuery')}</span>
              <span className="text-sm font-semibold text-white">{data?.sourceCounts.callback_query || 0}</span>
            </div>
            <div className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
              <span className="text-sm text-zinc-300">{t('subscribers.source.unknown')}</span>
              <span className="text-sm font-semibold text-white">{data?.sourceCounts.unknown || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">{t('subscribers.analytics.languagesTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.topLanguages?.length ? (
              data.topLanguages.map((item) => (
                <div key={item.code} className="rounded-lg border border-white/10 px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{item.code}</span>
                  <span className="text-sm font-semibold text-white">{item.count}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-400">{t('subscribers.analytics.languagesEmpty')}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('subscribers.tableTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-zinc-900/70 text-zinc-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.user')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.userId')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.language')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.source')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.firstSeen')}</th>
                  <th className="text-left px-3 py-2 font-medium">{t('subscribers.columns.lastSeen')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.items?.length ? (
                  data.items.map((item) => (
                    <tr key={`${item.telegramUserId}-${item.lastSeenAt || item.firstSeenAt || 'row'}`} className="hover:bg-white/[0.03] transition-colors">
                      <td className="px-3 py-2">
                        <div className="text-white">{resolveSubscriberName(item)}</div>
                        {item.username ? (
                          <div className="text-xs text-zinc-500 mt-0.5">@{item.username}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-200">{item.telegramUserId || '—'}</td>
                      <td className="px-3 py-2 text-zinc-200 uppercase">{item.languageCode || '—'}</td>
                      <td className="px-3 py-2 text-zinc-200">
                        {item.source === 'message'
                          ? t('subscribers.source.message')
                          : item.source === 'callback_query'
                          ? t('subscribers.source.callbackQuery')
                          : t('subscribers.source.unknown')}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{formatDateTime(item.firstSeenAt)}</td>
                      <td className="px-3 py-2 text-zinc-100">{formatDateTime(item.lastSeenAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                      {t('subscribers.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              {t('subscribers.pagination.pageOf', {
                page: data?.page || page,
                totalPages,
                total: data?.total || 0,
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-zinc-300"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={(data?.page || page) <= 1 || isLoading}
              >
                {t('subscribers.pagination.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-zinc-300"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={(data?.page || page) >= totalPages || isLoading}
              >
                {t('subscribers.pagination.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
