'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bot, MessageSquareText, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateBotModal, type CreateBotModalData } from '@/components/bot-editor/modals'
import { createBotAction } from '@/lib/bot-editor/actions/bots-actions'

const LAST_BOT_STORAGE_KEY = 'cbtooll:lastBotId'
const LAST_BOT_COOKIE = 'cbtooll:lastBotId'
const LAST_WORKSPACE_MODE_STORAGE_KEY = 'cbtooll:lastWorkspaceMode'
const LAST_WORKSPACE_MODE_COOKIE = 'cbtooll:lastWorkspaceMode'

function persistLastBot(botId: string) {
  try {
    window.localStorage.setItem(LAST_BOT_STORAGE_KEY, botId)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_BOT_COOKIE}=${encodeURIComponent(botId)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

function persistWorkspaceMode(botId: string, mode: 'chat' | 'editor') {
  try {
    window.localStorage.setItem(`${LAST_WORKSPACE_MODE_STORAGE_KEY}:${botId}`, mode)
    window.localStorage.setItem(LAST_WORKSPACE_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore unavailable browser storage.
  }

  document.cookie = `${LAST_WORKSPACE_MODE_COOKIE}=${encodeURIComponent(mode)}; Max-Age=31536000; Path=/; SameSite=Lax`
}

export function DashboardWorkspaceEmpty() {
  const locale = useLocale()
  const router = useRouter()
  const isRu = locale !== 'en'
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async (data: CreateBotModalData) => {
    setError(null)
    setIsCreating(true)
    const result = await createBotAction(data)

    if (!result.success || !result.bot) {
      setError(result.error || (isRu ? 'Не удалось создать бота' : 'Failed to create bot'))
      setIsCreating(false)
      return
    }

    persistLastBot(result.bot.id)
    persistWorkspaceMode(result.bot.id, 'chat')
    setIsCreateOpen(false)
    router.replace(`/${locale}/workspace/bots/${result.bot.id}/editor/ai-chat`)
  }

  return (
    <>
      <main className="relative flex min-h-screen overflow-hidden bg-[#05070A] px-5 py-6 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(36,161,222,0.16),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(139,92,246,0.14),transparent_36%)]" />
        <div className="relative mx-auto flex w-full max-w-5xl flex-col justify-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-zinc-300">
              <Sparkles className="h-4 w-4 text-[#8ED8FF]" />
              {isRu ? 'Ресторанный AI-workspace' : 'Restaurant AI workspace'}
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-6xl">
              {isRu ? 'Какой бот нужен ресторану?' : 'What bot does your restaurant need?'}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              {isRu
                ? 'Выберите шаблон: меню, бронирование, доставка, акции или ответы на вопросы. После создания сразу откроется чат с AI для сборки сценария.'
                : 'Choose a template: menu, booking, delivery, promotions, or FAQ. After creation, the AI chat opens immediately to build the flow.'}
            </p>
            {error ? (
              <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="gap-2 bg-[#24A1DE] text-white hover:bg-[#1B8FC6]"
                onClick={() => setIsCreateOpen(true)}
                disabled={isCreating}
              >
                <Plus className="h-4 w-4" />
                {isRu ? 'Выбрать шаблон' : 'Choose template'}
              </Button>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-400">
                <MessageSquareText className="h-4 w-4 text-zinc-300" />
                {isRu ? 'Следующий экран сразу откроет AI-чат' : 'Next screen opens the AI chat'}
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-3 sm:grid-cols-3">
            {[
              isRu ? 'Меню и цены' : 'Menu and prices',
              isRu ? 'Бронь, доставка и заявки' : 'Booking, delivery, and leads',
              isRu ? 'FAQ, акции и адрес' : 'FAQ, promos, and address',
            ].map((label, index) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-[#8ED8FF]">
                  {index === 0 ? <Bot className="h-4 w-4" /> : <span className="text-sm font-semibold">{index + 1}</span>}
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>
      </main>

      <CreateBotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
        isLoading={isCreating}
      />
    </>
  )
}
