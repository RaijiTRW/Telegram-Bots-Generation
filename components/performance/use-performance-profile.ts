'use client'

import { useEffect, useState } from 'react'
import { readPerformanceMode } from './performance-utils'

export function usePerformanceProfile() {
  const [mode, setMode] = useState<'lite' | 'full'>(() => readPerformanceMode())

  useEffect(() => {
    const apply = () => {
      setMode(readPerformanceMode())
    }

    apply()

    const observer = new MutationObserver(() => {
      apply()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-performance'],
    })

    const handleModeChange = () => {
      apply()
    }

    window.addEventListener('cbtooll:performance-mode-changed', handleModeChange)

    return () => {
      observer.disconnect()
      window.removeEventListener('cbtooll:performance-mode-changed', handleModeChange)
    }
  }, [])

  return {
    mode,
    isLiteMode: mode === 'lite',
    isFullMode: mode === 'full',
  }
}
