import { Header } from '@/components/header/header';
import { Hero } from '@/components/hero/hero';
import { Engine } from '@/components/engine/engine';
import { VisualControl } from '@/components/visual-control/visual-control';
import { Features } from '@/components/features/features';
import { Monitoring } from '@/components/monitoring/monitoring';
import { CTA } from '@/components/cta/cta';
import { Footer } from '@/components/footer/footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col text-white bg-[#05070A]">
      <Header />
      <main className="flex-1">
        <Hero />
        <Engine />
        <VisualControl />
        <Features />
        <Monitoring />
        {/* <CTA /> */}
      </main>
      <Footer />
    </div>
  );
}
