import type {
  BillingCurrency,
  PlanCode,
  PlanDefinition,
  PlanEntitlements,
  PricingFeatureGroup,
  PricingFeatureRow,
} from '@/lib/billing/types'

export const PLAN_ORDER: PlanCode[] = ['base', 'business', 'enterprise']

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
    aiChat: false,
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
    aiChat: false,
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

function featureRow(
  id: string,
  locale: string,
  description: { ru?: string; en?: string },
  values: PricingFeatureRow['values']
): PricingFeatureRow {
  return {
    id,
    label: isRu(locale) ? description.ru || description.en || id : description.en || description.ru || id,
    values,
  }
}

export function getPlanDefinition(planCode: PlanCode, locale: string): PlanDefinition {
  const ru = isRu(locale)
  const shared = {
    monthlyPrice: {
      RUB: planCode === 'base' ? 0 : planCode === 'business' ? 1499 : 3499,
      USD: planCode === 'base' ? 0 : planCode === 'business' ? 18.99 : 38.99,
    },
    entitlements: PLAN_ENTITLEMENTS[planCode],
  }

  if (planCode === 'base') {
    return {
      code: 'base',
      name: ru ? 'Base' : 'Base',
      tagline: ru ? 'Бесплатно при регистрации' : 'Free on signup',
      description: ru
        ? 'Базовый тариф для создания и экспорта ботов без managed hosting и бизнес-аналитики.'
        : 'Free plan for building and exporting bots without managed hosting or business analytics.',
      ...shared,
      spotlightFeatures: ru
        ? ['До 3 ботов', 'ZIP-экспорт кода', 'Canvas + System + Settings']
        : ['Up to 3 bots', 'ZIP code export', 'Canvas + System + Settings'],
    }
  }

  if (planCode === 'business') {
    return {
      code: 'business',
      name: ru ? 'Business' : 'Business',
      tagline: ru ? 'Основной тариф для бизнеса' : 'Best fit for growing teams',
      description: ru
        ? 'Основной тариф для бизнеса: CRM, базовая dashboard-аналитика, AI-ноды и managed hosting.'
        : 'Core business plan with CRM, dashboard analytics, AI nodes, and managed hosting.',
      badge: ru ? 'Самый популярный' : 'Most popular',
      popular: true,
      ...shared,
      spotlightFeatures: ru
        ? ['До 10 ботов', 'CRM и базовая dashboard-статистика', 'Хостинг до 5 ботов']
        : ['Up to 10 bots', 'CRM and basic dashboard analytics', 'Hosting for up to 5 bots'],
    }
  }

  return {
    code: 'enterprise',
    name: ru ? 'Enterprise' : 'Enterprise',
    tagline: ru ? 'Максимум возможностей и лимитов' : 'Maximum access and scale',
    description: ru
      ? 'Расширенный тариф с полной аналитикой, AI Chat и повышенными лимитами на ботов и hosting.'
      : 'Advanced plan with full analytics, AI Chat, and higher bot/hosting limits.',
    ...shared,
    spotlightFeatures: ru
      ? ['До 20 ботов', 'Полная аналитика в dashboard', 'AI Chat и докупка токенов']
      : ['Up to 20 bots', 'Full dashboard analytics', 'AI Chat and token top-ups'],
  }
}

export function getAllPlanDefinitions(locale: string): PlanDefinition[] {
  return PLAN_ORDER.map((planCode) => getPlanDefinition(planCode, locale))
}

export function getPlanEntitlements(planCode: PlanCode): PlanEntitlements {
  return PLAN_ENTITLEMENTS[planCode]
}

export function getPlanPrice(planCode: PlanCode, currency: BillingCurrency): number {
  return getPlanDefinition(planCode, 'en').monthlyPrice[currency]
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
        }),
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
        featureRow('dashboard-pro-stats', locale, { ru: 'Улучшенная аналитика в dashboard', en: 'Advanced dashboard analytics' }, {
          base: { kind: 'excluded' },
          business: { kind: 'excluded' },
          enterprise: { kind: 'included' },
        }),
        featureRow('crm', locale, { ru: 'CRM по лидам и диалогам', en: 'CRM for leads and dialogs' }, {
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
        }),
        featureRow('ai-chat', locale, { ru: 'AI Chat', en: 'AI Chat' }, {
          base: { kind: 'excluded' },
          business: { kind: 'excluded' },
          enterprise: { kind: 'included' },
        }),
        featureRow('own-ai-keys', locale, { ru: 'Подключение своего AI через API-ключи', en: 'Bring your own AI API keys' }, {
          base: { kind: 'excluded' },
          business: { kind: 'included' },
          enterprise: { kind: 'included' },
        }),
        featureRow('token-topups', locale, { ru: 'Докупка токенов для AI', en: 'AI token top-ups' }, {
          base: { kind: 'excluded' },
          business: { kind: 'excluded' },
          enterprise: { kind: 'included' },
        }),
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
