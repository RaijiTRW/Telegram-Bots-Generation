import { loadEnvConfig } from '@next/env'

import { getDocsContent } from '../lib/docs/docs-content'
import { getDocsPageDefinitions } from '../lib/docs/docs-pages'
import { buildLegacyPageBlocks } from '../lib/docs-cms/repository'
import { getSanityReadClient, getSanityWriteClient } from '../lib/sanity/client'
import {
  docsBlockToSanityBlock,
  sanitizeSanityDocsBlock,
  type RawSanityDocsBlock,
} from '../lib/sanity/docs-blocks'

type SanityDocsPage = {
  _id: string
  blocks: RawSanityDocsBlock[]
}

const GETTING_STARTED_TRANSLATIONS: Array<Partial<RawSanityDocsBlock>> = [
  { text: 'Quick Start' },
  { text: 'Reading order and section format. Create a bot, build a workflow, and test it.' },
  { text: 'How to read this documentation' },
  {
    text:
      'All sections follow the same principle: **action -> what the system does -> how to verify -> common mistakes**. This is a step-by-step working manual, not just a platform overview.',
  },
  {
    items: [
      'Start by completing **"Quick Start"** from beginning to end. Do not try to learn every node immediately.',
      'Once it works, review **"Editor sections"** and **"Interface components"** so you understand where the key features live.',
      'Use **"Nodes and presets"** as a reference: return to it when you need a specific node.',
      'Adding buttons? Make sure to read **"Keyboards and triggers"**. It helps you avoid confusing regular buttons (Reply) with buttons inside a message (Inline).',
      'If something breaks, open **"Test, logs, deploy"** and **"Troubleshooting"**. Those sections explain how to fix issues.',
    ],
  },
  { caption: 'Video guides (coming soon)' },
  { text: 'Quick Start' },
  { text: 'Quick Start: your first bot from idea to test' },
  {
    text:
      'The fastest path to a working bot: create a bot, connect **Trigger** and **Message** nodes, save, click **Test**, and check the logs.',
  },
  { text: '1. Create a bot in Bots' },
  { text: 'Get a bot card and open the editor.' },
  {
    title: 'Actions',
    text:
      'Open `Dashboard -> Bots`.\nClick `New bot` / `Create first bot`.\nEnter a name and short description.\nAfter creation, open the editor (`double-click the bot card`).',
  },
  {
    title: 'What to check',
    text:
      'After entering, you should see the bot editor with the canvas, left navigation, and node panel.\nThe top header shows the bot name and the `Save` and `Test` buttons.',
  },
  { caption: 'Video: creating the first bot and opening the editor' },
  { text: '2. Build a minimal workflow on Canvas' },
  { text: 'Create a simple scenario: trigger -> message.' },
  {
    title: 'Actions',
    text:
      'Add `Command Trigger` and `Message`.\nConnect them with a line.\nIn `Command Trigger` settings, set a command, for example `/start`.\nIn `Message`, set the response text.',
  },
  {
    title: 'What to check',
    text:
      'The canvas shows a connection between trigger and message.\nWhen selecting a node, its settings are visible on the right or in full modal mode.',
  },
  { caption: 'Video: building the first scenario on the canvas' },
  { text: '3. Add a variable and use it in a node' },
  { text: 'Understand the difference between user variables and runtime data.' },
  {
    title: 'Actions',
    text:
      'Open `System`.\nAdd a user variable, for example `welcomeText`.\nReturn to Canvas, click the `Message` node, and insert the `{{welcomeText}}` template (use `{{` suggestions to select your variable).\n\nOr use `Action -> setVariable` if you want a value only during test runtime.',
  },
  {
    title: 'Difference between regular variables and runtime variables',
    text:
      'User variables are saved in the config (`bot_configs.variables`).\nRuntime variables (`setVariable`) live in the test session and do not have to appear in the System variables table.\n\nRuntime variables are useful when you only need to temporarily change a value inside the bot.',
  },
  {
    title: 'What to check',
    text:
      'The created user variable is visible in `System -> Variables`.\nIn the `Message` text field, variable suggestions appear when typing `{{`.',
  },
  { caption: 'Step detail: System -> `welcomeText` variable' },
  { caption: 'Video: runtime variables and how to work with them' },
  { text: '4. Save changes' },
  { text: 'Persist the current canvas and project settings.' },
  {
    title: 'Actions',
    text:
      'Click `Save` in the editor top header.\nWait until saving finishes.\nIf there are errors, check bot settings (token/secrets) separately in `Settings`.',
  },
  { caption: 'Step detail: saving changes' },
  { text: '5. Run Test and check logs' },
  { text: 'Verify the workflow without a full deploy.' },
  {
    title: 'Actions',
    text:
      'Click `Test` on the canvas.\nOpen the bottom logs panel (`Bot logs`).\nSend the bot a message or command in Telegram.\nCheck whether the correct trigger fired and whether the message was sent.',
  },
  {
    title: 'What to check',
    text:
      'Logs show the test start, incoming event, and selected node path.\nTelegram receives a reply message from the bot.',
  },
  { caption: 'Step detail: running Test and checking logs' },
  { text: '6. Stop Test and lock in the working version' },
  { text: 'End the test session.' },
  {
    title: 'Actions',
    text:
      'Click `Stop` (the same test button while test mode is active).\nMake sure test status and logs stop updating.\nSave final changes if you edited anything during the test.',
  },
  {
    title: 'What the system does',
    text:
      'The test runtime/polling for this bot stops.\nThe active test flag is reset in bot metadata.\nThe bottom logs panel remains available for viewing the run history.',
  },
  {
    title: 'What to check',
    text: 'The button returns to the `Test` state.\nNo new logs appear without new actions.',
  },
  { caption: 'Step detail: stopping Test' },
  { caption: 'Video: stopping Test correctly' },
]

function applyTranslations(
  sourceBlocks: RawSanityDocsBlock[],
  translations: Array<Partial<RawSanityDocsBlock>>
) {
  return sourceBlocks.map((block, index) =>
    sanitizeSanityDocsBlock({
      ...block,
      ...translations[index],
    })
  )
}

function getEnglishNodesBlocks() {
  const content = getDocsContent('en')
  const nodesPage = getDocsPageDefinitions(content).find((page) => page.slug === 'nodes')

  if (!nodesPage) {
    throw new Error('Local EN nodes page definition was not found.')
  }

  const legacyBlocks = buildLegacyPageBlocks(content, nodesPage, 'en')
    .map((block, index) => docsBlockToSanityBlock(block, index))

  const result: RawSanityDocsBlock[] = [
    {
      ...legacyBlocks[0],
      level: 2,
    },
    legacyBlocks[1],
    {
      _key: 'nodes-how-to-use-title',
      _type: 'docsHeading',
      level: 3,
      text: 'Nodes and presets: How to use them',
    },
    {
      _key: 'nodes-how-to-use-description',
      _type: 'docsParagraph',
      text:
        'This is a complete reference for Canvas nodes and ready-made presets. It explains what each node is for, how to configure it, and what limitations to keep in mind.',
    },
    ...legacyBlocks.slice(6, 12),
    {
      _key: 'video-command-trigger-overview',
      _type: 'docsVideo',
      url: '',
      posterUrl: '',
      caption: 'Video overview: Command Trigger',
    },
    ...legacyBlocks.slice(12),
  ]

  return result.map((block) => sanitizeSanityDocsBlock(block))
}

async function main() {
  loadEnvConfig(process.cwd())

  const readClient = getSanityReadClient({ perspective: 'raw', useCdn: false })
  const writeClient = getSanityWriteClient()

  const ruGettingStarted = await readClient.fetch<SanityDocsPage | null>(
    '*[_id == "drafts.docsPage.ru.getting-started"][0]{_id, blocks}'
  )

  if (!ruGettingStarted?.blocks?.length) {
    throw new Error('RU getting-started draft was not found.')
  }

  if (ruGettingStarted.blocks.length !== GETTING_STARTED_TRANSLATIONS.length) {
    throw new Error(
      `Unexpected getting-started block count: ${ruGettingStarted.blocks.length}. Expected ${GETTING_STARTED_TRANSLATIONS.length}.`
    )
  }

  const gettingStartedBlocks = applyTranslations(
    ruGettingStarted.blocks,
    GETTING_STARTED_TRANSLATIONS
  )
  const nodesBlocks = getEnglishNodesBlocks()

  const transaction = writeClient
    .transaction()
    .patch('docsPage.en.getting-started', {
      set: {
        title: 'Quick Start',
        summary: 'Reading order and section format. Create a bot, build a workflow, and test it.',
        blocks: gettingStartedBlocks,
      },
    })
    .patch('docsPage.en.nodes', {
      set: {
        title: 'Nodes and presets',
        summary: 'What each node does and how to set it up',
        blocks: nodesBlocks,
      },
    })

  const result = await transaction.commit()

  console.log(`Updated EN docs pages: ${result.results.length}`)
  console.log(`getting-started blocks: ${gettingStartedBlocks.length}`)
  console.log(`nodes blocks: ${nodesBlocks.length}`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
