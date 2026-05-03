import 'server-only'

import { createServerClientWrapper } from '@/lib/supabase/server'

export async function requireAdminUser() {
  const supabase = await createServerClientWrapper()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('UNAUTHORIZED')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  return user
}
