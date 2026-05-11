import type { BotConfig, BotMetadata, Edge, Node } from '@/lib/bot-editor/types/bot.types'

export type RestaurantBotTemplateId =
  | 'restaurant-menu'
  | 'restaurant-booking'
  | 'restaurant-delivery'
  | 'restaurant-promos-faq'
  | 'restaurant-lead'

export const RESTAURANT_BOT_TEMPLATE_IDS = new Set<string>([
  'restaurant-menu',
  'restaurant-booking',
  'restaurant-delivery',
  'restaurant-promos-faq',
  'restaurant-lead',
])

type RestaurantTemplateBuild = {
  config: BotConfig
  metadata: Pick<BotMetadata, 'database'> & {
    restaurantTemplateVersion: 'v1'
  }
}

type TemplateNodeInput = Omit<Node, 'position'> & {
  x: number
  y: number
}

function node(input: TemplateNodeInput): Node {
  const { x, y, ...rest } = input
  return {
    ...rest,
    position: { x, y },
  }
}

function edge(source: string, target: string, index: number): Edge {
  return {
    id: `edge_${index}_${source}_${target}`,
    source,
    target,
    sourceHandle: null,
    targetHandle: null,
    animated: true,
    type: 'canvas-edge',
  }
}

function chain(nodes: Node[]): Edge[] {
  return nodes.slice(0, -1).map((item, index) => edge(item.id, nodes[index + 1].id, index + 1))
}

function trigger(id: string, x: number, y: number): Node {
  return node({
    id,
    type: 'trigger',
    x,
    y,
    data: {
      trigger: 'command',
      pattern: '/start',
      __label: 'Command Trigger',
      __description: 'Запуск по /start',
    },
  })
}

function message(id: string, x: number, y: number, text: string): Node {
  return node({
    id,
    type: 'message',
    x,
    y,
    data: {
      text,
      parseMode: 'None',
      typingDraft: false,
      disableWebPagePreview: false,
      disableNotification: false,
      attachments: [],
      __label: 'Message',
      __description: 'Сообщение гостю',
    },
  })
}

function input(id: string, x: number, y: number, question: string, variableName: string, placeholder: string): Node {
  return node({
    id,
    type: 'input',
    x,
    y,
    data: {
      question,
      variableName,
      parseMode: 'None',
      forceReply: true,
      inputPlaceholder: placeholder,
      skipButton: false,
      __label: 'Input',
      __description: `Записать ответ в ${variableName}`,
    },
  })
}

function database(id: string, x: number, y: number, mode: 'all' | 'search', query = '{{message.text}}'): Node {
  return node({
    id,
    type: 'database',
    x,
    y,
    data: {
      mode,
      query,
      saveToVariable: 'database.result',
      maxMatches: 5,
      fallbackText: 'Пока не нашли точный ответ. Напишите администратору, и мы уточним.',
      __label: 'Database',
      __description: 'Данные ресторана',
    },
  })
}

function crm(id: string, x: number, y: number, params: {
  title: string
  externalKey: string
  fieldMappings: Array<{ fieldKey: string; value: string }>
  tags: string
  notes?: string
}): Node {
  return node({
    id,
    type: 'crm',
    x,
    y,
    data: {
      operation: 'create_or_update',
      scope: 'bot',
      stageKey: 'new',
      title: params.title,
      externalKey: params.externalKey,
      fieldMappings: params.fieldMappings,
      tags: params.tags,
      notes: params.notes || '',
      saveToVariable: 'crm.card',
      __label: 'CRM',
      __description: 'Создать карточку заявки',
    },
  })
}

function buildConfig(nodes: Node[]): BotConfig {
  return {
    nodes,
    edges: chain(nodes),
    variables: [],
    version: '1.0.0',
  }
}

function rows(items: Array<{ id: string; text: string }>): BotMetadata['database'] {
  return {
    rows: items,
    text: items.map((item) => `[${item.id}]\n${item.text}`).join('\n\n'),
    sourceName: 'restaurant-template',
    updatedAt: new Date().toISOString(),
  }
}

function menuTemplate(): RestaurantTemplateBuild {
  const nodes = [
    trigger('start', 120, 120),
    message('welcome', 120, 270, 'Здравствуйте! Вот меню ресторана. Все позиции можно изменить в разделе «База данных».'),
    database('menu_database', 120, 420, 'all'),
    message('show_menu', 120, 570, '{{database.result}}\n\nЕсли хотите оформить заказ или задать вопрос, напишите администратору.'),
  ]

  return {
    config: buildConfig(nodes),
    metadata: {
      restaurantTemplateVersion: 'v1',
      database: rows([
        { id: 'menu', text: 'Меню:\n- Паста с томатами — 650 ₽\n- Цезарь с курицей — 590 ₽\n- Стейк с картофелем — 1200 ₽' },
        { id: 'drinks', text: 'Напитки:\n- Лимонад — 250 ₽\n- Капучино — 220 ₽\n- Вода — 150 ₽' },
        { id: 'contacts', text: 'Адрес: укажите адрес ресторана\nТелефон: укажите телефон\nВремя работы: 10:00-22:00' },
      ]),
    },
  }
}

function bookingTemplate(): RestaurantTemplateBuild {
  const nodes = [
    trigger('start', 120, 80),
    message('welcome', 120, 220, 'Здравствуйте! Помогу забронировать столик. Ответьте на несколько вопросов.'),
    input('ask_date', 120, 360, 'На какую дату нужна бронь?', 'booking_date', 'Например: 25 мая'),
    input('ask_time', 120, 500, 'На какое время?', 'booking_time', 'Например: 19:30'),
    input('ask_guests', 120, 640, 'Сколько гостей будет?', 'booking_guests', 'Например: 4'),
    input('ask_name', 520, 220, 'Как вас зовут?', 'guest_name', 'Имя'),
    input('ask_phone', 520, 360, 'Оставьте телефон для подтверждения брони.', 'guest_phone', '+7...'),
    crm('create_booking', 520, 500, {
      title: 'Бронь: {{booking_date}} {{booking_time}}',
      externalKey: '{{user.id}}-{{booking_date}}-{{booking_time}}',
      tags: 'бронь, ресторан',
      notes: 'Заявка на бронирование столика из Telegram',
      fieldMappings: [
        { fieldKey: 'name', value: '{{guest_name}}' },
        { fieldKey: 'phone', value: '{{guest_phone}}' },
        { fieldKey: 'comment', value: 'Дата: {{booking_date}}, время: {{booking_time}}, гостей: {{booking_guests}}' },
        { fieldKey: 'date_time', value: '{{booking_date}} {{booking_time}}' },
      ],
    }),
    message('confirm', 520, 640, 'Спасибо! Мы получили бронь на {{booking_date}} в {{booking_time}} для {{booking_guests}} гостей. Администратор свяжется с вами для подтверждения.'),
  ]

  return {
    config: buildConfig(nodes),
    metadata: {
      restaurantTemplateVersion: 'v1',
      database: rows([
        { id: 'booking_rules', text: 'Правила бронирования: укажите лимит гостей, время подтверждения и условия отмены.' },
      ]),
    },
  }
}

function deliveryTemplate(): RestaurantTemplateBuild {
  const nodes = [
    trigger('start', 120, 80),
    message('welcome', 120, 220, 'Здравствуйте! Помогу оформить доставку или самовывоз. Сначала покажу меню.'),
    database('menu_database', 120, 360, 'all'),
    message('show_menu', 120, 500, '{{database.result}}'),
    input('ask_order', 120, 640, 'Что добавить в заказ?', 'order_items', 'Например: 2 пасты, 1 лимонад'),
    input('ask_delivery_type', 520, 220, 'Доставка или самовывоз?', 'delivery_type', 'Доставка / самовывоз'),
    input('ask_address', 520, 360, 'Укажите адрес доставки. Если самовывоз, напишите «самовывоз».', 'delivery_address', 'Адрес'),
    input('ask_phone', 520, 500, 'Оставьте телефон для подтверждения заказа.', 'guest_phone', '+7...'),
    crm('create_order', 520, 640, {
      title: 'Заказ: {{delivery_type}}',
      externalKey: '{{user.id}}-{{order_items}}',
      tags: 'заказ, доставка',
      notes: 'Заказ из Telegram',
      fieldMappings: [
        { fieldKey: 'phone', value: '{{guest_phone}}' },
        { fieldKey: 'comment', value: 'Заказ: {{order_items}}\nТип: {{delivery_type}}\nАдрес: {{delivery_address}}' },
        { fieldKey: 'sum', value: '' },
      ],
    }),
    message('confirm', 920, 640, 'Заказ приняли: {{order_items}}.\nТип: {{delivery_type}}.\nАдрес: {{delivery_address}}.\nАдминистратор скоро подтвердит детали.'),
  ]

  return {
    config: buildConfig(nodes),
    metadata: {
      restaurantTemplateVersion: 'v1',
      database: rows([
        { id: 'menu', text: 'Меню доставки:\n- Пицца Маргарита — 690 ₽\n- Бургер — 550 ₽\n- Картофель фри — 220 ₽' },
        { id: 'delivery', text: 'Доставка: укажите зоны, стоимость и минимальную сумму заказа.\nСамовывоз: укажите адрес и время.' },
      ]),
    },
  }
}

function promosFaqTemplate(): RestaurantTemplateBuild {
  const nodes = [
    trigger('start', 120, 120),
    message('welcome', 120, 270, 'Здравствуйте! Я отвечу на вопросы про ресторан: часы работы, адрес, акции, меню и бронь.'),
    input('ask_question', 120, 420, 'Что хотите узнать?', 'faq_question', 'Например: какие акции сегодня?'),
    database('faq_database', 120, 570, 'search', '{{faq_question}}'),
    message('answer', 120, 720, '{{database.result}}\n\nЕсли нужно что-то ещё, напишите администратору.'),
  ]

  return {
    config: buildConfig(nodes),
    metadata: {
      restaurantTemplateVersion: 'v1',
      database: rows([
        { id: 'hours', text: 'Часы работы: ежедневно с 10:00 до 22:00.' },
        { id: 'address', text: 'Адрес: укажите адрес ресторана и ориентиры.' },
        { id: 'promo', text: 'Акции: укажите актуальные скидки, комбо и спецпредложения.' },
        { id: 'booking', text: 'Бронь: укажите телефон или правила бронирования столиков.' },
      ]),
    },
  }
}

function leadTemplate(): RestaurantTemplateBuild {
  const nodes = [
    trigger('start', 120, 120),
    message('welcome', 120, 270, 'Здравствуйте! Оставьте заявку, и администратор ресторана свяжется с вами.'),
    input('ask_name', 120, 420, 'Как вас зовут?', 'guest_name', 'Имя'),
    input('ask_phone', 120, 570, 'Оставьте телефон.', 'guest_phone', '+7...'),
    input('ask_request', 120, 720, 'Что нужно? Бронь, банкет, доставка, вопрос по меню?', 'guest_request', 'Опишите запрос'),
    crm('create_lead', 520, 570, {
      title: 'Заявка от {{guest_name}}',
      externalKey: '{{user.id}}-{{guest_request}}',
      tags: 'заявка, ресторан',
      notes: 'Заявка от гостя из Telegram',
      fieldMappings: [
        { fieldKey: 'name', value: '{{guest_name}}' },
        { fieldKey: 'phone', value: '{{guest_phone}}' },
        { fieldKey: 'comment', value: '{{guest_request}}' },
      ],
    }),
    message('confirm', 520, 720, 'Спасибо, {{guest_name}}! Заявку получили. Администратор свяжется с вами по номеру {{guest_phone}}.'),
  ]

  return {
    config: buildConfig(nodes),
    metadata: {
      restaurantTemplateVersion: 'v1',
      database: rows([
        { id: 'manager_note', text: 'Этот шаблон собирает имя, телефон и запрос гостя в CRM.' },
      ]),
    },
  }
}

export function normalizeRestaurantTemplateId(templateId: unknown): RestaurantBotTemplateId | undefined {
  const value = String(templateId || '').trim()
  return RESTAURANT_BOT_TEMPLATE_IDS.has(value) ? (value as RestaurantBotTemplateId) : undefined
}

export function buildRestaurantBotTemplate(templateId: RestaurantBotTemplateId): RestaurantTemplateBuild {
  switch (templateId) {
    case 'restaurant-booking':
      return bookingTemplate()
    case 'restaurant-delivery':
      return deliveryTemplate()
    case 'restaurant-promos-faq':
      return promosFaqTemplate()
    case 'restaurant-lead':
      return leadTemplate()
    case 'restaurant-menu':
    default:
      return menuTemplate()
  }
}
