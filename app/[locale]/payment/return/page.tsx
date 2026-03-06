interface PaymentReturnPageProps {
  params: Promise<{ locale: string }>
}

export default async function PaymentReturnPage({ params }: PaymentReturnPageProps) {
  const { locale } = await params
  const isEn = locale === 'en'

  return (
    <main className="min-h-screen bg-[#05070A] text-white px-6 py-14 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center space-y-3">
        <h1 className="text-2xl font-semibold">
          {isEn ? 'Payment window completed' : 'Окно оплаты завершено'}
        </h1>
        <p className="text-zinc-300">
          {isEn
            ? 'You can now return to Telegram and continue with the bot.'
            : 'Теперь можно вернуться в Telegram и продолжить работу с ботом.'}
        </p>
      </div>
    </main>
  )
}
