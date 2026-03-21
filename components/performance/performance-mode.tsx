'use client'

import { useEffect } from 'react'
import { shouldUseLiteMode } from './performance-utils'

export function PerformanceMode() {
  useEffect(() => {
    const root = document.documentElement
    let currentMode = root.getAttribute('data-performance') === 'lite' ? 'lite' : 'full'
    let rafId = 0

    const apply = () => {
      const lite = shouldUseLiteMode()
      const nextMode = lite ? 'lite' : 'full'

      if (nextMode === currentMode) {
        return
      }

      currentMode = nextMode
      root.setAttribute('data-performance', nextMode)
      window.dispatchEvent(new Event('cbtooll:performance-mode-changed'))
    }

    apply()

    const onResize = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }

      rafId = window.requestAnimationFrame(() => {
        apply()
      })
    }
    window.addEventListener('resize', onResize, { passive: true })

    const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onReducedMotionChange = () => apply()
    reducedMotionMql.addEventListener('change', onReducedMotionChange)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }

      window.removeEventListener('resize', onResize)
      reducedMotionMql.removeEventListener('change', onReducedMotionChange)
    }
  }, [])

  return null
}
