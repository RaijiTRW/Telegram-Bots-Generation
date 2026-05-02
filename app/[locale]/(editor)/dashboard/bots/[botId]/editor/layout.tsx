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
  const botPromise = botService.getBot(botId)
  const viewerAccessPromise = getViewerAccess(user.id)
  const profilePromise = supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  const helpGuideLocale: HelpGuideLocale = locale === 'en' ? 'en' : 'ru'
  const helpGuidesPromise = getPublishedSanityHelpGuideMap(helpGuideLocale)
  const [bot, viewerAccess, profileResult, helpGuides] = await Promise.all([
    botPromise,
    viewerAccessPromise,
    profilePromise,
    helpGuidesPromise,
  ])

  if (!bot) {
    redirect(`/${locale}/dashboard/bots`)
  }
  const userMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : {}
  const fallbackFullName =
    typeof userMetadata.full_name === 'string' && userMetadata.full_name.trim()
      ? userMetadata.full_name.trim()
      : user.email?.split('@')[0] || null
  const fallbackAvatarUrl =
    typeof userMetadata.avatar_url === 'string' && userMetadata.avatar_url.trim()
      ? userMetadata.avatar_url.trim()
      : null
  const profileRow = profileResult.data
  const initialViewerProfile = {
    fullName:
      typeof profileRow?.full_name === 'string' && profileRow.full_name.trim()
        ? profileRow.full_name.trim()
        : fallbackFullName,
    avatarUrl:
      typeof profileRow?.avatar_url === 'string' && profileRow.avatar_url.trim()
        ? profileRow.avatar_url.trim()
        : fallbackAvatarUrl,
  }

  return (
    <EditorHelpGuidesProvider guides={helpGuides}>
      <BotStateProvider
        initialBot={bot}
        viewerAccess={viewerAccess}
        initialViewerProfile={initialViewerProfile}
      >
        <EditorShell botId={botId} viewerAccess={viewerAccess}>
          {children}
        </EditorShell>
      </BotStateProvider>
    </EditorHelpGuidesProvider>
  )
}
