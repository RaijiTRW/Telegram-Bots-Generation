'use client'

import { useState } from 'react'
import { X, Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'

interface CreateBotModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (data: { name: string; description: string }) => Promise<void>
  isLoading?: boolean
}

export function CreateBotModal({ isOpen, onClose, onCreate, isLoading = false }: CreateBotModalProps) {
  const t = useTranslations('editor.modals')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await onCreate({ name: name.trim(), description: description.trim() })
    setName('')
    setDescription('')
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
              <Bot className="w-5 h-5 text-[#24A1DE]" />
            </div>
            <h2 className="text-xl font-semibold text-white">{t('createBot')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <Label htmlFor="bot-name" className="text-white mb-2 block">
              {t('botName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('botNamePlaceholder')}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              autoFocus
              maxLength={100}
              required
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('botNameDesc')}
            </p>
          </div>

          <div>
            <Label htmlFor="bot-description" className="text-white mb-2 block">
              {t('description')}
            </Label>
            <Textarea
              id="bot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-zinc-500 mt-1.5">
              {t('descriptionDesc')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="flex-1 gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('createBot')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
