'use client'

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CircleHelp, Plus, Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea, type TextareaProps } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'
import { cn } from '@/lib/utils'
import type { VariableType } from '@/lib/bot-editor/types/bot.types'
import {
  BOT_SYSTEM_VARIABLES,
  getBotSystemVariableDefinition,
  isReservedBotVariableName,
} from '@/lib/bot-editor/system-variables'

type VariableSuggestionKind = 'system' | 'custom' | 'external'

interface VariableSuggestionItem {
  name: string
  kind: VariableSuggestionKind
  description?: string
}

function getDefaultValue(type: VariableType): unknown {
  switch (type) {
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'object':
      return {}
    case 'array':
      return []
    default:
      return ''
  }
}

function normalizeName(value: string): string {
  return value.trim()
}

function getFilteredVariables(allVariables: VariableSuggestionItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return allVariables

  return [...allVariables].sort((left, right) => {
    const leftLower = left.name.toLowerCase()
    const rightLower = right.name.toLowerCase()

    const leftStarts = leftLower.startsWith(normalizedQuery)
    const rightStarts = rightLower.startsWith(normalizedQuery)
    if (leftStarts !== rightStarts) {
      return leftStarts ? -1 : 1
    }

    const leftIncludes = leftLower.includes(normalizedQuery)
    const rightIncludes = rightLower.includes(normalizedQuery)
    if (leftIncludes !== rightIncludes) {
      return leftIncludes ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  }).filter((item) => item.name.toLowerCase().includes(normalizedQuery))
}

interface VariableCreateModalProps {
  isOpen: boolean
  initialName?: string
  onClose: () => void
  onCreated?: (name: string) => void
}

function VariableCreateModal({
  isOpen,
  initialName = '',
  onClose,
  onCreated,
}: VariableCreateModalProps) {
  if (!isOpen) return null

  return (
    <VariableCreateModalContent
      key={`${initialName}:${isOpen ? 'open' : 'closed'}`}
      initialName={initialName}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

interface VariableCreateModalContentProps {
  initialName: string
  onClose: () => void
  onCreated?: (name: string) => void
}

function VariableCreateModalContent({
  initialName,
  onClose,
  onCreated,
}: VariableCreateModalContentProps) {
  const t = useTranslations('editor.variableAssist')
  const ts = useTranslations('editor.system')
  const { config, addVariable } = useBotState()

  const [name, setName] = useState(initialName)
  const [type, setType] = useState<VariableType>('string')
  const [defaultValue, setDefaultValue] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleCreate = () => {
    const variableName = normalizeName(name)
    if (!variableName) {
      setError(t('errors.nameRequired'))
      return
    }

    if (isReservedBotVariableName(variableName)) {
      setError(t('errors.reservedName'))
      return
    }

    const exists = (config.variables || []).some((variable) => variable.name === variableName)
    if (exists) {
      setError(t('errors.alreadyExists'))
      return
    }

    let parsedDefault: unknown = defaultValue
    if (type === 'number') {
      parsedDefault = Number(defaultValue || 0)
    } else if (type === 'boolean') {
      parsedDefault = defaultValue === 'true'
    } else if (type === 'object' || type === 'array') {
      try {
        parsedDefault = defaultValue ? JSON.parse(defaultValue) : getDefaultValue(type)
      } catch {
        setError(t('errors.defaultJson'))
        return
      }
    } else if (defaultValue === '') {
      parsedDefault = getDefaultValue(type)
    }

    addVariable({
      name: variableName,
      type,
      default_value: parsedDefault,
      description: description.trim() || undefined,
    })

    onCreated?.(variableName)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">{t('create.title')}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="var-create-name" className="text-white">{t('create.nameLabel')}</Label>
            <Input
              id="var-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create.namePlaceholder')}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="var-create-type" className="text-white">{t('create.typeLabel')}</Label>
            <select
              id="var-create-type"
              value={type}
              onChange={(e) => setType(e.target.value as VariableType)}
              className="mt-1.5 w-full rounded-md border border-white/10 bg-zinc-800/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#24A1DE]"
            >
              <option value="string">{ts('typeString')}</option>
              <option value="number">{ts('typeNumber')}</option>
              <option value="boolean">{ts('typeBoolean')}</option>
              <option value="object">{ts('typeObject')}</option>
              <option value="array">{ts('typeArray')}</option>
              <option value="user">{ts('typeUser')}</option>
              <option value="message">{ts('typeMessage')}</option>
              <option value="date">{ts('typeDate')}</option>
            </select>
          </div>

          <div>
            <Label htmlFor="var-create-default" className="text-white">{t('create.defaultValueLabel')}</Label>
            <Input
              id="var-create-default"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder={type === 'object' || type === 'array' ? '{"key":"value"}' : ''}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>

          <div>
            <Label htmlFor="var-create-description" className="text-white">{t('create.descriptionLabel')}</Label>
            <Textarea
              id="var-create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 bg-zinc-800/50 border-white/10"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('create.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              className="bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] hover:from-[#24A1DE]/80 hover:to-[#8B5CF6]/80"
            >
              {t('create.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface VariableSuggestionsProps {
  open: boolean
  query: string
  variables: VariableSuggestionItem[]
  onSelect: (name: string) => void
  onCreate: (prefill: string) => void
}

interface VariableTooltipState {
  left: number
  top: number
  placement: 'top' | 'bottom'
  kindLabel: string
  description: string
}

function VariableSuggestions({
  open,
  query,
  variables,
  onSelect,
  onCreate,
}: VariableSuggestionsProps) {
  const t = useTranslations('editor.variableAssist')
  const [tooltipState, setTooltipState] = useState<VariableTooltipState | null>(null)
  if (!open) return null

  const filtered = getFilteredVariables(variables, query)
  const getSystemDescription = (name: string) => {
    const systemVariable = getBotSystemVariableDefinition(name)
    return systemVariable
      ? t(`suggestions.systemDescriptions.${systemVariable.descriptionKey}`)
      : t('suggestions.systemDescriptionFallback')
  }

  const getDescriptionMeta = (variable: VariableSuggestionItem) => {
    if (variable.kind === 'system') {
      return {
        kindLabel: t('suggestions.typeSystem'),
        description: getSystemDescription(variable.name),
      }
    }

    if (variable.kind === 'custom') {
      return {
        kindLabel: t('suggestions.typeCustom'),
        description: variable.description || t('suggestions.customDescriptionFallback'),
      }
    }

    return {
      kindLabel: t('suggestions.typeExternal'),
      description: variable.description || t('suggestions.externalDescriptionFallback'),
    }
  }

  const hideTooltip = () => {
    setTooltipState(null)
  }

  const showTooltip = (target: HTMLElement, variable: VariableSuggestionItem) => {
    const tooltipMeta = getDescriptionMeta(variable)
    const rect = target.getBoundingClientRect()
    const tooltipWidth = 256
    const gap = 10
    const viewportPadding = 8
    const estimatedHeight = 88

    const left = Math.min(
      Math.max(viewportPadding, rect.right - tooltipWidth),
      window.innerWidth - tooltipWidth - viewportPadding
    )

    const placeBottom = rect.top < estimatedHeight + gap + viewportPadding
    const top = placeBottom ? rect.bottom + gap : rect.top - gap

    setTooltipState({
      left,
      top,
      placement: placeBottom ? 'bottom' : 'top',
      kindLabel: tooltipMeta.kindLabel,
      description: tooltipMeta.description,
    })
  }

  return (
    <>
      <div className="absolute left-0 right-0 top-full mt-2 z-[110] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Search className="w-3.5 h-3.5" />
            <span>{t('suggestions.title')}</span>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreate(query)}
            className="inline-flex items-center gap-1 text-xs text-[#24A1DE] hover:text-white"
            title={t('suggestions.createTitle')}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('suggestions.createButton')}
          </button>
        </div>

        <div
          className="max-h-56 overflow-y-auto p-2 space-y-1"
          onScroll={hideTooltip}
        >
          {filtered.length > 0 ? (
            filtered.map((variable) => (
              <div
                key={variable.name}
                className="flex items-center gap-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(variable.name)}
                  className="flex-1 text-left px-2.5 py-2 rounded-lg"
                >
                  <code className="text-sm text-[#24A1DE]">{variable.name}</code>
                </button>

                <button
                  type="button"
                  aria-label={t('suggestions.descriptionIconAria')}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={(e) => showTooltip(e.currentTarget, variable)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip(e.currentTarget, variable)}
                  onBlur={hideTooltip}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-transparent p-0 text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24A1DE]/70"
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="px-2.5 py-3 text-sm text-zinc-500">
              {t('suggestions.noMatch')}
            </div>
          )}
        </div>
      </div>

      {tooltipState && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[4000] w-64 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-2 text-left text-xs text-zinc-200 shadow-2xl pointer-events-none"
              style={{
                left: tooltipState.left,
                top: tooltipState.top,
                transform: tooltipState.placement === 'top' ? 'translateY(-100%)' : undefined,
              }}
            >
              <span className="block text-[11px] uppercase tracking-wide text-zinc-400">
                {tooltipState.kindLabel}
              </span>
              <span className="mt-1 block leading-relaxed">{tooltipState.description}</span>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function useAvailableVariables(extraVariables?: string[]) {
  const { config } = useBotState()

  return useMemo(() => {
    const mapped = new Map<string, VariableSuggestionItem>()

    for (const variable of BOT_SYSTEM_VARIABLES) {
      mapped.set(variable.name, {
        name: variable.name,
        kind: 'system',
      })
    }

    for (const variable of config.variables || []) {
      const variableName = normalizeName(variable.name)
      if (!variableName || mapped.has(variableName)) continue
      mapped.set(variableName, {
        name: variableName,
        kind: 'custom',
        description:
          typeof variable.description === 'string'
            ? variable.description.trim() || undefined
            : undefined,
      })
    }

    for (const rawName of extraVariables || []) {
      const variableName = normalizeName(rawName)
      if (!variableName || mapped.has(variableName)) continue
      mapped.set(variableName, {
        name: variableName,
        kind: 'external',
      })
    }

    return [...mapped.values()].sort((left, right) => left.name.localeCompare(right.name))
  }, [config.variables, extraVariables])
}

interface VariableAutocompleteInputProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  variables?: string[]
}

export function VariableAutocompleteInput({
  id,
  value,
  onValueChange,
  placeholder,
  className,
  variables,
}: VariableAutocompleteInputProps) {
  const allVariables = useAvailableVariables(variables)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPrefill, setCreatePrefill] = useState('')

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(true)
          }}
          placeholder={placeholder}
          className={className}
        />

        <VariableSuggestions
          open={open}
          query={value}
          variables={allVariables}
          onSelect={(name) => {
            onValueChange(name)
            setOpen(false)
            inputRef.current?.focus()
          }}
          onCreate={(prefill) => {
            setCreatePrefill(prefill.trim())
            setCreateOpen(true)
          }}
        />
      </div>

      <VariableCreateModal
        isOpen={createOpen}
        initialName={createPrefill}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          onValueChange(name)
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
      />
    </>
  )
}

function getTemplateQueryAtCursor(value: string, cursor: number): {
  query: string
  start: number
  end: number
} | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length))

  const fullTokenRegex = /\{\{([^{}]*)\}\}/g
  let tokenMatch: RegExpExecArray | null
  while ((tokenMatch = fullTokenRegex.exec(value)) !== null) {
    const tokenStart = tokenMatch.index
    const tokenEnd = tokenStart + tokenMatch[0].length

    if (safeCursor >= tokenStart && safeCursor <= tokenEnd) {
      return {
        query: tokenMatch[1] || '',
        start: tokenStart,
        end: tokenEnd,
      }
    }
  }

  const beforeCursor = value.slice(0, safeCursor)
  const match = beforeCursor.match(/\{\{([^}]*)$/)
  if (!match) return null

  const tokenStart = safeCursor - match[0].length
  const hasClosingBraces = value.slice(safeCursor).startsWith('}}')

  return {
    query: match[1] || '',
    start: tokenStart,
    end: safeCursor + (hasClosingBraces ? 2 : 0),
  }
}

function hasTemplateVariables(value: string) {
  return /\{\{[^{}]+\}\}/.test(value)
}

function renderTemplatePreview(value: string) {
  const parts = value.split(/(\{\{[^{}]+\}\})/g)

  return parts.map((part, index) => {
    if (!part) return null

    if (/^\{\{[^{}]+\}\}$/.test(part)) {
      return (
        <span
          key={`${part}-${index}`}
          className="rounded-md border border-sky-400/35 bg-sky-400/15 px-1 py-0.5 font-mono text-[0.95em] text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]"
        >
          {part}
        </span>
      )
    }

    return <span key={`${index}-${part.slice(0, 8)}`}>{part}</span>
  })
}

interface TemplateVariableTextareaProps extends Omit<TextareaProps, 'value' | 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  variables?: string[]
  previewHtml?: string
  forcePreview?: boolean
}

export const TemplateVariableTextarea = forwardRef<HTMLTextAreaElement, TemplateVariableTextareaProps>(function TemplateVariableTextarea({
  value,
  onValueChange,
  variables,
  previewHtml,
  forcePreview = false,
  onKeyUp,
  onClick,
  onFocus,
  onScroll,
  className,
  style,
  ...textareaProps
}: TemplateVariableTextareaProps, forwardedRef) {
  const allVariables = useAvailableVariables(variables)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingCursorRef = useRef<number | null>(null)

  const [open, setOpen] = useState(false)
  const [templateQuery, setTemplateQuery] = useState<{ query: string; start: number; end: number } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPrefill, setCreatePrefill] = useState('')
  const [overlayScroll, setOverlayScroll] = useState({ top: 0, left: 0 })
  const shouldHighlight = forcePreview || hasTemplateVariables(value)

  useEffect(() => {
    if (pendingCursorRef.current === null || !textareaRef.current) {
      return
    }

    const nextCursor = pendingCursorRef.current
    pendingCursorRef.current = null
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(nextCursor, nextCursor)
  }, [value])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const refreshTemplateQuery = (nextValue: string, cursor: number) => {
    const nextQuery = getTemplateQueryAtCursor(nextValue, cursor)
    setTemplateQuery(nextQuery)
    setOpen(Boolean(nextQuery))
  }

  const applyVariable = (variableName: string) => {
    if (!templateQuery) return

    const replacement = `{{${variableName}}}`
    const nextValue =
      value.slice(0, templateQuery.start) +
      replacement +
      value.slice(templateQuery.end)

    pendingCursorRef.current = templateQuery.start + replacement.length
    onValueChange(nextValue)
    setOpen(false)
    setTemplateQuery(null)
  }

  const setTextareaRefs = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element

    if (typeof forwardedRef === 'function') {
      forwardedRef(element)
      return
    }

    if (forwardedRef) {
      forwardedRef.current = element
    }
  }

  return (
    <>
      <div ref={wrapperRef} className="relative">
        {shouldHighlight ? (
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-md border border-transparent px-3 py-2 text-sm leading-normal text-white whitespace-pre-wrap break-words',
              'selection:bg-transparent'
            )}
          >
            {previewHtml ? (
              <div
                style={{
                  transform: `translate(${-overlayScroll.left}px, ${-overlayScroll.top}px)`,
                }}
                dangerouslySetInnerHTML={{
                  __html: previewHtml + (value.endsWith('\n') ? '\u00a0' : ''),
                }}
              />
            ) : (
              <div
                style={{
                  transform: `translate(${-overlayScroll.left}px, ${-overlayScroll.top}px)`,
                }}
              >
                {renderTemplatePreview(value)}
                {value.endsWith('\n') ? '\u00a0' : null}
              </div>
            )}
          </div>
        ) : null}
        <Textarea
          ref={setTextareaRefs}
          {...textareaProps}
          value={value}
          className={cn(
            className,
            shouldHighlight && 'relative z-[2] bg-transparent text-transparent caret-white selection:bg-[#24A1DE]/35'
          )}
          style={{
            ...style,
            ...(shouldHighlight
              ? {
                  color: 'transparent',
                  caretColor: '#ffffff',
                }
              : null),
          }}
          onChange={(e) => {
            const nextValue = e.target.value
            onValueChange(nextValue)
            refreshTemplateQuery(nextValue, e.target.selectionStart ?? nextValue.length)
          }}
          onScroll={(e) => {
            setOverlayScroll({
              top: e.currentTarget.scrollTop,
              left: e.currentTarget.scrollLeft,
            })
            onScroll?.(e)
          }}
          onKeyUp={(e) => {
            const target = e.currentTarget
            refreshTemplateQuery(target.value, target.selectionStart ?? target.value.length)
            onKeyUp?.(e)
          }}
          onClick={(e) => {
            const target = e.currentTarget
            refreshTemplateQuery(target.value, target.selectionStart ?? target.value.length)
            onClick?.(e)
          }}
          onFocus={(e) => {
            const target = e.currentTarget
            refreshTemplateQuery(target.value, target.selectionStart ?? target.value.length)
            onFocus?.(e)
          }}
        />

        <VariableSuggestions
          open={open}
          query={templateQuery?.query || ''}
          variables={allVariables}
          onSelect={applyVariable}
          onCreate={(prefill) => {
            setCreatePrefill(prefill.trim())
            setCreateOpen(true)
          }}
        />
      </div>

      <VariableCreateModal
        isOpen={createOpen}
        initialName={createPrefill}
        onClose={() => setCreateOpen(false)}
        onCreated={(name) => {
          applyVariable(name)
        }}
      />
    </>
  )
})
