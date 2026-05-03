'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getSafeClientUser } from '@/lib/supabase/client-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { AdminAccessControlsCard } from '@/components/admin/admin-access-controls-card'
import {
  getAdminEmailSettingsAction,
  getBetaAccessRequestsAction,
  reviewBetaAccessRequestAction,
  saveAdminEmailSettingsAction,
  testAdminEmailConnectionAction,
  type BetaAccessRequestView,
} from '@/app/actions/beta-access'
import {
  type AppAccessControls,
  createDefaultAppAccessControls,
  parseAppAccessControls,
  serializeAppAccessControls,
} from '@/lib/admin-access/config'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Mail,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  SlidersHorizontal,
  TimerReset,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'

type Notice = {
  type: 'success' | 'error'
  text: string
} | null

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'admin'
  access_status?: 'active' | 'beta_pending' | 'rejected'
  created_at: string
  updated_at: string
}

type ProfilesTableClient = {
  update: (values: { role: 'user' | 'admin' }) => {
    eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>
  }
}

type AdminStats = {
  onlineNow: number
  registeredToday: number
  landingViewsToday: number
}

type AdminEmailSettingsView = {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpFrom: string
  smtpPasswordConfigured: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  imapPasswordConfigured: boolean
}

type AppAccessControlsTableClient = {
  upsert: (
    values: Record<string, unknown>
  ) => {
    select: (
      columns: string
    ) => {
      single: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>
    }
  }
}

const emptyEmailSettings: AdminEmailSettingsView = {
  smtpHost: '',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpFrom: '',
  smtpPasswordConfigured: false,
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUser: '',
  imapPasswordConfigured: false,
}

export function DashboardAdminPageClient() {
  const t = useTranslations('dashboard.admin')
  const supabase = createClient()
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [betaRequests, setBetaRequests] = useState<BetaAccessRequestView[]>([])
  const [betaSearchQuery, setBetaSearchQuery] = useState('')
  const [betaStatusFilter, setBetaStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [emailSettings, setEmailSettings] = useState<AdminEmailSettingsView>(emptyEmailSettings)
  const [smtpPassword, setSmtpPassword] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false)
  const [testingEmailKind, setTestingEmailKind] = useState<'smtp' | 'imap' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState<Notice>(null)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [accessControls, setAccessControls] = useState<AppAccessControls>(createDefaultAppAccessControls())
  const [isSavingAccessControls, setIsSavingAccessControls] = useState(false)
  const [stats, setStats] = useState<AdminStats>({
    onlineNow: 0,
    registeredToday: 0,
    landingViewsToday: 0,
  })

  const filteredProfiles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return profiles
    return profiles.filter((profile) => {
      const name = (profile.full_name || '').toLowerCase()
      const email = (profile.email || '').toLowerCase()
      const id = profile.id.toLowerCase()
      return name.includes(normalized) || email.includes(normalized) || id.includes(normalized)
    })
  }, [profiles, searchQuery])

  const filteredBetaRequests = useMemo(() => {
    const normalized = betaSearchQuery.trim().toLowerCase()
    return betaRequests.filter((request) => {
      if (betaStatusFilter !== 'all' && request.status !== betaStatusFilter) {
        return false
      }
      if (!normalized) return true
      return (
        request.email.toLowerCase().includes(normalized) ||
        (request.fullName || '').toLowerCase().includes(normalized)
      )
    })
  }, [betaRequests, betaSearchQuery, betaStatusFilter])

  const fetchStats = useCallback(async () => {
    try {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const startOfTodayIso = startOfToday.toISOString()
      const onlineBoundaryIso = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      const [onlineResult, registeredTodayResult, landingViewsResult] = await Promise.all([
        supabase
          .from('user_presence')
          .select('user_id', { head: true, count: 'exact' })
          .gte('last_seen_at', onlineBoundaryIso),
        supabase
          .from('profiles')
          .select('id', { head: true, count: 'exact' })
          .gte('created_at', startOfTodayIso),
        supabase
          .from('landing_page_views')
          .select('id', { head: true, count: 'exact' })
          .gte('created_at', startOfTodayIso),
      ])

      setStats({
        onlineNow: onlineResult.error ? 0 : onlineResult.count || 0,
        registeredToday: registeredTodayResult.error ? 0 : registeredTodayResult.count || 0,
        landingViewsToday: landingViewsResult.error ? 0 : landingViewsResult.count || 0,
      })
    } catch (error) {
      console.error('Failed to load admin stats:', error)
    }
  }, [supabase])

  const loadData = useCallback(async (withRefreshState = false) => {
    if (withRefreshState) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setStatus(null)

    try {
      const user = await getSafeClientUser(supabase)
      if (!user) {
        throw new Error('User not found')
      }

      setCurrentUserId(user.id)

      const [profilesResult, accessControlsResult, betaRequestsResult, emailSettingsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, role, access_status, created_at, updated_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('app_access_controls')
          .select('registration_open, registration_mode, maintenance_scope, maintenance_title, maintenance_message, dashboard_overrides')
          .eq('id', 1)
          .maybeSingle(),
        getBetaAccessRequestsAction(),
        getAdminEmailSettingsAction(),
      ])

      if (profilesResult.error) {
        throw profilesResult.error
      }

      setProfiles((profilesResult.data || []) as ProfileRow[])
      setAccessControls(parseAppAccessControls(accessControlsResult.data || null))
      if (betaRequestsResult.success) {
        setBetaRequests(betaRequestsResult.data)
      }
      if (emailSettingsResult.success) {
        setEmailSettings(emailSettingsResult.data)
      }
      await fetchStats()
    } catch (error) {
      console.error('Failed to load admin profiles:', error)
      setStatus({ type: 'error', text: t('loadError') })
      setProfiles([])
      setBetaRequests([])
      setEmailSettings(emptyEmailSettings)
      setAccessControls(createDefaultAppAccessControls())
      setStats({
        onlineNow: 0,
        registeredToday: 0,
        landingViewsToday: 0,
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [fetchStats, supabase, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchStats()
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [fetchStats])

  const handleToggleRole = async (profile: ProfileRow) => {
    if (savingProfileId) return
    const nextRole: 'user' | 'admin' = profile.role === 'admin' ? 'user' : 'admin'

    setSavingProfileId(profile.id)
    setStatus(null)

    try {
      const profilesTable = supabase.from('profiles') as unknown as ProfilesTableClient
      const { error } = await profilesTable
        .update({ role: nextRole })
        .eq('id', profile.id)

      if (error) {
        throw error
      }

      setProfiles((previous) =>
        previous.map((item) =>
          item.id === profile.id
            ? {
                ...item,
                role: nextRole,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      )
      setStatus({
        type: 'success',
        text: t('saveSuccess', { email: profile.email }),
      })
    } catch (error) {
      console.error('Failed to update profile role:', error)
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''
      const suffix = message ? ` (${message})` : ''
      setStatus({ type: 'error', text: `${t('saveError')}${suffix}` })
    } finally {
      setSavingProfileId(null)
    }
  }

  const adminsCount = profiles.filter((profile) => profile.role === 'admin').length
  const usersCount = profiles.length - adminsCount

  const handleSaveAccessControls = async () => {
    if (!currentUserId || isSavingAccessControls) {
      return
    }

    setIsSavingAccessControls(true)
    setStatus(null)

    try {
      const appAccessControlsTable = supabase.from('app_access_controls') as unknown as AppAccessControlsTableClient
      const payload = {
        ...serializeAppAccessControls(accessControls),
        updated_by: currentUserId,
      }
      const { data, error } = await appAccessControlsTable
        .upsert(payload)
        .select('registration_open, registration_mode, maintenance_scope, maintenance_title, maintenance_message, dashboard_overrides')
        .single()

      if (error) {
        throw error
      }

      setAccessControls(parseAppAccessControls(data))
      setStatus({ type: 'success', text: t('accessSaveSuccess') })
      router.refresh()
    } catch (error) {
      console.error('Failed to save access controls:', error)
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : ''
      const suffix = message ? ` (${message})` : ''
      setStatus({ type: 'error', text: `${t('accessSaveError')}${suffix}` })
    } finally {
      setIsSavingAccessControls(false)
    }
  }

  const handleReviewBetaRequest = async (
    request: BetaAccessRequestView,
    status: 'approved' | 'rejected'
  ) => {
    if (reviewingRequestId) return
    setReviewingRequestId(request.id)
    setStatus(null)

    try {
      const result = await reviewBetaAccessRequestAction({
        requestId: request.id,
        status,
        adminNote: request.adminNote || undefined,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      setBetaRequests((previous) =>
        previous.map((item) => (item.id === request.id ? result.data : item))
      )
      setStatus({
        type: 'success',
        text: status === 'approved' ? 'Заявка одобрена, письмо отправлено.' : 'Заявка отклонена.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setStatus({ type: 'error', text: `Не удалось обновить заявку${message ? ` (${message})` : ''}` })
    } finally {
      setReviewingRequestId(null)
    }
  }

  const handleSaveEmailSettings = async () => {
    if (isSavingEmailSettings) return
    setIsSavingEmailSettings(true)
    setStatus(null)

    try {
      const result = await saveAdminEmailSettingsAction({
        ...emailSettings,
        smtpPassword,
        imapPassword,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      setEmailSettings(result.data)
      setSmtpPassword('')
      setImapPassword('')
      setStatus({ type: 'success', text: 'Настройки почты сохранены.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setStatus({ type: 'error', text: `Не удалось сохранить почту${message ? ` (${message})` : ''}` })
    } finally {
      setIsSavingEmailSettings(false)
    }
  }

  const handleTestEmailConnection = async (kind: 'smtp' | 'imap') => {
    if (testingEmailKind) return
    setTestingEmailKind(kind)
    setStatus(null)

    try {
      const result = await testAdminEmailConnectionAction(kind)
      if (!result.success) {
        throw new Error(result.error)
      }
      setStatus({ type: 'success', text: kind === 'smtp' ? 'SMTP подключен.' : 'IMAP подключен.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setStatus({ type: 'error', text: `Проверка не прошла${message ? ` (${message})` : ''}` })
    } finally {
      setTestingEmailKind(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-10 flex items-center justify-center gap-3 text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-[#24A1DE]" />
            <span>{t('loading')}</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400 mt-1">{t('manage')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData(true)}
          disabled={isRefreshing}
          className="border-white/10 text-zinc-200 hover:bg-white/5"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {t('refresh')}
        </Button>
      </div>

      {status ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {status.text}
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/50 p-1.5">
          <TabsTrigger value="overview" className="gap-2 rounded-xl px-4 py-2.5">
            <BarChart3 className="h-4 w-4" />
            {t('tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2 rounded-xl px-4 py-2.5">
            <Settings2 className="h-4 w-4" />
            {t('tabAccess')}
          </TabsTrigger>
          <TabsTrigger value="beta" className="gap-2 rounded-xl px-4 py-2.5">
            <Clock3 className="h-4 w-4" />
            Бета-заявки
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2 rounded-xl px-4 py-2.5">
            <Mail className="h-4 w-4" />
            Почта
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-2 rounded-xl px-4 py-2.5">
            <Users className="h-4 w-4" />
            {t('tabProfiles')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsTotal')}</div>
                  <div className="text-xl font-semibold text-white">{profiles.length}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsAdmins')}</div>
                  <div className="text-xl font-semibold text-white">{adminsCount}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsUsers')}</div>
                  <div className="text-xl font-semibold text-white">{usersCount}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                  <TimerReset className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsOnlineNow')}</div>
                  <div className="text-xl font-semibold text-white">{stats.onlineNow}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{t('statsOnlineHint')}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsRegisteredToday')}</div>
                  <div className="text-xl font-semibold text-white">{stats.registeredToday}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{t('statsLandingViewsToday')}</div>
                  <div className="text-xl font-semibold text-white">{stats.landingViewsToday}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="access" className="mt-0">
          <AdminAccessControlsCard
            value={accessControls}
            isSaving={isSavingAccessControls}
            onChange={setAccessControls}
            onSave={() => void handleSaveAccessControls()}
          />
        </TabsContent>

        <TabsContent value="beta" className="mt-0">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock3 className="h-5 w-5 text-[#24A1DE]" />
                Бета-заявки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    value={betaSearchQuery}
                    onChange={(event) => setBetaSearchQuery(event.target.value)}
                    placeholder="Поиск по email или имени..."
                    className="pl-10 bg-zinc-900/70 border-white/10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={betaStatusFilter === filter ? 'default' : 'outline'}
                      onClick={() => setBetaStatusFilter(filter)}
                      className={betaStatusFilter === filter ? '' : 'border-white/10 text-zinc-200 hover:bg-white/5'}
                    >
                      {filter === 'pending'
                        ? 'На рассмотрении'
                        : filter === 'approved'
                          ? 'Одобрено'
                          : filter === 'rejected'
                            ? 'Отклонено'
                            : 'Все'}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredBetaRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-zinc-500">
                    Заявок нет.
                  </div>
                ) : (
                  filteredBetaRequests.map((request) => {
                    const isReviewing = reviewingRequestId === request.id
                    return (
                      <div key={request.id} className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {request.fullName || 'Без имени'}
                              </p>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                                  request.status === 'approved'
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                    : request.status === 'rejected'
                                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                }`}
                              >
                                {request.status === 'approved'
                                  ? 'approved'
                                  : request.status === 'rejected'
                                    ? 'rejected'
                                    : 'pending'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-400">{request.email}</p>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {new Date(request.createdAt).toLocaleString('ru-RU')}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleReviewBetaRequest(request, 'approved')}
                              disabled={isReviewing || request.status === 'approved'}
                              className="bg-emerald-600 text-white hover:bg-emerald-500"
                            >
                              {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Одобрить
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleReviewBetaRequest(request, 'rejected')}
                              disabled={isReviewing || request.status === 'rejected'}
                              className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                            >
                              Отклонить
                            </Button>
                          </div>
                        </div>
                        <Input
                          value={request.adminNote || ''}
                          onChange={(event) => {
                            const nextNote = event.target.value
                            setBetaRequests((previous) =>
                              previous.map((item) =>
                                item.id === request.id ? { ...item, adminNote: nextNote } : item
                              )
                            )
                          }}
                          placeholder="Заметка админа"
                          className="mt-3 bg-zinc-900/70 border-white/10"
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-0">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Mail className="h-5 w-5 text-[#24A1DE]" />
                Почта
              </CardTitle>
              <p className="text-sm text-zinc-400">
                SMTP отправляет письма об одобрении, IMAP нужен для проверки подключения почтового ящика.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                    <SlidersHorizontal className="h-4 w-4 text-[#24A1DE]" />
                    SMTP
                  </div>
                  <div className="grid gap-3">
                    <Input value={emailSettings.smtpHost} onChange={(event) => setEmailSettings((prev) => ({ ...prev, smtpHost: event.target.value }))} placeholder="SMTP host" />
                    <Input value={emailSettings.smtpPort} onChange={(event) => setEmailSettings((prev) => ({ ...prev, smtpPort: Number(event.target.value) || 465 }))} type="number" placeholder="SMTP port" />
                    <Input value={emailSettings.smtpUser} onChange={(event) => setEmailSettings((prev) => ({ ...prev, smtpUser: event.target.value }))} placeholder="SMTP user" />
                    <Input value={emailSettings.smtpFrom} onChange={(event) => setEmailSettings((prev) => ({ ...prev, smtpFrom: event.target.value }))} placeholder="From email" />
                    <Input value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} type="password" placeholder={emailSettings.smtpPasswordConfigured ? 'Новый пароль или оставить пустым' : 'SMTP password'} />
                    <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300">
                      Secure TLS
                      <Switch checked={emailSettings.smtpSecure} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, smtpSecure: checked }))} />
                    </label>
                    <Button type="button" variant="outline" onClick={() => void handleTestEmailConnection('smtp')} disabled={testingEmailKind === 'smtp'} className="border-white/10 text-zinc-200 hover:bg-white/5">
                      {testingEmailKind === 'smtp' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Проверить SMTP
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                    <SlidersHorizontal className="h-4 w-4 text-[#24A1DE]" />
                    IMAP
                  </div>
                  <div className="grid gap-3">
                    <Input value={emailSettings.imapHost} onChange={(event) => setEmailSettings((prev) => ({ ...prev, imapHost: event.target.value }))} placeholder="IMAP host" />
                    <Input value={emailSettings.imapPort} onChange={(event) => setEmailSettings((prev) => ({ ...prev, imapPort: Number(event.target.value) || 993 }))} type="number" placeholder="IMAP port" />
                    <Input value={emailSettings.imapUser} onChange={(event) => setEmailSettings((prev) => ({ ...prev, imapUser: event.target.value }))} placeholder="IMAP user" />
                    <Input value={imapPassword} onChange={(event) => setImapPassword(event.target.value)} type="password" placeholder={emailSettings.imapPasswordConfigured ? 'Новый пароль или оставить пустым' : 'IMAP password'} />
                    <label className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-300">
                      Secure TLS
                      <Switch checked={emailSettings.imapSecure} onCheckedChange={(checked) => setEmailSettings((prev) => ({ ...prev, imapSecure: checked }))} />
                    </label>
                    <Button type="button" variant="outline" onClick={() => void handleTestEmailConnection('imap')} disabled={testingEmailKind === 'imap'} className="border-white/10 text-zinc-200 hover:bg-white/5">
                      {testingEmailKind === 'imap' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Проверить IMAP
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={() => void handleSaveEmailSettings()} disabled={isSavingEmailSettings} className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white">
                  {isSavingEmailSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Сохранить почту
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="mt-0">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">{t('profilesTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-10 bg-zinc-900/70 border-white/10"
                />
              </div>

              <div className="space-y-2">
                {filteredProfiles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-8 text-center text-zinc-500">
                    {t('noProfiles')}
                  </div>
                ) : (
                  filteredProfiles.map((profile) => {
                    const isCurrentUser = profile.id === currentUserId
                    const isSavingCurrent = savingProfileId === profile.id
                    return (
                      <div
                        key={profile.id}
                        className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {profile.full_name?.trim() || t('emptyName')}
                            </p>
                            {isCurrentUser ? (
                              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-white/15 text-zinc-300">
                                {t('you')}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-zinc-400 truncate">{profile.email}</p>
                          <p className="text-[11px] text-zinc-500 mt-1 truncate">{profile.id}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full border ${
                              profile.role === 'admin'
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : 'border-zinc-600/40 bg-zinc-800/70 text-zinc-300'
                            }`}
                          >
                            {profile.role === 'admin' ? t('roleAdmin') : t('roleUser')}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/10 text-zinc-200 hover:bg-white/5"
                            onClick={() => void handleToggleRole(profile)}
                            disabled={isSavingCurrent}
                          >
                            {isSavingCurrent ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {t('updating')}
                              </>
                            ) : profile.role === 'admin' ? (
                              t('demote')
                            ) : (
                              t('promote')
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="text-xs text-zinc-500 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{t('safetyHint')}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
    </div>
  )
}
