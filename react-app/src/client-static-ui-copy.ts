import { createElement, Fragment, useMemo, type ReactNode } from 'react'
import { useClientPreferences, type ClientLanguage } from './client-preferences'
import dictionary from './client-static-ui-copy.json' with { type: 'json' }
import { singularUiTemplate } from './client-static-ui-plural-copy'

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type UiCopyKey = keyof typeof dictionary

/** For local state/enum values whose exact source literals are explicitly listed.
 * An unknown value stays verbatim; this is not a user/API prose translator. */
export function fixedStaticUiText(language: ClientLanguage, text: string): string {
  return Object.hasOwn(dictionary, text) ? staticUiText(language, text as UiCopyKey) : text
}

/** Explicit source-owned UI literals only. Never pass user or server prose. */
export function staticUiText(language: ClientLanguage, text: UiCopyKey, values: Record<string, string | number> = {}): string {
  if (language !== 'ko' && text === '{days}일' && typeof values.days === 'number' && Number.isFinite(values.days)) {
    // Native plural rules keep 1 day/jour/día distinct from multi-day labels.
    // This is display formatting only; the supplied duration is not rounded.
    return new Intl.NumberFormat(language, { style: 'unit', unit: 'day', unitDisplay: 'long', useGrouping: false, maximumFractionDigits: 20 }).format(values.days)
  }
  return (singularUiTemplate(language, text, values) ?? dictionary[text][column[language]]).replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]))
}

/** React owns the displayed text; no DOM replacement observer or global patch. */
export function useStaticUiCopy() {
  const { language } = useClientPreferences()
  return useMemo(() => Object.assign(
    (text: UiCopyKey, values: Record<string, string | number> = {}) => staticUiText(language, text, values),
    {
      rich: (text: UiCopyKey, values: Record<string, ReactNode>) => (singularUiTemplate(language, text, values) ?? dictionary[text][column[language]]).split(/(\{\w+\})/g).map((part, index) =>
        createElement(Fragment, { key: index }, /^\{\w+\}$/.test(part) ? values[part.slice(1, -1)] ?? part : part)),
      month: (month: number) => language === 'ko' ? `${month}월` : new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1))),
      number: (value: number) => new Intl.NumberFormat(language).format(value),
      fixed: (text: string) => fixedStaticUiText(language, text),
    },
  ), [language])
}
