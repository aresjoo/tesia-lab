import type { ClientLanguage } from './client-preferences'

/** A strategy condition is not a rounded performance metric. Preserve the
 * supplied number; localize punctuation without changing the threshold. */
export function conditionNumber(value: number, language: ClientLanguage): string {
  return language === 'ko' ? String(value)
    : new Intl.NumberFormat(language, { useGrouping: false, maximumSignificantDigits: 21 }).format(value)
}
