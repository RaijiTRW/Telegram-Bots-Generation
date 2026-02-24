'use server'

import { createServerClientWrapper } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type DeleteAccountResult =
  | { success: true }
  | { success: false; error: 'UNAUTHORIZED' | 'DELETE_FAILED' | 'UNKNOWN' }

export async function deleteCurrentUserAccount(): Promise<DeleteAccountResult> {
  try {
    const supabase = await createServerClientWrapper()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { success: false, error: 'UNAUTHORIZED' }
    }

    const admin = createAdminClient()
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      return { success: false, error: 'DELETE_FAILED' }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'UNKNOWN' }
  }
}
