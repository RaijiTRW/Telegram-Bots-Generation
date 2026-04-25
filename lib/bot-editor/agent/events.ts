import 'server-only'

import type {
  AiAgentLivePreview,
  AiAgentRunSnapshot,
} from '@/lib/bot-editor/types/bot.types'

type AgentRunEvent =
  | {
      type: 'preview'
      runId: string
      preview: AiAgentLivePreview
    }
  | {
      type: 'snapshot'
      runId: string
      snapshot: AiAgentRunSnapshot | null
    }
  | {
      type: 'end'
      runId: string
    }

type AgentRunListener = (event: AgentRunEvent) => void

type AgentRunChannel = {
  preview: AiAgentLivePreview | null
  listeners: Set<AgentRunListener>
}

declare global {
  var __tflowAgentRunChannels: Map<string, AgentRunChannel> | undefined
}

const agentRunChannels =
  globalThis.__tflowAgentRunChannels || new Map<string, AgentRunChannel>()

if (!globalThis.__tflowAgentRunChannels) {
  globalThis.__tflowAgentRunChannels = agentRunChannels
}

function getChannelKey(botId: string, runId: string) {
  return `${botId}:${runId}`
}

function getOrCreateChannel(botId: string, runId: string): AgentRunChannel {
  const key = getChannelKey(botId, runId)
  const existing = agentRunChannels.get(key)
  if (existing) {
    return existing
  }

  const channel: AgentRunChannel = {
    preview: null,
    listeners: new Set<AgentRunListener>(),
  }
  agentRunChannels.set(key, channel)
  return channel
}

function emitToChannel(botId: string, runId: string, event: AgentRunEvent) {
  const channel = getOrCreateChannel(botId, runId)
  for (const listener of channel.listeners) {
    listener(event)
  }
}

export function publishAgentRunPreview(botId: string, preview: AiAgentLivePreview) {
  const channel = getOrCreateChannel(botId, preview.runId)
  channel.preview = preview
  emitToChannel(botId, preview.runId, {
    type: 'preview',
    runId: preview.runId,
    preview,
  })
}

export function publishAgentRunSnapshot(botId: string, snapshot: AiAgentRunSnapshot | null) {
  if (!snapshot?.runId) {
    return
  }

  emitToChannel(botId, snapshot.runId, {
    type: 'snapshot',
    runId: snapshot.runId,
    snapshot,
  })
}

export function clearAgentRunPreview(botId: string, runId: string) {
  const channel = getOrCreateChannel(botId, runId)
  channel.preview = null
  emitToChannel(botId, runId, {
    type: 'end',
    runId,
  })
}

export function getAgentRunPreview(botId: string, runId: string) {
  return getOrCreateChannel(botId, runId).preview
}

export function subscribeToAgentRunEvents(
  botId: string,
  runId: string,
  listener: AgentRunListener
) {
  const channel = getOrCreateChannel(botId, runId)
  channel.listeners.add(listener)

  return () => {
    const currentChannel = getOrCreateChannel(botId, runId)
    currentChannel.listeners.delete(listener)

    if (currentChannel.listeners.size === 0 && !currentChannel.preview) {
      agentRunChannels.delete(getChannelKey(botId, runId))
    }
  }
}
