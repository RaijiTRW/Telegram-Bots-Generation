'use client'

import { Cpu, Zap, Database, Code2, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VariablesTable } from './variables-table'
import { useBotState } from '../providers/bot-state-provider'

export function SystemPanel() {
  const t = useTranslations('editor.system')
  const { bot, config } = useBotState()

  const stats = [
    { label: t('nodes'), value: config.nodes.length, icon: Code2, color: 'text-[#24A1DE]' },
    { label: t('variables'), value: config.variables.length, icon: Database, color: 'text-[#8B5CF6]' },
    { label: t('connections'), value: config.edges.length, icon: Zap, color: 'text-amber-400' },
  ]

  return (
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Cpu className="w-4 h-4 text-[#24A1DE]" />
          </div>
          <h1 className="text-white font-semibold">{t('title')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{t('subtitle')}</span>
        </div>

        <div />
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-zinc-900/50 border border-white/10 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">{stat.label}</span>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                </div>
              )
            })}
          </div>

          {/* Trigger Routing Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-3">Trigger Routing</h3>
            <p className="text-sm text-zinc-400">
              Триггеры теперь настраиваются напрямую на Canvas через ноды
              <span className="text-white"> Command Trigger </span>
              и
              <span className="text-white"> Callback Trigger</span>.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Это единый источник запуска веток и обработки callback query.
            </p>
          </section>

          {/* Variables Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <VariablesTable />
          </section>

          {/* Bot Info Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
                <Info className="w-4 h-4 text-[#24A1DE]" />
              </div>
              {t('botInformation')}
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">{t('botId')}:</span>
                <code className="ml-2 text-[#24A1DE]">{bot?.id || 'N/A'}</code>
              </div>
              <div>
                <span className="text-zinc-500">{t('status')}:</span>
                <span className={`ml-2 ${bot?.status === 'active' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {bot?.status || 'draft'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">{t('created')}:</span>
                <span className="ml-2 text-zinc-400">
                  {bot?.createdAt ? new Date(bot.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">{t('lastUpdated')}:</span>
                <span className="ml-2 text-zinc-400">
                  {bot?.updatedAt ? new Date(bot.updatedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
