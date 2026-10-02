import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowLeft, Sparkles, TriangleAlert } from 'lucide-react'
import { copyDetailTabs, copyProfileTabs, copyTraderLocation, sharedAnalysisRequest, type SharedLocation, type SharedStrategy } from '../client-shared-strategies'
import { copyTraderPeriods, projectCopyTraderProfile, type CopyTraderPeriod } from '../client-copy-trader-profile'
import { adjustCopyPreview, calculateCopyPreview, closeCopyPreview, copyPreviewConfig, copyPreviewDashboard, copyPreviewPairs, flattenCopyPreview, startCopyPreview, topUpCopyPreview, type CopyPreviewCalculation, type CopyPreviewCopy } from '../client-copy-preview-state'
import { copyRecoveryText } from '../client-copy-recovery-copy'
import type { CopyPreviewAccount } from '../use-copy-preview-account'
import { useClientPreferences } from '../client-preferences'
import { sharedNumber } from '../client-shared-number-format'
import { sourceTerminalDate, sourceTerminalPrices } from '../client-terminal-source-fixture'
import { ClientCopyDetailHistory } from './ClientCopyDetailHistory'
import { copyHistoryText } from '../client-copy-history-copy'
import { copySetupSourceText, copySetupText, type CopySetupKey } from '../client-copy-setup-copy'
import { copyProfileAsset, copyProfileSourceText, copyProfileText, type CopyProfileKey } from '../client-copy-profile-copy'
import { copyActionError, copyActionText, copySummaryText, copyTradingLabel, type CopyActionKey, type CopySummaryKey } from '../client-copy-trading-copy'
import { sharingActionFailed, sharingUnavailable, unavailableTraderProfile, type SharingServicePresentation } from '../client-sharing-presentation'
import type { CopyServiceAccount, CopyServiceMetrics } from '../client-copy-service-data'
import { ClientServiceCopyHistory, ClientServicePositions, ClientServiceProfilePanel } from './ClientCopyServiceData'
import '../client-copy-trading.css'

type DialogType = ComponentType<{ title: string; children: ReactNode; onClose: () => void; trigger?: HTMLElement; focusKey?: string }>
type Navigation = (next: SharedLocation, replace?: boolean) => void
type Action = { kind: 'adjust' | 'close' | 'flat' | 'settings'; id: string; trigger?: HTMLElement }
const detailLocation = (id: string): SharedLocation => ({ view: 'copy-detail', copyId: id, copyTab: 'pos', period: 'all' })
const tone = (value: number) => value >= 0 ? 'u' : 'd'
const decimal = (value: string) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? Number(value) : NaN
function CopyFoot() {
  const { language } = useClientPreferences()
  return <p className="cpp-foot">{copySummaryText(language, '전 자산 USDT 표기, 시뮬레이션 데이터 기준')}</p>
}
function CopyStartedAt({ value }: { value: number | null | undefined }) {
  const { language } = useClientPreferences()
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return <time dateTime={date.toISOString()}>{copySummaryText(language, '{date} 시작', { date: date.toLocaleString(language, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</time>
}
const foot = <CopyFoot />
function useCopyText() {
  const { language } = useClientPreferences()
  return (key: CopySummaryKey, values?: Record<string, string | number>) => copySummaryText(language, key, values)
}
function useCopyActionText() {
  const { language } = useClientPreferences()
  return (key: CopyActionKey, values?: Record<string, string | number>) => copyActionText(language, key, values)
}
function useNumbers(asset = 'USDT') {
  const { language } = useClientPreferences()
  const n = (value: number, digits: 0 | 1 | 2 = 2) => Number.isFinite(value) ? sharedNumber(value, language, digits) : '—'
  return { n, usd: (value: number | null, digits: 0 | 1 | 2 = 2) => value == null || !Number.isFinite(value) ? '—' : `${value.toLocaleString(language, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${asset}`, pct: (value: number, digits: 0 | 1 | 2 = 2) => !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${n(value, digits)}%`,
    date: (at: number | null) => at == null || !Number.isFinite(new Date(at).getTime()) ? '—' : new Date(at).toLocaleDateString(language) }
}
function Note({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <div className={`cpp-ai${warning ? ' warn' : ''}`}>{warning ? <TriangleAlert size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}<span>{children}</span></div>
}
function Empty({ title, children, hint, action }: { title: string; children?: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return <div className="cpp-empty"><b>{title}</b>{children}{hint && <span className="nx">{hint}</span>}{action && <div className="cpp-empty-action">{action}</div>}</div>
}
function Kpi({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return <div className="cpp-kpi"><small>{label}</small><b className={`num ${className}`}>{value}</b></div>
}
function Metrics({ values, dashboard = false, closed = false, asset = 'USDT' }: { values: CopyServiceMetrics | null; dashboard?: boolean; closed?: boolean; asset?: string }) {
  const { usd } = useNumbers(asset)
  const text = useCopyText()
  return <div className="cpd-sum">{([
    ['est', dashboard ? '카피 자산 평가' : '평가 금액'], ['avail', dashboard ? '가용 잔고' : '가용'], ['net', '순손익 (분배 차감 후)'],
    ['unreal', closed ? '정산 시점 미실현' : '미실현 손익'], ['realized', '실현 손익'], ['share', '수익 분배 지급'],
  ] as const).map(([key, label]) => <Kpi key={key} label={text(label)} value={values ? usd(values[key]) : '—'} className={values && values[key] != null && key !== 'est' && key !== 'avail' ? tone(values[key]) : ''} />)}</div>
}
function ProfileCurve({ eq, indexToDate = sourceTerminalDate }: { eq: SharedStrategy['result']['eq']; indexToDate?: (index: number) => Date }) {
  const id = useId(), { pct } = useNumbers()
  const { language } = useClientPreferences()
  if (eq.length < 2) return <Empty title={copyProfileText(language, '검증 곡선이 없어요')} />
  const first = eq[0], last = eq[eq.length - 1], min = Math.min(...eq.map(p => p.v)), max = Math.max(...eq.map(p => p.v))
  const y = (v: number) => 200 - (v - min) / Math.max(max - min, 1e-9) * 194
  const step = Math.max(1, Math.floor(eq.length / 120))
  const points = eq.filter((_, i) => i % step === 0 || i === eq.length - 1).map(p => `${(p.i - first.i) / Math.max(1, last.i - first.i) * 528},${y(p.v)}`).join(' ')
  const color = last.v >= 1 ? '#2fb98a' : '#ee766a'
  const date = (i: number) => { const d = indexToDate(i); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}` }
  return <div className="cpp-curve"><svg className="ss3-eq" viewBox="0 0 528 220" role="img" aria-label={copyProfileText(language, '검증 구간 누적 수익 곡선')} data-point-count={eq.length}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".15" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <line className="base" x1="0" x2="528" y1={y(Math.min(Math.max(1, min), max))} y2={y(Math.min(Math.max(1, min), max))} />
    <path d={`M${points.split(' ').join(' L')} L528,202 L0,202 Z`} fill={`url(#${id})`} /><polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />
    <text x="522" y="14" textAnchor="end" fill={color}>{pct((max - 1) * 100, 1)}</text><text x="2" y="216">{date(first.i)}</text><text x="526" y="216" textAnchor="end">{date(last.i)}</text>
  </svg></div>
}

function TraderProfile({ source, location, navigate, onStart, watching, onWatch, onAsk, asking, service }: {
  source: SharedStrategy; location: SharedLocation; navigate: Navigation; onStart: () => void; watching: boolean; onWatch: () => void; onAsk: () => void; asking: boolean; service?: SharingServicePresentation
}) {
  const [period, setPeriod] = useState<CopyTraderPeriod>(30)
  const { language } = useClientPreferences()
  const text = (key: CopyProfileKey, values?: Record<string, string | number>) => copyProfileText(language, key, values)
  const projection = useMemo(() => service ? service.profile?.(source, period) ?? unavailableTraderProfile(source.nick, period, sharingUnavailable(language)) : projectCopyTraderProfile(source, period), [source, period, service, language])
  const { meta: m, performance: p, trustNote, mddNote, weeklyBars, allocation } = projection
  const { n, usd, pct } = useNumbers(service ? service.profileData?.(source.nick)?.asset ?? '' : 'USDT'), tab = location.profileTab ?? 'ov'
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => { title.current?.focus({ preventScroll: true }) }, [source.nick])
  const start = <button type="button" className="wbtn" onClick={onStart}>{text('카피 시작하기')}</button>
  return <section className="cpp" aria-label={copyTradingLabel(language, '트레이더 프로필')}>
    <button className="ss3-back" type="button" onClick={() => navigate({ period: 'all' })}><ArrowLeft size={16} />{text('전략들')}</button>
    <div className="cpp-head"><div className="cpp-ava" aria-hidden="true">{Array.from(source.nick)[0]}</div><div className="cpp-idm">
      <h2 className="cpp-nick" ref={title} tabIndex={-1}>{source.nick}</h2><div className="cpp-meta"><span>{Number.isFinite(m.days) ? text('트레이딩 {days}일차', { days: m.days }) : '—'}</span><span title={language === 'ko' ? 'Profit share ratio' : text('수익 분배')}>{Number.isFinite(m.share) ? text('수익 분배 {percent}%', { percent: (m.share * 100).toLocaleString(language, { maximumFractionDigits: 6 }) }) : '—'}</span><span>{text('{asset} 주력', { asset: copyProfileAsset(language, source.asset) })}</span><span>{Number.isFinite(m.lastTradeMin) ? text('마지막 거래 {time}', { time: m.lastTradeMin < 60 ? text('{count}분 전', { count: m.lastTradeMin }) : text('{count}시간 전', { count: Math.round(m.lastTradeMin / 60) }) }) : '—'}</span></div><p className="cpp-bio">{copyProfileSourceText(language, m.bio)}</p>
    </div><div className="cpp-acts"><button type="button" className="wbtn" onClick={onStart}>{copyTradingLabel(language, '카피하기')}</button><button type="button" className="obtn" disabled={Boolean(service) && !service?.onWatch} aria-pressed={watching} onClick={onWatch}>{text(watching ? '알림 끄기' : '알림받기')}</button></div></div>
    <div className="cpp-tabs" role="group" aria-label={text('트레이더 정보')}>{Object.entries(copyProfileTabs).map(([key, label]) => <button type="button" className={`fp${tab === key ? ' on' : ''}`} aria-pressed={tab === key} key={key} onClick={() => navigate({ ...copyTraderLocation(source.nick), profileTab: key as keyof typeof copyProfileTabs }, true)}>{text(label)}</button>)}</div>
    {tab === 'ov' ? <>
      <div className="cpp-pd" role="group" aria-label={text('기간 선택')}>{copyTraderPeriods.map(days => <button type="button" className={days === period ? 'on' : ''} aria-pressed={days === period} key={days} onClick={() => setPeriod(days)}>{text('{days}일', { days })}</button>)}</div>
      <div className="cpp-grid"><Kpi label={text('기간 수익률')} value={pct(p.roi)} className={tone(p.roi)} /><Kpi label={text('기간 손익')} value={usd(p.pnl)} className={tone(p.pnl)} /><Kpi label={text('카피어 누적 수익')} value={usd(p.copiersPnl)} className={tone(p.copiersPnl)} /><Kpi label={text('승률')} value={Number.isFinite(p.winRate) ? `${n(p.winRate, 1)}%` : '—'} /><Kpi label={text('최대 낙폭')} value={Number.isFinite(p.mdd) ? `${n(p.mdd)}%` : '—'} className="d" /><Kpi label={text('카피하는 사람')} value={`${n(m.copiers, 0)} / ${n(m.cap, 0)}`} /><Kpi label={text('운용 자산')} value={usd(m.aum, 0)} /><Kpi label={text('트레이더 총자산')} value={usd(m.total, 0)} /></div>
      <Note warning={Boolean(trustNote.w)}>{copyProfileSourceText(language, trustNote.t)}</Note><div className="cpp-kpi"><small>{text('수익 / 손실 거래')}</small>{Number.isFinite(p.n) && <div className="cpp-plbar" aria-hidden="true"><i className="w" style={{ width: `${p.n ? Math.round(p.wins / p.n * 100) : 0}%` }} /><i className="l" style={{ flex: 1 }} /></div>}<span className="cpp-static">{Number.isFinite(p.n) ? text('수익 {wins}회, 손실 {losses}회 (기간 내 {total}회 청산)', { wins: p.wins, losses: p.losses, total: p.n }) : sharingUnavailable(language)}</span></div><Note warning={Boolean(mddNote.w)}>{copyProfileSourceText(language, mddNote.t)}</Note>
      <h3 className="cpp-sec">{text('수익률 곡선')}<small>{text('선택한 기간 기준, 아래 지표와 같은 데이터예요')}</small></h3><ProfileCurve eq={p.eq} indexToDate={service?.indexToDate} />
      <h3 className="cpp-sec">{text('주간 순익')}<small>{text('최근 13주, 청산 완결 기준')}</small></h3>{weeklyBars.available ? <div className="cpp-wk" role="img" aria-label={text('주간 순익 {count}주', { count: weeklyBars.bars.length })}>{weeklyBars.bars.map((bar, i) => <i key={i} className={bar.positive ? 'u' : 'd'} style={{ height: bar.heightPx }} title={text('{week}주: {amount}', { week: i + 1, amount: usd(bar.value) })} />)}</div> : <Empty title={service ? sharingUnavailable(language) : text('주간 데이터가 아직 부족해요')}>{!service && text('청산이 쌓이면 주 단위 순익이 여기에 표시돼요.')}</Empty>}
      <h3 className="cpp-sec">{text('자산 비중')}<small>{text('어떤 자산을 주로 거래하는지')}</small></h3><div className="cpp-dn"><svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label={text('자산 비중')}>{allocation.map(item => <circle key={item.label} cx="55" cy="55" r="40" fill="none" stroke={item.color} strokeWidth="14" strokeDasharray={item.dashArray} strokeDashoffset={item.dashOffset} transform="rotate(-90 55 55)" />)}</svg><div className="lg">{allocation.map(item => <span key={item.label}><i style={{ background: item.color }} />{copyProfileAsset(language, item.label)} <b>{item.percent}%</b></span>)}</div></div>
    </> : service ? <ClientServiceProfilePanel key={source.nick} tab={tab} data={service.profileData?.(source.nick)} onOpenStrategy={() => navigate({ nick: source.nick, period: 'all' })} /> : tab === 'pos' ? <Empty title={text('지금은 표시할 오픈 포지션이 없어요')} hint={text('카피 시작 전에는 오픈 포지션이 1시간 지연 공개돼요. 카피를 시작하면 실시간으로 따라갑니다.')} action={start}>{text('트레이더가 새로 진입하면 여기에 나타나고, 카피 중이라면 자동으로 함께 진입해요.')}</Empty>
      : tab === 'cal' ? <Empty title={text('내 카피 손익 캘린더는 첫 청산 후에 채워져요')} hint={text('이 트레이더의 검증 구간 일별 손익은 전략 상세 캘린더에서 지금도 볼 수 있어요.')} action={<button type="button" className="obtn" onClick={() => navigate({ nick: source.nick, period: 'all' })}>{text('전략 상세에서 캘린더 보기')}</button>}>{text('카피를 시작하고 첫 거래가 청산되면 일별 손익이 달력으로 쌓여요.')}</Empty>
        : tab === 'bal' ? <Empty title={text('아직 자금 이동 내역이 없어요')} hint={text('손실 후 입금이 반복되면 수익률이 실제보다 부풀려 보일 수 있어요. 그 패턴이 감지되면 TETH가 먼저 알려드립니다.')}>{text('트레이더가 카피 계좌에 돈을 넣거나 빼면 시각과 금액이 여기에 기록돼요 (최근 180일).')}</Empty>
          : <Empty title={text('카피하는 사람들 랭킹을 준비하고 있어요')} hint={text('카피를 시작하면 내 순위도 이 목록에서 확인할 수 있어요.')}>{text('지금 {count}명이 이 트레이더를 카피하고 있어요. 투자금과 수익 기준 랭킹이 곧 여기에 표시돼요.', { count: m.copiers })}</Empty>}
    <div className="cpp-chips"><span>{text('이어서 물어보기')}</span><button type="button" className="obtn" onClick={onAsk} disabled={asking || (Boolean(service) && !service?.onAnalyze)} aria-busy={asking}>{text('이 트레이더의 위험 신호 분석시키기')}</button>{start}</div>{!service && foot}
  </section>
}

function Amount({ label, value, onChange, maximum, error, description, minimum = false, asset = 'USDT', disabled = false }: { label: string; value: string; onChange: (value: string) => void; maximum: number; error?: string; description?: ReactNode; minimum?: boolean; asset?: string; disabled?: boolean }) {
  const id = useId(), text = useCopyActionText()
  return <div className={`cps-fld${error ? ' bad' : ''}`}><label htmlFor={id}>{label}</label><div className="cps-in"><input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder={text(minimum ? '최소 50' : '금액')} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={`${id}-help`} /><span className="un">{asset}</span><button type="button" className="mx" disabled={disabled || !Number.isFinite(maximum)} onClick={() => onChange(String(Math.floor(maximum * 100) / 100))}>{text('최대')}</button></div><div id={`${id}-help`}>{description}{error && <p className="cps-err" role="alert">{error}</p>}</div></div>
}
function CopyDialogRecovery({ account }: { account: CopyPreviewAccount }) {
  const { language } = useClientPreferences()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current?.closest('dialog'), active = document.activeElement
    if (dialog && (active === document.body || (active instanceof HTMLElement && dialog.contains(active) && active.matches(':disabled')))) {
      dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    }
  }, [account.storageError])
  if (!account.storageError) return account.actionError ? <p role="alert">{copyActionError(language, account.actionError)}</p> : null
  return <div ref={ref} className="cpa-recovery" role="alert">
    <p>{copyRecoveryText(language, account.storageError)}</p>
    <button type="button" className="obtn" onClick={event => {
      // The retry control disappears after a successful read. Keep focus on
      // the same dialog heading, and never repeat the financial mutation.
      event.currentTarget.closest('dialog')?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      account.retry()
    }}>{copyRecoveryText(language, '저장 상태 다시 확인')}</button>
  </div>
}
function CopySetup({ source, account, navigate, Dialog, onStartGate, onFollow, service }: { source: SharedStrategy; account: CopyPreviewAccount; navigate: Navigation; Dialog: DialogType; onStartGate: () => boolean; onFollow: () => void; service?: SharingServicePresentation }) {
  const { language } = useClientPreferences()
  const text = (key: CopySetupKey, values?: Record<string, string | number>) => copySetupText(language, key, values)
  const [mode, setMode] = useState<'ratio' | 'margin'>('ratio'), [amount, setAmount] = useState('')
  const available = service ? service.setup?.pairs ?? [] : copyPreviewPairs(source), [pairs, setPairs] = useState(available.length ? [available[0]] : [])
  const [modal, setModal] = useState<'pairs' | 'topup' | null>(null), [selection, setSelection] = useState(pairs)
  const { usd, pct } = useNumbers(service ? service.setup?.asset ?? '' : 'USDT'), { meta: m, performance: p, trustNote } = useMemo(() => service ? service.profile?.(source, 180) ?? unavailableTraderProfile(source.nick, 180, sharingUnavailable(language)) : projectCopyTraderProfile(source, 180), [source, service, language])
  const state = account.state, numeric = decimal(amount), spot = service ? service.setup?.availableBalance ?? NaN : account.blocked ? NaN : state?.spot ?? NaN
  const error = !amount ? '' : !Number.isFinite(numeric) || numeric < (service ? service.setup?.minimumAmount ?? Infinity : copyPreviewConfig.MIN_COPY_USDT) ? '최소 50 USDT부터 시작할 수 있어요' : numeric > spot ? '스팟 잔고보다 커요. 충전(+)하거나 금액을 줄여주세요' : ''
  const [submitting, setSubmitting] = useState(false), [serviceFailed, setServiceFailed] = useState(false)
  const serviceError = serviceFailed ? sharingActionFailed(language) : ''
  const request = useRef({ alive: false, busy: false, version: 0 })
  useEffect(() => { const value = request.current; value.alive = true; return () => { value.alive = false; value.version++ } }, [])
  const start = async () => {
    if (service) {
      if (!service.setup?.onStart || request.current.busy || !Number.isFinite(spot) || !amount || error || !pairs.length || !pairs.every(pair => available.includes(pair)) || !onStartGate()) return
      request.current.busy = true; setSubmitting(true); setServiceFailed(false)
      const version = request.current.version
      try {
        await service.setup.onStart({ nick: source.nick, amount: numeric, pairs: [...pairs], mode: 'ratio' })
        if (request.current.alive && request.current.version === version) onFollow()
      } catch {
        if (request.current.alive && request.current.version === version) setServiceFailed(true)
      } finally {
        if (request.current.alive && request.current.version === version) { request.current.busy = false; setSubmitting(false) }
      }
      return
    }
    if (!state || account.blocked || !onStartGate()) return
    if (state.copies.some(c => c.nick === source.nick && c.status === 'active')) { onFollow(); return }
    if (account.commit(current => startCopyPreview(current, { owner: current.owner, id: `cp-${crypto.randomUUID()}`, at: Date.now(), amount: numeric, pairs, mode: 'ratio' }, source))) onFollow()
  }
  return <section className="cpp" aria-label={copyTradingLabel(language, '카피 설정')}><button type="button" className="ss3-back" onClick={() => navigate(copyTraderLocation(source.nick))}><ArrowLeft size={16} />{copyTradingLabel(language, '트레이더 프로필')}</button>
    <div className="cps-wrap"><div className="cps-form"><div className="cps-modes" role="group" aria-label={text('카피 방식')}>{(['ratio', 'margin'] as const).map(value => <button type="button" key={value} className={mode === value ? 'on' : ''} aria-pressed={mode === value} onClick={() => setMode(value)}>{text(value === 'ratio' ? '비율 따라가기' : '고정 마진')}</button>)}</div>
      <p className="cps-modenote">{text(mode === 'ratio' ? '비율 따라가기: 트레이더가 자기 자산의 몇 %를 쓰면, 내 카피 금액에서도 같은 비율만큼 따라 들어가요.' : '고정 마진: 트레이더의 비중과 무관하게 주문마다 정해둔 금액만큼만 따라가요.')}</p>
      {mode === 'margin' ? <Empty title={text('고정 마진 모드는 준비 중이에요')} action={<button type="button" className="obtn" onClick={() => setMode('ratio')}>{text('비율 따라가기로 설정하기')}</button>}>{text('지금은 비율 따라가기로 시작할 수 있어요. 고정 마진이 열리면 알림으로 알려드릴게요.')}</Empty> : <>
        <Amount minimum={!service} label={text('카피 금액')} value={amount} onChange={setAmount} maximum={spot} error={service && (!service.setup || !Number.isFinite(service.setup.minimumAmount)) ? sharingUnavailable(language) : error ? service && error === '최소 50 USDT부터 시작할 수 있어요' ? `${text('카피 금액')} ≥ ${usd(service.setup!.minimumAmount)}` : text(error) : ''} description={<div className="cps-bal">{text('스팟 잔고')} <b>{usd(spot)}</b><button type="button" className="plus" aria-label={text('스팟 충전')} disabled={Boolean(service) || account.blocked} onClick={() => { if (!service) setModal('topup') }}>+</button>{!service && <span>{text('충전은 스팟 계좌에서 카피 계좌로 옮겨져요')}</span>}</div>} />
        <div className="cps-row"><span>{text('따라갈 페어')}</span><b>{pairs[0] ?? '—'}{pairs.length > 1 ? text(' 외 {count}개', { count: pairs.length - 1 }) : ''}</b><button type="button" className="obtn" onClick={() => { setSelection(pairs); setModal('pairs') }}>{text('변경')}</button></div>
        <details className="cps-adv"><summary><span>{text('고급 설정')}</span><span className="sm">{text('트레이더 설정 그대로 따름')}</span></summary>{([
          ['마진 모드', text('교차, 트레이더 설정을 따라요')], ['레버리지', text('트레이더 레버리지 따름')], ['체결가 차이 허용', text('시스템 기본')], ['주문당 마진 상한', '95%'], ['최대 포지션 금액', Number.isFinite(numeric) && numeric > 0 ? text('{amount}까지, 자동', { amount: usd(numeric * 5, 0) }) : text('카피 금액의 5배까지, 자동')],
        ] as const).map(([key, value]) => <div className="cps-row" key={key}><span>{text(key)}</span><span className="cps-static">{service ? service.setup?.advanced?.[({ '마진 모드': 'margin', '레버리지': 'leverage', '체결가 차이 허용': 'slippage', '주문당 마진 상한': 'orderLimit', '최대 포지션 금액': 'positionLimit' } as const)[key]] ?? '—' : value}</span></div>)}</details>
        <button type="button" className="cps-cta" disabled={service ? !service.setup?.onStart || !Number.isFinite(spot) || !amount || Boolean(error) || !pairs.length || submitting : account.blocked || !amount || Boolean(error)} aria-busy={submitting} onClick={() => { void start() }}>{text('카피 시작')}</button>{serviceError && <p role="alert">{serviceError}</p>}{account.actionError && <p role="alert">{copyActionError(language, account.actionError)}</p>}<p className="cpa-note">{service ? service.setup?.disclosure : text('시작 후에도 언제든 중지할 수 있어요. 수익이 나면 10%를 트레이더와 나눠요.')}</p>
      </>}
    </div><aside className="cps-side" aria-label={text('트레이더 요약')}><div className="nk"><div className="cpp-ava" aria-hidden="true">{Array.from(source.nick)[0]}</div><b>{source.nick}</b></div><p className="bio">{copySetupSourceText(language, m.bio)}</p>{([
      ['트레이딩 기간', Number.isFinite(m.days) ? text('{days}일', { days: m.days.toLocaleString(language) }) : '—'], ['수익 분배', service ? service.setup?.sharePercent == null ? '—' : `${service.setup.sharePercent}%` : '10%'], ['180일 수익률', pct(p.roi)], ['180일 손익', usd(p.pnl)], ['카피어 누적 수익', usd(p.copiersPnl)], ['운용 자산', usd(m.aum, 0)],
    ] as const).map(([key, value]) => <div className="cps-row" key={key}><span>{text(key)}</span><b>{value}</b></div>)}<Note warning={Boolean(trustNote.w)}>{copySetupSourceText(language, trustNote.t)}</Note></aside></div>{!service && foot}
    {modal === 'pairs' && <Dialog title={text('따라갈 페어 선택')} onClose={() => setModal(null)}><p>{text('트레이더가 이 페어에서 거래할 때만 따라가요.')}</p><div className="cps-pair-options">{available.map((pair, i) => <label key={pair}><input type="checkbox" checked={selection.includes(pair)} onChange={e => setSelection(previous => e.target.checked ? [...previous, pair] : previous.filter(p => p !== pair))} /><span>{pair}</span>{i === 0 && <small>{text('주력')}</small>}</label>)}</div>{selection.length === 0 && <p role="status">{text('최소 1개 페어는 선택해야 해요')}</p>}<div className="ss3-dacts"><button type="button" className="obtn" onClick={() => setModal(null)}>{text('취소')}</button><button type="button" className="wbtn" disabled={!selection.length} onClick={() => { setPairs(selection); setModal(null) }}>{text('적용')}</button></div></Dialog>}
    {!service && modal === 'topup' && <Dialog title={text('스팟 충전')} onClose={() => setModal(null)}><p>{text('체험용 스팟 잔고를 충전해요.')}<br />{text('실서비스에서는 거래소 입금 플로우가 연결됩니다.')}</p><CopyDialogRecovery account={account} /><div className="ss3-dacts"><button type="button" className="obtn" onClick={() => setModal(null)}>{text('취소')}</button><button type="button" className="wbtn" disabled={account.blocked} onClick={() => { if (account.commit(current => topUpCopyPreview(current, current.owner))) setModal(null) }}>{text('+1,000 USDT 충전')}</button></div></Dialog>}
  </section>
}

function CopyPositions({ copy, d, source, onFlat }: { copy: CopyPreviewCopy; d: CopyPreviewCalculation; source: SharedStrategy | null; onFlat: () => void }) {
  const { usd, n, pct } = useNumbers()
  const text = useCopyText(), { language } = useClientPreferences()
  if (!d.posOpen || copy.status !== 'active') return <Empty title={text('지금 열려 있는 카피 포지션이 없어요')} hint={text(copy.status === 'active' ? '포지션이 없는 동안에도 카피는 유지돼요.' : '종료된 카피예요. 기록 탭에서 이력을 볼 수 있어요.')}>{copy.status === 'active' && text('트레이더가 진입하면 자동으로 함께 진입하고, 여기에 실시간으로 표시돼요.')}</Empty>
  if (!source) return <Empty title={text('카피 원본 데이터를 확인할 수 없어요')} />
  const price = sourceTerminalPrices.at(-1)!, entry = price / (1 + d.unreal / Math.max(1, copy.amount)), size = copy.amount * .4
  const headers = [copyHistoryText(language, 'pair'), copyHistoryText(language, 'direction'), ...(['규모', '평균 진입가', '현재가', '청산 위험', '손절 / 목표', '미실현 손익'] as const).map(key => text(key))]
  return <><p className="cpx-sumline">{text('포지션 1건이 열려 있어요. 미실현 손익 ')}<b className={tone(d.unreal)}>{usd(d.unreal)}</b>{text('. 트레이더의 손절 규칙까지 그대로 따라가요.')}</p><div className="cpx-tblw" role="region" aria-label={text('카피 포지션')} tabIndex={0}><table className="cpx-tbl"><caption className="sr-only">{text('카피 포지션')}</caption><thead><tr>{headers.map((label, index) => <th scope="col" key={index}>{label}</th>)}</tr></thead><tbody><tr><td>{copy.pairs[0]}</td><td className="u">{copyHistoryText(language, 'long')}</td><td>{usd(size, 0)}</td><td>{Number.isFinite(entry) && entry > 0 ? n(entry, 0) : '—'}</td><td>{n(price, 0)}</td><td>{text('낮음')}</td><td>{source.parameters.sl.toLocaleString(language, { maximumFractionDigits: 20 })}% / {source.parameters.tp === null ? copyHistoryText(language, 'timeExit') : `+${source.parameters.tp.toLocaleString(language, { maximumFractionDigits: 20 })}%`}</td><td className={tone(d.unreal)}>{usd(d.unreal)} ({pct(d.unreal / size * 100, 1)})</td></tr></tbody></table></div><div className="cpd-acts"><button type="button" className="ss3-dbtn" onClick={onFlat}>{text('포지션 전체 정리')}</button></div></>
}

function CopyActionDialog({ action, account, sources, Dialog, onClose, onAdjusted, onClosed }: { action: Action; account: CopyPreviewAccount; sources: SharedStrategy[]; Dialog: DialogType; onClose: () => void; onAdjusted: () => void; onClosed?: () => void }) {
  const text = useCopyActionText()
  const copy = account.state?.copies.find(c => c.id === action.id), source = sources.find(s => s.nick === copy?.nick) ?? null
  const d = copy ? calculateCopyPreview(copy, source) : null, { usd, pct } = useNumbers()
  const [kind, setKind] = useState(action.kind), [direction, setDirection] = useState<'add' | 'out'>('add'), [amount, setAmount] = useState(''), [confirmLoss, setConfirmLoss] = useState(false)
  const value = decimal(amount), maximum = account.blocked ? NaN : direction === 'add' ? account.state?.spot ?? NaN : d?.avail ?? NaN
  const verifiedAmount = (value: number) => usd(account.blocked ? null : value)
  const error = !amount ? '' : !Number.isFinite(value) || value <= 0 ? '0보다 큰 금액을 입력해주세요' : value > maximum ? direction === 'add' ? '스팟 잔고보다 커요' : '출금 가능 금액을 넘었어요' : ''
  const valid = Boolean(copy && d && copy.status === 'active' && !account.blocked && (kind !== 'flat' || d.posOpen))
  const dismiss = () => { account.clearActionError(); onClose() }
  const finish = () => {
    dismiss()
    if (kind === 'close' && onClosed) { onClosed(); return }
    requestAnimationFrame(() => {
      if (!action.trigger?.isConnected) document.querySelector<HTMLElement>('.cpp-nick, .cpd-heading :is(h2,h3)')?.focus({ preventScroll: true })
    })
  }
  const flattened = !account.blocked && kind === 'flat' && copy && account.state ? flattenCopyPreview(account.state, { owner: account.state.owner, id: copy.id, at: Math.max(copy.at, ...copy.ledger.map(entry => entry.at)) }, source) : null
  const settlement = flattened?.ok && flattened.copy ? calculateCopyPreview(flattened.copy, source) : d
  const adjust = () => {
    if (!valid || !d) return
    if (direction === 'add' && d.pnlPct <= copyPreviewConfig.LOSS_GUARD + Number.EPSILON && !confirmLoss) { setConfirmLoss(true); return }
    if (account.commit(state => adjustCopyPreview(state, { owner: state.owner, id: action.id, at: Date.now(), amount: value, direction, confirmLoss }, source))) { dismiss(); onAdjusted() }
  }
  const title = text(confirmLoss && !account.blocked ? '잠깐, 손실 구간이에요' : kind === 'adjust' ? '잔고 조정, {nick}' : kind === 'settings' ? '카피 설정, {nick}' : kind === 'flat' ? '포지션 전체 정리' : '카피 종료', { nick: copy?.nick ?? '' })
  return <Dialog title={title} onClose={dismiss} trigger={action.trigger} focusKey={`${kind}:${confirmLoss}`}>
    <CopyDialogRecovery account={account} />
    {!copy || !d ? <p>{text('카피 원본 데이터를 확인할 수 없어요')}.</p> : kind === 'settings' ? <><p>{text('따라갈 페어: ')}<b>{account.blocked ? '—' : copy.pairs.join(', ')}</b><br />{text('모드와 카피 금액 변경은 카피를 종료한 뒤 다시 시작할 때 고를 수 있어요.')}<br />{text('잔고는 잔고 조정에서 언제든 바꿀 수 있어요.')}</p><div className="ss3-dacts"><button type="button" className="obtn" onClick={dismiss}>{text('닫기')}</button><button type="button" className="wbtn" disabled={!valid} onClick={() => setKind('adjust')}>{text('잔고 조정 열기')}</button></div></>
      : kind === 'adjust' ? <>{confirmLoss ? <>{!account.blocked && <Note warning>{text('지금 손실 구간이에요. 추가 입금은 평균 단가를 낮추지만 위험도 같이 커져요. 금액을 늘리기 전에 전략 자체를 다시 점검해보세요.')}</Note>}<p>{text('{amount}를 추가할까요?', { amount: usd(value) })}</p></> : <><p className="cpa-pnl">{text('이 카피의 현재 수익률 ')}<b className={account.blocked ? '' : tone(d.pnlPct)}>{account.blocked ? '—' : pct(d.pnlPct * 100, 1)}</b></p><div className="cpa-tgl" role="group" aria-label={text('잔고 조정 방식')}>{(['add', 'out'] as const).map(dir => <button type="button" key={dir} aria-pressed={direction === dir} className={direction === dir ? 'on' : ''} onClick={() => { setDirection(dir); setAmount('') }}>{text(dir === 'add' ? '추가 입금' : '출금')}</button>)}</div><Amount label={text('조정 금액')} value={amount} onChange={setAmount} maximum={maximum} error={error ? text(error) : ''} description={<div className="cps-bal">{text(direction === 'add' ? '추가 가능 (스팟 잔고)' : '출금 가능')} <b>{usd(maximum)}</b></div>} /><p className="cpa-note">{text(direction === 'add' ? '스팟 계좌에서 카피 계좌로 옮겨져요. 추가한 금액은 다음 진입부터 반영돼요.' : '카피 계좌에서 스팟 계좌로 옮겨져요. 포지션에 잡혀 있는 금액은 출금할 수 없어요.')}</p></>}
        <div className="ss3-dacts"><button type="button" className="obtn" onClick={() => confirmLoss ? setConfirmLoss(false) : dismiss()}>{text(confirmLoss ? '다시 생각할게요' : '취소')}</button><button type="button" className="wbtn" disabled={!valid || !amount || Boolean(error)} onClick={adjust}>{text(confirmLoss ? '{amount} 추가할게요' : '확인', { amount: usd(value) })}</button></div></>
        : <><p>{kind === 'flat' ? <>{text('열려 있는 카피 포지션을 현재가로 정리해요.')}<br />{text('미실현 {amount}이 실현 손익으로 확정되고, 카피는 유지되어 다음 진입부터 다시 따라가요.', { amount: verifiedAmount(d.unreal) })}</> : <>{text('{nick} 님 카피를 종료할까요?', { nick: copy.nick })}<br />{text('보유 중인 카피 포지션을 현재가로 정리하고, 정산된 금액을 스팟 계좌로 돌려드려요.')}</>}</p>{settlement && <div className="cpd-kv"><Kpi label={text(kind === 'flat' ? '정리 후 순손익' : '순손익')} value={verifiedAmount(settlement.net)} /><Kpi label={text(kind === 'flat' ? '정리 후 수익 분배 지급' : '수익 분배 지급')} value={verifiedAmount(settlement.share)} /><Kpi label={text(kind === 'flat' ? '정리 후 평가 금액' : '회수 금액')} value={verifiedAmount(kind === 'flat' ? settlement.est : Math.max(0, settlement.est))} /></div>}<div className="ss3-dacts"><button type="button" className="obtn" onClick={dismiss}>{text(kind === 'flat' ? '취소' : '계속 카피')}</button><button type="button" className="ss3-dbtn" disabled={!valid} onClick={() => { if (!valid) return; if (account.commit(state => (kind === 'flat' ? flattenCopyPreview : closeCopyPreview)(state, { owner: state.owner, id: action.id, at: Date.now() }, source))) finish() }}>{text(kind === 'flat' ? '정리하기' : '종료하고 정산')}</button></div></>}
  </Dialog>
}

function ServiceCopyActionDialog({ copy, action, Dialog, onClose, onAdjusted, onClosed }: { copy?: CopyServiceAccount; action: Action; Dialog: DialogType; onClose: () => void; onAdjusted: () => void; onClosed?: () => void }) {
  const text = useCopyActionText(), { language } = useClientPreferences(), { usd, pct } = useNumbers(copy?.asset ?? '')
  const [kind,setKind] = useState(action.kind), [direction,setDirection] = useState<'add'|'out'>('add'), [amount,setAmount] = useState(''), [confirmLoss,setConfirmLoss] = useState(false)
  const [pending,setPending] = useState(false), [failed,setFailed] = useState(false), lifetime = useRef({ active: true, pending: false })
  const failure = failed ? sharingActionFailed(language) : ''
  useEffect(()=>{const current=lifetime.current;current.active=true;return()=>{current.active=false}},[])
  const capabilities=copy?.actions, maximum=(direction==='add'?capabilities?.availableDeposit:capabilities?.availableWithdrawal) ?? NaN, value=decimal(amount)
  const error=!amount?'':!Number.isFinite(value)||value<=0?text('0보다 큰 금액을 입력해주세요'):value>maximum?text(direction==='add'?'스팟 잔고보다 커요':'출금 가능 금액을 넘었어요'):''
  const valid=copy?.status==='active' && !pending
  const callback=kind==='adjust'?capabilities?.onAdjust:kind==='flat'?capabilities?.onFlatten:capabilities?.onClose
  const settlement=kind==='flat'?capabilities?.flattenSettlement:capabilities?.closeSettlement
  const dismiss=()=>{if(!lifetime.current.pending)onClose()}
  const submit=async()=>{
    if(!valid||!callback||lifetime.current.pending)return
    if(kind==='adjust'&&(!amount||error||!Number.isFinite(maximum)))return
    if(kind==='adjust'&&direction==='add'&&capabilities?.depositNeedsConfirmation&&!confirmLoss){setConfirmLoss(true);return}
    lifetime.current.pending=true;setPending(true);setFailed(false)
    try { if(kind==='adjust')await capabilities!.onAdjust!({amount:value,direction,confirmLoss});else if(kind==='flat')await capabilities!.onFlatten!();else await capabilities!.onClose!()
      if(lifetime.current.active){onClose();if(kind==='adjust')onAdjusted();else if(kind==='close')onClosed?.()}
    } catch{if(lifetime.current.active)setFailed(true)}
    finally{lifetime.current.pending=false;if(lifetime.current.active)setPending(false)}
  }
  const title=text(confirmLoss?'잠깐, 손실 구간이에요':kind==='adjust'?'잔고 조정, {nick}':kind==='settings'?'카피 설정, {nick}':kind==='flat'?'포지션 전체 정리':'카피 종료',{nick:copy?.nick ?? '—'})
  return <Dialog title={title} onClose={dismiss} trigger={action.trigger} focusKey={`${kind}:${confirmLoss}`}>
    {kind==='settings'?<><p>{text('따라갈 페어: ')}<b>{copy?.pairs.join(', ') || '—'}</b><br/>{text('모드와 카피 금액 변경은 카피를 종료한 뒤 다시 시작할 때 고를 수 있어요.')}<br/>{text('잔고는 잔고 조정에서 언제든 바꿀 수 있어요.')}</p><div className="ss3-dacts"><button type="button" className="obtn" onClick={dismiss}>{text('닫기')}</button><button type="button" className="wbtn" disabled={!valid || !capabilities?.onAdjust} onClick={()=>setKind('adjust')}>{text('잔고 조정 열기')}</button></div></>
      : kind==='adjust'?<>{confirmLoss?<><Note warning>{text('지금 손실 구간이에요. 추가 입금은 평균 단가를 낮추지만 위험도 같이 커져요. 금액을 늘리기 전에 전략 자체를 다시 점검해보세요.')}</Note><p>{text('{amount}를 추가할까요?',{amount:usd(value)})}</p></>:<><p className="cpa-pnl">{text('이 카피의 현재 수익률 ')}<b className={tone(copy?.returnPercent ?? NaN)}>{pct(copy?.returnPercent ?? NaN,1)}</b></p><div className="cpa-tgl" role="group" aria-label={text('잔고 조정 방식')}>{(['add','out'] as const).map(dir=><button type="button" disabled={pending} key={dir} aria-pressed={direction===dir} className={direction===dir?'on':''} onClick={()=>{setDirection(dir);setAmount('')}}>{text(dir==='add'?'추가 입금':'출금')}</button>)}</div><Amount asset={copy?.asset ?? ''} disabled={pending} label={text('조정 금액')} value={amount} onChange={value=>{if(!pending)setAmount(value)}} maximum={maximum} error={error} description={<div className="cps-bal">{text(direction==='add'?'추가 가능 (스팟 잔고)':'출금 가능')} <b>{usd(maximum)}</b></div>}/><p className="cpa-note">{text(direction==='add'?'스팟 계좌에서 카피 계좌로 옮겨져요. 추가한 금액은 다음 진입부터 반영돼요.':'카피 계좌에서 스팟 계좌로 옮겨져요. 포지션에 잡혀 있는 금액은 출금할 수 없어요.')}</p></>}
        <div className="ss3-dacts"><button type="button" className="obtn" disabled={pending} onClick={()=>confirmLoss?setConfirmLoss(false):dismiss()}>{text(confirmLoss?'다시 생각할게요':'취소')}</button><button type="button" className="wbtn" disabled={!valid||!callback||!amount||Boolean(error)||!Number.isFinite(maximum)} aria-busy={pending} onClick={()=>{void submit()}}>{text(confirmLoss?'{amount} 추가할게요':'확인',{amount:usd(value)})}</button></div></>
        : <><p>{kind==='flat'?<>{text('열려 있는 카피 포지션을 현재가로 정리해요.')}<br/>{text('미실현 {amount}이 실현 손익으로 확정되고, 카피는 유지되어 다음 진입부터 다시 따라가요.',{amount:usd(copy?.metrics?.unreal ?? null)})}</>:<>{text('{nick} 님 카피를 종료할까요?',{nick:copy?.nick ?? '—'})}<br/>{text('보유 중인 카피 포지션을 현재가로 정리하고, 정산된 금액을 스팟 계좌로 돌려드려요.')}</>}</p><div className="cpd-kv"><Kpi label={text(kind==='flat'?'정리 후 순손익':'순손익')} value={usd(settlement?.net ?? null)}/><Kpi label={text(kind==='flat'?'정리 후 수익 분배 지급':'수익 분배 지급')} value={usd(settlement?.share ?? null)}/><Kpi label={text(kind==='flat'?'정리 후 평가 금액':'회수 금액')} value={usd(settlement?.recovered ?? null)}/></div><div className="ss3-dacts"><button type="button" className="obtn" disabled={pending} onClick={dismiss}>{text(kind==='flat'?'취소':'계속 카피')}</button><button type="button" className="ss3-dbtn" disabled={!valid||!callback} aria-busy={pending} onClick={()=>{void submit()}}>{text(kind==='flat'?'정리하기':'종료하고 정산')}</button></div></>}
    {failure&&<p role="alert">{failure}</p>}{!copy&&<p role="status">{sharingUnavailable(language)}</p>}
  </Dialog>
}

type SharedProps = { account: CopyPreviewAccount; sources: SharedStrategy[]; navigate: Navigation; Dialog: DialogType }
export function ClientCopyDashboard({ account, sources, navigate, Dialog, servicePresentation: service, showValidationHeading = true, headingLevel = 3 }: SharedProps & { servicePresentation?: SharingServicePresentation; showValidationHeading?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  const [all, setAll] = useState(false), [action, setAction] = useState<Action | null>(null), { usd, date } = useNumbers(service?.copyAccounts?.asset ?? (service ? '' : 'USDT'))
  const text = useCopyText(), { language } = useClientPreferences()
  const preview = useMemo(() => !service && account.state ? copyPreviewDashboard(account.state, sources) : null, [account.state, sources, service])
  const supplied = service?.copyAccounts, uncertain = !service && account.blocked
  const rows = service ? supplied?.accounts.state === 'ready' ? supplied.accounts.rows.map(copy=>({copy:{id:copy.id,nick:copy.nick,status:copy.status,at:copy.startedAt,settle:{back:copy.recovered}},calculation:copy.metrics?{...copy.metrics,inv:copy.invested}:null,supplied:copy})) : [] : (preview?.rows ?? []).map(row=>({...row,calculation:uncertain ? null : row.calculation,supplied:undefined as CopyServiceAccount|undefined}))
  const summary = { rows, active:rows.filter(row=>row.copy.status==='active'), sum:service ? supplied?.metrics ?? null : uncertain ? null : preview?.sum ?? null }
  const open = (kind: Action['kind'], id: string) => setAction({ kind, id, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined })
  if (!service && !summary.rows.length) return null
  return <section className="cpp cpd" aria-label={text('카피 대시보드')}><div className="cpd-heading"><Heading tabIndex={-1}>{text('실시간 카피')}</Heading><span>{service ? `${supplied?.activeCount ?? '—'} · ${supplied?.asset ?? '—'}` : text('{count}건 진행 중, 전 자산 USDT 표기', { count: uncertain ? '—' : summary.active.length })}</span></div><Metrics values={summary.sum} dashboard asset={supplied?.asset ?? (service ? '' : 'USDT')} />
    {summary.sum?.net != null && <Note warning={summary.sum.net < 0}>{summary.sum.net < 0 ? text('지금은 손실 구간이에요. 카피는 트레이더의 손절 규칙까지 그대로 따라가니, 원칙이 지켜지는지 프로필의 판단 기록을 확인해보세요.') : text('수익 분배는 실현 수익에서만 차감돼요. 미실현 수익에는 분배가 붙지 않아요.')}</Note>}
    <div className="cpd-flt" role="group" aria-label={text('카피 표시')}>{[false, true].map(value => <button type="button" key={String(value)} className={all === value ? 'on' : ''} aria-pressed={all === value} onClick={() => setAll(value)}>{text(value ? '종료 포함' : '카피 중')}</button>)}</div>
    {(all ? summary.rows : summary.active).map(({ copy, calculation: d, supplied: row }) => <article className="cpd-card" key={copy.id}><div className="cpd-hd"><button type="button" className="nm" onClick={() => navigate(copyTraderLocation(copy.nick))}>{copy.nick}</button><span className="tag">{text('비율 따라가기')}</span><span className="tag">{service ? copyProfileText(language,'수익 분배 {percent}%',{percent:row?.sharePercent ?? '—'}) : text('분배 10%')}</span><span className={`tag ${uncertain ? '' : copy.status === 'active' ? 'on' : 'off'}`}>{uncertain ? '—' : text(copy.status === 'active' ? '카피 중' : '종료됨')}</span><span className="cpd-date">{text('{date} 시작', { date: date(copy.at) })}</span></div>
      {d ? <div className="cpd-kv">{(copy.status === 'active' ? [['순손익', d.net], ['수익 분배 지급', d.share], ['평가 금액', d.est], ['가용', d.avail], ['누적 투자', d.inv]] as const : [['순손익 (정산 확정)', d.net], ['수익 분배 지급', d.share], ['회수 금액', copy.settle?.back ?? NaN]] as const).map(([key, value]) => <div key={key}><small>{text(key)}</small><b className={key.startsWith('순손익') ? tone(value ?? NaN) : ''}>{value != null && Number.isFinite(value) ? service ? `${value.toLocaleString(language,{maximumFractionDigits:2})} ${row?.asset ?? ''}` : usd(value) : '—'}</b></div>)}</div> : <Metrics values={null} />}
      <div className="cpd-acts"><button type="button" className={copy.status === 'active' ? 'wbtn' : 'obtn'} onClick={() => navigate(detailLocation(copy.id))}>{text(copy.status === 'active' ? '상세' : '기록 보기')}</button>{copy.status === 'active' ? <><button type="button" className="obtn" disabled={service ? !row?.actions?.onAdjust : account.blocked || !d} onClick={() => open('adjust', copy.id)}>{text('잔고 조정')}</button><button type="button" className="ss3-dbtn" disabled={service ? !row?.actions?.onClose : account.blocked || !d} onClick={() => open('close', copy.id)}>{text('카피 종료')}</button></> : <span className="cpp-static">{uncertain ? '—' : text('정산 완료, {amount} 회수', { amount: copy.settle ? service ? copy.settle.back == null ? '—' : `${copy.settle.back.toLocaleString(language)} ${row?.asset ?? ''}` : usd(copy.settle.back, 0) : '—' })}</span>}</div>
    </article>)}{service && supplied?.accounts.state !== 'ready' ? <p role={supplied?.accounts.state==='error'?'alert':'status'}>{supplied?.accounts.message || sharingUnavailable(language)}</p> : !uncertain && !all && !summary.active.length && <Empty title={text('진행 중인 카피가 없어요')} action={<button type="button" className="obtn" onClick={() => setAll(true)}>{text('종료 기록 보기')}</button>} />}
    {action && (service ? <ServiceCopyActionDialog key={`${action.id}:${action.kind}`} action={action} copy={supplied?.accounts.rows.find(row=>row.id===action.id)} Dialog={Dialog} onClose={()=>setAction(null)} onAdjusted={()=>{}}/> : <CopyActionDialog key={`${action.id}:${action.kind}`} action={action} account={account} sources={sources} Dialog={Dialog} onClose={() => setAction(null)} onAdjusted={() => {}} />)}
    {showValidationHeading && <div className="cpd-heading"><Heading>{text('복제 검증')}</Heading><span>{text('전략을 복제해 내 계정으로 재검증한 기록')}</span></div>}
  </section>
}

export function ClientCopyTrading({ location, account, sources, navigate, Dialog, onStartGate, onFollow, backLabel, watching, onWatch, onAsk, signedIn, onLogin, servicePresentation: service }: SharedProps & {
  servicePresentation?: SharingServicePresentation; location: SharedLocation; onStartGate: () => boolean; onFollow: () => void; backLabel?: string; watching: (nick: string) => boolean; onWatch: (nick: string) => void; onAsk: (text: string) => void | Promise<void>; signedIn: boolean; onLogin: () => void
}) {
  const [action, setAction] = useState<Action | null>(null), [askFailed, setAskFailed] = useState(false), [asking, setAsking] = useState(false)
  const { language } = useClientPreferences()
  const askError = askFailed ? sharingActionFailed(language) : ''
  const text = useCopyText()
  const route = JSON.stringify(location), [previousRoute, setPreviousRoute] = useState(route)
  if (previousRoute !== route) { setPreviousRoute(route); setAction(null); setAskFailed(false) }
  const lifetime = useRef({ version: 0, asking: false })
  const [observedAt] = useState(() => Date.now())
  useEffect(() => { const current = lifetime.current; current.version++; return () => { current.version++ } }, [])
  const source = sources.find(row => row.nick === location.nick && !row.me)
  const previewCopy = service ? undefined : account.state?.copies.find(row => row.id === location.copyId)
  const suppliedCopy = service?.copyAccounts?.accounts.state === 'ready' ? service.copyAccounts.accounts.rows.find(row => row.id === location.copyId) : undefined
  const copy = service ? suppliedCopy ?? {id:location.copyId ?? '',nick:'—',status:undefined} : previewCopy
  const copySource = sources.find(row => row.nick === copy?.nick) ?? null, d = service ? suppliedCopy?.metrics ?? null : previewCopy && !account.blocked ? calculateCopyPreview(previewCopy, copySource) : null
  const start = () => { if (source && onStartGate()) navigate({ view: 'copy-setup', nick: source.nick, period: 'all' }) }
  const open = (kind: Action['kind']) => { if (copy) setAction({ kind, id: copy.id, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined }) }
  const ask = async () => {
    if (!signedIn) { onLogin(); return }
    if (!source || lifetime.current.asking) return
    const version = lifetime.current.version; lifetime.current.asking = true; setAsking(true); setAskFailed(false)
    try { if (service) await service.onAnalyze?.(source, 'all'); else await onAsk(sharedAnalysisRequest(source, 'all')) }
    catch { if (version === lifetime.current.version) setAskFailed(true) }
    finally { if (version === lifetime.current.version) { lifetime.current.asking = false; setAsking(false) } }
  }
  if (location.view === 'trader' && source) return <><TraderProfile service={service} source={source} location={location} navigate={navigate} onStart={start} watching={watching(source.nick)} onWatch={() => onWatch(source.nick)} onAsk={() => { void ask() }} asking={asking} />{askError && <p role="alert">{askError}</p>}</>
  if (!signedIn && (location.view === 'copy-setup' || location.view === 'copy-detail')) return <Empty title={text('로그인 후 카피를 관리할 수 있어요')} action={<button type="button" className="wbtn" onClick={onLogin}>{text('로그인')}</button>} />
  if (location.view === 'copy-setup' && source) return <CopySetup service={service} key={source.nick} source={source} account={account} navigate={navigate} Dialog={Dialog} onStartGate={onStartGate} onFollow={onFollow} />
  if (location.view !== 'copy-detail' || !copy) return <Empty title={text(location.view === 'copy-detail' ? '카피를 찾을 수 없어요' : '지금은 볼 수 없는 트레이더예요')} action={<button type="button" className="obtn" onClick={() => navigate({ period: 'all' }, true)}>{text('전략들로 돌아가기')}</button>} />
  const tab = location.copyTab ?? 'pos'
  return <section className="cpp cpx" aria-label={copyTradingLabel(language, '카피 상세')}><button type="button" className="ss3-back" onClick={onFollow}><ArrowLeft size={16} />{backLabel ?? text('따라가기')}</button><div className="cpp-head"><div className="cpp-ava" aria-hidden="true">{Array.from(copy.nick)[0]}</div><div className="cpp-idm"><h2 className="cpp-nick" tabIndex={-1}><button type="button" className="nm" disabled={service && !suppliedCopy} onClick={() => navigate(copyTraderLocation(copy.nick))}>{copy.nick}</button></h2><div className="cpp-meta"><span>{text('비율 따라가기')}</span><span>{service ? copyProfileText(language,'수익 분배 {percent}%',{percent:suppliedCopy?.sharePercent ?? '—'}) : text('수익 분배 10%')}</span><CopyStartedAt value={service ? suppliedCopy?.startedAt : previewCopy?.at} /><span>{(!service && account.blocked) || !copy.status ? '—' : text(copy.status === 'active' ? '카피 중' : '종료됨')}</span></div></div>{copy.status === 'active' && <div className="cpp-acts"><button type="button" className="obtn" disabled={service ? copy.status !== 'active' || !suppliedCopy?.actions?.onAdjust : account.blocked || !d} onClick={() => open('adjust')}>{text('잔고 조정')}</button><button type="button" className="obtn" disabled={service ? !suppliedCopy : account.blocked} onClick={() => open('settings')}>{text('설정')}</button><button type="button" className="ss3-dbtn" disabled={service ? copy.status !== 'active' || !suppliedCopy?.actions?.onClose : account.blocked || !d} onClick={() => open('close')}>{text('카피 종료')}</button></div>}</div><Metrics values={d} closed={copy.status === 'closed'} asset={suppliedCopy?.asset ?? (service ? '' : 'USDT')} />
    <div className="cpp-tabs" role="group" aria-label={copyHistoryText(language, 'tabs')}>{(Object.keys(copyDetailTabs) as (keyof typeof copyDetailTabs)[]).map(key => <button type="button" key={key} className={`fp${key === tab ? ' on' : ''}`} aria-pressed={key === tab} onClick={() => navigate({ ...detailLocation(copy.id), copyTab: key }, true)}>{copyHistoryText(language, key)}</button>)}</div>
    {service ? tab === 'pos' ? <ClientServicePositions data={suppliedCopy?.positions} asset={suppliedCopy?.asset ?? ''} onFlat={suppliedCopy?.status==='active' && suppliedCopy.actions?.onFlatten ? ()=>open('flat') : undefined}/> : <ClientServiceCopyHistory tab={tab} account={suppliedCopy}/> : !d || !previewCopy ? <Empty title={account.blocked ? sharingUnavailable(language) : text('카피 원본 데이터를 확인할 수 없어요')} /> : tab === 'pos' ? <CopyPositions copy={previewCopy} d={d as CopyPreviewCalculation} source={copySource} onFlat={() => open('flat')} /> : <ClientCopyDetailHistory tab={tab} copy={previewCopy} calculation={d as CopyPreviewCalculation} source={copySource} now={previewCopy.closedAt ?? observedAt} />}{!service && foot}
    {action && (service ? <ServiceCopyActionDialog key={`${action.id}:${action.kind}`} copy={suppliedCopy} action={action} Dialog={Dialog} onClose={()=>setAction(null)} onClosed={onFollow} onAdjusted={()=>navigate({...detailLocation(copy.id),copyTab:'bal'},true)}/> : <CopyActionDialog key={`${action.id}:${action.kind}`} action={action} account={account} sources={sources} Dialog={Dialog} onClose={() => setAction(null)} onClosed={onFollow} onAdjusted={() => navigate({ ...detailLocation(copy.id), copyTab: 'bal' }, true)} />)}
  </section>
}
