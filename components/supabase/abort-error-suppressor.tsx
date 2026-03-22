'use client'

import { useEffect } from 'react'

function isAbortLikeError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false
  const record = reason as { name?: unknown; message?: unknown; code?: unknown }
  const name = String(record.name || '')
  const message = String(record.message || '')
  const code = String(record.code || '')
  return (
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    message.includes('signal is aborted without reason') ||
    message.includes('The operation was aborted') ||
    message.includes('This operation was aborted')
  )
}

export function AbortErrorSuppressor() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (!isAbortLikeError(event.reason)) return
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', handler)
    return () => window.removeEventListener('unhandledrejection', handler)
  }, [])

  return null
}
