import type { ClientLanguage } from './client-preferences'
import dictionary from './client-terminal-chart-locale-copy.json' with { type: 'json' }

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
/** Static default chart chrome only. Caller labels/provenance stay verbatim. */
export function terminalChartLocaleText(language: ClientLanguage, source: string) {
  return (dictionary as Record<string, string[]>)[source]?.[column[language]] ?? source
}
