/**
 * Bot Code Generator
 * Transforms JSON workflow (nodes + edges) into working Telegraf.js bot code
 */

import type {
  BotConfig,
  BotMetadata,
  Node,
} from '../types/bot.types'
import type {
  MessageNodeData,
  InputNodeData,
  ConditionNodeData,
  ActionNodeData,
  SetVariableNodeData,
  HttpNodeData,
  WebhookNodeData,
  TriggerNodeData,
  WaitNodeData,
} from '../types/component-schemas'

interface GeneratorOptions {
  botToken?: string
  webhookUrl?: string
  includeSession?: boolean
  includeLogging?: boolean
}

export class BotCodeGenerator {
  private config: BotConfig
  private metadata: BotMetadata
  private options: Required<GeneratorOptions>

  constructor(config: BotConfig, metadata: BotMetadata = {}, options: Partial<GeneratorOptions> = {}) {
    this.config = config
    this.metadata = metadata
    this.options = {
      botToken: options.botToken || metadata.telegramToken || 'process.env.BOT_TOKEN',
      webhookUrl: options.webhookUrl || metadata.webhookUrl || '',
      includeSession: options.includeSession ?? true,
      includeLogging: options.includeLogging ?? true,
    }
  }

  /**
   * Generate complete bot code
   */
  generate(): string {
    const sections: string[] = []

    // Header
    sections.push(this.generateHeader())
    sections.push('')

    // Imports
    sections.push(this.generateImports())
    sections.push('')

    // Session middleware
    if (this.options.includeSession) {
      sections.push(this.generateSessionMiddleware())
      sections.push('')
    }

    // Initialize bot
    sections.push(this.generateBotInitialization())
    sections.push('')

    // Helper functions
    sections.push(this.generateHelperFunctions())
    sections.push('')

    // Workflow handlers (main logic)
    sections.push(this.generateWorkflowHandlers())
    sections.push('')

    // Launch
    sections.push(this.generateLaunch())

    return sections.join('\n')
  }

  private generateHeader(): string {
    return `/**
 * Generated Telegram Bot
 * DO NOT EDIT - This file is auto-generated from visual workflow
 *
 * Generated at: ${new Date().toISOString()}
 * Nodes: ${this.config.nodes.length}
 * Edges: ${this.config.edges.length}
 */`
  }

  private generateImports(): string {
    const imports: string[] = [
      "const { Telegraf } = require('telegraf');",
      "const { session } = require('telegraf/lib/middleware/session.js');",
    ]

    if (this.options.includeSession) {
      imports.push("const { MemorySessionStorage } = require('@telegraf/session/memory');")
    }

    const needsAxios = this.config.nodes.some((n) => {
      if (n.type === 'webhook' || n.type === 'http') {
        return true
      }

      if (n.type === 'action') {
        const action = (n.data as ActionNodeData | undefined)?.action as { type?: string } | undefined
        return action?.type === 'httpRequest'
      }

      return false
    })

    if (needsAxios) {
      imports.push("const axios = require('axios');")
    }

    const needsLocalMediaSupport = this.config.nodes.some((n) => {
      if (n.type !== 'message' || !n.data || typeof n.data !== 'object') {
        return false
      }
      const dataRecord = n.data as Record<string, unknown>
      const attachments = Array.isArray(dataRecord.attachments) ? dataRecord.attachments : []
      return attachments.length > 0
    })

    if (needsLocalMediaSupport) {
      imports.push("const fs = require('fs');")
      imports.push("const path = require('path');")
      imports.push("const os = require('os');")
    }

    return imports.join('\n')
  }

  private generateSessionMiddleware(): string {
    return `// Session storage for keeping user state
const storage = new MemorySessionStorage();
const sessionMiddleware = session({ storage });`
  }

  private generateBotInitialization(): string {
    const token = this.options.botToken.startsWith('process.env')
      ? this.options.botToken
      : `'${this.options.botToken}'`

    return `// Initialize bot
const bot = new Telegraf(${token});

// Apply session middleware
bot.use(sessionMiddleware);

// Global error handler
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});`
  }

  private generateHelperFunctions(): string {
    const functions: string[] = []

    // Variable interpolation
    functions.push(`
// Interpolate variables in text ({{variable}} syntax)
function interpolate(text, ctx) {
  if (!text) return '';
  return text.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
    const keys = path.split('.');
    let value = ctx.session;
    for (const key of keys) {
      value = value?.[key];
    }
    return value !== undefined ? String(value) : match;
  });
}`)

    // Helper to get next node
    functions.push(`
// Get next node in workflow
function getNextNode(currentNodeId) {
  const edge = ${JSON.stringify(this.config.edges)}.find(e => e.source === currentNodeId);
  return edge?.target || null;
}`)

    // Keyboard builder
    if (this.config.nodes.some(n => n.type === 'message' || n.type === 'input')) {
      functions.push(`
// Build inline keyboard from data
function buildKeyboard(keyboardData) {
  if (!keyboardData) return undefined;

  const normalizeRows = (source) => {
    if (Array.isArray(source)) {
      if (source.length > 0 && Array.isArray(source[0])) return source;
      return [source];
    }
    if (source && typeof source === 'object') {
      if (Array.isArray(source.rows)) return source.rows.map((row) => row?.buttons || row || []);
      if (Array.isArray(source.inline_keyboard)) return source.inline_keyboard;
      if (Array.isArray(source.buttons)) return [source.buttons];
    }
    return [];
  };

  const toSlug = (value) => {
    const base = String(value || '').trim().toLowerCase().replace(/\\s+/g, '_');
    if (!base) return '';
    return encodeURIComponent(base).replace(/%/g, '').replace(/[^a-z0-9_:-]/g, '').slice(0, 52);
  };

  const NOOP_PREFIX = '__noop__:';
  const isUrl = (value) => /^(https?:\\/\\/|tg:\\/\\/|mailto:|tel:)/i.test(String(value || '').trim());
  const rows = normalizeRows(keyboardData);
  if (rows.length === 0) return undefined;

  const inline_keyboard = rows
    .map((row, rowIndex) => {
      const rowButtons = Array.isArray(row) ? row : [];
      return rowButtons
        .map((rawButton, buttonIndex) => {
          const btn =
            rawButton && typeof rawButton === 'object'
              ? rawButton
              : { text: String(rawButton || ''), callbackData: String(rawButton || '') };
          const text = String(btn.text || btn.label || btn.title || '').trim();
          if (!text) return null;

          const callbackRaw = String(
            btn.callbackData || btn.callback_data || btn.data || btn.action || btn.value || ''
          ).trim();
          const actionType = String(btn.actionType || btn.kind || btn.type || '').trim().toLowerCase();
          const payStars = Boolean(btn.payStars) || actionType === 'stars' || actionType === 'starspay' || actionType === 'stars_pay';
          const urlRaw = String(
            btn.url || (payStars ? (btn.starsUrl || btn.paymentUrl || btn.payment_url || '') : '')
          ).trim();
          const fallbackNoop = NOOP_PREFIX + (toSlug(btn.id) || ('r' + (rowIndex + 1) + 'b' + (buttonIndex + 1)));

          const shouldUseUrl = payStars || actionType === 'url' || (!actionType && urlRaw);
          if (shouldUseUrl && urlRaw && isUrl(urlRaw)) {
            return { text, url: urlRaw };
          }

          const callbackData = String(callbackRaw || fallbackNoop).slice(0, 64);
          if (!callbackData) return null;
          return { text, callback_data: callbackData };
        })
        .filter(Boolean);
    })
    .filter((row) => row.length > 0);

  if (inline_keyboard.length === 0) return undefined;

  return {
    inline_keyboard,
  };
}`)
    }

    const hasMessageAttachments = this.config.nodes.some((n) => {
      if (n.type !== 'message' || !n.data || typeof n.data !== 'object') {
        return false
      }
      const dataRecord = n.data as Record<string, unknown>
      return Array.isArray(dataRecord.attachments) && dataRecord.attachments.length > 0
    })

    if (hasMessageAttachments) {
      functions.push(`
// Resolve media input: URL/file_id or local file path
function resolveMediaInput(source) {
  const value = String(source || '').trim();
  if (!value) return value;

  if (/^(https?:\\/\\/|tg:\\/\\/)/i.test(value)) {
    return value;
  }

  const looksLikePath =
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    value.startsWith('~/') ||
    /^[a-zA-Z]:[\\\\/]/.test(value) ||
    value.includes('/') ||
    value.includes('\\\\');

  if (!looksLikePath) {
    return value; // likely Telegram file_id
  }

  let resolvedPath = value;
  if (value.startsWith('~/')) {
    resolvedPath = path.resolve(os.homedir(), value.slice(2));
  } else if (!path.isAbsolute(value) && !/^[a-zA-Z]:[\\\\/]/.test(value)) {
    resolvedPath = path.resolve(process.cwd(), value);
  }

  if (!fs.existsSync(resolvedPath)) {
    return value;
  }

  return { source: fs.createReadStream(resolvedPath) };
}`)
    }

    return functions.join('\n')
  }

  private generateWorkflowHandlers(): string {
    const sections: string[] = []

    // Find trigger nodes (entry points)
    const triggerNodes = this.config.nodes.filter(n => n.type === 'trigger')

    if (triggerNodes.length === 0) {
      sections.push('// No trigger nodes found - adding default /start handler')
      sections.push("bot.on('message', async (ctx) => {")
      sections.push("  ctx.reply('Бот запущен! Настройте триггеры в редакторе.');")
      sections.push("});")
    } else {
      for (const triggerNode of triggerNodes) {
        sections.push(this.generateTriggerHandler(triggerNode))
      }
    }

    // Generate handlers for each node type
    sections.push(this.generateNodeHandlers())

    return sections.join('\n\n')
  }

  private generateTriggerHandler(node: Node): string {
    const data = node.data as TriggerNodeData
    const sections: string[] = []

    const handlerName = `handle_${data.trigger}_${node.id.replace(/-/g, '_')}`

    sections.push(`// Trigger: ${data.description || data.pattern || data.trigger}`)
    sections.push(`async function ${handlerName}(ctx) {`)

    // Get next node
    const nextEdge = this.config.edges.find(e => e.source === node.id)
    if (nextEdge) {
      const nextNode = this.config.nodes.find(n => n.id === nextEdge.target)
      if (nextNode) {
        sections.push(this.generateNodeCall(nextNode, 'ctx'))
      }
    }

    sections.push('}')

    // Register handler
    switch (data.trigger) {
      case 'command':
        sections.push(`bot.command('${data.pattern?.replace('/', '') || 'start'}', ${handlerName});`)
        break
      case 'text':
        sections.push(`bot.hears('${data.pattern || ''}', ${handlerName});`)
        break
      case 'callbackQuery':
        sections.push(`bot.action('${data.pattern || ''}', ${handlerName});`)
        break
      case 'photo':
        sections.push(`bot.on('photo', ${handlerName});`)
        break
      default:
        sections.push(`bot.on('message', ${handlerName});`)
    }

    return sections.join('\n')
  }

  private generateNodeHandlers(): string {
    const sections: string[] = []
    sections.push('// Node handlers')
    sections.push('const handlers = {')

    for (const node of this.config.nodes) {
      if (node.type === 'trigger' || node.type === 'comment') continue

      const handlerCode = this.generateNodeHandler(node)
      sections.push(`  '${node.id}': ${handlerCode},`)
    }

    sections.push('};')
    sections.push('')
    sections.push('// Execute node handler')
    sections.push('async function executeNode(nodeId, ctx) {')
    sections.push('  const handler = handlers[nodeId];')
    sections.push('  if (handler) await handler(ctx);')
    sections.push('  const nextId = getNextNode(nodeId);')
    sections.push('  if (nextId) await executeNode(nextId, ctx);')
    sections.push('}')

    return sections.join('\n')
  }

  private generateNodeHandler(node: Node): string {
    const lines: string[] = []
    lines.push(`async (ctx) => {`)

    switch (node.type) {
      case 'message':
        lines.push(...this.generateMessageHandler(node.data as MessageNodeData))
        break
      case 'input':
        lines.push(...this.generateInputHandler(node))
        break
      case 'condition':
        lines.push(...this.generateConditionHandler(node))
        break
      case 'action':
        lines.push(...this.generateActionHandler(node.data as ActionNodeData))
        break
      case 'setVariable':
        lines.push(...this.generateSetVariableHandler(node.data as SetVariableNodeData))
        break
      case 'http':
        lines.push(...this.generateHttpHandler(node.data as HttpNodeData))
        break
      case 'webhook':
        lines.push(...this.generateHttpHandler(node.data as WebhookNodeData))
        break
      case 'wait':
        lines.push(...this.generateWaitHandler(node.data as WaitNodeData))
        break
      default:
        lines.push('  // Unknown node type')
    }

    lines.push('}')
    return lines.join('\n')
  }

  private normalizeParseModeValue(value: unknown): 'Markdown' | 'MarkdownV2' | 'HTML' | undefined {
    let rawValue: unknown = value

    if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      const record = rawValue as Record<string, unknown>
      rawValue =
        record.value ??
        record.mode ??
        record.parseMode ??
        record.parse_mode ??
        rawValue
    }

    if (typeof rawValue !== 'string') {
      return undefined
    }

    const normalized = rawValue.trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (!normalized || normalized === 'none' || normalized === 'plain' || normalized === 'off') {
      return undefined
    }
    if (normalized === 'markdown' || normalized === 'md') {
      return 'Markdown'
    }
    if (normalized === 'markdownv2' || normalized === 'markdown2' || normalized === 'mdv2') {
      return 'MarkdownV2'
    }
    if (normalized === 'html') {
      return 'HTML'
    }

    return undefined
  }

  private resolveParseMode(data: Record<string, unknown>): 'Markdown' | 'MarkdownV2' | 'HTML' | undefined {
    const directCandidates: unknown[] = [
      data.parseMode,
      data.parse_mode,
      data.formatting,
      data.format,
    ]

    for (const candidate of directCandidates) {
      const normalized = this.normalizeParseModeValue(candidate)
      if (normalized) {
        return normalized
      }
    }

    const nestedCandidates = [data.settings, data.options, data.formatting]
    for (const candidate of nestedCandidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        continue
      }
      const record = candidate as Record<string, unknown>
      const normalized =
        this.normalizeParseModeValue(record.parseMode) ||
        this.normalizeParseModeValue(record.parse_mode) ||
        this.normalizeParseModeValue(record.mode) ||
        this.normalizeParseModeValue(record.value)

      if (normalized) {
        return normalized
      }
    }

    return undefined
  }

  private resolveMessageAttachment(
    data: Record<string, unknown>
  ): { type: 'photo' | 'video' | 'document' | 'audio'; source: string } | undefined {
    const normalizeType = (value: unknown): 'photo' | 'video' | 'document' | 'audio' | undefined => {
      if (typeof value !== 'string') return undefined
      const normalized = value.trim().toLowerCase()
      if (
        normalized === 'photo' ||
        normalized === 'video' ||
        normalized === 'document' ||
        normalized === 'audio'
      ) {
        return normalized
      }
      return undefined
    }

    const attachments = Array.isArray(data.attachments) ? data.attachments : []
    for (const rawAttachment of attachments) {
      if (!rawAttachment || typeof rawAttachment !== 'object') continue
      const record = rawAttachment as Record<string, unknown>
      const type = normalizeType(record.type ?? record.kind ?? record.mediaType ?? record.media_type)
      if (!type) continue

      const sourceCandidate =
        record.source ??
        record.url ??
        record.media ??
        record.fileId ??
        record.file_id ??
        record.value
      const source = typeof sourceCandidate === 'string' ? sourceCandidate.trim() : ''
      if (!source) continue

      return { type, source }
    }

    return undefined
  }

  private generateMessageHandler(data: MessageNodeData): string[] {
    const lines: string[] = []

    const dataRecord = (data || {}) as unknown as Record<string, unknown>
    const keyboardSource =
      dataRecord.keyboard ?? dataRecord.inlineKeyboard ?? dataRecord.buttons
    const keyboardLiteral = keyboardSource ? JSON.stringify(keyboardSource) : ''
    const parseMode = this.resolveParseMode(dataRecord)
    const attachment = this.resolveMessageAttachment(dataRecord)
    const shouldDisablePreview = Boolean(data.disableWebPagePreview)
    const shouldDisableNotification = Boolean(data.disableNotification)

    lines.push(`  // Send message`)
    lines.push(`  const text = ${JSON.stringify(data.text || '')};`)
    lines.push(`  const message = interpolate(text, ctx);`)
    lines.push(`  const replyOptions = {};`)

    if (parseMode) {
      lines.push(`  replyOptions.parse_mode = '${parseMode}';`)
    }
    if (keyboardLiteral) {
      lines.push(`  replyOptions.reply_markup = buildKeyboard(${keyboardLiteral});`)
    }
    if (!attachment) {
      if (shouldDisablePreview) {
        lines.push(`  replyOptions.disable_web_page_preview = true;`)
        lines.push(`  replyOptions.link_preview_options = { is_disabled: true };`)
      } else {
        lines.push(`  const previewMatch = message.match(/https?:\\/\\/[^\\s)]+/i);`)
        lines.push(`  replyOptions.link_preview_options = previewMatch`)
        lines.push(`    ? { is_disabled: false, url: previewMatch[0] }`)
        lines.push(`    : { is_disabled: false };`)
      }
    }
    if (shouldDisableNotification) {
      lines.push(`  replyOptions.disable_notification = true;`)
    }

    if (attachment) {
      const methodMap: Record<'photo' | 'video' | 'document' | 'audio', string> = {
        photo: 'replyWithPhoto',
        video: 'replyWithVideo',
        document: 'replyWithDocument',
        audio: 'replyWithAudio',
      }
      const telegrafMethod = methodMap[attachment.type]

      lines.push(`  const mediaSourceTemplate = ${JSON.stringify(attachment.source)};`)
      lines.push(`  const mediaSource = interpolate(mediaSourceTemplate, ctx);`)
      lines.push(`  const mediaInput = resolveMediaInput(mediaSource);`)
      lines.push(`  if (message) {`)
      lines.push(`    replyOptions.caption = message;`)
      lines.push(`  }`)
      lines.push(`  if (Object.keys(replyOptions).length > 0) {`)
      lines.push(`    await ctx.${telegrafMethod}(mediaInput, replyOptions);`)
      lines.push(`  } else {`)
      lines.push(`    await ctx.${telegrafMethod}(mediaInput);`)
      lines.push(`  }`)
    } else {
      lines.push(`  if (Object.keys(replyOptions).length > 0) {`)
      lines.push(`    await ctx.reply(message, replyOptions);`)
      lines.push(`  } else {`)
      lines.push(`    await ctx.reply(message);`)
      lines.push(`  }`)
    }

    return lines
  }

  private generateInputHandler(node: Node): string[] {
    const data = node.data as InputNodeData
    const lines: string[] = []
    const dataRecord = (data || {}) as unknown as Record<string, unknown>
    const keyboardSource =
      dataRecord.keyboard ?? dataRecord.inlineKeyboard ?? dataRecord.buttons
    const keyboardLiteral = keyboardSource ? JSON.stringify(keyboardSource) : ''
    const parseMode = this.resolveParseMode(dataRecord)

    lines.push(`  // Input: ${data.variableName}`)
    lines.push(`  ctx.session.waitingForInput = '${node.id}';`)
    lines.push(`  const question = ${JSON.stringify(data.question || '')};`)
    lines.push(`  const questionText = interpolate(question, ctx);`)
    lines.push(`  const replyOptions = {};`)

    if (parseMode) {
      lines.push(`  replyOptions.parse_mode = '${parseMode}';`)
    }
    if (keyboardLiteral) {
      lines.push(`  replyOptions.reply_markup = buildKeyboard(${keyboardLiteral});`)
    }

    lines.push(`  const previewMatch = questionText.match(/https?:\\/\\/[^\\s)]+/i);`)
    lines.push(`  replyOptions.link_preview_options = previewMatch`)
    lines.push(`    ? { is_disabled: false, url: previewMatch[0] }`)
    lines.push(`    : { is_disabled: false };`)

    lines.push(`  if (Object.keys(replyOptions).length > 0) {`)
    lines.push(`    await ctx.reply(questionText, replyOptions);`)
    lines.push(`  } else {`)
    lines.push(`    await ctx.reply(questionText);`)
    lines.push(`  }`)

    // Wait for user response (separate handler)
    lines.push(`  // Response will be handled by the input listener`)

    return lines
  }

  private generateConditionHandler(node: Node): string[] {
    const data = node.data as ConditionNodeData
    const lines: string[] = []

    // Find outgoing edges (true and false branches)
    const trueEdge = this.config.edges.find(e => e.source === node.id && e.sourceHandle === 'true')
    const falseEdge = this.config.edges.find(e => e.source === node.id && e.sourceHandle === 'false')
    const defaultEdge = this.config.edges.find(e => e.source === node.id && !e.sourceHandle)

    lines.push(`  // Condition: ${data.variable} ${data.operator} ${data.value}`)
    lines.push(`  const value = ctx.session.${data.variable} || ctx.${data.variable};`)
    lines.push(`  const condition = `)

    // Generate condition check
    switch (data.operator) {
      case 'equals':
        lines.push(`    value === ${JSON.stringify(data.value)};`)
        break
      case 'notEquals':
        lines.push(`    value !== ${JSON.stringify(data.value)};`)
        break
      case 'contains':
        lines.push(`    String(value).includes(${JSON.stringify(String(data.value))});`)
        break
      case 'gt':
        lines.push(`    Number(value) > ${Number(data.value)};`)
        break
      case 'lt':
        lines.push(`    Number(value) < ${Number(data.value)};`)
        break
      default:
        lines.push(`    value == ${JSON.stringify(data.value)};`)
    }

    lines.push(`  if (condition) {`)
    if (trueEdge) {
      lines.push(`    await executeNode('${trueEdge.target}', ctx);`)
    } else if (defaultEdge) {
      lines.push(`    await executeNode('${defaultEdge.target}', ctx);`)
    }
    lines.push(`  } else {`)
    if (falseEdge) {
      lines.push(`    await executeNode('${falseEdge.target}', ctx);`)
    } else if (defaultEdge) {
      lines.push(`    await executeNode('${defaultEdge.target}', ctx);`)
    }
    lines.push(`  }`)

    return lines
  }

  private generateActionHandler(data: ActionNodeData): string[] {
    const lines: string[] = []

    if (!data.action) return lines

    lines.push(`  // Action: ${data.action.type}`)

    switch (data.action.type) {
      case 'setVariable': {
        lines.push(`  ctx.session.${data.action.variableName} = ${JSON.stringify(data.action.value)};`)
        break
      }
      case 'delay': {
        lines.push(`  await new Promise(resolve => setTimeout(resolve, ${data.action.duration || 1000}));`)
        break
      }
      case 'deleteMessage': {
        lines.push(`  await ctx.deleteMessage();`)
        if (data.action.delay) {
          lines.push(`  await new Promise(resolve => setTimeout(resolve, ${data.action.delay}));`)
        }
        break
      }
      // Legacy compatibility: old Action nodes may still contain HTTP request config.
      case 'httpRequest': {
        lines.push(`  try {`)
        lines.push(`    const response = await axios({`)
        lines.push(`      method: '${data.action.method || 'GET'}',`)
        lines.push(`      url: ${JSON.stringify(data.action.url || '')},`)
        lines.push(`      headers: ${JSON.stringify(data.action.headers || {})},`)
        if (data.action.body) {
          lines.push(`      data: ${JSON.stringify(data.action.body)},`)
        }
        lines.push(`    });`)
        if (data.action.saveToVariable) {
          lines.push(`    ctx.session.${data.action.saveToVariable} = response.data;`)
        }
        lines.push(`  } catch (error) {`)
        lines.push(`    console.error('Legacy action HTTP request failed:', error);`)
        lines.push(`  }`)
        break
      }
    }

    return lines
  }

  private generateSetVariableHandler(data: SetVariableNodeData): string[] {
    const variableName = String(data.variableName || '').trim()
    if (!variableName) return []

    return [
      `  // Set variable: ${variableName}`,
      `  ctx.session.${variableName} = ${JSON.stringify(data.value ?? '')};`,
    ]
  }

  private generateHttpHandler(data: HttpNodeData | WebhookNodeData): string[] {
    const lines: string[] = []

    lines.push(`  // HTTP call to ${data.url}`)
    lines.push(`  try {`)
    lines.push(`    const response = await axios({`)
    lines.push(`      method: '${data.method}',`)
    lines.push(`      url: interpolate('${data.url}', ctx),`)
    if (data.headers) {
      lines.push(`      headers: ${JSON.stringify(data.headers)},`)
    }
    if (data.body && ['POST', 'PUT', 'PATCH'].includes(data.method)) {
      lines.push(`      data: ${JSON.stringify(data.body)},`)
    }
    lines.push(`    });`)
    if (data.saveToVariable) {
      lines.push(`    ctx.session.${data.saveToVariable} = response.data;`)
    }
    lines.push(`  } catch (error) {`)
    lines.push(`    console.error('HTTP node error:', error);`)
    lines.push(`  }`)

    return lines
  }

  private generateWaitHandler(data: WaitNodeData): string[] {
    const lines: string[] = []

    lines.push(`  // Wait for: ${data.waitFor}`)
    lines.push(`  ctx.session.waitingFor = '${data.waitFor}';`)
    lines.push(`  ctx.session.waitTimeout = ${data.timeout || 300000};`)
    lines.push(`  if (ctx.session.waitTimeout) {`)
    lines.push(`    ctx.session.waitTimer = setTimeout(() => {`)
    lines.push(`      // Handle timeout`)
    if (data.onTimeout) {
      lines.push(`      executeNode('${data.onTimeout}', ctx);`)
    }
    lines.push(`    }, ctx.session.waitTimeout);`)
    lines.push(`  }`)

    return lines
  }

  private generateNodeCall(node: Node, contextVar = 'ctx'): string {
    return `  await executeNode('${node.id}', ${contextVar});`
  }

  private generateLaunch(): string {
    let launch = ''

    if (this.options.webhookUrl) {
      launch += `// Webhook mode\n`
      launch += `bot.webhookCallback = '/webhook';\n`
      launch += `module.exports = bot;\n`
    } else {
      launch += `// Polling mode\n`
      launch += `bot.launch();\n`
      launch += `\n`
      launch += `// Graceful shutdown\n`
      launch += `process.once('SIGINT', () => bot.stop('SIGINT'));\n`
      launch += `process.once('SIGTERM', () => bot.stop('SIGTERM'));\n`
    }

    return launch
  }
}

/**
 * Generate bot code from config
 */
export function generateBotCode(
  config: BotConfig,
  metadata?: BotMetadata,
  options?: Partial<GeneratorOptions>
): string {
  const generator = new BotCodeGenerator(config, metadata, options)
  return generator.generate()
}

/**
 * Generate package.json for the bot
 */
export function generatePackageJson(): string {
  return JSON.stringify(
    {
      name: 'telegram-bot',
      version: '1.0.0',
      description: 'Generated Telegram Bot',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'nodemon index.js',
      },
      dependencies: {
        telegraf: '^4.16.3',
        axios: '^1.6.0',
        '@telegraf/session': '^2.0.0',
      },
      devDependencies: {
        nodemon: '^3.0.0',
      },
    },
    null,
    2
  )
}

/**
 * Generate .env template
 */
export function generateEnvTemplate(): string {
  return `# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# Optional: Webhook URL (if using webhook mode)
WEBHOOK_URL=https://your-domain.com/webhook
`
}

/**
 * Generate Python runtime bot code (workflow interpreter).
 */
export function generatePythonBotCode(): string {
  return `#!/usr/bin/env python3
import os
import re
import json
import time
import random
import asyncio
import hashlib
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton, LinkPreviewOptions, ForceReply, LabeledPrice
from telegram.constants import ParseMode
from telegram.ext import Application, CallbackQueryHandler, ContextTypes, MessageHandler, filters

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WORKFLOW_PATH = Path(__file__).resolve().parent / "workflow.json"

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is required in .env")

if not WORKFLOW_PATH.exists():
    raise RuntimeError("workflow.json is missing near main.py")

with WORKFLOW_PATH.open("r", encoding="utf-8") as f:
    WORKFLOW = json.load(f)

NODES = {str(node.get("id")): node for node in WORKFLOW.get("nodes", []) if node.get("id")}
EDGES = [edge for edge in WORKFLOW.get("edges", []) if edge.get("source") and edge.get("target")]

OUTGOING: Dict[str, list] = {}
for edge in EDGES:
    source_id = str(edge.get("source"))
    OUTGOING.setdefault(source_id, []).append(edge)

TRIGGER_NODES = [node for node in WORKFLOW.get("nodes", []) if node.get("type") == "trigger"]
SESSIONS: Dict[int, Dict[str, Any]] = {}


def get_session(chat_id: int) -> Dict[str, Any]:
    session = SESSIONS.get(chat_id)
    if session is None:
        session = {"variables": {}, "waiting": None}
        SESSIONS[chat_id] = session
    return session


def parse_mode_from_value(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("_", "").replace("-", "").replace(" ", "")
    if normalized in ("", "none", "plain", "off"):
        return None
    if normalized in ("markdown", "md"):
        return ParseMode.MARKDOWN
    if normalized in ("markdownv2", "markdown2", "mdv2"):
        return ParseMode.MARKDOWN_V2
    if normalized == "html":
        return ParseMode.HTML
    return None


def resolve_parse_mode(data: Dict[str, Any]) -> Optional[str]:
    direct = [
        data.get("parseMode"),
        data.get("parse_mode"),
        data.get("formatting"),
        data.get("format"),
    ]
    for candidate in direct:
        mode = parse_mode_from_value(candidate)
        if mode:
            return mode

    for nested in [data.get("settings"), data.get("options"), data.get("formatting")]:
        if isinstance(nested, dict):
            mode = (
                parse_mode_from_value(nested.get("parseMode"))
                or parse_mode_from_value(nested.get("parse_mode"))
                or parse_mode_from_value(nested.get("mode"))
                or parse_mode_from_value(nested.get("value"))
            )
            if mode:
                return mode
    return None


def resolve_path(obj: Any, path: str) -> Any:
    if not path:
        return None
    current = obj
    for key in str(path).split("."):
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
        if current is None:
            return None
    return current


def set_path(obj: Dict[str, Any], path: str, value: Any) -> None:
    keys = str(path).split(".")
    if not keys:
        return
    cursor = obj
    for key in keys[:-1]:
        next_value = cursor.get(key)
        if not isinstance(next_value, dict):
            next_value = {}
            cursor[key] = next_value
        cursor = next_value
    cursor[keys[-1]] = value


def interpolate(text: Any, variables: Dict[str, Any]) -> str:
    if text is None:
        return ""
    raw = str(text)

    def replace(match: re.Match) -> str:
        variable_path = match.group(1).strip()
        value = resolve_path(variables, variable_path)
        if value is None:
            return match.group(0)
        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)
        return str(value)

    return re.sub(r"\\{\\{([^}]+)\\}\\}", replace, raw)


def to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes", "on"):
            return True
        if normalized in ("false", "0", "no", "off"):
            return False
    return default


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return default


def get_default_next_node_id(node_id: str) -> Optional[str]:
    edges = OUTGOING.get(node_id, [])
    if not edges:
        return None
    for edge in edges:
        if not edge.get("sourceHandle"):
            return str(edge.get("target"))
    return str(edges[0].get("target"))


def get_next_node_id_by_handle(node_id: str, handle: str) -> Optional[str]:
    edges = OUTGOING.get(node_id, [])
    if not edges:
        return None
    for edge in edges:
        if str(edge.get("sourceHandle") or "") == handle:
            return str(edge.get("target"))
    return None


def normalize_trigger_type(value: Any) -> str:
    raw = str(value or "command").strip().lower()
    if raw in ("command", "text", "callbackquery", "photo", "any", "schedule"):
        return raw
    return "command"


def normalize_rows(source: Any) -> list:
    if isinstance(source, list):
        if source and isinstance(source[0], list):
            return source
        return [source]
    if isinstance(source, dict):
        rows = source.get("rows")
        if isinstance(rows, list):
            result = []
            for row in rows:
                if isinstance(row, dict) and isinstance(row.get("buttons"), list):
                    result.append(row.get("buttons"))
                elif isinstance(row, list):
                    result.append(row)
            return result
        inline = source.get("inline_keyboard")
        if isinstance(inline, list):
            return inline
        buttons = source.get("buttons")
        if isinstance(buttons, list):
            return [buttons]
    return []


def build_inline_keyboard(keyboard_data: Any) -> Optional[InlineKeyboardMarkup]:
    if not keyboard_data:
        return None

    rows = normalize_rows(keyboard_data)
    if not rows:
        return None

    prepared_rows = []
    for row_index, row in enumerate(rows):
        if not isinstance(row, list):
            continue
        prepared_buttons = []
        for button_index, raw_button in enumerate(row):
            if isinstance(raw_button, dict):
                btn = raw_button
            else:
                raw_text = str(raw_button or "").strip()
                btn = {"text": raw_text, "callbackData": raw_text}

            text = str(btn.get("text") or btn.get("label") or btn.get("title") or "").strip()
            if not text:
                continue

            callback_raw = str(
                btn.get("callbackData")
                or btn.get("callback_data")
                or btn.get("data")
                or btn.get("action")
                or btn.get("value")
                or ""
            ).strip()
            action_type = str(btn.get("actionType") or btn.get("kind") or btn.get("type") or "").strip().lower()
            pay_stars = bool(btn.get("payStars")) or action_type in ("stars", "starspay", "stars_pay")
            url_raw = str(
                btn.get("url")
                or (btn.get("starsUrl") if pay_stars else "")
                or (btn.get("paymentUrl") if pay_stars else "")
                or (btn.get("payment_url") if pay_stars else "")
                or ""
            ).strip()

            should_use_url = pay_stars or action_type == "url" or (not action_type and bool(url_raw))
            if should_use_url and re.match(r"^(https?://|tg://|mailto:|tel:)", url_raw, flags=re.IGNORECASE):
                prepared_buttons.append(InlineKeyboardButton(text=text, url=url_raw))
                continue

            fallback_noop = f"__noop__:{row_index + 1}:{button_index + 1}"
            callback_data = (callback_raw or fallback_noop)[:64]
            if not callback_data:
                continue

            prepared_buttons.append(InlineKeyboardButton(text=text, callback_data=callback_data))

        if prepared_buttons:
            prepared_rows.append(prepared_buttons)

    if not prepared_rows:
        return None
    return InlineKeyboardMarkup(prepared_rows)


def evaluate_condition(operator: str, left_value: Any, right_value: Any) -> bool:
    op = str(operator or "equals")
    left_text = "" if left_value is None else str(left_value)
    right_text = "" if right_value is None else str(right_value)

    if op == "equals":
        return left_text == right_text
    if op == "notEquals":
        return left_text != right_text
    if op == "contains":
        return right_text.lower() in left_text.lower()
    if op == "notContains":
        return right_text.lower() not in left_text.lower()
    if op == "gt":
        return to_float(left_value, 0) > to_float(right_value, 0)
    if op == "lt":
        return to_float(left_value, 0) < to_float(right_value, 0)
    if op == "gte":
        return to_float(left_value, 0) >= to_float(right_value, 0)
    if op == "lte":
        return to_float(left_value, 0) <= to_float(right_value, 0)
    if op == "isEmpty":
        return left_value is None or str(left_value).strip() == ""
    if op == "isNotEmpty":
        return left_value is not None and str(left_value).strip() != ""
    return left_text == right_text


def get_runtime_variables(update: Update, session: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    runtime: Dict[str, Any] = {}
    runtime.update(session.get("variables") or {})

    user = update.effective_user
    chat = update.effective_chat
    message = update.effective_message
    callback = update.callback_query

    runtime["user"] = {
        "id": getattr(user, "id", None),
        "username": getattr(user, "username", None),
        "firstName": getattr(user, "first_name", None),
        "lastName": getattr(user, "last_name", None),
        "languageCode": getattr(user, "language_code", None),
    }
    runtime["chat"] = {"id": getattr(chat, "id", None)}
    runtime["message"] = {
        "messageId": getattr(message, "message_id", None),
        "text": getattr(message, "text", None),
        "caption": getattr(message, "caption", None),
    }
    runtime["callback"] = {
        "id": getattr(callback, "id", None) if callback else None,
        "data": getattr(callback, "data", None) if callback else None,
    }
    if extra:
        runtime.update(extra)
    return runtime


def resolve_media_input(source: str) -> Any:
    value = str(source or "").strip()
    if not value:
        return value
    if re.match(r"^(https?://|tg://)", value, flags=re.IGNORECASE):
        return value
    if value.startswith("~/"):
        value = str(Path.home() / value[2:])
    local_path = Path(value)
    if not local_path.is_absolute():
        local_path = (Path.cwd() / value).resolve()
    if local_path.exists() and local_path.is_file():
        return local_path.open("rb")
    return value


async def safe_send_text(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    text: str,
    parse_mode: Optional[str],
    reply_markup: Optional[InlineKeyboardMarkup],
    disable_preview: bool,
    disable_notification: bool,
) -> None:
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": text or "...",
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup
    if disable_preview:
        payload["link_preview_options"] = LinkPreviewOptions(is_disabled=True)
    if disable_notification:
        payload["disable_notification"] = True

    try:
        await context.bot.send_message(**payload)
    except Exception:
        payload.pop("parse_mode", None)
        await context.bot.send_message(**payload)


def normalize_header_pairs(value: Any, runtime_variables: Dict[str, Any]) -> Dict[str, str]:
    if isinstance(value, dict):
        return {str(k): interpolate(v, runtime_variables) for k, v in value.items()}
    if isinstance(value, list):
        result: Dict[str, str] = {}
        for item in value:
            if isinstance(item, dict):
                key = str(item.get("key") or "").strip()
                if not key:
                    continue
                result[key] = interpolate(item.get("value") or "", runtime_variables)
        return result
    return {}


def normalize_query_pairs(value: Any, runtime_variables: Dict[str, Any]) -> Dict[str, str]:
    if isinstance(value, list):
        result: Dict[str, str] = {}
        for item in value:
            if isinstance(item, dict):
                key = str(item.get("key") or "").strip()
                if not key:
                    continue
                result[key] = interpolate(item.get("value") or "", runtime_variables)
        return result
    if isinstance(value, dict):
        return {str(k): interpolate(v, runtime_variables) for k, v in value.items()}
    return {}


def execute_http_request(data: Dict[str, Any], runtime_variables: Dict[str, Any]) -> Any:
    method = str(data.get("method") or "GET").upper()
    url = interpolate(data.get("url") or "", runtime_variables).strip()
    if not url:
        raise RuntimeError("HTTP node: url is empty")

    headers = normalize_header_pairs(data.get("headers"), runtime_variables)
    params = normalize_query_pairs(data.get("queryParams"), runtime_variables)
    timeout_ms = int(to_float(data.get("timeout"), 30000))
    timeout_seconds = max(1.0, timeout_ms / 1000.0)

    body_type = str(data.get("bodyType") or "none")
    body = data.get("body")
    payload = None
    data_payload = None

    if method in ("POST", "PUT", "PATCH"):
        if body_type == "json":
            if isinstance(body, str):
                rendered = interpolate(body, runtime_variables)
                try:
                    payload = json.loads(rendered) if rendered.strip() else {}
                except Exception:
                    payload = {"value": rendered}
            else:
                payload = body
        elif body_type in ("raw", "form"):
            data_payload = interpolate(body or "", runtime_variables)

    response = requests.request(
        method=method,
        url=url,
        headers=headers or None,
        params=params or None,
        json=payload,
        data=data_payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    content_type = str(response.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        return response.json()
    return response.text


def create_robokassa_payment_link(data: Dict[str, Any], runtime_variables: Dict[str, Any]) -> Dict[str, Any]:
    merchant_login = interpolate(data.get("merchantLogin") or "", runtime_variables).strip()
    password1 = interpolate(data.get("password1") or "", runtime_variables).strip()
    amount = interpolate(data.get("amount") or "100.00", runtime_variables).strip() or "100.00"
    invoice_id = interpolate(data.get("invoiceId") or "", runtime_variables).strip() or str(int(time.time() * 1000))
    description = interpolate(data.get("description") or "", runtime_variables).strip()
    currency = (interpolate(data.get("currency") or "RUB", runtime_variables).strip() or "RUB").upper()
    is_test = to_bool(data.get("isTest"), False)

    sign_source = f"{merchant_login}:{amount}:{invoice_id}:{password1}"
    signature = hashlib.md5(sign_source.encode("utf-8")).hexdigest()

    params = {
        "MerchantLogin": merchant_login,
        "OutSum": amount,
        "InvId": invoice_id,
        "Description": description,
        "SignatureValue": signature,
        "Culture": "ru",
    }
    if currency:
        params["IncCurrLabel"] = currency
    if is_test:
        params["IsTest"] = "1"

    from urllib.parse import urlencode
    url = "https://auth.robokassa.ru/Merchant/Index.aspx?" + urlencode(params)
    return {
        "provider": "robokassa",
        "paymentId": invoice_id,
        "status": "pending",
        "url": url,
        "amount": amount,
        "currency": currency,
    }


def create_yookassa_payment(data: Dict[str, Any], runtime_variables: Dict[str, Any]) -> Dict[str, Any]:
    shop_id = interpolate(data.get("shopId") or "", runtime_variables).strip()
    secret_key = interpolate(data.get("secretKey") or "", runtime_variables).strip()
    if not shop_id or not secret_key:
        raise RuntimeError("YooKassa: shopId/secretKey is required")

    amount = interpolate(data.get("amount") or "100.00", runtime_variables).strip() or "100.00"
    currency = (interpolate(data.get("currency") or "RUB", runtime_variables).strip() or "RUB").upper()
    description = interpolate(data.get("description") or "", runtime_variables).strip()
    return_url = interpolate(data.get("returnUrl") or "https://t.me", runtime_variables).strip() or "https://t.me"
    capture = to_bool(data.get("capture"), True)

    payload = {
        "amount": {"value": amount, "currency": currency},
        "capture": capture,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": description,
    }

    response = requests.post(
        "https://api.yookassa.ru/v3/payments",
        auth=(shop_id, secret_key),
        headers={"Idempotence-Key": str(uuid.uuid4())},
        json=payload,
        timeout=20,
    )
    response.raise_for_status()
    body = response.json()

    confirmation = body.get("confirmation") if isinstance(body, dict) else {}
    confirmation_url = confirmation.get("confirmation_url") if isinstance(confirmation, dict) else ""

    return {
        "provider": "yookassa",
        "paymentId": str(body.get("id") or ""),
        "status": str(body.get("status") or "pending"),
        "url": str(confirmation_url or ""),
        "amount": amount,
        "currency": currency,
        "raw": body,
    }


def create_stripe_payment(data: Dict[str, Any], runtime_variables: Dict[str, Any]) -> Dict[str, Any]:
    secret_key = interpolate(data.get("secretKey") or "", runtime_variables).strip()
    if not secret_key:
        raise RuntimeError("Stripe: secretKey is required")

    amount_value = to_float(interpolate(data.get("amount") or "100.00", runtime_variables), 100.0)
    amount_cents = max(1, int(round(amount_value * 100)))
    currency = (interpolate(data.get("currency") or "usd", runtime_variables).strip() or "usd").lower()
    product_name = interpolate(data.get("productName") or "Order payment", runtime_variables).strip() or "Order payment"
    description = interpolate(data.get("description") or "", runtime_variables).strip()
    success_url = interpolate(data.get("successUrl") or "https://t.me", runtime_variables).strip() or "https://t.me"
    cancel_url = interpolate(data.get("cancelUrl") or "https://t.me", runtime_variables).strip() or "https://t.me"

    form = {
        "mode": "payment",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items[0][price_data][currency]": currency,
        "line_items[0][price_data][unit_amount]": str(amount_cents),
        "line_items[0][price_data][product_data][name]": product_name[:120],
        "line_items[0][quantity]": "1",
    }
    if description:
        form["payment_intent_data[description]"] = description[:500]

    response = requests.post(
        "https://api.stripe.com/v1/checkout/sessions",
        headers={"Authorization": f"Bearer {secret_key}"},
        data=form,
        timeout=20,
    )
    response.raise_for_status()
    body = response.json()
    checkout_url = str(body.get("url") or "")
    if not checkout_url:
        raise RuntimeError("Stripe: checkout URL missing")

    return {
        "provider": "stripe",
        "paymentId": str(body.get("id") or ""),
        "status": str(body.get("status") or "open"),
        "url": checkout_url,
        "amount": f"{amount_value:.2f}",
        "currency": currency.upper(),
        "raw": body,
    }


async def create_telegram_stars_payment(
    data: Dict[str, Any],
    runtime_variables: Dict[str, Any],
    context: ContextTypes.DEFAULT_TYPE,
) -> Dict[str, Any]:
    amount_stars = max(1, int(round(to_float(interpolate(data.get("amount") or "100", runtime_variables), 100))))
    title = interpolate(data.get("title") or "Telegram Stars payment", runtime_variables).strip() or "Telegram Stars payment"
    description = interpolate(data.get("description") or "Telegram Stars payment", runtime_variables).strip() or "Telegram Stars payment"
    payload = interpolate(data.get("payload") or "", runtime_variables).strip() or f"stars_{int(time.time())}_{uuid.uuid4().hex[:8]}"

    url = await context.bot.create_invoice_link(
        title=title[:32],
        description=description[:255],
        payload=payload,
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(label=title[:32], amount=amount_stars)],
    )

    return {
        "provider": "telegram_stars",
        "paymentId": payload,
        "status": "pending",
        "url": str(url or ""),
        "amount": str(amount_stars),
        "currency": "XTR",
    }


async def execute_payment_node(
    node: Dict[str, Any],
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    session: Dict[str, Any],
    runtime_variables: Dict[str, Any],
) -> Optional[str]:
    data = (node.get("data") or {}) if isinstance(node.get("data"), dict) else {}
    node_type = str(node.get("type") or "")
    result: Dict[str, Any]

    try:
        if node_type == "paymentYookassa":
            result = create_yookassa_payment(data, runtime_variables)
        elif node_type == "paymentStripe":
            result = create_stripe_payment(data, runtime_variables)
        elif node_type == "paymentRobokassa":
            result = create_robokassa_payment_link(data, runtime_variables)
        elif node_type == "paymentStars":
            result = await create_telegram_stars_payment(data, runtime_variables, context)
        else:
            raise RuntimeError(f"Unsupported payment node type: {node_type}")
    except Exception as error:
        result = {
            "provider": node_type,
            "paymentId": str(int(time.time() * 1000)),
            "status": "failed",
            "url": "",
            "amount": interpolate(data.get("amount") or "", runtime_variables),
            "currency": interpolate(data.get("currency") or "", runtime_variables),
            "error": str(error),
        }

    save_to_variable = str(data.get("saveToVariable") or "").strip()
    if save_to_variable:
        set_path(session["variables"], save_to_variable, result)

    if to_bool(data.get("autoSendPaymentLink"), True):
        message_template = str(data.get("messageTemplate") or "").strip()
        if not message_template:
            message_template = "Оплатите заказ: {{payment.url}}"
        message_text = interpolate(message_template, {**runtime_variables, "payment": result})
        chat_id = update.effective_chat.id if update.effective_chat else None
        if chat_id:
            await safe_send_text(
                context=context,
                chat_id=chat_id,
                text=message_text,
                parse_mode=None,
                reply_markup=None,
                disable_preview=False,
                disable_notification=False,
            )

    return get_default_next_node_id(str(node.get("id")))


async def execute_node_chain(
    start_node_id: Optional[str],
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    session: Dict[str, Any],
) -> None:
    current_node_id = start_node_id
    safety_limit = 200

    while current_node_id and safety_limit > 0:
        safety_limit -= 1
        node = NODES.get(str(current_node_id))
        if not node:
            return

        node_id = str(node.get("id"))
        node_type = str(node.get("type") or "")
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        runtime_variables = get_runtime_variables(update, session)

        if node_type == "comment":
            current_node_id = get_default_next_node_id(node_id)
            continue

        if node_type == "message":
            chat = update.effective_chat
            if not chat:
                return
            text_template = data.get("text") or ""
            message_text = interpolate(text_template, runtime_variables)
            parse_mode = resolve_parse_mode(data)

            keyboard_data = data.get("keyboard") or data.get("inlineKeyboard") or data.get("buttons")
            reply_markup = build_inline_keyboard(keyboard_data)

            disable_preview = to_bool(data.get("disableWebPagePreview"), False)
            disable_notification = to_bool(data.get("disableNotification"), False)

            attachment = None
            attachments = data.get("attachments")
            if isinstance(attachments, list):
                for item in attachments:
                    if not isinstance(item, dict):
                        continue
                    attachment_type = str(item.get("type") or "").strip().lower()
                    attachment_source = str(item.get("source") or "").strip()
                    if attachment_type in ("photo", "video", "document", "audio") and attachment_source:
                        attachment = (attachment_type, attachment_source)
                        break

            if attachment:
                kind, source_template = attachment
                source = interpolate(source_template, runtime_variables)
                media_input = resolve_media_input(source)
                send_kwargs: Dict[str, Any] = {"chat_id": chat.id}
                if parse_mode:
                    send_kwargs["parse_mode"] = parse_mode
                if reply_markup:
                    send_kwargs["reply_markup"] = reply_markup
                if disable_notification:
                    send_kwargs["disable_notification"] = True
                if message_text:
                    send_kwargs["caption"] = message_text

                try:
                    if kind == "photo":
                        await context.bot.send_photo(photo=media_input, **send_kwargs)
                    elif kind == "video":
                        await context.bot.send_video(video=media_input, **send_kwargs)
                    elif kind == "document":
                        await context.bot.send_document(document=media_input, **send_kwargs)
                    elif kind == "audio":
                        await context.bot.send_audio(audio=media_input, **send_kwargs)
                finally:
                    if hasattr(media_input, "close"):
                        try:
                            media_input.close()
                        except Exception:
                            pass
            else:
                await safe_send_text(
                    context=context,
                    chat_id=chat.id,
                    text=message_text,
                    parse_mode=parse_mode,
                    reply_markup=reply_markup,
                    disable_preview=disable_preview,
                    disable_notification=disable_notification,
                )

            current_node_id = get_default_next_node_id(node_id)
            continue

        if node_type == "input":
            chat = update.effective_chat
            if not chat:
                return
            question = interpolate(data.get("question") or "", runtime_variables)
            parse_mode = resolve_parse_mode(data)
            keyboard_data = data.get("keyboard") or data.get("inlineKeyboard") or data.get("buttons")
            reply_markup = build_inline_keyboard(keyboard_data)

            skip_enabled = to_bool(data.get("skipButton"), False)
            if skip_enabled:
                skip_text = "Пропустить"
                reply_markup = InlineKeyboardMarkup(
                    [[InlineKeyboardButton(skip_text, callback_data=f"__skip__:{node_id}")]]
                )

            force_reply = to_bool(data.get("forceReply"), False)
            if force_reply:
                reply_markup = ForceReply(selective=True)

            await safe_send_text(
                context=context,
                chat_id=chat.id,
                text=question,
                parse_mode=parse_mode,
                reply_markup=reply_markup,
                disable_preview=False,
                disable_notification=False,
            )

            session["waiting"] = {
                "nodeId": node_id,
                "variableName": str(data.get("variableName") or "").strip(),
                "skipButton": skip_enabled,
                "skipValue": data.get("skipValue"),
            }
            return

        if node_type == "condition":
            variable_name = str(data.get("variable") or "").strip()
            operator = str(data.get("operator") or "equals")
            expected = data.get("value")
            current_value = resolve_path(runtime_variables, variable_name)
            matched = evaluate_condition(operator, current_value, expected)

            if matched:
                current_node_id = get_next_node_id_by_handle(node_id, "true") or get_default_next_node_id(node_id)
            else:
                current_node_id = get_next_node_id_by_handle(node_id, "false") or get_default_next_node_id(node_id)
            continue

        if node_type == "router":
            variable_name = str(data.get("variable") or "").strip()
            operator = str(data.get("operator") or "equals")
            current_value = resolve_path(runtime_variables, variable_name)
            matched_target = None
            cases = data.get("cases")
            if isinstance(cases, list):
                for case in cases:
                    if not isinstance(case, dict):
                        continue
                    case_id = str(case.get("id") or "").strip()
                    if not case_id:
                        continue
                    if evaluate_condition(operator, current_value, case.get("value")):
                        matched_target = get_next_node_id_by_handle(node_id, f"case:{case_id}")
                        if matched_target:
                            break
            current_node_id = matched_target or get_default_next_node_id(node_id)
            continue

        if node_type == "action":
            action = data.get("action") if isinstance(data.get("action"), dict) else {}
            action_type = str(action.get("type") or "").strip()

            if action_type == "setVariable":
                variable_name = str(action.get("variableName") or "").strip()
                raw_value = action.get("value")
                next_value = interpolate(raw_value, runtime_variables) if isinstance(raw_value, str) else raw_value
                if variable_name:
                    set_path(session["variables"], variable_name, next_value)
                current_node_id = get_default_next_node_id(node_id)
                continue

            if action_type == "delay":
                duration_ms = max(0, int(to_float(action.get("duration"), 1000)))
                await asyncio.sleep(duration_ms / 1000.0)
                current_node_id = get_default_next_node_id(node_id)
                continue

            if action_type == "deleteMessage":
                try:
                    message = update.effective_message
                    if message:
                        await message.delete()
                except Exception:
                    pass
                delay_ms = max(0, int(to_float(action.get("delay"), 0)))
                if delay_ms > 0:
                    await asyncio.sleep(delay_ms / 1000.0)
                current_node_id = get_default_next_node_id(node_id)
                continue

            if action_type in ("random", "randomSplit"):
                a_percent = max(0.0, min(100.0, to_float(action.get("aPercent"), 50.0)))
                random_value = random.random() * 100.0
                selected_handle = "a" if random_value < a_percent else "b"
                save_to_variable = str(action.get("saveToVariable") or "").strip()
                if save_to_variable:
                    set_path(session["variables"], save_to_variable, selected_handle)
                current_node_id = (
                    get_next_node_id_by_handle(node_id, selected_handle)
                    or get_default_next_node_id(node_id)
                )
                continue

        if node_type == "setVariable":
            variable_name = str(data.get("variableName") or data.get("variable") or data.get("key") or "").strip()
            raw_value = data.get("value")
            next_value = interpolate(raw_value, runtime_variables) if isinstance(raw_value, str) else raw_value
            if variable_name:
                set_path(session["variables"], variable_name, next_value)
            current_node_id = get_default_next_node_id(node_id)
            continue

        if node_type in ("http", "webhook"):
            try:
                response_data = execute_http_request(data, runtime_variables)
                save_to_variable = str(data.get("saveToVariable") or "").strip()
                if save_to_variable:
                    set_path(session["variables"], save_to_variable, response_data)
            except Exception as error:
                session["variables"]["lastHttpError"] = str(error)
            current_node_id = get_default_next_node_id(node_id)
            continue

        if node_type in ("paymentYookassa", "paymentStripe", "paymentRobokassa", "paymentStars"):
            current_node_id = await execute_payment_node(
                node=node,
                update=update,
                context=context,
                session=session,
                runtime_variables=runtime_variables,
            )
            continue

        if node_type in ("wait", "scheduler", "script", "replyKeyboard"):
            # Portable export keeps these nodes as pass-through to avoid blocking flow.
            current_node_id = get_default_next_node_id(node_id)
            continue

        current_node_id = get_default_next_node_id(node_id)


def trigger_matches(trigger_node: Dict[str, Any], update: Update) -> bool:
    data = trigger_node.get("data") if isinstance(trigger_node.get("data"), dict) else {}
    trigger_type = normalize_trigger_type(data.get("trigger"))
    pattern = str(data.get("pattern") or "").strip()

    message = update.effective_message
    callback_query = update.callback_query

    if trigger_type == "callbackquery":
        callback_data = str(getattr(callback_query, "data", "") or "")
        if not callback_query:
            return False
        if not pattern:
            return True
        return callback_data == pattern

    if trigger_type == "command":
        text = str(getattr(message, "text", "") or "").strip()
        if not text.startswith("/"):
            return False
        command = text.split()[0]
        expected = pattern or "/start"
        if not expected.startswith("/"):
            expected = "/" + expected
        return command == expected

    if trigger_type == "text":
        text = str(getattr(message, "text", "") or "").strip()
        if not text:
            return False
        if not pattern:
            return True
        return text == pattern

    if trigger_type == "photo":
        return bool(getattr(message, "photo", None))

    if trigger_type == "any":
        return message is not None or callback_query is not None

    # schedule triggers are not executed by update event
    return False


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    callback = update.callback_query
    if not callback:
        return

    chat_id = callback.message.chat.id if callback.message and callback.message.chat else None
    if not chat_id:
        return
    session = get_session(chat_id)

    callback_data = str(callback.data or "")
    waiting = session.get("waiting")
    if isinstance(waiting, dict):
        waiting_node_id = str(waiting.get("nodeId") or "")
        if callback_data == f"__skip__:{waiting_node_id}":
            variable_name = str(waiting.get("variableName") or "").strip()
            if variable_name:
                set_path(session["variables"], variable_name, waiting.get("skipValue"))
            session["waiting"] = None
            await callback.answer()
            await execute_node_chain(get_default_next_node_id(waiting_node_id), update, context, session)
            return

    matched_triggers = [node for node in TRIGGER_NODES if trigger_matches(node, update)]
    if not matched_triggers:
        await callback.answer()
        return

    await callback.answer()
    for trigger in matched_triggers:
        trigger_id = str(trigger.get("id"))
        next_node_id = get_default_next_node_id(trigger_id)
        if next_node_id:
            await execute_node_chain(next_node_id, update, context, session)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    chat = update.effective_chat
    if not message or not chat:
        return

    session = get_session(chat.id)

    waiting = session.get("waiting")
    if isinstance(waiting, dict):
        message_text = str(getattr(message, "text", "") or "")
        waiting_node_id = str(waiting.get("nodeId") or "")
        variable_name = str(waiting.get("variableName") or "").strip()
        if variable_name:
            set_path(session["variables"], variable_name, message_text)
        session["waiting"] = None
        await execute_node_chain(get_default_next_node_id(waiting_node_id), update, context, session)
        return

    matched_triggers = [node for node in TRIGGER_NODES if trigger_matches(node, update)]
    if not matched_triggers:
        return

    for trigger in matched_triggers:
        trigger_id = str(trigger.get("id"))
        next_node_id = get_default_next_node_id(trigger_id)
        if next_node_id:
            await execute_node_chain(next_node_id, update, context, session)


async def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CallbackQueryHandler(handle_callback_query))
    app.add_handler(MessageHandler(filters.ALL, handle_message))

    print("Bot is starting in polling mode...")
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=False)
    print("Bot is online.")

    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
`
}

export function generatePythonRequirements(): string {
  return `python-telegram-bot==21.7
python-dotenv==1.0.1
requests==2.32.3
`
}

export function generatePythonEnvTemplate(): string {
  return `# Telegram bot token from @BotFather
BOT_TOKEN=your_telegram_bot_token_here
`
}

export function generateWorkflowJson(config: BotConfig): string {
  return JSON.stringify(config, null, 2)
}
