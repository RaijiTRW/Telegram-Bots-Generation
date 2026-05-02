'use client'

import { Loader2 } from 'lucide-react'
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import type { EditorSection } from '@/lib/bot-editor/types/bot.types'

type EditorSectionComponent = ComponentType
type EditorSectionModule = { default: EditorSectionComponent }

interface EditorSectionViewportProps {
  activeSection: EditorSection
  initialSection: EditorSection
  initialContent: ReactNode
  className?: string
}

const EDITOR_SECTION_ORDER: EditorSection[] = [
  'ai-chat',
  'canvas',
  'system',
  'settings',
  'statistics',
  'ai-agents',
]

const EDITOR_SECTION_LABELS: Record<EditorSection, string> = {
  'ai-chat': 'Business Start',
  'ai-agents': 'AI Agents',
  canvas: 'Advanced Editor',
  system: 'Telegram & Launch',
  statistics: 'Analytics',
  settings: 'Bot',
}

const editorSectionLoaders: Record<EditorSection, () => Promise<EditorSectionModule>> = {
  'ai-chat': () => import('@/components/bot-editor/screens/ai-chat-screen'),
  'ai-agents': () => import('@/components/bot-editor/screens/ai-agents-screen'),
  canvas: () => import('@/components/bot-editor/screens/canvas-screen'),
  system: () => import('@/components/bot-editor/screens/system-screen'),
  statistics: () => import('@/components/bot-editor/screens/statistics-screen'),
  settings: () => import('@/components/bot-editor/screens/settings-screen'),
}

const editorSectionComponentCache = new Map<EditorSection, EditorSectionComponent>()
const editorSectionPromiseCache = new Map<EditorSection, Promise<EditorSectionComponent>>()

function readCachedEditorSection(section: EditorSection) {
  return editorSectionComponentCache.get(section) ?? null
}

export function preloadEditorSection(section: EditorSection): Promise<EditorSectionComponent> {
  const cached = editorSectionComponentCache.get(section)
  if (cached) {
    return Promise.resolve(cached)
  }

  const existingPromise = editorSectionPromiseCache.get(section)
  if (existingPromise) {
    return existingPromise
  }

  const promise = editorSectionLoaders[section]().then((module) => {
    editorSectionComponentCache.set(section, module.default)
    editorSectionPromiseCache.delete(section)
    return module.default
  })

  editorSectionPromiseCache.set(section, promise)
  return promise
}

function EditorSectionFallback({ section }: { section: EditorSection }) {
  return (
    <div className="h-full w-full bg-[#05070A] flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#24A1DE]" />
        <span>{EDITOR_SECTION_LABELS[section]}</span>
      </div>
    </div>
  )
}

export function EditorSectionViewport({
  activeSection,
  initialSection,
  initialContent,
  className,
}: EditorSectionViewportProps) {
  const [stableInitialContent] = useState(initialContent)
  const [visitedSections, rememberVisitedSection] = useReducer(
    (state: EditorSection[], section: EditorSection) => (
      state.includes(section)
        ? state
        : [...state, section]
    ),
    [initialSection]
  )
  const [loadedSections, setLoadedSections] = useState<Partial<Record<EditorSection, EditorSectionComponent>>>(() => {
    const nextState: Partial<Record<EditorSection, EditorSectionComponent>> = {}
    for (const section of EDITOR_SECTION_ORDER) {
      const cached = readCachedEditorSection(section)
      if (cached) {
        nextState[section] = cached
      }
    }
    return nextState
  })

  const loadSection = useCallback(async (section: EditorSection) => {
    if (section === initialSection) {
      return
    }

    const cached = readCachedEditorSection(section)
    if (cached) {
      setLoadedSections((prev) => (prev[section] ? prev : { ...prev, [section]: cached }))
      return
    }

    const LoadedSection = await preloadEditorSection(section)
    setLoadedSections((prev) => (prev[section] ? prev : { ...prev, [section]: LoadedSection }))
  }, [initialSection])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      rememberVisitedSection(activeSection)
      void loadSection(activeSection)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeSection, loadSection])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let cancelled = false
    const preloadRemainingSections = async () => {
      for (const [index, section] of EDITOR_SECTION_ORDER.entries()) {
        if (cancelled) {
          return
        }

        if (section === initialSection) {
          continue
        }

        if (index > 0) {
          await new Promise((resolve) => {
            globalThis.setTimeout(resolve, 160)
          })
        }

        if (cancelled) {
          return
        }

        await loadSection(section)
      }
    }

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        void preloadRemainingSections()
      }, {
        timeout: 420,
      })

      return () => {
        cancelled = true
        window.cancelIdleCallback(idleCallbackId)
      }
    }

    const timeoutId = globalThis.setTimeout(() => {
      void preloadRemainingSections()
    }, 250)

    return () => {
      cancelled = true
      globalThis.clearTimeout(timeoutId)
    }
  }, [initialSection, loadSection])

  return (
    <div className={cn('h-full w-full min-w-0', className)}>
      {visitedSections.map((section) => {
        const isActive = section === activeSection
        const LoadedSection = loadedSections[section]
        const content =
          section === initialSection
            ? stableInitialContent
            : LoadedSection
            ? <LoadedSection />
            : <EditorSectionFallback section={section} />

        return (
          <div
            key={section}
            aria-hidden={!isActive}
            className={cn('h-full w-full min-w-0', isActive ? 'block' : 'hidden')}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
