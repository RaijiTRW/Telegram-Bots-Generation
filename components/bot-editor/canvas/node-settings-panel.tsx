'use client'

import { useState, useEffect, useCallback } from 'react'
import { Node } from 'reactflow'
import {
  MessageSquare,
  Keyboard,
  GitBranch,
  Zap,
  Webhook,
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
  WebhookNodeData,
  TriggerNodeData,
  WaitNodeData,
  CommentNodeData,
  ParseMode,
  ComparisonOperator,
  HttpMethod,
  ActionType,
  NodeConfig,
} from '@/lib/bot-editor/types/component-schemas'
import { NODE_CONFIGS, DEFAULT_NODE_DATA } from '@/lib/bot-editor/types/component-schemas'
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
  webhook: Webhook,
  trigger: Play,
  wait: Clock,
  comment: MessageCircle,
}

export function NodeSettingsPanel({ node, onUpdate, onClose, variables = [] }: NodeSettingsPanelProps) {
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
          <p>Выберите компонент для редактирования</p>
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
              <p className="text-xs text-zinc-500">ID: {node.id}</p>
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
          />
        )}
        {nodeType === 'input' && (
          <InputSettings
            data={data as InputNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'condition' && (
          <ConditionSettings
            data={data as ConditionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'action' && (
          <ActionSettings
            data={data as ActionNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'webhook' && (
          <WebhookSettings
            data={data as WebhookNodeData}
            onUpdate={handleUpdate}
            variables={variables}
          />
        )}
        {nodeType === 'trigger' && (
          <TriggerSettings
            data={data as TriggerNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {nodeType === 'wait' && (
          <WaitSettings
            data={data as WaitNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {nodeType === 'comment' && (
          <CommentSettings
            data={data as CommentNodeData}
            onUpdate={handleUpdate}
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
            Сохранить
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
}: {
  data: MessageNodeData
  onUpdate: (data: Partial<MessageNodeData>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="msg-text">Текст сообщения</Label>
        <Textarea
          id="msg-text"
          value={data.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Введите текст сообщения..."
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Используйте {'{{переменная}}'} для вставки значений
        </p>
      </div>

      <div>
        <Label htmlFor="msg-parsemode">Форматирование</Label>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">Без форматирования</SelectItem>
            <SelectItem value="Markdown">Markdown</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="HTML">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-preview">Отключить превью ссылок</Label>
          <Switch
            id="msg-preview"
            checked={data.disableWebPagePreview || false}
            onCheckedChange={(checked) => onUpdate({ disableWebPagePreview: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="msg-silent">Тихий режим (без звука)</Label>
          <Switch
            id="msg-silent"
            checked={data.disableNotification || false}
            onCheckedChange={(checked) => onUpdate({ disableNotification: checked })}
          />
        </div>
      </div>

      <div>
        <Label>Вложения</Label>
        <div className="mt-2 p-3 rounded-lg bg-zinc-800/30 border border-white/10 text-center text-zinc-500 text-sm">
          Редактор вложений скоро будет доступен
        </div>
      </div>

      <div>
        <Label>Клавиатура (кнопки)</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
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
}: {
  data: InputNodeData
  onUpdate: (data: Partial<InputNodeData>) => void
  variables: string[]
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="input-question">Вопрос пользователю</Label>
        <Textarea
          id="input-question"
          value={data.question || ''}
          onChange={(e) => onUpdate({ question: e.target.value })}
          placeholder="Задайте вопрос..."
          rows={3}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="input-varname">Имя переменной</Label>
        <Input
          id="input-varname"
          value={data.variableName || ''}
          onChange={(e) => onUpdate({ variableName: e.target.value })}
          placeholder="user_name"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">
          Ответ будет сохранён в эту переменную
        </p>
      </div>

      <div>
        <Label htmlFor="input-parsemode">Форматирование</Label>
        <Select
          value={data.parseMode || 'None'}
          onValueChange={(value) => onUpdate({ parseMode: value as ParseMode })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">Без форматирования</SelectItem>
            <SelectItem value="Markdown">Markdown</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="HTML">HTML</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="input-skip">Кнопка "Пропустить"</Label>
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
            placeholder="Значение при пропуске"
            className="bg-zinc-800/50 border-white/10"
          />
        )}
      </div>

      <div>
        <Label>Клавиатура</Label>
        <InlineKeyboardEditor
          keyboard={data.keyboard}
          onChange={(keyboard) => onUpdate({ keyboard })}
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
}: {
  data: ConditionNodeData
  onUpdate: (data: Partial<ConditionNodeData>) => void
  variables: string[]
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cond-var">Переменная</Label>
        <Select
          value={data.variable || ''}
          onValueChange={(value) => onUpdate({ variable: value })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue placeholder="Выберите переменную" />
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
        <Label htmlFor="cond-op">Условие</Label>
        <Select
          value={data.operator || 'equals'}
          onValueChange={(value) => onUpdate({ operator: value as ComparisonOperator })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">равно</SelectItem>
            <SelectItem value="notEquals">не равно</SelectItem>
            <SelectItem value="contains">содержит</SelectItem>
            <SelectItem value="notContains">не содержит</SelectItem>
            <SelectItem value="gt">больше чем</SelectItem>
            <SelectItem value="lt">меньше чем</SelectItem>
            <SelectItem value="gte">больше или равно</SelectItem>
            <SelectItem value="lte">меньше или равно</SelectItem>
            <SelectItem value="isEmpty">пусто</SelectItem>
            <SelectItem value="isNotEmpty">не пусто</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="cond-value">Значение</Label>
        <Input
          id="cond-value"
          value={data.value || ''}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Значение для сравнения"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div className="p-3 rounded-lg bg-zinc-800/30 border border-white/10">
        <p className="text-sm text-zinc-400">
          Если <span className="text-white font-medium">{'{{'}{data.variable || 'переменная'}{ '}}'}</span>{' '}
          {data.operator === 'equals' && 'равно'}
          {data.operator === 'notEquals' && 'не равно'}
          {data.operator === 'contains' && 'содержит'}
          {data.operator === 'gt' && 'больше чем'}
          {data.operator === 'lt' && 'меньше чем'}
          {' '}
          <span className="text-white font-medium">"{data.value || '...'}"</span>
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
}: {
  data: ActionNodeData
  onUpdate: (data: Partial<ActionNodeData>) => void
  variables: string[]
}) {
  const actionType = data.action?.type || 'setVariable'

  return (
    <Tabs defaultValue="action" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-zinc-800/50">
        <TabsTrigger value="action">Действие</TabsTrigger>
        <TabsTrigger value="error">Ошибка</TabsTrigger>
      </TabsList>

      <TabsContent value="action" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-type">Тип действия</Label>
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
              <SelectItem value="setVariable">Установить переменную</SelectItem>
              <SelectItem value="httpRequest">HTTP запрос</SelectItem>
              <SelectItem value="delay">Задержка</SelectItem>
              <SelectItem value="deleteMessage">Удалить сообщение</SelectItem>
              <SelectItem value="random">Случайный выбор</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionType === 'setVariable' && (
          <>
            <div>
              <Label htmlFor="setvar-name">Имя переменной</Label>
              <Input
                id="setvar-name"
                value={(data.action as any)?.variableName || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...(data.action as any), variableName: e.target.value } as any,
                  })
                }
                placeholder="my_variable"
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="setvar-value">Значение</Label>
              <Textarea
                id="setvar-value"
                value={(data.action as any)?.value || ''}
                onChange={(e) =>
                  onUpdate({
                    action: { ...(data.action as any), value: e.target.value } as any,
                  })
                }
                placeholder="Значение или {{переменная}}"
                rows={2}
                className="mt-1.5 bg-zinc-800/50 border-white/10"
              />
            </div>
          </>
        )}

        {actionType === 'delay' && (
          <div>
            <Label htmlFor="delay-duration">Задержка (мс)</Label>
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
            <Label htmlFor="delete-delay">Удалить через (мс)</Label>
            <Input
              id="delete-delay"
              type="number"
              value={(data.action as any)?.delay || 0}
              onChange={(e) =>
                onUpdate({
                  action: { ...(data.action as any), delay: Number(e.target.value) } as any,
                })
              }
              placeholder="0 - сразу"
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="error" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="action-onerror">При ошибке</Label>
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
              <SelectItem value="continue">Продолжить</SelectItem>
              <SelectItem value="stop">Остановить</SelectItem>
              <SelectItem value="retry">Повторить</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.onError === 'retry' && (
          <div>
            <Label htmlFor="retry-count">Количество попыток</Label>
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
// WEBHOOK NODE SETTINGS
// ============================================================================

function WebhookSettings({
  data,
  onUpdate,
  variables,
}: {
  data: WebhookNodeData
  onUpdate: (data: Partial<WebhookNodeData>) => void
  variables: string[]
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="webhook-url">URL</Label>
        <Input
          id="webhook-url"
          value={data.url || ''}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="webhook-method">Метод</Label>
        <Select
          value={data.method || 'GET'}
          onValueChange={(value) => onUpdate({ method: value as HttpMethod })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(data.method === 'POST' || data.method === 'PUT' || data.method === 'PATCH') && (
        <>
          <div>
            <Label htmlFor="webhook-bodytype">Тип тела запроса</Label>
            <Select
              value={data.bodyType || 'json'}
              onValueChange={(value) => onUpdate({ bodyType: value as 'json' | 'form' | 'raw' })}
            >
              <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="form">Form Data</SelectItem>
                <SelectItem value="raw">Raw</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="webhook-body">Тело запроса</Label>
            <Textarea
              id="webhook-body"
              value={typeof data.body === 'string' ? data.body : JSON.stringify(data.body || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  onUpdate({ body: parsed })
                } catch {
                  onUpdate({ body: e.target.value })
                }
              }}
              placeholder='{"key": "value"}'
              rows={4}
              className="mt-1.5 bg-zinc-800/50 border-white/10 font-mono text-sm"
            />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="webhook-savevar">Сохранить ответ в</Label>
        <Input
          id="webhook-savevar"
          value={data.saveToVariable || ''}
          onChange={(e) => onUpdate({ saveToVariable: e.target.value })}
          placeholder="api_response"
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
}: {
  data: TriggerNodeData
  onUpdate: (data: Partial<TriggerNodeData>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trigger-type">Тип триггера</Label>
        <Select
          value={data.trigger || 'command'}
          onValueChange={(value) => onUpdate({ trigger: value as any })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">Команда</SelectItem>
            <SelectItem value="text">Текст</SelectItem>
            <SelectItem value="callbackQuery">Callback Query</SelectItem>
            <SelectItem value="photo">Фото</SelectItem>
            <SelectItem value="any">Любое сообщение</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(data.trigger === 'command' || data.trigger === 'text') && (
        <div>
          <Label htmlFor="trigger-pattern">
            {data.trigger === 'command' ? 'Команда' : 'Шаблон текста'}
          </Label>
          <Input
            id="trigger-pattern"
            value={data.pattern || ''}
            onChange={(e) => onUpdate({ pattern: e.target.value })}
            placeholder={data.trigger === 'command' ? '/start' : 'Привет'}
            className="mt-1.5 bg-zinc-800/50 border-white/10"
          />
        </div>
      )}

      <div>
        <Label htmlFor="trigger-desc">Описание</Label>
        <Input
          id="trigger-desc"
          value={data.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Описание точки входа"
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
}: {
  data: WaitNodeData
  onUpdate: (data: Partial<WaitNodeData>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="wait-for">Ожидать</Label>
        <Select
          value={data.waitFor || 'message'}
          onValueChange={(value) => onUpdate({ waitFor: value as any })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="message">Сообщение</SelectItem>
            <SelectItem value="callbackQuery">Нажатие кнопки</SelectItem>
            <SelectItem value="photo">Фото</SelectItem>
            <SelectItem value="contact">Контакт</SelectItem>
            <SelectItem value="location">Локация</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="wait-timeout">Таймаут (мс)</Label>
        <Input
          id="wait-timeout"
          type="number"
          value={data.timeout || 300000}
          onChange={(e) => onUpdate({ timeout: Number(e.target.value) })}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
        <p className="text-xs text-zinc-500 mt-1">300000 мс = 5 минут</p>
      </div>

      <div>
        <Label htmlFor="wait-savevar">Сохранить в переменную</Label>
        <Input
          id="wait-savevar"
          value={data.saveToVariable || ''}
          onChange={(e) => onUpdate({ saveToVariable: e.target.value })}
          placeholder="user_input"
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
}: {
  data: CommentNodeData
  onUpdate: (data: Partial<CommentNodeData>) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="comment-text">Текст комментария</Label>
        <Textarea
          id="comment-text"
          value={data.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Оставьте заметку..."
          rows={4}
          className="mt-1.5 bg-zinc-800/50 border-white/10"
        />
      </div>

      <div>
        <Label htmlFor="comment-color">Цвет</Label>
        <Select
          value={data.color || 'default'}
          onValueChange={(value) => onUpdate({ color: value as any })}
        >
          <SelectTrigger className="mt-1.5 bg-zinc-800/50 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Обычный</SelectItem>
            <SelectItem value="info">Информация</SelectItem>
            <SelectItem value="warning">Предупреждение</SelectItem>
            <SelectItem value="error">Ошибка</SelectItem>
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
    rows: Array<{ buttons: Array<{ id: string; text: string; callbackData?: string }> }>
  }
  onChange: (keyboard: any) => void
}

function InlineKeyboardEditor({ keyboard, onChange }: InlineKeyboardEditorProps) {
  const rows = keyboard?.rows || []

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
    newRows[rowIndex].buttons.push({
      id: `btn-${Date.now()}`,
      text: 'Кнопка',
      callbackData: `action_${Date.now()}`,
    })
    onChange({ rows: newRows })
  }

  const updateButton = (
    rowIndex: number,
    buttonIndex: number,
    field: 'text' | 'callbackData',
    value: string
  ) => {
    const newRows = [...rows]
    newRows[rowIndex].buttons[buttonIndex][field] = value
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
            <span className="text-xs text-zinc-500">Ряд {rowIndex + 1}</span>
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
                className="flex items-center gap-1 bg-zinc-800/50 rounded px-2 py-1"
              >
                <input
                  value={button.text}
                  onChange={(e) => updateButton(rowIndex, buttonIndex, 'text', e.target.value)}
                  className="bg-transparent text-sm text-white w-20 outline-none"
                />
                <button
                  onClick={() => removeButton(rowIndex, buttonIndex)}
                  className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
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
        Добавить ряд
      </Button>
    </div>
  )
}
