'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type GuidedTourStep = {
  id: string
  target?: string
  title: string
  body: string
  note?: string
  href?: string
}

interface GuidedTourProps {
  storageKey: string
  steps: GuidedTourStep[]
  isSeen?: boolean | null
  startDelayMs?: number
  onSeen?: () => Promise<void> | void
  labels?: {
    back: string
    next: string
    done: string
    close: string
  }
}

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}

const HIGHLIGHT_PADDING = 10

export function GuidedTour({
  storageKey,
  steps,
  isSeen,
  startDelayMs = 700,
  onSeen,
  labels = {
    back: 'Назад',
    next: 'Продолжить',
    done: 'Готово',
    close: 'Закрыть обучение',
  },
}: GuidedTourProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)

  const safeSteps = useMemo(
    () => steps.filter((step) => step.title.trim() && step.body.trim()),
    [steps]
  )
  const currentStep = safeSteps[currentIndex] ?? null
  const isLastStep = currentIndex >= safeSteps.length - 1

  const completeTour = useCallback(() => {
    if (completedRef.current) {
      setIsOpen(false)
      return
    }

    completedRef.current = true
    try {
      window.localStorage.setItem(storageKey, 'done')
    } catch {
      // Storage can be unavailable in private windows; closing still works.
    }
    setIsOpen(false)
    void onSeen?.()
  }, [onSeen, storageKey])

  const measureTarget = useCallback(() => {
    if (!currentStep?.target) {
      setHighlightRect(null)
      return
    }

    const target = document.querySelector<HTMLElement>(currentStep.target)
    if (!target) {
      setHighlightRect(null)
      return
    }

    target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = window.requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect()
      const paddedLeft = Math.max(8, rect.left - HIGHLIGHT_PADDING)
      const paddedTop = Math.max(8, rect.top - HIGHLIGHT_PADDING)
      const paddedRight = Math.min(window.innerWidth - 8, rect.right + HIGHLIGHT_PADDING)
      const paddedBottom = Math.min(window.innerHeight - 8, rect.bottom + HIGHLIGHT_PADDING)

      setHighlightRect({
        top: paddedTop,
        left: paddedLeft,
        width: Math.max(0, paddedRight - paddedLeft),
        height: Math.max(0, paddedBottom - paddedTop),
      })
    })
  }, [currentStep])

  useEffect(() => {
    if (startedRef.current || safeSteps.length === 0) {
      return
    }

    if (isSeen === null) {
      return
    }

    startedRef.current = true
    const timeoutId = window.setTimeout(() => {
      if (isSeen === true) {
        return
      }

      try {
        if (isSeen === undefined && window.localStorage.getItem(storageKey) === 'done') {
          return
        }
      } catch {
        // If storage is unavailable, show the tour for the current session.
      }
      setIsOpen(true)
    }, startDelayMs)

    return () => window.clearTimeout(timeoutId)
  }, [isSeen, safeSteps.length, startDelayMs, storageKey])

  useEffect(() => {
    if (!isOpen || !currentStep?.href || pathname === currentStep.href) {
      return
    }

    router.push(currentStep.href)
  }, [currentStep?.href, isOpen, pathname, router])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const timeoutId = window.setTimeout(measureTarget, 180)
    return () => window.clearTimeout(timeoutId)
  }, [isOpen, measureTarget, pathname])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const initialMeasureId = window.requestAnimationFrame(measureTarget)
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, true)

    return () => {
      window.cancelAnimationFrame(initialMeasureId)
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget, true)
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isOpen, measureTarget])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        completeTour()
      }
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((index) => Math.max(0, index - 1))
      }
      if (event.key === 'ArrowRight') {
        setCurrentIndex((index) => Math.min(safeSteps.length - 1, index + 1))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [completeTour, isOpen, safeSteps.length])

  if (!isOpen || !currentStep) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[300]">
      {highlightRect ? (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/72 backdrop-blur-[1px]"
            style={{ height: highlightRect.top }}
          />
          <div
            className="absolute left-0 bg-black/72 backdrop-blur-[1px]"
            style={{
              top: highlightRect.top,
              width: highlightRect.left,
              height: highlightRect.height,
            }}
          />
          <div
            className="absolute right-0 bg-black/72 backdrop-blur-[1px]"
            style={{
              top: highlightRect.top,
              left: highlightRect.left + highlightRect.width,
              height: highlightRect.height,
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/72 backdrop-blur-[1px]"
            style={{ top: highlightRect.top + highlightRect.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
      )}

      {highlightRect && (
        <div
          className="pointer-events-none fixed rounded-2xl border border-[#24A1DE] bg-[#24A1DE]/6 shadow-[0_0_38px_rgba(36,161,222,0.42)] transition-all duration-300"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
          }}
        />
      )}

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        className={cn(
          'fixed right-4 top-1/2 w-[min(380px,calc(100vw-2rem))] -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-white shadow-2xl shadow-black/60 backdrop-blur-xl',
          'max-sm:left-4 max-sm:right-4 max-sm:top-auto max-sm:bottom-4 max-sm:w-auto max-sm:translate-y-0'
        )}
      >
        <button
          type="button"
          onClick={completeTour}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
          aria-label={labels.close}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-8">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#7fd6ff]">
            {currentIndex + 1} / {safeSteps.length}
          </div>
          <h2 id="guided-tour-title" className="mt-3 text-xl font-semibold leading-tight">
            {currentStep.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            {currentStep.body}
          </p>
          {currentStep.note ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-zinc-400">
              {currentStep.note}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            {labels.back}
          </Button>

          <Button
            type="button"
            size="sm"
            className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white hover:from-[#24A1DE]/85 hover:to-[#8B5CF6]/85"
            onClick={() => {
              if (isLastStep) {
                completeTour()
                return
              }
              setCurrentIndex((index) => Math.min(safeSteps.length - 1, index + 1))
            }}
          >
            {isLastStep ? (
              <>
                {labels.done}
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                {labels.next}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
