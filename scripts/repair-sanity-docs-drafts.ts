import { groq } from 'next-sanity'

import { getSanityWriteClient } from '../lib/sanity/client'
import { sanitizeSanityDocsBlock, type RawSanityDocsBlock } from '../lib/sanity/docs-blocks'

type RawDocsPage = {
  _id: string
  locale?: string
  title?: string
  summary?: string
  isHome?: boolean
  blocks?: RawSanityDocsBlock[]
}

const DOCS_PAGES_QUERY = groq`*[_type == "docsPage"]{
  _id,
  locale,
  title,
  summary,
  "isHome": coalesce(isHome, false),
  blocks
}`

function toCanonicalId(documentId: string) {
  return String(documentId || '').replace(/^drafts\./, '')
}

function getDerivedSummary(blocks: RawSanityDocsBlock[] = []) {
  const paragraph = blocks.find(
    (block): block is RawSanityDocsBlock & { text: string } =>
      block?._type === 'docsParagraph' && typeof block.text === 'string' && block.text.trim().length > 0
  )

  return paragraph?.text.trim() || ''
}

function isLegacyHomeTocList(block: RawSanityDocsBlock | undefined) {
  if (!block || block._type !== 'docsList' || !Array.isArray(block.items) || block.items.length === 0) {
    return false
  }

  return block.items.every((item) => typeof item === 'string' && item.includes(':'))
}

function hasVideoSource(block: RawSanityDocsBlock) {
  const caption = typeof block.caption === 'string' ? block.caption.trim() : ''
  return Boolean(block.asset || block.url || caption)
}

function inferCalloutTitle(block: RawSanityDocsBlock, locale: string, tone: string) {
  const rawText = typeof block.text === 'string' ? block.text.trim() : ''
  const firstLine = rawText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (firstLine) {
    return firstLine.length > 56 ? `${firstLine.slice(0, 56).trim()}...` : firstLine
  }

  if (locale === 'en') {
    if (tone === 'success') return 'What the system does'
    if (tone === 'warning') return 'What to check'
    if (tone === 'danger') return 'Important'
    return 'Note'
  }

  if (tone === 'success') return 'Что делает система'
  if (tone === 'warning') return 'Что проверить'
  if (tone === 'danger') return 'Важно'
  return 'Примечание'
}

function getPublishedMatch(block: RawSanityDocsBlock, index: number, publishedBlocks: RawSanityDocsBlock[]) {
  const byKey = typeof block._key === 'string'
    ? publishedBlocks.find((candidate) => candidate?._key === block._key && candidate?._type === block._type)
    : null

  if (byKey) {
    return byKey
  }

  const byIndex = publishedBlocks[index]
  if (byIndex && byIndex._type === block._type) {
    return byIndex
  }

  return null
}

function repairBlock(
  block: RawSanityDocsBlock,
  index: number,
  page: RawDocsPage,
  publishedBlocks: RawSanityDocsBlock[]
) {
  const nextBlock: RawSanityDocsBlock = { ...block }
  const publishedMatch = getPublishedMatch(block, index, publishedBlocks)
  let changed = false

  if (block._type === 'docsHeading') {
    const publishedLevel = typeof publishedMatch?.level === 'number' ? publishedMatch.level : null
    if (typeof nextBlock.level !== 'number' || nextBlock.level < 1 || nextBlock.level > 6) {
      nextBlock.level = publishedLevel || (index === 0 ? 1 : 2)
      changed = true
    }
  }

  if (block._type === 'docsCallout') {
    const publishedTone = typeof publishedMatch?.tone === 'string' ? publishedMatch.tone : null
    const nextTone =
      typeof nextBlock.tone === 'string' && ['info', 'success', 'warning', 'danger'].includes(nextBlock.tone)
        ? nextBlock.tone
        : publishedTone || 'info'

    if (nextTone !== nextBlock.tone) {
      nextBlock.tone = nextTone
      changed = true
    }

    const publishedTitle = typeof publishedMatch?.title === 'string' ? publishedMatch.title.trim() : ''
    const currentTitle = typeof nextBlock.title === 'string' ? nextBlock.title.trim() : ''
    if (!currentTitle) {
      nextBlock.title = publishedTitle || inferCalloutTitle(nextBlock, page.locale === 'en' ? 'en' : 'ru', nextTone)
      changed = true
    }
  }

  if (block._type === 'docsVideo' && !hasVideoSource(nextBlock)) {
    const publishedCaption = typeof publishedMatch?.caption === 'string' ? publishedMatch.caption.trim() : ''
    nextBlock.caption = publishedCaption || (page.locale === 'en' ? 'Video placeholder' : 'Видео скоро')
    changed = true
  }

  if (block._type === 'docsButton') {
    if (typeof nextBlock.label !== 'string' || !nextBlock.label.trim()) {
      nextBlock.label =
        typeof publishedMatch?.label === 'string' && publishedMatch.label.trim()
          ? publishedMatch.label.trim()
          : page.locale === 'en'
            ? 'Open'
            : 'Открыть'
      changed = true
    }

    if (typeof nextBlock.url !== 'string' || !nextBlock.url.trim()) {
      nextBlock.url =
        typeof publishedMatch?.url === 'string' && publishedMatch.url.trim()
          ? publishedMatch.url.trim()
          : '#'
      changed = true
    }

    if (
      typeof nextBlock.variant !== 'string'
      || !['default', 'outline', 'ghost'].includes(nextBlock.variant)
    ) {
      nextBlock.variant =
        typeof publishedMatch?.variant === 'string' && ['default', 'outline', 'ghost'].includes(publishedMatch.variant)
          ? publishedMatch.variant
          : 'default'
      changed = true
    }
  }

  if (block._type === 'docsCode') {
    if (typeof nextBlock.language !== 'string' || !nextBlock.language.trim()) {
      nextBlock.language =
        typeof publishedMatch?.language === 'string' && publishedMatch.language.trim()
          ? publishedMatch.language.trim()
          : 'text'
      changed = true
    }

    if (typeof nextBlock.code !== 'string' || !nextBlock.code.trim()) {
      nextBlock.code =
        typeof publishedMatch?.code === 'string' && publishedMatch.code.trim()
          ? publishedMatch.code
          : page.locale === 'en'
            ? '// Add code example'
            : '// Добавьте пример кода'
      changed = true
    }
  }

  return {
    block: nextBlock,
    changed,
  }
}

async function main() {
  const sanity = getSanityWriteClient()
  const pages = await sanity.fetch<RawDocsPage[]>(DOCS_PAGES_QUERY)

  const publishedByCanonicalId = new Map<string, RawDocsPage>()
  const drafts = (pages || []).filter((page) => page._id.startsWith('drafts.'))

  for (const page of pages || []) {
    if (!page._id.startsWith('drafts.')) {
      publishedByCanonicalId.set(toCanonicalId(page._id), page)
    }
  }

  let transaction = sanity.transaction()
  let changes = 0

  for (const draft of drafts) {
    const published = publishedByCanonicalId.get(toCanonicalId(draft._id))
    const publishedBlocks = Array.isArray(published?.blocks) ? published.blocks : []
    const originalBlocks = Array.isArray(draft.blocks) ? draft.blocks : []
    const filteredBlocks = draft.isHome
      ? originalBlocks.filter((block) => !isLegacyHomeTocList(block))
      : originalBlocks

    const repairedBlocks = filteredBlocks.map((block, index) => repairBlock(block, index, draft, publishedBlocks))
    const nextBlocks = repairedBlocks.map((entry) => sanitizeSanityDocsBlock(entry.block))
    const blocksChanged = JSON.stringify(originalBlocks) !== JSON.stringify(nextBlocks)

    const currentSummary = typeof draft.summary === 'string' ? draft.summary.trim() : ''
    const nextSummary = currentSummary || getDerivedSummary(nextBlocks)

    if (!blocksChanged && nextSummary === currentSummary) {
      continue
    }

    transaction = transaction.patch(draft._id, {
      set: {
        summary: nextSummary,
        blocks: nextBlocks,
      },
    })
    changes += 1
  }

  if (changes === 0) {
    console.log('Sanity docs drafts are already repaired.')
    return
  }

  const result = await transaction.commit()
  console.log(`Repaired ${changes} Sanity docs draft(s).`)
  console.log(`Transaction results: ${result.results.length}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
