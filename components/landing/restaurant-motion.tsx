"use client";

import type { ReactNode } from "react";
import { motion } from "@/components/motion-wrapper";
import { cn } from "@/lib/utils";

type MotionShellProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const ease = [0.16, 1, 0.3, 1] as const;

export function RestaurantHeroMotion({ children, className }: MotionShellProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.05, ease }}
    >
      {children}
    </motion.div>
  );
}

export function RestaurantHeroPreviewMotion({ children, className }: MotionShellProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 48, scale: 0.96, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
      transition={{ duration: 1.1, delay: 0.16, ease }}
    >
      {children}
    </motion.div>
  );
}

export function RestaurantReveal({ children, className, delay = 0 }: MotionShellProps) {
  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.9, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function RestaurantInteractiveCard({
  children,
  className,
  delay = 0,
}: MotionShellProps) {
  return (
    <motion.div
      className={cn("h-full", className)}
      initial={false}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.015 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function RestaurantCtaMotion({ children, className, delay = 0 }: MotionShellProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -2, scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay }}
    >
      {children}
    </motion.div>
  );
}
