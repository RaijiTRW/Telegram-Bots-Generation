export type LeadStage = 'new' | 'contacted' | 'qualified' | 'won' | 'lost'

export type CrmPeriod = '24h' | '7d' | '30d' | 'all'

export type CrmLeadRecord = {
  botId: string
  botName: string
  telegramUserId: number
  telegramChatId: number | null
  username: string
  firstName: string
  lastName: string
  languageCode: string
  leadStage: LeadStage
  leadNotes: string
  leadTags: string[]
  firstSeenAt: string | null
  lastSeenAt: string | null
  lastIncomingAt: string | null
  lastOutgoingAt: string | null
  inboundCount: number
  outboundCount: number
}

export type CrmOverview = {
  totalLeads: number
  stageCounts: Record<LeadStage, number>
  activeDialogs24h: number
  inbound24h: number
  outbound24h: number
}

export type CrmLeadTimelineEvent = {
  id: string
  botId: string
  telegramUserId: number
  telegramChatId: number | null
  direction: 'inbound' | 'outbound'
  eventKind: 'message_text' | 'callback' | 'media' | 'service'
  messageText: string
  payload: Record<string, unknown>
  createdAt: string
}

export type CrmLeadsResponse = {
  items: CrmLeadRecord[]
  total: number
  page: number
  pageSize: number
}

export type CrmFilters = {
  botId?: string
  stage?: LeadStage | 'all'
  period?: CrmPeriod
  search?: string
}

export type BotTechnicalStatsRange = '1h' | '24h' | '7d'

export type BotTechnicalStatsPoint = {
  bucketStart: string
  total: number
  error: number
  warn: number
}

export type BotTechnicalStatsTopSource = {
  source: string
  count: number
}

export type BotTechnicalStatsAuditEvent = {
  id: string
  eventType: string
  createdAt: string
  payload: Record<string, unknown>
}

export type BotTechnicalStatsSummary = {
  totalEvents: number
  errorCount: number
  warnCount: number
  errorRatePercent: number
  telegramErrors: number
  eventsPerMinute: number
  testStarts: number
  testStops: number
  canvasSaves: number
  settingsSaves: number
  totalSubscribers: number
  active7dSubscribers: number
  activeRangeSubscribers: number
}

export type BotTechnicalStats = {
  range: BotTechnicalStatsRange
  summary: BotTechnicalStatsSummary
  timeline: BotTechnicalStatsPoint[]
  topErrorSources: BotTechnicalStatsTopSource[]
  recentAuditEvents: BotTechnicalStatsAuditEvent[]
}
