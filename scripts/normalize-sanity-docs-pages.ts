import { groq } from 'next-sanity'

import { getSanityWriteClient } from '../lib/sanity/client'
import { sanitizeSanityDocsBlock, type RawSanityDocsBlock } from '../lib/sanity/docs-blocks'

type RawDocsPage = {
  _id: string
  title?: string
  summary?: string
  isHome?: boolean
  blocks?: RawSanityDocsBlock[]
}

const DOCS_PAGES_QUERY = groq`*[_type == "docsPage"]{
  _id,
  title,
  summary,
  "isHome": coalesce(isHome, false),
  blocks
}`

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

async function main() {
  const sanity = getSanityWriteClient()
  const pages = await sanity.fetch<RawDocsPage[]>(DOCS_PAGES_QUERY)
  let transaction = sanity.transaction()
  let changes = 0

  for (const page of pages || []) {
    const currentSummary = typeof page.summary === 'string' ? page.summary.trim() : ''
    const nextSummary = currentSummary || getDerivedSummary(page.blocks || [])
    const filteredBlocks =
      page.isHome && Array.isArray(page.blocks)
        ? page.blocks.filter((block) => !isLegacyHomeTocList(block))
        : page.blocks || []
    const nextBlocks = filteredBlocks.map((block) => sanitizeSanityDocsBlock(block))

    const summaryChanged = nextSummary !== currentSummary
    const blocksChanged = JSON.stringify(page.blocks || []) !== JSON.stringify(nextBlocks)

    if (!summaryChanged && !blocksChanged) {
      continue
    }

    transaction = transaction.patch(page._id, {
      set: {
        summary: nextSummary,
        blocks: nextBlocks,
      },
    })
    changes += 1
  }

  if (changes === 0) {
    console.log('Sanity docs pages are already normalized.')
    return
  }

  const result = await transaction.commit()
  console.log(`Normalized ${changes} docs page(s) in Sanity.`)
  console.log(`Transaction results: ${result.results.length}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
