'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Node } from 'reactflow'
import {
  MessageSquare,
  Keyboard,
  GitBranch,
  Database,
  Zap,
  Variable,
  Webhook,
  Globe,
  CreditCard,
  Play,
  Clock,
  MessageCircle,
  Code2,
  Maximize2,
  Minimize2,
  X,
  Plus,
  Trash2,
  CircleHelp,
  Settings,
  Save,
  Copy,
  Check,
  RefreshCw,
  KanbanSquare,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import type {
  NodeData,
  MessageNodeData,
  InputNodeData,
  ConditionNodeData,
  RouterNodeData,
  ActionNodeData,
  SetVariableNodeData,
  DatabaseNodeData,
  CrmNodeData,
  ScriptNodeData,
  HttpNodeData,
  WebhookNodeData,
  PaymentYookassaNodeData,
  PaymentStripeNodeData,
  PaymentRobokassaNodeData,
  PaymentStarsNodeData,
  TriggerNodeData,
  WaitNodeData,
  SchedulerNodeData,
  ReplyKeyboardNodeData,
  CommentNodeData,
  ActionPayload,
  KeyboardData,
  ParseMode,
  MessageAttachmentType,
  ComparisonOperator,
  HttpMethod,
  ScriptLanguage,
} from '@/lib/bot-editor/types/component-schemas'
import { NODE_CONFIGS } from '@/lib/bot-editor/types/component-schemas'
import type { NodeType } from '@/lib/bot-editor/types/bot.types'
import {
  getFlexibleCrmBoardAction,
  uploadBotMessageAttachmentAction,
} from '@/lib/bot-editor/actions/editor-actions'
import type { CrmField, CrmStage } from '@/lib/bot-editor/types/analytics.types'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import {
  TemplateVariableTextarea,
  VariableAutocompleteInput,
} from './variable-field-assist'
import { BOT_SYSTEM_VARIABLE_NAMES } from '@/lib/bot-editor/system-variables'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import {
  getNodeTemplateGuideKey,
} from '@/lib/bot-editor/help/help-guide-keys'
import { resolveNodeHelpTemplateId } from '@/lib/bot-editor/help/node-help-guides'

interface NodeSettingsPanelProps {
  node: Node | null
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void
  onSave?: () => Promise<boolean> | boolean
  onClose: () => void
  variables?: string[] // Available variable names
  detailedModeRequestKey?: number
}

// Icons map
const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  input: Keyboard,
  condition: GitBranch,
  router: GitBranch,
  action: Zap,
  setVariable: Variable,
  database: Database,
  crm: KanbanSquare,
  http: Globe,
  webhook: Webhook,
  paymentYookassa: CreditCard,
  paymentStripe: CreditCard,
  paymentRobokassa: CreditCard,
  paymentStars: CreditCard,
  trigger: Play,
  wait: Clock,
  scheduler: Clock,
  replyKeyboard: Keyboard,
  script: Code2,
  comment: MessageCircle,
}

const NODE_LABEL_MAX_LENGTH = 48

function getNodeHelpDocsHref(args: { locale: string; nodeType: NodeType }): string {
  const { locale, nodeType } = args
  const docsBasePath = `/${locale}/dashboard/docs`

  const anchorByNodeType: Partial<Record<NodeType, string>> = {
    trigger: 'node-trigger-command',
    message: 'node-message',
    input: 'node-input',
    condition: 'node-condition',
    router: 'node-router',
    scheduler: 'node-date-scheduler',
    replyKeyboard: 'node-reply-keyboard-node',
    action: 'node-action',
    database: 'node-database',
    crm: 'nodes-reference',
    http: 'node-http',
    webhook: 'node-http',
    paymentYookassa: 'node-payment-yookassa',
    paymentStripe: 'node-payment-stripe',
    paymentRobokassa: 'node-payment-robokassa',
    paymentStars: 'node-payment-stars',
    script: 'node-script',
    wait: 'nodes-reference',
    comment: 'nodes-reference',
  }

  const anchor = anchorByNodeType[nodeType] || 'nodes-reference'
  return `${docsBasePath}/nodes#${anchor}`
}

type TranslationFn = (key: string, values?: Record<string, unknown>) => string

const TEMPLATE_ID_TO_CANVAS_TRANSLATION_KEY: Record<string, string> = {
  'trigger-command': 'triggerCommand',
  'trigger-text': 'triggerText',
  'trigger-callback': 'triggerCallback',
  'trigger-schedule': 'triggerSchedule',
  'trigger-ai': 'triggerAI',
  message: 'message',
  'message-ai': 'messageAI',
  input: 'input',
  condition: 'condition',
  'condition-ai': 'conditionAI',
  router: 'router',
  scheduler: 'scheduler',
  'reply-keyboard': 'replyKeyboard',
  action: 'action',
  database: 'database',
  crm: 'crm',
  script: 'script',
  http: 'http',
  webhook: 'http',
  'payment-yookassa': 'paymentYookassa',
  'payment-stripe': 'paymentStripe',
  'payment-robokassa': 'paymentRobokassa',
  'payment-stars': 'paymentStars',
}

function tryTranslate(t: TranslationFn, key: string): string | null {
  try {
    return t(key)
  } catch {
    return null
  }
}

function getNodeHelpContent(args: {
  nodeType: NodeType
  data: Partial<NodeData>
  tNode: TranslationFn
  tCanvas: TranslationFn
}) {
  const { nodeType, data, tNode, tCanvas } = args
  const templateId = resolveNodeHelpTemplateId(nodeType, data)
  const translationSuffix = templateId ? TEMPLATE_ID_TO_CANVAS_TRANSLATION_KEY[templateId] : null

  const fallbackSummary = tNode('help.summary')
  const fallbackSteps = [tNode('help.step1'), tNode('help.step2'), tNode('help.step3')]
  const fallbackNote = tNode('help.note')

  if (!translationSuffix) {
    return { summary: fallbackSummary, steps: fallbackSteps, note: fallbackNote }
  }

  const summary =
    tryTranslate(tCanvas, `nodeTemplateDescriptions.${translationSuffix}`) || fallbackSummary

  const steps = [1, 2, 3].map((index) => {
    return (
      tryTranslate(tCanvas, `nodeTemplateHelpSteps.${translationSuffix}.step${index}`) ||
      fallbackSteps[index - 1]
    )
  })

  const typeSpecificNote =
    tryTranslate(tNode, `help.notes.${templateId}`) ||
    tryTranslate(tNode, `help.notes.${nodeType}`) ||
    fallbackNote

  return {
    summary,
    steps,
    note: typeSpecificNote,
  }
}

type ReplyKeyboardVariantOption = {
  value: string
  label: string
}

function getReplyKeyboardVariantOptionsFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  t?: (key: string) => string
): ReplyKeyboardVariantOption[] {
  const features =
    metadata && typeof metadata.features === 'object'
      ? (metadata.features as Record<string, unknown>)
      : null
  const replyKeyboard =
    features?.replyKeyboard && typeof features.replyKeyboard === 'object'
      ? (features.replyKeyboard as Record<string, unknown>)
      : null

  const options: ReplyKeyboardVariantOption[] = [
    { value: 'base', label: t ? t('replyKeyboardNode.baseVariantLabel') : 'Base keyboard' },
  ]

  const rules = Array.isArray(replyKeyboard?.rules) ? replyKeyboard?.rules : []
  for (let index = 0; index < rules.length; index += 1) {
    const item = rules[index]
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const id = String(record.id || '').trim()
    if (!id) continue
    const name =
      String(record.name || '').trim() || `${t ? t('replyKeyboardNode.ruleFallbackLabel') : 'Rule'} ${index + 1}`
    options.push({
      value: `rule:${id}`,
      label: `${t ? t('replyKeyboardNode.ruleVariantPrefix') : 'Rule'}: ${name}`,
    })
  }

  return options
}

type PaymentReturnProvider = 'yookassa' | 'stripe' | 'robokassa'
type PaymentReturnState = 'success' | 'cancel' | 'fail'

function buildPaymentAutoReturnUrl(input: {
  locale: string
  botId?: string | null
  provider?: PaymentReturnProvider
  state?: PaymentReturnState
}): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const origin = String(window.location.origin || '').trim()
  if (!origin) {
    return ''
  }

  const localeSegment = input.locale === 'en' ? 'en' : 'ru'
  const botId = String(input.botId || '').trim()
  const params = new URLSearchParams()
  if (botId) {
    params.set('botId', botId)
  }
  if (input.provider) {
    params.set('provider', input.provider)
  }
  if (input.state) {
    params.set('state', input.state)
  }
  const query = params.size > 0 ? `?${params.toString()}` : ''

  return `${origin}/${localeSegment}/payment/return${query}`
}

function buildYookassaAutoReturnUrl(input: { locale: string; botId?: string | null }): string {
  return buildPaymentAutoReturnUrl(input)
}

function buildStripeAutoReturnUrl(input: {
  locale: string
  botId?: string | null
  state: 'success' | 'cancel'
}): string {
  return buildPaymentAutoReturnUrl({
    locale: input.locale,
    botId: input.botId,
    provider: 'stripe',
    state: input.state,
  })
}

function buildRobokassaAutoReturnUrl(input: {
  locale: string
  botId?: string | null
  state: 'success' | 'fail'
}): string {
  return buildPaymentAutoReturnUrl({
    locale: input.locale,
    botId: input.botId,
    provider: 'robokassa',
    state: input.state,
  })
}

export function NodeSettingsPanel({
  node,
  onUpdate,
  onSave,
  onClose,
  variables = [],
  detailedModeRequestKey = 0,
}: NodeSettingsPanelProps) {
  const t = useTranslations('editor.nodeSettings')
  const tCanvas = useTranslations('editor.canvas')
  const tNodeSettings = t as unknown as TranslationFn
  const locale = useLocale()
  const { isDirty, bot } = useBotState()
  const [data, setData] = useState<Partial<NodeData>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDetailedMode, setIsDetailedMode] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const labelInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (node) {
      setData(node.data as NodeData)
      setHasChanges(false)
      const nodeDataRecord = (node.data || {}) as Record<string, unknown>
      const visibleLabel =
        typeof nodeDataRecord.__label === 'string' && nodeDataRecord.__label.trim()
          ? nodeDataRecord.__label.trim()
          : ''
      setLabelDraft(visibleLabel)
      setIsEditingLabel(false)
    }
  }, [node])

  useEffect(() => {
    if (!isDirty) {
      setHasChanges(false)
    }
  }, [isDirty])

  useEffect(() => {
    setIsDetailedMode(false)
  }, [node?.id])

  useEffect(() => {
    if (!node || detailedModeRequestKey <= 0) return
    setIsDetailedMode(true)
  }, [detailedModeRequestKey, node])

  useEffect(() => {
    if (!isDetailedMode || typeof document === 'undefined') {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isDetailedMode])

  useEffect(() => {
    if (!isEditingLabel) {
      return
    }

    labelInputRef.current?.focus()
    labelInputRef.current?.select()
  }, [isEditingLabel])

  const yookassaAutoReturnUrl = useMemo(
    () => buildYookassaAutoReturnUrl({ locale, botId: bot?.id }),
    [locale, bot?.id]
  )
  const stripeAutoSuccessUrl = useMemo(
    () => buildStripeAutoReturnUrl({ locale, botId: bot?.id, state: 'success' }),
    [locale, bot?.id]
  )
  const stripeAutoCancelUrl = useMemo(
    () => buildStripeAutoReturnUrl({ locale, botId: bot?.id, state: 'cancel' }),
    [locale, bot?.id]
  )
  const robokassaAutoSuccessUrl = useMemo(
    () => buildRobokassaAutoReturnUrl({ locale, botId: bot?.id, state: 'success' }),
    [locale, bot?.id]
  )
  const robokassaAutoFailUrl = useMemo(
    () => buildRobokassaAutoReturnUrl({ locale, botId: bot?.id, state: 'fail' }),
    [locale, bot?.id]
  )

  if (!node) {
    return (
      <div className="w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 p-6">
        <div className="text-center text-zinc-500">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('selectNode')}</p>
        </div>
      </div>
    )
  }

  const nodeType = node.type as NodeType
  const config = NODE_CONFIGS[nodeType]
  const Icon = ICONS[nodeType] || Settings
  const replyKeyboardVariantOptions = getReplyKeyboardVariantOptionsFromMetadata(
    (bot?.metadata || null) as Record<string, unknown> | null,
    tNodeSettings
  )
  const nodeHelpDocsHref = getNodeHelpDocsHref({ locale, nodeType })
  const nodeHelp = getNodeHelpContent({
    nodeType,
    data: data as Partial<NodeData>,
    tNode: t as unknown as TranslationFn,
    tCanvas: tCanvas as unknown as TranslationFn,
  })
  const nodeHelpTemplateId = resolveNodeHelpTemplateId(nodeType, data as Partial<NodeData>)
  const nodeHelpGuideKey = getNodeTemplateGuideKey(nodeHelpTemplateId || nodeType)
  const panelTitle =
    typeof (data as Record<string, unknown> | null)?.__label === 'string' &&
      String((data as Record<string, unknown>).__label || '').trim()
      ? String((data as Record<string, unknown>).__label)
      : config.label

  const commitNodeLabel = () => {
    const trimmed = labelDraft.trim().slice(0, NODE_LABEL_MAX_LENGTH)
    const currentCustomLabel =
      typeof (data as Record<string, unknown> | null)?.__label === 'string'
        ? String((data as Record<string, unknown>).__label || '').trim()
        : ''
    const nextLabel =
      !currentCustomLabel && trimmed === panelTitle.trim()
        ? ''
        : trimmed

    handleUpdate({ __label: nextLabel })
    setLabelDraft(nextLabel)
    setIsEditingLabel(false)
  }

  const resetNodeLabelEdit = () => {
    const currentLabel =
      typeof (data as Record<string, unknown> | null)?.__label === 'string'
        ? String((data as Record<string, unknown>).__label || '').trim()
        : ''
    setLabelDraft(currentLabel)
    setIsEditingLabel(false)
  }

  const handleUpdate = (newData: Partial<NodeData>) => {
    const updatedData = {
      ...(data as Record<string, unknown>),
      ...(newData as Record<string, unknown>),
    } as Partial<NodeData>
    setData(updatedData)
    setHasChanges(true)
    // Persist only the patch to avoid leaking stale fields from previously selected nodes.
    onUpdate(node.id, newData)
  }

  const handleSave = async () => {
    onUpdate(node.id, data)

    if (!onSave) {
      setHasChanges(false)
      return
    }

    setIsSaving(true)
    try {
      const result = await onSave()
      if (result !== false) {
        setHasChanges(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const panelSurface = (
    <div
      className={`${isDetailedMode
        ? 'w-full max-w-[980px] h-[min(88vh,920px)] rounded-2xl border border-white/10 shadow-2xl shadow-black/50 bg-zinc-900/95'
        : 'w-96 h-full border-l border-white/10 bg-zinc-900/95'
        } backdrop-blur-xl flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className={`${isDetailedMode ? 'p-5' : 'p-4'} border-b border-white/10`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: `${config.color}20` }}>
              <Icon className="w-4 h-4" style={{ color: config.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingLabel ? (
                  <div className="flex items-center gap-2">
                    <Input
                      ref={labelInputRef}
                      value={labelDraft}
                      maxLength={NODE_LABEL_MAX_LENGTH}
                      onChange={(event) => setLabelDraft(event.target.value.slice(0, NODE_LABEL_MAX_LENGTH))}
                      onBlur={commitNodeLabel}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitNodeLabel()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          resetNodeLabelEdit()
                        }
                      }}
                      placeholder={config.label}
                      className="h-8 min-w-[180px] max-w-[260px] border-white/10 bg-zinc-950/80 px-2.5 text-sm font-semibold text-white"
                    />
                    <span className="text-[11px] text-zinc-500">
                      {labelDraft.length}/{NODE_LABEL_MAX_LENGTH}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLabelDraft(panelTitle)
                      setIsEditingLabel(true)
                    }}
                    className={`rounded-md text-left font-semibold text-white transition-colors hover:text-[#7fd6ff] ${isDetailedMode ? 'text-base' : ''}`}
                  >
                    {panelTitle}
                  </button>
                )}
                <HelpGuideButton
                  guideKey={nodeHelpGuideKey}
                  title={panelTitle}
                  summary={nodeHelp.summary}
                  steps={nodeHelp.steps}
                  notes={[nodeHelp.note]}
                  docsHref={nodeHelpDocsHref}
                />
              </div>
              <p className="text-xs text-zinc-500">{t('nodeId')} {node.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsDetailedMode((prev) => !prev)}
              title={isDetailedMode ? t('collapseDetailedMode') : t('openDetailedMode')}
              className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
            >
              {isDetailedMode ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {isDetailedMode && (
          <div className="text-xs text-zinc-400">
            {t('detailedModeHint')}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isDetailedMode ? 'p-5' : 'p-4'}`}>
        {nodeType === 'message' && (
          <MessageSettings
            data={data as MessageNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'input' && (
          <InputSettings
            data={data as InputNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'condition' && (
          <ConditionSettings
            data={data as ConditionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'router' && (
          <RouterSettings
            data={data as RouterNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'action' && (
          <ActionSettings
            data={data as ActionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'setVariable' && (
          <SetVariableSettings
            data={data as SetVariableNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'database' && (
          <DatabaseSettings
            data={data as DatabaseNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'crm' && (
          <CrmSettings
            data={data as CrmNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'script' && (
          <ScriptSettings
            data={data as ScriptNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'http' && (
          <HttpSettings
            data={data as HttpNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'webhook' && (
          <HttpSettings
            data={data as WebhookNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {(nodeType === 'paymentYookassa' ||
          nodeType === 'paymentStripe' ||
          nodeType === 'paymentRobokassa' ||
          nodeType === 'paymentStars') && (
          <PaymentSettings
            nodeType={nodeType}
            data={data as PaymentYookassaNodeData | PaymentStripeNodeData | PaymentRobokassaNodeData | PaymentStarsNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            defaultYookassaReturnUrl={yookassaAutoReturnUrl}
            defaultStripeSuccessUrl={stripeAutoSuccessUrl}
            defaultStripeCancelUrl={stripeAutoCancelUrl}
            defaultRobokassaSuccessUrl={robokassaAutoSuccessUrl}
            defaultRobokassaFailUrl={robokassaAutoFailUrl}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'trigger' && (
          <TriggerSettings
            data={data as TriggerNodeData}
            onUpdate={handleUpdate}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'wait' && (
          <WaitSettings
            data={data as WaitNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'scheduler' && (
          <SchedulerSettings
            data={data as SchedulerNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'replyKeyboard' && (
          <ReplyKeyboardSettings
            data={data as ReplyKeyboardNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            variantOptions={replyKeyboardVariantOptions}
            t={tNodeSettings}
          />
        )}
        {nodeType === 'comment' && (
          <CommentSettings
            data={data as CommentNodeData}
            onUpdate={handleUpdate}
            t={tNodeSettings}
          />
        )}
      </div>

      {/* Footer */}
      {hasChanges && (
        <div className={`${isDetailedMode ? 'p-5' : 'p-4'} border-t border-white/10`}>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6]"
          >
            <Save className="w-4 h-4" />
            {t('save')}
          </Button>
        </div>
      )}
    </div>
  )

  if (!isDetailedMode || typeof document === 'undefined') {
    return panelSurface
  }

  return createPortal(
    <div className="fixed inset-0 z-[3000]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsDetailedMode(false)
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 p-4 md:p-6 flex items-center justify-center pointer-events-none">
        <div className="w-full flex items-center justify-center">
          <div className="pointer-events-auto">
            {panelSurface}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// MESSAGE NODE SETTINGS
// ============================================================================

type MessageFormatAction = {
  id: string
  label: string
  apply: (selectedText: string) => string
}

type MessageFormatMenuState = {
  x: number
  y: number
  selectionStart: number
  selectionEnd: number
  hasSelection: boolean
}

function escapeTelegramMarkdownV2(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

function getMessageFormattingActions(
  parseMode: ParseMode | 'None',
  tm: (key: string) => string
): MessageFormatAction[] {
  if (parseMode === 'HTML') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `<b>${text}</b>` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `<i>${text}</i>` },
      { id: 'underline', label: tm('formatUnderline'), apply: (text) => `<u>${text}</u>` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `<code>${text}</code>` },
      { id: 'spoiler', label: tm('formatSpoiler'), apply: (text) => `<tg-spoiler>${text}</tg-spoiler>` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `<a href="https://example.com">${text}</a>` },
    ]
  }

  if (parseMode === 'MarkdownV2') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `*${escapeTelegramMarkdownV2(text)}*` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `_${escapeTelegramMarkdownV2(text)}_` },
      { id: 'underline', label: tm('formatUnderline'), apply: (text) => `__${escapeTelegramMarkdownV2(text)}__` },
      { id: 'strike', label: tm('formatStrike'), apply: (text) => `~${escapeTelegramMarkdownV2(text)}~` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `\`${text.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`` },
      { id: 'spoiler', label: tm('formatSpoiler'), apply: (text) => `||${escapeTelegramMarkdownV2(text)}||` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `[${escapeTelegramMarkdownV2(text)}](https://example.com)` },
    ]
  }

  if (parseMode === 'Markdown') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `*${text}*` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `_${text}_` },
      { id: 'strike', label: tm('formatStrike'), apply: (text) => `~${text}~` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `\`${text}\`` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `[${text}](https://example.com)` },
    ]
  }

  return []
}

function normalizeMessageAttachmentType(
  value: unknown
): MessageAttachmentType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'photo' ||
    normalized === 'video' ||
    normalized === 'document' ||
    normalized === 'audio'
  ) {
    return normalized
  }
  return null
}

function getPrimaryMessageAttachment(
  data: MessageNodeData
): { type: MessageAttachmentType; source: string } | null {
  const attachments = Array.isArray(data.attachments) ? data.attachments : []

  for (const rawAttachment of attachments) {
    if (!rawAttachment || typeof rawAttachment !== 'object') {
      continue
    }

    const record = rawAttachment as Record<string, unknown>
    const type = normalizeMessageAttachmentType(
      record.type ?? record.kind ?? record.mediaType ?? record.media_type
    )
    if (!type) {
      continue
    }

    const sourceCandidate =
      record.source ??
      record.url ??
      record.media ??
      record.fileId ??
      record.file_id ??
      record.value

    return {
      type,
      source: typeof sourceCandidate === 'string' ? sourceCandidate : '',
    }
  }

  return null
}

function MessageSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: MessageNodeData
  onUpdate: (data: Partial<MessageNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const tm = (key: string) => t(`message.${key}`)
  const aiMeta = data as unknown as {
    aiEnabled?: boolean
    aiPrompt?: string
    aiModel?: string
  }
  const isAiMessage = Boolean(aiMeta.aiEnabled)
  const { bot } = useBotState()
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const formatHintButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const [formatMenu, setFormatMenu] = useState<MessageFormatMenuState | null>(null)
  const [formatHintPosition, setFormatHintPosition] = useState<{ left: number; top: number } | null>(null)
  const [isFormatHintVisible, setIsFormatHintVisible] = useState(false)
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)
  const messageDraftsEnabledGlobally = Boolean(
    bot?.metadata &&
      typeof bot.metadata === 'object' &&
      bot.metadata.features &&
      typeof bot.metadata.features === 'object' &&
      (bot.metadata.features as Record<string, unknown>).messageDrafts &&
      typeof (bot.metadata.features as Record<string, unknown>).messageDrafts === 'object' &&
      Boolean(
        (
          (bot.metadata.features as Record<string, unknown>).messageDrafts as Record<string, unknown>
        ).enabled
      )
  )

  const currentParseMode = (data.parseMode || 'None') as ParseMode | 'None'
  const formatActions = getMessageFormattingActions(currentParseMode, tm)
  const primaryAttachment = getPrimaryMessageAttachment(data)
  const attachmentType = primaryAttachment?.type ?? 'none'
  const attachmentSource = primaryAttachment?.source ?? ''

  useEffect(() => {
    if (!formatMenu) return

    const closeMenu = () => setFormatMenu(null)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target && menuRef.current?.contains(target)) {
        return
      }
      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [formatMenu])

  useEffect(() => {
    if (!isFormatHintVisible) return

    const closeHint = () => setIsFormatHintVisible(false)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeHint()
      }
    }

    window.addEventListener('scroll', closeHint, true)
    window.addEventListener('resize', closeHint)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', closeHint, true)
      window.removeEventListener('resize', closeHint)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFormatHintVisible])

  const rememberSelection = (textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    lastSelectionRef.current = { start, end }
  }

  const openFormattingMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault()

    const textarea = event.currentTarget
    let selectionStart = textarea.selectionStart ?? 0
    let selectionEnd = textarea.selectionEnd ?? 0

    if (selectionStart === selectionEnd && lastSelectionRef.current) {
      selectionStart = lastSelectionRef.current.start
      selectionEnd = lastSelectionRef.current.end
    }

    const menuWidth = 230
    const menuHeight = currentParseMode === 'None' ? 76 : 280
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12)

    setFormatMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      selectionStart,
      selectionEnd,
      hasSelection: selectionStart !== selectionEnd,
    })
  }

  const openFormatHint = () => {
    const trigger = formatHintButtonRef.current
    if (!trigger || typeof window === 'undefined') return

    const rect = trigger.getBoundingClientRect()
    const tooltipWidth = Math.min(320, Math.max(220, window.innerWidth - 32))
    const viewportPadding = 12
    const left = Math.min(
      window.innerWidth - tooltipWidth - viewportPadding,
      Math.max(viewportPadding, rect.right - tooltipWidth)
    )
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120)

    setFormatHintPosition({ left, top })
    setIsFormatHintVisible(true)
  }

  const applyFormatting = (formatter: (selectedText: string) => string) => {
    if (!formatMenu) return

    const sourceText = data.text || ''
    const selectedText = sourceText.slice(formatMenu.selectionStart, formatMenu.selectionEnd)
    if (!selectedText) {
      setFormatMenu(null)
      return
    }

    const replacement = formatter(selectedText)
    const updatedText = `${sourceText.slice(0, formatMenu.selectionStart)}${replacement}${sourceText.slice(formatMenu.selectionEnd)}`

    onUpdate({ text: updatedText })
    setFormatMenu(null)

    requestAnimationFrame(() => {
      const textarea = textAreaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(
        formatMenu.selectionStart,
        formatMenu.selectionStart + replacement.length
      )
    })
  }

  const updatePrimaryAttachment = (
    nextType: MessageAttachmentType | 'none',
    nextSource: string
  ) => {
    if (nextType === 'none') {
      onUpdate({ attachments: [] })
      return
    }

    onUpdate({
      attachments: [
        {
          type: nextType,
          source: nextSource,
        },
      ],
    })
  }

  const uploadAttachmentFile = useCallback(async (file: File) => {
    if (!file) return

    if (attachmentType === 'none') {
      setAttachmentUploadError(tm('attachmentSelectTypeFirst'))
      return
    }

    if (!bot?.id) {
      setAttachmentUploadError(tm('attachmentUploadBotMissing'))
      return
    }

    setAttachmentUploadError(null)
    setIsUploadingAttachment(true)
    try {
      const result = await uploadBotMessageAttachmentAction(bot.id, file)
      if (!result.success) {
        setAttachmentUploadError(result.error || tm('attachmentUploadFailed'))
        return
      }

      updatePrimaryAttachment(attachmentType as MessageAttachmentType, result.path || '')
    } catch (error) {
      setAttachmentUploadError(String(error) || tm('attachmentUploadFailed'))
    } finally {
      setIsUploadingAttachment(false)
    }
  }, [attachmentType, bot?.id, tm, updatePrimaryAttachment])

  const handleAttachmentDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsAttachmentDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await uploadAttachmentFile(file)
  }, [uploadAttachmentFile])

  const handleAttachmentFilePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    await uploadAttachmentFile(file)
  }, [uploadAttachmentFile])

  return (
    <div className="space-y-4 relative">
      {isAiMessage && (
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{tm('aiTitle')}</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {tm('aiDescription')}
              </p>
            </div>
            <div className="text-[11px] px-2 py-1 rounded border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
              {tm('soon')}
            </div>
          </div>

          <div className="relative">
            <Label htmlFor="ai-message-prompt" className="text-xs text-zinc-300">
              {tm('aiPromptLabel')}
            </Label>
            <Textarea
              id="ai-message-prompt"
              value={String(aiMeta.aiPrompt || '')}
              readOnly
              disabled
              placeholder={tm('aiPromptPlaceholder')}
              rows={3}
              className="mt-1.5 bg-zinc-900/40 border-white/10"
            />
            <div className="absolute inset-x-0 bottom-0 top-7 rounded-md bg-zinc-950/45 border border-white/5 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-medium text-zinc-300">{tm('aiSoonOverlay')}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="msg-text">{tm('textLabel')}</Label>
        <TemplateVariableTextarea
          ref={textAreaRef}
          id="msg-text"
          value={data.text || ''}
          onValueChange={(value) => {
            setFormatMenu(null)
            onUpdate({ text: value })
          }}
          onSelect={(e) => rememberSelection(e.currentTarget)}
          onMouseUp={(e) => rememberSelection(e.currentTarget)}
          onKeyUp={(e) => rememberSelection(e.currentTarget)}
          onMouseDownCapture={(e) => {
            if (e.button === 2) {
              rememberSelection(e.currentTarget)
            }
          }}
          onContextMenu={openFormattingMenu}
          placeholder={tm('textPlaceholder')}
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {tm('variableHint')}
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          {tm('formatContextHint')}
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Label htmlFor="msg-parsemode">{tm('formatting')}</Label>
          <div className="relative">
            <button
              ref={formatHintButtonRef}
              type="button"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-transparent p-0 text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]/70"
              aria-label={tm('formattingHelpLabel')}
              onMouseEnter={openFormatHint}
              onMouseLeave={() => setIsFormatHintVisible(false)}
              onFocus={openFormatHint}
              onBlur={() => setIsFormatHintVisible(false)}
            >
              <CircleHelp className="h-3 w-3" />
            </button>
          </div>
        </div>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">{tm('none')}</SelectItem>
            <SelectItem value="Markdown">{tm('markdown')}</SelectItem>
            <SelectItem value="MarkdownV2">{tm('markdownV2')}</SelectItem>
            <SelectItem value="HTML">{tm('html')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-white/10 bg-zinc-800/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-300">{tm('typingDraftTitle')}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {messageDraftsEnabledGlobally
                ? tm('typingDraftGlobalHint')
                : tm('typingDraftHint')}
            </p>
          </div>
          <Switch
            id="msg-typing-draft"
            checked={Boolean(data.typingDraft)}
            onCheckedChange={(checked) => onUpdate({ typingDraft: checked })}
          />
        </div>
        <p className="text-[11px] text-zinc-600 mt-2">
          {messageDraftsEnabledGlobally
            ? tm('typingDraftGlobalStatus')
            : tm('typingDraftNodeOnlyHint')}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-preview">{tm('disablePreview')}</Label>
          <Switch
            id="msg-preview"
            checked={data.disableWebPagePreview || false}
            onCheckedChange={(checked) => onUpdate({ disableWebPagePreview: checked })}
          />
        </div>
      </div>

      <div>
        <Label>{tm('attachments')}</Label>
        <div className="mt-2 space-y-3 rounded-lg bg-zinc-800/20 border border-white/10 p-3">
          <div>
            <Label htmlFor="msg-attachment-type" className="text-xs text-zinc-400">
              {tm('attachmentType')}
            </Label>
            <Select
              value={attachmentType}
              onValueChange={(value) =>
                updatePrimaryAttachment(value as MessageAttachmentType | 'none', attachmentSource)
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tm('attachmentNone')}</SelectItem>
                <SelectItem value="photo">{tm('attachmentPhoto')}</SelectItem>
                <SelectItem value="video">{tm('attachmentVideo')}</SelectItem>
                <SelectItem value="document">{tm('attachmentDocument')}</SelectItem>
                <SelectItem value="audio">{tm('attachmentAudio')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {attachmentType !== 'none' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleAttachmentFilePick(event)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (!isAttachmentDragActive) {
                    setIsAttachmentDragActive(true)
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof HTMLElement &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return
                  }
                  setIsAttachmentDragActive(false)
                }}
                onDrop={(event) => void handleAttachmentDrop(event)}
                className={`mb-3 rounded-lg border px-3 py-3 text-sm transition-colors cursor-pointer outline-none ${isAttachmentDragActive
                  ? 'border-[#24A1DE]/50 bg-[#24A1DE]/10 text-white'
                  : 'border-white/10 bg-zinc-800/20 text-zinc-300 hover:border-white/20 hover:bg-zinc-800/30'
                  }`}
              >
                <div className="font-medium">
                  {isUploadingAttachment ? tm('attachmentUploading') : tm('attachmentDropTitle')}
                </div>
                <div className="text-xs mt-1 text-zinc-400">
                  {tm('attachmentDropHint')}
                </div>
              </div>

              <Label htmlFor="msg-attachment-source" className="text-xs text-zinc-400">
                {tm('attachmentSource')}
              </Label>
              <Input
                id="msg-attachment-source"
                value={attachmentSource}
                onChange={(event) =>
                  updatePrimaryAttachment(attachmentType as MessageAttachmentType, event.target.value)
                }
                placeholder={tm('attachmentSourcePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">{tm('attachmentSourceHint')}</p>
              <p className="text-xs text-zinc-600 mt-1">{tm('attachmentCaptionHint')}</p>
              {attachmentUploadError && (
                <p className="text-xs text-red-300 mt-2">{attachmentUploadError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>{tm('keyboard')}</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
          t={t}
        />
      </div>

      {formatMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[230px] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-2"
          style={{
            left: formatMenu.x,
            top: formatMenu.y,
          }}
        >
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
            {tm('formatMenuTitle')}
          </div>

          {!formatMenu.hasSelection ? (
            <div className="px-2 py-2 text-sm text-zinc-300 bg-white/5 border border-white/10 rounded-lg">
              {tm('formatSelectTextFirst')}
            </div>
          ) : currentParseMode === 'None' ? (
            <div className="px-2 py-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              {tm('formatEnableFirst')}
            </div>
          ) : (
            <div className="space-y-1">
              {formatActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => applyFormatting(action.apply)}
                  className="w-full text-left px-2 py-2 rounded-lg text-sm text-zinc-200 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      {isFormatHintVisible && formatHintPosition && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[10050] w-80 max-w-[calc(100vw-2rem)] rounded-md border border-white/15 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-300 break-words shadow-xl shadow-black/40"
          style={{
            left: formatHintPosition.left,
            top: formatHintPosition.top,
          }}
        >
          {tm('formattingHelpHint')}
        </div>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// INPUT NODE SETTINGS
// ============================================================================

function InputSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: InputNodeData
  onUpdate: (data: Partial<InputNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const ti = (key: string) => t(`input.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="input-question">{ti('questionLabel')}</Label>
        <TemplateVariableTextarea
          id="input-question"
          value={data.question || ''}
          onValueChange={(value) => onUpdate({ question: value })}
          placeholder={ti('questionPlaceholder')}
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div>
        <Label htmlFor="input-varname">{ti('variableNameLabel')}</Label>
        <VariableAutocompleteInput
          id="input-varname"
          value={data.variableName || ''}
          onValueChange={(value) => onUpdate({ variableName: value })}
          placeholder={ti('variableNamePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {ti('variableHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="input-parsemode">{ti('formatting')}</Label>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">{t('message.none')}</SelectItem>
            <SelectItem value="Markdown">{t('message.markdown')}</SelectItem>
            <SelectItem value="MarkdownV2">{t('message.markdownV2')}</SelectItem>
            <SelectItem value="HTML">{t('message.html')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="input-force-reply">{ti('forceReplyLabel')}</Label>
          <Switch
            id="input-force-reply"
            checked={data.forceReply !== false}
            onCheckedChange={(checked) => onUpdate({ forceReply: checked })}
          />
        </div>
        {data.forceReply !== false && (
          <Input
            value={data.inputPlaceholder || ''}
            onChange={(e) => onUpdate({ inputPlaceholder: e.target.value })}
            placeholder={ti('inputPlaceholder')}
            className="bg-zinc-800/50 border-white/10"
          />
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="input-skip">{ti('skipButtonLabel')}</Label>
          <Switch
            id="input-skip"
            checked={data.skipButton || false}
            onCheckedChange={(checked) => onUpdate({ skipButton: checked })}
          />
        </div>
        {data.skipButton && (
          <Input
            value={data.skipValue || ''}
            onChange={(e) => onUpdate({ skipValue: e.target.value })}
            placeholder={ti('skipValuePlaceholder')}
            className="bg-zinc-800/50 border-white/10"
          />
        )}
      </div>

      <div>
        <Label>{ti('keyboard')}</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
          t={t}
        />
      </div>
    </div>
  )
}

function createRouterCaseId(): string {
  return `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================================
// CONDITION NODE SETTINGS
// ============================================================================

function ConditionSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: ConditionNodeData
  onUpdate: (data: Partial<ConditionNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const tc = (key: string, values?: Record<string, unknown>) => t(`condition.${key}`, values)
  const aiMeta = data as unknown as {
    aiEnabled?: boolean
    aiPrompt?: string
  }
  const isAiLogic = Boolean(aiMeta.aiEnabled)
  const conditionVariableOptions = Array.from(
    new Set(
      [
        ...variables,
        ...BOT_SYSTEM_VARIABLE_NAMES,
      ]
        .map((value) => String(value || '').trim())
        .map((value) => {
          const wrappedMatch = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/)
          return wrappedMatch?.[1]?.trim() || value
        })
        .filter(Boolean)
    )
  )

  const getConditionLabel = (op: string) => {
    switch (op) {
      case 'equals': return tc('equals')
      case 'notEquals': return tc('notEquals')
      case 'contains': return tc('contains')
      case 'notContains': return tc('notContains')
      case 'gt': return tc('gt')
      case 'lt': return tc('lt')
      case 'gte': return tc('gte')
      case 'lte': return tc('lte')
      case 'isEmpty': return tc('isEmpty')
      case 'isNotEmpty': return tc('isNotEmpty')
      default: return op
    }
  }

  return (
    <div className="space-y-4">
      {isAiLogic && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{tc('aiTitle')}</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {tc('aiDescription')}
              </p>
            </div>
            <div className="text-[11px] px-2 py-1 rounded border border-amber-300/20 bg-amber-400/10 text-amber-200">
              {tc('soon')}
            </div>
          </div>

          <div className="relative">
            <Label htmlFor="ai-logic-prompt" className="text-xs text-zinc-300">
              {tc('aiPromptLabel')}
            </Label>
            <Textarea
              id="ai-logic-prompt"
              value={String(aiMeta.aiPrompt || '')}
              readOnly
              disabled
              placeholder={tc('aiPromptPlaceholder')}
              rows={3}
              className="mt-1.5 bg-zinc-900/40 border-white/10"
            />
            <div className="absolute inset-x-0 bottom-0 top-7 rounded-md bg-zinc-950/45 border border-white/5 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-medium text-zinc-300">{tc('aiSoonOverlay')}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="cond-var">{tc('variableLabel')}</Label>
        <VariableAutocompleteInput
          id="cond-var"
          value={data.variable || ''}
          onValueChange={(value) => onUpdate({ variable: value })}
          placeholder={tc('selectVariable')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={conditionVariableOptions}
        />
      </div>

      <div>
        <Label htmlFor="cond-op">{tc('conditionLabel')}</Label>
        <Select
          value={data.operator || 'equals'}
          onValueChange={(value) => onUpdate({ operator: value as ComparisonOperator })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">{tc('equals')}</SelectItem>
            <SelectItem value="notEquals">{tc('notEquals')}</SelectItem>
            <SelectItem value="contains">{tc('contains')}</SelectItem>
            <SelectItem value="notContains">{tc('notContains')}</SelectItem>
            <SelectItem value="gt">{tc('gt')}</SelectItem>
            <SelectItem value="lt">{tc('lt')}</SelectItem>
            <SelectItem value="gte">{tc('gte')}</SelectItem>
            <SelectItem value="lte">{tc('lte')}</SelectItem>
            <SelectItem value="isEmpty">{tc('isEmpty')}</SelectItem>
            <SelectItem value="isNotEmpty">{tc('isNotEmpty')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="cond-value">{tc('valueLabel')}</Label>
        <Input
          id="cond-value"
          value={data.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={tc('valuePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div className="p-3 rounded-lg bg-zinc-800/30 border border-white/10">
        <p className="text-sm text-zinc-400">
          {tc('preview', {
            variable: data.variable || 'variable',
            condition: getConditionLabel(data.operator || 'equals'),
            value: data.value || '...'
          })}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// ROUTER / SWITCH NODE SETTINGS
// ============================================================================

function RouterSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: RouterNodeData
  onUpdate: (data: Partial<RouterNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const tr = (key: string) => t(`router.${key}`)
  const tc = (key: string) => t(`condition.${key}`)
  const cases = Array.isArray(data.cases) ? data.cases : []
  const operator = (data.operator || 'equals') as ComparisonOperator

  const updateCase = (caseId: string, patch: Record<string, unknown>) => {
    onUpdate({
      cases: cases.map((routerCase) =>
        routerCase.id === caseId ? { ...routerCase, ...patch } : routerCase
      ),
    })
  }

  const addCase = () => {
    onUpdate({
      cases: [
        ...cases,
        {
          id: createRouterCaseId(),
          label: `${tr('caseDefaultLabel')} ${cases.length + 1}`,
          value: '',
        },
      ],
    })
  }

  const removeCase = (caseId: string) => {
    onUpdate({
      cases: cases.filter((routerCase) => routerCase.id !== caseId),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="router-variable">{tr('variableLabel')}</Label>
        <VariableAutocompleteInput
          id="router-variable"
          value={data.variable || ''}
          onValueChange={(value) => onUpdate({ variable: value })}
          placeholder={tr('variablePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {tr('variableHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="router-operator">{tr('operatorLabel')}</Label>
        <Select
          value={operator}
          onValueChange={(value) => onUpdate({ operator: value as ComparisonOperator })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">{tc('equals')}</SelectItem>
            <SelectItem value="notEquals">{tc('notEquals')}</SelectItem>
            <SelectItem value="contains">{tc('contains')}</SelectItem>
            <SelectItem value="notContains">{tc('notContains')}</SelectItem>
            <SelectItem value="gt">{tc('gt')}</SelectItem>
            <SelectItem value="lt">{tc('lt')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{tr('casesLabel')}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={addCase}
          >
            <Plus className="w-3.5 h-3.5" />
            {tr('addCase')}
          </Button>
        </div>

        {cases.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-zinc-800/20 px-3 py-2 text-sm text-zinc-500">
            {tr('noCases')}
          </div>
        )}

        {cases.map((routerCase, index) => (
          <div
            key={routerCase.id || index}
            className="rounded-xl border border-white/10 bg-zinc-800/20 p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                {tr('handleLabel')}{' '}
                <code
                  className="text-zinc-300"
                  title={String(routerCase.id || '')}
                >
                  {`case:case_${index + 1}`}
                </code>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-zinc-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => removeCase(String(routerCase.id || ''))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div>
              <Label htmlFor={`router-case-label-${index}`}>{tr('caseLabel')}</Label>
              <Input
                id={`router-case-label-${index}`}
                value={String(routerCase.label || '')}
                onChange={(e) => updateCase(String(routerCase.id), { label: e.target.value })}
                placeholder={`${tr('caseDefaultLabel')} ${index + 1}`}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>

            <div>
              <Label htmlFor={`router-case-value-${index}`}>{tr('caseValueLabel')}</Label>
              <Input
                id={`router-case-value-${index}`}
                value={routerCase.value == null ? '' : String(routerCase.value)}
                onChange={(e) => updateCase(String(routerCase.id), { value: e.target.value })}
                placeholder={tr('caseValuePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="router-default-label">{tr('defaultBranchLabel')}</Label>
        <Input
          id="router-default-label"
          value={data.defaultLabel || ''}
          onChange={(e) => onUpdate({ defaultLabel: e.target.value })}
          placeholder={tr('defaultPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">
          {tr('defaultHint')}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// ACTION NODE SETTINGS
// ============================================================================

function ActionSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: ActionNodeData
  onUpdate: (data: Partial<ActionNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const ta = (key: string, values?: Record<string, unknown>) => t(`action.${key}`, values)
  const action = (data.action || {}) as ActionPayload
  const actionType = String(action.type || 'setVariable')
  const actionNumber = (key: string, fallback: number) => {
    const value = Number(action[key] ?? fallback)
    return Number.isFinite(value) ? value : fallback
  }

  const createActionConfigByType = (value: string): ActionPayload => {
    if (value === 'delay') {
      return { type: 'delay', duration: 1000 }
    }
    if (value === 'deleteMessage') {
      return { type: 'deleteMessage', delay: 0 }
    }
    if (value === 'random') {
      return { type: 'random', aPercent: 50, saveToVariable: '' }
    }
    return { type: 'setVariable', variableName: '', value: '' }
  }

  return (
    <Tabs defaultValue="action" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
        <TabsTrigger value="action">{ta('actionTab')}</TabsTrigger>
        <TabsTrigger value="error">{ta('errorTab')}</TabsTrigger>
      </TabsList>

      <TabsContent value="action" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-type">{ta('typeLabel')}</Label>
          <Select
            value={actionType}
            onValueChange={(value) =>
              onUpdate({
                action: createActionConfigByType(value),
              })
            }
          >
            <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="setVariable">{ta('setVariable')}</SelectItem>
              <SelectItem value="delay">{ta('delay')}</SelectItem>
              <SelectItem value="deleteMessage">{ta('deleteMessage')}</SelectItem>
              <SelectItem value="random">{ta('random')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionType === 'setVariable' && (
          <>
            <div>
              <Label htmlFor="setvar-name">{ta('variableNameLabel')}</Label>
              <VariableAutocompleteInput
                id="setvar-name"
                value={String(action.variableName || '')}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...action, variableName: value },
                  })
                }
                placeholder={ta('variableNamePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
            </div>
            <div>
              <Label htmlFor="setvar-value">{ta('valueLabel')}</Label>
              <TemplateVariableTextarea
                id="setvar-value"
                value={String(action.value || '')}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...action, value },
                  })
                }
                placeholder={ta('valuePlaceholder')}
                rows={2}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
            </div>
          </>
        )}

        {actionType === 'delay' && (
          <div>
            <Label htmlFor="delay-duration">{ta('delayLabel')}</Label>
            <Input
              id="delay-duration"
              type="number"
              value={actionNumber('duration', 1000)}
              onChange={(e) =>
                onUpdate({
                  action: { ...action, duration: Number(e.target.value) },
                })
              }
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}

        {actionType === 'deleteMessage' && (
          <div>
            <Label htmlFor="delete-delay">{ta('deleteDelayLabel')}</Label>
            <Input
              id="delete-delay"
              type="number"
              value={actionNumber('delay', 0)}
              onChange={(e) =>
                onUpdate({
                  action: { ...action, delay: Number(e.target.value) },
                })
              }
              placeholder={ta('deleteDelayPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}

        {actionType === 'random' && (
          <>
            <div>
              <Label htmlFor="random-a-percent">{ta('randomAPercentLabel')}</Label>
              <Input
                id="random-a-percent"
                type="number"
                min={0}
                max={100}
                value={Math.min(100, Math.max(0, actionNumber('aPercent', 50)))}
                onChange={(e) =>
                  onUpdate({
                    action: {
                      ...action,
                      aPercent: Math.min(100, Math.max(0, Number(e.target.value || 0))),
                    },
                  })
                }
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {ta('randomSplitHint', {
                  a: String(Math.min(100, Math.max(0, actionNumber('aPercent', 50)))),
                  b: String(100 - Math.min(100, Math.max(0, actionNumber('aPercent', 50)))),
                })}
              </p>
            </div>

            <div>
              <Label htmlFor="random-savevar">{ta('randomSaveResultLabel')}</Label>
              <VariableAutocompleteInput
                id="random-savevar"
                value={String(action.saveToVariable || '')}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...action, saveToVariable: value },
                  })
                }
                placeholder={ta('randomSaveResultPlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
              <p className="text-xs text-zinc-500 mt-1">{ta('randomHandlesHint')}</p>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="error" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-onerror">{ta('onErrorLabel')}</Label>
          <Select
            value={data.onError || 'continue'}
            onValueChange={(value) =>
              onUpdate({ onError: value as 'continue' | 'stop' | 'retry' })
            }
          >
            <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="continue">{ta('continue')}</SelectItem>
              <SelectItem value="stop">{ta('stop')}</SelectItem>
              <SelectItem value="retry">{ta('retry')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.onError === 'retry' && (
          <div>
            <Label htmlFor="retry-count">{ta('retryCountLabel')}</Label>
            <Input
              id="retry-count"
              type="number"
              value={data.retryCount || 3}
              onChange={(e) => onUpdate({ retryCount: Number(e.target.value) })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

function SetVariableSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: SetVariableNodeData
  onUpdate: (data: Partial<SetVariableNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const ta = (key: string, values?: Record<string, unknown>) => t(`action.${key}`, values)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="set-variable-name">{ta('variableNameLabel')}</Label>
        <VariableAutocompleteInput
          id="set-variable-name"
          value={data.variableName || ''}
          onValueChange={(value) => onUpdate({ variableName: value })}
          placeholder={ta('variableNamePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div>
        <Label htmlFor="set-variable-value">{ta('valueLabel')}</Label>
        <TemplateVariableTextarea
          id="set-variable-value"
          value={data.value == null ? '' : String(data.value)}
          onValueChange={(value) => onUpdate({ value })}
          placeholder={ta('valuePlaceholder')}
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs leading-5 text-emerald-100/75">
        Значение можно писать обычным текстом или через переменные, например {'{{callback.data}}'}.
      </p>
    </div>
  )
}

function DatabaseSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: DatabaseNodeData
  onUpdate: (data: Partial<DatabaseNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const td = (key: string, values?: Record<string, unknown>) => t(`database.${key}`, values)
  const mode = data.mode || 'search'

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="database-mode">{td('modeLabel')}</Label>
        <Select
          value={mode}
          onValueChange={(value) => onUpdate({ mode: value as DatabaseNodeData['mode'] })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="search">{td('modeSearch')}</SelectItem>
            <SelectItem value="all">{td('modeAll')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'search' ? (
        <div>
          <Label htmlFor="database-query">{td('queryLabel')}</Label>
          <TemplateVariableTextarea
            id="database-query"
            value={data.query || ''}
            onValueChange={(value) => onUpdate({ query: value })}
            placeholder={td('queryPlaceholder')}
            rows={3}
            className="mt-1.5 bg-zinc-800/50 border-white/10"
            variables={variables}
          />
        </div>
      ) : null}

      <div>
        <Label htmlFor="database-save-variable">{td('saveToVariableLabel')}</Label>
        <VariableAutocompleteInput
          id="database-save-variable"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder="database.result"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      {mode === 'search' ? (
        <div>
          <Label htmlFor="database-max-matches">{td('maxMatchesLabel')}</Label>
          <Input
            id="database-max-matches"
            type="number"
            min={1}
            max={20}
            value={Math.min(20, Math.max(1, Number(data.maxMatches || 5)))}
            onChange={(event) => onUpdate({ maxMatches: Math.min(20, Math.max(1, Number(event.target.value || 1))) })}
            className="mt-1.5 bg-zinc-800/50 border-white/10"
          />
        </div>
      ) : null}

      <div>
        <Label htmlFor="database-fallback">{td('fallbackLabel')}</Label>
        <Textarea
          id="database-fallback"
          value={data.fallbackText || ''}
          onChange={(event) => onUpdate({ fallbackText: event.target.value })}
          placeholder={td('fallbackPlaceholder')}
          rows={2}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <p className="rounded-lg border border-sky-400/15 bg-sky-400/5 px-3 py-2 text-xs leading-5 text-sky-100/75">
        {td('hint')}
      </p>
    </div>
  )
}

type CrmStageOption = Pick<CrmStage, 'id' | 'key' | 'name' | 'color'>
type CrmFieldOption = Pick<CrmField, 'id' | 'key' | 'name' | 'type'>

const FALLBACK_CRM_STAGE_OPTIONS: CrmStageOption[] = [
  { id: '', key: 'new', name: 'Новая', color: '#38bdf8' },
  { id: '', key: 'in_progress', name: 'В работе', color: '#8b5cf6' },
  { id: '', key: 'waiting', name: 'Ожидает', color: '#f59e0b' },
  { id: '', key: 'won', name: 'Успешно', color: '#10b981' },
  { id: '', key: 'lost', name: 'Потеряно', color: '#ef4444' },
]

const FALLBACK_CRM_FIELD_OPTIONS: CrmFieldOption[] = [
  { id: '', key: 'name', name: 'Имя', type: 'text' },
  { id: '', key: 'phone', name: 'Телефон', type: 'phone' },
  { id: '', key: 'comment', name: 'Комментарий', type: 'textarea' },
  { id: '', key: 'date_time', name: 'Дата/время', type: 'datetime' },
  { id: '', key: 'sum', name: 'Сумма', type: 'number' },
]

function useCrmStageOptions(scope: CrmNodeData['scope'], botId?: string | null) {
  const [stages, setStages] = useState<CrmStageOption[]>(FALLBACK_CRM_STAGE_OPTIONS)
  const normalizedScope = scope || 'bot'
  const shouldUseFallback = normalizedScope === 'bot' && !botId

  useEffect(() => {
    if (shouldUseFallback) return

    let cancelled = false

    async function loadStages() {
      const result = await getFlexibleCrmBoardAction({
        scope: normalizedScope,
        botId: normalizedScope === 'bot' ? botId || null : null,
      }).catch(() => null)

      if (cancelled) return

      if (!result?.success) {
        setStages(FALLBACK_CRM_STAGE_OPTIONS)
        return
      }

      const board = result.board

      if (!board?.stages.length) {
        setStages(FALLBACK_CRM_STAGE_OPTIONS)
        return
      }

      setStages(board.stages.map((stage) => ({
        id: stage.id,
        key: stage.key,
        name: stage.name,
        color: stage.color,
      })))
    }

    void loadStages()

    return () => {
      cancelled = true
    }
  }, [botId, normalizedScope, shouldUseFallback])

  return shouldUseFallback ? FALLBACK_CRM_STAGE_OPTIONS : stages
}

function useCrmFieldOptions(scope: CrmNodeData['scope'], botId?: string | null) {
  const [fields, setFields] = useState<CrmFieldOption[]>(FALLBACK_CRM_FIELD_OPTIONS)
  const normalizedScope = scope || 'bot'
  const shouldUseFallback = normalizedScope === 'bot' && !botId

  useEffect(() => {
    if (shouldUseFallback) return

    let cancelled = false

    async function loadFields() {
      const result = await getFlexibleCrmBoardAction({
        scope: normalizedScope,
        botId: normalizedScope === 'bot' ? botId || null : null,
      }).catch(() => null)

      if (cancelled) return

      if (!result?.success || !result.board?.fields.length) {
        setFields(FALLBACK_CRM_FIELD_OPTIONS)
        return
      }

      setFields(result.board.fields.map((field) => ({
        id: field.id,
        key: field.key,
        name: field.name,
        type: field.type,
      })))
    }

    void loadFields()

    return () => {
      cancelled = true
    }
  }, [botId, normalizedScope, shouldUseFallback])

  return shouldUseFallback ? FALLBACK_CRM_FIELD_OPTIONS : fields
}

function CrmSettings({
  data,
  onUpdate,
  variables,
}: {
  data: CrmNodeData
  onUpdate: (data: Partial<CrmNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const { bot } = useBotState()
  const operation = data.operation || 'create_or_update'
  const mappings = useMemo(
    () => Array.isArray(data.fieldMappings) ? data.fieldMappings : [],
    [data.fieldMappings]
  )
  const loadedStageOptions = useCrmStageOptions(data.scope || 'bot', bot?.id)
  const loadedFieldOptions = useCrmFieldOptions(data.scope || 'bot', bot?.id)
  const stageOptions = useMemo(() => {
    const currentKey = (data.stageKey || 'new').trim()
    if (!currentKey || loadedStageOptions.some((stage) => stage.key === currentKey)) {
      return loadedStageOptions
    }

    return [
      { id: data.stageId || '', key: currentKey, name: currentKey, color: '#71717a' },
      ...loadedStageOptions,
    ]
  }, [data.stageId, data.stageKey, loadedStageOptions])
  const fieldOptionsByMapping = useMemo(() => {
    return mappings.map((mapping) => {
      const currentKey = (mapping.fieldKey || '').trim()
      if (!currentKey || loadedFieldOptions.some((field) => field.key === currentKey)) {
        return loadedFieldOptions
      }

      return [
        { id: '', key: currentKey, name: currentKey, type: 'text' as const },
        ...loadedFieldOptions,
      ]
    })
  }, [loadedFieldOptions, mappings])

  const updateMapping = (index: number, patch: Partial<{ fieldKey: string; value: string }>) => {
    onUpdate({
      fieldMappings: mappings.map((mapping, mappingIndex) => (
        mappingIndex === index ? { ...mapping, ...patch } : mapping
      )),
    })
  }
  const updateOperation = (value: CrmNodeData['operation']) => {
    onUpdate({
      operation: value,
      ...(value === 'move_stage'
        ? {
            cardId: data.cardId || '{{crm.cardId}}',
            saveToVariable: 'crm.move',
          }
        : {
            saveToVariable: 'crm.card',
          }),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="crm-operation">Действие</Label>
        <Select
          value={operation}
          onValueChange={(value) => updateOperation(value as CrmNodeData['operation'])}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create_or_update">Создать или обновить карточку</SelectItem>
            <SelectItem value="move_stage">Перенести карточку по этапам</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="crm-scope">CRM</Label>
        <Select
          value={data.scope || 'bot'}
          onValueChange={(value) => onUpdate({ scope: value as CrmNodeData['scope'] })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bot">CRM выбранного бота</SelectItem>
            <SelectItem value="global">Общая CRM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {operation === 'move_stage' ? (
        <>
          <div>
            <Label htmlFor="crm-card-id">Карточка</Label>
            <TemplateVariableTextarea
              id="crm-card-id"
              value={data.cardId || ''}
              onValueChange={(value) => onUpdate({ cardId: value })}
              placeholder="{{crm.cardId}}"
              rows={2}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
              variables={variables}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Обычно это crm.cardId из предыдущего CRM-узла. Если его ещё нет, бот попробует найти карточку по external key пользователя.
            </p>
          </div>

          <div>
            <div>
              <Label>Новый этап</Label>
              <Select
                value={data.stageKey || 'new'}
                onValueChange={(value) => {
                  const selectedStage = stageOptions.find((stage) => stage.key === value)
                  onUpdate({
                    stageKey: value,
                    stageId: selectedStage?.id || undefined,
                  })
                }}
              >
                <SelectTrigger className="mt-1.5 h-11 bg-zinc-800/50 border-white/10">
                  <SelectValue placeholder="new" />
                </SelectTrigger>
                <SelectContent className="z-[4000]">
                  {stageOptions.map((stage) => (
                    <SelectItem key={`${stage.id || stage.key}-${stage.key}`} value={stage.key}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="truncate">{stage.name}</span>
                        <code className="shrink-0 text-xs text-zinc-500">{stage.key}</code>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="crm-notes">Комментарий</Label>
            <TemplateVariableTextarea
              id="crm-notes"
              value={data.notes || ''}
              onValueChange={(value) => onUpdate({ notes: value })}
              placeholder="Перенесено после ответа: {{message.text}}"
              rows={3}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
              variables={variables}
            />
          </div>

          <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs leading-5 text-emerald-100/75">
            Узел переносит найденную карточку на выбранный этап.
          </p>
        </>
      ) : (
        <>

      <div>
        <Label htmlFor="crm-title">Название карточки</Label>
        <TemplateVariableTextarea
          id="crm-title"
          value={data.title || ''}
          onValueChange={(value) => onUpdate({ title: value })}
          placeholder="Заявка от {{user.firstName}}"
          rows={2}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div>
        <div>
          <Label>Этап</Label>
          <Select
            value={data.stageKey || 'new'}
            onValueChange={(value) => {
              const selectedStage = stageOptions.find((stage) => stage.key === value)
              onUpdate({
                stageKey: value,
                stageId: selectedStage?.id || undefined,
              })
            }}
          >
            <SelectTrigger className="mt-1.5 h-11 bg-zinc-800/50 border-white/10">
              <SelectValue placeholder="new" />
            </SelectTrigger>
            <SelectContent className="z-[4000]">
              {stageOptions.map((stage) => (
                <SelectItem key={`${stage.id || stage.key}-${stage.key}`} value={stage.key}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="truncate">{stage.name}</span>
                    <code className="shrink-0 text-xs text-zinc-500">{stage.key}</code>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="crm-external-key">External key</Label>
        <TemplateVariableTextarea
          id="crm-external-key"
          value={data.externalKey || ''}
          onValueChange={(value) => onUpdate({ externalKey: value })}
          placeholder="{{user.id}}"
          rows={2}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Если ключ одинаковый, карточка обновится. Пустой ключ создаёт новую карточку каждый раз.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Поля карточки</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 bg-zinc-800/50"
            onClick={() => onUpdate({
              fieldMappings: [...mappings, { fieldKey: '', value: '' }],
            })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Поле
          </Button>
        </div>

        {mappings.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-3 text-sm text-zinc-500">
            Добавьте соответствия: ID поля CRM и значение из переменных сценария.
          </div>
        ) : null}

        {mappings.map((mapping, index) => (
          <div key={`${index}-${mapping.fieldKey}`} className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
            <div className="flex gap-2">
              <Select
                value={mapping.fieldKey || ''}
                onValueChange={(value) => updateMapping(index, { fieldKey: value })}
              >
                <SelectTrigger className="h-11 bg-zinc-800/50 border-white/10">
                  <SelectValue placeholder="Выберите поле" />
                </SelectTrigger>
                <SelectContent className="z-[4000]">
                  {(fieldOptionsByMapping[index] || loadedFieldOptions).map((field) => (
                    <SelectItem key={`${field.id || field.key}-${field.key}`} value={field.key}>
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{field.name}</span>
                        <code className="shrink-0 text-xs text-zinc-500">{field.key}</code>
                        <span className="shrink-0 text-xs text-zinc-600">{field.type}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-zinc-400 hover:text-red-300"
                onClick={() => onUpdate({ fieldMappings: mappings.filter((_, mappingIndex) => mappingIndex !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <TemplateVariableTextarea
              value={mapping.value || ''}
              onValueChange={(value) => updateMapping(index, { value })}
              placeholder="{{message.text}}"
              rows={2}
              className="mt-2 bg-zinc-800/50 border-white/10"
              variables={variables}
            />
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="crm-tags">Теги</Label>
        <Input
          id="crm-tags"
          value={data.tags || ''}
          onChange={(event) => onUpdate({ tags: event.target.value })}
          placeholder="booking, telegram"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="crm-notes">Заметки</Label>
        <TemplateVariableTextarea
          id="crm-notes"
          value={data.notes || ''}
          onValueChange={(value) => onUpdate({ notes: value })}
          placeholder="Комментарий клиента: {{message.text}}"
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <p className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs leading-5 text-emerald-100/75">
        Узел создаёт или обновляет карточку CRM из данных сценария.
      </p>
        </>
      )}
    </div>
  )
}

// ============================================================================
// SCRIPT NODE SETTINGS
// ============================================================================

function getDefaultScriptCode(language: ScriptLanguage): string {
  if (language === 'python') {
    return [
      '# Available: input, context, vars',
      '# Assign output to `result`',
      "text = str(input or '')",
      'result = text.upper()',
    ].join('\n')
  }

  return [
    '// Available: input, context, vars',
    '// Assign output to `result`',
    "result = String(input ?? '').toUpperCase()",
  ].join('\n')
}

type ScriptEditorSuggestion = {
  label: string
  insertText: string
  detail?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightScriptCode(code: string, language: ScriptLanguage): string {
  const source = code || ''
  const escaped = escapeHtml(source)

  const jsKeywordSet = new Set([
    'const', 'let', 'var', 'if', 'else', 'return', 'function', 'async', 'await', 'for', 'while',
    'try', 'catch', 'throw', 'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined',
  ])
  const pyKeywordSet = new Set([
    'def', 'if', 'elif', 'else', 'return', 'for', 'while', 'try', 'except', 'finally', 'raise',
    'import', 'from', 'as', 'in', 'not', 'and', 'or', 'True', 'False', 'None', 'class', 'pass',
  ])
  const runtimeSymbols = new Set([
    'input', 'context', 'vars', 'result',
  ])

  const combinedRegex =
    language === 'python'
      ? /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm
      : /(\/\/.*$|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm

  return escaped.replace(combinedRegex, (token) => {
    const raw = token
    const plain = raw

    if (language === 'python' && plain.startsWith('#')) {
      return `<span class="text-zinc-500">${raw}</span>`
    }
    if (language !== 'python' && (plain.startsWith('//') || plain.startsWith('/*'))) {
      return `<span class="text-zinc-500">${raw}</span>`
    }
    if (plain.startsWith('"') || plain.startsWith("'") || plain.startsWith('`')) {
      return `<span class="text-emerald-300">${raw}</span>`
    }
    if (/^\d/.test(plain)) {
      return `<span class="text-amber-300">${raw}</span>`
    }
    if (runtimeSymbols.has(plain)) {
      return `<span class="text-cyan-300 font-medium">${raw}</span>`
    }
    if ((language === 'python' ? pyKeywordSet : jsKeywordSet).has(plain)) {
      return `<span class="text-violet-300">${raw}</span>`
    }

    return raw
  })
}

function getScriptSuggestions(language: ScriptLanguage, variables: string[]): ScriptEditorSuggestion[] {
  const shared: ScriptEditorSuggestion[] = [
    { label: 'input', insertText: 'input', detail: 'Input value from Input Path / context' },
    { label: 'context', insertText: 'context', detail: 'Full execution context object' },
    { label: 'vars', insertText: 'vars', detail: 'Session variables map/object' },
    { label: 'result', insertText: 'result', detail: 'Assign final result here' },
  ]

  const commonContext: ScriptEditorSuggestion[] =
    language === 'python'
      ? [
        { label: 'context.get("user")', insertText: 'context.get("user")', detail: 'User data' },
        { label: 'context.get("message")', insertText: 'context.get("message")', detail: 'Message data' },
        { label: 'context.get("callback")', insertText: 'context.get("callback")', detail: 'Callback data' },
      ]
      : [
        { label: 'context.user', insertText: 'context.user', detail: 'User data' },
        { label: 'context.message', insertText: 'context.message', detail: 'Message data' },
        { label: 'context.callback', insertText: 'context.callback', detail: 'Callback data' },
        { label: 'context.chat', insertText: 'context.chat', detail: 'Chat data' },
        { label: 'context.update', insertText: 'context.update', detail: 'Update flags' },
      ]

  const languageBuiltins: ScriptEditorSuggestion[] =
    language === 'python'
      ? [
        { label: 'str()', insertText: 'str()', detail: 'Convert to string' },
        { label: 'len()', insertText: 'len()', detail: 'Length' },
        { label: 'int()', insertText: 'int()', detail: 'Convert to int' },
        { label: 'float()', insertText: 'float()', detail: 'Convert to float' },
        { label: 'bool()', insertText: 'bool()', detail: 'Convert to bool' },
        { label: 'dict', insertText: 'dict', detail: 'Dictionary type' },
        { label: 'list', insertText: 'list', detail: 'List type' },
      ]
      : [
        { label: 'String()', insertText: 'String()', detail: 'Convert to string' },
        { label: 'Number()', insertText: 'Number()', detail: 'Convert to number' },
        { label: 'Boolean()', insertText: 'Boolean()', detail: 'Convert to boolean' },
        { label: 'Math', insertText: 'Math', detail: 'Math helpers' },
        { label: 'JSON', insertText: 'JSON', detail: 'JSON parse/stringify' },
        { label: 'Date', insertText: 'Date', detail: 'Date API' },
        { label: 'Array.isArray()', insertText: 'Array.isArray()', detail: 'Array check' },
      ]

  const variableSuggestions: ScriptEditorSuggestion[] = []
  for (const rawVar of variables) {
    const name = String(rawVar || '').trim().replace(/^\{\{\s*|\s*\}\}$/g, '')
    if (!name) continue
    variableSuggestions.push(
      language === 'python'
        ? { label: `vars.get("${name}")`, insertText: `vars.get("${name}")`, detail: `Variable: ${name}` }
        : { label: `vars.${name}`, insertText: `vars.${name}`, detail: `Variable: ${name}` }
    )
  }

  const seen = new Set<string>()
  return [...shared, ...commonContext, ...variableSuggestions, ...languageBuiltins].filter((item) => {
    if (seen.has(item.label)) return false
    seen.add(item.label)
    return true
  })
}

function getScriptCompletionRange(value: string, caretIndex: number): { start: number; end: number; query: string } | null {
  const safeCaret = Math.max(0, Math.min(value.length, caretIndex))
  const prefix = value.slice(0, safeCaret)
  const match = prefix.match(/([A-Za-z_][A-Za-z0-9_."']*)$/)
  if (!match) return null
  const query = match[1] || ''
  return {
    start: safeCaret - query.length,
    end: safeCaret,
    query,
  }
}

function ScriptCodeEditor({
  id,
  language,
  value,
  onValueChange,
  placeholder,
  variables,
}: {
  id: string
  language: ScriptLanguage
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  variables: string[]
}) {
  const ts = useTranslations('editor.nodeSettings.script')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightedRef = useRef<HTMLPreElement | null>(null)
  const blurTimerRef = useRef<number | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [caretIndex, setCaretIndex] = useState(0)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0)
  const [forceSuggestions, setForceSuggestions] = useState(false)

  const allSuggestions = useMemo(
    () => getScriptSuggestions(language, variables),
    [language, variables]
  )

  const completionRange = getScriptCompletionRange(value, caretIndex)
  const normalizedQuery = completionRange?.query?.toLowerCase() || ''

  const filteredSuggestions = useMemo(() => {
    const list = !normalizedQuery
      ? (forceSuggestions ? allSuggestions : [])
      : allSuggestions.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    return list.slice(0, 8)
  }, [allSuggestions, normalizedQuery, forceSuggestions])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current)
      }
    }
  }, [])

  const syncScroll = () => {
    if (!textareaRef.current || !highlightedRef.current) return
    highlightedRef.current.scrollTop = textareaRef.current.scrollTop
    highlightedRef.current.scrollLeft = textareaRef.current.scrollLeft
  }

  const applySuggestion = (suggestion: ScriptEditorSuggestion) => {
    const textarea = textareaRef.current
    const range = completionRange
    if (!textarea || !range) {
      return
    }

    const nextValue = `${value.slice(0, range.start)}${suggestion.insertText}${value.slice(range.end)}`
    const nextCaret = range.start + suggestion.insertText.length
    onValueChange(nextValue)
    setForceSuggestions(false)

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCaret, nextCaret)
      setCaretIndex(nextCaret)
      syncScroll()
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const hasSuggestions = filteredSuggestions.length > 0
    const resolvedActiveSuggestionIndex =
      filteredSuggestions.length > 0
        ? Math.min(activeSuggestionIndex, filteredSuggestions.length - 1)
        : 0

    if ((event.metaKey || event.ctrlKey) && event.code === 'Space') {
      event.preventDefault()
      setForceSuggestions(true)
      return
    }

    if (hasSuggestions && event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev + 1) % filteredSuggestions.length)
      return
    }

    if (hasSuggestions && event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
      return
    }

    if (hasSuggestions && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault()
      applySuggestion(filteredSuggestions[resolvedActiveSuggestionIndex])
      return
    }

    if (event.key === 'Escape') {
      setForceSuggestions(false)
      return
    }
  }

  const showSuggestions = isFocused && filteredSuggestions.length > 0
  const resolvedActiveSuggestionIndex =
    filteredSuggestions.length > 0
      ? Math.min(activeSuggestionIndex, filteredSuggestions.length - 1)
      : 0
  const highlightedHtml = highlightScriptCode(value, language)

  return (
    <div className="mt-1.5 rounded-lg border border-white/10 bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-zinc-800/20">
        <div className="text-[11px] text-zinc-400">
          {language === 'python'
            ? ts('editorHeaderPython')
            : ts('editorHeaderJavascript')}
        </div>
        <div className="text-[10px] text-zinc-500">
          {ts('editorShortcut')}
        </div>
      </div>

      <div className="relative">
        <pre
          ref={highlightedRef}
          aria-hidden="true"
          className="m-0 h-[360px] overflow-auto p-3 font-mono text-xs leading-5 whitespace-pre-wrap break-words text-zinc-200"
          dangerouslySetInnerHTML={{
            __html: highlightedHtml || `<span class="text-zinc-500">${escapeHtml(placeholder || '')}</span>`,
          }}
        />

        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setCaretIndex(e.target.selectionStart ?? 0)
            setForceSuggestions(false)
          }}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            setCaretIndex(e.currentTarget.selectionStart ?? 0)
            setForceSuggestions(false)
          }}
          onKeyUp={(e) => setCaretIndex(e.currentTarget.selectionStart ?? 0)}
          onSelect={(e) => setCaretIndex(e.currentTarget.selectionStart ?? 0)}
          onScroll={syncScroll}
          onFocus={() => {
            if (blurTimerRef.current) {
              window.clearTimeout(blurTimerRef.current)
            }
            setIsFocused(true)
          }}
          onBlur={() => {
            blurTimerRef.current = window.setTimeout(() => {
              setIsFocused(false)
              setForceSuggestions(false)
            }, 120)
          }}
          placeholder={placeholder}
          rows={12}
          className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-xs leading-5 text-transparent caret-white selection:bg-[#24A1DE]/35 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            color: 'transparent',
            caretColor: '#ffffff',
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
        />

        {showSuggestions && (
          <div className="absolute right-2 top-2 z-20 w-[320px] max-w-[calc(100%-1rem)] rounded-lg border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-white/10">
              {ts('suggestionsTitle')}
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.label}-${index}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applySuggestion(suggestion)
                  }}
                  className={`w-full text-left rounded-md px-2 py-1.5 transition-colors ${index === resolvedActiveSuggestionIndex
                    ? 'bg-[#24A1DE]/15 border border-[#24A1DE]/20'
                    : 'hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <div className="text-xs text-zinc-100 font-mono truncate">{suggestion.label}</div>
                  {suggestion.detail && (
                    <div className="text-[10px] text-zinc-500 truncate">{suggestion.detail}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ScriptSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: ScriptNodeData
  onUpdate: (data: Partial<ScriptNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const ts = (key: string) => t(`script.${key}`)
  const language = (data.language || 'javascript') as ScriptLanguage
  const timeoutMs = Math.min(30_000, Math.max(100, Number(data.timeoutMs || 1000) || 1000))
  const code = typeof data.code === 'string' ? data.code : ''

  const handleLanguageChange = (nextLanguage: ScriptLanguage) => {
    const shouldSeedExample = !code.trim()
    onUpdate({
      language: nextLanguage,
      code: shouldSeedExample ? getDefaultScriptCode(nextLanguage) : code,
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="script-language">{ts('languageLabel')}</Label>
          <Select
            value={language}
            onValueChange={(value) => handleLanguageChange(value as ScriptLanguage)}
          >
            <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">{ts('languageJavascript')}</SelectItem>
              <SelectItem value="python">{ts('languagePython')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="script-timeout">{ts('timeoutLabel')}</Label>
          <Input
            id="script-timeout"
            type="number"
            min={100}
            max={30000}
            step={100}
            value={timeoutMs}
            onChange={(e) =>
              onUpdate({
                timeoutMs: Math.min(30_000, Math.max(100, Number(e.target.value || 1000) || 1000)),
              })
            }
            className="mt-1.5 bg-zinc-800/50 border-white/10"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="script-input-path">{ts('inputPathLabel')}</Label>
        <VariableAutocompleteInput
          id="script-input-path"
          value={data.inputPath || ''}
          onValueChange={(value) => onUpdate({ inputPath: value })}
          placeholder={ts('inputPathPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {ts('inputPathHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="script-savevar">{ts('saveVarLabel')}</Label>
        <VariableAutocompleteInput
          id="script-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={ts('saveVarPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div>
        <Label htmlFor="script-code">{ts('codeLabel')}</Label>
        <ScriptCodeEditor
          id="script-code"
          value={code}
          onValueChange={(nextCode) => onUpdate({ code: nextCode })}
          language={language}
          placeholder={getDefaultScriptCode(language)}
          variables={variables}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-zinc-800/20 px-3 py-3 space-y-2">
        <div className="text-xs font-medium text-zinc-200">{ts('contractTitle')}</div>
        <div className="text-xs text-zinc-400">
          {ts('contractPrefix')} <code className="text-zinc-200">input</code>,{' '}
          <code className="text-zinc-200">context</code>,{' '}
          <code className="text-zinc-200">vars</code>. {ts('contractSuffix')}{' '}
          <code className="text-zinc-200">result</code>.
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// HTTP NODE SETTINGS
// ============================================================================

type HttpPair = { key: string; value: string }

type HttpLikeData = {
  url?: string
  method?: HttpMethod
  headers?: unknown
  queryParams?: unknown
  body?: unknown
  bodyType?: 'json' | 'form' | 'raw' | 'none'
  saveToVariable?: string
  timeout?: number
}

function normalizePairs(input: unknown): HttpPair[] {
  if (Array.isArray(input)) {
    return input.map((item) => {
      const pair = (item || {}) as { key?: unknown; value?: unknown }
      return {
        key: String(pair.key ?? ''),
        value: String(pair.value ?? ''),
      }
    })
  }

  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }))
  }

  return []
}

function KeyValueListEditor({
  idPrefix,
  label,
  addLabel,
  emptyLabel,
  keyPlaceholder,
  valuePlaceholder,
  rows,
  onChange,
}: {
  idPrefix: string
  label: string
  addLabel: string
  emptyLabel: string
  keyPlaceholder: string
  valuePlaceholder: string
  rows: HttpPair[]
  onChange: (rows: HttpPair[]) => void
}) {
  const addRow = () => onChange([...rows, { key: '', value: '' }])
  const removeRow = (index: number) => onChange(rows.filter((_, idx) => idx !== index))
  const updateRow = (index: number, field: keyof HttpPair, value: string) => {
    const next = [...rows]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 border-white/10"
          onClick={addRow}
        >
          <Plus className="w-3 h-3 mr-1" />
          {addLabel}
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-xs text-zinc-500 border border-white/10 rounded-lg px-3 py-2">
          {emptyLabel}
        </div>
      )}

      {rows.map((row, index) => (
        <div key={`${idPrefix}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            id={`${idPrefix}-key-${index}`}
            value={row.key}
            onChange={(e) => updateRow(index, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="bg-zinc-800/50 border-white/10"
          />
          <Input
            id={`${idPrefix}-value-${index}`}
            value={row.value}
            onChange={(e) => updateRow(index, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="bg-zinc-800/50 border-white/10"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10"
            onClick={() => removeRow(index)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function HttpSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: HttpLikeData
  onUpdate: (data: Partial<HttpLikeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const th = (key: string) => t(`webhook.${key}`)
  const thttp = (key: string) => t(`http.${key}`)
  const method = data.method || 'GET'
  const methodSupportsBody = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)
  const headers = normalizePairs(data.headers)
  const queryParams = normalizePairs(data.queryParams)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="http-url">{th('urlLabel')}</Label>
        <Input
          id="http-url"
          value={data.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder={th('urlPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="http-method">{th('methodLabel')}</Label>
        <Select
          value={method}
          onValueChange={(value) => onUpdate({ method: value as HttpMethod })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="HEAD">HEAD</SelectItem>
            <SelectItem value="OPTIONS">OPTIONS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <KeyValueListEditor
        idPrefix="http-query"
        label={thttp('queryParamsLabel')}
        addLabel={thttp('addPair')}
        emptyLabel={thttp('emptyList')}
        keyPlaceholder={thttp('keyPlaceholder')}
        valuePlaceholder={thttp('valuePlaceholder')}
        rows={queryParams}
        onChange={(rows) => onUpdate({ queryParams: rows })}
      />

      <KeyValueListEditor
        idPrefix="http-headers"
        label={thttp('headersLabel')}
        addLabel={thttp('addPair')}
        emptyLabel={thttp('emptyList')}
        keyPlaceholder={thttp('keyPlaceholder')}
        valuePlaceholder={thttp('valuePlaceholder')}
        rows={headers}
        onChange={(rows) => onUpdate({ headers: rows })}
      />

      {methodSupportsBody && (
        <>
          <div>
            <Label htmlFor="http-body-type">{th('bodyTypeLabel')}</Label>
            <Select
              value={data.bodyType || 'json'}
              onValueChange={(value) =>
                onUpdate({ bodyType: value as HttpLikeData['bodyType'] })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="form">{thttp('bodyForm')}</SelectItem>
                <SelectItem value="raw">{thttp('bodyRaw')}</SelectItem>
                <SelectItem value="none">{thttp('bodyNone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(data.bodyType || 'json') !== 'none' && (
            <div>
              <Label htmlFor="http-body">{th('bodyLabel')}</Label>
              <TemplateVariableTextarea
                id="http-body"
                value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || {}, null, 2)}
                onValueChange={(value) => onUpdate({ body: value })}
                placeholder={'{"key": "value"}'}
                rows={5}
                className="mt-1.5 bg-zinc-800/50 border-white/10 font-mono text-sm"
                variables={variables}
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor="http-timeout">{thttp('timeoutLabel')}</Label>
        <Input
          id="http-timeout"
          type="number"
          min={100}
          value={data.timeout || 30000}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) || 30000 })}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="http-savevar">{th('saveResponseLabel')}</Label>
        <VariableAutocompleteInput
          id="http-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={th('saveResponsePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>
    </div>
  )
}

type PaymentNodeData =
  | PaymentYookassaNodeData
  | PaymentStripeNodeData
  | PaymentRobokassaNodeData
  | PaymentStarsNodeData

function PaymentSettings({
  nodeType,
  data,
  onUpdate,
  variables,
  defaultYookassaReturnUrl,
  defaultStripeSuccessUrl,
  defaultStripeCancelUrl,
  defaultRobokassaSuccessUrl,
  defaultRobokassaFailUrl,
  t,
}: {
  nodeType: 'paymentYookassa' | 'paymentStripe' | 'paymentRobokassa' | 'paymentStars'
  data: PaymentNodeData
  onUpdate: (data: Partial<PaymentNodeData>) => void
  variables: string[]
  defaultYookassaReturnUrl?: string
  defaultStripeSuccessUrl?: string
  defaultStripeCancelUrl?: string
  defaultRobokassaSuccessUrl?: string
  defaultRobokassaFailUrl?: string
  t: (key: string) => string
}) {
  const tp = (key: string) => t(`payment.${key}`)
  const isYookassa = nodeType === 'paymentYookassa'
  const isStripe = nodeType === 'paymentStripe'
  const isRobokassa = nodeType === 'paymentRobokassa'
  const isStars = nodeType === 'paymentStars'
  const yookassaReturnUrl = String((data as PaymentYookassaNodeData).returnUrl || '').trim()
  const stripeSuccessUrl = String((data as PaymentStripeNodeData).successUrl || '').trim()
  const stripeCancelUrl = String((data as PaymentStripeNodeData).cancelUrl || '').trim()
  const robokassaSuccessUrl = String((data as PaymentRobokassaNodeData).successUrl || '').trim()
  const robokassaFailUrl = String((data as PaymentRobokassaNodeData).failUrl || '').trim()
  const [isReturnUrlCopied, setIsReturnUrlCopied] = useState(false)
  const [isStripeSuccessUrlCopied, setIsStripeSuccessUrlCopied] = useState(false)
  const [isStripeCancelUrlCopied, setIsStripeCancelUrlCopied] = useState(false)
  const [isRobokassaSuccessUrlCopied, setIsRobokassaSuccessUrlCopied] = useState(false)
  const [isRobokassaFailUrlCopied, setIsRobokassaFailUrlCopied] = useState(false)
  const returnUrlCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stripeSuccessCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stripeCancelCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const robokassaSuccessCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const robokassaFailCopyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isYookassa) return

    const currentReturnUrl = yookassaReturnUrl
    if (currentReturnUrl) return

    const fallbackReturnUrl = String(defaultYookassaReturnUrl || '').trim()
    if (!fallbackReturnUrl) return

    onUpdate({ returnUrl: fallbackReturnUrl } as Partial<PaymentYookassaNodeData>)
  }, [isYookassa, yookassaReturnUrl, defaultYookassaReturnUrl, onUpdate])

  useEffect(() => {
    if (!isStripe) return

    const patch: Partial<PaymentStripeNodeData> = {}
    const fallbackSuccessUrl = String(defaultStripeSuccessUrl || '').trim()
    const fallbackCancelUrl = String(defaultStripeCancelUrl || '').trim()

    if (!stripeSuccessUrl && fallbackSuccessUrl) {
      patch.successUrl = fallbackSuccessUrl
    }
    if (!stripeCancelUrl && fallbackCancelUrl) {
      patch.cancelUrl = fallbackCancelUrl
    }

    if (Object.keys(patch).length > 0) {
      onUpdate(patch as Partial<PaymentStripeNodeData>)
    }
  }, [
    isStripe,
    stripeSuccessUrl,
    stripeCancelUrl,
    defaultStripeSuccessUrl,
    defaultStripeCancelUrl,
    onUpdate,
  ])

  useEffect(() => {
    if (!isRobokassa) return

    const patch: Partial<PaymentRobokassaNodeData> = {}
    const fallbackSuccessUrl = String(defaultRobokassaSuccessUrl || '').trim()
    const fallbackFailUrl = String(defaultRobokassaFailUrl || '').trim()

    if (!robokassaSuccessUrl && fallbackSuccessUrl) {
      patch.successUrl = fallbackSuccessUrl
    }
    if (!robokassaFailUrl && fallbackFailUrl) {
      patch.failUrl = fallbackFailUrl
    }

    if (Object.keys(patch).length > 0) {
      onUpdate(patch as Partial<PaymentRobokassaNodeData>)
    }
  }, [
    isRobokassa,
    robokassaSuccessUrl,
    robokassaFailUrl,
    defaultRobokassaSuccessUrl,
    defaultRobokassaFailUrl,
    onUpdate,
  ])

  useEffect(() => {
    if (!isStars) return
    if (String(data.currency || '').trim().toUpperCase() === 'XTR') return
    onUpdate({ currency: 'XTR' } as Partial<PaymentStarsNodeData>)
  }, [isStars, data.currency, onUpdate])

  useEffect(() => {
    return () => {
      if (returnUrlCopyResetTimerRef.current) {
        clearTimeout(returnUrlCopyResetTimerRef.current)
      }
      if (stripeSuccessCopyResetTimerRef.current) {
        clearTimeout(stripeSuccessCopyResetTimerRef.current)
      }
      if (stripeCancelCopyResetTimerRef.current) {
        clearTimeout(stripeCancelCopyResetTimerRef.current)
      }
      if (robokassaSuccessCopyResetTimerRef.current) {
        clearTimeout(robokassaSuccessCopyResetTimerRef.current)
      }
      if (robokassaFailCopyResetTimerRef.current) {
        clearTimeout(robokassaFailCopyResetTimerRef.current)
      }
    }
  }, [])

  const copyTextToClipboard = useCallback(async (value: string) => {
    if (!value) return

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }

    if (typeof document !== 'undefined') {
      const fallbackTextarea = document.createElement('textarea')
      fallbackTextarea.value = value
      fallbackTextarea.setAttribute('readonly', 'true')
      fallbackTextarea.style.position = 'absolute'
      fallbackTextarea.style.left = '-9999px'
      document.body.appendChild(fallbackTextarea)
      fallbackTextarea.select()
      document.execCommand('copy')
      document.body.removeChild(fallbackTextarea)
    }
  }, [])

  const handleRegenerateYookassaReturnUrl = useCallback(() => {
    const nextReturnUrl = String(defaultYookassaReturnUrl || '').trim()
    if (!nextReturnUrl) return
    onUpdate({ returnUrl: nextReturnUrl } as Partial<PaymentYookassaNodeData>)
  }, [defaultYookassaReturnUrl, onUpdate])

  const handleCopyYookassaReturnUrl = useCallback(async () => {
    if (!yookassaReturnUrl) return

    try {
      await copyTextToClipboard(yookassaReturnUrl)

      setIsReturnUrlCopied(true)
      if (returnUrlCopyResetTimerRef.current) {
        clearTimeout(returnUrlCopyResetTimerRef.current)
      }
      returnUrlCopyResetTimerRef.current = setTimeout(() => {
        setIsReturnUrlCopied(false)
      }, 1400)
    } catch {
      // no-op
    }
  }, [copyTextToClipboard, yookassaReturnUrl])

  const handleRegenerateStripeUrls = useCallback(() => {
    const nextSuccessUrl = String(defaultStripeSuccessUrl || '').trim()
    const nextCancelUrl = String(defaultStripeCancelUrl || '').trim()
    const patch: Partial<PaymentStripeNodeData> = {}
    if (nextSuccessUrl) {
      patch.successUrl = nextSuccessUrl
    }
    if (nextCancelUrl) {
      patch.cancelUrl = nextCancelUrl
    }
    if (Object.keys(patch).length > 0) {
      onUpdate(patch as Partial<PaymentStripeNodeData>)
    }
  }, [defaultStripeSuccessUrl, defaultStripeCancelUrl, onUpdate])

  const handleCopyStripeSuccessUrl = useCallback(async () => {
    if (!stripeSuccessUrl) return

    try {
      await copyTextToClipboard(stripeSuccessUrl)
      setIsStripeSuccessUrlCopied(true)
      if (stripeSuccessCopyResetTimerRef.current) {
        clearTimeout(stripeSuccessCopyResetTimerRef.current)
      }
      stripeSuccessCopyResetTimerRef.current = setTimeout(() => {
        setIsStripeSuccessUrlCopied(false)
      }, 1400)
    } catch {
      // no-op
    }
  }, [copyTextToClipboard, stripeSuccessUrl])

  const handleCopyStripeCancelUrl = useCallback(async () => {
    if (!stripeCancelUrl) return

    try {
      await copyTextToClipboard(stripeCancelUrl)
      setIsStripeCancelUrlCopied(true)
      if (stripeCancelCopyResetTimerRef.current) {
        clearTimeout(stripeCancelCopyResetTimerRef.current)
      }
      stripeCancelCopyResetTimerRef.current = setTimeout(() => {
        setIsStripeCancelUrlCopied(false)
      }, 1400)
    } catch {
      // no-op
    }
  }, [copyTextToClipboard, stripeCancelUrl])

  const handleRegenerateRobokassaUrls = useCallback(() => {
    const nextSuccessUrl = String(defaultRobokassaSuccessUrl || '').trim()
    const nextFailUrl = String(defaultRobokassaFailUrl || '').trim()
    const patch: Partial<PaymentRobokassaNodeData> = {}
    if (nextSuccessUrl) {
      patch.successUrl = nextSuccessUrl
    }
    if (nextFailUrl) {
      patch.failUrl = nextFailUrl
    }
    if (Object.keys(patch).length > 0) {
      onUpdate(patch as Partial<PaymentRobokassaNodeData>)
    }
  }, [defaultRobokassaSuccessUrl, defaultRobokassaFailUrl, onUpdate])

  const handleCopyRobokassaSuccessUrl = useCallback(async () => {
    if (!robokassaSuccessUrl) return

    try {
      await copyTextToClipboard(robokassaSuccessUrl)
      setIsRobokassaSuccessUrlCopied(true)
      if (robokassaSuccessCopyResetTimerRef.current) {
        clearTimeout(robokassaSuccessCopyResetTimerRef.current)
      }
      robokassaSuccessCopyResetTimerRef.current = setTimeout(() => {
        setIsRobokassaSuccessUrlCopied(false)
      }, 1400)
    } catch {
      // no-op
    }
  }, [copyTextToClipboard, robokassaSuccessUrl])

  const handleCopyRobokassaFailUrl = useCallback(async () => {
    if (!robokassaFailUrl) return

    try {
      await copyTextToClipboard(robokassaFailUrl)
      setIsRobokassaFailUrlCopied(true)
      if (robokassaFailCopyResetTimerRef.current) {
        clearTimeout(robokassaFailCopyResetTimerRef.current)
      }
      robokassaFailCopyResetTimerRef.current = setTimeout(() => {
        setIsRobokassaFailUrlCopied(false)
      }, 1400)
    } catch {
      // no-op
    }
  }, [copyTextToClipboard, robokassaFailUrl])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-zinc-800/20 p-3 text-xs text-zinc-400">
        {isYookassa && tp('providerHintYookassa')}
        {isStripe && tp('providerHintStripe')}
        {isRobokassa && tp('providerHintRobokassa')}
        {isStars && tp('providerHintStars')}
      </div>

      {isYookassa && (
        <>
          <div>
            <Label htmlFor="payment-yookassa-shop-id">{tp('shopIdLabel')}</Label>
            <Input
              id="payment-yookassa-shop-id"
              value={String((data as PaymentYookassaNodeData).shopId || '')}
              onChange={(event) => onUpdate({ shopId: event.target.value } as Partial<PaymentYookassaNodeData>)}
              placeholder={tp('shopIdPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-yookassa-secret">{tp('secretKeyLabel')}</Label>
            <Input
              id="payment-yookassa-secret"
              type="password"
              value={String((data as PaymentYookassaNodeData).secretKey || '')}
              onChange={(event) => onUpdate({ secretKey: event.target.value } as Partial<PaymentYookassaNodeData>)}
              placeholder={tp('secretKeyPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-yookassa-return-url">{tp('returnUrlLabel')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="payment-yookassa-return-url"
                value={yookassaReturnUrl}
                readOnly
                placeholder={tp('returnUrlPlaceholder')}
                className="pr-11 bg-zinc-800/50 border-white/10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-white"
                onClick={() => void handleCopyYookassaReturnUrl()}
                disabled={!yookassaReturnUrl}
                aria-label={isReturnUrlCopied ? tp('returnUrlCopiedLabel') : tp('returnUrlCopyLabel')}
                title={isReturnUrlCopied ? tp('returnUrlCopiedLabel') : tp('returnUrlCopyLabel')}
              >
                {isReturnUrlCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{tp('returnUrlAutoHint')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={handleRegenerateYookassaReturnUrl}
              disabled={!defaultYookassaReturnUrl}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {tp('returnUrlRegenerate')}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="payment-yookassa-capture">{tp('captureLabel')}</Label>
            <Switch
              id="payment-yookassa-capture"
              checked={(data as PaymentYookassaNodeData).capture !== false}
              onCheckedChange={(checked) => onUpdate({ capture: checked } as Partial<PaymentYookassaNodeData>)}
            />
          </div>
        </>
      )}

      {isStripe && (
        <>
          <div>
            <Label htmlFor="payment-stripe-secret">{tp('secretKeyLabel')}</Label>
            <Input
              id="payment-stripe-secret"
              type="password"
              value={String((data as PaymentStripeNodeData).secretKey || '')}
              onChange={(event) => onUpdate({ secretKey: event.target.value } as Partial<PaymentStripeNodeData>)}
              placeholder={tp('secretKeyPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-stripe-success-url">{tp('successUrlLabel')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="payment-stripe-success-url"
                value={stripeSuccessUrl}
                readOnly
                placeholder={tp('successUrlPlaceholder')}
                className="pr-11 bg-zinc-800/50 border-white/10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-white"
                onClick={() => void handleCopyStripeSuccessUrl()}
                disabled={!stripeSuccessUrl}
                aria-label={isStripeSuccessUrlCopied ? tp('successUrlCopiedLabel') : tp('successUrlCopyLabel')}
                title={isStripeSuccessUrlCopied ? tp('successUrlCopiedLabel') : tp('successUrlCopyLabel')}
              >
                {isStripeSuccessUrlCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{tp('successUrlAutoHint')}</p>
          </div>
          <div>
            <Label htmlFor="payment-stripe-cancel-url">{tp('cancelUrlLabel')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="payment-stripe-cancel-url"
                value={stripeCancelUrl}
                readOnly
                placeholder={tp('cancelUrlPlaceholder')}
                className="pr-11 bg-zinc-800/50 border-white/10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-white"
                onClick={() => void handleCopyStripeCancelUrl()}
                disabled={!stripeCancelUrl}
                aria-label={isStripeCancelUrlCopied ? tp('cancelUrlCopiedLabel') : tp('cancelUrlCopyLabel')}
                title={isStripeCancelUrlCopied ? tp('cancelUrlCopiedLabel') : tp('cancelUrlCopyLabel')}
              >
                {isStripeCancelUrlCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{tp('cancelUrlAutoHint')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={handleRegenerateStripeUrls}
              disabled={!defaultStripeSuccessUrl && !defaultStripeCancelUrl}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {tp('stripeUrlsRegenerate')}
            </Button>
          </div>
          <div>
            <Label htmlFor="payment-stripe-product">{tp('productNameLabel')}</Label>
            <Input
              id="payment-stripe-product"
              value={String((data as PaymentStripeNodeData).productName || '')}
              onChange={(event) => onUpdate({ productName: event.target.value } as Partial<PaymentStripeNodeData>)}
              placeholder={tp('productNamePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        </>
      )}

      {isRobokassa && (
        <>
          <div>
            <Label htmlFor="payment-robo-login">{tp('merchantLoginLabel')}</Label>
            <Input
              id="payment-robo-login"
              value={String((data as PaymentRobokassaNodeData).merchantLogin || '')}
              onChange={(event) => onUpdate({ merchantLogin: event.target.value } as Partial<PaymentRobokassaNodeData>)}
              placeholder={tp('merchantLoginPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-robo-password1">{tp('password1Label')}</Label>
            <Input
              id="payment-robo-password1"
              type="password"
              value={String((data as PaymentRobokassaNodeData).password1 || '')}
              onChange={(event) => onUpdate({ password1: event.target.value } as Partial<PaymentRobokassaNodeData>)}
              placeholder={tp('password1Placeholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-robo-success">{tp('successUrlLabel')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="payment-robo-success"
                value={robokassaSuccessUrl}
                readOnly
                placeholder={tp('successUrlPlaceholder')}
                className="pr-11 bg-zinc-800/50 border-white/10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-white"
                onClick={() => void handleCopyRobokassaSuccessUrl()}
                disabled={!robokassaSuccessUrl}
                aria-label={isRobokassaSuccessUrlCopied ? tp('successUrlCopiedLabel') : tp('successUrlCopyLabel')}
                title={isRobokassaSuccessUrlCopied ? tp('successUrlCopiedLabel') : tp('successUrlCopyLabel')}
              >
                {isRobokassaSuccessUrlCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{tp('successUrlAutoHint')}</p>
          </div>
          <div>
            <Label htmlFor="payment-robo-fail">{tp('failUrlLabel')}</Label>
            <div className="relative mt-1.5">
              <Input
                id="payment-robo-fail"
                value={robokassaFailUrl}
                readOnly
                placeholder={tp('failUrlPlaceholder')}
                className="pr-11 bg-zinc-800/50 border-white/10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-zinc-400 hover:text-white"
                onClick={() => void handleCopyRobokassaFailUrl()}
                disabled={!robokassaFailUrl}
                aria-label={isRobokassaFailUrlCopied ? tp('failUrlCopiedLabel') : tp('failUrlCopyLabel')}
                title={isRobokassaFailUrlCopied ? tp('failUrlCopiedLabel') : tp('failUrlCopyLabel')}
              >
                {isRobokassaFailUrlCopied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{tp('failUrlAutoHint')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={handleRegenerateRobokassaUrls}
              disabled={!defaultRobokassaSuccessUrl && !defaultRobokassaFailUrl}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {tp('robokassaUrlsRegenerate')}
            </Button>
          </div>
          <div>
            <Label htmlFor="payment-robo-invoice-id">{tp('invoiceIdLabel')}</Label>
            <Input
              id="payment-robo-invoice-id"
              value={String((data as PaymentRobokassaNodeData).invoiceId || '')}
              onChange={(event) => onUpdate({ invoiceId: event.target.value } as Partial<PaymentRobokassaNodeData>)}
              placeholder={tp('invoiceIdPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="payment-robo-test">{tp('testModeLabel')}</Label>
            <Switch
              id="payment-robo-test"
              checked={Boolean((data as PaymentRobokassaNodeData).isTest)}
              onCheckedChange={(checked) => onUpdate({ isTest: checked } as Partial<PaymentRobokassaNodeData>)}
            />
          </div>
        </>
      )}

      {isStars && (
        <>
          <div>
            <Label htmlFor="payment-stars-title">{tp('starsTitleLabel')}</Label>
            <Input
              id="payment-stars-title"
              value={String((data as PaymentStarsNodeData).title || '')}
              onChange={(event) => onUpdate({ title: event.target.value } as Partial<PaymentStarsNodeData>)}
              placeholder={tp('starsTitlePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="payment-stars-payload">{tp('starsPayloadLabel')}</Label>
            <Input
              id="payment-stars-payload"
              value={String((data as PaymentStarsNodeData).payload || '')}
              onChange={(event) => onUpdate({ payload: event.target.value } as Partial<PaymentStarsNodeData>)}
              placeholder={tp('starsPayloadPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">{tp('starsPayloadHint')}</p>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="payment-amount">{isStars ? tp('starsAmountLabel') : tp('amountLabel')}</Label>
        <Input
          id="payment-amount"
          value={String(data.amount || '')}
          onChange={(event) => onUpdate({ amount: event.target.value })}
          placeholder={isStars ? tp('starsAmountPlaceholder') : tp('amountPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        {isStars ? (
          <p className="text-xs text-zinc-500 mt-1">{tp('starsAmountHint')}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="payment-currency">{tp('currencyLabel')}</Label>
        <Input
          id="payment-currency"
          value={isStars ? 'XTR' : String(data.currency || '')}
          onChange={(event) => onUpdate({ currency: event.target.value })}
          placeholder={tp('currencyPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          readOnly={isStars}
        />
        {isStars ? (
          <p className="text-xs text-zinc-500 mt-1">{tp('starsCurrencyHint')}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="payment-description">{tp('descriptionLabel')}</Label>
        <TemplateVariableTextarea
          id="payment-description"
          value={String(data.description || '')}
          onValueChange={(value) => onUpdate({ description: value })}
          placeholder={tp('descriptionPlaceholder')}
          rows={2}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="payment-auto-send">{tp('autoSendPaymentLinkLabel')}</Label>
        <Switch
          id="payment-auto-send"
          checked={data.autoSendPaymentLink !== false}
          onCheckedChange={(checked) => onUpdate({ autoSendPaymentLink: checked })}
        />
      </div>

      {data.autoSendPaymentLink !== false && (
        <div>
          <Label htmlFor="payment-message-template">{tp('messageTemplateLabel')}</Label>
          <TemplateVariableTextarea
            id="payment-message-template"
            value={String(data.messageTemplate || '')}
            onValueChange={(value) => onUpdate({ messageTemplate: value })}
            placeholder={tp('messageTemplatePlaceholder')}
            rows={3}
            className="mt-1.5 bg-zinc-800/50 border-white/10"
            variables={variables}
          />
          <p className="text-xs text-zinc-500 mt-1">{tp('messageTemplateHint')}</p>
        </div>
      )}

      <div>
        <Label htmlFor="payment-save-var">{tp('saveToVariableLabel')}</Label>
        <VariableAutocompleteInput
          id="payment-save-var"
          value={String(data.saveToVariable || '')}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={tp('saveToVariablePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>
    </div>
  )
}

// ============================================================================
// TRIGGER NODE SETTINGS
// ============================================================================

function TriggerSettings({
  data,
  onUpdate,
  t,
}: {
  data: TriggerNodeData
  onUpdate: (data: Partial<TriggerNodeData>) => void
  t: (key: string) => string
}) {
  const tr = (key: string) => t(`trigger.${key}`)
  const aiMeta = data as unknown as {
    aiEnabled?: boolean
    aiPrompt?: string
  }
  const isAiTrigger = Boolean(aiMeta.aiEnabled)
  const isCommandTrigger = data.trigger === 'command'
  const isTextTrigger = data.trigger === 'text'
  const isCallbackTrigger = data.trigger === 'callbackQuery'
  const isScheduleTrigger = data.trigger === 'schedule'
  const scheduleMode = (data.scheduleMode || 'daily') as 'hourly' | 'daily'

  return (
    <div className="space-y-4">
      {isAiTrigger && (
        <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/5 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{tr('aiTitle')}</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {tr('aiDescription')}
              </p>
            </div>
            <div className="text-[11px] px-2 py-1 rounded border border-indigo-300/20 bg-indigo-400/10 text-indigo-200">
              {tr('soon')}
            </div>
          </div>

          <div className="relative">
            <Label htmlFor="ai-trigger-prompt" className="text-xs text-zinc-300">
              {tr('aiPromptLabel')}
            </Label>
            <Textarea
              id="ai-trigger-prompt"
              value={String(aiMeta.aiPrompt || '')}
              readOnly
              disabled
              placeholder={tr('aiPromptPlaceholder')}
              rows={3}
              className="mt-1.5 bg-zinc-900/40 border-white/10"
            />
            <div className="absolute inset-x-0 bottom-0 top-7 rounded-md bg-zinc-950/45 border border-white/5 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-medium text-zinc-300">{tr('aiSoonOverlay')}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="trigger-type">{tr('typeLabel')}</Label>
        <Select
          value={data.trigger || 'command'}
          onValueChange={(value) => onUpdate({ trigger: value as TriggerNodeData['trigger'] })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">{tr('command')}</SelectItem>
            <SelectItem value="text">{tr('text')}</SelectItem>
            <SelectItem value="callbackQuery">{tr('callbackQuery')}</SelectItem>
            <SelectItem value="photo">{tr('photo')}</SelectItem>
            <SelectItem value="any">{tr('any')}</SelectItem>
            <SelectItem value="schedule">{tr('schedule')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(isCommandTrigger || isTextTrigger || isCallbackTrigger) && (
        <div>
          <Label htmlFor="trigger-pattern">
            {isCommandTrigger ? tr('command') : isCallbackTrigger ? tr('callbackDataLabel') : tr('patternLabel')}
          </Label>
          <Input
            id="trigger-pattern"
            value={data.pattern || ''}
            onChange={(e) => onUpdate({ pattern: e.target.value })}
            placeholder={
              isCommandTrigger
                ? tr('commandPlaceholder')
                : isCallbackTrigger
                  ? tr('callbackPlaceholder')
                  : tr('textPlaceholder')
            }
            className="mt-1.5 bg-zinc-800/50 border-white/10"
          />
          {isCallbackTrigger && (
            <p className="text-xs text-zinc-500 mt-1">
              {tr('callbackAnyHint')}
            </p>
          )}
        </div>
      )}

      {isScheduleTrigger && (
        <>
          <div>
            <Label htmlFor="trigger-schedule-mode">{tr('scheduleModeLabel')}</Label>
            <Select
              value={scheduleMode}
              onValueChange={(value) =>
                onUpdate({ scheduleMode: value as 'hourly' | 'daily' })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{tr('scheduleDaily')}</SelectItem>
                <SelectItem value="hourly">{tr('scheduleHourly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleMode === 'daily' ? (
            <div>
              <Label htmlFor="trigger-schedule-time">{tr('scheduleTimeLabel')}</Label>
              <Input
                id="trigger-schedule-time"
                type="time"
                value={data.atTime || '10:00'}
                onChange={(e) => onUpdate({ atTime: e.target.value })}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="trigger-schedule-every-hours">{tr('scheduleEveryHoursLabel')}</Label>
                <Input
                  id="trigger-schedule-every-hours"
                  type="number"
                  min={1}
                  max={24}
                  value={data.everyHours ?? 1}
                  onChange={(e) => onUpdate({ everyHours: Math.max(1, Number(e.target.value) || 1) })}
                  className="mt-1.5 bg-zinc-800/50 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="trigger-schedule-minute">{tr('scheduleMinuteLabel')}</Label>
                <Input
                  id="trigger-schedule-minute"
                  type="number"
                  min={0}
                  max={59}
                  value={data.atMinute ?? 0}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    onUpdate({ atMinute: Math.min(59, Math.max(0, Number.isFinite(next) ? next : 0)) })
                  }}
                  className="mt-1.5 bg-zinc-800/50 border-white/10"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="trigger-schedule-timezone">{tr('scheduleTimezoneLabel')}</Label>
            <Input
              id="trigger-schedule-timezone"
              value={data.timeZone || 'UTC'}
              onChange={(e) => onUpdate({ timeZone: e.target.value })}
              placeholder={tr('scheduleTimezonePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {tr('scheduleTimezoneHint')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="trigger-target-chat-id">{tr('scheduleTargetChatIdLabel')}</Label>
              <Input
                id="trigger-target-chat-id"
                value={data.targetChatId || ''}
                onChange={(e) => onUpdate({ targetChatId: e.target.value })}
                placeholder={tr('scheduleTargetChatIdPlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {tr('scheduleTargetChatIdHint')}
              </p>
            </div>

            <div>
              <Label htmlFor="trigger-target-user-id">{tr('scheduleTargetUserIdLabel')}</Label>
              <Input
                id="trigger-target-user-id"
                value={data.targetUserId || ''}
                onChange={(e) => onUpdate({ targetUserId: e.target.value })}
                placeholder={tr('scheduleTargetUserIdPlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {tr('scheduleTargetUserIdHint')}
              </p>
            </div>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="trigger-desc">{tr('descriptionLabel')}</Label>
        <Input
          id="trigger-desc"
          value={data.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder={tr('descriptionPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>
    </div>
  )
}

// ============================================================================
// DATE / TIME SCHEDULER NODE SETTINGS
// ============================================================================

function SchedulerSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: SchedulerNodeData
  onUpdate: (data: Partial<SchedulerNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const ts = (key: string) => t(`scheduler.${key}`)
  const mode = (data.mode || 'delay') as SchedulerNodeData['mode']
  const delayUnit = (data.delayUnit || 'minutes') as NonNullable<SchedulerNodeData['delayUnit']>

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="scheduler-mode">{ts('modeLabel')}</Label>
        <Select
          value={mode || 'delay'}
          onValueChange={(value) =>
            onUpdate({ mode: value as NonNullable<SchedulerNodeData['mode']> })
          }
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delay">{ts('modeDelay')}</SelectItem>
            <SelectItem value="dateTime">{ts('modeDateTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'delay' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="scheduler-delay-value">{ts('delayValueLabel')}</Label>
            <Input
              id="scheduler-delay-value"
              type="number"
              min={0}
              value={data.delayValue ?? 5}
              onChange={(e) => onUpdate({ delayValue: Number(e.target.value) })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="scheduler-delay-unit">{ts('delayUnitLabel')}</Label>
            <Select
              value={delayUnit}
              onValueChange={(value) =>
                onUpdate({
                  delayUnit: value as NonNullable<SchedulerNodeData['delayUnit']>,
                })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">{ts('unitSeconds')}</SelectItem>
                <SelectItem value="minutes">{ts('unitMinutes')}</SelectItem>
                <SelectItem value="hours">{ts('unitHours')}</SelectItem>
                <SelectItem value="days">{ts('unitDays')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="scheduler-datetime">{ts('dateTimeLabel')}</Label>
            <Input
              id="scheduler-datetime"
              type="datetime-local"
              value={data.dateTime || ''}
              onChange={(e) => onUpdate({ dateTime: e.target.value })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {ts('dateTimeHint')}
            </p>
          </div>

          <div>
            <Label htmlFor="scheduler-timezone">{ts('timezoneLabel')}</Label>
            <Input
              id="scheduler-timezone"
              value={data.timeZone || 'UTC'}
              onChange={(e) => onUpdate({ timeZone: e.target.value })}
              placeholder={ts('timezonePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              {ts('timezoneHint')}
            </p>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="scheduler-savevar">{ts('saveVarLabel')}</Label>
        <VariableAutocompleteInput
          id="scheduler-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={ts('saveVarPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {ts('saveVarHint')}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// REPLY KEYBOARD CONTROL NODE SETTINGS
// ============================================================================

function ReplyKeyboardSettings({
  data,
  onUpdate,
  variables,
  variantOptions,
  t,
}: {
  data: ReplyKeyboardNodeData
  onUpdate: (data: Partial<ReplyKeyboardNodeData>) => void
  variables: string[]
  variantOptions: ReplyKeyboardVariantOption[]
  t: (key: string) => string
}) {
  const trk = (key: string) => t(`replyKeyboardNode.${key}`)
  const tc = (key: string) => t(`condition.${key}`)
  const mode = (data.mode || 'system') as NonNullable<ReplyKeyboardNodeData['mode']>
  const operator = (data.operator || 'equals') as ComparisonOperator
  const trueMode = (data.trueMode || 'variant') as NonNullable<ReplyKeyboardNodeData['trueMode']>
  const falseMode = (data.falseMode || 'system') as NonNullable<ReplyKeyboardNodeData['falseMode']>

  const renderVariantSelect = (
    id: string,
    value: string | undefined,
    onValueChange: (value: string) => void,
    disabled?: boolean
  ) => (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <Select value={(value || 'base').trim() || 'base'} onValueChange={onValueChange}>
        <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {variantOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" id={id} value={(value || 'base').trim() || 'base'} readOnly />
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="replykb-mode">{trk('modeLabel')}</Label>
        <Select
          value={mode}
          onValueChange={(value) => onUpdate({ mode: value as ReplyKeyboardNodeData['mode'] })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">{trk('modeSystem')}</SelectItem>
            <SelectItem value="variant">{trk('modeVariant')}</SelectItem>
            <SelectItem value="condition">{trk('modeCondition')}</SelectItem>
            <SelectItem value="clear">{trk('modeClear')}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500 mt-1">
          {trk('modeHint')}
        </p>
        <p className="text-xs text-amber-300/80 mt-1">
          {trk('starsUnavailableHint')}
        </p>
      </div>

      {mode === 'variant' && (
        <div>
          <Label htmlFor="replykb-variant">{trk('variantLabel')}</Label>
          {renderVariantSelect('replykb-variant', data.variantKey, (value) => onUpdate({ variantKey: value }))}
          <p className="text-xs text-zinc-500 mt-1">
            {trk('variantHint')}
          </p>
        </div>
      )}

      {mode === 'condition' && (
        <>
          <div>
            <Label htmlFor="replykb-variable">{trk('variableLabel')}</Label>
            <VariableAutocompleteInput
              id="replykb-variable"
              value={data.variable || ''}
              onValueChange={(value) => onUpdate({ variable: value })}
              placeholder={trk('variablePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
              variables={variables}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="replykb-operator">{trk('operatorLabel')}</Label>
              <Select
                value={operator}
                onValueChange={(value) =>
                  onUpdate({ operator: value as ReplyKeyboardNodeData['operator'] })
                }
              >
                <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">{tc('equals')}</SelectItem>
                  <SelectItem value="notEquals">{tc('notEquals')}</SelectItem>
                  <SelectItem value="contains">{tc('contains')}</SelectItem>
                  <SelectItem value="notContains">{tc('notContains')}</SelectItem>
                  <SelectItem value="gt">{tc('gt')}</SelectItem>
                  <SelectItem value="lt">{tc('lt')}</SelectItem>
                  <SelectItem value="gte">{tc('gte')}</SelectItem>
                  <SelectItem value="lte">{tc('lte')}</SelectItem>
                  <SelectItem value="isEmpty">{tc('isEmpty')}</SelectItem>
                  <SelectItem value="isNotEmpty">{tc('isNotEmpty')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="replykb-value">{trk('valueLabel')}</Label>
              <Input
                id="replykb-value"
                value={data.value == null ? '' : String(data.value)}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder={trk('valuePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 space-y-3">
            <div className="text-xs font-medium text-zinc-300">{trk('ifTrue')}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="replykb-true-mode">{trk('actionLabel')}</Label>
                <Select
                  value={trueMode}
                  onValueChange={(value) =>
                    onUpdate({ trueMode: value as ReplyKeyboardNodeData['trueMode'] })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variant">{trk('actionSetVariant')}</SelectItem>
                    <SelectItem value="system">{trk('actionUseSystem')}</SelectItem>
                    <SelectItem value="clear">{trk('actionHide')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="replykb-true-variant">{trk('variantLabel')}</Label>
                {renderVariantSelect(
                  'replykb-true-variant',
                  data.trueVariantKey,
                  (value) => onUpdate({ trueVariantKey: value }),
                  trueMode !== 'variant'
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3 space-y-3">
            <div className="text-xs font-medium text-zinc-300">{trk('ifFalse')}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="replykb-false-mode">{trk('actionLabel')}</Label>
                <Select
                  value={falseMode}
                  onValueChange={(value) =>
                    onUpdate({ falseMode: value as ReplyKeyboardNodeData['falseMode'] })
                  }
                >
                  <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variant">{trk('actionSetVariant')}</SelectItem>
                    <SelectItem value="system">{trk('actionUseSystem')}</SelectItem>
                    <SelectItem value="clear">{trk('actionHide')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="replykb-false-variant">{trk('variantLabel')}</Label>
                {renderVariantSelect(
                  'replykb-false-variant',
                  data.falseVariantKey,
                  (value) => onUpdate({ falseVariantKey: value }),
                  falseMode !== 'variant'
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {mode === 'clear' && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {trk('clearHint')}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// WAIT NODE SETTINGS
// ============================================================================

function WaitSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: WaitNodeData
  onUpdate: (data: Partial<WaitNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const tw = (key: string) => t(`wait.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wait-for">{tw('waitForLabel')}</Label>
        <Select
          value={data.waitFor || 'message'}
          onValueChange={(value) => onUpdate({ waitFor: value })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="message">{tw('message')}</SelectItem>
            <SelectItem value="callbackQuery">{tw('buttonClick')}</SelectItem>
            <SelectItem value="photo">{tw('photo')}</SelectItem>
            <SelectItem value="contact">{tw('contact')}</SelectItem>
            <SelectItem value="location">{tw('location')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="wait-timeout">{tw('timeoutLabel')}</Label>
        <Input
          id="wait-timeout"
          type="number"
          value={data.timeout || 300000}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) })}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">{tw('timeoutHint')}</p>
      </div>

      <div>
        <Label htmlFor="wait-savevar">{tw('saveToVariableLabel')}</Label>
        <VariableAutocompleteInput
          id="wait-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={tw('saveToVariablePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>
    </div>
  )
}

// ============================================================================
// COMMENT NODE SETTINGS
// ============================================================================

function CommentSettings({
  data,
  onUpdate,
  t,
}: {
  data: CommentNodeData
  onUpdate: (data: Partial<CommentNodeData>) => void
  t: (key: string) => string
}) {
  const tco = (key: string) => t(`comment.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="comment-text">{tco('textLabel')}</Label>
        <Textarea
          id="comment-text"
          value={data.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder={tco('textPlaceholder')}
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="comment-color">{tco('colorLabel')}</Label>
        <Select
          value={data.color || 'default'}
          onValueChange={(value) => onUpdate({ color: value })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{tco('default')}</SelectItem>
            <SelectItem value="info">{tco('info')}</SelectItem>
            <SelectItem value="warning">{tco('warning')}</SelectItem>
            <SelectItem value="error">{tco('error')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ============================================================================
// INLINE KEYBOARD EDITOR
// ============================================================================

interface InlineKeyboardEditorProps {
  keyboard?: {
    rows: Array<{
      buttons: Array<{
        id: string
        text: string
        actionType?: string
        callbackData?: string
        callback_data?: string
        url?: string
        starsUrl?: string
        payStars?: boolean
      }>
    }>
  }
  onChange: (keyboard: KeyboardData) => void
  t: (key: string) => string
}

function InlineKeyboardEditor({ keyboard, onChange, t }: InlineKeyboardEditorProps) {
  const tk = (key: string) => t(`keyboard.${key}`)
  const tm = (key: string) => t(`message.${key}`)

  const rows =
    keyboard?.rows?.map((row) => ({
      buttons: (row.buttons || []).map((button) => ({
        ...button,
        actionType:
          String(button.actionType || '').trim() ||
          (button.payStars ? 'stars' : String(button.url || '').trim() ? 'url' : 'callback'),
        callbackData: button.callbackData || button.callback_data || '',
        starsUrl: button.starsUrl || (button.payStars ? button.url || '{{payment.url}}' : ''),
      })),
    })) || []

  const buildDefaultCallbackData = (value: string) =>
    `btn:${value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_:-]/g, '')
      .slice(0, 52) || 'button'}`

  const addRow = () => {
    onChange({
      rows: [...rows, { buttons: [] }],
    })
  }

  const removeRow = (index: number) => {
    onChange({
      rows: rows.filter((_, i) => i !== index),
    })
  }

  const addButton = (rowIndex: number) => {
    const newRows = [...rows]
    const id = `btn-${rowIndex}-${newRows[rowIndex].buttons.length + 1}`
    newRows[rowIndex].buttons.push({
      id,
      text: tk('button'),
      actionType: 'callback',
      callbackData: buildDefaultCallbackData(id),
      starsUrl: '',
    })
    onChange({ rows: newRows })
  }

  const updateButton = (
    rowIndex: number,
    buttonIndex: number,
    field: 'text' | 'callbackData' | 'url' | 'starsUrl' | 'actionType',
    value: string
  ) => {
    const newRows = [...rows]
    const current = newRows[rowIndex].buttons[buttonIndex]

    if (field === 'actionType') {
      const actionType = String(value || 'callback').trim() || 'callback'
      current.actionType = actionType
      if (actionType === 'callback') {
        current.url = ''
        current.starsUrl = ''
        current.payStars = false
        if (!current.callbackData) {
          current.callbackData = buildDefaultCallbackData(current.id || `btn-${rowIndex}-${buttonIndex + 1}`)
        }
      } else if (actionType === 'url') {
        current.payStars = false
        current.starsUrl = ''
        if (!current.url) {
          current.url = 'https://'
        }
      } else if (actionType === 'stars') {
        current.payStars = true
        current.callbackData = ''
        current.url = ''
        current.starsUrl = current.starsUrl || '{{payment.url}}'
      }
    } else {
      current[field] = value
      if (field === 'starsUrl') {
        current.actionType = 'stars'
        current.payStars = true
      }
    }

    onChange({ rows: newRows })
  }

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    const newRows = [...rows]
    newRows[rowIndex].buttons = newRows[rowIndex].buttons.filter((_, i) => i !== buttonIndex)
    onChange({ rows: newRows })
  }

  return (
    <div className="space-y-2 mt-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="border border-white/10 rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{tk('row')} {rowIndex + 1}</span>
            <button
              onClick={() => removeRow(rowIndex)}
              className="p-1 rounded hover:bg-red-500/20 text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.buttons.map((button, buttonIndex) => (
              <div
                key={button.id}
                className="w-full space-y-2 bg-zinc-800/50 rounded px-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={button.text}
                    onChange={(e) => updateButton(rowIndex, buttonIndex, 'text', e.target.value)}
                    placeholder={tk('button')}
                    className="h-8 bg-zinc-900/40 border-white/10 text-sm"
                  />
                  <button
                    onClick={() => removeButton(rowIndex, buttonIndex)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <Select
                  value={String(button.actionType || 'callback')}
                  onValueChange={(value) => updateButton(rowIndex, buttonIndex, 'actionType', value)}
                >
                  <SelectTrigger className="h-8 bg-zinc-900/40 border-white/10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="callback">{tk('actionCallback')}</SelectItem>
                    <SelectItem value="url">{tk('actionUrl')}</SelectItem>
                    <SelectItem value="stars">{tk('actionStars')}</SelectItem>
                  </SelectContent>
                </Select>
                {String(button.actionType || 'callback') === 'callback' && (
                  <Input
                    value={button.callbackData || ''}
                    onChange={(e) => updateButton(rowIndex, buttonIndex, 'callbackData', e.target.value)}
                    placeholder={tk('callbackPlaceholder')}
                    className="h-8 bg-zinc-900/40 border-white/10 text-xs font-mono"
                  />
                )}
                {String(button.actionType || '') === 'url' && (
                  <Input
                    value={button.url || ''}
                    onChange={(e) => updateButton(rowIndex, buttonIndex, 'url', e.target.value)}
                    placeholder={tk('urlPlaceholder')}
                    className="h-8 bg-zinc-900/40 border-white/10 text-xs"
                  />
                )}
                {String(button.actionType || '') === 'stars' && (
                  <>
                    <Input
                      value={button.starsUrl || ''}
                      onChange={(e) => updateButton(rowIndex, buttonIndex, 'starsUrl', e.target.value)}
                      placeholder={tk('starsUrlPlaceholder')}
                      className="h-8 bg-zinc-900/40 border-white/10 text-xs"
                    />
                    <p className="text-[11px] text-zinc-500">{tk('starsHint')}</p>
                  </>
                )}
              </div>
            ))}
            <button
              onClick={() => addButton(rowIndex)}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 text-sm"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button
        onClick={addRow}
        variant="outline"
        size="sm"
        className="w-full gap-2 border-white/10"
      >
        <Plus className="w-4 h-4" />
        {tm('addRow')}
      </Button>
    </div>
  )
}
