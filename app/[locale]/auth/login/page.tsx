import { useTranslations } from 'next-intl'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05070A] relative overflow-hidden p-4">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#24A1DE]/10 via-transparent to-[#8B5CF6]/10 pointer-events-none" />
      
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(36, 161, 222, 0.15) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)`,
        }} />
      </div>
      
      <div className="relative z-10">
        <AuthCard
          title={t('title')}
          description={t('subtitle')}
          footerLink={{
            href: '/auth/signup',
            label: t('noAccount'),
            linkLabel: t('signUp')
          }}
        >
          <LoginForm />
        </AuthCard>
      </div>
    </div>
  )
}
