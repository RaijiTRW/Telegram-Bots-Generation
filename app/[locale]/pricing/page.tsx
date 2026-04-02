import type { Metadata } from 'next'

import { Header } from '@/components/header/header'
import { Footer } from '@/components/footer/footer'
import { PublicPricingPageClient } from '@/components/billing/public-pricing-page-client'
import { JsonLd } from '@/components/seo/json-ld'
import { SeoFaqSection } from '@/components/site/seo-faq-section'
import { getAvailableBillingCurrencies } from '@/lib/billing/server'
import { getPricingFaqItems } from '@/lib/site/faq-content'
import { toLocale } from '@/lib/site/public-config'
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildSoftwareApplicationSchema,
  buildWebPageSchema,
  getPricingMetadata,
} from '@/lib/site/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return getPricingMetadata(toLocale(locale))
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const safeLocale = toLocale(locale)
  const isRu = safeLocale === 'ru'
  const availableCurrencies = getAvailableBillingCurrencies()
  const faqItems = getPricingFaqItems(safeLocale)

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <JsonLd
        data={[
          buildWebPageSchema(
            safeLocale,
            '/pricing',
            isRu ? 'Цены на конструктор Telegram-ботов | CBTooll' : 'Telegram Bot Builder Pricing | CBTooll',
            isRu
              ? 'Сравните тарифы на создание Telegram-ботов: бесплатный старт, Business и Enterprise для роста.'
              : 'Compare Telegram bot builder plans for a free start, growth, and higher limits.'
          ),
          buildSoftwareApplicationSchema(safeLocale),
          buildFaqSchema(safeLocale, faqItems),
          buildBreadcrumbSchema(safeLocale, [
            { name: isRu ? 'Главная' : 'Home', path: '' },
            { name: isRu ? 'Тарифы' : 'Pricing', path: '/pricing' },
          ]),
        ]}
      />
      <Header />
      <main className="flex-1 pt-28 pb-20">
        <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
          <PublicPricingPageClient locale={locale} availableCurrencies={availableCurrencies} />
          <SeoFaqSection
            title={isRu ? 'Частые вопросы по тарифам' : 'Pricing questions teams ask first'}
            subtitle={
              isRu
                ? 'Короткие ответы для бизнеса, который сравнивает стоимость запуска Telegram-бота, лимиты и состав доступных возможностей.'
                : 'Short answers for teams comparing Telegram bot pricing, plan limits, and the scope of available features.'
            }
            items={faqItems}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
