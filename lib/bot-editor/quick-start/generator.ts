import type { BotConfig, Edge, Node, QuickStartTemplateId } from '@/lib/bot-editor/types/bot.types'
import { QUICK_START_GENERATOR_VERSION } from '@/lib/bot-editor/quick-start/utils'

type GeneratorLocale = 'ru' | 'en'

type GeneratorInput = {
  templateId: QuickStartTemplateId
  answers: Record<string, unknown>
  locale?: string
}

type ButtonConfig = {
  id: string
  text: string
  callbackData: string
}

type MessageAttachment = {
  type: 'photo' | 'video' | 'document' | 'audio'
  source: string
}

type ServiceItem = {
  id: string
  name: string
  price?: string
  description?: string
}

type FaqItem = {
  id: string
  question: string
  answer: string
}

type FlowBuilder = {
  nodes: Node[]
  edges: Edge[]
}

const MAIN_X = 80
const SECONDARY_X = 420
const THIRD_X = 760
const COLUMN_GAP = 320
const ROW_GAP = 180

const createBuilder = (): FlowBuilder => ({
  nodes: [],
  edges: [],
})

const toLocale = (locale?: string): GeneratorLocale => (locale === 'en' ? 'en' : 'ru')

const normalizeText = (value: unknown, fallback = '') => String(value ?? '').trim() || fallback

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item'

const uniqById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }
    seen.add(item.id)
    return true
  })
}

function addNode(builder: FlowBuilder, node: Node) {
  builder.nodes.push(node)
}

function addEdge(builder: FlowBuilder, source: string, target: string, sourceHandle?: string | null) {
  builder.edges.push({
    id: `edge:${source}:${sourceHandle || 'default'}:${target}`,
    source,
    target,
    sourceHandle: sourceHandle ?? null,
    targetHandle: null,
  })
}

function createMessageNode(args: {
  id: string
  x: number
  y: number
  label: string
  description: string
  text: string
  keyboard?: ButtonConfig[][]
  attachments?: MessageAttachment[]
}): Node {
  return {
    id: args.id,
    type: 'message',
    position: { x: args.x, y: args.y },
    data: {
      type: 'message',
      text: args.text,
      parseMode: 'None',
      ...(args.keyboard ? { keyboard: { rows: args.keyboard.map((row) => ({ buttons: row })) } } : {}),
      ...(args.attachments?.length ? { attachments: args.attachments } : {}),
      __label: args.label,
      __description: args.description,
    },
  }
}

function createTriggerNode(args: {
  id: string
  x: number
  y: number
  label: string
  description: string
  trigger: 'command' | 'callbackQuery'
  pattern: string
}): Node {
  return {
    id: args.id,
    type: 'trigger',
    position: { x: args.x, y: args.y },
    data: {
      type: 'trigger',
      trigger: args.trigger,
      pattern: args.pattern,
      __label: args.label,
      __description: args.description,
    },
  }
}

function createInputNode(args: {
  id: string
  x: number
  y: number
  label: string
  description: string
  question: string
  variableName: string
  inputPlaceholder: string
}) : Node {
  return {
    id: args.id,
    type: 'input',
    position: { x: args.x, y: args.y },
    data: {
      type: 'input',
      question: args.question,
      variableName: args.variableName,
      inputPlaceholder: args.inputPlaceholder,
      forceReply: true,
      __label: args.label,
      __description: args.description,
    },
  }
}

function createActionSetVariableNode(args: {
  id: string
  x: number
  y: number
  label: string
  description: string
  variableName: string
  value: string
}): Node {
  return {
    id: args.id,
    type: 'action',
    position: { x: args.x, y: args.y },
    data: {
      type: 'action',
      action: {
        type: 'setVariable',
        variableName: args.variableName,
        value: args.value,
      },
      __label: args.label,
      __description: args.description,
    },
  }
}

function createConfig(builder: FlowBuilder): BotConfig {
  return {
    nodes: builder.nodes,
    edges: uniqById(builder.edges),
    variables: [],
    version: QUICK_START_GENERATOR_VERSION,
  }
}

function pickLocaleText<T>(locale: GeneratorLocale, values: { ru: T; en: T }): T {
  return locale === 'en' ? values.en : values.ru
}

function buildInlineButtons(buttons: Array<{ text: string; callbackData: string }>): ButtonConfig[][] {
  return buttons.map((button, index) => [
    {
      id: `btn:${slugify(button.callbackData || String(index + 1))}`,
      text: button.text,
      actionType: 'callback',
      callbackData: button.callbackData,
    },
  ])
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key]
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function readServices(record: Record<string, unknown>, key: string, fallback: ServiceItem[]): ServiceItem[] {
  const raw = record[key]
  if (!Array.isArray(raw)) return fallback

  const items = raw
    .map((item, index) => {
      const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const name = normalizeText(source.name, '')
      if (!name) return null
      const price = normalizeText(source.price, '')
      const description = normalizeText(source.description, '')
      return {
        id: normalizeText(source.id, `${slugify(name)}-${index + 1}`),
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
      }
    })
    .filter(Boolean) as ServiceItem[]

  return items.length > 0 ? items.slice(0, 6) : fallback
}

function readFaqItems(record: Record<string, unknown>, key: string, fallback: FaqItem[]): FaqItem[] {
  const raw = record[key]
  if (!Array.isArray(raw)) return fallback

  const items = raw
    .map((item, index) => {
      const source = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const question = normalizeText(source.question, '')
      const answer = normalizeText(source.answer, '')
      if (!question || !answer) return null

      return {
        id: normalizeText(source.id, `${slugify(question)}-${index + 1}`),
        question,
        answer,
      }
    })
    .filter(Boolean) as FaqItem[]

  return items.length > 0 ? items.slice(0, 6) : fallback
}

function buildLeadGenConfig(answers: Record<string, unknown>, locale: GeneratorLocale): BotConfig {
  const builder = createBuilder()
  const businessName = normalizeText(
    answers.businessName,
    pickLocaleText(locale, { ru: 'Ваш бизнес', en: 'Your business' })
  )
  const businessDescription = normalizeText(
    answers.businessDescription,
    pickLocaleText(locale, {
      ru: 'Мы помогаем быстро ответить на запрос и принять заявку.',
      en: 'We help reply quickly and capture new leads.',
    })
  )
  const cta = normalizeText(
    answers.cta,
    pickLocaleText(locale, { ru: 'Оставить заявку', en: 'Leave a request' })
  )
  const contact = normalizeText(
    answers.contact,
    pickLocaleText(locale, { ru: 'Мы свяжемся с вами в ближайшее время.', en: 'We will contact you shortly.' })
  )

  const fieldDefinitions = [
    readBoolean(answers, 'collectName', true)
      ? {
          key: 'lead_name',
          question: pickLocaleText(locale, {
            ru: 'Как вас зовут?',
            en: 'What is your name?',
          }),
          placeholder: pickLocaleText(locale, {
            ru: 'Введите имя',
            en: 'Enter your name',
          }),
          label: pickLocaleText(locale, { ru: 'Имя клиента', en: 'Lead name' }),
        }
      : null,
    readBoolean(answers, 'collectPhone', true)
      ? {
          key: 'lead_phone',
          question: pickLocaleText(locale, {
            ru: 'Оставьте телефон или @username для связи.',
            en: 'Leave your phone or @username for contact.',
          }),
          placeholder: pickLocaleText(locale, {
            ru: 'Телефон или @username',
            en: 'Phone or @username',
          }),
          label: pickLocaleText(locale, { ru: 'Контакт клиента', en: 'Lead contact' }),
        }
      : null,
    readBoolean(answers, 'collectQuestion', true)
      ? {
          key: 'lead_question',
          question: pickLocaleText(locale, {
            ru: 'Коротко опишите ваш вопрос или задачу.',
            en: 'Briefly describe your question or request.',
          }),
          placeholder: pickLocaleText(locale, {
            ru: 'Ваш вопрос',
            en: 'Your request',
          }),
          label: pickLocaleText(locale, { ru: 'Запрос клиента', en: 'Lead request' }),
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    question: string
    placeholder: string
    label: string
  }>

  addNode(builder, createTriggerNode({
    id: 'lead-start',
    x: MAIN_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Старт /start', en: 'Start /start' }),
    description: pickLocaleText(locale, { ru: 'Запуск по команде /start', en: 'Start on /start command' }),
    trigger: 'command',
    pattern: '/start',
  }))
  addNode(builder, createTriggerNode({
    id: 'lead-cta-trigger',
    x: SECONDARY_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Кнопка заявки', en: 'Lead CTA' }),
    description: pickLocaleText(locale, { ru: 'Нажатие inline-кнопки заявки', en: 'Inline lead button click' }),
    trigger: 'callbackQuery',
    pattern: 'lead:start',
  }))
  addNode(builder, createMessageNode({
    id: 'lead-welcome',
    x: MAIN_X,
    y: 220,
    label: pickLocaleText(locale, { ru: 'Приветствие', en: 'Welcome message' }),
    description: pickLocaleText(locale, { ru: 'Первое сообщение с CTA', en: 'First message with CTA' }),
    text: pickLocaleText(locale, {
      ru: `Здравствуйте! Это ${businessName}.\n\n${businessDescription}`,
      en: `Hello! This is ${businessName}.\n\n${businessDescription}`,
    }),
    keyboard: buildInlineButtons([{ text: cta, callbackData: 'lead:start' }]),
  }))

  addEdge(builder, 'lead-start', 'lead-welcome')

  let previousNodeId = 'lead-cta-trigger'
  let currentY = 220

  if (fieldDefinitions.length === 0) {
    addNode(builder, createMessageNode({
      id: 'lead-confirmation',
      x: SECONDARY_X,
      y: currentY,
      label: pickLocaleText(locale, { ru: 'Подтверждение', en: 'Confirmation' }),
      description: pickLocaleText(locale, { ru: 'Завершение заявки', en: 'Lead completion' }),
      text: pickLocaleText(locale, {
        ru: `Спасибо! Ваша заявка для ${businessName} принята.\n\n${contact}`,
        en: `Thanks! Your request for ${businessName} has been received.\n\n${contact}`,
      }),
    }))
    addEdge(builder, previousNodeId, 'lead-confirmation')
    return createConfig(builder)
  }

  for (const [index, field] of fieldDefinitions.entries()) {
    const nodeId = `lead-input-${index + 1}`
    addNode(builder, createInputNode({
      id: nodeId,
      x: SECONDARY_X,
      y: currentY,
      label: field.label,
      description: field.question,
      question: field.question,
      variableName: field.key,
      inputPlaceholder: field.placeholder,
    }))
    addEdge(builder, previousNodeId, nodeId)
    previousNodeId = nodeId
    currentY += ROW_GAP
  }

  const summaryLines = [
    pickLocaleText(locale, {
      ru: `Спасибо! Заявка для ${businessName} принята.`,
      en: `Thanks! Your request for ${businessName} has been received.`,
    }),
    fieldDefinitions.some((field) => field.key === 'lead_name')
      ? pickLocaleText(locale, { ru: 'Имя: {{lead_name}}', en: 'Name: {{lead_name}}' })
      : null,
    fieldDefinitions.some((field) => field.key === 'lead_phone')
      ? pickLocaleText(locale, { ru: 'Контакт: {{lead_phone}}', en: 'Contact: {{lead_phone}}' })
      : null,
    fieldDefinitions.some((field) => field.key === 'lead_question')
      ? pickLocaleText(locale, { ru: 'Запрос: {{lead_question}}', en: 'Request: {{lead_question}}' })
      : null,
    '',
    contact,
  ].filter(Boolean)

  addNode(builder, createMessageNode({
    id: 'lead-confirmation',
    x: SECONDARY_X,
    y: currentY,
    label: pickLocaleText(locale, { ru: 'Подтверждение', en: 'Confirmation' }),
    description: pickLocaleText(locale, { ru: 'Финал заявки', en: 'Lead summary' }),
    text: summaryLines.join('\n'),
  }))
  addEdge(builder, previousNodeId, 'lead-confirmation')

  return createConfig(builder)
}

function buildFaqConfig(answers: Record<string, unknown>, locale: GeneratorLocale): BotConfig {
  const builder = createBuilder()
  const businessName = normalizeText(
    answers.businessName,
    pickLocaleText(locale, { ru: 'Ваш бизнес', en: 'Your business' })
  )
  const businessDescription = normalizeText(
    answers.businessDescription,
    pickLocaleText(locale, {
      ru: 'Бот помогает быстро найти ответ на частые вопросы.',
      en: 'This bot helps visitors find quick answers to common questions.',
    })
  )
  const contact = normalizeText(
    answers.contact,
    pickLocaleText(locale, {
      ru: 'Если вопрос не решён, напишите нам в ответ на это сообщение.',
      en: 'If your question is not resolved, reply to this message and we will help.',
    })
  )
  const faqItems = readFaqItems(answers, 'faqItems', [
    {
      id: 'hours',
      question: pickLocaleText(locale, { ru: 'Какой у вас график?', en: 'What are your hours?' }),
      answer: pickLocaleText(locale, { ru: 'Мы работаем ежедневно с 10:00 до 20:00.', en: 'We work daily from 10:00 to 20:00.' }),
    },
    {
      id: 'price',
      question: pickLocaleText(locale, { ru: 'Сколько это стоит?', en: 'How much does it cost?' }),
      answer: pickLocaleText(locale, { ru: 'Стоимость зависит от задачи. Оставьте заявку, и мы уточним цену.', en: 'Pricing depends on the request. Leave a message and we will confirm the price.' }),
    },
    {
      id: 'location',
      question: pickLocaleText(locale, { ru: 'Где вы находитесь?', en: 'Where are you located?' }),
      answer: pickLocaleText(locale, { ru: 'Мы работаем онлайн и можем обсудить детали в Telegram.', en: 'We work online and can discuss details in Telegram.' }),
    },
  ])

  const menuButtons = buildInlineButtons([
    ...faqItems.map((item) => ({
      text: item.question,
      callbackData: `faq:${item.id}`,
    })),
    {
      text: pickLocaleText(locale, { ru: 'Связаться', en: 'Contact us' }),
      callbackData: 'faq:contact',
    },
  ])

  addNode(builder, createTriggerNode({
    id: 'faq-start',
    x: MAIN_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Старт /start', en: 'Start /start' }),
    description: pickLocaleText(locale, { ru: 'Запуск FAQ по команде', en: 'FAQ entry on /start' }),
    trigger: 'command',
    pattern: '/start',
  }))
  addNode(builder, createTriggerNode({
    id: 'faq-menu-trigger',
    x: SECONDARY_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Возврат в меню', en: 'Back to menu' }),
    description: pickLocaleText(locale, { ru: 'Открывает FAQ-меню', en: 'Opens FAQ menu' }),
    trigger: 'callbackQuery',
    pattern: 'faq:menu',
  }))
  addNode(builder, createTriggerNode({
    id: 'faq-contact-trigger',
    x: THIRD_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Контакт', en: 'Contact' }),
    description: pickLocaleText(locale, { ru: 'Показывает способ связи', en: 'Shows contact instructions' }),
    trigger: 'callbackQuery',
    pattern: 'faq:contact',
  }))
  addNode(builder, createMessageNode({
    id: 'faq-menu',
    x: MAIN_X,
    y: 220,
    label: pickLocaleText(locale, { ru: 'FAQ меню', en: 'FAQ menu' }),
    description: pickLocaleText(locale, { ru: 'Главное меню вопросов', en: 'Main FAQ menu' }),
    text: pickLocaleText(locale, {
      ru: `Здравствуйте! Это ${businessName}.\n\n${businessDescription}\n\nВыберите вопрос ниже:`,
      en: `Hello! This is ${businessName}.\n\n${businessDescription}\n\nChoose a question below:`,
    }),
    keyboard: menuButtons,
  }))
  addNode(builder, createMessageNode({
    id: 'faq-contact',
    x: THIRD_X,
    y: 220,
    label: pickLocaleText(locale, { ru: 'Контактный ответ', en: 'Contact answer' }),
    description: pickLocaleText(locale, { ru: 'Показывает, как связаться', en: 'Shows how to contact you' }),
    text: contact,
    keyboard: buildInlineButtons([
      {
        text: pickLocaleText(locale, { ru: 'Назад к вопросам', en: 'Back to questions' }),
        callbackData: 'faq:menu',
      },
    ]),
  }))

  addEdge(builder, 'faq-start', 'faq-menu')
  addEdge(builder, 'faq-menu-trigger', 'faq-menu')
  addEdge(builder, 'faq-contact-trigger', 'faq-contact')

  faqItems.forEach((item, index) => {
    const x = MAIN_X + (index % 3) * COLUMN_GAP
    const y = 520 + Math.floor(index / 3) * (ROW_GAP * 2)
    const triggerId = `faq-trigger-${item.id}`
    const answerId = `faq-answer-${item.id}`

    addNode(builder, createTriggerNode({
      id: triggerId,
      x,
      y: 340 + Math.floor(index / 3) * (ROW_GAP * 2),
      label: item.question,
      description: pickLocaleText(locale, { ru: 'Ответ на вопрос FAQ', en: 'FAQ answer branch' }),
      trigger: 'callbackQuery',
      pattern: `faq:${item.id}`,
    }))
    addNode(builder, createMessageNode({
      id: answerId,
      x,
      y,
      label: item.question,
      description: item.answer,
      text: item.answer,
      keyboard: buildInlineButtons([
        {
          text: pickLocaleText(locale, { ru: 'Назад к вопросам', en: 'Back to questions' }),
          callbackData: 'faq:menu',
        },
        {
          text: pickLocaleText(locale, { ru: 'Связаться', en: 'Contact us' }),
          callbackData: 'faq:contact',
        },
      ]),
    }))
    addEdge(builder, triggerId, answerId)
  })

  return createConfig(builder)
}

function buildBookingConfig(answers: Record<string, unknown>, locale: GeneratorLocale): BotConfig {
  const builder = createBuilder()
  const businessName = normalizeText(
    answers.businessName,
    pickLocaleText(locale, { ru: 'Ваш бизнес', en: 'Your business' })
  )
  const schedule = normalizeText(
    answers.schedule,
    pickLocaleText(locale, { ru: 'Свободные слоты уточняются менеджером.', en: 'Available slots are confirmed by the manager.' })
  )
  const contact = normalizeText(
    answers.contact,
    pickLocaleText(locale, { ru: 'Мы подтвердим запись в ответном сообщении.', en: 'We will confirm your booking in a follow-up message.' })
  )
  const services = readServices(answers, 'services', [
    {
      id: 'consultation',
      name: pickLocaleText(locale, { ru: 'Консультация', en: 'Consultation' }),
      description: pickLocaleText(locale, { ru: 'Первичная консультация и подбор решения.', en: 'Initial consultation and service selection.' }),
    },
  ])

  const collectName = readBoolean(answers, 'collectName', true)
  const collectPhone = readBoolean(answers, 'collectPhone', true)
  const collectDate = readBoolean(answers, 'collectDate', true)

  addNode(builder, createTriggerNode({
    id: 'booking-start',
    x: MAIN_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Старт /start', en: 'Start /start' }),
    description: pickLocaleText(locale, { ru: 'Открывает меню записи', en: 'Opens booking menu' }),
    trigger: 'command',
    pattern: '/start',
  }))
  addNode(builder, createTriggerNode({
    id: 'booking-menu-trigger',
    x: SECONDARY_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Возврат к услугам', en: 'Back to services' }),
    description: pickLocaleText(locale, { ru: 'Возвращает в меню услуг', en: 'Returns to service menu' }),
    trigger: 'callbackQuery',
    pattern: 'booking:menu',
  }))
  addNode(builder, createMessageNode({
    id: 'booking-menu',
    x: MAIN_X,
    y: 220,
    label: pickLocaleText(locale, { ru: 'Меню услуг', en: 'Service menu' }),
    description: pickLocaleText(locale, { ru: 'Выбор услуги для записи', en: 'Choose a service to book' }),
    text: pickLocaleText(locale, {
      ru: `Здравствуйте! Это ${businessName}.\n\nВыберите услугу для записи.\n${schedule}`,
      en: `Hello! This is ${businessName}.\n\nChoose a service to book.\n${schedule}`,
    }),
    keyboard: buildInlineButtons(
      services.map((service) => ({
        text: service.name,
        callbackData: `booking:service:${slugify(service.id)}`,
      }))
    ),
  }))

  addEdge(builder, 'booking-start', 'booking-menu')
  addEdge(builder, 'booking-menu-trigger', 'booking-menu')

  const sharedInputNodes: string[] = []
  let chainY = 860

  if (collectName) {
    const nodeId = 'booking-input-name'
    addNode(builder, createInputNode({
      id: nodeId,
      x: SECONDARY_X,
      y: chainY,
      label: pickLocaleText(locale, { ru: 'Имя клиента', en: 'Client name' }),
      description: pickLocaleText(locale, { ru: 'Запрашивает имя', en: 'Requests name' }),
      question: pickLocaleText(locale, { ru: 'Как вас зовут?', en: 'What is your name?' }),
      variableName: 'booking_name',
      inputPlaceholder: pickLocaleText(locale, { ru: 'Введите имя', en: 'Enter your name' }),
    }))
    sharedInputNodes.push(nodeId)
    chainY += ROW_GAP
  }

  if (collectPhone) {
    const nodeId = 'booking-input-phone'
    addNode(builder, createInputNode({
      id: nodeId,
      x: SECONDARY_X,
      y: chainY,
      label: pickLocaleText(locale, { ru: 'Контакт', en: 'Contact' }),
      description: pickLocaleText(locale, { ru: 'Запрашивает телефон', en: 'Requests phone' }),
      question: pickLocaleText(locale, { ru: 'Оставьте телефон или @username.', en: 'Leave your phone or @username.' }),
      variableName: 'booking_phone',
      inputPlaceholder: pickLocaleText(locale, { ru: 'Телефон или @username', en: 'Phone or @username' }),
    }))
    sharedInputNodes.push(nodeId)
    chainY += ROW_GAP
  }

  if (collectDate) {
    const nodeId = 'booking-input-date'
    addNode(builder, createInputNode({
      id: nodeId,
      x: SECONDARY_X,
      y: chainY,
      label: pickLocaleText(locale, { ru: 'Дата записи', en: 'Preferred date' }),
      description: pickLocaleText(locale, { ru: 'Запрашивает дату', en: 'Requests preferred date' }),
      question: pickLocaleText(locale, { ru: 'На какую дату или время хотите записаться?', en: 'Which date or time would you prefer?' }),
      variableName: 'booking_date',
      inputPlaceholder: pickLocaleText(locale, { ru: 'Дата или время', en: 'Date or time' }),
    }))
    sharedInputNodes.push(nodeId)
    chainY += ROW_GAP
  }

  const confirmationLines = [
    pickLocaleText(locale, {
      ru: 'Спасибо! Заявка на запись принята.',
      en: 'Thanks! Your booking request has been received.',
    }),
    pickLocaleText(locale, { ru: 'Услуга: {{booking_service}}', en: 'Service: {{booking_service}}' }),
    collectName ? pickLocaleText(locale, { ru: 'Имя: {{booking_name}}', en: 'Name: {{booking_name}}' }) : null,
    collectPhone ? pickLocaleText(locale, { ru: 'Контакт: {{booking_phone}}', en: 'Contact: {{booking_phone}}' }) : null,
    collectDate ? pickLocaleText(locale, { ru: 'Дата: {{booking_date}}', en: 'Date: {{booking_date}}' }) : null,
    '',
    contact,
  ].filter(Boolean)

  addNode(builder, createMessageNode({
    id: 'booking-confirmation',
    x: SECONDARY_X,
    y: chainY,
    label: pickLocaleText(locale, { ru: 'Подтверждение записи', en: 'Booking confirmation' }),
    description: pickLocaleText(locale, { ru: 'Финал заявки на запись', en: 'Booking summary' }),
    text: confirmationLines.join('\n'),
  }))

  if (sharedInputNodes.length > 0) {
    sharedInputNodes.forEach((nodeId, index) => {
      const nextNodeId = sharedInputNodes[index + 1] || 'booking-confirmation'
      addEdge(builder, nodeId, nextNodeId)
    })
  }

  services.forEach((service, index) => {
    const triggerId = `booking-trigger-${slugify(service.id)}`
    const actionId = `booking-set-service-${slugify(service.id)}`
    const columnX = MAIN_X + (index % 3) * COLUMN_GAP
    const rowOffset = Math.floor(index / 3) * (ROW_GAP * 2)

    addNode(builder, createTriggerNode({
      id: triggerId,
      x: columnX,
      y: 420 + rowOffset,
      label: service.name,
      description: pickLocaleText(locale, { ru: 'Выбор услуги', en: 'Service selection' }),
      trigger: 'callbackQuery',
      pattern: `booking:service:${slugify(service.id)}`,
    }))
    addNode(builder, createActionSetVariableNode({
      id: actionId,
      x: columnX,
      y: 600 + rowOffset,
      label: pickLocaleText(locale, { ru: 'Сохранить услугу', en: 'Save service' }),
      description: service.description || service.name,
      variableName: 'booking_service',
      value: service.name,
    }))

    addEdge(builder, triggerId, actionId)
    addEdge(builder, actionId, sharedInputNodes[0] || 'booking-confirmation')
  })

  return createConfig(builder)
}

function buildServicesConfig(answers: Record<string, unknown>, locale: GeneratorLocale): BotConfig {
  const builder = createBuilder()
  const businessName = normalizeText(
    answers.businessName,
    pickLocaleText(locale, { ru: 'Ваш бизнес', en: 'Your business' })
  )
  const cta = normalizeText(
    answers.cta,
    pickLocaleText(locale, { ru: 'Оставить заявку', en: 'Leave a request' })
  )
  const contact = normalizeText(
    answers.contact,
    pickLocaleText(locale, { ru: 'Мы свяжемся с вами в ближайшее время.', en: 'We will contact you shortly.' })
  )
  const services = readServices(answers, 'services', [
    {
      id: 'service-1',
      name: pickLocaleText(locale, { ru: 'Основная услуга', en: 'Main service' }),
      description: pickLocaleText(locale, { ru: 'Короткое описание услуги.', en: 'Short service description.' }),
    },
  ])

  addNode(builder, createTriggerNode({
    id: 'services-start',
    x: MAIN_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Старт /start', en: 'Start /start' }),
    description: pickLocaleText(locale, { ru: 'Открывает каталог', en: 'Opens catalog' }),
    trigger: 'command',
    pattern: '/start',
  }))
  addNode(builder, createTriggerNode({
    id: 'services-menu-trigger',
    x: SECONDARY_X,
    y: 40,
    label: pickLocaleText(locale, { ru: 'Возврат в каталог', en: 'Back to catalog' }),
    description: pickLocaleText(locale, { ru: 'Открывает список услуг', en: 'Reopens service catalog' }),
    trigger: 'callbackQuery',
    pattern: 'services:menu',
  }))
  addNode(builder, createMessageNode({
    id: 'services-menu',
    x: MAIN_X,
    y: 220,
    label: pickLocaleText(locale, { ru: 'Каталог услуг', en: 'Service catalog' }),
    description: pickLocaleText(locale, { ru: 'Показывает список услуг', en: 'Shows service list' }),
    text: pickLocaleText(locale, {
      ru: `Здравствуйте! Это ${businessName}.\n\nВыберите интересующую услугу:`,
      en: `Hello! This is ${businessName}.\n\nChoose the service you need:`,
    }),
    keyboard: buildInlineButtons(
      services.map((service) => ({
        text: service.price ? `${service.name} · ${service.price}` : service.name,
        callbackData: `services:item:${slugify(service.id)}`,
      }))
    ),
  }))

  addEdge(builder, 'services-start', 'services-menu')
  addEdge(builder, 'services-menu-trigger', 'services-menu')

  addNode(builder, createInputNode({
    id: 'services-input-name',
    x: SECONDARY_X,
    y: 1160,
    label: pickLocaleText(locale, { ru: 'Имя клиента', en: 'Client name' }),
    description: pickLocaleText(locale, { ru: 'Запрашивает имя', en: 'Requests name' }),
    question: pickLocaleText(locale, { ru: 'Как вас зовут?', en: 'What is your name?' }),
    variableName: 'services_lead_name',
    inputPlaceholder: pickLocaleText(locale, { ru: 'Введите имя', en: 'Enter your name' }),
  }))
  addNode(builder, createInputNode({
    id: 'services-input-contact',
    x: SECONDARY_X,
    y: 1340,
    label: pickLocaleText(locale, { ru: 'Контакт клиента', en: 'Client contact' }),
    description: pickLocaleText(locale, { ru: 'Запрашивает контакт', en: 'Requests contact' }),
    question: pickLocaleText(locale, { ru: 'Оставьте телефон или @username.', en: 'Leave your phone or @username.' }),
    variableName: 'services_lead_contact',
    inputPlaceholder: pickLocaleText(locale, { ru: 'Телефон или @username', en: 'Phone or @username' }),
  }))
  addNode(builder, createMessageNode({
    id: 'services-confirmation',
    x: SECONDARY_X,
    y: 1520,
    label: pickLocaleText(locale, { ru: 'Подтверждение заявки', en: 'Lead confirmation' }),
    description: pickLocaleText(locale, { ru: 'Финал заявки по услуге', en: 'Lead summary for service request' }),
    text: [
      pickLocaleText(locale, {
        ru: 'Спасибо! Мы получили заявку по услуге {{lead_service}}.',
        en: 'Thanks! We received your request for {{lead_service}}.',
      }),
      pickLocaleText(locale, { ru: 'Имя: {{services_lead_name}}', en: 'Name: {{services_lead_name}}' }),
      pickLocaleText(locale, { ru: 'Контакт: {{services_lead_contact}}', en: 'Contact: {{services_lead_contact}}' }),
      '',
      contact,
    ].join('\n'),
  }))
  addEdge(builder, 'services-input-name', 'services-input-contact')
  addEdge(builder, 'services-input-contact', 'services-confirmation')

  services.forEach((service, index) => {
    const columnX = MAIN_X + (index % 3) * COLUMN_GAP
    const rowOffset = Math.floor(index / 3) * (ROW_GAP * 3)
    const itemTriggerId = `services-item-trigger-${slugify(service.id)}`
    const detailId = `services-detail-${slugify(service.id)}`
    const leadTriggerId = `services-lead-trigger-${slugify(service.id)}`
    const setLeadServiceId = `services-set-service-${slugify(service.id)}`

    addNode(builder, createTriggerNode({
      id: itemTriggerId,
      x: columnX,
      y: 420 + rowOffset,
      label: service.name,
      description: pickLocaleText(locale, { ru: 'Открывает карточку услуги', en: 'Opens service detail' }),
      trigger: 'callbackQuery',
      pattern: `services:item:${slugify(service.id)}`,
    }))
    addNode(builder, createMessageNode({
      id: detailId,
      x: columnX,
      y: 620 + rowOffset,
      label: service.name,
      description: service.description || service.name,
      text: [
        `${service.name}${service.price ? `\n${pickLocaleText(locale, { ru: 'Цена', en: 'Price' })}: ${service.price}` : ''}`,
        service.description || pickLocaleText(locale, {
          ru: 'Подробности по услуге можно уточнить в заявке.',
          en: 'You can ask for more details in your request.',
        }),
      ].join('\n\n'),
      keyboard: buildInlineButtons([
        {
          text: cta,
          callbackData: `services:lead:${slugify(service.id)}`,
        },
        {
          text: pickLocaleText(locale, { ru: 'Назад в каталог', en: 'Back to catalog' }),
          callbackData: 'services:menu',
        },
      ]),
    }))
    addNode(builder, createTriggerNode({
      id: leadTriggerId,
      x: columnX,
      y: 860 + rowOffset,
      label: pickLocaleText(locale, { ru: 'Заявка по услуге', en: 'Service lead CTA' }),
      description: pickLocaleText(locale, { ru: 'Начинает сбор заявки', en: 'Starts lead capture' }),
      trigger: 'callbackQuery',
      pattern: `services:lead:${slugify(service.id)}`,
    }))
    addNode(builder, createActionSetVariableNode({
      id: setLeadServiceId,
      x: columnX,
      y: 1020 + rowOffset,
      label: pickLocaleText(locale, { ru: 'Сохранить выбранную услугу', en: 'Save selected service' }),
      description: service.description || service.name,
      variableName: 'lead_service',
      value: service.name,
    }))

    addEdge(builder, itemTriggerId, detailId)
    addEdge(builder, leadTriggerId, setLeadServiceId)
    addEdge(builder, setLeadServiceId, 'services-input-name')
  })

  return createConfig(builder)
}

export function generateQuickStartBotConfig(input: GeneratorInput): BotConfig {
  const locale = toLocale(input.locale)
  const answers = input.answers || {}

  switch (input.templateId) {
    case 'lead-gen':
      return buildLeadGenConfig(answers, locale)
    case 'faq':
      return buildFaqConfig(answers, locale)
    case 'booking':
      return buildBookingConfig(answers, locale)
    case 'services':
      return buildServicesConfig(answers, locale)
    default:
      return {
        nodes: [],
        edges: [],
        variables: [],
        version: QUICK_START_GENERATOR_VERSION,
      }
  }
}
