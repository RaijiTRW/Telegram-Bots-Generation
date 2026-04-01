'use client'

import { createContext, useContext } from 'react'

import type { HelpGuideMap } from '@/lib/bot-editor/help/help-guide-types'

const EditorHelpGuidesContext = createContext<HelpGuideMap>({})

export function EditorHelpGuidesProvider({
  children,
  guides,
}: {
  children: React.ReactNode
  guides: HelpGuideMap
}) {
  return (
    <EditorHelpGuidesContext.Provider value={guides}>
      {children}
    </EditorHelpGuidesContext.Provider>
  )
}

export function useEditorHelpGuides() {
  return useContext(EditorHelpGuidesContext)
}
