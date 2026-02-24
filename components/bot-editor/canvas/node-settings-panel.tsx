'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Node } from 'reactflow'
import {
  MessageSquare,
  Keyboard,
  GitBranch,
  Zap,
  Webhook,
  Globe,
  Play,
  Clock,
  MessageCircle,
  X,
  Plus,
  Trash2,
  Settings,
  Save,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import type {
  NodeData,
  MessageNodeData,
  InputNodeData,
  ConditionNodeData,
  RouterNodeData,
  ActionNodeData,
  HttpNodeData,
  WebhookNodeData,
  TriggerNodeData,
  WaitNodeData,
  SchedulerNodeData,
  CommentNodeData,
  ParseMode,
  MessageAttachmentType,
  ComparisonOperator,
  HttpMethod,
} from '@/lib/bot-editor/types/component-schemas'
import { NODE_CONFIGS } from '@/lib/bot-editor/types/component-schemas'
import type { NodeType } from '@/lib/bot-editor/types/bot.types'
import { uploadBotMessageAttachmentAction } from '@/lib/bot-editor/actions/editor-actions'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import {
  TemplateVariableTextarea,
  VariableAutocompleteInput,
} from './variable-field-assist'

interface NodeSettingsPanelProps {
  node: Node | null
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void
  onSave?: () => Promise<boolean> | boolean
  onClose: () => void
  variables?: string[] // Available variable names
}

// Icons map
const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  input: Keyboard,
  condition: GitBranch,
  router: GitBranch,
  action: Zap,
  http: Globe,
  webhook: Webhook,
  trigger: Play,
  wait: Clock,
  scheduler: Clock,
  comment: MessageCircle,
}

export function NodeSettingsPanel({ node, onUpdate, onSave, onClose, variables = [] }: NodeSettingsPanelProps) {
  const t = useTranslations('editor.nodeSettings')
  const { isDirty } = useBotState()
  const [data, setData] = useState<Partial<NodeData>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (node) {
      setData(node.data as NodeData)
      setHasChanges(false)
    }
  }, [node])

  useEffect(() => {
    if (!isDirty) {
      setHasChanges(false)
    }
  }, [isDirty])

  if (!node) {
    return (
      <div className="w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 p-6">
        <div className="text-center text-zinc-500">
          <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t('selectNode')}</p>
        </div>
      </div>
    )
  }

  const nodeType = node.type as NodeType
  const config = NODE_CONFIGS[nodeType]
  const Icon = ICONS[nodeType] || Settings

  const handleUpdate = (newData: Partial<NodeData>) => {
    const updatedData = { ...data, ...newData }
    setData(updatedData)
    setHasChanges(true)
    onUpdate(node.id, updatedData)
  }

  const handleSave = async () => {
    onUpdate(node.id, data)

    if (!onSave) {
      setHasChanges(false)
      return
    }

    setIsSaving(true)
    try {
      const result = await onSave()
      if (result !== false) {
        setHasChanges(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-96 bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg" style={{ background: `${config.color}20` }}>
              <Icon className="w-4 h-4" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="text-white font-semibold">{config.label}</h3>
              <p className="text-xs text-zinc-500">{t('nodeId')} {node.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {nodeType === 'message' && (
          <MessageSettings
            data={data as MessageNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'input' && (
          <InputSettings
            data={data as InputNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'condition' && (
          <ConditionSettings
            data={data as ConditionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'router' && (
          <RouterSettings
            data={data as RouterNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'action' && (
          <ActionSettings
            data={data as ActionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'http' && (
          <HttpSettings
            data={data as HttpNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'webhook' && (
          <HttpSettings
            data={data as WebhookNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'trigger' && (
          <TriggerSettings
            data={data as TriggerNodeData}
            onUpdate={handleUpdate}
            t={t}
          />
        )}
        {nodeType === 'wait' && (
          <WaitSettings
            data={data as WaitNodeData}
            onUpdate={handleUpdate}
            variables={variables}
            t={t}
          />
        )}
        {nodeType === 'scheduler' && (
          <SchedulerSettings
            data={data as SchedulerNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'comment' && (
          <CommentSettings
            data={data as CommentNodeData}
            onUpdate={handleUpdate}
            t={t}
          />
        )}
      </div>

      {/* Footer */}
      {hasChanges && (
        <div className="p-4 border-t border-white/10">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full gap-2 bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6]"
          >
            <Save className="w-4 h-4" />
            {t('save')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MESSAGE NODE SETTINGS
// ============================================================================

type MessageFormatAction = {
  id: string
  label: string
  apply: (selectedText: string) => string
}

type MessageFormatMenuState = {
  x: number
  y: number
  selectionStart: number
  selectionEnd: number
  hasSelection: boolean
}

function escapeTelegramMarkdownV2(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1')
}

function getMessageFormattingActions(
  parseMode: ParseMode | 'None',
  tm: (key: string) => string
): MessageFormatAction[] {
  if (parseMode === 'HTML') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `<b>${text}</b>` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `<i>${text}</i>` },
      { id: 'underline', label: tm('formatUnderline'), apply: (text) => `<u>${text}</u>` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `<code>${text}</code>` },
      { id: 'spoiler', label: tm('formatSpoiler'), apply: (text) => `<tg-spoiler>${text}</tg-spoiler>` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `<a href="https://example.com">${text}</a>` },
    ]
  }

  if (parseMode === 'MarkdownV2') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `*${escapeTelegramMarkdownV2(text)}*` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `_${escapeTelegramMarkdownV2(text)}_` },
      { id: 'underline', label: tm('formatUnderline'), apply: (text) => `__${escapeTelegramMarkdownV2(text)}__` },
      { id: 'strike', label: tm('formatStrike'), apply: (text) => `~${escapeTelegramMarkdownV2(text)}~` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `\`${text.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`` },
      { id: 'spoiler', label: tm('formatSpoiler'), apply: (text) => `||${escapeTelegramMarkdownV2(text)}||` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `[${escapeTelegramMarkdownV2(text)}](https://example.com)` },
    ]
  }

  if (parseMode === 'Markdown') {
    return [
      { id: 'bold', label: tm('formatBold'), apply: (text) => `*${text}*` },
      { id: 'italic', label: tm('formatItalic'), apply: (text) => `_${text}_` },
      { id: 'strike', label: tm('formatStrike'), apply: (text) => `~${text}~` },
      { id: 'code', label: tm('formatCode'), apply: (text) => `\`${text}\`` },
      { id: 'link', label: tm('formatLink'), apply: (text) => `[${text}](https://example.com)` },
    ]
  }

  return []
}

function normalizeMessageAttachmentType(
  value: unknown
): MessageAttachmentType | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (
    normalized === 'photo' ||
    normalized === 'video' ||
    normalized === 'document' ||
    normalized === 'audio'
  ) {
    return normalized
  }
  return null
}

function getPrimaryMessageAttachment(
  data: MessageNodeData
): { type: MessageAttachmentType; source: string } | null {
  const attachments = Array.isArray(data.attachments) ? data.attachments : []

  for (const rawAttachment of attachments) {
    if (!rawAttachment || typeof rawAttachment !== 'object') {
      continue
    }

    const record = rawAttachment as Record<string, unknown>
    const type = normalizeMessageAttachmentType(
      record.type ?? record.kind ?? record.mediaType ?? record.media_type
    )
    if (!type) {
      continue
    }

    const sourceCandidate =
      record.source ??
      record.url ??
      record.media ??
      record.fileId ??
      record.file_id ??
      record.value

    return {
      type,
      source: typeof sourceCandidate === 'string' ? sourceCandidate : '',
    }
  }

  return null
}

function MessageSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: MessageNodeData
  onUpdate: (data: Partial<MessageNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const tm = (key: string) => t(`message.${key}`)
  const { bot } = useBotState()
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null)
  const [formatMenu, setFormatMenu] = useState<MessageFormatMenuState | null>(null)
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [attachmentUploadError, setAttachmentUploadError] = useState<string | null>(null)

  const currentParseMode = (data.parseMode || 'None') as ParseMode | 'None'
  const formatActions = getMessageFormattingActions(currentParseMode, tm)
  const primaryAttachment = getPrimaryMessageAttachment(data)
  const attachmentType = primaryAttachment?.type ?? 'none'
  const attachmentSource = primaryAttachment?.source ?? ''

  useEffect(() => {
    if (!formatMenu) return

    const closeMenu = () => setFormatMenu(null)
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target && menuRef.current?.contains(target)) {
        return
      }
      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [formatMenu])

  const rememberSelection = (textarea: HTMLTextAreaElement) => {
    const start = textarea.selectionStart ?? 0
    const end = textarea.selectionEnd ?? 0
    lastSelectionRef.current = { start, end }
  }

  const openFormattingMenu = (event: React.MouseEvent<HTMLTextAreaElement>) => {
    event.preventDefault()

    const textarea = event.currentTarget
    let selectionStart = textarea.selectionStart ?? 0
    let selectionEnd = textarea.selectionEnd ?? 0

    if (selectionStart === selectionEnd && lastSelectionRef.current) {
      selectionStart = lastSelectionRef.current.start
      selectionEnd = lastSelectionRef.current.end
    }

    const menuWidth = 230
    const menuHeight = currentParseMode === 'None' ? 76 : 280
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12)

    setFormatMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      selectionStart,
      selectionEnd,
      hasSelection: selectionStart !== selectionEnd,
    })
  }

  const applyFormatting = (formatter: (selectedText: string) => string) => {
    if (!formatMenu) return

    const sourceText = data.text || ''
    const selectedText = sourceText.slice(formatMenu.selectionStart, formatMenu.selectionEnd)
    if (!selectedText) {
      setFormatMenu(null)
      return
    }

    const replacement = formatter(selectedText)
    const updatedText = `${sourceText.slice(0, formatMenu.selectionStart)}${replacement}${sourceText.slice(formatMenu.selectionEnd)}`

    onUpdate({ text: updatedText })
    setFormatMenu(null)

    requestAnimationFrame(() => {
      const textarea = textAreaRef.current
      if (!textarea) return
      textarea.focus()
      textarea.setSelectionRange(
        formatMenu.selectionStart,
        formatMenu.selectionStart + replacement.length
      )
    })
  }

  const updatePrimaryAttachment = (
    nextType: MessageAttachmentType | 'none',
    nextSource: string
  ) => {
    if (nextType === 'none') {
      onUpdate({ attachments: [] })
      return
    }

    onUpdate({
      attachments: [
        {
          type: nextType,
          source: nextSource,
        },
      ],
    })
  }

  const uploadAttachmentFile = useCallback(async (file: File) => {
    if (!file) return

    if (attachmentType === 'none') {
      setAttachmentUploadError(tm('attachmentSelectTypeFirst'))
      return
    }

    if (!bot?.id) {
      setAttachmentUploadError(tm('attachmentUploadBotMissing'))
      return
    }

    setAttachmentUploadError(null)
    setIsUploadingAttachment(true)
    try {
      const result = await uploadBotMessageAttachmentAction(bot.id, file)
      if (!result.success) {
        setAttachmentUploadError(result.error || tm('attachmentUploadFailed'))
        return
      }

      updatePrimaryAttachment(attachmentType as MessageAttachmentType, result.path)
    } catch (error) {
      setAttachmentUploadError(String(error) || tm('attachmentUploadFailed'))
    } finally {
      setIsUploadingAttachment(false)
    }
  }, [attachmentType, bot?.id, tm, updatePrimaryAttachment])

  const handleAttachmentDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsAttachmentDragActive(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await uploadAttachmentFile(file)
  }, [uploadAttachmentFile])

  const handleAttachmentFilePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    await uploadAttachmentFile(file)
  }, [uploadAttachmentFile])

  return (
    <div className="space-y-4 relative">
      <div>
        <Label htmlFor="msg-text">{tm('textLabel')}</Label>
        <TemplateVariableTextarea
          ref={textAreaRef}
          id="msg-text"
          value={data.text || ''}
          onValueChange={(value) => {
            setFormatMenu(null)
            onUpdate({ text: value })
          }}
          onSelect={(e) => rememberSelection(e.currentTarget)}
          onMouseUp={(e) => rememberSelection(e.currentTarget)}
          onKeyUp={(e) => rememberSelection(e.currentTarget)}
          onMouseDownCapture={(e) => {
            if (e.button === 2) {
              rememberSelection(e.currentTarget)
            }
          }}
          onContextMenu={openFormattingMenu}
          placeholder={tm('textPlaceholder')}
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {tm('variableHint')}
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          {tm('formatContextHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="msg-parsemode">{tm('formatting')}</Label>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">{tm('none')}</SelectItem>
            <SelectItem value="Markdown">{tm('markdown')}</SelectItem>
            <SelectItem value="MarkdownV2">{tm('markdownV2')}</SelectItem>
            <SelectItem value="HTML">{tm('html')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-preview">{tm('disablePreview')}</Label>
          <Switch
            id="msg-preview"
            checked={data.disableWebPagePreview || false}
            onCheckedChange={(checked) => onUpdate({ disableWebPagePreview: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-silent">{tm('silentMode')}</Label>
          <Switch
            id="msg-silent"
            checked={data.disableNotification || false}
            onCheckedChange={(checked) => onUpdate({ disableNotification: checked })}
          />
        </div>
      </div>

      <div>
        <Label>{tm('attachments')}</Label>
        <div className="mt-2 space-y-3 rounded-lg bg-zinc-800/20 border border-white/10 p-3">
          <div>
            <Label htmlFor="msg-attachment-type" className="text-xs text-zinc-400">
              {tm('attachmentType')}
            </Label>
            <Select
              value={attachmentType}
              onValueChange={(value) =>
                updatePrimaryAttachment(value as MessageAttachmentType | 'none', attachmentSource)
              }
            >
              <SelectTrigger id="msg-attachment-type" className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tm('attachmentNone')}</SelectItem>
                <SelectItem value="photo">{tm('attachmentPhoto')}</SelectItem>
                <SelectItem value="video">{tm('attachmentVideo')}</SelectItem>
                <SelectItem value="document">{tm('attachmentDocument')}</SelectItem>
                <SelectItem value="audio">{tm('attachmentAudio')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {attachmentType !== 'none' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(event) => void handleAttachmentFilePick(event)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (!isAttachmentDragActive) {
                    setIsAttachmentDragActive(true)
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof HTMLElement &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return
                  }
                  setIsAttachmentDragActive(false)
                }}
                onDrop={(event) => void handleAttachmentDrop(event)}
                className={`mb-3 rounded-lg border px-3 py-3 text-sm transition-colors cursor-pointer outline-none ${
                  isAttachmentDragActive
                    ? 'border-[#24A1DE]/50 bg-[#24A1DE]/10 text-white'
                    : 'border-white/10 bg-zinc-800/20 text-zinc-300 hover:border-white/20 hover:bg-zinc-800/30'
                }`}
              >
                <div className="font-medium">
                  {isUploadingAttachment ? tm('attachmentUploading') : tm('attachmentDropTitle')}
                </div>
                <div className="text-xs mt-1 text-zinc-400">
                  {tm('attachmentDropHint')}
                </div>
              </div>

              <Label htmlFor="msg-attachment-source" className="text-xs text-zinc-400">
                {tm('attachmentSource')}
              </Label>
              <Input
                id="msg-attachment-source"
                value={attachmentSource}
                onChange={(event) =>
                  updatePrimaryAttachment(attachmentType as MessageAttachmentType, event.target.value)
                }
                placeholder={tm('attachmentSourcePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">{tm('attachmentSourceHint')}</p>
              <p className="text-xs text-zinc-600 mt-1">{tm('attachmentCaptionHint')}</p>
              {attachmentUploadError && (
                <p className="text-xs text-red-300 mt-2">{attachmentUploadError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>{tm('keyboard')}</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
          t={t}
        />
      </div>

      {formatMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[230px] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-2"
          style={{
            left: formatMenu.x,
            top: formatMenu.y,
          }}
        >
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-zinc-500">
            {tm('formatMenuTitle')}
          </div>

          {!formatMenu.hasSelection ? (
            <div className="px-2 py-2 text-sm text-zinc-300 bg-white/5 border border-white/10 rounded-lg">
              {tm('formatSelectTextFirst')}
            </div>
          ) : currentParseMode === 'None' ? (
            <div className="px-2 py-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              {tm('formatEnableFirst')}
            </div>
          ) : (
            <div className="space-y-1">
              {formatActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => applyFormatting(action.apply)}
                  className="w-full text-left px-2 py-2 rounded-lg text-sm text-zinc-200 hover:bg-white/5 hover:text-white transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// INPUT NODE SETTINGS
// ============================================================================

function InputSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: InputNodeData
  onUpdate: (data: Partial<InputNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const ti = (key: string) => t(`input.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="input-question">{ti('questionLabel')}</Label>
        <TemplateVariableTextarea
          id="input-question"
          value={data.question || ''}
          onValueChange={(value) => onUpdate({ question: value })}
          placeholder={ti('questionPlaceholder')}
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>

      <div>
        <Label htmlFor="input-varname">{ti('variableNameLabel')}</Label>
        <VariableAutocompleteInput
          id="input-varname"
          value={data.variableName || ''}
          onValueChange={(value) => onUpdate({ variableName: value })}
          placeholder={ti('variableNamePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          {ti('variableHint')}
        </p>
      </div>

      <div>
        <Label htmlFor="input-parsemode">{ti('formatting')}</Label>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">{t('message.none')}</SelectItem>
            <SelectItem value="Markdown">{t('message.markdown')}</SelectItem>
            <SelectItem value="MarkdownV2">{t('message.markdownV2')}</SelectItem>
            <SelectItem value="HTML">{t('message.html')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="input-force-reply">{ti('forceReplyLabel')}</Label>
          <Switch
            id="input-force-reply"
            checked={data.forceReply !== false}
            onCheckedChange={(checked) => onUpdate({ forceReply: checked })}
          />
        </div>
        {data.forceReply !== false && (
          <Input
            value={data.inputPlaceholder || ''}
            onChange={(e) => onUpdate({ inputPlaceholder: e.target.value })}
            placeholder={ti('inputPlaceholder')}
            className="bg-zinc-800/50 border-white/10"
          />
        )}
        <div className="flex items-center justify-between">
          <Label htmlFor="input-skip">{ti('skipButtonLabel')}</Label>
          <Switch
            id="input-skip"
            checked={data.skipButton || false}
            onCheckedChange={(checked) => onUpdate({ skipButton: checked })}
          />
        </div>
        {data.skipButton && (
          <Input
            value={data.skipValue || ''}
            onChange={(e) => onUpdate({ skipValue: e.target.value })}
            placeholder={ti('skipValuePlaceholder')}
            className="bg-zinc-800/50 border-white/10"
          />
        )}
      </div>

      <div>
        <Label>{ti('keyboard')}</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
          t={t}
        />
      </div>
    </div>
  )
}

function createRouterCaseId(): string {
  return `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ============================================================================
// CONDITION NODE SETTINGS
// ============================================================================

function ConditionSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: ConditionNodeData
  onUpdate: (data: Partial<ConditionNodeData>) => void
  variables: string[]
  t: (key: string, values?: Record<string, unknown>) => string
}) {
  const tc = (key: string, values?: Record<string, unknown>) => t(`condition.${key}`, values)
  const conditionVariableOptions = Array.from(
    new Set(
      [
        ...variables,
        'user.id',
        'user.username',
        'user.firstName',
        'user.lastName',
        'user.languageCode',
      ]
        .map((value) => String(value || '').trim())
        .map((value) => {
          const wrappedMatch = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/)
          return wrappedMatch?.[1]?.trim() || value
        })
        .filter(Boolean)
    )
  )

  const getConditionLabel = (op: string) => {
    switch (op) {
      case 'equals': return tc('equals')
      case 'notEquals': return tc('notEquals')
      case 'contains': return tc('contains')
      case 'notContains': return tc('notContains')
      case 'gt': return tc('gt')
      case 'lt': return tc('lt')
      case 'gte': return tc('gte')
      case 'lte': return tc('lte')
      case 'isEmpty': return tc('isEmpty')
      case 'isNotEmpty': return tc('isNotEmpty')
      default: return op
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cond-var">{tc('variableLabel')}</Label>
        <Select
          value={data.variable || ''}
          onValueChange={(value) => onUpdate({ variable: value })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue placeholder={tc('selectVariable')} />
          </SelectTrigger>
          <SelectContent>
            {conditionVariableOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="cond-op">{tc('conditionLabel')}</Label>
        <Select
          value={data.operator || 'equals'}
          onValueChange={(value) => onUpdate({ operator: value as ComparisonOperator })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">{tc('equals')}</SelectItem>
            <SelectItem value="notEquals">{tc('notEquals')}</SelectItem>
            <SelectItem value="contains">{tc('contains')}</SelectItem>
            <SelectItem value="notContains">{tc('notContains')}</SelectItem>
            <SelectItem value="gt">{tc('gt')}</SelectItem>
            <SelectItem value="lt">{tc('lt')}</SelectItem>
            <SelectItem value="gte">{tc('gte')}</SelectItem>
            <SelectItem value="lte">{tc('lte')}</SelectItem>
            <SelectItem value="isEmpty">{tc('isEmpty')}</SelectItem>
            <SelectItem value="isNotEmpty">{tc('isNotEmpty')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="cond-value">{tc('valueLabel')}</Label>
        <Input
          id="cond-value"
          value={data.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={tc('valuePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div className="p-3 rounded-lg bg-zinc-800/30 border border-white/10">
        <p className="text-sm text-zinc-400">
          {tc('preview', {
            variable: data.variable || 'variable',
            condition: getConditionLabel(data.operator || 'equals'),
            value: data.value || '...'
          })}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// ROUTER / SWITCH NODE SETTINGS
// ============================================================================

function RouterSettings({
  data,
  onUpdate,
  variables,
}: {
  data: RouterNodeData
  onUpdate: (data: Partial<RouterNodeData>) => void
  variables: string[]
}) {
  const cases = Array.isArray(data.cases) ? data.cases : []
  const operator = (data.operator || 'equals') as ComparisonOperator

  const updateCase = (caseId: string, patch: Record<string, unknown>) => {
    onUpdate({
      cases: cases.map((routerCase) =>
        routerCase.id === caseId ? { ...routerCase, ...patch } : routerCase
      ),
    })
  }

  const addCase = () => {
    onUpdate({
      cases: [
        ...cases,
        {
          id: createRouterCaseId(),
          label: `Case ${cases.length + 1}`,
          value: '',
        },
      ],
    })
  }

  const removeCase = (caseId: string) => {
    onUpdate({
      cases: cases.filter((routerCase) => routerCase.id !== caseId),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="router-variable">Variable</Label>
        <VariableAutocompleteInput
          id="router-variable"
          value={data.variable || ''}
          onValueChange={(value) => onUpdate({ variable: value })}
          placeholder="user.languageCode"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          Compare this variable against multiple cases. First match wins.
        </p>
      </div>

      <div>
        <Label htmlFor="router-operator">Operator (applies to all cases)</Label>
        <Select
          value={operator}
          onValueChange={(value) => onUpdate({ operator: value as ComparisonOperator })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">equals</SelectItem>
            <SelectItem value="notEquals">notEquals</SelectItem>
            <SelectItem value="contains">contains</SelectItem>
            <SelectItem value="notContains">notContains</SelectItem>
            <SelectItem value="gt">gt</SelectItem>
            <SelectItem value="lt">lt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cases</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={addCase}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Case
          </Button>
        </div>

        {cases.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-zinc-800/20 px-3 py-2 text-sm text-zinc-500">
            No cases yet. Add at least one case.
          </div>
        )}

        {cases.map((routerCase, index) => (
          <div
            key={routerCase.id || index}
            className="rounded-xl border border-white/10 bg-zinc-800/20 p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Handle:{' '}
                <code
                  className="text-zinc-300"
                  title={String(routerCase.id || '')}
                >
                  {`case:case_${index + 1}`}
                </code>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-zinc-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => removeCase(String(routerCase.id || ''))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div>
              <Label htmlFor={`router-case-label-${index}`}>Label</Label>
              <Input
                id={`router-case-label-${index}`}
                value={String(routerCase.label || '')}
                onChange={(e) => updateCase(String(routerCase.id), { label: e.target.value })}
                placeholder={`Case ${index + 1}`}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>

            <div>
              <Label htmlFor={`router-case-value-${index}`}>Compare Value</Label>
              <Input
                id={`router-case-value-${index}`}
                value={routerCase.value == null ? '' : String(routerCase.value)}
                onChange={(e) => updateCase(String(routerCase.id), { value: e.target.value })}
                placeholder="en"
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <Label htmlFor="router-default-label">Default Branch Label</Label>
        <Input
          id="router-default-label"
          value={data.defaultLabel || ''}
          onChange={(e) => onUpdate({ defaultLabel: e.target.value })}
          placeholder="Default"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Connect the bottom output handle for the default branch.
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// ACTION NODE SETTINGS
// ============================================================================

function ActionSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: ActionNodeData
  onUpdate: (data: Partial<ActionNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const ta = (key: string, values?: Record<string, unknown>) => t(`action.${key}`, values)
  const actionType = data.action?.type || 'setVariable'

  const createActionConfigByType = (value: string) => {
    if (value === 'delay') {
      return { type: 'delay', duration: 1000 }
    }
    if (value === 'deleteMessage') {
      return { type: 'deleteMessage', delay: 0 }
    }
    if (value === 'random') {
      return { type: 'random', aPercent: 50, saveToVariable: '' }
    }
    return { type: 'setVariable', variableName: '', value: '' }
  }

  return (
    <Tabs defaultValue="action" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
        <TabsTrigger value="action">{ta('actionTab')}</TabsTrigger>
        <TabsTrigger value="error">{ta('errorTab')}</TabsTrigger>
      </TabsList>

      <TabsContent value="action" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-type">{ta('typeLabel')}</Label>
          <Select
            value={actionType}
            onValueChange={(value) =>
              onUpdate({
                action: createActionConfigByType(value) as any,
              })
            }
          >
            <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="setVariable">{ta('setVariable')}</SelectItem>
              <SelectItem value="delay">{ta('delay')}</SelectItem>
              <SelectItem value="deleteMessage">{ta('deleteMessage')}</SelectItem>
              <SelectItem value="random">{ta('random')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionType === 'setVariable' && (
          <>
            <div>
              <Label htmlFor="setvar-name">{ta('variableNameLabel')}</Label>
              <VariableAutocompleteInput
                id="setvar-name"
                value={(data.action as any)?.variableName || ''}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...(data.action as any), variableName: value } as any,
                  })
                }
                placeholder={ta('variableNamePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
            </div>
            <div>
              <Label htmlFor="setvar-value">{ta('valueLabel')}</Label>
              <TemplateVariableTextarea
                id="setvar-value"
                value={(data.action as any)?.value || ''}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...(data.action as any), value } as any,
                  })
                }
                placeholder={ta('valuePlaceholder')}
                rows={2}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
            </div>
          </>
        )}

        {actionType === 'delay' && (
          <div>
            <Label htmlFor="delay-duration">{ta('delayLabel')}</Label>
            <Input
              id="delay-duration"
              type="number"
              value={(data.action as any)?.duration || 1000}
              onChange={(e) =>
                onUpdate({
                  action: { ...(data.action as any), duration: Number(e.target.value) } as any,
                })
              }
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}

        {actionType === 'deleteMessage' && (
          <div>
            <Label htmlFor="delete-delay">{ta('deleteDelayLabel')}</Label>
            <Input
              id="delete-delay"
              type="number"
              value={(data.action as any)?.delay || 0}
              onChange={(e) =>
                onUpdate({
                  action: { ...(data.action as any), delay: Number(e.target.value) } as any,
                })
              }
              placeholder={ta('deleteDelayPlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}

        {actionType === 'random' && (
          <>
            <div>
              <Label htmlFor="random-a-percent">{ta('randomAPercentLabel')}</Label>
              <Input
                id="random-a-percent"
                type="number"
                min={0}
                max={100}
                value={Math.min(100, Math.max(0, Number((data.action as any)?.aPercent ?? 50)))}
                onChange={(e) =>
                  onUpdate({
                    action: {
                      ...(data.action as any),
                      aPercent: Math.min(100, Math.max(0, Number(e.target.value || 0))),
                    } as any,
                  })
                }
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {ta('randomSplitHint', {
                  a: String(Math.min(100, Math.max(0, Number((data.action as any)?.aPercent ?? 50)))),
                  b: String(100 - Math.min(100, Math.max(0, Number((data.action as any)?.aPercent ?? 50)))),
                })}
              </p>
            </div>

            <div>
              <Label htmlFor="random-savevar">{ta('randomSaveResultLabel')}</Label>
              <VariableAutocompleteInput
                id="random-savevar"
                value={String((data.action as any)?.saveToVariable || '')}
                onValueChange={(value) =>
                  onUpdate({
                    action: { ...(data.action as any), saveToVariable: value } as any,
                  })
                }
                placeholder={ta('randomSaveResultPlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
                variables={variables}
              />
              <p className="text-xs text-zinc-500 mt-1">{ta('randomHandlesHint')}</p>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="error" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-onerror">{ta('onErrorLabel')}</Label>
          <Select
            value={data.onError || 'continue'}
            onValueChange={(value) =>
              onUpdate({ onError: value as 'continue' | 'stop' | 'retry' })
            }
          >
            <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="continue">{ta('continue')}</SelectItem>
              <SelectItem value="stop">{ta('stop')}</SelectItem>
              <SelectItem value="retry">{ta('retry')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.onError === 'retry' && (
          <div>
            <Label htmlFor="retry-count">{ta('retryCountLabel')}</Label>
            <Input
              id="retry-count"
              type="number"
              value={data.retryCount || 3}
              onChange={(e) => onUpdate({ retryCount: Number(e.target.value) })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

// ============================================================================
// HTTP NODE SETTINGS
// ============================================================================

type HttpPair = { key: string; value: string }

type HttpLikeData = {
  url?: string
  method?: HttpMethod
  headers?: unknown
  queryParams?: unknown
  body?: unknown
  bodyType?: 'json' | 'form' | 'raw' | 'none'
  saveToVariable?: string
  timeout?: number
}

function normalizePairs(input: unknown): HttpPair[] {
  if (Array.isArray(input)) {
    return input.map((item) => {
      const pair = (item || {}) as { key?: unknown; value?: unknown }
      return {
        key: String(pair.key ?? ''),
        value: String(pair.value ?? ''),
      }
    })
  }

  if (input && typeof input === 'object') {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }))
  }

  return []
}

function KeyValueListEditor({
  idPrefix,
  label,
  addLabel,
  emptyLabel,
  rows,
  onChange,
}: {
  idPrefix: string
  label: string
  addLabel: string
  emptyLabel: string
  rows: HttpPair[]
  onChange: (rows: HttpPair[]) => void
}) {
  const addRow = () => onChange([...rows, { key: '', value: '' }])
  const removeRow = (index: number) => onChange(rows.filter((_, idx) => idx !== index))
  const updateRow = (index: number, field: keyof HttpPair, value: string) => {
    const next = [...rows]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 border-white/10"
          onClick={addRow}
        >
          <Plus className="w-3 h-3 mr-1" />
          {addLabel}
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-xs text-zinc-500 border border-white/10 rounded-lg px-3 py-2">
          {emptyLabel}
        </div>
      )}

      {rows.map((row, index) => (
        <div key={`${idPrefix}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            id={`${idPrefix}-key-${index}`}
            value={row.key}
            onChange={(e) => updateRow(index, 'key', e.target.value)}
            placeholder="key"
            className="bg-zinc-800/50 border-white/10"
          />
          <Input
            id={`${idPrefix}-value-${index}`}
            value={row.value}
            onChange={(e) => updateRow(index, 'value', e.target.value)}
            placeholder="value"
            className="bg-zinc-800/50 border-white/10"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10"
            onClick={() => removeRow(index)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function HttpSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: HttpLikeData
  onUpdate: (data: Partial<HttpLikeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const th = (key: string) => t(`webhook.${key}`)
  const thttp = (key: string) => t(`http.${key}`)
  const method = data.method || 'GET'
  const methodSupportsBody = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(method)
  const headers = normalizePairs(data.headers)
  const queryParams = normalizePairs(data.queryParams)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="http-url">{th('urlLabel')}</Label>
        <Input
          id="http-url"
          value={data.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder={th('urlPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="http-method">{th('methodLabel')}</Label>
        <Select
          value={method}
          onValueChange={(value) => onUpdate({ method: value as HttpMethod })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="HEAD">HEAD</SelectItem>
            <SelectItem value="OPTIONS">OPTIONS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <KeyValueListEditor
        idPrefix="http-query"
        label={thttp('queryParamsLabel')}
        addLabel={thttp('addPair')}
        emptyLabel={thttp('emptyList')}
        rows={queryParams}
        onChange={(rows) => onUpdate({ queryParams: rows })}
      />

      <KeyValueListEditor
        idPrefix="http-headers"
        label={thttp('headersLabel')}
        addLabel={thttp('addPair')}
        emptyLabel={thttp('emptyList')}
        rows={headers}
        onChange={(rows) => onUpdate({ headers: rows })}
      />

      {methodSupportsBody && (
        <>
          <div>
            <Label htmlFor="http-body-type">{th('bodyTypeLabel')}</Label>
            <Select
              value={data.bodyType || 'json'}
              onValueChange={(value) =>
                onUpdate({ bodyType: value as HttpLikeData['bodyType'] })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="form">Form Data</SelectItem>
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="none">{thttp('bodyNone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(data.bodyType || 'json') !== 'none' && (
            <div>
              <Label htmlFor="http-body">{th('bodyLabel')}</Label>
              <TemplateVariableTextarea
                id="http-body"
                value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || {}, null, 2)}
                onValueChange={(value) => onUpdate({ body: value })}
                placeholder={th('bodyPlaceholder')}
                rows={5}
                className="mt-1.5 bg-zinc-800/50 border-white/10 font-mono text-sm"
                variables={variables}
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor="http-timeout">{thttp('timeoutLabel')}</Label>
        <Input
          id="http-timeout"
          type="number"
          min={100}
          value={data.timeout || 30000}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) || 30000 })}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="http-savevar">{th('saveResponseLabel')}</Label>
        <VariableAutocompleteInput
          id="http-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={th('saveResponsePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>
    </div>
  )
}

// ============================================================================
// TRIGGER NODE SETTINGS
// ============================================================================

function TriggerSettings({
  data,
  onUpdate,
  t,
}: {
  data: TriggerNodeData
  onUpdate: (data: Partial<TriggerNodeData>) => void
  t: (key: string) => string
}) {
  const tr = (key: string) => t(`trigger.${key}`)
  const isCommandTrigger = data.trigger === 'command'
  const isTextTrigger = data.trigger === 'text'
  const isCallbackTrigger = data.trigger === 'callbackQuery'
  const isScheduleTrigger = data.trigger === 'schedule'
  const scheduleMode = (data.scheduleMode || 'daily') as 'hourly' | 'daily'

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trigger-type">{tr('typeLabel')}</Label>
        <Select
          value={data.trigger || 'command'}
          onValueChange={(value) => onUpdate({ trigger: value as TriggerNodeData['trigger'] })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">{tr('command')}</SelectItem>
            <SelectItem value="text">{tr('text')}</SelectItem>
            <SelectItem value="callbackQuery">{tr('callbackQuery')}</SelectItem>
            <SelectItem value="photo">{tr('photo')}</SelectItem>
            <SelectItem value="any">{tr('any')}</SelectItem>
            <SelectItem value="schedule">Schedule (time)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(isCommandTrigger || isTextTrigger || isCallbackTrigger) && (
        <div>
          <Label htmlFor="trigger-pattern">
            {isCommandTrigger ? tr('command') : isCallbackTrigger ? 'Callback Data' : tr('patternLabel')}
          </Label>
          <Input
            id="trigger-pattern"
            value={data.pattern || ''}
            onChange={(e) => onUpdate({ pattern: e.target.value })}
            placeholder={
              isCommandTrigger
                ? tr('commandPlaceholder')
                : isCallbackTrigger
                  ? 'Например: menu:settings'
                  : tr('textPlaceholder')
            }
            className="mt-1.5 bg-zinc-800/50 border-white/10"
          />
          {isCallbackTrigger && (
            <p className="text-xs text-zinc-500 mt-1">
              Оставьте пустым, чтобы ловить любое нажатие inline-кнопки.
            </p>
          )}
        </div>
      )}

      {isScheduleTrigger && (
        <>
          <div>
            <Label htmlFor="trigger-schedule-mode">Schedule Mode</Label>
            <Select
              value={scheduleMode}
              onValueChange={(value) =>
                onUpdate({ scheduleMode: value as 'hourly' | 'daily' })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day at time</SelectItem>
                <SelectItem value="hourly">Every N hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleMode === 'daily' ? (
            <div>
              <Label htmlFor="trigger-schedule-time">Time (HH:mm)</Label>
              <Input
                id="trigger-schedule-time"
                type="time"
                value={data.atTime || '10:00'}
                onChange={(e) => onUpdate({ atTime: e.target.value })}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="trigger-schedule-every-hours">Every N Hours</Label>
                <Input
                  id="trigger-schedule-every-hours"
                  type="number"
                  min={1}
                  max={24}
                  value={data.everyHours ?? 1}
                  onChange={(e) => onUpdate({ everyHours: Math.max(1, Number(e.target.value) || 1) })}
                  className="mt-1.5 bg-zinc-800/50 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="trigger-schedule-minute">At Minute</Label>
                <Input
                  id="trigger-schedule-minute"
                  type="number"
                  min={0}
                  max={59}
                  value={data.atMinute ?? 0}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    onUpdate({ atMinute: Math.min(59, Math.max(0, Number.isFinite(next) ? next : 0)) })
                  }}
                  className="mt-1.5 bg-zinc-800/50 border-white/10"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="trigger-schedule-timezone">Timezone (IANA)</Label>
            <Input
              id="trigger-schedule-timezone"
              value={data.timeZone || 'UTC'}
              onChange={(e) => onUpdate({ timeZone: e.target.value })}
              placeholder="Europe/Moscow"
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Examples: `UTC`, `Europe/Moscow`, `America/New_York`
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label htmlFor="trigger-target-chat-id">Target Chat ID</Label>
              <Input
                id="trigger-target-chat-id"
                value={data.targetChatId || ''}
                onChange={(e) => onUpdate({ targetChatId: e.target.value })}
                placeholder="-1001234567890 or 123456789"
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Required for message-based workflows started by schedule trigger.
              </p>
            </div>

            <div>
              <Label htmlFor="trigger-target-user-id">Target User ID (optional)</Label>
              <Input
                id="trigger-target-user-id"
                value={data.targetUserId || ''}
                onChange={(e) => onUpdate({ targetUserId: e.target.value })}
                placeholder="123456789"
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Optional. Helps preserve `user.*` context in some flows.
              </p>
            </div>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="trigger-desc">{tr('descriptionLabel')}</Label>
        <Input
          id="trigger-desc"
          value={data.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder={tr('descriptionPlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>
    </div>
  )
}

// ============================================================================
// DATE / TIME SCHEDULER NODE SETTINGS
// ============================================================================

function SchedulerSettings({
  data,
  onUpdate,
  variables,
}: {
  data: SchedulerNodeData
  onUpdate: (data: Partial<SchedulerNodeData>) => void
  variables: string[]
}) {
  const mode = (data.mode || 'delay') as SchedulerNodeData['mode']
  const delayUnit = (data.delayUnit || 'minutes') as NonNullable<SchedulerNodeData['delayUnit']>

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="scheduler-mode">Mode</Label>
        <Select
          value={mode || 'delay'}
          onValueChange={(value) =>
            onUpdate({ mode: value as NonNullable<SchedulerNodeData['mode']> })
          }
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delay">Delay (relative)</SelectItem>
            <SelectItem value="dateTime">Date & Time (timezone-aware)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'delay' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="scheduler-delay-value">Delay Value</Label>
            <Input
              id="scheduler-delay-value"
              type="number"
              min={0}
              value={data.delayValue ?? 5}
              onChange={(e) => onUpdate({ delayValue: Number(e.target.value) })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
          <div>
            <Label htmlFor="scheduler-delay-unit">Delay Unit</Label>
            <Select
              value={delayUnit}
              onValueChange={(value) =>
                onUpdate({
                  delayUnit: value as NonNullable<SchedulerNodeData['delayUnit']>,
                })
              }
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Seconds</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="scheduler-datetime">Date & Time</Label>
            <Input
              id="scheduler-datetime"
              type="datetime-local"
              value={data.dateTime || ''}
              onChange={(e) => onUpdate({ dateTime: e.target.value })}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Interpreted in the selected timezone below.
            </p>
          </div>

          <div>
            <Label htmlFor="scheduler-timezone">Timezone (IANA)</Label>
            <Input
              id="scheduler-timezone"
              value={data.timeZone || 'UTC'}
              onChange={(e) => onUpdate({ timeZone: e.target.value })}
              placeholder="Europe/Moscow"
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Examples: `UTC`, `Europe/Moscow`, `America/New_York`
            </p>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="scheduler-savevar">Save Scheduled Time To Variable (optional)</Label>
        <VariableAutocompleteInput
          id="scheduler-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder="scheduledAt"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
        <p className="text-xs text-zinc-500 mt-1">
          Stores ISO UTC timestamp (e.g. `2026-02-24T12:30:00.000Z`).
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// WAIT NODE SETTINGS
// ============================================================================

function WaitSettings({
  data,
  onUpdate,
  variables,
  t,
}: {
  data: WaitNodeData
  onUpdate: (data: Partial<WaitNodeData>) => void
  variables: string[]
  t: (key: string) => string
}) {
  const tw = (key: string) => t(`wait.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wait-for">{tw('waitForLabel')}</Label>
        <Select
          value={data.waitFor || 'message'}
          onValueChange={(value) => onUpdate({ waitFor: value as any })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="message">{tw('message')}</SelectItem>
            <SelectItem value="callbackQuery">{tw('buttonClick')}</SelectItem>
            <SelectItem value="photo">{tw('photo')}</SelectItem>
            <SelectItem value="contact">{tw('contact')}</SelectItem>
            <SelectItem value="location">{tw('location')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="wait-timeout">{tw('timeoutLabel')}</Label>
        <Input
          id="wait-timeout"
          type="number"
          value={data.timeout || 300000}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) })}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">{tw('timeoutHint')}</p>
      </div>

      <div>
        <Label htmlFor="wait-savevar">{tw('saveToVariableLabel')}</Label>
        <VariableAutocompleteInput
          id="wait-savevar"
          value={data.saveToVariable || ''}
          onValueChange={(value) => onUpdate({ saveToVariable: value })}
          placeholder={tw('saveToVariablePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
          variables={variables}
        />
      </div>
    </div>
  )
}

// ============================================================================
// COMMENT NODE SETTINGS
// ============================================================================

function CommentSettings({
  data,
  onUpdate,
  t,
}: {
  data: CommentNodeData
  onUpdate: (data: Partial<CommentNodeData>) => void
  t: (key: string) => string
}) {
  const tco = (key: string) => t(`comment.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="comment-text">{tco('textLabel')}</Label>
        <Textarea
          id="comment-text"
          value={data.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder={tco('textPlaceholder')}
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="comment-color">{tco('colorLabel')}</Label>
        <Select
          value={data.color || 'default'}
          onValueChange={(value) => onUpdate({ color: value as any })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{tco('default')}</SelectItem>
            <SelectItem value="info">{tco('info')}</SelectItem>
            <SelectItem value="warning">{tco('warning')}</SelectItem>
            <SelectItem value="error">{tco('error')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ============================================================================
// INLINE KEYBOARD EDITOR
// ============================================================================

interface InlineKeyboardEditorProps {
  keyboard?: {
    rows: Array<{
      buttons: Array<{
        id: string
        text: string
        callbackData?: string
        callback_data?: string
        url?: string
      }>
    }>
  }
  onChange: (keyboard: any) => void
  t: (key: string) => string
}

function InlineKeyboardEditor({ keyboard, onChange, t }: InlineKeyboardEditorProps) {
  const tk = (key: string) => t(`keyboard.${key}`)
  const tm = (key: string) => t(`message.${key}`)

  const rows =
    keyboard?.rows?.map((row) => ({
      buttons: (row.buttons || []).map((button) => ({
        ...button,
        callbackData: button.callbackData || button.callback_data || '',
      })),
    })) || []
  const buildDefaultCallbackData = (value: string) =>
    `btn:${value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_:-]/g, '')
      .slice(0, 52) || 'button'}`

  const addRow = () => {
    onChange({
      rows: [...rows, { buttons: [] }],
    })
  }

  const removeRow = (index: number) => {
    onChange({
      rows: rows.filter((_, i) => i !== index),
    })
  }

  const addButton = (rowIndex: number) => {
    const newRows = [...rows]
    const id = `btn-${rowIndex}-${newRows[rowIndex].buttons.length + 1}`
    newRows[rowIndex].buttons.push({
      id,
      text: tk('button'),
      callbackData: buildDefaultCallbackData(id),
    })
    onChange({ rows: newRows })
  }

  const updateButton = (
    rowIndex: number,
    buttonIndex: number,
    field: 'text' | 'callbackData' | 'url',
    value: string
  ) => {
    const newRows = [...rows]
    const current = newRows[rowIndex].buttons[buttonIndex]
    current[field] = value

    onChange({ rows: newRows })
  }

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    const newRows = [...rows]
    newRows[rowIndex].buttons = newRows[rowIndex].buttons.filter((_, i) => i !== buttonIndex)
    onChange({ rows: newRows })
  }

  return (
    <div className="space-y-2 mt-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="border border-white/10 rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{tk('row')} {rowIndex + 1}</span>
            <button
              onClick={() => removeRow(rowIndex)}
              className="p-1 rounded hover:bg-red-500/20 text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.buttons.map((button, buttonIndex) => (
              <div
                key={button.id}
                className="w-full space-y-2 bg-zinc-800/50 rounded px-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={button.text}
                    onChange={(e) => updateButton(rowIndex, buttonIndex, 'text', e.target.value)}
                    placeholder={tk('button')}
                    className="h-8 bg-zinc-900/40 border-white/10 text-sm"
                  />
                  <button
                    onClick={() => removeButton(rowIndex, buttonIndex)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <Input
                  value={button.callbackData || ''}
                  onChange={(e) => updateButton(rowIndex, buttonIndex, 'callbackData', e.target.value)}
                  placeholder={tk('callbackPlaceholder')}
                  className="h-8 bg-zinc-900/40 border-white/10 text-xs font-mono"
                />
              </div>
            ))}
            <button
              onClick={() => addButton(rowIndex)}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-zinc-400 text-sm"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button
        onClick={addRow}
        variant="outline"
        size="sm"
        className="w-full gap-2 border-white/10"
      >
        <Plus className="w-4 h-4" />
        {tm('addRow')}
      </Button>
    </div>
  )
}
