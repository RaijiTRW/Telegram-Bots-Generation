'use client'

import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TechnicalStatsPanel } from '@/components/bot-editor/statistics/technical-stats-panel'
import { PaymentStatsPanel } from '@/components/bot-editor/statistics/payment-stats-panel'
import { SubscribersStatsPanel } from '@/components/bot-editor/statistics/subscribers-stats-panel'

export default function StatisticsPage() {
  const tNav = useTranslations('editor.nav')
  const t = useTranslations('editor.statistics')

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
          <Tabs defaultValue="technical" className="space-y-4">
            <TabsList className="grid w-full max-w-[620px] grid-cols-3 bg-zinc-900/60 border border-white/10">
              <TabsTrigger value="technical" className="w-full">{t('tabs.technical')}</TabsTrigger>
              <TabsTrigger value="payments" className="w-full">{t('tabs.payments')}</TabsTrigger>
              <TabsTrigger value="subscribers" className="w-full">{t('tabs.subscribers')}</TabsTrigger>
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
