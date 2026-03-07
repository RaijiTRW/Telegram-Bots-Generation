'use server'

import { getServerUser, createServerClientWrapper } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getViewerAccess } from '@/lib/billing/server'

export async function getUserBots() {
  const user = await getServerUser()

  if (!user) {
    return { success: false, bots: [], authenticated: false }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const userBots = await botService.getUserBots(user.id)
    return { success: true, bots: userBots, authenticated: true }
  } catch (error) {
    console.error('Failed to load bots:', error)
    return { success: false, bots: [], authenticated: true, error: String(error) }
  }
}

export async function createBotAction(data: { name: string; description: string }) {
  const user = await getServerUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const viewerAccess = await getViewerAccess(user.id)
    if (!viewerAccess.isAdmin && viewerAccess.usage.bots >= viewerAccess.entitlements.maxBots) {
      return {
        success: false,
        error: `Bot limit reached for the current plan (${viewerAccess.entitlements.maxBots}). Upgrade subscription or remove an existing bot.`,
      }
    }

    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const newBot = await botService.createBot({
      name: data.name,
      description: data.description,
      userId: user.id
    })

    // Create empty config
    await botService.saveBotConfig(newBot.id, {
      nodes: [],
      edges: [],
      variables: []
    })

    return { success: true, bot: newBot }
  } catch (error) {
    console.error('Failed to create bot:', error)
    return { success: false, error: String(error) }
  }
}

export async function updateBotAction(botId: string, data: { name?: string; description?: string }) {
  const user = await getServerUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    const updatedBot = await botService.updateBot(botId, data)
    return { success: true, bot: updatedBot }
  } catch (error) {
    console.error('Failed to update bot:', error)
    return { success: false, error: String(error) }
  }
}

export async function deleteBotAction(botId: string) {
  const user = await getServerUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    const supabase = await createServerClientWrapper()
    const botService = createBotService(supabase)
    await botService.deleteBot(botId)
    return { success: true }
  } catch (error) {
    console.error('Failed to delete bot:', error)
    return { success: false, error: String(error) }
  }
}
