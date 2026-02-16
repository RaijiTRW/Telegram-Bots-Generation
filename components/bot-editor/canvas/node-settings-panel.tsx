'use client'

import { useState, useEffect, useCallback } from 'react'
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
  ActionNodeData,
  HttpNodeData,
  WebhookNodeData,
  TriggerNodeData,
  WaitNodeData,
  CommentNodeData,
  ParseMode,
  ComparisonOperator,
  HttpMethod,
} from '@/lib/bot-editor/types/component-schemas'
import { NODE_CONFIGS } from '@/lib/bot-editor/types/component-schemas'
import type { NodeType } from '@/lib/bot-editor/types/bot.types'

interface NodeSettingsPanelProps {
  node: Node | null
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void
  onClose: () => void
  variables?: string[] // Available variable names
}

// Icons map
const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  input: Keyboard,
  condition: GitBranch,
  action: Zap,
  http: Globe,
  webhook: Webhook,
  trigger: Play,
  wait: Clock,
  comment: MessageCircle,
}

export function NodeSettingsPanel({ node, onUpdate, onClose, variables = [] }: NodeSettingsPanelProps) {
  const t = useTranslations('editor.nodeSettings')
  const [data, setData] = useState<Partial<NodeData>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (node) {
      setData(node.data as NodeData)
      setHasChanges(false)
    }
  }, [node])

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

  const handleSave = () => {
    onUpdate(node.id, data)
    setHasChanges(false)
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
            t={t}
          />
        )}
        {nodeType === 'webhook' && (
          <HttpSettings
            data={data as WebhookNodeData}
            onUpdate={handleUpdate}
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
            t={t}
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

function MessageSettings({
  data,
  onUpdate,
  t,
}: {
  data: MessageNodeData
  onUpdate: (data: Partial<MessageNodeData>) => void
  t: (key: string) => string
}) {
  const tm = (key: string) => t(`message.${key}`)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="msg-text">{tm('textLabel')}</Label>
        <Textarea
          id="msg-text"
          value={data.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder={tm('textPlaceholder')}
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">
          {tm('variableHint')}
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
        <div className="mt-2 p-3 rounded-lg bg-zinc-800/30 border border-white/10 text-center text-zinc-500 text-sm">
          {tm('attachmentsComingSoon')}
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
        <Textarea
          id="input-question"
          value={data.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder={ti('questionPlaceholder')}
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="input-varname">{ti('variableNameLabel')}</Label>
        <Input
          id="input-varname"
          value={data.variableName || ''}
          onChange={(e) => onUpdate({ variableName: e.target.value })}
          placeholder={ti('variableNamePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
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
  t: (key: string) => string
}) {
  const tc = (key: string) => t(`condition.${key}`)

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
            {variables.map((v) => (
              <SelectItem key={v} value={v}>
                {'{{'} + {v} + {'}}'}
              </SelectItem>
            ))}
            <SelectItem value="user.id">user.id</SelectItem>
            <SelectItem value="user.username">user.username</SelectItem>
            <SelectItem value="user.firstName">user.firstName</SelectItem>
            <SelectItem value="user.lastName">user.lastName</SelectItem>
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
  const ta = (key: string) => t(`action.${key}`)
  const actionType = data.action?.type || 'setVariable'

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
                action: { type: value as any, variableName: '', value: '' },
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
              <Input
                id="setvar-name"
                value={(data.action as any)?.variableName || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...(data.action as any), variableName: e.target.value } as any,
                  })
                }
                placeholder={ta('variableNamePlaceholder')}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="setvar-value">{ta('valueLabel')}</Label>
              <Textarea
                id="setvar-value"
                value={(data.action as any)?.value || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...(data.action as any), value: e.target.value } as any,
                  })
                }
                placeholder={ta('valuePlaceholder')}
                rows={2}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
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
  t,
}: {
  data: HttpLikeData
  onUpdate: (data: Partial<HttpLikeData>) => void
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
              <Textarea
                id="http-body"
                value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || {}, null, 2)}
                onChange={(e) => onUpdate({ body: e.target.value })}
                placeholder={th('bodyPlaceholder')}
                rows={5}
                className="mt-1.5 bg-zinc-800/50 border-white/10 font-mono text-sm"
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
        <Input
          id="http-savevar"
          value={data.saveToVariable || ''}
          onChange={(e) => onUpdate({ saveToVariable: e.target.value })}
          placeholder={th('saveResponsePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
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
// WAIT NODE SETTINGS
// ============================================================================

function WaitSettings({
  data,
  onUpdate,
  t,
}: {
  data: WaitNodeData
  onUpdate: (data: Partial<WaitNodeData>) => void
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
        <Input
          id="wait-savevar"
          value={data.saveToVariable || ''}
          onChange={(e) => onUpdate({ saveToVariable: e.target.value })}
          placeholder={tw('saveToVariablePlaceholder')}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
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
