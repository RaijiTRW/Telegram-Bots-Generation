import type {
  BillingCurrency,
  BillingInterval,
  PlanCode,
  PlanDefinition,
  PlanEntitlements,
  PricingFeatureGroup,
  PricingFeatureRow,
} from '@/lib/billing/types'
import { formatAiChatLimit, getAiChatLimit } from '@/lib/billing/ai-limits'

export const PLAN_ORDER: PlanCode[] = ['base', 'business', 'enterprise']
export const YEARLY_BILLING_DISCOUNT_PERCENT = 75

const PLAN_ENTITLEMENTS: Record<PlanCode, PlanEntitlements> = {
  base: {
    canvas: true,
    system: true,
    settings: true,
    zipExport: true,
    editorTechnicalStats: true,
    crm: false,
    dashboardStatisticsBasic: false,
    dashboardStatisticsPro: false,
    aiNodes: false,
    aiChat: true,
    aiChatLimitRequests: getAiChatLimit('base').requests,
    aiChatLimitWindowHours: getAiChatLimit('base').windowHours,
    ownAiApiKeys: false,
    tokenTopUps: false,
    hosting: false,
    prioritySupport: false,
    maxBots: 3,
    maxHostedBots: 0,
  },
  business: {
    canvas: true,
    system: true,
    settings: true,
    zipExport: true,
    editorTechnicalStats: true,
    crm: true,
    dashboardStatisticsBasic: true,
    dashboardStatisticsPro: false,
    aiNodes: true,
    aiChat: true,
    aiChatLimitRequests: getAiChatLimit('business').requests,
    aiChatLimitWindowHours: getAiChatLimit('business').windowHours,
    ownAiApiKeys: true,
    tokenTopUps: false,
    hosting: true,
    prioritySupport: true,
    maxBots: 10,
    maxHostedBots: 5,
  },
  enterprise: {
    canvas: true,
    system: true,
    settings: true,
    zipExport: true,
    editorTechnicalStats: true,
    crm: true,
    dashboardStatisticsBasic: true,
    dashboardStatisticsPro: true,
    aiNodes: true,
    aiChat: true,
    aiChatLimitRequests: getAiChatLimit('enterprise').requests,
    aiChatLimitWindowHours: getAiChatLimit('enterprise').windowHours,
    ownAiApiKeys: true,
    tokenTopUps: true,
    hosting: true,
    prioritySupport: true,
    maxBots: 20,
    maxHostedBots: 15,
  },
}

function isRu(locale: string) {
  return locale !== 'en'
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100
}

function buildYearlyPriceMap(monthlyPrice: Record<BillingCurrency, number>) {
  return {
    RUB: roundPrice(monthlyPrice.RUB * 12 * (1 - YEARLY_BILLING_DISCOUNT_PERCENT / 100)),
    USD: roundPrice(monthlyPrice.USD * 12 * (1 - YEARLY_BILLING_DISCOUNT_PERCENT / 100)),
  } satisfies Record<BillingCurrency, number>
}

function featureRow(
  id: string,
  locale: string,
  description: { ru?: string; en?: string },
  values: PricingFeatureRow['values'],
  options?: Pick<PricingFeatureRow, 'soon'>
): PricingFeatureRow {
  return {
    id,
    label: isRu(locale) ? description.ru || description.en || id : description.en || description.ru || id,
    ...(options || {}),
    values,
  }
}

export function getPlanDefinition(planCode: PlanCode, locale: string): PlanDefinition {
  const ru = isRu(locale)
  const monthlyPrice = {
    RUB: planCode === 'base' ? 0 : planCode === 'business' ? 1499 : 3499,
    USD: planCode === 'base' ? 0 : planCode === 'business' ? 18.99 : 38.99,
  } satisfies Record<BillingCurrency, number>
  const shared = {
    monthlyPrice,
    yearlyPrice: buildYearlyPriceMap(monthlyPrice),
    yearlyDiscountPercent: YEARLY_BILLING_DISCOUNT_PERCENT,
    entitlements: PLAN_ENTITLEMENTS[planCode],
  }

  if (planCode === 'base') {
    return {
      code: 'base',
      name: ru ? 'Base' : 'Base',
      tagline: ru ? 'Бесплатно при регистрации' : 'Free on signup',
      description: ru
        ? 'Базовый тариф для создания и экспорта ботов без размещения на нашем хостинге и бизнес-аналитики.'
        : 'Free plan for building and exporting bots without managed hosting or business analytics.',
      ...shared,
      spotlightFeatures: ru
        ? ['До 3 ботов', 'AI Chat: 10 запросов / 24 ч', 'ZIP-экспорт кода']
        : ['Up to 3 bots', 'AI Chat: 10 requests / 24h', 'ZIP code export'],
    }
  }

  if (planCode === 'business') {
    return {
      code: 'business',
      name: ru ? 'Business' : 'Business',
      tagline: ru ? 'Основной тариф для бизнеса' : 'Best fit for growing teams',
      description: ru
        ? 'Основной тариф для бизнеса: CRM, базовая dashboard-аналитика, AI-ноды и хостинг на нашей стороне.'
        : 'Core business plan with CRM, dashboard analytics, AI nodes, and managed hosting.',
      badge: ru ? 'Самый популярный' : 'Most popular',
      recommendedBadge: ru ? 'Рекомендуем' : 'Recommended',
      popular: true,
      ...shared,
      spotlightFeatures: ru
        ? ['До 10 ботов', 'AI Chat: 60 запросов / 5 ч', 'Хостинг до 5 ботов']
        : ['Up to 10 bots', 'AI Chat: 60 requests / 5h', 'Hosting for up to 5 bots'],
    }
  }

  return {
    code: 'enterprise',
    name: ru ? 'Enterprise' : 'Enterprise',
    tagline: ru ? 'Максимум возможностей и лимитов' : 'Maximum access and scale',
    description: ru
      ? 'Расширенный тариф с retention-аналитикой, XLSX-отчетами, email-алертами по аномалиям и повышенными лимитами.'
      : 'Advanced plan with retention analytics, XLSX reports, anomaly alert emails, and higher limits.',
    ...shared,
    spotlightFeatures: ru
      ? ['До 20 ботов', 'AI Chat: 140 запросов / 5 ч', 'Retention и XLSX-отчеты']
      : ['Up to 20 bots', 'AI Chat: 140 requests / 5h', 'Retention and XLSX reports'],
  }
}

export function getAllPlanDefinitions(locale: string): PlanDefinition[] {
  return PLAN_ORDER.map((planCode) => getPlanDefinition(planCode, locale))
}

export function getPlanEntitlements(planCode: PlanCode): PlanEntitlements {
  return PLAN_ENTITLEMENTS[planCode]
}

export function getBillingIntervalMonthCount(interval: BillingInterval): number {
  return interval === 'year' ? 12 : 1
}

export function getPlanPrice(planCode: PlanCode, currency: BillingCurrency, interval: BillingInterval = 'month'): number {
  const definition = getPlanDefinition(planCode, 'en')
  return interval === 'year' ? definition.yearlyPrice[currency] : definition.monthlyPrice[currency]
}

export function getPlanFullYearPriceWithoutDiscount(planCode: PlanCode, currency: BillingCurrency): number {
  return roundPrice(getPlanDefinition(planCode, 'en').monthlyPrice[currency] * 12)
}

export function getPlanMonthlyEquivalent(planCode: PlanCode, currency: BillingCurrency, interval: BillingInterval = 'month'): number {
  const price = getPlanPrice(planCode, currency, interval)
  return interval === 'year' ? roundPrice(price / 12) : price
}

export function getPricingFeatureGroups(locale: string): PricingFeatureGroup[] {
  const ru = isRu(locale)
  return [
    {
      id: 'editor',
      label: ru ? 'Редактор и запуск' : 'Editor and launch',
      rows: [
        featureRow('canvas', locale, { ru: 'Создание ботов через Canvas', en: 'Build bots in Canvas' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('system', locale, { ru: 'Полная настройка в разделе System', en: 'Full System configuration' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('settings', locale, { ru: 'Настройка стилей и параметров бота', en: 'Bot styling and settings' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('zip-export', locale, { ru: 'Скачивание бота через ZIP', en: 'Download bot as ZIP' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('managed-hosting', locale, { ru: 'Развертывание на нашем хостинге', en: 'Deploy on our hosting' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }, { soon: true }),
      ],
    },
    {
      id: 'analytics',
      label: ru ? 'Аналитика и CRM' : 'Analytics and CRM',
      rows: [
        featureRow('editor-technical-stats', locale, { ru: 'Техническая статистика в редакторе', en: 'Technical stats inside editor' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('dashboard-basic-stats', locale, { ru: 'Базовая статистика в dashboard', en: 'Basic dashboard analytics' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('dashboard-pro-stats', locale, { ru: 'Retention, отчеты XLSX и email-алерты', en: 'Retention, XLSX reports, and email alerts' }, {
          base: { kind: 'excluded' },
          business: { kind: 'excluded' },
          enterprise: { kind: 'included' },
        }),
        featureRow('crm', locale, { ru: 'CRM', en: 'CRM' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
      ],
    },
    {
      id: 'ai',
      label: ru ? 'AI и расширения' : 'AI and extensions',
      rows: [
        featureRow('ai-nodes', locale, { ru: 'AI-ноды', en: 'AI nodes' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }, { soon: true }),
        featureRow('ai-chat', locale, { ru: 'AI Chat', en: 'AI Chat' }, {
          base: { kind: 'included' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('ai-chat-limit', locale, { ru: 'Лимит AI Chat', en: 'AI Chat limit' }, {
          base: { kind: 'limit', value: formatAiChatLimit('base', locale) },
          business: { kind: 'limit', value: formatAiChatLimit('business', locale) },
          enterprise: { kind: 'limit', value: formatAiChatLimit('enterprise', locale) },
        }),
        featureRow('own-ai-keys', locale, { ru: 'Подключение своего AI через API-ключи', en: 'Bring your own AI API keys' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }, { soon: true }),
        featureRow('token-topups', locale, { ru: 'Докупка AI-кредитов', en: 'AI credit top-ups' }, {
          base: { kind: 'excluded' },
          business: { kind: 'excluded' },
          enterprise: { kind: 'included' },
        }, { soon: true }),
      ],
    },
    {
      id: 'support',
      label: ru ? 'Поддержка и лимиты' : 'Support and limits',
      rows: [
        featureRow('priority-support', locale, { ru: 'Приоритетная поддержка', en: 'Priority support' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('max-bots', locale, { ru: 'Максимум ботов', en: 'Max bots' }, {
          base: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.base.maxBots) },
          business: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.business.maxBots) },
          enterprise: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.enterprise.maxBots) },
        }),
        featureRow('max-hosted-bots', locale, { ru: 'Максимум ботов на хостинге', en: 'Max hosted bots' }, {
          base: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.base.maxHostedBots) },
          business: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.business.maxHostedBots) },
          enterprise: { kind: 'limit', value: String(PLAN_ENTITLEMENTS.enterprise.maxHostedBots) },
        }),
      ],
    },
  ]
}
