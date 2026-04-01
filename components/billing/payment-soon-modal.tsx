'use client'

import { useEffect } from 'react'
import { Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaymentSoonModalProps {
  locale: string
  open: boolean
  onClose: () => void
}

export function PaymentSoonModal({
  locale,
  open,
  onClose,
}: PaymentSoonModalProps) {
  const isRu = locale !== 'en'

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
        aria-label={isRu ? 'Закрыть окно' : 'Close modal'}
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
      />

      <div className="relative z-[121] w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
            <Clock3 className="h-6 w-6 text-amber-300" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">
              {isRu ? 'Оплата скоро появится' : 'Payments are coming soon'}
            </h2>
            <p className="text-sm leading-6 text-zinc-300">
              {isRu
                ? 'Онлайн-оплата подписки для этой локали пока не подключена. Сейчас checkout работает только для русской аудитории через YooKassa.'
                : 'Subscription checkout is not enabled for this locale yet. Right now payments are available only for the Russian audience via YooKassa.'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>
            {isRu ? 'Понятно' : 'Got it'}
          </Button>
        </div>
      </div>
    </div>
  )
}
