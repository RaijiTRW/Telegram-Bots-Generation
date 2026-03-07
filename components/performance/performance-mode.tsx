'use client'

import { useEffect } from 'react'

function shouldUseLiteMode(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const smallViewport = window.matchMedia('(max-width: 1024px)').matches
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 8
  const lowMemory =
    'deviceMemory' in navigator &&
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number' &&
    ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0) <= 8

  return reducedMotion || smallViewport || coarsePointer || lowCores || lowMemory
}

export function PerformanceMode() {
  useEffect(() => {
    const root = document.documentElement

    const apply = () => {
      const lite = shouldUseLiteMode()
      root.setAttribute('data-performance', lite ? 'lite' : 'full')
    }

    apply()

    const onResize = () => apply()
    window.addEventListener('resize', onResize, { passive: true })

    const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onReducedMotionChange = () => apply()
    reducedMotionMql.addEventListener('change', onReducedMotionChange)

    return () => {
      window.removeEventListener('resize', onResize)
      reducedMotionMql.removeEventListener('change', onReducedMotionChange)
    }
  }, [])

  return null
}

