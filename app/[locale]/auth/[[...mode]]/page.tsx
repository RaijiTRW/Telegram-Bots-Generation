import { AuthEntryPage } from '@/components/auth/auth-entry-page'
import { getAppAccessControls } from '@/lib/admin-access/server'

type AuthMode = 'login' | 'signup'

function resolveInitialMode(mode?: string[]): AuthMode {
  if (mode?.[0] === 'signup') {
    return 'signup'
  }
  return 'login'
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ locale: string; mode?: string[] }>
}) {
  const { mode } = await params
  const requestedMode = resolveInitialMode(mode)
  const accessControls = await getAppAccessControls()
  const initialMode = !accessControls.registrationOpen && requestedMode === 'signup'
    ? 'login'
    : requestedMode

  return (
    <AuthEntryPage
      initialMode={initialMode}
      requestedMode={requestedMode}
      registrationOpen={accessControls.registrationOpen}
    />
  )
}
