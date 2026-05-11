'use client'

import { useRef, useState } from 'react'
import { Database, FileText, Plus, Trash2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useBotState } from '@/components/bot-editor/providers/bot-state-provider'

const MAX_DATABASE_TEXT_CHARS = 200_000
const MAX_DATABASE_ROW_TEXT_CHARS = 50_000
const MAX_DATABASE_ROWS = 100

type DatabaseRow = {
  id: string
  text: string
}

type DatabaseMetadata = {
  rows: DatabaseRow[]
  text: string
  sourceName: string
  updatedAt: string
}

function normalizeRowId(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .trim()
    .replace(/[.[\]{}]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64)
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

function getUniqueRowId(value: unknown, rows: DatabaseRow[], currentIndex = -1) {
  const fallback = `row_${rows.length + 1}`
  const baseId = normalizeRowId(value, fallback)
  const usedIds = new Set(rows.map((row, index) => (index === currentIndex ? '' : row.id)).filter(Boolean))

  if (!usedIds.has(baseId)) {
    return baseId
  }

  let index = 2
  let nextId = `${baseId}_${index}`
  while (usedIds.has(nextId)) {
    index += 1
    nextId = `${baseId}_${index}`
  }

  return nextId
}

function normalizeRows(input: unknown, legacyText = ''): DatabaseRow[] {
  const rawRows = Array.isArray(input) ? input : []
  const rows = rawRows
    .map((item, index) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        id: normalizeRowId(record.id, `row_${index + 1}`),
        text: String(record.text || '').slice(0, MAX_DATABASE_ROW_TEXT_CHARS),
      }
    })
    .filter((row) => row.id || row.text.trim())
    .slice(0, MAX_DATABASE_ROWS)

  if (rows.length) {
    return rows.reduce<DatabaseRow[]>((acc, row) => [
      ...acc,
      {
        ...row,
        id: getUniqueRowId(row.id, acc),
      },
    ], [])
  }

  const fallbackText = String(legacyText || '').slice(0, MAX_DATABASE_TEXT_CHARS)
  return fallbackText.trim() ? [{ id: 'main', text: fallbackText }] : []
}

function serializeRows(rows: DatabaseRow[]) {
  return rows
    .map((row) => row.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_DATABASE_TEXT_CHARS)
}

function readDatabaseMetadata(metadata: Record<string, unknown> | undefined | null): DatabaseMetadata {
  const raw =
    metadata?.database && typeof metadata.database === 'object'
      ? (metadata.database as Record<string, unknown>)
      : {}
  const rows = normalizeRows(raw.rows, String(raw.text || ''))

  return {
    rows,
    text: serializeRows(rows),
    sourceName: String(raw.sourceName || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

export default function BotDatabaseScreen() {
  const tNav = useTranslations('editor.nav')
  const t = useTranslations('editor.database')
  const { bot, updateBotDraft } = useBotState()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const database = readDatabaseMetadata((bot?.metadata || {}) as Record<string, unknown>)
  const charCount = database.text.length
  const updatedAtDate = database.updatedAt ? new Date(database.updatedAt) : null
  const updatedAtLabel = updatedAtDate && Number.isFinite(updatedAtDate.getTime())
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(updatedAtDate)
    : t('neverUpdated')

  const updateDatabaseRows = (rows: DatabaseRow[], sourceName = database.sourceName) => {
    const nextRows = normalizeRows(rows, '')
    updateBotDraft({
      metadata: {
        ...(bot?.metadata || {}),
        database: {
          rows: nextRows,
          text: serializeRows(nextRows),
          sourceName,
          updatedAt: new Date().toISOString(),
        },
      },
    })
  }

  const handleAddRow = () => {
    setImportError(null)
    updateDatabaseRows([
      ...database.rows,
      {
        id: getUniqueRowId(`row_${database.rows.length + 1}`, database.rows),
        text: '',
      },
    ])
  }

  const handleUpdateRow = (index: number, patch: Partial<DatabaseRow>) => {
    setImportError(null)
    const nextRows = database.rows.map((row, rowIndex) => {
      if (rowIndex !== index) {
        return row
      }

      if (patch.id !== undefined) {
        return {
          ...row,
          id: getUniqueRowId(patch.id, database.rows, index),
        }
      }

      return {
        ...row,
        text: String(patch.text || '').slice(0, MAX_DATABASE_ROW_TEXT_CHARS),
      }
    })

    updateDatabaseRows(nextRows)
  }

  const handleDeleteRow = (index: number) => {
    setImportError(null)
    updateDatabaseRows(database.rows.filter((_, rowIndex) => rowIndex !== index))
  }

  const handleImportFile = (file: File | undefined) => {
    if (!file) {
      return
    }

    setImportError(null)
    if (!file.name.toLowerCase().endsWith('.txt') && file.type && file.type !== 'text/plain') {
      setImportError(t('txtOnly'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '').slice(0, MAX_DATABASE_ROW_TEXT_CHARS)
      const baseName = file.name.replace(/\.[^.]+$/, '')
      updateDatabaseRows([
        ...database.rows,
        {
          id: getUniqueRowId(baseName, database.rows),
          text,
        },
      ], file.name)
    }
    reader.onerror = () => setImportError(t('readError'))
    reader.readAsText(file)
  }

  return (
    <div className="h-full w-full min-w-0 overflow-y-auto bg-[#05070A]">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-white/10 bg-zinc-950/50 px-6 backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Database className="h-4 w-4 shrink-0 text-[#24A1DE]" />
          <h1 className="shrink-0 font-semibold text-white">{tNav('database')}</h1>
          <span className="text-zinc-500">|</span>
          <span className="min-w-0 truncate text-sm text-zinc-400">{tNav('databaseDesc')}</span>
        </div>
      </header>

      <div className="min-w-0 p-6">
        <div className="w-full min-w-0 space-y-5">
          <section className="rounded-xl border border-white/10 bg-zinc-900/45 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <FileText className="h-4 w-4 text-[#8ED8FF]" />
                  {t('textTitle')}
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">
                  {t('textDesc')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(event) => {
                    handleImportFile(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleAddRow}
                  disabled={database.rows.length >= MAX_DATABASE_ROWS}
                >
                  <Plus className="h-4 w-4" />
                  {t('addRow')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={database.rows.length >= MAX_DATABASE_ROWS}
                >
                  <Upload className="h-4 w-4" />
                  {t('importTxt')}
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
              <div className="grid grid-cols-[220px_minmax(0,1fr)_48px] border-b border-white/10 bg-white/[0.035] text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                <div className="px-3 py-2">{t('rowId')}</div>
                <div className="border-l border-white/10 px-3 py-2">{t('rowText')}</div>
                <div className="border-l border-white/10 px-3 py-2" />
              </div>

              {database.rows.length ? (
                <div className="divide-y divide-white/10">
                  {database.rows.map((row, index) => (
                    <div key={index} className="grid grid-cols-[220px_minmax(0,1fr)_48px] bg-[#080B11]">
                      <div className="min-w-0 p-3">
                        <Input
                          value={row.id}
                          onChange={(event) => handleUpdateRow(index, { id: event.target.value })}
                          placeholder={t('rowIdPlaceholder')}
                          className="border-white/10 bg-zinc-950/70 font-mono text-sm"
                        />
                        <div className="mt-2 truncate font-mono text-xs text-sky-200/70">
                          {`{{database.${row.id}}}`}
                        </div>
                      </div>
                      <div className="min-w-0 border-l border-white/10 p-3">
                        <Textarea
                          value={row.text}
                          onChange={(event) => handleUpdateRow(index, { text: event.target.value })}
                          rows={5}
                          placeholder={t('rowTextPlaceholder')}
                          className="min-h-[132px] resize-y border-white/10 bg-zinc-950/70 font-mono text-sm leading-6"
                        />
                      </div>
                      <div className="flex items-start justify-center border-l border-white/10 p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(index)}
                          aria-label={t('deleteRow')}
                          title={t('deleteRow')}
                          className="h-9 w-9 text-zinc-500 hover:bg-red-500/10 hover:text-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 bg-[#080B11] px-4 py-8 text-center text-sm text-zinc-500 transition hover:bg-white/[0.035] hover:text-zinc-300"
                >
                  <Plus className="h-5 w-5" />
                  {t('emptyRows')}
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {t('rowsCount', { count: database.rows.length.toLocaleString() })}
                {' · '}
                {t('chars', { count: charCount.toLocaleString() })}
                {database.sourceName ? ` · ${database.sourceName}` : ''}
              </span>
              <span>{t('updatedAt', { value: updatedAtLabel })}</span>
            </div>

            {importError ? (
              <div className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {importError}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-4 py-3 text-sm leading-6 text-sky-100/80">
            {t('usageHint')}
          </section>
        </div>
      </div>
    </div>
  )
}
