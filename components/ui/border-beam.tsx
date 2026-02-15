'use client';

import { motion } from '@/components/motion-wrapper';

interface BorderBeamProps {
  roundedClassName?: string;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  roundedClassName = '',
  size = 200,
  duration = 15,
  colorFrom = 'rgba(30, 136, 229, 0.5)',
  colorTo = 'rgba(124, 77, 255, 0.5)',
  delay = 0,
}: BorderBeamProps) {
  return (
    <motion.div
      className={`absolute inset-0 pointer-events-none ${roundedClassName}`}
      style={{ overflow: 'hidden' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* Rotating conic gradient for corner beam effect */}
      <motion.div
        className="absolute w-[600px] h-[600px]"
        style={{
          left: '50%',
          top: '50%',
          marginLeft: '-300px',
          marginTop: '-300px',
          background: `conic-gradient(from 0deg at 50% 50%,
            transparent 0deg,
            ${colorFrom} 60deg,
            ${colorTo} 120deg,
            transparent 180deg)`,
          filter: 'blur(40px)',
        }}
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Border glow pulse */}
      <div className={`absolute inset-0 ${roundedClassName}`}>
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(45deg, ${colorFrom}, ${colorTo})`,
            opacity: 0.1,
          }}
          animate={{
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Subtle edge highlight */}
      <motion.div
        className={`absolute inset-0 ${roundedClassName}`}
        style={{
          border: '1px solid',
          borderColor: colorFrom,
          opacity: 0.15,
        }}
        animate={{
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
    </motion.div>
  );
}
