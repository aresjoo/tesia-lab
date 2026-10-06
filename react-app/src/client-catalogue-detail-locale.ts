import { catalogueSourceSha, findCatalogueStrategy, type CatalogueStrategy } from './client-catalogue'
import { catalogueIdentity } from './client-catalogue-presentation'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { ClientLanguage } from './client-preferences'
import preview from './client-catalogue-preview-locale-copy.json' with { type: 'json' }
import judgment from './client-catalogue-judgment-locale-copy.json' with { type: 'json' }
import extra from './client-catalogue-detail-locale-copy.json' with { type: 'json' }
import assets from './client-catalogue-judgment-assets.json' with { type: 'json' }

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const dictionary: Readonly<Record<string, readonly string[]>> = { ...preview, ...judgment, ...extra }
export type CatalogueDetailText = { text: string; language: ClientLanguage; translated: boolean }
const knownStrategy = (strategy: Readonly<CatalogueStrategy>) => {
  const original = findCatalogueStrategy(strategy.id)
  return Boolean(original && JSON.stringify(original) === JSON.stringify(strategy))
}
function fixedText(language: ClientLanguage, source: string): CatalogueDetailText {
  if (language === 'ko' || !/[가-힣]/.test(source)) return { text: source, language, translated: true }
  const numbers: string[] = [], key = source.replace(/-?\d+(?:,\d{3})*(?:\.\d+)?/g, value => `{n${numbers.push(value) - 1}}`)
  const row = dictionary[key]
  return row ? { text: row[column[language]].replace(/\{n(\d+)\}/g, (slot, index: string) => numbers[Number(index)] ?? slot), language, translated: true }
    : { text: source, language: 'ko', translated: false }
}

/** Explicit fixed-preview caller only. The returned presentation never replaces
 * the strategy object, IDs, search values, callback arguments or stored title. */
export function sourceCatalogueIdentity(strategy: Readonly<CatalogueStrategy>, language: ClientLanguage, sourcePreview: boolean) {
  const row = catalogueIdentity(strategy)
  if (!sourcePreview || !knownStrategy(strategy)) return row
  return { ...row, title: fixedText(language, row.title).text, description: fixedText(language, row.description).text, asset: fixedText(language, row.asset).text }
}

export function catalogueDetailLocale(value: CataloguePreviewResult, language: ClientLanguage) {
  const eligible = value.source === 'client-snapshot-preview' && value.sourceSha === catalogueSourceSha && knownStrategy(value.strategy)
  const literal = (source: string): CatalogueDetailText => !eligible && language !== 'ko' && /[가-힣]/.test(source)
    ? { text: source, language: 'ko', translated: false } : fixedText(language, source)
  const narrative = (source: string): CatalogueDetailText => {
    if (language === 'ko' || !eligible) return literal(source)
    const pieces = source.split(/((?<=[.!?。！？])\s+)/).map(literal)
    return pieces.every(part => part.translated) ? { text: pieces.map(part => part.text).join(''), language, translated: true }
      : { text: source, language: 'ko', translated: false }
  }
  return { eligible, literal, narrative, identity: sourceCatalogueIdentity(value.strategy, language, eligible) }
}

/** Glossary definitions are fixed UI, not translations of caller/API prose. */
export function catalogueDetailGlossary(language: ClientLanguage) {
  return Object.entries(assets.MK_GLOSS).map(([term, body]) => ({ term, label: fixedText(language, term).text, body: fixedText(language, body).text }))
}
