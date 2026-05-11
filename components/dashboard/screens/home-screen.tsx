'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bot, Activity, Users, MessageSquare, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BotProjectCard } from '@/components/dashboard/bot-project-card'
import { getUserBots } from '@/lib/bot-editor/actions/bots-actions'
import { getDashboardGlobalStatsAction } from '@/lib/bot-editor/actions/editor-actions'
import type { Bot as BotProject } from '@/lib/bot-editor/types/bot.types'
import type { DashboardGlobalStats } from '@/lib/bot-editor/types/analytics.types'
import { prefetchHrefOnce, schedulePrefetchHref } from '@/lib/navigation/prefetch'

type HomeStatCard = {
  title: string
  value: string
  icon: typeof Bot
  bgColor: string
  iconBg: string
  iconColor: string
  borderColor: string
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(value)
}

export default function DashboardPage() {
  const t = useTranslations('dashboard.home')
  const tStats = useTranslations('dashboard.stats')
  const locale = useLocale()
  const router = useRouter()

  const [bots, setBots] = useState<BotProject[]>([])
  const [stats, setStats] = useState<DashboardGlobalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const getActionErrorMessage = useCallback((input: unknown, fallback: string) => {
    const message =
      input instanceof Error
        ? input.message
        : String(input || '').trim()

    if (!message || message === '[object Object]' || message.includes('An unexpected response was received from the server.')) {
      return fallback
    }

    return message
  }, [])

  const getEditorHref = useCallback(
    (botId: string) => `/${locale}/workspace/bots/${botId}/editor`,
    [locale]
  )

  const loadHomeData = useCallback(async () => {
    const [botsResult, statsResult] = await Promise.allSettled([
      getUserBots(),
      getDashboardGlobalStatsAction({ period: '30d' }),
    ])

    if (botsResult.status === 'fulfilled') {
      if (botsResult.value.success && botsResult.value.authenticated) {
        setBots(botsResult.value.bots)
      } else {
        setBots([])
        if (botsResult.value.error) {
          setError(botsResult.value.error)
        }
      }
    } else {
      setBots([])
      setError(getActionErrorMessage(botsResult.reason, t('loadError')))
    }

    if (statsResult.status === 'fulfilled') {
      if (statsResult.value.success && statsResult.value.stats) {
        setStats(statsResult.value.stats)
      } else {
        setStats(null)
      }
    } else {
      setStats(null)
    }

    setIsLoading(false)
  }, [getActionErrorMessage, t])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHomeData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadHomeData])

  const activeBots = useMemo(
    () => bots.filter((bot) => bot.status === 'active'),
    [bots]
  )

  useEffect(() => {
    for (const bot of activeBots.slice(0, 3)) {
      schedulePrefetchHref(router, getEditorHref(bot.id))
    }
  }, [activeBots, getEditorHref, router])

  const totalMessages = useMemo(
    () => (stats?.trend || []).reduce((sum, point) => sum + point.activity, 0),
    [stats]
  )

  const statCards = useMemo<HomeStatCard[]>(() => [
    {
      title: tStats('bots'),
      value: formatNumber(bots.length, locale),
      icon: Bot,
      bgColor: 'from-blue-500/20 to-cyan-500/20',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
    },
    {
      title: tStats('active'),
      value: formatNumber(activeBots.length, locale),
      icon: Activity,
      bgColor: 'from-emerald-500/20 to-green-500/20',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: tStats('users'),
      value: formatNumber(stats?.basic.totalSubscribers || 0, locale),
      icon: Users,
      bgColor: 'from-purple-500/20 to-violet-500/20',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
    {
      title: tStats('messages'),
      value: formatNumber(totalMessages, locale),
      icon: MessageSquare,
      bgColor: 'from-orange-500/20 to-amber-500/20',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
      borderColor: 'border-orange-500/20',
    },
  ], [activeBots.length, bots.length, locale, stats?.basic.totalSubscribers, tStats, totalMessages])

  return (
    <div className="space-y-6 p-0 sm:space-y-8 sm:p-6">
      <div className="space-y-1.5 sm:space-y-2">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('title')}</h1>
        <p className="text-sm leading-6 text-zinc-400 sm:text-base">{t('overview')}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card
              key={stat.title}
              className={`group relative min-h-[104px] overflow-hidden rounded-2xl border ${stat.borderColor} bg-white/5 bg-gradient-to-br ${stat.bgColor} backdrop-blur-sm transition-all duration-300 sm:min-h-[132px] lg:min-h-0 sm:hover:-translate-y-1 hover:border-white/20 hover:shadow-lg hover:shadow-black/20`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <CardContent className="relative p-3 sm:p-4 lg:p-6">
                <div className="mb-2 flex items-start justify-between sm:mb-3 lg:mb-4">
                  <div className={`rounded-xl p-2 sm:p-2.5 lg:p-3 ${stat.iconBg} ${stat.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                  </div>
                  <div className={`h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${stat.iconColor} bg-current ${isLoading ? 'animate-pulse' : ''}`} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium leading-4 text-zinc-400 sm:text-xs lg:text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold leading-none text-white sm:text-3xl">
                    {isLoading ? '…' : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('activeProjects')}</h2>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href={`/${locale}/dashboard/bots`}>
              {t('viewAllBots')}
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
            <CardContent className="flex items-center justify-center gap-3 p-10 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#24A1DE]" />
              {t('loadingProjects')}
            </CardContent>
          </Card>
        ) : activeBots.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeBots.map((bot) => (
              <BotProjectCard
                key={bot.id}
                bot={bot}
                onOpen={() => router.push(getEditorHref(bot.id))}
                onPrefetch={() => prefetchHrefOnce(router, getEditorHref(bot.id))}
              />
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
            <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#24A1DE]/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#8B5CF6]/10 blur-3xl" />
            <CardContent className="relative p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{t('noActiveProjects')}</h3>
                  <p className="mt-1 text-zinc-400">{t('noActiveProjectsDesc')}</p>
                </div>
                <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20">
                  <Sparkles className="h-8 w-8 text-[#24A1DE]" />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#24A1DE]/20">
                  <Link href={`/${locale}/dashboard/bots`}>
                    {t('createBot')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
                  <Link href={`/${locale}/dashboard/docs`}>{t('viewDocs')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
