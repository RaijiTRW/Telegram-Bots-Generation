'use client'

import { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BillingNoticeModalProps {
  open: boolean
  title: string
  description: string
  buttonLabel: string
  onClose: () => void
}

export function BillingNoticeModal({
  open,
  title,
  description,
  buttonLabel,
  onClose,
}: BillingNoticeModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label={buttonLabel}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />

      <div className="relative z-[121] w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="text-sm leading-6 text-zinc-300">{description}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
