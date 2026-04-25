import { createServerClientWrapper, getServerUser } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getBotAgentRunStatus } from '@/lib/bot-editor/agent/runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    botId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getServerUser()
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { botId } = await context.params
  const normalizedBotId = String(botId || '').trim()
  if (!normalizedBotId) {
    return Response.json({ success: false, error: 'Missing botId' }, { status: 400 })
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bot = await botService.getBot(normalizedBotId)
  if (!bot) {
    return Response.json({ success: false, error: 'Bot not found' }, { status: 404 })
  }

  const result = await getBotAgentRunStatus(normalizedBotId)
  const latestBot = await botService.getBot(normalizedBotId)

  return Response.json({
    success: true,
    snapshot: result.snapshot || null,
    config: result.config,
    metadata: latestBot?.metadata || bot.metadata,
  })
}
