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
  Bot,
  FileArchive,
  ArrowRight,
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
    title: { ru: 'Размещение на нашей стороне', en: 'Hosted for you' },
    description: {
      ru: 'Бот работает без отдельного сервера и не требует ручного DevOps при запуске и росте.',
      en: 'Your bot stays online without managing servers or deployment setup as it grows.',
    },
    type: 'map' as const,
  },
  {
    id: 'code',
    size: 'medium' as const,
    icon: Code2,
    title: { ru: 'Экспорт и контроль', en: 'Export and control' },
    description: {
      ru: 'Можно остаться на платформе сейчас и забрать готовый код позже, когда проект вырастет.',
      en: 'Stay on-platform now and export production-ready code later when the project grows.',
    },
    type: 'code' as const,
  },
  {
    id: 'analytics',
    size: 'small' as const,
    icon: BarChart3,
    title: { ru: 'Платежи и аналитика', en: 'Payments and analytics' },
    description: {
      ru: 'Заявки, оплаты и активность видны в одном месте, без ручных таблиц и догадок.',
      en: 'Leads, payments, and activity stay visible in one place without manual spreadsheets.',
    },
    type: 'chart' as const,
  },
  {
    id: 'security',
    size: 'small' as const,
    icon: Shield,
    title: { ru: 'Надёжность и защита', en: 'Security and reliability' },
    description: {
      ru: 'Безопасное хранение, контроль доступов и меньше рисков в ежедневной работе.',
      en: 'Secure storage, controlled access, and less operational risk day to day.',
    },
    type: 'security' as const,
  },
];

const platformOutcomes = [
  {
    id: 'launch',
    icon: Server,
    title: {
      ru: 'Запуск без лишней сборки',
      en: 'Launch without the extra stack',
    },
    description: {
      ru: 'Не нужно отдельно искать хостинг, аналитику и вспомогательные сервисы, чтобы выпустить первую рабочую версию.',
      en: 'You do not need separate hosting, analytics, and support tooling just to ship the first working version.',
    },
  },
  {
    id: 'scale',
    icon: BarChart3,
    title: {
      ru: 'Рост без переезда на другой стек',
      en: 'Grow without rebuilding the stack',
    },
    description: {
      ru: 'Когда бот начинает приносить заявки и оплаты, не приходится пересобирать продукт заново.',
      en: 'Once the bot starts driving leads and payments, you do not need to rebuild the product from scratch.',
    },
  },
  {
    id: 'control',
    icon: Code2,
    title: {
      ru: 'Контроль без потери гибкости',
      en: 'Control without losing flexibility',
    },
    description: {
      ru: 'Сценарии, размещение, аналитика и экспорт уже связаны между собой и не мешают команде развиваться дальше.',
      en: 'Flows, hosting, analytics, and export already work together and still leave room for the team to grow later.',
    },
  },
];

export function Features() {
  const locale = useLocale();
  const isRu = locale === 'ru';
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  return (
    <section
      id="features"
      className="relative overflow-hidden px-4 py-24 scroll-mt-24 md:py-32 md:scroll-mt-28 cyber-grid cyber-noise"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="text-center mb-16"
        >
          <motion.span
            className="inline-block rounded-full glass-panel px-4 py-2 text-sm font-medium text-white/82 mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={enterViewport}
            transition={{ duration: 0.34 }}
          >
            {isRu ? 'Возможности платформы' : 'Platform capabilities'}
          </motion.span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {isRu ? (
              <>
                Не просто конструктор, а{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  рабочая платформа
                </span>
              </>
            ) : (
              <>
                Not just a builder, but a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                  working platform
                </span>
              </>
            )}
          </h2>
          <p className="text-lg text-white/74 max-w-2xl mx-auto">
            {isRu
              ? 'Запуск, размещение, аналитика и контроль собраны в одном контуре. Меньше ручной сборки, меньше разрозненных сервисов и быстрее путь от идеи до рабочего бота.'
              : 'Launch, hosting, analytics, and control sit in one workflow. Less manual setup, fewer disconnected tools, and a faster path from idea to a working bot.'}
          </p>
        </motion.div>

        {/* Bento Grid Layout */}
        <div className="grid md:grid-cols-4 gap-6 auto-rows-[200px]">
          {infrastructureBlocks.map((block, index) => {
            const Icon = block.icon;
            const title = typeof block.title === 'string' ? block.title : (isRu ? block.title.ru : block.title.en);
            const description = typeof block.description === 'string' ? block.description : (isRu ? block.description.ru : block.description.en);

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
                      <p className="text-white/74 text-xs leading-relaxed">
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
                        {isRu ? 'Глобальная сеть' : 'Global network'}
                      </div>
                    </div>
                  )}

                  {block.type === 'code' && (
                    <div className="mt-auto pt-4">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7C4DFF]/15 text-[#A78BFA] shrink-0">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {isRu ? 'Готовый бот' : 'Ready bot'}
                              </div>
                              <div className="truncate text-xs font-medium text-white/70">
                                {isRu ? 'Остаётся на платформе' : 'Stays on-platform'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 text-[#38BDF8]">
                          <ArrowRight className="h-4 w-4" />
                          <Download className="h-4 w-4" />
                          <ArrowRight className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1 rounded-2xl border border-[#1E88E5]/20 bg-[#1E88E5]/10 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E88E5]/15 text-[#38BDF8] shrink-0">
                              <FileArchive className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-white">
                                {isRu ? 'ZIP-архив' : 'ZIP archive'}
                              </div>
                              <div className="truncate text-xs font-medium text-white/72">
                                {isRu ? 'Скачать при необходимости' : 'Export when needed'}
                              </div>
                            </div>
                          </div>
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
                    <div className="mt-auto pt-4">
                      <div className="text-xs font-semibold text-white mb-1">
                        {isRu ? 'Защита данных' : 'Protected data'}
                      </div>
                      <div className="text-xs font-medium text-white/68">
                        {isRu ? 'Secure-by-default' : 'Secure-by-default'}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {platformOutcomes.map((item, index) => {
              const Icon = item.icon;
              const title = isRu ? item.title.ru : item.title.en;
              const description = isRu ? item.description.ru : item.description.en;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={enterViewport}
                  transition={{ duration: 0.34, delay: 0.08 + index * 0.04 }}
                  className="rounded-3xl border border-white/8 bg-black/30 p-5 backdrop-blur-xl"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[#38BDF8]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/74">{description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
