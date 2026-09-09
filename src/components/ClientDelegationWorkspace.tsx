import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { delegationBudgets, delegationChartFixture, delegationExchanges, delegationPrices, delegationQuestions, delegationResultFixtures, delegationRiskCopy, delegationSteps, delegationTradeFixture, readDelegationUi, saveDelegationUi, type DelegationAnswers } from '../client-delegation-fixtures'
import '../client-delegation.css'
import { getSitePage } from '../site-navigation'

type Page = 'intake' | 'backtest' | 'report' | 'connect' | 'done' | 'trading'
type ConnectionStep = 'plan' | 'cycle' | 'card' | 'confirm' | 'exchange' | 'joined' | 'uid' | 'api'
type Props = { sessionId: string; idea: string; onBack: () => void; onTradingReady?: () => void; onShowRanking?: () => void; initialPage?: string }
const won = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`
const pageOf = (value?: string): Page => ['backtest', 'report', 'connect', 'done', 'trading'].includes(value ?? '') ? value as Page : 'intake'
const defaultAnswers = (): DelegationAnswers => Object.fromEntries(delegationQuestions.map(q => [q.key, { index: q.recommended, label: q.options[q.recommended][0], recommended: true }]))
const workMilestones = [480, 960, 1860, 2340, 2820]
function Check() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 12.5 5 5 11-11" /></svg> }
function Shield() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5v-6z" /></svg> }
function FixtureScore({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700
    let frame = 0
    const start = performance.now()
    const draw = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      setDisplayed(Math.round(value * progress * progress * (3 - 2 * progress)))
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <><div className="n" aria-label={`${value}점`}><span aria-hidden="true">{displayed}</span> <small>/ 100</small></div><div className={`vd ${value >= 80 ? 'ok' : 'no'}`} style={{ visibility: displayed === value ? 'visible' : 'hidden' }}>{value >= 80 ? '실행 가능' : '기준 미달'}</div></>
}
function Head({ children, onBack, sub, badge }: { children: ReactNode; onBack: () => void; sub?: string; badge?: ReactNode }) { return <header className="tfw-hd"><button className="bk" onClick={onBack} aria-label="뒤로"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg></button><h2 className="ti">{children}</h2>{sub && <span className="sb">{sub}</span>}{badge && <span className="bdg">{badge}</span>}</header> }
function Field({ label, value, onChange, error, type = 'text', inputMode, placeholder, maxLength, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; inputMode?: 'numeric' | 'text'; placeholder?: string; maxLength?: number; readOnly?: boolean }) {
  const id = useId()
  return <div className={`tf-fld${error ? ' bad' : ''}`}><label htmlFor={id}>{label}</label><input id={id} autoComplete="off" spellCheck={false} type={type} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} inputMode={inputMode} placeholder={placeholder} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} />{error && <div className="err" id={`${id}-error`}>{error}</div>}</div>
}
function FixtureChart({ asset, compact = false, interval = '1D', onIntervalChange, period = 1 }: { asset: string; compact?: boolean; interval?: string; onIntervalChange?: (interval: string) => void; period?: number }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(760)
  useEffect(() => {
    const node = chartRef.current
    if (!node) return
    const observer = new ResizeObserver(entries => setChartWidth(Math.max(260, Math.floor(entries[0].contentRect.width))))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const [selected, setSelected] = useState<number | null>(null)
  const groupSize = interval === '1M' ? 30 : interval === '1W' ? 7 : 1
  const candles = useMemo(() => Array.from({ length: Math.ceil(delegationChartFixture.length / groupSize) }, (_, i) => {
    const group = delegationChartFixture.slice(i * groupSize, (i + 1) * groupSize)
    return { open: group[0].open, close: group[group.length - 1].close, high: Math.max(...group.map(c => c.high)), low: Math.min(...group.map(c => c.low)), volume: group.reduce((sum, c) => sum + c.volume, 0) / group.length }
  }), [groupSize])
  const width = chartWidth, height = compact ? 240 : chartWidth < 600 ? 230 : 440, plotBottom = height - 72
  const days = period === 0 ? 365 : period === 2 ? 1260 : 730
  const dateLabels = Array.from({ length: width < 480 ? 3 : 5 }, (_, i) => {
    const count = width < 480 ? 3 : 5
    const date = new Date(Date.UTC(2026, 7, 27) - days * (1 - i / (count - 1)) * 86400000)
    return `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  })
  const min = Math.min(...candles.map(c => c.low)), max = Math.max(...candles.map(c => c.high))
  const x = (index: number) => 14 + index / (candles.length - 1) * (width - 100)
  const y = (price: number) => 24 + (max - price) / (max - min) * (plotBottom - 40)
  const shown = candles[Math.min(selected ?? candles.length - 1, candles.length - 1)]
  const line = candles.map((c, i) => `${i ? 'L' : 'M'}${x(i)},${y(c.close)}`).join(' ')
  return <div ref={chartRef} className={`tf-chart${compact ? ' compact' : ''}`}>
    {!compact && <><div className="tf-chart-toolbar"><strong>{asset}</strong><span>·</span><span>{interval === '1D' ? '일봉' : interval} 시뮬레이션</span><div className="tf-chart-intervals">{['1D', '1W', '1M'].map(item => <button key={item} aria-pressed={interval === item} onClick={() => { setSelected(null); onIntervalChange?.(item) }}>{item}</button>)}</div></div><div className="tf-ohlc"><span>O {shown.open.toFixed(0)}</span><span>H {shown.high.toFixed(0)}</span><span>L {shown.low.toFixed(0)}</span><span className={shown.close >= shown.open ? 'u' : 'd'}>C {shown.close.toFixed(0)}</span></div></>}
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${asset} 과거 검증 구간 가격, 매수와 매도 지점`} onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect(); setSelected(Math.max(0, Math.min(candles.length - 1, Math.round(((e.clientX - rect.left) / rect.width * width - 14) / (width - 100) * (candles.length - 1))))) }} onPointerLeave={() => setSelected(null)}>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="0" x2={width - 76} y1={24 + i * (plotBottom - 24) / 4} y2={24 + i * (plotBottom - 24) / 4} stroke="rgba(255,255,255,.065)" /><text x={width - 68} y={28 + i * (plotBottom - 24) / 4} fill="#7f8794" fontSize="10">{Math.round(max - i * (max - min) / 4).toLocaleString()}</text></g>)}
      {compact ? <path className="tf-equity-line" pathLength="1" d={line} fill="none" stroke="rgba(143,178,255,.75)" strokeWidth="1.5" /> : candles.map(c => { const i = candles.indexOf(c), color = c.close >= c.open ? '#56c486' : '#ee766a'; return <g key={i}><line x1={x(i)} x2={x(i)} y1={y(c.high)} y2={y(c.low)} stroke={color} /><rect x={x(i) - 1.2} y={Math.min(y(c.open), y(c.close))} width="2.4" height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))} fill={color} /><rect x={x(i) - 1.2} y={height - 26 - c.volume * .5} width="2.4" height={c.volume * .5} fill={color} opacity=".32" /></g> })}
      {delegationTradeFixture.map((sourceIndex, i) => { const index = Math.min(candles.length - 1, Math.floor(sourceIndex / groupSize)); const buy = i % 2 === 0, cy = y(candles[index].close) + (buy ? 14 : -14); return <g className="tf-trade-marker" style={{ animationDelay: `${i * 110}ms` }} key={sourceIndex}><path d={buy ? `M${x(index)},${cy - 5}l-4.5,8h9z` : `M${x(index)},${cy + 5}l-4.5,-8h9z`} fill={buy ? '#56c486' : '#ee766a'}><title>{buy ? '매수' : '매도'} · {candles[index].close.toFixed(0)}</title></path></g> })}
      {selected !== null && <><line x1={x(selected)} x2={x(selected)} y1="12" y2={height - 24} stroke="#8b96a8" strokeDasharray="3 4" /><line x1="0" x2={width - 76} y1={y(shown.close)} y2={y(shown.close)} stroke="#8b96a8" strokeDasharray="3 4" /></>}
      {dateLabels.map((date, i, dates) => <text key={date} x={14 + i * (width - 120) / (dates.length - 1)} y={height - 8} fill="#7f8794" fontSize="10">{date}</text>)}
    </svg>
    {compact && <div className="tf-chart-caption">과거 검증 구간의 매수(▲)와 매도(▼) 지점</div>}
  </div>
}

export function ClientDelegationWorkspace({ sessionId, idea, onBack, onTradingReady, onShowRanking, initialPage }: Props) {
  const [restored] = useState(() => readDelegationUi(sessionId))
  const firstPage = initialPage ? pageOf(initialPage) : restored?.page ?? 'intake'
  const [page, setPage] = useState<Page>(firstPage)
  const [answers, setAnswers] = useState<DelegationAnswers>(() => restored?.answers ?? (firstPage === 'intake' ? {} : defaultAnswers()))
  const [questionIndex, setQuestionIndex] = useState(restored?.questionIndex ?? (firstPage === 'intake' ? 0 : 5))
  const [attempt, setAttempt] = useState(restored?.attempt ?? (firstPage === 'intake' || firstPage === 'backtest' ? 0 : 1))
  const [workStep, setWorkStep] = useState(restored?.workStep ?? (firstPage === 'backtest' ? 0 : 5))
  const [workStartedAt, setWorkStartedAt] = useState(() => restored?.workStartedAt ?? (firstPage === 'backtest' ? Date.now() - (workMilestones[(restored?.workStep ?? 0) - 1] ?? 0) : undefined))
  const [expert, setExpert] = useState(restored?.expert ?? false)
  const [chartInterval, setChartInterval] = useState(restored?.chartInterval ?? '1D')
  const [plan, setPlan] = useState<'partner' | 'paid' | null>(null)
  const [connectStep, setConnectStep] = useState<ConnectionStep>('plan')
  const [exchange, setExchange] = useState<typeof delegationExchanges[number]>(delegationExchanges[0])
  const [cycle, setCycle] = useState<'month' | 'year'>('year')
  // Credentials/payment values exist only in this mounted component. No storage, logs or network.
  const [uid, setUid] = useState(''), [apiKey, setApiKey] = useState(''), [secretKey, setSecretKey] = useState('')
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '' })
  const [last4, setLast4] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [busyText, setBusyText] = useState('')
  const [guide, setGuide] = useState<'uid' | 'api' | null>(null)
  const [storageError, setStorageError] = useState(false)
  const [running, setRunning] = useState(firstPage === 'trading')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const asset = answers.asset?.label ?? '비트코인'
  const budget = delegationBudgets[answers.budget?.index ?? 1]
  const result = delegationResultFixtures[Math.min(attempt, 1)]
  const amount = delegationPrices[cycle]
  const headingRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const saved = saveDelegationUi(sessionId, { page: page === 'done' || page === 'trading' ? 'connect' : page, answers, questionIndex, attempt, workStep, workStartedAt, expert, chartInterval })
    // Persist immediately for route changes; report the external storage result
    // after the effect flush, discarding stale results after another save/unmount.
    let disposed = false
    queueMicrotask(() => { if (!disposed) setStorageError(!saved) })
    return () => { disposed = true }
  }, [sessionId, page, answers, questionIndex, attempt, workStep, workStartedAt, expert, chartInterval])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => { rootRef.current?.scrollTo({ top: 0 }); headingRef.current?.focus({ preventScroll: true }) }, [page, connectStep])
  useEffect(() => {
    if (page !== 'backtest' || workStep >= 5 || workStartedAt === undefined) return
    let timer: ReturnType<typeof setTimeout>
    const sync = () => {
      clearTimeout(timer)
      if (document.hidden) return
      const elapsed = Date.now() - workStartedAt
      const step = workMilestones.filter(at => at <= elapsed).length
      setWorkStep(previous => Math.max(previous, step))
      if (step < 5) timer = setTimeout(sync, Math.max(1, workMilestones[step] - elapsed))
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync) }
  }, [page, workStep, workStartedAt])
  useEffect(() => { if (guide) dialogRef.current?.showModal(); else dialogRef.current?.close() }, [guide])
  useEffect(() => {
    // SiteRouter keeps this workspace mounted beneath public pages. The native
    // modal must release the top layer immediately when the workspace is hidden.
    const closeOnNavigation = () => {
      if (!getSitePage()) return
      dialogRef.current?.close()
      setGuide(null)
    }
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
    }
  }, [])
  useEffect(() => { if (errors.general) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) } else if (Object.keys(errors).length) rootRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus() }, [errors])
  const later = (callback: () => void, milliseconds: number) => { timers.current.push(setTimeout(callback, milliseconds)) }
  const go = (next: Page) => { timers.current.forEach(clearTimeout); timers.current = []; setBusy(false); setErrors({}); setGuide(null); setPage(next) }
  const reset = () => { timers.current.forEach(clearTimeout); setBusy(false); setAnswers({}); setQuestionIndex(0); setAttempt(0); setUid(''); setApiKey(''); setSecretKey(''); setCard({ number: '', expiry: '', cvc: '', name: '' }); setPlan(null); setConnectStep('plan'); setLast4(''); go('intake') }
  const verify = () => { setWorkStartedAt(Date.now()); setWorkStep(0); go('backtest') }
  const recommend = () => { setAnswers(previous => ({ ...previous, style: { index: 1, label: '중립적으로', recommended: true }, period: { index: 2, label: '전체 기간', recommended: true }, stop: { index: 1, label: '-5%까지', recommended: true } })); setAttempt(value => value + 1); verify() }
  const pick = (index: number, recommended = false) => { const q = delegationQuestions[questionIndex]; setAnswers(previous => ({ ...previous, [q.key]: { index, label: q.options[index][0], recommended } })); setQuestionIndex(value => value + 1) }
  const rows = [['자산', asset], ['투자금', won(budget)], ['성향', answers.style?.label ?? ''], ['기간', answers.period?.label ?? ''], ['허용 하락', answers.stop?.label ?? '']]
  const back = () => { if (page === 'intake') onBack(); else if (page === 'backtest') go('intake'); else if (page === 'report') go('backtest'); else if (page === 'connect') go('report'); else if (page === 'done') go('connect'); else onBack() }
  const changeConnect = (next: ConnectionStep) => { setErrors({}); setConnectStep(next) }
  const validateCard = (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!/^\d{16}$/.test(card.number.replace(/\s/g, ''))) next.number = '카드 번호 16자리를 확인해주세요'
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) next.expiry = 'MM/YY'
    if (!/^\d{3}$/.test(card.cvc)) next.cvc = '3자리'
    if (card.name.trim().length < 2) next.name = '이름을 입력해주세요'
    setErrors(next); if (!Object.keys(next).length) changeConnect('confirm')
  }
  const confirmPayment = () => {
    if (busy) return
    setBusy(true); setBusyText('결제 확인 중...')
    later(() => { setBusy(false); if (card.number.startsWith('0000')) { setErrors({ general: '카드사 승인이 거절됐어요. 다른 카드로 시도해주세요.' }); setConnectStep('card') } else { setCard({ number: '', expiry: '', cvc: '', name: '' }); changeConnect('exchange') } }, 1400)
  }
  const verifyUid = (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    if (!/^\d{5,12}$/.test(uid.trim())) { setErrors({ uid: 'UID 숫자 5~12자리를 확인해주세요' }); return }
    setErrors({}); setBusy(true); setBusyText('연동 확인 중...')
    later(() => { setBusy(false); if (/^0+$/.test(uid.trim())) setErrors({ general: '해당 UID로 가입 내역을 찾지 못했어요. 파트너 링크로 가입한 계정의 UID인지 확인해주세요.' }); else { setUid(''); changeConnect('api') } }, 1800)
  }
  const verifyApi = (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    const next: Record<string, string> = {}
    if (apiKey.trim().length < 10) next.api = 'API Key를 확인해주세요 (10자 이상)'
    if (secretKey.trim().length < 10) next.secret = 'Secret Key를 확인해주세요 (10자 이상)'
    setErrors(next); if (Object.keys(next).length) return
    setBusy(true); setBusyText('읽기 권한 확인 중...')
    later(() => setBusyText('거래 권한 확인 중...'), 650)
    later(() => setBusyText('출금 권한 없음 확인 중...'), 1300)
    later(() => { setBusy(false); if (/^BAD/i.test(apiKey)) setErrors({ general: 'API Key 권한 확인에 실패했어요. 읽기와 거래 권한이 켜져 있는지 확인해주세요.' }); else { setLast4(apiKey.slice(-4)); setApiKey(''); setSecretKey(''); go('done') } }, 1900)
  }
  const kpis = (report = false) => <div className={`tf-kpis${report ? ' report' : ''}`}>{[[report ? `${result.ret >= 0 ? '+' : ''}${won(budget * result.ret / 100)}` : `+${result.ret.toFixed(1)}%`, report ? `${won(budget)} 기준 ${answers.period?.index === 0 ? 12 : answers.period?.index === 2 ? 43 : 24}개월 예상 수익` : '과거 시뮬레이션 수익률', 'u'], [`${result.mdd.toFixed(1)}%`, report ? '최대 손실' : '최대 하락폭', 'd'], [`${result.winRate.toFixed(0)}%`, '승률', ''], [`${result.n}회`, report ? '거래 횟수' : '거래', '']].map(([value, label, cls]) => <div className="tf-kpi" key={label}><div className={`v ${cls}`}>{value}</div><div className="k">{label}</div></div>)}</div>
  const generalError = errors.general && <div className="tf-errb" role="alert" ref={errorRef} tabIndex={-1}>{errors.general}<button onClick={() => setErrors({})}>다시 시도</button></div>
  const guideButton = (kind: 'uid' | 'api') => <button className="tf-link" type="button" onClick={() => setGuide(kind)}>{kind === 'uid' ? 'UID가 어디 있어요?' : '발급 방법 보기'}</button>
  const startTrading = () => { setRunning(true); onTradingReady?.(); go('trading') }
  return <div className="client-delegation" ref={rootRef} data-source="client-ui-fixture" data-session={sessionId}>
    <div ref={headingRef} tabIndex={-1} className="tf-page-focus" />
    {storageError && <div className="tf-errb tf-storage-notice" role="status">브라우저 저장에 실패했습니다. 새로고침 시 초기화될 수 있으니 내용을 복사해 두세요.</div>}
    {page === 'intake' && <div className="tf-intake"><Head onBack={onBack}>전략 위임</Head>{idea && <div className="tf-user-message">{idea}</div>}<p className="tf-hello">좋아요, 맡겨주세요. 언제, 어떻게 {/팔|정리|손절|탈출|매도/.test(idea) ? '정리할지' : '살지'} 전략을 만들어서 과거 시장에 검증해볼게요. 몇 가지만 편하게 답해주세요!</p>{delegationQuestions.slice(0, questionIndex).map(q => <div className="tf-intake-done" key={q.key}><span className="ok"><Check /></span><span className="tt">{q.title}</span><span className="ans">{answers[q.key]?.label}{answers[q.key]?.recommended ? ' (AI 추천)' : ''}</span></div>)}
      {questionIndex < 5 ? <section className="tfq" aria-label={delegationQuestions[questionIndex].title}><div className="q"><h3 className="t">{delegationQuestions[questionIndex].title}</h3><span className="pg">{questionIndex + 1}/5</span></div><p className="d">{delegationQuestions[questionIndex].description}</p><div className="ops">{delegationQuestions[questionIndex].options.map(([label, hint], i) => <button className="op" key={label} title={hint} onClick={() => pick(i)}>{label}</button>)}<button className="op rec" onClick={() => pick(delegationQuestions[questionIndex].recommended, true)}>잘 모르겠어요, AI가 추천해주세요</button></div></section> : <section className="tf-sum"><h3 className="h">전략 계약서</h3><div className="rows">{rows.map(([key, value]) => <div className="r" key={key}><span className="k">{key === '기간' ? '검증 기간' : key}</span><span className="v">{value}</span></div>)}</div><button className="tf-link" onClick={reset}>다시 답하기</button><p className="tf-assumptions">데이터: 2023~2026 일봉 시뮬레이션, {answers.period?.index === 0 ? 365 : answers.period?.index === 2 ? 1260 : 730}일 구간. 체결: 신호 봉 종가 기준. 비용: 거래당 수수료 0.2% 반영.</p><button className="tf-btn p" onClick={verify}>전략 검증 시작</button></section>}
    </div>}
    {page === 'backtest' && <div className="tfw"><Head onBack={back} sub="과거 시장 기준">{asset} 전략 검증</Head><div className="tfw-grid"><div className="tfw-chart"><FixtureChart asset={asset} interval={chartInterval} onIntervalChange={setChartInterval} period={answers.period?.index} /></div><aside className="tfw-rail"><section className="tfw-sec"><h3 className="sh">전략 조건</h3>{rows.map(([key, value]) => <div className="r" key={key}><span className="k">{key}</span><span className="v">{value}</span></div>)}<p className="tf-assumptions ruled">데이터: 일봉 시뮬레이션. 체결: 신호 봉 종가. 비용: 거래당 0.2% 반영.</p></section><section className="tfw-sec" aria-live="polite">{workStep < 5 ? <><h3 className="sh">검증 진행</h3><div className="tfw-steps">{delegationSteps.map((label, i) => <div className={`tfw-st ${i < workStep ? 'ok' : i === workStep ? 'run' : ''}`} key={label}><span className="ic">{i < workStep ? <Check /> : i === workStep ? <i /> : null}</span><span>{label}</span></div>)}</div></> : <><h3 className="sh">검증 결과</h3><div className="tf-scorebox"><div className="lb">TETH SCORE</div><FixtureScore value={result.score} /><p className="cp">{result.score >= 80 ? '과거 데이터 기준으로 TETH 실행 기준(80점)을 통과했어요.' : '조금만 조정하면 실행 기준(80점)에 가까워질 수 있어요.'}</p></div>{kpis()}<p className="tf-assumptions">수수료 0.2% 포함, 거래 {result.n}회 표본 기준.{result.score >= 80 && ' 파라미터 민감도와 시장 국면별 검증은 아직 안 거친 조건부 통과예요.'}</p>{result.score >= 80 ? <div className="tf-sticky"><button className="tf-btn p" onClick={() => go('report')}>리포트 보기</button></div> : <><h3 className="sh tf-space">TETH 추천</h3><div className="tf-diff"><div className="dr"><span>손실 제한</span><span className="a">{answers.stop?.label}</span><span>→</span><span className="b">-5%</span></div><div className="dr"><span>기간</span><span className="a">{answers.period?.label}</span><span>→</span><span className="b">전체 기간</span></div><div className="dr"><span>진입 조건</span><span className="a">현재 설정</span><span>→</span><span className="b">TETH 권장</span></div></div><button className="tf-btn p" onClick={recommend}>추천 설정으로 다시 검증</button><button className="tf-btn ghost" onClick={reset}>직접 수정</button><button className="tf-btn ghost" onClick={onShowRanking ?? onBack}>다른 전략 보기</button></>}</>}</section></aside></div></div>}
    {page === 'report' && <div className="tfw tf-report-page"><Head onBack={back} badge={<><Shield />TETH {result.score}, 실행 가능</>}>{asset}, {answers.period?.label} 전략</Head><section className="tfw-sec tf-report-chart"><FixtureChart asset={asset} compact period={answers.period?.index} /></section>{kpis(true)}<section className="tfw-sec"><div className="tf-section-head"><h3 className="sh">전략 설명</h3><button className="tf-tgl" onClick={() => setExpert(value => !value)}>{expert ? '쉬운 말 보기' : '전문가 보기'}</button></div><p className="tf-ez">{expert ? `승률 ${result.winRate.toFixed(1)}%, 거래 ${result.n}회, MDD ${result.mdd.toFixed(1)}%, Sharpe ${result.sharpe.toFixed(2)}, Profit Factor ${result.pf.toFixed(2)}, CAGR ${result.cagr.toFixed(1)}%.` : `100번 중 ${Math.round(result.winRate)}번 꼴로 이기는 전략이었고, 가장 안 좋았던 구간에서는 약 ${Math.abs(result.mdd).toFixed(1)}%까지 떨어졌어요. 위험 대비 수익이 좋은 편이에요. 검증 구간 동안 총 ${result.n}번 사고팔았어요.`}</p><h3 className="sh tf-space">위험 요소</h3><p className="tf-ez">하락 뒤 반등을 노리는 전략이라 큰 추세 하락장에서는 신호가 약해질 수 있어요. 최악 구간에서는 약 {Math.abs(result.mdd).toFixed(1)}%의 평가 손실을 견뎌야 했고, 시장 급변 시 검증 결과와 다르게 움직일 수 있습니다. 모든 수치는 거래당 수수료 0.2%를 반영한 값이며, 파라미터 민감도와 하락장 구간별 검증은 아직 수행하지 않았어요.</p></section><div className="tf-sticky"><button className="tf-btn p" onClick={() => go('connect')}>이 전략 실행하기</button><button className="tf-btn ghost" onClick={reset}>전략 수정</button></div><p className="tf-risk">{delegationRiskCopy}</p></div>}
    {page === 'connect' && <div className="tfw tf-connect-page"><Head onBack={back}>전략 실행</Head><nav className="tf-prog" aria-label="연결 진행 단계">{['실행 방법', '거래소 연결', '연결 확인', '시작'].map((label, i) => { const step = ['plan', 'cycle', 'card', 'confirm'].includes(connectStep) ? 0 : connectStep === 'api' ? 2 : 1; return <span className={`p ${i < step ? 'ok' : i === step ? 'on' : ''}`} key={label} aria-current={i === step ? 'step' : undefined}><span className="n">{i < step ? '✓' : i + 1}</span>{label}{i < 3 && <span className="ln" />}</span> })}</nav>{generalError}
      {connectStep === 'plan' && <><h3 className="tf-connect-title">어떻게 실행할까요?</h3><div className="tf-opts"><section className="tf-optc rec"><div className="top"><span className="nm">TETH 파트너 거래소로 시작</span><span className="tag">추천</span><span className="pr">₩0</span></div><p className="ds">새 계정을 만들고 연결하면 이용료가 없어요. <b>약 2분 소요</b>, 연 최대 <b>₩5,000,000</b> 절약.</p><button className="tf-btn p" onClick={() => { setPlan('partner'); changeConnect('exchange') }}>무료로 시작</button></section><section className="tf-optc"><div className="top"><span className="nm">기존 거래소 연결</span><span className="pr">₩599,000 <small>/ 월</small></span></div><p className="ds">이미 사용 중인 거래소를 그대로 사용해요.</p><button className="tf-btn s" onClick={() => { setPlan('paid'); changeConnect('cycle') }}>기존 계정 연결</button></section></div></>}
      {connectStep === 'cycle' && <><h3 className="tf-connect-title">결제 주기를 선택해주세요</h3><div className="tf-payp"><div className="tf-cycrow" role="group" aria-label="결제 주기">{(['year', 'month'] as const).map(item => <button className={`tf-cyc2${cycle === item ? ' on' : ''}`} key={item} aria-pressed={cycle === item} onClick={() => setCycle(item)}><span className="rd" /><span><span className="t">{item === 'year' ? '연 결제' : '월 결제'}</span>{item === 'year' && <span className="d">월 약 ₩417,000</span>}</span><span className="pr">{won(delegationPrices[item])} / {item === 'year' ? '년' : '월'}{item === 'year' && <small>₩2,188,000 절약</small>}</span></button>)}</div><button className="tf-btn p" onClick={() => changeConnect('card')}>계속</button><button className="tf-btn ghost" onClick={() => { setPlan(null); changeConnect('plan') }}>실행 방법 다시 선택</button></div></>}
      {connectStep === 'card' && <><h3 className="tf-connect-title">결제 정보</h3><form className="tf-payp" onSubmit={validateCard} noValidate><Field label="카드 번호" value={card.number} onChange={value => setCard(old => ({ ...old, number: value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') }))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} error={errors.number} /><div className="tf-row2"><Field label="유효기간" value={card.expiry} onChange={value => { const digits = value.replace(/\D/g, '').slice(0, 4); setCard(old => ({ ...old, expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits })) }} placeholder="MM/YY" inputMode="numeric" maxLength={5} error={errors.expiry} /><Field label="CVC" value={card.cvc} onChange={value => setCard(old => ({ ...old, cvc: value.replace(/\D/g, '').slice(0, 3) }))} type="password" inputMode="numeric" placeholder="000" maxLength={3} error={errors.cvc} /></div><Field label="카드 소유자 이름" value={card.name} onChange={value => setCard(old => ({ ...old, name: value }))} placeholder="홍길동" error={errors.name} /><button className="tf-btn p" type="submit">계속</button><button className="tf-btn ghost" type="button" onClick={() => changeConnect('cycle')}>이전</button><p className="tf-risk">데모 환경입니다. 실제 결제가 발생하지 않습니다.</p></form></>}
      {connectStep === 'confirm' && <><h3 className="tf-connect-title">결제 확인</h3><div className="tf-payp"><div className="tfw-sec">{[['플랜', cycle === 'year' ? '연 결제' : '월 결제'], ['결제 금액', won(amount)], ['카드', `•••• ${card.number.replace(/\s/g, '').slice(-4)}`]].map(([label, value]) => <div className="r" key={label}><span className="k">{label}</span><span className="v">{value}</span></div>)}</div><button className="tf-btn p tf-space" disabled={busy} onClick={confirmPayment}>{busy ? busyText : `${won(amount)} 결제하기`}</button><button className="tf-btn ghost" disabled={busy} onClick={() => changeConnect('card')}>이전</button></div></>}
      {connectStep === 'exchange' && <><h3 className="tf-connect-title">{plan === 'partner' ? '어느 거래소로 시작할까요? 하나만 고르면 돼요.' : '바로 연결할 거래소를 선택해주세요.'}</h3><div className="tf-exs">{delegationExchanges.map((item, i) => <button className="tf-ex" key={item.id} onClick={() => { setExchange(item); changeConnect(plan === 'partner' ? 'joined' : 'api') }}>{plan === 'partner' && i === 0 && <span className="rb">추천</span>}<span className="lg">{item.name}</span></button>)}</div><button className="tf-btn ghost" onClick={() => changeConnect('plan')}>실행 방법 다시 선택</button></>}
      {connectStep === 'joined' && <><h3 className="tf-connect-title">{exchange.name} 가입</h3><div className="tf-wait">{exchange.name} 가입을 완료한 뒤 이 화면으로 돌아오세요.<div className="tf-mini3"><span className="s on">① 가입</span><span className="s">② UID 확인</span><span className="s">③ 연결</span></div></div><button className="tf-btn p" onClick={() => changeConnect('uid')}>가입 완료했어요</button><button className="tf-btn ghost" onClick={() => setGuide('uid')}>가입 안내 보기</button><button className="tf-btn ghost" onClick={() => changeConnect('exchange')}>다른 거래소 선택</button></>}
      {connectStep === 'uid' && <><h3 className="tf-connect-title">{exchange.name} UID 연동</h3><div className="tf-mini3"><span className="s ok">① 가입</span><span className="s on">② UID 확인</span><span className="s">③ 연결</span></div><form className="tf-uid-form" aria-busy={busy} onSubmit={verifyUid} noValidate><Field label={`${exchange.name} UID`} value={uid} readOnly={busy} onChange={setUid} inputMode="numeric" placeholder="예: 38291042" maxLength={12} error={errors.uid} />{guideButton('uid')}<button className="tf-btn p tf-space" disabled={busy}>{busy ? busyText : '연동 확인하기'}</button></form></>}
      {connectStep === 'api' && <><h3 className="tf-connect-title">{exchange.name} API 연결</h3><p className="tf-ez">TETH는 출금 권한을 요구하지 않습니다.</p><div className="tf-perm"><span className="yes">✓ 조회</span><span className="yes">✓ 거래</span><span className="no">✕ 출금</span></div><form className="tf-api-form" aria-busy={busy} onSubmit={verifyApi} noValidate><Field label="API Key" value={apiKey} readOnly={busy} onChange={setApiKey} placeholder="발급받은 API Key" error={errors.api} /><Field label="Secret Key" value={secretKey} readOnly={busy} onChange={setSecretKey} type="password" placeholder="발급받은 Secret Key" error={errors.secret} />{guideButton('api')}<button className="tf-btn p tf-space" disabled={busy}>{busy ? busyText : '권한 확인하고 연결하기'}</button></form></>}
    </div>}
    {page === 'done' && <div className="tfw"><div className="tf-donec"><span className="ck"><Check /></span><h3>준비가 끝났어요</h3><p className="pd">{asset} 전략이 TETH에 연결됐습니다.</p><div className="rows">{[['TETH Score', String(result.score)], ['투자금', won(budget)], ['거래소', `${exchange.name} (API •••• ${last4})`], ...(plan === 'partner' ? [['이용료', '₩0, 파트너 플랜']] : [])].map(([label, value]) => <div className="r" key={label}><span className="k">{label}</span><span className="v">{value}</span></div>)}</div><button className="tf-btn p" onClick={startTrading}>전략 시작</button><button className="tf-btn ghost" onClick={() => { onTradingReady?.(); onBack() }}>나중에 시작</button></div></div>}
    {page === 'trading' && <div className="tf-page"><Head onBack={onBack}>내 트레이딩</Head><p className="pd">{exchange.name} 연결됨 (API ••••{last4}), 출금 권한 없음{plan === 'partner' ? ', 파트너 0원 플랜' : plan === 'paid' ? ', 구독 중' : ''}</p><h3>내 전략</h3><div className="tf-strat"><span className="nm">{asset} 위임 전략</span><span className={`st ${running ? 'live' : 'off'}`}>{running ? 'Running' : '중지됨'}</span><span className="m">TETH <b>{result.score}</b></span>{running && <span className="m">오늘 <b className="u">+1.2%</b></span>}<span className="m">검증 수익 <b>+{result.ret}%</b></span><button className="go" onClick={() => setRunning(value => !value)}>{running ? '중지' : '재개'}</button></div><h3>현황</h3><div className="tf-grid">{[['총 자산 (시뮬레이션)', won(budget * (1 + result.ret / 100))], ['전략 누적 손익', `+${won(budget * result.ret / 100)}`], ['실행 중인 전략', `${running ? 1 : 0}개`], ['누적 공유 보상', '₩0']].map(([label, value]) => <div className="tf-dcard" key={label}><div className="k">{label}</div><div className="v">{value}</div></div>)}</div><h3>최근 체결</h3><div className="tf-fills">{[1.8, -1.2, 3.4, 2.1].map((pnl, i) => <div className="tf-fill" key={i}><span className={`sd ${i % 2 ? 's' : 'b'}`}>{i % 2 ? '매도' : '매수'}</span><span>{asset}</span><span className={pnl >= 0 ? 'u' : 'd'}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%</span><span className="tm">8. 27. {10 + i}:00</span></div>)}</div></div>}
    <dialog className="tf-drawer" ref={dialogRef} onCancel={() => setGuide(null)} onClose={() => setGuide(null)} aria-labelledby="tf-guide-title"><div className="dh"><h3 className="t" id="tf-guide-title">{guide === 'api' ? `${exchange.name} API Key 발급 방법` : 'UID 확인 방법'}</h3><button className="x" aria-label="가이드 닫기" onClick={() => setGuide(null)}>×</button></div><ol className="tf-guide">{(guide === 'api' ? exchange.apiGuide : ['거래소 앱 또는 웹에서 로그인', '우측 상단 프로필 아이콘 선택', '프로필 화면 상단에 표시된 숫자가 UID예요']).map(text => <li className="g" key={text}>{text}</li>)}</ol>{guide === 'api' ? <div className="tf-trust"><Shield /><span>출금 권한은 받지 않아요. 당신 돈은 당신 거래소에 있습니다.</span></div> : <p className="tf-assumptions">{exchange.name} 기준이며 다른 거래소도 위치가 비슷해요.</p>}</dialog>
  </div>
}
