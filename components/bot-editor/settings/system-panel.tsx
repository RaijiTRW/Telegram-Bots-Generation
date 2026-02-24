'use client'

import { Cpu, Zap, Database, Code2, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VariablesTable } from './variables-table'
import { useBotState } from '../providers/bot-state-provider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

type AutoReactionsConfig = {
  enabled: boolean
  cooldownSeconds: number
  onlyTextMessages: boolean
}

function getAutoReactionsConfig(metadata: Record<string, unknown> | undefined | null): AutoReactionsConfig {
  const features =
    metadata && typeof metadata.features === 'object' && metadata.features
      ? (metadata.features as Record<string, unknown>)
      : {}

  const autoReactions =
    features.autoReactions && typeof features.autoReactions === 'object'
      ? (features.autoReactions as Record<string, unknown>)
      : {}

  const cooldownRaw = Number(autoReactions.cooldownSeconds)
  const cooldownSeconds = Number.isFinite(cooldownRaw)
    ? Math.max(0, Math.min(3600, Math.round(cooldownRaw)))
    : 15

  return {
    enabled: Boolean(autoReactions.enabled),
    cooldownSeconds,
    onlyTextMessages:
      autoReactions.onlyTextMessages === undefined ? true : Boolean(autoReactions.onlyTextMessages),
  }
}

export function SystemPanel() {
  const t = useTranslations('editor.system')
  const { bot, config, updateBotDraft } = useBotState()

  const stats = [
    { label: t('nodes'), value: config.nodes.length, icon: Code2, color: 'text-[#24A1DE]' },
    { label: t('variables'), value: config.variables.length, icon: Database, color: 'text-[#8B5CF6]' },
    { label: t('connections'), value: config.edges.length, icon: Zap, color: 'text-amber-400' },
  ]

  const autoReactions = getAutoReactionsConfig((bot?.metadata || {}) as Record<string, unknown>)

  const updateAutoReactions = (patch: Partial<AutoReactionsConfig>) => {
    if (!bot) return

    const currentMetadata = (bot.metadata || {}) as Record<string, unknown>
    const currentFeatures =
      currentMetadata.features && typeof currentMetadata.features === 'object'
        ? (currentMetadata.features as Record<string, unknown>)
        : {}
    const currentAuto =
      currentFeatures.autoReactions && typeof currentFeatures.autoReactions === 'object'
        ? (currentFeatures.autoReactions as Record<string, unknown>)
        : {}

    const nextCooldown =
      patch.cooldownSeconds !== undefined
        ? Math.max(0, Math.min(3600, Math.round(patch.cooldownSeconds)))
        : autoReactions.cooldownSeconds

    updateBotDraft({
      metadata: {
        features: {
          ...currentFeatures,
          autoReactions: {
            ...currentAuto,
            enabled: patch.enabled ?? autoReactions.enabled,
            cooldownSeconds: nextCooldown,
            onlyTextMessages: patch.onlyTextMessages ?? autoReactions.onlyTextMessages,
            mode: 'rule-based',
          },
        },
      },
    })
  }

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

          {/* Variables Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <VariablesTable />
          </section>

          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Доп. функция: Реакции Telegram</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Бот будет ставить реакцию на входящие сообщения пользователя через правило-ориентированную логику
                  (без AI).
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm ${autoReactions.enabled ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  {autoReactions.enabled ? 'Включено' : 'Выключено'}
                </span>
                <Switch
                  checked={autoReactions.enabled}
                  onCheckedChange={(checked) => updateAutoReactions({ enabled: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <label className="block text-sm text-zinc-300 mb-2" htmlFor="auto-reactions-cooldown">
                  Cooldown между реакциями (сек)
                </label>
                <Input
                  id="auto-reactions-cooldown"
                  type="number"
                  min={0}
                  max={3600}
                  step={1}
                  value={autoReactions.cooldownSeconds}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value || '0', 10)
                    updateAutoReactions({
                      cooldownSeconds: Number.isFinite(parsed) ? parsed : 0,
                    })
                  }}
                  disabled={!autoReactions.enabled}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Ограничение, чтобы бот не спамил реакциями на каждое сообщение подряд.
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-zinc-300">Только текст/подпись</div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Если выключить, бот будет ставить базовую реакцию и на нетекстовые сообщения.
                    </p>
                  </div>
                  <Switch
                    checked={autoReactions.onlyTextMessages}
                    onCheckedChange={(checked) => updateAutoReactions({ onlyTextMessages: checked })}
                    disabled={!autoReactions.enabled}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-zinc-950/30 p-4">
              <div className="text-sm text-zinc-300 mb-2">AI реакций</div>
              <div className="relative">
                <Input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  placeholder="Описание логики AI-реакций"
                  className="pr-4"
                />
                <div className="absolute inset-0 rounded-md bg-zinc-950/55 border border-white/5 flex items-center justify-center pointer-events-none">
                  <span className="text-xs md:text-sm font-medium text-zinc-300">
                    AI реакций (скоро)
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Позже здесь будет prompt/настройка анализа сообщения для выбора реакции через AI.
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-4">
              <div className="text-sm font-medium text-white mb-2">Как выбирается реакция (без AI)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-300">
                <div>`спасибо`, `thanks` → ❤️</div>
                <div>позитив (`круто`, `super`, `great`) → 🔥</div>
                <div>вопрос/`?` → 🤔</div>
                <div>ошибка/проблема (`error`, `не работает`) → 👀</div>
                <div>`/start` → 👋</div>
                <div>прочие команды `/...` → ⚡, иначе → 👍</div>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                Реакция ставится только на сообщения пользователя (не на сообщения самого бота).
              </p>
            </div>
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
