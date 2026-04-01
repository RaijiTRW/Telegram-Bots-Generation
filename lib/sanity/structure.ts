'use client'

import type { DefaultDocumentNodeResolver, StructureResolver } from 'sanity/structure'

import { DocsPagePreviewPane } from '@/components/sanity/docs-page-preview-pane'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Documentation')
        .child(
          S.list()
            .title('Documentation')
            .items([
              S.listItem()
                .title('RU documentation')
                .child(
                  S.documentTypeList('docsPage')
                    .title('RU documentation')
                    .filter('_type == "docsPage" && locale == $locale')
                    .params({ locale: 'ru' })
                    .defaultOrdering([
                      { field: 'sortOrder', direction: 'asc' },
                      { field: 'title', direction: 'asc' },
                    ])
                ),
              S.listItem()
                .title('EN documentation')
                .child(
                  S.documentTypeList('docsPage')
                    .title('EN documentation')
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
        .title('Help Guides')
        .child(
          S.list()
            .title('Help Guides')
            .items([
              S.listItem()
                .title('RU help guides')
                .child(
                  S.documentTypeList('helpGuide')
                    .title('RU help guides')
                    .filter('_type == "helpGuide" && locale == $locale')
                    .params({ locale: 'ru' })
                    .defaultOrdering([
                      { field: 'section', direction: 'asc' },
                      { field: 'guideKey', direction: 'asc' },
                    ])
                ),
              S.listItem()
                .title('EN help guides')
                .child(
                  S.documentTypeList('helpGuide')
                    .title('EN help guides')
                    .filter('_type == "helpGuide" && locale == $locale')
                    .params({ locale: 'en' })
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
