import { redirect } from 'next/navigation'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { BotStateProvider } from '@/components/bot-editor/providers/bot-state-provider'
import { EditorShell } from '@/components/bot-editor/layout/editor-shell'
import { createBotService } from '@/lib/bot-editor/services/bot-service'

export default async function BotEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; botId: string }>
}) {
  const user = await getServerUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { botId, locale } = await params

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bot = await botService.getBot(botId)

  if (!bot) {
    redirect(`/${locale}/dashboard/bots`)
  }

  return (
    <BotStateProvider initialBot={bot}>
      <EditorShell botId={botId}>
        {children}
      </EditorShell>
    </BotStateProvider>
  )
}
