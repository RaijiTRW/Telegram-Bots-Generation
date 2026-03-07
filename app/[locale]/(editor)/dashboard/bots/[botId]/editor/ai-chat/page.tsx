import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AiChatPanel } from '@/components/bot-editor/chat/ai-chat-panel'
import { getServerUser } from '@/lib/supabase/server'
import { getViewerAccess } from '@/lib/billing/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>
}) {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { locale, botId } = await params
  const viewerAccess = await getViewerAccess(user.id)

  if (!(viewerAccess.isAdmin || viewerAccess.entitlements.aiChat)) {
    return (
      <div className="p-6">
        <Card className="border-amber-500/30 bg-zinc-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-amber-300" />
              {locale === 'en' ? 'AI Chat requires Enterprise' : 'AI Chat доступен на Enterprise'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>
              {locale === 'en'
                ? 'Upgrade the subscription to Enterprise to use AI Chat inside the editor.'
                : 'Переключите подписку на Enterprise, чтобы использовать AI Chat внутри редактора.'}
            </p>
            <Button asChild>
              <Link href={`/${locale}/dashboard/subscription`}>
                {locale === 'en' ? 'Open subscription' : 'Открыть подписку'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AiChatPanel />
}
