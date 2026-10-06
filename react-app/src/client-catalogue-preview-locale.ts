import { useMemo } from 'react'
import { useClientPreferences, type ClientLanguage } from './client-preferences'
import { evidenceText } from './client-catalogue-evidence-state'
import { fixedStaticUiText } from './client-static-ui-copy'
import dictionary from './client-catalogue-preview-locale-copy.json'

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const numbers = /-?\d+(?:,\d{3})*(?:\.\d+)?/g

/** Bundled catalogue preview presentation ONLY. The engine, stored rule strings,
 * result objects and event identifiers remain authoritative and untouched.
 * Never use this helper to translate a live API response or an authored title. */
export function cataloguePreviewText(language: ClientLanguage, source: string, futures = false): string {
  if (language === 'ko') return source
  const normalized = evidenceText(source, futures), values: string[] = []
  const template = normalized.replace(numbers, value => `{n${values.push(value) - 1}}`)
  if (!Object.hasOwn(dictionary, template)) {
    const fixed = fixedStaticUiText(language, normalized)
    return fixed === normalized ? source : fixed
  }
  return dictionary[template as keyof typeof dictionary][column[language]].replace(/\{n(\d+)\}/g, (match, index: string) => values[Number(index)] ?? match)
}

export function useCataloguePreviewLocale() {
  const { language } = useClientPreferences()
  return useMemo(() => {
    // catalogueDateReader reconstructs civil dates. Recreate the same calendar
    // fields in UTC for Intl, rather than shifting that date across time zones.
    const civil = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    return {
      text: (source: string, futures = false) => cataloguePreviewText(language, source, futures),
      date: (date: Date) => language === 'ko' ? `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
        : new Intl.DateTimeFormat(language, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(civil(date)),
      shortDate: (date: Date) => language === 'ko' ? `${String(date.getFullYear()).slice(2)}. ${date.getMonth() + 1}. ${date.getDate()}.`
        : new Intl.DateTimeFormat(language, { year: '2-digit', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(civil(date)),
      month: (date: Date) => language === 'ko' ? `${date.getFullYear()}년 ${date.getMonth() + 1}월`
        : new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(civil(date)),
    }
  }, [language])
}
