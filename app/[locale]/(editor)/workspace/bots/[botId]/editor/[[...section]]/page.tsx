import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AiChatScreen from '@/components/bot-editor/screens/ai-chat-screen'
import CanvasScreen from '@/components/bot-editor/screens/canvas-screen'
import SettingsScreen from '@/components/bot-editor/screens/settings-screen'
import DatabaseScreen from '@/components/bot-editor/screens/database-screen'
import SystemScreen from '@/components/bot-editor/screens/system-screen'
import StatisticsScreen from '@/components/bot-editor/screens/statistics-screen'
import AiAgentsScreen from '@/components/bot-editor/screens/ai-agents-screen'

const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'

function getWorkspaceSectionForMode(value: string | undefined) {
  return value === 'editor' ? 'canvas' : 'ai-chat'
}

function getWorkspaceModeQuery(value: string | undefined) {
  return value === 'crm' ? '?workspaceMode=crm' : ''
}

export default async function WorkspaceBotEditorPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string; section?: string[] }>
}) {
  const { locale, botId, section } = await params
  const activeSection = section?.[0]

  if (!activeSection) {
    const cookieStore = await cookies()
    const lastWorkspaceMode = cookieStore.get(LAST_WORKSPACE_MODE_COOKIE)?.value
    const workspaceSection = getWorkspaceSectionForMode(lastWorkspaceMode)

    redirect(`/${locale}/workspace/bots/${botId}/editor/${workspaceSection}${getWorkspaceModeQuery(lastWorkspaceMode)}`)
  }

  if (activeSection === 'quick-start') {
    redirect(`/${locale}/workspace/bots/${botId}/editor/ai-chat`)
  }

  if (activeSection === 'canvas') return <CanvasScreen />
  if (activeSection === 'settings') return <SettingsScreen />
  if (activeSection === 'database') return <DatabaseScreen />
  if (activeSection === 'system') return <SystemScreen />
  if (activeSection === 'statistics') return <StatisticsScreen />
  if (activeSection === 'ai-agents') return <AiAgentsScreen />

  return <AiChatScreen />
}
