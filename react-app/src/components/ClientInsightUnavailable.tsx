import { useLayoutEffect, useRef } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ClientInsightGallery } from './ClientInsightGallery'
import { useClientPreferences } from '../client-preferences'
import '../client-insights.css'
import { insightSourceCopy } from '../client-insight-source-copy'

/** Reuse the original editorial geometry without importing its fixture articles
 * or SVG conversions. This is not a feed contract or a successful empty query. */
export type InsightUnavailableView = { label: string; heading: string; subheading: string; message: string; returnLabel: string }

export function ClientInsightUnavailable({ view, onClose, shouldFocus }: { view: InsightUnavailableView; onClose: () => void; shouldFocus: () => boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { language } = useClientPreferences()
  const labels = {
    ko: ['새로운 인사이트', '기사 피드 미연결'],
    en: ['New insights', 'Article feed not connected'],
    ja: ['新しいインサイト', '記事フィード未接続'],
    'zh-CN': ['最新洞察', '文章源尚未连接'],
    'zh-TW': ['最新洞察', '文章來源尚未連接'],
    es: ['Nuevas perspectivas', 'Fuente de artículos no conectada'],
    fr: ['Nouvelles analyses', 'Flux d’articles non connecté'],
  }[language]
  useLayoutEffect(() => { if (shouldFocus()) heading.current?.focus({ preventScroll: true }) }, [shouldFocus])
  return <section className="client-insights" aria-label={view.label} data-source="UNAVAILABLE">
    <div className="nfz-page">
      <div className="nfz-open">
        <h1 ref={heading} tabIndex={-1}>{view.heading}<br /><em>{view.subheading}</em></h1>
      </div>
      <ClientInsightGallery
        secondary={<div className="nfz-sh"><h2>{labels[0]}</h2><p className="insight-unavailable-desc">{labels[1]}</p></div>}
        featured={<div className="insight-unavailable-feature"><p>{view.message}</p><button type="button" className="nfz-back" onClick={onClose}>{view.returnLabel}<ArrowUpRight size={15} aria-hidden="true" /></button></div>}
        rail={<aside className="nfz-rail"><div className="nfz-topics"><div className="th5">{insightSourceCopy(language, 'topics')}</div><div className="tw"><span aria-label={labels[1]}>—</span></div></div><h2 className="rh">{insightSourceCopy(language, 'popular')}</h2><p className="insight-unavailable-desc">{labels[1]}</p></aside>}
        heading={null} />
    </div>
  </section>
}
