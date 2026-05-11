'use client'

import { Bot, Sparkles, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'

export default function AiAgentsScreen() {
  const tNav = useTranslations('editor.nav')
  const { isAdmin } = useBotState()

  if (!isAdmin) {
    return (
      <div className="flex h-full w-full min-w-0 flex-col bg-[#05070A]">
        <header className="shrink-0 border-b border-white/8 bg-[#06080D]/90 px-6 backdrop-blur-xl">
          <div className="flex h-16 min-w-0 items-center gap-3">
            <Bot className="h-4 w-4 shrink-0 text-[#24A1DE]" />
            <h1 className="truncate font-semibold text-white">{tNav('aiAgents')}</h1>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
              {tNav('soonBadge')}
            </span>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/[0.03] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-200">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">{tNav('aiAgentsLockedTitle')}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{tNav('aiAgentsLocked')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-[#05070A]">
      <header className="shrink-0 border-b border-white/8 bg-[#06080D]/90 px-6 backdrop-blur-xl">
        <div className="flex h-16 min-w-0 items-center gap-3">
          <Bot className="h-4 w-4 shrink-0 text-[#24A1DE]" />
          <h1 className="truncate font-semibold text-white">{tNav('aiAgents')}</h1>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.08),transparent_38%),rgba(255,255,255,0.03)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 text-[#24A1DE] ring-1 ring-[#24A1DE]/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">{tNav('soonBadge')}</div>
              <h2 className="text-2xl font-semibold text-white">{tNav('aiAgentsTitle')}</h2>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-300">
            {tNav('aiAgentsComingSoon')}
          </p>
        </div>
      </div>
    </div>
  )
}
