import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { researchDocumentCopy as copy, type ResearchDocumentCopyKey } from './native-research-document-copy'
import type { NativeResearchDocumentPresentation, ResearchDocumentFinding, ResearchDocumentMetrics, ResearchDocumentRow, ResearchDocumentTone, ResearchDocumentValue, ResearchWhatIfResult } from './native-research-document-presentation'
import '../client-restored-research.css'
import { NativeResearchChartPreview } from './NativeResearchChartPreview'
import { useNativeResearchThread } from './NativeResearchThreadContext'

export type NativeResearchDocumentsProps = {
  scopeId: string
  document: NativeResearchDocumentPresentation
  onOpenDocument?: (id: string) => void
  onOpenAnalysis?: () => void
  /** Optional existing chart surface. Never pass the same controller to multiple mounted documents. */
  chartContent?: ReactNode
  active?: boolean
}
const toneClass = (tone?: ResearchDocumentTone) => tone === 'positive' ? 'up' : tone === 'negative' ? 'down' : tone === 'warning' ? 'warn' : ''
const tagClass = (tone?: ResearchDocumentTone) => tone === 'positive' ? 'ok' : tone === 'warning' || tone === 'negative' ? 'warn' : ''
function Value({ value }: { value?: ResearchDocumentValue }) { return <span className={toneClass(value?.tone)}>{value?.text ?? '—'}</span> }
function useWords() { const { language } = useClientPreferences(); return (key: ResearchDocumentCopyKey) => copy(key, language) }

function Stats({ values }: { values: readonly [ResearchDocumentCopyKey, ResearchDocumentValue | undefined][] }) {
  const t = useWords()
  return <div className="g-vstat">{values.map(([label, value]) => <div key={label} style={{ minWidth: 0, maxWidth: '100%' }}><div className="k">{t(label)}</div><div className={`v ${toneClass(value?.tone)}`} style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{value?.text ?? '—'}</div></div>)}</div>
}
function ResultStats({ metrics }: { metrics?: ResearchDocumentMetrics }) {
  return <Stats values={(['return', 'drawdown', 'winRate', 'trades', 'profitFactor'] as const).map(key => [key, metrics?.[key]])} />
}
function Finding({ finding }: { finding: ResearchDocumentFinding }) {
  const t = useWords()
  return <div className="g-finding" data-tone={finding.tone ?? 'neutral'} style={finding.tone === 'negative' ? { borderColor: 'rgba(224,96,75,.35)' } : undefined}>
    <div className={toneClass(finding.tone)} style={finding.tone === 'negative' ? { background: 'rgba(224,96,75,.08)', color: 'var(--gr)' } : undefined}>{finding.title}</div>
    <div><span className="k">{t('plain')}</span>{finding.plain}</div><div><span className="k">{t('meaning')}</span>{finding.meaning}</div><div><span className="k">{t('next')}</span>{finding.nextAction}</div>
  </div>
}
function Table({ headers, children, showHead = true }: { headers: readonly ResearchDocumentCopyKey[]; children?: ReactNode; showHead?: boolean }) {
  const t = useWords()
  return <div className="rw-table-scroll" tabIndex={0} role="region" aria-label={headers.map(t).join(' / ')}><table className="g-table">{showHead && <thead><tr>{headers.map(key => <th scope="col" key={key}>{t(key)}</th>)}</tr></thead>}<tbody>{children ?? <tr>{headers.map(key => <td key={key}>—</td>)}</tr>}</tbody></table></div>
}
function CommentIcon() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /></svg> }
function DocumentRow({ row, label, ready }: { row?: ResearchDocumentRow; label: ResearchDocumentCopyKey; ready: boolean }) {
  const t = useWords(), [open, setOpen] = useState(false), [draft, setDraft] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState(false)
  const button = useRef<HTMLButtonElement>(null), form = useRef<HTMLFormElement>(null), restoreFocus = useRef(false), mounted = useRef(false), lock = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useLayoutEffect(() => {
    if (!open && !pending && restoreFocus.current) {
      restoreFocus.current = false
      if (button.current?.getClientRects().length && document.activeElement === document.body) button.current.focus()
    }
  }, [open, pending])
  const title = row?.label ?? t(label)
  const close = () => { restoreFocus.current = document.activeElement === document.body || !!form.current?.contains(document.activeElement); setOpen(false); setError(false) }
  const submit = async () => {
    if (lock.current || !ready || !row?.onComment || !draft.trim()) return
    lock.current = true; setPending(true); setError(false)
    try { await row.onComment(draft.trim()); if (mounted.current) { setDraft(''); close() } }
    catch { if (mounted.current) setError(true) }
    finally { lock.current = false; if (mounted.current) setPending(false) }
  }
  return <><div className="g-row"><span className="k" style={{ flexShrink: 1, minWidth: 0 }}>{title}</span><span className="v">{row?.value ?? '—'}</span>
    <button ref={button} className="cbtn" type="button" disabled={!ready || !row?.onComment || pending} aria-label={`${title} ${t('edit')}`} aria-expanded={open} onClick={() => { setOpen(!open); setError(false) }}><CommentIcon /></button>
  </div>{open && <form ref={form} className="g-inline-input" aria-label={`${title} ${t('edit')}`} onSubmit={event => { event.preventDefault(); void submit() }}>
    <input autoFocus aria-label={`${title} ${t('comment')}`} placeholder={t('commentHint')} value={draft} maxLength={2000} disabled={pending} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing && !pending) { event.stopPropagation(); close() } }} />
    <button className="g-btn g-btn-p" type="submit" disabled={pending || !draft.trim()}>{t(pending ? 'pending' : 'apply')}</button><button className="g-btn g-btn-t" type="button" disabled={pending} onClick={close}>{t('cancel')}</button>
    {error && <p className="rw-input-error" role="alert">{t('error')}</p>}
  </form>}</>
}

/** Scope/document identity is a hard boundary for drafts, requests and late responses. */
export function NativeResearchDocuments(props: NativeResearchDocumentsProps) {
  // Callbacks may be recreated on a parent render or language change. They are
  // not a revision. Prefer an explicit producer revision; older presentation
  // adapters fall back to their non-executable supplied content.
  const revision = useMemo(() => props.document.revision ?? JSON.stringify(props.document.data, (_key, value: unknown) => typeof value === 'function' ? undefined : value), [props.document.revision, props.document.data])
  return <DocumentBody key={JSON.stringify([props.scopeId, props.document.id, props.document.kind, props.document.state, revision])} {...props} />
}
function DocumentBody({ scopeId, document: doc, onOpenDocument, onOpenAnalysis, chartContent, active = true }: NativeResearchDocumentsProps) {
  const t = useWords(), [pending, setPending] = useState<string | null>(null), [failed, setFailed] = useState(false), [whatIfHistory, setWhatIfHistory] = useState<ResearchWhatIfResult[]>([]), [stopConfirm, setStopConfirm] = useState(false)
  const mounted = useRef(false), lock = useRef(false)
  const thread = useNativeResearchThread(), lifetime = useRef<object>({})
  useLayoutEffect(() => {
    const identity = lifetime.current
    return () => thread?.discard(identity)
  }, [thread])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const ready = doc.state === 'ready'
  const run = async (id: string, action?: () => Promise<void>) => {
    if (!ready || !action || lock.current) return
    lock.current = true; setPending(id); setFailed(false)
    try { await action() } catch { if (mounted.current) setFailed(true) }
    finally { lock.current = false; if (mounted.current) setPending(null) }
  }
  const button = (id: string, label: string, action?: () => Promise<void>, primary = false) => <button type="button" className={doc.kind === 'connect' ? `g-fbtn ${primary ? 'p' : 's'}` : `g-btn ${primary ? 'g-btn-p' : 'g-btn-s'}`} disabled={!ready || !action || pending !== null} aria-busy={pending === id} onClick={() => void run(id, action)}>{pending === id ? t('pending') : label}</button>
  const navigate = (id: string | undefined, label: string, primary = false) => <button type="button" className={`g-btn ${primary ? 'g-btn-p' : 'g-btn-t'}`} disabled={!ready || !id || !onOpenDocument} onClick={() => { if (ready && id) onOpenDocument?.(id) }}>{label}</button>
  const analysis = <button type="button" className="g-btn g-btn-t" disabled={!ready || !onOpenAnalysis} onClick={() => { if (ready) onOpenAnalysis?.() }}>{t('analysis')}</button>
  const heading = (kind: ResearchDocumentCopyKey, suffix?: string) => <h3>{doc.title ?? `${t(kind)}${suffix ? ` ${suffix}` : ''}`}</h3>
  let body: ReactNode
  switch (doc.kind) {
    case 'hypothesis': {
      const d = doc.data
      body = <>{heading('hypothesis')}<div className="g-note rw-hypothesis">{d?.professional ?? '—'}</div><h3>{t('plain')}</h3><div>{d?.plain ?? '—'}</div><h3>{t('criteria')}</h3><div className="g-note">{d?.criteria ?? '—'}</div></>
      break
    }
    case 'strategy': {
      const d = doc.data
      body = <>{heading('strategy', d?.versionLabel)}<div className="meta">{d?.description ?? '—'}</div><div className="rw-spaced">{(['entry', 'stopLoss', 'takeProfit', 'maxHolding', 'costs'] as const).map((key, index) => <DocumentRow key={d?.[key]?.id ?? key} row={d?.[key]} ready={ready} label={(['entry', 'stopLoss', 'takeProfit', 'holding', 'costs'] as const)[index]} />)}</div></>
      break
    }
    case 'backtest': {
      const d = doc.data
      body = <>{heading('backtest', d?.versionLabel)}<div className="meta">{d?.description ?? '—'}</div><ResultStats metrics={d?.metrics} />
        {chartContent ?? <NativeResearchChartPreview scopeId={scopeId} versionIdentity={d?.chart?.versionIdentity ?? doc.id} active={active}
          prices={ready ? d?.chart?.prices : undefined} equity={ready ? d?.chart?.equity : undefined} onOpenAnalysis={ready ? onOpenAnalysis : undefined} />}
        {(d?.priceDescription || d?.equityDescription) && <p className="g-note">{[d.priceDescription, d.equityDescription].filter(Boolean).join('\n')}</p>}
        <h3>{t('byYear')}</h3><Table headers={['year', 'pnl', 'trades', 'winRate']}>{d?.years.length ? d.years.map(row => <tr key={row.id}><td className="num">{row.year}</td><td className="num"><Value value={row.pnl} /></td><td className="num">{row.trades}</td><td className="num">{row.winRate}</td></tr>) : undefined}</Table><p className="g-note rw-spaced">{d?.drawdownExplanation ?? '—'}</p></>
      break
    }
    case 'critic': {
      const d = doc.data
      body = <>{heading('critic')}<div className="meta">{t('criticFlow')}</div><div className="research-critic-blocks" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div><span className="g-tag">{t('builderRole')}</span><p>{d?.builder ?? '—'}</p></div><div><span className="g-tag warn">{t('criticRole')}</span><p>{d?.critic ?? '—'}</p></div><div><span className={`g-tag ${tagClass(d?.verdictTone)}`}>{t('verdictRole')}</span><p>{d?.verdict ?? '—'}</p></div></div>{d?.finding && <Finding finding={d.finding} />}</>
      break
    }
    case 'stress': {
      const d = doc.data
      body = <>{heading('stress')}<div className="meta">{d?.description ?? t('stressHint')}</div><div className="rw-spaced"><Table headers={['scenario', 'result', 'verdict']}>{d?.scenarios.length ? d.scenarios.map(row => <tr key={row.id}><td>{row.name}</td><td className="num">{row.result}</td><td><Value value={row.verdict} /></td></tr>) : undefined}</Table></div></>
      break
    }
    case 'holdout': {
      const d = doc.data
      const comparison = (values?: { research: string; holdout: string }) => values ? { text: `${values.research} → ${values.holdout}` } : undefined
      body = <>{heading('holdout')}<div className="meta">{d?.description ?? '—'}</div><Stats values={[[ 'annualized', comparison(d?.annualizedReturn)], ['decline', comparison(d?.drawdown)], ['trades', comparison(d?.trades)]]} />{d?.assessment?.kind === 'finding' ? <Finding finding={d.assessment.finding} /> : <p className="g-note rw-spaced">{d?.assessment?.text ?? '—'}</p>}</>
      break
    }
    case 'report': {
      const d = doc.data
      const choices = d?.whatIf ?? (['fee2', 'delay', 'sl2'] as const).map(id => ({ id, label: t(id), onRun: undefined }))
      body = <><h3>{doc.title ?? d?.strategyName ?? t('report')}</h3><div className="meta">{d?.description ?? '—'}</div><div className="rw-verdict"><p>{d?.verdict?.summary ?? '—'}</p><span className={`g-tag ${tagClass(d?.verdict?.grade.tone)}`}><Value value={d?.verdict?.grade} /></span></div>
        <Stats values={(['researchReturn', 'holdoutReturn', 'drawdown', 'profitFactor'] as const).map(key => [key, d?.metrics[key]])} />
        <h3>{t('evidence')}</h3><div className="rw-evidence">{d?.evidence.length ? d.evidence.map(item => <div key={item.id}><span aria-hidden="true">{item.status === 'confirmed' ? '✓' : item.status === 'warning' ? '!' : '?'}</span> {item.text} {item.documentId && navigate(item.documentId, t('evidence'))}</div>) : <div>— {navigate(undefined, t('evidence'))}</div>}</div>
        <h3>{t('disagreement')}</h3><div className="g-note">{d?.disagreement ? <>{d.disagreement.opinions.map(opinion => <div key={opinion.id}>{opinion.author}, {opinion.verdict}</div>)}<p>{d.disagreement.explanation}</p></> : '—'}</div>
        <h3>{t('integrity')}</h3><div className="g-note">{d?.integrity?.summary ?? '—'}{d?.integrity?.conclusion && <><br /><b>{d.integrity.conclusion}</b></>}</div><h3>{t('unknowns')}</h3><div className="g-note">{d?.unknowns ?? '—'}</div>
        <h3>{t('whatIf')}</h3><div className="g-chiprow" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{choices.map(choice => <button type="button" className="g-qchip" key={choice.id} disabled={!ready || !choice.onRun || pending !== null} aria-busy={pending === choice.id} onClick={() => void run(choice.id, choice.onRun ? async () => {
          const result = await choice.onRun!()
          if (!mounted.current) return
          if (thread) thread.append(lifetime.current, <WhatIfResult result={result} />)
          else setWhatIfHistory(history => [...history, result])
        } : undefined)}>{pending === choice.id ? t('pending') : choice.label}</button>)}</div>
        <div className="rw-actions">{navigate(d?.connectDocumentId, t('connect'), true)}{navigate(d?.activityDocumentId, t('activity'))}{analysis}</div></>
      break
    }
    case 'connect': {
      const d = doc.data
      body = <div className="g-card-center"><div className="ct">{doc.title ?? t('connect')}</div>{button('connect', d?.primaryLabel ?? t('primaryConnect'), d?.onConnect, true)}{button('partner', d?.partnerLabel ?? t('partner'), d?.onPartner)}
        <Table headers={['check', 'result']} showHead={false}>{(['balancesAndQuotes', 'orders', 'withdrawals'] as const).map((key, index) => <tr key={key}><td>{t((['balances', 'orders', 'withdrawals'] as const)[index])}</td><td style={{ textAlign: 'right', color: d?.permissions?.[key] === true ? 'var(--gg)' : 'var(--gt3)' }}>{typeof d?.permissions?.[key] === 'boolean' ? t(d.permissions[key] ? 'requested' : 'notRequested') : '—'}</td></tr>)}</Table><p className="g-note" style={{ textAlign: 'center' }}>{d?.disclosure ?? '—'}</p></div>
      break
    }
    case 'run': {
      const d = doc.data
      body = <>{heading('run')}<div className="meta">{d?.description ?? '—'}</div><div className="rw-spaced">{(['strategy', 'conditions', 'stopAndTarget', 'capital', 'verification'] as const).map(key => <DocumentRow key={d?.[key]?.id ?? key} row={d?.[key]} ready={ready} label={key} />)}</div><p className="g-note rw-spaced">{d?.disclosure ?? '—'}</p><div className="rw-actions">{button('paper', d?.paperLabel ?? t('paper'), d?.onPaper, true)}{button('live', d?.liveLabel ?? t('liveStart'), d?.onLive)}</div></>
      break
    }
    case 'live': {
      const d = doc.data
      body = <><h3>{doc.title ?? d?.strategyName ?? t('live')}</h3><div className="meta"><span className="g-tag"><span className={`g-dot ${d?.status === 'active' ? 'run' : ''}`} />{d?.modeLabel ?? '—'}</span> {d?.statusLabel ?? '—'}{d?.broker ? ` · ${d.broker}` : ''}</div><p className="g-note rw-spaced">{d?.summary ?? '—'}</p>
        <div className="rw-actions"><button type="button" className="g-btn g-btn-p" disabled={!ready || !d?.onOpenTrading} onClick={() => { if (ready) d?.onOpenTrading?.() }}>{t('openTrading')}</button></div>
        <h3>{t('recent')}</h3><Table headers={['time', 'type', 'quantity', 'pnl']} showHead={false}>{d?.activity.length ? d.activity.map(row => <tr key={row.id}><td className="num" style={{ color: 'var(--gt3)' }}>{row.time}</td><td>{row.type}</td><td className="num">{row.quantity}</td><td className="num" style={{ textAlign: 'right' }}><Value value={row.pnl} /></td></tr>) : undefined}</Table>
        <h3>{t('reality')}</h3><Table headers={['check', 'comparison', 'verdict']} showHead={false}>{d?.realityCheck?.length ? d.realityCheck.map(row => <tr key={row.id}><td>{row.label}</td><td className="num">{row.assumed} → {row.observed}</td><td style={{ textAlign: 'right' }}><Value value={row.verdict} /></td></tr>) : undefined}</Table>
        <div className="rw-actions">{d?.status === 'paused' ? button('resume', t('resume'), d.onResume) : button('pause', t('pause'), d?.status === 'active' ? d.onPause : undefined)}
          {!stopConfirm ? <button type="button" className="g-btn g-btn-s" disabled={!ready || !d?.onStop || pending !== null || !['active', 'paused'].includes(d.status)} onClick={() => setStopConfirm(true)}>{t('stop')}</button> : <><span>{t('confirmStop')}</span>{button('stop', t('stop'), d?.onStop ? async () => { await d.onStop!(); if (mounted.current) setStopConfirm(false) } : undefined)}<button type="button" className="g-btn g-btn-t" disabled={pending !== null} onClick={() => setStopConfirm(false)}>{t('cancel')}</button></>}
        </div></>
      break
    }
  }
  return <div data-research-document-kind={doc.kind} data-document-state={doc.state} style={{ minWidth: 0 }}>
    {body}
    {/* Append supplied successes after this document, like gDocThread. This is
        local presentation history, not the general conversation or server storage.
        The keyed DocumentBody lifetime also binds late responses and resets it. */}
    {whatIfHistory.length > 0 && <div className="rw-thread" data-research-whatif-history aria-live="polite" aria-relevant="additions">
      {whatIfHistory.map((result, index) => <WhatIfResult result={result} key={index} />)}
    </div>}
    {(doc.state !== 'ready' || doc.statusLabel) && <p className="g-note rw-spaced" role="status">{doc.statusLabel ?? t(doc.state === 'loading' ? 'loading' : doc.state === 'error' ? 'error' : 'unavailable')}</p>}
    {failed && <p className="rw-input-error rw-spaced" role="alert">{t('error')}</p>}
  </div>
}

function WhatIfResult({ result }: { result: ResearchWhatIfResult }) {
  return <section className="g-note" data-native-thread-kind="whatif"><h3>{result.title}</h3><p>{result.summary}</p>{result.metrics && <ResultStats metrics={result.metrics} />}</section>
}
