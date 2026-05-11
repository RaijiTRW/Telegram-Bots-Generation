'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import {
  BarChart3,
  Bot,
  Check,
  Clock3,
  KanbanSquare,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
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
import { AnimatePresence, motion } from '@/components/motion-wrapper'
import { getCurrentSubscriptionAction } from '@/lib/billing/actions'
import {
  deleteCrmFieldAction,
  deleteCrmStageAction,
  getCrmCardTimelineAction,
  getFlexibleCrmBoardAction,
  moveCrmCardAction,
  upsertCrmCardAction,
  upsertCrmFieldAction,
  upsertCrmStageAction,
} from '@/lib/bot-editor/actions/editor-actions'
import type {
  CrmBoard,
  CrmCard,
  CrmCardEvent,
  CrmField,
  CrmFieldType,
  CrmScope,
  CrmStage,
} from '@/lib/bot-editor/types/analytics.types'

const FIELD_TYPES: Array<{ value: CrmFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
]

const STAGE_COLOR_PRESETS = [
  '#38bdf8',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#a3e635',
  '#64748b',
]

const CRM_REFRESH_TIMEOUT_MS = 4_500
const CRM_LIVE_REFRESH_INTERVAL_MS = 5_000

const COPY = {
  ru: {
    title: 'CRM',
    subtitle: 'Карточки заявок, броней, заказов и сделок по всем ботам.',
    allBots: 'Все боты',
    botScope: 'Конкретный бот',
    search: 'Поиск карточек',
    settings: 'Настройка CRM',
    newCard: 'Новая карточка',
    empty: 'Карточек пока нет',
    noAccess: 'CRM недоступна на текущем тарифе',
    loadError: 'Не удалось загрузить CRM',
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    stages: 'Этапы',
    fields: 'Поля карточки',
    titleField: 'Название',
    stage: 'Этап',
    bot: 'Бот',
    notes: 'Заметки',
    tags: 'Теги',
    externalKey: 'External key',
    timeline: 'История',
    addStage: 'Добавить этап',
    addField: 'Добавить поле',
    fieldKey: 'ID поля',
    fieldName: 'Название поля',
    fieldType: 'Тип',
    color: 'Цвет',
    order: 'Порядок',
    created: 'Создано',
    updated: 'Обновлено',
    combined: 'объединённая доска',
  },
  en: {
    title: 'CRM',
    subtitle: 'Cards for leads, bookings, orders, and deals across bots.',
    allBots: 'All bots',
    botScope: 'Selected bot',
    search: 'Search cards',
    settings: 'CRM settings',
    newCard: 'New card',
    empty: 'No cards yet',
    noAccess: 'CRM is not available on the current plan',
    loadError: 'Failed to load CRM',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    stages: 'Stages',
    fields: 'Card fields',
    titleField: 'Title',
    stage: 'Stage',
    bot: 'Bot',
    notes: 'Notes',
    tags: 'Tags',
    externalKey: 'External key',
    timeline: 'Timeline',
    addStage: 'Add stage',
    addField: 'Add field',
    fieldKey: 'Field ID',
    fieldName: 'Field name',
    fieldType: 'Type',
    color: 'Color',
    order: 'Order',
    created: 'Created',
    updated: 'Updated',
    combined: 'combined board',
  },
}

type AccessState = 'checking' | 'granted' | 'locked' | 'denied'

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

function normalizeTagInput(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 16)
}

function valueToInput(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toCrmErrorMessage(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error || '')).replace(/^Error:\s*/i, '')
  if (raw.includes('CRM tables are not installed')) {
    return "CRM-таблицы ещё не применены в Supabase. Запустите миграцию supabase/migrations/20260510175753_create_flexible_crm.sql и в конце выполните notify pgrst, 'reload schema';"
  }
  return raw || 'CRM error'
}

function StageCard({
  stage,
  count,
  onEdit,
}: {
  stage: CrmStage
  count: number
  onEdit: () => void
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-left transition hover:border-sky-400/40"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="truncate text-sm font-semibold text-white">{stage.name}</span>
      </span>
      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400">{count}</span>
    </button>
  )
}

function CrmCardButton({
  card,
  fields,
  onOpen,
  onDragStart,
}: {
  card: CrmCard
  fields: CrmField[]
  onOpen: () => void
  onDragStart: () => void
}) {
  const previewFields = fields.slice(0, 3)
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="group w-full rounded-lg border border-white/10 bg-zinc-950/80 p-3 text-left shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:border-sky-400/40 hover:bg-zinc-900/90"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{card.title}</div>
          {card.botName ? (
            <div className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
              <Bot className="h-3 w-3" />
              <span className="truncate">{card.botName}</span>
            </div>
          ) : null}
        </div>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: card.stageColor }} />
      </div>

      <div className="mt-3 space-y-1.5">
        {previewFields.map((field) => {
          const value = card.fieldValues[field.key]
          if (value == null || value === '') return null
          return (
            <div key={field.id} className="flex gap-2 text-xs">
              <span className="shrink-0 text-zinc-500">{field.name}:</span>
              <span className="min-w-0 truncate text-zinc-300">{valueToInput(value)}</span>
            </div>
          )
        })}
      </div>

      {card.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] text-sky-200">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{formatDate(card.updatedAt, 'ru')}</span>
        {card.telegramUserId ? <span>TG {card.telegramUserId}</span> : null}
      </div>
    </button>
  )
}

interface DashboardCrmPageProps {
  initialScope?: CrmScope
  initialBotId?: string | null
}

export default function DashboardCrmPage({
  initialScope = 'global',
  initialBotId = null,
}: DashboardCrmPageProps = {}) {
  const locale = useLocale()
  const copy = locale === 'en' ? COPY.en : COPY.ru
  const [accessState, setAccessState] = useState<AccessState>('checking')
  const [board, setBoard] = useState<CrmBoard | null>(null)
  const [scope, setScope] = useState<CrmScope>(initialScope)
  const [botId, setBotId] = useState<string>(initialBotId || '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<CrmCard | null>(null)
  const [timeline, setTimeline] = useState<CrmCardEvent[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editingStage, setEditingStage] = useState<Partial<CrmStage> | null>(null)
  const [editingField, setEditingField] = useState<Partial<CrmField> | null>(null)
  const boardCacheRef = useRef(new Map<string, CrmBoard>())
  const loadRequestSeqRef = useRef(0)
  const [draftCard, setDraftCard] = useState<{
    title: string
    stageId: string
    botId: string
    externalKey: string
    notes: string
    tags: string
    fieldValues: Record<string, string>
  } | null>(null)

  const cardsByStage = useMemo(() => {
    const result = new Map<string, CrmCard[]>()
    for (const stage of board?.stages || []) {
      result.set(stage.key, [])
    }
    for (const card of board?.cards || []) {
      const key = result.has(card.stageKey) ? card.stageKey : board?.stages[0]?.key || 'new'
      result.set(key, [...(result.get(key) || []), card])
    }
    return result
  }, [board])

  const openCard = useCallback((card: CrmCard | null) => {
    if (!board) return
    setSelectedCard(card)
    setTimeline([])
    if (card) {
      setDraftCard({
        title: card.title,
        stageId: card.stageId,
        botId: card.botId || '',
        externalKey: card.externalKey,
        notes: card.notes,
        tags: card.tags.join(', '),
        fieldValues: Object.fromEntries(
          board.fields.map((field) => [field.key, valueToInput(card.fieldValues[field.key])])
        ),
      })
      void getCrmCardTimelineAction(card.id).then((result) => {
        if (result.success && result.timeline) {
          setTimeline(result.timeline)
        }
      })
      return
    }

    setDraftCard({
      title: copy.newCard,
      stageId: board.stages[0]?.id || '',
      botId: scope === 'bot' ? board.botId || botId : '',
      externalKey: '',
      notes: '',
      tags: '',
      fieldValues: Object.fromEntries(board.fields.map((field) => [field.key, ''])),
    })
  }, [board, botId, copy.newCard, scope])

  const loadBoard = useCallback(async (options: { force?: boolean; background?: boolean } = {}) => {
    if (accessState !== 'granted') return
    const normalizedSearch = debouncedSearch.trim()
    const cacheKey = JSON.stringify({
      scope,
      botId: scope === 'bot' ? botId || null : null,
      search: normalizedSearch,
    })
    const cachedBoard = boardCacheRef.current.get(cacheKey)
    if (cachedBoard && !options.force) {
      setBoard(cachedBoard)
    }
    const canRunInBackground = Boolean(options.background && (cachedBoard || board))
    const requestSeq = loadRequestSeqRef.current + 1
    loadRequestSeqRef.current = requestSeq
    setError(null)
    const request = getFlexibleCrmBoardAction({
      scope,
      botId: scope === 'bot' ? botId || null : null,
      search: normalizedSearch || undefined,
    })
    const applyResult = (result: Awaited<typeof request>) => {
      if (requestSeq !== loadRequestSeqRef.current) return
      if (!result.success || !result.board) {
        throw new Error(result.error || copy.loadError)
      }
      boardCacheRef.current.set(cacheKey, result.board)
      setBoard(result.board)
      if (scope === 'bot' && !botId && result.board.botId) {
        setBotId(result.board.botId)
      }
    }

    try {
      if (canRunInBackground) {
        const timeout = new Promise<'timeout'>((resolve) => {
          window.setTimeout(() => resolve('timeout'), CRM_REFRESH_TIMEOUT_MS)
        })
        const result = await Promise.race([request, timeout])
        if (result === 'timeout') {
          request
            .then((lateResult) => {
              try {
                applyResult(lateResult)
              } catch (lateError) {
                if (requestSeq === loadRequestSeqRef.current) {
                  setError(toCrmErrorMessage(lateError))
                }
              }
            })
            .catch((lateError) => {
              if (requestSeq === loadRequestSeqRef.current) {
                setError(toCrmErrorMessage(lateError))
              }
            })
          return
        }
        applyResult(result)
        return
      }

      applyResult(await request)
    } catch (loadError) {
      if (requestSeq !== loadRequestSeqRef.current) return
      setError(toCrmErrorMessage(loadError))
      if (!cachedBoard) {
        setBoard(null)
      }
    } finally {
      // Background updates keep the current board visible and do not block the UI.
    }
  }, [accessState, board, botId, copy.loadError, debouncedSearch, scope])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const checkAccess = async () => {
      try {
        const result = await getCurrentSubscriptionAction()
        const subscription = result.success ? result.subscription : null
        if (!subscription) {
          if (!cancelled) setAccessState('denied')
          return
        }
        if (!cancelled) {
          setAccessState(subscription.isAdmin || subscription.entitlements.crm ? 'granted' : 'locked')
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
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (accessState !== 'granted') return

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadBoard({ force: true, background: true })
    }, CRM_LIVE_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [accessState, loadBoard])

  const saveCard = useCallback(async () => {
    if (!board || !draftCard) return
    setIsSaving(true)
    setError(null)
    try {
      const cardFieldValues = Object.fromEntries(
        board.fields.map((field) => {
          const raw = draftCard.fieldValues[field.key] || ''
          if (field.type === 'checkbox') return [field.key, raw === 'true']
          if (field.type === 'number') return [field.key, raw ? Number(raw) : null]
          return [field.key, raw]
        })
      )
      const result = await upsertCrmCardAction({
        id: selectedCard?.id,
        scope,
        botId: draftCard.botId || (scope === 'bot' ? board.botId : null),
        pipelineId: selectedCard?.pipelineId || board.pipeline.id,
        stageId: draftCard.stageId,
        title: draftCard.title,
        externalKey: draftCard.externalKey,
        fieldValues: cardFieldValues,
        notes: draftCard.notes,
        tags: normalizeTagInput(draftCard.tags),
        telegramUserId: selectedCard?.telegramUserId || null,
        telegramChatId: selectedCard?.telegramChatId || null,
      })
      if (!result.success) throw new Error(result.error || 'Save failed')
      setSelectedCard(null)
      setDraftCard(null)
      await loadBoard()
    } catch (saveError) {
      setError(toCrmErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }, [board, draftCard, loadBoard, scope, selectedCard])

  const moveCard = useCallback(async (stage: CrmStage) => {
    if (!draggedCardId) return
    const result = await moveCrmCardAction(draggedCardId, stage.id)
    setDraggedCardId(null)
    if (!result.success) {
      setError(result.error || 'Move failed')
      return
    }
    await loadBoard()
  }, [draggedCardId, loadBoard])

  const saveStage = useCallback(async () => {
    if (!board || !editingStage) return
    const result = await upsertCrmStageAction({
      id: editingStage.id,
      pipelineId: board.pipeline.id,
      key: editingStage.key,
      name: editingStage.name || 'Этап',
      color: editingStage.color || '#38bdf8',
      sortOrder: Number(editingStage.sortOrder || (board.stages.length + 1) * 10),
      isTerminal: Boolean(editingStage.isTerminal),
    })
    if (!result.success) {
      setError(result.error || 'Stage save failed')
      return
    }
    setEditingStage(null)
    await loadBoard()
  }, [board, editingStage, loadBoard])

  const saveField = useCallback(async () => {
    if (!board || !editingField) return
    const result = await upsertCrmFieldAction({
      id: editingField.id,
      pipelineId: board.pipeline.id,
      key: editingField.key,
      name: editingField.name || 'Поле',
      type: editingField.type || 'text',
      options: Array.isArray(editingField.options) ? editingField.options : [],
      required: Boolean(editingField.required),
      sortOrder: Number(editingField.sortOrder || (board.fields.length + 1) * 10),
    })
    if (!result.success) {
      setError(result.error || 'Field save failed')
      return
    }
    setEditingField(null)
    await loadBoard()
  }, [board, editingField, loadBoard])

  if (accessState === 'checking') {
    return (
      <div className="flex min-h-[560px] items-center justify-center text-zinc-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin text-sky-300" />
        CRM
      </div>
    )
  }

  if (accessState !== 'granted') {
    return (
      <div className="flex min-h-[560px] items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-zinc-950/80 p-8 text-center">
          <Lock className="mx-auto h-10 w-10 text-zinc-500" />
          <h1 className="mt-4 text-2xl font-semibold text-white">{copy.noAccess}</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
              <KanbanSquare className="h-3.5 w-3.5" />
              {copy.title}
            </div>
            <h1 className="mt-3 text-3xl font-semibold">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">{copy.subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/10 bg-zinc-950 text-white hover:bg-zinc-900"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              {copy.settings}
            </Button>
            <Button
              className="bg-sky-500 text-white hover:bg-sky-400"
              onClick={() => openCard(null)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {copy.newCard}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-[auto_240px_minmax(320px,1fr)] xl:items-center">
          <div className="flex h-12 rounded-xl border border-white/10 bg-zinc-950 p-1">
            {(['global', 'bot'] as CrmScope[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  scope === item ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {item === 'global' ? copy.allBots : copy.botScope}
              </button>
            ))}
          </div>

          {scope === 'bot' ? (
            <Select value={botId || board?.botId || ''} onValueChange={setBotId}>
              <SelectTrigger className="h-12 w-full border-white/10 bg-zinc-950 text-white">
                <SelectValue placeholder={copy.bot} />
              </SelectTrigger>
              <SelectContent>
                {(board?.bots || []).map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-12 items-center rounded-xl border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-400">
              {copy.combined}
            </div>
          )}

          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.search}
              className="h-12 border-white/10 bg-zinc-950 pl-9 text-white"
            />
          </div>

        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-5 py-5">
        <div className="flex min-h-[620px] h-[calc(100vh-300px)] min-w-max gap-4">
          {(board?.stages || []).map((stage) => {
            const cards = cardsByStage.get(stage.key) || []
            return (
              <section
                key={stage.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => void moveCard(stage)}
                className="flex h-full w-[320px] shrink-0 flex-col rounded-xl border border-white/10 bg-zinc-950/50"
              >
                <div className="border-b border-white/10 p-3">
                  <StageCard
                    stage={stage}
                    count={cards.length}
                    onEdit={() => {
                      setEditingStage(stage)
                      setIsSettingsOpen(true)
                    }}
                  />
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                  {cards.map((card) => (
                    <CrmCardButton
                      key={card.id}
                      card={card}
                      fields={board?.fields || []}
                      onOpen={() => openCard(card)}
                      onDragStart={() => setDraggedCardId(card.id)}
                    />
                  ))}
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                      {copy.empty}
                    </div>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {draftCard && board ? (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => {
              setSelectedCard(null)
              setDraftCard(null)
            }}
          >
            <motion.aside
              className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"
              initial={{ x: 48, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">CRM card</div>
                  <h2 className="mt-1 text-xl font-semibold">{draftCard.title || copy.newCard}</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setSelectedCard(null)
                    setDraftCard(null)
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>{copy.titleField}</Label>
                    <Input
                      value={draftCard.title}
                      onChange={(event) => setDraftCard((current) => current && { ...current, title: event.target.value })}
                      className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                    />
                  </div>
                  <div>
                    <Label>{copy.stage}</Label>
                    <Select
                      value={draftCard.stageId}
                      onValueChange={(value) => setDraftCard((current) => current && { ...current, stageId: value })}
                    >
                      <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {board.stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{copy.bot}</Label>
                    <Select
                      value={draftCard.botId || 'global'}
                      onValueChange={(value) => setDraftCard((current) => current && { ...current, botId: value === 'global' ? '' : value })}
                    >
                      <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">{copy.allBots}</SelectItem>
                        {board.bots.map((bot) => (
                          <SelectItem key={bot.id} value={bot.id}>{bot.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>{copy.externalKey}</Label>
                    <Input
                      value={draftCard.externalKey}
                      onChange={(event) => setDraftCard((current) => current && { ...current, externalKey: event.target.value })}
                      className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                      placeholder="{{user.id}}"
                    />
                  </div>

                  {board.fields.map((field) => (
                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                      <Label>{field.name}</Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          value={draftCard.fieldValues[field.key] || ''}
                          onChange={(event) => setDraftCard((current) => current && {
                            ...current,
                            fieldValues: { ...current.fieldValues, [field.key]: event.target.value },
                          })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                          rows={3}
                        />
                      ) : field.type === 'checkbox' ? (
                        <Select
                          value={draftCard.fieldValues[field.key] || 'false'}
                          onValueChange={(value) => setDraftCard((current) => current && {
                            ...current,
                            fieldValues: { ...current.fieldValues, [field.key]: value },
                          })}
                        >
                          <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">No</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'}
                          value={draftCard.fieldValues[field.key] || ''}
                          onChange={(event) => setDraftCard((current) => current && {
                            ...current,
                            fieldValues: { ...current.fieldValues, [field.key]: event.target.value },
                          })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      )}
                    </div>
                  ))}

                  <div className="md:col-span-2">
                    <Label>{copy.tags}</Label>
                    <Input
                      value={draftCard.tags}
                      onChange={(event) => setDraftCard((current) => current && { ...current, tags: event.target.value })}
                      className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                      placeholder="vip, booking, delivery"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{copy.notes}</Label>
                    <Textarea
                      value={draftCard.notes}
                      onChange={(event) => setDraftCard((current) => current && { ...current, notes: event.target.value })}
                      className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                      rows={4}
                    />
                  </div>
                </div>

                {selectedCard ? (
                  <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                      <Clock3 className="h-4 w-4 text-sky-300" />
                      {copy.timeline}
                    </div>
                    <div className="space-y-2">
                      {timeline.length > 0 ? timeline.map((event) => (
                        <div key={event.id} className="rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-zinc-200">{event.eventType}</span>
                            <span className="text-xs text-zinc-500">{formatDate(event.createdAt, locale)}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-sm text-zinc-500">—</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4">
                <Button
                  variant="outline"
                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setSelectedCard(null)
                    setDraftCard(null)
                  }}
                >
                  {copy.cancel}
                </Button>
                <Button className="bg-sky-500 text-white hover:bg-sky-400" onClick={() => void saveCard()} disabled={isSaving}>
                  <Check className="mr-2 h-4 w-4" />
                  {copy.save}
                </Button>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && board ? (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setIsSettingsOpen(false)}
          >
            <motion.div
              className="mx-auto mt-10 flex max-h-[calc(100vh-80px)] w-[min(1100px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
              initial={{ y: 24, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{copy.settings}</div>
                  <h2 className="mt-1 text-xl font-semibold">{board.pipeline.name}</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_380px]">
                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <BarChart3 className="h-4 w-4 text-sky-300" />
                      {copy.stages}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-zinc-900 text-white"
                      onClick={() => {
                        setEditingField(null)
                        setEditingStage({ color: '#38bdf8', sortOrder: (board.stages.length + 1) * 10 })
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {copy.addStage}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {board.stages.map((stage) => (
                      <div
                        key={stage.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                          editingStage?.id === stage.id
                            ? 'border-sky-300/70 bg-sky-400/10'
                            : 'border-white/10 bg-zinc-950/80 hover:border-white/20'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => {
                            setEditingField(null)
                            setEditingStage(stage)
                          }}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                          <span className="truncate text-sm text-white">{stage.name}</span>
                          <span className="text-xs text-zinc-500">{stage.key}</span>
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-zinc-400 hover:bg-sky-500/10 hover:text-sky-200"
                          onClick={() => {
                            setEditingField(null)
                            setEditingStage(stage)
                          }}
                          aria-label="Редактировать этап"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => void deleteCrmStageAction(stage.id).then(() => loadBoard())}
                          aria-label="Удалить этап"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <Tags className="h-4 w-4 text-sky-300" />
                      {copy.fields}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-zinc-900 text-white"
                      onClick={() => {
                        setEditingStage(null)
                        setEditingField({ type: 'text', sortOrder: (board.fields.length + 1) * 10 })
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      {copy.addField}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {board.fields.map((field) => (
                      <div
                        key={field.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 transition ${
                          editingField?.id === field.id
                            ? 'border-sky-300/70 bg-sky-400/10'
                            : 'border-white/10 bg-zinc-950/80 hover:border-white/20'
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setEditingStage(null)
                            setEditingField(field)
                          }}
                        >
                          <div className="truncate text-sm text-white">{field.name}</div>
                          <div className="text-xs text-zinc-500">{field.key} · {field.type}</div>
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-zinc-400 hover:bg-sky-500/10 hover:text-sky-200"
                          onClick={() => {
                            setEditingStage(null)
                            setEditingField(field)
                          }}
                          aria-label="Редактировать поле"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => void deleteCrmFieldAction(field.id).then(() => loadBoard())}
                          aria-label="Удалить поле"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {editingStage ? copy.stages : editingField ? copy.fields : copy.settings}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      {editingStage
                        ? (editingStage.id ? 'Редактировать этап' : 'Новый этап')
                        : editingField
                          ? (editingField.id ? 'Редактировать поле' : 'Новое поле')
                          : 'Выберите элемент'}
                    </h3>
                  </div>

                  {editingStage ? (
                    <div className="space-y-3">
                      <div>
                        <Label>{copy.stage}</Label>
                        <Input
                          value={editingStage.name || ''}
                          onChange={(event) => setEditingStage((current) => current && { ...current, name: event.target.value })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>ID</Label>
                        <Input
                          value={editingStage.key || ''}
                          onChange={(event) => setEditingStage((current) => current && { ...current, key: event.target.value })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>{copy.color}</Label>
                        <div className="mt-1.5 rounded-xl border border-white/10 bg-zinc-900 p-3">
                          <div className="grid grid-cols-5 gap-2">
                            {STAGE_COLOR_PRESETS.map((color) => {
                              const isSelected = (editingStage.color || '#38bdf8').toLowerCase() === color.toLowerCase()
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  aria-label={color}
                                  className={`h-9 rounded-lg border transition ${
                                    isSelected
                                      ? 'border-white/80 shadow-[0_0_0_2px_rgba(255,255,255,0.12)]'
                                      : 'border-white/10 hover:border-white/35'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setEditingStage((current) => current && { ...current, color })}
                                />
                              )
                            })}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="color"
                              value={editingStage.color || '#38bdf8'}
                              onChange={(event) => setEditingStage((current) => current && { ...current, color: event.target.value })}
                              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1"
                              aria-label={copy.color}
                            />
                            <Input
                              value={editingStage.color || '#38bdf8'}
                              onChange={(event) => setEditingStage((current) => current && { ...current, color: event.target.value })}
                              className="border-white/10 bg-zinc-950 text-white"
                              placeholder="#38bdf8"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>{copy.order}</Label>
                        <Input
                          type="number"
                          value={String(editingStage.sortOrder || 0)}
                          onChange={(event) => setEditingStage((current) => current && { ...current, sortOrder: Number(event.target.value) })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>Финальный этап</Label>
                        <Select
                          value={editingStage.isTerminal ? 'true' : 'false'}
                          onValueChange={(value) => setEditingStage((current) => current && { ...current, isTerminal: value === 'true' })}
                        >
                          <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Нет</SelectItem>
                            <SelectItem value="true">Да</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}

                  {editingField ? (
                    <div className="space-y-3">
                      <div>
                        <Label>{copy.fieldName}</Label>
                        <Input
                          value={editingField.name || ''}
                          onChange={(event) => setEditingField((current) => current && { ...current, name: event.target.value })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>{copy.fieldKey}</Label>
                        <Input
                          value={editingField.key || ''}
                          onChange={(event) => setEditingField((current) => current && { ...current, key: event.target.value })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>{copy.fieldType}</Label>
                        <Select
                          value={editingField.type || 'text'}
                          onValueChange={(value) => setEditingField((current) => current && { ...current, type: value as CrmFieldType })}
                        >
                          <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {editingField.type === 'select' ? (
                        <div>
                          <Label>Варианты</Label>
                          <Input
                            value={(Array.isArray(editingField.options) ? editingField.options : []).join(', ')}
                            onChange={(event) => setEditingField((current) => current && {
                              ...current,
                              options: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                            })}
                            placeholder="Новый, VIP, Повторный"
                            className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                          />
                        </div>
                      ) : null}
                      <div>
                        <Label>{copy.order}</Label>
                        <Input
                          type="number"
                          value={String(editingField.sortOrder || 0)}
                          onChange={(event) => setEditingField((current) => current && { ...current, sortOrder: Number(event.target.value) })}
                          className="mt-1.5 border-white/10 bg-zinc-900 text-white"
                        />
                      </div>
                      <div>
                        <Label>Обязательное поле</Label>
                        <Select
                          value={editingField.required ? 'true' : 'false'}
                          onValueChange={(value) => setEditingField((current) => current && { ...current, required: value === 'true' })}
                        >
                          <SelectTrigger className="mt-1.5 border-white/10 bg-zinc-900 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Нет</SelectItem>
                            <SelectItem value="true">Да</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}

                  {!editingStage && !editingField ? (
                    <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-sm leading-6 text-zinc-500">
                      Нажмите на этап или поле, чтобы изменить название, ID, цвет, тип и порядок.
                    </div>
                  ) : (
                    <div className="mt-5 flex justify-end gap-3">
                      <Button
                        variant="outline"
                        className="border-white/10 bg-transparent text-white"
                        onClick={() => {
                          setEditingStage(null)
                          setEditingField(null)
                        }}
                      >
                        {copy.cancel}
                      </Button>
                      <Button
                        className="bg-sky-500 text-white hover:bg-sky-400"
                        onClick={() => editingStage ? void saveStage() : void saveField()}
                      >
                        {copy.save}
                      </Button>
                    </div>
                  )}
                </aside>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
