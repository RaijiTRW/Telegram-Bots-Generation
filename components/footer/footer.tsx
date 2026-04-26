'use client';

import type { SVGProps } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from '@/components/motion-wrapper';
import { TFlowLogo } from '@/components/logo';
import { Instagram, Youtube } from 'lucide-react';

function VkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.785 17.592c-6.314 0-9.914-4.329-10.065-11.53h3.163c.104 5.284 2.432 7.52 4.277 7.981V6.062h2.98v4.556c1.821-.197 3.732-2.27 4.377-4.556h2.98c-.495 2.813-2.568 4.886-4.043 5.739 1.475.691 3.836 2.5 4.735 5.791h-3.28c-.704-2.19-2.453-3.884-4.77-4.116v4.116h-.354z" />
    </svg>
  );
}

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
        { label: 'Возможности', href: `/${locale}#business-advantage` },
        { label: 'Цены', href: `/${locale}/pricing` },
        { label: 'Документация', href: `/${locale}/docs` },
        // { label: 'API', href: `/${locale}/docs` },
      ]
    : [
        { label: 'Features', href: `/${locale}#business-advantage` },
        { label: 'Pricing', href: `/${locale}/pricing` },
        { label: 'Documentation', href: `/${locale}/docs` },
        // { label: 'API', href: `/${locale}/docs` },
      ];

  const companyLinks = isRu
    ? [{ label: 'Контакты', href: `/${locale}/contact` }]
    : [{ label: 'Contact', href: `/${locale}/contact` }];

  const legalLinks = isRu
    ? [
        { label: 'Конфиденциальность', href: `/${locale}/privacy` },
        { label: 'Условия', href: `/${locale}/terms` },
        { label: 'Безопасность', href: `/${locale}/security` },
        { label: 'Статус', href: `/${locale}/status` },
      ]
    : [
        { label: 'Privacy', href: `/${locale}/privacy` },
        { label: 'Terms', href: `/${locale}/terms` },
        { label: 'Security', href: `/${locale}/security` },
        { label: 'Status', href: `/${locale}/status` },
      ];

  return (
    <footer className="border-t border-white/5 mt-auto relative overflow-hidden cyber-grid">
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10 md:py-20">
        {/* Footer Links Grid */}
        <div className="grid gap-7 md:grid-cols-4 md:gap-12 md:mb-12">
          {/* Brand Column */}
          <motion.div
          className="md:col-span-1"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34 }}
        >
            <Link href={`/${locale}`} className="flex items-center gap-3 md:mb-4 group">
              <TFlowLogo className="h-8 md:h-10" idPrefix="site-footer-logo" />
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/56 md:mt-0 md:leading-relaxed">
              {isRu ? 'Создание Telegram-ботов для заявок, записи, FAQ, прогрева и продаж без тяжёлой разработки.' : 'Build Telegram bots for leads, booking, FAQ, funnels, and sales without a heavy custom build.'}
            </p>
          </motion.div>

          {/* Quick Links */}
          <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.04 }}
        >
            <h4 className="mb-3 text-sm font-semibold text-white/88 md:mb-4">{isRu ? 'Продукт' : 'Product'}</h4>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 md:block md:space-y-2">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <motion.div whileHover={{ x: 3 }} className="inline-block">
                    <Link
                      href={link.href}
                      className="text-sm text-white/58 hover:text-white transition-colors inline-block"
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
            <h4 className="mb-3 text-sm font-semibold text-white/88 md:mb-4">{isRu ? 'Компания' : 'Company'}</h4>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 md:block md:space-y-2">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <motion.div whileHover={{ x: 3 }} className="inline-block">
                    <Link
                      href={link.href}
                    className="text-sm text-white/58 hover:text-white transition-colors inline-block"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
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
            <h4 className="mb-3 text-sm font-semibold text-white/88 md:mb-4">{isRu ? 'Правовая информация' : 'Legal'}</h4>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 md:block md:space-y-2">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <motion.div whileHover={{ x: 3 }} className="inline-block">
                    <Link
                      href={link.href}
                    className="text-sm text-white/58 hover:text-white transition-colors inline-block"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-5 md:mt-0 md:flex-row md:items-center md:pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={enterViewport}
          transition={{ duration: 0.32, delay: 0.14 }}
        >
          <div className="text-sm leading-6 text-white/54">
            © {currentYear} CBTooll. {isRu ? 'Создано для скорости, разработано для масштабирования.' : 'Built for speed, designed for scale.'}
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2.5 md:gap-4">
            <motion.a
              href="#"
              className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/58 hover:text-white hover:bg-white/10 transition-all md:h-10 md:w-10"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <VkIcon className="w-5 h-5" />
            </motion.a>
            <motion.a
              href="#"
              className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/58 hover:text-white hover:bg-white/10 transition-all md:h-10 md:w-10"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Instagram className="w-5 h-5" />
            </motion.a>
            <motion.a
              href="#"
              className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/58 hover:text-white hover:bg-white/10 transition-all md:h-10 md:w-10"
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Youtube className="w-5 h-5" />
            </motion.a>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
