import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { marketBindingKey } from '../client-market-response-presentation'
import { marketQuestionText } from '../client-market-question-copy'
import type { MarketQuestionActions, MarketQuestionAnswer, MarketQuestionPresentation, MarketQuestionViewState } from '../client-market-question-presentation'
import { decodeMarketQuestionState, emptyMarketQuestionState, marketQuestionRows } from '../client-market-question-state'
import { ClientQuestionDockContext } from '../client-question-dock'
import { ClientPersistentRegion } from './ClientPersistentRegion'
import '../client-market-question.css'

type Props = { presentation: MarketQuestionPresentation; actions?: MarketQuestionActions }

/** Source taiAskCard: a separate multi-step card, not the immediate-answer gcl. */
export function ClientMarketQuestionCard({ presentation, actions }: Props) {
  const key = marketBindingKey(presentation.binding)
  const steps = presentation.steps.slice(0, 4).filter(step => step.options.length).map(step => ({ ...step, options: step.options.slice(0, presentation.state && step.options.length <= 7 ? 7 : 6) }))
  if (!key || !steps.length || new Set(steps.map(step => step.id)).size !== steps.length || steps.some(step => !step.id || step.options.some(option => !option.id || !option.label.trim()) || new Set(step.options.map(option => option.id)).size !== step.options.length)) return null
  // Identity changes invalidate any pending acceptance without touching a new card.
  const identity = JSON.stringify([key, steps.map(step => [step.id, !!step.multi, step.options.map(option => option.id)])])
  return <Question key={identity} presentation={{ ...presentation, steps }} actions={actions}/>
}

function Question({ presentation, actions }: Props) {
  const { binding, steps } = presentation
  const dock = useContext(ClientQuestionDockContext)
  const active = !dock || dock.activeKey === marketBindingKey(binding)
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof marketQuestionText>[1], values?: Record<string, string | number>) => marketQuestionText(language, key, values)
  const id = useId()
  const [viewState, setViewState] = useState<MarketQuestionViewState>(() => decodeMarketQuestionState(presentation.state, presentation) ?? emptyMarketQuestionState(presentation))
  const stateRef = useRef(viewState)
  const { index, picks, direct } = viewState
  // The host may synchronously persist ACK and advance to a new message
  // before our awaited submit resumes. Render its validated terminal state.
  const terminal = presentation.state?.closed || presentation.state?.accepted ? decodeMarketQuestionState(presentation.state, presentation) : null
  const { closed, accepted } = terminal ?? viewState
  const [notice, setNotice] = useState<Parameters<typeof marketQuestionText>[1] | null>(null)
  const [pending, setPending] = useState(false)
  const flight = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null), input = useRef<HTMLInputElement>(null)
  const isDirect = direct[index]
  useLayoutEffect(() => {
    if (active && isDirect) {
      input.current?.focus({ preventScroll: true })
      input.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [active, isDirect, index, notice])
  useEffect(() => { if (!active && flight.current) { flight.current.abort(); flight.current = null; setPending(false) } }, [active])
  useEffect(() => () => { flight.current?.abort(); flight.current = null }, [])
  const step = steps[index]
  function applyState(next: MarketQuestionViewState) {
    stateRef.current = next; setViewState(next)
  }
  function change(next: MarketQuestionViewState): boolean {
    if (!active) return false
    try {
      if (actions?.change && actions.change({ ...binding }, structuredClone(next)) !== true) { setNotice('failed'); return false }
    } catch { setNotice('failed'); return false }
    applyState(next); setNotice(null)
    return true
  }
  function move(next: number) {
    if (flight.current) return
    if (change({ ...stateRef.current, index: Math.max(0, Math.min(steps.length - 1, next)) })) heading.current?.focus({ preventScroll: true })
  }
  function choose(optionId: string) {
    if (flight.current) return
    const current = stateRef.current, at = current.index
    if (!change({ ...current,
      picks: current.picks.map((row, i) => i !== at ? row : steps[at].multi ? row.includes(optionId) ? row.filter(value => value !== optionId) : [...row, optionId] : [optionId]),
      direct: current.direct.map((value, i) => i === at ? false : value),
      free: steps.map((_, i) => i === at ? '' : current.free?.[i] ?? ''),
    })) return
    if (!steps[at].multi) go()
  }
  function openDirect() {
    if (flight.current) return
    const current = stateRef.current, at = current.index
    change({ ...current, direct: current.direct.map((value, i) => i === at ? true : value),
      picks: current.picks.map((row, i) => i === at ? [] : row),
      free: steps.map((_, i) => current.free?.[i] ?? '') })
  }
  function close() {
    if (!change({ ...stateRef.current, closed: true })) return
    flight.current?.abort(); flight.current = null; setPending(false)
  }
  async function submit(mode: 'selection' | 'delegate') {
    if (flight.current || !active) return
    if (actions?.busy) { setNotice('busy'); return }
    if (!actions?.submit) { setNotice('unavailable'); return }
    const rows = marketQuestionRows(steps, stateRef.current)
    if (mode === 'selection' && !rows.length) { setNotice('choose'); return }
    const answer: MarketQuestionAnswer = { binding: { ...binding }, mode, rows: mode === 'delegate' ? [] : rows, text: mode === 'delegate' ? t('delegateText') : rows.map(row => `${row.title ? `${row.title}: ` : ''}${row.labels.join(', ')}`).join(' / ') + t('suffix') }
    if (answer.text.length > 1000) { setNotice('tooLong'); return }
    const controller = new AbortController()
    flight.current = controller; setPending(true); setNotice(null)
    try {
      // Keep our summary independent of any host mutation of its argument.
      const result = await actions.submit(structuredClone(answer), controller.signal)
      if (controller.signal.aborted) return
      // The host atomically persists acceptance with the submitted request.
      // Do not issue a second change write after its successful ACK.
      if (result === true) applyState(mode === 'delegate' ? { ...stateRef.current, closed: true } : { ...stateRef.current, accepted: answer })
      else setNotice('failed')
    } catch { if (!controller.signal.aborted) setNotice('failed') }
    finally { if (!controller.signal.aborted) { flight.current = null; setPending(false) } }
  }
  function go() {
    if (flight.current) return
    const current = stateRef.current, at = current.index
    if (current.direct[at] && !current.free?.[at]?.trim()) { setNotice('writeAnswer'); input.current?.focus(); return }
    if (!current.free?.[at]?.trim() && !current.picks[at].length) { setNotice('choose'); return }
    if (at < steps.length - 1) move(at + 1)
    else void submit('selection')
  }
  if (closed) return null
  if (accepted) return <div className="g-usum client-market-question-summary" data-question-anchor={marketBindingKey(binding) ?? undefined} aria-label={t('selection')}>{accepted.rows.map(row => <div className="rw" key={row.stepId}><b>{row.title || t('selection')}</b><span>{row.labels.join(', ')}</span></div>)}</div>
  const panel = <section className="g-askcard ska client-market-question" aria-labelledby={`${id}-title`} aria-busy={pending}>
    <div className="hd"><h3 className="t" id={`${id}-title`} ref={heading} tabIndex={-1}>{step.title || t('title')}</h3><div className="ask-controls">
      {steps.length > 1 && <span className="pg"><button type="button" className="pn" aria-label={t('previous')} disabled={index === 0 || pending} onClick={() => move(index - 1)}><Chevron back/></button><span>{t('page', { total: steps.length, current: index + 1 })}</span><button type="button" className="pn" aria-label={t('next')} disabled={index === steps.length - 1 || pending} onClick={() => move(index + 1)}><Chevron/></button></span>}
      <button type="button" className="x" aria-label={t('close')} onClick={close}>×</button>
    </div></div>
    <div className="ops" role="group" aria-labelledby={`${id}-title`}>
      {step.options.map(option => <button type="button" className={`op${picks[index].includes(option.id) ? ' on' : ''}`} key={option.id} aria-pressed={picks[index].includes(option.id)} disabled={pending}
        onKeyDown={event=>{if(event.repeat&&(event.key==='Enter'||event.key===' '))event.preventDefault()}}
        onClick={()=>choose(option.id)}><b>{option.label}</b>{option.description && <span>{option.description}</span>}</button>)}
      {isDirect ? <div className="op free"><input ref={input} type="text" aria-label={t('direct')} placeholder={t('freePlaceholder')} value={viewState.free?.[index] ?? ''} maxLength={1000} disabled={pending}
        onChange={event => { const current = stateRef.current; change({ ...current, free: steps.map((_, i) => i === current.index ? event.target.value : current.free?.[i] ?? '') }) }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); if (!event.repeat) go() } }}/>
        <button type="button" className="send" disabled={pending} onClick={go}>{t('confirm')}</button></div>
        : <button type="button" className="op" disabled={pending} onClick={openDirect}><b>{t('direct')}</b>{viewState.free?.[index] && <span>{viewState.free[index]}</span>}</button>}
    </div>
    <div className="ft"><button type="button" className="skipb" disabled={pending} onClick={() => void submit('delegate')}>{t('delegate')}</button>
      {(step.multi || pending || notice && !isDirect) && <button type="button" className="go" disabled={pending} aria-label={pending ? t('pending') : index < steps.length - 1 ? t('next') : t('send')} onClick={go}>{pending ? t('pending') : index < steps.length - 1 ? t('nextShort') : t('sendShort')}</button>}
    </div>
    <p className="ask-notice" role="status" aria-live="polite">{notice ? t(notice) : ''}</p>
  </section>
  if (!dock) return panel
  return <><p className="ska-note">{active ? t(steps.length === 1 ? 'singleDockNote' : 'dockNote', { total: steps.length }) : t('previousNote')}</p>{active && dock.target && <ClientPersistentRegion target={dock.target} className="client-question-panel" contents>{panel}</ClientPersistentRegion>}</>
}

function Chevron({ back = false }: { back?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}/></svg>
}
