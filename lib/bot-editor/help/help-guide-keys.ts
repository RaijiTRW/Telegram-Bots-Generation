export const HELP_GUIDE_KEYS = {
  editorBotHeader: 'editor.bot-header',
  editorCanvasOverview: 'editor.canvas.overview',
  editorSettingsOverview: 'editor.settings.overview',
  editorAiChatOverview: 'editor.ai-chat.overview',
  editorSettingsBasicInfo: 'editor.settings.basic-info',
  editorSettingsProfileStyle: 'editor.settings.profile-style',
  editorSettingsTelegramIntegration: 'editor.settings.telegram-integration',
  editorSettingsBotToken: 'editor.settings.bot-token',
  editorSystemOverview: 'editor.system.overview',
  editorSystemAutoReactions: 'editor.system.auto-reactions',
  editorSystemAutoReactionsCooldown: 'editor.system.auto-reactions.cooldown',
  editorSystemAutoReactionsOnlyText: 'editor.system.auto-reactions.only-text',
  editorSystemReplyKeyboard: 'editor.system.reply-keyboard',
  editorSystemReplyKeyboardResize: 'editor.system.reply-keyboard.resize',
  editorSystemReplyKeyboardPersistent: 'editor.system.reply-keyboard.persistent',
  editorSystemReplyKeyboardOneTime: 'editor.system.reply-keyboard.one-time',
  editorSystemReplyKeyboardBaseButtons: 'editor.system.reply-keyboard.base-buttons',
  editorSystemReplyKeyboardRules: 'editor.system.reply-keyboard.rules',
  editorSystemReplyKeyboardRuleVariable: 'editor.system.reply-keyboard.rule-variable',
  editorSystemReplyKeyboardRuleOperator: 'editor.system.reply-keyboard.rule-operator',
  editorSystemReplyKeyboardRuleValue: 'editor.system.reply-keyboard.rule-value',
  editorSystemReplyKeyboardRuleButtons: 'editor.system.reply-keyboard.rule-buttons',
  editorSystemSubscribers: 'editor.system.subscribers',
  editorSystemBotInfo: 'editor.system.bot-info',
} as const

export function getCanvasPaletteGuideKey(templateId: string) {
  return `canvas.palette.${String(templateId || '').trim()}`
}

export function getNodeTemplateGuideKey(templateId: string) {
  return `node-template.${String(templateId || '').trim()}`
}
