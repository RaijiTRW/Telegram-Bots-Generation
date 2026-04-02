import { cache } from 'react'
import { createServerClientWrapper } from '@/lib/supabase/server'
import { createDefaultAppAccessControls, parseAppAccessControls } from '@/lib/admin-access/config'

export const getAppAccessControls = cache(async () => {
  try {
    const supabase = await createServerClientWrapper()
    const { data } = await supabase
      .from('app_access_controls')
      .select('registration_open, maintenance_scope, maintenance_title, maintenance_message, dashboard_overrides')
      .eq('id', 1)
      .maybeSingle()

    return parseAppAccessControls(data)
  } catch {
    return createDefaultAppAccessControls()
  }
})
