import { redirect } from 'next/navigation'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'

export default async function BotEditorPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>
}) {
  const { botId, locale } = await params
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bot = await botService.getBot(botId)

  if (!bot) {
    redirect(`/${locale}/dashboard/bots`)
  }

  redirect(`/${locale}/dashboard/bots/${botId}/editor/ai-chat`)
}
