'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AuthSplitLayout } from '@/components/auth/auth-split-layout'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'

type AuthMode = 'login' | 'signup'

interface AuthEntryPageProps {
  initialMode: AuthMode
  requestedMode?: AuthMode
  registrationOpen?: boolean
}

function resolveModeFromPathname(pathname: string, locale: string): AuthMode {
  const normalizedPath = pathname.replace(/\/+$/, '')
  const authPrefix = `/${locale}/auth/`

  if (normalizedPath.startsWith(authPrefix)) {
    const modeSegment = normalizedPath.slice(authPrefix.length).split('/')[0]
    if (modeSegment === 'signup') {
      return 'signup'
    }
  }

  return 'login'
}

export function AuthEntryPage({
  initialMode,
  requestedMode = initialMode,
  registrationOpen = true,
}: AuthEntryPageProps) {
  const locale = useLocale()
  const tLogin = useTranslations('auth.login')
  const tSignup = useTranslations('auth.signup')
  const tSide = useTranslations('auth.login.layout')
  const [mode, setMode] = useState<AuthMode>(initialMode)

  const loginHref = `/${locale}/auth/login`
  const signupHref = `/${locale}/auth/signup`

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    const syncFromUrl = () => {
      const nextMode = resolveModeFromPathname(window.location.pathname, locale)
      setMode(!registrationOpen && nextMode === 'signup' ? 'login' : nextMode)
    }

    syncFromUrl()
    window.addEventListener('popstate', syncFromUrl)

    return () => {
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [locale, registrationOpen])

  const switchMode = (nextMode: AuthMode) => {
    if (!registrationOpen && nextMode === 'signup') {
      return
    }

    if (nextMode === mode) {
      return
    }

    setMode(nextMode)

    const nextPath = nextMode === 'signup' ? signupHref : loginHref
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
  }

  const isSignup = mode === 'signup'
  const showRegistrationClosedNotice = !registrationOpen && requestedMode === 'signup'
  const isRu = locale !== 'en'
  const registrationClosedTitle = isRu
    ? 'Регистрация временно закрыта'
    : 'Registration is temporarily closed'
  const registrationClosedDescription = isRu
    ? 'Создание новых аккаунтов сейчас отключено. Попробуйте зайти позже или войдите в существующий аккаунт.'
    : 'New account creation is currently disabled. Please try again later or sign in with an existing account.'

  return (
    <AuthSplitLayout
      title={isSignup ? tSignup('title') : tLogin('title')}
      subtitle={isSignup ? tSignup('subtitle') : tLogin('subtitle')}
      homeHref={`/${locale}`}
      footerLink={
        registrationOpen
          ? {
              href: isSignup ? loginHref : signupHref,
              label: isSignup ? tSignup('hasAccount') : tLogin('noAccount'),
              linkLabel: isSignup ? tSignup('signIn') : tLogin('signUp'),
              onClick: () => switchMode(isSignup ? 'login' : 'signup'),
            }
          : undefined
      }
      side={{
        tagline: tSide('tagline'),
        benefitsTitle: tSide('benefitsTitle'),
        benefits: [
          tSide('benefit1'),
          tSide('benefit2'),
          tSide('benefit3'),
          tSide('benefit4'),
        ],
        valuesTitle: tSide('valuesTitle'),
        values: [tSide('value1'), tSide('value2'), tSide('value3')],
        resultsTitle: tSide('resultsTitle'),
        results: [tSide('result1'), tSide('result2'), tSide('result3')],
        reviewsTitle: tSide('reviewsTitle'),
        testimonials: [
          {
            quote: tSide('review1Text'),
            name: tSide('review1Name'),
            role: tSide('review1Role'),
          },
          {
            quote: tSide('review2Text'),
            name: tSide('review2Name'),
            role: tSide('review2Role'),
          },
          {
            quote: tSide('review3Text'),
            name: tSide('review3Name'),
            role: tSide('review3Role'),
          },
        ],
        stats: [
          { value: tSide('stat1Value'), label: tSide('stat1Label') },
          { value: tSide('stat2Value'), label: tSide('stat2Label') },
          { value: tSide('stat3Value'), label: tSide('stat3Label') },
        ],
      }}
    >
      {showRegistrationClosedNotice ? (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <div className="font-medium text-amber-100">{registrationClosedTitle}</div>
          <div className="mt-1 text-amber-200/80">{registrationClosedDescription}</div>
        </div>
      ) : null}
      {isSignup && registrationOpen ? <SignupForm /> : <LoginForm />}
    </AuthSplitLayout>
  )
}
