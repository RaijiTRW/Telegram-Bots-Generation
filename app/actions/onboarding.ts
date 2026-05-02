'use server'

import { createServerClientWrapper, getServerUser } from '@/lib/supabase/server'

export type OnboardingScope = 'dashboard' | 'editor'

type OnboardingColumn = 'dashboard_onboarding_seen' | 'editor_onboarding_seen'

const scopeToColumn = (scope: OnboardingScope): OnboardingColumn =>
  scope === 'dashboard' ? 'dashboard_onboarding_seen' : 'editor_onboarding_seen'

export async function getOnboardingStatusAction(scope: OnboardingScope) {
  try {
    const user = await getServerUser()
    if (!user) {
      return { success: false as const, error: 'Not authenticated' as const }
    }

    const supabase = await createServerClientWrapper()
    const { data, error } = await supabase
      .from('profiles')
      .select('dashboard_onboarding_seen, editor_onboarding_seen')
      .eq('id', user.id)
      .single()

    if (error) {
      return { success: false as const, error: String(error.message || error) }
    }

    return {
      success: true as const,
      seen: scope === 'dashboard'
        ? Boolean(data?.dashboard_onboarding_seen)
        : Boolean(data?.editor_onboarding_seen),
    }
  } catch (error) {
    return { success: false as const, error: String(error) }
  }
}

export async function markOnboardingSeenAction(scope: OnboardingScope) {
  try {
    const user = await getServerUser()
    if (!user) {
      return { success: false as const, error: 'Not authenticated' as const }
    }

    const column = scopeToColumn(scope)
    const supabase = await createServerClientWrapper()
    const { error } = await supabase
      .from('profiles')
      .update({
        [column]: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      return { success: false as const, error: String(error.message || error) }
    }

    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: String(error) }
  }
}
