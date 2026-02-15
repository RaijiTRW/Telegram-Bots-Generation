'use client'

import { useState } from 'react'
import { Zap, Bell, MessageCircle, MousePointer2, Settings as SettingsIcon, Check, ChevronRight, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as React from 'react'
import { useBotState } from '../providers/bot-state-provider'

export interface BotTrigger {
  id: string
  type: 'on_bot_start' | 'on_message' | 'on_callback_query' | 'on_command' | 'on_inline_query'
  name: string
  description: string
  enabled: boolean
  config?: Record<string, any>
}

const defaultTriggers: BotTrigger[] = [
  {
    id: 'on_bot_start',
    type: 'on_bot_start',
    name: 'On Bot Start',
    description: 'Triggered when a user starts the bot or sends /start command',
    enabled: true,
  },
  {
    id: 'on_message',
    type: 'on_message',
    name: 'On Message',
    description: 'Triggered when the bot receives any text message',
    enabled: true,
  },
  {
    id: 'on_callback_query',
    type: 'on_callback_query',
    name: 'On Callback Query',
    description: 'Triggered when a user clicks an inline button',
    enabled: false,
  },
  {
    id: 'on_command',
    type: 'on_command',
    name: 'On Command',
    description: 'Triggered when a user sends a command (e.g., /help)',
    enabled: false,
    config: { commands: [] },
  },
  {
    id: 'on_inline_query',
    type: 'on_inline_query',
    name: 'On Inline Query',
    description: 'Triggered when user uses inline mode in any chat',
    enabled: false,
  },
]

interface TriggerItemProps {
  trigger: BotTrigger
  onToggle: (id: string) => void
  onConfigure: (trigger: BotTrigger) => void
}

function TriggerItem({ trigger, onToggle, onConfigure }: TriggerItemProps) {
  const getIcon = () => {
    switch (trigger.type) {
      case 'on_bot_start':
        return <Play className="w-5 h-5 text-emerald-400" />
      case 'on_message':
        return <MessageCircle className="w-5 h-5 text-[#24A1DE]" />
      case 'on_callback_query':
        return <MousePointer2 className="w-5 h-5 text-amber-400" />
      case 'on_command':
        return <Bell className="w-5 h-5 text-purple-400" />
      case 'on_inline_query':
        return <Zap className="w-5 h-5 text-pink-400" />
      default:
        return <Zap className="w-5 h-5 text-zinc-400" />
    }
  }

  const getStatusBadge = () => {
    if (trigger.enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-emerald-400">Active</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        <span className="text-xs text-zinc-400">Inactive</span>
      </span>
    )
  }

  return (
    <div className={cn(
      "group rounded-xl border p-4 transition-all duration-200",
      trigger.enabled
        ? "bg-gradient-to-br from-[#24A1DE]/10 to-[#8B5CF6]/5 border-[#24A1DE]/30"
        : "bg-zinc-900/30 border-white/5 hover:border-white/10"
    )}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn(
          "p-3 rounded-xl transition-all duration-200",
          trigger.enabled
            ? "bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30"
            : "bg-white/5 border border-white/10"
        )}>
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-medium">{trigger.name}</h4>
            {getStatusBadge()}
          </div>
          <p className="text-sm text-zinc-400 mb-3">{trigger.description}</p>

          {/* Additional config info */}
          {trigger.config?.commands && trigger.config.commands.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trigger.config.commands.map((cmd: string) => (
                <code key={cmd} className="px-2 py-0.5 rounded bg-zinc-900/50 border border-white/10 text-xs text-[#24A1DE]">
                  {cmd}
                </code>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={trigger.enabled}
            onClick={() => onToggle(trigger.id)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]",
              trigger.enabled ? "bg-[#24A1DE]" : "bg-zinc-700"
            )}
            data-state={trigger.enabled ? "checked" : "unchecked"}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                trigger.enabled && "translate-x-4"
              )}
              data-state={trigger.enabled ? "checked" : "unchecked"}
            />
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfigure(trigger)}
            className="gap-1.5 h-8 text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Configure
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface TriggerConfigDialogProps {
  trigger: BotTrigger | null
  open: boolean
  onClose: () => void
  onSave: (trigger: BotTrigger) => void
}

function TriggerConfigDialog({ trigger, open, onClose, onSave }: TriggerConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, any>>(trigger?.config || {})

  if (!open || !trigger) return null

  const handleSave = () => {
    onSave({ ...trigger, config })
    onClose()
  }

  const renderConfigFields = () => {
    switch (trigger.type) {
      case 'on_command':
        return (
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Commands</label>
            <Input
              placeholder="/help, /start, /about"
              value={config.commands?.join(', ') || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({
                ...config,
                commands: e.target.value.split(',').map((c: string) => c.trim()).filter(Boolean)
              })}
              className="bg-zinc-900/50 border-white/10 text-white"
            />
            <p className="text-xs text-zinc-500 mt-2">Separate multiple commands with commas</p>
          </div>
        )
      case 'on_message':
        return (
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Filter by text pattern (optional)</label>
            <Input
              placeholder="regex pattern"
              value={config.pattern || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, pattern: e.target.value })}
              className="bg-zinc-900/50 border-white/10 text-white"
            />
          </div>
        )
      case 'on_inline_query':
        return (
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Query template</label>
            <Input
              placeholder="@{bot} {query}"
              value={config.template || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, template: e.target.value })}
              className="bg-zinc-900/50 border-white/10 text-white"
            />
          </div>
        )
      default:
        return (
          <p className="text-sm text-zinc-500">No additional configuration needed for this trigger type.</p>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-zinc-900/95 border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
            <SettingsIcon className="w-4 h-4 text-[#24A1DE]" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Configure Trigger</h3>
            <p className="text-sm text-zinc-400">{trigger.name}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {renderConfigFields()}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
          >
            <Check className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

interface TriggersListProps {
  triggers?: BotTrigger[]
  onTriggersChange?: (triggers: BotTrigger[]) => void
}

export function TriggersList({ triggers: externalTriggers, onTriggersChange }: TriggersListProps) {
  const [triggers, setTriggers] = useState<BotTrigger[]>(externalTriggers || defaultTriggers)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configuringTrigger, setConfiguringTrigger] = useState<BotTrigger | null>(null)

  const handleToggle = (id: string) => {
    const updated = triggers.map((t) =>
      t.id === id ? { ...t, enabled: !t.enabled } : t
    )
    setTriggers(updated)
    onTriggersChange?.(updated)
  }

  const handleConfigure = (trigger: BotTrigger) => {
    setConfiguringTrigger(trigger)
    setConfigDialogOpen(true)
  }

  const handleSaveConfig = (trigger: BotTrigger) => {
    const updated = triggers.map((t) => (t.id === trigger.id ? trigger : t))
    setTriggers(updated)
    onTriggersChange?.(updated)
  }

  const enabledCount = triggers.filter((t) => t.enabled).length

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
              <Zap className="w-4 h-4 text-[#24A1DE]" />
            </div>
            <h3 className="text-lg font-semibold text-white">Event Triggers</h3>
            <span className="text-zinc-500 text-sm">({enabledCount} active)</span>
          </div>
        </div>

        {/* Triggers List */}
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <TriggerItem
              key={trigger.id}
              trigger={trigger}
              onToggle={handleToggle}
              onConfigure={handleConfigure}
            />
          ))}
        </div>

        {/* Info Box */}
        <div className="rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#24A1DE]/5 border border-[#8B5CF6]/20 p-4">
          <p className="text-sm text-zinc-400">
            <strong className="text-[#24A1DE]">Tip:</strong> Enable triggers to define when your bot should respond to events.
            Use Configure to add filters and custom behavior for each trigger type.
          </p>
        </div>
      </div>

      {/* Config Dialog */}
      <TriggerConfigDialog
        trigger={configuringTrigger}
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        onSave={handleSaveConfig}
      />
    </>
  )
}
