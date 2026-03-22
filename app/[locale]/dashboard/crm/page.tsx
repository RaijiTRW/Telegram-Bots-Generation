'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getSafeClientUser } from '@/lib/supabase/client-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getDashboardCrmLeadsAction,
  getDashboardCrmOverviewAction,
  getLeadTimelineAction,
  updateLeadStageAction,
} from '@/lib/bot-editor/actions/editor-actions'
import { getCurrentSubscriptionAction } from '@/lib/billing/actions'
import type {
  CrmLeadRecord,
  CrmLeadTimelineEvent,
  CrmOverview,
  CrmPeriod,
  LeadStage,
} from '@/lib/bot-editor/types/analytics.types'
import { Copy, ExternalLink, Lock, Megaphone, RefreshCcw, ShieldAlert, X } from 'lucide-react'
import { AnimatePresence, motion } from '@/components/motion-wrapper'

type StageFilter = LeadStage | 'all'
type BotOption = { id: string; name: string }

const STAGE_OPTIONS: LeadStage[] = ['new', 'contacted', 'qualified', 'won', 'lost']
const PERIOD_OPTIONS: CrmPeriod[] = ['24h', '7d', '30d', 'all']

function resolveLeadDisplayName(lead: CrmLeadRecord): string {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (lead.username) return `@${lead.username}`
  return String(lead.telegramUserId)
}

export default function DashboardCrmPage() {
  const t = useTranslations('dashboard.crm')
  const locale = useLocale()
  const pathname = usePathname()
  const isRu = locale !== 'en'
  const [accessState, setAccessState] = useState<'checking' | 'granted' | 'locked' | 'denied'>('checking')
  const [overview, setOverview] = useState<CrmOverview | null>(null)
  const [leads, setLeads] = useState<CrmLeadRecord[]>([])
  const [selectedLead, setSelectedLead] = useState<CrmLeadRecord | null>(null)
  const [timeline, setTimeline] = useState<CrmLeadTimelineEvent[]>([])
  const [isPortalMounted, setIsPortalMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
  const [isSavingLead, setIsSavingLead] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bots, setBots] = useState<BotOption[]>([])

  const [botFilter, setBotFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<StageFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<CrmPeriod>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)

  const [editStage, setEditStage] = useState<LeadStage>('new')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState('')

  const loadBots = useCallback(async () => {
    try {
      const supabase = createClient()
      const user = await getSafeClientUser(supabase)
      if (!user) {
        setBots([])
        return
      }
      const { data, error: botsError } = await supabase
        .from('bots')
        .select('id, name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (botsError) return
      const nextBots = (Array.isArray(data) ? data : [])
        .map((item) => ({
          id: String((item as Record<string, unknown>).id || ''),
          name: String((item as Record<string, unknown>).name || ''),
        }))
        .filter((item) => item.id)
      setBots(nextBots)
    } catch {
      // ignore
    }
  }, [])

  const loadCrm = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const filters = {
        botId: botFilter !== 'all' ? botFilter : undefined,
        stage: stageFilter,
        period: periodFilter,
        search: search.trim() || undefined,
      }

      const [overviewResult, leadsResult] = await Promise.all([
        getDashboardCrmOverviewAction(filters),
        getDashboardCrmLeadsAction(filters, page, pageSize),
      ])

      if (!overviewResult.success || !overviewResult.overview) {
        throw new Error(overviewResult.error || t('loadError'))
      }
      if (!leadsResult.success || !leadsResult.result) {
        throw new Error(leadsResult.error || t('loadError'))
      }

      setOverview(overviewResult.overview)
      setLeads(leadsResult.result.items)
      setTotal(leadsResult.result.total)

      setSelectedLead((current) => {
        if (current) {
          const refreshed = leadsResult.result.items.find(
            (item) => item.botId === current.botId && item.telegramUserId === current.telegramUserId
          )
          return refreshed || null
        }
        return null
      })
    } catch (loadError) {
      setError(String(loadError))
      setOverview(null)
      setLeads([])
      setTotal(0)
      setSelectedLead(null)
    } finally {
      setIsLoading(false)
    }
  }, [botFilter, stageFilter, periodFilter, search, page, pageSize, t])

  const loadLeadTimeline = useCallback(async (lead: CrmLeadRecord | null) => {
    if (!lead) {
      setTimeline([])
      return
    }
    setIsLoadingTimeline(true)
    try {
      const result = await getLeadTimelineAction(lead.botId, lead.telegramUserId, null, 80)
      if (!result.success || !result.timeline) {
        setTimeline([])
        return
      }
      setTimeline(result.timeline)
    } finally {
      setIsLoadingTimeline(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const checkAccess = async () => {
      try {
        const result = await getCurrentSubscriptionAction()
        if (!result.success || !result.subscription) {
          if (!cancelled) setAccessState('denied')
          return
        }
        if (!cancelled) {
          setAccessState(
            result.subscription.isAdmin
              ? 'granted'
              : 'locked'
          )
        }
      } catch {
        if (!cancelled) setAccessState('denied')
      }
    }

    void checkAccess()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (accessState !== 'granted') return
    void loadBots()
  }, [accessState, loadBots])

  useEffect(() => {
    setIsPortalMounted(true)
    return () => setIsPortalMounted(false)
  }, [])

  useEffect(() => {
    setSelectedLead(null)
    setTimeline([])
  }, [pathname])

  useEffect(() => {
    if (accessState !== 'granted') return
    void loadCrm()
  }, [accessState, loadCrm])

  useEffect(() => {
    if (!selectedLead) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedLead])

  useEffect(() => {
    if (!selectedLead) return
    setEditStage(selectedLead.leadStage)
    setEditNotes(selectedLead.leadNotes || '')
    setEditTags((selectedLead.leadTags || []).join(', '))
    void loadLeadTimeline(selectedLead)
  }, [selectedLead, loadLeadTimeline])

  const stageLabel = useCallback((stage: LeadStage) => t(`stages.${stage}`), [t])
  const formatDateValue = useCallback((value: string | null) => {
    if (!value) return '—'
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) return '—'
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed))
  }, [locale])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total])

  const handleSaveLead = useCallback(async () => {
    if (!selectedLead) return
    setIsSavingLead(true)
    setError(null)
    try {
      const tags = editTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
      const result = await updateLeadStageAction({
        botId: selectedLead.botId,
        telegramUserId: selectedLead.telegramUserId,
        stage: editStage,
        notes: editNotes,
        tags,
      })
      if (!result.success) {
        throw new Error(result.error || t('saveError'))
      }
      await loadCrm()
      await loadLeadTimeline({
        ...selectedLead,
        leadStage: editStage,
      })
    } catch (saveError) {
      setError(String(saveError))
    } finally {
      setIsSavingLead(false)
    }
  }, [selectedLead, editStage, editNotes, editTags, t, loadCrm, loadLeadTimeline])

  const copyLeadId = useCallback(async () => {
    if (!selectedLead) return
    try {
      await navigator.clipboard.writeText(String(selectedLead.telegramUserId))
    } catch {
      // ignore
    }
  }, [selectedLead])

  if (accessState === 'checking') {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-white">
              {isRu ? 'Проверка доступа...' : 'Checking access...'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300">{isRu ? 'Загружаем раздел CRM.' : 'Loading CRM section.'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (accessState === 'locked') {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-amber-500/25 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Lock className="h-5 w-5 text-amber-300" />
              {isRu ? 'CRM скоро для пользователей' : 'CRM is coming soon for users'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>
              {isRu
                ? 'Сейчас раздел CRM доступен только администраторам. Для обычных аккаунтов он временно закрыт и появится позже.'
                : 'CRM is currently available only for admins. For regular accounts this section is temporarily locked and will be available later.'}
            </p>
            <Button asChild>
              <Link href={`/${locale}/dashboard`}>
                {isRu ? 'Назад в дэшборд' : 'Back to dashboard'}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (accessState === 'denied') {
    return (
      <div className="p-6">
        <Card className="bg-zinc-900/60 border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              {isRu ? 'Доступ запрещен' : 'Access denied'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <p>{isRu ? 'Не удалось подтвердить доступ к разделу CRM.' : 'Unable to confirm access to CRM.'}</p>
            <Button asChild variant="outline" className="border-white/10 hover:bg-white/5 text-zinc-200">
              <Link href={`/${locale}/dashboard`}>{isRu ? 'Назад в дэшборд' : 'Back to dashboard'}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-zinc-400 mt-1">{t('subtitle')}</p>
        </div>
        <Button variant="outline" className="border-white/10 text-zinc-300" onClick={() => void loadCrm()} disabled={isLoading}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-200">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-3">
            <div className="text-xs text-zinc-400">{t('kpi.totalLeads')}</div>
            <div className="text-xl text-white font-semibold">{overview?.totalLeads ?? 0}</div>
          </CardContent>
        </Card>
        {STAGE_OPTIONS.map((stage) => (
          <Card key={stage} className="border-white/10 bg-zinc-950/40">
            <CardContent className="p-3">
              <div className="text-xs text-zinc-400">{stageLabel(stage)}</div>
              <div className="text-xl text-white font-semibold">{overview?.stageCounts?.[stage] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-3">
            <div className="text-xs text-zinc-400">{t('kpi.activeDialogs24h')}</div>
            <div className="text-xl text-white font-semibold">{overview?.activeDialogs24h ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-3">
            <div className="text-xs text-zinc-400">{t('kpi.inbound24h')}</div>
            <div className="text-xl text-white font-semibold">{overview?.inbound24h ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-zinc-950/40">
          <CardContent className="p-3">
            <div className="text-xs text-zinc-400">{t('kpi.outbound24h')}</div>
            <div className="text-xl text-white font-semibold">{overview?.outbound24h ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('filters.title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-400">{t('filters.bot')}</Label>
                <Select value={botFilter} onValueChange={(value) => { setPage(1); setBotFilter(value) }}>
                  <SelectTrigger><SelectValue placeholder={t('filters.botAll')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.botAll')}</SelectItem>
                    {bots.map((botOption) => (
                      <SelectItem key={botOption.id} value={botOption.id}>
                        {botOption.name || botOption.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-400">{t('filters.stage')}</Label>
                <Select value={stageFilter} onValueChange={(value) => { setPage(1); setStageFilter(value as StageFilter) }}>
                  <SelectTrigger><SelectValue placeholder={t('filters.stageAll')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filters.stageAll')}</SelectItem>
                    {STAGE_OPTIONS.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-400">{t('filters.period')}</Label>
                <Select value={periodFilter} onValueChange={(value) => { setPage(1); setPeriodFilter(value as CrmPeriod) }}>
                  <SelectTrigger><SelectValue placeholder="24h" /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((period) => (
                      <SelectItem key={period} value={period}>{t(`period.${period}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-400">{t('filters.search')}</Label>
                <Input
                  value={search}
                  onChange={(event) => { setPage(1); setSearch(event.target.value) }}
                  placeholder={t('filters.searchPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-zinc-950/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{t('table.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900/70 text-zinc-400">
                    <tr>
                      <th className="text-left p-3">{t('table.lead')}</th>
                      <th className="text-left p-3">{t('table.bot')}</th>
                      <th className="text-left p-3">{t('table.stage')}</th>
                      <th className="text-left p-3">{t('table.lastInteraction')}</th>
                      <th className="text-left p-3">{t('table.messages')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length ? (
                      leads.map((lead) => {
                        const isActive = selectedLead?.botId === lead.botId && selectedLead?.telegramUserId === lead.telegramUserId
                        return (
                          <tr
                            key={`${lead.botId}_${lead.telegramUserId}`}
                            className={`border-t border-white/5 cursor-pointer ${isActive ? 'bg-[#24A1DE]/10' : 'hover:bg-white/5'}`}
                            onClick={() => setSelectedLead(lead)}
                          >
                            <td className="p-3 text-white">
                              <div>{resolveLeadDisplayName(lead)}</div>
                              <div className="text-xs text-zinc-500">ID: {lead.telegramUserId}</div>
                            </td>
                            <td className="p-3 text-zinc-300">{lead.botName}</td>
                            <td className="p-3 text-zinc-300">{stageLabel(lead.leadStage)}</td>
                            <td className="p-3 text-zinc-300">{formatDateValue(lead.lastSeenAt || lead.lastIncomingAt || lead.lastOutgoingAt)}</td>
                            <td className="p-3 text-zinc-300">{lead.inboundCount}/{lead.outboundCount}</td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td className="p-6 text-zinc-500" colSpan={5}>{t('table.empty')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {t('pagination.page', { page, total: totalPages })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 text-zinc-300"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1 || isLoading}
                  >
                    {t('pagination.prev')}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-zinc-300"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages || isLoading}
                  >
                    {t('pagination.next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/10">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-white font-semibold">{t('broadcastSoonTitle')}</div>
                <div className="text-sm text-zinc-300 mt-1">{t('broadcastSoonDesc')}</div>
              </div>
              <Button disabled className="bg-white/10 text-zinc-300 border border-white/10 cursor-not-allowed">
                <Megaphone className="w-4 h-4 mr-2" />
                {t('broadcastSoonCta')}
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
      {isPortalMounted
        ? createPortal(
            <AnimatePresence>
              {selectedLead && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedLead(null)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120]"
                  />
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-zinc-950 border-l border-white/10 p-6 z-[130] overflow-y-auto shadow-2xl flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">{t('leadCard.title')}</h2>
                      <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-white/10 rounded-full" onClick={() => setSelectedLead(null)}>
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    <div className="space-y-6 flex-1">
                      <div className="rounded-xl border border-white/10 p-5 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 shadow-inner">
                        <div className="text-lg text-white font-medium">{resolveLeadDisplayName(selectedLead)}</div>
                        <div className="text-sm text-zinc-400 mt-1">{selectedLead.botName}</div>
                        {selectedLead.username ? (
                          <Link
                            href={`https://t.me/${selectedLead.username}`}
                            target="_blank"
                            className="inline-flex items-center mt-3 text-sm text-[#24A1DE] hover:text-sky-400 font-medium transition-colors"
                          >
                            {t('leadCard.openTelegram')}
                            <ExternalLink className="w-4 h-4 ml-1.5" />
                          </Link>
                        ) : (
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                            <span className="text-sm text-zinc-400">{t('leadCard.telegramId')}: <span className="text-zinc-200">{selectedLead.telegramUserId}</span></span>
                            <Button size="sm" variant="ghost" className="h-8 hover:bg-white/10 text-zinc-300" onClick={() => void copyLeadId()}>
                              <Copy className="w-4 h-4 mr-2" />
                              {t('leadCard.copyId')}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label className="text-zinc-400 font-medium">{t('leadCard.stage')}</Label>
                          <Select value={editStage} onValueChange={(value) => setEditStage(value as LeadStage)}>
                            <SelectTrigger className="bg-zinc-900/50 border-white/10"><SelectValue placeholder={stageLabel(editStage)} /></SelectTrigger>
                            <SelectContent>
                              {STAGE_OPTIONS.map((stage) => (
                                <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-zinc-400 font-medium">{t('leadCard.tags')}</Label>
                          <Input
                            value={editTags}
                            onChange={(event) => setEditTags(event.target.value)}
                            placeholder={t('leadCard.tagsPlaceholder')}
                            className="bg-zinc-900/50 border-white/10 focus-visible:ring-[#24A1DE]/40"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-zinc-400 font-medium">{t('leadCard.notes')}</Label>
                          <Textarea
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            placeholder={t('leadCard.notesPlaceholder')}
                            rows={4}
                            className="bg-zinc-900/50 border-white/10 focus-visible:ring-[#24A1DE]/40 resize-none"
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:opacity-90 transition-opacity text-white h-11 rounded-lg font-medium shadow-lg shadow-black/20"
                        onClick={() => void handleSaveLead()}
                        disabled={isSavingLead}
                      >
                        {isSavingLead ? t('leadCard.saving') : t('leadCard.save')}
                      </Button>

                      <div className="pt-2">
                        <div className="text-sm font-medium text-zinc-400 mb-4">{t('leadCard.timeline')}</div>
                        <div className="space-y-3 pb-8">
                          {isLoadingTimeline ? (
                            <div className="text-sm text-zinc-500 flex items-center justify-center p-8">
                              <RefreshCcw className="w-5 h-5 animate-spin text-zinc-600 mr-2" />
                              {t('loading')}
                            </div>
                          ) : timeline.length ? (
                            timeline.map((event) => (
                              <div key={event.id} className="relative pl-6">
                                <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full border border-zinc-700 bg-zinc-900" />
                                <div className="absolute left-1 top-4 bottom-[-16px] w-[1px] bg-white/5 last:bg-transparent" />
                                <div className="rounded-lg border border-white/5 p-3 bg-zinc-900/30">
                                  <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5 flex justify-between items-center">
                                    <span>{event.direction === 'inbound' ? t('timeline.inbound') : t('timeline.outbound')}</span>
                                    <span>{formatDateValue(event.createdAt)}</span>
                                  </div>
                                  <div className="text-sm text-zinc-200 leading-relaxed font-light break-words">
                                    {event.messageText || <span className="text-zinc-500 italic">({event.eventKind})</span>}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-zinc-500 text-center p-8 bg-zinc-900/20 rounded-xl border border-white/5 border-dashed">
                              {t('leadCard.timelineEmpty')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  )
}
