'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { TechnicalStatsPanel } from '@/components/bot-editor/statistics/technical-stats-panel'

type StatisticsTab = 'technical' | 'payments' | 'subscribers'

function getSubscriberModeEnabled(metadata: Record<string, unknown> | undefined | null) {
  const features =
    metadata && typeof metadata.features === 'object' && metadata.features
      ? (metadata.features as Record<string, unknown>)
      : {}

  const raw =
    features.subscriberMode && typeof features.subscriberMode === 'object'
      ? (features.subscriberMode as Record<string, unknown>)
      : {}

  return Boolean(raw.enabled)
}

function StatsPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="h-28 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
        <div className="h-28 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
        <div className="h-28 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
        <div className="h-28 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
      </div>
      <div className="h-80 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
    </div>
  )
}

const PaymentStatsPanel = dynamic(
  () => import('@/components/bot-editor/statistics/payment-stats-panel').then((module) => module.PaymentStatsPanel),
  {
    loading: () => <StatsPanelSkeleton />,
  }
)

const SubscribersStatsPanel = dynamic(
  () => import('@/components/bot-editor/statistics/subscribers-stats-panel').then((module) => module.SubscribersStatsPanel),
  {
    loading: () => <StatsPanelSkeleton />,
  }
)

export default function StatisticsPage() {
  const { bot } = useBotState()
  const tNav = useTranslations('editor.nav')
  const t = useTranslations('editor.statistics')
  const [activeTab, setActiveTab] = useState<StatisticsTab>('technical')
  const subscribersEnabled = useMemo(
    () => getSubscriberModeEnabled((bot?.metadata || {}) as Record<string, unknown>),
    [bot?.metadata]
  )
  const resolvedActiveTab: StatisticsTab =
    activeTab === 'subscribers' && !subscribersEnabled ? 'technical' : activeTab

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-[#05070A] overflow-y-auto">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BarChart3 className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="shrink-0 text-white font-semibold">{tNav('statistics')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="min-w-0 truncate text-sm text-zinc-400">{tNav('statisticsDesc')}</span>
        </div>
      </header>

      <div className="min-w-0 flex-1 p-6">
        <div className="w-full min-w-0">
          <p className="text-zinc-400 text-sm mb-4">{t('description')}</p>
          <Tabs
            value={resolvedActiveTab}
            onValueChange={(value) => {
              if (value === 'subscribers' && !subscribersEnabled) {
                return
              }
              setActiveTab(value as StatisticsTab)
            }}
            className="space-y-0"
          >
            <div className="sticky top-[3.6rem] z-20 mb-4">
              <div className="inline-flex w-full max-w-[620px] rounded-[20px] border border-white/10 bg-[#0D1117]/92 p-1 shadow-[0_14px_36px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                <TabsList className="grid h-auto w-full grid-cols-3 overflow-visible rounded-[16px] bg-transparent p-0 text-zinc-400">
                  <TabsTrigger
                    value="technical"
                    className="min-h-11 rounded-[14px] text-[15px] font-medium"
                  >
                    {t('tabs.technical')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="payments"
                    className="min-h-11 rounded-[14px] text-[15px] font-medium"
                  >
                    {t('tabs.payments')}
                  </TabsTrigger>
                  <div className="relative w-full group/subscribers">
                    <TabsTrigger
                      value="subscribers"
                      className={subscribersEnabled
                        ? 'min-h-11 w-full rounded-[14px] text-[15px] font-medium'
                        : 'min-h-11 w-full cursor-not-allowed rounded-[14px] text-[15px] font-medium opacity-50'
                      }
                      aria-disabled={!subscribersEnabled}
                    >
                      {t('tabs.subscribers')}
                    </TabsTrigger>

                    {!subscribersEnabled ? (
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-[280px] -translate-x-1/2 rounded-xl border border-amber-500/20 bg-zinc-950/95 px-4 py-3 text-left opacity-0 shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-150 group-hover/subscribers:translate-y-0 group-hover/subscribers:opacity-100 group-focus-within/subscribers:translate-y-0 group-focus-within/subscribers:opacity-100">
                        <div className="text-sm font-medium text-amber-200">
                          {t('tabs.subscribersDisabledTitle')}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-zinc-300">
                          {t('tabs.subscribersDisabledHint')}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsList>
              </div>
            </div>
            <TabsContent value="technical" className="mt-0">
              <TechnicalStatsPanel />
            </TabsContent>
            <TabsContent value="payments" className="mt-0">
              <PaymentStatsPanel />
            </TabsContent>
            <TabsContent value="subscribers" className="mt-0">
              <SubscribersStatsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
