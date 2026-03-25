import { defineArrayMember, defineField, defineType } from 'sanity'

import { DocsHomeSectionsNoteInput } from '@/components/sanity/docs-home-sections-note-input'
import { SANITY_API_VERSION } from '@/lib/sanity/config'
import { docsBlockMembers } from '@/lib/sanity/schema-types/docs-blocks'

const LOCALE_SCOPED_SLUG_UNIQUENESS_QUERY = `
  count(*[
    _type == "docsPage"
    && locale == $locale
    && slug.current == $slug
    && !(_id in [$draftId, $publishedId])
  ]) == 0
`

type MinimalSlugUniqueContext = {
  document?: {
    _id?: string
    locale?: string
  }
  getClient: (options: { apiVersion: string }) => {
    fetch: <T = unknown>(query: string, params?: Record<string, unknown>) => Promise<T>
  }
}

async function isLocaleScopedSlugUnique(value: string, context: unknown) {
  const safeContext = context as MinimalSlugUniqueContext
  const slug = typeof value === 'string' ? value.trim() : ''
  if (!slug) {
    return true
  }

  const rawId = typeof safeContext.document?._id === 'string' ? safeContext.document._id : ''
  const publishedId = rawId.replace(/^drafts\./, '')
  const draftId = publishedId ? `drafts.${publishedId}` : ''
  const locale = typeof safeContext.document?.locale === 'string' && safeContext.document.locale.trim()
    ? safeContext.document.locale.trim()
    : 'ru'

  const client = safeContext.getClient({ apiVersion: SANITY_API_VERSION })
  return client.fetch<boolean>(LOCALE_SCOPED_SLUG_UNIQUENESS_QUERY, {
    slug,
    locale,
    draftId,
    publishedId,
  })
}

export const docsPageType = defineType({
  name: 'docsPage',
  title: 'Docs page',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'settings', title: 'Settings' },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    defineField({
      name: 'locale',
      title: 'Locale',
      type: 'string',
      group: 'settings',
      initialValue: 'ru',
      options: {
        list: [
          { title: 'RU', value: 'ru' },
          { title: 'EN', value: 'en' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: ['content', 'settings'],
      description: 'For regular docs pages this is also the section card title on the documentation home page.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 3,
      description: 'Shown on the documentation home page cards for quick navigation.',
      group: ['content', 'settings'],
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'settings',
      options: {
        source: 'title',
        isUnique: isLocaleScopedSlugUnique,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'parentPage',
      title: 'Parent page',
      type: 'reference',
      group: 'settings',
      to: [{ type: 'docsPage' }],
      options: {
        filter: ({ document }) => {
          const locale = typeof document?.locale === 'string' ? document.locale : 'ru'
          const rawId = typeof document?._id === 'string' ? document._id : ''
          const documentId = rawId.replace(/^drafts\./, '')

          return {
            filter: '_type == "docsPage" && locale == $locale && !(_id in [$draftId, $publishedId])',
            params: {
              locale,
              draftId: documentId ? `drafts.${documentId}` : '',
              publishedId: documentId,
            },
          }
        },
      },
    }),
    defineField({
      name: 'sortOrder',
      title: 'Sort order',
      type: 'number',
      group: 'settings',
      initialValue: 0,
      validation: (Rule) => Rule.required().integer(),
    }),
    defineField({
      name: 'isHome',
      title: 'Home page',
      type: 'boolean',
      group: 'settings',
      initialValue: false,
    }),
    defineField({
      name: 'previousPaths',
      title: 'Previous paths',
      type: 'array',
      group: 'settings',
      of: [defineArrayMember({ type: 'string' })],
      description: 'Used for redirects from old docs URLs. Store paths without leading slash.',
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'generatedSectionsHelp',
      title: 'Section cards',
      type: 'string',
      group: 'content',
      readOnly: true,
      hidden: ({ document }) => !document?.isHome,
      description: 'For the documentation home page only.',
      components: {
        input: DocsHomeSectionsNoteInput,
      },
    }),
    defineField({
      name: 'blocks',
      title: 'Blocks',
      type: 'array',
      group: 'content',
      of: docsBlockMembers,
      description: 'On the documentation home page, the section cards below are generated automatically from other docs pages. Edit each page Title and Summary to change those cards.',
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'docsSeo',
      group: 'seo',
    }),
  ],
  initialValue: {
    locale: 'ru',
    sortOrder: 0,
    isHome: false,
    previousPaths: [],
    blocks: [],
  },
  orderings: [
    {
      title: 'Sort order',
      name: 'sortOrderAsc',
      by: [
        { field: 'sortOrder', direction: 'asc' },
        { field: 'title', direction: 'asc' },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      summary: 'summary',
      locale: 'locale',
      isHome: 'isHome',
      slug: 'slug.current',
    },
    prepare({ title, summary, locale, isHome, slug }) {
      const localeLabel = typeof locale === 'string' ? locale.toUpperCase() : 'RU'
      const pathLabel = isHome ? '/docs' : slug ? `/docs/${slug}` : '/docs'

      return {
        title: title || 'Untitled docs page',
        subtitle: `${localeLabel} • ${pathLabel}${summary ? ` • ${summary}` : ''}`,
      }
    },
  },
})
