import copy from './client-source-intake-copy.json'
import type { ClientLanguage } from './client-preferences'
import { readSourceIntake, type SourceIntake, type SourceIntakeKey } from './client-source-intake'

export type SourceIntakeCopyKey = keyof typeof copy
export const sourceIntakeText = (language: ClientLanguage, key: SourceIntakeCopyKey) => copy[key][language]
export const sourceIntakeQuestion = (key: SourceIntakeKey) => `${key}Title` as SourceIntakeCopyKey
export const sourceIntakeOption = (key: SourceIntakeKey, index: number) => `${key}${index}` as SourceIntakeCopyKey
export function sourceIntakeRows(value: SourceIntake, language: ClientLanguage): [string, string][] {
  const intake = readSourceIntake(value)
  if (!intake || intake.answers.length !== 5) return []
  return (['asset', 'budget', 'style', 'period', 'stop'] as const).map(key => {
    const answer = intake.answers.find(item => item.key === key)!
    return [sourceIntakeText(language, key), `${sourceIntakeText(language, sourceIntakeOption(key, answer.index))}${answer.recommended ? ` (${sourceIntakeText(language, 'recommended')})` : ''}`]
  })
}
