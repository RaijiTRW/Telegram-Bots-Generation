'use client';

import { LazyMotion, domAnimation, m, AnimatePresence, useScroll, useTransform } from 'framer-motion';

/**
 * MotionWrapper - оптимизированная обертка для Framer Motion
 * Использует LazyMotion для уменьшения размера бандла с ~34kb до ~5kb
 *
 * Использование:
 * import { motion } from '@/components/motion-wrapper';
 */
export function MotionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}

// Экспортируем m как motion для совместимости с существующим кодом
export { m as motion, AnimatePresence, useScroll, useTransform };
