import { defineCliConfig } from 'sanity/cli'

import { getSanityEnv } from '@/lib/sanity/config'

const { projectId, dataset } = getSanityEnv()

export default defineCliConfig({
  api: {
    projectId: projectId || 'missing-project-id',
    dataset: dataset || 'missing-dataset',
  },
})
