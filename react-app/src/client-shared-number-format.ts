import type { ClientLanguage } from './client-preferences'

type Precision = 0 | 1 | 2 | 4 | 'auto'
const separators = new Map<ClientLanguage, string>()

/** Presentation only: preserve source toFixed rounding, signs and precision.
 * Do not re-round with Intl, group IDs, convert currency, or alter SVG geometry.
 * All seven supported languages use Latin digits; only their decimal mark differs.
 */
export function sharedNumber(value: number, language: ClientLanguage, digits: Precision = 1): string {
  if (!Number.isFinite(value)) return '—'
  const text = digits === 'auto' ? String(value) : value.toFixed(digits)
  if (language === 'ko') return text
  let separator = separators.get(language)
  if (separator === undefined) {
    separator = new Intl.NumberFormat(language, { useGrouping: false, numberingSystem: 'latn' }).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.'
    separators.set(language, separator)
  }
  return text.replace('.', separator)
}

export function sharedSigned(value: number, language: ClientLanguage, digits: Precision = 1): string {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${sharedNumber(value, language, digits)}` : '—'
}

export function sharedPercent(value: number, language: ClientLanguage, digits: Precision = 1, signed = true): string {
  return Number.isFinite(value) ? `${signed ? sharedSigned(value, language, digits) : sharedNumber(value, language, digits)}%` : '—'
}
