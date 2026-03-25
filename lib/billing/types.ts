export type PlanCode = 'base' | 'business' | 'enterprise'

export type PlanStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete'

export type BillingCurrency = 'RUB' | 'USD'

export type BillingProvider = 'yookassa'

export type BillingInterval = 'month' | 'year'

export type SubscriptionTransactionKind = 'initial' | 'renewal' | 'change'

export type SubscriptionTransactionStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'

export type UserRole = 'user' | 'admin'

export type PlanFeatureValue = 'included' | 'excluded' | 'soon'

export type PlanEntitlements = {
  canvas: boolean
  system: boolean
  settings: boolean
  zipExport: boolean
  editorTechnicalStats: boolean
  crm: boolean
  dashboardStatisticsBasic: boolean
  dashboardStatisticsPro: boolean
  aiNodes: boolean
  aiChat: boolean
  ownAiApiKeys: boolean
  tokenTopUps: boolean
  hosting: boolean
  prioritySupport: boolean
  maxBots: number
  maxHostedBots: number
}

export type PricingFeatureCell =
  | { kind: 'included' }
  | { kind: 'excluded' }
  | { kind: 'soon' }
  | { kind: 'limit'; value: string }
  | { kind: 'text'; value: string }

export type PricingFeatureRow = {
  id: string
  label: string
  description?: string
  soon?: boolean
  values: Record<PlanCode, PricingFeatureCell>
}

export type PricingFeatureGroup = {
  id: string
  label: string
  rows: PricingFeatureRow[]
}

export type PlanDefinition = {
  code: PlanCode
  name: string
  tagline: string
  description: string
  badge?: string
  recommendedBadge?: string
  popular?: boolean
  monthlyPrice: Record<BillingCurrency, number>
  yearlyPrice: Record<BillingCurrency, number>
  yearlyDiscountPercent: number
  entitlements: PlanEntitlements
  spotlightFeatures: string[]
}

export type SubscriptionUsage = {
  bots: number
  hostedBots: number
}

export type PendingSubscriptionTransaction = {
  id: string
  planCode: PlanCode
  billingInterval: BillingInterval
  kind: SubscriptionTransactionKind
  amount: number
  currency: BillingCurrency
  confirmationUrl: string | null
  createdAt: string
}

export type SubscriptionSummary = {
  role: UserRole
  isAdmin: boolean
  planCode: PlanCode
  effectivePlanCode: PlanCode
  status: PlanStatus
  currency: BillingCurrency
  priceAmount: number
  billingInterval: BillingInterval
  billingProvider: BillingProvider
  cancelAtPeriodEnd: boolean
  startedAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  canceledAt: string | null
  pastDueAt: string | null
  usage: SubscriptionUsage
  entitlements: PlanEntitlements
  softLocked: boolean
  usageExceeded: boolean
  restrictions: string[]
  availableCurrencies: BillingCurrency[]
  pendingTransaction: PendingSubscriptionTransaction | null
}

export type ViewerAccess = SubscriptionSummary
