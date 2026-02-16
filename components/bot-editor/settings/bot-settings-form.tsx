'use client'

import { useState } from 'react'
import { Eye, EyeOff, Palette, Key, Webhook } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBotState } from '../providers/bot-state-provider'
import type { BotStatus } from '@/lib/bot-editor/types/bot.types'

export function BotSettingsForm() {
  const t = useTranslations('editor.settings')
  const { bot, updateBotDraft } = useBotState()

  // Form state
  const [showToken, setShowToken] = useState(false)

  const name = bot?.name || ''
  const description = bot?.description || ''
  const status: BotStatus = bot?.status || 'draft'
  const telegramToken = String(bot?.metadata?.telegramToken || '')
  const webhookUrl = String(bot?.metadata?.webhookUrl || '')

  const statusOptions: { value: BotStatus; labelKey: string; color: string }[] = [
    { value: 'draft', labelKey: 'statusDraft', color: 'text-zinc-400' },
    { value: 'active', labelKey: 'statusActive', color: 'text-emerald-400' },
    { value: 'archived', labelKey: 'statusArchived', color: 'text-amber-400' },
    { value: 'error', labelKey: 'statusError', color: 'text-red-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Palette className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('basicInfo')}
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bot-name" className="text-white">{t('botName')}</Label>
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => updateBotDraft({ name: e.target.value })}
              placeholder={t('botNamePlaceholder')}
              className="mt-1.5 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
            />
          </div>

          <div>
            <Label htmlFor="bot-description" className="text-white">{t('description')}</Label>
            <textarea
              id="bot-description"
              value={description}
              onChange={(e) => updateBotDraft({ description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="mt-1.5 w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:outline-none focus:ring-2 focus:ring-[#24A1DE]/20 resize-none"
            />
          </div>

          <div>
            <Label htmlFor="bot-status" className="text-white">{t('status')}</Label>
            <div className="mt-1.5 relative">
              <select
                id="bot-status"
                value={status}
                onChange={(e) => updateBotDraft({ status: e.target.value as BotStatus })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/10 text-white focus:border-[#24A1DE] focus:outline-none appearance-none cursor-pointer"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey as any)}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <p className={`text-xs mt-1.5 ${statusOptions.find(s => s.value === status)?.color}`}>
              {t('currentStatus', { status: t(statusOptions.find(s => s.value === status)?.labelKey as any) })}
            </p>
          </div>
        </div>
      </section>

      {/* Telegram Settings */}
      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Key className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('telegramIntegration')}
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="telegram-token" className="text-white">{t('botToken')}</Label>
            <div className="mt-1.5 relative">
              <Input
                id="telegram-token"
                type={showToken ? 'text' : 'password'}
                value={telegramToken}
                onChange={(e) =>
                  updateBotDraft({
                    metadata: {
                      ...(bot?.metadata || {}),
                      telegramToken: e.target.value,
                    },
                  })
                }
                placeholder={t('botTokenPlaceholder')}
                className="pr-20 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('getBotToken').replace('@BotFather', '<a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#24A1DE] hover:underline">@BotFather</a>')}
            </p>
          </div>
        </div>
      </section>

      {/* Webhook Settings */}
      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Webhook className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('webhookConfig')}
        </h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="webhook-url" className="text-white">{t('webhookUrl')}</Label>
            <Input
              id="webhook-url"
              value={webhookUrl}
              onChange={(e) =>
                updateBotDraft({
                  metadata: {
                    ...(bot?.metadata || {}),
                    webhookUrl: e.target.value,
                  },
                })
              }
              placeholder={t('webhookUrlPlaceholder')}
              className="mt-1.5 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('webhookDesc')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 rounded-lg bg-zinc-900/50 border border-white/10">
              <code className="text-xs text-[#24A1DE] break-all">
                {webhookUrl || t('webhookUrlPlaceholder')}
              </code>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigator.clipboard.writeText(webhookUrl || t('webhookUrlPlaceholder'))}
            >
              {t('copy')}
            </Button>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
        <span dangerouslySetInnerHTML={{ __html: t('changesSavedBy', { button: `<span class="text-white">${t('save')}</span>` }) }} />
      </div>
    </div>
  )
}
