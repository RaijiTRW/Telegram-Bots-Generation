import enMessages from '../../../app/messages/en.json'
import ruMessages from '../../../app/messages/ru.json'

import { HELP_GUIDE_KEYS, getCanvasPaletteGuideKey, getNodeTemplateGuideKey } from '@/lib/bot-editor/help/help-guide-keys'
import {
  CANVAS_PALETTE_TEMPLATE_IDS,
  NODE_HELP_TEMPLATE_LABELS,
  NODE_HELP_TRANSLATION_SUFFIX_BY_TEMPLATE_ID,
  NODE_TEMPLATE_GUIDE_IDS,
} from '@/lib/bot-editor/help/node-help-guides'
import type { HelpGuideContent, HelpGuideLocale } from '@/lib/bot-editor/help/help-guide-types'

type MessageTree = Record<string, unknown>

type ValueSpec =
  | string
  | {
      path: string
    }

type HelpGuideSeedSpec = {
  guideKey: string
  section: string
  title: ValueSpec
  summary?: ValueSpec
  steps?: ValueSpec[]
  notes?: ValueSpec[]
}

export type LocalizedHelpGuideSeed = HelpGuideContent & {
  guideKey: string
  locale: HelpGuideLocale
}

const MESSAGES_BY_LOCALE: Record<HelpGuideLocale, MessageTree> = {
  ru: ruMessages as MessageTree,
  en: enMessages as MessageTree,
}

const text = (path: string): ValueSpec => ({ path })

function getMessageValue(messages: MessageTree, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, messages)
}

function hasMessagePath(messages: MessageTree, path: string) {
  return typeof getMessageValue(messages, path) === 'string'
}

function resolveValue(messages: MessageTree, spec: ValueSpec | undefined): string | undefined {
  if (!spec) return undefined

  if (typeof spec === 'string') {
    const trimmed = spec.trim()
    return trimmed || undefined
  }

  const value = getMessageValue(messages, spec.path)
  if (typeof value !== 'string') {
    throw new Error(`Missing help-guide message path: ${spec.path}`)
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

function resolveList(messages: MessageTree, specs?: ValueSpec[]) {
  if (!Array.isArray(specs)) return []

  return specs
    .map((spec) => resolveValue(messages, spec))
    .filter((value): value is string => Boolean(value))
}

const STATIC_GUIDE_SPECS: HelpGuideSeedSpec[] = [
  {
    guideKey: HELP_GUIDE_KEYS.editorBotHeader,
    section: 'Editor',
    title: text('editor.nav.botEditor'),
    summary: text('editor.nav.helpSummary'),
    steps: [
      text('editor.nav.helpStep1'),
      text('editor.nav.helpStep2'),
      text('editor.nav.helpStep3'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorCanvasOverview,
    section: 'Canvas',
    title: text('editor.canvas.nodes'),
    summary: text('editor.canvas.helpSummary'),
    steps: [
      text('editor.canvas.helpStep1'),
      text('editor.canvas.helpStep2'),
      text('editor.canvas.helpStep3'),
    ],
    notes: [text('editor.canvas.helpNote')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSettingsOverview,
    section: 'Settings',
    title: text('editor.nav.settings'),
    summary: text('editor.settings.help.overviewSummary'),
    steps: [
      text('editor.settings.help.overviewStep1'),
      text('editor.settings.help.overviewStep2'),
      text('editor.settings.help.overviewStep3'),
    ],
    notes: [text('editor.settings.help.overviewNote')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorAiChatOverview,
    section: 'AI Chat',
    title: text('editor.nav.aiAssistant'),
    summary: text('editor.chat.helpSummary'),
    steps: [
      text('editor.chat.helpStep1'),
      text('editor.chat.helpStep2'),
      text('editor.chat.helpStep3'),
    ],
    notes: [text('editor.chat.helpNote')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSettingsBasicInfo,
    section: 'Settings',
    title: text('editor.settings.basicInfo'),
    summary: text('editor.settings.help.basicSummary'),
    steps: [
      text('editor.settings.help.basicStep1'),
      text('editor.settings.help.basicStep2'),
      text('editor.settings.help.basicStep3'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSettingsProfileStyle,
    section: 'Settings',
    title: text('editor.settings.profileStyleTitle'),
    summary: text('editor.settings.help.profileSummary'),
    steps: [
      text('editor.settings.help.profileStep1'),
      text('editor.settings.help.profileStep2'),
      text('editor.settings.help.profileStep3'),
    ],
    notes: [text('editor.settings.profileUsernameHint')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSettingsTelegramIntegration,
    section: 'Settings',
    title: text('editor.settings.telegramIntegration'),
    summary: text('editor.settings.help.tokenSummary'),
    steps: [
      text('editor.settings.help.tokenStep1'),
      text('editor.settings.help.tokenStep2'),
      text('editor.settings.help.tokenStep3'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSettingsBotToken,
    section: 'Settings',
    title: text('editor.settings.botToken'),
    summary: text('editor.settings.help.tokenSummary'),
    steps: [
      text('editor.settings.help.tokenStep1'),
      text('editor.settings.help.tokenStep2'),
      text('editor.settings.help.tokenStep3'),
    ],
    notes: [text('editor.settings.botTokenStoredSecurely')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemOverview,
    section: 'System',
    title: text('editor.system.title'),
    summary: text('editor.system.help.overviewSummary'),
    steps: [
      text('editor.system.help.overviewStep1'),
      text('editor.system.help.overviewStep2'),
      text('editor.system.help.overviewStep3'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemAutoReactions,
    section: 'System',
    title: text('editor.system.autoReactions.title'),
    summary: text('editor.system.autoReactions.description'),
    steps: [
      text('editor.system.autoReactions.onlyTextHint'),
      text('editor.system.autoReactions.cooldownHint'),
      text('editor.system.autoReactions.footerHint'),
    ],
    notes: [text('editor.system.autoReactions.aiHint')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemAutoReactionsCooldown,
    section: 'System',
    title: text('editor.system.autoReactions.cooldownLabel'),
    summary: text('editor.system.autoReactions.cooldownHint'),
    steps: [
      text('editor.system.autoReactions.cooldownHint'),
      text('editor.system.autoReactions.onlyTextHint'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemAutoReactionsOnlyText,
    section: 'System',
    title: text('editor.system.autoReactions.onlyTextTitle'),
    summary: text('editor.system.autoReactions.onlyTextHint'),
    steps: [
      text('editor.system.autoReactions.onlyTextHint'),
      text('editor.system.autoReactions.ruleQuestion'),
      text('editor.system.autoReactions.ruleError'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboard,
    section: 'System',
    title: text('editor.system.replyKeyboard.title'),
    summary: text('editor.system.replyKeyboard.description'),
    steps: [
      text('editor.system.replyKeyboard.howItWorks1'),
      text('editor.system.replyKeyboard.howItWorks2'),
      text('editor.system.replyKeyboard.howItWorks3'),
    ],
    notes: [text('editor.system.replyKeyboard.editor.replyKeyboardTextTriggerHint')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardResize,
    section: 'System',
    title: text('editor.system.replyKeyboard.resizeTitle'),
    summary: text('editor.system.replyKeyboard.resizeHint'),
    steps: [
      text('editor.system.replyKeyboard.resizeHint'),
      text('editor.system.replyKeyboard.howItWorks1'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardPersistent,
    section: 'System',
    title: text('editor.system.replyKeyboard.persistentTitle'),
    summary: text('editor.system.replyKeyboard.persistentHint'),
    steps: [
      text('editor.system.replyKeyboard.persistentHint'),
      text('editor.system.replyKeyboard.howItWorks1'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardOneTime,
    section: 'System',
    title: text('editor.system.replyKeyboard.oneTimeTitle'),
    summary: text('editor.system.replyKeyboard.oneTimeHint'),
    steps: [
      text('editor.system.replyKeyboard.oneTimeHint'),
      text('editor.system.replyKeyboard.howItWorks2'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardBaseButtons,
    section: 'System',
    title: text('editor.system.replyKeyboard.baseButtonsTitle'),
    summary: text('editor.system.replyKeyboard.baseButtonsEmpty'),
    steps: [
      text('editor.system.replyKeyboard.howItWorks1'),
      text('editor.system.replyKeyboard.howItWorks2'),
    ],
    notes: [text('editor.system.replyKeyboard.editor.replyKeyboardTextTriggerHint')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardRules,
    section: 'System',
    title: text('editor.system.replyKeyboard.rulesTitle'),
    summary: text('editor.system.replyKeyboard.rulesHint'),
    steps: [
      text('editor.system.replyKeyboard.rulesHint'),
      text('editor.system.replyKeyboard.ruleVariableLabel'),
      text('editor.system.replyKeyboard.ruleButtonsLabel'),
    ],
    notes: [text('editor.system.replyKeyboard.editor.replyKeyboardTextTriggerHint')],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardRuleVariable,
    section: 'System',
    title: text('editor.system.replyKeyboard.ruleVariableLabel'),
    summary: text('editor.system.replyKeyboard.ruleVariablePlaceholder'),
    steps: [
      text('editor.system.replyKeyboard.ruleVariablePlaceholder'),
      text('editor.system.replyKeyboard.ruleOperatorLabel'),
      text('editor.system.replyKeyboard.ruleValueLabel'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardRuleOperator,
    section: 'System',
    title: text('editor.system.replyKeyboard.ruleOperatorLabel'),
    summary: text('editor.system.replyKeyboard.rulesHint'),
    steps: [
      text('editor.system.replyKeyboard.operators.equals'),
      text('editor.system.replyKeyboard.operators.contains'),
      text('editor.system.replyKeyboard.operators.isEmpty'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardRuleValue,
    section: 'System',
    title: text('editor.system.replyKeyboard.ruleValueLabel'),
    summary: text('editor.system.replyKeyboard.ruleValuePlaceholder'),
    steps: [
      text('editor.system.replyKeyboard.ruleValuePlaceholder'),
      text('editor.system.replyKeyboard.ruleVariablePlaceholder'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemReplyKeyboardRuleButtons,
    section: 'System',
    title: text('editor.system.replyKeyboard.ruleButtonsLabel'),
    summary: text('editor.system.replyKeyboard.ruleButtonsEmpty'),
    steps: [
      text('editor.system.replyKeyboard.ruleButtonsEmpty'),
      text('editor.system.replyKeyboard.howItWorks3'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemSubscribers,
    section: 'System',
    title: text('editor.system.subscribers.title'),
    summary: text('editor.system.subscribers.description'),
    steps: [
      text('editor.system.subscribers.privateOnlyHint'),
      text('editor.system.subscribers.trackCallbacksHint'),
      text('editor.system.subscribers.note'),
    ],
  },
  {
    guideKey: HELP_GUIDE_KEYS.editorSystemBotInfo,
    section: 'System',
    title: text('editor.system.botInformation'),
    summary: text('editor.system.help.botInfoSummary'),
    steps: [
      text('editor.system.help.botInfoStep1'),
      text('editor.system.help.botInfoStep2'),
      text('editor.system.help.botInfoStep3'),
    ],
  },
]

function buildNodeTemplateGuideSpecs(messages: MessageTree): HelpGuideSeedSpec[] {
  return NODE_TEMPLATE_GUIDE_IDS.map((templateId) => {
    const suffix = NODE_HELP_TRANSLATION_SUFFIX_BY_TEMPLATE_ID[templateId]
    const notePath = `editor.nodeSettings.help.notes.${templateId}`

    return {
      guideKey: getNodeTemplateGuideKey(templateId),
      section: 'Node Settings',
      title: NODE_HELP_TEMPLATE_LABELS[templateId] || templateId,
      summary: text(`editor.canvas.nodeTemplateDescriptions.${suffix}`),
      steps: [
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step1`),
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step2`),
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step3`),
      ],
      notes: hasMessagePath(messages, notePath) ? [text(notePath)] : undefined,
    }
  })
}

function buildCanvasPaletteGuideSpecs(): HelpGuideSeedSpec[] {
  return CANVAS_PALETTE_TEMPLATE_IDS.map((templateId) => {
    const suffix = NODE_HELP_TRANSLATION_SUFFIX_BY_TEMPLATE_ID[templateId]

    return {
      guideKey: getCanvasPaletteGuideKey(templateId),
      section: 'Canvas Palette',
      title: NODE_HELP_TEMPLATE_LABELS[templateId] || templateId,
      summary: text(`editor.canvas.nodeTemplateDescriptions.${suffix}`),
      steps: [
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step1`),
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step2`),
        text(`editor.canvas.nodeTemplateHelpSteps.${suffix}.step3`),
      ],
    }
  })
}

export function getLocalizedHelpGuideSeeds(locale: HelpGuideLocale): LocalizedHelpGuideSeed[] {
  const messages = MESSAGES_BY_LOCALE[locale]
  const allSpecs = [
    ...STATIC_GUIDE_SPECS,
    ...buildNodeTemplateGuideSpecs(messages),
    ...buildCanvasPaletteGuideSpecs(),
  ]

  return allSpecs.map((spec) => ({
    locale,
    guideKey: spec.guideKey,
    section: spec.section,
    title: resolveValue(messages, spec.title),
    summary: resolveValue(messages, spec.summary),
    steps: resolveList(messages, spec.steps),
    notes: resolveList(messages, spec.notes),
  }))
}

export function getAllLocalizedHelpGuideSeeds() {
  return (['ru', 'en'] as const).flatMap((locale) => getLocalizedHelpGuideSeeds(locale))
}
