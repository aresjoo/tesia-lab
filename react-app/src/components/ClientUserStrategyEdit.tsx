import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { evaluateSourceTerminal, type SourceTerminalParameters } from '../client-terminal-source-fixture'
import { scoreSourceTerminal } from '../client-terminal-source-proposal'
import { SOURCE_USER_STRATEGY_PASS_SCORE, type SourceUserStrategyRecord } from '../client-user-strategy'
import { delegationQuestions } from '../client-delegation-fixtures'
import { SourceUserStrategyEditConflict } from '../client-user-strategy-store'
import '../client-strategy-sharing.css'
import '../client-user-strategy-edit.css'

type Props = {
  record: SourceUserStrategyRecord
  current: SourceUserStrategyRecord
  onClose: () => void
  onApply: (expected: SourceUserStrategyRecord, parameters: SourceTerminalParameters) => void | Promise<void>
}
type Candidate = { parameters: SourceTerminalParameters; result: ReturnType<typeof evaluateSourceTerminal>['r']; score: number }
const stops = [-3, -5, -8, -12]
const profits = [8, 10, 12, 15]
const entries = [38, 40, 42, 44, 46]

/** Client 8c5d8c8 tfBotEdit/Run/Dirty/Apply. Source-preview calculation only. */
export function ClientUserStrategyEdit({ record, current, onClose, onApply }: Props) {
  const [parameters, setParameters] = useState(() => ({ ...record.parameters! }))
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [dirty, setDirty] = useState(false), [error, setError] = useState<'conflict' | 'request' | null>(null), [pending, setPending] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null), resultNode = useRef<HTMLDivElement>(null)
  const errorNode = useRef<HTMLParagraphElement>(null)
  const backdropDown = useRef(false)
  const live = useRef(true), working = useRef(false), id = useId()
  const stale = JSON.stringify(current) !== JSON.stringify(record)
  const pass = candidate !== null && candidate.score >= SOURCE_USER_STRATEGY_PASS_SCORE
  useEffect(() => {
    live.current = true
    const node = dialog.current!, origin = document.activeElement, host = node.closest('.client-user-strategy')
    const scroll = (host?.closest<HTMLElement>('.client-main-account') ?? document.getElementById('tesia-main'))?.style
    const overflow = scroll?.getPropertyValue('overflow-y'), priority = scroll?.getPropertyPriority('overflow-y')
    scroll?.setProperty('overflow-y', 'hidden')
    node.showModal(); node.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    return () => {
      live.current = false; node.close()
      if (scroll) { if (overflow) scroll.setProperty('overflow-y', overflow, priority); else scroll.removeProperty('overflow-y') }
      const target = [origin instanceof HTMLElement ? origin : null, host?.querySelector<HTMLElement>('.nfxb-actions .nfx-btn.out'), host?.querySelector<HTMLElement>('.nfx-page > .nfx-btn')]
        .find(element => element?.isConnected && element !== document.body && element !== document.documentElement && !element.matches(':disabled') && !element.closest('[hidden],[inert]') && element.getClientRects().length)
      target?.focus({ preventScroll: true })
    }
  }, [])
  useLayoutEffect(() => { if (candidate) resultNode.current?.focus({ preventScroll: true }) }, [candidate])
  useLayoutEffect(() => {
    if (!pending && (error || stale) && (document.activeElement === document.body || document.activeElement === dialog.current)) errorNode.current?.focus({ preventScroll: true })
  }, [error, stale, pending])
  const change = (patch: Partial<SourceTerminalParameters>) => {
    if (working.current || error === 'conflict') return
    setParameters(previous => ({ ...previous, ...patch })); setCandidate(null); setDirty(true); setError(null)
  }
  const validate = () => {
    if (working.current || stale || error === 'conflict') return
    try {
      const result = evaluateSourceTerminal(parameters, 1).r
      setCandidate({ parameters: { ...parameters }, result, score: scoreSourceTerminal(result) }); setDirty(false); setError(null)
    } catch { setCandidate(null); setError('request') }
  }
  const apply = async () => {
    if (working.current || stale || error === 'conflict' || !pass || !candidate || JSON.stringify(candidate.parameters) !== JSON.stringify(parameters)) return
    working.current = true; setPending(true); setError(null)
    try { await onApply(record, candidate.parameters); if (live.current) onClose() }
    catch (failure) { if (live.current) setError(failure instanceof SourceUserStrategyEditConflict ? 'conflict' : 'request') }
    finally { if (live.current) { working.current = false; setPending(false) } }
  }
  return <div className="client-strategy-sharing user-strategy-edit-host"><dialog ref={dialog} className="ss3-dialog user-strategy-edit" aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!working.current) onClose() }}
    onPointerDown={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      backdropDown.current = !working.current && event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
    }}
    onPointerCancel={() => { backdropDown.current = false }}
    onClick={event => {
      const startedOutside = backdropDown.current
      backdropDown.current = false
      if (!startedOutside || working.current || event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    }}
    onKeyDown={event => { if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation() } }}>
    <header><h2 id={`${id}-title`} tabIndex={-1}>전략 수정: {record.name}</h2><button type="button" aria-label="닫기" disabled={pending} onClick={onClose}><X size={20} /></button></header>
    <div className="ss3-dialog-body"><p className="ss3-notice">설정을 바꾸면 같은 검증 구간에서 다시 검증해요. 재검증을 통과해야 이 전략에 적용됩니다.{record.status === 'live' && ' 적용 시 실행이 일시정지돼요.'}</p>
      <fieldset disabled={pending || stale || error === 'conflict'}>
        <label><span id={`${id}-sl`}>손절선</span><select aria-labelledby={`${id}-sl`} value={parameters.sl} onChange={event => change({ sl: Number(event.target.value) })}>
          {!stops.includes(parameters.sl) && <option value={parameters.sl}>{parameters.sl}%</option>}
          {stops.map((value, i) => <option value={value} key={value}>{delegationQuestions.find(item => item.key === 'stop')!.options[i].join(' (') + ')'}</option>)}
        </select></label>
        <label><span id={`${id}-tp`}>익절 목표</span><select aria-labelledby={`${id}-tp`} value={parameters.tp ?? 'none'} onChange={event => change({ tp: event.target.value === 'none' ? null : Number(event.target.value) })}>
          {(parameters.tp === null || !profits.includes(parameters.tp)) && <option value={parameters.tp ?? 'none'}>{parameters.tp === null ? '기간 청산' : `+${parameters.tp}%`}</option>}
          {profits.map(value => <option value={value} key={value}>+{value}%</option>)}
        </select></label>
        <label><span id={`${id}-rsi`}>진입 RSI 임계</span><select aria-labelledby={`${id}-rsi`} value={parameters.rsiTh} onChange={event => change({ rsiTh: Number(event.target.value) })}>
          {!entries.includes(parameters.rsiTh) && <option value={parameters.rsiTh}>RSI {parameters.rsiTh} 이하</option>}
          {entries.map(value => <option value={value} key={value}>RSI {value} 이하</option>)}
        </select></label>
        <label><span id={`${id}-trend`}>추세 필터</span><select aria-labelledby={`${id}-trend`} value={parameters.trendFilter ? '1' : '0'} onChange={event => change({ trendFilter: event.target.value === '1' })}><option value="1">사용 (20/60일 이평)</option><option value="0">사용 안 함</option></select></label>
      </fieldset>
      {stale || error === 'conflict' ? <p ref={errorNode} tabIndex={-1} role="alert">전략 상태가 바뀌었어요. 현재 상태를 확인해주세요.</p> : error ? <p ref={errorNode} tabIndex={-1} role="alert">요청을 완료하지 못했어요. 다시 시도해 주세요.</p> : candidate ? <div ref={resultNode} tabIndex={-1} role="status" className="user-edit-result">재검증 결과: TETH <b>{candidate.score}점</b> ({pass ? '통과' : `기준 ${SOURCE_USER_STRATEGY_PASS_SCORE}점 미달`}), 검증 수익 <b className={candidate.result.ret >= 0 ? 'up' : 'dn'}>{candidate.result.ret >= 0 ? '+' : ''}{candidate.result.ret.toFixed(1)}%</b>, 최대 낙폭 {candidate.result.mdd.toFixed(1)}%, 체결 {candidate.result.n}회 <span>(시뮬레이션)</span>{!pass && <p>설정을 조정해 다시 검증해보세요. 통과 전에는 적용되지 않아요.</p>}</div> : dirty && <p role="status">설정이 바뀌었어요. <b>재검증</b>을 다시 통과해야 적용할 수 있어요.</p>}
      <div className="ss3-dacts" aria-busy={pending}><button type="button" className="obtn" disabled={pending} onClick={onClose}>취소</button><button type="button" className="wbtn" disabled={pending || stale || error === 'conflict'} onClick={validate}>재검증</button>{pass && <button type="button" className="wbtn" disabled={pending || stale || error === 'conflict'} onClick={() => void apply()}>이 전략에 적용</button>}</div>
    </div>
  </dialog></div>
}
