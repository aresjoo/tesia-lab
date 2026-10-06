import { catalogueSourceSha, findCatalogueStrategy } from './client-catalogue'
import { catalogueTerminalModel, splitCatalogueThought } from './client-catalogue-terminal'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { ClientLanguage } from './client-preferences'
import dictionary from './client-catalogue-judgment-locale-copy.json' with { type: 'json' }

const columns = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const numbers = /-?\d+(?:,\d{3})*(?:\.\d+)?/g
const sentences = /((?<=[.!?。！？])\s+)/
type DisplayCopy = { text: string; language: ClientLanguage; translated: boolean }
type DisplayParagraph = Omit<DisplayCopy, 'text'> & { head: string; rest: string }

/** Fixed catalogue preview output ONLY, never a translator for user/API prose.
 * Unknown source sentences remain visible verbatim and retain their KO label.
 * Numeric slots preserve exact source lexemes, including signs and decimals. */
export function catalogueJudgmentLocale(value: CataloguePreviewResult, language: ClientLanguage) {
  const known = findCatalogueStrategy(value.strategy.id)
  const eligible = value.source === 'client-snapshot-preview' && value.sourceSha === catalogueSourceSha
    && known !== undefined && JSON.stringify(known) === JSON.stringify(value.strategy)
  const source = catalogueTerminalModel(value, 'ko')
  const literal = (text: string): DisplayCopy => {
    if (language === 'ko' || !/[가-힣]/.test(text)) return { text, language, translated: true }
    if (!eligible) return { text, language: 'ko', translated: false }
    const values: string[] = []
    const key = text.replace(numbers, v => `{n${values.push(v) - 1}}`)
    if (!Object.hasOwn(dictionary, key)) return { text, language: 'ko', translated: false }
    const row = (dictionary as Record<string, string[]>)[key]
    return { text: row[columns[language]].replace(/\{n(\d+)\}/g, (match, index: string) => values[Number(index)] ?? match), language, translated: true }
  }
  const paragraph = (text: string): DisplayParagraph => {
    const original = splitCatalogueThought(text)
    if (language === 'ko') return { ...original, language, translated: true }
    const head = original.head.split(sentences).map(literal), rest = original.rest.split(sentences).map(literal)
    // Keep original two-sentence disclosure boundaries, even when the target
    // language uses different punctuation or no spaces after sentence endings.
    const translated = [...head, ...rest].every(part => part.translated)
    return translated ? { head: head.map(p => p.text).join(''), rest: rest.map(p => p.text).join(''), language, translated }
      : { ...original, language: 'ko', translated }
  }
  return {
    headline: literal(source.headline), rule: literal(source.rule),
    pick: source.pick ? literal(source.pick) : null,
    assets: source.holdings.map(p => literal(p.asset)),
    title: value.strategy.name,
    sourceOwned: eligible,
    thought: paragraph(source.thought), history: source.history.map(m => paragraph(m.t)),
  }
}
