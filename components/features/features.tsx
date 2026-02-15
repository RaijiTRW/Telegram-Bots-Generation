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
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useState } from 'react';

// Simplified world GeoJSON for detailed map
const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

// World map points for Edge Hosting visualization (using lat/lon for react-simple-maps)
const mapPoints: Array<{
  name: string;
  coordinates: [number, number];
  delay: number;
}> = [
  { name: 'US East', coordinates: [-74, 40.7], delay: 0 },      // New York
  { name: 'US West', coordinates: [-122.4, 37.8], delay: 0.5 },  // San Francisco
  { name: 'EU West', coordinates: [-0.1, 51.5], delay: 1 },      // London
  { name: 'EU East', coordinates: [30.5, 50.4], delay: 1.5 },     // Kyiv
  { name: 'Asia', coordinates: [139.7, 35.7], delay: 2 },         // Tokyo
  { name: 'Australia', coordinates: [151.2, -33.9], delay: 2.5 }, // Sydney
  { name: 'SA', coordinates: [-46.6, -23.6], delay: 3 },          // Sao Paulo
  { name: 'Africa', coordinates: [18.4, -33.9], delay: 3.5 },    // Cape Town
];

// WorldMap component that loads GeoJSON
function WorldMap() {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  return (
    <div
      className="w-full h-full"
      style={{ outline: 'none', userSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [0, 35],
        }}
        className="w-full h-full"
        style={{ backgroundColor: 'transparent', outline: 'none' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const isHovered = hoveredCountry === geo.rsmKey;
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered ? 'rgba(30, 136, 229, 0.5)' : 'rgba(30, 136, 229, 0.25)'}
                  stroke={isHovered ? 'rgba(30, 136, 229, 1)' : 'rgba(30, 136, 229, 0.6)'}
                  strokeWidth={isHovered ? 1 : 0.5}
                  onMouseEnter={() => setHoveredCountry(geo.rsmKey)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              );
            })
          }
      </Geographies>
      {mapPoints.map((point) => (
        <Marker key={point.name} coordinates={point.coordinates}>
          <g>
            <circle r={3} fill="#1E88E5" style={{ filter: 'drop-shadow(0 0 4px rgba(30, 136, 229, 0.6))' }} />
          </g>
        </Marker>
      ))}
    </ComposableMap>
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
                className={`${colSpan} glass-cyber rounded-3xl p-6 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden flex flex-col`}
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
                        <motion.button
                          className="mt-2 py-1.5 rounded bg-[#1E88E5]/20 border border-[#1E88E5]/30 text-[#1E88E5] text-[10px] flex items-center justify-center gap-1.5 shrink-0"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Download className="w-3 h-3" />
                          {locale === 'ru' ? 'Экспорт' : 'Export'}
                        </motion.button>
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
                          viewport={{ once: true }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
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
