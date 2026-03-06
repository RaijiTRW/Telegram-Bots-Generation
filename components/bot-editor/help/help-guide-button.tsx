'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { CircleHelp, ExternalLink, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type HelpGuideButtonProps = {
  title: string
  summary: string
  steps?: string[]
  notes?: string[]
  docsHref?: string
  className?: string
  iconClassName?: string
  compact?: boolean
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
  const [open, setOpen] = useState(false)

  const safeSummary = String(summary || '').trim()
  const safeSteps = normalizeList(steps)
  const safeNotes = normalizeList(notes)
  const resolvedDocsHref = resolveDocsHrefWithTopic(docsHref, title)

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
        className={`inline-flex items-center justify-center rounded-full border border-white/20 text-zinc-400 hover:text-white hover:border-white/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]/70 ${compact ? 'h-5 w-5' : 'h-6 w-6'} ${className}`}
      >
        <CircleHelp className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${iconClassName}`} />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
              />

              <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/60">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">{t('modalTag')}</p>
                    <h3 className="text-lg font-semibold text-white mt-1">{title}</h3>
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
                    <p className="text-sm text-zinc-300 leading-relaxed">{safeSummary}</p>
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
                            <span className="leading-relaxed">{step}</span>
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
                            {note}
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
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
