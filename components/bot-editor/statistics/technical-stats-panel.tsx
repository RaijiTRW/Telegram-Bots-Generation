'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Activity, AlertTriangle, Gauge, Users, Bug, RefreshCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { getBotTechnicalStatsAction } from '@/lib/bot-editor/actions/editor-actions'
import type { BotTechnicalStats, BotTechnicalStatsRange } from '@/lib/bot-editor/types/analytics.types'

type KpiItem = {
  key: string
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
}

const RANGE_OPTIONS: BotTechnicalStatsRange[] = ['1h', '24h', '7d']

export function TechnicalStatsPanel() {
  const t = useTranslations('editor.statistics')
  const locale = useLocale()
  const { bot } = useBotState()
  const botId = String(bot?.id || '')
  const [range, setRange] = useState<BotTechnicalStatsRange>('24h')
  const [stats, setStats] = useState<BotTechnicalStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuditExpanded, setIsAuditExpanded] = useState(false)

  const loadStats = useCallback(async (nextRange: BotTechnicalStatsRange) => {
    if (!botId) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await getBotTechnicalStatsAction(botId, nextRange)
      if (!result.success || !result.stats) {
        setStats(null)
        setError(result.error || t('loadError'))
        return
      }
      setStats(result.stats)
    } catch (loadError) {
      setStats(null)
      setError(String(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [botId, t])

  useEffect(() => {
    void loadStats(range)
  }, [loadStats, range])

  const kpis = useMemo<KpiItem[]>(() => {
    if (!stats) return []
    const { summary } = stats
    return [
      {
        key: 'events',
        label: t('kpi.totalEvents'),
        value: String(summary.totalEvents),
        icon: Activity,
      },
      {
        key: 'errors',
        label: t('kpi.errors'),
        value: String(summary.errorCount),
        icon: AlertTriangle,
      },
      {
        key: 'errorRate',
        label: t('kpi.errorRate'),
        value: `${summary.errorRatePercent.toFixed(2)}%`,
        icon: Bug,
      },
      {
        key: 'epm',
        label: t('kpi.eventsPerMinute'),
        value: summary.eventsPerMinute.toFixed(2),
        icon: Gauge,
      },
      {
        key: 'subscribers',
        label: t('kpi.subscribersTotal'),
        value: String(summary.totalSubscribers),
        icon: Users,
      },
      {
        key: 'active',
        label: t('kpi.subscribersActiveRange'),
        value: String(summary.activeRangeSubscribers),
        icon: Users,
      },
    ]
  }, [stats, t])

  const timelineMax = useMemo(() => {
    if (!stats?.timeline.length) return 1
    return Math.max(...stats.timeline.map((point) => point.total), 1)
  }, [stats])

  const recentAuditEvents = stats?.recentAuditEvents || []
  const hasExpandableAuditList = recentAuditEvents.length > 5

  const formatDateTime = useCallback((value: string) => {
    if (!value) return '—'
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed))
  }, [locale])

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('tabs.technical')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={option === range ? 'secondary' : 'outline'}
                  className={option === range ? 'bg-[#24A1DE]/20 text-white border-[#24A1DE]/30' : 'border-white/10 text-zinc-300'}
                  onClick={() => setRange(option)}
                  disabled={isLoading}
                >
                  {option}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              className="border-white/10 text-zinc-300"
              onClick={() => void loadStats(range)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.key} className="border-white/10 bg-zinc-950/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">{item.label}</p>
                    <p className="text-2xl font-semibold text-white mt-1">{item.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#24A1DE]/15 border border-[#24A1DE]/25 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#24A1DE]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-white/10 bg-zinc-950/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">{t('timelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.timeline.length ? (
            <div className="h-44 flex items-end gap-1">
              {stats.timeline.map((point) => {
                const heightPercent = Math.max(4, Math.round((point.total / timelineMax) * 100))
                return (
                  <div key={point.bucketStart} className="flex-1 min-w-[6px] flex flex-col items-center justify-end gap-2">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-[#24A1DE] to-[#8B5CF6]"
                      style={{ height: `${heightPercent}%` }}
                      title={`${formatDateTime(point.bucketStart)} • ${point.total}`}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-sm text-zinc-400">{t('empty')}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-zinc-950/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">{t('topSourcesTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.topErrorSources.length ? (
              stats.topErrorSources.map((source) => (
                <div key={source.source} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
                  <span className="text-sm text-zinc-300">{source.source}</span>
                  <span className="text-sm font-semibold text-white">{source.count}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-400">{t('noErrorSources')}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-zinc-950/40">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-white text-base">{t('auditTitle')}</CardTitle>
              {hasExpandableAuditList ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAuditExpanded((prev) => !prev)}
                  className="h-8 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                >
                  {isAuditExpanded ? (
                    <ChevronUp className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {isAuditExpanded
                    ? t('auditCollapse')
                    : t('auditExpand', { count: recentAuditEvents.length })}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {recentAuditEvents.length ? (
              <div className="relative">
                <div
                  className={cn(
                    'space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5',
                    hasExpandableAuditList
                      ? isAuditExpanded
                        ? 'max-h-[32rem]'
                        : 'max-h-[19rem]'
                      : ''
                  )}
                >
                  {recentAuditEvents.map((event) => (
                    <div key={event.id} className="rounded-lg border border-white/10 px-3 py-2">
                      <div className="text-sm text-white">{event.eventType}</div>
                      <div className="mt-1 text-xs text-zinc-400">{formatDateTime(event.createdAt)}</div>
                    </div>
                  ))}
                </div>
                {hasExpandableAuditList && !isAuditExpanded ? (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent" />
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">{t('noAuditEvents')}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
