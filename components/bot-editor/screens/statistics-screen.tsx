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
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="text-white font-semibold">{tNav('statistics')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{tNav('statisticsDesc')}</span>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-zinc-400 text-sm mb-4">{t('description')}</p>
          <Tabs
            value={resolvedActiveTab}
            onValueChange={(value) => {
              if (value === 'subscribers' && !subscribersEnabled) {
                return
              }
              setActiveTab(value as StatisticsTab)
            }}
            className="space-y-4"
          >
            <TabsList className="grid w-full max-w-[620px] grid-cols-3 overflow-visible bg-zinc-900/60 border border-white/10">
              <TabsTrigger value="technical" className="w-full">{t('tabs.technical')}</TabsTrigger>
              <TabsTrigger value="payments" className="w-full">{t('tabs.payments')}</TabsTrigger>
              <div className="relative w-full group/subscribers">
                <TabsTrigger
                  value="subscribers"
                  className={subscribersEnabled ? 'w-full' : 'w-full cursor-not-allowed opacity-50'}
                  aria-disabled={!subscribersEnabled}
                >
                  {t('tabs.subscribers')}
                </TabsTrigger>

                {!subscribersEnabled ? (
                  <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-[280px] -translate-x-1/2 rounded-xl border border-amber-500/20 bg-zinc-950/95 px-4 py-3 text-left shadow-2xl shadow-black/40 opacity-0 backdrop-blur-md transition-all duration-150 group-hover/subscribers:translate-y-0 group-hover/subscribers:opacity-100 group-focus-within/subscribers:translate-y-0 group-focus-within/subscribers:opacity-100">
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
            <TabsContent value="technical">
              <TechnicalStatsPanel />
            </TabsContent>
            <TabsContent value="payments">
              <PaymentStatsPanel />
            </TabsContent>
            <TabsContent value="subscribers">
              <SubscribersStatsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
