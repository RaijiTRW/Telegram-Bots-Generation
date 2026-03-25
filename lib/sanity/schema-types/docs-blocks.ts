import { defineArrayMember, defineField, defineType } from 'sanity'

export const docsSeoType = defineType({
  name: 'docsSeo',
  title: 'SEO',
  type: 'object',
  fields: [
    defineField({
      name: 'title',
      title: 'SEO title',
      type: 'string',
    }),
    defineField({
      name: 'description',
      title: 'SEO description',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'ogImage',
      title: 'OG image URL',
      type: 'url',
    }),
    defineField({
      name: 'noIndex',
      title: 'No index',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})

export const docsTableRowType = defineType({
  name: 'docsTableRow',
  title: 'Table row',
  type: 'object',
  fields: [
    defineField({
      name: 'cells',
      title: 'Cells',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      cells: 'cells',
    },
    prepare({ cells }) {
      return {
        title: Array.isArray(cells) && cells.length > 0 ? cells.join(' | ') : 'Empty row',
      }
    },
  },
})

export const docsHeadingType = defineType({
  name: 'docsHeading',
  title: 'Heading',
  type: 'object',
  fields: [
    defineField({
      name: 'level',
      title: 'Level',
      type: 'number',
      initialValue: 2,
      options: {
        list: [1, 2, 3, 4, 5, 6].map((level) => ({ title: `H${level}`, value: level })),
        layout: 'radio',
      },
      validation: (Rule) => Rule.required().min(1).max(6),
    }),
    defineField({
      name: 'text',
      title: 'Text',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      level: 'level',
      text: 'text',
    },
    prepare({ level, text }) {
      return {
        title: text || 'Heading',
        subtitle: `H${level || 2}`,
      }
    },
  },
})

export const docsParagraphType = defineType({
  name: 'docsParagraph',
  title: 'Paragraph',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Text',
      type: 'text',
      rows: 6,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      text: 'text',
    },
    prepare({ text }) {
      return {
        title: 'Paragraph',
        subtitle: typeof text === 'string' ? text.slice(0, 80) : 'Empty paragraph',
      }
    },
  },
})

export const docsListType = defineType({
  name: 'docsList',
  title: 'List',
  type: 'object',
  fields: [
    defineField({
      name: 'ordered',
      title: 'Ordered list',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'items',
      title: 'Items',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      ordered: 'ordered',
      items: 'items',
    },
    prepare({ ordered, items }) {
      return {
        title: ordered ? 'Ordered list' : 'List',
        subtitle: Array.isArray(items) ? `${items.length} item(s)` : 'No items',
      }
    },
  },
})

export const docsCalloutType = defineType({
  name: 'docsCallout',
  title: 'Callout',
  type: 'object',
  fields: [
    defineField({
      name: 'tone',
      title: 'Tone',
      type: 'string',
      initialValue: 'info',
      options: {
        list: [
          { title: 'Info', value: 'info' },
          { title: 'Success', value: 'success' },
          { title: 'Warning', value: 'warning' },
          { title: 'Danger', value: 'danger' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'text',
      title: 'Text',
      type: 'text',
      rows: 4,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      tone: 'tone',
    },
    prepare({ title, tone }) {
      return {
        title: title || 'Callout',
        subtitle: tone || 'info',
      }
    },
  },
})

export const docsTableType = defineType({
  name: 'docsTable',
  title: 'Table',
  type: 'object',
  fields: [
    defineField({
      name: 'columns',
      title: 'Columns',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [defineArrayMember({ type: 'docsTableRow' })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      columns: 'columns',
      rows: 'rows',
    },
    prepare({ columns, rows }) {
      return {
        title: 'Table',
        subtitle: `${Array.isArray(columns) ? columns.length : 0} column(s), ${Array.isArray(rows) ? rows.length : 0} row(s)`,
      }
    },
  },
})

export const docsImageType = defineType({
  name: 'docsImage',
  title: 'Image',
  type: 'object',
  fields: [
    defineField({
      name: 'asset',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'url',
      title: 'External image URL',
      type: 'url',
    }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
  ],
  validation: (Rule) =>
    Rule.custom((value) => {
      if (!value || typeof value !== 'object') {
        return 'Add an uploaded image or external image URL'
      }

      const record = value as { asset?: unknown; url?: unknown }
      return record.asset || record.url ? true : 'Add an uploaded image or external image URL'
    }),
  preview: {
    select: {
      title: 'caption',
      media: 'asset',
    },
    prepare({ title, media }) {
      return {
        title: title || 'Image',
        media,
      }
    },
  },
})

export const docsVideoType = defineType({
  name: 'docsVideo',
  title: 'Video',
  type: 'object',
  fields: [
    defineField({
      name: 'asset',
      title: 'Video file',
      type: 'file',
      options: {
        accept: 'video/*',
      },
    }),
    defineField({
      name: 'url',
      title: 'External video URL',
      type: 'url',
    }),
    defineField({
      name: 'poster',
      title: 'Poster image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'posterUrl',
      title: 'External poster URL',
      type: 'url',
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      title: 'caption',
    },
    prepare({ title }) {
      return {
        title: title || 'Video',
      }
    },
  },
})

export const docsVideoEmbedType = defineType({
  name: 'docsVideoEmbed',
  title: 'Video embed',
  type: 'object',
  fields: [
    defineField({
      name: 'provider',
      title: 'Provider',
      type: 'string',
      initialValue: 'other',
      options: {
        list: [
          { title: 'YouTube', value: 'youtube' },
          { title: 'Vimeo', value: 'vimeo' },
          { title: 'Other', value: 'other' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Embed URL',
      type: 'url',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      provider: 'provider',
      url: 'url',
    },
    prepare({ provider, url }) {
      return {
        title: 'Video embed',
        subtitle: `${provider || 'other'}${url ? ` • ${url}` : ''}`,
      }
    },
  },
})

export const docsButtonType = defineType({
  name: 'docsButton',
  title: 'Button',
  type: 'object',
  fields: [
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'variant',
      title: 'Variant',
      type: 'string',
      initialValue: 'default',
      options: {
        list: [
          { title: 'Default', value: 'default' },
          { title: 'Outline', value: 'outline' },
          { title: 'Ghost', value: 'ghost' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: 'label',
      subtitle: 'url',
    },
  },
})

export const docsDividerType = defineType({
  name: 'docsDivider',
  title: 'Divider',
  type: 'object',
  fields: [
    defineField({
      name: 'marker',
      title: 'Marker',
      type: 'string',
      initialValue: 'divider',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Divider',
      }
    },
  },
})

export const docsCodeType = defineType({
  name: 'docsCode',
  title: 'Code',
  type: 'object',
  fields: [
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      initialValue: 'text',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'code',
      title: 'Code',
      type: 'text',
      rows: 10,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      language: 'language',
      code: 'code',
    },
    prepare({ language, code }) {
      return {
        title: `Code (${language || 'text'})`,
        subtitle: typeof code === 'string' ? code.split('\n')[0]?.slice(0, 80) : 'Empty code block',
      }
    },
  },
})

export const docsBlockMembers = [
  defineArrayMember({ type: 'docsHeading' }),
  defineArrayMember({ type: 'docsParagraph' }),
  defineArrayMember({ type: 'docsList' }),
  defineArrayMember({ type: 'docsCallout' }),
  defineArrayMember({ type: 'docsTable' }),
  defineArrayMember({ type: 'docsImage' }),
  defineArrayMember({ type: 'docsVideo' }),
  defineArrayMember({ type: 'docsVideoEmbed' }),
  defineArrayMember({ type: 'docsButton' }),
  defineArrayMember({ type: 'docsDivider' }),
  defineArrayMember({ type: 'docsCode' }),
]

export const docsBlockTypes = [
  docsSeoType,
  docsTableRowType,
  docsHeadingType,
  docsParagraphType,
  docsListType,
  docsCalloutType,
  docsTableType,
  docsImageType,
  docsVideoType,
  docsVideoEmbedType,
  docsButtonType,
  docsDividerType,
  docsCodeType,
]
