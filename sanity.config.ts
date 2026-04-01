'use client'

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { schemaTypes } from '@/lib/sanity/schema-types'
import { defaultDocumentNode, structure } from '@/lib/sanity/structure'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'missing-project-id'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'missing-dataset'

export default defineConfig({
  name: 'default',
  title: 'Content CMS',
  basePath: '/dashboard/cms',
  projectId: projectId || 'missing-project-id',
  dataset: dataset || 'missing-dataset',
  plugins: [
    structureTool({
      structure,
      defaultDocumentNode,
    }),
  ],
  schema: {
    types: schemaTypes,
  },
})
