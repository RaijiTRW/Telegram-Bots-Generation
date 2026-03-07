'use client'
import { useEffect, useRef, useState } from 'react'
import { Cpu, Zap, Database, Code2, Info, Keyboard, Plus, Trash2, ChevronDown, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { VariablesTable } from './variables-table'
import { HelpGuideButton } from '@/components/bot-editor/help/help-guide-button'
import { useBotState } from '../providers/bot-state-provider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AutoReactionsConfig = {
  enabled: boolean
  cooldownSeconds: number
  onlyTextMessages: boolean
}

type SubscriberModeConfig = {
  enabled: boolean
  privateChatsOnly: boolean
  trackCallbacks: boolean
}

type ReplyKeyboardButtonStyle = 'default' | 'primary' | 'success' | 'danger'

type ReplyKeyboardButtonConfig = {
  id: string
  text: string
  emoji?: string
  style?: ReplyKeyboardButtonStyle
  iconCustomEmojiId?: string
}

type EmojiPickerCategoryId =
  | 'recent'
  | 'smileys'
  | 'gestures'
  | 'travel'
  | 'objects'
  | 'symbols'

type EmojiPickerCategory = {
  id: EmojiPickerCategoryId
  icon: string
  label: string
  emojis: string[]
}

type ReplyKeyboardRuleConfig = {
  id: string
  name: string
  enabled: boolean
  variable: string
  operator:
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'
  value: string
  rows: ReplyKeyboardButtonConfig[][]
}

type ReplyKeyboardSystemConfig = {
  enabled: boolean
  resizeKeyboard: boolean
  oneTimeKeyboard: boolean
  isPersistent: boolean
  baseRows: ReplyKeyboardButtonConfig[][]
  rules: ReplyKeyboardRuleConfig[]
}

function createReplyKeyboardButtonId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `btn_${crypto.randomUUID().slice(0, 8)}`
  }
  return `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function createReplyKeyboardButton(
  patch?: Partial<ReplyKeyboardButtonConfig>
): ReplyKeyboardButtonConfig {
  return {
    id: createReplyKeyboardButtonId(),
    text: '',
    emoji: '',
    style: 'default',
    iconCustomEmojiId: '',
    ...patch,
  }
}

function normalizeReplyKeyboardButtonStyle(value: unknown): ReplyKeyboardButtonStyle {
  const raw = String(value || '').trim()
  if (raw === 'primary' || raw === 'success' || raw === 'danger') {
    return raw
  }
  return 'default'
}

function normalizeReplyKeyboardRows(value: unknown): ReplyKeyboardButtonConfig[][] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!Array.isArray(row)) return []
      return row
        .map((button) => {
          if (typeof button === 'string') {
            const text = button.trim()
            if (!text) return null
            return createReplyKeyboardButton({ text })
          }

          if (!button || typeof button !== 'object') {
            return null
          }

          const record = button as Record<string, unknown>
          const text = String(record.text ?? '').trim()
          const emoji = String(record.emoji ?? '').trim()
          const iconCustomEmojiId = String(
            record.iconCustomEmojiId ?? record.icon_custom_emoji_id ?? ''
          ).trim()
          if (!text && !emoji) {
            return null
          }

          return createReplyKeyboardButton({
            id: String(record.id || '').trim() || createReplyKeyboardButtonId(),
            text,
            emoji,
            style: normalizeReplyKeyboardButtonStyle(record.style),
            iconCustomEmojiId,
          })
        })
        .filter((button): button is ReplyKeyboardButtonConfig => Boolean(button))
        .slice(0, 10)
    })
    .filter((row) => row.length > 0)
    .slice(0, 12)
}

const REPLY_KEYBOARD_STYLE_PREVIEW_CLASS: Record<ReplyKeyboardButtonStyle, string> = {
  default: 'bg-zinc-800/90 border-white/10 text-zinc-200',
  primary: 'bg-sky-500/15 border-sky-400/30 text-sky-200',
  success: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200',
  danger: 'bg-rose-500/15 border-rose-400/30 text-rose-200',
}

const REPLY_KEYBOARD_STYLE_OPTIONS: Array<{
  value: ReplyKeyboardButtonStyle
  label: string
  dotClassName: string
}> = [
    { value: 'default', label: 'Default', dotClassName: 'bg-zinc-300' },
    { value: 'primary', label: 'Primary', dotClassName: 'bg-sky-400' },
    { value: 'success', label: 'Success', dotClassName: 'bg-emerald-400' },
    { value: 'danger', label: 'Danger', dotClassName: 'bg-rose-400' },
  ]

const EMOJI_PICKER_RECENT_STORAGE_KEY = 'tflow.replyKeyboard.emojiPickerRecent'
const EMOJI_PICKER_MAX_RECENT = 18

const EMOJI_PICKER_BASE_CATEGORIES: EmojiPickerCategory[] = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'Smileys',
    emojis: ['😀', '😄', '😁', '😂', '😊', '😉', '😍', '😘', '😎', '🤓', '🤖', '🥳', '😇', '🙂', '🙃', '😌', '🤗', '🤔', '😴', '😭', '😡', '😱', '🤯', '🥶', '😅', '🤣', '😬', '🫠', '🥹', '😏'],
  },
  {
    id: 'gestures',
    icon: '👍',
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '💪', '👋', '👌', '🤝', '✌️', '🤟', '🫶', '👀', '❤️', '🔥', '⚡', '💯', '✅', '❌', '❓', '❗', '🎯', '💡', '🚀'],
  },
  {
    id: 'travel',
    icon: '🚗',
    label: 'Travel',
    emojis: ['🚗', '🚕', '🛻', '🏎️', '🚙', '🚌', '🚎', '🚑', '🚓', '🚒', '🚲', '🛴', '🚂', '✈️', '🚁', '🚀', '🛸', '🗺️', '🏝️', '🏙️', '🗽'],
  },
  {
    id: 'objects',
    icon: '💼',
    label: 'Objects',
    emojis: ['💼', '📦', '📌', '📎', '✏️', '🖊️', '📚', '📱', '💻', '⌚', '🎧', '📷', '🔍', '🔒', '🔑', '🧠', '⚙️', '🛠️', '🧰', '🧪', '🧲', '💳', '🧾'],
  },
  {
    id: 'symbols',
    icon: '⭐',
    label: 'Symbols',
    emojis: ['⭐', '🌟', '✨', '🔔', '📍', '🎉', '🏆', '🥇', '📈', '📉', '🟢', '🟡', '🔴', '⚫', '🔵', '🟣', '➕', '➖', '➡️', '⬅️', '⬆️', '⬇️', '🔁', '🔄'],
  },
]

function readRecentEmojis(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(EMOJI_PICKER_RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, EMOJI_PICKER_MAX_RECENT)
  } catch {
    return []
  }
}

function writeRecentEmojis(values: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      EMOJI_PICKER_RECENT_STORAGE_KEY,
      JSON.stringify(values.slice(0, EMOJI_PICKER_MAX_RECENT))
    )
  } catch {
    // ignore
  }
}

function buildEmojiPickerCategories(recent: string[]): EmojiPickerCategory[] {
  return [
    { id: 'recent', icon: '🕘', label: 'Recent', emojis: recent },
    ...EMOJI_PICKER_BASE_CATEGORIES,
  ]
}

function getEmojiPickerCategoryLabel(
  categoryId: EmojiPickerCategoryId,
  t?: (key: string, values?: Record<string, unknown>) => string
): string {
  if (!t) {
    if (categoryId === 'recent') return 'Recent'
    return (
      EMOJI_PICKER_BASE_CATEGORIES.find((category) => category.id === categoryId)?.label ||
      String(categoryId)
    )
  }

  const keyMap: Record<EmojiPickerCategoryId, string> = {
    recent: 'emojiPicker.categories.recent',
    smileys: 'emojiPicker.categories.smileys',
    gestures: 'emojiPicker.categories.gestures',
    travel: 'emojiPicker.categories.travel',
    objects: 'emojiPicker.categories.objects',
    symbols: 'emojiPicker.categories.symbols',
  }

  return t(keyMap[categoryId])
}

function formatReplyKeyboardButtonLabel(button: ReplyKeyboardButtonConfig): string {
  const emoji = String(button.emoji || '').trim()
  const text = String(button.text || '').trim()
  return [emoji, text].filter(Boolean).join(' ').trim()
}

function getReplyKeyboardStyleLabel(
  style: ReplyKeyboardButtonStyle,
  t?: (key: string, values?: Record<string, unknown>) => string
): string {
  if (!t) {
    return REPLY_KEYBOARD_STYLE_OPTIONS.find((option) => option.value === style)?.label || 'Default'
  }

  const normalized = normalizeReplyKeyboardButtonStyle(style)
  const keyMap: Record<ReplyKeyboardButtonStyle, string> = {
    default: 'styleOptions.default',
    primary: 'styleOptions.primary',
    success: 'styleOptions.success',
    danger: 'styleOptions.danger',
  }
  return t(keyMap[normalized])
}

function EmojiPickerPopover({
  value,
  onSelect,
  onClear,
  onClose,
  disabled,
}: {
  value?: string
  onSelect: (emoji: string) => void
  onClear: () => void
  onClose: () => void
  disabled?: boolean
}) {
  const t = useTranslations('editor.system.replyKeyboard')
  const translate = (key: string, values?: Record<string, unknown>) =>
    t(key as never, values as never)
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis())
  const [activeCategory, setActiveCategory] = useState<EmojiPickerCategoryId>('smileys')

  const categories = buildEmojiPickerCategories(recentEmojis)
  const visibleCategory =
    categories.find((c) => c.id === activeCategory && c.emojis.length > 0) ||
    categories.find((c) => c.id !== 'recent') ||
    categories[0]

  const handleSelect = (emoji: string) => {
    if (disabled) return
    const nextRecent = [emoji, ...recentEmojis.filter((item) => item !== emoji)].slice(0, EMOJI_PICKER_MAX_RECENT)
    setRecentEmojis(nextRecent)
    writeRecentEmojis(nextRecent)
    onSelect(emoji)
    onClose()
  }

  return (
    <div className="absolute left-0 top-full mt-2 z-[120] w-[340px] sm:w-[380px]">
      <div className="absolute -top-2 left-6 h-4 w-4 rotate-45 border-l border-t border-white/10 bg-zinc-900/95" />
      <div className="rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-400">
            {t('emojiPicker.title')}
            {value ? <span className="text-zinc-200"> • {value}</span> : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
              onClick={onClear}
              disabled={disabled}
            >
              {t('emojiPicker.clear')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
              onClick={onClose}
            >
              {t('emojiPicker.close')}
            </Button>
          </div>
        </div>

        <div className="max-h-[260px] overflow-y-auto p-2">
          {visibleCategory?.emojis?.length ? (
            <div className="grid grid-cols-7 gap-1">
              {visibleCategory.emojis.map((emoji) => (
                <button
                  key={`${visibleCategory.id}-${emoji}`}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="h-10 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 text-xl flex items-center justify-center transition-colors"
                  title={emoji}
                  disabled={disabled}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-xs text-zinc-500">
              {t('emojiPicker.noRecent')}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-2 py-2 flex items-center gap-1 overflow-x-auto">
          {categories.map((category) => {
            const isDisabled = category.id === 'recent' && category.emojis.length === 0
            const isActive = visibleCategory?.id === category.id
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  if (!isDisabled) setActiveCategory(category.id)
                }}
                disabled={isDisabled}
                title={getEmojiPickerCategoryLabel(category.id, translate)}
                className={`h-8 min-w-8 px-2 rounded-lg border text-sm transition-colors ${isActive
                  ? 'bg-[#24A1DE]/15 border-[#24A1DE]/30 text-[#7dd3fc]'
                  : 'bg-transparent border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {category.icon}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReplyKeyboardStylePopover({
  value,
  onSelect,
  onClose,
  disabled,
}: {
  value: ReplyKeyboardButtonStyle
  onSelect: (style: ReplyKeyboardButtonStyle) => void
  onClose: () => void
  disabled?: boolean
}) {
  const t = useTranslations('editor.system.replyKeyboard')
  const translate = (key: string, values?: Record<string, unknown>) =>
    t(key as never, values as never)
  const currentStyle = normalizeReplyKeyboardButtonStyle(value)

  return (
    <div className="absolute left-0 top-full mt-2 z-[120] w-[220px]">
      <div className="absolute -top-2 left-6 h-4 w-4 rotate-45 border-l border-t border-white/10 bg-zinc-900/95" />
      <div className="rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-400">{t('stylePicker.title')}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
            onClick={onClose}
          >
            {t('stylePicker.close')}
          </Button>
        </div>

        <div className="p-2 space-y-1">
          {REPLY_KEYBOARD_STYLE_OPTIONS.map((option) => {
            const isActive = currentStyle === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (disabled) return
                  onSelect(option.value)
                  onClose()
                }}
                disabled={disabled}
                className={`w-full rounded-lg border px-2 py-2 text-left transition-colors ${isActive
                  ? 'border-[#24A1DE]/30 bg-[#24A1DE]/10'
                  : 'border-transparent hover:border-white/10 hover:bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${option.dotClassName}`} />
                  <span className="text-sm text-white">
                    {getReplyKeyboardStyleLabel(option.value, translate)}
                  </span>
                </div>
                <div className="mt-2">
                  <div
                    className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] ${REPLY_KEYBOARD_STYLE_PREVIEW_CLASS[option.value]}`}
                  >
                    {t('editor.preview')}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ReplyKeyboardButtonsEditor({
  rowsValue,
  onRowsChange,
  disabled,
  emptyHint,
  compact,
}: {
  rowsValue: ReplyKeyboardButtonConfig[][]
  onRowsChange: (rows: ReplyKeyboardButtonConfig[][]) => void
  disabled?: boolean
  emptyHint?: string
  compact?: boolean
}) {
  const t = useTranslations('editor.system.replyKeyboard')
  const translate = (key: string, values?: Record<string, unknown>) =>
    t(key as never, values as never)
  const safeRows = normalizeReplyKeyboardRows(rowsValue)
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<{ rowIndex: number; buttonIndex: number } | null>(null)
  const [stylePickerTarget, setStylePickerTarget] = useState<{ rowIndex: number; buttonIndex: number } | null>(null)
  const emojiPickerRootRef = useRef<HTMLDivElement | null>(null)
  const emojiPickerTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const stylePickerRootRef = useRef<HTMLDivElement | null>(null)
  const stylePickerTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    if (!emojiPickerTarget) return

    const activeKey = `${emojiPickerTarget.rowIndex}:${emojiPickerTarget.buttonIndex}`

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (emojiPickerRootRef.current?.contains(target)) return
      if (emojiPickerTriggerRefs.current[activeKey]?.contains(target)) return

      setEmojiPickerTarget(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmojiPickerTarget(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [emojiPickerTarget])

  useEffect(() => {
    if (!stylePickerTarget) return

    const activeKey = `${stylePickerTarget.rowIndex}:${stylePickerTarget.buttonIndex}`

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return

      if (stylePickerRootRef.current?.contains(target)) return
      if (stylePickerTriggerRefs.current[activeKey]?.contains(target)) return

      setStylePickerTarget(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStylePickerTarget(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [stylePickerTarget])

  const setRows = (updater: (rows: ReplyKeyboardButtonConfig[][]) => ReplyKeyboardButtonConfig[][]) => {
    const next = updater(
      safeRows.map((row) => row.map((button) => ({ ...button })))
    )
    onRowsChange(normalizeReplyKeyboardRows(next))
  }

  const addRow = () => {
    setRows((rows) => [...rows, [createReplyKeyboardButton()]])
  }

  const removeRow = (rowIndex: number) => {
    setRows((rows) => rows.filter((_, index) => index !== rowIndex))
  }

  const addButton = (rowIndex: number) => {
    setRows((rows) =>
      rows.map((row, index) =>
        index === rowIndex ? [...row, createReplyKeyboardButton()] : row
      )
    )
  }

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    setRows((rows) =>
      rows
        .map((row, index) =>
          index === rowIndex ? row.filter((_, idx) => idx !== buttonIndex) : row
        )
        .filter((row) => row.length > 0)
    )
  }

  const updateButton = (
    rowIndex: number,
    buttonIndex: number,
    patch: Partial<ReplyKeyboardButtonConfig>
  ) => {
    setRows((rows) =>
      rows.map((row, rIdx) => {
        if (rIdx !== rowIndex) return row
        return row.map((button, bIdx) =>
          bIdx === buttonIndex
            ? {
              ...button,
              ...patch,
            }
            : button
        )
      })
    )
  }

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-3">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{t('editor.preview')}</div>
        {safeRows.length === 0 ? (
          <div className="text-xs text-zinc-500">{emptyHint || t('editor.empty.noButtons')}</div>
        ) : (
          <div className="space-y-2">
            {safeRows.map((row, rowIndex) => (
              <div key={`preview-row-${rowIndex}`} className="flex flex-wrap gap-2">
                {row.map((button) => {
                  const label = formatReplyKeyboardButtonLabel(button) || t('editor.button')
                  return (
                    <div
                      key={button.id}
                      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs ${REPLY_KEYBOARD_STYLE_PREVIEW_CLASS[normalizeReplyKeyboardButtonStyle(button.style)]}`}
                    >
                      <span className="truncate max-w-[180px]">{label}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {safeRows.length === 0 && (
        <div className="text-xs text-zinc-500 border border-dashed border-white/10 rounded-lg px-3 py-2">
          {emptyHint || t('editor.empty.addButtonAndRow')}
        </div>
      )}

      <div className="space-y-3">
        {safeRows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="rounded-lg border border-white/10 bg-zinc-900/35 p-3">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-xs text-zinc-400">
                {t('editor.rowSummary', { row: rowIndex + 1, count: row.length })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 border-white/10"
                  onClick={() => addButton(rowIndex)}
                  disabled={disabled}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {t('editor.button')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-400 hover:text-red-300"
                  onClick={() => removeRow(rowIndex)}
                  disabled={disabled}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {row.map((button, buttonIndex) => (
                <div key={button.id} className="rounded-lg border border-white/10 bg-zinc-950/50 p-2">
                  <div className={`grid gap-2 ${compact ? 'grid-cols-[64px_1fr_110px_36px]' : 'grid-cols-[70px_1fr_120px_36px]'}`}>
                    <div className="relative">
                      <button
                        type="button"
                        ref={(element) => {
                          emojiPickerTriggerRefs.current[`${rowIndex}:${buttonIndex}`] = element
                        }}
                        onClick={() =>
                          setEmojiPickerTarget((prev) => {
                            setStylePickerTarget(null)
                            return (
                              prev && prev.rowIndex === rowIndex && prev.buttonIndex === buttonIndex
                                ? null
                                : { rowIndex, buttonIndex }
                            )
                          })
                        }
                        disabled={disabled}
                        className="h-9 w-full rounded-md border border-white/10 bg-zinc-800/50 px-2 text-center text-lg hover:bg-zinc-800/70 focus:outline-none focus:ring-2 focus:ring-[#24A1DE]/50 disabled:opacity-60"
                        title={t('editor.chooseEmoji')}
                      >
                        {String(button.emoji || '').trim() || <span className="text-sm text-zinc-500">🙂</span>}
                      </button>

                      {emojiPickerTarget?.rowIndex === rowIndex && emojiPickerTarget?.buttonIndex === buttonIndex && (
                        <div ref={emojiPickerRootRef}>
                          <EmojiPickerPopover
                            value={button.emoji}
                            disabled={disabled}
                            onSelect={(emoji) => updateButton(rowIndex, buttonIndex, { emoji })}
                            onClear={() => {
                              updateButton(rowIndex, buttonIndex, { emoji: '' })
                              setEmojiPickerTarget(null)
                            }}
                            onClose={() => setEmojiPickerTarget(null)}
                          />
                        </div>
                      )}
                    </div>
                    <Input
                      value={button.text}
                      onChange={(event) =>
                        updateButton(rowIndex, buttonIndex, { text: event.target.value.slice(0, 64) })
                      }
                      disabled={disabled}
                      className="h-9 bg-zinc-800/50 border-white/10"
                      placeholder={t('editor.buttonTextPlaceholder')}
                    />
                    <div className={disabled ? 'pointer-events-none' : ''}>
                      <div className="relative">
                        <button
                          type="button"
                          ref={(element) => {
                            stylePickerTriggerRefs.current[`${rowIndex}:${buttonIndex}`] = element
                          }}
                          onClick={() =>
                            setStylePickerTarget((prev) => {
                              setEmojiPickerTarget(null)
                              return (
                                prev && prev.rowIndex === rowIndex && prev.buttonIndex === buttonIndex
                                  ? null
                                  : { rowIndex, buttonIndex }
                              )
                            })
                          }
                          disabled={disabled}
                          className="h-9 w-full rounded-md border border-white/10 bg-zinc-800/50 px-2 text-xs hover:bg-zinc-800/70 focus:outline-none focus:ring-2 focus:ring-[#24A1DE]/50 disabled:opacity-60"
                          title={t('editor.chooseStyle')}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${REPLY_KEYBOARD_STYLE_OPTIONS.find(
                                  (option) => option.value === normalizeReplyKeyboardButtonStyle(button.style)
                                )?.dotClassName || 'bg-zinc-300'
                                  }`}
                              />
                              <span className="truncate text-zinc-200">
                                {getReplyKeyboardStyleLabel(normalizeReplyKeyboardButtonStyle(button.style), translate)}
                              </span>
                            </div>
                            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          </div>
                        </button>

                        {stylePickerTarget?.rowIndex === rowIndex && stylePickerTarget?.buttonIndex === buttonIndex && (
                          <div ref={stylePickerRootRef}>
                            <ReplyKeyboardStylePopover
                              value={normalizeReplyKeyboardButtonStyle(button.style)}
                              disabled={disabled}
                              onSelect={(style) => updateButton(rowIndex, buttonIndex, { style })}
                              onClose={() => setStylePickerTarget(null)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-zinc-400 hover:text-red-300"
                      onClick={() => removeButton(rowIndex, buttonIndex)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="mt-2">
                    <Input
                      value={button.iconCustomEmojiId || ''}
                      onChange={(event) =>
                        updateButton(rowIndex, buttonIndex, {
                          iconCustomEmojiId: event.target.value.trim(),
                        })
                      }
                      disabled={disabled}
                      className="h-8 bg-zinc-800/30 border-white/10 text-xs"
                      placeholder={t('editor.customEmojiIdPlaceholder')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-white/10"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('editor.addRow')}
        </Button>
      </div>

      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
        {t('editor.replyKeyboardTextTriggerHint')}
      </div>
    </div>
  )
}

function createReplyKeyboardRuleId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `rule_${crypto.randomUUID().slice(0, 8)}`
  }
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function getReplyKeyboardConfig(
  metadata: Record<string, unknown> | undefined | null
): ReplyKeyboardSystemConfig {
  const features =
    metadata && typeof metadata.features === 'object' && metadata.features
      ? (metadata.features as Record<string, unknown>)
      : {}

  const raw =
    features.replyKeyboard && typeof features.replyKeyboard === 'object'
      ? (features.replyKeyboard as Record<string, unknown>)
      : {}

  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : []
  const rules: ReplyKeyboardRuleConfig[] = rulesRaw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const rule = item as Record<string, unknown>
      const id = String(rule.id || '').trim() || `rule_${index + 1}`
      return {
        id,
        name: String(rule.name || '').trim() || `Rule ${index + 1}`,
        enabled: rule.enabled === undefined ? true : Boolean(rule.enabled),
        variable: String(rule.variable || '').trim(),
        operator: (String(rule.operator || 'equals').trim() ||
          'equals') as ReplyKeyboardRuleConfig['operator'],
        value: String(rule.value ?? ''),
        rows: normalizeReplyKeyboardRows(rule.rows),
      }
    })
    .filter((rule): rule is ReplyKeyboardRuleConfig => Boolean(rule))

  return {
    enabled: Boolean(raw.enabled),
    resizeKeyboard: raw.resizeKeyboard === undefined ? true : Boolean(raw.resizeKeyboard),
    oneTimeKeyboard: Boolean(raw.oneTimeKeyboard),
    isPersistent: raw.isPersistent === undefined ? true : Boolean(raw.isPersistent),
    baseRows: normalizeReplyKeyboardRows(raw.baseRows),
    rules,
  }
}

function getAutoReactionsConfig(metadata: Record<string, unknown> | undefined | null): AutoReactionsConfig {
  const features =
    metadata && typeof metadata.features === 'object' && metadata.features
      ? (metadata.features as Record<string, unknown>)
      : {}

  const autoReactions =
    features.autoReactions && typeof features.autoReactions === 'object'
      ? (features.autoReactions as Record<string, unknown>)
      : {}

  const cooldownRaw = Number(autoReactions.cooldownSeconds)
  const cooldownSeconds = Number.isFinite(cooldownRaw)
    ? Math.max(0, Math.min(3600, Math.round(cooldownRaw)))
    : 15

  return {
    enabled: Boolean(autoReactions.enabled),
    cooldownSeconds,
    onlyTextMessages:
      autoReactions.onlyTextMessages === undefined ? true : Boolean(autoReactions.onlyTextMessages),
  }
}

function getSubscriberModeConfig(
  metadata: Record<string, unknown> | undefined | null
): SubscriberModeConfig {
  const features =
    metadata && typeof metadata.features === 'object' && metadata.features
      ? (metadata.features as Record<string, unknown>)
      : {}

  const raw =
    features.subscriberMode && typeof features.subscriberMode === 'object'
      ? (features.subscriberMode as Record<string, unknown>)
      : {}

  return {
    enabled: Boolean(raw.enabled),
    privateChatsOnly: raw.privateChatsOnly === undefined ? true : Boolean(raw.privateChatsOnly),
    trackCallbacks: raw.trackCallbacks === undefined ? true : Boolean(raw.trackCallbacks),
  }
}

function formatSystemPanelDate(
  dateValue: string | undefined,
  locale: string,
  fallback = 'N/A'
): string {
  if (!dateValue) return fallback

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  try {
    return new Intl.DateTimeFormat(locale || 'en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }).format(date)
  }
}

export function SystemPanel() {
  const t = useTranslations('editor.system')
  const locale = useLocale()
  const { bot, config, updateBotDraft } = useBotState()
  const docsBasePath = `/${locale}/dashboard/docs`
  const docsKeyboardTriggers = `${docsBasePath}/keyboards-triggers`
  const docsNodes = `${docsBasePath}/nodes`
  const docsDataSecurity = `${docsBasePath}/data-security`

  const stats = [
    { label: t('nodes'), value: config.nodes.length, icon: Code2, color: 'text-[#24A1DE]' },
    { label: t('variables'), value: config.variables.length, icon: Database, color: 'text-[#8B5CF6]' },
    { label: t('connections'), value: config.edges.length, icon: Zap, color: 'text-amber-400' },
  ]

  const autoReactions = getAutoReactionsConfig((bot?.metadata || {}) as Record<string, unknown>)
  const replyKeyboard = getReplyKeyboardConfig((bot?.metadata || {}) as Record<string, unknown>)
  const subscriberMode = getSubscriberModeConfig((bot?.metadata || {}) as Record<string, unknown>)

  const updateAutoReactions = (patch: Partial<AutoReactionsConfig>) => {
    if (!bot) return

    const currentMetadata = (bot.metadata || {}) as Record<string, unknown>
    const currentFeatures =
      currentMetadata.features && typeof currentMetadata.features === 'object'
        ? (currentMetadata.features as Record<string, unknown>)
        : {}
    const currentAuto =
      currentFeatures.autoReactions && typeof currentFeatures.autoReactions === 'object'
        ? (currentFeatures.autoReactions as Record<string, unknown>)
        : {}

    const nextCooldown =
      patch.cooldownSeconds !== undefined
        ? Math.max(0, Math.min(3600, Math.round(patch.cooldownSeconds)))
        : autoReactions.cooldownSeconds

    updateBotDraft({
      metadata: {
        features: {
          ...currentFeatures,
          autoReactions: {
            ...currentAuto,
            enabled: patch.enabled ?? autoReactions.enabled,
            cooldownSeconds: nextCooldown,
            onlyTextMessages: patch.onlyTextMessages ?? autoReactions.onlyTextMessages,
            mode: 'rule-based',
          },
        },
      },
    })
  }

  const updateReplyKeyboard = (patch: Partial<ReplyKeyboardSystemConfig>) => {
    if (!bot) return

    const currentMetadata = (bot.metadata || {}) as Record<string, unknown>
    const currentFeatures =
      currentMetadata.features && typeof currentMetadata.features === 'object'
        ? (currentMetadata.features as Record<string, unknown>)
        : {}
    const currentReplyKeyboard =
      currentFeatures.replyKeyboard && typeof currentFeatures.replyKeyboard === 'object'
        ? (currentFeatures.replyKeyboard as Record<string, unknown>)
        : {}

    updateBotDraft({
      metadata: {
        features: {
          ...currentFeatures,
          replyKeyboard: {
            ...currentReplyKeyboard,
            enabled: patch.enabled ?? replyKeyboard.enabled,
            resizeKeyboard: patch.resizeKeyboard ?? replyKeyboard.resizeKeyboard,
            oneTimeKeyboard: patch.oneTimeKeyboard ?? replyKeyboard.oneTimeKeyboard,
            isPersistent: patch.isPersistent ?? replyKeyboard.isPersistent,
            baseRows: patch.baseRows ?? replyKeyboard.baseRows,
            rules: patch.rules ?? replyKeyboard.rules,
          },
        },
      },
    })
  }

  const updateSubscriberMode = (patch: Partial<SubscriberModeConfig>) => {
    if (!bot) return

    const currentMetadata = (bot.metadata || {}) as Record<string, unknown>
    const currentFeatures =
      currentMetadata.features && typeof currentMetadata.features === 'object'
        ? (currentMetadata.features as Record<string, unknown>)
        : {}
    const currentSubscriberMode =
      currentFeatures.subscriberMode && typeof currentFeatures.subscriberMode === 'object'
        ? (currentFeatures.subscriberMode as Record<string, unknown>)
        : {}

    updateBotDraft({
      metadata: {
        features: {
          ...currentFeatures,
          subscriberMode: {
            ...currentSubscriberMode,
            enabled: patch.enabled ?? subscriberMode.enabled,
            privateChatsOnly: patch.privateChatsOnly ?? subscriberMode.privateChatsOnly,
            trackCallbacks: patch.trackCallbacks ?? subscriberMode.trackCallbacks,
          },
        },
      },
    })
  }

  const addReplyKeyboardRule = () => {
    updateReplyKeyboard({
      rules: [
        ...replyKeyboard.rules,
        {
          id: createReplyKeyboardRuleId(),
          name: t('replyKeyboard.ruleNamePlaceholder', { index: replyKeyboard.rules.length + 1 }),
          enabled: true,
          variable: 'user.languageCode',
          operator: 'equals',
          value: 'ru',
          rows: [[createReplyKeyboardButton({ text: t('replyKeyboard.defaultButtonText') })]],
        },
      ],
    })
  }

  const updateReplyKeyboardRule = (ruleId: string, patch: Partial<ReplyKeyboardRuleConfig>) => {
    updateReplyKeyboard({
      rules: replyKeyboard.rules.map((rule) =>
        rule.id === ruleId
          ? {
            ...rule,
            ...patch,
          }
          : rule
      ),
    })
  }

  const removeReplyKeyboardRule = (ruleId: string) => {
    updateReplyKeyboard({
      rules: replyKeyboard.rules.filter((rule) => rule.id !== ruleId),
    })
  }

  return (
    <div className="h-full flex flex-col bg-[#05070A] overflow-y-auto">
      {/* Header */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Cpu className="w-4 h-4 text-[#24A1DE] shrink-0" />
          <h1 className="text-white font-semibold">{t('title')}</h1>
          <HelpGuideButton
            title={t('title')}
            summary={t('help.overviewSummary')}
            steps={[t('help.overviewStep1'), t('help.overviewStep2'), t('help.overviewStep3')]}
            docsHref={docsBasePath}
          />
          <span className="text-zinc-500">|</span>
          <span className="text-sm text-zinc-400">{t('subtitle')}</span>
        </div>

        <div />
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-xl bg-zinc-900/50 border border-white/10 p-4 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-400">{stat.label}</span>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                </div>
              )
            })}
          </div>

          {/* Variables Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <VariablesTable />
          </section>

          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">{t('autoReactions.title')}</h3>
                  <HelpGuideButton
                    title={t('autoReactions.title')}
                    summary={t('autoReactions.description')}
                    steps={[
                      t('autoReactions.onlyTextHint'),
                      t('autoReactions.cooldownHint'),
                      t('autoReactions.footerHint'),
                    ]}
                    notes={[t('autoReactions.aiHint')]}
                    docsHref={docsDataSecurity}
                  />
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  {t('autoReactions.description')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm ${autoReactions.enabled ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  {autoReactions.enabled ? t('autoReactions.enabled') : t('autoReactions.disabled')}
                </span>
                <Switch
                  checked={autoReactions.enabled}
                  onCheckedChange={(checked) => updateAutoReactions({ enabled: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm text-zinc-300" htmlFor="auto-reactions-cooldown">
                    {t('autoReactions.cooldownLabel')}
                  </label>
                  <HelpGuideButton
                    title={t('autoReactions.cooldownLabel')}
                    summary={t('autoReactions.cooldownHint')}
                    steps={[
                      t('autoReactions.cooldownHint'),
                      t('autoReactions.onlyTextHint'),
                    ]}
                    docsHref={docsDataSecurity}
                  />
                </div>
                <Input
                  id="auto-reactions-cooldown"
                  type="number"
                  min={0}
                  max={3600}
                  step={1}
                  value={autoReactions.cooldownSeconds}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value || '0', 10)
                    updateAutoReactions({
                      cooldownSeconds: Number.isFinite(parsed) ? parsed : 0,
                    })
                  }}
                  disabled={!autoReactions.enabled}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  {t('autoReactions.cooldownHint')}
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-zinc-300">{t('autoReactions.onlyTextTitle')}</div>
                      <HelpGuideButton
                        title={t('autoReactions.onlyTextTitle')}
                        summary={t('autoReactions.onlyTextHint')}
                        steps={[
                          t('autoReactions.onlyTextHint'),
                          t('autoReactions.ruleQuestion'),
                          t('autoReactions.ruleError'),
                        ]}
                        docsHref={docsDataSecurity}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      {t('autoReactions.onlyTextHint')}
                    </p>
                  </div>
                  <Switch
                    checked={autoReactions.onlyTextMessages}
                    onCheckedChange={(checked) => updateAutoReactions({ onlyTextMessages: checked })}
                    disabled={!autoReactions.enabled}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-white/10 bg-zinc-950/30 p-4">
              <div className="text-sm text-zinc-300 mb-2">{t('autoReactions.aiTitle')}</div>
              <div className="relative">
                <Input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  placeholder={t('autoReactions.aiPlaceholder')}
                  className="pr-4"
                />
                <div className="absolute inset-0 rounded-md bg-zinc-950/55 border border-white/5 flex items-center justify-center pointer-events-none">
                  <span className="text-xs md:text-sm font-medium text-zinc-300">
                    {t('autoReactions.aiSoon')}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {t('autoReactions.aiHint')}
              </p>
            </div>

            <div className="mt-4 rounded-lg border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-4">
              <div className="text-sm font-medium text-white mb-2">{t('autoReactions.rulesTitle')}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-300">
                <div>{t('autoReactions.ruleThanks')}</div>
                <div>{t('autoReactions.rulePositive')}</div>
                <div>{t('autoReactions.ruleQuestion')}</div>
                <div>{t('autoReactions.ruleError')}</div>
                <div>{t('autoReactions.ruleStart')}</div>
                <div>{t('autoReactions.ruleOther')}</div>
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {t('autoReactions.footerHint')}
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-[#24A1DE]" />
                  {t('replyKeyboard.title')}
                  <HelpGuideButton
                    title={t('replyKeyboard.title')}
                    summary={t('replyKeyboard.description')}
                    steps={[
                      t('replyKeyboard.howItWorks1'),
                      t('replyKeyboard.howItWorks2'),
                      t('replyKeyboard.howItWorks3'),
                    ]}
                    notes={[t('replyKeyboard.editor.replyKeyboardTextTriggerHint')]}
                    docsHref={docsKeyboardTriggers}
                    className="ml-1"
                  />
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {t('replyKeyboard.description')}
                </p>
                <p className="text-xs text-amber-300/80 mt-1.5">
                  {t('replyKeyboard.starsUnavailableHint')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm ${replyKeyboard.enabled ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  {replyKeyboard.enabled ? t('replyKeyboard.enabled') : t('replyKeyboard.disabled')}
                </span>
                <Switch
                  checked={replyKeyboard.enabled}
                  onCheckedChange={(checked) => updateReplyKeyboard({ enabled: checked })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-zinc-300">{t('replyKeyboard.resizeTitle')}</div>
                      <HelpGuideButton
                        title={t('replyKeyboard.resizeTitle')}
                        summary={t('replyKeyboard.resizeHint')}
                        steps={[
                          t('replyKeyboard.resizeHint'),
                          t('replyKeyboard.howItWorks1'),
                        ]}
                        docsHref={docsKeyboardTriggers}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{t('replyKeyboard.resizeHint')}</p>
                  </div>
                  <Switch
                    checked={replyKeyboard.resizeKeyboard}
                    onCheckedChange={(checked) => updateReplyKeyboard({ resizeKeyboard: checked })}
                    disabled={!replyKeyboard.enabled}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-zinc-300">{t('replyKeyboard.persistentTitle')}</div>
                      <HelpGuideButton
                        title={t('replyKeyboard.persistentTitle')}
                        summary={t('replyKeyboard.persistentHint')}
                        steps={[
                          t('replyKeyboard.persistentHint'),
                          t('replyKeyboard.howItWorks1'),
                        ]}
                        docsHref={docsKeyboardTriggers}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{t('replyKeyboard.persistentHint')}</p>
                  </div>
                  <Switch
                    checked={replyKeyboard.isPersistent}
                    onCheckedChange={(checked) => updateReplyKeyboard({ isPersistent: checked })}
                    disabled={!replyKeyboard.enabled}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-zinc-300">{t('replyKeyboard.oneTimeTitle')}</div>
                      <HelpGuideButton
                        title={t('replyKeyboard.oneTimeTitle')}
                        summary={t('replyKeyboard.oneTimeHint')}
                        steps={[
                          t('replyKeyboard.oneTimeHint'),
                          t('replyKeyboard.howItWorks2'),
                        ]}
                        docsHref={docsKeyboardTriggers}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{t('replyKeyboard.oneTimeHint')}</p>
                  </div>
                  <Switch
                    checked={replyKeyboard.oneTimeKeyboard}
                    onCheckedChange={(checked) => updateReplyKeyboard({ oneTimeKeyboard: checked })}
                    disabled={!replyKeyboard.enabled}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="reply-keyboard-base-rows" className="text-sm text-zinc-300">
                  {t('replyKeyboard.baseButtonsTitle')}
                </Label>
                <HelpGuideButton
                  title={t('replyKeyboard.baseButtonsTitle')}
                  summary={t('replyKeyboard.baseButtonsEmpty')}
                  steps={[
                    t('replyKeyboard.howItWorks1'),
                    t('replyKeyboard.howItWorks2'),
                  ]}
                  notes={[t('replyKeyboard.editor.replyKeyboardTextTriggerHint')]}
                  docsHref={docsKeyboardTriggers}
                />
              </div>
              <div id="reply-keyboard-base-rows" className="mt-2">
                <ReplyKeyboardButtonsEditor
                  rowsValue={replyKeyboard.baseRows}
                  onRowsChange={(rows) => updateReplyKeyboard({ baseRows: rows })}
                  disabled={!replyKeyboard.enabled}
                  emptyHint={t('replyKeyboard.baseButtonsEmpty')}
                  compact
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-zinc-950/30 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white">{t('replyKeyboard.rulesTitle')}</div>
                    <HelpGuideButton
                      title={t('replyKeyboard.rulesTitle')}
                      summary={t('replyKeyboard.rulesHint')}
                      steps={[
                        t('replyKeyboard.rulesHint'),
                        t('replyKeyboard.ruleVariableLabel'),
                        t('replyKeyboard.ruleButtonsLabel'),
                      ]}
                      notes={[t('replyKeyboard.editor.replyKeyboardTextTriggerHint')]}
                      docsHref={docsKeyboardTriggers}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t('replyKeyboard.rulesHint')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  onClick={addReplyKeyboardRule}
                  disabled={!replyKeyboard.enabled}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  {t('replyKeyboard.ruleButton')}
                </Button>
              </div>

              {replyKeyboard.rules.length === 0 && (
                <div className="text-xs text-zinc-500 border border-dashed border-white/10 rounded-lg px-3 py-2">
                  {t('replyKeyboard.noRules')}
                </div>
              )}

              <div className="space-y-3">
                {replyKeyboard.rules.map((rule, index) => (
                  <div key={rule.id} className="rounded-lg border border-white/10 bg-zinc-900/40 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <Label htmlFor={`replykb-rule-name-${rule.id}`}>{t('replyKeyboard.ruleNameLabel')}</Label>
                        <Input
                          id={`replykb-rule-name-${rule.id}`}
                          value={rule.name}
                          onChange={(event) =>
                            updateReplyKeyboardRule(rule.id, { name: event.target.value })
                          }
                          disabled={!replyKeyboard.enabled}
                          className="mt-1.5 bg-zinc-800/50 border-white/10"
                          placeholder={t('replyKeyboard.ruleNamePlaceholder', { index: index + 1 })}
                        />
                        <p className="text-[11px] text-zinc-500 mt-1">{t('replyKeyboard.ruleIdLabel', { id: rule.id })}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => updateReplyKeyboardRule(rule.id, { enabled: checked })}
                          disabled={!replyKeyboard.enabled}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-300"
                          onClick={() => removeReplyKeyboardRule(rule.id)}
                          disabled={!replyKeyboard.enabled}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.9fr_1fr] gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`replykb-rule-variable-${rule.id}`}>{t('replyKeyboard.ruleVariableLabel')}</Label>
                          <HelpGuideButton
                            title={t('replyKeyboard.ruleVariableLabel')}
                            summary={t('replyKeyboard.ruleVariablePlaceholder')}
                            steps={[
                              t('replyKeyboard.ruleVariablePlaceholder'),
                              t('replyKeyboard.ruleOperatorLabel'),
                              t('replyKeyboard.ruleValueLabel'),
                            ]}
                            docsHref={docsKeyboardTriggers}
                          />
                        </div>
                        <Input
                          id={`replykb-rule-variable-${rule.id}`}
                          value={rule.variable}
                          onChange={(event) =>
                            updateReplyKeyboardRule(rule.id, { variable: event.target.value })
                          }
                          disabled={!replyKeyboard.enabled}
                          className="mt-1.5 bg-zinc-800/50 border-white/10"
                          placeholder={t('replyKeyboard.ruleVariablePlaceholder')}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`replykb-rule-operator-${rule.id}`}>{t('replyKeyboard.ruleOperatorLabel')}</Label>
                          <HelpGuideButton
                            title={t('replyKeyboard.ruleOperatorLabel')}
                            summary={t('replyKeyboard.rulesHint')}
                            steps={[
                              t('replyKeyboard.operators.equals'),
                              t('replyKeyboard.operators.contains'),
                              t('replyKeyboard.operators.isEmpty'),
                            ]}
                            docsHref={docsKeyboardTriggers}
                          />
                        </div>
                        <div className={!replyKeyboard.enabled ? 'opacity-60 pointer-events-none' : ''}>
                          <Select
                            value={rule.operator}
                            onValueChange={(value) =>
                              updateReplyKeyboardRule(rule.id, {
                                operator: value as ReplyKeyboardRuleConfig['operator'],
                              })
                            }
                          >
                            <SelectTrigger
                              className="mt-1.5 bg-zinc-800/50 border-white/10"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">{t('replyKeyboard.operators.equals')}</SelectItem>
                              <SelectItem value="notEquals">{t('replyKeyboard.operators.notEquals')}</SelectItem>
                              <SelectItem value="contains">{t('replyKeyboard.operators.contains')}</SelectItem>
                              <SelectItem value="notContains">{t('replyKeyboard.operators.notContains')}</SelectItem>
                              <SelectItem value="gt">{t('replyKeyboard.operators.gt')}</SelectItem>
                              <SelectItem value="lt">{t('replyKeyboard.operators.lt')}</SelectItem>
                              <SelectItem value="gte">{t('replyKeyboard.operators.gte')}</SelectItem>
                              <SelectItem value="lte">{t('replyKeyboard.operators.lte')}</SelectItem>
                              <SelectItem value="isEmpty">{t('replyKeyboard.operators.isEmpty')}</SelectItem>
                              <SelectItem value="isNotEmpty">{t('replyKeyboard.operators.isNotEmpty')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`replykb-rule-value-${rule.id}`}>{t('replyKeyboard.ruleValueLabel')}</Label>
                          <HelpGuideButton
                            title={t('replyKeyboard.ruleValueLabel')}
                            summary={t('replyKeyboard.ruleValuePlaceholder')}
                            steps={[
                              t('replyKeyboard.ruleValuePlaceholder'),
                              t('replyKeyboard.ruleVariablePlaceholder'),
                            ]}
                            docsHref={docsKeyboardTriggers}
                          />
                        </div>
                        <Input
                          id={`replykb-rule-value-${rule.id}`}
                          value={rule.value}
                          onChange={(event) =>
                            updateReplyKeyboardRule(rule.id, { value: event.target.value })
                          }
                          disabled={!replyKeyboard.enabled}
                          className="mt-1.5 bg-zinc-800/50 border-white/10"
                          placeholder={t('replyKeyboard.ruleValuePlaceholder')}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`replykb-rule-rows-${rule.id}`}>{t('replyKeyboard.ruleButtonsLabel')}</Label>
                        <HelpGuideButton
                          title={t('replyKeyboard.ruleButtonsLabel')}
                          summary={t('replyKeyboard.ruleButtonsEmpty')}
                          steps={[
                            t('replyKeyboard.ruleButtonsEmpty'),
                            t('replyKeyboard.howItWorks3'),
                          ]}
                          docsHref={docsKeyboardTriggers}
                        />
                      </div>
                      <div id={`replykb-rule-rows-${rule.id}`} className="mt-1.5">
                        <ReplyKeyboardButtonsEditor
                          rowsValue={rule.rows}
                          onRowsChange={(rows) => updateReplyKeyboardRule(rule.id, { rows })}
                          disabled={!replyKeyboard.enabled}
                          emptyHint={t('replyKeyboard.ruleButtonsEmpty')}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#24A1DE]/20 bg-[#24A1DE]/5 p-4">
              <div className="text-sm font-medium text-white mb-2">{t('replyKeyboard.howItWorksTitle')}</div>
              <div className="text-xs text-zinc-300 space-y-1">
                <div>{t('replyKeyboard.howItWorks1')}</div>
                <div>{t('replyKeyboard.howItWorks2')}</div>
                <div>{t('replyKeyboard.howItWorks3')}</div>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#24A1DE]" />
                  {t('subscribers.title')}
                  <HelpGuideButton
                    title={t('subscribers.title')}
                    summary={t('subscribers.description')}
                    steps={[
                      t('subscribers.privateOnlyHint'),
                      t('subscribers.trackCallbacksHint'),
                      t('subscribers.note'),
                    ]}
                    docsHref={docsDataSecurity}
                    className="ml-1"
                  />
                </h3>
                <p className="text-sm text-zinc-400 mt-1">{t('subscribers.description')}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm ${subscriberMode.enabled ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  {subscriberMode.enabled ? t('subscribers.enabled') : t('subscribers.disabled')}
                </span>
                <Switch
                  checked={subscriberMode.enabled}
                  onCheckedChange={(checked) => updateSubscriberMode({ enabled: checked })}
                />
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-white/10 bg-zinc-950/30 p-4">
              <div className="text-xs text-zinc-400">{t('subscribers.analyticsInStatistics')}</div>
            </div>
          </section>

          {/* Bot Info Section */}
          <section className="rounded-xl bg-zinc-900/50 border border-white/10 p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-[#24A1DE]/20 to-[#8B5CF6]/20 border border-[#24A1DE]/30">
                <Info className="w-4 h-4 text-[#24A1DE]" />
              </div>
              {t('botInformation')}
              <HelpGuideButton
                title={t('botInformation')}
                summary={t('help.botInfoSummary')}
                steps={[
                  t('help.botInfoStep1'),
                  t('help.botInfoStep2'),
                  t('help.botInfoStep3'),
                ]}
                docsHref={docsNodes}
              />
            </h3>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">{t('botId')}:</span>
                <code className="ml-2 text-[#24A1DE]">{bot?.id || t('notAvailable')}</code>
              </div>
              <div>
                <span className="text-zinc-500">{t('status')}:</span>
                <span className={`ml-2 ${bot?.status === 'active' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                  {bot?.status || 'draft'}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">{t('created')}:</span>
                <span className="ml-2 text-zinc-400">
                  {formatSystemPanelDate(bot?.createdAt, locale, t('notAvailable'))}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">{t('lastUpdated')}:</span>
                <span className="ml-2 text-zinc-400">
                  {formatSystemPanelDate(bot?.updatedAt, locale, t('notAvailable'))}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
