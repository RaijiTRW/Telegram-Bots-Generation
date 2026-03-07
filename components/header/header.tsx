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
import { setUserLocale } from '@/app/actions/locale';
import type { Locale } from '@/app/i18n';

export function Header() {
  const t = useTranslations('header');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ userName: string; userEmail: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const setUserPreview = async (authUser?: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']) => {
      const resolvedUser = authUser ?? (await supabase.auth.getUser()).data.user;

      if (!resolvedUser) {
        setUser(null);
        return;
      }

      const metadata =
        resolvedUser.user_metadata && typeof resolvedUser.user_metadata === 'object'
          ? (resolvedUser.user_metadata as Record<string, unknown>)
          : {};

      const fallbackName =
        (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
        resolvedUser.email?.split('@')[0] ||
        '';
      const fallbackAvatar =
        typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
          ? metadata.avatar_url
          : null;

      setUser({
        userName: fallbackName,
        userEmail: resolvedUser.email || '',
        avatarUrl: fallbackAvatar,
      });

      const { data: profileRow } = await ((supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', resolvedUser.id)
        .maybeSingle()) as unknown as Promise<{
        data: { full_name: string | null; avatar_url: string | null } | null
      }>);

      setUser((prev) => {
        if (!prev) return prev;
        if (!profileRow) return prev;

        return {
          ...prev,
          userName: profileRow.full_name?.trim() || prev.userName,
          avatarUrl: typeof profileRow.avatar_url === 'string' ? profileRow.avatar_url : prev.avatarUrl,
        };
      });
    };

    void setUserPreview();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void setUserPreview(session?.user ?? undefined);
    });

    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ fullName?: string; avatarUrl?: string | null; email?: string }>).detail;
      if (!detail) return;

      setUser((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          userName: detail.fullName ?? prev.userName,
          userEmail: detail.email ?? prev.userEmail,
          avatarUrl: detail.avatarUrl === undefined ? prev.avatarUrl : (detail.avatarUrl ?? null),
        };
      });
    };

    window.addEventListener('cbtooll:profile-updated', handleProfileUpdated as EventListener);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('cbtooll:profile-updated', handleProfileUpdated as EventListener);
    };
  }, []);

  const switchLocale = async (newLocale: string) => {
    // Prevent double-click
    if (newLocale === locale) {
      return;
    }

    // Set cookie for next-intl middleware to detect the locale change
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${maxAge}; SameSite=Lax`;

    // Also update the DB for logged-in users so the middleware
    // (which prioritizes DB locale over cookie) stays in sync
    if (user) {
      try {
        await setUserLocale(newLocale as Locale);
      } catch {
        // Continue with navigation even if DB update fails
      }
    }

    // Remove current locale from path and add new one
    let pathWithoutLocale = pathname;
    if (pathname.startsWith(`/${locale}`)) {
      pathWithoutLocale = pathname.slice(`/${locale}`.length) || '/';
    }

    const newUrl = `/${newLocale}${pathWithoutLocale}`;

    // Navigate to new locale
    window.location.href = newUrl;
  };

  const navItems = [
    { key: 'nav.features', href: `/${locale}#features` },
    { key: 'nav.templates', href: `/${locale}#templates` },
    { key: 'nav.pricing', href: `/${locale}/pricing` },
    { key: 'nav.docs', href: `/${locale}/docs` },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 group"
            aria-label="CBTooll Home"
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
              CBTooll
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
              aria-label={t('switchLanguage')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Globe className="w-4 h-4 text-white/60" />
              <span className="text-sm font-medium">
                {locale === 'ru' ? 'EN' : 'RU'}
              </span>
            </motion.button>

            {user ? (
              <UserMenuDropdown userName={user.userName} userEmail={user.userEmail} avatarUrl={user.avatarUrl} />
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
                    href={`/${locale}/auth/signup`}
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
                      href={`/${locale}/auth/signup`}
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
