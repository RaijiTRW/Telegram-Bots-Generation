'use client';

import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
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

const WorldMap = dynamic(
  () => import('./world-map').then((module) => module.WorldMap),
  {
    ssr: false,
    loading: () => <LiteMapPreview />,
  }
);

function LiteMapPreview() {
  return (
    <div className="w-full h-full rounded-xl border border-[#1E88E5]/20 bg-linear-to-br from-[#08111E] to-[#0B0F17] p-4">
      <div className="relative h-full overflow-hidden rounded-lg border border-white/6 bg-black/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(30,136,229,0.18),transparent_26%),radial-gradient(circle_at_75%_35%,rgba(124,77,255,0.16),transparent_24%),radial-gradient(circle_at_58%_72%,rgba(0,230,118,0.12),transparent_22%)]" />
        <div className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-[#1E88E5]/40 to-transparent" />
        <div className="absolute left-[18%] top-[34%] w-2 h-2 rounded-full bg-[#1E88E5]" />
        <div className="absolute left-[37%] top-[43%] w-2 h-2 rounded-full bg-[#7C4DFF]" />
        <div className="absolute left-[61%] top-[30%] w-2 h-2 rounded-full bg-[#00E676]" />
        <div className="absolute left-[74%] top-[58%] w-2 h-2 rounded-full bg-[#1E88E5]" />
        <div className="absolute left-[48%] top-[68%] w-2 h-2 rounded-full bg-[#7C4DFF]" />
      </div>
    </div>
  );
}

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

export function Features() {
  const locale = useLocale();
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  return (
    <section className="py-24 md:py-32 px-4 relative overflow-hidden cyber-grid cyber-noise">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-block px-4 py-2 rounded-full glass-panel text-sm text-white/60 mb-4 font-mono"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={enterViewport}
            transition={{ duration: 0.34 }}
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
                viewport={enterViewport}
                transition={{
                  opacity: { duration: 0.34, delay: index * 0.04 },
                  scale: { duration: 0.34, delay: index * 0.04 },
                  y: { duration: 0.14, ease: 'easeOut' },
                }}
                className={`${colSpan} glass-cyber rounded-3xl p-6 hover:bg-white/5 transition-colors duration-150 group relative overflow-hidden flex flex-col gpu-layer`}
                style={{ maxHeight: block.size === 'large' ? '424px' : block.size === 'medium' ? '200px' : '200px' }}
                whileHover={{ y: -5 }}
              >
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <BorderBeam duration={20 + index * 5} size={300} roundedClassName="rounded-3xl" />
                </div>

                <div className="relative flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3 shrink-0">
                    <motion.div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
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
                        className="w-5 h-5"
                        style={{
                          color: block.id === 'edge' ? '#1E88E5' :
                                  block.id === 'code' ? '#7C4DFF' :
                                  block.id === 'analytics' ? '#00E676' :
                                  '#FFAB00'
                        }}
                      />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-bold mb-1">
                        {title}
                      </h3>
                      <p className="text-white/60 text-xs leading-relaxed">
                        {description}
                      </p>
                    </div>
                  </div>

                  {/* Content based on type */}
                  {block.type === 'map' && (
                    <div className="flex-1 min-h-0 relative mt-2 overflow-hidden rounded-xl">
                      <WorldMap />

                      <div className="absolute bottom-0 right-0 text-xs font-mono text-[#1E88E5]">
                        <Server className="w-3 h-3 inline mr-1" />
                        {locale === 'ru' ? 'Глобальная Edge-сеть' : 'Global Edge Network'}
                      </div>
                    </div>
                  )}

                  {block.type === 'code' && (
                    <div className="flex-1 min-h-0 mt-2 flex flex-col">
                      <div className="rounded-lg bg-black/40 p-3 font-mono text-xs overflow-hidden flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 shrink-0">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/50" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                            <div className="w-2 h-2 rounded-full bg-green-500/50" />
                          </div>
                          <span className="text-white/40 text-[10px]">bot.py</span>
                        </div>
                        <pre className="text-white/70 text-[10px] leading-relaxed overflow-hidden">
                          <span className="text-[#7C4DFF]">import</span> tflow{'\n'}
                          <span className="text-[#7C4DFF]">async def</span> <span className="text-[#1E88E5]">start</span>(msg):{'\n'}
                          <span className="ml-2 text-white/50"># Your logic</span>
                        </pre>
                        <div
                          className="pointer-events-none mt-2 py-1.5 rounded bg-[#1E88E5]/20 border border-[#1E88E5]/30 text-[#1E88E5] text-[10px] flex items-center justify-center gap-1.5 shrink-0 select-none"
                          aria-hidden="true"
                        >
                          <Download className="w-3 h-3" />
                          {locale === 'ru' ? 'Экспорт' : 'Export'}
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === 'chart' && (
                    <div className="flex-1 min-h-0 mt-2 flex items-end gap-1">
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
                          viewport={enterViewport}
                          transition={{ duration: 0.42, delay: i * 0.03 }}
                        />
                      ))}
                    </div>
                  )}

                  {block.type === 'security' && (
                    <div className="flex-1 min-h-0 mt-2 flex flex-col justify-center items-center">
                      <motion.div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(255, 171, 0, 0.15)',
                          border: '2px solid #FFAB00',
                          boxShadow: '0 0 28px rgba(255, 171, 0, 0.16)',
                        }}
                      >
                        <Shield className="w-6 h-6 text-[#FFAB00]" />
                      </motion.div>
                      <div className="text-center mt-2">
                        <div className="text-xs font-semibold text-white mb-0.5">
                          {locale === 'ru' ? 'E2E Защита' : 'E2E Encrypted'}
                        </div>
                        <div className="text-[10px] text-white/40">SOC2 Compliant</div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
