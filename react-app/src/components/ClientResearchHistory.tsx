import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { searchResearch, type ResearchRecord } from '../research-library'
import { useClientPreferences } from '../client-preferences'
import { localizedResearchDate, researchCopy, type ResearchCopyKey } from '../client-research-copy'
import '../client-research-hub.css'

/** Source history presentation only. The caller owns records and navigation.
 * Unavailable is distinct from a successfully queried empty collection. */
export function ClientResearchHistory({ records, onSelect, onNew, onReturn, notice, externalBoundary = false, unavailable, scopedContent, shouldFocus, footer, pending = false }: {
  records: readonly ResearchRecord[]; onSelect: (id: string) => void | Promise<void>; onNew: () => void; onReturn: () => void
  notice?: ReactNode; externalBoundary?: boolean; unavailable?: ReactNode
  /** Separately labelled, caller-owned subset. Never a substitute for records. */
  scopedContent?: ReactNode
  footer?: ReactNode
  pending?: boolean
  /** Optional host intent for a delayed mount; public history keeps its default. */
  shouldFocus?: () => boolean
}) {
  const { language } = useClientPreferences()
  const copy = (key: ResearchCopyKey, values?: Record<string, string | number>) => researchCopy(language, key, values)
  const [query, setQuery] = useState(''), [limit, setLimit] = useState(20)
  const searchRef = useRef<HTMLInputElement>(null), titleRef = useRef<HTMLHeadingElement>(null), moreRef = useRef<HTMLButtonElement>(null)
  const isUnavailable = Boolean(unavailable)
  const matches = useMemo(() => searchResearch([...records], query), [records, query])
  useEffect(() => {
    if (isUnavailable || !moreRef.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setLimit(value => value + 20)
    }, { root: document.getElementById('research-main'), rootMargin: '160px' })
    observer.observe(moreRef.current)
    return () => observer.disconnect()
  }, [isUnavailable, limit, matches.length])
  useEffect(() => {
    if (shouldFocus && !shouldFocus()) return
    const target = !isUnavailable && matchMedia('(min-width:861px)').matches ? searchRef.current : titleRef.current
    target?.focus({ preventScroll: true })
  }, [isUnavailable, shouldFocus])
  const Container = externalBoundary ? 'section' : 'main'
  return <Container id="research-main" className="client-research-hub" aria-labelledby="research-title">
    <header className="hub-header"><h1 id="research-title" ref={titleRef} tabIndex={-1}>{copy('history')}</h1><button type="button" onClick={onReturn}>{copy('return')}</button></header>
    <div className="hub-content g-hist">
      {notice}
      {scopedContent}
      {!externalBoundary && <p className="hub-boundary">{copy('boundary')}</p>}
      <div className="g-hist-search"><Search size={18} aria-hidden="true" /><input ref={searchRef} type="search" disabled={isUnavailable} value={query} onChange={event => { setQuery(event.target.value); setLimit(20) }} placeholder={copy('search')} aria-label={copy('search')} autoComplete="off" />{query && !isUnavailable && <button type="button" aria-label={copy('clearSearch')} onClick={() => { setQuery(''); setLimit(20); searchRef.current?.focus() }}><X size={16} aria-hidden="true" /></button>}</div>
      <div className="g-hist-sec">{copy('recent')}</div>
      {unavailable || <>
        {matches.length ? <ul className="g-hist-list" aria-busy={pending}>{matches.slice(0, limit).map(record => <li key={record.id}><button className="g-hist-row" disabled={pending} onClick={async () => { try { await onSelect(record.id) } catch { /* Host retains its redacted failure notice and selection. */ } }} type="button" title={record.title}><span className="t">{record.title}</span><time className="d" dateTime={Number.isFinite(new Date(record.updatedAt).getTime()) ? new Date(record.updatedAt).toISOString() : undefined}>{localizedResearchDate(record.updatedAt, language)}</time></button></li>)}</ul> : <div className="hub-empty"><p>{copy(query ? 'noResults' : 'noHistory')}</p>{!query && <button type="button" onClick={onNew}>{copy('newStrategy')}</button>}</div>}
        {matches.length > limit && <button className="g-hist-more" ref={moreRef} type="button" onClick={() => setLimit(value => value + 20)}>{copy('more')}</button>}
        <span className="g-hist-announcement" role="status">{query ? copy('resultCount', { count: matches.length.toLocaleString(language) }) : ''}</span>
      </>}
      {footer}
    </div>
  </Container>
}
