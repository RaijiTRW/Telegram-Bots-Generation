import 'server-only'

import { createServerClientWrapper } from '@/lib/supabase/server'

export type ProfileAccessStatus = 'active' | 'beta_pending' | 'rejected'

export async function getCurrentProfileAccessStatus(userId: string): Promise<ProfileAccessStatus> {
  const supabase = await createServerClientWrapper()
  const { data } = await supabase
    .from('profiles')
    .select('access_status')
    .eq('id', userId)
    .maybeSingle()

  const status = data?.access_status
  if (status === 'beta_pending' || status === 'rejected') {
    return status
  }

  return 'active'
}
