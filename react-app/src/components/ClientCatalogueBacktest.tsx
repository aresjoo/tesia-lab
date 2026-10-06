import { useCataloguePreviewLocale } from '../client-catalogue-preview-locale'
import { useStaticUiCopy } from '../client-static-ui-copy'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { catalogueAssets, catalogueTitle, catalogueUniverses, findCatalogueStrategy, catalogueSourceSha } from '../client-catalogue'
import { catalogueIdentity, catalogueDateReader } from '../client-catalogue-presentation'
import { catalogueChartPath, catalogueChartSeries, catalogueChartTicks } from '../client-catalogue-chart'
import { catalogueBacktestReplay } from '../client-catalogue-backtest-result'
import { createCatalogueBacktestClient, catalogueBacktestUseBinding, catalogueBacktestPeriods, catalogueBacktestAmounts,
  validCatalogueBacktestSelection, type CatalogueBacktestObservation, type CatalogueBacktestSelection, type CatalogueBacktestUseBinding } from '../client-catalogue-backtest'
import { catalogueBacktestCopy as c, catalogueBacktestPeriodLabels as periods } from '../client-catalogue-backtest-copy'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import { ClientCatalogueEvidence } from './ClientCatalogueEvidence'
import { catalogueEvidenceSummary, initialEvidenceState, revealEvidenceMarker, type EvidenceSelection, type EvidenceJump } from '../client-catalogue-evidence-state'
import { catalogueBacktestMarkers } from '../client-catalogue-backtest-marker-groups'
import '../client-catalogue-backtest.css'

export type ClientCatalogueBacktestProps = {
  strategyId: string; owner: string | null; onBack: () => void; onBrowse?: () => void
  onUse?: (signal: AbortSignal, binding: Readonly<CatalogueBacktestUseBinding>) => void | Promise<void>
}
type Saved = CatalogueBacktestSelection & { version: 1; sourceSha: string; startedAt?: number; done?: boolean }
const storageKey = (owner: string, strategyId: string) => `teth-client-catalogue-backtest:${encodeURIComponent(owner)}:${encodeURIComponent(strategyId)}`
function initial(owner: string, strategyId: string): { value: Saved; warning: boolean } {
  const fallback: Saved = { version: 1, sourceSha: catalogueSourceSha, owner, strategyId, period: 365, amount: 1000 }
  try {
    const raw = sessionStorage.getItem(storageKey(owner, strategyId)); if (!raw) return { value: fallback, warning: false }
    const value = JSON.parse(raw) as Saved
    if (value.version !== 1 || value.sourceSha !== catalogueSourceSha || value.owner !== owner || value.strategyId !== strategyId
      || !validCatalogueBacktestSelection(value) || value.startedAt !== undefined && (!Number.isFinite(value.startedAt) || value.startedAt < 0)
      || value.done !== undefined && typeof value.done !== 'boolean') throw Error('invalid saved selection')
    return { value, warning: false }
  } catch { return { value: fallback, warning: true } }
}
const money = (value: number) => `${value < 0 ? '-' : ''}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`
const signedMoney = (value: number) => (Math.round(value) > 0 ? '+' : '') + money(value)
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`

export default function ClientCatalogueBacktest(props: ClientCatalogueBacktestProps) {
  const localeUi = useStaticUiCopy()
  const strategy = findCatalogueStrategy(props.strategyId)
  if (!props.owner || props.owner.trim() !== props.owner || !strategy || strategy.id !== props.strategyId) return <section className="client-catalogue-bt bt" data-testid="catalogue-backtest-unavailable"><h1>{localeUi(c.title)}</h1><p role="status">{localeUi(c.ownerUnavailable)}</p><button type="button" onClick={props.onBack}>{localeUi("뒤로")}</button></section>
  return <Bound key={JSON.stringify([props.owner, props.strategyId])} {...props} owner={props.owner}/>
}
function Bound(props: ClientCatalogueBacktestProps & { owner: string }) {
  const [restored] = useState(() => initial(props.owner, props.strategyId)), [settings, setSettings] = useState(restored.value), [warning, setWarning] = useState(restored.warning)
  const save = (value: Saved) => {
    try { const key=storageKey(props.owner,props.strategyId), encoded=JSON.stringify(value); sessionStorage.setItem(key,encoded); if(sessionStorage.getItem(key)!==encoded) throw Error('selection not saved'); setWarning(false); return true }
    catch { setWarning(true); return false }
  }
  const change = (value: CatalogueBacktestSelection) => {
    const next: Saved = { ...value, version: 1, sourceSha: catalogueSourceSha }
    if (!validCatalogueBacktestSelection(next) || !save(next)) return
    setSettings(next)
  }
  return <Run key={JSON.stringify([settings.period, settings.amount])} {...props} saved={settings} warning={warning} save={save} change={change}/>
}
function Run({ saved, warning, save, change, ...props }: ClientCatalogueBacktestProps & { owner: string; saved: Saved; warning: boolean; save: (v: Saved) => boolean; change: (v: CatalogueBacktestSelection) => void }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const strategy = findCatalogueStrategy(props.strategyId)!, identity = catalogueIdentity(strategy)
  const [client] = useState(createCatalogueBacktestClient), [value, setValue] = useState<CatalogueBacktestObservation | null>(null), [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState(saved.startedAt), [finished, setFinished] = useState(saved.done ?? false), [now, setNow] = useState(Date.now)
  const [usePhase, setUsePhase] = useState<'pending' | 'awaiting' | 'failed' | null>(null), [evidenceState, setEvidenceState] = useState(() => initialEvidenceState(strategy))
  const retired = useRef(false), useRequest = useRef<AbortController | null>(null), heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    retired.current = false
    const controller = new AbortController()
    void client.run({ owner: props.owner, strategyId: props.strategyId, period: saved.period, amount: saved.amount }, controller.signal).then(result => {
      if (!controller.signal.aborted) setValue(result)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : c.ownerUnavailable) })
    return () => { retired.current = true; controller.abort(); useRequest.current?.abort() }
  }, [client, props.owner, props.strategyId, saved.period, saved.amount])
  // Worker creation is lazy and request-scoped. StrictMode effect replay aborts
  // the old request; disposing after retirement cannot cancel a remounted owner.
  useEffect(() => () => { queueMicrotask(() => { if (retired.current) client.dispose() }) }, [client])
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const replay = useMemo(() => value && catalogueBacktestReplay(value), [value])
  const phase = startedAt === undefined ? 'ready' : finished || replay && now - startedAt >= replay.duration ? 'result' : 'run'
  useEffect(() => {
    if (phase !== 'run') return
    const tick = () => setNow(Date.now()), timer = window.setInterval(tick, 100)
    document.addEventListener('visibilitychange', tick); window.addEventListener('pageshow', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick) }
  }, [phase])
  const cancelUse = () => { useRequest.current?.abort(); useRequest.current = null }
  const back = () => { cancelUse(); if (phase === 'run') { if (save({ ...saved, startedAt: undefined, done: false })) { setStartedAt(undefined); setFinished(false) }; return }; props.onBack() }
  const begin = () => {
    if (!value || usePhase === 'pending') return
    const time = Date.now()
    if (!save({ ...saved, startedAt: time, done: false })) return
    cancelUse(); setUsePhase(null); setStartedAt(time); setNow(time); setFinished(false)
  }
  const skip = () => { if (value && save({ ...saved, startedAt, done: true })) { setFinished(true); setNow(Date.now()) } }
  const rerun = () => { if (!save({ ...saved, startedAt: undefined, done: false })) return; cancelUse(); setUsePhase(null); setStartedAt(undefined); setFinished(false); setEvidenceState(initialEvidenceState(strategy)) }
  const use = () => {
    if (!value || phase !== 'result' || !props.onUse || warning || usePhase === 'pending' || usePhase === 'awaiting') return
    const controller = new AbortController(); cancelUse(); useRequest.current = controller; setUsePhase('pending')
    let work: void | Promise<void>
    try { work = props.onUse(controller.signal, catalogueBacktestUseBinding(value)) } catch { if (!retired.current && !controller.signal.aborted) setUsePhase('failed'); return }
    void Promise.resolve(work).then(() => { if (!retired.current && !controller.signal.aborted && useRequest.current === controller) setUsePhase('awaiting') }, () => { if (!retired.current && !controller.signal.aborted && useRequest.current === controller) setUsePhase('failed') })
  }
  const elapsed = startedAt === undefined ? 0 : now - startedAt, segment = replay?.segments.find(s => elapsed >= s.start && elapsed < s.end)
  const index = phase === 'result' ? (value?.result.eq.length ?? 1) - 1 : phase === 'ready' ? -1 : segment ? Math.floor(segment.a + (segment.b - segment.a) * Math.min(1, (elapsed - segment.start) / Math.max(1, segment.end - segment.start))) : elapsed < 700 ? -1 : (value?.result.eq.length ?? 1) - 1
  const date = value ? catalogueDateReader(value.calendar) : null
  const dateText = (i: number) => { const d = date!(i); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` }
  const point = value?.result.eq[Math.max(0, index)], amount = phase === 'ready' || index < 0 ? saved.amount : (point?.v ?? 1) * saved.amount
  const eq = value?.result.eq ?? [], final = eq.at(-1)?.v ?? 1, profit = (final - 1) * saved.amount, benchmarkProfit = (value?.benchmark.at(-1)?.v ?? 1) * saved.amount - saved.amount
  const difference = Math.round(profit + saved.amount) - Math.round(benchmarkProfit + saved.amount)
  const ai = strategy.kind === 'agent' || strategy.kind === 'mix' && strategy.gate > 0
  const summary = value ? catalogueEvidenceSummary(value) : []
  const rules = sourceRules(strategy), assets = catalogueAssets(strategy)
  const selectEvent = (ix: number, ix2 = ix, individual = false) => { if (value) setEvidenceState(state => revealEvidenceMarker(state, value.evidence, strategy, ix, ix2, individual)) }
  const jump = (key: EvidenceJump) => {
    const trade = key === 'win' || key === 'loss'
    setEvidenceState(state => trade ? { ...state, tradeFilter: key, tradeCount: 8 } : { ...state, filter: key, count: 12, group: null, selection: state.selection?.type === 'trade' ? state.selection : null })
    requestAnimationFrame(() => heading.current?.closest('.client-catalogue-bt')?.querySelector(trade ? '#bt-trs' : '#bt-dec')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }))
  }
  return <section className="client-catalogue-bt bt" data-testid="catalogue-backtest-shell" data-phase={phase} data-kind={strategy.kind} data-source="client-snapshot-preview" data-strategy-id={strategy.id} data-period={saved.period} data-amount={saved.amount}>
    <header className="tfw-hd bt-hd"><button type="button" className="bk" onClick={back} aria-label={localeUi("뒤로")}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h1 ref={heading} tabIndex={-1} className="ti">{localeUi(c.title)}</h1><span className="sb">{localeUi('{period}, {amount}로 시작', { period: localeUi(periods[saved.period]), amount: money(saved.amount) })}</span></header>
    <div className="bt-id"><ClientStrategyGlyph kind={identity.kind} evidence={identity.glyph} size={44}/><div className="bt-id-t"><h2>{previewLocale.text(identity.title)}</h2><p>{previewLocale.text(identity.description)}</p><div className="bt-id-m"><b>{previewLocale.text({ rule: '규칙', mix: 'AI와 규칙', agent: 'AI 판단' }[strategy.kind])}</b><span>{previewLocale.text(identity.asset)}</span><span>{strategy.fut ? localeUi("선물") : localeUi("현물")}</span></div></div></div>
    {warning && <p className="bt-note" role="status">{localeUi(c.storage)}</p>}
    {error && <p className="bt-note" role="alert">{error}</p>}
    {!value && !error && <p role="status">{localeUi(c.loading)}</p>}
    {value && <div className="bt-grid"><div className="bt-main">
      <div className="bt-cap"><div className="bt-cap-l"><small>{phase === 'ready' ? localeUi(c.amount) : phase === 'result' ? localeUi("남은 금액") : localeUi("지금")}</small><b className="num">{money(amount)}</b>{phase === 'result' && <i className="num">{percent(value.result.ret)}</i>}</div><div className="bt-leg"><span className="a">{localeUi("이 전략")}</span><span className="b">{localeUi("그냥 들고 있었다면 ")}{phase === 'result' ? percent(value.benchmarkReturn) : ''}</span></div></div>
      <BacktestChart value={value} count={Math.max(1, index + 1)} ready={phase === 'ready'} interactive={phase === 'result'} onEvent={selectEvent} evidenceSelection={evidenceState.selection}/>
      <section className={`bt-panel c${ai ? 3 : 2}${phase === 'result' ? ' sum' : ''}`}><div className="ph" role="status"><span className={`bt-dot ${phase === 'run' ? 'run' : 'idle'}`}/><b>{phase === 'run' && point ? dateText(point.i) : ''}</b><span>{phase === 'ready' ? ai ? localeUi("다시 돌리는 동안 기회가 생길 때마다 확인 과정이 여기에 보입니다") : localeUi("다시 돌리는 동안 사는 조건이 맞을 때마다 여기에 보입니다") : phase === 'run' ? localeUi("하루씩 다시 돌리기") : localeUi("결과 정리")}</span>{phase === 'run' && <button type="button" className="bt-skip" onClick={skip}>{localeUi(c.skip)}</button>}</div><div className="pc">{phase === 'result' ? summary.map(([label, links, caption], i) => <div className="cell on sum" key={label}><small><i className="num">{i + 1}</i>{previewLocale.text(label)}</small><b>{links.map(([text, key]) => <button key={key} type="button" className={`k-${key}`} onClick={() => jump(key)}>{previewLocale.text(text, !!strategy.fut)}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>)}</b><span>{previewLocale.text(caption, !!strategy.fut)}</span></div>) : (strategy.kind === 'agent' ? ['AI 재평가', '시장 확인', '결정'] : ai ? ['기회 발견', 'AI 확인', '결정'] : ['조건 충족', '결정']).map((label, i) => <div className={`cell ${segment?.stop ? 'on' : ''}`} key={label}><small><i>{i + 1}</i>{previewLocale.text(label)}</small><b>{segment?.stop ? segment.stop.kind === 'buy' ? localeUi("조건에 맞아 진입") : segment.stop.kind === 'hold' ? localeUi("그대로 유지") : localeUi("새로 사지 않음") : ''}</b><span/></div>)}</div></section>
      {phase === 'result' && <ClientCatalogueEvidence value={value} state={evidenceState} onChange={setEvidenceState}/>}
    </div><aside className="bt-rail">
      {phase === 'ready' && <><section className="bt-box bt-set"><h3>{localeUi(c.conditions)}</h3><div className="bt-f"><small>{localeUi(c.period)}</small><div className="bt-seg" role="group" aria-label={localeUi(c.period)}>{catalogueBacktestPeriods.map(period => <button type="button" key={period} aria-pressed={saved.period === period} onClick={() => change({ ...saved, period })}>{localeUi(periods[period])}</button>)}</div></div><div className="bt-f"><small>{localeUi(c.amount)}</small><div className="bt-seg" role="group" aria-label={localeUi(c.amount)}>{catalogueBacktestAmounts.map(amount => <button type="button" key={amount} aria-pressed={saved.amount === amount} onClick={() => change({ ...saved, amount })}>{amount.toLocaleString('en-US')}</button>)}</div><em>USD</em></div><button type="button" className="bt-cta" onClick={begin}>{localeUi(c.start)}</button><p className="bt-note">{localeUi('{from}부터 {to}까지, {days}일을 하루씩 다시 돌립니다.', { from: dateText(eq[0].i), to: dateText(eq.at(-1)!.i), days: localeUi.number(eq.length) })}</p></section><details className="bt-box bt-fold" open><summary><h3>{localeUi(c.rules)}</h3></summary><dl className="bt-dl">{rules.map(([label, rule]) => <div key={label}><dt>{previewLocale.text(label)}</dt><dd>{previewLocale.text(rule, !!strategy.fut)}</dd></div>)}</dl></details><details className="bt-box bt-fold bt-terms"><summary><h3>{localeUi(c.terms)}</h3></summary><dl className="bt-dl"><div><dt>{localeUi("판단 시점")}</dt><dd>{strategy.fut ? localeUi("하루 한 번, UTC 0시 종가로 정하고 다음 날 시가에 체결") : localeUi("하루 한 번, 그날 마지막 가격으로")}</dd></div><div><dt>{localeUi("비용")}</dt><dd>{strategy.fut ? localeUi("체결 금액의 수수료 0.055%, 슬리피지 0.05%, 펀딩비는 실제 기록대로") : localeUi("살 때와 팔 때마다 수수료 0.1%")}</dd></div><div><dt>{localeUi("비교 대상")}</dt><dd>{assets.length > 1 ? localeUi("같은 종목을 똑같이 나눠 그냥 들고 있었을 때") : localeUi("같은 종목을 그냥 들고 있었을 때")}</dd></div></dl></details></>}
      {phase === 'run' && <section className="bt-box bt-read"><h3>{localeUi("하루씩 다시 돌리기")}</h3><p>{localeUi(ai ? '가격 자료 준비 → 하루씩 다시 돌리기 → 기회마다 AI 확인 → 결과 정리' : '가격 자료 준비 → 하루씩 다시 돌리기 → 사는 조건 확인 → 결과 정리')}</p></section>}
      {phase === 'result' && <><section className="bt-box bt-verdict"><small>{localeUi('{period} 동안, {amount}로', { period: localeUi(periods[saved.period]), amount: money(saved.amount) })}</small><p className="bt-v1b"><b className="num">{signedMoney(profit)}</b></p><p className="bt-v2"><span>{localeUi("그냥 들고 있었다면 ")}<i className="num">{signedMoney(benchmarkProfit)}</i></span><b>{localeUi(difference >= 0 ? '그보다 {amount} 많음' : '그보다 {amount} 적음', { amount: money(Math.abs(difference)) })}</b></p><div className="bt-k3"><div><small>{localeUi("가장 크게 내려간 폭")}</small><b>{value.result.mdd.toFixed(1)}%</b><em>{localeUi("그냥 들고 있었다면 ")}{value.benchmarkMdd.toFixed(1)}%</em></div><div><small>{localeUi("이긴 거래")}</small><b>{value.result.n ? localeUi('{total}번 중 {wins}번', { total: value.result.n, wins: value.result.trades.filter(t => t.pnl > 0).length }) : localeUi("아직 없음")}</b></div><div><small>{localeUi("평균 보유")}</small><b>{value.result.avgHold === null ? '—' : localeUi('{days}일', { days: Math.round(value.result.avgHold) })}</b></div></div></section><section className="bt-box bt-read v2 fail"><h3>{localeUi(c.readTitle)}</h3><p className="f">{localeUi(c.readUnavailable)}</p></section>{!value.result.n && <p className="rv-note">{localeUi(c.noTrades)}</p>}<button type="button" className="bt-cta" onClick={use} disabled={!props.onUse || warning || usePhase === 'pending' || usePhase === 'awaiting'}>{localeUi(c.execute)}</button>{!props.onUse && <p className="bt-note">{localeUi(c.callbackUnavailable)}</p>}{usePhase && <p role={usePhase === 'failed' ? 'alert' : 'status'}>{localeUi(c[usePhase === 'pending' ? 'callbackPending' : usePhase === 'awaiting' ? 'callbackAwaiting' : 'callbackFailed'])}</p>}<button type="button" className="bt-sec" onClick={rerun}>{localeUi(c.rerun)}</button>{props.onBrowse && <p className="rv-links"><button type="button" onClick={() => { cancelUse(); props.onBrowse?.() }}>{localeUi(c.browse)}</button></p>}<p className="bt-rec">{localeUi('가격 {prices}개, {days}일을 확인했습니다', { prices: localeUi.number(assets.length * eq.length), days: localeUi.number(eq.length) })}</p></>}
    </aside></div>}
    {value && phase === 'result' && <div className="bt-mcta"><div><b>{signedMoney(profit)}</b><span>{localeUi(periods[saved.period])}</span></div><button type="button" className="bt-cta" onClick={use} disabled={!props.onUse || warning || usePhase==='pending' || usePhase==='awaiting'}>{localeUi(c.execute)}</button><button type="button" className="bt-mobile-rerun" onClick={rerun}>{localeUi(c.rerun)}</button>{(!props.onUse||usePhase) && <p className="bt-mobile-status" role={usePhase==='failed'?'alert':'status'}>{localeUi(!props.onUse?c.callbackUnavailable:usePhase==='pending'?c.callbackPending:usePhase==='awaiting'?c.callbackAwaiting:c.callbackFailed)}</p>}</div>}
    <p className="bt-note catalogue-backtest-boundary">{localeUi(c.preview)}</p>
  </section>
}

function sourceRules(strategy: NonNullable<ReturnType<typeof findCatalogueStrategy>>): [string, string][] {
  const assets = catalogueAssets(strategy), universe = strategy.kind === 'rule' ? catalogueTitle(strategy.asset) : catalogueUniverses[strategy.uni].label
  if (strategy.fut) {
    const rows: [string,string][] = [], outs: string[] = []
    if (strategy.kind !== 'rule') {
      const n = assets.length, L = Math.ceil(strategy.gate * n - 1e-9), S = Math.floor((1 - strategy.gate) * n + 1e-9)
      const ev = strategy.every === 1 ? '매일' : `${strategy.every}일마다`, cL = L >= n ? `${n}종목이 모두 오름세면` : `오름세 종목이 ${L}개 이상이면`, cS = S <= 0 ? '하나도 오름세가 아니면' : `오름세 종목이 ${S}개 이하면`
      rows.push([strategy.kind === 'agent' ? 'AI 판단' : '방향과 종목', strategy.kind === 'agent' ? `${ev} ${n}종목을 비교합니다. ${cL} 가장 강한 ${strategy.top}종목을 롱, ${cS} 가장 약한 ${strategy.top}종목을 숏${L-S>1?', 그 사이면 쉽니다':''}` : `AI가 ${ev} 방향과 종목을 정합니다. ${cL} 가장 강한 종목을 롱 후보로, ${cS} 가장 약한 종목을 숏 후보로${L-S>1?', 그 사이면 후보를 비웁니다':' 고릅니다'}`])
    }
    if (strategy.kind !== 'agent') {
      const signal = strategy.mode === 'brk' ? `종가가 최근 ${strategy.n}일 최고가를 넘으면 롱, 최근 ${strategy.n}일 최저가 아래로 내려가면 숏` : strategy.mode === 'ma' ? `${strategy.fast}일 평균 가격이 ${strategy.slow}일 평균을 위로 넘으면 롱, 아래로 내려가면 숏` : strategy.mode === 'dip' ? `최근 ${strategy.n}일 고점에서 ${strategy.dip}% 넘게 밀렸다가 반등하면 롱, 저점에서 ${strategy.dip}% 넘게 올랐다가 꺾이면 숏` : `공포 탐욕 지수가 ${strategy.lo} 이하일 때 반등하면 롱, ${strategy.hi} 이상일 때 꺾이면 숏`
      rows.push(['진입', signal + (strategy.reg ? `. 롱은 ${strategy.reg}일 평균 위, 숏은 아래에서만` : '')]); outs.push('반대 방향 신호가 나오면 닫고 방향을 바꿉니다')
      if (strategy.exitN) outs.push(`종가가 반대쪽 ${strategy.exitN}일 기준선을 벗어나면 닫습니다`)
    }
    if (strategy.trail) outs.push(`가장 유리했던 종가에서 ${strategy.trail}% 되돌리면 닫습니다`)
    if (strategy.sl) outs.push(`진입가에서 ${strategy.sl}% 불리하게 움직이면 닫습니다`)
    if (strategy.tp) outs.push(`진입가에서 ${strategy.tp}% 유리하게 움직이면 닫습니다`)
    if (strategy.hold) outs.push(`길어도 ${strategy.hold}일`)
    rows.push(['청산', outs.join('. ') || '재평가 때 방향이나 순위가 바뀌면 닫습니다'], ['레버리지', strategy.lev>1 ? `${strategy.lev}배, 손실은 넣은 증거금까지` : '1배'])
    return rows
  }
  if (strategy.kind === 'agent') return [['종목 고르기', `AI가 ${strategy.every}일마다 ${universe}을 비교해 최대 ${strategy.top}종목`], ['쉬는 때', `오름세 종목이 ${assets.length}개 중 ${Math.ceil(strategy.gate * assets.length)}개 미만이면 새로 사지 않음`], ['파는 때', `든 뒤 가장 높았던 가격에서 ${strategy.trail}% 밀리면`]]
  const rules: [string, string][] = []
  if (strategy.kind === 'mix') rules.push(['종목 고르기', `AI가 ${strategy.every}일마다 ${universe} 중 가장 강한 하나`])
  rules.push(['사는 때', `되돌림 점수가 ${strategy.rsiTh} 아래로 내려간 뒤 하루 만에 0.5% 넘게 다시 오르면${'tf' in strategy && strategy.tf ? ', 오름세일 때만' : ''}${'fng' in strategy && strategy.fng != null ? `, 공포 탐욕 지수가 ${strategy.fng} 이하일 때만` : ''}`])
  if (strategy.kind === 'mix' && strategy.gate > 0) rules.push(['AI 확인', `조건이 맞아도 오름세 종목이 ${assets.length}개 중 ${Math.ceil(strategy.gate * assets.length)}개 미만이면 사지 않음`])
  rules.push(['파는 때', `${strategy.tp != null ? `+${strategy.tp}% 오르거나 ` : ''}${strategy.sl}% 내리면, 또는 25일이 지나면`])
  return rules
}


/** Shared source tick/path helpers, with bt's strategy/benchmark on ONE amount-scaled domain. */
function BacktestChart({ value, count, ready, interactive, onEvent, evidenceSelection }: { value: CatalogueBacktestObservation; count: number; ready: boolean; interactive: boolean; onEvent:(ix: number, ix2?: number, individual?: boolean)=>void; evidenceSelection: EvidenceSelection }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const id = useId(), [selected, setSelected] = useState<number | null>(null), [width, setWidth] = useState(800), host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { const h = host.current; if (!h) return; const update = () => setWidth(h.clientWidth); update(); const observer = new ResizeObserver(update); observer.observe(h); return () => observer.disconnect() }, [])
  const full = useMemo(() => catalogueChartSeries(value, 0, 'bal', 'day', value.amount)!, [value])
  const benchmark = useMemo(() => value.benchmark.map(p => ({ i: p.i, value: p.v * value.amount })), [value])
  const ticks = useMemo(() => {
    const all = full.points.map(p => p.value).concat(benchmark.map(p => p.value), value.amount)
    return catalogueChartTicks(Math.min(...all), Math.max(...all))
  }, [full, benchmark, value.amount])
  const { W, H, left, right, top, bottom, x, y } = useMemo(() => {
    const W = Math.max(300, width), H = W < 560 ? 240 : 340, left = W < 560 ? 46 : 64, right = W - (W < 560 ? 8 : 18), top = 26, bottom = H - 40
    const x = (i: number) => left + i / Math.max(1, full.points.length - 1) * (right - left), y = (v: number) => top + (1 - (v - ticks[0]) / (ticks.at(-1)! - ticks[0])) * (bottom - top)
    return { W, H, left, right, top, bottom, x, y }
  }, [width, full, ticks])
  const n = ready ? full.points.length : Math.min(full.points.length, count)
  const paths = useMemo(() => {
    const draw = (points: readonly { value: number }[]) => catalogueChartPath(points.slice(0, n).map((p, i) => ({ x: x(i), y: y(p.value) })), top, bottom)
    return { benchmark: draw(benchmark), strategy: draw(full.points) }
  }, [benchmark, full, n, x, y, top, bottom])
  const select = (index: number) => setSelected(Math.max(0, Math.min(n - 1, index))), point = selected === null ? null : full.points[Math.min(selected, n - 1)]
  const markers = useMemo(() => catalogueBacktestMarkers(value.evidence.decisions, interactive, x).filter(m => m.j < n), [value.evidence.decisions, interactive, x, n])
  // Pointer-only selection reuses the unchanged source paths and accessible rows.
  const tickNodes = useMemo(() => ticks.map(tick => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,.08)"/><text x={left - 8} y={y(tick) + 4} fill="#8b9096" fontSize="11" textAnchor="end">{money(tick)}</text></g>), [ticks, left, right, y])
  const markerNodes = useMemo(() => !ready && markers.map(m => {
      const offset = m.k === 'skip' ? -20 : m.k === 'buy' && m.side !== -1 ? 11 : -11, decision = value.evidence.decisions[m.ix], raw = value.result.events[decision.eventIndex]
      const choose = () => { if (interactive) onEvent(m.ix, m.k === 'skip' ? m.ix2 : m.ix) }
      return <g key={m.ix} className="bt-marker-anchor" role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={localeUi(m.k === 'skip' && m.n > 1 ? '{date} {title} 외 {count}번 판단 근거' : '{date} {title} 판단 근거', { date: full.points[m.j].date, title: previewLocale.text(m.title, !!value.strategy.fut), count: m.n - 1 })} data-backtest-marker={raw.t} data-marker-index={m.ix} data-marker-index2={m.ix2} data-marker-count={m.n} data-run-id={value.runId} transform={`translate(${x(m.j)},${y(full.points[m.j].value) + offset})`} onPointerMove={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); choose() }} onKeyDown={event => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.stopPropagation(); event.preventDefault(); choose() } }}>
        <title>{previewLocale.text(m.title, !!value.strategy.fut)}</title><g className={`bt-m on k-${m.k}`}><rect x="-11" y="-9" width="22" height="20" fill="transparent"/>
        {m.k === 'skip' ? <><path d="M0-5L5 0 0 5-5 0Z" fill="#15171a" stroke="#f0b840" strokeWidth="1.7"/>{m.n > 1 && <text x="9" y="-7" fontSize="10.5" fontWeight="700" fill="#f0b840">{m.n}{localeUi("번")}</text>}</> : <path d={m.k === 'buy' && m.side !== -1 ? 'M0-4L5 4H-5Z' : 'M0 4L5-4H-5Z'} fill={m.k === 'buy' ? m.side === -1 ? '#b08cf5' : '#2fb98a' : '#15171a'} stroke={m.k === 'sell' ? '#cfd3d8' : undefined} strokeWidth="1.5"/>}
      </g></g>
    }), [ready, markers, value.evidence.decisions, value.result.events, value.runId, value.strategy.fut, interactive, onEvent, full, x, y, localeUi, previewLocale])
  const markerList = useMemo(() => interactive && <details className="bt-marker-list" onPointerMove={event => event.stopPropagation()}><summary>{localeUi("차트의 판단 모두 보기 ")}<span className="num">{localeUi('{count}건', { count: value.evidence.decisions.length })}</span></summary><div>{value.evidence.decisions.map(d => <button key={d.ix} type="button" data-marker-decision-index={d.ix} onClick={() => onEvent(d.ix, d.ix, true)}>{full.points[d.j].date} · {d.tk ? `${d.tk} ` : ''}{previewLocale.text(d.tag, !!value.strategy.fut)}</button>)}</div></details>, [interactive, value.evidence.decisions, value.strategy.fut, full, onEvent, localeUi, previewLocale])
  const pin = evidenceSelection?.runId === value.runId ? evidenceSelection.j : null
  return <div className="bt-chart" ref={host} tabIndex={0} role="region" aria-label={localeUi("백테스트 자산과 그냥 보유 비교 차트")} aria-describedby={id} onKeyDown={event => {
    if (event.target instanceof Element && event.target.closest('.bt-marker-list')) return
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) { event.preventDefault(); if (event.key === 'Escape') setSelected(null); else select(event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : (selected ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1)) }
  }} onPointerLeave={() => setSelected(null)} onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); select(Math.round(((event.clientX - box.left) / box.width * W - left) / (right - left) * (full.points.length - 1))) }}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={localeUi("선택한 금액으로 다시 계산한 전략과 보유 금액")}><g>{tickNodes}</g><path data-series="benchmark" d={paths.benchmark} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeDasharray="4 4"/><path data-series="strategy" d={paths.strategy} fill="none" stroke="#2fb98a" strokeWidth="2" opacity={ready ? .35 : 1}/>{markerNodes}{pin !== null && pin >= 0 && pin < full.points.length && <g className="bt-selection-pin" pointerEvents="none"><line x1={x(pin)} x2={x(pin)} y1={top} y2={bottom} stroke="#f0b840" strokeWidth="1.2"/><circle cx={x(pin)} cy={y(full.points[pin].value)} r="5" fill="#f0b840"/></g>}<text x={left} y={H - 14} fill="#8b9096" fontSize="11">{full.points[0].date}</text><text x={right} y={H - 14} fill="#8b9096" fontSize="11" textAnchor="end">{full.points.at(-1)!.date}</text>{point && <><line x1={x(selected!)} x2={x(selected!)} y1={top} y2={bottom} stroke="rgba(255,255,255,.5)"/><circle cx={x(selected!)} cy={y(point.value)} r="4" fill="#2fb98a"/></>}</svg>
    <p id={id} className="catalogue-backtest-chart-status" role="status">{point ? localeUi('{date} · 이 전략 {amount} · 그냥 보유 {benchmark}', { date: point.date, amount: money(point.value), benchmark: money(benchmark[selected!].value) }) : localeUi("좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.")}</p>
    {markerList}
  </div>
}
