import type { Json } from '@/lib/supabase/types'

export type AppMaintenanceScope = 'none' | 'site' | 'editor' | 'dashboard_editor'
export type DashboardSectionVisibilityMode = 'default' | 'locked' | 'hidden'
export type ManagedDashboardSection =
  | 'bots'
  | 'statistics'
  | 'subscription'
  | 'crm'
  | 'docs'
  | 'profile'
  | 'settings'

export type DashboardSectionAccessOverride = {
  mode: DashboardSectionVisibilityMode
  label: string | null
}

export type AppAccessControls = {
  registrationOpen: boolean
  maintenanceScope: AppMaintenanceScope
  maintenanceTitle: string
  maintenanceMessage: string
  dashboardSections: Record<ManagedDashboardSection, DashboardSectionAccessOverride>
}

type AppAccessControlsRowLike = Partial<{
  registration_open: unknown
  maintenance_scope: unknown
  maintenance_title: unknown
  maintenance_message: unknown
  dashboard_overrides: unknown
}> | null

export const MANAGED_DASHBOARD_SECTIONS: ManagedDashboardSection[] = [
  'bots',
  'statistics',
  'subscription',
  'crm',
  'docs',
  'profile',
  'settings',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function asMaintenanceScope(value: unknown, fallback: AppMaintenanceScope): AppMaintenanceScope {
  switch (value) {
    case 'site':
    case 'editor':
    case 'dashboard_editor':
    case 'none':
      return value
    default:
      return fallback
  }
}

function asVisibilityMode(
  value: unknown,
  fallback: DashboardSectionVisibilityMode
): DashboardSectionVisibilityMode {
  switch (value) {
    case 'locked':
    case 'hidden':
    case 'default':
      return value
    default:
      return fallback
  }
}

export function createDefaultDashboardSectionOverrides(): Record<
  ManagedDashboardSection,
  DashboardSectionAccessOverride
> {
  return {
    bots: { mode: 'default', label: null },
    statistics: { mode: 'default', label: null },
    subscription: { mode: 'default', label: null },
    crm: { mode: 'locked', label: null },
    docs: { mode: 'default', label: null },
    profile: { mode: 'default', label: null },
    settings: { mode: 'default', label: null },
  }
}

export function createDefaultAppAccessControls(): AppAccessControls {
  return {
    registrationOpen: true,
    maintenanceScope: 'none',
    maintenanceTitle: '',
    maintenanceMessage: '',
    dashboardSections: createDefaultDashboardSectionOverrides(),
  }
}

export function parseAppAccessControls(raw: AppAccessControlsRowLike): AppAccessControls {
  const defaults = createDefaultAppAccessControls()
  if (!isRecord(raw)) {
    return defaults
  }

  const rawOverrides = isRecord(raw.dashboard_overrides) ? raw.dashboard_overrides : {}
  const dashboardSections = MANAGED_DASHBOARD_SECTIONS.reduce<
    Record<ManagedDashboardSection, DashboardSectionAccessOverride>
  >((accumulator, section) => {
    const fallback = defaults.dashboardSections[section]
    const rawOverride = isRecord(rawOverrides[section]) ? rawOverrides[section] : {}
    const nextLabel = asString(rawOverride.label, '')

    accumulator[section] = {
      mode: asVisibilityMode(rawOverride.mode, fallback.mode),
      label: nextLabel || null,
    }

    return accumulator
  }, createDefaultDashboardSectionOverrides())

  return {
    registrationOpen: asBoolean(raw.registration_open, defaults.registrationOpen),
    maintenanceScope: asMaintenanceScope(raw.maintenance_scope, defaults.maintenanceScope),
    maintenanceTitle: asString(raw.maintenance_title, ''),
    maintenanceMessage: asString(raw.maintenance_message, ''),
    dashboardSections,
  }
}

export function serializeAppAccessControls(config: AppAccessControls) {
  const dashboardOverrides = MANAGED_DASHBOARD_SECTIONS.reduce<Record<string, Json>>(
    (accumulator, section) => {
      accumulator[section] = {
        mode: config.dashboardSections[section].mode,
        label: config.dashboardSections[section].label,
      }
      return accumulator
    },
    {}
  )

  return {
    id: 1,
    registration_open: config.registrationOpen,
    maintenance_scope: config.maintenanceScope,
    maintenance_title: config.maintenanceTitle.trim() || null,
    maintenance_message: config.maintenanceMessage.trim() || null,
    dashboard_overrides: dashboardOverrides,
  }
}

export function getPathLocale(pathname: string): 'ru' | 'en' {
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment === 'en' ? 'en' : 'ru'
}

export function isMaintenancePagePath(pathname: string) {
  return pathname === '/maintenance' || pathname.startsWith('/maintenance/')
}

export function isAuthPath(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/')
}

export function isPaymentReturnPath(pathname: string) {
  return pathname === '/payment/return' || pathname.startsWith('/payment/return/')
}

export function shouldBypassMaintenancePath(pathname: string) {
  return isMaintenancePagePath(pathname) || isAuthPath(pathname) || isPaymentReturnPath(pathname)
}

export function maintenanceScopeApplies(scope: AppMaintenanceScope, pathname: string) {
  if (scope === 'none') return false
  if (scope === 'site') return true
  if (scope === 'editor') {
    return pathname.includes('/dashboard/bots/') && pathname.includes('/editor')
  }
  if (scope === 'dashboard_editor') {
    return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  }
  return false
}

export function getManagedDashboardSectionFromPath(pathname: string): ManagedDashboardSection | null {
  if (pathname === '/dashboard/bots' || pathname === '/dashboard/bots/') return 'bots'
  if (pathname === '/dashboard/statistics' || pathname.startsWith('/dashboard/statistics/')) {
    return 'statistics'
  }
  if (pathname === '/dashboard/subscription' || pathname.startsWith('/dashboard/subscription/')) {
    return 'subscription'
  }
  if (pathname === '/dashboard/crm' || pathname.startsWith('/dashboard/crm/')) return 'crm'
  if (pathname === '/dashboard/docs' || pathname.startsWith('/dashboard/docs/')) return 'docs'
  if (pathname === '/dashboard/profile' || pathname.startsWith('/dashboard/profile/')) return 'profile'
  if (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) {
    return 'settings'
  }
  return null
}

function getFallbackSectionBadge(
  mode: DashboardSectionVisibilityMode,
  locale: 'ru' | 'en'
) {
  if (mode === 'hidden') {
    return locale === 'en' ? 'Hidden' : 'Скрыто'
  }
  return locale === 'en' ? 'Soon' : 'Скоро'
}

export type ResolvedDashboardSectionAccess = {
  mode: DashboardSectionVisibilityMode
  badge: string | null
  visible: boolean
  accessible: boolean
}

export function resolveDashboardSectionAccess(
  section: ManagedDashboardSection,
  config: AppAccessControls,
  isAdmin: boolean,
  locale: 'ru' | 'en'
): ResolvedDashboardSectionAccess {
  const override = config.dashboardSections[section]
  const badge = override.mode === 'default'
    ? null
    : override.label || getFallbackSectionBadge(override.mode, locale)

  if (isAdmin) {
    return {
      mode: override.mode,
      badge,
      visible: true,
      accessible: true,
    }
  }

  if (override.mode === 'hidden') {
    return {
      mode: override.mode,
      badge,
      visible: false,
      accessible: false,
    }
  }

  if (override.mode === 'locked') {
    return {
      mode: override.mode,
      badge,
      visible: true,
      accessible: false,
    }
  }

  return {
    mode: 'default',
    badge: null,
    visible: true,
    accessible: true,
  }
}

export function getDefaultMaintenanceTitle(
  scope: AppMaintenanceScope,
  locale: 'ru' | 'en'
) {
  if (locale === 'en') {
    switch (scope) {
      case 'editor':
        return 'Editor maintenance'
      case 'dashboard_editor':
        return 'Dashboard maintenance'
      case 'site':
        return 'Site maintenance'
      default:
        return 'Maintenance'
    }
  }

  switch (scope) {
    case 'editor':
      return 'Редактор на техобслуживании'
    case 'dashboard_editor':
      return 'Дэшборд временно недоступен'
    case 'site':
      return 'Сайт на техобслуживании'
    default:
      return 'Технические работы'
  }
}

export function getDefaultMaintenanceMessage(
  scope: AppMaintenanceScope,
  locale: 'ru' | 'en'
) {
  if (locale === 'en') {
    switch (scope) {
      case 'editor':
        return 'The bot editor is temporarily unavailable. Please try again a bit later.'
      case 'dashboard_editor':
        return 'The dashboard and bot editor are temporarily unavailable. Please try again a bit later.'
      case 'site':
        return 'The service is temporarily unavailable while maintenance is in progress. Please try again a bit later.'
      default:
        return 'The selected area is temporarily unavailable.'
    }
  }

  switch (scope) {
    case 'editor':
      return 'Редактор бота временно недоступен. Попробуйте зайти чуть позже.'
    case 'dashboard_editor':
      return 'Дэшборд и редактор бота временно недоступны. Попробуйте зайти чуть позже.'
    case 'site':
      return 'Сервис временно недоступен из-за технических работ. Попробуйте зайти чуть позже.'
    default:
      return 'Выбранный раздел временно недоступен.'
  }
}
