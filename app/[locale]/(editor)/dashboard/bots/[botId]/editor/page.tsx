import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'

function getWorkspaceSectionForMode(value: string | undefined) {
  return value === 'editor' ? 'canvas' : 'ai-chat'
}

function getWorkspaceModeQuery(value: string | undefined) {
  return value === 'crm' ? '?workspaceMode=crm' : ''
}

export default async function LegacyBotEditorPage({
  params,
}: {
  params: Promise<{ locale: string; botId: string }>
}) {
  const { botId, locale } = await params
  const cookieStore = await cookies()
  const lastWorkspaceMode = cookieStore.get(LAST_WORKSPACE_MODE_COOKIE)?.value
  const workspaceSection = getWorkspaceSectionForMode(lastWorkspaceMode)

  redirect(`/${locale}/workspace/bots/${botId}/editor/${workspaceSection}${getWorkspaceModeQuery(lastWorkspaceMode)}`)
}
