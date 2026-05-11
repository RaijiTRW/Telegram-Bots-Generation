'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DashboardWorkspaceRedirectProps {
  locale: string
  botIds: string[]
  fallbackBotId: string
  fallbackWorkspaceSection: 'ai-chat' | 'canvas'
  globalSettingsQuery?: string
}

const LAST_BOT_STORAGE_KEY = 'cbtooll:lastBotId'
const LAST_BOT_COOKIE = 'cbtooll:lastBotId'
const LAST_WORKSPACE_MODE_STORAGE_KEY = 'cbtooll:lastWorkspaceMode'
const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'

function persistLastBot(botId: string) {
  try {
    window.localStorage.setItem(LAST_BOT_STORAGE_KEY, botId)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_BOT_COOKIE}=${encodeURIComponent(botId)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

type WorkspaceMode = 'chat' | 'editor' | 'crm'

function normalizeWorkspaceMode(value: string | null | undefined): WorkspaceMode | null {
  return value === 'editor' || value === 'chat' || value === 'crm' ? value : null
}

function getWorkspaceModeStorageKey(botId: string) {
  return `${LAST_WORKSPACE_MODE_STORAGE_KEY}:${botId}`
}

function getWorkspaceSectionForMode(mode: WorkspaceMode) {
  return mode === 'editor' ? 'canvas' : 'ai-chat'
}

function buildWorkspaceHref(locale: string, botId: string, mode: WorkspaceMode, globalSettingsQuery: string) {
  const rawGlobalSettingsQuery = globalSettingsQuery.startsWith('?')
    ? globalSettingsQuery.slice(1)
    : globalSettingsQuery
  const params = new URLSearchParams(rawGlobalSettingsQuery)
  if (mode === 'crm') {
    params.set('workspaceMode', 'crm')
  } else {
    params.delete('workspaceMode')
  }
  const query = params.toString()
  return `/${locale}/workspace/bots/${botId}/editor/${getWorkspaceSectionForMode(mode)}${query ? `?${query}` : ''}`
}

function persistWorkspaceMode(botId: string, mode: WorkspaceMode) {
  try {
    window.localStorage.setItem(getWorkspaceModeStorageKey(botId), mode)
    window.localStorage.setItem(LAST_WORKSPACE_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_WORKSPACE_MODE_COOKIE}=${encodeURIComponent(mode)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

export function DashboardWorkspaceRedirect({
  locale,
  botIds,
  fallbackBotId,
  fallbackWorkspaceSection,
  globalSettingsQuery = '',
}: DashboardWorkspaceRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    let selectedBotId = fallbackBotId
    let workspaceMode: WorkspaceMode = fallbackWorkspaceSection === 'canvas' ? 'editor' : 'chat'

    try {
      const storedBotId = window.localStorage.getItem(LAST_BOT_STORAGE_KEY)
      if (storedBotId && botIds.includes(storedBotId)) {
        selectedBotId = storedBotId
      }

      const storedMode =
        normalizeWorkspaceMode(window.localStorage.getItem(getWorkspaceModeStorageKey(selectedBotId))) ||
        normalizeWorkspaceMode(window.localStorage.getItem(LAST_WORKSPACE_MODE_STORAGE_KEY))
      if (storedMode) {
        workspaceMode = storedMode
      }
    } catch {
      // Keep the server-selected fallback.
    }

    persistLastBot(selectedBotId)
    persistWorkspaceMode(selectedBotId, workspaceMode)
    router.replace(buildWorkspaceHref(locale, selectedBotId, workspaceMode, globalSettingsQuery))
  }, [botIds, fallbackBotId, fallbackWorkspaceSection, globalSettingsQuery, locale, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070A] px-6 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-zinc-300 shadow-2xl shadow-black/30">
        {locale === 'en' ? 'Opening your AI workspace...' : 'Открываем AI-воркспейс...'}
      </div>
    </div>
  )
}
