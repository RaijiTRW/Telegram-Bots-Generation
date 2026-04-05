'use client';

import Link from 'next/link';
import { motion } from '@/components/motion-wrapper';
import { useLocale, useTranslations } from 'next-intl';
import { Shield, Activity, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';
export function Monitoring() {
  const t = useTranslations('monitoring');
  const locale = useLocale();
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  const botPoints = [
    { x: 30, y: 20, delay: 0 },
    { x: 60, y: 40, delay: 0.5 },
    { x: 45, y: 70, delay: 1 },
    { x: 20, y: 55, delay: 1.5 },
    { x: 70, y: 65, delay: 2 },
  ];

  const features = [
    { icon: CheckCircle2, text: t('features.updates'), color: '#00E676' },
    { icon: Activity, text: t('features.uptime'), color: '#1E88E5' },
    { icon: AlertTriangle, text: t('features.alerts'), color: '#FFAB00' },
  ];

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden cyber-grid cyber-noise">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 gpu-layer">
          <div className="w-[800px] h-[800px] rounded-full border" style={{ borderColor: 'rgba(30, 136, 229, 0.1)' }} />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 gpu-layer">
          <div className="w-[600px] h-[600px] rounded-full border" style={{ borderColor: 'rgba(124, 77, 255, 0.1)' }} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={enterViewport}
            transition={{ duration: 0.42 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel mb-6 font-mono text-sm">
              <Shield className="w-4 h-4 text-[#00E676]" />
              <span className="text-white/60">{t('title')}</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t('subtitleFirst')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                {t('subtitleHighlight')}
              </span>
            </h2>

            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              {t('subtitleSecond')}
            </p>

            <div className="space-y-4">
              {features.map((item, index) => {
                const Icon = item.icon;
                return (
                    <motion.div
                      key={item.text}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={enterViewport}
                      transition={{ delay: index * 0.04, duration: 0.34 }}
                      className="flex items-center gap-4"
                    >
                    <div
                      className="w-10 h-10 rounded-lg glass-panel flex items-center justify-center"
                      style={{ borderColor: `${item.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <span className="text-white/80">{item.text}</span>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={enterViewport}
              transition={{ duration: 0.34, delay: 0.12 }}
              className="mt-8"
            >
              <Link
                href={`/${locale}/auth/signup`}
                className="inline-flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#1E88E5,#00E676)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(30,136,229,0.22)] transition-transform hover:translate-y-[-1px]"
              >
                <span>{t('cta.label')}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/56">
                {t('cta.note')}
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={enterViewport}
            transition={{ duration: 0.42 }}
            className="relative gpu-layer"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              <BorderBeam duration={10} size={400} roundedClassName="rounded-full" />

              <div className="relative glass-cyber-strong rounded-full aspect-square flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-white/5" style={{ background: 'radial-gradient(circle, rgba(30, 136, 229, 0.05) 0%, transparent 70%)' }} />
                <div className="absolute inset-8 rounded-full border border-white/5" style={{ background: 'radial-gradient(circle, rgba(124, 77, 255, 0.03) 0%, transparent 70%)' }} />
                <div className="absolute inset-16 rounded-full border border-white/5" style={{ background: 'radial-gradient(circle, rgba(30, 136, 229, 0.02) 0%, transparent 70%)' }} />

                <motion.div
                  className="absolute inset-0 gpu-layer"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 h-1 w-1/2 origin-left"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(30, 136, 229, 0.4))' }}
                  />
                </motion.div>
                <motion.div
                  className="absolute inset-0 rotate-[132deg] gpu-layer"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                >
                  <div
                    className="absolute top-1/2 left-1/2 h-1 w-1/3 origin-left"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(124, 77, 255, 0.3))' }}
                  />
                </motion.div>

                {botPoints.map((bot) => (
                  <div
                    key={bot.delay}
                    className="absolute w-3 h-3 rounded-full shadow-lg gpu-layer"
                    style={{
                      left: `${bot.x}%`,
                      top: `${bot.y}%`,
                      background: '#00E676',
                      boxShadow: '0 0 10px rgba(0, 230, 118, 0.18)',
                    }}
                  />
                ))}

                <div className="relative z-10 text-center">
                  <div
                    className="w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center gpu-layer"
                    style={{
                      background: 'rgba(0, 230, 118, 0.15)',
                      border: '2px solid #00E676',
                      boxShadow: '0 0 26px rgba(0, 230, 118, 0.18)',
                    }}
                  >
                    <CheckCircle2 className="w-8 h-8 text-[#00E676]" />
                  </div>
                  <div className="text-sm font-mono text-[#00E676]">{t('statusTitle')}</div>
                  <div className="text-xs text-white/40 mt-1">{t('statusSubtitle')}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
