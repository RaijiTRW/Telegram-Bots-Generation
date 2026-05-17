'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { type Locale } from '@/app/i18n'
import { setUserLocale } from '@/app/actions/locale'
import { deleteCurrentUserAccount } from '@/app/actions/account'
import { createClient } from '@/lib/supabase/client'
import {
  createDefaultDashboardSettings,
  normalizeDashboardDigestFormat,
  normalizeDashboardSettingsLocale,
  parseDashboardSettings,
  type DashboardDigestFormat,
  type DashboardSettingsState,
} from '@/lib/dashboard-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Settings as SettingsIcon,
  Bell,
  BellRing,
  Lock,
  Globe,
  Shield,
  ChevronRight,
  Mail,
  Loader2,
  Save,
  RotateCcw,
  Trash2,
  KeyRound,
  QrCode,
  Copy,
  Smartphone,
  CheckCircle2,
} from 'lucide-react'

type Notice = {
  type: 'success' | 'error' | 'info'
  text: string
} | null

type MfaFactor = {
  id: string
  factor_type: string
  status: 'verified' | 'unverified' | string
  friendly_name?: string
  created_at?: string
  updated_at?: string
  last_challenged_at?: string
}

type TotpEnrollmentState = {
  factorId: string
  qrCodeSvg: string
  secret: string
  uri: string
  friendlyName: string
}

type BrowserPushSubscriptionPayload = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

type SettingsSectionKey = keyof Pick<DashboardSettingsState, 'notifications' | 'security' | 'appearance'>

type NotificationSettingKey = Exclude<keyof DashboardSettingsState['notifications'], 'digestFormat'>
type SecuritySettingKey = keyof DashboardSettingsState['security']
type AppearanceSettingKey = keyof DashboardSettingsState['appearance']
type SwitchSettingKey = NotificationSettingKey | SecuritySettingKey | AppearanceSettingKey

type SwitchItemConfig = {
  key: SwitchSettingKey
  label: string
  description: string
}

type SwitchSectionConfig = {
  key: SettingsSectionKey
  title: string
  description: string
  icon: typeof Bell
  iconBg: string
  iconColor: string
  items: SwitchItemConfig[]
}

const BROWSER_PUSH_LOCKED = true

const TIMEZONE_OPTIONS = [
  'UTC',
  'Europe/Moscow',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Almaty',
  'Asia/Tashkent',
  'Asia/Bangkok',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function resolveCurrentLocale(locale: string): Locale {
  return locale === 'en' ? 'en' : 'ru'
}

function getPendingEmailValue(user: unknown) {
  if (!isRecord(user)) return null

  if (typeof user.new_email === 'string' && user.new_email) {
    return user.new_email
  }
  if (typeof user.email_change === 'string' && user.email_change) {
    return user.email_change
  }

  return null
}

function stripLocaleFromPath(pathname: string, locale: Locale) {
  if (!pathname.startsWith(`/${locale}`)) {
    return pathname || '/'
  }

  return pathname.slice(`/${locale}`.length) || '/'
}

function formatTimeInZone(locale: Locale, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date())
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(normalized)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

function normalizePushSubscriptionPayload(
  value: PushSubscriptionJSON | null | undefined
): BrowserPushSubscriptionPayload | null {
  if (!value?.endpoint || !value.keys?.p256dh || !value.keys?.auth) {
    return null
  }

  return {
    endpoint: value.endpoint,
    keys: {
      p256dh: value.keys.p256dh,
      auth: value.keys.auth,
    },
  }
}

function normalizeMfaFactorList(value: unknown): MfaFactor[] {
  const candidates: unknown[] = []

  const appendFactors = (items: unknown) => {
    if (!Array.isArray(items)) return
    candidates.push(...items)
  }

  if (Array.isArray(value)) {
    appendFactors(value)
  } else if (isRecord(value)) {
    if (Array.isArray(value.all)) {
      appendFactors(value.all)
    } else if (isRecord(value.all)) {
      Object.values(value.all).forEach(appendFactors)
    }

    // Fallback for SDK responses that expose factor arrays directly on the root object.
    if (candidates.length === 0) {
      Object.entries(value).forEach(([key, entry]) => {
        if (key === 'all') return
        appendFactors(entry)
      })
    }
  }

  const seen = new Set<string>()
  const normalized: MfaFactor[] = []

  for (const item of candidates) {
    if (!isRecord(item)) continue

    const id = typeof item.id === 'string' ? item.id : null
    const factorType =
      typeof item.factor_type === 'string'
        ? item.factor_type
        : typeof item.factorType === 'string'
          ? item.factorType
          : null
    const status = typeof item.status === 'string' ? item.status.toLowerCase() : null

    if (!id || !factorType || !status || seen.has(id)) continue
    seen.add(id)

    normalized.push({
      id,
      factor_type: factorType.toLowerCase(),
      status,
      friendly_name:
        typeof item.friendly_name === 'string'
          ? item.friendly_name
          : typeof item.friendlyName === 'string'
            ? item.friendlyName
            : undefined,
      created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : undefined,
      last_challenged_at: typeof item.last_challenged_at === 'string' ? item.last_challenged_at : undefined,
    })
  }

  return normalized
}

export default function SettingsPage() {
  const t = useTranslations('dashboard.settings')
  const currentLocale = resolveCurrentLocale(useLocale())
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [isLoadingAccount, setIsLoadingAccount] = useState(true)
  const [isLoadingMfa, setIsLoadingMfa] = useState(true)

  const [currentEmail, setCurrentEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [emailStatus, setEmailStatus] = useState<Notice>(null)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [pushStatus, setPushStatus] = useState<Notice>(null)
  const [isRequestingPushPermission, setIsRequestingPushPermission] = useState(false)
  const [isSendingPushTest, setIsSendingPushTest] = useState(false)

  const [settings, setSettings] = useState<DashboardSettingsState>(() => createDefaultDashboardSettings(currentLocale))
  const [initialSettings, setInitialSettings] = useState<DashboardSettingsState>(() =>
    createDefaultDashboardSettings(currentLocale)
  )
  const [settingsStatus, setSettingsStatus] = useState<Notice>(null)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<Notice>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([])
  const [mfaStatus, setMfaStatus] = useState<Notice>(null)
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollmentState | null>(null)
  const [mfaEnrollCode, setMfaEnrollCode] = useState('')
  const [mfaManageCode, setMfaManageCode] = useState('')
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false)
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false)
  const [isDisablingMfa, setIsDisablingMfa] = useState(false)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [dangerStatus, setDangerStatus] = useState<Notice>(null)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const pushPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY || ''

  const hasSettingsChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings)

  const compact = settings.appearance.compactMode
  const verifiedTotpFactors = mfaFactors.filter(
    (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
  )
  const unverifiedTotpFactors = mfaFactors.filter(
    (factor) => factor.factor_type === 'totp' && factor.status === 'unverified'
  )
  const primaryVerifiedTotpFactor = verifiedTotpFactors[0] ?? null
  const syncTwoFactorState = useCallback((enabled: boolean) => {
    setSettings((prev) =>
      prev.security.twoFactorEnabled === enabled
        ? prev
        : {
            ...prev,
            security: {
              ...prev.security,
              twoFactorEnabled: enabled,
            },
          }
    )

    setInitialSettings((prev) =>
      prev.security.twoFactorEnabled === enabled
        ? prev
        : {
            ...prev,
            security: {
              ...prev.security,
              twoFactorEnabled: enabled,
            },
          }
    )
  }, [])

  const loadMfaState = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false

    if (!silent) {
      setIsLoadingMfa(true)
    }

    try {
      const factorsResponse = await supabase.auth.mfa.listFactors()

      if (factorsResponse.error) {
        throw factorsResponse.error
      }

      const factors = normalizeMfaFactorList(factorsResponse.data)
      const hasVerifiedTotp = factors.some(
        (factor) => factor.factor_type === 'totp' && factor.status === 'verified'
      )

      setMfaFactors(factors)
      syncTwoFactorState(hasVerifiedTotp)
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaLoadError') })
    } finally {
      if (!silent) {
        setIsLoadingMfa(false)
      }
    }
  }, [supabase, syncTwoFactorState, t])

  useEffect(() => {
    let isMounted = true

    const loadAccountAndSettings = async () => {
      setIsLoadingAccount(true)
      setEmailStatus(null)
      setSettingsStatus(null)

      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error

        const user = data.user
        if (!user) throw new Error('User not found')

        if (!isMounted) return

        const email = user.email || ''
        const parsedSettings = parseDashboardSettings(user.user_metadata, currentLocale)

        setCurrentEmail(email)
        setNewEmail(email)
        setPendingEmail(getPendingEmailValue(user))
        setSettings(parsedSettings)
        setInitialSettings(parsedSettings)

        // Load actual MFA state after account data so 2FA reflects real factors.
        void loadMfaState()
      } catch {
        if (!isMounted) return
        setEmailStatus({ type: 'error', text: t('emailLoadError') })
        setSettingsStatus({ type: 'error', text: t('settingsLoadError') })
        setIsLoadingMfa(false)
      } finally {
        if (isMounted) {
          setIsLoadingAccount(false)
        }
      }
    }

    void loadAccountAndSettings()

    return () => {
      isMounted = false
    }
  }, [currentLocale, loadMfaState, supabase, t])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncPermission = () => {
      if (
        !('Notification' in window)
        || typeof navigator === 'undefined'
        || !('serviceWorker' in navigator)
        || !('PushManager' in window)
        || !pushPublicKey
      ) {
        setPushPermission('unsupported')
        return
      }

      setPushPermission(window.Notification.permission)
    }

    syncPermission()
    window.addEventListener('focus', syncPermission)

    return () => {
      window.removeEventListener('focus', syncPermission)
    }
  }, [pushPublicKey])

  const languageOptions: Array<{ value: Locale; label: string }> = [
    { value: 'ru', label: t('languageRu') },
    { value: 'en', label: t('languageEn') },
  ]

  const selectedLanguageLabel =
    languageOptions.find((option) => option.value === settings.preferences.language)?.label ||
    settings.preferences.language

  const selectedTimezoneLabel = settings.preferences.timezone
  const timezonePreview = formatTimeInZone(currentLocale, settings.preferences.timezone)
  const switchSections: SwitchSectionConfig[] = [
    {
      key: 'notifications',
      title: t('notifications'),
      description: t('notificationsDesc'),
      icon: Bell,
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      items: [
        {
          key: 'emailNotifications',
          label: t('emailNotif'),
          description: t('emailNotifDesc'),
        },
        {
          key: 'pushNotifications',
          label: t('pushNotif'),
          description: t('pushNotifDesc'),
        },
        {
          key: 'weeklyDigest',
          label: t('weeklyDigest'),
          description: t('weeklyDigestDesc'),
        },
        {
          key: 'monthlyDigest',
          label: t('monthlyDigest'),
          description: t('monthlyDigestDesc'),
        },
        {
          key: 'anomalyEmails',
          label: t('anomalyEmails'),
          description: t('anomalyEmailsDesc'),
        },
      ],
    },
    {
      key: 'security',
      title: t('security'),
      description: t('securityDesc'),
      icon: Shield,
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      items: [
        {
          key: 'twoFactorEnabled',
          label: t('twoFactor'),
          description: t('mfaManagedInCard'),
        },
        {
          key: 'loginAlerts',
          label: t('loginAlerts'),
          description: t('loginAlertsDesc'),
        },
      ],
    },
  ]

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const getSwitchValue = (sectionKey: SettingsSectionKey, itemKey: SwitchSettingKey) => {
    if (sectionKey === 'notifications') {
      return settings.notifications[itemKey as NotificationSettingKey]
    }
    if (sectionKey === 'security') {
      return settings.security[itemKey as SecuritySettingKey]
    }
    return settings.appearance[itemKey as AppearanceSettingKey]
  }

  const updateSwitchSetting = (
    sectionKey: SettingsSectionKey,
    itemKey: SwitchSettingKey,
    checked: boolean
  ) => {
    setSettingsStatus(null)
    setSettings((prev) => {
      if (sectionKey === 'notifications') {
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            [itemKey as NotificationSettingKey]: checked,
          },
        }
      }

      if (sectionKey === 'security') {
        return {
          ...prev,
          security: {
            ...prev.security,
            [itemKey as SecuritySettingKey]: checked,
          },
        }
      }

      return {
        ...prev,
        appearance: {
          ...prev.appearance,
          [itemKey as AppearanceSettingKey]: checked,
        },
      }
    })
  }

  const ensurePushPermission = useCallback(async () => {
    if (
      typeof window === 'undefined'
      || !('Notification' in window)
      || typeof navigator === 'undefined'
      || !('serviceWorker' in navigator)
      || !('PushManager' in window)
      || !pushPublicKey
    ) {
      setPushPermission('unsupported')
      setPushStatus({ type: 'error', text: t('pushUnsupported') })
      return false
    }

    let permission = window.Notification.permission
    setPushPermission(permission)

    if (permission === 'granted') {
      return true
    }

    setIsRequestingPushPermission(true)

    try {
      permission = await window.Notification.requestPermission()
      setPushPermission(permission)

      if (permission !== 'granted') {
        setPushStatus({ type: 'error', text: t('pushPermissionDenied') })
        return false
      }

      setPushStatus({ type: 'success', text: t('pushPermissionGranted') })
      return true
    } catch {
      setPushStatus({ type: 'error', text: t('pushPermissionError') })
      return false
    } finally {
      setIsRequestingPushPermission(false)
    }
  }, [pushPublicKey, t])

  const registerPushServiceWorker = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      throw new Error('Service worker is not supported')
    }

    const registration = await navigator.serviceWorker.register('/push-sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    await navigator.serviceWorker.ready
    return registration
  }, [])

  const savePushSubscription = useCallback(async (subscription: BrowserPushSubscriptionPayload) => {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locale: currentLocale,
        subscription,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      throw new Error(String(payload?.error || 'Failed to save push subscription'))
    }
  }, [currentLocale])

  const removePushSubscriptionFromServer = useCallback(async (endpoint: string) => {
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) {
      throw new Error(String(payload?.error || 'Failed to remove push subscription'))
    }
  }, [])

  const ensureBrowserPushSubscription = useCallback(async (persistToServer = true) => {
    const granted = await ensurePushPermission()
    if (!granted) return null

    const registration = await registerPushServiceWorker()
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushPublicKey),
      })
    }

    const normalized = normalizePushSubscriptionPayload(subscription.toJSON())
    if (!normalized) {
      throw new Error('Invalid push subscription payload')
    }

    if (persistToServer) {
      await savePushSubscription(normalized)
    }

    return normalized
  }, [ensurePushPermission, pushPublicKey, registerPushServiceWorker, savePushSubscription])

  const disableBrowserPushSubscription = useCallback(async () => {
    const registration = await registerPushServiceWorker()
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      return
    }

    const normalized = normalizePushSubscriptionPayload(subscription.toJSON())
    await subscription.unsubscribe().catch(() => undefined)

    if (normalized) {
      await removePushSubscriptionFromServer(normalized.endpoint)
    }
  }, [registerPushServiceWorker, removePushSubscriptionFromServer])

  useEffect(() => {
    if (isLoadingAccount) return
    if (BROWSER_PUSH_LOCKED) return
    if (!settings.notifications.pushNotifications) return
    if (pushPermission !== 'granted') return

    void ensureBrowserPushSubscription(true).catch(() => undefined)
  }, [ensureBrowserPushSubscription, isLoadingAccount, pushPermission, settings.notifications.pushNotifications])

  const handleSwitchChange = async (
    sectionKey: SettingsSectionKey,
    itemKey: SwitchSettingKey,
    nextChecked: boolean
  ) => {
    if (sectionKey === 'security' && itemKey === 'twoFactorEnabled') {
      setMfaStatus({ type: 'info', text: t('mfaManagedInCard') })
      return
    }

    if (sectionKey === 'notifications' && itemKey === 'pushNotifications' && BROWSER_PUSH_LOCKED) {
      setPushStatus({ type: 'info', text: t('pushComingSoon') })
      return
    }

    if (sectionKey === 'notifications' && itemKey === 'pushNotifications') {
      if (nextChecked) {
        try {
          const subscription = await ensureBrowserPushSubscription(true)
          if (!subscription) {
            updateSwitchSetting(sectionKey, itemKey, false)
            return
          }
          setPushStatus({ type: 'success', text: t('pushSubscriptionReady') })
        } catch {
          setPushStatus({ type: 'error', text: t('pushSubscriptionError') })
          updateSwitchSetting(sectionKey, itemKey, false)
          return
        }
      }

      if (!nextChecked) {
        try {
          await disableBrowserPushSubscription()
        } catch {
          setPushStatus({ type: 'error', text: t('pushSubscriptionError') })
          return
        }
        setPushStatus({ type: 'info', text: t('pushDisabledInfo') })
      }
    }

    updateSwitchSetting(sectionKey, itemKey, nextChecked)
  }

  const handleSendPushTest = async () => {
    if (isSendingPushTest) return
    if (BROWSER_PUSH_LOCKED) {
      setPushStatus({ type: 'info', text: t('pushComingSoon') })
      return
    }

    setPushStatus(null)
    setIsSendingPushTest(true)

    try {
      const subscription = await ensureBrowserPushSubscription(settings.notifications.pushNotifications)
      if (!subscription) {
        return
      }

      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: currentLocale,
          subscription,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(String(payload?.error || 'Failed to send push test'))
      }

      setPushStatus({ type: 'success', text: t('pushTestSent') })
    } catch {
      setPushStatus({ type: 'error', text: t('pushTestError') })
    } finally {
      setIsSendingPushTest(false)
    }
  }

  const handleCopyText = async (text: string, successMessage: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }

      await navigator.clipboard.writeText(text)
      setMfaStatus({ type: 'success', text: successMessage })
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaCopyError') })
    }
  }

  const handleStartMfaEnrollment = async () => {
    if (isEnrollingMfa || isVerifyingMfa) return

    setMfaStatus(null)
    setIsEnrollingMfa(true)

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: t('mfaGoogleAuthenticatorName'),
        issuer: 'CBTooll',
      })

      if (error) throw error
      if (!data || data.type !== 'totp' || !data.totp) {
        throw new Error('Unexpected MFA enroll response')
      }

      setMfaEnrollment({
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
        friendlyName: data.friendly_name || t('mfaGoogleAuthenticatorName'),
      })
      setMfaEnrollCode('')
      setMfaStatus({ type: 'info', text: t('mfaEnrollStarted') })

      await loadMfaState({ silent: true })
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaEnrollError') })
    } finally {
      setIsEnrollingMfa(false)
    }
  }

  const handleCancelPendingMfaEnrollment = async () => {
    if (!mfaEnrollment) return

    setMfaStatus(null)

    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaEnrollment.factorId })
      if (error) {
        throw error
      }
    } catch {
      // Ignore cleanup failure and just clear local state.
    } finally {
      setMfaEnrollment(null)
      setMfaEnrollCode('')
      await loadMfaState({ silent: true })
    }
  }

  const handleVerifyMfaEnrollment = async () => {
    if (!mfaEnrollment || isVerifyingMfa) return

    const code = mfaEnrollCode.trim()
    if (!code) {
      setMfaStatus({ type: 'error', text: t('mfaCodeRequired') })
      return
    }

    setMfaStatus(null)
    setIsVerifyingMfa(true)

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaEnrollment.factorId,
        code,
      })

      if (error) throw error

      setMfaEnrollment(null)
      setMfaEnrollCode('')
      setMfaManageCode('')
      setMfaStatus({ type: 'success', text: t('mfaEnabledSuccess') })
      await loadMfaState({ silent: true })
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaVerifyError') })
    } finally {
      setIsVerifyingMfa(false)
    }
  }

  const handleVerifyMfaSession = async () => {
    if (!primaryVerifiedTotpFactor) return

    const code = mfaManageCode.trim()
    if (!code) {
      setMfaStatus({ type: 'error', text: t('mfaCodeRequired') })
      return
    }

    setMfaStatus(null)
    setIsVerifyingMfa(true)

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: primaryVerifiedTotpFactor.id,
        code,
      })

      if (error) throw error

      setMfaManageCode('')
      setMfaStatus({ type: 'success', text: t('mfaStepUpSuccess') })
      await loadMfaState({ silent: true })
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaStepUpError') })
    } finally {
      setIsVerifyingMfa(false)
    }
  }

  const handleDisableMfa = async () => {
    if (!primaryVerifiedTotpFactor || isDisablingMfa) return

    setMfaStatus(null)
    setIsDisablingMfa(true)

    try {
      let { error } = await supabase.auth.mfa.unenroll({ factorId: primaryVerifiedTotpFactor.id })

      // If the current session isn't AAL2, verify with a current code first and retry.
      if (error) {
        const code = mfaManageCode.trim()
        if (!code) {
          setMfaStatus({ type: 'info', text: t('mfaDisableRequiresCode') })
          return
        }

        const verifyResult = await supabase.auth.mfa.challengeAndVerify({
          factorId: primaryVerifiedTotpFactor.id,
          code,
        })

        if (verifyResult.error) {
          throw verifyResult.error
        }

        const retry = await supabase.auth.mfa.unenroll({ factorId: primaryVerifiedTotpFactor.id })
        error = retry.error
      }

      if (error) throw error

      setMfaManageCode('')
      setMfaStatus({ type: 'success', text: t('mfaDisabledSuccess') })
      await loadMfaState({ silent: true })
    } catch {
      setMfaStatus({ type: 'error', text: t('mfaDisableError') })
    } finally {
      setIsDisablingMfa(false)
    }
  }

  const handleSettingsReset = () => {
    setSettings(initialSettings)
    setSettingsStatus({ type: 'info', text: t('settingsResetInfo') })
  }

  const handleSettingsSave = async () => {
    if (isLoadingAccount || isSavingSettings) return

    setIsSavingSettings(true)
    setSettingsStatus(null)

    const nextSettings: DashboardSettingsState = {
      ...settings,
      security: {
        ...settings.security,
        twoFactorEnabled: verifiedTotpFactors.length > 0,
      },
      preferences: {
        ...settings.preferences,
        timezone: settings.preferences.timezone || 'UTC',
      },
    }

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          dashboard_settings: nextSettings,
        },
      })

      if (error) throw error

      setSettings(nextSettings)
      setInitialSettings(nextSettings)
      setSettingsStatus({ type: 'success', text: t('settingsSaveSuccess') })

      if (nextSettings.preferences.language !== currentLocale) {
        const pathWithoutLocale = stripLocaleFromPath(pathname, currentLocale)
        await setUserLocale(nextSettings.preferences.language)
        router.replace(`/${nextSettings.preferences.language}${pathWithoutLocale}`)
      }
    } catch {
      setSettingsStatus({ type: 'error', text: t('settingsSaveError') })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleEmailUpdate = async () => {
    if (isLoadingAccount || isUpdatingEmail) return

    const nextEmail = newEmail.trim()

    if (!nextEmail) {
      setEmailStatus({ type: 'error', text: t('emailEmptyError') })
      return
    }

    if (nextEmail === currentEmail && !pendingEmail) {
      setEmailStatus({ type: 'info', text: t('emailNoChanges') })
      return
    }

    setIsUpdatingEmail(true)
    setEmailStatus(null)

    try {
      const { data, error } = await supabase.auth.updateUser({ email: nextEmail })
      if (error) throw error

      const updatedUser = data.user
      if (!updatedUser) throw new Error('User not found')

      const updatedEmail = updatedUser.email || currentEmail
      const nextPendingEmail =
        getPendingEmailValue(updatedUser) || (updatedEmail === currentEmail ? nextEmail : null)

      if (updatedEmail && updatedEmail !== currentEmail) {
        setCurrentEmail(updatedEmail)
        await supabase.from('profiles').update({ email: updatedEmail } as never).eq('id', updatedUser.id)
      }

      setPendingEmail(nextPendingEmail)
      setEmailStatus({
        type: nextPendingEmail ? 'info' : 'success',
        text: nextPendingEmail ? t('emailUpdatePending') : t('emailUpdateSuccess'),
      })
    } catch {
      setEmailStatus({ type: 'error', text: t('emailUpdateError') })
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (isLoadingAccount || isUpdatingPassword) return

    setPasswordStatus(null)

    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', text: t('passwordTooShort') })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', text: t('passwordMismatch') })
      return
    }

    setIsUpdatingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus({ type: 'success', text: t('passwordUpdateSuccess') })
    } catch {
      setPasswordStatus({ type: 'error', text: t('passwordUpdateError') })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return

    setDangerStatus(null)

    if (deleteConfirmText.trim() !== 'DELETE') {
      setDangerStatus({ type: 'error', text: t('deleteAccountConfirmMismatch') })
      return
    }

    if (!window.confirm(t('deleteAccountConfirm'))) {
      return
    }

    setIsDeletingAccount(true)

    try {
      const result = await deleteCurrentUserAccount()
      if (!result.success) {
        throw new Error(result.error)
      }

      setDangerStatus({ type: 'success', text: t('deleteAccountSuccess') })

      await supabase.auth.signOut()
      router.replace(`/${currentLocale}/auth/login`)
    } catch {
      setDangerStatus({ type: 'error', text: t('deleteAccountError') })
    } finally {
      setIsDeletingAccount(false)
    }
  }

  const renderNotice = (notice: Notice) => {
    if (!notice) return null

    const styles =
      notice.type === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        : notice.type === 'info'
          ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          : 'border-red-500/30 bg-red-500/10 text-red-300'

    return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{notice.text}</div>
  }

  return (
    <div className={`p-6 ${compact ? 'space-y-6' : 'space-y-8'}`}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
        <p className="text-zinc-400">{t('manage')}</p>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 ${compact ? 'gap-4' : 'gap-6'}`}>
        <div className={`${compact ? 'space-y-3' : 'space-y-4'} lg:col-span-1`}>
          <Card className="bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/10 backdrop-blur-sm border-[#24A1DE]/20 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#24A1DE]/20 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
            <CardContent className={compact ? 'relative p-5' : 'relative p-6'}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] flex items-center justify-center mb-4">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{t('quickSettings')}</h3>
              <p className="text-sm text-zinc-400 mb-4">{t('quickSettingsDesc')}</p>
              <Button asChild variant="outline" className="w-full border-white/10 text-zinc-300 hover:bg-white/5 justify-between">
                <Link href={`/${currentLocale}/dashboard/profile`}>
                  {t('changeProfile')}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800">
            <CardContent className={compact ? 'p-3 space-y-2' : 'p-4 space-y-2'}>
              <button
                type="button"
                onClick={() => scrollToSection('password-settings')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
                  <Lock className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{t('changePassword')}</p>
                  <p className="text-xs text-zinc-500">{t('changePasswordDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('mfa-settings')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{t('twoFactor')}</p>
                  <p className="text-xs text-zinc-500">{t('mfaQuickActionDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('danger-zone')}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <div className="p-2 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                  <Shield className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{t('privacy')}</p>
                  <p className="text-xs text-zinc-500">{t('privacyDesc')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>
            </CardContent>
          </Card>
        </div>

        <div className={`${compact ? 'space-y-4' : 'space-y-6'} lg:col-span-2`}>
          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
              <CardTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Mail className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  {t('emailSettings')}
                  <p className="text-sm font-normal text-zinc-500 mt-0.5">{t('emailSettingsDesc')}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${compact ? 'p-4' : 'p-6'} space-y-4`}>
              {renderNotice(emailStatus)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentEmail" className="text-zinc-300">{t('currentEmail')}</Label>
                  <Input
                    id="currentEmail"
                    type="email"
                    value={currentEmail}
                    disabled
                    placeholder={isLoadingAccount ? t('loading') : ''}
                    className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newEmail" className="text-zinc-300">{t('newEmail')}</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    disabled={isLoadingAccount || isUpdatingEmail}
                    placeholder={t('newEmailPlaceholder')}
                    className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] focus:ring-[#24A1DE]/20"
                  />
                </div>
              </div>

              {pendingEmail && (
                <p className="text-sm text-amber-300">
                  {t('pendingEmail')}: <span className="font-medium break-all">{pendingEmail}</span>
                </p>
              )}

              <p className="text-xs text-zinc-500">{t('emailChangeHint')}</p>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleEmailUpdate}
                  disabled={isLoadingAccount || isUpdatingEmail}
                  className="min-w-[180px]"
                >
                  {isUpdatingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUpdatingEmail ? t('saving') : t('updateEmail')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="password-settings" className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden scroll-mt-24">
            <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
              <CardTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <KeyRound className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  {t('passwordSettings')}
                  <p className="text-sm font-normal text-zinc-500 mt-0.5">{t('passwordSettingsDesc')}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${compact ? 'p-4' : 'p-6'} space-y-4`}>
              {renderNotice(passwordStatus)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-zinc-300">{t('newPassword')}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={isLoadingAccount || isUpdatingPassword}
                    placeholder={t('newPasswordPlaceholder')}
                    className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-zinc-300">{t('confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={isLoadingAccount || isUpdatingPassword}
                    placeholder={t('confirmPasswordPlaceholder')}
                    className="bg-zinc-950/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              <p className="text-xs text-zinc-500">{t('passwordChangeHint')}</p>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handlePasswordUpdate}
                  disabled={isLoadingAccount || isUpdatingPassword}
                  className="min-w-[200px]"
                >
                  {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUpdatingPassword ? t('saving') : t('updatePassword')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="mfa-settings" className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden scroll-mt-24">
            <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
              <CardTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  {t('twoFactor')}
                  <p className="text-sm font-normal text-zinc-500 mt-0.5">{t('mfaDesc')}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${compact ? 'p-4' : 'p-6'} space-y-4`}>
              {renderNotice(mfaStatus)}

              {verifiedTotpFactors.length === 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
                  <p className="text-sm font-medium text-white mb-2">{t('mfaHowToTitle')}</p>
                  <ol className="space-y-2 text-sm text-zinc-300">
                    <li className="flex gap-2">
                      <span className="text-zinc-500">1.</span>
                      <span>{t('mfaHowToStep1')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-zinc-500">2.</span>
                      <span>{t('mfaHowToStep2')}</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-zinc-500">3.</span>
                      <span>{t('mfaHowToStep3')}</span>
                    </li>
                  </ol>
                </div>
              )}

              {verifiedTotpFactors.length > 0 && (
                <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {t('mfaGoogleAuthenticatorName')}
                      </p>
                      <p className="text-xs text-zinc-400">{t('mfaEnabledReadyText')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
                    <div className="space-y-2">
                      <Label htmlFor="mfaManageCode" className="text-zinc-300">{t('mfaCurrentCode')}</Label>
                      <Input
                        id="mfaManageCode"
                        inputMode="numeric"
                        value={mfaManageCode}
                        onChange={(event) => setMfaManageCode(event.target.value.replace(/\\D/g, '').slice(0, 6))}
                        disabled={isVerifyingMfa || isDisablingMfa}
                        placeholder={t('mfaCodePlaceholder')}
                        className="bg-zinc-950/50 border-zinc-700 text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleVerifyMfaSession}
                      disabled={isLoadingMfa || isVerifyingMfa || isDisablingMfa}
                      className="border-zinc-700 text-zinc-300"
                    >
                      {isVerifyingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {t('mfaCheckCode')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDisableMfa}
                      disabled={isLoadingMfa || isDisablingMfa || isVerifyingMfa}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      {isDisablingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('mfaDisable')}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500">{t('mfaDisableHintSimple')}</p>
                </div>
              )}

              {verifiedTotpFactors.length === 0 && (
                <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
                  {!mfaEnrollment && (
                    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{t('mfaGoogleAuthenticatorName')}</p>
                        <p className="text-xs text-zinc-500">{t('mfaStartCardHint')}</p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleStartMfaEnrollment}
                        disabled={isLoadingMfa || isEnrollingMfa || isVerifyingMfa}
                        className="min-w-[180px]"
                      >
                        {isEnrollingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                        {t('mfaStartSetupSimple')}
                      </Button>
                    </div>
                  )}

                  {unverifiedTotpFactors.length > 0 && !mfaEnrollment && (
                    <p className="text-xs text-amber-300">{t('mfaPendingFactorDetected')}</p>
                  )}

                  {mfaEnrollment && (
                    <div className="rounded-lg border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-4 space-y-4">
                      <div className="text-sm font-medium text-white">{t('mfaGoogleAuthenticatorName')}</div>

                      <div className="flex flex-col items-center gap-3">
                        <div className="w-full max-w-[260px] aspect-square rounded-lg border border-white/10 bg-white p-2 overflow-hidden">
                          <div
                            role="img"
                            aria-label={t('mfaQrAlt')}
                            className="w-full h-full [&_svg]:w-full [&_svg]:h-full"
                            // Supabase returns trusted SVG markup for TOTP enrollment QR codes.
                            dangerouslySetInnerHTML={{ __html: mfaEnrollment.qrCodeSvg }}
                          />
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs text-zinc-400 text-center">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{t('mfaScanQr')}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-zinc-300">{t('mfaSecret')}</Label>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Input
                            value={mfaEnrollment.secret}
                            readOnly
                            className="bg-zinc-950/50 border-zinc-700 text-white font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCopyText(mfaEnrollment.secret, t('mfaSecretCopied'))}
                            className="border-zinc-700 text-zinc-300"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-zinc-500">{t('mfaSecretHelpText')}</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mfaEnrollCode" className="text-zinc-300">{t('mfaEnterCode')}</Label>
                        <Input
                          id="mfaEnrollCode"
                          inputMode="numeric"
                          value={mfaEnrollCode}
                          onChange={(event) => setMfaEnrollCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={isVerifyingMfa}
                          placeholder={t('mfaCodePlaceholder')}
                          className="bg-zinc-950/50 border-zinc-700 text-white"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          onClick={handleVerifyMfaEnrollment}
                          disabled={isVerifyingMfa}
                          className="sm:flex-1"
                        >
                          {isVerifyingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          {t('mfaConfirmEnableSimple')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelPendingMfaEnrollment}
                          disabled={isVerifyingMfa}
                          className="border-zinc-700 text-zinc-300"
                        >
                          {t('cancel')}
                        </Button>
                      </div>

                      <p className="text-xs text-zinc-500">{t('mfaSetupHintSimple')}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
              <CardTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <BellRing className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{t('pushSettingsTitle')}</span>
                    <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-200">
                      {t('pushSoon')}
                    </span>
                  </div>
                  <p className="text-sm font-normal text-zinc-500 mt-0.5">{t('pushComingSoon')}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${compact ? 'p-4' : 'p-6'} space-y-4 opacity-75`} aria-disabled="true">
              {renderNotice(pushStatus)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{t('pushPermission')}</p>
                  <p className="mt-1 text-sm font-medium text-white">{t('pushSoon')}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{t('pushPreference')}</p>
                  <p className="mt-1 text-sm font-medium text-white">{t('pushSoon')}</p>
                </div>
              </div>

              <p className="text-xs text-zinc-500">{t('pushComingSoon')}</p>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={ensurePushPermission}
                  disabled
                  className="border-zinc-700 text-zinc-300"
                >
                  {isRequestingPushPermission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {t('pushSoon')}
                </Button>
                <Button
                  type="button"
                  onClick={handleSendPushTest}
                  disabled
                  className="min-w-[180px]"
                >
                  {isSendingPushTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                  {t('pushSoon')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
            <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
              <CardTitle className="text-white flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Globe className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  {t('languageRegion')}
                  <p className="text-sm font-normal text-zinc-500 mt-0.5">{t('languageRegionDesc')}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${compact ? 'p-4' : 'p-6'} space-y-4`}>
              {renderNotice(settingsStatus)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">{t('language')}</Label>
                  <Select
                    value={settings.preferences.language}
                    onValueChange={(value) => {
                      const nextLocale = normalizeDashboardSettingsLocale(value, settings.preferences.language)
                      setSettingsStatus(null)
                      setSettings((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, language: nextLocale },
                      }))
                    }}
                  >
                    <SelectTrigger className="w-full bg-zinc-950/50 border-zinc-700 text-white">
                      <span>{selectedLanguageLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">{t('timezone')}</Label>
                  <Select
                    value={settings.preferences.timezone}
                    onValueChange={(value) => {
                      setSettingsStatus(null)
                      setSettings((prev) => ({
                        ...prev,
                        preferences: { ...prev.preferences, timezone: value },
                      }))
                    }}
                  >
                    <SelectTrigger className="w-full bg-zinc-950/50 border-zinc-700 text-white">
                      <span>{selectedTimezoneLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="w-full max-h-64">
                      {TIMEZONE_OPTIONS.map((timeZone) => (
                        <SelectItem key={timeZone} value={timeZone}>
                          {timeZone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {timezonePreview && (
                <p className="text-xs text-zinc-500">
                  {t('timezonePreview')}: <span className="text-zinc-300">{timezonePreview}</span>
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-zinc-500">
                  {hasSettingsChanges ? t('settingsUnsaved') : t('settingsSaved')}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSettingsReset}
                    disabled={isLoadingAccount || isSavingSettings || !hasSettingsChanges}
                    className="border-zinc-700 text-zinc-300 hover:bg-white/5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('resetSettings')}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSettingsSave}
                    disabled={isLoadingAccount || isSavingSettings || !hasSettingsChanges}
                    className="min-w-[160px]"
                  >
                    {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSavingSettings ? t('saving') : t('saveSettings')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {switchSections.map((section) => {
            const Icon = section.icon
            return (
              <Card key={section.key} className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
                <CardHeader className="border-b border-zinc-800 bg-zinc-950/30">
                  <CardTitle className="text-white flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${section.iconBg}`}>
                      <Icon className={`w-5 h-5 ${section.iconColor}`} />
                    </div>
                    <div>
                      {section.title}
                      <p className="text-sm font-normal text-zinc-500 mt-0.5">{section.description}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className={`${compact ? 'p-3' : 'p-4'} space-y-1`}>
                  {section.items.map((item) => {
                    const checked = Boolean(getSwitchValue(section.key, item.key))
                    const isLockedPushToggle = section.key === 'notifications' && item.key === 'pushNotifications'

                    return (
                      <div
                        key={`${section.key}-${String(item.key)}`}
                        className={`flex items-center justify-between gap-4 p-4 rounded-lg transition-colors group ${
                          isLockedPushToggle ? 'opacity-60' : 'hover:bg-white/5'
                        }`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Label className="text-zinc-200 cursor-pointer">{item.label}</Label>
                            {isLockedPushToggle && (
                              <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-200">
                                {t('pushSoon')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            {isLockedPushToggle ? t('pushComingSoon') : item.description}
                          </p>
                        </div>
                        <Switch
                          checked={isLockedPushToggle ? false : checked}
                          onCheckedChange={(nextChecked) => {
                            void handleSwitchChange(section.key, item.key, nextChecked)
                          }}
                          disabled={
                            isLoadingAccount ||
                            isSavingSettings ||
                            isLockedPushToggle ||
                            (section.key === 'security' && item.key === 'twoFactorEnabled')
                          }
                        />
                      </div>
                    )
                  })}

                  {section.key === 'notifications' ? (
                    <div className="flex flex-col gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4">
                      <div>
                        <Label className="text-zinc-200">{t('digestFormat')}</Label>
                        <p className="mt-0.5 text-sm text-zinc-500">{t('digestFormatDesc')}</p>
                      </div>

                      <Select
                        value={settings.notifications.digestFormat}
                        onValueChange={(value) => {
                          const nextFormat = normalizeDashboardDigestFormat(
                            value,
                            settings.notifications.digestFormat as DashboardDigestFormat
                          )
                          setSettingsStatus(null)
                          setSettings((prev) => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              digestFormat: nextFormat,
                            },
                          }))
                        }}
                      >
                        <SelectTrigger className="w-full border-zinc-700 bg-zinc-950/50 text-white">
                          <span>
                            {settings.notifications.digestFormat === 'xlsx'
                              ? t('digestFormatXlsx')
                              : t('digestFormatCsv')}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="w-full">
                          <SelectItem value="xlsx">{t('digestFormatXlsx')}</SelectItem>
                          <SelectItem value="csv">{t('digestFormatCsv')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}

          <Card id="danger-zone" className="bg-gradient-to-r from-red-500/10 to-orange-500/10 backdrop-blur-sm border-red-500/20 overflow-hidden scroll-mt-24">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl translate-x-1/2 -translate-y-1/2" />
            <CardContent className={`${compact ? 'p-5' : 'p-6'} relative space-y-4`}>
              {renderNotice(dangerStatus)}

              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{t('dangerZone')}</h3>
                <p className="text-sm text-zinc-400">{t('dangerZoneDesc')}</p>
              </div>

              <p className="text-xs text-zinc-500">{t('dangerZoneWarning')}</p>

              <div className="space-y-2">
                <Label htmlFor="deleteConfirm" className="text-zinc-300">{t('deleteAccountTypeConfirm')}</Label>
                <Input
                  id="deleteConfirm"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  disabled={isDeletingAccount}
                  placeholder={t('deleteAccountTypePlaceholder')}
                  className="bg-zinc-950/50 border-red-500/20 text-white placeholder:text-zinc-500 focus:border-red-400"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  {isDeletingAccount ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {isDeletingAccount ? t('deletingAccount') : t('deleteAccount')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
