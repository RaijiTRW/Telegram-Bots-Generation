import type { Metadata } from 'next';
import { Header } from '@/components/header/header';
import { Footer } from '@/components/footer/footer';
import { LandingViewTracker } from '@/components/analytics/landing-view-tracker';
import { RestaurantLandingPage } from '@/components/landing/restaurant-landing-page';
import { JsonLd } from '@/components/seo/json-ld';
import { getLandingFaqItems } from '@/lib/site/faq-content';
import { toLocale } from '@/lib/site/public-config';
import {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationSchema,
  buildSoftwareApplicationSchema,
  buildWebSiteSchema,
  getHomeMetadata,
} from '@/lib/site/seo';

// The previous general-purpose landing is preserved in
// components/landing/legacy-landing-page.tsx for a quick rollback when needed.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params;
  return getHomeMetadata(toLocale(locale));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params;
  const safeLocale = toLocale(locale);
  const isRu = safeLocale === 'ru';
  const faqItems = getLandingFaqItems(safeLocale);

  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <JsonLd
        data={[
          buildOrganizationSchema(),
          buildWebSiteSchema(safeLocale),
          buildSoftwareApplicationSchema(safeLocale),
          buildFaqSchema(safeLocale, faqItems),
          buildBreadcrumbSchema(safeLocale, [{ name: isRu ? 'Главная' : 'Home', path: '' }]),
        ]}
      />
      <LandingViewTracker />
      <Header />
      <main className="flex-1">
        <RestaurantLandingPage locale={safeLocale} />
      </main>
      <Footer />
    </div>
  );
}
