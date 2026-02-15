'use client'

import { useState } from 'react'
import { Cpu, Zap, Database, Code2, Info, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TriggersList } from './triggers-list'
import { VariablesTable } from './variables-table'
import { useBotState } from '../providers/bot-state-provider'
import { startBotTestAction, stopBotTestAction } from '@/lib/bot-editor/actions/editor-actions'
import {
  serializeWorkflowNodes,
  serializeWorkflowEdges,
} from '@/lib/bot-editor/utils/workflow-serialization'

export function SystemPanel() {
  const { bot, config, setIsDirty, setBot } = useBotState()
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const isTestActive = Boolean(bot?.metadata?.testActive)

  const handleTriggersChange = () => {
    setIsDirty(true)
  }

  const handleDeploy = () => {
    // In real app, this would deploy the bot
    console.log('Deploying bot:', bot?.id)
    setIsDirty(false)
  }

  const handleTest = async () => {
    if (!bot?.id) return

    setIsTesting(true)
    setTestError(null)

    if (isTestActive) {
      const stopResult = await stopBotTestAction(bot.id)
      setIsTesting(false)

      if (!stopResult.success) {
        setTestError(stopResult.error || 'Не удалось остановить тест')
        return
      }

      if (stopResult.bot) {
        setBot(stopResult.bot)
      }
      setIsDirty(false)

      return
    }

    const serialNodes = serializeWorkflowNodes(config.nodes as unknown[])
    const serialEdges = serializeWorkflowEdges(config.edges as unknown[])

    const result = await startBotTestAction(bot.id, {
      nodes: serialNodes,
      edges: serialEdges,
      variables: config.variables as unknown[],
      version: config.version,
    })

    setIsTesting(false)

    if (!result.success) {
      setTestError(result.error || 'Не удалось запустить тест')
      return
    }

    if (result.bot) {
      setBot(result.bot)
    }
    setIsDirty(false)

    if (result.deepLink) {
      window.open(result.deepLink, '_blank', 'noopener,noreferrer')
    }

    const modeLabel = result.mode === 'polling' ? 'polling (локально)' : 'webhook'
    alert(result.deepLink ? `Тест запущен (${modeLabel}): ${result.deepLink}` : `Тест запущен (${modeLabel})`)
  }

  const stats = [
    { label: 'Nodes', value: config.nodes.length, icon: Code2, color: 'text-[#24A1DE]' },
    { label: 'Variables', value: config.variables.length, icon: Database, color: 'text-[#8B5CF6]' },
    { label: 'Connections', value: config.edges.length, icon: Zap, color: 'text-amber-400' },
  ]

  return (
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Cpu className="w-4 h-4 text-[#24A1DE]" />
          </div>
          <h1 className="text-white font-semibold">System</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">Bot logic & configuration</span>
        </div>

        <div className="flex items-center gap-2">
          {testError && (
            <div className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-300">
              {testError}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 ${isTestActive ? 'border-red-500/40 text-red-300 hover:bg-red-500/10' : ''}`}
            onClick={handleTest}
          >
            <RefreshCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Processing...' : isTestActive ? 'Stop' : 'Test'}
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80" onClick={handleDeploy}>
            <Zap className="w-4 h-4" />
            Deploy Bot
          </Button>
        </div>
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

          {/* Triggers Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <TriggersList onTriggersChange={handleTriggersChange} />
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
              Bot Information
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Bot ID:</span>
                <code className="ml-2 text-[#24A1DE]">{bot?.id || 'N/A'}</code>
              </div>
              <div>
                <span className="text-zinc-500">Status:</span>
                <span className={`ml-2 ${bot?.status === 'active' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {bot?.status || 'draft'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Created:</span>
                <span className="ml-2 text-zinc-400">
                  {bot?.createdAt ? new Date(bot.createdAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Last updated:</span>
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
