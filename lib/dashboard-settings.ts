export type DashboardSettingsLocale = 'ru' | 'en'

export type DashboardDigestFormat = 'xlsx' | 'csv'

export type DashboardSettingsState = {
  notifications: {
    emailNotifications: boolean
    pushNotifications: boolean
    weeklyDigest: boolean
    monthlyDigest: boolean
    anomalyEmails: boolean
    digestFormat: DashboardDigestFormat
  }
  security: {
    twoFactorEnabled: boolean
    loginAlerts: boolean
  }
  appearance: {
    darkTheme: boolean
    compactMode: boolean
  }
  preferences: {
    language: DashboardSettingsLocale
    timezone: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function normalizeDashboardSettingsLocale(
  value: unknown,
  fallback: DashboardSettingsLocale
): DashboardSettingsLocale {
  return value === 'en' || value === 'ru' ? value : fallback
}

export function normalizeDashboardDigestFormat(
  value: unknown,
  fallback: DashboardDigestFormat = 'xlsx'
): DashboardDigestFormat {
  return value === 'csv' || value === 'xlsx' ? value : fallback
}

export function resolveBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function createDefaultDashboardSettings(
  locale: DashboardSettingsLocale
): DashboardSettingsState {
  return {
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      weeklyDigest: true,
      monthlyDigest: false,
      anomalyEmails: true,
      digestFormat: 'xlsx',
    },
    security: {
      twoFactorEnabled: false,
      loginAlerts: true,
    },
    appearance: {
      darkTheme: true,
      compactMode: false,
    },
    preferences: {
      language: locale,
      timezone: resolveBrowserTimeZone(),
    },
  }
}

export function parseDashboardSettings(
  rawMetadata: unknown,
  locale: DashboardSettingsLocale
): DashboardSettingsState {
  const defaults = createDefaultDashboardSettings(locale)

  if (!isRecord(rawMetadata)) {
    return defaults
  }

  const rawSettings = isRecord(rawMetadata.dashboard_settings) ? rawMetadata.dashboard_settings : {}
  const notifications = isRecord(rawSettings.notifications) ? rawSettings.notifications : {}
  const security = isRecord(rawSettings.security) ? rawSettings.security : {}
  const appearance = isRecord(rawSettings.appearance) ? rawSettings.appearance : {}
  const preferences = isRecord(rawSettings.preferences) ? rawSettings.preferences : {}

  return {
    notifications: {
      emailNotifications: asBoolean(
        notifications.emailNotifications,
        defaults.notifications.emailNotifications
      ),
      pushNotifications: asBoolean(
        notifications.pushNotifications,
        defaults.notifications.pushNotifications
      ),
      weeklyDigest: asBoolean(notifications.weeklyDigest, defaults.notifications.weeklyDigest),
      monthlyDigest: asBoolean(notifications.monthlyDigest, defaults.notifications.monthlyDigest),
      anomalyEmails: asBoolean(notifications.anomalyEmails, defaults.notifications.anomalyEmails),
      digestFormat: normalizeDashboardDigestFormat(
        notifications.digestFormat,
        defaults.notifications.digestFormat
      ),
    },
    security: {
      twoFactorEnabled: asBoolean(security.twoFactorEnabled, defaults.security.twoFactorEnabled),
      loginAlerts: asBoolean(security.loginAlerts, defaults.security.loginAlerts),
    },
    appearance: {
      darkTheme: asBoolean(appearance.darkTheme, defaults.appearance.darkTheme),
      compactMode: asBoolean(appearance.compactMode, defaults.appearance.compactMode),
    },
    preferences: {
      language: normalizeDashboardSettingsLocale(
        preferences.language,
        defaults.preferences.language
      ),
      timezone: asString(preferences.timezone, defaults.preferences.timezone),
    },
  }
}
