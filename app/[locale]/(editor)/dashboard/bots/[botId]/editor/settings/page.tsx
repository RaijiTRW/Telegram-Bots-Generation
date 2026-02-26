'use client'

import { Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BotSettingsForm } from '@/components/bot-editor/settings/bot-settings-form'

export default function SettingsPage() {
  const tNav = useTranslations('editor.nav')
  return (
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="text-white font-semibold">{tNav('settings')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{tNav('settingsDesc')}</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto">
          <BotSettingsForm />
        </div>
      </div>
    </div>
  )
}
