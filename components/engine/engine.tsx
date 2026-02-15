'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from '@/components/motion-wrapper';
import { useTranslations } from 'next-intl';
import { Smartphone, Cloud, CheckCircle, ArrowUpRight } from 'lucide-react';

export function Engine() {
  const t = useTranslations('engine');
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Transform values for scroll-linked animations
  const phoneY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0, -100]);
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.3, 1, 1, 0]);
  const textCloudOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const botStructureOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const uiElementsOpacity = useTransform(scrollYProgress, [0.5, 0.8], [0, 1]);
  const deployOpacity = useTransform(scrollYProgress, [0.8, 1], [0, 1]);

  const stages = [
    { label: t('stages.analyze'), icon: Cloud, description: t('stages.analyzeDesc'), progress: 0.25 },
    { label: t('stages.build'), icon: CheckCircle, description: t('stages.buildDesc'), progress: 0.5 },
    { label: t('stages.configure'), icon: Smartphone, description: t('stages.configureDesc'), progress: 0.75 },
    { label: t('stages.deploy'), icon: ArrowUpRight, description: t('stages.deployDesc'), progress: 1 },
  ];

  const words = [
    t('words.sales'),
    t('words.catalog'),
    t('words.orders'),
    t('words.AI'),
    t('words.automation'),
    t('words.support'),
  ];

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 overflow-hidden cyber-grid">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl bg-[#1E88E5]/5" />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-24"
        >
          <span className="inline-block px-4 py-2 rounded-full glass-panel text-sm text-white/60 mb-4 font-mono">
            {t('badge')}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Scroll visualization area */}
        <div className="relative h-[600px] flex items-center justify-center">
          {/* Fixed smartphone */}
          <motion.div
            style={{ y: phoneY, opacity: phoneOpacity }}
            className="relative z-10"
          >
            <div className="w-64 h-[500px] rounded-3xl glass-panel p-4 relative">
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl" />

              {/* Phone screen */}
              <div className="absolute inset-4 flex items-center justify-center overflow-hidden">
                {/* Stage 1: Text cloud */}
                <motion.div
                  style={{ opacity: textCloudOpacity }}
                  className="absolute inset-0 flex flex-wrap gap-2 items-center justify-center p-4"
                >
                  {words.map((word, i) => (
                    <motion.span
                      key={word}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="px-3 py-1.5 rounded-full glass-panel text-xs font-mono text-white/80"
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.div>

                {/* Stage 2: Bot structure */}
                <motion.div
                  style={{ opacity: botStructureOpacity }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="space-y-2 w-full px-8">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      transition={{ duration: 0.8 }}
                      className="h-2 bg-[#1E88E5]/30 rounded"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '50%' }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-2 bg-[#1E88E5]/20 rounded ml-auto"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '66%' }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="h-2 bg-[#1E88E5]/10 rounded"
                    />
                    <div className="text-center mt-6 text-xs font-mono text-[#1E88E5]">
                      {t('buildingStructure')}
                    </div>
                  </div>
                </motion.div>

                {/* Stage 3: UI elements */}
                <motion.div
                  style={{ opacity: uiElementsOpacity }}
                  className="absolute inset-0 flex flex-col p-4 space-y-3"
                >
                  {/* Header */}
                  <div className="h-10 rounded-lg bg-gradient-to-r from-[#1E88E5]/20 to-[#7C4DFF]/20 border border-[#1E88E5]/30 flex items-center justify-center">
                    <span className="text-xs font-semibold">{t('botName')}</span>
                  </div>
                  {/* Chat messages */}
                  <div className="space-y-2 flex-1">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="h-8 rounded-lg bg-white/5 border border-white/10 flex items-center px-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-[#1E88E5] mr-2" />
                        <div className="h-2 flex-1 bg-white/10 rounded" />
                      </motion.div>
                    ))}
                  </div>
                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="h-8 rounded-lg bg-[#1E88E5]/20 border border-[#1E88E5]/30"
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Stage 4: Deployed */}
                <motion.div
                  style={{ opacity: deployOpacity }}
                  className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#00E676]/10 to-transparent"
                >
                  <div className="text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.6 }}
                      className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00E676]/20 border-2 border-[#00E676] flex items-center justify-center"
                    >
                      <CheckCircle className="w-8 h-8 text-[#00E676]" />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-lg font-mono text-[#00E676] mb-2"
                    >
                      t.me/your_bot
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center justify-center gap-2 text-sm text-white/60"
                    >
                      <CheckCircle className="w-4 h-4 text-[#00E676]" />
                      <span>{t('deployedSuccessfully')}</span>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Stage indicators */}
          <div className="absolute right-0 top-0 bottom-0 w-64 space-y-8 py-12 hidden lg:block">
            {stages.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <motion.div
                  key={stage.label}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl glass-panel flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-[#1E88E5]" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{stage.label}</h4>
                    <p className="text-sm text-white/60">{stage.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-sm text-white/40 font-mono mb-2">{t('scrollHint')}</p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="inline-block"
          >
            <ArrowUpRight className="w-6 h-6 text-[#1E88E5]/50 rotate-180" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
