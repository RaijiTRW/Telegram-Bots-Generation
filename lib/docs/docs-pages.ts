import type { DocsContent } from './docs-content'

export type DocsPageSlug =
  | 'getting-started'
  | 'how-it-works'
  | 'nodes'
  | 'keyboards-triggers'
  | 'data-security'
  | 'testing-deploy'
  | 'troubleshooting'
  | 'video-plan'

export type DocsPageSectionId =
  | 'learning-flow'
  | 'quick-start'
  | 'service-flow'
  | 'editor-areas'
  | 'ui-components'
  | 'nodes-reference'
  | 'keyboards-triggers'
  | 'data-security'
  | 'test-deploy'
  | 'troubleshooting'
  | 'video-plan'

export type DocsPageDefinition = {
  slug: DocsPageSlug
  title: string
  description: string
  sections: DocsPageSectionId[]
}

const SECTION_META_INDEX = (content: DocsContent) =>
  new Map(content.sections.map((section) => [section.id, section]))

export function getDocsPageDefinitions(content: DocsContent): DocsPageDefinition[] {
  const sections = SECTION_META_INDEX(content)

  const getMeta = (id: DocsPageSectionId) =>
    sections.get(id) || { id, title: id, description: '' }

  const learning = getMeta('learning-flow')
  const quick = getMeta('quick-start')
  const service = getMeta('service-flow')
  const areas = getMeta('editor-areas')
  const nodes = getMeta('nodes-reference')
  const kb = getMeta('keyboards-triggers')
  const data = getMeta('data-security')
  const test = getMeta('test-deploy')
  const trouble = getMeta('troubleshooting')
  const video = getMeta('video-plan')

  return [
    {
      slug: 'getting-started',
      title: `${quick.title}`,
      description: `${learning.description || learning.title}. ${quick.description}`.trim(),
      sections: ['learning-flow', 'quick-start'],
    },
    {
      slug: 'how-it-works',
      title: service.title,
      description: `${service.description} ${areas.description}`.trim(),
      sections: ['service-flow', 'editor-areas', 'ui-components'],
    },
    {
      slug: 'nodes',
      title: nodes.title,
      description: nodes.description,
      sections: ['nodes-reference'],
    },
    {
      slug: 'keyboards-triggers',
      title: kb.title,
      description: kb.description,
      sections: ['keyboards-triggers'],
    },
    {
      slug: 'data-security',
      title: data.title,
      description: data.description,
      sections: ['data-security'],
    },
    {
      slug: 'testing-deploy',
      title: test.title,
      description: test.description,
      sections: ['test-deploy'],
    },
    {
      slug: 'troubleshooting',
      title: trouble.title,
      description: trouble.description,
      sections: ['troubleshooting'],
    },
    {
      slug: 'video-plan',
      title: video.title,
      description: video.description,
      sections: ['video-plan'],
    },
  ]
}

export function getDocsPageBySlug(content: DocsContent, slug: string): DocsPageDefinition | null {
  return getDocsPageDefinitions(content).find((page) => page.slug === slug) || null
}
