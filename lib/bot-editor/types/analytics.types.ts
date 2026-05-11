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

export type CrmScope = 'global' | 'bot'

export type CrmFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'phone'
  | 'email'
  | 'select'
  | 'checkbox'

export type CrmBotOption = {
  id: string
  name: string
}

export type CrmPipeline = {
  id: string
  userId: string
  botId: string | null
  scope: CrmScope
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type CrmStage = {
  id: string
  userId: string
  pipelineId: string
  key: string
  name: string
  color: string
  sortOrder: number
  isTerminal: boolean
  createdAt: string
  updatedAt: string
}

export type CrmField = {
  id: string
  userId: string
  pipelineId: string
  key: string
  name: string
  type: CrmFieldType
  options: string[]
  required: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type CrmCard = {
  id: string
  userId: string
  botId: string | null
  botName: string | null
  pipelineId: string
  stageId: string
  stageKey: string
  stageName: string
  stageColor: string
  title: string
  externalKey: string
  telegramUserId: number | null
  telegramChatId: number | null
  fieldValues: Record<string, unknown>
  tags: string[]
  notes: string
  createdAt: string
  updatedAt: string
  stageUpdatedAt: string
}

export type CrmCardEvent = {
  id: string
  cardId: string
  userId: string
  botId: string | null
  eventType: string
  payload: Record<string, unknown>
  createdAt: string
}

export type CrmBoard = {
  scope: CrmScope
  botId: string | null
  pipeline: CrmPipeline
  stages: CrmStage[]
  fields: CrmField[]
  cards: CrmCard[]
  bots: CrmBotOption[]
}

export type CrmBoardFilters = {
  scope?: CrmScope
  botId?: string | null
  search?: string
}

export type CrmCardFieldMapping = {
  fieldKey: string
  value: unknown
}

export type UpsertCrmCardInput = {
  id?: string
  scope?: CrmScope
  botId?: string | null
  pipelineId?: string | null
  stageId?: string | null
  stageKey?: string | null
  title: string
  externalKey?: string | null
  telegramUserId?: number | null
  telegramChatId?: number | null
  fieldValues?: Record<string, unknown>
  tags?: string[]
  notes?: string | null
}

export type UpsertCrmStageInput = {
  id?: string
  pipelineId: string
  key?: string
  name: string
  color: string
  sortOrder?: number
  isTerminal?: boolean
}

export type UpsertCrmFieldInput = {
  id?: string
  pipelineId: string
  key?: string
  name: string
  type: CrmFieldType
  options?: string[]
  required?: boolean
  sortOrder?: number
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

export type DashboardGlobalStatsDelta = {
  current: number
  previous: number
  deltaPercent: number | null
  direction: 'up' | 'down' | 'flat' | 'none'
  available: boolean
}

export type DashboardGlobalStatsComparison = {
  available: boolean
  revenueComparable: boolean
  revenue: DashboardGlobalStatsDelta
  successfulPayments: DashboardGlobalStatsDelta
  activeSubscribers: DashboardGlobalStatsDelta
  conversionPercent: DashboardGlobalStatsDelta
}

export type DashboardGlobalFunnel = {
  firstContactUsers: number
  activeUsers: number
  paidUsers: number
  repeatPayers: number
}

export type DashboardRetentionWindowKey = 'd1' | 'd3' | 'd7' | 'd30'

export type DashboardGlobalRetentionWindow = {
  key: DashboardRetentionWindowKey
  label: string
  retainedUsers: number
  cohortUsers: number
  retentionPercent: number
}

export type DashboardGlobalRetentionCohortRow = {
  cohortStart: string
  cohortEnd: string
  cohortUsers: number
  windows: Record<DashboardRetentionWindowKey, DashboardGlobalRetentionWindow>
}

export type DashboardGlobalRetentionBlock = {
  available: boolean
  recentOnly: boolean
  cohortCount: number
  summary: Record<DashboardRetentionWindowKey, DashboardGlobalRetentionWindow>
  cohorts: DashboardGlobalRetentionCohortRow[]
}

export type DashboardGlobalCurrencyTotal = {
  currency: string
  amount: number
}

export type DashboardGlobalMoneySummary = {
  count: number
  totalAmount: number
  currencyTotals: DashboardGlobalCurrencyTotal[]
}

export type DashboardGlobalLostRevenueBotSlice = {
  botId: string
  botName: string
  pending: DashboardGlobalMoneySummary
  failed: DashboardGlobalMoneySummary
}

export type DashboardGlobalLostRevenueMethodSlice = {
  method: string
  pending: DashboardGlobalMoneySummary
  failed: DashboardGlobalMoneySummary
}

export type DashboardGlobalLostRevenue = {
  pending: DashboardGlobalMoneySummary
  failed: DashboardGlobalMoneySummary
  byBot: DashboardGlobalLostRevenueBotSlice[]
  byMethod: DashboardGlobalLostRevenueMethodSlice[]
}

export type DashboardGlobalRepeatMetrics = {
  repeatRevenueAmount: number | null
  repeatRevenueSharePercent: number | null
  repeatRevenueCurrencyTotals: DashboardGlobalCurrencyTotal[]
  repeatPayers: number
  returnedPayers: number
  medianDaysToSecondPayment: number | null
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

export type DashboardGlobalBotRankingRow = {
  botId: string
  botName: string
  currentRevenue: number
  previousRevenue: number
  revenueDeltaPercent: number | null
  successfulPayments: number
  previousSuccessfulPayments: number
  uniquePayers: number
  activeSubscribers: number
  conversionPercent: number
  pendingCount: number
  failedCount: number
  pendingAmount: number
  failedAmount: number
}

export type DashboardGlobalRankings = {
  items: DashboardGlobalBotRankingRow[]
  bestGrowthBotId: string | null
  worstDeclineBotId: string | null
  bestConversionBotId: string | null
  mostProblematicBotId: string | null
}

export type DashboardGlobalAnomalyKey =
  | 'revenue_drop'
  | 'conversion_drop'
  | 'payment_issues_growth'
  | 'active_audience_drop'
  | 'new_audience_drop'

export type DashboardGlobalAnomaly = {
  key: DashboardGlobalAnomalyKey
  severity: 'warning' | 'critical'
  currentValue: number
  previousValue: number
  deltaPercent: number | null
}

export type DashboardGlobalReportFormat = 'csv' | 'xlsx'

export type DashboardAnalyticsEmailKind = 'weekly_digest' | 'monthly_summary' | 'anomaly_alert'

export type DashboardGlobalStats = {
  period: DashboardGlobalStatsPeriod
  entitlements: DashboardGlobalStatsEntitlements
  currencyMode: 'none' | 'single' | 'mixed'
  currencies: string[]
  basic: DashboardGlobalStatsBasic
  pro: DashboardGlobalStatsPro
  comparison: DashboardGlobalStatsComparison
  funnel: DashboardGlobalFunnel
  retention: {
    activity: DashboardGlobalRetentionBlock
    payment: DashboardGlobalRetentionBlock
  }
  lostRevenue: DashboardGlobalLostRevenue
  repeat: DashboardGlobalRepeatMetrics
  rankings: DashboardGlobalRankings
  anomalies: DashboardGlobalAnomaly[]
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
