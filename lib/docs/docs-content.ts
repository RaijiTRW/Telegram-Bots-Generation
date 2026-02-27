export type DocsLocale = 'ru' | 'en'

export type DocsQuickStartStep = {
  id: string
  title: string
  goal: string
  actions: string[]
  systemBehavior: string[]
  check: string[]
  videoSlotTitle: string
}

export type DocsAreaCard = {
  id: string
  title: string
  subtitle: string
  whenToUse: string
  actions: string[]
  result: string
}

export type DocsUiComponentCard = {
  id: string
  title: string
  location: string
  purpose: string
  howToUse: string[]
  commonMistakes?: string[]
}

export type DocsNodeItem = {
  id: string
  name: string
  kind: 'node' | 'preset'
  purpose: string
  whenToUse: string
  setup: string[]
  output: string
  notes?: string[]
}

export type DocsNodeGroup = {
  id: string
  title: string
  description: string
  items: DocsNodeItem[]
}

export type DocsCompareRow = {
  topic: string
  replyKeyboard: string
  inlineKeyboard: string
}

export type DocsStorageRow = {
  id: string
  item: string
  where: string
  persistence: string
  visibility: string
  notes: string
}

export type DocsSupportStep = {
  id: string
  title: string
  actions: string[]
  outcome: string
  videoSlotTitle: string
}

export type DocsFaqItem = {
  id: string
  question: string
  answer: string[]
}

export type DocsVideoSlot = {
  id: string
  title: string
  description: string
}

export type DocsContent = {
  locale: DocsLocale
  hero: {
    badge: string
    title: string
    subtitle: string
    description: string
    notes: string[]
    actions: {
      quickStart: string
      openDashboard: string
      createBot: string
    }
  }
  tocTitle: string
  tocHint: string
  sections: Array<{ id: string; title: string; description: string }>
  learningFlow: {
    title: string
    description: string
    steps: string[]
    videoNoteTitle: string
    videoNoteDescription: string
  }
  quickStart: {
    title: string
    description: string
    steps: DocsQuickStartStep[]
  }
  serviceFlow: {
    title: string
    description: string
    stages: Array<{ title: string; description: string; output: string }>
  }
  editorAreas: {
    title: string
    description: string
    cards: DocsAreaCard[]
  }
  uiComponents: {
    title: string
    description: string
    cards: DocsUiComponentCard[]
  }
  nodes: {
    title: string
    description: string
    groups: DocsNodeGroup[]
  }
  keyboardsAndTriggers: {
    title: string
    description: string
    note: string
    rows: DocsCompareRow[]
  }
  dataAndSecurity: {
    title: string
    description: string
    rows: DocsStorageRow[]
  }
  testAndDeploy: {
    title: string
    description: string
    steps: DocsSupportStep[]
  }
  troubleshooting: {
    title: string
    description: string
    items: DocsFaqItem[]
  }
  videoPlan: {
    title: string
    description: string
    slots: DocsVideoSlot[]
  }
}

const ruContent: DocsContent = {
  locale: 'ru',
  hero: {
    badge: 'Документация сервиса',
    title: 'Руководство по работе с CBTooll',
    subtitle: 'Быстрый старт, логика редактора, ноды, системные настройки и поддержка пользователей',
    description:
      'Эта документация построена как рабочий сценарий: что нажимать, что происходит внутри системы, что вы увидите в интерфейсе и как проверить результат. Видеоинструкции будут появляться постепенно и дополнять текст, не заменяя его.',
    notes: [
      'Имена нод в редакторе оставлены на английском (как в продукте), чтобы не было расхождения между документацией и интерфейсом.',
      'Для большинства действий сначала используйте режим Test, а уже потом переходите к Deploy.',
      'Если действие влияет на данные бота, в разделе указано где это сохраняется: Supabase, localStorage или runtime (временная память процесса).',
    ],
    actions: {
      quickStart: 'Перейти к быстрому старту',
      openDashboard: 'Открыть дашборд',
      createBot: 'Открыть список ботов',
    },
  },
  tocTitle: 'Разделы документации',
  tocHint: 'Начинай сверху. Для повторного просмотра используй разделы и поиск. Видеоинструкции скоро появятся в этих же блоках.',
  sections: [
    { id: 'learning-flow', title: 'Как читать документацию', description: 'Порядок изучения и формат разделов' },
    { id: 'quick-start', title: 'Быстрый старт', description: 'Создать бота, собрать workflow, протестировать' },
    { id: 'service-flow', title: 'Как работает сервис', description: 'Путь от идеи до работающего бота' },
    { id: 'editor-areas', title: 'Разделы редактора', description: 'Canvas, AI, System, Settings' },
    { id: 'ui-components', title: 'Компоненты интерфейса', description: 'Ключевые панели и как с ними работать' },
    { id: 'nodes-reference', title: 'Ноды и пресеты', description: 'Что делает каждая нода и как настраивать' },
    { id: 'keyboards-triggers', title: 'Клавиатуры и триггеры', description: 'Reply vs Inline, Text Trigger vs Callback' },
    { id: 'data-security', title: 'Данные и безопасность', description: 'Что и где хранится' },
    { id: 'test-deploy', title: 'Тест, логи, деплой', description: 'Рабочий процесс запуска и проверки' },
    { id: 'troubleshooting', title: 'Частые проблемы', description: 'Что проверить, если что-то не работает' },
    { id: 'video-plan', title: 'Видеоинструкции (скоро)', description: 'Раздел с будущими видеоинструкциями по шагам документации' },
  ],
  learningFlow: {
    title: 'Как читать эту документацию',
    description:
      'Каждый раздел построен по одному шаблону: действие -> что происходит внутри -> что проверить -> что чаще всего ломается. Это сделано специально, чтобы документация не была “описательной”, а работала как инструкция.',
    steps: [
      'Сначала пройдите раздел “Быстрый старт” без попытки изучить все ноды. Цель — увидеть полный цикл работы сервиса.',
      'После первого рабочего теста перейдите к разделу “Разделы редактора” и “Компоненты интерфейса”, чтобы понимать, где находится нужная функция.',
      'Далее используйте “Ноды и пресеты” как справочник: открывайте только нужную группу нод под текущую задачу.',
      'Раздел “Клавиатуры и триггеры” обязателен перед настройкой кнопок, чтобы не путать Reply Keyboard и Inline Keyboard.',
      'При проблемах сразу идите в “Частые проблемы” и “Тест, логи, деплой” — там описан порядок диагностики.',
    ],
    videoNoteTitle: 'Видеоинструкции (скоро)',
    videoNoteDescription:
      'В этих блоках скоро появятся видеоинструкции. Пока используйте текст как основной источник точных шагов и проверок.',
  },
  quickStart: {
    title: 'Быстрый старт: первый бот от идеи до теста',
    description:
      'Ниже минимальный сценарий, который даёт рабочий результат: бот отвечает на команду и на текст, использует переменную и показывает логи.',
    steps: [
      {
        id: 'qs-1',
        title: 'Создайте бота в разделе Bots',
        goal: 'Получить карточку бота и перейти в редактор.',
        actions: [
          'Откройте `Dashboard -> Bots`.',
          'Нажмите `Новый бот` / `Create first bot`.',
          'Введите имя и короткое описание (можно черновик).',
          'После создания перейдите в редактор (`/editor/canvas`).',
        ],
        systemBehavior: [
          'Создаётся запись бота в Supabase (таблица `bots`).',
          'Создаётся/инициализируется конфиг workflow (таблица `bot_configs`).',
          'Редактор открывается с пустым canvas и базовыми настройками.',
        ],
        check: [
          'Вы видите экран редактора с холстом, левой навигацией и панелью нод.',
          'Верхний хедер показывает название бота и кнопки `Сохранить` / `Тест`.',
        ],
        videoSlotTitle: 'Видео: создание первого бота и вход в редактор',
      },
      {
        id: 'qs-2',
        title: 'Соберите минимальный workflow на Canvas',
        goal: 'Сделать простой сценарий: триггер -> сообщение.',
        actions: [
          'Добавьте `Command Trigger` и `Message`.',
          'Соедините их линией.',
          'В настройках `Command Trigger` укажите команду, например `/start`.',
          'В `Message` задайте текст ответа.',
        ],
        systemBehavior: [
          'Ноды и связи пока живут в состоянии редактора (в браузере) до сохранения.',
          'При изменении ноды обновляется runtime-конфигурация ноды на холсте.',
        ],
        check: [
          'На холсте отображается соединение между trigger и message.',
          'При выборе ноды справа (или в модальном режиме) видны её настройки.',
        ],
        videoSlotTitle: 'Видео: сборка первого сценария на холсте',
      },
      {
        id: 'qs-3',
        title: 'Добавьте переменную и используйте её в сообщении',
        goal: 'Понять разницу между пользовательскими переменными и runtime-данными.',
        actions: [
          'Откройте раздел `Система`.',
          'Добавьте пользовательскую переменную (например `welcomeText`).',
          'Вернитесь в `Message` и вставьте шаблон `{{welcomeText}}` (через подсказки `{{`).',
          'Либо используйте `Action -> setVariable`, если хотите значение только в runtime теста.',
        ],
        systemBehavior: [
          'Пользовательские переменные сохраняются в конфиге (`bot_configs.variables`).',
          'Runtime-переменные (`setVariable`) живут в тестовой сессии и не обязаны появляться в таблице переменных System.',
        ],
        check: [
          'В `System -> Переменные` видна созданная пользовательская переменная.',
          'В поле текста `Message` подсказка переменных появляется при вводе `{{`.',
        ],
        videoSlotTitle: 'Видео: переменные (System) и вставка в Message',
      },
      {
        id: 'qs-4',
        title: 'Сохраните конфиг бота',
        goal: 'Зафиксировать текущий canvas и настройки в БД.',
        actions: [
          'Нажмите `Сохранить` в верхнем хедере редактора.',
          'Дождитесь завершения сохранения.',
          'Если есть ошибки, проверьте настройки бота (токен/секреты) отдельно в `Настройки`.',
        ],
        systemBehavior: [
          'Canvas (`nodes`, `edges`) и системные настройки конфигурации сохраняются в Supabase.',
          'Секреты Telegram (если меняли) сохраняются отдельно и шифруются на сервере.',
          'UI снимает флаг несохранённых изменений.',
        ],
        check: [
          'Индикатор “Несохранённые изменения” исчезает.',
          'После перезагрузки страницы ноды остаются на месте.',
        ],
        videoSlotTitle: 'Видео: сохранение canvas и настроек',
      },
      {
        id: 'qs-5',
        title: 'Запустите Test и проверьте логи',
        goal: 'Проверить workflow без полноценного прод-деплоя.',
        actions: [
          'Нажмите `Тест` на холсте.',
          'Откройте панель логов внизу (`Логи бота`).',
          'Отправьте боту сообщение или команду в Telegram.',
          'Проверьте, сработал ли нужный триггер и отправилось ли сообщение.',
        ],
        systemBehavior: [
          'Перед тестом текущий canvas сохраняется.',
          'Runtime запускает тестовый режим (polling/webhook в зависимости от конфигурации).',
          'Логи пишутся в память и в Supabase (`bot_test_logs`) при доступности БД.',
        ],
        check: [
          'В логах видно запуск теста, входящее событие и выбранный путь по нодам.',
          'В Telegram приходит ответное сообщение от бота.',
        ],
        videoSlotTitle: 'Видео: запуск теста и чтение логов',
      },
      {
        id: 'qs-6',
        title: 'Остановите Test и зафиксируйте рабочую версию',
        goal: 'Завершить сессию теста без зависшего runtime.',
        actions: [
          'Нажмите `Стоп` / `Stop` (та же кнопка теста, когда тест активен).',
          'Убедитесь, что статус теста и логи перестали обновляться.',
          'Сохраните финальные изменения, если что-то правили во время теста.',
        ],
        systemBehavior: [
          'Останавливается тестовый runtime/polling для данного бота.',
          'Флаг активного теста сбрасывается в метаданных бота.',
          'Нижняя панель логов остаётся доступной для просмотра истории запуска.',
        ],
        check: [
          'Кнопка возвращается в состояние `Тест`.',
          'Новые логи не появляются без новых действий.',
        ],
        videoSlotTitle: 'Видео: корректная остановка теста',
      },
    ],
  },
  serviceFlow: {
    title: 'Как работает сервис (путь данных и логики)',
    description:
      'Ниже упрощённая схема движения данных в продукте. Это важно, чтобы понимать, что сохраняется сразу, что хранится временно и почему некоторые значения видны только во время теста.',
    stages: [
      {
        title: '1. Идея / описание задачи',
        description: 'Вы формулируете сценарий вручную на Canvas или через AI-помощник (AI-узлы/AI-чат).',
        output: 'Набор нод, связей и системных настроек бота.',
      },
      {
        title: '2. Редактор (Canvas + System + Settings)',
        description: 'Изменения сначала живут в состоянии интерфейса и считаются черновиком до сохранения.',
        output: 'Черновой workflow в браузере + статус “несохранённые изменения”.',
      },
      {
        title: '3. Сохранение',
        description: 'Canvas, переменные и конфигурация сохраняются в Supabase. Секреты Telegram сохраняются отдельно и шифруются.',
        output: 'Актуальная версия конфигурации бота в БД.',
      },
      {
        title: '4. Test runtime',
        description: 'Временный рантайм исполняет workflow по входящим событиям Telegram и пишет логи.',
        output: 'Ответы бота, runtime-переменные (в сессии), тестовые логи.',
      },
      {
        title: '5. Анализ и поддержка',
        description: 'Вы проверяете логи, поведение нод и данные. При необходимости правите workflow и повторяете тест.',
        output: 'Рабочая версия сценария + понятная история действий/логов для поддержки.',
      },
    ],
  },
  editorAreas: {
    title: 'Разделы редактора (где что делать)',
    description:
      'Редактор разбит на 4 раздела. Это важно для UX: каждый раздел решает свой тип задач, и документация ниже строится по этим зонам.',
    cards: [
      {
        id: 'canvas',
        title: 'Canvas (Холст)',
        subtitle: 'Визуальная сборка workflow',
        whenToUse: 'Когда вы проектируете логику диалога, ветвления, действия и последовательность шагов.',
        actions: [
          'Добавление нод из палитры (по категориям).',
          'Соединение нод связями.',
          'Выбор ноды и открытие настроек.',
          'Copy / Cut / Paste нод (`Cmd/Ctrl + C/X/V`).',
          'Запуск теста и просмотр логов.',
        ],
        result: 'Рабочая схема поведения бота (workflow).',
      },
      {
        id: 'ai-chat',
        title: 'AI Assistant',
        subtitle: 'Помощник для сборки и подсказок',
        whenToUse: 'Когда нужно быстро набросать сценарий, получить идею или объяснение логики.',
        actions: [
          'Формулируете задачу простым текстом.',
          'Получаете предложения по структуре или нодам.',
          'Используете ответ как основу, затем проверяете руками в Canvas.',
        ],
        result: 'Ускорение проектирования, но итоговую логику всё равно проверяете вы.',
      },
      {
        id: 'system',
        title: 'System (Система)',
        subtitle: 'Логика окружения бота',
        whenToUse: 'Когда настраиваете переменные, триггеры, базовые Telegram-функции, reply keyboard, авто-реакции.',
        actions: [
          'Создание пользовательских переменных.',
          'Просмотр базовых Telegram переменных (`user.*`).',
          'Настройка reply keyboard (под input).',
          'Настройка авто-реакций и доп. функций.',
        ],
        result: 'Системная конфигурация, на которую опирается workflow.',
      },
      {
        id: 'settings',
        title: 'Settings (Настройки)',
        subtitle: 'Конфигурация бота и Telegram',
        whenToUse: 'Когда подключаете токен, webhook/polling параметры, поведение запуска и общие параметры бота.',
        actions: [
          'Ввод/обновление Telegram token.',
          'Настройка webhook/polling режима.',
          'Проверка статуса и параметров деплоя.',
        ],
        result: 'Бот готов к тесту и запуску с корректными внешними настройками.',
      },
    ],
  },
  uiComponents: {
    title: 'Компоненты интерфейса редактора и как с ними работать',
    description:
      'Это не ноды, а элементы самого интерфейса. Здесь описано, где они находятся и как правильно ими пользоваться в ежедневной работе.',
    cards: [
      {
        id: 'sections-panel',
        title: 'Панель разделов (слева)',
        location: 'Левая колонка редактора: Canvas / AI Assistant / System / Settings.',
        purpose: 'Переключение между режимами работы редактора.',
        howToUse: [
          'Кликайте по иконкам/разделам для смены режима.',
          'Тяните вертикальный разделитель, чтобы менять ширину панели.',
          'Двойной клик по разделителю сбрасывает ширину к дефолтной.',
          'Ширина панели сохраняется в `localStorage` и восстанавливается при следующем входе.',
        ],
        commonMistakes: [
          'Пытаются искать ноды в `System` — ноды добавляются только на `Canvas`.',
          'Сужают панель слишком сильно и думают, что разделы пропали — они просто в compact/hidden режиме.',
        ],
      },
      {
        id: 'nodes-palette',
        title: 'Палитра нод (на Canvas)',
        location: 'Верхний левый угол холста.',
        purpose: 'Добавление нод и пресетов в workflow.',
        howToUse: [
          'Наведение на иконку категории показывает список нод справа.',
          'Клик по категории закрепляет её (pin).',
          'Клик по ноде добавляет её на холст; drag-and-drop тоже работает.',
          'Следите за счётчиками нод и связей внизу палитры.',
        ],
        commonMistakes: [
          'Путают пресет (`Text Trigger`) с отдельным новым типом ноды — это preset существующей `trigger` ноды.',
        ],
      },
      {
        id: 'node-settings',
        title: 'Панель настроек ноды',
        location: 'Справа при выборе ноды на Canvas.',
        purpose: 'Редактирование параметров выбранной ноды.',
        howToUse: [
          'Выберите ноду на холсте — справа откроются её параметры.',
          'Для сложных нод используйте детальный режим (иконка раскрытия): настройки откроются по центру экрана.',
          'В детальном режиме фон блокируется, чтобы вы не сбились с контекста редактирования.',
          'Проверяйте поля с переменными через подсказки `{{` и список переменных.',
        ],
        commonMistakes: [
          'Редактируют не ту ноду — сначала проверьте ID/название в шапке панели.',
          'Ищут runtime-значения в настройках ноды — здесь хранится конфигурация, а не текущее состояние выполнения.',
        ],
      },
      {
        id: 'logs-panel',
        title: 'Панель логов бота',
        location: 'Нижняя панель на Canvas.',
        purpose: 'Диагностика поведения workflow во время теста.',
        howToUse: [
          'Открывайте панель после запуска Test.',
          'Смотрите последовательность событий: входящее сообщение -> выбранный триггер -> ноды -> ошибки/ответы.',
          'Копируйте логи в `Text` или `JSON`, если нужно разобрать поведение или отправить в поддержку.',
        ],
        commonMistakes: [
          'Ожидают новые логи без активного теста.',
          'Путают UI-ошибку с runtime-ошибкой — в логах обычно видно источник (`runtime`, `webhook`, `action`).',
        ],
      },
      {
        id: 'system-panels',
        title: 'System-панели (Variables / Triggers / Reply Keyboard)',
        location: 'Раздел `System`.',
        purpose: 'Управление переменными и системным поведением бота вне конкретной ноды.',
        howToUse: [
          'Создавайте пользовательские переменные для повторного использования в workflow.',
          'Используйте `Reply Keyboard` для постоянной клавиатуры под input (глобальной для шагов).',
          'Используйте rules в `Reply Keyboard`, если хотите разные кнопки по условию/переменной.',
          'Используйте `Text Trigger` для обработки нажатий reply-кнопок (они отправляют обычный текст).',
        ],
        commonMistakes: [
          'Пытаются ловить reply keyboard через `Callback Trigger` — это работает только для inline кнопок.',
        ],
      },
      {
        id: 'bot-settings-form',
        title: 'Bot Settings (Telegram token, режимы)',
        location: 'Раздел `Settings`.',
        purpose: 'Подключение бота к Telegram и управление режимами запуска.',
        howToUse: [
          'Заполняйте токен и нужные параметры запуска.',
          'Пустое поле токена при сохранении не должно автоматически очищать уже сохранённый токен (это безопасное поведение).',
          'После изменения параметров всегда делайте `Save`, затем `Test`.',
        ],
        commonMistakes: [
          'Меняют настройки и сразу нажимают `Test`, не сохранив изменения.',
          'Ожидают, что секреты будут видны в открытом виде в UI/БД — они хранятся отдельно и защищены.',
        ],
      },
    ],
  },
  nodes: {
    title: 'Ноды и пресеты: что есть сейчас и как с ними работать',
    description:
      'Ниже справочник по основным нодам и пресетам, которые доступны в Canvas. Для каждой ноды указано: что делает, когда использовать и минимальный порядок настройки.',
    groups: [
      {
        id: 'triggers',
        title: 'Триггеры (точки входа)',
        description: 'Запускают workflow по событию. Один workflow может иметь несколько разных триггеров.',
        items: [
          {
            id: 'trigger-command',
            name: 'Command Trigger',
            kind: 'preset',
            purpose: 'Запускает workflow по команде Telegram (`/start`, `/help`).',
            whenToUse: 'Когда нужен явный вход в сценарий по команде.',
            setup: [
              'Выберите тип trigger: command (обычно preset уже выставляет).',
              'Укажите одну или несколько команд.',
              'Подключите следующую ноду (`Message`, `Router`, `Action`).',
            ],
            output: 'Сценарий стартует при совпадении команды.',
          },
          {
            id: 'trigger-text',
            name: 'Text Trigger',
            kind: 'preset',
            purpose: 'Запускает workflow по тексту сообщения (совпадение/паттерн).',
            whenToUse: 'Для обработки текстовых reply-кнопок, ключевых слов, фраз.',
            setup: [
              'Выберите текстовый паттерн или оставьте broad pattern по вашей логике.',
              'При необходимости используйте `Router`/`Condition` дальше для уточнения ветки.',
              'Свяжите с `Message` или другой логикой.',
            ],
            output: 'Workflow запускается по входящему text message.',
            notes: ['Именно этот триггер используйте для Reply Keyboard (под input).'],
          },
          {
            id: 'trigger-callback',
            name: 'Callback Trigger',
            kind: 'preset',
            purpose: 'Ловит нажатия inline-кнопок по `callback_data`.',
            whenToUse: 'Только для кнопок в `Message` node (inline keyboard), не для глобальной клавиатуры.',
            setup: [
              'В `Message` создайте inline-кнопки с callback.',
              'В `Callback Trigger` задайте pattern или callback identifier.',
              'Подключите нужную ветку обработки.',
            ],
            output: 'Workflow запускается по `callback_query` Telegram.',
            notes: ['Если кнопка под input (Reply Keyboard), callback не придёт.'],
          },
          {
            id: 'trigger-schedule',
            name: 'Schedule Trigger',
            kind: 'preset',
            purpose: 'Запускает workflow по времени (ежедневно или каждые N часов).',
            whenToUse: 'Для напоминаний, рассылок, периодических проверок.',
            setup: [
              'Выберите режим: daily или hourly.',
              'Укажите timezone и target chat ID.',
              'Подключите ноды отправки/логики.',
            ],
            output: 'Workflow стартует по расписанию без входящего сообщения.',
            notes: ['Для сообщений нужен корректный `Target Chat ID`.'],
          },
          {
            id: 'trigger-ai',
            name: 'AI Trigger',
            kind: 'preset',
            purpose: 'Подготовленный вход для будущего AI intent / semantic matching.',
            whenToUse: 'Когда хотите заложить структуру под будущий AI routing.',
            setup: [
              'Добавьте `AI Trigger` как точку входа.',
              'На текущем этапе задайте fallback-поведение (дальнейшая логика вручную).',
              'Проверьте тестом, как обрабатывается входящий текст.',
            ],
            output: 'Сейчас работает через fallback/подготовленный режим, AI логика отмечена как `soon`.',
          },
        ],
      },
      {
        id: 'messaging',
        title: 'Сообщения и ввод',
        description: 'Ноды, которые отправляют ответы пользователю или запрашивают ввод.',
        items: [
          {
            id: 'message',
            name: 'Message',
            kind: 'node',
            purpose: 'Отправляет текст и (по настройкам) медиа/кнопки.',
            whenToUse: 'Почти в каждом сценарии, где бот отвечает пользователю.',
            setup: [
              'Введите текст сообщения.',
              'При необходимости используйте переменные `{{...}}`.',
              'Настройте форматирование/клавиатуру/медиа.',
            ],
            output: 'Пользователь получает сообщение, а workflow идёт дальше по связи.',
            notes: [
              'Inline-кнопки из `Message` работают с `Callback Trigger`.',
              'Reply Keyboard под input лучше настраивать в `System` или через ноду `Reply Keyboard`.',
            ],
          },
          {
            id: 'message-ai',
            name: 'AI Message',
            kind: 'preset',
            purpose: 'Подготовленная нода для AI-генерации сообщения.',
            whenToUse: 'Когда проектируете будущую AI-ответную логику и хотите сохранить структуру.',
            setup: [
              'Заполните fallback-текст ниже AI-блока.',
              'Подключите как обычный `Message` в текущем этапе.',
              'Позже замените на боевой AI backend, когда он будет подключён.',
            ],
            output: 'Сейчас работает как message fallback, AI блок отмечен как `soon`.',
          },
          {
            id: 'input',
            name: 'Input',
            kind: 'node',
            purpose: 'Запрашивает данные у пользователя и сохраняет ответ в переменную.',
            whenToUse: 'Когда нужен пошаговый сбор данных (имя, телефон, ответ на вопрос).',
            setup: [
              'Укажите вопрос/подсказку пользователю.',
              'Укажите `variableName`, куда сохранять ответ.',
              'Свяжите с нодой, которая использует эту переменную.',
            ],
            output: 'Ответ пользователя сохраняется в runtime/session переменную.',
            notes: ['Если включён force reply, Telegram reply keyboard может временно не показываться.'],
          },
          {
            id: 'reply-keyboard-node',
            name: 'Reply Keyboard',
            kind: 'node',
            purpose: 'Управляет глобальной клавиатурой под input внутри сценария.',
            whenToUse: 'Когда нужно вручную переключать/скрывать system reply keyboard на конкретном шаге.',
            setup: [
              'Выберите режим: использовать system rules, конкретный variant, условный выбор или hide/remove.',
              'Если используете variant/rule — убедитесь, что он создан в `System`.',
              'Проверьте следующий `Message`, чтобы увидеть эффект в Telegram.',
            ],
            output: 'На следующих сообщениях применяется выбранный вариант reply keyboard или она скрывается.',
          },
        ],
      },
      {
        id: 'logic',
        title: 'Логика и ветвление',
        description: 'Ноды, которые выбирают путь выполнения или задерживают продолжение сценария.',
        items: [
          {
            id: 'condition',
            name: 'Condition',
            kind: 'node',
            purpose: 'Проверяет условие и даёт ветки true/false.',
            whenToUse: 'Для простых проверок по переменным, тексту, числам.',
            setup: [
              'Выберите переменную/поле, оператор и значение.',
              'Подключите ветку `true` и ветку `false`.',
              'Проверьте кейсы тестовыми сообщениями.',
            ],
            output: 'Workflow идёт по одной из двух веток.',
          },
          {
            id: 'condition-ai',
            name: 'AI Logic',
            kind: 'preset',
            purpose: 'Подготовленная нода под AI-классификацию/ветвление.',
            whenToUse: 'Для будущих AI-веток, когда заранее готовите архитектуру сценария.',
            setup: [
              'Используйте как условный узел с fallback логикой.',
              'Подготовьте ветки под будущие intent/классы.',
            ],
            output: 'Сейчас опирается на текущую условную логику/фоллбек, AI режим — `soon`.',
          },
          {
            id: 'router',
            name: 'Router / Switch',
            kind: 'node',
            purpose: 'Выбирает одну из нескольких веток по значению переменной.',
            whenToUse: 'Когда вариантов больше двух (язык, статус, роль, этап onboarding).',
            setup: [
              'Укажите переменную и общий оператор.',
              'Добавьте cases (сверху вниз) и значения для сравнения.',
              'Подключите `default` ветку на случай отсутствия совпадения.',
            ],
            output: 'Срабатывает первый совпавший case, иначе идёт в default.',
            notes: ['Удобнее и чище, чем длинная цепочка из нескольких `Condition`.'],
          },
          {
            id: 'date-scheduler',
            name: 'Date/Time Scheduler',
            kind: 'node',
            purpose: 'Откладывает продолжение сценария до времени/даты.',
            whenToUse: 'Когда нужен send later, отложенный шаг или таймаут между сообщениями.',
            setup: [
              'Выберите режим: относительная задержка или конкретная дата/время.',
              'Укажите timezone при работе с датой/временем.',
              'Опционально сохраните рассчитанное время в переменную.',
            ],
            output: 'Workflow продолжится позже по таймеру.',
            notes: ['На текущем этапе таймеры могут зависеть от runtime процесса (важно учитывать при рестарте).'],
          },
        ],
      },
      {
        id: 'data-advanced',
        title: 'Данные, интеграции и продвинутые ноды',
        description: 'Операции с переменными, внешними API и пользовательской логикой.',
        items: [
          {
            id: 'action',
            name: 'Action',
            kind: 'node',
            purpose: 'Выполняет служебные действия (например `setVariable`, delay, delete message и др.).',
            whenToUse: 'Когда нужно изменить состояние, подготовить данные или сделать служебный шаг.',
            setup: [
              'Выберите тип действия в настройках.',
              'Для `setVariable` задайте имя и значение.',
              'Проверьте результат через последующее `Message` (`{{var}}`) или через логи.',
            ],
            output: 'Изменение runtime состояния или выполнение конкретной операции.',
          },
          {
            id: 'http',
            name: 'HTTP',
            kind: 'node',
            purpose: 'Вызывает внешний API и сохраняет ответ в переменную.',
            whenToUse: 'Интеграции с CRM, backend API, webhook endpoints, внешними сервисами.',
            setup: [
              'Укажите URL, метод, headers и body.',
              'Выберите формат body (`JSON`, `Form Data`, raw).',
              'Укажите `saveToVariable`, если нужно использовать ответ дальше.',
            ],
            output: 'HTTP-ответ доступен для следующих нод через переменную.',
            notes: ['Всегда продумывайте ветку обработки ошибок и таймауты.'],
          },
          {
            id: 'script',
            name: 'Script',
            kind: 'node',
            purpose: 'Выполняет JS/Python код для трансформации данных и логики.',
            whenToUse: 'Когда стандартных нод недостаточно и нужен контролируемый кастомный код.',
            setup: [
              'Выберите язык (JavaScript/Python).',
              'Используйте `input`, `context`, `vars` и присвойте итог в `result`.',
              'Укажите `save result to variable`, если нужен результат дальше.',
            ],
            output: 'Результат скрипта сохраняется в переменную и используется в следующих шагах.',
            notes: [
              'Это мощная нода, но требует дисциплины: короткие скрипты, понятные входы/выходы, контроль таймаутов.',
              'В production-среде стоит использовать только в доверенной инфраструктуре.',
            ],
          },
        ],
      },
    ],
  },
  keyboardsAndTriggers: {
    title: 'Клавиатуры и триггеры: что с чем работает',
    description:
      'Это один из самых частых источников ошибок. Важно различать reply keyboard (под input) и inline keyboard (под сообщением).',
    note:
      'Главное правило: Reply Keyboard отправляет обычный текст пользователя. Inline Keyboard может отправлять `callback_data` и ловится через `Callback Trigger`.',
    rows: [
      {
        topic: 'Где находится кнопка',
        replyKeyboard: 'Под полем ввода (глобальная клавиатура Telegram)',
        inlineKeyboard: 'Под конкретным сообщением бота',
      },
      {
        topic: 'Что отправляет при нажатии',
        replyKeyboard: 'Обычное текстовое сообщение',
        inlineKeyboard: '`callback_data` (или URL / web_app и т.д.)',
      },
      {
        topic: 'Каким триггером ловить',
        replyKeyboard: '`Text Trigger` (или `Condition` / `Router` по `message.text`)',
        inlineKeyboard: '`Callback Trigger`',
      },
      {
        topic: 'Где настраивается',
        replyKeyboard: '`System -> Reply Keyboard` или нода `Reply Keyboard`',
        inlineKeyboard: 'В `Message` node (inline buttons)',
      },
      {
        topic: 'Когда использовать',
        replyKeyboard: 'Постоянная навигация, меню, быстрые команды',
        inlineKeyboard: 'Действия внутри конкретного шага/сообщения',
      },
    ],
  },
  dataAndSecurity: {
    title: 'Где хранятся данные и что важно для безопасности',
    description:
      'Этот раздел нужен для поддержки пользователей и для понимания, что можно увидеть в Supabase, а что является временным runtime-состоянием.',
    rows: [
      {
        id: 'bots',
        item: 'Основные данные бота (имя, статус, metadata)',
        where: 'Supabase: `bots`',
        persistence: 'Постоянно',
        visibility: 'Видно в SB',
        notes: 'Используется для карточек ботов, статуса, общих настроек и части метаданных.',
      },
      {
        id: 'bot-configs',
        item: 'Canvas (nodes, edges, variables)',
        where: 'Supabase: `bot_configs` (JSONB)',
        persistence: 'Постоянно',
        visibility: 'Видно в SB (как JSON)',
        notes: 'Ноды не лежат отдельными строками; это JSON-массивы в одной записи конфигурации.',
      },
      {
        id: 'secrets',
        item: 'Telegram token / webhook secrets',
        where: 'Supabase: `bot_secrets` (шифрованно)',
        persistence: 'Постоянно',
        visibility: 'В SB виден ciphertext, не plaintext',
        notes: 'UI может показывать только факт наличия секрета, а не его открытое значение.',
      },
      {
        id: 'test-logs',
        item: 'Тестовые логи runtime',
        where: 'Supabase: `bot_test_logs` + runtime memory fallback',
        persistence: 'Постоянно (если запись в SB успешна)',
        visibility: 'Видно в SB и в панели логов',
        notes: 'Удобно для поддержки и будущей админ-панели.',
      },
      {
        id: 'audit',
        item: 'История действий (save/start/stop и др.)',
        where: 'Supabase: `bot_audit_events`',
        persistence: 'Постоянно',
        visibility: 'Видно в SB',
        notes: 'Полезно для расследования проблем и поддержки пользователя.',
      },
      {
        id: 'runtime-session',
        item: 'Текущие runtime-переменные/ожидания во время теста',
        where: 'Runtime процесса (часть состояния может быть временной)',
        persistence: 'Временно',
        visibility: 'Обычно не видно напрямую в SB',
        notes: 'Может сбрасываться при рестарте dev-сервера/процесса. Для прод-уровня нужен персистентный runtime store.',
      },
      {
        id: 'ui-local',
        item: 'Локальные UI-настройки (например чекбоксы/размеры панелей)',
        where: 'localStorage в браузере',
        persistence: 'Локально у пользователя',
        visibility: 'Не в SB',
        notes: 'Нормально для не-секретных UI-предпочтений.',
      },
    ],
  },
  testAndDeploy: {
    title: 'Тест, логи, деплой: рабочий процесс без путаницы',
    description:
      'Используйте один и тот же порядок каждый раз. Это снизит количество “случайных” ошибок и ускорит диагностику.',
    steps: [
      {
        id: 'td-1',
        title: 'Перед запуском теста: сохранить изменения',
        actions: [
          'Проверьте, что на холсте и в `System/Settings` закончены изменения.',
          'Нажмите `Сохранить`.',
          'Убедитесь, что индикатор несохранённых изменений исчез.',
        ],
        outcome: 'Тест запускается на актуальной конфигурации, а не на старом черновике.',
        videoSlotTitle: 'Видео: чек-лист перед Test',
      },
      {
        id: 'td-2',
        title: 'Запуск Test и проверка событий',
        actions: [
          'Нажмите `Тест`.',
          'Откройте панель логов.',
          'Отправьте тестовое сообщение в Telegram и сравните ожидаемую ветку с фактической.',
        ],
        outcome: 'Вы видите, какой trigger сработал и через какие ноды прошёл runtime.',
        videoSlotTitle: 'Видео: анализ теста по логам',
      },
      {
        id: 'td-3',
        title: 'Исправление логики после теста',
        actions: [
          'Используйте логи и поведение Telegram для локализации ошибки.',
          'Исправьте конкретную ноду/условие/переменную.',
          'Повторите `Save -> Test`, а не только `Test`.',
        ],
        outcome: 'Правки воспроизводимы и не теряются.',
        videoSlotTitle: 'Видео: цикл “ошибка -> правка -> повторный тест”',
      },
      {
        id: 'td-4',
        title: 'Остановка теста и подготовка к деплою',
        actions: [
          'Остановите тестовый режим.',
          'Проверьте финальную конфигурацию в `Settings`.',
          'Только после успешного теста переходите к деплою/боевому запуску.',
        ],
        outcome: 'Минимум конфликтов между тестовым и боевым режимами.',
        videoSlotTitle: 'Видео: завершение теста и подготовка к релизу',
      },
    ],
  },
  troubleshooting: {
    title: 'Частые проблемы и что проверять сначала',
    description:
      'Ниже не просто список ошибок, а порядок проверки. Идея простая: сначала исключаем UI/сохранение, затем trigger, потом runtime и только потом внешние сервисы.',
    items: [
      {
        id: 'faq-no-trigger',
        question: 'Нажал кнопку в Telegram, но нужный trigger не сработал',
        answer: [
          'Сначала проверьте тип кнопки: Reply Keyboard (под input) или Inline Keyboard (под сообщением).',
          'Если это Reply Keyboard, используйте `Text Trigger`, а не `Callback Trigger`.',
          'Если это Inline Keyboard, проверьте `callback_data` и pattern в `Callback Trigger`.',
          'Откройте логи и посмотрите, какое событие реально пришло (`message` или `callback_query`).',
        ],
      },
      {
        id: 'faq-var-not-visible',
        question: 'Action -> setVariable сработал, но значение не видно в System',
        answer: [
          '`System -> Переменные` показывает конфиг (пользовательские переменные), а не runtime-состояние сессии.',
          '`setVariable` обычно пишет значение во временную runtime/session переменную.',
          'Проверьте результат через следующую `Message` ноду (`{{var}}`) или по логам теста.',
        ],
      },
      {
        id: 'faq-save-errors',
        question: 'Нажимаю Save/Test, а изменения ведут себя нестабильно',
        answer: [
          'Проверьте, нет ли ошибок auth/rate limit в терминале dev-сервера.',
          'Убедитесь, что сессия Supabase не в rate limit и middleware корректно обновляет cookies.',
          'После серии auth ошибок перезапустите dev-сервер и повторите `Save`.',
        ],
      },
      {
        id: 'faq-logs-empty',
        question: 'Логи пустые или не обновляются',
        answer: [
          'Проверьте, запущен ли `Test` прямо сейчас.',
          'Проверьте, дошло ли сообщение до бота в Telegram и правильный ли token/config.',
          'Если был рестарт dev-сервера, часть временного runtime-состояния могла быть потеряна.',
          'Проверьте `bot_test_logs` в Supabase — возможно, логи сохранились туда, но UI polling временно отстаёт.',
        ],
      },
      {
        id: 'faq-hydration-locale',
        question: 'Появляется hydration mismatch (даты/форматы)',
        answer: [
          'Проверьте, что даты форматируются с явной локалью и timeZone, а не через “голый” `toLocaleDateString()`.',
          'Если компонент SSR, не используйте нестабильные значения (`Date.now()`, `Math.random()`) в разметке без необходимости.',
        ],
      },
    ],
  },
  videoPlan: {
    title: 'Видеоинструкции (скоро)',
    description:
      'Здесь скоро появятся видеоинструкции в том же порядке, что и текстовая документация. Пока ориентируйтесь на текстовые шаги как на основной сценарий.',
    slots: [
      {
        id: 'video-01',
        title: 'Создание первого бота и вход в редактор',
        description: 'Путь `Dashboard -> Bots -> Create -> Editor`, базовый обзор интерфейса.',
      },
      {
        id: 'video-02',
        title: 'Canvas: первый workflow (Trigger -> Message)',
        description: 'Добавление нод, соединение, выбор ноды, открытие настроек.',
      },
      {
        id: 'video-03',
        title: 'Переменные: System + вставка в Message',
        description: 'Создание пользовательской переменной и использование `{{variable}}`.',
      },
      {
        id: 'video-04',
        title: 'Reply Keyboard и Text Trigger',
        description: 'Настройка глобальной клавиатуры под input и обработка нажатий через текст.',
      },
      {
        id: 'video-05',
        title: 'Inline Keyboard и Callback Trigger',
        description: 'Кнопки в `Message` node, `callback_data`, обработка callback-событий.',
      },
      {
        id: 'video-06',
        title: 'Router / Switch и ветвление сценария',
        description: 'Построение нескольких веток по переменной вместо цепочки Condition.',
      },
      {
        id: 'video-07',
        title: 'HTTP / Script / Action (практический кейс)',
        description: 'Интеграция с API, трансформация данных, запись результата в переменную.',
      },
      {
        id: 'video-08',
        title: 'Тест, логи и диагностика ошибок',
        description: 'Как читать логи, что искать первым, как повторять тестовый цикл.',
      },
      {
        id: 'video-09',
        title: 'Settings: token, режимы запуска, подготовка к деплою',
        description: 'Безопасная настройка Telegram token и подготовка к запуску.',
      },
    ],
  },
}

const enContent: DocsContent = {
  locale: 'en',
  hero: {
    badge: 'Service Documentation',
    title: 'CBTooll Documentation',
    subtitle: 'Quick start, editor logic, nodes, system settings, and support workflow',
    description:
      'This documentation is action-oriented: what to click, what happens inside the system, what you should see, and how to verify the result. Video tutorials will be added gradually and will support the text, not replace it.',
    notes: [
      'Node names stay in English (same as product UI) to avoid mismatch between docs and interface.',
      'Use Test first for most scenarios, then move to Deploy / production setup.',
      'Each section clarifies where data is stored: Supabase, localStorage, or temporary runtime memory.',
    ],
    actions: {
      quickStart: 'Go to Quick Start',
      openDashboard: 'Open Dashboard',
      createBot: 'Open Bots List',
    },
  },
  tocTitle: 'Documentation Sections',
  tocHint: 'Start from top to bottom. Use sections and search for quick navigation. Video tutorials will appear in these same blocks soon.',
  sections: [
    { id: 'learning-flow', title: 'How to use this docs', description: 'Reading order and format' },
    { id: 'quick-start', title: 'Quick Start', description: 'Create bot, build workflow, test' },
    { id: 'service-flow', title: 'How the service works', description: 'From idea to running bot' },
    { id: 'editor-areas', title: 'Editor areas', description: 'Canvas, AI, System, Settings' },
    { id: 'ui-components', title: 'UI components', description: 'Main panels and usage' },
    { id: 'nodes-reference', title: 'Nodes and presets', description: 'What each node does and how to set it up' },
    { id: 'keyboards-triggers', title: 'Keyboards and triggers', description: 'Reply vs Inline, Text vs Callback' },
    { id: 'data-security', title: 'Data and security', description: 'Where data is stored' },
    { id: 'test-deploy', title: 'Test, logs, deploy', description: 'Execution and verification flow' },
    { id: 'troubleshooting', title: 'Troubleshooting', description: 'Common issues and checks' },
    { id: 'video-plan', title: 'Video Guides (Coming Soon)', description: 'Future video tutorials matching the documentation steps' },
  ],
  learningFlow: {
    title: 'How to read this documentation',
    description:
      'Each section follows the same structure: action -> system behavior -> validation -> common mistakes. This keeps docs operational instead of purely descriptive.',
    steps: [
      'Finish the Quick Start first to understand the full workflow cycle before deep-diving into all nodes.',
      'Then use “Editor areas” and “UI components” to understand where each feature lives in the interface.',
      'Use “Nodes and presets” as a reference, opening only the relevant group for your current task.',
      'Read “Keyboards and triggers” before configuring buttons to avoid Reply/Inline confusion.',
      'Use “Troubleshooting” and “Test, logs, deploy” when debugging behavior or setup issues.',
    ],
    videoNoteTitle: 'Video guides (coming soon)',
    videoNoteDescription:
      'Video walkthroughs will appear in these same sections soon. For now, use the text as the main source of exact actions and verification checkpoints.',
  },
  quickStart: {
    title: 'Quick Start: first bot from idea to test',
    description: 'Minimal path to a working result: trigger -> message -> save -> test -> logs.',
    steps: [
      {
        id: 'qs-1',
        title: 'Create a bot in Bots section',
        goal: 'Get a bot card and open the editor.',
        actions: [
          'Open `Dashboard -> Bots`.',
          'Click `New Bot` / `Create first bot`.',
          'Enter a name and short description.',
          'Open the editor (`/editor/canvas`).',
        ],
        systemBehavior: [
          'Bot base record is created in Supabase (`bots`).',
          'Workflow config is initialized in `bot_configs`.',
          'Editor opens with an empty canvas.',
        ],
        check: [
          'You see the canvas, section navigation, and node palette.',
          'Top header shows bot name and action buttons.',
        ],
        videoSlotTitle: 'Video: create first bot and open editor',
      },
      {
        id: 'qs-2',
        title: 'Build a minimal workflow on Canvas',
        goal: 'Create a simple trigger -> message flow.',
        actions: [
          'Add `Command Trigger` and `Message`.',
          'Connect them.',
          'Set command (e.g. `/start`).',
          'Enter response text in `Message`.',
        ],
        systemBehavior: [
          'Changes stay in editor state until Save/Test.',
          'Node settings update the workflow config on the canvas.',
        ],
        check: [
          'Connected nodes are visible on canvas.',
          'Node settings panel opens when selecting a node.',
        ],
        videoSlotTitle: 'Video: first workflow on canvas',
      },
      {
        id: 'qs-3',
        title: 'Add a variable and use it in Message',
        goal: 'Understand config variables vs runtime values.',
        actions: [
          'Open `System`.',
          'Create a custom variable (e.g. `welcomeText`).',
          'Insert `{{welcomeText}}` in `Message` (via suggestions after `{{`).',
          'Optionally use `Action -> setVariable` for runtime-only data.',
        ],
        systemBehavior: [
          'Custom variables are stored in `bot_configs.variables`.',
          'Runtime variables from `setVariable` live in the execution session.',
        ],
        check: [
          'Variable appears in `System -> Variables`.',
          'Variable suggestions appear in message text input.',
        ],
        videoSlotTitle: 'Video: variables and template insertion',
      },
      {
        id: 'qs-4',
        title: 'Save the bot configuration',
        goal: 'Persist canvas and settings.',
        actions: [
          'Click `Save` in editor header.',
          'Wait for completion.',
          'If there is an error, check bot settings/token separately.',
        ],
        systemBehavior: [
          'Canvas and config are saved to Supabase.',
          'Secrets (if changed) are stored separately and encrypted.',
          'Unsaved state indicator resets.',
        ],
        check: [
          'Unsaved changes indicator disappears.',
          'Canvas remains after page reload.',
        ],
        videoSlotTitle: 'Video: saving canvas and settings',
      },
      {
        id: 'qs-5',
        title: 'Run Test and inspect logs',
        goal: 'Validate workflow behavior before production deployment.',
        actions: [
          'Click `Test`.',
          'Open bottom logs panel.',
          'Send a message/command to the bot in Telegram.',
          'Confirm the expected trigger and message were executed.',
        ],
        systemBehavior: [
          'Current canvas is saved before test start.',
          'Runtime starts test execution mode.',
          'Logs are written to runtime memory and Supabase test logs when available.',
        ],
        check: [
          'Logs show test start and incoming event processing.',
          'Telegram bot sends the expected reply.',
        ],
        videoSlotTitle: 'Video: run test and read logs',
      },
      {
        id: 'qs-6',
        title: 'Stop Test and finalize',
        goal: 'Cleanly stop test runtime and keep stable state.',
        actions: [
          'Click `Stop` (same test button when active).',
          'Confirm logs stop streaming.',
          'Save final changes if needed.',
        ],
        systemBehavior: [
          'Test runtime/polling stops for this bot.',
          'Test-active metadata is reset.',
          'Logs remain available for review/history.',
        ],
        check: [
          'Button returns to `Test` state.',
          'No new log events appear without actions.',
        ],
        videoSlotTitle: 'Video: stopping test properly',
      },
    ],
  },
  serviceFlow: {
    title: 'How the service works (data & execution flow)',
    description: 'A simplified model of how ideas become a running bot inside the product.',
    stages: [
      { title: '1. Idea / prompt', description: 'You define the bot logic manually on canvas or via AI-assisted flow design.', output: 'Draft workflow structure.' },
      { title: '2. Editor state', description: 'Changes live in UI state until Save/Test.', output: 'Editable draft + unsaved indicator.' },
      { title: '3. Save', description: 'Canvas/config are stored in Supabase; secrets are stored separately and encrypted.', output: 'Persistent bot version in DB.' },
      { title: '4. Test runtime', description: 'Runtime executes workflow on Telegram events and writes logs.', output: 'Bot responses + logs + runtime variables.' },
      { title: '5. Support & iteration', description: 'You inspect logs, adjust nodes, and repeat the cycle.', output: 'Stable version of workflow.' },
    ],
  },
  editorAreas: {
    title: 'Editor Areas',
    description: 'The editor is intentionally split into focused areas to keep workflow design, system config, and bot settings separated.',
    cards: [
      {
        id: 'canvas',
        title: 'Canvas',
        subtitle: 'Visual workflow builder',
        whenToUse: 'Use when building dialog flow, branching, actions, and execution sequence.',
        actions: ['Add nodes from palette', 'Connect nodes', 'Edit node settings', 'Copy/Cut/Paste nodes', 'Run Test and inspect logs'],
        result: 'A working workflow graph.',
      },
      {
        id: 'ai-chat',
        title: 'AI Assistant',
        subtitle: 'Prompt-based assistant for drafting flows',
        whenToUse: 'Use when you need a fast draft, ideas, or explanation of logic.',
        actions: ['Describe the task', 'Review suggestions', 'Apply/translate into canvas logic', 'Validate manually'],
        result: 'Faster workflow design with manual verification.',
      },
      {
        id: 'system',
        title: 'System',
        subtitle: 'Variables and system-level bot behavior',
        whenToUse: 'Use for variables, triggers, reply keyboard, reactions, and global behavior.',
        actions: ['Create variables', 'Review base Telegram variables', 'Configure reply keyboard', 'Set additional features'],
        result: 'System config used by workflows.',
      },
      {
        id: 'settings',
        title: 'Settings',
        subtitle: 'Bot configuration and Telegram connection',
        whenToUse: 'Use for token, webhook/polling setup, and bot-level settings.',
        actions: ['Set Telegram token', 'Configure runtime mode', 'Save settings before test'],
        result: 'Bot is ready for test/launch.',
      },
    ],
  },
  uiComponents: {
    title: 'Editor UI Components and How to Use Them',
    description: 'These are interface components (not workflow nodes).',
    cards: [
      {
        id: 'sections-panel',
        title: 'Sections Panel (left)',
        location: 'Left side of the editor (Canvas / AI / System / Settings).',
        purpose: 'Switch between major editor modes.',
        howToUse: ['Click sections to switch mode.', 'Drag the divider to resize.', 'Double-click divider to reset width.', 'Width is saved in localStorage.'],
      },
      {
        id: 'nodes-palette',
        title: 'Nodes Palette',
        location: 'Top-left on Canvas.',
        purpose: 'Add nodes and presets.',
        howToUse: ['Hover a category to preview nodes.', 'Click category to pin.', 'Click or drag a node to add it to canvas.', 'Use node/edge counters for quick context.'],
      },
      {
        id: 'node-settings',
        title: 'Node Settings Panel',
        location: 'Right side on node selection.',
        purpose: 'Configure selected node behavior.',
        howToUse: ['Select a node on canvas.', 'Edit fields in side panel.', 'Use detailed (modal) mode for complex nodes.', 'Use variable suggestions when typing `{{`.'],
      },
      {
        id: 'logs-panel',
        title: 'Bot Logs Panel',
        location: 'Bottom panel on Canvas.',
        purpose: 'Inspect runtime behavior during Test.',
        howToUse: ['Open after Test starts.', 'Trace event -> trigger -> nodes -> result.', 'Copy logs as text/JSON for debugging or support.'],
      },
      {
        id: 'system-panels',
        title: 'System Panels',
        location: 'System section.',
        purpose: 'Manage variables and global bot features.',
        howToUse: ['Create custom variables.', 'Configure reply keyboard variants/rules.', 'Use Text Trigger for reply keyboard presses.', 'Enable additional features like reactions.'],
      },
      {
        id: 'bot-settings-form',
        title: 'Bot Settings Form',
        location: 'Settings section.',
        purpose: 'Connect the bot and configure runtime behavior.',
        howToUse: ['Set token and runtime options.', 'Save settings before testing.', 'Treat secrets as protected values (not shown in plaintext).'],
      },
    ],
  },
  nodes: {
    title: 'Nodes and Presets Reference',
    description: 'What each node/preset does and how to configure it safely.',
    groups: ruContent.nodes.groups as DocsNodeGroup[],
  },
  keyboardsAndTriggers: {
    title: 'Keyboards and Triggers',
    description: 'Avoid the most common mistake: confusing Reply Keyboard with Inline Keyboard.',
    note: 'Reply Keyboard sends plain text. Inline Keyboard can send callback_data and is handled by Callback Trigger.',
    rows: [
      { topic: 'Location', replyKeyboard: 'Under input (global Telegram keyboard)', inlineKeyboard: 'Under a specific bot message' },
      { topic: 'Press result', replyKeyboard: 'Regular user text message', inlineKeyboard: 'callback_data / URL / web_app action' },
      { topic: 'Trigger to handle it', replyKeyboard: 'Text Trigger (or Condition/Router by message.text)', inlineKeyboard: 'Callback Trigger' },
      { topic: 'Configured in', replyKeyboard: 'System -> Reply Keyboard or Reply Keyboard node', inlineKeyboard: 'Message node (inline buttons)' },
      { topic: 'Best use case', replyKeyboard: 'Persistent menus/navigation', inlineKeyboard: 'Context actions inside a message step' },
    ],
  },
  dataAndSecurity: {
    title: 'Data Storage and Security',
    description: 'Where things are stored and what is persistent vs runtime-only.',
    rows: [
      { id: 'bots', item: 'Bot base data (name/status/metadata)', where: 'Supabase: `bots`', persistence: 'Persistent', visibility: 'Visible in SB', notes: 'General bot state and metadata.' },
      { id: 'bot-configs', item: 'Canvas (nodes/edges/variables)', where: 'Supabase: `bot_configs` (JSONB)', persistence: 'Persistent', visibility: 'Visible in SB (JSON)', notes: 'Stored as JSON arrays, not separate rows per node.' },
      { id: 'secrets', item: 'Telegram token / webhook secrets', where: 'Supabase: `bot_secrets` (encrypted)', persistence: 'Persistent', visibility: 'Ciphertext visible, not plaintext', notes: 'Protected server-side storage for secrets.' },
      { id: 'test-logs', item: 'Runtime test logs', where: 'Supabase `bot_test_logs` + memory fallback', persistence: 'Persistent when DB write succeeds', visibility: 'Visible in SB and UI logs', notes: 'Useful for support and future admin panel.' },
      { id: 'audit', item: 'Audit events (save/start/stop)', where: 'Supabase: `bot_audit_events`', persistence: 'Persistent', visibility: 'Visible in SB', notes: 'Useful for troubleshooting and support.' },
      { id: 'runtime-session', item: 'Runtime variables / waiting states', where: 'Runtime process memory (partially temporary)', persistence: 'Temporary', visibility: 'Usually not directly visible in SB', notes: 'Can reset on process restart until persistent runtime storage is added.' },
      { id: 'ui-local', item: 'UI preferences (panel sizes, toggles)', where: 'Browser localStorage', persistence: 'Local per browser', visibility: 'Not in SB', notes: 'Safe for non-secret UI preferences.' },
    ],
  },
  testAndDeploy: {
    title: 'Test, Logs, and Deploy Workflow',
    description: 'Use a consistent sequence to reduce random failures and speed up debugging.',
    steps: [
      { id: 'td-1', title: 'Save before Test', actions: ['Finish changes on Canvas/System/Settings.', 'Click Save.', 'Confirm unsaved indicator is gone.'], outcome: 'You test the current version, not an old draft.', videoSlotTitle: 'Video: pre-test checklist' },
      { id: 'td-2', title: 'Run Test and inspect runtime path', actions: ['Click Test.', 'Open logs panel.', 'Send a Telegram message and verify actual path in logs.'], outcome: 'You can see which trigger and nodes actually executed.', videoSlotTitle: 'Video: reading test logs' },
      { id: 'td-3', title: 'Fix and repeat', actions: ['Use logs to isolate the broken node/condition.', 'Apply a focused fix.', 'Repeat Save -> Test.'], outcome: 'Changes remain reproducible and easier to validate.', videoSlotTitle: 'Video: debug loop (fix and retest)' },
      { id: 'td-4', title: 'Stop test and prepare for deploy', actions: ['Stop test mode.', 'Review Settings/token/runtime options.', 'Move to deploy only after successful tests.'], outcome: 'Cleaner transition from test to production setup.', videoSlotTitle: 'Video: stop test and prepare deployment' },
    ],
  },
  troubleshooting: {
    title: 'Troubleshooting (first checks)',
    description: 'Use this sequence: UI/save -> trigger type -> runtime logs -> external services.',
    items: [
      {
        id: 'faq-no-trigger',
        question: 'A button press does not trigger the expected flow',
        answer: [
          'Check button type first: Reply Keyboard vs Inline Keyboard.',
          'Reply Keyboard -> use Text Trigger. Inline Keyboard -> use Callback Trigger.',
          'Inspect logs to confirm whether Telegram sent `message` or `callback_query`.',
        ],
      },
      {
        id: 'faq-var-not-visible',
        question: 'Action setVariable worked but value is not visible in System',
        answer: [
          'System variables list shows configuration variables, not runtime session state.',
          'Runtime value is usually visible via next Message node (`{{var}}`) or logs.',
        ],
      },
      {
        id: 'faq-save-errors',
        question: 'Save/Test behaves inconsistently',
        answer: [
          'Check dev server terminal for Supabase auth/rate-limit errors.',
          'Confirm session refresh/cookies are working normally.',
          'Restart dev server if auth rate-limit errors accumulate.',
        ],
      },
      {
        id: 'faq-logs-empty',
        question: 'Logs are empty or not updating',
        answer: [
          'Confirm Test mode is active.',
          'Confirm the bot receives the Telegram event (token/config is valid).',
          'Check Supabase `bot_test_logs` if UI polling is delayed.',
        ],
      },
      {
        id: 'faq-hydration-locale',
        question: 'Hydration mismatch appears (dates/formatting)',
        answer: [
          'Use explicit locale and timezone for date formatting.',
          'Avoid unstable SSR-rendered values unless necessary.',
        ],
      },
    ],
  },
  videoPlan: {
    title: 'Video Guides (Coming Soon)',
    description: 'Video tutorials will appear here in the same order as the documentation. Until then, follow the text steps as the primary guide.',
    slots: [
      { id: 'video-01', title: 'Create first bot and open editor', description: 'Dashboard -> Bots -> Create -> Editor flow.' },
      { id: 'video-02', title: 'Canvas: first workflow', description: 'Trigger -> Message, connecting nodes, editing settings.' },
      { id: 'video-03', title: 'Variables and templates', description: 'System variables and `{{variable}}` usage.' },
      { id: 'video-04', title: 'Reply Keyboard + Text Trigger', description: 'Global keyboard under input and text-based handling.' },
      { id: 'video-05', title: 'Inline Keyboard + Callback Trigger', description: 'Callback buttons in Message node and callback handling.' },
      { id: 'video-06', title: 'Router / Switch', description: 'Multi-branch routing by variable value.' },
      { id: 'video-07', title: 'HTTP / Script / Action practical flow', description: 'API call, transformation, variable save, response.' },
      { id: 'video-08', title: 'Testing and logs', description: 'How to read runtime logs and debug issues.' },
      { id: 'video-09', title: 'Settings and deploy preparation', description: 'Token/runtime settings and release checklist.' },
    ],
  },
}

export function getDocsContent(locale: string): DocsContent {
  return locale === 'en' ? enContent : ruContent
}
