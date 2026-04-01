import { groq } from 'next-sanity'

import { getAllLocalizedHelpGuideSeeds } from '../lib/bot-editor/help/help-guide-bootstrap'
import type { HelpGuideLocale } from '../lib/bot-editor/help/help-guide-types'
import { getSanityWriteClient } from '../lib/sanity/client'

type ExistingHelpGuideRecord = {
  _id: string
  locale?: string
  guideKey?: string
}

const HELP_GUIDES_QUERY = groq`*[_type == "helpGuide"]{
  _id,
  locale,
  guideKey
}`

function toGuideIdentity(locale: string | undefined, guideKey: string | undefined) {
  return `${String(locale || '').trim()}:${String(guideKey || '').trim()}`
}

function toDocumentId(locale: HelpGuideLocale, guideKey: string) {
  const safeKey = guideKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return `helpGuide.${locale}.${safeKey}`
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const sanity = getSanityWriteClient()
  const seeds = getAllLocalizedHelpGuideSeeds()
  const existing = await sanity.fetch<ExistingHelpGuideRecord[]>(HELP_GUIDES_QUERY)
  const existingKeys = new Set((existing || []).map((row) => toGuideIdentity(row.locale, row.guideKey)))

  let transaction = sanity.transaction()
  let created = 0

  for (const seed of seeds) {
    const identity = toGuideIdentity(seed.locale, seed.guideKey)
    if (existingKeys.has(identity)) {
      continue
    }

    const documentId = toDocumentId(seed.locale, seed.guideKey)
    const payload = {
      _id: documentId,
      _type: 'helpGuide',
      locale: seed.locale,
      guideKey: seed.guideKey,
      section: seed.section || 'Editor',
      title: seed.title || seed.guideKey,
      summary: seed.summary || '',
      steps: seed.steps || [],
      notes: seed.notes || [],
    }

    if (!dryRun) {
      transaction = transaction.createIfNotExists(payload)
    }

    created += 1
    console.log(`${dryRun ? 'Would create' : 'Create'} ${seed.locale.toUpperCase()} ${seed.guideKey}`)
  }

  if (created === 0) {
    console.log('Sanity help guides are already in sync.')
    return
  }

  if (dryRun) {
    console.log(`Dry run complete. ${created} help guide(s) would be created.`)
    return
  }

  const result = await transaction.commit()
  console.log(`Created ${created} help guide(s).`)
  console.log(`Transaction results: ${result.results.length}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
