import { docsBlockTypes } from '@/lib/sanity/schema-types/docs-blocks'
import { docsPageType } from '@/lib/sanity/schema-types/docs-page'

export const schemaTypes = [
  ...docsBlockTypes,
  docsPageType,
]
