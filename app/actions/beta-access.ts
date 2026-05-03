'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClientWrapper } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/admin/admin-auth'
import {
  getAdminEmailSettings,
  saveAdminEmailSettings,
  sendAdminEmail,
  verifyImapConnection,
  verifySmtpConnection,
  type AdminEmailSettingsForm,
  type AdminEmailSettingsView,
} from '@/lib/admin/email-settings'

export type BetaRequestStatus = 'pending' | 'approved' | 'rejected'

export type BetaAccessRequestView = {
  id: string
  userId: string
  email: string
  fullName: string | null
  status: BetaRequestStatus
  adminNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

type ActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string; code?: string }

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeName(fullName: string) {
  return fullName.trim().replace(/\s+/g, ' ')
}

function mapRequest(row: Record<string, unknown>): BetaAccessRequestView {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    fullName: typeof row.full_name === 'string' ? row.full_name : null,
    status: String(row.status) as BetaRequestStatus,
    adminNote: typeof row.admin_note === 'string' ? row.admin_note : null,
    reviewedBy: typeof row.reviewed_by === 'string' ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === 'string' ? row.reviewed_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function submitBetaAccessRequest(input: {
  fullName: string
  email: string
  password: string
  locale?: string
}): Promise<ActionResult<{ status: BetaRequestStatus }>> {
  const fullName = normalizeName(input.fullName)
  const email = normalizeEmail(input.email)
  const password = input.password
  const locale = input.locale === 'en' ? 'en' : 'ru'

  if (!fullName || !email || password.length < 6) {
    return { success: false, error: 'INVALID_INPUT', code: 'INVALID_INPUT' }
  }

  try {
    const admin = createAdminClient()

    const { data: accessControls } = await admin
      .from('app_access_controls')
      .select('registration_mode')
      .eq('id', 1)
      .maybeSingle()

    if (accessControls?.registration_mode !== 'beta_request') {
      return { success: false, error: 'BETA_REQUEST_CLOSED', code: 'BETA_REQUEST_CLOSED' }
    }

    const { data: existingRequest } = await admin
      .from('beta_access_requests')
      .select('status')
      .ilike('email', email)
      .maybeSingle()

    if (existingRequest?.status === 'pending' || existingRequest?.status === 'approved') {
      return { success: true, data: { status: existingRequest.status } }
    }

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, access_status')
      .ilike('email', email)
      .maybeSingle()

    if (existingProfile?.access_status === 'active') {
      return { success: true, data: { status: 'approved' } }
    }

    let userId = existingProfile?.id || null

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          language: locale,
          access_status: 'beta_pending',
        },
      })

      if (createError || !created.user) {
        return {
          success: false,
          error: createError?.message || 'CREATE_USER_FAILED',
          code: 'CREATE_USER_FAILED',
        }
      }

      userId = created.user.id
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        access_status: 'beta_pending',
        language: locale,
      } as never)

    if (profileError) {
      return { success: false, error: profileError.message, code: 'PROFILE_UPDATE_FAILED' }
    }

    const requestPayload: Record<string, unknown> = {
      user_id: userId,
      email,
      full_name: fullName,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
    }

    if (existingRequest?.status === 'rejected') {
      requestPayload.admin_note = null
    }

    const { error: requestError } = await admin
      .from('beta_access_requests')
      .upsert(requestPayload as never, { onConflict: 'email' })

    if (requestError) {
      return { success: false, error: requestError.message, code: 'REQUEST_SAVE_FAILED' }
    }

    return { success: true, data: { status: 'pending' } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      code: 'UNKNOWN_ERROR',
    }
  }
}

export async function getBetaAccessRequestsAction(): Promise<ActionResult<BetaAccessRequestView[]>> {
  try {
    await requireAdminUser()
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('beta_access_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return { success: true, data: (data || []).map((row) => mapRequest(row as Record<string, unknown>)) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function reviewBetaAccessRequestAction(input: {
  requestId: string
  status: 'approved' | 'rejected'
  adminNote?: string
  locale?: string
}): Promise<ActionResult<BetaAccessRequestView>> {
  try {
    const adminUser = await requireAdminUser()
    const admin = createAdminClient()
    const { data: request, error: requestError } = await admin
      .from('beta_access_requests')
      .select('*')
      .eq('id', input.requestId)
      .maybeSingle()

    if (requestError || !request) {
      throw new Error(requestError?.message || 'REQUEST_NOT_FOUND')
    }

    const nextAccessStatus = input.status === 'approved' ? 'active' : 'rejected'
    const [{ error: profileError }, { data: updatedRequest, error: updateError }] = await Promise.all([
      admin
        .from('profiles')
        .update({ access_status: nextAccessStatus } as never)
        .eq('id', request.user_id),
      admin
        .from('beta_access_requests')
        .update({
          status: input.status,
          admin_note: input.adminNote?.trim() || null,
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq('id', input.requestId)
        .select('*')
        .single(),
    ])

    if (profileError) throw profileError
    if (updateError) throw updateError

    if (input.status === 'approved') {
      const isEnglish = input.locale === 'en'
      const subject = isEnglish ? 'CBTooll beta access approved' : 'Доступ к CBTooll открыт'
      const text = isEnglish
        ? 'Your CBTooll beta access has been approved. You can now sign in with the email and password you used in the request.'
        : 'Ваш доступ к бета-тестированию CBTooll одобрен. Теперь вы можете войти с email и паролем, которые указали в заявке.'
      await sendAdminEmail({
        to: request.email,
        subject,
        text,
        html: `<p>${text}</p>`,
      })
    }

    revalidatePath('/ru/dashboard/admin')
    revalidatePath('/en/dashboard/admin')

    return { success: true, data: mapRequest(updatedRequest as Record<string, unknown>) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function getAdminEmailSettingsAction(): Promise<ActionResult<AdminEmailSettingsView>> {
  try {
    await requireAdminUser()
    const settings = await getAdminEmailSettings()
    return { success: true, data: settings }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function saveAdminEmailSettingsAction(
  input: AdminEmailSettingsForm
): Promise<ActionResult<AdminEmailSettingsView>> {
  try {
    const adminUser = await requireAdminUser()
    await saveAdminEmailSettings(input, adminUser.id)
    const settings = await getAdminEmailSettings()
    return { success: true, data: settings }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function testAdminEmailConnectionAction(kind: 'smtp' | 'imap'): Promise<ActionResult> {
  try {
    await requireAdminUser()
    if (kind === 'smtp') {
      await verifySmtpConnection()
    } else {
      await verifyImapConnection()
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }
  }
}

export async function logoutFromPendingAccessAction(): Promise<ActionResult> {
  try {
    const supabase = await createServerClientWrapper()
    await supabase.auth.signOut()
    return { success: true }
  } catch {
    return { success: false, error: 'UNKNOWN_ERROR' }
  }
}
