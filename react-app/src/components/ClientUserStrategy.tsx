import { useClientPreferences } from '../client-preferences'
import { useUserStrategyLocaleText, sourceActionLogLocaleText, userStrategyRuleText } from '../client-user-strategy-locale-copy'
import { useStaticUiCopy } from '../client-static-ui-copy'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SOURCE_USER_STRATEGY_PASS_SCORE, type SourceUserStrategyRecord } from '../client-user-strategy'
import { projectSourceUserStrategy, selectSourceUserStrategyActivity, type SourceUserStrategyModel } from '../client-user-strategy-view'
import type { SourceAccountEventState } from '../client-account-event-state'
import { sourceTerminalDate } from '../client-terminal-source-fixture'
import type { SourceTerminalParameters } from '../client-terminal-source-fixture'
import { ClientUserStrategyEdit } from './ClientUserStrategyEdit'
import '../client-account-activity.css'
import '../client-user-strategy.css'
import type { AccountBotPresentation, AccountPresentationActions } from '../client-account-presentation'
import { ClientAccountBotPresentation } from './ClientAccountPresentation'
import { ClientBotStrategyEdit } from './ClientBotStrategyEdit'

// Original NFX_IC SVG paths. Never interpreted caller HTML.
const icons = {
trend: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>),
won: (<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
info: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>),
zap: (<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
chev: (<svg aria-hidden="true" className="nfx-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>),
empty: (<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>),
}
export type ClientUserStrategyControl = 'pause' | 'resume' | 'start' | 'env'
export type ClientUserStrategyProps = {
  presentation?: AccountBotPresentation
  presentationActions?: AccountPresentationActions
  record: SourceUserStrategyRecord | null
  events: SourceAccountEventState | null
  money: (value: number, signed?: boolean) => string
  onNavigate: (route: string) => void
  onControl?: (action: ClientUserStrategyControl) => void | Promise<void>
  onEdit?: () => void | Promise<void>
  onApplyEdit?: (expected: SourceUserStrategyRecord, parameters: SourceTerminalParameters) => void | Promise<void>
  position?: { title: string; description?: string; checks?: readonly string[] } | null
  executionPermissionLabel?: string
}
function Badge({ children }: { children: ReactNode }) { return <span className="nfx-badge sim">{children}</span> }
function Empty({ title, description }: { title: string; description?: string }) { return <div className="nfx-empty"><div className="nfx-eicon">{icons.empty}</div><div className="nfx-etit">{title}</div>{description && <div className="nfx-edesc">{description}</div>}</div> }
function ScoreRing({ score }: { score: number }) {
  const circle = useRef<SVGCircleElement>(null)
  useEffect(() => {
    const element = circle.current
    if (!element) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let timer = 0
    const finish = () => { clearTimeout(timer); if (document.hidden || media.matches) element.style.transition = 'none'; element.style.strokeDashoffset = String(251.3 * (1 - Math.min(100, Math.max(0, score)) / 100)) }
    const onVisibility = () => { if (document.hidden) finish() }
    const onMotion = () => { if (media.matches) finish() }
    if (document.hidden || media.matches) finish()
    else { element.style.transition = ''; element.style.strokeDashoffset = '251.3'; timer = window.setTimeout(finish, 60) }
    document.addEventListener('visibilitychange', onVisibility); media.addEventListener('change', onMotion)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onMotion) }
  }, [score])
  return <div className="nfxb-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="bg" cx="50" cy="50" r="40" /><circle ref={circle} className="fg" cx="50" cy="50" r="40" /></svg><div className="val"><span>{score}</span><span className="mx">/100</span></div></div>
}
function EquityChart({ model }: { model: SourceUserStrategyModel }) {
  const localeUi = useStaticUiCopy()
  const gradientId = 'user-strategy-gradient-' + useId().replace(/:/g, '')
  const eq = model.evaluation?.r.eq
  if (!eq || eq.length < 2) return null
  let min = Infinity, max = -Infinity
  for (const point of eq) { min = Math.min(min, point.v); max = Math.max(max, point.v) }
  if (max - min < 1e-9) max = min + 1e-9
  const path = eq.map((point, i) => (i ? 'L ' : 'M ') + Math.round(i / (eq.length - 1) * 800) + ' ' + Math.round(130 - ((point.v - min) / (max - min)) * 115)).join(' ')
  const record = model.record, color = record.ret >= 0 ? '#4ec08d' : '#e0604b', p = record.parameters
  const days = p?.endI != null && p.startI != null ? p.endI - p.startI : null
  return <section className="nfxb-chart"><div className="nfxb-chd"><h2 className="nfxb-ctit">{localeUi("검증 수익 곡선")}<span className="nfxb-cbadge">{localeUi("검증 시뮬레이션")}</span></h2><div className="nfxb-cstats"><span>{localeUi("기준 자산: ")}<b>{record.name.replace(' 위임 전략', '')}</b></span>{!!days && <span>{localeUi("검증 기간: ")}<b>{localeUi('{days}일', { days })}</b></span>}<span>{localeUi("승률: ")}<b className="user-gain">{Math.round(record.winRate)}%</b></span></div></div><div className="nfxb-spark"><svg role="img" aria-label={localeUi("저장된 검증 설정의 수익 곡선")} viewBox="0 0 800 140" preserveAspectRatio="none"><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".32" /><stop offset="60%" stopColor={color} stopOpacity=".08" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>{[20, 70, 120].map(y => <line key={y} className="nfxb-grid" x1="0" y1={y} x2="800" y2={y} />)}<path className="nfxb-area" fill={'url(#' + gradientId + ')'} d={path + ' L 800 140 L 0 140 Z'} /><path className={'nfxb-line' + (record.ret < 0 ? ' dn' : '')} d={path} /></svg></div></section>
}
function ActionLog({ model }: { model: SourceUserStrategyModel }) {
  const { language } = useClientPreferences(), u = useUserStrategyLocaleText()
  const localeUi = useStaticUiCopy()
  const [filter, setFilter] = useState<'all' | 'fills'>('all'), [limit, setLimit] = useState(14)
  const anchor = useRef<HTMLButtonElement>(null), scrollAnchor = useRef<number | null>(null)
  const L = model.evaluation?.L, parameters = model.record.parameters
  useLayoutEffect(() => {
    if (scrollAnchor.current !== null && anchor.current) {
      const delta = anchor.current.getBoundingClientRect().top - scrollAnchor.current
      // Keep the reader's current control in place as older rows are prepended above it.
      let parent: HTMLElement | null = anchor.current.parentElement
      while (parent && (!/(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY) || parent.scrollHeight <= parent.clientHeight)) parent = parent.parentElement
      if (parent) parent.scrollTop += delta
      else window.scrollBy(0, delta)
      scrollAnchor.current = null
    }
  }, [limit])
  if (!L || !parameters) return null
  const rows = filter === 'fills' ? L.evs.filter(event => event.k === 'entry' || event.k.startsWith('exit')) : L.evs
  const shown = rows.slice(-limit), remaining = Math.max(0, rows.length - shown.length)
  return <section className="nfxb-scard user-log"><div className="nfx-sechead"><h2 className="nfx-sectit">{localeUi("AI 행동 로그")}</h2><span className="nfx-badge">{localeUi("엔진 신호 기준, 시뮬레이션")}</span></div><div className="nfxl-sum"><span>{localeUi.rich('검증 구간 평가 {count}', { count: <b>{L.bars === 1 ? localeUi('1봉') : localeUi('{bars}봉', { bars: L.bars })}</b> })}</span><span>{localeUi("관망 ")}<b>{L.cnt.watch}</b></span><span>{localeUi("진입 ")}<b>{L.cnt.entry}</b></span><span>{localeUi("청산 ")}<b>{L.cnt.exit}</b></span><span className="nfxl-rsi"><span>{localeUi("마지막 봉 RSI ")}<b>{L.last.rsi.toFixed(1)}</b></span><span className="tr"><span className="fl" style={{ width: Math.min(100, Math.max(0, L.last.rsi)) + '%' }} /><span className="pin" style={{ left: parameters.rsiTh + '%' }} title={localeUi("임계 ") + parameters.rsiTh} /></span></span></div><div className="nfxh-fchips" role="group" aria-label={localeUi("AI 행동 로그 분류")}><button className={'nfxh-fchip' + (filter === 'all' ? ' on' : '')} aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setLimit(14) }}>{localeUi("전체")}</button><button className={'nfxh-fchip' + (filter === 'fills' ? ' on' : '')} aria-pressed={filter === 'fills'} onClick={() => { setFilter('fills'); setLimit(14) }}>{localeUi("체결만")}<span className="c2">{L.cnt.entry + L.cnt.exit}</span></button><span className="user-log-count">{localeUi('최근 {shown}개 표시, 이전 {remaining}개', { shown: shown.length, remaining })}</span></div><div className="nfxl-tl">{shown.map(event => { const date = sourceTerminalDate(event.i); return <div className={'nfxl-ev ' + event.k} key={event.i} data-bar={event.i}><time className="tm2" dateTime={date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')}>{date.getFullYear() + '.' + String(date.getMonth() + 1).padStart(2, '0')}</time><span className="node"><span className="dt" /><span className="ln" /></span><div className="card"><span className="tp2">{u(event.tag)}</span>{sourceActionLogLocaleText(language,event.txt)}</div></div> })}</div><button ref={anchor} className="nfx-btn out user-log-more" disabled={!remaining} onClick={() => { scrollAnchor.current = anchor.current?.getBoundingClientRect().top ?? null; setLimit(limit + 14) }}>{localeUi("이전 14개 보기")}</button></section>
}

function StrategyDetail(props: ClientUserStrategyProps & { model: SourceUserStrategyModel }) {
  const { language } = useClientPreferences(), u = useUserStrategyLocaleText()
  const localeUi = useStaticUiCopy()
  const { model, events, money, onNavigate, onControl, onEdit, position, executionPermissionLabel } = props
  const record = model.record, p = record.parameters
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const busy = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const invoke = async (callback?: () => void | Promise<void>) => {
    if (!callback || busy.current) return
    busy.current = true; setPending(true); setError('')
    try { await callback() } catch { if (mounted.current) setError('요청을 완료하지 못했어요. 다시 시도해 주세요.') }
    finally { if (mounted.current) { busy.current = false; setPending(false) } }
  }
  const control = (action: ClientUserStrategyControl, label: string, tone: string, zap = false) => <button className={'nfx-btn ' + tone} disabled={!onControl || pending} onClick={() => void invoke(onControl && (() => onControl(action)))}>{zap && icons.zap}{u(label)}</button>
  const activity = events ? selectSourceUserStrategyActivity(record.id, events) : null
  const assetLabel = record.name
  const date = new Date(record.createdAt)
  return <><nav className="nfx-bc" aria-label={localeUi("현재 위치")}><button className="account-link lk" onClick={() => onNavigate('#/trade')}>{localeUi("AI 트레이딩")}</button><span>/</span><span>{assetLabel}</span></nav>
    <section className="nfxb-hero"><div className="nfxb-toprow"><div className="user-min"><div className="nfxb-tline"><h1 className="nfxb-title">{record.name}</h1><span className={'nfxb-st ' + model.environmentKey}><span className={'nfx-dot' + (record.status === 'live' ? ' pulse' : '')} />{u(model.environmentLabel)}</span><Badge>{localeUi("시뮬레이션")}</Badge></div>{record.origin && <span className="nfxb-origin">{localeUi("원본: ")}<b>{record.origin}</b></span>}</div><div className="nfxb-actions" aria-busy={pending}>{record.status === 'live' ? <>{control('pause', '실행 일시정지', 'dng')}{control('env', record.environment === 'paper' ? '라이브(시뮬레이션)로 전환' : '가상 시뮬레이션으로 전환', 'sec')}</> : record.status === 'off' ? control('resume', '재개', 'pri', true) : control('start', '지금 시작하기', 'pri', true)}{p && <button className="nfx-btn out" disabled={!onEdit || pending} onClick={() => void invoke(onEdit)}>{localeUi("전략 수정")}</button>}</div></div><div className="nfxb-notice">{icons.info}<span>{model.environmentKey === 'paper' ? localeUi("가상 실행은 자산 차감 없이 신호와 체결을 재현해요.") : localeUi("체험 모드예요. 이 화면의 실행과 체결은 시뮬레이션이에요.")}</span></div>{error && <p role="alert" className="user-error">{u(error)}</p>}</section>
    <section className="nfxb-mgrid"><div className="nfxb-mcard score"><div className="nfxb-mhd"><span className="nfxb-mlb">TETH Score</span><span className="nfxb-chipp">{localeUi("검증 {count}회", { count: record.n })}</span></div><div className="nfxb-scorebody"><ScoreRing score={record.score} /><div className="nfxb-smeta"><span className="nfxb-srank">{record.score >= SOURCE_USER_STRATEGY_PASS_SCORE ? localeUi("검증 통과 전략") : localeUi("재검증 필요")}</span>{model.ruleText && <span className="nfxb-sdesc">{p ? userStrategyRuleText(language,p,model.ruleText) : model.ruleText}</span>}</div></div></div><div className="nfxb-mcard"><div className="nfxb-mhd"><span className="nfxb-mlb">{localeUi("검증 수익률")}</span><Badge>{localeUi("시뮬레이션")}</Badge></div><div><div className={'nfxb-bigval ' + (record.ret >= 0 ? 'up' : 'dn')}>{record.ret >= 0 ? '+' : ''}{record.ret.toFixed(1)}%</div><div className="nfxb-subtx">{localeUi("검증 체결 {count}회, 승률 {rate}%", { count: record.n, rate: Math.round(record.winRate) })}</div></div><div className="nfxb-rbar"><i style={{ width: Math.min(100, Math.max(4, Math.round(Math.abs(record.ret) * 4))) + '%', background: record.ret >= 0 ? 'var(--gg)' : 'var(--gr)' }} /></div></div><div className="nfxb-mcard"><div className="nfxb-mhd"><span className="nfxb-mlb">{localeUi("최대 낙폭 (MDD)")}</span><span className="nfxb-chipp">{localeUi("리스크")}</span></div><div><div className="nfxb-bigval">{record.mdd.toFixed(1)}%</div><div className="nfxb-subtx">{localeUi("누적 고점 대비 최대 낙폭")}</div></div><div className="nfxb-rbar"><i style={{ width: Math.min(100, Math.max(4, Math.round(Math.abs(record.mdd) * 4))) + '%', background: 'linear-gradient(90deg,var(--gg),var(--ga))' }} /></div></div></section>
    <EquityChart model={model} />
    <div className="nfxb-grid2"><section className="nfxb-scard"><div className="nfx-sechead"><h2 className="nfx-sectit">{localeUi("주문 내역 ")}<Badge>{localeUi("시뮬레이션")}</Badge></h2>{activity && <span className="nfxb-fee">{icons.won}{localeUi("적립 누계 ")}<b>{money(activity.rebates.reduce((sum, rebate) => sum + rebate.amt, 0), true)}</b></span>}</div>{!activity ? <Empty title={localeUi("주문 기록을 확인할 수 없어요")} /> : activity.fillLog.length ? <div className="nfx-rows">{activity.fillLog.map((fill, i) => { const review = activity.reviews.find(row => row.fid === fill.fid); const content = <><span className="nfx-rl"><span className={'nfx-ric ' + (fill.side === 'b' ? 'gg' : 'gr')}>{icons.trend}</span><span className="nfx-rtx"><span className="nfx-rlb">{fill.side === 'b' ? localeUi("매수") : localeUi("매도")}, {fill.label}</span><span className="nfx-rds">{u({ sl: '손절', tp: '익절', time: '기간 청산' }[fill.kind])}{review ? localeUi(", 복기 리포트 도착") : ''}</span></span></span><span className="nfx-rr"><span className={'nfx-rval ' + (fill.pnl >= 0 ? 'gain' : 'loss')}>{fill.pnl >= 0 ? '+' : ''}{(fill.pnl * 100).toFixed(1)}%</span>{review && icons.chev}</span></>; const className = 'nfx-row nfx-stag s' + Math.min(i + 1, 8) + (review ? ' lk' : ''); return review ? <button className={className} key={fill.fid + ':' + fill.side} onClick={() => onNavigate('#/review/' + review.id)}>{content}</button> : <div className={className} key={fill.fid + ':' + fill.side}>{content}</div> })}</div> : <><Empty title={localeUi("아직 체결이 없어요")} description={u(record.status === 'ready' ? '전략을 시작하면 검증 시뮬레이션 체결이 여기에 쌓여요.' : '신호가 발생해 체결이 확정되면 여기에 표시돼요.')} />{record.status === 'ready' && control('start', '지금 시작하기', 'pri')}</>}</section>
      <div className="user-side"><section className="nfxb-scard"><div className="nfx-sechead"><h2 className="nfx-sectit">{localeUi("현재 포지션 ")}<Badge>{localeUi("시뮬레이션")}</Badge></h2>{position === null && <span className="nfxb-pill-amber"><span className={'nfx-dot' + (record.status === 'live' ? ' pulse' : '')} />{record.status === 'live' ? record.environment === 'paper' ? localeUi("가상 신호 탐색 중") : localeUi("신호 탐색 중") : localeUi("실행 대기")}</span>}</div><div className="nfxb-posbox"><div><div className="nfxb-postit">{position === undefined ? localeUi("포지션 상태를 확인할 수 없어요") : position === null ? localeUi("현재 열린 포지션이 없어요") : position.title}</div>{position === null ? <div className="nfxb-posdesc">{localeUi("진입 신호가 발생하면 여기에 표시돼요. (시뮬레이션)")}</div> : position?.description && <div className="nfxb-posdesc">{position.description}</div>}</div>{position?.checks?.map((check, i) => <div className="nfxb-check" key={i}><span className="d" /><span>{check}</span></div>)}</div></section><section className="nfxb-scard"><div className="nfx-sechead"><h2 className="nfx-sectit">{localeUi("전략 실행 환경")}</h2><span className="nfxb-chipp">{localeUi("설정 요약")}</span></div><div className="nfxb-specs">{[[u(record.origin === 'research' ? '검증 기준 거래소' : '연결 거래소'), record.exchangeName ?? u('미연결')], [u('실행 환경'), u(model.environmentLabel)], [u('실행 권한'), executionPermissionLabel ?? u('확인되지 않음')], [u('등록일'), date.toLocaleDateString(language)]].map(([label, value]) => <div className="nfxb-spec" key={label}><span className="k">{label}</span><span className="v">{value}</span></div>)}</div></section></div></div>
    {model.evaluation && <ActionLog model={model} />}
  </>
}
export function ClientUserStrategy(props: ClientUserStrategyProps) {
  const localeUi = useStaticUiCopy()
  const model = useMemo(() => projectSourceUserStrategy(props.record), [props.record])
  const [editing, setEditing] = useState<SourceUserStrategyRecord | null>(null)
  if (props.presentation) return <ServiceStrategyDetail key={props.presentation.id} view={props.presentation} {...props.presentationActions} onNavigate={props.onNavigate} />
  // A removed/replaced strategy must not resurrect its abandoned editor on return.
  if (editing && (!model || editing.id !== model.record.id)) setEditing(null)
  // Record replacement disposes pending presentation work and resets only that record's local log filter.
  return <div className="client-account-activity client-user-strategy"><div className="nfx-page"><div className="nfx-glow" />{model ? <StrategyDetail key={JSON.stringify(model.record)} {...props} model={model} onEdit={props.onEdit ?? (props.onApplyEdit && (() => setEditing(model.record)))} /> : <><Empty title={localeUi("전략을 찾을 수 없어요")} /><button className="nfx-btn out" onClick={() => props.onNavigate('#/trade')}>{localeUi("AI 트레이딩")}</button></>}</div>
    {editing && model && editing.id === model.record.id && props.onApplyEdit && <ClientUserStrategyEdit record={editing} current={model.record} onApply={props.onApplyEdit} onClose={() => setEditing(null)} />}
  </div>
}

function ServiceStrategyDetail({ view, ...actions }: AccountPresentationActions & { view: AccountBotPresentation }) {
  const edit = view.edit?.strategyId === view.id ? view.edit : undefined
  const hasEditAction = !!edit && actions.isActionAvailable?.(edit.actionId) !== false && view.actions.some(action => action.id === edit.actionId && !action.route)
  const identity = edit && hasEditAction ? JSON.stringify([view.id, edit.revision, edit.initial.stopLossPercent, edit.initial.takeProfitPercent, edit.initial.rsiThreshold, edit.initial.trendFilter, !!edit.onValidate, !!edit.onApply]) : null
  const [opened, setOpened] = useState<string | null>(null)
  const [editTrigger, setEditTrigger] = useState<HTMLElement | null>(null)
  // Owner is scoped by NativeAccountPlan. Replaced strategy observations retire
  // drafts and in-flight presentation work; a locale change does not.
  if (opened !== null && opened !== identity) setOpened(null)
  const onAction = hasEditAction ? (actionId: string) => {
    if (actionId === edit.actionId) { setEditTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null); setOpened(identity); return }
    return actions.onAction?.(actionId)
  } : actions.onAction
  // Do not enable unrelated action IDs merely because the local edit form exists.
  const isActionAvailable = (actionId: string) => hasEditAction && actionId === edit.actionId || !!actions.onAction && actions.isActionAvailable?.(actionId) !== false
  return <><ClientAccountBotPresentation view={view} {...actions} onAction={onAction} isActionAvailable={isActionAvailable} />
    {opened !== null && opened === identity && edit && <ClientBotStrategyEdit key={opened} title={view.title} presentation={edit} returnFocus={editTrigger} onClose={() => setOpened(null)} />}
  </>
}
