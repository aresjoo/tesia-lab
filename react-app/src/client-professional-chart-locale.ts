import type { ClientLanguage } from './client-preferences'
import { professionalChartKo } from './client-professional-chart-ko'
import translations from './client-professional-chart-translations.json' with { type: 'json' }

export type ProfessionalChartCopyKey = keyof typeof professionalChartKo
const localized: Record<Exclude<ClientLanguage, 'ko'>, Record<ProfessionalChartCopyKey, string>> = translations
const localeNames: Record<ClientLanguage, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', es: 'es-ES', fr: 'fr-FR' }
const cache = new Map<ClientLanguage, ReturnType<typeof createFormat>>()
function createFormat(language: ClientLanguage) {
  const locale = localeNames[language]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 12 })
  const axisNumbers = new Map<number, Intl.NumberFormat>()
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const copy = language === 'ko' ? professionalChartKo : localized[language]
  const t = (key: ProfessionalChartCopyKey, values: Record<string, string | number> = {}) => copy[key].replace(/\{([a-zA-Z]+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match)
  return {
    locale, t, price: (value: number) => number.format(value), utc: (time: number) => date.format(time * 1000),
    axisPrice: (precision: number) => {
      let axis = axisNumbers.get(precision)
      if (!axis) { axis = new Intl.NumberFormat(locale, { minimumFractionDigits: precision, maximumFractionDigits: precision }); axisNumbers.set(precision, axis) }
      return axis.format
    },
    resolution: (seconds: number) => {
      const [unit, divisor] = seconds % 86400 === 0 ? ['days', 86400] as const : seconds % 3600 === 0 ? ['hours', 3600] as const : seconds % 60 === 0 ? ['minutes', 60] as const : ['seconds', 1] as const
      return t(unit, { count: number.format(seconds / divisor) })
    },
    issue: (message: string) => {
      const key = (Object.keys(professionalChartKo) as ProfessionalChartCopyKey[]).find(key => professionalChartKo[key] === message)
      return key ? t(key) : message // Never conceal a new validator reason with a generic success/empty state.
    },
  }
}
export function professionalChartLocale(language: ClientLanguage) {
  let format = cache.get(language)
  if (!format) { format = createFormat(language); cache.set(language, format) }
  return format
}
