import type { Locale } from '@/app/i18n'

export const INFO_PAGE_SLUGS = ['privacy', 'terms', 'security', 'status', 'contact'] as const

export type InfoPageSlug = (typeof INFO_PAGE_SLUGS)[number]

export type InfoPageSection = {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type InfoPageContent = {
  slug: InfoPageSlug
  eyebrow: string
  title: string
  description: string
  updatedAt: string
  callout?: {
    title: string
    description: string
  }
  sections: InfoPageSection[]
}

const RU_UPDATED_AT = 'Обновлено 30 марта 2026'
const EN_UPDATED_AT = 'Updated March 30, 2026'

const INFO_PAGES: Record<Locale, Record<InfoPageSlug, InfoPageContent>> = {
  ru: {
    privacy: {
      slug: 'privacy',
      eyebrow: 'Правовая информация',
      title: 'Конфиденциальность',
      description: 'Как CBTooll обрабатывает данные аккаунта, контент ботов, платежную информацию и технические события.',
      updatedAt: RU_UPDATED_AT,
      callout: {
        title: 'Коротко',
        description: 'Мы собираем только те данные, которые нужны для работы сервиса, безопасности, платежей и поддержки.',
      },
      sections: [
        {
          title: 'Какие данные мы используем',
          paragraphs: [
            'CBTooll использует данные аккаунта, которые вы передаёте при регистрации или входе: email, имя профиля и технические идентификаторы пользователя.',
            'Если вы создаёте ботов в сервисе, система хранит их конфигурацию, тексты, переменные, системные настройки, технические логи и связанные метаданные, необходимые для работы редактора и runtime.',
          ],
          bullets: [
            'данные профиля и авторизации',
            'конфигурации ботов и workflow',
            'технические события, ошибки и логи запуска',
            'платёжные события и статусы подписки',
          ],
        },
        {
          title: 'Как данные используются',
          paragraphs: [
            'Данные используются для предоставления доступа к личному кабинету, сохранения проектов, работы runtime, аналитики, защиты сервиса и улучшения качества продукта.',
            'Мы не используем ваши данные для произвольной перепродажи и не публикуем приватные конфигурации ботов в открытом доступе.',
          ],
        },
        {
          title: 'Платежи и сторонние сервисы',
          paragraphs: [
            'Для оплаты сервис может использовать сторонние платёжные провайдеры. Платёжные формы, статусы и подтверждения могут обрабатываться на стороне этих провайдеров в соответствии с их собственными правилами.',
            'Для инфраструктуры и авторизации могут использоваться внешние сервисы хранения, аутентификации и доставки контента.',
          ],
        },
        {
          title: 'Хранение и контроль',
          paragraphs: [
            'Мы храним данные столько, сколько это нужно для работы аккаунта, исполнения обязательств, безопасности и расследования технических инцидентов.',
            'Вы можете удалить проекты, прекратить использование сервиса или обратиться по вопросам обработки данных через публичные каналы связи, когда они будут опубликованы на странице контактов.',
          ],
        },
      ],
    },
    terms: {
      slug: 'terms',
      eyebrow: 'Правовая информация',
      title: 'Условия использования',
      description: 'Базовые правила доступа к сервису, подписке, проектам ботов и допустимому использованию платформы.',
      updatedAt: RU_UPDATED_AT,
      callout: {
        title: 'Важно',
        description: 'Используя сервис, вы соглашаетесь использовать его законно, не злоупотреблять инфраструктурой и не нарушать работу других пользователей.',
      },
      sections: [
        {
          title: 'Доступ к сервису',
          paragraphs: [
            'CBTooll предоставляет инструменты для создания, настройки и запуска Telegram-ботов. Доступ к отдельным функциям может зависеть от текущего тарифа, прав пользователя и технической готовности конкретного модуля.',
            'Некоторые функции могут иметь статус soon, beta или disabled до их полного запуска.',
          ],
        },
        {
          title: 'Ответственность за аккаунт и контент',
          paragraphs: [
            'Вы отвечаете за безопасность своих учётных данных, корректность контента ботов, соблюдение законодательства и правил платформ, с которыми интегрируете бота.',
            'Вы не должны использовать сервис для спама, мошенничества, фишинга, обхода ограничений, распространения вредоносного кода или нелегального контента.',
          ],
          bullets: [
            'не размещать вредоносный или незаконный контент',
            'не пытаться ломать чужие аккаунты и инфраструктуру',
            'не использовать сервис для обхода ограничений Telegram или платёжных систем',
          ],
        },
        {
          title: 'Подписки и ограничения',
          paragraphs: [
            'Отдельные возможности доступны только в рамках подходящего тарифа. Мы можем менять состав тарифов, лимиты, список модулей и функциональность продукта по мере развития сервиса.',
            'Если функция ещё не запущена, наличие её в интерфейсе не означает немедленную доступность для production-использования.',
          ],
        },
        {
          title: 'Доступность и изменения',
          paragraphs: [
            'Мы стараемся поддерживать сервис в рабочем состоянии, но не гарантируем непрерывную доступность без перерывов, обновлений или технических инцидентов.',
            'Мы можем обновлять продукт, менять интерфейс, инфраструктуру и внутренние правила, если это нужно для развития сервиса, безопасности или соответствия требованиям.',
          ],
        },
      ],
    },
    security: {
      slug: 'security',
      eyebrow: 'Правовая информация',
      title: 'Безопасность',
      description: 'Какие базовые меры безопасности заложены в сервисе для авторизации, хранения конфигураций и работы редактора.',
      updatedAt: RU_UPDATED_AT,
      callout: {
        title: 'Текущее состояние',
        description: 'Основной фокус сейчас на защите аккаунтов, конфигураций ботов, секретов и стабильности базовой инфраструктуры.',
      },
      sections: [
        {
          title: 'Защита аккаунтов и доступа',
          paragraphs: [
            'Для доступа к сервису используется централизованная авторизация. Права в административных разделах и редакторе ограничиваются ролями и состоянием подписки.',
            'Системные действия, критичные изменения и доступ к отдельным модулям контролируются серверной логикой, а не только интерфейсом.',
          ],
        },
        {
          title: 'Секреты и конфигурации',
          paragraphs: [
            'Токены, платёжные ключи и другие чувствительные значения не должны публиковаться в открытых частях интерфейса. Для их хранения используются отдельные серверные механизмы и защищённые конфигурации.',
            'Если функция требует секретов, они должны использоваться только в пределах нужного сценария и не выводиться пользователям без необходимости.',
          ],
          bullets: [
            'бот-токены и служебные ключи обрабатываются отдельно от публичного интерфейса',
            'доступ к секретным операциям ограничен серверной частью',
            'ошибки и runtime-события логируются для диагностики инцидентов',
          ],
        },
        {
          title: 'Инфраструктура и эксплуатация',
          paragraphs: [
            'Базовые системы сервиса поддерживаются и обновляются по мере развития продукта. Мы следим за работоспособностью ключевых сценариев: авторизация, редактор, сохранение данных, подписки и техническая диагностика.',
            'AI-модули пока не считаются частью стабильного production-контура и остаются отключёнными или помеченными как soon там, где это требуется.',
          ],
        },
        {
          title: 'Инциденты и развитие',
          paragraphs: [
            'При обнаружении уязвимостей или инцидентов мы можем временно ограничивать отдельные функции, менять доступность модулей и усиливать правила безопасности.',
            'Политика безопасности будет дополняться по мере появления публичного security-канала и формализованного процесса disclosure.',
          ],
        },
      ],
    },
    status: {
      slug: 'status',
      eyebrow: 'Правовая информация',
      title: 'Статус сервиса',
      description: 'Дневная телеметрия ядра сервиса за последние 30 дней: сайт, редактор, runtime и базовая инфраструктура.',
      updatedAt: RU_UPDATED_AT,
      callout: {
        title: 'Сейчас',
        description: 'Базовые системы работают. AI-модули пока не участвуют в штатной работе сервиса и остаются выключенными или отмеченными как soon.',
      },
      sections: [
        {
          title: 'Что считается базовыми системами',
          paragraphs: [
            'Под базовыми системами мы имеем в виду ключевые сценарии, без которых сервис не выполняет свою основную функцию: вход, хранение проектов, редактор, публичные страницы, документацию и подписочную часть.',
            'Именно эти контуры сейчас считаются основным рабочим слоем платформы.',
          ],
        },
        {
          title: 'AI-статус',
          paragraphs: [
            'AI-функции пока не включены как стабильная часть сервиса. В интерфейсе они могут отображаться как soon, locked или disabled в зависимости от раздела.',
            'Это означает, что AI не должен рассматриваться как гарантированно доступный production-модуль на текущем этапе.',
          ],
        },
        {
          title: 'Как интерпретировать этот статус',
          paragraphs: [
            'Если вы работаете с базовым редактором, настройками, документацией и подписками, ориентируйтесь на статус working / operational.',
            'Если сценарий зависит от AI, закладывайте, что модуль пока недоступен и должен иметь fallback или быть исключён из боевого контура.',
          ],
        },
      ],
    },
    contact: {
      slug: 'contact',
      eyebrow: 'Компания',
      title: 'Контакты',
      description: 'Контакты для продуктовых, юридических и общих вопросов по сервису создания Telegram-ботов CBTooll.',
      updatedAt: RU_UPDATED_AT,
      callout: {
        title: 'Что важно',
        description: 'Эта страница помогает понять, куда направлять продуктовые, юридические и технические вопросы. По мере расширения публичных каналов связи они будут появляться здесь.',
      },
      sections: [
        {
          title: 'Продуктовые вопросы',
          paragraphs: [
            'Если вопрос касается того, как работает сервис, логики редактора, тарифов или доступных функций, сначала проверьте документацию, страницу тарифов и статус сервиса.',
            'Когда публичные support-каналы будут закреплены как основные, они будут опубликованы здесь отдельно.',
          ],
        },
        {
          title: 'Юридические и платёжные вопросы',
          paragraphs: [
            'Для вопросов о правилах использования, конфиденциальности, безопасности, платежах и статусе сервиса ориентируйтесь на соответствующие публичные страницы в этом разделе.',
            'Если появятся выделенные юридические или платёжные контакты, эта страница станет точкой входа и для таких обращений.',
          ],
        },
        {
          title: 'Как быстрее найти ответ',
          paragraphs: [
            'Для быстрого старта по созданию Telegram-бота откройте документацию и страницы с описанием сценариев сервиса. Они помогают понять, как подойти к заявкам, записи, FAQ, автоворонкам и запуску без тяжёлой разработки.',
            'Публичные обновления о сервисе, запуске новых модулей и изменениях статуса будут появляться на сайте и в официальных каналах, когда они будут закреплены как основные.',
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      slug: 'privacy',
      eyebrow: 'Legal',
      title: 'Privacy',
      description: 'How CBTooll handles account data, bot content, payment information, and technical events.',
      updatedAt: EN_UPDATED_AT,
      callout: {
        title: 'In short',
        description: 'We collect only the data required to operate the service, protect accounts, process billing, and support the product.',
      },
      sections: [
        {
          title: 'What data we use',
          paragraphs: [
            'CBTooll uses account information you provide during sign-up or login, including email, profile name, and technical user identifiers.',
            'If you build bots in the service, the platform stores bot configuration, workflow content, variables, system settings, technical logs, and related metadata required for editor and runtime behavior.',
          ],
          bullets: [
            'profile and authentication data',
            'bot configurations and workflows',
            'technical events, errors, and run logs',
            'billing events and subscription state',
          ],
        },
        {
          title: 'How data is used',
          paragraphs: [
            'Data is used to provide access to the dashboard, persist projects, run workflows, protect the service, improve reliability, and support product development.',
            'We do not publish private bot configurations openly and do not use your data for arbitrary resale.',
          ],
        },
        {
          title: 'Payments and third-party services',
          paragraphs: [
            'Payments may be handled through external providers. Payment forms, confirmations, and billing states can be processed by those providers under their own policies.',
            'Infrastructure, authentication, and content delivery may rely on external services where required.',
          ],
        },
        {
          title: 'Retention and control',
          paragraphs: [
            'We retain data for as long as required to operate accounts, fulfill obligations, protect the platform, and investigate technical incidents.',
            'You can remove projects, stop using the service, or rely on published contact channels once they are formalized on the contact page.',
          ],
        },
      ],
    },
    terms: {
      slug: 'terms',
      eyebrow: 'Legal',
      title: 'Terms',
      description: 'Core rules for accessing the service, subscriptions, bot projects, and acceptable use of the platform.',
      updatedAt: EN_UPDATED_AT,
      callout: {
        title: 'Important',
        description: 'By using the service, you agree to use it lawfully, avoid abuse of infrastructure, and not disrupt other users.',
      },
      sections: [
        {
          title: 'Access to the service',
          paragraphs: [
            'CBTooll provides tools for creating, configuring, and running Telegram bots. Access to individual features may depend on the current plan, user role, and technical readiness of a given module.',
            'Some features may appear as soon, beta, or disabled before their full launch.',
          ],
        },
        {
          title: 'Responsibility for account and content',
          paragraphs: [
            'You are responsible for the security of your account, the legality of bot content, and compliance with the rules of connected platforms and payment providers.',
            'You must not use the service for spam, fraud, phishing, malware, abuse of infrastructure, or illegal distribution.',
          ],
          bullets: [
            'do not publish harmful or illegal content',
            'do not attempt to compromise other accounts or infrastructure',
            'do not use the platform to bypass Telegram or payment restrictions',
          ],
        },
        {
          title: 'Subscriptions and limits',
          paragraphs: [
            'Some features are available only under a suitable plan. We may change plan contents, limits, available modules, and product behavior as the service evolves.',
            'If a feature has not launched yet, its presence in the interface does not guarantee production availability.',
          ],
        },
        {
          title: 'Availability and updates',
          paragraphs: [
            'We aim to keep the service available, but uninterrupted uptime without maintenance windows, updates, or incidents is not guaranteed.',
            'We may change the product, infrastructure, interface, and internal rules when needed for growth, security, or compliance.',
          ],
        },
      ],
    },
    security: {
      slug: 'security',
      eyebrow: 'Legal',
      title: 'Security',
      description: 'Baseline security measures used for authentication, configuration storage, and editor/runtime access.',
      updatedAt: EN_UPDATED_AT,
      callout: {
        title: 'Current focus',
        description: 'The current priority is protecting accounts, bot configurations, secrets, and the stability of the core service infrastructure.',
      },
      sections: [
        {
          title: 'Account and access protection',
          paragraphs: [
            'The service uses centralized authentication for access. Administrative and editor capabilities are restricted by role and subscription state.',
            'Critical actions and sensitive areas are enforced by server-side logic, not only by client-side UI.',
          ],
        },
        {
          title: 'Secrets and configuration',
          paragraphs: [
            'Tokens, payment credentials, and other sensitive values should never be exposed in public UI surfaces. Sensitive operations are handled through separate server-side mechanisms and protected configuration paths.',
            'When a feature requires secrets, those values should be limited to the required execution scope and never shown to end users unnecessarily.',
          ],
          bullets: [
            'bot tokens and service keys are handled separately from public UI data',
            'sensitive actions are limited to server-side flows',
            'runtime errors and service events are logged for incident diagnosis',
          ],
        },
        {
          title: 'Infrastructure and operations',
          paragraphs: [
            'Core product systems are maintained and updated as the platform evolves. We monitor and support the key paths required for the service to function: auth, editor, saved project data, subscriptions, and technical diagnostics.',
            'AI modules are not currently treated as part of the stable production perimeter and remain disabled or marked as soon where needed.',
          ],
        },
        {
          title: 'Incidents and future process',
          paragraphs: [
            'When vulnerabilities or incidents are discovered, we may temporarily limit access to specific modules, tighten controls, or change service availability as needed.',
            'This security page will be expanded once a formal public disclosure process and dedicated security contact channel are published.',
          ],
        },
      ],
    },
    status: {
      slug: 'status',
      eyebrow: 'Legal',
      title: 'Service Status',
      description: 'Daily telemetry for the core service across the last 30 days: site, editor, runtime, and base infrastructure.',
      updatedAt: EN_UPDATED_AT,
      callout: {
        title: 'Current state',
        description: 'Core systems are operational. AI modules are not yet part of the normal service path and remain disabled or marked as coming soon.',
      },
      sections: [
        {
          title: 'What we consider core systems',
          paragraphs: [
            'Core systems are the parts required for the platform to perform its main job: authentication, project storage, editor access, public pages, documentation, and subscription handling.',
            'Those modules are the primary operational layer of the service right now.',
          ],
        },
        {
          title: 'AI status',
          paragraphs: [
            'AI features are not yet enabled as a stable production module. In the interface they may appear as soon, locked, or disabled depending on the section.',
            'That means AI should not currently be treated as guaranteed production functionality.',
          ],
        },
        {
          title: 'How to read this status page',
          paragraphs: [
            'If your workflow depends on the main editor, settings, documentation, or subscriptions, treat those paths as operational.',
            'If your workflow depends on AI, assume that module is still unavailable and should have a fallback or be excluded from the live setup.',
          ],
        },
      ],
    },
    contact: {
      slug: 'contact',
      eyebrow: 'Company',
      title: 'Contact',
      description: 'Contacts for product, legal, and general questions about the CBTooll Telegram bot platform.',
      updatedAt: EN_UPDATED_AT,
      callout: {
        title: 'What to know',
        description: 'This page helps route product, legal, and technical questions. As public contact channels become official, they will appear here.',
      },
      sections: [
        {
          title: 'Product questions',
          paragraphs: [
            'If your question is about product behavior, editor logic, pricing, or available features, start with the documentation, pricing page, and service status.',
            'As official public support channels go live, they will be listed here.',
          ],
        },
        {
          title: 'Legal and billing questions',
          paragraphs: [
            'For privacy, terms, security, billing, and service availability questions, use the related public pages in this section as the current source of truth.',
            'If dedicated legal or billing contacts become available, this page will serve as the public entry point for them as well.',
          ],
        },
        {
          title: 'Where to start faster',
          paragraphs: [
            'If you are evaluating how to create a Telegram bot for leads, booking, FAQ, funnels, or no-code launch, start with the documentation and the scenario pages across the public site.',
            'Public updates about the service, new module launches, and status changes will be published on the site and official channels once those channels are locked in as primary.',
          ],
        },
      ],
    },
  },
}

export function isInfoPageSlug(value: string): value is InfoPageSlug {
  return INFO_PAGE_SLUGS.includes(value as InfoPageSlug)
}

export function getInfoPageContent(locale: Locale, slug: InfoPageSlug) {
  const safeLocale: Locale = locale === 'en' ? 'en' : 'ru'
  return INFO_PAGES[safeLocale][slug]
}
