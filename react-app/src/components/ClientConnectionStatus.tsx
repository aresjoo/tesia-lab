import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { planExchanges, type PlanExchange } from '../client-connection-plan'
import { boundConnectionStatus, type ConnectionStatusAction, type ConnectionStatusPresentation, type ConnectionStatusRecord,
  type ConnectionStatusRequest, type ConnectionStatusSource } from '../client-connection-status-presentation'
import '../client-connection-status.css'

export type ClientConnectionStatusProps = {
  presentation?: ConnectionStatusPresentation; scope: string | null; source: ConnectionStatusSource
  /** Closes only the current UI observation; it does not cancel a server command. */
  onClose?: () => void
}
const name = (id: PlanExchange) => planExchanges.find(([key]) => key === id)![1]
function Check() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500" /></svg> }
function Out() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg> }
function Logo({ exchange }: { exchange: PlanExchange }) {
  const [failed, setFailed] = useState(false)
  return failed ? <span className="ccs-logo" aria-hidden="true">{name(exchange).slice(0, 2)}</span>
    : <img src={`/client-broker-assets/app-${exchange}.${exchange === 'gate' ? 'jpg' : 'png'}`} width="22" height="22" alt="" onError={() => setFailed(true)} />
}
function Account({ connection, action }: { connection: ConnectionStatusRecord; action?: ReactNode }) {
  return <p className="px-acct"><Logo exchange={connection.exchange} /><b>{name(connection.exchange)}</b>
    {connection.maskedAccountLabel && <span className="num">{connection.maskedAccountLabel}</span>}
    <em>{connection.eligibility === 'expired' ? '구독이 끝나 새 주문이 멈췄습니다' : connection.eligibility === 'unknown'
      ? '연결 이용 가능 여부를 확인할 수 없습니다.' : connection.route === 'paid' ? '구독' : 'TETH 초대 계정'}</em>{action}</p>
}
/** Controlled source display. No credentials, storage, timers or optimistic state. */
export function ClientConnectionStatus({ presentation, scope, source, onClose }: ClientConnectionStatusProps) {
  const p = boundConnectionStatus(presentation, scope, source), titleId = useId()
  const key = JSON.stringify([scope, source, p?.identity, p?.state])
  const live = useRef({ p, key, active: true }), attempt = useRef<AbortController | null>(null)
  const [operation, setOperation] = useState<{ key: string; phase: 'pending' | 'awaiting' | 'unknown' } | null>(null)
  const [closed, setClosed] = useState<string | null>(null), [menu, setMenu] = useState<string | null>(null)
  const root = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    live.current = { p, key, active: closed !== key }
  }, [key, p, closed])
  useLayoutEffect(() => {
    return () => { live.current.active = false; attempt.current?.abort(); attempt.current = null }
  }, [key])
  useLayoutEffect(() => {
    if (menu !== key) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setMenu(null) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [key, menu])
  const phase = operation?.key === key ? operation.phase : null
  const close = () => {
    live.current.active = false; attempt.current?.abort(); attempt.current = null
    setClosed(key); setMenu(null); onClose?.()
  }
  const run = (action: ConnectionStatusAction, detail: Pick<ConnectionStatusRequest, 'exchange' | 'connectionId' | 'selection'> = {}) => {
    const current = live.current
    if (!current.active || current.key !== key || !current.p || attempt.current
      || phase && action !== 'refresh' || typeof current.p.actions?.[action] !== 'function') return
    const callback = current.p.actions[action]!, controller = new AbortController()
    attempt.current = controller; setOperation({ key, phase: 'pending' }); setMenu(null)
    const request: ConnectionStatusRequest = { scope: current.p.scope, identity: current.p.identity, source: current.p.source, action, ...detail }
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted && live.current.active && live.current.key === key) return callback(request, controller.signal)
    }).then(() => finish('awaiting'), () => finish('unknown'))
    function finish(next: 'awaiting' | 'unknown') {
      if (controller.signal.aborted || attempt.current !== controller || !live.current.active || live.current.key !== key) return
      attempt.current = null; setOperation({ key, phase: next })
    }
  }
  if (closed === key) return <p className="client-connection-status" role="status">연결 상태 화면을 닫았습니다.</p>
  if (!p) return <p className="client-connection-status ccs-unavailable" role="status">연결 상태를 확인할 수 없습니다.</p>
  const state = p.state
  const exchange = 'exchange' in state ? state.exchange : 'connection' in state ? state.connection.exchange : undefined
  const n = exchange ? name(exchange) : ''
  const detail = 'connection' in state ? { exchange, connectionId: state.connection.id } : { exchange }
  const button = (action: ConnectionStatusAction, text: string, primary = false,
    request = detail, disabled = false) => <button type="button" className={primary ? 'px-cta' : 'pl-link'}
      disabled={disabled || !!attempt.current || !!phase && action !== 'refresh' || typeof p.actions?.[action] !== 'function'}
      onClick={() => run(action, request)}>{text}{action === 'openKyc' && <Out />}</button>
  const title = state.kind === 'authorization_result' ? `${n} 연결` : state.kind === 'invitation_verifying' ? `${n} 연결 확인 중`
    : state.kind === 'not_invited' ? 'TETH 초대 계정이 아닙니다' : state.kind === 'connected_done' ? '연결되었습니다'
      : state.kind === 'strategy_start_after_connection' ? '전략 시작' : state.kind === 'subscription_expired' ? '구독이 끝났습니다'
        : state.kind === 'disconnect_confirmation' ? `${n} 연결을 끊으시겠습니까?` : state.kind === 'kyc_before_start' ? `${n} 본인 확인`
          : state.kind === 'eligible_my_exchange_filter' ? '내 거래소' : '거래소 연결'
  const eligible = 'connections' in state ? state.connections.filter(item => item.eligibility === 'eligible') : []
  const selected = state.kind === 'eligible_my_exchange_filter' && (state.selected === 'all' || state.selected === 'off'
    || eligible.some(item => item.exchange === state.selected)) ? state.selected : 'all'
  return <section ref={root} className={`client-connection-status${state.kind === 'disconnect_confirmation' || state.kind === 'kyc_before_start' ? ' ccs-confirm' : ''}`}
    data-connection-state={state.kind} data-source={p.source} aria-labelledby={titleId} aria-busy={phase === 'pending'}
    onKeyDown={event => { if (event.key === 'Escape') { if (menu === key) setMenu(null); else if (onClose) close() } }}>
    <header className="px-head"><h1 id={titleId}>{title}</h1><button type="button" className="ccs-close" aria-label="닫기" disabled={!onClose} onClick={close}>✕</button></header>
    {state.kind === 'authorization_result' && <>
      <p className="px-lead">{n} 화면이 열리면 아래 두 권한을 허용합니다.</p>
      <div className="px-card"><ul className="px-perm">{[['잔고 조회', '전략에 쓸 잔고를 봅니다'], ['주문', '전략 조건에 맞을 때 주문을 냅니다']].map(([label, text]) => <li key={label}><Check /><span><b>{label}</b>{text}</span></li>)}</ul></div>
      {state.authorization === 'failed' && <p className="px-fail" role="alert">{n}에서 승인을 마치지 못했습니다. 잠시 뒤 다시 시도해 주십시오.</p>}
      {state.authorization === 'cancelled' && <p role="status">승인을 취소했습니다. 연결된 것은 없습니다.</p>}
      {button('authorize', `${n}에서 승인하기`, true, detail, state.authorization === 'pending')}
      {state.invitationRouteAvailable && <p className="px-links">{button('invitationRoute', 'TETH 초대 계정으로 연결')}</p>}
    </>}
    {state.kind === 'invitation_verifying' && <><p className="px-lead">승인한 계정을 확인하고 있습니다.</p><div className="px-card">
      <p className="px-acct"><Logo exchange={state.exchange} /><b>{n}</b>{state.maskedAccountLabel && <span className="num">{state.maskedAccountLabel}</span>}</p>
      <ul className="px-chk">{[['계정 확인', state.accountChecked ? '확인했습니다' : '승인한 계정을 읽는 중'], ['초대 계정 확인', 'TETH 초대로 만든 계정인지']].map(([label, text], index) => <li key={label} className={index === 0 && state.accountChecked ? 'ok' : index === 0 || state.accountChecked ? 'run' : ''}><span className="ic">{index === 0 && state.accountChecked ? <Check /> : <i />}</span><b>{label}</b><span>{text}</span></li>)}</ul>
    </div></>}
    {state.kind === 'not_invited' && <><p className="px-lead">이 {n} 계정은 TETH 초대로 만든 계정이 아닙니다. 아래에서 하나를 고르십시오.</p><div className="px-col">
      {([['newAccount', 'TETH 초대로 새 계정 만들기', '이용료 없이 씁니다'], ['subscribe', '이 계정을 그대로 쓰고 구독하기', '월 $280'], ['chooseExchange', '다른 거래소 고르기', '초대로 만든 계정이 다른 거래소에 있을 때']] as const).map(([action, label, text]) => <button type="button" className="px-ch" key={action} disabled={!!attempt.current || !!phase || typeof p.actions?.[action] !== 'function'} onClick={() => run(action, detail)}><b>{label}</b><span>{text}</span></button>)}</div></>}
    {state.kind === 'connected_done' && <><p className="px-lead">이제 {state.strategyName ? `${state.strategyName} 전략을 ` : '전략을 '}시작하면 {n} 계정에서 실행됩니다.</p><div className="px-card"><Account connection={state.connection} /></div>
      {button('continue', state.continuation === 'copy' ? '전략 복사 이어서 하기' : state.continuation === 'backtest' ? '전략 실행 이어서 하기' : '전략 시작하기', true)}<p className="px-links">{button('addExchange', '거래소 더 연결하기')}</p></>}
    {state.kind === 'strategy_start_after_connection' && <><p className="px-lead">{state.strategyName} 전략을 {n} 계정에서 실행합니다.</p><div className="px-card px-rows"><div className="r"><span>실행 계정</span><b><Logo exchange={state.connection.exchange} />{n} {state.connection.maskedAccountLabel}</b></div><div className="r"><span>사용할 금액</span><b className="num">{state.amountLabel}</b></div><div className="r"><span>TETH 이용료</span><b>{state.feeLabel}</b></div></div>
      {button('startLive', '전략 시작하기', true)}<p className="px-links">{button('startPaper', '가상으로 먼저 시작')}{button('startLater', '나중에 시작')}</p></>}
    {state.kind === 'connected_list' && <><div className="px-card px-list">{state.connections.map(connection => <div key={connection.id}><Account connection={connection} action={button('disconnect', '연결 끊기', false, { exchange: connection.exchange, connectionId: connection.id })} /></div>)}</div>
      {state.connections.length === 0 && <p role="status">연결된 거래소가 없습니다.</p>}{button('terminal', '터미널 열기', true, detail, !eligible.length)}<p className="px-links">{button('addExchange', '거래소 더 연결하기')}</p></>}
    {state.kind === 'subscription_expired' && <><p className="px-lead">연결은 그대로 있습니다. 다시 구독하면 전략이 새 주문을 이어서 냅니다.</p>{button('subscribe', '다시 구독', true)}</>}
    {state.kind === 'disconnect_confirmation' && <><p className="px-lead">이 거래소에서 돌아가는 전략은 새 주문을 내지 않습니다. 열려 있는 포지션은 거래소에 그대로 남습니다.</p>
      <div className="ccs-actions"><button type="button" className="pl-link" disabled={!onClose} onClick={close}>취소</button>{button('disconnect', '연결 끊기', true)}</div></>}
    {state.kind === 'kyc_before_start' && <><p className="px-lead">{state.kyc === 'verified' ? '본인 확인이 끝났습니다. 전략을 시작합니다.' : state.kyc === 'running' ? `${n}에서 본인 확인 상태를 보는 중입니다.` : state.kyc === 'review' ? `${n}에서 본인 확인을 검토하고 있습니다. 끝나면 전략을 시작할 수 있습니다.` : state.kyc === 'error' ? '본인 확인 상태를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주십시오.' : '본인 확인이 끝나면 전략을 시작할 수 있습니다.'}</p>
      {state.kyc === 'running' ? <button type="button" className="px-cta" disabled><i className="ccs-spinner" />확인 중</button> : state.kyc !== 'verified' && <>
        {(state.kyc === 'none' || state.kyc === 'failed') && button('openKyc', `${n}에서 본인 확인하기`, true)}<p className="px-links">{button('refresh', state.kyc === 'error' ? '다시 확인하기' : '확인 상태 다시 보기')}</p></>}
    </>}
    {state.kind === 'eligible_my_exchange_filter' && <div className="ccs-myex">
      <button type="button" className="myex" disabled={!eligible.length || !!phase || eligible.length === 1 && typeof p.actions?.filter !== 'function'} aria-expanded={menu === key} onClick={() => eligible.length === 1 ? run('filter', { selection: selected === 'off' ? eligible[0].exchange : 'off', exchange: eligible[0].exchange }) : setMenu(menu === key ? null : key)}>내 거래소<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
      {menu === key && <div className="myex-m" role="menu" aria-label="내 거래소">{(['all', ...eligible.map(item => item.exchange), 'off'] as const).map(selection => <button type="button" role="menuitemradio" aria-checked={selected === selection} key={selection} disabled={!!phase || typeof p.actions?.filter !== 'function'} onClick={() => run('filter', { selection, ...(selection !== 'all' && selection !== 'off' ? { exchange: selection } : {}) })}>{selection === 'all' ? '연결한 거래소 전체' : selection === 'off' ? '끄기, 전체 전략 보기' : `${name(selection)}만`}</button>)}</div>}
      {!eligible.length && <p role="status">이용 가능한 연결을 확인할 수 없습니다.</p>}
      {state.empty && eligible.length > 0 && <p className="myex-empty">{(selected === 'all' || selected === 'off' ? eligible : eligible.filter(item => item.exchange === selected)).map(item => name(item.exchange)).join(', ')}에서 실행할 수 있는 전략이 아직 없습니다.</p>}
    </div>}
    {phase && <p className="ccs-feedback" role={phase === 'unknown' ? 'alert' : 'status'}>{phase === 'pending' ? '요청을 전달하고 있습니다.' : phase === 'awaiting' ? '최신 연결 상태를 확인하고 있습니다.' : '처리 결과를 확인하지 못했습니다. 연결 상태를 다시 확인해 주세요.'}</p>}
    {phase && state.kind !== 'kyc_before_start' && button('refresh', '연결 상태 다시 확인')}
    {source === 'mock' && <p className="ccs-unavailable">연결 상태 미리보기입니다. 실제 연결·결제·주문을 실행하지 않습니다.</p>}
    {!p.actions && <p className="ccs-unavailable" role="status">연결 상태 동작이 아직 제공되지 않았습니다.</p>}
    {state.kind !== 'eligible_my_exchange_filter' && <p className="px-help"><span>막히면 상담원이 24시간 답합니다.</span>{button('help', '상담원에게 묻기')}</p>}
  </section>
}
