'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import {
  getOnboardingStatusAction,
  markOnboardingSeenAction,
} from '@/app/actions/onboarding'
import { GuidedTour, type GuidedTourStep } from './guided-tour'

export function DashboardOnboardingTour() {
  const locale = useLocale()
  const isRu = locale !== 'en'
  const [isSeen, setIsSeen] = useState<boolean | null>(null)
  const dashboardRoot = `/${locale}/dashboard`

  const steps = useMemo<GuidedTourStep[]>(
    () => isRu
      ? [
          {
            id: 'welcome',
            target: '[data-tour="dashboard-header"]',
            href: dashboardRoot,
            title: 'Быстрый обзор',
            body: 'Сначала посмотрите на продукт целиком: слева разделы, сверху аккаунт и язык, а в центре открывается текущая рабочая область.',
          },
          {
            id: 'navigation',
            target: '[data-tour="dashboard-nav"]',
            href: dashboardRoot,
            title: 'Разделы продукта',
            body: 'Левое меню — главный маршрут по сервису. Здесь вы переходите между главной, ботами, статистикой, тарифом, CRM, документацией, профилем и настройками.',
          },
          {
            id: 'home',
            target: '[data-tour="dashboard-content"]',
            href: dashboardRoot,
            title: 'Главная',
            body: 'Главная нужна для быстрого старта: посмотреть состояние аккаунта, вернуться к важным действиям и понять, что делать дальше после входа.',
          },
          {
            id: 'bots',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/bots`,
            title: 'Боты',
            body: 'В этом разделе создаются новые боты и открываются уже готовые проекты. Именно отсюда обычно начинается работа с редактором сценария.',
          },
          {
            id: 'statistics',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/statistics`,
            title: 'Статистика',
            body: 'Статистика помогает понять, что происходит после запуска: активность пользователей, рост, события и эффективность ботов.',
          },
          {
            id: 'subscription',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/subscription`,
            title: 'Подписка',
            body: 'Здесь проверяется текущий тариф и ограничения. Если какая-то функция недоступна, сначала стоит посмотреть именно этот раздел.',
          },
          {
            id: 'crm',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/crm`,
            title: 'CRM',
            body: 'CRM собирает контакты и заявки, которые приходят из ботов. Это место для работы с лидами после того, как сценарий начал принимать пользователей.',
          },
          {
            id: 'docs',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/docs`,
            title: 'Документация',
            body: 'Документация объясняет логику редактора, узлы, тестирование, развертывание и частые ошибки. Если что-то непонятно, это первый справочник.',
          },
          {
            id: 'profile',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/profile`,
            title: 'Профиль',
            body: 'В профиле находятся данные аккаунта и персональные настройки пользователя. Это не настройки конкретного бота, а настройки владельца аккаунта.',
          },
          {
            id: 'settings',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/settings`,
            title: 'Настройки',
            body: 'Настройки отвечают за системные параметры сервиса и интеграции аккаунта. Сюда стоит заходить, когда нужно изменить поведение продукта в целом.',
          },
        ]
      : [
          {
            id: 'welcome',
            target: '[data-tour="dashboard-header"]',
            href: dashboardRoot,
            title: 'Quick overview',
            body: 'Start with the whole product: sections on the left, account and language at the top, and the current workspace in the center.',
          },
          {
            id: 'navigation',
            target: '[data-tour="dashboard-nav"]',
            href: dashboardRoot,
            title: 'Product sections',
            body: 'The left menu is the main route through the app: Home, Bots, Statistics, Subscription, CRM, Documentation, Profile, and Settings.',
          },
          {
            id: 'home',
            target: '[data-tour="dashboard-content"]',
            href: dashboardRoot,
            title: 'Home',
            body: 'Home is for orientation and quick actions: review the account state, return to important tasks, and understand what to do next.',
          },
          {
            id: 'bots',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/bots`,
            title: 'Bots',
            body: 'This is where users create new bots and open existing projects. Most editor work starts from this section.',
          },
          {
            id: 'statistics',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/statistics`,
            title: 'Statistics',
            body: 'Statistics show what happens after launch: user activity, growth, events, and bot performance.',
          },
          {
            id: 'subscription',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/subscription`,
            title: 'Subscription',
            body: 'This section shows the current plan and limits. If a feature is unavailable, check the plan here first.',
          },
          {
            id: 'crm',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/crm`,
            title: 'CRM',
            body: 'CRM collects contacts and requests from bots. It is where leads are handled after a workflow starts receiving users.',
          },
          {
            id: 'docs',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/docs`,
            title: 'Documentation',
            body: 'Documentation explains editor logic, nodes, testing, deployment, and common errors. Use it as the first reference when something is unclear.',
          },
          {
            id: 'profile',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/profile`,
            title: 'Profile',
            body: 'Profile contains account data and personal user settings. These are owner-level settings, not settings for a single bot.',
          },
          {
            id: 'settings',
            target: '[data-tour="dashboard-content"]',
            href: `${dashboardRoot}/settings`,
            title: 'Settings',
            body: 'Settings control product-level behavior and account integrations. Use this section when the app itself needs to behave differently.',
          },
        ],
    [dashboardRoot, isRu]
  )

  useEffect(() => {
    let isMounted = true

    getOnboardingStatusAction('dashboard').then((result) => {
      if (!isMounted) {
        return
      }
      setIsSeen(result.success ? result.seen : false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const markSeen = useCallback(async () => {
    setIsSeen(true)
    await markOnboardingSeenAction('dashboard')
  }, [])

  return (
    <GuidedTour
      storageKey="cbtooll:onboarding:dashboard:v1"
      steps={steps}
      isSeen={isSeen}
      onSeen={markSeen}
      labels={{
        back: isRu ? 'Назад' : 'Back',
        next: isRu ? 'Продолжить' : 'Continue',
        done: isRu ? 'Готово' : 'Done',
        close: isRu ? 'Закрыть обучение' : 'Close tutorial',
      }}
    />
  )
}
