'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function revealDetailsChain(element: HTMLElement) {
  let current: HTMLElement | null = element
  while (current) {
    if (current.tagName === 'DETAILS') {
      ;(current as HTMLDetailsElement).open = true
    }
    current = current.parentElement
  }
}

function resolveHashTarget(hash: string): HTMLElement | null {
  const id = hash.startsWith('#') ? hash.slice(1) : hash
  if (!id) return null

  const direct = document.getElementById(id)
  if (direct) return direct

  try {
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(id)
      : id.replace(/[^a-zA-Z0-9\-_:.]/g, '\\$&')
    return document.querySelector<HTMLElement>(`#${escaped}`)
  } catch {
    return null
  }
}

function focusHashTarget() {
  if (typeof window === 'undefined') return

  const rawHash = String(window.location.hash || '').trim()
  if (!rawHash || rawHash === '#') return

  const decodedHash = decodeURIComponent(rawHash)
  const target = resolveHashTarget(decodedHash)
  if (!target) return

  revealDetailsChain(target)

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
  })

  target.classList.add('ring-2', 'ring-[#24A1DE]/60')
  window.setTimeout(() => {
    target.classList.remove('ring-2', 'ring-[#24A1DE]/60')
  }, 1300)
}

export function DocsHashFocus() {
  const pathname = usePathname()

  useEffect(() => {
    const delays = [0, 120, 260, 520, 900]
    const timers: Array<ReturnType<typeof setTimeout>> = []

    for (const delay of delays) {
      timers.push(setTimeout(() => focusHashTarget(), delay))
    }

    const onHashChange = () => focusHashTarget()
    window.addEventListener('hashchange', onHashChange)

    return () => {
      for (const timer of timers) {
        clearTimeout(timer)
      }
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [pathname])

  return null
}
