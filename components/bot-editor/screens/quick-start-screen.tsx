'use client'

import { startTransition, useCallback, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Bot as BotIcon,
  CheckCircle2,
  KeyRound,
  Loader2,
  Play,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { saveBotSettingsAction, startBotTestAction } from '@/lib/bot-editor/actions/editor-actions'
import {
  generateQuickStartAiAction,
  saveQuickStartDraftAction,
  skipQuickStartAction,
} from '@/lib/bot-editor/actions/quick-start-actions'
import {
  getDefaultQuickStartAiAnswers,
  isBotConfigMeaningfullyEmpty,
  sanitizeQuickStartAiAnswers,
} from '@/lib/bot-editor/quick-start/utils'
import {
  serializeWorkflowEdges,
  serializeWorkflowNodes,
} from '@/lib/bot-editor/utils/workflow-serialization'
import type {
  Bot as BotEntity,
  BotVariable,
  QuickStartAiAnswers,
  QuickStartAiGraphSummaryDraft,
} from '@/lib/bot-editor/types/bot.types'

type CanvasNodePayload = {
  id: string
  type?: string | null
  position?: { x: number; y: number }
  data?: Record<string, unknown>
  [key: string]: unknown
}

type CanvasEdgePayload = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  [key: string]: unknown
}

type CanvasVariablePayload = BotVariable & {
  [key: string]: unknown
}

type QuickStartLocalState = {
  answers: QuickStartAiAnswers
  showSuccess: boolean
  lastSummary: QuickStartAiGraphSummaryDraft | null
}

type StepNumber = 1 | 2 | 3 | 4

function getInitialAnswers(bot: BotEntity | null, locale: string): QuickStartAiAnswers {
  const isRu = locale !== 'en'
  const fastStartAnswers = sanitizeQuickStartAiAnswers(bot?.metadata?.fastStart?.answers || {})
  const defaults = getDefaultQuickStartAiAnswers()

  return {
    ...defaults,
    businessName: fastStartAnswers.businessName || bot?.name || '',
    businessDescription: fastStartAnswers.businessDescription || bot?.description || '',
    primaryGoal: fastStartAnswers.primaryGoal,
    targetAudience: fastStartAnswers.targetAudience,
    requiredSections: fastStartAnswers.requiredSections,
    leadCaptureFields: fastStartAnswers.leadCaptureFields,
    offerings: fastStartAnswers.offerings,
    faq: fastStartAnswers.faq,
    contactDetails: fastStartAnswers.contactDetails,
    tone: fastStartAnswers.tone || (isRu ? 'Дружелюбно, коротко и по делу' : 'Friendly, clear, and concise'),
    extraInstructions: fastStartAnswers.extraInstructions,
  }
}

function splitList(value: string): string[] {
  return value
    .split(/\n|,|;/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function QuickStartProgress({
  currentStep,
  t,
}: {
  currentStep: StepNumber
  t: ReturnType<typeof useTranslations>
}) {
  const steps = [
    t('steps.about'),
    t('steps.details'),
    t('steps.telegram'),
    t('steps.review'),
  ]

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {steps.map((label, index) => {
        const stepNumber = (index + 1) as StepNumber
        const isActive = stepNumber === currentStep
        const isDone = stepNumber < currentStep
        return (
          <div
            key={label}
            className={`rounded-2xl border px-3 py-2.5 ${
              isActive
                ? 'border-[#24A1DE]/40 bg-[#24A1DE]/10'
                : isDone
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : isActive
                      ? 'bg-[#24A1DE]/20 text-[#7fd6ff]'
                      : 'bg-white/5 text-zinc-400'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNumber}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {t('stepNumber', { value: stepNumber })}
                </div>
                <div className={`text-sm font-medium leading-none ${isActive || isDone ? 'text-white' : 'text-zinc-300'}`}>
                  {label}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PreviewGroup({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

type QuickStartScreenContentProps = {
  bot: BotEntity
  locale: string
  autoOpenTelegramAfterTest: boolean
  setBot: (bot: BotEntity | null) => void
}

function QuickStartScreenContent({
  bot,
  locale,
  autoOpenTelegramAfterTest,
  setBot,
}: QuickStartScreenContentProps) {
  const t = useTranslations('editor.quickStart')
  const router = useRouter()
  const initialAnswers = useMemo(() => getInitialAnswers(bot, locale), [bot, locale])
  const [state, setState] = useState<QuickStartLocalState>({
    answers: initialAnswers,
    showSuccess: bot?.metadata?.fastStart?.status === 'completed' && !isBotConfigMeaningfullyEmpty(bot.config),
    lastSummary: null,
  })
  const [currentStep, setCurrentStep] = useState<StepNumber>(
    bot?.metadata?.fastStart?.status === 'completed' && !isBotConfigMeaningfullyEmpty(bot.config) ? 4 : 1
  )
  const [tokenDraft, setTokenDraft] = useState(String(bot?.metadata?.telegramToken || ''))
  const [error, setError] = useState<string | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSavingToken, setIsSavingToken] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)
  const [isStartingTest, setIsStartingTest] = useState(false)

  const editorCanvasHref = bot?.id
    ? `/${locale}/dashboard/bots/${bot.id}/editor/canvas`
    : `/${locale}/dashboard/bots`
  const hasStoredToken = Boolean(bot?.metadata?.hasTelegramToken)
  const previewSections = useMemo(() => splitList(state.answers.requiredSections), [state.answers.requiredSections])
  const previewFields = useMemo(() => splitList(state.answers.leadCaptureFields), [state.answers.leadCaptureFields])
  const previewOfferings = useMemo(() => splitList(state.answers.offerings), [state.answers.offerings])
  const previewFaq = useMemo(() => splitList(state.answers.faq), [state.answers.faq])
  const canStartTest = hasStoredToken && !isStartingTest

  const saveDraft = useCallback(async () => {
    if (!bot?.id) {
      return true
    }

    setIsSavingDraft(true)
    const result = await saveQuickStartDraftAction(bot.id, {
      answers: state.answers,
    })
    setIsSavingDraft(false)

    if (!result.success) {
      setError(('error' in result ? result.error : null) || t('errors.saveDraft'))
      return false
    }

    if ('bot' in result && result.bot) {
      setBot(result.bot)
    }

    return true
  }, [bot, setBot, state.answers, t])

  const handleSaveTokenAndContinue = useCallback(async () => {
    if (!bot?.id || !bot) {
      return false
    }

    if (!tokenDraft.trim() && !hasStoredToken) {
      return true
    }

    setIsSavingToken(true)
    const result = await saveBotSettingsAction(bot.id, {
      name: bot.name || '',
      description: bot.description || '',
      status: bot.status,
      telegramToken: tokenDraft.trim(),
      webhookUrl: '',
      metadataPatch: {},
    })
    setIsSavingToken(false)

    if (!result.success || !('bot' in result) || !result.bot) {
      setError(('error' in result ? result.error : null) || t('errors.saveToken'))
      return false
    }

    setBot(result.bot)
    setTokenDraft('')
    return true
  }, [bot, hasStoredToken, setBot, t, tokenDraft])

  const handleSkipToAdvanced = useCallback(async () => {
    if (!bot?.id) {
      startTransition(() => {
        router.push(editorCanvasHref)
      })
      return
    }

    setIsSkipping(true)
    setError(null)

    if (!state.showSuccess) {
      const result = await skipQuickStartAction(bot.id)
      if (!result.success) {
        setIsSkipping(false)
        setError(('error' in result ? result.error : null) || t('errors.skip'))
        return
      }

      if ('bot' in result && result.bot) {
        setBot(result.bot)
      }
    }

    setIsSkipping(false)
    startTransition(() => {
      router.push(editorCanvasHref)
    })
  }, [bot, editorCanvasHref, router, setBot, state.showSuccess, t])

  const validateStepOne = useCallback(() => {
    if (!state.answers.businessName.trim()) {
      return t('errors.businessNameRequired')
    }
    if (!state.answers.primaryGoal.trim()) {
      return t('errors.primaryGoalRequired')
    }
    return null
  }, [state.answers.businessName, state.answers.primaryGoal, t])

  const handleGenerateScenario = useCallback(async () => {
    if (!bot?.id) {
      return
    }

    const validationError = validateStepOne()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!isBotConfigMeaningfullyEmpty(bot.config)) {
      const shouldReplace = window.confirm(t('confirmReplace'))
      if (!shouldReplace) {
        return
      }
    }

    setIsGenerating(true)
    setError(null)

    const result = await generateQuickStartAiAction(bot.id, {
      answers: state.answers,
      locale,
      overwrite: true,
    })

    setIsGenerating(false)

    if (!result.success || !('bot' in result) || !result.bot) {
      setError(('error' in result ? result.error : null) || t('errors.generate'))
      return
    }

    setBot(result.bot)
    setState((prev) => ({
      ...prev,
      showSuccess: true,
      lastSummary: 'summary' in result ? (result.summary as QuickStartAiGraphSummaryDraft | null) : null,
    }))
    setCurrentStep(4)
  }, [bot, locale, setBot, state.answers, t, validateStepOne])

  const handleStartTest = useCallback(async () => {
    if (!bot?.id || !bot.config || !hasStoredToken) {
      return
    }

    setIsStartingTest(true)
    setError(null)

    const preparedTelegramWindow =
      autoOpenTelegramAfterTest && typeof window !== 'undefined'
        ? window.open('', '_blank')
        : null

    if (preparedTelegramWindow) {
      try {
        preparedTelegramWindow.opener = null
        preparedTelegramWindow.document.write(
          '<!doctype html><title>Telegram</title><body style="margin:0;padding:24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;">Opening Telegram...</body>'
        )
        preparedTelegramWindow.document.close()
      } catch {
        // Ignore placeholder rendering issues.
      }
    }

    const result = await startBotTestAction(bot.id, {
      nodes: serializeWorkflowNodes((bot.config.nodes || []) as unknown[]) as CanvasNodePayload[],
      edges: serializeWorkflowEdges((bot.config.edges || []) as unknown[]) as CanvasEdgePayload[],
      variables: (bot.config.variables || []) as CanvasVariablePayload[],
      version: bot.config.version,
    })

    setIsStartingTest(false)

    if (!result.success) {
      if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
        preparedTelegramWindow.close()
      }
      setError(('error' in result ? result.error : null) || t('errors.startTest'))
      return
    }

    if ('bot' in result && result.bot) {
      setBot(result.bot)
    }

    const deepLink = 'deepLink' in result ? result.deepLink : null
    if (deepLink && autoOpenTelegramAfterTest) {
      let openedViaPreparedWindow = false

      if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
        try {
          preparedTelegramWindow.location.replace(deepLink)
          openedViaPreparedWindow = true
        } catch {
          openedViaPreparedWindow = false
        }
      }

      if (!openedViaPreparedWindow) {
        window.open(deepLink, '_blank', 'noopener,noreferrer')
      }
    } else if (preparedTelegramWindow && !preparedTelegramWindow.closed) {
      preparedTelegramWindow.close()
    }
  }, [autoOpenTelegramAfterTest, bot, hasStoredToken, setBot, t])

  const handleNext = useCallback(async () => {
    setError(null)

    if (state.showSuccess) {
      return
    }

    if (currentStep === 1) {
      const validationError = validateStepOne()
      if (validationError) {
        setError(validationError)
        return
      }

      const saved = await saveDraft()
      if (!saved) return
      setCurrentStep(2)
      return
    }

    if (currentStep === 2) {
      const saved = await saveDraft()
      if (!saved) return
      setCurrentStep(3)
      return
    }

    if (currentStep === 3) {
      const savedToken = await handleSaveTokenAndContinue()
      if (!savedToken) return
      const savedDraft = await saveDraft()
      if (!savedDraft) return
      setCurrentStep(4)
      return
    }

    await handleGenerateScenario()
  }, [currentStep, handleGenerateScenario, handleSaveTokenAndContinue, saveDraft, state.showSuccess, validateStepOne])

  const handleBack = useCallback(() => {
    setError(null)

    if (state.showSuccess) {
      setState((prev) => ({ ...prev, showSuccess: false }))
      setCurrentStep(1)
      return
    }

    setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev))
  }, [state.showSuccess])

  const updateAnswers = useCallback((patch: Partial<QuickStartAiAnswers>) => {
    setState((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        ...patch,
      },
    }))
  }, [])

  const currentStepTitle =
    currentStep === 1
      ? t('about.title')
      : currentStep === 2
        ? t('details.title')
        : currentStep === 3
          ? t('telegram.title')
          : t('review.title')

  return (
    <div className="h-full overflow-y-auto bg-[#05070A]">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 px-5 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#24A1DE]/20 bg-[#24A1DE]/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7fd6ff]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('kicker')}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                {state.showSuccess ? t('success.title') : currentStepTitle}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {state.showSuccess ? t('success.description') : t('subtitle')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white"
              onClick={() => void handleSkipToAdvanced()}
              disabled={isSkipping}
            >
              {isSkipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Workflow className="mr-2 h-4 w-4" />}
              {t('openAdvanced')}
            </Button>
          </div>
        </div>

        <QuickStartProgress currentStep={currentStep} t={t} />

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {state.showSuccess ? (
          <Card className="border-white/10 bg-zinc-950/60">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{t('success.title')}</div>
                    <div className="mt-1 text-sm text-zinc-400">{t('success.description')}</div>
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t('success.nodes')}</div>
                    <div className="mt-1 text-xl font-semibold text-white">{bot.config.nodes.length}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t('success.connections')}</div>
                    <div className="mt-1 text-xl font-semibold text-white">{bot.config.edges.length}</div>
                  </div>
                </div>
              </div>

              {state.lastSummary?.highlights && state.lastSummary.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {state.lastSummary.highlights.map((line) => (
                    <div key={line} className="rounded-full border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {!hasStoredToken && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {t('success.missingTokenHint')}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  type="button"
                  className="w-full justify-center gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/85 hover:to-[#8B5CF6]/85"
                  onClick={() => void handleStartTest()}
                  disabled={!canStartTest}
                >
                  {isStartingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {t('success.startTest')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2 border-white/10 text-zinc-200 hover:bg-white/5"
                  onClick={() => {
                    startTransition(() => {
                      router.push(editorCanvasHref)
                    })
                  }}
                >
                  <Workflow className="h-4 w-4" />
                  {t('success.openAdvanced')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-center text-zinc-300 hover:bg-white/5 hover:text-white"
                  onClick={handleBack}
                >
                  {t('success.editAnswers')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-white/10 bg-zinc-950/60">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-semibold text-white">{currentStepTitle}</h2>
                  <div className="text-sm text-zinc-500">
                    {currentStep === 1
                      ? t('about.description')
                      : currentStep === 2
                        ? t('details.description')
                        : currentStep === 3
                          ? t('telegram.description')
                          : t('review.description')}
                  </div>
                </div>

                {currentStep === 1 && (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="business-name" className="text-white">{t('about.businessName')}</Label>
                        <Input
                          id="business-name"
                          value={state.answers.businessName}
                          onChange={(event) => updateAnswers({ businessName: event.target.value })}
                          placeholder={t('about.businessNamePlaceholder')}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="target-audience" className="text-white">{t('about.targetAudience')}</Label>
                        <Input
                          id="target-audience"
                          value={state.answers.targetAudience}
                          onChange={(event) => updateAnswers({ targetAudience: event.target.value })}
                          placeholder={t('about.targetAudiencePlaceholder')}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="business-description" className="text-white">{t('about.businessDescription')}</Label>
                      <Textarea
                        id="business-description"
                        value={state.answers.businessDescription}
                        onChange={(event) => updateAnswers({ businessDescription: event.target.value })}
                        placeholder={t('about.businessDescriptionPlaceholder')}
                        rows={4}
                        className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="primary-goal" className="text-white">{t('about.primaryGoal')}</Label>
                      <Textarea
                        id="primary-goal"
                        value={state.answers.primaryGoal}
                        onChange={(event) => updateAnswers({ primaryGoal: event.target.value })}
                        placeholder={t('about.primaryGoalPlaceholder')}
                        rows={4}
                        className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="required-sections" className="text-white">{t('details.requiredSections')}</Label>
                        <Textarea
                          id="required-sections"
                          value={state.answers.requiredSections}
                          onChange={(event) => updateAnswers({ requiredSections: event.target.value })}
                          placeholder={t('details.requiredSectionsPlaceholder')}
                          rows={4}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lead-capture-fields" className="text-white">{t('details.leadCaptureFields')}</Label>
                        <Textarea
                          id="lead-capture-fields"
                          value={state.answers.leadCaptureFields}
                          onChange={(event) => updateAnswers({ leadCaptureFields: event.target.value })}
                          placeholder={t('details.leadCaptureFieldsPlaceholder')}
                          rows={4}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="offerings" className="text-white">{t('details.offerings')}</Label>
                        <Textarea
                          id="offerings"
                          value={state.answers.offerings}
                          onChange={(event) => updateAnswers({ offerings: event.target.value })}
                          placeholder={t('details.offeringsPlaceholder')}
                          rows={5}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="faq" className="text-white">{t('details.faq')}</Label>
                        <Textarea
                          id="faq"
                          value={state.answers.faq}
                          onChange={(event) => updateAnswers({ faq: event.target.value })}
                          placeholder={t('details.faqPlaceholder')}
                          rows={5}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="contact-details" className="text-white">{t('details.contactDetails')}</Label>
                        <Textarea
                          id="contact-details"
                          value={state.answers.contactDetails}
                          onChange={(event) => updateAnswers({ contactDetails: event.target.value })}
                          placeholder={t('details.contactDetailsPlaceholder')}
                          rows={4}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="tone" className="text-white">{t('details.tone')}</Label>
                        <Textarea
                          id="tone"
                          value={state.answers.tone}
                          onChange={(event) => updateAnswers({ tone: event.target.value })}
                          placeholder={t('details.tonePlaceholder')}
                          rows={4}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="extra-instructions" className="text-white">{t('details.extraInstructions')}</Label>
                      <Textarea
                        id="extra-instructions"
                        value={state.answers.extraInstructions}
                        onChange={(event) => updateAnswers({ extraInstructions: event.target.value })}
                        placeholder={t('details.extraInstructionsPlaceholder')}
                        rows={4}
                        className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{t('telegram.tokenTitle')}</div>
                          <div className="mt-1 text-xs text-zinc-500">{t('telegram.tokenHint')}</div>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
                          hasStoredToken
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border border-white/10 bg-white/[0.04] text-zinc-300'
                        }`}>
                          <KeyRound className="h-3.5 w-3.5" />
                          {hasStoredToken ? t('telegram.connected') : t('telegram.notConnected')}
                        </div>
                      </div>
                      <div className="mt-4">
                        <Label htmlFor="telegram-token" className="text-white">{t('telegram.tokenLabel')}</Label>
                        <Input
                          id="telegram-token"
                          type="password"
                          value={tokenDraft}
                          onChange={(event) => setTokenDraft(event.target.value)}
                          placeholder={hasStoredToken ? t('telegram.replacePlaceholder') : t('telegram.placeholder')}
                          className="mt-1.5 border-white/10 bg-zinc-900/50 text-white"
                        />
                      </div>
                      <div className="mt-3 text-sm text-zinc-400">
                        {hasStoredToken ? t('telegram.storedSecurely') : t('telegram.optionalHint')}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-medium text-white">{t('review.aboutCard')}</div>
                        <div className="mt-3 space-y-2 text-sm text-zinc-300">
                          <div><span className="text-zinc-500">{t('about.businessName')}:</span> {state.answers.businessName || '—'}</div>
                          <div><span className="text-zinc-500">{t('about.primaryGoal')}:</span> {state.answers.primaryGoal || '—'}</div>
                          <div><span className="text-zinc-500">{t('about.targetAudience')}:</span> {state.answers.targetAudience || '—'}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-medium text-white">{t('review.detailsCard')}</div>
                        <div className="mt-3 space-y-2 text-sm text-zinc-300">
                          <div><span className="text-zinc-500">{t('details.contactDetails')}:</span> {state.answers.contactDetails || '—'}</div>
                          <div><span className="text-zinc-500">{t('details.tone')}:</span> {state.answers.tone || '—'}</div>
                          <div><span className="text-zinc-500">{t('review.tokenStatus')}:</span> {hasStoredToken ? t('telegram.connected') : t('telegram.notConnected')}</div>
                        </div>
                      </div>
                    </div>

                    <PreviewGroup title={t('review.sectionsTitle')} items={previewSections} />
                    <PreviewGroup title={t('review.fieldsTitle')} items={previewFields} />
                    <PreviewGroup title={t('review.offeringsTitle')} items={previewOfferings} />
                    <PreviewGroup title={t('review.faqTitle')} items={previewFaq} />
                    <PreviewGroup title={t('review.instructionsTitle')} items={splitList(state.answers.extraInstructions)} />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <div className="text-xs text-zinc-500">
                    {(isSavingDraft || isSavingToken || isGenerating) ? t('status.savingDraft') : t('status.autoSaveHint')}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-2 text-zinc-300 hover:bg-white/5 hover:text-white"
                      onClick={handleBack}
                      disabled={currentStep === 1 && !state.showSuccess}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t('actions.back')}
                    </Button>
                    <Button
                      type="button"
                      className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/85 hover:to-[#8B5CF6]/85"
                      onClick={() => void handleNext()}
                      disabled={isSavingDraft || isSavingToken || isGenerating}
                    >
                      {isSavingToken || isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : currentStep === 4 ? (
                        <BotIcon className="h-4 w-4" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      {currentStep === 4 ? t('actions.generateScenario') : t('actions.continue')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuickStartScreen() {
  const locale = useLocale()
  const { bot, setBot, autoOpenTelegramAfterTest } = useBotState()

  if (!bot) {
    return (
      <div className="flex h-full items-center justify-center bg-[#05070A]">
        <Loader2 className="h-6 w-6 animate-spin text-[#24A1DE]" />
      </div>
    )
  }

  return (
    <QuickStartScreenContent
      key={`${bot.id}:${locale}`}
      bot={bot}
      locale={locale}
      autoOpenTelegramAfterTest={autoOpenTelegramAfterTest}
      setBot={setBot}
    />
  )
}
