'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { motion, AnimatePresence } from '@/components/motion-wrapper';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  Terminal,
  GitBranch,
  Zap,
  Code,
  Bot,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

// Typing animation hook
function useTypingEffect(text: string, speed: number = 50) {
  const [displayText, setDisplayText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(text.slice(0, index + 1));
        setIndex(index + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed]);

  return displayText;
}

// Logic node visualization component
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
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-8 h-0.5 bg-gradient-to-r from-transparent to-[#1E88E5]/50"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3, delay: delay + 0.1 }}
      />

      {/* Node content */}
      <div
        className={`glass-panel rounded-lg px-3 py-2 border-l-2 ${isActive ? 'border-l-[#1E88E5]' : 'border-l-white/10'
          }`}
      >
        <div className="flex items-center gap-2">
          <Code className="w-3 h-3 text-[#1E88E5]" />
          <span className="text-xs font-mono text-white/80">{label}</span>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const t = useTranslations('hero');
  const locale = useLocale();
  const [prompt, setPrompt] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeNodes, setActiveNodes] = useState<number[]>([]);

  const examplePrompt = locale === 'ru' ? 'Создать бота продаж для моего магазина...' : 'Create a sales bot for my online store...';
  const typedPrompt = useTypingEffect(examplePrompt, 50);

  // Simulate node tree building
  useEffect(() => {
    if (isTyping) {
      const intervals = [
        setTimeout(() => setActiveNodes([0]), 800),
        setTimeout(() => setActiveNodes([0, 1]), 1400),
        setTimeout(() => setActiveNodes([0, 1, 2]), 2000),
        setTimeout(() => setActiveNodes([0, 1, 2, 3]), 2600),
      ];

      return () => intervals.forEach(clearTimeout);
    }
  }, [isTyping]);

  const nodes = [
    { label: '/start', delay: 0.1 },
    { label: 'menu_flow', delay: 0.3 },
    { label: 'catalog_view', delay: 0.5 },
    { label: 'order_handler', delay: 0.7 },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-20 overflow-hidden cyber-grid cyber-noise">
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
        <div className="grid lg:grid-cols-2 gap-8 items-center">
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
              className="mb-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel mb-6">
                <Sparkles className="w-3.5 h-3.5 text-[#7C4DFF]" />
                <span className="text-xs font-mono text-white/60">{locale === 'ru' ? 'Генерация на основе ИИ' : 'AI-Powered Generation'}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
                {locale === 'ru' ? (
                  <>
                    Создавайте ботов со{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                      скоростью мысли.
                    </span>
                  </>
                ) : (
                  <>
                    Build bots at the{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF]">
                      speed of thought.
                    </span>
                  </>
                )}
              </h1>

              <p className="text-lg text-white/60 max-w-xl">
                {locale === 'ru' ? (
                  <>Опишите вашего бота простым языком. Наблюдайте, как ИИ строит логику, настраивает функции и разворачивает — всё в реальном времени.</>
                ) : (
                  <>Describe your bot in plain language. Watch as AI constructs the logic, configures features, and deploys — all in real-time.</>
                )}
              </p>
            </motion.div>

            {/* Console Interface */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="relative group"
            >
              <div className="relative rounded-xl overflow-hidden">
                <BorderBeam duration={12} size={300} roundedClassName="rounded-xl" />

                <div className="relative glass-panel rounded-xl h-full">
                  {/* Console header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
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
                  <div className="p-4 min-h-[200px] font-mono text-sm">
                    {/* Prompt line */}
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[#1E88E5]">$</span>
                      <div className="flex-1">
                        {isTyping ? (
                          <span className="text-white/90">
                            {typedPrompt}
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="inline-block w-2 h-4 bg-[#1E88E5] ml-1 align-middle"
                            />
                          </span>
                        ) : (
                          <span className="text-white/40">
                            {prompt || (locale === 'ru' ? 'Опишите вашего бота...' : 'Describe your bot...')}
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
                          className="space-y-1 mt-4 text-xs"
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
                  <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                    <Link
                      href={`/${locale}/dashboard`}
                      onClick={() => setIsTyping(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1E88E5] to-[#7C4DFF] rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{locale === 'ru' ? 'Сгенерировать и запустить' : 'Generate & Launch'}</span>
                    </Link>

                    <button
                      onClick={() => {
                        setIsTyping(true);
                        setTimeout(() => setIsTyping(false), 4000);
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
            className="relative"
          >
            <div className="relative glass-panel rounded-xl p-6 min-h-[400px]">
              {/* Tree header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-[#1E88E5]" />
                  <h3 className="font-semibold">{locale === 'ru' ? 'Дерево логики' : 'Logic Tree'}</h3>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#00E676]/10 border border-[#00E676]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                  <span className="text-xs font-mono text-[#00E676]">LIVE</span>
                </div>
              </div>

              {/* Node tree */}
              <div className="space-y-3 pl-4">
                {nodes.map((node, index) => (
                  <LogicNode
                    key={index}
                    label={node.label}
                    delay={node.delay}
                    isActive={activeNodes.includes(index)}
                  />
                ))}
              </div>

              {/* Tree preview code snippet */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="mt-6 p-4 rounded-lg bg-black/30 border border-white/5 font-mono text-xs"
              >
                <pre className="text-white/70">
                  <span className="text-[#7C4DFF]">const</span> bot = {'{'}
                  <br />
                  <span className="ml-4 text-[#1E88E5]">handlers</span>: [
                  <br />
                  <span className="ml-8">startHandler,</span>
                  <br />
                  <span className="ml-8">menuFlow,</span>
                  <br />
                  <span className="ml-8">catalogView</span>
                  <br />
                  <span className="ml-4">]</span>
                  <br />
                  {'}'};
                </pre>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
