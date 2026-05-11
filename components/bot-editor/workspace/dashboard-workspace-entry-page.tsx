import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardWorkspaceEmpty } from '@/components/bot-editor/workspace/dashboard-workspace-empty'
import { DashboardWorkspaceRedirect } from '@/components/bot-editor/workspace/dashboard-workspace-redirect'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import type { DashboardSection } from '@/components/dashboard/layout/dashboard-section-viewport'

const LAST_BOT_COOKIE = 'cbtooll:lastBotId'
const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'
const GLOBAL_SETTINGS_SECTIONS = new Set<DashboardSection>([
  'statistics',
  'subscription',
  'admin',
  'profile',
  'settings',
])

function getGlobalSettingsQuery(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue || !GLOBAL_SETTINGS_SECTIONS.has(rawValue as DashboardSection)) {
    return ''
  }

  return `?globalSettings=${encodeURIComponent(rawValue)}`
}

function getWorkspaceSectionForMode(value: string | undefined) {
  return value === 'editor' ? 'canvas' : 'ai-chat'
}

function getWorkspaceModeQuery(value: string | undefined) {
  return value === 'crm' ? '?workspaceMode=crm' : ''
}

export async function DashboardWorkspaceEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ globalSettings?: string | string[] }>
}) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const globalSettingsQuery = getGlobalSettingsQuery(resolvedSearchParams?.globalSettings)
  const user = await getServerUser()

  if (!user) {
    redirect(`/${locale}/auth/login`)
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bots = await botService.getUserBots(user.id)

  if (bots.length === 0) {
    return <DashboardWorkspaceEmpty />
  }

  const cookieStore = await cookies()
  const lastBotId = cookieStore.get(LAST_BOT_COOKIE)?.value || ''
  const lastWorkspaceMode = cookieStore.get(LAST_WORKSPACE_MODE_COOKIE)?.value
  const workspaceSection = getWorkspaceSectionForMode(lastWorkspaceMode)
  const workspaceModeQuery = getWorkspaceModeQuery(lastWorkspaceMode)
  const workspaceQuery = [workspaceModeQuery.slice(1), globalSettingsQuery.slice(1)].filter(Boolean).join('&')
  const cookieBot = bots.find((bot) => bot.id === lastBotId)

  if (cookieBot) {
    redirect(`/${locale}/workspace/bots/${cookieBot.id}/editor/${workspaceSection}${workspaceQuery ? `?${workspaceQuery}` : ''}`)
  }

  return (
    <DashboardWorkspaceRedirect
      locale={locale}
      botIds={bots.map((bot) => bot.id)}
      fallbackBotId={bots[0].id}
      fallbackWorkspaceSection={workspaceSection}
      globalSettingsQuery={workspaceQuery ? `?${workspaceQuery}` : ''}
    />
  )
}
