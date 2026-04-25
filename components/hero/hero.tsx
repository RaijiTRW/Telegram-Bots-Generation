'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion, AnimatePresence } from '@/components/motion-wrapper';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Terminal,
  GitBranch,
  Zap,
  Sparkles,
  ChevronsDown,
  CheckCircle2,
} from 'lucide-react';

// Business flow visualization component
function LogicNode({
  label,
  delay,
  isActive,
}: {
  label: string;
  delay: number;
  isActive: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, x: -20 }}
      animate={{
        opacity: isActive ? 1 : 0.4,
        scale: isActive ? 1 : 0.95,
        x: 0,
      }}
      transition={{
        duration: 0.4,
        delay,
        ease: 'easeOut',
      }}
      className="relative"
    >
      {/* Node connector line */}
      <motion.div
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-6 h-0.5 bg-gradient-to-r from-transparent to-[#1E88E5]/50 md:w-8"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3, delay: delay + 0.1 }}
      />

      {/* Node content */}
      <div
        className={`glass-panel rounded-lg px-2.5 py-1.5 border-l-2 md:px-3 md:py-2 ${isActive ? 'border-l-[#1E88E5]' : 'border-l-white/10'
          }`}
      >
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-[#1E88E5]" />
          <span className="font-mono text-[11px] text-white/80 md:text-xs">{label}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const locale = useLocale();
  const [isTyping, setIsTyping] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [activeNodes, setActiveNodes] = useState<number[]>([]);
  const exampleTimeoutRef = useRef<number | null>(null);

  const examplePrompt = locale === 'ru' ? 'Создать Telegram-бота для заявок и FAQ моего бизнеса...' : 'Create a Telegram bot for leads and FAQ in my business...';
  const placeholderPrompt = locale === 'ru' ? 'Опишите Telegram-бота для бизнеса...' : 'Describe the business Telegram bot you need...';
  const visiblePrompt = isTyping ? examplePrompt.slice(0, typedLength) : placeholderPrompt;
  const heroBody = locale === 'ru'
    ? 'Заявки, запись, FAQ и продажи в одном конструкторе. Быстрый запуск без кода и отдельного backend на старте.'
    : 'Leads, booking, FAQ, and sales in one builder. Launch fast without code or a separate backend on day one.';

  // Simulate node tree building
  useEffect(() => {
    if (!isTyping) {
      return;
    }

    const intervals = [
      window.setTimeout(() => setActiveNodes([0]), 800),
      window.setTimeout(() => setActiveNodes([0, 1]), 1400),
      window.setTimeout(() => setActiveNodes([0, 1, 2]), 2000),
      window.setTimeout(() => setActiveNodes([0, 1, 2, 3]), 2600),
    ];

    return () => intervals.forEach(window.clearTimeout);
  }, [isTyping]);

  useEffect(() => {
    if (!isTyping || typedLength >= examplePrompt.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setTypedLength((current) => Math.min(current + 1, examplePrompt.length));
    }, 42);

    return () => window.clearTimeout(timeout);
  }, [examplePrompt, isTyping, typedLength]);

  useEffect(() => {
    return () => {
      if (exampleTimeoutRef.current !== null) {
        window.clearTimeout(exampleTimeoutRef.current);
      }
    };
  }, []);

  const nodes = [
    { label: locale === 'ru' ? 'Старт в Telegram' : 'Telegram start', delay: 0.1 },
    { label: locale === 'ru' ? 'Выбор задачи' : 'Need selection', delay: 0.3 },
    { label: locale === 'ru' ? 'Сбор контакта' : 'Contact capture', delay: 0.5 },
    { label: locale === 'ru' ? 'Заявка в CRM' : 'Lead to CRM', delay: 0.7 },
  ];

  const previewResults = locale === 'ru'
    ? [
        'Бот сразу отвечает и ведёт по сценарию.',
        'Контакт и запрос собираются без ручной переписки.',
        'Менеджер получает уже готовую заявку.',
      ]
    : [
        'The bot replies instantly and moves the user through the flow.',
        'Contact data and request are captured without manual back-and-forth.',
        'The manager gets a ready-to-handle lead.',
      ];

  const handleScrollToFeatures = () => {
    const target = document.getElementById('business-advantage');

    if (!target) {
      window.location.hash = 'business-advantage';
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `/${locale}#business-advantage`);
  };

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pb-6 pt-20 md:pb-8 md:pt-24 cyber-grid cyber-noise">
      {/* Ambient glow effects - static for performance */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(30, 136, 229, 0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto w-full z-10">
        <div className="grid items-center gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Left Column - Console Interface */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 md:mb-5"
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full glass-panel px-3 py-1.5 md:mb-4">
                <Sparkles className="w-3.5 h-3.5 text-[#7C4DFF]" />
                <span className="text-xs font-mono text-white/60">{locale === 'ru' ? 'Генерация на основе ИИ' : 'AI-Powered Generation'}</span>
              </div>

              <h1 className="mb-3 max-w-[11ch] text-[3.15rem] font-bold leading-[0.9] tracking-[-0.04em] sm:text-[3.9rem] md:mb-4 md:text-[4.35rem] xl:text-[5rem]">
                {locale === 'ru' ? (
                  <>
                    Telegram-боты для бизнеса{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                      без сложной разработки.
                    </span>
                  </>
                ) : (
                  <>
                    Telegram bots for business{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                      without custom development.
                    </span>
                  </>
                )}
              </h1>

              <p className="max-w-[34rem] text-[15px] leading-relaxed text-white/60 md:text-[1.05rem]">
                {heroBody}
              </p>
            </motion.div>

            {/* Console Interface */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative group"
            >
              <div className="relative overflow-hidden rounded-xl">
                <BorderBeam duration={12} size={300} roundedClassName="rounded-xl" />

                <div className="relative h-full rounded-xl glass-panel">
                  {/* Console header */}
                  <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2 md:px-4 md:py-2.5">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-[#1E88E5]" />
                      <span className="text-xs font-mono text-white/60">cbtooll-cli</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
                    </div>
                  </div>

                  {/* Console body */}
                  <div className="min-h-[144px] p-3 font-mono text-sm md:min-h-[152px] md:p-3.5">
                    {/* Prompt line */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[#1E88E5]">$</span>
                      <div className="flex-1">
                        {isTyping ? (
                          <span className="text-white/90">
                            {visiblePrompt}
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block w-2 h-4 bg-[#1E88E5] ml-1 align-middle"
                            />
                          </span>
                        ) : (
                          <span className="text-white/40">
                            {visiblePrompt}
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block w-2 h-4 bg-[#1E88E5]/50 ml-1 align-middle"
                            />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Console output */}
                    <AnimatePresence>
                      {isTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-2.5 space-y-1 text-xs"
                        >
                          <div className="text-[#00E676]">
                            {locale === 'ru' ? '→ Анализ требований...' : '→ Analyzing requirements...'}
                          </div>
                          <div className="text-white/60">
                            {locale === 'ru' ? '→ Построение дерева логики...' : '→ Building logic tree...'}
                          </div>
                          <div className="text-white/60">
                            {locale === 'ru' ? '→ Настройка обработчиков...' : '→ Configuring handlers...'}
                          </div>
                          <div className="text-[#7C4DFF]">
                            {locale === 'ru' ? '✓ Бот готов к развертыванию' : '✓ Bot ready for deployment'}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Console footer */}
                  <div className="flex items-center justify-between border-t border-white/5 px-3.5 py-2 md:px-4 md:py-2.5">
                    <Link
                      href={`/${locale}/auth/signup`}
                      onClick={() => setIsTyping(true)}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{locale === 'ru' ? 'Создать и запустить бота' : 'Create & launch a bot'}</span>
                    </Link>

                    <button
                      onClick={() => {
                        if (exampleTimeoutRef.current !== null) {
                          window.clearTimeout(exampleTimeoutRef.current);
                        }
                        setTypedLength(0);
                        setActiveNodes([]);
                        setIsTyping(true);
                        exampleTimeoutRef.current = window.setTimeout(() => {
                          setActiveNodes([]);
                          setIsTyping(false);
                          exampleTimeoutRef.current = null;
                        }, 4000);
                      }}
                      className="text-xs text-white/40 hover:text-white/60 transition-colors font-mono"
                    >
                      {locale === 'ru' ? 'Запустить пример →' : 'Run example →'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Logic Tree Visualization */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative w-full lg:max-w-[560px] lg:justify-self-end"
          >
            <div className="relative min-h-[304px] rounded-xl glass-panel p-4 md:min-h-[318px] md:p-5 lg:min-h-[308px] lg:p-4">
              {/* Tree header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-[#1E88E5] md:h-5 md:w-5" />
                  <h3 className="text-sm font-semibold md:text-base">{locale === 'ru' ? 'Сценарий клиента' : 'Customer flow'}</h3>
                </div>
                <div className="flex items-center gap-1.5 rounded border border-[#00E676]/20 bg-[#00E676]/10 px-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                  <span className="text-xs font-mono text-[#00E676]">{locale === 'ru' ? 'Сбор заявок' : 'Lead flow'}</span>
                </div>
              </div>

              {/* Node tree */}
              <div className="space-y-2 pl-3 md:pl-4">
                {nodes.map((node, index) => (
                  <LogicNode
                    key={index}
                    label={node.label}
                    delay={node.delay}
                    isActive={activeNodes.includes(index)}
                  />
                ))}
              </div>

              {/* Business summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-4 rounded-lg border border-white/5 bg-black/30 p-3 md:p-3.5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45 md:text-xs">
                  {locale === 'ru' ? 'Результат для бизнеса' : 'Business outcome'}
                </div>
                <div className="mt-3 space-y-2.5">
                  {previewResults.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm leading-6 text-white/74">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={handleScrollToFeatures}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center justify-center text-white/45 transition-colors hover:text-white/75 md:bottom-4"
        aria-label={locale === 'ru' ? 'Перейти к возможностям' : 'Jump to features'}
      >
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[#38BDF8]"
        >
          <ChevronsDown className="h-5 w-5" />
        </motion.div>
      </motion.button>
    </section>
  );
}
