'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Bot as BotIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import type { Bot } from '@/lib/bot-editor/types/bot.types'

interface EditBotModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; description: string }) => Promise<void>
  onDelete?: () => Promise<void>
  bot?: Bot | null
  isLoading?: boolean
  isDeleting?: boolean
}

export function EditBotModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  bot,
  isLoading = false,
  isDeleting = false
}: EditBotModalProps) {
  const t = useTranslations('editor.modals')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (bot) {
      setName(bot.name)
      setDescription(bot.description || '')
    }
  }, [bot])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await onSave({ name: name.trim(), description: description.trim() })
    setShowDeleteConfirm(false)
  }

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete()
      setShowDeleteConfirm(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setShowDeleteConfirm(false)
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
              <BotIcon className="w-5 h-5 text-[#24A1DE]" />
            </div>
            <h2 className="text-xl font-semibold text-white">{t('editBot')}</h2>
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
            <Label htmlFor="edit-bot-name" className="text-white mb-2 block">
              {t('botName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('botNamePlaceholder')}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              autoFocus
              maxLength={100}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-bot-description" className="text-white mb-2 block">
              {t('description')}
            </Label>
            <Textarea
              id="edit-bot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="bg-zinc-800/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-[#24A1DE] resize-none"
              maxLength={500}
            />
          </div>

          {/* Delete Section */}
          {onDelete && (
            <div className="pt-4 border-t border-white/10">
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    {t('deleteConfirm')}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('creating')}
                        </>
                      ) : (
                        t('delete')
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t('delete')}
                </Button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading || isDeleting}
              className="flex-1"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isLoading || isDeleting}
              className="flex-1 gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
