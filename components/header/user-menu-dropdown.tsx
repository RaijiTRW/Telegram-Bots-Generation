'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion, AnimatePresence } from '@/components/motion-wrapper'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, ChevronDown, LayoutDashboard, User as UserIcon, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UserMenuDropdownProps {
  userName: string
  userEmail?: string
}

export function UserMenuDropdown({ userName, userEmail }: UserMenuDropdownProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const locale = useLocale()
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('header.userMenu')

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push(`/${locale}`)
  }

  const menuItems = [
    { icon: LayoutDashboard, label: t('dashboard'), href: `/${locale}/dashboard` },
    { icon: UserIcon, label: t('profile'), href: `/${locale}/dashboard/profile` },
    { icon: Settings, label: t('settings'), href: `/${locale}/dashboard/settings` },
  ]

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsDropdownOpen(true)}
      onMouseLeave={() => setIsDropdownOpen(false)}
    >
      {/* Avatar with click to dashboard */}
      <Link
        href={`/${locale}/dashboard`}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        onClick={(e) => {
          // Allow navigation when clicking directly on avatar link
        }}
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#24A1DE] to-[#8B5CF6] blur-sm opacity-70" />
          <Avatar className="relative bg-zinc-900 border-2 border-zinc-800 shadow-xl w-9 h-9">
            <AvatarFallback className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-white font-semibold text-xs">
              {initials || <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </div>
        <motion.div
          animate={{ rotate: isDropdownOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/60" />
        </motion.div>
      </Link>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info */}
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm font-medium text-white">{userName}</p>
              {userEmail && (
                <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                {t('logout')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
