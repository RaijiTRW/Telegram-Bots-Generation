interface PaymentReturnPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ source?: string; plan?: string }>
}

export default async function PaymentReturnPage({ params, searchParams }: PaymentReturnPageProps) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const isEn = locale === 'en'
  const isSubscriptionReturn = resolvedSearchParams?.source === 'subscription'
  const planName = String(resolvedSearchParams?.plan || '').trim()

  return (
    <main className="min-h-screen bg-[#05070A] text-white px-6 py-14 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center space-y-3">
        <h1 className="text-2xl font-semibold">
          {isSubscriptionReturn
            ? isEn ? 'Subscription checkout completed' : 'Окно оплаты подписки завершено'
            : isEn ? 'Payment window completed' : 'Окно оплаты завершено'}
        </h1>
        <p className="text-zinc-300">
          {isSubscriptionReturn
            ? isEn
              ? `You can return to the dashboard and check the ${planName || 'selected'} plan status.`
              : `Теперь можно вернуться в дашборд и проверить статус тарифа ${planName || 'после оплаты'}.`
            : isEn
              ? 'You can now return to Telegram and continue with the bot.'
              : 'Теперь можно вернуться в Telegram и продолжить работу с ботом.'}
        </p>
        {isSubscriptionReturn ? (
          <a
            href={`/${locale}/dashboard/subscription`}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] px-5 py-2.5 text-sm font-medium text-white"
          >
            {isEn ? 'Open subscription' : 'Открыть подписку'}
          </a>
        ) : null}
      </div>
    </main>
  )
}
