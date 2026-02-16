/**
 * Bot Code Generator
 * Transforms JSON workflow (nodes + edges) into working Telegraf.js bot code
 */

import type {
  BotConfig,
  BotMetadata,
  Node,
  Edge,
  NodeType,
} from '../types/bot.types'
import type {
  MessageNodeData,
  InputNodeData,
  ConditionNodeData,
  ActionNodeData,
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
          const urlRaw = String(btn.url || '').trim();
          const fallbackNoop = NOOP_PREFIX + (toSlug(btn.id) || ('r' + (rowIndex + 1) + 'b' + (buttonIndex + 1)));

          if (urlRaw && isUrl(urlRaw)) {
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

  private generateMessageHandler(data: MessageNodeData): string[] {
    const lines: string[] = []

    const dataRecord = (data || {}) as Record<string, unknown>
    const keyboardSource =
      dataRecord.keyboard ?? dataRecord.inlineKeyboard ?? dataRecord.buttons
    const keyboardLiteral = keyboardSource ? JSON.stringify(keyboardSource) : ''

    lines.push(`  // Send message`)
    lines.push(`  const text = ${JSON.stringify(data.text || '')};`)
    lines.push(`  const message = interpolate(text, ctx);`)

    if (data.parseMode && data.parseMode !== 'None') {
      if (keyboardLiteral) {
        lines.push(
          `  await ctx.reply(message, { parse_mode: '${data.parseMode}', reply_markup: buildKeyboard(${keyboardLiteral}) });`
        )
      } else {
        lines.push(`  await ctx.reply(message, { parse_mode: '${data.parseMode}' });`)
      }
    } else {
      if (keyboardLiteral) {
        lines.push(`  await ctx.reply(message, { reply_markup: buildKeyboard(${keyboardLiteral}) });`)
      } else {
        lines.push(`  await ctx.reply(message);`)
      }
    }

    return lines
  }

  private generateInputHandler(node: Node): string[] {
    const data = node.data as InputNodeData
    const lines: string[] = []
    const dataRecord = (data || {}) as Record<string, unknown>
    const keyboardSource =
      dataRecord.keyboard ?? dataRecord.inlineKeyboard ?? dataRecord.buttons
    const keyboardLiteral = keyboardSource ? JSON.stringify(keyboardSource) : ''
    const hasParseMode = Boolean(data.parseMode && data.parseMode !== 'None')

    lines.push(`  // Input: ${data.variableName}`)
    lines.push(`  ctx.session.waitingForInput = '${node.id}';`)
    lines.push(`  const question = ${JSON.stringify(data.question || '')};`)
    lines.push(`  const questionText = interpolate(question, ctx);`)

    if (hasParseMode && keyboardLiteral) {
      lines.push(
        `  await ctx.reply(questionText, { parse_mode: '${data.parseMode}', reply_markup: buildKeyboard(${keyboardLiteral}) });`
      )
    } else if (hasParseMode) {
      lines.push(`  await ctx.reply(questionText, { parse_mode: '${data.parseMode}' });`)
    } else if (keyboardLiteral) {
      lines.push(`  await ctx.reply(questionText, { reply_markup: buildKeyboard(${keyboardLiteral}) });`)
    } else {
      lines.push(`  await ctx.reply(questionText);`)
    }

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

// Helper function for template interpolation in code generation
function interpolateCall(variable: string, template: string): string {
  return template // In real implementation, would convert {{var}} to ${var}
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
