import { AuthEntryPage } from '@/components/auth/auth-entry-page'

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

  return <AuthEntryPage initialMode={resolveInitialMode(mode)} />
}
