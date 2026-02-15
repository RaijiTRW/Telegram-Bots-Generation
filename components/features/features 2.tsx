'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion } from '@/components/motion-wrapper';
import {
  Globe,
  Code2,
  Shield,
  BarChart3,
  Server,
  Download,
} from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';

// Infrastructure feature blocks - translations will be applied in component
const infrastructureBlocks = [
  {
    id: 'edge',
    size: 'large' as const,
    icon: Globe,
    title: { ru: 'Edge Хостинг', en: 'Edge Hosting' },
    description: { ru: 'Глобальное edge-развертывание обеспечивает минимальную задержку для ваших ботов по всему миру.', en: 'Global edge deployment ensures minimal latency for your bots worldwide.' },
    type: 'map' as const,
  },
  {
    id: 'code',
    size: 'medium' as const,
    icon: Code2,
    title: { ru: 'Экспорт кода', en: 'Source Code Export' },
    description: { ru: 'Экспортируйте чистый, готовый к продакшену код на Python или Node.js.', en: 'Export clean, production-ready code in Python or Node.js.' },
    type: 'code' as const,
  },
  {
    id: 'analytics',
    size: 'small' as const,
    icon: BarChart3,
    title: { ru: 'Аналитика', en: 'Analytics' },
    description: { ru: 'Аналитика в реальном времени вовлеченности пользователей и производительности ботов.', en: 'Real-time insights into user engagement and bot performance.' },
    type: 'chart' as const,
  },
  {
    id: 'security',
    size: 'small' as const,
    icon: Shield,
    title: { ru: 'Безопасность', en: 'Security' },
    description: { ru: 'Сквозное шифрование и безопасная обработка данных.', en: 'End-to-end encryption and secure data handling.' },
    type: 'security' as const,
  },
];

// World map points for Edge Hosting visualization
const mapPoints = [
  { x: 15, y: 30, label: 'US East', delay: 0 },
  { x: 25, y: 35, label: 'US West', delay: 0.5 },
  { x: 48, y: 28, label: 'EU West', delay: 1 },
  { x: 52, y: 45, label: 'EU East', delay: 1.5 },
  { x: 75, y: 40, label: 'Asia', delay: 2 },
  { x: 85, y: 75, label: 'Australia', delay: 2.5 },
];

export function Features() {
  const t = useTranslations('features');
  const locale = useLocale();

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden cyber-grid cyber-noise">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(30, 136, 229, 0.08) 0%, transparent 70%)' }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(124, 77, 255, 0.08) 0%, transparent 70%)' }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            duration: 10,
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
            className="inline-block px-4 py-2 rounded-full glass-panel text-sm text-white/60 mb-4 font-mono"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {locale === 'ru' ? 'Инфраструктура' : 'Infrastructure'}
          </motion.span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {locale === 'ru' ? (
              <>
                Создано для{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  масштабирования
                </span>
              </>
            ) : (
              <>
                Built for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  scale
                </span>
              </>
            )}
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            {locale === 'ru' ? 'Инфраструктура корпоративного уровня, которая растет вместе с вашим бизнесом.' : 'Enterprise-grade infrastructure that grows with your business.'}
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid md:grid-cols-4 gap-6 auto-rows-[200px]">
          {infrastructureBlocks.map((block, index) => {
            const Icon = block.icon;
            const title = typeof block.title === 'string' ? block.title : (locale === 'ru' ? block.title.ru : block.title.en);
            const description = typeof block.description === 'string' ? block.description : (locale === 'ru' ? block.description.ru : block.description.en);

            // Grid span based on size
            const colSpan = block.size === 'large' ? 'md:col-span-2 md:row-span-2' :
                           block.size === 'medium' ? 'md:col-span-2 md:row-span-1' :
                           'md:col-span-1 md:row-span-1';

            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`${colSpan} glass-cyber rounded-3xl p-8 hover:bg-white/5 transition-all duration-300 group relative`}
                whileHover={{ y: -5 }}
              >
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <BorderBeam duration={20 + index * 5} size={300} />
                </div>

                <div className="relative h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <motion.div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: block.id === 'edge' ? 'rgba(30, 136, 229, 0.15)' :
                                   block.id === 'code' ? 'rgba(124, 77, 255, 0.15)' :
                                   block.id === 'analytics' ? 'rgba(0, 230, 118, 0.15)' :
                                   'rgba(255, 171, 0, 0.15)',
                      }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon
                        className="w-7 h-7"
                        style={{
                          color: block.id === 'edge' ? '#1E88E5' :
                                  block.id === 'code' ? '#7C4DFF' :
                                  block.id === 'analytics' ? '#00E676' :
                                  '#FFAB00'
                        }}
                      />
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-xl md:text-2xl font-bold mb-2">
                        {title}
                      </h3>
                      <p className="text-white/60 text-sm leading-relaxed">
                        {description}
                      </p>
                    </div>
                  </div>

                  {/* Content based on type */}
                  {block.type === 'map' && (
                    <div className="flex-1 relative mt-4">
                      {/* Real world map SVG */}
                      <div className="absolute inset-0 opacity-40">
                        <svg
                          viewBox="0 0 1000 500"
                          className="w-full h-full"
                          style={{ filter: 'drop-shadow(0 0 8px rgba(30, 136, 229, 0.3))' }}
                        >
                          {/* World map - real continent outlines */}
                          <g fill="none" stroke="rgba(30, 136, 229, 0.5)" strokeWidth="1.2">
                            {/* North America */}
                            <path d="M60,80 L80,70 L120,65 L150,70 L170,85 L180,110 L175,140 L165,160 L140,175 L120,185 L100,180 L85,165 L70,145 L60,120 L55,100 Z" />
                            <path d="M140,70 L160,55 L190,50 L210,55 L200,70 L175,75 Z" /> {/* Greenland */}
                            {/* Central America */}
                            <path d="M120,185 L130,200 L125,220 L115,215 L110,195 Z" />
                            {/* South America */}
                            <path d="M125,220 L145,235 L160,265 L165,300 L155,340 L140,375 L120,400 L105,385 L95,350 L100,310 L105,270 L115,240 Z" />
                            {/* Europe */}
                            <path d="M450,95 L470,85 L500,80 L520,85 L530,100 L525,120 L510,135 L490,140 L465,135 L450,120 L445,105 Z" />
                            {/* Africa */}
                            <path d="M445,145 L475,140 L510,150 L540,175 L555,210 L550,260 L530,300 L500,330 L460,340 L430,320 L415,280 L410,235 L420,190 L435,160 Z" />
                            {/* Middle East / Arabia */}
                            <path d="M540,155 L570,150 L595,165 L590,190 L565,200 L545,185 Z" />
                            {/* India */}
                            <path d="M620,180 L650,170 L675,190 L680,220 L665,250 L640,260 L615,245 L610,210 Z" />
                            {/* Southeast Asia */}
                            <path d="M680,200 L710,195 L740,210 L755,235 L745,260 L720,275 L695,265 L685,240 Z" />
                            {/* China / East Asia */}
                            <path d="M700,120 L750,110 L800,115 L830,130 L840,160 L825,190 L795,200 L755,195 L720,180 L700,150 Z" />
                            {/* Japan */}
                            <path d="M850,130 L865,125 L875,140 L870,160 L855,165 L845,155 Z" />
                            {/* Russia / North Asia */}
                            <path d="M530,70 L600,55 L700,50 L800,55 L870,70 L900,90 L880,110 L800,115 L750,110 L700,120 L650,115 L600,100 L560,95 L530,85 Z" />
                            {/* UK & Ireland */}
                            <path d="M420,90 L435,85 L445,95 L440,110 L425,115 L415,105 Z" />
                            {/* Australia */}
                            <path d="M780,320 L820,310 L860,325 L880,355 L875,390 L850,410 L810,415 L775,400 L765,365 L770,335 Z" />
                            {/* New Zealand */}
                            <path d="M900,380 L915,375 L920,390 L910,405 L895,400 Z" />
                            {/* Indonesia */}
                            <path d="M720,290 L750,285 L785,295 L800,310 L790,325 L755,330 L720,320 Z" />
                          </g>
                        </svg>
                      </div>

                      {/* Animated ping points */}
                      {mapPoints.map((point) => (
                        <motion.div
                          key={point.label}
                          className="absolute w-2 h-2 rounded-full"
                          style={{
                            left: `${point.x}%`,
                            top: `${point.y}%`,
                            background: '#1E88E5',
                            boxShadow: '0 0 10px rgba(30, 136, 229, 0.6)',
                          }}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.6, 1, 0.6],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: point.delay,
                          }}
                        >
                          {/* Ping ripple */}
                          <motion.div
                            className="absolute inset-0 rounded-full border border-[#1E88E5]"
                            animate={{
                              scale: [1, 3, 3],
                              opacity: [0.5, 0, 0],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              delay: point.delay,
                            }}
                          />
                        </motion.div>
                      ))}

                      <div className="absolute bottom-0 right-0 text-xs font-mono text-[#1E88E5]">
                        <Server className="w-3 h-3 inline mr-1" />
                        {locale === 'ru' ? 'Глобальная Edge-сеть' : 'Global Edge Network'}
                      </div>
                    </div>
                  )}

                  {block.type === 'code' && (
                    <div className="flex-1 mt-4">
                      <div className="rounded-lg bg-black/40 p-4 font-mono text-xs overflow-hidden">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/50" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                            <div className="w-2 h-2 rounded-full bg-green-500/50" />
                          </div>
                          <span className="text-white/40">bot.py</span>
                        </div>
                        <pre className="text-white/70">
                          <span className="text-[#7C4DFF]">import</span> tflow{'\n'}
                          <br />
                          <span className="text-[#7C4DFF]">async def</span> <span className="text-[#1E88E5]">start</span>(msg):{'\n'}
                          <span className="ml-4 text-white/50"># Your logic here</span>
                        </pre>
                        <motion.button
                          className="mt-3 w-full py-2 rounded bg-[#1E88E5]/20 border border-[#1E88E5]/30 text-[#1E88E5] text-xs flex items-center justify-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Download className="w-3 h-3" />
                          {locale === 'ru' ? 'Экспорт кода' : 'Export Code'}
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {block.type === 'chart' && (
                    <div className="flex-1 mt-4 flex items-end gap-1">
                      {/* Simple bar chart */}
                      {[40, 65, 45, 80, 55, 70, 60, 90, 75, 85, 95, 80].map((height, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t"
                          style={{
                            background: 'linear-gradient(to top, #1E88E5, #7C4DFF)',
                            height: `${height}%`,
                          }}
                          initial={{ height: 0 }}
                          whileInView={{ height: `${height}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                        />
                      ))}
                    </div>
                  )}

                  {block.type === 'security' && (
                    <div className="flex-1 mt-4 flex flex-col justify-center">
                      <motion.div
                        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(255, 171, 0, 0.15)',
                          border: '2px solid #FFAB00',
                        }}
                        animate={{
                          boxShadow: [
                            '0 0 20px rgba(255, 171, 0, 0.3)',
                            '0 0 40px rgba(255, 171, 0, 0.5)',
                            '0 0 20px rgba(255, 171, 0, 0.3)',
                          ],
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <Shield className="w-8 h-8 text-[#FFAB00]" />
                      </motion.div>
                      <div className="text-center mt-3">
                        <div className="text-sm font-semibold text-white mb-1">
                          {locale === 'ru' ? 'Сквозное шифрование' : 'End-to-end encrypted'}
                        </div>
                        <div className="text-xs text-white/40">{locale === 'ru' ? 'Соответствие SOC2' : 'SOC2 Compliant'}</div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
