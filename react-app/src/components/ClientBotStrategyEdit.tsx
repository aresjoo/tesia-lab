import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { botStrategyEditText } from '../client-bot-strategy-edit-copy'
import { sameBotEditInput, type BotStrategyEditInput, type BotStrategyEditParameters, type BotStrategyEditPresentation } from '../client-bot-strategy-edit-presentation'
import '../client-strategy-sharing.css'
import '../client-user-strategy-edit.css'

const stops = [-3, -5, -8, -12], profits = [8, 10, 12, 15], entries = [38, 40, 42, 44, 46]
const stopLabels = ['stopShort', 'stopStandard', 'stopWide', 'stopLong'] as const
const valid = (p: BotStrategyEditParameters) => Number.isFinite(p.stopLossPercent) && p.stopLossPercent < 0 && p.stopLossPercent >= -100
  && (p.takeProfitPercent === null || Number.isFinite(p.takeProfitPercent) && p.takeProfitPercent > 0)
  && Number.isFinite(p.rsiThreshold) && p.rsiThreshold >= 0 && p.rsiThreshold <= 100 && typeof p.trendFilter === 'boolean'
const copyInput = (input: BotStrategyEditInput): BotStrategyEditInput => ({ ...input, parameters: { ...input.parameters } })

/** tfBotEdit/Run/Dirty/Apply UI only. Never imports the preview backtest/store. */
export function ClientBotStrategyEdit({ title, presentation: p, onClose, returnFocus }: { title: string; presentation: BotStrategyEditPresentation; onClose: () => void; returnFocus?: HTMLElement | null }) {
  const { language } = useClientPreferences(), id = useId()
  const t = (key: Parameters<typeof botStrategyEditText>[1], values?: Record<string, string | number>) => botStrategyEditText(language, key, values)
  const [parameters, setParameters] = useState(() => ({ ...p.initial }))
  const [requested, setRequested] = useState<BotStrategyEditInput | null>(null)
  const [dirty, setDirty] = useState(false), [error, setError] = useState<'validate' | 'apply' | null>(null)
  const [pending, setPending] = useState<'validate' | 'apply' | null>(null), [applyRequested, setApplyRequested] = useState(false)
  const sequence = useRef(0), request = useRef<object | null>(null), alive = useRef(false)
  const dialog = useRef<HTMLDialogElement>(null), backdropDown = useRef(false), resultNode = useRef<HTMLDivElement>(null)
  const origin = useRef(returnFocus)
  const currentInput = requested && { strategyId: p.strategyId, revision: p.revision, inputIdentity: requested.inputIdentity, parameters }
  const validation = sameBotEditInput(p.validation, requested) && sameBotEditInput(p.validation, currentInput) ? p.validation : undefined
  const confirmed = validation?.confirmed === true && validation.verdict !== 'pending'
  const application = applyRequested && sameBotEditInput(p.application, requested) && sameBotEditInput(p.application, currentInput) ? p.application : undefined
  const applied = application?.status === 'applied'
  const waitingApply = applyRequested && error !== 'apply' && (!application || application.status === 'pending')
  const waitingValidation = !!requested && !confirmed && !error
  const passed = confirmed && validation.verdict === 'passed'
  const custom = !stops.includes(parameters.stopLossPercent) || parameters.takeProfitPercent === null || !profits.includes(parameters.takeProfitPercent) || !entries.includes(parameters.rsiThreshold)
  useEffect(() => {
    alive.current = true
    const node = dialog.current!, previous = origin.current ?? document.activeElement
    node.showModal(); node.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    return () => {
      alive.current = false; request.current = null; node.close()
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body && !previous.matches(':disabled') && !previous.closest('[hidden],[inert]') && previous.getClientRects().length && !document.querySelector('dialog:modal')) previous.focus({ preventScroll: true })
    }
  }, [])
  useLayoutEffect(() => {
    if ((confirmed || applied) && resultNode.current && dialog.current?.contains(document.activeElement)) resultNode.current.focus({ preventScroll: true })
  }, [confirmed, applied])
  const change = (patch: Partial<BotStrategyEditParameters>) => {
    if (request.current || waitingApply || applied) return
    setParameters(value => ({ ...value, ...patch })); setRequested(null); setDirty(true); setError(null); setApplyRequested(false)
  }
  const invoke = async (kind: 'validate' | 'apply') => {
    const callback = kind === 'validate' ? p.onValidate : p.onApply
    if (!callback || request.current || !alive.current || !valid(parameters) || applied || waitingApply) return
    if (kind === 'apply' && (!passed || !requested)) return
    if (kind === 'validate' && waitingValidation) return
    const input: BotStrategyEditInput = kind === 'apply' ? copyInput(requested!) : { strategyId: p.strategyId, revision: p.revision, inputIdentity: `${id}:${++sequence.current}`, parameters: { ...parameters } }
    const token = {}; request.current = token; setPending(kind); setError(null)
    if (kind === 'validate') { setRequested(input); setApplyRequested(false); setDirty(false) }
    else setApplyRequested(true)
    try { await callback(copyInput(input)) }
    catch {
      if (alive.current && request.current === token) {
        // Keep correlation after an acknowledgement failure. A separately
        // observed outcome, even in the same React batch, outranks that failure.
        // Editing/retrying still invalidates or replaces the validation input.
        setError(kind)
      }
    } finally {
      if (alive.current && request.current === token) { request.current = null; setPending(null) }
    }
  }
  const close = () => { if (!request.current) onClose() }
  return <div className="client-strategy-sharing user-strategy-edit-host"><dialog ref={dialog} className="ss3-dialog user-strategy-edit" aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onPointerDown={event => { const box = event.currentTarget.getBoundingClientRect(); backdropDown.current = !request.current && event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) }}
    onPointerCancel={() => { backdropDown.current = false }}
    onClick={event => { const outside = backdropDown.current; backdropDown.current = false; if (outside && event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close() } }}
    onKeyDown={event => { if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation() } }}>
    <header><h2 id={`${id}-title`} tabIndex={-1}>{t('title', { name: title })}</h2><button type="button" aria-label={t('close')} disabled={!!pending} onClick={close}><X size={20} /></button></header>
    <div className="ss3-dialog-body"><p className="ss3-notice">{p.notice ?? t('notice')}</p>
      {custom && <p className="ss3-notice">{t('custom')}</p>}
      <fieldset disabled={!!pending || waitingApply || applied}>
        <label><span id={`${id}-sl`}>{t('stopLoss')}</span><select aria-labelledby={`${id}-sl`} value={parameters.stopLossPercent} onChange={event => change({ stopLossPercent: Number(event.target.value) })}>
          {!stops.includes(parameters.stopLossPercent) && <option value={parameters.stopLossPercent}>{parameters.stopLossPercent}%</option>}
          {stops.map((value, index) => <option value={value} key={value}>{t('stopOption', { value, label: t(stopLabels[index]) })}</option>)}
        </select></label>
        <label><span id={`${id}-tp`}>{t('takeProfit')}</span><select aria-labelledby={`${id}-tp`} value={parameters.takeProfitPercent ?? 'none'} onChange={event => change({ takeProfitPercent: event.target.value === 'none' ? null : Number(event.target.value) })}>
          {(parameters.takeProfitPercent === null || !profits.includes(parameters.takeProfitPercent)) && <option value={parameters.takeProfitPercent ?? 'none'}>{parameters.takeProfitPercent === null ? t('periodExit') : `+${parameters.takeProfitPercent}%`}</option>}
          {profits.map(value => <option value={value} key={value}>+{value}%</option>)}
        </select></label>
        <label><span id={`${id}-rsi`}>{t('rsi')}</span><select aria-labelledby={`${id}-rsi`} value={parameters.rsiThreshold} onChange={event => change({ rsiThreshold: Number(event.target.value) })}>
          {!entries.includes(parameters.rsiThreshold) && <option value={parameters.rsiThreshold}>{t('rsiOption', { value: parameters.rsiThreshold })}</option>}
          {entries.map(value => <option value={value} key={value}>{t('rsiOption', { value })}</option>)}
        </select></label>
        <label><span id={`${id}-filter`}>{t('filter')}</span><select aria-labelledby={`${id}-filter`} value={parameters.trendFilter ? '1' : '0'} onChange={event => change({ trendFilter: event.target.value === '1' })}><option value="1">{t('filterOn')}</option><option value="0">{t('filterOff')}</option></select></label>
      </fieldset>
      {!valid(parameters) && <p role="alert">{t('invalid')}</p>}
      {!p.onValidate && <p className="ss3-notice">{t('unavailable')}</p>}
      {(error === 'validate' && !confirmed || error === 'apply' && !applied || application?.status === 'failed') && <p role="alert">{t('requestFailed')}</p>}
      {applied ? <div ref={resultNode} role="status" tabIndex={-1} className="user-edit-result">{application?.message ?? t('applied')}</div>
        : waitingApply ? <p role="status">{t('waitingApplication')}</p>
          : confirmed ? <div ref={resultNode} role="status" tabIndex={-1} className="user-edit-result">{t('result')}: {validation.scoreLabel && <>TETH <b>{validation.scoreLabel}</b> </>}({t(passed ? 'passed' : 'failed')}){validation.returnLabel && <>, {t('return')} <b>{validation.returnLabel}</b></>}{validation.drawdownLabel && <>, {t('drawdown')} {validation.drawdownLabel}</>}{validation.tradesLabel && <>, {t('trades')} {validation.tradesLabel}</>}{validation.sourceLabel && <> <span>({validation.sourceLabel})</span></>}{!passed && <p>{t('adjust')}</p>}</div>
            : waitingValidation ? <p role="status">{t('waitingValidation')}</p> : dirty && <p role="status">{t('changed')}</p>}
      <div className="ss3-dacts"><button type="button" className="obtn" disabled={!!pending} onClick={close}>{t(applied ? 'close' : 'cancel')}</button>
        {!applied && <button type="button" className="wbtn" disabled={!p.onValidate || !!pending || waitingValidation || waitingApply || !valid(parameters)} aria-busy={pending === 'validate' || undefined} onClick={() => { void invoke('validate') }}>{t(pending === 'validate' ? 'validating' : 'validate')}</button>}
        {!applied && passed && <button type="button" className="wbtn" disabled={!p.onApply || !!pending || waitingApply} aria-busy={pending === 'apply' || undefined} onClick={() => { void invoke('apply') }}>{t(pending === 'apply' ? 'applying' : 'apply')}</button>}
      </div>
    </div>
  </dialog></div>
}
