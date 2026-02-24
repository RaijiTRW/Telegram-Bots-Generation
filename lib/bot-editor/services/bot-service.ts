/**
 * Bot Service
 * Handles CRUD operations for bots in Supabase
 */

import type {
  Bot,
  BotConfig,
  BotMetadata,
  BotStatus,
} from '../types/bot.types'
import type { NodeData } from '../types/component-schemas'

// Table names (adjust to your Supabase schema)
const BOTS_TABLE = 'bots'
const BOT_CONFIGS_TABLE = 'bot_configs'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateBotInput {
  name: string
  description?: string
  userId: string
}

export interface UpdateBotInput {
  name?: string
  description?: string
  status?: BotStatus
  metadata?: BotMetadata
}

export interface BotWithConfig extends Bot {
  config: BotConfig
}

// ============================================================================
// BOT SERVICE
// ============================================================================

export class BotService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Create a new bot
   */
  async createBot(input: CreateBotInput): Promise<Bot> {
    const { data, error } = await this.supabase
      .from(BOTS_TABLE)
      .insert({
        name: input.name,
        description: input.description || null,
        user_id: input.userId,
        status: 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating bot:', error)
      throw new Error(`Failed to create bot: ${error.message}`)
    }

    return this.mapBotFromDb(data)
  }

  /**
   * Get bot by ID with config
   */
  async getBot(botId: string): Promise<BotWithConfig | null> {
    const { data: botData, error: botError } = await this.supabase
      .from(BOTS_TABLE)
      .select('*')
      .eq('id', botId)
      .single()

    if (botError) {
      console.error('Error fetching bot:', botError)
      return null
    }

    const bot = this.mapBotFromDb(botData)

    // Get config
    const { data: configData, error: configError } = await this.supabase
      .from(BOT_CONFIGS_TABLE)
      .select('*')
      .eq('bot_id', botId)
      .single()

    if (configError) {
      // Return bot with empty config
      return {
        ...bot,
        config: {
          nodes: [],
          edges: [],
          variables: [],
        },
      }
    }

    return {
      ...bot,
      config: this.mapConfigFromDb(configData),
    }
  }

  /**
   * Get all bots for a user
   */
  async getUserBots(userId: string): Promise<Bot[]> {
    const { data, error } = await this.supabase
      .from(BOTS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching user bots:', error)
      return []
    }

    return data.map(this.mapBotFromDb)
  }

  /**
   * Update bot metadata
   */
  async updateBot(botId: string, input: UpdateBotInput): Promise<Bot> {
    const updateData: any = {}
    if (input.name) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.status) updateData.status = input.status
    if (input.metadata) updateData.metadata = input.metadata

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await this.supabase
      .from(BOTS_TABLE)
      .update(updateData)
      .eq('id', botId)
      .select()
      .single()

    if (error) {
      console.error('Error updating bot:', error)
      throw new Error(`Failed to update bot: ${error.message}`)
    }

    return this.mapBotFromDb(data)
  }

  /**
   * Delete bot
   */
  async deleteBot(botId: string): Promise<void> {
    const { error } = await this.supabase
      .from(BOTS_TABLE)
      .delete()
      .eq('id', botId)

    if (error) {
      console.error('Error deleting bot:', error)
      throw new Error(`Failed to delete bot: ${error.message}`)
    }
  }

  /**
   * Save bot config (nodes, edges, variables)
   */
  async saveBotConfig(botId: string, config: BotConfig): Promise<void> {
    const configData = this.mapConfigToDb(config)

    // Check if config exists
    const { data: existing } = await this.supabase
      .from(BOT_CONFIGS_TABLE)
      .select('id')
      .eq('bot_id', botId)
      .single()

    if (existing) {
      // Update
      const { error } = await this.supabase
        .from(BOT_CONFIGS_TABLE)
        .update({
          ...configData,
          updated_at: new Date().toISOString(),
        })
        .eq('bot_id', botId)

      if (error) {
        console.error('Error updating config:', error)
        throw new Error(`Failed to update config: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.supabase
        .from(BOT_CONFIGS_TABLE)
        .insert({
          bot_id: botId,
          ...configData,
        })

      if (error) {
        console.error('Error saving config:', error)
        throw new Error(`Failed to save config: ${error.message}`)
      }
    }

    // Update bot's updated_at timestamp
    await this.supabase
      .from(BOTS_TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq('id', botId)
  }

  /**
   * Duplicate bot
   */
  async duplicateBot(botId: string, userId: string): Promise<Bot> {
    const original = await this.getBot(botId)
    if (!original) {
      throw new Error('Bot not found')
    }

    const newBot = await this.createBot({
      name: `${original.name} (Copy)`,
      description: original.description || undefined,
      userId,
    })

    await this.saveBotConfig(newBot.id, original.config)

    return newBot
  }

  // ============================================================================
  // MAPPERS
  // ============================================================================

  private mapBotFromDb(data: any): Bot {
    const rawMetadata = (data.metadata && typeof data.metadata === 'object')
      ? { ...(data.metadata as Record<string, unknown>) }
      : {}

    const hasTelegramToken =
      Boolean(String(rawMetadata.telegramToken || '').trim()) ||
      Boolean(rawMetadata.hasTelegramToken)
    const hasWebhookSecret =
      Boolean(String(rawMetadata.webhookSecret || '').trim()) ||
      Boolean(rawMetadata.hasWebhookSecret)

    delete rawMetadata.telegramToken
    delete rawMetadata.webhookSecret

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status,
      config: {
        nodes: [],
        edges: [],
        variables: [],
      },
      metadata: {
        ...rawMetadata,
        hasTelegramToken,
        hasWebhookSecret,
      },
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  private mapConfigFromDb(data: any): BotConfig {
    return {
      nodes: data.nodes || [],
      edges: data.edges || [],
      variables: data.variables || [],
      version: data.version,
    }
  }

  private mapConfigToDb(config: BotConfig): any {
    return {
      nodes: config.nodes,
      edges: config.edges,
      variables: config.variables,
      version: config.version || '1.0.0',
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create bot service instance
 */
export function createBotService(supabaseClient: any): BotService {
  return new BotService(supabaseClient)
}

/**
 * Generate a unique bot ID
 */
export function generateBotId(): string {
  return `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate bot config
 */
export function validateBotConfig(config: BotConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check for trigger nodes
  const triggerNodes = config.nodes.filter(n => n.type === 'trigger')
  if (triggerNodes.length === 0) {
    errors.push('Bot must have at least one trigger node')
  }

  // Check for disconnected nodes
  const nodeIds = new Set(config.nodes.map(n => n.id))
  const connectedNodeIds = new Set([
    ...triggerNodes.map(n => n.id),
    ...config.edges.map(e => e.target),
  ])

  for (const node of config.nodes) {
    if (node.type !== 'trigger' && !connectedNodeIds.has(node.id)) {
      errors.push(`Node "${node.id}" is disconnected from the workflow`)
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    recursionStack.add(nodeId)

    const outgoingEdges = config.edges.filter(e => e.source === nodeId)
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.target)) return true
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const node of config.nodes) {
    if (hasCycle(node.id)) {
      errors.push('Workflow contains circular dependencies')
      break
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
