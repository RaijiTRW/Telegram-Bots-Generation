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

export type BotPaymentHistoryPeriod = '24h' | '7d' | '30d' | 'all'

export type BotPaymentHistoryFilters = {
  period?: BotPaymentHistoryPeriod
  search?: string
  method?: string
  status?: string
}

export type BotPaymentHistoryItem = {
  id: string
  paymentId: string
  method: string
  status: string
  amount: number | null
  currency: string
  payerId: number | null
  payerUsername: string
  payerName: string
  createdAt: string
}

export type BotPaymentHistorySummary = {
  totalCount: number
  totalAmount: number
  successCount: number
  pendingCount: number
  failedCount: number
}

export type BotPaymentHistory = {
  period: BotPaymentHistoryPeriod
  methods: string[]
  statuses: string[]
  summary: BotPaymentHistorySummary
  items: BotPaymentHistoryItem[]
}

export type BotSubscribersPeriod = '24h' | '7d' | '30d' | 'all'
export type BotSubscribersSource = 'message' | 'callback_query' | 'unknown'

export type BotSubscriberItem = {
  telegramUserId: number
  telegramChatId: number | null
  username: string
  firstName: string
  lastName: string
  languageCode: string
  source: BotSubscribersSource
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export type BotSubscribersSummary = {
  totalSubscribers: number
  activeInPeriod: number
  newInPeriod: number
  lastSeenAt: string | null
}

export type BotSubscribersAnalytics = {
  period: BotSubscribersPeriod
  page: number
  pageSize: number
  total: number
  summary: BotSubscribersSummary
  sourceCounts: Record<BotSubscribersSource, number>
  topLanguages: Array<{ code: string; count: number }>
  items: BotSubscriberItem[]
}

export type DashboardGlobalStatsPeriod = '24h' | '7d' | '30d' | 'all'

export type DashboardGlobalStatsFilters = {
  period?: DashboardGlobalStatsPeriod
  botId?: string
}

export type DashboardGlobalStatsEntitlements = {
  basic: boolean
  pro: boolean
}

export type DashboardGlobalStatsBasic = {
  revenue: number
  profit: number
  successfulPayments: number
  pendingAndFailedPayments: number
  totalSubscribers: number
  activeSubscribers: number
  newSubscribers: number
  avgUserActivity: number
}

export type DashboardGlobalStatsPro = {
  arpu: number
  arppu: number
  averageCheck: number
  conversionPercent: number
  repeatPayerRatePercent: number
  uniquePayers: number
  repeatPayers: number
}

export type DashboardGlobalStatsTrendPoint = {
  bucketStart: string
  revenue: number
  activity: number
}

export type DashboardGlobalTopBot = {
  botId: string
  botName: string
  revenue: number
  conversionPercent: number
  successfulPayments: number
  uniquePayers: number
  activeSubscribers: number
}

export type DashboardGlobalMethodSlice = {
  method: string
  count: number
  revenue: number
}

export type DashboardGlobalStatusSlice = {
  status: string
  count: number
}

export type DashboardGlobalStats = {
  period: DashboardGlobalStatsPeriod
  entitlements: DashboardGlobalStatsEntitlements
  currencyMode: 'none' | 'single' | 'mixed'
  currencies: string[]
  basic: DashboardGlobalStatsBasic
  pro: DashboardGlobalStatsPro
  trend: DashboardGlobalStatsTrendPoint[]
  topBots: DashboardGlobalTopBot[]
  methodBreakdown: DashboardGlobalMethodSlice[]
  statusBreakdown: DashboardGlobalStatusSlice[]
}

export type DashboardGlobalPaymentsFilters = {
  period?: DashboardGlobalStatsPeriod
  botId?: string
  search?: string
  method?: string
  status?: string
}

export type DashboardGlobalPaymentItem = {
  id: string
  paymentId: string
  botId: string
  botName: string
  method: string
  status: string
  amount: number | null
  currency: string
  payerId: number | null
  payerUsername: string
  payerName: string
  createdAt: string
}

export type DashboardGlobalPaymentsSummary = {
  totalCount: number
  totalAmount: number
  successCount: number
  pendingCount: number
  failedCount: number
  currencyTotals: Array<{ currency: string; amount: number }>
}

export type DashboardGlobalPayments = {
  period: DashboardGlobalStatsPeriod
  methods: string[]
  statuses: string[]
  page: number
  pageSize: number
  total: number
  summary: DashboardGlobalPaymentsSummary
  items: DashboardGlobalPaymentItem[]
}

export type DashboardGlobalSubscribersFilters = {
  period?: DashboardGlobalStatsPeriod
  botId?: string
  search?: string
  source?: BotSubscribersSource | 'all'
}

export type DashboardGlobalSubscriberItem = {
  botId: string
  botName: string
  telegramUserId: number
  telegramChatId: number | null
  username: string
  firstName: string
  lastName: string
  languageCode: string
  source: BotSubscribersSource
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export type DashboardGlobalSubscribers = {
  period: DashboardGlobalStatsPeriod
  page: number
  pageSize: number
  total: number
  summary: BotSubscribersSummary
  sourceCounts: Record<BotSubscribersSource, number>
  topLanguages: Array<{ code: string; count: number }>
  items: DashboardGlobalSubscriberItem[]
}
