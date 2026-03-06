'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import type { DocsBlock } from '@/lib/docs-cms/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  blocks: DocsBlock[]
  setBlocks: (next: DocsBlock[]) => void
  markDirty: () => void
  isRu: boolean
}

const BLOCK_TYPES: Array<{ value: DocsBlock['type']; labelRu: string; labelEn: string }> = [
  { value: 'heading', labelRu: 'Заголовок', labelEn: 'Heading' },
  { value: 'paragraph', labelRu: 'Параграф', labelEn: 'Paragraph' },
  { value: 'list', labelRu: 'Список', labelEn: 'List' },
  { value: 'callout', labelRu: 'Блок заметки', labelEn: 'Callout' },
  { value: 'table', labelRu: 'Таблица', labelEn: 'Table' },
  { value: 'image', labelRu: 'Изображение', labelEn: 'Image' },
  { value: 'video', labelRu: 'Видео', labelEn: 'Video' },
  { value: 'videoEmbed', labelRu: 'Видеовставка', labelEn: 'Video embed' },
  { value: 'button', labelRu: 'Кнопка', labelEn: 'Button' },
  { value: 'divider', labelRu: 'Разделитель', labelEn: 'Divider' },
  { value: 'code', labelRu: 'Код', labelEn: 'Code' },
]

function blockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function listToText(items: string[]): string {
  return items.join('\n')
}

function textToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function rowsToText(rows: string[][]): string {
  return rows.map((row) => row.join(' | ')).join('\n')
}

function textToRows(text: string): string[][] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
}

function createEmptyBlock(type: DocsBlock['type'], isRu: boolean): DocsBlock {
  switch (type) {
    case 'heading':
      return { id: blockId('heading'), type: 'heading', level: 2, text: isRu ? 'Новый заголовок' : 'New heading' }
    case 'paragraph':
      return { id: blockId('paragraph'), type: 'paragraph', richText: isRu ? 'Новый текст' : 'New text' }
    case 'list':
      return { id: blockId('list'), type: 'list', ordered: false, items: [isRu ? 'Пункт 1' : 'Item 1'] }
    case 'callout':
      return {
        id: blockId('callout'),
        type: 'callout',
        tone: 'info',
        title: isRu ? 'Заметка' : 'Note',
        text: isRu ? 'Текст заметки' : 'Callout text',
      }
    case 'table':
      return {
        id: blockId('table'),
        type: 'table',
        columns: [isRu ? 'Колонка 1' : 'Column 1', isRu ? 'Колонка 2' : 'Column 2'],
        rows: [[isRu ? 'Значение 1' : 'Value 1', isRu ? 'Значение 2' : 'Value 2']],
      }
    case 'image':
      return { id: blockId('image'), type: 'image', assetId: null, url: '', alt: '', caption: '' }
    case 'video':
      return { id: blockId('video'), type: 'video', assetId: null, url: '', caption: '', posterUrl: '' }
    case 'videoEmbed':
      return { id: blockId('video-embed'), type: 'videoEmbed', provider: 'other', url: '', caption: '' }
    case 'button':
      return { id: blockId('button'), type: 'button', label: isRu ? 'Открыть' : 'Open', url: '', variant: 'default' }
    case 'divider':
      return { id: blockId('divider'), type: 'divider' }
    case 'code':
      return { id: blockId('code'), type: 'code', language: 'text', code: '' }
    case 'richText':
      return { id: blockId('rich-text'), type: 'richText', content: '' }
    default:
      return { id: blockId('paragraph'), type: 'paragraph', richText: '' }
  }
}

export function DocsCmsBlockEditor({ blocks, setBlocks, markDirty, isRu }: Props) {
  const [newType, setNewType] = useState<DocsBlock['type']>('paragraph')

  const typeLabel = useMemo(() => {
    const labels = new Map(BLOCK_TYPES.map((item) => [item.value, isRu ? item.labelRu : item.labelEn]))
    return (type: DocsBlock['type']) => labels.get(type) || type
  }, [isRu])

  const replaceBlocks = (next: DocsBlock[]) => {
    setBlocks(next)
    markDirty()
  }

  const updateAt = (index: number, block: DocsBlock) => {
    const next = [...blocks]
    next[index] = block
    replaceBlocks(next)
  }

  const removeAt = (index: number) => {
    const next = blocks.filter((_, i) => i !== index)
    replaceBlocks(next)
  }

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= blocks.length) return
    const next = [...blocks]
    const [current] = next.splice(index, 1)
    next.splice(nextIndex, 0, current)
    replaceBlocks(next)
  }

  const addBlock = () => {
    replaceBlocks([...blocks, createEmptyBlock(newType, isRu)])
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-white/10 bg-zinc-950/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={newType}
            onChange={(event) => setNewType(event.target.value as DocsBlock['type'])}
            className="h-9 rounded-md border border-white/10 bg-zinc-900/60 px-3 text-sm text-white"
          >
            {BLOCK_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {isRu ? option.labelRu : option.labelEn}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={addBlock}>
            <Plus className="h-4 w-4 mr-1" />
            {isRu ? 'Добавить компонент' : 'Add component'}
          </Button>
        </div>
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-lg border border-white/10 bg-zinc-950/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-zinc-400">{typeLabel(block.type)}</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-300" onClick={() => removeAt(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {block.type === 'heading' ? (
            <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-2">
              <select
                value={block.level}
                onChange={(event) =>
                  updateAt(index, { ...block, level: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })
                }
                className="h-9 rounded-md border border-white/10 bg-zinc-900/60 px-3 text-sm text-white"
              >
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <option key={level} value={level}>{`H${level}`}</option>
                ))}
              </select>
              <Input
                value={block.text}
                onChange={(event) => updateAt(index, { ...block, text: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
              />
            </div>
          ) : null}

          {block.type === 'paragraph' ? (
            <Textarea
              value={block.richText}
              onChange={(event) => updateAt(index, { ...block, richText: event.target.value })}
              rows={4}
              className="bg-zinc-900/60 border-white/10"
            />
          ) : null}

          {block.type === 'list' ? (
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={block.ordered}
                  onChange={(event) => updateAt(index, { ...block, ordered: event.target.checked })}
                />
                {isRu ? 'Нумерованный список' : 'Ordered list'}
              </label>
              <Textarea
                value={listToText(block.items)}
                onChange={(event) => updateAt(index, { ...block, items: textToList(event.target.value) })}
                rows={5}
                className="bg-zinc-900/60 border-white/10"
              />
            </div>
          ) : null}

          {block.type === 'callout' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
                <select
                  value={block.tone}
                  onChange={(event) =>
                    updateAt(index, {
                      ...block,
                      tone: event.target.value as 'info' | 'success' | 'warning' | 'danger',
                    })
                  }
                  className="h-9 rounded-md border border-white/10 bg-zinc-900/60 px-3 text-sm text-white"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
                <Input
                  value={block.title}
                  onChange={(event) => updateAt(index, { ...block, title: event.target.value })}
                  className="bg-zinc-900/60 border-white/10"
                />
              </div>
              <Textarea
                value={block.text}
                onChange={(event) => updateAt(index, { ...block, text: event.target.value })}
                rows={4}
                className="bg-zinc-900/60 border-white/10"
              />
            </div>
          ) : null}

          {block.type === 'table' ? (
            <div className="space-y-2">
              <Input
                value={block.columns.join(' | ')}
                onChange={(event) =>
                  updateAt(
                    index,
                    {
                      ...block,
                      columns: event.target.value
                        .split('|')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }
                  )
                }
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Колонки через |' : 'Columns separated by |'}
              />
              <Textarea
                value={rowsToText(block.rows)}
                onChange={(event) => updateAt(index, { ...block, rows: textToRows(event.target.value) })}
                rows={5}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Каждая строка с новой строки, ячейки через |' : 'One row per line, cells separated by |'}
              />
            </div>
          ) : null}

          {block.type === 'image' ? (
            <div className="space-y-2">
              <Input
                value={block.url}
                onChange={(event) => updateAt(index, { ...block, url: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder="https://..."
              />
              <Input
                value={block.alt}
                onChange={(event) => updateAt(index, { ...block, alt: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Alt текст' : 'Alt text'}
              />
              <Input
                value={block.caption}
                onChange={(event) => updateAt(index, { ...block, caption: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Подпись' : 'Caption'}
              />
            </div>
          ) : null}

          {block.type === 'video' ? (
            <div className="space-y-2">
              <Input
                value={block.url}
                onChange={(event) => updateAt(index, { ...block, url: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder="https://..."
              />
              <Input
                value={block.posterUrl}
                onChange={(event) => updateAt(index, { ...block, posterUrl: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'URL постера (опц.)' : 'Poster URL (optional)'}
              />
              <Input
                value={block.caption}
                onChange={(event) => updateAt(index, { ...block, caption: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Подпись / описание' : 'Caption / description'}
              />
            </div>
          ) : null}

          {block.type === 'videoEmbed' ? (
            <div className="space-y-2">
              <select
                value={block.provider}
                onChange={(event) =>
                  updateAt(index, { ...block, provider: event.target.value as 'youtube' | 'vimeo' | 'other' })
                }
                className="h-9 rounded-md border border-white/10 bg-zinc-900/60 px-3 text-sm text-white"
              >
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="other">Other</option>
              </select>
              <Input
                value={block.url}
                onChange={(event) => updateAt(index, { ...block, url: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder="https://..."
              />
              <Input
                value={block.caption}
                onChange={(event) => updateAt(index, { ...block, caption: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Подпись' : 'Caption'}
              />
            </div>
          ) : null}

          {block.type === 'button' ? (
            <div className="space-y-2">
              <Input
                value={block.label}
                onChange={(event) => updateAt(index, { ...block, label: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Текст кнопки' : 'Button label'}
              />
              <Input
                value={block.url}
                onChange={(event) => updateAt(index, { ...block, url: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder="https://..."
              />
              <select
                value={block.variant}
                onChange={(event) =>
                  updateAt(index, { ...block, variant: event.target.value as 'default' | 'outline' | 'ghost' })
                }
                className="h-9 rounded-md border border-white/10 bg-zinc-900/60 px-3 text-sm text-white"
              >
                <option value="default">Default</option>
                <option value="outline">Outline</option>
                <option value="ghost">Ghost</option>
              </select>
            </div>
          ) : null}

          {block.type === 'code' ? (
            <div className="space-y-2">
              <Input
                value={block.language}
                onChange={(event) => updateAt(index, { ...block, language: event.target.value })}
                className="bg-zinc-900/60 border-white/10"
                placeholder={isRu ? 'Язык (js, ts, bash...)' : 'Language (js, ts, bash...)'}
              />
              <Textarea
                value={block.code}
                onChange={(event) => updateAt(index, { ...block, code: event.target.value })}
                rows={8}
                className="bg-zinc-900/60 border-white/10 font-mono"
              />
            </div>
          ) : null}

          {block.type === 'divider' ? (
            <div className="text-xs text-zinc-500">{isRu ? 'Разделитель без настроек' : 'Divider has no settings'}</div>
          ) : null}

          {block.type === 'richText' ? (
            <Textarea
              value={block.content}
              onChange={(event) => updateAt(index, { ...block, content: event.target.value })}
              rows={8}
              className="bg-zinc-900/60 border-white/10"
            />
          ) : null}
        </div>
      ))}

      {blocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-zinc-500 text-center">
          {isRu ? 'Добавьте первый компонент' : 'Add your first component'}
        </div>
      ) : null}
    </div>
  )
}
