'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, X, Globe } from 'lucide-react';
import { motion, AnimatePresence } from '@/components/motion-wrapper';
import { CompactLogo } from '@/components/logo';
import { UserMenuDropdown } from '@/components/header/user-menu-dropdown';
import { createClient } from '@/lib/supabase/client';

export function Header() {
  const t = useTranslations('header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ userName: string; userEmail: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const userName = data.user.user_metadata.full_name || data.user.email?.split('@')[0] || '';
        setUser({
          userName,
          userEmail: data.user.email || '',
        });
      } else {
        setUser(null);
      }
    };
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userName = session.user.user_metadata.full_name || session.user.email?.split('@')[0] || '';
        setUser({
          userName,
          userEmail: session.user.email || '',
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const switchLocale = (newLocale: string) => {
    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname;
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/';
    }
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  const navItems = [
    { key: 'nav.features', href: '#features' },
    { key: 'nav.templates', href: '#templates' },
    { key: 'nav.pricing', href: '#pricing' },
    { key: 'nav.docs', href: '#docs' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 group"
            aria-label="TFlow Home"
          >
            <div className="relative">
              <CompactLogo className="w-12 h-10" />
              <motion.div
                className="absolute inset-0 bg-[#24A1DE]/20 blur-xl rounded-full"
                animate={{
                  opacity: [0.3, 0.5, 0.3],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
            {/* Текст TFlow показываем только на десктопе */}
            <span className="hidden lg:block text-xl font-bold gradient-text">
              TFlow
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item, index) => (
              <motion.a
                key={item.key}
                href={item.href}
                className="text-sm text-white/60 hover:text-white transition-colors relative"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -2 }}
              >
                {t(item.key)}
                <motion.span
                  className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-primary"
                  whileHover={{ width: '100%' }}
                  transition={{ duration: 0.3 }}
                />
              </motion.a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Switcher */}
            <motion.button
              onClick={() => switchLocale(locale === 'ru' ? 'en' : 'ru')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Switch language"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Globe className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium">
                {locale === 'ru' ? 'EN' : 'RU'}
              </span>
            </motion.button>

            {user ? (
              <UserMenuDropdown userName={user.userName} userEmail={user.userEmail} />
            ) : (
              <>
                <Link
                  href={`/${locale}/auth/login`}
                  className="px-4 py-2 text-sm font-medium text-white hover:text-[#24A1DE] transition-colors"
                >
                  {t('buttons.login')}
                </Link>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="#cta"
                    className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg inline-block"
                  >
                    {t('buttons.createBot')}
                  </Link>
                </motion.div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
            whileTap={{ scale: 0.9 }}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-white/10"
          >
            <div className="px-4 py-6 space-y-4">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.key}
                  href={item.href}
                  className="block py-2 text-white/60 hover:text-white transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  {t(item.key)}
                </motion.a>
              ))}
              <motion.div
                className="pt-4 border-t border-white/10 space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.2 }}
              >
                <button
                  onClick={() => switchLocale(locale === 'ru' ? 'en' : 'ru')}
                  className="flex items-center gap-2 w-full px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>
                    {locale === 'ru'
                      ? 'Переключить на английский'
                      : 'Switch to Russian'}
                  </span>
                </button>

                {user ? (
                  <>
                    <div className="px-4 py-2 bg-white/5 rounded-lg">
                      <p className="text-sm font-medium text-white">{user.userName}</p>
                      {user.userEmail && (
                        <p className="text-xs text-zinc-500">{user.userEmail}</p>
                      )}
                    </div>
                    <Link
                      href={`/${locale}/dashboard`}
                      className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('userMenu.dashboard')}
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/profile`}
                      className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('userMenu.profile')}
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/settings`}
                      className="block px-4 py-2 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors rounded-lg"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('userMenu.settings')}
                    </Link>
                    <button
                      onClick={async () => {
                        const { createClient } = await import('@/lib/supabase/client');
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        router.push(`/${locale}`);
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors rounded-lg"
                    >
                      {t('userMenu.logout')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/${locale}/auth/login`}
                      className="block px-4 py-2 text-center text-white/60 hover:text-white transition-colors"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('buttons.login')}
                    </Link>
                    <Link
                      href="#cta"
                      className="btn-primary block px-4 py-3 text-center rounded-lg font-semibold text-white"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {t('buttons.createBot')}
                    </Link>
                  </>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
