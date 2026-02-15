'use client';

import { useTranslations } from 'next-intl';
import { motion } from '@/components/motion-wrapper';
import {
  FileText,
  Zap,
  Rocket,
  ArrowRight,
  Sparkles,
  Cpu,
} from 'lucide-react';

const iconMap = {
  '01': FileText,
  '02': Zap,
  '03': Rocket,
};

const bgIconMap = {
  '01': Sparkles,
  '02': Cpu,
  '03': Rocket,
};

export function HowItWorks() {
  const t = useTranslations('howItWorks');
  const steps = t.raw('steps') as Array<{
    number: string;
    title: string;
    description: string;
  }>;

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-block px-4 py-2 rounded-full glass text-sm text-white/60 mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Простые шаги к вашему боту
          </motion.span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {t('title')}
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = iconMap[step.number as keyof typeof iconMap];
            const BgIcon = bgIconMap[step.number as keyof typeof bgIconMap];

            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className="relative group"
              >
                {/* Card */}
                <div className="glass rounded-2xl p-8 h-full hover:bg-white/10 transition-all duration-300 relative overflow-hidden">
                  {/* Background icon */}
                  <motion.div
                    className="absolute -bottom-8 -right-8 w-32 h-32 opacity-5"
                    animate={{
                      rotate: index % 2 === 0 ? 360 : -360,
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  >
                    {BgIcon && <BgIcon className="w-full h-full text-[#24A1DE]" />}
                  </motion.div>

                  {/* Step Number Badge */}
                  <motion.div
                    className="absolute -top-4 -left-4 w-14 h-14 bg-gradient-primary rounded-xl flex items-center justify-center font-bold text-lg shadow-lg"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.number}
                  </motion.div>

                  {/* Icon */}
                  <div className="mb-6 pt-4">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      {Icon && <Icon className="w-8 h-8 text-white" />}
                    </motion.div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-white/60 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Animated Connector Line (desktop) */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 left-full w-8 h-0.5 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ x: '-100%' }}
                      whileInView={{ x: '0%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.5 + index * 0.15 }}
                    />
                  </div>
                )}

                {/* Animated Arrow (desktop) */}
                {index < steps.length - 1 && (
                  <motion.div
                    className="hidden md:block absolute top-1/2 -right-6 w-6 h-6 bg-gradient-primary rounded-full items-center justify-center"
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.8 + index * 0.15 }}
                  >
                    <ArrowRight className="w-3 h-3 text-white" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
