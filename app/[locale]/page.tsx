import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { Header } from '@/components/header/header';
import { Hero } from '@/components/hero/hero';
import { Footer } from '@/components/footer/footer';
import { LandingViewTracker } from '@/components/analytics/landing-view-tracker';
import { DeferredSection } from '@/components/performance/deferred-section';
import { Testimonials } from '@/components/testimonials/testimonials';
import { SeoIntentSection } from '@/components/landing/seo-intent-section';
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

const Engine = dynamic(
  () => import('@/components/engine/engine').then((module) => module.Engine),
  {
    loading: () => <SectionPlaceholder />,
  }
);

const VisualControl = dynamic(
  () => import('@/components/visual-control/visual-control').then((module) => module.VisualControl),
  {
    loading: () => <SectionPlaceholder />,
  }
);

const Features = dynamic(
  () => import('@/components/features/features').then((module) => module.Features),
  {
    loading: () => <SectionPlaceholder />,
  }
);

const BusinessAdvantage = dynamic(
  () => import('@/components/business-advantage/business-advantage').then((module) => module.BusinessAdvantage),
  {
    loading: () => <SectionPlaceholder heightClass="h-[820px] md:h-[760px]" />,
  }
);

const Solutions = dynamic(
  () => import('@/components/solutions/solutions').then((module) => module.Solutions),
  {
    loading: () => <SectionPlaceholder heightClass="h-[700px] md:h-[640px]" />,
  }
);

const LandingPricingSection = dynamic(
  () => import('@/components/billing/landing-pricing-section').then((module) => module.LandingPricingSection),
  {
    loading: () => <SectionPlaceholder heightClass="h-[560px] md:h-[520px]" />,
  }
);

const Monitoring = dynamic(
  () => import('@/components/monitoring/monitoring').then((module) => module.Monitoring),
  {
    loading: () => <SectionPlaceholder />,
  }
);

const LandingFaq = dynamic(
  () => import('@/components/faq/landing-faq').then((module) => module.LandingFaq),
  {
    loading: () => <SectionPlaceholder heightClass="h-[760px] md:h-[720px]" />,
  }
);

function SectionPlaceholder({
  heightClass = 'h-[760px] md:h-[820px]',
}: {
  heightClass?: string;
}) {
  return (
    <section className="px-4 py-24">
      <div className="max-w-7xl mx-auto">
        <div className={`rounded-3xl border border-white/6 bg-white/[0.02] ${heightClass}`} />
      </div>
    </section>
  );
}

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
        <Hero />
        <SeoIntentSection locale={safeLocale} semanticOnly />
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[820px] md:h-[760px]" />}
          rootMargin="1600px 0px"
        >
          <BusinessAdvantage />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[760px] md:h-[820px]" />}
          rootMargin="1600px 0px"
        >
          <Engine />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[880px] md:h-[860px]" />}
          rootMargin="1600px 0px"
        >
          <VisualControl />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[700px] md:h-[640px]" />}
          rootMargin="1600px 0px"
        >
          <Solutions />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[840px] md:h-[760px]" />}
          rootMargin="1600px 0px"
        >
          <Testimonials />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[960px] md:h-[900px]" />}
          rootMargin="1600px 0px"
        >
          <Features />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[560px] md:h-[520px]" />}
          rootMargin="1600px 0px"
        >
          <LandingPricingSection />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[900px] md:h-[860px]" />}
          rootMargin="1600px 0px"
        >
          <Monitoring />
        </DeferredSection>
        <DeferredSection
          className="content-visibility-auto"
          placeholder={<SectionPlaceholder heightClass="h-[760px] md:h-[720px]" />}
          rootMargin="1600px 0px"
        >
          <LandingFaq />
        </DeferredSection>
        {/* <CTA /> */}
      </main>
      <Footer />
    </div>
  );
}
