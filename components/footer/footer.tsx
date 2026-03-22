'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from '@/components/motion-wrapper';
import { TFlowLogo } from '@/components/logo';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  const locale = useLocale();
  const currentYear = new Date().getFullYear();

  const isRu = locale === 'ru';
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  const productLinks = isRu
    ? [
        { label: 'Возможности', href: `/${locale}#features` },
        { label: 'Цены', href: `/${locale}/pricing` },
        { label: 'Документация', href: `/${locale}/docs` },
        { label: 'API', href: `/${locale}/docs` },
      ]
    : [
        { label: 'Features', href: `/${locale}#features` },
        { label: 'Pricing', href: `/${locale}/pricing` },
        { label: 'Documentation', href: `/${locale}/docs` },
        { label: 'API', href: `/${locale}/docs` },
      ];

  const companyLinks = isRu
    ? ['О нас', 'Блог', 'Карьера', 'Контакты']
    : ['About', 'Blog', 'Careers', 'Contact'];

  const legalLinks = isRu
    ? ['Конфиденциальность', 'Условия', 'Безопасность', 'Статус']
    : ['Privacy', 'Terms', 'Security', 'Status'];

  return (
    <footer className="border-t border-white/5 mt-auto relative overflow-hidden cyber-grid">
      <div className="max-w-7xl mx-auto px-4 py-24 relative z-10">
        {/* Main CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-8">
            {isRu ? (
              <>
                Готовы создать своего{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#00E676]">
                  первого бота?
                </span>
              </>
            ) : (
              <>
                Ready to build your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1E88E5] to-[#00E676]">
                  first bot?
                </span>
              </>
            )}
          </h2>

          {/* Huge CTA Button with expanding glow */}
          <motion.div
            className="relative inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Expanding glow effect on hover */}
            <Link
              href={`/${locale}/dashboard`}
              className="relative px-16 py-6 rounded-full text-xl font-bold text-white shadow-2xl inline-flex items-center gap-4"
              style={{
                background: 'linear-gradient(135deg, #1E88E5, #00E676)',
              }}
            >
              <span className="drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]">
                {isRu ? 'Развернуть первого бота сейчас' : 'Deploy your first bot now'}
              </span>
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>

        {/* System Status Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.08 }}
          className="flex items-center justify-center gap-4 mb-16"
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: '#00E676',
              boxShadow: '0 0 14px rgba(0, 230, 118, 0.28)',
            }}
          />
          <span className="text-white/60 font-mono text-sm">{isRu ? 'Статус системы: ' : 'System Status: '}</span>
          <span className="text-[#00E676] font-semibold">{isRu ? 'Работает' : 'Operational'}</span>
        </motion.div>

        {/* Footer Links Grid */}
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <motion.div
          className="md:col-span-1"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34 }}
        >
            <Link href={`/${locale}`} className="flex items-center gap-2 mb-4 group">
              <TFlowLogo className="w-32 h-10" showText={false} idPrefix="site-footer-logo" />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed">
              {isRu ? 'Создавайте Telegram ботов за 60 секунд с помощью ИИ. Без кода, без серверов.' : 'Create Telegram bots in 60 seconds with AI. No code, no servers.'}
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.04 }}
        >
            <h4 className="font-semibold mb-4 text-sm">{isRu ? 'Продукт' : 'Product'}</h4>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <motion.div whileHover={{ x: 3 }} className="inline-block">
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white transition-colors inline-block"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company Links */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.08 }}
        >
            <h4 className="font-semibold mb-4 text-sm">{isRu ? 'Компания' : 'Company'}</h4>
            <ul className="space-y-2">
              {companyLinks.map((link) => (
                <li key={link}>
                  <motion.a
                    href="#"
                    className="text-sm text-white/60 hover:text-white transition-colors inline-block"
                    whileHover={{ x: 3 }}
                  >
                    {link}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal Links */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.12 }}
        >
            <h4 className="font-semibold mb-4 text-sm">{isRu ? 'Правовая информация' : 'Legal'}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link}>
                  <motion.a
                    href="#"
                    className="text-sm text-white/60 hover:text-white transition-colors inline-block"
                    whileHover={{ x: 3 }}
                  >
                    {link}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={enterViewport}
          transition={{ duration: 0.32, delay: 0.14 }}
        >
          <div className="text-sm text-white/60">
            © {currentYear} CBTooll. {isRu ? 'Создано для скорости, разработано для масштабирования.' : 'Built for speed, designed for scale.'}
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <motion.a
              href="#"
              className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Github className="w-5 h-5" />
            </motion.a>
            <motion.a
              href="#"
              className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Twitter className="w-5 h-5" />
            </motion.a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
