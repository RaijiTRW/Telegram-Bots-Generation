'use client'

import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { TechnicalStatsPanel } from '@/components/bot-editor/statistics/technical-stats-panel'

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
          <TechnicalStatsPanel />
        </div>
      </div>
    </div>
  )
}

