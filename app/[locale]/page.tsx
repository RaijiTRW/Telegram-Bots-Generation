import dynamic from 'next/dynamic';
import { Header } from '@/components/header/header';
import { Hero } from '@/components/hero/hero';
import { Footer } from '@/components/footer/footer';
import { LandingViewTracker } from '@/components/analytics/landing-view-tracker';
import { DeferredSection } from '@/components/performance/deferred-section';
import { Testimonials } from '@/components/testimonials/testimonials';

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

const Monitoring = dynamic(
  () => import('@/components/monitoring/monitoring').then((module) => module.Monitoring),
  {
    loading: () => <SectionPlaceholder />,
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

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <LandingViewTracker />
      <Header />
      <main className="flex-1">
        <Hero />
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
          placeholder={<SectionPlaceholder heightClass="h-[900px] md:h-[860px]" />}
          rootMargin="1600px 0px"
        >
          <Monitoring />
        </DeferredSection>
        {/* <CTA /> */}
      </main>
      <Footer />
    </div>
  );
}
