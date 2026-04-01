import { redirect } from 'next/navigation'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { BotStateProvider } from '@/components/bot-editor/providers/bot-state-provider'
import { EditorHelpGuidesProvider } from '@/components/bot-editor/providers/editor-help-guides-provider'
import { EditorShell } from '@/components/bot-editor/layout/editor-shell'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getViewerAccess } from '@/lib/billing/server'
import { getPublishedSanityHelpGuideMap } from '@/lib/sanity/help-guides'
import type { HelpGuideLocale } from '@/lib/bot-editor/help/help-guide-types'

export default async function BotEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode
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
  const viewerAccess = await getViewerAccess(user.id)
  const helpGuideLocale: HelpGuideLocale = locale === 'en' ? 'en' : 'ru'
  const helpGuides = await getPublishedSanityHelpGuideMap(helpGuideLocale)

  return (
    <EditorHelpGuidesProvider guides={helpGuides}>
      <BotStateProvider initialBot={bot} viewerAccess={viewerAccess}>
        <EditorShell botId={botId} viewerAccess={viewerAccess}>
          {children}
        </EditorShell>
      </BotStateProvider>
    </EditorHelpGuidesProvider>
  )
}
