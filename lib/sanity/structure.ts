'use client'

import type { DefaultDocumentNodeResolver, StructureResolver } from 'sanity/structure'

import { DocsPagePreviewPane } from '@/components/sanity/docs-page-preview-pane'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .id('documentation-root')
        .title('Documentation')
        .child(
          S.list()
            .id('documentation-list')
            .title('Documentation')
            .items([
              S.listItem()
                .id('documentation-ru')
                .title('🇷🇺 Documentation')
                .child(
                  S.documentTypeList('docsPage')
                    .title('🇷🇺 Documentation')
                    .filter('_type == "docsPage" && locale == $locale')
                    .params({ locale: 'ru' })
                    .defaultOrdering([
                      { field: 'sortOrder', direction: 'asc' },
                      { field: 'title', direction: 'asc' },
                    ])
                ),
              S.listItem()
                .id('documentation-en')
                .title('🇺🇸 Documentation')
                .child(
                  S.documentTypeList('docsPage')
                    .title('🇺🇸 Documentation')
                    .filter('_type == "docsPage" && locale == $locale')
                    .params({ locale: 'en' })
                    .defaultOrdering([
                      { field: 'sortOrder', direction: 'asc' },
                      { field: 'title', direction: 'asc' },
                    ])
                ),
            ])
        ),
      S.listItem()
        .id('help-guides-root')
        .title('Help Guides')
        .child(
          S.list()
            .id('help-guides-list')
            .title('Help Guides')
            .items([
              S.listItem()
                .id('help-guides-all')
                .title('All help guides')
                .child(
                  S.documentList()
                    .id('help-guides-all-documents')
                    .title('All help guides')
                    .schemaType('helpGuide')
                    .filter('_type == $type')
                    .params({ type: 'helpGuide' })
                    .defaultOrdering([
                      { field: 'locale', direction: 'asc' },
                      { field: 'section', direction: 'asc' },
                      { field: 'guideKey', direction: 'asc' },
                    ])
                ),
              S.listItem()
                .id('help-guides-ru')
                .title('🇷🇺 Help guides')
                .child(
                  S.documentList()
                    .id('help-guides-ru-documents')
                    .title('🇷🇺 Help guides')
                    .schemaType('helpGuide')
                    .filter('_type == $type && locale == $locale')
                    .params({ type: 'helpGuide', locale: 'ru' })
                    .defaultOrdering([
                      { field: 'section', direction: 'asc' },
                      { field: 'guideKey', direction: 'asc' },
                    ])
                ),
              S.listItem()
                .id('help-guides-en')
                .title('🇺🇸 Help guides')
                .child(
                  S.documentList()
                    .id('help-guides-en-documents')
                    .title('🇺🇸 Help guides')
                    .schemaType('helpGuide')
                    .filter('_type == $type && locale == $locale')
                    .params({ type: 'helpGuide', locale: 'en' })
                    .defaultOrdering([
                      { field: 'section', direction: 'asc' },
                      { field: 'guideKey', direction: 'asc' },
                    ])
                ),
            ])
        ),
    ])

export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, { schemaType }) => {
  if (schemaType !== 'docsPage') {
    return S.document().views([S.view.form()])
  }

  return S.document().views([
    S.view.form().title('Form'),
    S.view.component(DocsPagePreviewPane).title('Preview'),
  ])
}
