'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { motion } from '@/components/motion-wrapper';
import { Briefcase } from 'lucide-react';
import { useInView, useReducedMotion } from 'framer-motion';
import { BorderBeam } from '@/components/ui/border-beam';

const audienceChips = {
  ru: ['Заявки', 'Запись', 'FAQ', 'Прогрев', 'Выдача материалов', 'Мини-воронки'],
  en: ['Leads', 'Booking', 'FAQ', 'Warm-up flows', 'Content delivery', 'Mini funnels'],
};

const starterSummary = {
  ru: {
    eyebrow: 'Почему это удобно на старте',
    title: 'Вы не тратите недели на ТЗ, созвоны и бесконечные правки.',
    body: [
      'Сначала быстро собираете рабочий сценарий и смотрите, даёт ли он заявки, запись или оплату.',
      'Если сценарий работает, вы развиваете его дальше без постоянной зависимости от подрядчика.',
      'Если не работает, вы это понимаете рано и не сливаете бюджет в тяжёлый кастом.',
    ],
  },
  en: {
    eyebrow: 'Why it works for an early launch',
    title: 'You do not spend weeks on specs, calls, and endless revisions.',
    body: [
      'First you launch a working scenario and check whether it drives leads, bookings, or payments.',
      'If it works, you keep improving it without constant dependence on a contractor.',
      'If it does not, you learn that early and avoid sinking budget into heavy custom work.',
    ],
  },
} as const;

const proofStats = [
  {
    id: 'time',
    value: 24,
    startValue: 0,
    prefix: '',
    suffix: 'ч',
    title: {
      ru: 'до первого рабочего сценария',
      en: 'to the first working scenario',
    },
    body: {
      ru: 'Если задача типовая: заявки, запись, FAQ или мини-воронка.',
      en: 'For standard flows like leads, booking, FAQ, or a mini funnel.',
    },
  },
  {
    id: 'developers',
    value: 0,
    startValue: 3,
    prefix: '',
    suffix: '',
    title: {
      ru: 'разработчиков нужно на старте',
      en: 'developers needed to get started',
    },
    body: {
      ru: 'Для типового MVP без долгой кастомной сборки.',
      en: 'For a typical MVP without a long custom build.',
    },
  },
  {
    id: 'budget',
    value: 80,
    startValue: 0,
    prefix: 'до ',
    suffix: 'k ₽',
    title: {
      ru: 'не нужно платить сразу',
      en: 'you do not need to spend upfront',
    },
    body: {
      ru: 'Чтобы просто проверить, даёт ли сценарий заявки, запись или оплату.',
      en: 'Just to validate whether the flow drives leads, bookings, or payments.',
    },
  },
  {
    id: 'focus',
    value: 1,
    startValue: 0,
    prefix: '',
    suffix: '',
    title: {
      ru: 'рабочий сценарий под задачу',
      en: 'working scenario per business goal',
    },
    body: {
      ru: 'Сначала запуск, потом решение, нужен ли вам тяжёлый кастом.',
      en: 'First launch, then decide whether heavy custom work is actually needed.',
    },
  },
];

const comparisonCards = [
  {
    id: 'custom',
    accent: '#7C4DFF',
    glow: 'rgba(124,77,255,0.28)',
    eyebrow: {
      ru: 'Когда путь тяжелее',
      en: 'When the path is heavier',
    },
    title: {
      ru: 'Кастомная разработка',
      en: 'Custom development',
    },
    description: {
      ru: 'Долгий старт, больше согласований, выше инерция.',
      en: 'A slower start, more approvals, and higher friction.',
    },
    points: [
      [6, 88],
      [14, 84],
      [22, 76],
      [30, 70],
      [38, 74],
      [46, 62],
      [54, 66],
      [62, 58],
      [70, 54],
      [78, 46],
      [86, 40],
      [94, 34],
    ] as const,
  },
  {
    id: 'cbtooll',
    accent: '#38BDF8',
    glow: 'rgba(56,189,248,0.28)',
    eyebrow: {
      ru: 'Когда старт короче',
      en: 'When the path is shorter',
    },
    title: {
      ru: 'CBTooll',
      en: 'CBTooll',
    },
    description: {
      ru: 'Быстрый запуск, ранняя проверка гипотезы, меньше лишних затрат на старте.',
      en: 'A faster launch, earlier validation, and less unnecessary upfront spend.',
    },
    points: [
      [6, 90],
      [12, 84],
      [18, 60],
      [24, 46],
      [32, 36],
      [40, 31],
      [48, 28],
      [58, 24],
      [68, 20],
      [78, 15],
      [86, 11],
      [94, 7],
    ] as const,
  },
];

function createSmoothPath(points: readonly (readonly [number, number])[]) {
  return points.reduce((path, point, index) => {
    const [x, y] = point;

    if (index === 0) {
      return `M ${x} ${y}`;
    }

    const [prevX, prevY] = points[index - 1];
    const controlX = (prevX + x) / 2;
    return `${path} C ${controlX} ${prevY}, ${controlX} ${y}, ${x} ${y}`;
  }, '');
}

function createAreaPath(points: readonly (readonly [number, number])[], baseline = 94) {
  if (points.length === 0) {
    return '';
  }

  const linePath = createSmoothPath(points);
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  return `${linePath} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
}

function formatAnimatedNumber(value: number, decimals: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function AnimatedMetric({
  value,
  startValue = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  decimals = 0,
}: {
  value: number;
  startValue?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-12% 0px' });
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(startValue);

  useEffect(() => {
    if (!isInView) {
      return;
    }

    if (prefersReducedMotion) {
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    const delta = value - startValue;

    const tick = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + delta * eased);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [duration, isInView, prefersReducedMotion, startValue, value]);

  const resolvedValue = prefersReducedMotion && isInView ? value : displayValue;
  const roundedValue = decimals > 0
    ? Number(resolvedValue.toFixed(decimals))
    : Math.round(resolvedValue);

  return (
    <span ref={ref} className="font-mono tabular-nums tracking-tight">
      {prefix}
      {formatAnimatedNumber(roundedValue, decimals)}
      {suffix}
    </span>
  );
}

function ComparisonGraphCard({
  id,
  eyebrow,
  title,
  description,
  accent,
  glow,
  points,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  glow: string;
  points: readonly (readonly [number, number])[];
}) {
  const prefersReducedMotion = useReducedMotion();
  const path = createSmoothPath(points);
  const areaPath = createAreaPath(points);
  const [lastX, lastY] = points[points.length - 1];
  const lineGradientId = `comparison-line-${id}`;
  const areaGradientId = `comparison-area-${id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '240px 0px' }}
      transition={{ duration: 0.36 }}
      className="relative overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl"
    >
      <div
        className="absolute inset-x-6 top-6 h-24 rounded-full blur-3xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 72%)` }}
      />

      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
          {eyebrow}
        </div>
        <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>

        <div className="mt-5 rounded-[20px] border border-white/6 bg-[linear-gradient(180deg,rgba(6,8,14,0.96),rgba(11,12,19,0.82))] px-4 py-4">
          <svg viewBox="0 0 100 100" className="h-44 w-full overflow-visible">
            <defs>
              <linearGradient id={lineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={accent} stopOpacity="0.78" />
                <stop offset="100%" stopColor={accent} stopOpacity="1" />
              </linearGradient>
              <linearGradient id={areaGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.015" />
              </linearGradient>
            </defs>

            {[18, 36, 54, 72, 90].map((y) => (
              <path
                key={y}
                d={`M 4 ${y} H 96`}
                stroke="rgba(255,255,255,0.09)"
                strokeWidth="0.8"
                fill="none"
              />
            ))}

            <motion.path
              d={areaPath}
              fill={`url(#${areaGradientId})`}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: prefersReducedMotion ? 0 : 0.38 }}
            />

            <path
              d={path}
              stroke={accent}
              strokeOpacity="0.14"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            <motion.path
              d={path}
              stroke={`url(#${lineGradientId})`}
              strokeWidth="3.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0.75 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: prefersReducedMotion ? 0 : 1.2, ease: 'easeOut' }}
            />

            <motion.g
              initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.28, delay: prefersReducedMotion ? 0 : 0.9 }}
              style={{ transformOrigin: `${lastX}px ${lastY}px` }}
            >
              <circle cx={lastX} cy={lastY} r="7" fill={accent} fillOpacity="0.11" />
              <circle cx={lastX} cy={lastY} r="4" fill={accent} fillOpacity="0.22" />
              <circle cx={lastX} cy={lastY} r="2.2" fill={accent} />
            </motion.g>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-white/74">{description}</p>
      </div>
    </motion.div>
  );
}

export function BusinessAdvantage() {
  const locale = useLocale();
  const isRu = locale === 'ru';
  const summary = isRu ? starterSummary.ru : starterSummary.en;
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  return (
    <section id="business-advantage" className="relative overflow-hidden px-4 py-24 md:py-28 cyber-grid">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/82 backdrop-blur-xl">
            <Briefcase className="h-4 w-4 text-[#38BDF8]" />
            {isRu ? 'Для бизнеса' : 'For business'}
          </span>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-5xl">
            {isRu ? (
              <>
                Не бот ради бота, а{' '}
                <span className="bg-gradient-to-r from-[#1E88E5] via-[#38BDF8] to-[#7C4DFF] bg-clip-text text-transparent">
                  быстрый запуск задачи
                </span>
              </>
            ) : (
              <>
                Not a bot for the sake of a bot, but a{' '}
                <span className="bg-gradient-to-r from-[#1E88E5] via-[#38BDF8] to-[#7C4DFF] bg-clip-text text-transparent">
                  faster business launch
                </span>
              </>
            )}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-white/74">
            {isRu
              ? 'CBTooll нужен бизнесу, которому надо быстро запустить Telegram-бота для заявок, записи, FAQ, прогрева или выдачи материалов без долгой кастомной разработки и без тех. боли на старте.'
              : 'CBTooll is for teams that need to launch Telegram bots for leads, booking, FAQ, warm-up flows, or content delivery without long custom development or early technical overhead.'}
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {proofStats.map((item, index) => {
            const title = isRu ? item.title.ru : item.title.en;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={enterViewport}
                transition={{ duration: 0.34, delay: 0.06 + index * 0.05 }}
                className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 backdrop-blur-xl"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  {isRu ? 'Ориентир по запуску' : 'Launch benchmark'}
                </div>
                <div className="mt-5 overflow-hidden text-4xl font-bold text-white md:text-5xl">
                  <AnimatedMetric
                    value={item.value}
                    startValue={item.startValue}
                    prefix={item.prefix}
                    suffix={item.suffix}
                  />
                </div>
                <div className="mt-4 text-lg font-semibold leading-7 text-white">
                  {title}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={enterViewport}
            transition={{ duration: 0.4, delay: 0.04 }}
            className="relative overflow-hidden rounded-[28px] border border-[#1E88E5]/18 bg-[linear-gradient(145deg,rgba(8,14,24,0.95),rgba(8,11,18,0.82))] p-6 md:p-7"
          >
            <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">
              <BorderBeam duration={24} size={340} roundedClassName="rounded-[28px]" />
            </div>

            <div className="relative">
              <div className="flex flex-wrap gap-2">
                {(isRu ? audienceChips.ru : audienceChips.en).map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  {summary.eyebrow}
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={enterViewport}
                transition={{ duration: 0.34, delay: 0.08 }}
                className="mt-4 rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl"
              >
                <p className="max-w-4xl text-lg font-semibold leading-8 text-white md:text-xl">
                  {summary.title}
                </p>
                <div className="mt-4 space-y-3 max-w-4xl text-sm leading-7 text-white/76 md:text-base">
                  {summary.body.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {comparisonCards.map((card) => (
            <ComparisonGraphCard
              key={card.id}
              id={card.id}
              eyebrow={isRu ? card.eyebrow.ru : card.eyebrow.en}
              title={isRu ? card.title.ru : card.title.en}
              description={isRu ? card.description.ru : card.description.en}
              accent={card.accent}
              glow={card.glow}
              points={card.points}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
