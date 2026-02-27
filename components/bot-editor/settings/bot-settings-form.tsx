'use client'

import { useState } from 'react'
import { AlertCircle, AtSign, CheckCircle2, Eye, EyeOff, Key, Loader2, Palette, User, Webhook } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBotState } from '../providers/bot-state-provider'
import type { BotStatus } from '@/lib/bot-editor/types/bot.types'
import {
  checkTelegramUsernameAvailabilityAction,
  syncTelegramBotStyleAction,
} from '@/lib/bot-editor/actions/editor-actions'

export function BotSettingsForm() {
  const t = useTranslations('editor.settings')
  const { bot, updateBotDraft } = useBotState()

  // Form state
  const [showToken, setShowToken] = useState(false)
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)
  const [usernameCheckMessage, setUsernameCheckMessage] = useState<{
    tone: 'success' | 'warning' | 'error' | 'neutral'
    text: string
  } | null>(null)
  const [isSyncingStyle, setIsSyncingStyle] = useState(false)
  const [styleSyncMessage, setStyleSyncMessage] = useState<{
    tone: 'success' | 'warning' | 'error' | 'neutral'
    text: string
  } | null>(null)

  const name = bot?.name || ''
  const description = bot?.description || ''
  const status: BotStatus = bot?.status || 'draft'
  const telegramToken = String(bot?.metadata?.telegramToken || '')
  const hasStoredTelegramToken = Boolean((bot?.metadata as Record<string, unknown> | undefined)?.hasTelegramToken)
  const webhookUrl = String(bot?.metadata?.webhookUrl || '')
  const profileStyleRaw =
    bot?.metadata?.profileStyle && typeof bot.metadata.profileStyle === 'object'
      ? (bot.metadata.profileStyle as Record<string, unknown>)
      : {}
  const profileDisplayName = String(profileStyleRaw.displayName || '')
  const profileDesiredUsername = String(profileStyleRaw.desiredUsername || '')
  const profileAvatarUrl = String(profileStyleRaw.avatarUrl || '')
  const profileAbout = String(profileStyleRaw.about || '')
  const profileShortDescription = String(profileStyleRaw.shortDescription || '')
  const getBotTokenText = t('getBotToken')
  const [getBotTokenBefore, ...getBotTokenRestParts] = getBotTokenText.split('@BotFather')
  const hasBotFatherPlaceholder = getBotTokenRestParts.length > 0
  const getBotTokenAfter = getBotTokenRestParts.join('@BotFather')

  const statusOptions: { value: BotStatus; labelKey: string; color: string }[] = [
    { value: 'draft', labelKey: 'statusDraft', color: 'text-zinc-400' },
    { value: 'active', labelKey: 'statusActive', color: 'text-emerald-400' },
    { value: 'archived', labelKey: 'statusArchived', color: 'text-amber-400' },
    { value: 'error', labelKey: 'statusError', color: 'text-red-400' },
  ]

  const updateProfileStyleDraft = (patch: Record<string, unknown>) => {
    updateBotDraft({
      metadata: {
        ...(bot?.metadata || {}),
        profileStyle: {
          ...profileStyleRaw,
          ...patch,
        },
      },
    })
  }

  const checkMessageClasses =
    usernameCheckMessage?.tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : usernameCheckMessage?.tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : usernameCheckMessage?.tone === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-white/10 bg-zinc-900/40 text-zinc-300'

  const styleSyncMessageClasses =
    styleSyncMessage?.tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : styleSyncMessage?.tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : styleSyncMessage?.tone === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-white/10 bg-zinc-900/40 text-zinc-300'

  const handleUsernameCheck = async () => {
    if (!bot?.id) return
    setIsCheckingUsername(true)
    setUsernameCheckMessage(null)

    try {
      const result = await checkTelegramUsernameAvailabilityAction(bot.id, profileDesiredUsername)
      if (!result.success) {
        setUsernameCheckMessage({
          tone: 'error',
          text: t('profileUsernameCheckError'),
        })
        return
      }

      if (result.status === 'available') {
        setUsernameCheckMessage({
          tone: 'success',
          text: t('profileUsernameAvailable', { username: result.normalizedUsername }),
        })
        return
      }

      if (result.status === 'taken') {
        setUsernameCheckMessage({
          tone: 'warning',
          text: t('profileUsernameTaken', { username: result.normalizedUsername }),
        })
        return
      }

      if (result.status === 'unchanged') {
        setUsernameCheckMessage({
          tone: 'neutral',
          text: t('profileUsernameCurrent', { username: result.normalizedUsername }),
        })
        return
      }

      if (result.reason === 'suffix') {
        setUsernameCheckMessage({
          tone: 'error',
          text: t('profileUsernameInvalidSuffix'),
        })
        return
      }

      setUsernameCheckMessage({
        tone: 'error',
        text: t('profileUsernameInvalidFormat'),
      })
    } catch {
      setUsernameCheckMessage({
        tone: 'error',
        text: t('profileUsernameCheckError'),
      })
    } finally {
      setIsCheckingUsername(false)
    }
  }

  const handleSyncProfileStyle = async () => {
    if (!bot?.id) return
    setIsSyncingStyle(true)
    setStyleSyncMessage(null)

    try {
      const result = await syncTelegramBotStyleAction(bot.id, {
        displayName: profileDisplayName,
        desiredUsername: profileDesiredUsername,
        avatarUrl: profileAvatarUrl,
        about: profileAbout,
        shortDescription: profileShortDescription,
      })

      if (result.profileStyle) {
        updateProfileStyleDraft(result.profileStyle)
      }

      if (!result.success) {
        setStyleSyncMessage({
          tone: 'error',
          text: t('profileSyncError'),
        })
        return
      }

      if (Array.isArray(result.warnings) && result.warnings.length > 0) {
        setStyleSyncMessage({
          tone: 'warning',
          text: t('profileSyncDoneWithWarnings'),
        })
        return
      }

      setStyleSyncMessage({
        tone: 'success',
        text: t('profileSyncSuccess'),
      })
    } catch {
      setStyleSyncMessage({
        tone: 'error',
        text: t('profileSyncError'),
      })
    } finally {
      setIsSyncingStyle(false)
    }
  }

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
                    {t(option.labelKey)}
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
              {t('currentStatus', { status: t(statusOptions.find(s => s.value === status)?.labelKey || 'statusDraft') })}
            </p>
          </div>
        </div>
      </section>

      {/* Telegram Profile Style */}
      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <User className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('profileStyleTitle')}
        </h2>
        <p className="text-xs text-zinc-400 mb-4">{t('profileStyleDesc')}</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="profile-display-name" className="text-white">{t('profileDisplayName')}</Label>
            <Input
              id="profile-display-name"
              value={profileDisplayName}
              onChange={(e) => updateProfileStyleDraft({ displayName: e.target.value })}
              placeholder={t('profileDisplayNamePlaceholder')}
              className="mt-1.5 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
            />
          </div>

          <div>
            <Label htmlFor="profile-username" className="text-white">{t('profileUsername')}</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative flex-1">
                <AtSign className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="profile-username"
                  value={profileDesiredUsername}
                  onChange={(e) => {
                    setUsernameCheckMessage(null)
                    updateProfileStyleDraft({
                      desiredUsername: e.target.value.replace(/^@+/, ''),
                    })
                  }}
                  placeholder={t('profileUsernamePlaceholder')}
                  className="pl-9 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void handleUsernameCheck()}
                disabled={isCheckingUsername || !profileDesiredUsername.trim()}
              >
                {isCheckingUsername ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('profileUsernameChecking')}
                  </>
                ) : (
                  t('profileUsernameCheck')
                )}
              </Button>
            </div>
            {usernameCheckMessage && (
              <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${checkMessageClasses}`}>
                {usernameCheckMessage.text}
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-1.5">{t('profileUsernameHint')}</p>
          </div>

          <div>
            <Label htmlFor="profile-avatar-url" className="text-white">{t('profileAvatarUrl')}</Label>
            <Input
              id="profile-avatar-url"
              value={profileAvatarUrl}
              onChange={(e) => updateProfileStyleDraft({ avatarUrl: e.target.value })}
              placeholder={t('profileAvatarUrlPlaceholder')}
              className="mt-1.5 bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
            />
            {/^https?:\/\//i.test(profileAvatarUrl) && (
              <div className="mt-2 rounded-lg border border-white/10 bg-zinc-950/60 p-2 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profileAvatarUrl}
                  alt={t('profileAvatarPreviewAlt')}
                  className="w-16 h-16 rounded-md object-cover bg-zinc-900/60 border border-white/10"
                />
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-1.5">{t('profileAvatarHint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <Label htmlFor="profile-about" className="text-white">{t('profileAbout')}</Label>
              <Textarea
                id="profile-about"
                value={profileAbout}
                onChange={(e) => updateProfileStyleDraft({ about: e.target.value })}
                placeholder={t('profileAboutPlaceholder')}
                rows={4}
                className="mt-1.5 min-h-[110px]"
              />
            </div>
            <div>
              <Label htmlFor="profile-short-description" className="text-white">{t('profileShortDescription')}</Label>
              <Textarea
                id="profile-short-description"
                value={profileShortDescription}
                onChange={(e) => updateProfileStyleDraft({ shortDescription: e.target.value })}
                placeholder={t('profileShortDescriptionPlaceholder')}
                rows={4}
                className="mt-1.5 min-h-[110px]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void handleSyncProfileStyle()} disabled={isSyncingStyle}>
              {isSyncingStyle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('profileSyncInProgress')}
                </>
              ) : (
                t('profileSyncButton')
              )}
            </Button>
            <span className="text-xs text-zinc-500">{t('profileSyncHint')}</span>
          </div>

          {styleSyncMessage && (
            <div className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${styleSyncMessageClasses}`}>
              {styleSyncMessage.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{styleSyncMessage.text}</span>
            </div>
          )}
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
                placeholder={
                  hasStoredTelegramToken && !telegramToken
                    ? t('botTokenReplacePlaceholder')
                    : t('botTokenPlaceholder')
                }
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
            {hasStoredTelegramToken && !telegramToken && (
              <p className="text-xs text-emerald-300/90 mt-1.5">
                {t('botTokenStoredSecurely')}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-1.5">
              {hasBotFatherPlaceholder ? (
                <>
                  {getBotTokenBefore}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#24A1DE] hover:underline"
                  >
                    @BotFather
                  </a>
                  {getBotTokenAfter}
                </>
              ) : (
                getBotTokenText
              )}
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
