'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Bot as BotIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { Bot, BotStatus } from '@/lib/bot-editor/types/bot.types'

type BotStatusTranslationKey = `status.${BotStatus}`

interface BotProjectCardProps {
  bot: Bot
  onOpen: () => void
  onPrefetch?: () => void
  trailing?: ReactNode
  className?: string
}

function getStatusColor(status: BotStatus) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'draft':
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    case 'archived':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'error':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
  }
}

export function BotProjectCard({
  bot,
  onOpen,
  onPrefetch,
  trailing,
  className = '',
}: BotProjectCardProps) {
  const t = useTranslations('dashboard.bots')
  const uiLocale = useLocale()

  return (
    <Card
      onClick={onOpen}
      onDoubleClick={onOpen}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      className={`group relative cursor-pointer overflow-hidden border-zinc-800 bg-zinc-900/50 backdrop-blur-sm transition-all hover:border-[#24A1DE]/50 ${className}`.trim()}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#24A1DE]/5 to-[#8B5CF6]/5 opacity-0 transition-opacity group-hover:opacity-100" />

      <CardContent className="relative p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="rounded-xl border border-[#24A1DE]/30 bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 p-2.5">
            <BotIcon className="h-5 w-5 text-[#24A1DE]" />
          </div>
          {trailing ? <div className="relative shrink-0">{trailing}</div> : null}
        </div>

        <h3 className="mb-1 line-clamp-1 text-lg font-semibold text-white">
          {bot.name}
        </h3>
        <p className="mb-4 min-h-[40px] line-clamp-2 text-sm text-zinc-400">
          {bot.description || t('noDescription')}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full border px-2 py-1 text-xs ${getStatusColor(bot.status)}`}>
            {t(`status.${bot.status}` as BotStatusTranslationKey)}
          </span>
          <span className="text-xs text-zinc-500">
            {bot.updatedAt
              ? new Intl.DateTimeFormat(uiLocale, { dateStyle: 'short', timeZone: 'UTC' }).format(
                  new Date(bot.updatedAt)
                )
              : t('new')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
