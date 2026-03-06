'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
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
  created_at: string
  updated_at: string
}

type ProfileRoleRow = {
  id: string
  role: 'user' | 'admin'
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

export default function DashboardAdminPage() {
  const t = useTranslations('dashboard.admin')
  const locale = useLocale()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState<Notice>(null)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw userError || new Error('User not found')
      }

      setCurrentUserId(user.id)

      const { data: ownProfileRaw, error: ownProfileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

      if (ownProfileError) {
        throw ownProfileError
      }

      const ownProfile = ownProfileRaw as ProfileRoleRow | null
      const hasAdminAccess = ownProfile?.role === 'admin'
      setIsAdmin(hasAdminAccess)

      if (!hasAdminAccess) {
        setProfiles([])
        setStats({
          onlineNow: 0,
          registeredToday: 0,
          landingViewsToday: 0,
        })
        return
      }

      const [profilesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, role, created_at, updated_at')
          .order('created_at', { ascending: false }),
      ])

      if (profilesResult.error) {
        throw profilesResult.error
      }

      setProfiles((profilesResult.data || []) as ProfileRow[])
      await fetchStats()
    } catch (error) {
      console.error('Failed to load admin profiles:', error)
      setStatus({ type: 'error', text: t('loadError') })
      setProfiles([])
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
    if (!isAdmin) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchStats()
    }, 30_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [fetchStats, isAdmin])

  const handleToggleRole = async (profile: ProfileRow) => {
    if (!isAdmin || savingProfileId) return
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

      {!isAdmin ? (
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              {t('accessDeniedTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>{t('accessDeniedDesc')}</p>
            <p className="text-zinc-500 text-sm">{t('bootstrapHint')}</p>
            <Button asChild variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-200">
              <Link href={`/${locale}/dashboard`}>{t('backHome')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
