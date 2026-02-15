'use client';

import { motion } from '@/components/motion-wrapper';

interface TFlowLogoProps {
  className?: string;
  showText?: boolean;
}

/**
 * TFlowLogo - анимированный логотип с бумажным самолетиком и волной
 * Символизирует: Telegram (самолетик) + Flow (поток/волна)
 */
export function TFlowLogo({ className = '', showText = true }: TFlowLogoProps) {
  return (
    <svg
      viewBox="0 0 140 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Градиент для текста */}
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#24A1DE" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        {/* Градиент для самолета */}
        <linearGradient id="plane-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#24A1DE" />
          <stop offset="100%" stopColor="#1E8FB8" />
        </linearGradient>

        {/* Градиент для волны */}
        <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>

        {/* Свечение самолета */}
        <filter id="plane-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Бумажный самолетик с анимацией покачивания */}
      <g filter="url(#plane-glow)">
        <motion.path
          d="M8 20 L28 8 L28 32 Z"
          fill="url(#plane-gradient)"
          stroke="#24A1DE"
          strokeWidth="1.5"
          strokeLinejoin="round"
          animate={{
            rotate: [0, 8, 0],
            y: [0, -2, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        {/* Деталь самолета - складка */}
        <motion.path
          d="M8 20 L28 20"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
          animate={{
            rotate: [0, 8, 0],
            y: [0, -2, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </g>

      {/* Анимированная волна - символ Flow */}
      <motion.path
        d="M38 24 Q48 14, 58 24 T78 24"
        stroke="url(#wave-gradient)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          duration: 1.8,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 0.5,
        }}
      />

      {/* Вторая маленькая волна */}
      <motion.path
        d="M38 28 Q45 22, 52 28 T66 28"
        stroke="#8B5CF6"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity={0.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 2,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatType: 'loop',
          repeatDelay: 0.8,
        }}
      />

      {/* Текст TFlow с градиентом */}
      {showText && (
        <motion.text
          x="88"
          y="28"
          fill="url(#logo-gradient)"
          fontSize="20"
          fontWeight="700"
          letterSpacing="0.5"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          TFlow
        </motion.text>
      )}

      {/* Декоративные частицы вокруг логотипа */}
      <motion.circle
        cx="18"
        cy="12"
        r="1.5"
        fill="#24A1DE"
        opacity={0.6}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.circle
        cx="68"
        cy="18"
        r="1"
        fill="#8B5CF6"
        opacity={0.4}
        animate={{
          scale: [1, 2, 1],
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
    </svg>
  );
}

/**
 * CompactLogo - уменьшенная версия логотипа для хедера
 */
export function CompactLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="compact-plane-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#24A1DE" />
          <stop offset="100%" stopColor="#1E8FB8" />
        </linearGradient>
        <linearGradient id="compact-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      {/* Самолетик */}
      <motion.path
        d="M8 20 L24 10 L24 30 Z"
        fill="url(#compact-plane-gradient)"
        stroke="#24A1DE"
        strokeWidth="1.5"
        strokeLinejoin="round"
        animate={{ rotate: [0, 5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Волна */}
      <motion.path
        d="M28 22 Q34 16, 40 22"
        stroke="url(#compact-wave-gradient)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 1.5,
          ease: 'easeInOut',
          repeat: Infinity,
          repeatDelay: 0.3,
        }}
      />
    </svg>
  );
}
