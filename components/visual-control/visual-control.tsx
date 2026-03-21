'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion } from '@/components/motion-wrapper';
import {
  Settings,
  MessageSquare,
  MousePointer,
  Wand2,
  Type,
  Image as ImageIcon,
  Box,
} from 'lucide-react';

import { EditorCanvasPreview } from './editor-canvas-preview';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Settings,
  MessageSquare,
  MousePointer,
  Type,
  ImageIcon,
  Box,
};

export function VisualControl() {
  const t = useTranslations('visualControl');
  const locale = useLocale();
  const isRu = locale === 'ru';
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  const features = t.raw('features') as Array<{
    icon: string;
    title: string;
    description: string;
  }>;

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden cyber-grid cyber-noise">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={enterViewport}
            transition={{ duration: 0.42 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm text-white/60 mb-6 font-mono"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={enterViewport}
              transition={{ duration: 0.34 }}
            >
              <Wand2 className="w-4 h-4 text-[#7C4DFF]" />
              <span>{t('badge')}</span>
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t('title')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                {t('titleHighlight1')}
              </span>
              {t('titleAnd')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C4DFF] to-[#1E88E5]">
                {t('titleHighlight2')}
              </span>
            </h2>

            <p className="text-lg text-white/60 mb-12 leading-relaxed">
              {t('subtitle')}
            </p>

            <div className="space-y-6">
              {features.map((feature, index) => {
                const Icon = iconMap[feature.icon];

                return (
                    <motion.div
                      key={feature.icon}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={enterViewport}
                      transition={{ duration: 0.34, delay: index * 0.04 }}
                      className="flex items-start gap-4 group"
                    >
                    <motion.div
                      className="w-12 h-12 rounded-xl glass-panel flex items-center justify-center flex-shrink-0 group-hover:bg-[#1E88E5]/20 transition-colors"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.2 }}
                    >
                      {Icon && <Icon className="w-6 h-6 text-[#1E88E5]" />}
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                      <p className="text-white/60">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={enterViewport}
            transition={{ duration: 0.42 }}
            className="relative"
          >
            <div className="glass-cyber-strong rounded-[28px] overflow-hidden border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <div className="h-5 w-px bg-white/10" />
                  <span className="text-sm text-white/65 font-mono">{t('editor_title')}</span>
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/60">
                  {isRu ? 'Пример canvas' : 'Canvas preview'}
                </div>
              </div>

              <div className="p-4 md:p-5">
                <EditorCanvasPreview />
              </div>
            </div>

            <div className="pointer-events-none absolute -top-8 -right-8 h-16 w-16 rounded-full border border-[#1E88E5]/30" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-12 w-12 rounded-full border border-[#7C4DFF]/30" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
