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
      viewBox="0 0 160 50"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Core Gradients */}
        <linearGradient id="logo-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#24A1DE" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient id="plane-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(36, 161, 222, 0.9)" />
          <stop offset="50%" stopColor="rgba(139, 92, 246, 0.7)" />
          <stop offset="100%" stopColor="rgba(30, 143, 184, 0.9)" />
        </linearGradient>

        <linearGradient id="plane-wing-left" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.6)" />
          <stop offset="100%" stopColor="rgba(36, 161, 222, 0.1)" />
        </linearGradient>

        <linearGradient id="plane-wing-right" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" />
        </linearGradient>

        {/* Wave Gradients */}
        <linearGradient id="wave-bottom" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(36, 161, 222, 0.1)" />
          <stop offset="50%" stopColor="rgba(139, 92, 246, 0.5)" />
          <stop offset="100%" stopColor="rgba(36, 161, 222, 0.1)" />
        </linearGradient>

        <linearGradient id="wave-top" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(139, 92, 246, 0.1)" />
          <stop offset="50%" stopColor="rgba(0, 240, 255, 0.6)" />
          <stop offset="100%" stopColor="rgba(139, 92, 246, 0.1)" />
        </linearGradient>

        {/* Glow Filters */}
        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="6" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="subtle-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* --- LAYER 1: NEURAL NETWORK BACKGROUND (AI) --- */}
      <g opacity="0.4">
        {/* Connection Lines */}
        <motion.path
          d="M10 25 L35 15 L50 35 L75 20 M35 15 L55 5 M50 35 L70 45"
          stroke="url(#plane-wing-left)"
          strokeWidth="0.5"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
        />
        {/* Neural Nodes */}
        {[
          { cx: 10, cy: 25, delay: 0 },
          { cx: 35, cy: 15, delay: 0.5 },
          { cx: 50, cy: 35, delay: 1 },
          { cx: 55, cy: 5, delay: 1.5 },
          { cx: 75, cy: 20, delay: 2 },
          { cx: 70, cy: 45, delay: 2.5 },
        ].map((node, i) => (
          <motion.circle
            key={i}
            cx={node.cx}
            cy={node.cy}
            r="1.5"
            fill="#00F0FF"
            filter="url(#subtle-glow)"
            animate={{
              r: [1, 2.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 2,
              delay: node.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </g>

      {/* --- LAYER 2: DATA FLOW WAVES (Flow) --- */}
      <g>
        {/* Background Wave */}
        <motion.path
          d="M0 30 Q 20 15, 45 28 T 90 25"
          stroke="url(#wave-bottom)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          filter="url(#subtle-glow)"
          animate={{
            d: [
              "M0 30 Q 20 15, 45 28 T 90 25",
              "M0 25 Q 25 35, 50 20 T 90 30",
              "M0 30 Q 20 15, 45 28 T 90 25",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Foreground Wave */}
        <motion.path
          d="M15 35 Q 35 45, 55 30 T 95 32"
          stroke="url(#wave-top)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          filter="url(#neon-glow)"
          initial={{ pathLength: 0 }}
          animate={{
            pathLength: 1,
            d: [
              "M15 35 Q 35 45, 55 30 T 95 32",
              "M15 30 Q 30 15, 60 35 T 95 28",
              "M15 35 Q 35 45, 55 30 T 95 32",
            ],
          }}
          transition={{
            d: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            pathLength: { duration: 2, ease: 'easeOut', repeat: Infinity, repeatType: 'loop', repeatDelay: 1 },
          }}
        />
      </g>

      {/* --- LAYER 3: 3D GLASS TELEGRAM PLANE --- */}
      <motion.g
        animate={{
          y: [0, -3, 0],
          rotateZ: [0, 2, 0],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Plane Shadow */}
        <motion.path
          d="M10 28 L35 15 L32 40 Z"
          fill="rgba(0,0,0,0.4)"
          filter="blur(4px)"
          animate={{ scale: [1, 0.9, 1], y: [0, 4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Back Wing (Right) */}
        <path
          d="M12 24 L38 12 L30 35 Z"
          fill="url(#plane-wing-right)"
          stroke="rgba(139, 92, 246, 0.8)"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* Main Body */}
        <path
          d="M10 25 L40 10 L28 38 L22 28 Z"
          fill="url(#plane-body-grad)"
          stroke="#00F0FF"
          strokeWidth="1"
          strokeLinejoin="round"
          filter="url(#neon-glow)"
        />

        {/* Front Wing (Left) */}
        <path
          d="M10 25 L40 10 L22 28 Z"
          fill="url(#plane-wing-left)"
          stroke="rgba(255, 255, 255, 0.8)"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />

        {/* Crease/Fold Line */}
        <path
          d="M10 25 L40 10"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          filter="url(#subtle-glow)"
        />

        {/* Flow 'Engine' Trail Glow */}
        <motion.circle
          cx="10"
          cy="25"
          r="2"
          fill="#00F0FF"
          filter="url(#neon-glow)"
          animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.g>

      {/* --- Текст TFlow --- */}
      {showText && (
        <motion.g
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <text
            x="100"
            y="33"
            fill="url(#logo-text-gradient)"
            fontSize="26"
            fontWeight="800"
            letterSpacing="0.5"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            TFlow
          </text>
        </motion.g>
      )}
    </svg>
  );
}

/**
 * CompactLogo - уменьшенная версия логотипа для хедера
 */
export function CompactLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 50"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="compact-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(36, 161, 222, 0.9)" />
          <stop offset="100%" stopColor="rgba(139, 92, 246, 0.9)" />
        </linearGradient>
        <linearGradient id="compact-wing" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.8)" />
          <stop offset="100%" stopColor="rgba(36, 161, 222, 0.2)" />
        </linearGradient>
        <filter id="compact-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="compact-wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#00F0FF" />
        </linearGradient>
      </defs>

      {/* Nodes */}
      <motion.circle cx="15" cy="15" r="1.5" fill="#00F0FF" filter="url(#compact-glow)" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />
      <motion.circle cx="45" cy="35" r="2" fill="#8B5CF6" filter="url(#compact-glow)" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }} />

      {/* Wave */}
      <motion.path
        d="M5 30 Q 25 20, 45 40 T 55 35"
        stroke="url(#compact-wave)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        filter="url(#compact-glow)"
        animate={{ d: ["M5 30 Q 25 20, 45 40 T 55 35", "M5 35 Q 30 45, 45 25 T 55 30", "M5 30 Q 25 20, 45 40 T 55 35"] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Plane */}
      <motion.g animate={{ y: [0, -2, 0], rotateZ: [0, 3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M15 25 L45 10 L33 38 L27 28 Z" fill="url(#compact-body)" stroke="#00F0FF" strokeWidth="1" strokeLinejoin="round" filter="url(#compact-glow)" />
        <path d="M15 25 L45 10 L27 28 Z" fill="url(#compact-wing)" stroke="#FFFFFF" strokeWidth="1" strokeLinejoin="round" />
        <path d="M15 25 L45 10" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
