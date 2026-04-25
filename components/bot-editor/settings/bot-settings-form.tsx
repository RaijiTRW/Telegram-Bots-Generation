'use client'

import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Key, Loader2, Palette, Trash2, Upload, User } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBotState } from '../providers/bot-state-provider'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import { HELP_GUIDE_KEYS } from '@/lib/bot-editor/help/help-guide-keys'
import type { BotStatus } from '@/lib/bot-editor/types/bot.types'
import {
  syncTelegramBotStyleAction,
  uploadBotMessageAttachmentAction,
} from '@/lib/bot-editor/actions/editor-actions'

const SUPPORTED_PROFILE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])
const MAX_PROFILE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export function BotSettingsForm() {
  const t = useTranslations('editor.settings')
  const locale = useLocale()
  const { bot, updateBotDraft } = useBotState()
  const docsBasePath = `/${locale}/dashboard/docs`
  const docsGettingStarted = `${docsBasePath}/getting-started`
  const docsDataSecurity = `${docsBasePath}/data-security`

  // Form state
  const [showToken, setShowToken] = useState(false)
  const [isSyncingStyle, setIsSyncingStyle] = useState(false)
  const [styleSyncMessage, setStyleSyncMessage] = useState<{
    tone: 'success' | 'warning' | 'error' | 'neutral'
    text: string
  } | null>(null)
  const [isAvatarUploadDragging, setIsAvatarUploadDragging] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const [avatarPreviewDataUrl, setAvatarPreviewDataUrl] = useState<string | null>(null)
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null)

  const name = bot?.name || ''
  const description = bot?.description || ''
  const status: BotStatus = bot?.status || 'draft'
  const telegramToken = String(bot?.metadata?.telegramToken || '')
  const hasStoredTelegramToken = Boolean((bot?.metadata as Record<string, unknown> | undefined)?.hasTelegramToken)
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

  const styleSyncMessageClasses =
    styleSyncMessage?.tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
      : styleSyncMessage?.tone === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : styleSyncMessage?.tone === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-white/10 bg-zinc-900/40 text-zinc-300'

  const processAvatarFile = async (file: File) => {
    if (!bot?.id) {
      setAvatarUploadError(t('profileAvatarUploadBotMissing'))
      return
    }

    if (!SUPPORTED_PROFILE_IMAGE_TYPES.has(file.type)) {
      setAvatarUploadError(t('profileAvatarInvalidType'))
      return
    }

    if (!file.size || file.size <= 0) {
      setAvatarUploadError(t('profileAvatarEmptyFile'))
      return
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
      setAvatarUploadError(t('profileAvatarTooLarge'))
      return
    }

    setAvatarUploadError(null)
    setIsUploadingAvatar(true)
    try {
      const previewDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const value = reader.result
          if (typeof value === 'string') {
            resolve(value)
            return
          }
          reject(new Error('invalid preview data'))
        }
        reader.onerror = () => reject(new Error('preview read failed'))
        reader.readAsDataURL(file)
      })
      setAvatarPreviewDataUrl(previewDataUrl)

      const result = await uploadBotMessageAttachmentAction(bot.id, file)
      if (!result.success || !result.path) {
        setAvatarUploadError(result.error || t('profileAvatarUploadFailed'))
        return
      }

      updateProfileStyleDraft({ avatarUrl: result.path })
    } catch {
      setAvatarUploadError(t('profileAvatarUploadFailed'))
    } finally {
      setIsUploadingAvatar(false)
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

      const syncedProfileStyle = 'profileStyle' in result ? result.profileStyle : null
      const syncWarnings = 'warnings' in result && Array.isArray(result.warnings) ? result.warnings : []
      const syncError = 'error' in result ? result.error : null

      if (syncedProfileStyle) {
        updateProfileStyleDraft(syncedProfileStyle)
      }

      if (!result.success) {
        const reason = String(syncError || '').trim()
        const warningText =
          syncWarnings.length > 0
            ? ` ${syncWarnings.join(' ')}`
            : ''
        setStyleSyncMessage({
          tone: 'error',
          text: reason
            ? `${t('profileSyncErrorWithReason', { reason })}${warningText}`
            : `${t('profileSyncError')}${warningText}`,
        })
        return
      }

      if (syncWarnings.length > 0) {
        setStyleSyncMessage({
          tone: 'warning',
          text: `${t('profileSyncDoneWithWarnings')} ${syncWarnings.join(' ')}`.trim(),
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

  const handleAvatarInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    await processAvatarFile(file)
  }

  const handleAvatarDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsAvatarUploadDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await processAvatarFile(file)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#24A1DE]">
          {t('launchEssentialsTitle')}
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          {t('launchEssentialsDesc')}
        </div>
      </div>

      {/* Basic Settings */}
      <div className="px-1">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          {t('advancedSectionTitle')}
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          {t('advancedSectionDesc')}
        </div>
      </div>

      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Palette className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('basicInfo')}
          <HelpGuideButton
            guideKey={HELP_GUIDE_KEYS.editorSettingsBasicInfo}
            title={t('basicInfo')}
            summary={t('help.basicSummary')}
            steps={[t('help.basicStep1'), t('help.basicStep2'), t('help.basicStep3')]}
            docsHref={docsGettingStarted}
            className="ml-1"
          />
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
          <HelpGuideButton
            guideKey={HELP_GUIDE_KEYS.editorSettingsProfileStyle}
            title={t('profileStyleTitle')}
            summary={t('help.profileSummary')}
            steps={[t('help.profileStep1'), t('help.profileStep2'), t('help.profileStep3')]}
            notes={[t('profileUsernameHint')]}
            docsHref={docsDataSecurity}
            className="ml-1"
          />
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
            <Label className="text-white">{t('profileUsername')}</Label>
            <p className="text-xs text-zinc-500 mt-1.5">{t('profileUsernameHint')}</p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white">{t('profileAvatarUploadTitle')}</Label>
              {profileAvatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 border-white/10"
                  onClick={() => {
                    updateProfileStyleDraft({ avatarUrl: '' })
                    setAvatarPreviewDataUrl(null)
                    setAvatarUploadError(null)
                  }}
                  disabled={isUploadingAvatar}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('profileAvatarRemove')}
                </Button>
              )}
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleAvatarInputChange(event)}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => avatarFileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  avatarFileInputRef.current?.click()
                }
              }}
              onDragOver={(event) => {
                event.preventDefault()
                if (!isAvatarUploadDragging) {
                  setIsAvatarUploadDragging(true)
                }
              }}
              onDragLeave={(event) => {
                if (
                  event.relatedTarget instanceof HTMLElement &&
                  event.currentTarget.contains(event.relatedTarget)
                ) {
                  return
                }
                setIsAvatarUploadDragging(false)
              }}
              onDrop={(event) => void handleAvatarDrop(event)}
              className={`mt-1.5 rounded-lg border px-3 py-3 text-sm transition-colors cursor-pointer outline-none ${isAvatarUploadDragging
                ? 'border-[#24A1DE]/50 bg-[#24A1DE]/10 text-white'
                : 'border-white/10 bg-zinc-900/50 text-zinc-300 hover:border-white/20 hover:bg-zinc-800/30'
                }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <Upload className="w-4 h-4 text-[#24A1DE]" />
                {isUploadingAvatar ? t('profileAvatarUploading') : t('profileAvatarDropTitle')}
              </div>
              <div className="text-xs mt-1 text-zinc-400">
                {t('profileAvatarDropHint')}
              </div>
            </div>

            {(avatarPreviewDataUrl || /^https?:\/\//i.test(profileAvatarUrl)) && (
              <div className="mt-2 rounded-lg border border-white/10 bg-zinc-950/60 p-2 w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarPreviewDataUrl || profileAvatarUrl}
                  alt={t('profileAvatarPreviewAlt')}
                  className="w-16 h-16 rounded-md object-cover bg-zinc-900/60 border border-white/10"
                />
              </div>
            )}

            {profileAvatarUrl && (
              <p className="text-[11px] text-zinc-500 mt-2 break-all">
                {t('profileAvatarStoredPath')}: <code>{profileAvatarUrl}</code>
              </p>
            )}
            {avatarUploadError && (
              <p className="text-xs text-red-300 mt-1.5">{avatarUploadError}</p>
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
      <div className="px-1">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400">
          {t('requiredSectionTitle')}
        </div>
        <div className="mt-1 text-sm text-zinc-500">
          {t('requiredSectionDesc')}
        </div>
      </div>

      <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <Key className="w-4 h-4 text-[#24A1DE]" />
          </div>
          {t('telegramIntegration')}
          <HelpGuideButton
            guideKey={HELP_GUIDE_KEYS.editorSettingsTelegramIntegration}
            title={t('telegramIntegration')}
            summary={t('help.tokenSummary')}
            steps={[t('help.tokenStep1'), t('help.tokenStep2'), t('help.tokenStep3')]}
            docsHref={docsDataSecurity}
            className="ml-1"
          />
        </h2>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Label htmlFor="telegram-token" className="text-white">{t('botToken')}</Label>
              <HelpGuideButton
                guideKey={HELP_GUIDE_KEYS.editorSettingsBotToken}
                title={t('botToken')}
                summary={t('help.tokenSummary')}
                steps={[t('help.tokenStep1'), t('help.tokenStep2'), t('help.tokenStep3')]}
                notes={[t('botTokenStoredSecurely')]}
                docsHref={docsDataSecurity}
              />
            </div>
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
                autoComplete="new-password"
                data-lpignore="true"
                data-form-type="other"
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

      <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
        <span dangerouslySetInnerHTML={{ __html: t('changesSavedBy', { button: `<span class="text-white">${t('save')}</span>` }) }} />
      </div>
    </div>
  )
}
