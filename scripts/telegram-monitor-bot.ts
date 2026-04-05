import { createHash } from 'node:crypto'
import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const exec = promisify(execCallback)

type MonitorState = {
  ownerChatId: number | null
  lastUpdateId: number
  lastHealthState: 'healthy' | 'down'
  alerts: Record<string, number>
}

type TelegramUpdate = {
  update_id: number
  message?: {
    chat?: { id?: number }
    text?: string
    from?: { first_name?: string }
  }
}

type TelegramApiResponse<T> = {
  ok: boolean
  result: T
  description?: string
}

type ReplyButton = string

type ScenarioAlert = {
  key: string
  title: string
  body: string
  logs: string
}

const DEFAULT_STATE: MonitorState = {
  ownerChatId: null,
  lastUpdateId: 0,
  lastHealthState: 'healthy',
  alerts: {},
}

const REPLY_KEYBOARD: ReplyButton[][] = [
  ['Проверить сайт', 'Логи сайта'],
  ['Статус сервисов', 'Помощь'],
]

const DEFAULT_LOG_COMMAND =
  'journalctl -u cbtooll-blue.service -u cbtooll-green.service -u nginx -n 1000 --no-pager -o short-iso'

const DEFAULT_CRITICAL_LOG_COMMAND =
  'journalctl -u cbtooll-blue.service -u cbtooll-green.service -u nginx -n 250 --no-pager -o short-iso'

const CRITICAL_PATTERNS = [
  /\b502\b/i,
  /\b503\b/i,
  /\b504\b/i,
  /bad gateway/i,
  /upstream sent too big header/i,
  /\buncaught\b/i,
  /\bunhandled\b/i,
  /\bexception\b/i,
  /\bfatal\b/i,
  /\bpanic\b/i,
  /\bsegfault\b/i,
  /\bTypeError\b/i,
  /\bReferenceError\b/i,
  /\bSyntaxError\b/i,
  /\bECONNREFUSED\b/i,
  /\bEADDRINUSE\b/i,
  /\bout of memory\b/i,
  /\bOOM\b/i,
]

function env(name: string, fallback = '') {
  return String(process.env[name] || fallback).trim()
}

function intEnv(name: string, fallback: number) {
  const value = Number(env(name))
  return Number.isFinite(value) ? value : fallback
}

function getStatePath() {
  return env(
    'TELEGRAM_MONITOR_STATE_PATH',
    path.join(process.cwd(), '.runtime', 'telegram-monitor-bot-state.json')
  )
}

function getBotToken() {
  return env('TELEGRAM_MONITOR_BOT_TOKEN')
}

function getHealthUrl() {
  return env('TELEGRAM_MONITOR_SITE_HEALTH_URL', env('APP_URL', 'https://cbtooll.com') + '/ru')
}

function getLogCommand() {
  return env('TELEGRAM_MONITOR_LOG_COMMAND', DEFAULT_LOG_COMMAND)
}

function getCriticalLogCommand() {
  return env('TELEGRAM_MONITOR_CRITICAL_LOG_COMMAND', DEFAULT_CRITICAL_LOG_COMMAND)
}

function getServicesList() {
  return env('TELEGRAM_MONITOR_SERVICES', 'cbtooll-green.service,cbtooll-blue.service,nginx')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getAlertCooldownMs() {
  return intEnv('TELEGRAM_MONITOR_ALERT_COOLDOWN_MS', 24 * 60 * 60 * 1000)
}

function getHealthIntervalMs() {
  return intEnv('TELEGRAM_MONITOR_HEALTHCHECK_INTERVAL_MS', 30_000)
}

function getLogScanIntervalMs() {
  return intEnv('TELEGRAM_MONITOR_LOG_SCAN_INTERVAL_MS', 30_000)
}

function getUpdatesTimeoutSec() {
  return intEnv('TELEGRAM_MONITOR_UPDATES_TIMEOUT_SEC', 20)
}

function getHealthTimeoutMs() {
  return intEnv('TELEGRAM_MONITOR_SITE_TIMEOUT_MS', 12_000)
}

function getOwnerFromEnv() {
  const raw = env('TELEGRAM_MONITOR_OWNER_CHAT_ID')
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Moscow',
  }).format(date)
}

function buildReplyMarkup() {
  return {
    keyboard: REPLY_KEYBOARD.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
    input_field_placeholder: 'Выберите действие',
  }
}

async function ensureParentDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true })
}

async function loadState(): Promise<MonitorState> {
  const filePath = getStatePath()

  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<MonitorState>
    return {
      ownerChatId: typeof parsed.ownerChatId === 'number' ? parsed.ownerChatId : null,
      lastUpdateId: Number.isFinite(parsed.lastUpdateId) ? Number(parsed.lastUpdateId) : 0,
      lastHealthState: parsed.lastHealthState === 'down' ? 'down' : 'healthy',
      alerts: parsed.alerts && typeof parsed.alerts === 'object' ? parsed.alerts : {},
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

async function saveState(state: MonitorState) {
  const filePath = getStatePath()
  await ensureParentDir(filePath)
  await writeFile(filePath, JSON.stringify(state, null, 2), 'utf8')
}

function purgeExpiredAlerts(state: MonitorState) {
  const cutoff = Date.now() - getAlertCooldownMs()
  for (const [key, timestamp] of Object.entries(state.alerts)) {
    if (timestamp < cutoff) {
      delete state.alerts[key]
    }
  }
}

function hashFingerprint(input: string) {
  return createHash('sha1').update(input).digest('hex')
}

async function runShellCommand(command: string) {
  try {
    const { stdout, stderr } = await exec(command, {
      shell: '/bin/bash',
      maxBuffer: 8 * 1024 * 1024,
    })
    const output = [stdout, stderr].filter(Boolean).join('\n').trim()
    return output || 'Команда не вернула данных.'
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr?: string }).stderr || (error as { message?: string }).message || error)
        : String(error)
    return `Не удалось выполнить команду:\n${message}`
  }
}

async function telegramApi<T>(method: string, body?: BodyInit) {
  const token = getBotToken()
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    body,
  })

  const payload = (await response.json()) as TelegramApiResponse<T>
  if (!payload.ok) {
    throw new Error(payload.description || `Telegram API ${method} failed`)
  }

  return payload.result
}

async function sendMessage(chatId: number, text: string, withKeyboard = false) {
  const body = new URLSearchParams({
    chat_id: String(chatId),
    text,
  })

  if (withKeyboard) {
    body.set('reply_markup', JSON.stringify(buildReplyMarkup()))
  }

  await telegramApi('sendMessage', body)
}

async function sendDocument(chatId: number, filename: string, content: string, caption?: string) {
  const form = new FormData()
  form.set('chat_id', String(chatId))
  if (caption) {
    form.set('caption', caption)
  }
  form.set('document', new Blob([content], { type: 'text/plain;charset=utf-8' }), filename)
  await telegramApi('sendDocument', form)
}

async function getUpdates(offset: number) {
  const params = new URLSearchParams({
    timeout: String(getUpdatesTimeoutSec()),
    offset: String(offset),
    allowed_updates: JSON.stringify(['message']),
  })
  return telegramApi<TelegramUpdate[]>(`getUpdates?${params.toString()}`)
}

async function collectSiteLogs() {
  return runShellCommand(getLogCommand())
}

async function collectCriticalLogSnippet() {
  const output = await runShellCommand(getCriticalLogCommand())
  const lines = output.split(/\r?\n/)
  let matchIndex = -1

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (CRITICAL_PATTERNS.some((pattern) => pattern.test(lines[index] || ''))) {
      matchIndex = index
      break
    }
  }

  if (matchIndex < 0) {
    return null
  }

  const start = Math.max(0, matchIndex - 40)
  const end = Math.min(lines.length, matchIndex + 41)
  const snippet = lines.slice(start, end).join('\n').trim()
  const line = lines[matchIndex] || 'Critical log entry'
  return {
    fingerprint: hashFingerprint(line),
    line,
    snippet,
  }
}

async function checkHealth(): Promise<ScenarioAlert | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getHealthTimeoutMs())
  const url = getHealthUrl()

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'CBTooll-MonitorBot/1.0',
      },
    })

    if (response.ok) {
      return null
    }

    const body = await response.text().catch(() => '')
    const logs = await collectSiteLogs()
    return {
      key: hashFingerprint(`health:${response.status}:${url}`),
      title: `Критическая проблема сайта: ${response.status}`,
      body: `Сайт ответил статусом ${response.status} на ${url}.`,
      logs: [
        `URL: ${url}`,
        `Status: ${response.status}`,
        '',
        body.slice(0, 4000),
        '',
        '----- LOGS -----',
        logs,
      ].join('\n'),
    }
  } catch (error) {
    const logs = await collectSiteLogs()
    return {
      key: hashFingerprint(`health-error:${String(error)}`),
      title: 'Критическая проблема сайта: healthcheck не прошёл',
      body: `Не удалось получить ответ от ${url}.`,
      logs: [
        `URL: ${url}`,
        `Error: ${String(error)}`,
        '',
        '----- LOGS -----',
        logs,
      ].join('\n'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkCriticalLogs(): Promise<ScenarioAlert | null> {
  const match = await collectCriticalLogSnippet()
  if (!match) {
    return null
  }

  return {
    key: match.fingerprint,
    title: 'Критическая ошибка в логах сайта',
    body: match.line,
    logs: match.snippet,
  }
}

async function collectServicesStatus() {
  const services = getServicesList()
  if (!services.length) {
    return 'Список сервисов не настроен.'
  }

  const lines = await Promise.all(
    services.map(async (service) => {
      const status = await runShellCommand(`systemctl is-active ${service}`)
      return `${service}: ${status.split('\n')[0] || 'unknown'}`
    })
  )

  return lines.join('\n')
}

function isOwnerChat(chatId: number, state: MonitorState) {
  const configuredOwner = getOwnerFromEnv()
  const ownerChatId = configuredOwner || state.ownerChatId
  return ownerChatId !== null && chatId === ownerChatId
}

async function ensureOwner(chatId: number, state: MonitorState) {
  const configuredOwner = getOwnerFromEnv()
  if (configuredOwner) {
    return configuredOwner === chatId
  }

  if (state.ownerChatId === null) {
    state.ownerChatId = chatId
    await saveState(state)
    return true
  }

  return state.ownerChatId === chatId
}

async function sendGreeting(chatId: number) {
  await sendMessage(
    chatId,
    [
      'Привет. Это monitor-бот CBTooll.',
      'Я могу прислать статус сайта, последние 1000 строк логов и сам сообщу о критических проблемах.',
      'Используйте кнопки под строкой ввода.',
    ].join('\n\n'),
    true
  )
}

async function handleCommand(chatId: number, text: string, state: MonitorState) {
  const normalized = text.trim()

  if (normalized === '/start') {
    const allowed = await ensureOwner(chatId, state)
    if (!allowed) {
      await sendMessage(chatId, 'Этот monitor-бот уже привязан к другому чату.')
      return
    }

    await sendGreeting(chatId)
    return
  }

  if (!isOwnerChat(chatId, state)) {
    await sendMessage(chatId, 'Сначала откройте этот бот из привязанного чата через /start.')
    return
  }

  if (normalized === 'Проверить сайт' || normalized === '/status') {
    const health = await checkHealth()
    if (!health) {
      const servicesStatus = await collectServicesStatus()
      await sendMessage(
        chatId,
        [
          `Сайт отвечает нормально. Проверка: ${formatTimestamp()}.`,
          '',
          'Статус сервисов:',
          servicesStatus,
        ].join('\n'),
        true
      )
      return
    }

    await sendMessage(chatId, `${health.title}\n\n${health.body}`, true)
    await sendDocument(chatId, `site-health-${Date.now()}.txt`, health.logs, 'Логи по последней критической проблеме')
    return
  }

  if (normalized === 'Логи сайта' || normalized === '/logs') {
    const logs = await collectSiteLogs()
    await sendDocument(chatId, `site-logs-${Date.now()}.txt`, logs, 'Последние 1000 строк логов сайта')
    return
  }

  if (normalized === 'Статус сервисов' || normalized === '/services') {
    const servicesStatus = await collectServicesStatus()
    await sendMessage(chatId, `Статус сервисов:\n${servicesStatus}`, true)
    return
  }

  if (normalized === 'Помощь' || normalized === '/help') {
    await sendMessage(
      chatId,
      [
        'Доступные действия:',
        '• Проверить сайт — быстрый healthcheck и статус сервисов',
        '• Логи сайта — последние 1000 строк в txt',
        '• Статус сервисов — состояние nginx и приложений',
      ].join('\n'),
      true
    )
    return
  }

  await sendMessage(chatId, 'Используйте кнопки под строкой ввода: Проверить сайт, Логи сайта, Статус сервисов или Помощь.', true)
}

async function processUpdates(state: MonitorState) {
  const updates = await getUpdates(state.lastUpdateId + 1)
  if (!updates.length) {
    return
  }

  for (const update of updates) {
    state.lastUpdateId = Math.max(state.lastUpdateId, update.update_id)
    const chatId = Number(update.message?.chat?.id || 0)
    const text = String(update.message?.text || '').trim()
    if (!chatId || !text) {
      continue
    }

    await handleCommand(chatId, text, state)
  }

  await saveState(state)
}

async function maybeSendAlert(state: MonitorState, alert: ScenarioAlert | null) {
  if (!alert) {
    return
  }

  const ownerChatId = getOwnerFromEnv() || state.ownerChatId
  if (!ownerChatId) {
    return
  }

  purgeExpiredAlerts(state)
  if (state.alerts[alert.key]) {
    return
  }

  state.alerts[alert.key] = Date.now()
  await saveState(state)

  await sendMessage(ownerChatId, `${alert.title}\n\n${alert.body}`, true)
  await sendDocument(
    ownerChatId,
    `critical-site-error-${Date.now()}.txt`,
    alert.logs,
    'Логи критической проблемы'
  )
}

async function runMonitor() {
  const botToken = getBotToken()
  if (!botToken) {
    throw new Error('Missing TELEGRAM_MONITOR_BOT_TOKEN')
  }

  const state = await loadState()
  let nextHealthCheckAt = 0
  let nextLogScanAt = 0
  let previousHealthWasDown = state.lastHealthState === 'down'

  while (true) {
    try {
      await processUpdates(state)

      const now = Date.now()

      if (now >= nextHealthCheckAt) {
        const healthAlert = await checkHealth()
        const isDown = Boolean(healthAlert)

        if (!isDown && previousHealthWasDown && (getOwnerFromEnv() || state.ownerChatId)) {
          await sendMessage(
            Number(getOwnerFromEnv() || state.ownerChatId),
            `Сайт снова отвечает нормально. Проверка: ${formatTimestamp()}.`,
            true
          )
        }

        state.lastHealthState = isDown ? 'down' : 'healthy'
        previousHealthWasDown = isDown
        await saveState(state)
        await maybeSendAlert(state, healthAlert)
        nextHealthCheckAt = now + getHealthIntervalMs()
      }

      if (now >= nextLogScanAt) {
        const logAlert = await checkCriticalLogs()
        await maybeSendAlert(state, logAlert)
        nextLogScanAt = now + getLogScanIntervalMs()
      }
    } catch (error) {
      console.error('[telegram-monitor-bot] loop error:', error)
      await sleep(3_000)
    }
  }
}

runMonitor().catch((error) => {
  console.error('[telegram-monitor-bot] fatal:', error)
  process.exitCode = 1
})
