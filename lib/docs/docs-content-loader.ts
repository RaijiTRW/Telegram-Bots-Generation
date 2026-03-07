import { promises as fs } from 'node:fs'
import path from 'node:path'

import { getDocsContent, type DocsContent } from './docs-content'

type OverrideValue = string | string[]
type OverrideMap = Record<string, OverrideValue>

function parseMarkdownOverrides(source: string): OverrideMap {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const sections = new Map<string, string[]>()
  let currentKey: string | null = null

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^##\s+(.+)$/)
    if (headingMatch) {
      currentKey = headingMatch[1].trim()
      sections.set(currentKey, [])
      continue
    }

    if (!currentKey) {
      continue
    }

    sections.get(currentKey)?.push(rawLine)
  }

  const result: OverrideMap = {}

  for (const [key, blockLines] of sections.entries()) {
    const trimmedBlock = blockLines.join('\n').trim()
    if (!trimmedBlock) continue

    const nonEmpty = trimmedBlock
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const isList = nonEmpty.length > 0 && nonEmpty.every((line) => line.startsWith('- '))

    if (isList) {
      result[key] = nonEmpty.map((line) => line.slice(2).trim()).filter(Boolean)
      continue
    }

    const paragraph = trimmedBlock
      .split('\n')
      .map((line) => line.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (paragraph) {
      result[key] = paragraph
    }
  }

  return result
}

function setOverride(content: DocsContent, key: string, value: OverrideValue): void {
  switch (key) {
    case 'hero.description':
      if (typeof value === 'string') content.hero.description = value
      return
    case 'hero.notes':
      if (Array.isArray(value)) content.hero.notes = value
      return
    case 'tocHint':
      if (typeof value === 'string') content.tocHint = value
      return
    case 'learningFlow.description':
      if (typeof value === 'string') content.learningFlow.description = value
      return
    case 'learningFlow.steps':
      if (Array.isArray(value)) content.learningFlow.steps = value
      return
    case 'learningFlow.videoNoteTitle':
      if (typeof value === 'string') content.learningFlow.videoNoteTitle = value
      return
    case 'learningFlow.videoNoteDescription':
      if (typeof value === 'string') content.learningFlow.videoNoteDescription = value
      return
    case 'quickStart.description':
      if (typeof value === 'string') content.quickStart.description = value
      return
    case 'serviceFlow.description':
      if (typeof value === 'string') content.serviceFlow.description = value
      return
    case 'editorAreas.description':
      if (typeof value === 'string') content.editorAreas.description = value
      return
    case 'uiComponents.description':
      if (typeof value === 'string') content.uiComponents.description = value
      return
    case 'nodes.description':
      if (typeof value === 'string') content.nodes.description = value
      return
    case 'keyboardsAndTriggers.description':
      if (typeof value === 'string') content.keyboardsAndTriggers.description = value
      return
    case 'keyboardsAndTriggers.note':
      if (typeof value === 'string') content.keyboardsAndTriggers.note = value
      return
    case 'statistics.description':
      if (typeof value === 'string') content.statistics.description = value
      return
    case 'statistics.note':
      if (typeof value === 'string') content.statistics.note = value
      return
    case 'dataAndSecurity.description':
      if (typeof value === 'string') content.dataAndSecurity.description = value
      return
    case 'testAndDeploy.description':
      if (typeof value === 'string') content.testAndDeploy.description = value
      return
    case 'troubleshooting.description':
      if (typeof value === 'string') content.troubleshooting.description = value
      return
    case 'videoPlan.description':
      if (typeof value === 'string') content.videoPlan.description = value
      return
    default:
      return
  }
}

export async function getDocsContentWithMarkdown(locale: string): Promise<DocsContent> {
  const content = structuredClone(getDocsContent(locale))
  const safeLocale = locale === 'en' ? 'en' : 'ru'
  const filePath = path.join(process.cwd(), 'content', 'docs', safeLocale, 'docs-overrides.md')

  try {
    const file = await fs.readFile(filePath, 'utf8')
    const overrides = parseMarkdownOverrides(file)

    for (const [key, value] of Object.entries(overrides)) {
      setOverride(content, key, value)
    }
  } catch {
    // Fallback to typed defaults if markdown file is missing or invalid.
  }

  return content
}

export { parseMarkdownOverrides }
