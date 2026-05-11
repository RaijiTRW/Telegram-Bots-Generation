'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Bot as BotIcon, LogIn, Sparkles, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CreateBotModal, EditBotModal, type CreateBotModalData } from '@/components/bot-editor/modals'
import { BotProjectCard } from '@/components/dashboard/bot-project-card'
import { getUserBots, createBotAction, updateBotAction, deleteBotAction } from '@/lib/bot-editor/actions/bots-actions'
import type { Bot } from '@/lib/bot-editor/types/bot.types'
import { prefetchHrefOnce, schedulePrefetchHref } from '@/lib/navigation/prefetch'

export default function BotsPage() {
  const t = useTranslations('dashboard.bots')
  const uiLocale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  // State
  const [bots, setBots] = useState<Bot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMenuForBot, setShowMenuForBot] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Get locale from pathname
  const locale = pathname.split('/')[1] || 'ru'
  const getEditorHref = useCallback(
    (botId: string) => `/${locale}/workspace/bots/${botId}/editor`,
    [locale]
  )
  const getActionErrorMessage = useCallback((error: unknown, fallback: string) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error || '').trim()

    if (!message || message === '[object Object]' || message.includes('An unexpected response was received from the server.')) {
      return fallback
    }

    return message
  }, [])
  const loadBotsFallback = uiLocale === 'ru' ? 'Не удалось загрузить список ботов' : 'Failed to load bots'
  const loadBots = useCallback(async () => {
    try {
      const result = await getUserBots()

      if (result.authenticated) {
        setIsAuthenticated(true)
        setBots(result.bots)
      } else {
        setIsAuthenticated(false)
        setBots([])
      }

      setError(result.error ?? null)
    } catch (error) {
      setIsAuthenticated(false)
      setBots([])
      setError(getActionErrorMessage(error, loadBotsFallback))
    } finally {
      setIsLoading(false)
    }
  }, [getActionErrorMessage, loadBotsFallback])

  // Load bots on mount
  useEffect(() => {
    void loadBots()
  }, [loadBots])

  useEffect(() => {
    for (const bot of bots.slice(0, 3)) {
      schedulePrefetchHref(router, getEditorHref(bot.id))
    }
  }, [bots, getEditorHref, router])

  // Create bot with Server Action
  const handleCreateBot = async (data: CreateBotModalData) => {
    try {
      const result = await createBotAction(data)

      if (result.success && result.bot) {
        setBots(prev => [result.bot, ...prev])
        setShowCreateModal(false)
        setError(null)
        const nextHref = getEditorHref(result.bot.id)
        prefetchHrefOnce(router, nextHref)
        startTransition(() => {
          router.push(nextHref)
        })
      } else {
        setError(result.error || t('errors.create'))
      }
    } catch (error) {
      await loadBots()
      setError(getActionErrorMessage(error, t('errors.create')))
    }
  }

  // Update bot with Server Action
  const handleUpdateBot = async (data: { name: string; description: string }) => {
    if (!selectedBot) return

    try {
      const result = await updateBotAction(selectedBot.id, data)

      if (result.success && result.bot) {
        setBots(prev => prev.map(b => b.id === selectedBot.id ? result.bot! : b))
        setShowEditModal(false)
        setSelectedBot(null)
        setError(null)
      } else {
        setError(result.error || t('errors.update'))
      }
    } catch (error) {
      await loadBots()
      setError(getActionErrorMessage(error, t('errors.update')))
    }
  }

  // Delete bot with Server Action
  const handleDeleteBot = async () => {
    if (!selectedBot) return

    try {
      const result = await deleteBotAction(selectedBot.id)

      if (result.success) {
        setBots(prev => prev.filter(b => b.id !== selectedBot.id))
        setShowEditModal(false)
        setSelectedBot(null)
        setError(null)
      } else {
        setError(result.error || t('errors.delete'))
      }
    } catch (error) {
      await loadBots()
      setError(getActionErrorMessage(error, t('errors.delete')))
    }
  }

  // Navigate to bot editor
  const handleBotClick = (botId: string) => {
    const nextHref = getEditorHref(botId)
    prefetchHrefOnce(router, nextHref)
    startTransition(() => {
      router.push(nextHref)
    })
  }

  // Open edit modal
  const openEditModal = (bot: Bot, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedBot(bot)
    setShowEditModal(true)
    setShowMenuForBot(null)
  }

  return (
    <>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
            <p className="text-zinc-400">{t('manage')}</p>
          </div>
          {bots.length > 0 && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            >
              <Plus className="w-4 h-4" />
              {t('newBot')}
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#24A1DE] animate-spin" />
          </div>
        ) : !isAuthenticated ? (
          /* Not Authenticated State */
          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#24A1DE]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="relative p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 mb-6">
                <LogIn className="w-10 h-10 text-[#24A1DE]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{t('authenticationRequired')}</h3>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                {t('pleaseLogIn')}
              </p>
              <Button
                onClick={() => router.push(`/${locale}/auth/login`)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/90 hover:to-[#8B5CF6]/90 text-white border-0 px-6"
              >
                <LogIn className="w-4 h-4" />
                {t('signIn')}
              </Button>
            </CardContent>
          </Card>
        ) : bots.length === 0 ? (
          /* Empty State */
          <Card className="bg-zinc-900/50 backdrop-blur-sm border-zinc-800 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#24A1DE]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="relative p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 mb-6">
                <BotIcon className="w-10 h-10 text-[#24A1DE]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{t('noBots')}</h3>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                {t('noBotsDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/90 hover:to-[#8B5CF6]/90 text-white border-0 px-6"
                >
                  <Plus className="w-4 h-4" />
                  {t('createFirst')}
                </Button>
                <Button variant="outline" className="border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('viewTemplates')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Bots Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <BotProjectCard
                key={bot.id}
                bot={bot}
                onOpen={() => handleBotClick(bot.id)}
                onPrefetch={() => prefetchHrefOnce(router, getEditorHref(bot.id))}
                trailing={
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenuForBot(showMenuForBot === bot.id ? null : bot.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showMenuForBot === bot.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowMenuForBot(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px]">
                          <button
                            onClick={(e) => openEditModal(bot, e)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            {t('edit')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedBot(bot)
                              setShowEditModal(true)
                              setShowMenuForBot(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('delete')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Bot Modal */}
      <CreateBotModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateBot}
        isLoading={isPending}
      />

      {/* Edit Bot Modal */}
      <EditBotModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedBot(null)
        }}
        onSave={handleUpdateBot}
        onDelete={handleDeleteBot}
        bot={selectedBot}
        isLoading={isPending}
        isDeleting={isPending}
      />
    </>
  )
}
