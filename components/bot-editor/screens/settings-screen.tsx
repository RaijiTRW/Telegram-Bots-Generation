'use client'

import { useSyncExternalStore } from 'react'
import { Settings } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { BotSettingsForm } from '@/components/bot-editor/settings/bot-settings-form'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import { HELP_GUIDE_KEYS } from '@/lib/bot-editor/help/help-guide-keys'

export default function SettingsPage() {
  const tNav = useTranslations('editor.nav')
  const tHelp = useTranslations('editor.settings.help')
  const locale = useLocale()
  const docsBasePath = `/${locale}/dashboard/docs`
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="text-white font-semibold">{tNav('settings')}</h1>
          <HelpGuideButton
            guideKey={HELP_GUIDE_KEYS.editorSettingsOverview}
            title={tNav('settings')}
            summary={tHelp('overviewSummary')}
            steps={[tHelp('overviewStep1'), tHelp('overviewStep2'), tHelp('overviewStep3')]}
            notes={[tHelp('overviewNote')]}
            docsHref={`${docsBasePath}/how-it-works#editor-areas`}
          />
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{tNav('settingsDesc')}</span>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          {isMounted ? (
            <BotSettingsForm />
          ) : (
            <div className="space-y-4" suppressHydrationWarning>
              <div className="h-24 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
              <div className="h-48 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
              <div className="h-24 rounded-xl border border-white/10 bg-zinc-900/40 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
