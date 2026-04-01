import { docsBlockTypes } from '@/lib/sanity/schema-types/docs-blocks'
import { docsPageType } from '@/lib/sanity/schema-types/docs-page'
import { helpGuideType } from '@/lib/sanity/schema-types/help-guide'

export const schemaTypes = [
  ...docsBlockTypes,
  docsPageType,
  helpGuideType,
]
