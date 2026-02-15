'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from '@/components/motion-wrapper';
import { ArrowRight, Sparkles } from 'lucide-react';

export function CTA() {
  const t = useTranslations('cta');
  const locale = useLocale();

  return (
    <section id="cta" className="py-24 md:py-32 px-4 relative overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-primary opacity-10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Floating particles */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/30"
            style={{
              top: `${20 + i * 10}%`,
              left: `${10 + i * 15}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          {/* Main card with glow effect */}
          <motion.div
            className="glass-strong rounded-3xl p-8 md:p-16 text-center relative overflow-hidden"
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
          >
            {/* Animated gradient border effect */}
            <motion.div
              className="absolute inset-0 rounded-3xl opacity-50"
              style={{
                background: 'linear-gradient(45deg, transparent, rgba(36, 161, 222, 0.1), transparent)',
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            {/* Icon badge */}
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-6 shadow-lg"
              animate={{
                rotate: [0, 10, -10, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>

            {/* Title */}
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              {t('title')}
            </h2>

            {/* Subtitle */}
            <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>

            {/* Signup Button */}
            <div className="max-w-md mx-auto">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href={`/${locale}/auth/signup`}
                  className="btn-primary px-8 py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 w-full"
                >
                  <span>{t('button')}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>

              {/* Note */}
              <motion.p
                className="mt-4 text-sm text-white/60"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                {t('note')}
              </motion.p>
            </div>

            {/* Enhanced Decorative Elements */}
            <div className="mt-12 flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="w-2 h-2"
                >
                  <motion.div
                    className="w-full h-full rounded-full bg-gradient-primary"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Extra glow behind card */}
          <motion.div
            className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl rounded-3xl -z-10"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.div>
      </div>
    </section>
  );
}
