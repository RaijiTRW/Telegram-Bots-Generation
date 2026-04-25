import { createServerClientWrapper, getServerUser } from '@/lib/supabase/server'
import { createBotService } from '@/lib/bot-editor/services/bot-service'
import { getBotAgentRunStatus } from '@/lib/bot-editor/agent/runtime'
import {
  getAgentRunPreview,
  subscribeToAgentRunEvents,
} from '@/lib/bot-editor/agent/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{
    botId: string
  }>
}

function createSseMessage(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getServerUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { botId } = await context.params
  const normalizedBotId = String(botId || '').trim()
  const runId = String(new URL(request.url).searchParams.get('runId') || '').trim()

  if (!normalizedBotId || !runId) {
    return new Response('Missing botId or runId', { status: 400 })
  }

  const supabase = await createServerClientWrapper()
  const botService = createBotService(supabase)
  const bot = await botService.getBot(normalizedBotId)
  if (!bot) {
    return new Response('Bot not found', { status: 404 })
  }

  const status = await getBotAgentRunStatus(normalizedBotId)
  const snapshot = status.snapshot?.runId === runId ? status.snapshot : null
  const preview = getAgentRunPreview(normalizedBotId, runId)

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let cleanedUp = false

      const send = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(createSseMessage(event, payload)))
      }

      send('ready', { botId: normalizedBotId, runId })

      if (snapshot) {
        send('snapshot', { snapshot })
      }

      if (preview) {
        send('preview', { preview })
      }

      let unsubscribe = () => {}
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 15000)

      const cleanup = () => {
        if (cleanedUp) {
          return
        }
        cleanedUp = true
        clearInterval(heartbeat)
        unsubscribe()
      }

      unsubscribe = subscribeToAgentRunEvents(normalizedBotId, runId, (event) => {
        switch (event.type) {
          case 'preview':
            send('preview', { preview: event.preview })
            break
          case 'snapshot':
            send('snapshot', { snapshot: event.snapshot })
            if (event.snapshot?.status && ['completed', 'failed', 'cancelled'].includes(event.snapshot.status)) {
              send('end', { runId })
              cleanup()
              controller.close()
            }
            break
          case 'end':
            send('end', { runId })
            cleanup()
            controller.close()
            break
        }
      })

      request.signal.addEventListener('abort', cleanup, { once: true })
    },
    cancel() {
      // no-op: cleanup is handled via request abort and explicit stream close
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
