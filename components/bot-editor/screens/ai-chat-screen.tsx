'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { AiChatPanel } from '@/components/bot-editor/chat/ai-chat-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'

export default function AiChatPage() {
  const locale = useLocale()
  const t = useTranslations('editor.chat')
  const { viewerAccess, bot } = useBotState()
  const canUseAiChat = viewerAccess.isAdmin
  const backHref = bot?.id
    ? `/${locale}/dashboard/bots/${bot.id}/editor/canvas`
    : `/${locale}/dashboard`

  if (!canUseAiChat) {
    return (
      <div className="p-6">
        <Card className="border-amber-500/30 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-amber-300" />
              {t('lockedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>{t('lockedDescription')}</p>
            <Button asChild>
              <Link href={backHref}>
                {t('backToEditor')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AiChatPanel />
}
