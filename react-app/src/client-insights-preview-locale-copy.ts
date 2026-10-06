import type { ClientLanguage } from './client-preferences'
import type { InsightPresentationData } from './client-insight-presentation'
import translations from './client-insights-preview-locale-copy.json'

type CopyKey = keyof typeof translations
export function insightPreviewText(language: ClientLanguage, original: string, values?: Readonly<Record<string, string>>): string {
  // Only exact authored keys participate. This helper is not a translator for
  // arbitrary user/provider text; callers keep that prose on its own path.
  const text = language !== 'ko' && Object.hasOwn(translations, original)
    ? translations[original as CopyKey][language] : original
  return values ? text.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token) : text
}

export type InsightUiNotice = string | { literal: string }
export function insightUiNotice(language: ClientLanguage, notice: InsightUiNotice): string {
  return typeof notice === 'string' ? insightPreviewText(language, notice) : notice.literal
}

const xmlText = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
export function localizeInsightFigure(svg: string, language: ClientLanguage): string {
  if (language === 'ko') return svg
  // Text content only: all geometry, attributes and drawing order stay exact.
  return svg.replace(/(<text\b[^>]*>)([^<]*)(<\/text>)/g, (whole, open: string, text: string, close: string) =>
    Object.hasOwn(translations, text) ? open + xmlText(insightPreviewText(language, text)) + close : whole)
}

/** Only the local source-preview factory calls this adapter. Service/caller
 * data never passes through it, even if its content matches an editorial key.
 * Identity, route keys, timestamps, numbers and service authority are unchanged. */
export function localizeInsightPreview(data: InsightPresentationData, language: ClientLanguage): InsightPresentationData {
  if (language === 'ko') return data
  const t = (text: string) => insightPreviewText(language, text)
  const prefix = 'data:image/svg+xml;charset=utf-8,'
  return { ...data, periodLabel: data.periodLabel ? t(data.periodLabel) : undefined,
    figureUrls: data.figureUrls && Object.fromEntries(Object.entries(data.figureUrls).map(([key, url]) =>
      [key, url.startsWith(prefix) ? prefix + encodeURIComponent(localizeInsightFigure(decodeURIComponent(url.slice(prefix.length)), language)) : url])),
    articles: data.articles.map(article => ({ ...article,
      title: t(article.title), sub: t(article.sub), cat: t(article.cat),
      assets: article.assets.map(asset => asset.map((value, index) => index === 1 ? t(value) : value)),
      body: article.body.map(section => section.h !== undefined ? { ...section, h: t(section.h), ps: section.ps.map(t) }
        : section.q !== undefined ? { ...section, q: t(section.q) }
        : { ...section, fig: { ...section.fig, cap: t(section.fig.cap) } }),
    })),
  }
}
