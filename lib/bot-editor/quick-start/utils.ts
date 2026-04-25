import type {
  BotConfig,
  BotMetadata,
  QuickStartAiAnswers,
  QuickStartAiDraft,
  QuickStartDraft,
  QuickStartLastGeneration,
  QuickStartTemplateDraft,
  QuickStartTemplateId,
} from '@/lib/bot-editor/types/bot.types'

export const QUICK_START_GENERATOR_VERSION = 'v2' as const
export const QUICK_START_AI_GENERATOR_VERSION = 'v2' as const
export const QUICK_START_TEMPLATE_GENERATOR_VERSION = 'v1' as const

export const QUICK_START_TEMPLATE_IDS: QuickStartTemplateId[] = [
  'lead-gen',
  'faq',
  'booking',
  'services',
]

const QUICK_START_AI_DEFAULT_ANSWERS: QuickStartAiAnswers = {
  businessName: '',
  businessDescription: '',
  primaryGoal: '',
  targetAudience: '',
  requiredSections: '',
  leadCaptureFields: '',
  offerings: '',
  faq: '',
  contactDetails: '',
  tone: '',
  extraInstructions: '',
}

function sanitizeJsonValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item) => item !== undefined)
  }

  if (!value || typeof value !== 'object') {
    return undefined
  }

  const result: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    const sanitized = sanitizeJsonValue(nestedValue)
    if (sanitized !== undefined) {
      result[key] = sanitized
    }
  }

  return result
}

function normalizeStringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeLastGeneration(value: unknown): QuickStartLastGeneration | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const provider = normalizeStringField(record.provider)
  const model = normalizeStringField(record.model)
  const generatedAt = normalizeStringField(record.generatedAt)

  if (provider !== 'openrouter' || !model || !generatedAt) {
    return undefined
  }

  return {
    provider: 'openrouter',
    model,
    generatedAt,
  }
}

export function isQuickStartTemplateId(value: unknown): value is QuickStartTemplateId {
  return QUICK_START_TEMPLATE_IDS.includes(value as QuickStartTemplateId)
}

export function sanitizeQuickStartAnswers(input: unknown): Record<string, unknown> {
  const sanitized = sanitizeJsonValue(input)
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) {
    return {}
  }

  return sanitized as Record<string, unknown>
}

export function sanitizeQuickStartAiAnswers(input: unknown): QuickStartAiAnswers {
  const record = sanitizeQuickStartAnswers(input)
  return {
    businessName: normalizeStringField(record.businessName),
    businessDescription: normalizeStringField(record.businessDescription),
    primaryGoal: normalizeStringField(record.primaryGoal),
    targetAudience: normalizeStringField(record.targetAudience),
    requiredSections: normalizeStringField(record.requiredSections),
    leadCaptureFields: normalizeStringField(record.leadCaptureFields),
    offerings: normalizeStringField(record.offerings),
    faq: normalizeStringField(record.faq),
    contactDetails: normalizeStringField(record.contactDetails),
    tone: normalizeStringField(record.tone),
    extraInstructions: normalizeStringField(record.extraInstructions),
  }
}

export function getDefaultQuickStartAiAnswers(): QuickStartAiAnswers {
  return { ...QUICK_START_AI_DEFAULT_ANSWERS }
}

function sanitizeQuickStartTemplateDraft(record: Record<string, unknown>): QuickStartTemplateDraft {
  const statusRaw = String(record.status || 'draft')
  const status: QuickStartTemplateDraft['status'] =
    statusRaw === 'completed' || statusRaw === 'skipped' || statusRaw === 'draft'
      ? statusRaw
      : 'draft'
  const templateId = isQuickStartTemplateId(record.templateId) ? record.templateId : null
  const completedAt = typeof record.completedAt === 'string' && record.completedAt.trim()
    ? record.completedAt.trim()
    : undefined

  return {
    mode: 'template',
    status,
    templateId,
    answers: sanitizeQuickStartAnswers(record.answers),
    generatorVersion: QUICK_START_TEMPLATE_GENERATOR_VERSION,
    ...(completedAt ? { completedAt } : {}),
  }
}

function sanitizeQuickStartAiDraft(record: Record<string, unknown>): QuickStartAiDraft {
  const statusRaw = String(record.status || 'draft')
  const status: QuickStartAiDraft['status'] =
    statusRaw === 'completed' || statusRaw === 'skipped' || statusRaw === 'draft'
      ? statusRaw
      : 'draft'
  const completedAt = typeof record.completedAt === 'string' && record.completedAt.trim()
    ? record.completedAt.trim()
    : undefined
  const lastGeneration = sanitizeLastGeneration(record.lastGeneration)

  return {
    mode: 'ai',
    status,
    answers: sanitizeQuickStartAiAnswers(record.answers),
    generatorVersion: QUICK_START_AI_GENERATOR_VERSION,
    ...(completedAt ? { completedAt } : {}),
    ...(lastGeneration ? { lastGeneration } : {}),
  }
}

export function sanitizeQuickStartDraft(input: unknown): QuickStartDraft {
  const record = input && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {}

  const mode = normalizeStringField(record.mode)
  const generatorVersion = normalizeStringField(record.generatorVersion)

  if (mode === 'ai' || generatorVersion === QUICK_START_AI_GENERATOR_VERSION) {
    return sanitizeQuickStartAiDraft(record)
  }

  return sanitizeQuickStartTemplateDraft(record)
}

export function getQuickStartDraft(metadata: BotMetadata | null | undefined): QuickStartDraft | null {
  if (!metadata?.fastStart) {
    return null
  }

  return sanitizeQuickStartDraft(metadata.fastStart)
}

export function isQuickStartCompletedOrSkipped(metadata: BotMetadata | null | undefined): boolean {
  const draft = getQuickStartDraft(metadata)
  return draft?.status === 'completed' || draft?.status === 'skipped'
}

export function isBotConfigMeaningfullyEmpty(config: BotConfig | null | undefined): boolean {
  if (!config) return true

  const nonCommentNodes = (config.nodes || []).filter((node) => node.type !== 'comment')
  return nonCommentNodes.length === 0 && (config.edges || []).length === 0 && (config.variables || []).length === 0
}
