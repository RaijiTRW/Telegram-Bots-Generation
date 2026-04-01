import Link from 'next/link'

import { syncCardBindingForUser, syncLatestPendingSubscriptionForUser } from '@/lib/billing/service'
import { getServerUser } from '@/lib/supabase/server'

interface PaymentReturnPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ source?: string; plan?: string; billing?: string; tx?: string }>
}

export default async function PaymentReturnPage({ params, searchParams }: PaymentReturnPageProps) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const isEn = locale === 'en'
  const isSubscriptionReturn = resolvedSearchParams?.source === 'subscription'
  const isCardBindingReturn = resolvedSearchParams?.source === 'card-binding'
  const planName = String(resolvedSearchParams?.plan || '').trim()
  const transactionId = String(resolvedSearchParams?.tx || '').trim() || null
  const billingLabel = String(resolvedSearchParams?.billing || '').trim().toLowerCase() === 'year'
    ? (isEn ? 'yearly' : 'годовая')
    : (isEn ? 'monthly' : 'ежемесячная')
  const user = isSubscriptionReturn || isCardBindingReturn ? await getServerUser() : null
  const syncResult = user && isSubscriptionReturn
    ? await syncLatestPendingSubscriptionForUser(user.id)
    : user && isCardBindingReturn
      ? await syncCardBindingForUser(user.id, transactionId)
    : null
  const subscriptionActivated = Boolean(
    syncResult?.status === 'succeeded' &&
    syncResult.subscription.planCode === (planName === 'enterprise' ? 'enterprise' : planName === 'business' ? 'business' : syncResult.subscription.planCode) &&
    syncResult.subscription.status === 'active'
  )
  const cardBound = Boolean(
    isCardBindingReturn &&
    syncResult?.status === 'succeeded' &&
    syncResult.subscription.hasSavedPaymentMethod
  )
  const paymentStillPending = isCardBindingReturn
    ? Boolean(syncResult?.status === 'pending')
    : Boolean(syncResult?.subscription.pendingTransaction?.confirmationUrl)
  const syncError = syncResult && 'error' in syncResult ? syncResult.error : null

  return (
    <main className="min-h-screen bg-[#05070A] text-white px-6 py-14 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-900/70 p-8 text-center space-y-3">
        <h1 className="text-2xl font-semibold">
          {isSubscriptionReturn
            ? isEn ? 'Subscription checkout completed' : 'Окно оплаты подписки завершено'
            : isCardBindingReturn
              ? isEn ? 'Card binding window completed' : 'Окно привязки карты завершено'
            : isEn ? 'Payment window completed' : 'Окно оплаты завершено'}
        </h1>
        <p className="text-zinc-300">
          {isSubscriptionReturn
            ? isEn
              ? `You can return to the dashboard and check the ${planName || 'selected'} plan status.`
              : `Теперь можно вернуться в дашборд и проверить статус тарифа ${planName || 'после оплаты'}.`
            : isCardBindingReturn
              ? isEn
                ? 'You can return to the subscription page and check the saved card status for renewals.'
                : 'Теперь можно вернуться на страницу подписки и проверить статус привязанной карты для автопродления.'
            : isEn
              ? 'You can now return to Telegram and continue with the bot.'
              : 'Теперь можно вернуться в Telegram и продолжить работу с ботом.'}
        </p>
        {isSubscriptionReturn || isCardBindingReturn ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            subscriptionActivated || cardBound
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : paymentStillPending
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                : syncError
                  ? 'border-red-500/30 bg-red-500/10 text-red-100'
                  : 'border-white/10 bg-white/5 text-zinc-200'
          }`}>
            {subscriptionActivated
              ? isEn
                ? `Payment confirmed. ${planName || 'Selected'} (${billingLabel}) is now active.`
                : `Оплата подтверждена. Тариф ${planName || 'выбранный тариф'} (${billingLabel}) уже активирован.`
              : cardBound
                ? isEn
                  ? 'Card saved successfully. The test charge will be refunded by YooKassa.'
                  : 'Карта успешно привязана. Тестовое списание будет возвращено через YooKassa.'
              : paymentStillPending
                ? isEn
                  ? 'The payment window returned, but the provider still reports this payment as pending. Open the subscription page and refresh in a few seconds.'
                  : 'Окно оплаты вернулось, но провайдер всё ещё отдаёт платёж как pending. Откройте страницу подписки и обновите её через несколько секунд.'
                : syncError
                  ? isEn
                    ? 'We could not sync the payment status automatically yet. Open the subscription page and refresh it.'
                    : 'Не удалось автоматически синхронизировать статус платежа. Откройте страницу подписки и обновите её.'
                  : isCardBindingReturn
                    ? isEn
                      ? 'Card binding status has been refreshed.'
                      : 'Статус привязки карты обновлён.'
                    : isEn
                      ? 'Subscription status has been refreshed.'
                      : 'Статус подписки обновлён.'}
          </div>
        ) : null}
        {isSubscriptionReturn || isCardBindingReturn ? (
          <Link
            href={`/${locale}/dashboard/subscription`}
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] px-5 py-2.5 text-sm font-medium text-white"
          >
            {isEn ? 'Open subscription' : 'Открыть подписку'}
          </Link>
        ) : null}
      </div>
    </main>
  )
}
