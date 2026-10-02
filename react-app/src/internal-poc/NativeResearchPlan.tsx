import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeResearchPlanText } from './native-research-plan-copy'
import '../client-restored-research.css'

export type NativeResearchPlanRow = {
  label?: string
  /** Exact supplied display text, including units and adjacent numeric values. */
  value: string
  /** Existing controller-owned trigger/form, mounted exactly once. */
  editor?: ReactNode
}
export type NativeResearchPlanProps = {
  /** Presentation lifetime boundary, not authentication or execution authority. */
  scopeId: string
  title?: string
  summary?: string
  target?: NativeResearchPlanRow
  entry?: NativeResearchPlanRow
  stopLoss?: NativeResearchPlanRow
  takeProfit?: NativeResearchPlanRow
  researchRange?: NativeResearchPlanRow
  holdoutRange?: NativeResearchPlanRow
  costs?: NativeResearchPlanRow
  validation?: NativeResearchPlanRow
  /** Replaces the entire CTA area, preserving the existing workflow controller. */
  actions?: ReactNode
  onEditConditions?: () => void
  onResearchStart?: () => void | Promise<void>
  researchStartDisabled?: boolean
  /** Full SDK-backed conditions/details, not a second copy of any row editor. */
  rawDetails?: ReactNode
}
const rows = ['target', 'entry', 'stopLoss', 'takeProfit', 'researchRange', 'holdoutRange', 'costs', 'validation'] as const
function CommentSymbol() {
  return <span className="rw-comment-symbol"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>💬</span><svg className="rw-comment-hint-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /></svg></span>
}

/** Original gDocPlan presentation. No fixture, timer, percentage parser, local
 * research producer, implicit seven-stage validation, or period/cost defaults. */
export function NativeResearchPlan(props: NativeResearchPlanProps) { return <PlanBody key={props.scopeId} {...props} /> }
function PlanBody(props: NativeResearchPlanProps) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof nativeResearchPlanText>[1]) => nativeResearchPlanText(language, key)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  const alive = useRef(false), lock = useRef(false)
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const start = async () => {
    if (!props.onResearchStart || props.researchStartDisabled || lock.current || !alive.current) return
    lock.current = true; setPending(true); setFailed(false)
    try { await props.onResearchStart() } catch { if (alive.current) setFailed(true) }
    finally { lock.current = false; if (alive.current) setPending(false) }
  }
  const edit = () => { try { props.onEditConditions?.() } catch { setFailed(true) } }
  const hint = t('hint').split('💬')
  return <div className="native-research-plan" data-plan-scope={props.scopeId} lang={language}>
    <h3>{props.title ?? t('title')}</h3>
    <div className="meta" style={{ overflowWrap: 'anywhere' }}>{props.target?.value !== undefined && <>{props.target.value}, </>}{hint[0]}<CommentSymbol />{hint[1]}</div>
    <div className="g-note rw-spaced" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{props.summary ?? t('unavailable')}</div>
    <div className="rw-rows">{rows.map(key => {
      const row = props[key], label = row?.label ?? t(key), hasEditor = row?.editor !== undefined && row.editor !== null && row.editor !== false
      return <div className="g-row" data-k={key} key={key} style={hasEditor ? { display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) minmax(0,2fr)', paddingLeft: 2 } : undefined}>
        <span className="k" style={{ minWidth: 0, flexShrink: 1, maxWidth: hasEditor ? 'none' : undefined, overflowWrap: 'anywhere', ...(hasEditor ? { gridColumn: 2, gridRow: 1 } : {}) }}>{label}</span>
        <span className="v" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(hasEditor ? { gridColumn: 3, gridRow: 1 } : {}) }}>{row?.value ?? t('unavailable')}</span>
        {hasEditor ? row.editor : <button type="button" className="cbtn" disabled aria-label={`${label} ${t('comment')}`}><span aria-hidden="true"><CommentSymbol /></span></button>}
      </div>
    })}</div>
    <div className="native-research-plan-actions" style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      {props.actions !== undefined ? props.actions : <><button type="button" className="g-btn g-btn-p" aria-busy={pending} disabled={!props.onResearchStart || props.researchStartDisabled || pending} onClick={() => void start()}>{t('start')}</button><button type="button" className="g-btn g-btn-t" disabled={!props.onEditConditions || pending} onClick={edit}>{t('edit')}</button>{pending && <span className="g-note" role="status">{t('pending')}</span>}</>}
    </div>
    {failed && <p className="rw-input-error" role="alert">{t('failed')}</p>}
    {props.rawDetails}
  </div>
}
