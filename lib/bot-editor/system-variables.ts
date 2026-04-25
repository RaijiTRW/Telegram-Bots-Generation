import type { VariableType } from './types/bot.types'

export type BotSystemVariableDefinition = {
  name: string
  type: VariableType
  descriptionKey: string
}

export const BOT_SYSTEM_VARIABLES: BotSystemVariableDefinition[] = [
  {
    name: 'user.id',
    type: 'string',
    descriptionKey: 'userId',
  },
  {
    name: 'user.username',
    type: 'string',
    descriptionKey: 'username',
  },
  {
    name: 'user.firstName',
    type: 'string',
    descriptionKey: 'firstName',
  },
  {
    name: 'user.lastName',
    type: 'string',
    descriptionKey: 'lastName',
  },
  {
    name: 'user.languageCode',
    type: 'string',
    descriptionKey: 'languageCode',
  },
  {
    name: 'callback.data',
    type: 'string',
    descriptionKey: 'callbackData',
  },
] as const

export const BOT_SYSTEM_VARIABLE_NAMES = BOT_SYSTEM_VARIABLES.map((variable) => variable.name)

const BOT_SYSTEM_VARIABLE_NAME_SET = new Set(BOT_SYSTEM_VARIABLE_NAMES)
const RESERVED_BOT_VARIABLE_ROOTS = new Set(['callback'])

export function isBotSystemVariableName(value: string): boolean {
  return BOT_SYSTEM_VARIABLE_NAME_SET.has(String(value || '').trim())
}

export function isReservedBotVariableName(value: string): boolean {
  const normalized = String(value || '').trim()
  return BOT_SYSTEM_VARIABLE_NAME_SET.has(normalized) || RESERVED_BOT_VARIABLE_ROOTS.has(normalized)
}

export function getBotSystemVariableDefinition(name: string): BotSystemVariableDefinition | null {
  const normalized = String(name || '').trim()
  return BOT_SYSTEM_VARIABLES.find((variable) => variable.name === normalized) || null
}
