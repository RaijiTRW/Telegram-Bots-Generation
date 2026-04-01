import { defineArrayMember, defineField, defineType } from 'sanity'

import { SANITY_API_VERSION } from '@/lib/sanity/config'

const LOCALE_SCOPED_GUIDE_KEY_UNIQUENESS_QUERY = `
  count(*[
    _type == "helpGuide"
    && locale == $locale
    && guideKey == $guideKey
    && !(_id in [$draftId, $publishedId])
  ]) == 0
`

type MinimalGuideUniqueContext = {
  document?: {
    _id?: string
    locale?: string
  }
  getClient: (options: { apiVersion: string }) => {
    fetch: <T = unknown>(query: string, params?: Record<string, unknown>) => Promise<T>
  }
}

async function isLocaleScopedGuideKeyUnique(value: string | undefined, context: unknown) {
  const safeContext = context as MinimalGuideUniqueContext
  const guideKey = typeof value === 'string' ? value.trim() : ''
  if (!guideKey) {
    return true
  }

  const rawId = typeof safeContext.document?._id === 'string' ? safeContext.document._id : ''
  const publishedId = rawId.replace(/^drafts\./, '')
  const draftId = publishedId ? `drafts.${publishedId}` : ''
  const locale =
    typeof safeContext.document?.locale === 'string' && safeContext.document.locale.trim()
      ? safeContext.document.locale.trim()
      : 'ru'

  const client = safeContext.getClient({ apiVersion: SANITY_API_VERSION })
  const isUnique = await client.fetch<boolean>(LOCALE_SCOPED_GUIDE_KEY_UNIQUENESS_QUERY, {
    locale,
    guideKey,
    draftId,
    publishedId,
  })

  return isUnique || 'Guide key must be unique within the selected locale.'
}

export const helpGuideType = defineType({
  name: 'helpGuide',
  title: 'Help guide',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'settings', title: 'Settings' },
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
      name: 'guideKey',
      title: 'Guide key',
      type: 'string',
      group: 'settings',
      description: 'Stable identifier used by the bot editor to load this help modal.',
      validation: (Rule) => Rule.required().custom(isLocaleScopedGuideKeyUnique),
    }),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'string',
      group: 'settings',
      description: 'Used in Studio previews to group similar help guides.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: ['content', 'settings'],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 3,
      group: 'content',
    }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'notes',
      title: 'Notes',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.unique(),
    }),
  ],
  initialValue: {
    locale: 'ru',
    section: 'Editor',
    steps: [],
    notes: [],
  },
  orderings: [
    {
      title: 'Section / guide key',
      name: 'sectionGuideKeyAsc',
      by: [
        { field: 'section', direction: 'asc' },
        { field: 'guideKey', direction: 'asc' },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      locale: 'locale',
      section: 'section',
      guideKey: 'guideKey',
    },
    prepare({ title, locale, section, guideKey }) {
      const localeLabel = typeof locale === 'string' ? locale.toUpperCase() : 'RU'
      const safeSection = typeof section === 'string' && section.trim() ? section.trim() : 'Editor'
      const safeGuideKey = typeof guideKey === 'string' && guideKey.trim() ? guideKey.trim() : 'missing-key'

      return {
        title: title || 'Untitled help guide',
        subtitle: `${localeLabel} • ${safeSection} • ${safeGuideKey}`,
      }
    },
  },
})
