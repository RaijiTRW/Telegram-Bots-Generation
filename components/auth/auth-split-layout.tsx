'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquareQuote } from 'lucide-react'
import { motion, AnimatePresence } from '@/components/motion-wrapper'
import { CompactLogo } from '@/components/logo'

type AuthTestimonial = {
  quote: string
  name: string
  role: string
}

type AuthStat = {
  value: string
  label: string
}

interface AuthSplitLayoutProps {
  title: string
  subtitle: string
  homeHref: string
  footerLink: {
    label: string
    href: string
    linkLabel: string
    onClick?: () => void
  }
  side: {
    tagline: string
    benefitsTitle: string
    benefits: string[]
    valuesTitle: string
    values: string[]
    resultsTitle: string
    results: string[]
    reviewsTitle: string
    testimonials: AuthTestimonial[]
    stats: AuthStat[]
  }
  children: ReactNode
}

const TESTIMONIAL_ROTATE_MS = 5000
const AVATAR_ACCENTS = [
  'from-[#24A1DE] to-[#3DB7FF]',
  'from-[#8B5CF6] to-[#A97CFF]',
  'from-[#0EA5A4] to-[#2DD4BF]',
]

function getInitials(name: string): string {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'U'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
}

export function AuthSplitLayout({
  title,
  subtitle,
  homeHref,
  footerLink,
  side,
  children,
}: AuthSplitLayoutProps) {
  const testimonials = useMemo(
    () => side.testimonials.filter((item) => item.quote.trim().length > 0),
    [side.testimonials]
  )
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    if (testimonials.length <= 1) {
      return
    }

    const timerId = window.setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, TESTIMONIAL_ROTATE_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [testimonials.length])

  const currentTestimonial =
    testimonials[activeTestimonial] || { quote: '', name: '', role: '' }

  return (
    <div className="relative w-full min-h-screen bg-[#05070A] text-white overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#24A1DE]/20 blur-3xl"
          animate={{ scale: [1, 1.22, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-64 right-0 h-[30rem] w-[30rem] rounded-full bg-[#8B5CF6]/20 blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 grid min-h-screen lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="relative flex items-center px-5 py-6 sm:px-8 md:px-10 lg:px-12 xl:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-[#24A1DE]/10 blur-3xl" />
            <div className="absolute -bottom-20 right-4 h-56 w-56 rounded-full bg-[#8B5CF6]/10 blur-3xl" />
          </div>
          <div className="relative z-10 w-full max-w-xl space-y-4">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 hover:bg-zinc-900 transition-colors"
            >
              <CompactLogo className="h-8 w-10" />
              <span className="text-lg font-semibold text-white">CBTooll</span>
            </Link>

            <div className="max-w-lg">
              <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-white">{title}</h1>
              <p className="mt-2 text-sm md:text-base text-zinc-400">{subtitle}</p>
            </div>

            <div className="max-w-lg rounded-2xl border border-white/10 bg-zinc-900/50 p-4 md:p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              {children}
            </div>

            <p className="text-sm text-zinc-400">
              {footerLink.label}{' '}
              <Link
                href={footerLink.href}
                onClick={
                  footerLink.onClick
                    ? (event) => {
                        event.preventDefault()
                        footerLink.onClick?.()
                      }
                    : undefined
                }
                className="font-medium text-[#5EC8FF] hover:text-[#80d7ff] transition-colors"
              >
                {footerLink.linkLabel}
              </Link>
            </p>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-gradient-to-b from-[#090F1D] via-[#0A1224] to-[#090D19] p-5 md:p-6 lg:border-l lg:border-t-0">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -left-16 top-8 h-40 w-56 rounded-full bg-[#24A1DE]/30 blur-3xl"
                animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -right-20 bottom-16 h-52 w-64 rounded-full bg-[#8B5CF6]/30 blur-3xl"
                animate={{ x: [0, -16, 0], y: [0, 10, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            <div className="relative z-10 space-y-4">
              <div>
                <h2 className="text-lg md:text-xl font-semibold leading-snug">{side.tagline}</h2>
              </div>

              {side.stats.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {side.stats.map((item, index) => (
                    <div
                      key={`${item.label}-${item.value}`}
                      className="rounded-xl border border-white/15 bg-white/[0.05] p-2.5 backdrop-blur-sm"
                    >
                      <div
                        className={`inline-flex rounded-md bg-gradient-to-r px-2 py-0.5 text-[10px] font-semibold text-white ${
                          AVATAR_ACCENTS[index % AVATAR_ACCENTS.length]
                        }`}
                      >
                        KPI
                      </div>
                      <div className="mt-1 text-base md:text-lg font-semibold text-white">{item.value}</div>
                      <div className="mt-0.5 text-[11px] leading-tight text-zinc-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h3 className="text-sm uppercase tracking-wide text-zinc-400">
                  {side.benefitsTitle}
                </h3>
                <ul className="mt-2.5 space-y-2">
                  {side.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-xs md:text-sm text-zinc-200">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5EC8FF]" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                    {side.valuesTitle}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {side.values.map((item) => (
                      <li key={item} className="text-xs md:text-sm text-zinc-200 leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/[0.04] p-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                    {side.resultsTitle}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {side.results.map((item) => (
                      <li key={item} className="text-xs md:text-sm text-zinc-200 leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {testimonials.length > 0 && (
                <div>
                  <h3 className="text-sm uppercase tracking-wide text-zinc-400">
                    {side.reviewsTitle}
                  </h3>
                  <div className="mt-2.5 rounded-2xl border border-white/15 bg-zinc-900/40 p-3">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${activeTestimonial}-${currentTestimonial.name}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[#5EC8FF]">
                            <MessageSquareQuote className="h-4 w-4" />
                            <span className="text-xs font-medium uppercase tracking-wide">
                              {side.reviewsTitle}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            {activeTestimonial + 1}/{testimonials.length}
                          </span>
                        </div>

                        <p className="mt-2.5 text-xs md:text-sm leading-relaxed text-zinc-200 min-h-[52px] max-h-[4.25rem] overflow-hidden">
                          {currentTestimonial.quote}
                        </p>

                        <div className="mt-3 flex items-center gap-2.5">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r text-xs font-semibold text-white ${
                              AVATAR_ACCENTS[activeTestimonial % AVATAR_ACCENTS.length]
                            }`}
                          >
                            {getInitials(currentTestimonial.name)}
                          </div>
                          <div>
                            <div className="text-xs md:text-sm font-medium text-white">
                              {currentTestimonial.name}
                            </div>
                            <div className="text-xs text-zinc-400">{currentTestimonial.role}</div>
                          </div>
                        </div>

                        {testimonials.length > 1 && (
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              key={`bar-${activeTestimonial}`}
                              className="h-full rounded-full bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6]"
                              initial={{ width: '0%' }}
                              animate={{ width: '100%' }}
                              transition={{ duration: TESTIMONIAL_ROTATE_MS / 1000, ease: 'linear' }}
                            />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {testimonials.length > 1 && (
                      <div className="mt-3 flex items-center gap-2">
                        {testimonials.map((item, index) => (
                          <button
                            key={`${item.name}-${index}`}
                            type="button"
                            onClick={() => setActiveTestimonial(index)}
                            className={`h-1.5 rounded-full transition-all ${
                              index === activeTestimonial
                                ? 'w-6 bg-[#5EC8FF]'
                                : 'w-2 bg-zinc-600 hover:bg-zinc-500'
                            }`}
                            aria-label={`Testimonial ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>
      </motion.div>
    </div>
  )
}
