'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Bot as BotIcon, LogIn, Sparkles, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CreateBotModal, EditBotModal } from '@/components/bot-editor/modals'
import { getUserBots, createBotAction, updateBotAction, deleteBotAction } from '@/app/[locale]/dashboard/bots/actions'
import type { Bot, BotStatus } from '@/lib/bot-editor/types/bot.types'
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
    (botId: string) => `/${locale}/dashboard/bots/${botId}/editor/canvas`,
    [locale]
  )
  type BotStatusTranslationKey = `status.${BotStatus}`

  // Load bots on mount
  useEffect(() => {
    startTransition(async () => {
      const result = await getUserBots()
      setIsLoading(false)

      if (result.authenticated) {
        setIsAuthenticated(true)
        setBots(result.bots)
      } else {
        setIsAuthenticated(false)
      }

      if (result.error) {
        setError(result.error)
      }
    })
  }, [])

  useEffect(() => {
    for (const bot of bots.slice(0, 3)) {
      schedulePrefetchHref(router, getEditorHref(bot.id))
    }
  }, [bots, getEditorHref, router])

  // Create bot with Server Action
  const handleCreateBot = async (data: { name: string; description: string }) => {
    const result = await createBotAction(data)

    if (result.success && result.bot) {
      setBots(prev => [result.bot, ...prev])
      setShowCreateModal(false)
      // Navigate to the new bot editor
      const nextHref = getEditorHref(result.bot.id)
      prefetchHrefOnce(router, nextHref)
      startTransition(() => {
        router.push(nextHref)
      })
      // Router will refresh automatically
    } else {
      setError(result.error || t('errors.create'))
    }
  }

  // Update bot with Server Action
  const handleUpdateBot = async (data: { name: string; description: string }) => {
    if (!selectedBot) return

    const result = await updateBotAction(selectedBot.id, data)

    if (result.success && result.bot) {
      setBots(prev => prev.map(b => b.id === selectedBot.id ? result.bot! : b))
      setShowEditModal(false)
      setSelectedBot(null)
      // Router will refresh automatically
    } else {
      setError(result.error || t('errors.update'))
    }
  }

  // Delete bot with Server Action
  const handleDeleteBot = async () => {
    if (!selectedBot) return

    const result = await deleteBotAction(selectedBot.id)

    if (result.success) {
      setBots(prev => prev.filter(b => b.id !== selectedBot.id))
      setShowEditModal(false)
      setSelectedBot(null)
      // Router will refresh automatically
    } else {
      setError(result.error || t('errors.delete'))
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'draft': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
      case 'archived': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
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
              <Card
                key={bot.id}
                onClick={() => handleBotClick(bot.id)}
                onDoubleClick={() => handleBotClick(bot.id)}
                onMouseEnter={() => prefetchHrefOnce(router, getEditorHref(bot.id))}
                onFocus={() => prefetchHrefOnce(router, getEditorHref(bot.id))}
                className="group relative bg-zinc-900/50 backdrop-blur-sm border-zinc-800 hover:border-[#24A1DE]/50 transition-all cursor-pointer overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#24A1DE]/5 to-[#8B5CF6]/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Content */}
                <CardContent className="relative p-5">
                  {/* Header with menu button */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
                      <BotIcon className="w-5 h-5 text-[#24A1DE]" />
                    </div>
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

                      {/* Dropdown Menu */}
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
                  </div>

                  {/* Bot Info */}
                  <h3 className="text-lg font-semibold text-white mb-1 line-clamp-1">
                    {bot.name}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4 line-clamp-2 min-h-[40px]">
                    {bot.description || t('noDescription')}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(bot.status)}`}>
                      {t(`status.${bot.status}` as BotStatusTranslationKey)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {bot.updatedAt
                        ? new Intl.DateTimeFormat(uiLocale, { dateStyle: 'short', timeZone: 'UTC' }).format(
                            new Date(bot.updatedAt)
                          )
                        : t('new')}
                    </span>
                  </div>
                </CardContent>
              </Card>
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
