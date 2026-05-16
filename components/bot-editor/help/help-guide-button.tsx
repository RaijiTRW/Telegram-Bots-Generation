'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { CircleHelp, ExternalLink, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { DocsInlineText } from '@/components/docs/docs-inline-text'
import { useEditorHelpGuides } from '@/components/bot-editor/providers/editor-help-guides-provider'
import { AnimatePresence, motion } from '@/components/motion-wrapper'

type HelpGuideButtonProps = {
  guideKey: string
  title: string
  summary: string
  steps?: string[]
  notes?: string[]
  docsHref?: string
  className?: string
  iconClassName?: string
  compact?: boolean
}

const visualButtonClassPrefixes = [
  'bg-',
  'hover:bg-',
  'active:bg-',
  'focus:bg-',
  'focus-visible:bg-',
  'hover:border-',
  'active:border-',
  'focus:border-',
  'focus-visible:border-',
  'border',
  'shadow',
  'backdrop-',
]

function getIconOnlyClassName(className: string): string {
  return className
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !visualButtonClassPrefixes.some((prefix) => item === prefix || item.startsWith(prefix)))
    .join(' ')
}

function hasSizingClass(className: string, axis: 'h' | 'w'): boolean {
  return className
    .split(/\s+/)
    .some((item) => item === axis || item.startsWith(`${axis}-`))
}

function normalizeList(items?: string[]): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function resolveDocsHrefWithTopic(docsHref: string | undefined, title: string): string | undefined {
  if (!docsHref) return undefined
  if (docsHref.includes('#')) return docsHref

  const href = String(docsHref).trim()
  if (!href) return docsHref

  const lowerHref = href.toLowerCase()
  const lowerTitle = String(title || '').trim().toLowerCase()

  const withHash = (hash: string) => `${href}#${hash}`

  if (lowerHref.includes('/nodes')) {
    if (lowerTitle.includes('yookassa')) return withHash('node-payment-yookassa')
    if (lowerTitle.includes('stripe')) return withHash('node-payment-stripe')
    if (lowerTitle.includes('robokassa')) return withHash('node-payment-robokassa')
    if (lowerTitle.includes('stars')) return withHash('node-payment-stars')
    if (lowerTitle.includes('reply keyboard') || lowerTitle.includes('reply-клав') || lowerTitle.includes('reply клав')) {
      return withHash('node-reply-keyboard-node')
    }
    if (lowerTitle.includes('callback')) return withHash('node-trigger-callback')
    if (lowerTitle.includes('trigger') || lowerTitle.includes('триггер')) return withHash('node-trigger-command')
    if (lowerTitle.includes('message') || lowerTitle.includes('сообщ')) return withHash('node-message')
    if (lowerTitle.includes('input') || lowerTitle.includes('ввод')) return withHash('node-input')
    if (lowerTitle.includes('condition') || lowerTitle.includes('услов')) return withHash('node-condition')
    if (lowerTitle.includes('router') || lowerTitle.includes('switch')) return withHash('node-router')
    if (lowerTitle.includes('scheduler') || lowerTitle.includes('распис') || lowerTitle.includes('таймер')) {
      return withHash('node-date-scheduler')
    }
    if (lowerTitle.includes('action') || lowerTitle.includes('действ')) return withHash('node-action')
    if (lowerTitle.includes('http') || lowerTitle.includes('webhook')) return withHash('node-http')
    if (lowerTitle.includes('script') || lowerTitle.includes('скрипт')) return withHash('node-script')

    return withHash('nodes-reference')
  }

  if (lowerHref.includes('/getting-started')) return withHash('quick-start')
  if (lowerHref.includes('/how-it-works')) return withHash('service-flow')
  if (lowerHref.includes('/keyboards-triggers')) return withHash('keyboards-triggers')
  if (lowerHref.includes('/data-security')) return withHash('data-security')
  if (lowerHref.endsWith('/dashboard/docs') || lowerHref.match(/\/docs\/?$/)) return withHash('learning-flow')

  return docsHref
}

export function HelpGuideButton({
  guideKey,
  title,
  summary,
  steps,
  notes,
  docsHref,
  className = '',
  iconClassName = '',
  compact = true,
}: HelpGuideButtonProps) {
  const t = useTranslations('editor.help')
  const guides = useEditorHelpGuides()
  const [open, setOpen] = useState(false)
  const cmsGuide = guides[guideKey]

  const safeTitle = String(cmsGuide?.title || title || '').trim() || title
  const safeSummary = String(cmsGuide?.summary || summary || '').trim()
  const safeSteps = normalizeList(cmsGuide?.steps?.length ? cmsGuide.steps : steps)
  const safeNotes = normalizeList(cmsGuide?.notes?.length ? cmsGuide.notes : notes)
  const resolvedDocsHref = resolveDocsHrefWithTopic(docsHref, safeTitle)
  const iconOnlyClassName = getIconOnlyClassName(className)
  const defaultSizeClass = `${hasSizingClass(iconOnlyClassName, 'h') ? '' : compact ? 'h-5' : 'h-6'} ${
    hasSizingClass(iconOnlyClassName, 'w') ? '' : compact ? 'w-5' : 'w-6'
  }`

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openGuide')}
        title={t('openGuide')}
        className={`inline-flex items-center justify-center rounded-full bg-transparent p-0 text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]/70 ${defaultSizeClass} ${iconOnlyClassName}`}
      >
        <CircleHelp className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${iconClassName}`} />
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  key="help-guide-modal"
                  className="fixed inset-0 z-[5000] flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <motion.button
                    type="button"
                    className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                    aria-label={t('close')}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  />

                  <motion.div
                    className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/60"
                    initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 14, scale: 0.98, filter: 'blur(8px)' }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-zinc-500">{t('modalTag')}</p>
                        <h3 className="text-lg font-semibold text-white mt-1">{safeTitle}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5"
                        aria-label={t('close')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                      {safeSummary ? (
                        <p className="text-sm text-zinc-300 leading-relaxed">
                          <DocsInlineText text={safeSummary} />
                        </p>
                      ) : null}

                      {safeSteps.length > 0 ? (
                        <div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                            {t('stepsTitle')}
                          </div>
                          <ol className="space-y-2">
                            {safeSteps.map((step, index) => (
                              <li key={`${step}-${index}`} className="text-sm text-zinc-200 flex items-start gap-2">
                                <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#24A1DE]/15 text-[#7dd3fc] text-[11px] font-semibold">
                                  {index + 1}
                                </span>
                                <span className="leading-relaxed">
                                  <DocsInlineText text={step} />
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}

                      {safeNotes.length > 0 ? (
                        <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5">
                          <div className="text-xs uppercase tracking-wide text-amber-200/90 mb-2">
                            {t('notesTitle')}
                          </div>
                          <div className="space-y-1.5">
                            {safeNotes.map((note, index) => (
                              <p key={`${note}-${index}`} className="text-xs text-amber-100/90 leading-relaxed">
                                <DocsInlineText text={note} />
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
                      <div className="text-xs text-zinc-500">{t('footerHint')}</div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setOpen(false)}
                          className="border-white/10"
                        >
                          {t('close')}
                        </Button>
                        {resolvedDocsHref ? (
                          <Button asChild className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/85 hover:to-[#8B5CF6]/85">
                            <Link
                              href={resolvedDocsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t('openDocs')}
                              <ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  )
}
