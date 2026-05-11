'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import {
  getOnboardingStatusAction,
  markOnboardingSeenAction,
} from '@/app/actions/onboarding'
import { GuidedTour, type GuidedTourStep } from './guided-tour'

interface EditorOnboardingTourProps {
  botId: string
}

export function EditorOnboardingTour({ botId }: EditorOnboardingTourProps) {
  const locale = useLocale()
  const isRu = locale !== 'en'
  const [isSeen, setIsSeen] = useState<boolean | null>(null)
  const editorRoot = `/${locale}/workspace/bots/${botId}/editor`

  const steps = useMemo<GuidedTourStep[]>(
    () => isRu
      ? [
          {
            id: 'header',
            target: '[data-tour="editor-header"]',
            href: `${editorRoot}/ai-chat`,
            title: 'Редактор бота',
            body: 'Редактор состоит из общей панели, разделов слева и рабочей области. Здесь вы собираете сценарий, проверяете его, сохраняете и запускаете бота.',
          },
          {
            id: 'sections',
            target: '[data-tour="editor-nav"]',
            href: `${editorRoot}/ai-chat`,
            title: 'Разделы редактора',
            body: 'Слева находятся режимы работы. Переключайтесь между ИИ, агентами, холстом, системой, настройками и статистикой, не выходя из текущего бота.',
          },
          {
            id: 'ai-chat',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/ai-chat`,
            title: 'ИИ-помощник',
            body: 'В чате можно задавать вопросы о текущем сценарии или просить внести изменения. Если нужна только консультация, формулируйте это явно: “просто ответь”.',
          },
          {
            id: 'ai-agents',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/ai-agents`,
            title: 'ИИ-агенты',
            body: 'Раздел пока в разработке. Позже он будет нужен для автоматизаций ботов.',
          },
          {
            id: 'canvas',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/canvas`,
            title: 'Холст сценария',
            body: 'Холст — главная карта бота. Узлы отвечают за сообщения, кнопки, условия, данные и действия, а связи показывают порядок, в котором пользователь проходит сценарий.',
          },
          {
            id: 'system',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/system`,
            title: 'Система',
            body: 'В системе задается поведение бота на уровне правил: стиль ответа, ограничения, рабочие инструкции и то, как бот должен вести себя в диалоге.',
          },
          {
            id: 'settings',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/settings`,
            title: 'Настройки бота',
            body: 'Настройки относятся к конкретному боту: токен, подключение, параметры запуска и служебные данные. Перед публикацией важно проверить этот раздел.',
          },
          {
            id: 'statistics',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/statistics`,
            title: 'Статистика бота',
            body: 'После запуска здесь можно смотреть события, пользователей и результаты именно этого бота, не смешивая их с общей статистикой аккаунта.',
          },
          {
            id: 'save',
            target: '[data-tour="editor-save"]',
            href: `${editorRoot}/canvas`,
            title: 'Сохранение',
            body: 'Сохраняйте изменения перед тестом и развертыванием. Так preview, онлайн-бот и будущий запуск будут брать актуальную версию сценария.',
          },
          {
            id: 'deploy',
            target: '[data-tour="editor-deploy"]',
            href: `${editorRoot}/canvas`,
            title: 'Развертывание',
            body: 'Когда сценарий проверен, отсюда запускается публикация или подготовка сборки. Сначала тестируйте бота, потом разворачивайте.',
          },
        ]
      : [
          {
            id: 'header',
            target: '[data-tour="editor-header"]',
            href: `${editorRoot}/ai-chat`,
            title: 'Bot editor',
            body: 'The editor has a shared toolbar, sections on the left, and a central workspace. This is where users build, test, save, and launch the bot.',
          },
          {
            id: 'sections',
            target: '[data-tour="editor-nav"]',
            href: `${editorRoot}/ai-chat`,
            title: 'Editor sections',
            body: 'The left side contains the working modes. Move between AI, agents, canvas, system, settings, and statistics without leaving the current bot.',
          },
          {
            id: 'ai-chat',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/ai-chat`,
            title: 'AI Assistant',
            body: 'Use chat to ask questions about the current workflow or request changes. If you only need advice, say it explicitly: “just answer”.',
          },
          {
            id: 'ai-agents',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/ai-agents`,
            title: 'AI Agents',
            body: 'This section is still in development. Later, it will be used for bot automations.',
          },
          {
            id: 'canvas',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/canvas`,
            title: 'Workflow canvas',
            body: 'The canvas is the main map of the bot. Nodes represent messages, buttons, conditions, data, and actions; connections show the user path.',
          },
          {
            id: 'system',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/system`,
            title: 'System',
            body: 'System defines bot behavior at the rules level: response style, constraints, working instructions, and dialog behavior.',
          },
          {
            id: 'settings',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/settings`,
            title: 'Bot settings',
            body: 'Settings belong to this specific bot: token, connection, launch options, and service data. Check this section before publishing.',
          },
          {
            id: 'statistics',
            target: '[data-tour="editor-workspace"]',
            href: `${editorRoot}/statistics`,
            title: 'Bot statistics',
            body: 'After launch, this section shows events, users, and results for this bot without mixing them with account-wide statistics.',
          },
          {
            id: 'save',
            target: '[data-tour="editor-save"]',
            href: `${editorRoot}/canvas`,
            title: 'Saving',
            body: 'Save changes before testing and deployment. Preview, online bot mode, and future launches should use the latest workflow state.',
          },
          {
            id: 'deploy',
            target: '[data-tour="editor-deploy"]',
            href: `${editorRoot}/canvas`,
            title: 'Deployment',
            body: 'When the workflow is checked, this button starts publishing or build preparation. Test first, then deploy.',
          },
        ],
    [editorRoot, isRu]
  )

  useEffect(() => {
    let isMounted = true

    getOnboardingStatusAction('editor').then((result) => {
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
    await markOnboardingSeenAction('editor')
  }, [])

  return (
    <GuidedTour
      storageKey="cbtooll:onboarding:editor:v1"
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
