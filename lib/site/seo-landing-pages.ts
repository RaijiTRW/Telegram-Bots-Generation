import type { Locale } from '@/app/i18n'
import type { SeoFaqItem } from '@/lib/site/seo'
import { buildPageMetadata } from '@/lib/site/seo'

export type SeoLandingSlug =
  | 'telegram-bot-builder'
  | 'create-telegram-bot'
  | 'telegram-bot-for-business'
  | 'no-code-telegram-bot'

type SeoLandingSection = {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type SeoLandingPageContent = {
  slug: SeoLandingSlug
  title: string
  description: string
  eyebrow: string
  h1: string
  lead: string
  explainer: Array<{ title: string; body: string }>
  sections: SeoLandingSection[]
  faq: SeoFaqItem[]
  relatedLinks: Array<{ href: string; label: string }>
}

const seoLandingPages: Record<Locale, Record<SeoLandingSlug, SeoLandingPageContent>> = {
  ru: {
    'telegram-bot-builder': {
      slug: 'telegram-bot-builder',
      title: 'Конструктор Telegram-ботов для бизнеса | CBTooll',
      description:
        'Конструктор Telegram-ботов для бизнеса: заявки, запись, FAQ, автоворонки, оплаты и запуск без отдельной команды разработки.',
      eyebrow: 'Конструктор Telegram-ботов',
      h1: 'Конструктор Telegram-ботов для бизнеса без тяжёлой разработки.',
      lead:
        'CBTooll помогает собрать Telegram-бота под заявки, запись, FAQ, продажи и клиентские сценарии без долгого цикла через ТЗ, подрядчиков и отдельный backend.',
      explainer: [
        {
          title: 'Что это',
          body: 'Это no-code платформа для создания и запуска Telegram-ботов с логикой, настройками, аналитикой и готовым хостингом.',
        },
        {
          title: 'Для кого',
          body: 'Для бизнеса, агентств, экспертов, школ и команд, которым нужно быстро проверить или масштабировать сценарий в Telegram.',
        },
        {
          title: 'Что можно сделать',
          body: 'Заявки, запись, FAQ, каталог, прогрев, выдача материалов, простые оплаты и автоматические ответы в Telegram.',
        },
      ],
      sections: [
        {
          title: 'Когда нужен именно конструктор Telegram-ботов',
          paragraphs: [
            'Чаще всего бизнесу не нужен тяжёлый проект с нуля в тот момент, когда задача ещё проверяется. Нужен быстрый запуск: бот для заявок, бот для записи, FAQ-бот или простая автоворонка, которая начинает приносить пользу уже на первом этапе.',
            'В этой точке классическая разработка часто слишком медленная и дорогая. Конструктор Telegram-ботов даёт более короткий путь: сначала собрать рабочий сценарий и посмотреть, даёт ли он заявки, запись, диалоги или оплату.',
          ],
          bullets: [
            'быстрый старт без отдельного backend',
            'понятная логика и редактирование без постоянной зависимости от разработчика',
            'возможность запустить, измерить и улучшать сценарий по мере роста',
          ],
        },
        {
          title: 'Какие задачи бизнеса можно закрыть через Telegram-бота',
          paragraphs: [
            'Для малого и среднего бизнеса Telegram часто уже является привычным каналом. Именно поэтому здесь хорошо работают сценарии захвата обращений, записи на консультацию, FAQ, выдачи материалов, прогрева перед продажей и постпродажной поддержки.',
            'Если команда хочет сократить ручные переписки и ускорить путь пользователя до следующего шага, бот становится не просто чатом, а рабочим каналом конверсии.',
          ],
          bullets: [
            'заявки и первичная квалификация лидов',
            'запись на услуги и консультации',
            'ответы на частые вопросы и сопровождение клиентов',
            'продажи через простые автоворонки и каталог',
          ],
        },
        {
          title: 'Почему бизнесу выгоднее запускать сначала быстро',
          paragraphs: [
            'Когда сценарий запускается быстро, команда раньше видит реальную обратную связь: люди доходят до заявки или нет, какие вопросы задают, где прерывают путь и какие блоки требуют улучшения.',
            'Это снижает риск: вы не тратите недели на разработку того, что потом окажется лишним. Сначала — рабочий Telegram-бот, потом — более глубокая доработка только там, где она действительно оправдана.',
          ],
        },
      ],
      faq: [
        {
          question: 'Чем конструктор Telegram-ботов лучше кастомной разработки на старте?',
          answer:
            'На старте он быстрее и дешевле для типовых сценариев: можно запустить рабочий бот, проверить спрос и только потом решать, нужен ли отдельный backend и кастомный стек.',
        },
        {
          question: 'Можно ли использовать конструктор для коммерческих ботов?',
          answer:
            'Да. Сервис рассчитан на реальные бизнес-сценарии: заявки, запись, FAQ, продажи, уведомления и другие рабочие цепочки в Telegram.',
        },
        {
          question: 'Подходит ли сервис для русскоязычного бизнеса?',
          answer:
            'Да. Контент и сценарии ориентированы на бизнес-задачи, которые типичны для RU/CIS: заявки, консультации, запись, прогрев и быстрый запуск через Telegram.',
        },
      ],
      relatedLinks: [
        { href: '/create-telegram-bot', label: 'Как создать Telegram-бота' },
        { href: '/telegram-bot-for-business', label: 'Telegram-бот для бизнеса' },
        { href: '/pricing', label: 'Тарифы' },
      ],
    },
    'create-telegram-bot': {
      slug: 'create-telegram-bot',
      title: 'Как создать Telegram-бота для бизнеса | CBTooll',
      description:
        'Пошагово: как создать Telegram-бота для заявок, записи, FAQ и автоворонок без кода и без отдельного сервера.',
      eyebrow: 'Как создать Telegram-бота',
      h1: 'Как создать Telegram-бота без кода и быстрее выйти в запуск.',
      lead:
        'Если вам нужен Telegram-бот для заявок, консультаций, продаж или поддержки, быстрее всего начинать с готовой платформы, а не с долгой ручной разработки с нуля.',
      explainer: [
        {
          title: 'Первый шаг',
          body: 'Вы описываете задачу и собираете базовый сценарий: сообщение, развилки, формы заявки, FAQ и кнопки.',
        },
        {
          title: 'Что дальше',
          body: 'После этого бот получает настройки, нужные поля, переходы по логике и готовится к запуску.',
        },
        {
          title: 'Результат',
          body: 'У вас появляется рабочий Telegram-бот, который можно тестировать, улучшать и подключать к бизнес-процессам.',
        },
      ],
      sections: [
        {
          title: 'С чего начать создание Telegram-бота',
          paragraphs: [
            'Обычно команда знает бизнес-цель, но не всегда знает, какой именно путь пользователя нужен внутри Telegram. Поэтому правильный старт — не с кода, а с ответа на вопрос: что бот должен довести пользователя сделать.',
            'Это может быть заявка, запись, оплата, ответ на частый вопрос, сбор контактов или прогрев перед разговором с менеджером. Когда цель ясна, сценарий собирается намного быстрее.',
          ],
        },
        {
          title: 'Какие элементы есть у рабочего Telegram-бота',
          paragraphs: [
            'Даже простой бот обычно состоит из нескольких базовых блоков: стартовое сообщение, развилка логики, форма или кнопки, ответ на FAQ, передача данных дальше и системные настройки.',
            'Если платформа уже даёт эти элементы внутри визуального редактора, вы не тратите время на то, чтобы вручную собирать backend, клавиатуры, хостинг и обработку базовых сценариев.',
          ],
          bullets: [
            'сообщения и сценарии диалога',
            'кнопки и логические ветки',
            'поля для контактов и параметров заявки',
            'системные настройки и публикация',
          ],
        },
        {
          title: 'Почему быстрее запускать сначала no-code бота',
          paragraphs: [
            'На практике бизнес теряет не из-за отсутствия идеального кода, а из-за того, что запуск слишком долго откладывается. No-code путь позволяет быстрее начать работать с реальными пользователями и понять, что нужно улучшить.',
            'Это особенно полезно, если вы запускаете первый сценарий или хотите протестировать новую воронку, новый оффер или новый тип обращения через Telegram.',
          ],
        },
      ],
      faq: [
        {
          question: 'Можно ли создать бота без программиста?',
          answer:
            'Да. Для типовых сценариев достаточно конструктора и понятной логики: сообщения, переходы, формы, FAQ и настройки Telegram.',
        },
        {
          question: 'Сколько времени занимает создание бота?',
          answer:
            'Это зависит от сценария, но для типовых задач старт обычно заметно быстрее, чем при полном custom-подходе с backend, сервером и ручной логикой.',
        },
        {
          question: 'Подходит ли этот подход для коммерческого запуска?',
          answer:
            'Да. Бизнес часто начинает именно так: быстро запускает первую версию, получает лиды и только потом расширяет проект под более сложные задачи.',
        },
      ],
      relatedLinks: [
        { href: '/telegram-bot-builder', label: 'Конструктор Telegram-ботов' },
        { href: '/no-code-telegram-bot', label: 'No-code запуск' },
        { href: '/docs', label: 'Документация' },
      ],
    },
    'telegram-bot-for-business': {
      slug: 'telegram-bot-for-business',
      title: 'Telegram-бот для бизнеса: заявки, запись, FAQ | CBTooll',
      description:
        'Telegram-бот для бизнеса помогает собирать заявки, оформлять запись, отвечать на FAQ и ускорять продажи без лишней ручной переписки.',
      eyebrow: 'Telegram-бот для бизнеса',
      h1: 'Telegram-бот для бизнеса, который помогает доводить до заявки, записи и оплаты.',
      lead:
        'Бизнесу нужен не просто бот ради бота. Нужен сценарий, который сокращает ручную переписку, отвечает быстрее и доводит человека до следующего шага внутри Telegram.',
      explainer: [
        {
          title: 'Для каких компаний',
          body: 'Для сервисного бизнеса, экспертов, онлайн-школ, локальных команд, агентств и e-commerce с коммуникацией в Telegram.',
        },
        {
          title: 'Какие задачи',
          body: 'Лиды, консультации, запись, FAQ, мини-воронки, каталог, уведомления и поддержка пользователей.',
        },
        {
          title: 'Что получает команда',
          body: 'Меньше однотипных переписок, быстрее обработка входящих и более понятный путь пользователя до заявки или продажи.',
        },
      ],
      sections: [
        {
          title: 'Зачем бизнесу Telegram-бот, если уже есть менеджеры',
          paragraphs: [
            'Менеджеры нужны для сложных и ценных диалогов, но Telegram-бот забирает на себя то, что повторяется каждый день: типовые вопросы, сбор контактов, запись и первичную квалификацию.',
            'В результате команда не тонет в одинаковых переписках и может быстрее работать с тёплыми лидами и действительно важными кейсами.',
          ],
        },
        {
          title: 'Какие бизнес-сценарии окупаются быстрее всего',
          paragraphs: [
            'Лучше всего Telegram-бот показывает себя там, где уже есть входящий поток: консультации, заявки, запись на услуги, образовательные продукты, Telegram-каналы и сервисный бизнес.',
            'Если клиент уже готов писать в Telegram, то бот сокращает время ответа, помогает не терять обращения вечером и в выходные и быстрее приводит пользователя к следующему действию.',
          ],
          bullets: [
            'приём заявок с сайта и рекламы',
            'запись на консультации и услуги',
            'FAQ и поддержка без перегрузки менеджеров',
            'прогрев, выдача материалов и follow-up сценарии',
          ],
        },
        {
          title: 'Как Telegram-бот влияет на конверсию',
          paragraphs: [
            'Telegram часто выигрывает у сложных форм тем, что диалог начинается быстрее и привычнее для пользователя. Бот помогает не обрывать этот путь, а наоборот — структурировать его: уточнить задачу, предложить следующий шаг и зафиксировать контакт.',
            'Чем меньше трения между интересом и следующим действием, тем выше шанс, что человек дойдёт до заявки, записи или оплаты.',
          ],
        },
      ],
      faq: [
        {
          question: 'Подходит ли Telegram-бот для малого бизнеса?',
          answer:
            'Да. Для малого бизнеса это часто один из самых практичных способов быстро автоматизировать заявки, запись и FAQ без отдельной технической команды.',
        },
        {
          question: 'Можно ли использовать бота для продаж и прогрева?',
          answer:
            'Да. Telegram-бот подходит для мини-воронок, выдачи материалов, прогрева и перевода пользователя к оплате или разговору с менеджером.',
        },
        {
          question: 'Нужен ли отдельный хостинг для бизнеса?',
          answer:
            'Нет, не обязательно. Для быстрого старта можно использовать размещение на стороне сервиса и не собирать отдельную инфраструктуру только ради MVP.',
        },
      ],
      relatedLinks: [
        { href: '/telegram-bot-builder', label: 'Конструктор Telegram-ботов' },
        { href: '/pricing', label: 'Сравнить тарифы' },
        { href: '/contact', label: 'Контакты' },
      ],
    },
    'no-code-telegram-bot': {
      slug: 'no-code-telegram-bot',
      title: 'No-code Telegram-бот без программиста | CBTooll',
      description:
        'No-code Telegram-бот для заявок, FAQ, записи и продаж: запуск без программиста, без отдельного backend и без долгой ручной сборки.',
      eyebrow: 'No-code Telegram-бот',
      h1: 'No-code Telegram-бот, который можно собрать без программиста и долгого цикла разработки.',
      lead:
        'Когда задачу нужно проверить быстро, no-code подход даёт больше пользы, чем долгая кастомная сборка. Вы быстрее переходите от идеи к рабочему Telegram-боту и видите реальную реакцию пользователей.',
      explainer: [
        {
          title: 'Без кода',
          body: 'Сценарий собирается через визуальную логику, сообщения, условия, кнопки и настройки Telegram.',
        },
        {
          title: 'Без отдельного сервера',
          body: 'Для первого запуска не нужен свой backend, отдельный хостинг или ручная DevOps-сборка.',
        },
        {
          title: 'Для роста',
          body: 'Если проект вырастет, вы сможете дорабатывать сценарий дальше или переходить к более сложной архитектуре по необходимости.',
        },
      ],
      sections: [
        {
          title: 'Почему no-code особенно полезен для Telegram-ботов',
          paragraphs: [
            'Telegram-боты часто нужны там, где важны скорость и понятность: заявки, запись, ответы на частые вопросы, прогрев, каталог и простые касания с пользователем. Для таких задач no-code путь особенно рационален.',
            'Он позволяет собрать рабочий сценарий быстрее и без лишнего технического слоя, который на старте часто только тормозит запуск и увеличивает бюджет.',
          ],
        },
        {
          title: 'Что даёт запуск без программиста',
          paragraphs: [
            'Главная выгода в том, что бизнес-команда или оператор сценария могут менять текст, логику и переходы быстрее. Это сокращает цикл обратной связи и помогает быстрее улучшать конверсию.',
            'Даже если разработчик подключится позже, первая версия уже будет работать, а команда получит реальные данные о том, где сценарий эффективен, а где нет.',
          ],
          bullets: [
            'быстрее путь от идеи до релиза',
            'меньше зависимость от подрядчиков и очереди задач',
            'быстрее доработка текста, веток и сценариев',
          ],
        },
        {
          title: 'Когда no-code достаточно, а когда нужен custom',
          paragraphs: [
            'Для типовых business-flow сценариев no-code часто закрывает основную задачу полностью. Custom нужен тогда, когда появляются сложные интеграции, особые вычисления, уникальная архитектура или требования, которые выходят за пределы типового сценария.',
            'Именно поэтому no-code удобно использовать как первую production-ступень: он не мешает росту, но резко сокращает время до первой работающей версии.',
          ],
        },
      ],
      faq: [
        {
          question: 'Можно ли запустить Telegram-бота совсем без кода?',
          answer:
            'Для типовых сценариев — да. Логика, сообщения, кнопки и переходы собираются без программирования, а сервис берёт на себя базовый контур запуска.',
        },
        {
          question: 'Подходит ли no-code Telegram-бот для бизнеса?',
          answer:
            'Да. Особенно если компании нужно быстро проверить спрос, автоматизировать заявки, запись, FAQ или простую автоворонку в Telegram.',
        },
        {
          question: 'Что делать, если потом понадобится более сложный функционал?',
          answer:
            'Начать можно с no-code запуска, а затем развивать проект дальше: улучшать сценарии внутри платформы или переходить к custom-архитектуре по мере роста требований.',
        },
      ],
      relatedLinks: [
        { href: '/create-telegram-bot', label: 'Как создать Telegram-бота' },
        { href: '/telegram-bot-for-business', label: 'Для бизнеса' },
        { href: '/pricing', label: 'Тарифы' },
      ],
    },
  },
  en: {
    'telegram-bot-builder': {
      slug: 'telegram-bot-builder',
      title: 'Telegram Bot Builder for Business | CBTooll',
      description:
        'A Telegram bot builder for business: leads, booking, FAQ, funnels, payments, and launch without a heavy custom development cycle.',
      eyebrow: 'Telegram bot builder',
      h1: 'A Telegram bot builder for business without the heavy custom build.',
      lead:
        'CBTooll helps teams build Telegram bots for leads, booking, FAQ, payments, and customer flows without starting from a long spec, custom backend, and separate infrastructure.',
      explainer: [
        {
          title: 'What it is',
          body: 'A no-code platform for building, launching, and improving Telegram bots in one workflow.',
        },
        {
          title: 'Who it is for',
          body: 'Business teams, agencies, experts, schools, and service companies that need a faster Telegram launch.',
        },
        {
          title: 'What it can automate',
          body: 'Lead capture, booking, FAQ, funnels, support, content delivery, and simple payments inside Telegram.',
        },
      ],
      sections: [
        {
          title: 'When a Telegram bot builder makes more sense',
          paragraphs: [
            'Many teams do not need a large custom project on day one. They need a working Telegram flow for leads, booking, FAQ, or sales that can go live quickly and prove whether the use case is worth expanding.',
            'That is where a Telegram bot builder becomes practical: it shortens the distance between the idea and the first working version without the usual custom-development overhead.',
          ],
          bullets: [
            'faster launch without a separate backend',
            'clear visual logic without constant dependency on developers',
            'room to iterate after real users start interacting with the bot',
          ],
        },
        {
          title: 'What business jobs a Telegram bot can handle',
          paragraphs: [
            'Telegram already acts as a working communication channel for many teams. That makes it a strong place for lead capture, consultation booking, FAQ, content delivery, warm-up sequences, and basic support.',
            'Instead of treating the bot as a novelty, the platform turns it into a conversion layer that helps users reach the next step faster.',
          ],
        },
        {
          title: 'Why faster launch usually wins',
          paragraphs: [
            'A faster launch means earlier feedback. Teams can see where users drop off, what questions repeat, and which path drives the best conversion before committing to a heavier build.',
            'That lowers risk and keeps the budget focused on the parts of the product that actually prove value.',
          ],
        },
      ],
      faq: [
        {
          question: 'Why use a Telegram bot builder instead of custom development first?',
          answer:
            'Because it gets a standard business flow live much faster. Teams can validate the use case, collect real conversion data, and only then decide if a custom backend is necessary.',
        },
        {
          question: 'Can a Telegram bot builder be used for commercial bots?',
          answer:
            'Yes. It is designed for real business scenarios such as leads, booking, FAQ, funnels, notifications, and simple customer journeys in Telegram.',
        },
        {
          question: 'Is it useful for Russian-speaking and CIS-focused teams?',
          answer:
            'Yes. The product messaging and use cases are aligned with common RU/CIS business flows such as requests, consultations, booking, warm-up, and Telegram-first communication.',
        },
      ],
      relatedLinks: [
        { href: '/create-telegram-bot', label: 'How to create a Telegram bot' },
        { href: '/telegram-bot-for-business', label: 'Telegram bot for business' },
        { href: '/pricing', label: 'Pricing' },
      ],
    },
    'create-telegram-bot': {
      slug: 'create-telegram-bot',
      title: 'How to Create a Telegram Bot for Business | CBTooll',
      description:
        'How to create a Telegram bot for leads, booking, FAQ, and funnels without code and without setting up a separate server.',
      eyebrow: 'How to create a Telegram bot',
      h1: 'How to create a Telegram bot without code and reach launch faster.',
      lead:
        'If the goal is a Telegram bot for leads, booking, FAQ, or support, the fastest path is usually a structured platform workflow rather than starting with a custom backend from day one.',
      explainer: [
        { title: 'Start with the goal', body: 'Define the outcome: lead, booking, answer, payment, or next action.' },
        { title: 'Build the flow', body: 'Use messages, branching, forms, buttons, and settings to shape the user path.' },
        { title: 'Launch and improve', body: 'Test the bot on real traffic and improve the flow based on what users actually do.' },
      ],
      sections: [
        {
          title: 'Start from the business outcome, not from code',
          paragraphs: [
            'A Telegram bot works best when the business goal is clear. That may be collecting a lead, booking a visit, answering FAQ, warming a prospect, or moving a user closer to payment.',
            'Once the outcome is clear, the bot structure becomes simpler and faster to build because every message and branch serves the conversion path.',
          ],
        },
        {
          title: 'What a working Telegram bot usually includes',
          paragraphs: [
            'Even a simple business bot usually needs a start message, branching logic, buttons or forms, FAQ handling, and the settings required to publish the flow safely.',
            'When all of that already exists inside one product workflow, teams avoid spending extra time on infrastructure before the bot is even validated.',
          ],
          bullets: [
            'messages and conversation logic',
            'branching and buttons',
            'contact capture or booking fields',
            'system settings and publishing',
          ],
        },
        {
          title: 'Why the no-code route is often the best first launch',
          paragraphs: [
            'Many teams lose time because launch keeps being delayed in favor of a more “perfect” version. A no-code first release helps get to real usage faster and reduces the delay between the idea and feedback.',
            'That is especially valuable when you want to validate a new offer, a new lead funnel, or a new support flow in Telegram.',
          ],
        },
      ],
      faq: [
        {
          question: 'Can you create a Telegram bot without a programmer?',
          answer:
            'Yes. Standard bot flows can be built with messages, branching logic, buttons, forms, and Telegram settings without manual programming.',
        },
        {
          question: 'How long does it take to create a Telegram bot?',
          answer:
            'It depends on the flow, but standard business bots usually launch much faster in a structured builder than through a full custom stack.',
        },
        {
          question: 'Is this suitable for a commercial launch?',
          answer:
            'Yes. Many teams use this route to ship the first working version, collect leads or bookings, and then expand the product after the use case is proven.',
        },
      ],
      relatedLinks: [
        { href: '/telegram-bot-builder', label: 'Telegram bot builder' },
        { href: '/no-code-telegram-bot', label: 'No-code Telegram bot' },
        { href: '/docs', label: 'Documentation' },
      ],
    },
    'telegram-bot-for-business': {
      slug: 'telegram-bot-for-business',
      title: 'Telegram Bot for Business: Leads, Booking, FAQ | CBTooll',
      description:
        'A Telegram bot for business helps teams capture leads, handle booking, answer FAQ, and move customers faster toward the next step.',
      eyebrow: 'Telegram bot for business',
      h1: 'A Telegram bot for business that moves users toward leads, booking, and payment.',
      lead:
        'A business bot should do more than just exist in chat. It should shorten response time, reduce repetitive conversations, and help the user move toward the next action inside Telegram.',
      explainer: [
        { title: 'Who uses it', body: 'Service businesses, experts, schools, agencies, and commerce teams that already work through Telegram.' },
        { title: 'What it handles', body: 'Leads, consultations, booking, FAQ, support, warm-up flows, and post-click customer journeys.' },
        { title: 'What the team gains', body: 'Less repetitive manual work, faster response time, and a clearer conversion path.' },
      ],
      sections: [
        {
          title: 'Why business teams add a Telegram bot even if they have managers',
          paragraphs: [
            'Managers should focus on valuable conversations. A Telegram bot can take over the repetitive layer: common questions, contact capture, booking, and first-step qualification.',
            'That creates more room for the team to handle serious opportunities instead of losing time in repeated chat routines.',
          ],
        },
        {
          title: 'Which business flows benefit the most',
          paragraphs: [
            'The strongest fit is where Telegram is already part of the customer path: service businesses, consultations, educational products, Telegram-first projects, and ecommerce support or sales flows.',
            'If customers already message the team in Telegram, the bot can reduce delay, prevent missed requests, and guide users to the next action faster.',
          ],
          bullets: [
            'lead capture from ads or site traffic',
            'booking for services and consultations',
            'FAQ and support at scale',
            'warm-up sequences and content delivery',
          ],
        },
        {
          title: 'How it affects conversion',
          paragraphs: [
            'Telegram often reduces friction because the interaction starts in a familiar chat. A good bot keeps that momentum, asks the right follow-up questions, and makes the next action clear.',
            'The less friction between interest and action, the better the chance the user reaches the business goal.',
          ],
        },
      ],
      faq: [
        {
          question: 'Is a Telegram bot useful for a small business?',
          answer:
            'Yes. For many small teams it is one of the fastest ways to automate leads, booking, and FAQ without building a separate technical stack first.',
        },
        {
          question: 'Can it support sales and warm-up flows?',
          answer:
            'Yes. A Telegram bot can handle mini funnels, content delivery, warm-up steps, and route users toward payment or a manager.',
        },
        {
          question: 'Do we need dedicated hosting for business use?',
          answer:
            'Not necessarily. The first release can run on the platform so the team does not need to assemble hosting infrastructure just to validate the workflow.',
        },
      ],
      relatedLinks: [
        { href: '/telegram-bot-builder', label: 'Telegram bot builder' },
        { href: '/pricing', label: 'Compare plans' },
        { href: '/contact', label: 'Contact' },
      ],
    },
    'no-code-telegram-bot': {
      slug: 'no-code-telegram-bot',
      title: 'No-Code Telegram Bot for Business | CBTooll',
      description:
        'Launch a no-code Telegram bot for leads, FAQ, booking, and funnels without a programmer, separate backend, or slow manual setup.',
      eyebrow: 'No-code Telegram bot',
      h1: 'A no-code Telegram bot you can launch without a programmer and without a long build cycle.',
      lead:
        'When the goal is to validate a business flow quickly, a no-code Telegram bot is often the most practical first step. It gets the workflow live sooner and gives the team real user feedback earlier.',
      explainer: [
        { title: 'No code', body: 'The bot is built through messages, buttons, logic, and settings rather than manual programming.' },
        { title: 'No separate server', body: 'The first launch does not require a separate backend or manual DevOps setup.' },
        { title: 'Ready to grow', body: 'Teams can keep improving the flow or move to a more custom architecture later if needed.' },
      ],
      sections: [
        {
          title: 'Why no-code works especially well for Telegram bots',
          paragraphs: [
            'Telegram bots are often used for fast business tasks like leads, booking, FAQ, warm-up flows, catalog logic, or support. Those are exactly the kinds of use cases where a no-code release makes operational sense.',
            'It gets the first version into users’ hands quickly and avoids spending budget on infrastructure before the flow is validated.',
          ],
        },
        {
          title: 'What launching without a programmer changes',
          paragraphs: [
            'The team can update copy, branches, buttons, and response logic faster. That shortens the feedback loop and makes it easier to improve conversion after launch.',
            'Even if developers join later, the first version is already working and producing the insights the team needs to make better product decisions.',
          ],
          bullets: [
            'faster route from idea to live bot',
            'less dependence on contractors and backlog queues',
            'faster updates to text and logic',
          ],
        },
        {
          title: 'When no-code is enough and when custom is needed',
          paragraphs: [
            'For standard business flows, a no-code Telegram bot is often enough to cover the first and even the main production scenario. Custom work becomes useful when the project needs unusual integrations, heavier computation, or unique technical requirements.',
            'That makes no-code a strong first production layer: fast enough to launch, but not a dead end if the project grows.',
          ],
        },
      ],
      faq: [
        {
          question: 'Can a Telegram bot really launch without code?',
          answer:
            'For standard business flows, yes. Messages, logic, buttons, and settings can be assembled without manual coding while the platform handles the base launch layer.',
        },
        {
          question: 'Is a no-code Telegram bot suitable for business use?',
          answer:
            'Yes. It is especially useful for lead capture, booking, FAQ, and simple funnel scenarios where speed matters more than a heavy custom stack at the start.',
        },
        {
          question: 'What if the project later needs more complex functionality?',
          answer:
            'Teams can start with a no-code launch, improve the flow inside the platform, and later expand into a more custom architecture if the use case grows beyond the standard setup.',
        },
      ],
      relatedLinks: [
        { href: '/create-telegram-bot', label: 'How to create a Telegram bot' },
        { href: '/telegram-bot-for-business', label: 'For business' },
        { href: '/pricing', label: 'Pricing' },
      ],
    },
  },
}

export function isSeoLandingSlug(value: string): value is SeoLandingSlug {
  return value in seoLandingPages.ru
}

export function getSeoLandingPage(locale: Locale, slug: SeoLandingSlug) {
  return seoLandingPages[locale][slug]
}

export const SEO_LANDING_SLUGS = Object.keys(seoLandingPages.ru) as SeoLandingSlug[]

export function getSeoLandingMetadata(locale: Locale, slug: SeoLandingSlug) {
  const page = getSeoLandingPage(locale, slug)

  return buildPageMetadata({
    locale,
    path: `/${slug}`,
    title: page.title,
    description: page.description,
    keywords:
      locale === 'ru'
        ? ['создать бота тг', 'создание ботов тг', 'конструктор тг ботов', 'создать бота тг для бизнеса']
        : ['telegram bot builder', 'create telegram bot', 'telegram bot for business', 'no-code telegram bot'],
  })
}
