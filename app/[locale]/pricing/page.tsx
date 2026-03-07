import { Header } from '@/components/header/header'
import { Footer } from '@/components/footer/footer'
import { PublicPricingPageClient } from '@/components/billing/public-pricing-page-client'
import { getAvailableBillingCurrencies } from '@/lib/billing/server'

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const availableCurrencies = getAvailableBillingCurrencies()

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PublicPricingPageClient locale={locale} availableCurrencies={availableCurrencies} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
