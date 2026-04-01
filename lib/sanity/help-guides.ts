import { groq } from 'next-sanity'

import type { HelpGuideMap, HelpGuideLocale } from '@/lib/bot-editor/help/help-guide-types'
import { hasSanityEnv } from '@/lib/sanity/config'
import { getSanityReadClient } from '@/lib/sanity/client'

type SanityHelpGuideRecord = {
  guideKey?: string
  section?: string
  title?: string
  summary?: string
  steps?: string[]
  notes?: string[]
}

const HELP_GUIDES_QUERY = groq`*[_type == "helpGuide" && locale == $locale] | order(section asc, guideKey asc) {
  guideKey,
  section,
  title,
  summary,
  "steps": coalesce(steps, []),
  "notes": coalesce(notes, [])
}`

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) return undefined

  const next = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)

  return next.length > 0 ? next : undefined
}

export async function getPublishedSanityHelpGuideMap(locale: HelpGuideLocale): Promise<HelpGuideMap> {
  if (!hasSanityEnv()) {
    return {}
  }

  const sanity = getSanityReadClient()
  const rows = await sanity.fetch<SanityHelpGuideRecord[]>(HELP_GUIDES_QUERY, { locale })

  return (rows || []).reduce<HelpGuideMap>((accumulator, row) => {
    const guideKey = normalizeText(row?.guideKey)
    if (!guideKey) {
      return accumulator
    }

    accumulator[guideKey] = {
      section: normalizeText(row?.section),
      title: normalizeText(row?.title),
      summary: normalizeText(row?.summary),
      steps: normalizeList(row?.steps),
      notes: normalizeList(row?.notes),
    }

    return accumulator
  }, {})
}
