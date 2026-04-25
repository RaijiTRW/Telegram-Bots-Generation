'use client'

import { useEffect } from 'react'

function isAbortLikeError(reason: unknown): boolean {
  if (!reason) return false
  if (typeof reason === 'string') {
    return (
      reason.includes('AbortError') ||
      reason.includes('signal is aborted without reason') ||
      reason.includes('The operation was aborted') ||
      reason.includes('This operation was aborted')
    )
  }
  if (typeof reason !== 'object') return false
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
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      if (!isAbortLikeError(event.reason)) return
      event.preventDefault()
    }

    const errorHandler = (event: ErrorEvent) => {
      if (!isAbortLikeError(event.error) && !isAbortLikeError(event.message)) return
      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', rejectionHandler)
    window.addEventListener('error', errorHandler)
    return () => {
      window.removeEventListener('unhandledrejection', rejectionHandler)
      window.removeEventListener('error', errorHandler)
    }
  }, [])

  return null
}
