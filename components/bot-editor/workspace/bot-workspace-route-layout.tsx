import { redirect } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { BotStateProvider } from '@/components/bot-editor/providers/bot-state-provider'
import { EditorHelpGuidesProvider } from '@/components/bot-editor/providers/editor-help-guides-provider'
import { BotWorkspaceShell } from '@/components/bot-editor/layout/bot-workspace-shell'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getViewerAccess } from '@/lib/billing/server'
import { getPublishedSanityHelpGuideMap } from '@/lib/sanity/help-guides'
import { getAppAccessControls } from '@/lib/admin-access/server'
import { createDefaultAppAccessControls } from '@/lib/admin-access/config'
import type { HelpGuideLocale } from '@/lib/bot-editor/help/help-guide-types'

interface BotWorkspaceRouteLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string; botId: string }>
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export async function BotWorkspaceRouteLayout({
  children,
  params,
}: BotWorkspaceRouteLayoutProps) {
  const { botId, locale } = await params
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const botPromise = botService.getBot(botId)
  const botsPromise = botService.getUserBots(user.id)
  const viewerAccessPromise = getViewerAccess(user.id)
  const profilePromise = supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()
  const helpGuideLocale: HelpGuideLocale = locale === 'en' ? 'en' : 'ru'
  const helpGuidesPromise = getPublishedSanityHelpGuideMap(helpGuideLocale)
  const accessControlsPromise = withTimeout(getAppAccessControls(), 2500, createDefaultAppAccessControls())
  const messagesPromise = getMessages()
  const [bot, bots, viewerAccess, profileResult, helpGuides, accessControls, messages] = await Promise.all([
    botPromise,
    botsPromise,
    viewerAccessPromise,
    profilePromise,
    helpGuidesPromise,
    accessControlsPromise,
    messagesPromise,
  ])

  if (!bot) {
    redirect(`/${locale}/workspace`)
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
    <NextIntlClientProvider locale={locale} messages={messages}>
      <EditorHelpGuidesProvider guides={helpGuides}>
        <BotStateProvider
          initialBot={bot}
          viewerAccess={viewerAccess}
          initialViewerProfile={initialViewerProfile}
        >
          <BotWorkspaceShell
            botId={botId}
            viewerAccess={viewerAccess}
            accessControls={accessControls}
            bots={bots}
          >
            {children}
          </BotWorkspaceShell>
        </BotStateProvider>
      </EditorHelpGuidesProvider>
    </NextIntlClientProvider>
  )
}
