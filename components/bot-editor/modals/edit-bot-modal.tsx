'use client'

import { useState } from 'react'
import { X, Loader2, Bot as BotIcon, Trash2, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AnimatePresence, motion } from '@/components/motion-wrapper'
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

type EditBotModalContentProps = Omit<EditBotModalProps, 'isOpen' | 'bot'> & {
  bot: Bot
}

function EditBotModalContent({
  onClose,
  onSave,
  onDelete,
  bot,
  isLoading = false,
  isDeleting = false,
}: EditBotModalContentProps) {
  const t = useTranslations('editor.modals')
  const [name, setName] = useState(bot.name)
  const [description, setDescription] = useState(bot.description || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return

    await onSave({ name: name.trim(), description: description.trim() })
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setShowDeleteConfirm(false)
    await onDelete()
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <motion.div
      key={bot.id}
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      />

      <motion.div
        className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg border border-[#24A1DE]/30 bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 p-2">
              <BotIcon className="h-5 w-5 text-[#24A1DE]" />
            </div>
            <h2 className="truncate text-xl font-semibold text-white">{t('editBot')}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <Label htmlFor="edit-bot-name" className="mb-2 block text-white">
              {t('botName')} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-bot-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('botNamePlaceholder')}
              className="border-white/10 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              autoFocus
              maxLength={100}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-bot-description" className="mb-2 block text-white">
              {t('description')}
            </Label>
            <Textarea
              id="edit-bot-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="resize-none border-white/10 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-[#24A1DE]"
              maxLength={500}
            />
          </div>

          {onDelete ? (
            <div className="border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading || isDeleting}
                className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {t('delete')}
              </Button>
            </div>
          ) : null}

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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {showDeleteConfirm ? (
          <motion.div
            key="edit-bot-delete-confirm"
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteConfirm(false)
                }
              }}
            />
            <motion.div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-950 shadow-2xl"
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="p-6">
                <div className="mb-5 flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-500/30 bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-white">{t('delete')}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {t('deleteConfirm')}
                    </p>
                  </div>
                </div>

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
                    className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('creating')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        {t('delete')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

export function EditBotModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  bot,
  isLoading = false,
  isDeleting = false,
}: EditBotModalProps) {
  return (
    <AnimatePresence>
      {isOpen && bot ? (
        <EditBotModalContent
          key={bot.id}
          bot={bot}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
          isLoading={isLoading}
          isDeleting={isDeleting}
        />
      ) : null}
    </AnimatePresence>
  )
}
