'use client'

import { useEffect, useState } from 'react'
import type { StringInputProps } from 'sanity'
import { useClient, useFormValue } from 'sanity'

import { SANITY_API_VERSION } from '@/lib/sanity/config'

type SectionRow = {
  _id: string
  title?: string
  summary?: string
  slug?: string
}

const SECTION_ROWS_QUERY = `*[
  _type == "docsPage"
  && locale == $locale
  && !coalesce(isHome, false)
  && !(_id in path("drafts.**"))
] | order(coalesce(sortOrder, 0) asc, title asc) {
  _id,
  title,
  summary,
  "slug": slug.current
}`

export function DocsHomeSectionsNoteInput(_: StringInputProps) {
  void _
  const client = useClient({ apiVersion: SANITY_API_VERSION })
  const documentValue = useFormValue([]) as { isHome?: boolean; locale?: string } | undefined
  const isHome = Boolean(documentValue?.isHome)
  const locale = documentValue?.locale === 'en' ? 'en' : 'ru'
  const [sections, setSections] = useState<SectionRow[]>([])

  useEffect(() => {
    if (!isHome) {
      return
    }

    let cancelled = false

    void client.fetch<SectionRow[]>(SECTION_ROWS_QUERY, { locale }).then((rows) => {
      if (!cancelled) {
        setSections(Array.isArray(rows) ? rows : [])
      }
    }).catch(() => {
      if (!cancelled) {
        setSections([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, isHome, locale])

  if (!isHome) {
    return null
  }

  const copy = locale === 'en'
    ? {
        title: 'Section cards are generated automatically',
        body:
          'The cards on the documentation home page are not edited here as a list. Change each section page Title and Summary to update its card.',
        helper:
          'Open a page from the middle column, edit Title and Summary there, then publish. This home page only controls the intro text above the cards.',
        pathLabel: '/docs/',
        summaryFallback: 'No summary yet',
      }
    : {
        title: 'Карточки разделов генерируются автоматически',
        body:
          'Карточки на главной странице документации больше не редактируются тут списком. Чтобы поменять карточку, откройте саму страницу раздела и измените у неё поля Title и Summary.',
        helper:
          'Открывайте страницу из среднего списка, меняйте Title и Summary там и публикуйте. На этой главной странице редактируется только вводный текст над карточками.',
        pathLabel: '/docs/',
        summaryFallback: 'Пока без описания',
      }

  return (
    <div
      style={{
        border: '1px solid rgba(96, 165, 250, 0.35)',
        background: 'rgba(10, 22, 39, 0.72)',
        borderRadius: 14,
        padding: 16,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{copy.title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(228, 228, 231, 0.92)' }}>{copy.body}</div>
      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(161, 161, 170, 0.95)' }}>{copy.helper}</div>
      {sections.length > 0 ? (
        <div
          style={{
            marginTop: 4,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: 12,
            display: 'grid',
            gap: 10,
          }}
        >
          {sections.map((section) => (
            <div
              key={section._id}
              style={{
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                {section.title || 'Untitled'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(125, 211, 252, 0.95)', marginBottom: 4 }}>
                {copy.pathLabel}{section.slug || ''}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(212, 212, 216, 0.92)' }}>
                {typeof section.summary === 'string' && section.summary.trim()
                  ? section.summary.trim()
                  : copy.summaryFallback}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
