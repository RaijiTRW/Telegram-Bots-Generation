'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useLocale } from 'next-intl';
import { useReducedMotion } from 'framer-motion';
import { motion, AnimatePresence } from '@/components/motion-wrapper';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CircleHelp,
  Filter,
  PackageOpen,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

type LocalizedText = {
  ru: string;
  en: string;
};

type ScenarioMessage = {
  from: 'bot' | 'user';
  text: LocalizedText;
};

type ScenarioChoice = {
  label: LocalizedText;
  reply: LocalizedText;
};

type ScenarioStep = {
  prompt: LocalizedText;
  choices: ScenarioChoice[];
};

type Scenario = {
  id: string;
  icon: ComponentType<{ className?: string }>;
  accent: {
    glow: string;
    ring: string;
    tint: string;
    soft: string;
    text: string;
    line: string;
    botBubble: string;
    userBubble: string;
    action: string;
    actionText: string;
  };
  label: LocalizedText;
  title: LocalizedText;
  leftCopy: LocalizedText[];
  rightCopy: LocalizedText[];
  chat: {
    header: LocalizedText;
    status: LocalizedText;
    leadIn: ScenarioMessage[];
    steps: ScenarioStep[];
    outcome: LocalizedText;
  };
};

const scenarios: Scenario[] = [
  {
    id: 'leads',
    icon: Filter,
    accent: {
      glow: 'from-[#1E88E5]/20 via-[#24A1DE]/12 to-transparent',
      ring: 'border-[#24A1DE]/24',
      tint: 'bg-[#0B1628]',
      soft: 'bg-[#0E2037]',
      text: 'text-[#89D7FF]',
      line: 'from-[#24A1DE] to-[#60A5FA]',
      botBubble: 'bg-[#10233B] border-[#1E88E5]/24',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#0F2135] border-[#1E88E5]/24',
      actionText: 'text-[#89D7FF]',
    },
    label: {
      ru: 'Лиды и заявки',
      en: 'Leads',
    },
    title: {
      ru: 'Бот в строительстве собирает заявку, уточняет объект и передаёт уже понятный запрос в работу.',
      en: 'For construction leads, the bot qualifies the project and hands over a clear request to the team.',
    },
    leftCopy: [
      {
        ru: 'Человек пишет в Telegram и сразу попадает в рабочий сценарий.',
        en: 'The user enters Telegram and goes straight into the working flow.',
      },
      {
        ru: 'Бот уточняет объект, этап и формат связи.',
        en: 'The bot clarifies the object, stage, and preferred contact format.',
      },
      {
        ru: 'Менеджер получает уже тёплую заявку, а не пустой диалог.',
        en: 'The manager receives a qualified lead instead of an empty chat.',
      },
    ],
    rightCopy: [
      {
        ru: 'Меньше ручного отбора обращений в переписке.',
        en: 'Less manual qualification inside chat.',
      },
      {
        ru: 'Быстрее путь до сметы, созвона или выезда.',
        en: 'A faster path to estimate, call, or site visit.',
      },
      {
        ru: 'Проще видеть, какие заявки реально целевые.',
        en: 'Easier to see which leads are actually worth attention.',
      },
    ],
    chat: {
      header: {
        ru: 'Строительный бот',
        en: 'Construction bot',
      },
      status: {
        ru: 'собирает заявку',
        en: 'collecting lead',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Нужно строительство дома под ключ.',
            en: 'I need full-cycle house construction.',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'Какой объект планируете?',
            en: 'What kind of project are you planning?',
          },
          choices: [
            {
              label: { ru: 'Дом', en: 'House' },
              reply: { ru: 'Дом', en: 'House' },
            },
            {
              label: { ru: 'Баня', en: 'Bathhouse' },
              reply: { ru: 'Баня', en: 'Bathhouse' },
            },
            {
              label: { ru: 'Пристройка', en: 'Extension' },
              reply: { ru: 'Пристройка', en: 'Extension' },
            },
          ],
        },
        {
          prompt: {
            ru: 'На каком этапе вы сейчас?',
            en: 'What stage are you at right now?',
          },
          choices: [
            {
              label: { ru: 'Есть участок', en: 'Land is ready' },
              reply: { ru: 'Есть участок', en: 'Land is ready' },
            },
            {
              label: { ru: 'Есть проект', en: 'Project is ready' },
              reply: { ru: 'Есть проект', en: 'Project is ready' },
            },
            {
              label: { ru: 'Нужен расчёт', en: 'Need an estimate' },
              reply: { ru: 'Нужен расчёт', en: 'Need an estimate' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Как удобнее связаться с вами?',
            en: 'What is the best way to contact you?',
          },
          choices: [
            {
              label: { ru: 'Телефон', en: 'Phone' },
              reply: { ru: 'Телефон', en: 'Phone' },
            },
            {
              label: { ru: 'Telegram', en: 'Telegram' },
              reply: { ru: 'Telegram', en: 'Telegram' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Тёплая заявка на строительство передана менеджеру',
        en: 'A qualified construction lead was sent to the manager',
      },
    },
  },
  {
    id: 'booking',
    icon: CalendarClock,
    accent: {
      glow: 'from-[#0EA5E9]/16 via-[#22D3EE]/10 to-transparent',
      ring: 'border-[#22D3EE]/20',
      tint: 'bg-[#081922]',
      soft: 'bg-[#0D212B]',
      text: 'text-[#7DEBFF]',
      line: 'from-[#22D3EE] to-[#67E8F9]',
      botBubble: 'bg-[#0F2530] border-[#22D3EE]/22',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#0F242D] border-[#22D3EE]/22',
      actionText: 'text-[#7DEBFF]',
    },
    label: {
      ru: 'Запись',
      en: 'Booking',
    },
    title: {
      ru: 'Бот берёт на себя запись и напоминает о визите без администратора в чате.',
      en: 'The bot handles booking and reminders without a human admin in chat.',
    },
    leftCopy: [
      {
        ru: 'Пользователь выбирает услугу и удобное время.',
        en: 'The user chooses the service and time slot.',
      },
      {
        ru: 'Бот уточняет формат и собирает контакты.',
        en: 'The bot confirms format and contact details.',
      },
      {
        ru: 'Команда получает уже оформленную запись.',
        en: 'The team receives a ready booking.',
      },
    ],
    rightCopy: [
      {
        ru: 'Запись работает и вечером, и в выходные.',
        en: 'Booking keeps working in evenings and on weekends.',
      },
      {
        ru: 'Меньше потерянных обращений вне рабочего времени.',
        en: 'Fewer missed requests outside working hours.',
      },
      {
        ru: 'Меньше рутины у администратора.',
        en: 'Less routine work for the admin.',
      },
    ],
    chat: {
      header: {
        ru: 'Бот записи',
        en: 'Booking bot',
      },
      status: {
        ru: 'оформляет запись',
        en: 'booking visits',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Хочу записаться на консультацию.',
            en: 'I want to book a consultation.',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'Какой формат вам нужен?',
            en: 'What format do you need?',
          },
          choices: [
            {
              label: { ru: 'Онлайн', en: 'Online' },
              reply: { ru: 'Онлайн', en: 'Online' },
            },
            {
              label: { ru: 'В офисе', en: 'In-office' },
              reply: { ru: 'В офисе', en: 'In-office' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Когда вам удобно?',
            en: 'When does it work for you?',
          },
          choices: [
            {
              label: { ru: 'Сегодня после 18:00', en: 'Today after 6 PM' },
              reply: { ru: 'Сегодня после 18:00', en: 'Today after 6 PM' },
            },
            {
              label: { ru: 'Завтра утром', en: 'Tomorrow morning' },
              reply: { ru: 'Завтра утром', en: 'Tomorrow morning' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Куда отправить подтверждение?',
            en: 'Where should I send confirmation?',
          },
          choices: [
            {
              label: { ru: 'В Telegram', en: 'In Telegram' },
              reply: { ru: 'В Telegram', en: 'In Telegram' },
            },
            {
              label: { ru: 'По телефону', en: 'By phone' },
              reply: { ru: 'По телефону', en: 'By phone' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Запись подтверждена и передана в расписание',
        en: 'Booking confirmed and sent into the schedule',
      },
    },
  },
  {
    id: 'faq',
    icon: CircleHelp,
    accent: {
      glow: 'from-[#7C4DFF]/18 via-[#8B5CF6]/10 to-transparent',
      ring: 'border-[#8B5CF6]/20',
      tint: 'bg-[#120E25]',
      soft: 'bg-[#1A1731]',
      text: 'text-[#D2B3FF]',
      line: 'from-[#8B5CF6] to-[#C084FC]',
      botBubble: 'bg-[#1A1731] border-[#8B5CF6]/24',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#1B1730] border-[#8B5CF6]/22',
      actionText: 'text-[#D2B3FF]',
    },
    label: {
      ru: 'FAQ и поддержка',
      en: 'FAQ',
    },
    title: {
      ru: 'Бот отвечает на типовые вопросы и направляет человека в нужный раздел или к менеджеру.',
      en: 'The bot answers common questions and routes people to the right place or person.',
    },
    leftCopy: [
      {
        ru: 'Человек задаёт вопрос прямо в чате.',
        en: 'A user asks the question right in chat.',
      },
      {
        ru: 'Бот отвечает или предлагает следующий шаг.',
        en: 'The bot answers or offers the next step.',
      },
      {
        ru: 'Команда получает только сложные кейсы.',
        en: 'The team sees only the harder cases.',
      },
    ],
    rightCopy: [
      {
        ru: 'Меньше однотипной нагрузки на поддержку.',
        en: 'Less repetitive support work.',
      },
      {
        ru: 'Люди быстрее находят нужный ответ.',
        en: 'Users find the answer faster.',
      },
      {
        ru: 'Меньше потерянных обращений и ручной навигации.',
        en: 'Less manual routing and fewer lost chats.',
      },
    ],
    chat: {
      header: {
        ru: 'Бот поддержки',
        en: 'Support bot',
      },
      status: {
        ru: 'отвечает на вопросы',
        en: 'handling questions',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Как оплатить подписку и где чек?',
            en: 'How do I pay and where is the receipt?',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'Что нужно открыть прямо сейчас?',
            en: 'What should I open for you right now?',
          },
          choices: [
            {
              label: { ru: 'Раздел оплаты', en: 'Billing section' },
              reply: { ru: 'Раздел оплаты', en: 'Billing section' },
            },
            {
              label: { ru: 'Связь с менеджером', en: 'Contact manager' },
              reply: { ru: 'Связь с менеджером', en: 'Contact manager' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Как удобнее получить помощь?',
            en: 'How would you like to get help?',
          },
          choices: [
            {
              label: { ru: 'Сразу в чате', en: 'Right in chat' },
              reply: { ru: 'Сразу в чате', en: 'Right in chat' },
            },
            {
              label: { ru: 'Через менеджера', en: 'Through a manager' },
              reply: { ru: 'Через менеджера', en: 'Through a manager' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Типовой вопрос закрыт без оператора',
        en: 'Common question solved without an operator',
      },
    },
  },
  {
    id: 'warmup',
    icon: Sparkles,
    accent: {
      glow: 'from-[#10B981]/16 via-[#38BDF8]/12 to-transparent',
      ring: 'border-[#34D399]/20',
      tint: 'bg-[#0A1C1A]',
      soft: 'bg-[#0D2520]',
      text: 'text-[#97F5D8]',
      line: 'from-[#34D399] to-[#38BDF8]',
      botBubble: 'bg-[#102421] border-[#34D399]/24',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#102522] border-[#34D399]/22',
      actionText: 'text-[#97F5D8]',
    },
    label: {
      ru: 'Прогрев',
      en: 'Warm-up',
    },
    title: {
      ru: 'Бот прогревает интерес, сегментирует человека и ведёт к следующему шагу без ручной рутины.',
      en: 'The bot warms interest, segments the user, and moves them to the next step automatically.',
    },
    leftCopy: [
      {
        ru: 'Человек получает материал или лид-магнит.',
        en: 'The user receives the lead magnet or content.',
      },
      {
        ru: 'Бот уточняет интерес и сегментирует аудиторию.',
        en: 'The bot segments interest and intent.',
      },
      {
        ru: 'Дальше отправляет в нужный сценарий или оффер.',
        en: 'Then moves the user into the right flow or offer.',
      },
    ],
    rightCopy: [
      {
        ru: 'Проще тестировать воронки и офферы.',
        en: 'Easier to test funnels and offers.',
      },
      {
        ru: 'Меньше ручной выдачи материалов.',
        en: 'Less manual content delivery.',
      },
      {
        ru: 'Проще повторно касаться аудитории.',
        en: 'Easier to re-engage the audience.',
      },
    ],
    chat: {
      header: {
        ru: 'Бот прогрева',
        en: 'Warm-up bot',
      },
      status: {
        ru: 'ведёт к следующему шагу',
        en: 'moving to next step',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Хочу получить гайд по запуску.',
            en: 'I want the launch guide.',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'Что вам сейчас ближе?',
            en: 'What is more relevant for you right now?',
          },
          choices: [
            {
              label: { ru: 'Заявки', en: 'Leads' },
              reply: { ru: 'Заявки', en: 'Leads' },
            },
            {
              label: { ru: 'Продажи', en: 'Sales' },
              reply: { ru: 'Продажи', en: 'Sales' },
            },
            {
              label: { ru: 'Поддержка', en: 'Support' },
              reply: { ru: 'Поддержка', en: 'Support' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Что показать дальше?',
            en: 'What should I show next?',
          },
          choices: [
            {
              label: { ru: 'Готовый сценарий', en: 'Ready flow' },
              reply: { ru: 'Готовый сценарий', en: 'Ready flow' },
            },
            {
              label: { ru: 'Консультацию', en: 'Consultation' },
              reply: { ru: 'Консультацию', en: 'Consultation' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Пользователь переведён в нужный сценарий',
        en: 'User moved into the right flow',
      },
    },
  },
  {
    id: 'delivery',
    icon: PackageOpen,
    accent: {
      glow: 'from-[#14B8A6]/16 via-[#1E88E5]/10 to-transparent',
      ring: 'border-[#14B8A6]/20',
      tint: 'bg-[#09191B]',
      soft: 'bg-[#0D2024]',
      text: 'text-[#89F3E6]',
      line: 'from-[#14B8A6] to-[#38BDF8]',
      botBubble: 'bg-[#102126] border-[#14B8A6]/24',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#102126] border-[#14B8A6]/22',
      actionText: 'text-[#89F3E6]',
    },
    label: {
      ru: 'Выдача материалов',
      en: 'Delivery',
    },
    title: {
      ru: 'Бот выдаёт материалы, ссылки и доступы сразу после нужного действия пользователя.',
      en: 'The bot delivers materials, links, and access right after the needed action.',
    },
    leftCopy: [
      {
        ru: 'Человек пишет или оставляет заявку.',
        en: 'The user writes or completes the needed step.',
      },
      {
        ru: 'Бот сразу отправляет нужный материал.',
        en: 'The bot instantly delivers the right material.',
      },
      {
        ru: 'Дальше аккуратно ведёт к следующему шагу.',
        en: 'Then gently moves the user forward.',
      },
    ],
    rightCopy: [
      {
        ru: 'Не нужно отправлять всё вручную.',
        en: 'No need to send everything manually.',
      },
      {
        ru: 'Материалы приходят сразу и без ошибок.',
        en: 'Materials arrive instantly and consistently.',
      },
      {
        ru: 'Легче масштабировать выдачу без рутины.',
        en: 'Content delivery scales without routine work.',
      },
    ],
    chat: {
      header: {
        ru: 'Бот выдачи',
        en: 'Delivery bot',
      },
      status: {
        ru: 'отправляет материалы',
        en: 'sending materials',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Хочу получить шаблон и инструкцию.',
            en: 'I want the template and guide.',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'Что отправить первым?',
            en: 'What should I send first?',
          },
          choices: [
            {
              label: { ru: 'PDF и шаблон', en: 'PDF and template' },
              reply: { ru: 'PDF и шаблон', en: 'PDF and template' },
            },
            {
              label: { ru: 'Видео и чек-лист', en: 'Video and checklist' },
              reply: { ru: 'Видео и чек-лист', en: 'Video and checklist' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Что показать дальше?',
            en: 'What should I show next?',
          },
          choices: [
            {
              label: { ru: 'Сценарий запуска', en: 'Launch flow' },
              reply: { ru: 'Сценарий запуска', en: 'Launch flow' },
            },
            {
              label: { ru: 'Консультацию', en: 'Consultation' },
              reply: { ru: 'Консультацию', en: 'Consultation' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Материалы выданы автоматически',
        en: 'Materials delivered automatically',
      },
    },
  },
  {
    id: 'funnels',
    icon: Sparkles,
    accent: {
      glow: 'from-[#F59E0B]/14 via-[#8B5CF6]/10 to-transparent',
      ring: 'border-[#F59E0B]/20',
      tint: 'bg-[#19130B]',
      soft: 'bg-[#261B11]',
      text: 'text-[#FFD89A]',
      line: 'from-[#F59E0B] to-[#8B5CF6]',
      botBubble: 'bg-[#241B13] border-[#F59E0B]/24',
      userBubble: 'bg-[#12182A] border-white/8',
      action: 'bg-[#241B13] border-[#F59E0B]/22',
      actionText: 'text-[#FFD89A]',
    },
    label: {
      ru: 'Мини-воронки',
      en: 'Mini funnels',
    },
    title: {
      ru: 'Бот проводит человека по шагам и приводит к следующему целевому действию без тяжёлого внедрения.',
      en: 'The bot moves people step by step toward the next action without a heavy build.',
    },
    leftCopy: [
      {
        ru: 'Пользователь проходит короткий путь внутри чата.',
        en: 'The user moves through a short in-chat path.',
      },
      {
        ru: 'Каждый шаг подталкивает к следующему действию.',
        en: 'Each step nudges them to the next action.',
      },
      {
        ru: 'Сценарий можно быстро поменять и проверить заново.',
        en: 'The flow can be adjusted and tested quickly.',
      },
    ],
    rightCopy: [
      {
        ru: 'Проще запускать MVP без долгой кастомной сборки.',
        en: 'Easier to launch an MVP without a long custom cycle.',
      },
      {
        ru: 'Проще проверять, работает ли сценарий вообще.',
        en: 'Easier to validate whether the flow works at all.',
      },
      {
        ru: 'Меньше риска слить бюджет на старте.',
        en: 'Lower risk of wasting budget too early.',
      },
    ],
    chat: {
      header: {
        ru: 'Бот воронки',
        en: 'Funnel bot',
      },
      status: {
        ru: 'ведёт к действию',
        en: 'leading to action',
      },
      leadIn: [
        {
          from: 'user',
          text: {
            ru: 'Хочу посмотреть, как это работает.',
            en: 'I want to see how this works.',
          },
        },
      ],
      steps: [
        {
          prompt: {
            ru: 'С чего начнём?',
            en: 'Where should we start?',
          },
          choices: [
            {
              label: { ru: 'Короткий сценарий', en: 'Short flow' },
              reply: { ru: 'Короткий сценарий', en: 'Short flow' },
            },
            {
              label: { ru: 'Сразу к заявке', en: 'Go to lead' },
              reply: { ru: 'Сразу к заявке', en: 'Go to lead' },
            },
          ],
        },
        {
          prompt: {
            ru: 'Что сделать следующим шагом?',
            en: 'What should happen next?',
          },
          choices: [
            {
              label: { ru: 'Показать оффер', en: 'Show offer' },
              reply: { ru: 'Показать оффер', en: 'Show offer' },
            },
            {
              label: { ru: 'Открыть форму', en: 'Open form' },
              reply: { ru: 'Открыть форму', en: 'Open form' },
            },
          ],
        },
      ],
      outcome: {
        ru: 'Сценарий проверен без тяжёлой разработки',
        en: 'Flow validated without heavy development',
      },
    },
  },
];

const sectionCopy = {
  ru: {
    badge: 'Решения под задачи',
    title: 'Как это работает в чате',
    subtitle:
      'Выбираете задачу, проходите сценарий в чате и сразу видите итог для бизнеса.',
    ctaTitle: 'Запустите свой первый рабочий сценарий без долгой сборки.',
    ctaButton: 'Создать бота',
    ctaNote: 'Подойдёт для заявок, записи, FAQ и мини-воронок.',
    leftEyebrow: 'Что делает бот',
    rightEyebrow: 'Что получает бизнес',
    phoneBadge: 'Telegram-сценарий',
    outcomeLabel: 'Итог',
    reset: 'Пройти заново',
    phoneFooter: 'Нажмите на вариант и пройдите сценарий',
    rightTitle: 'Что получает команда после запуска',
  },
  en: {
    badge: 'Solutions by use case',
    title: 'How it works in chat',
    subtitle:
      'Pick a use case, walk through the chat flow, and see the business outcome right away.',
    ctaTitle: 'Launch your first working flow without a long build cycle.',
    ctaButton: 'Create a bot',
    ctaNote: 'Built for leads, booking, FAQ, and mini funnels.',
    leftEyebrow: 'What the bot does',
    rightEyebrow: 'What the business gets',
    phoneBadge: 'Telegram flow',
    outcomeLabel: 'Outcome',
    reset: 'Start again',
    phoneFooter: 'Tap an option and walk through the flow',
    rightTitle: 'What the team gets after launch',
  },
} as const;

export function Solutions() {
  const locale = useLocale();
  const isRu = locale === 'ru';
  const copy = isRu ? sectionCopy.ru : sectionCopy.en;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const enterViewport = {
    once: true,
    amount: 0.12,
    margin: '280px 0px',
  } as const;

  const activeScenario = scenarios.find((item) => item.id === activeId) ?? scenarios[0];
  const ActiveIcon = activeScenario.icon;
  const activeLabel = isRu ? activeScenario.label.ru : activeScenario.label.en;
  const activeTitle = isRu ? activeScenario.title.ru : activeScenario.title.en;
  const leftCopy = activeScenario.leftCopy.map((item) => (isRu ? item.ru : item.en));
  const rightCopy = activeScenario.rightCopy.map((item) => (isRu ? item.ru : item.en));

  return (
    <section className="relative overflow-hidden px-4 py-12 md:py-14 cyber-grid">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.42 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-white/82">
            <BadgeCheck className="h-4 w-4 text-[#38BDF8]" />
            <span>{copy.badge}</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold md:text-[2.55rem] md:leading-[1.06]">
            {copy.title}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-white/74 md:text-[17px]">
            {copy.subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.38 }}
          className="relative mt-8 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,22,0.96),rgba(7,10,17,0.98))] p-4 md:p-6"
        >
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${activeScenario.accent.glow}`}
          />

          <div className="relative">
            <div className="flex flex-wrap justify-center gap-2">
              {scenarios.map((item) => {
                const label = isRu ? item.label.ru : item.label.en;
                const isActive = item.id === activeId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors md:px-4 md:text-sm ${
                      isActive
                        ? `${item.accent.ring} ${item.accent.tint} ${item.accent.text}`
                        : 'border-white/10 bg-white/[0.03] text-white/78 hover:bg-white/[0.05]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.82fr_minmax(290px,0.72fr)_0.82fr] lg:items-center">
              <ScenarioCopyPanel
                className="order-2 lg:order-1"
                accent={activeScenario.accent}
                eyebrow={copy.leftEyebrow}
                title={activeTitle}
                lines={leftCopy}
                icon={<ActiveIcon className="h-5 w-5" />}
                scenarioKey={activeScenario.id}
                shouldReduceMotion={shouldReduceMotion}
              />

              <div className="order-1 lg:order-2">
                <SolutionPhonePreview
                  key={activeScenario.id}
                  accent={activeScenario.accent}
                  badge={copy.phoneBadge}
                  label={activeLabel}
                  header={isRu ? activeScenario.chat.header.ru : activeScenario.chat.header.en}
                  status={isRu ? activeScenario.chat.status.ru : activeScenario.chat.status.en}
                  leadIn={activeScenario.chat.leadIn}
                  steps={activeScenario.chat.steps}
                  outcomeLabel={copy.outcomeLabel}
                  outcome={isRu ? activeScenario.chat.outcome.ru : activeScenario.chat.outcome.en}
                  resetLabel={copy.reset}
                  footerText={copy.phoneFooter}
                  isRu={isRu}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </div>

              <ScenarioCopyPanel
                className="order-3"
                accent={activeScenario.accent}
                eyebrow={copy.rightEyebrow}
                title={copy.rightTitle}
                lines={rightCopy}
                icon={<OutcomeDot accent={activeScenario.accent} />}
                scenarioKey={`${activeScenario.id}-outcome`}
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={enterViewport}
          transition={{ duration: 0.34, delay: 0.06 }}
          className="mt-5"
        >
          <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="max-w-2xl">
              <p className="text-lg font-semibold leading-7 text-white md:text-[1.18rem]">
                {copy.ctaTitle}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-white/60">
                {copy.ctaNote}
              </p>
            </div>

            <Link
              href={`/${locale}/auth/signup`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#1E88E5,#00E676)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(30,136,229,0.2)] transition-transform hover:translate-y-[-1px]"
            >
              <span>{copy.ctaButton}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ScenarioCopyPanel({
  className,
  accent,
  eyebrow,
  title,
  lines,
  icon,
  scenarioKey,
  shouldReduceMotion,
}: {
  className?: string;
  accent: Scenario['accent'];
  eyebrow: string;
  title: string;
  lines: string[];
  icon: ReactNode;
  scenarioKey: string;
  shouldReduceMotion: boolean;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/62">
        {eyebrow}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scenarioKey}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.24 }}
          className="mt-3"
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/8 ${accent.soft} ${accent.text}`}
            >
              {icon}
            </div>
            <h3 className="text-[1.16rem] font-semibold leading-[1.18] text-white md:text-[1.34rem]">
              {title}
            </h3>
          </div>

          <div className="mt-4 divide-y divide-white/8 overflow-hidden rounded-[22px] border border-white/8 bg-white/[0.03]">
            {lines.map((line, index) => (
              <div key={line} className="flex items-start gap-3 px-4 py-3 md:px-4.5">
                <div
                  className={`mt-[0.45rem] h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r ${accent.line}`}
                />
                <p className="text-sm leading-6 text-white/78 md:text-[14px]">{line}</p>
                <span className="ml-auto shrink-0 pl-3 text-[11px] font-medium text-white/24">
                  0{index + 1}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SolutionPhonePreview({
  accent,
  badge,
  label,
  header,
  status,
  leadIn,
  steps,
  outcomeLabel,
  outcome,
  resetLabel,
  footerText,
  isRu,
  shouldReduceMotion,
}: {
  accent: Scenario['accent'];
  badge: string;
  label: string;
  header: string;
  status: string;
  leadIn: ScenarioMessage[];
  steps: ScenarioStep[];
  outcomeLabel: string;
  outcome: string;
  resetLabel: string;
  footerText: string;
  isRu: boolean;
  shouldReduceMotion: boolean;
}) {
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const currentStepIndex = selectedChoices.length;
  const isCompleted = currentStepIndex >= steps.length;
  const currentStep = isCompleted ? null : steps[currentStepIndex];

  const conversation = useMemo(() => {
    const base = leadIn.map((message) => ({
      from: message.from,
      text: isRu ? message.text.ru : message.text.en,
    }));

    const completed = steps.flatMap((step, index) => {
      if (selectedChoices[index] === undefined) {
        return [];
      }

      const selectedChoice = step.choices[selectedChoices[index]];

      return [
        {
          from: 'bot' as const,
          text: isRu ? step.prompt.ru : step.prompt.en,
        },
        {
          from: 'user' as const,
          text: isRu ? selectedChoice.reply.ru : selectedChoice.reply.en,
        },
      ];
    });

    if (isCompleted) {
      return [
        ...base,
        ...completed,
        {
          from: 'bot' as const,
          text: outcome,
        },
      ];
    }

    return [
      ...base,
      ...completed,
      {
        from: 'bot' as const,
        text: isRu ? currentStep!.prompt.ru : currentStep!.prompt.en,
      },
    ];
  }, [currentStep, isCompleted, isRu, leadIn, outcome, selectedChoices, steps]);

  const currentChoices = currentStep
    ? currentStep.choices.map((choice) => (isRu ? choice.label.ru : choice.label.en))
    : [];

  const handleChoice = (choiceIndex: number) => {
    if (isCompleted) {
      return;
    }

    setSelectedChoices((current) => [...current, choiceIndex]);
  };

  useEffect(() => {
    const node = messagesRef.current;

    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  }, [conversation, currentChoices.length, shouldReduceMotion]);

  return (
    <div className="mx-auto w-full max-w-[316px] md:max-w-[324px]">
      <div className="relative aspect-[390/844] w-full">
        <div className="pointer-events-none absolute left-[-3px] top-[146px] h-16 w-[3px] rounded-r-full bg-white/14" />
        <div className="pointer-events-none absolute left-[-3px] top-[224px] h-24 w-[3px] rounded-r-full bg-white/14" />
        <div className="pointer-events-none absolute right-[-3px] top-[198px] h-28 w-[3px] rounded-l-full bg-white/16" />

        <div className="absolute inset-0 rounded-[52px] bg-[linear-gradient(180deg,#191C24_0%,#08090D_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.16)]" />
        <div className="absolute inset-[1.5px] rounded-[51px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,11,16,0.98),rgba(5,6,10,1))]" />
        <div className="absolute inset-[9px] overflow-hidden rounded-[42px] border border-white/10 bg-[#080B12] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${accent.glow}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:22px_22px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(36,161,222,0.08),transparent_28%),radial-gradient(circle_at_bottom,rgba(124,77,255,0.08),transparent_26%)]" />

          <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex h-7 w-[118px] -translate-x-1/2 items-center justify-center rounded-full bg-black/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="h-[5px] w-14 rounded-full bg-white/10" />
            <div className="ml-3 h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>

          <div className="relative flex h-full min-h-0 flex-col">
            <div className="relative border-b border-white/6 px-3.5 pb-2.5 pt-12">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/68">
                <span>{badge}</span>
                <span className={accent.text}>• {label}</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.soft} ${accent.text}`}
                >
                  <div className={`h-4.5 w-4.5 rounded-full bg-gradient-to-r ${accent.line}`} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-white">{header}</div>
                  <div className="text-xs text-white/54">{status}</div>
                </div>
              </div>
            </div>

            <div
              ref={messagesRef}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${header}-${selectedChoices.join('-') || 'start'}`}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
                  transition={{ duration: shouldReduceMotion ? 0.01 : 0.22 }}
                  className="space-y-2.5 pb-3"
                >
                  {conversation.map((message, index) => {
                    const isBot = message.from === 'bot';

                    return (
                      <div
                        key={`${message.text}-${index}`}
                        className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[84%] rounded-[20px] border px-3.5 py-2.5 text-[12px] leading-5 text-white/84 shadow-[0_10px_28px_rgba(0,0,0,0.18)] ${
                            isBot ? accent.botBubble : accent.userBubble
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative border-t border-white/6 px-3.5 pb-3.5 pt-3 backdrop-blur-sm">
              {!isCompleted ? (
                <div className="flex flex-wrap gap-2">
                  {currentChoices.map((choice, index) => (
                    <button
                      key={`${choice}-${index}`}
                      type="button"
                      onClick={() => handleChoice(index)}
                      className={`rounded-full border px-3 py-2 text-[11px] font-medium transition-colors ${accent.action} ${accent.actionText} hover:bg-white/[0.06]`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedChoices([])}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-medium text-white/72 transition-colors hover:bg-white/[0.06]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{resetLabel}</span>
                </button>
              )}

              <div className="mt-3 rounded-[18px] border border-white/8 bg-black/20 px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/52">
                    {outcomeLabel}
                  </div>
                  <div className="text-[10px] text-white/40">{footerText}</div>
                </div>
                <div className="mt-2 text-[13px] font-medium leading-5 text-white/82">{outcome}</div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-full bg-white/16" />
        </div>
      </div>
    </div>
  );
}

function OutcomeDot({ accent }: { accent: Scenario['accent'] }) {
  return (
    <div
      className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r shadow-[0_0_24px_rgba(56,189,248,0.16)] ${accent.line}`}
    />
  );
}
