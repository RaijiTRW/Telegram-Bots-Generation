'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logoutFromPendingAccessAction } from '@/app/actions/beta-access'

export function BetaPendingPage({ locale, status }: { locale: string; status: 'beta_pending' | 'rejected' }) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const isEnglish = locale === 'en'
  const isRejected = status === 'rejected'

  const title = isRejected
    ? (isEnglish ? 'Access request was declined' : 'Заявка отклонена')
    : (isEnglish ? 'Your request is under review' : 'Заявка на рассмотрении')
  const description = isRejected
    ? (isEnglish
        ? 'This account does not have access to the product yet. Contact the team if you think this is a mistake.'
        : 'У этого аккаунта пока нет доступа к продукту. Если это ошибка, напишите команде.')
    : (isEnglish
        ? 'We already received your beta request. After approval you will get an email, then you can sign in normally.'
        : 'Мы уже получили вашу заявку на бета-доступ. После одобрения на почту придет письмо, и вы сможете войти как обычно.')

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logoutFromPendingAccessAction()
    router.push(`/${locale}/auth/login`)
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070A] px-4 text-white">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/70 p-8 shadow-2xl shadow-cyan-500/10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#24A1DE]/15 text-[#7dd3fc]">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-base leading-7 text-zinc-300">{description}</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="mt-8 border-white/10 text-zinc-100 hover:bg-white/5"
        >
          {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          {isEnglish ? 'Sign out' : 'Выйти'}
        </Button>
      </div>
    </main>
  )
}
