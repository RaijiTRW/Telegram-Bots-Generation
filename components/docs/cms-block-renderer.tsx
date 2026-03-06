import Image from 'next/image'
import Link from 'next/link'
import { FileImage, FileVideo } from 'lucide-react'

import type { DocsBlock } from '@/lib/docs-cms/types'

const headingTagByLevel = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const

function renderTextWithLineBreaks(value: string) {
  const lines = String(value || '').split('\n')
  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ))
}

function stripBasicHtml(value: string): string {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
}

function renderMediaPlaceholder({
  kind,
  locale,
}: {
  kind: 'image' | 'video'
  locale: string
}) {
  const isRu = locale !== 'en'
  const title =
    kind === 'image'
      ? isRu
        ? 'Изображение скоро появится'
        : 'Image coming soon'
      : isRu
        ? 'Видео скоро появится'
        : 'Video coming soon'
  const description = isRu
    ? 'Этот блок добавлен, но файл пока не загружен в CMS.'
    : 'This block was added, but the file has not been uploaded in CMS yet.'

  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-zinc-900/40 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-300">
          {kind === 'image' ? <FileImage className="h-4 w-4" /> : <FileVideo className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-100">{title}</div>
          <div className="mt-1 text-xs text-zinc-400">{description}</div>
        </div>
      </div>
    </div>
  )
}

export function CmsBlockRenderer({
  blocks,
  locale = 'ru',
}: {
  blocks: DocsBlock[]
  locale?: string
}) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        switch (block.type) {
          case 'heading': {
            const Tag = headingTagByLevel[block.level] ?? 'h2'
            const headingClass =
              block.level <= 2
                ? 'text-2xl md:text-3xl'
                : block.level === 3
                  ? 'text-xl md:text-2xl'
                  : block.level === 4
                    ? 'text-lg md:text-xl'
                    : 'text-base md:text-lg'

            return (
              <Tag key={block.id} className={`${headingClass} font-semibold tracking-tight text-white`}>
                {block.text}
              </Tag>
            )
          }
          case 'paragraph':
            return (
              <p key={block.id} className="text-zinc-200 leading-7 text-[15px] md:text-base max-w-[72ch]">
                {renderTextWithLineBreaks(stripBasicHtml(block.richText))}
              </p>
            )
          case 'list':
            return block.ordered ? (
              <ol key={block.id} className="list-decimal pl-6 space-y-2 text-zinc-200 text-[15px] md:text-base leading-7 max-w-[72ch]">
                {block.items.map((item, index) => (
                  <li key={`${block.id}-item-${index}`}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul key={block.id} className="list-disc pl-6 space-y-2 text-zinc-200 text-[15px] md:text-base leading-7 max-w-[72ch]">
                {block.items.map((item, index) => (
                  <li key={`${block.id}-item-${index}`}>{item}</li>
                ))}
              </ul>
            )
          case 'callout': {
            const tones = {
              info: 'border-blue-400/30 bg-blue-400/10 text-blue-100',
              success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
              warning: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
              danger: 'border-red-400/30 bg-red-400/10 text-red-100',
            }
            return (
              <div key={block.id} className={`rounded-xl border p-4 ${tones[block.tone]}`}>
                <div className="font-semibold">{block.title}</div>
                <div className="mt-1 text-sm opacity-95">{renderTextWithLineBreaks(block.text)}</div>
              </div>
            )
          }
          case 'table': {
            const useHorizontalCards = block.columns.length >= 4

            if (useHorizontalCards) {
              return (
                <div key={block.id} className="overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-4 snap-x snap-mandatory pr-1">
                    {block.columns.map((column, columnIndex) => {
                      const values = block.rows
                        .map((row) => String(row[columnIndex] || '').trim())
                        .filter(Boolean)

                      return (
                        <article
                          key={`${block.id}-card-${columnIndex}`}
                          className="w-[300px] sm:w-[330px] shrink-0 snap-start rounded-2xl border border-white/10 bg-zinc-950/55 p-5"
                        >
                          <h3 className="text-lg font-semibold text-white leading-7">{column}</h3>
                          <div className="mt-3 space-y-2 text-sm leading-7 text-zinc-300">
                            {values.length > 0 ? values.map((value, index) => (
                              <p key={`${block.id}-card-${columnIndex}-value-${index}`}>{renderTextWithLineBreaks(value)}</p>
                            )) : <p className="text-zinc-500">—</p>}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )
            }

            return (
              <div key={block.id} className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      {block.columns.map((column, index) => (
                        <th
                          key={`${block.id}-th-${index}`}
                          className="px-3 py-2 text-left font-medium text-zinc-300 border-b border-white/10"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${block.id}-row-${rowIndex}`} className="border-b border-white/5">
                        {row.map((cell, cellIndex) => (
                          <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-zinc-200 leading-7">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          case 'image':
            return (
              <figure key={block.id} className="space-y-2">
                {block.url.trim() ? (
                  <Image
                    src={block.url}
                    alt={block.alt || ''}
                    width={1600}
                    height={900}
                    className="w-full h-auto rounded-xl border border-white/10"
                    unoptimized
                  />
                ) : (
                  renderMediaPlaceholder({ kind: 'image', locale })
                )}
                {block.caption ? <figcaption className="text-sm text-zinc-400">{block.caption}</figcaption> : null}
              </figure>
            )
          case 'video':
            return (
              <figure key={block.id} className="space-y-2">
                {block.url.trim() ? (
                  <video controls preload="metadata" poster={block.posterUrl || undefined} className="w-full rounded-xl border border-white/10">
                    <source src={block.url} />
                  </video>
                ) : (
                  renderMediaPlaceholder({ kind: 'video', locale })
                )}
                {block.caption ? <figcaption className="text-sm text-zinc-400">{block.caption}</figcaption> : null}
              </figure>
            )
          case 'videoEmbed':
            return (
              <figure key={block.id} className="space-y-2">
                {block.url.trim() ? (
                  <div className="aspect-video rounded-xl border border-white/10 overflow-hidden">
                    <iframe
                      src={block.url}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      title={block.caption || 'Video embed'}
                    />
                  </div>
                ) : (
                  renderMediaPlaceholder({ kind: 'video', locale })
                )}
                {block.caption ? <figcaption className="text-sm text-zinc-400">{block.caption}</figcaption> : null}
              </figure>
            )
          case 'button':
            return (
              <div key={block.id}>
                <Link
                  href={block.url || '#'}
                  className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition ${block.variant === 'outline'
                      ? 'border border-white/20 text-zinc-100 hover:bg-white/10'
                      : block.variant === 'ghost'
                        ? 'text-zinc-100 hover:bg-white/10'
                        : 'bg-gradient-to-r from-[#24A1DE] to-[#8B5CF6] text-white hover:opacity-90'
                    }`}
                >
                  {block.label || 'Open'}
                </Link>
              </div>
            )
          case 'divider':
            return <hr key={block.id} className="border-white/10" />
          case 'code':
            return (
              <pre key={block.id} className="rounded-xl border border-white/10 bg-zinc-950/80 p-4 overflow-x-auto text-xs text-zinc-100">
                <code>{block.code}</code>
              </pre>
            )
          case 'richText':
            return (
              <div
                key={block.id}
                className="cms-richtext-content prose prose-invert prose-zinc max-w-none prose-headings:font-semibold prose-a:text-[#5EC8FF] prose-img:rounded-xl prose-img:border prose-img:border-white/10"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
