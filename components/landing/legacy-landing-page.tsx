import dynamic from "next/dynamic";
import { Testimonials } from "@/components/testimonials/testimonials";
import { SeoIntentSection } from "@/components/landing/seo-intent-section";
import { Hero } from "@/components/hero/hero";
import { DeferredSection } from "@/components/performance/deferred-section";
import type { Locale } from "@/app/i18n";

const VisualControl = dynamic(
  () => import("@/components/visual-control/visual-control").then((module) => module.VisualControl),
  {
    loading: () => <SectionPlaceholder />,
  },
);

const BusinessAdvantage = dynamic(
  () => import("@/components/business-advantage/business-advantage").then((module) => module.BusinessAdvantage),
  {
    loading: () => <SectionPlaceholder heightClass="h-[820px] md:h-[760px]" />,
  },
);

const Solutions = dynamic(
  () => import("@/components/solutions/solutions").then((module) => module.Solutions),
  {
    loading: () => <SectionPlaceholder heightClass="h-[700px] md:h-[640px]" />,
  },
);

const LandingPricingSection = dynamic(
  () => import("@/components/billing/landing-pricing-section").then((module) => module.LandingPricingSection),
  {
    loading: () => <SectionPlaceholder heightClass="h-[560px] md:h-[520px]" />,
  },
);

const Monitoring = dynamic(
  () => import("@/components/monitoring/monitoring").then((module) => module.Monitoring),
  {
    loading: () => <SectionPlaceholder />,
  },
);

const LandingFaq = dynamic(
  () => import("@/components/faq/landing-faq").then((module) => module.LandingFaq),
  {
    loading: () => <SectionPlaceholder heightClass="h-[760px] md:h-[720px]" />,
  },
);

function SectionPlaceholder({
  heightClass = "h-[760px] md:h-[820px]",
}: {
  heightClass?: string;
}) {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <div className={`rounded-3xl border border-white/6 bg-white/[0.02] ${heightClass}`} />
      </div>
    </section>
  );
}

export function LegacyLandingPage({ locale }: { locale: Locale }) {
  return (
    <>
      <Hero />
      <SeoIntentSection locale={locale} semanticOnly />
      <DeferredSection
        className="content-visibility-auto"
        placeholder={<SectionPlaceholder heightClass="h-[820px] md:h-[760px]" />}
        rootMargin="1600px 0px"
      >
        <BusinessAdvantage />
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
    </>
  );
}
