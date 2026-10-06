import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { CatalogueJudgment } from '../client-catalogue-judgments'
import type { CataloguePreviewResult } from '../client-catalogue-preview'
import { catalogueDetailGlossary, catalogueDetailLocale } from '../client-catalogue-detail-locale'
import { catalogueDateReader } from '../client-catalogue-presentation'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { sharedPercent } from '../client-shared-number-format'
import assets from '../client-catalogue-judgment-assets.json'
import copy from '../client-catalogue-judgment-copy.json'
import '../client-catalogue-judgments.css'

const glossary: Readonly<Record<string, string>> = assets.MK_GLOSS
const terms = Object.keys(glossary).filter(key => key !== '매수' && key !== '매도').sort((a, b) => b.length - a.length)
const tokenPattern = new RegExp(`([+\\-]\\d[\\d,]*(?:\\.\\d+)?%|${terms.join('|')})`, 'g')

function Meaning({ term, anchor, close, words, definition, language }: { term: string; anchor: HTMLButtonElement; close: (restore: boolean) => void; words: typeof copy.ko; definition: ReturnType<typeof catalogueDetailGlossary>[number]; language: ClientLanguage }) {
  const panel = useRef<HTMLDivElement>(null), id = useId()
  const [position, setPosition] = useState({ left: 12, top: 12 })
  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect(), element = panel.current
    if (!element) return
    const { width, height } = element.getBoundingClientRect()
    setPosition({ left: Math.max(12, Math.min(innerWidth - width - 12, box.x + box.width / 2 - width / 2)), top: Math.max(12, box.bottom + height + 8 <= innerHeight - 12 ? box.bottom + 8 : Math.min(box.top - height - 8, innerHeight - height - 12)) })
    element.querySelector('button')?.focus({ preventScroll: true })
    return () => {
      if (!element.contains(document.activeElement)) return
      const owner = anchor.closest('.client-shared-detail')
      requestAnimationFrame(() => {
        // External hash/back navigation can remove a focused portal without
        // clicking a tab. Only repair lost focus in this still-mounted owner;
        // explicit destination focus and owner retirement always take priority.
        if (!owner?.isConnected || document.activeElement !== document.body) return
        owner.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
      })
    }
  }, [anchor, term, words])
  useEffect(() => {
    const origin = anchor.getBoundingClientRect()
    const outside = (event: PointerEvent | FocusEvent) => { if (event.target instanceof Node && !panel.current?.contains(event.target) && !anchor.contains(event.target)) close(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(true) } }
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return
      // A click may follow browser scroll-into-view before its queued scroll
      // event arrives. Close only when the anchor actually moved after opening.
      const current = anchor.getBoundingClientRect()
      if (Math.abs(current.x - origin.x) > 1 || Math.abs(current.y - origin.y) > 1) close(false)
    }
    const resize = () => close(false)
    document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', outside, true); document.addEventListener('keydown', escape, true)
    document.addEventListener('scroll', scroll, true); window.addEventListener('resize', resize)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside, true); document.removeEventListener('keydown', escape, true); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize) }
  }, [anchor, close])
  return createPortal(<div ref={panel} className="catalogue-meaning" role="dialog" aria-labelledby={id} aria-describedby={`${id}-body`} style={position} onKeyDown={event => { if (event.key === 'Tab') { event.preventDefault(); close(true) } }}>
    <div><b id={id}>{words.meaning.replace('{term}', definition.label)}</b><button type="button" onClick={() => close(true)} aria-label={words.close}>×</button></div>
    <p id={`${id}-body`} lang={language}>{definition.body}</p>
  </div>, document.body)
}

function Narrative({ text, source, language, definitions, onTerm, selected }: { text: string; source: string; language: ClientLanguage; definitions: ReturnType<typeof catalogueDetailGlossary>; onTerm: (term: string, button: HTMLButtonElement) => void; selected: HTMLButtonElement | undefined }) {
  const used = new Set<string>(), cut = text.search(/[.!?。！？]\s/), head = cut > 0 ? text.slice(0, cut + 1) : text, rest = cut > 0 ? text.slice(cut + 1) : ''
  // A translated label only links back to a term present in this original
  // sentence. Canonical keys continue to own selection, focus and definitions.
  const displayedTerms = language === 'ko' ? terms.map(term => ({ term, label: term })) : definitions.filter(row => terms.includes(row.term) && source.includes(row.term))
  const byLabel = new Map(displayedTerms.map(row => [row.label.toLocaleLowerCase(), row.term]))
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const translatedPattern = new RegExp(`([+\\-]\\d[\\d,]*(?:\\.\\d+)?%${displayedTerms.length ? '|' + displayedTerms.map(row => escape(row.label)).sort((a, b) => b.length - a.length).join('|') : ''})`, 'gi')
  const pieces = (part: string): ReactNode[] => {
    const tokens = part.split(language === 'ko' ? tokenPattern : translatedPattern).filter(Boolean)
    return tokens.map((token, index) => {
    if (/^[+-]\d[\d,]*(?:\.\d+)?%$/.test(token)) return <span key={index} className={token[0] === '+' ? 'catalogue-gain' : 'catalogue-loss'}>{token}</span>
    const canonical = byLabel.get(token.toLocaleLowerCase())
    if (canonical && !used.has(canonical)) {
      used.add(canonical)
      // Keep a linked Korean noun and its grammatical particle on one line.
      const suffix = language === 'ko' ? tokens[index + 1]?.match(/^(으로|에서|까지|부터|보다|마다|이며|이고|은|는|이|가|을|를|의|에|도|만|과|와|로)/)?.[0] ?? '' : ''
      if (suffix) tokens[index + 1] = tokens[index + 1].slice(suffix.length)
      return <span key={index} className="catalogue-term-group"><button className="catalogue-term" type="button" aria-haspopup="dialog" aria-expanded={selected?.dataset.term === canonical} data-term={canonical} onClick={event => onTerm(canonical, event.currentTarget)}>{token}</button>{suffix}</span>
    }
    return token
    })
  }
  return <p lang={language}><strong>{pieces(head)}</strong>{pieces(rest)}</p>
}

export function ClientCatalogueJudgments({ messages, calendar, active, sourcePreview }: { messages: readonly CatalogueJudgment[]; calendar: { start: string; asof: string }; active: boolean; sourcePreview?: CataloguePreviewResult }) {
  const { language } = useClientPreferences(), words = copy[language]
  const display = useMemo(() => sourcePreview?.judgments === messages ? catalogueDetailLocale(sourcePreview, language) : null, [sourcePreview, messages, language])
  const definitions = useMemo(() => catalogueDetailGlossary(language), [language])
  const texts = messages.map(message => display?.narrative(message.t) ?? { text: message.t, language: /[가-힣]/.test(message.t) ? 'ko' as const : language, translated: language === 'ko' || !/[가-힣]/.test(message.t) })
  const [expanded, setExpanded] = useState(false), [meaning, setMeaning] = useState<{ term: string; anchor: HTMLButtonElement } | null>(null)
  const reveal = useRef<HTMLLIElement>(null), more = useRef(false)
  const [wasActive, setWasActive] = useState(active)
  if (wasActive !== active) { setWasActive(active); if (!active) setMeaning(null) }
  const indexToDate = useMemo(() => catalogueDateReader(calendar), [calendar])
  const date = (index: number) => new Intl.DateTimeFormat(language, { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory' }).format(indexToDate(index))
  useLayoutEffect(() => { if (more.current) { more.current = false; reveal.current?.focus({ preventScroll: true }); reveal.current?.scrollIntoView({ block: 'nearest' }) } }, [expanded])
  const close = (restore: boolean) => { if (restore && meaning?.anchor.isConnected) meaning.anchor.focus({ preventScroll: true }); setMeaning(null) }
  const onTerm = (term: string, anchor: HTMLButtonElement) => setMeaning(previous => previous?.anchor === anchor ? null : { term, anchor })
  const title = (message: CatalogueJudgment) => {
    return display?.literal(message.title).text ?? message.title
  }
  return <section className="catalogue-judgments" aria-label={words.heading}>
    <header><h3>{words.heading}</h3>{language !== 'ko' && texts.some(text => !text.translated) && <small>{words.sourceLanguage}</small>}</header>
    <ol>{messages.slice(0, expanded ? undefined : 3).map((message, index) => <li key={`${message.k}:${message.i}:${message.a ?? ''}`} ref={index === 3 ? reveal : undefined} tabIndex={-1} data-judgment-kind={message.k} data-judgment-index={message.i} data-judgment-key={`${message.k}:${message.i}:${message.a ?? ''}`}>
      <span className="catalogue-judgment-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{message.k === 'now' ? <><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8"/></> : <path d={assets.MKC_IC[message.k].match(/d="([^"]+)"/)?.[1]}/>}</svg></span>
      <div className="catalogue-judgment-body"><div className="catalogue-judgment-heading"><h4>{title(message)}</h4>{message.pnl !== undefined && <span className={message.pnl >= 0 ? 'catalogue-gain' : 'catalogue-loss'}>{sharedPercent(message.pnl, language)}</span>}<div className="catalogue-judgment-date">{message.fillIndex !== undefined && <span>{words.signal} </span>}<time>{date(message.i)}</time>{message.fillIndex !== undefined && <span> · {words.fill} {date(message.fillIndex)}</span>}</div></div>
        <Narrative text={texts[index].text} source={message.t} language={texts[index].language} definitions={definitions} onTerm={onTerm} selected={meaning?.anchor.closest('li')?.dataset.judgmentKey === `${message.k}:${message.i}:${message.a ?? ''}` ? meaning.anchor : undefined}/>
        {message.cnt !== undefined && message.from !== undefined && <p className="catalogue-judgment-repeat">{words.repeated.replace('{count}', new Intl.NumberFormat(language).format(message.cnt)).replace('{date}', date(message.from))}</p>}
      </div>
    </li>)}</ol>
    {!expanded && messages.length > 3 && <button className="catalogue-judgments-more" type="button" onClick={() => { more.current = true; setExpanded(true) }}>{words.more.replace('{count}', String(messages.length - 3))}</button>}
    {active && meaning && <Meaning key={meaning.term} term={meaning.term} anchor={meaning.anchor} close={close} words={words} definition={definitions.find(row => row.term === meaning.term)!} language={language}/>}
  </section>
}
