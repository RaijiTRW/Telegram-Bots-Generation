export type HelpGuideContent = {
  section?: string
  title?: string
  summary?: string
  steps?: string[]
  notes?: string[]
}

export type HelpGuideMap = Record<string, HelpGuideContent>

export type HelpGuideLocale = 'ru' | 'en'
