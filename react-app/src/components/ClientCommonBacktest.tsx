import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { commonAmounts, commonBacktestInput, commonDate, commonPeriods, commonPreviewProgress, commonPreviewResult, type CommonBacktestPreview } from '../client-common-backtest-preview'
import type { ClientSession } from '../client-experience-store'
import { useClientPreferences } from '../client-preferences'
import { commonBacktestText } from '../client-common-backtest-copy'
import ClientCommonBacktestChart from './ClientCommonBacktestChart'
import ClientCommonDecisions, { type CommonDecisionsHandle } from './ClientCommonDecisions'
import ClientCommonMonths from './ClientCommonMonths'
import { ClientCommonRevisionComparison } from './ClientCommonRevision'
import { revisionText } from '../client-common-revision-copy'
import '../client-common-backtest.css'
import { sourceTerminalPrices, sourceTerminalRsi, type SourceTerminalEvent } from '../client-terminal-source-fixture'
import { responseStrategyForTurn } from '../client-response-strategy'

type Props = { session: ClientSession | undefined; onChange: (value: CommonBacktestPreview) => void; onBack: () => void; onRevise?:()=>void; onBrowse?:()=>void; onRevert?:()=>void; onPrepare?:()=>void }
const Chevron = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>

export default function ClientCommonBacktest({ session, onChange, onBack, onRevise, onBrowse, onRevert, onPrepare }: Props) {
  const { language } = useClientPreferences()
  const input = useMemo(() => session && commonBacktestInput(session), [session])
  const heading = useRef<HTMLHeadingElement>(null)
  const viewport = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const node = viewport.current
    if (!node) return
    // CSS zoom does not reduce dvh. Bound this scrollport to the actual visible
    // space so keyboard-focused actions cannot slide behind the fixed footer.
    const measure = () => {
      const rect = node.getBoundingClientRect()
      const scale = rect.width / node.offsetWidth
      if (!(scale > 0)) return
      const boundary = document.querySelector('.client-development-boundary')?.getBoundingClientRect().top ?? Infinity
      const bottom = Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity, boundary)
      const height = Math.max(0, Math.floor((bottom - Math.max(0, rect.top)) / scale))
      const value = `${height}px`
      if (node.style.maxHeight !== value) node.style.maxHeight = value
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.visualViewport?.removeEventListener('resize', measure) }
  }, [language])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  const renderHeader = (back = onBack, settings = false) => <header className="cbt-head"><button type="button" onClick={back} aria-label={t(settings ? 'backToSettings' : 'back')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button><h1 ref={heading} tabIndex={-1}>{t('title')}</h1></header>
  return <section ref={viewport} className="client-common-bt" data-testid="common-backtest-shell">
    {input ? <CommonRun key={JSON.stringify([session!.id, input.state.turnId])} input={input} session={session!} renderHeader={renderHeader} onChange={onChange} onBack={onBack} onRevise={onRevise} onBrowse={onBrowse} onRevert={onRevert} onPrepare={onPrepare} /> : <>{renderHeader()}<p role="status">{t('missing')}</p></>}
  </section>
}
function CommonRun({ input, session, renderHeader, onChange, onBack, onRevise, onBrowse, onRevert, onPrepare }: { input: NonNullable<ReturnType<typeof commonBacktestInput>>; session:ClientSession; renderHeader: (back?: () => void, settings?: boolean) => ReactNode } & Pick<Props,'onChange'|'onBack'|'onRevise'|'onBrowse'|'onRevert'|'onPrepare'>) {
  const { language } = useClientPreferences()
  const r=(key:Parameters<typeof revisionText>[1])=>revisionText(language,key)
  const proposal = responseStrategyForTurn(session.turns.find(turn => turn.id === input.state.turnId))
  const title = proposal?.name ?? session.title
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  const { state, input: request } = input
  // The source fixture remains an explicit preview. Never label this calculation
  // a server job or synthesize AI analysis / live execution availability.
  const signature = JSON.stringify([request.parameters, state.amount])
  // input is replaced by the store when only the replay clock changes as well.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => commonPreviewResult(input), [signature])
  const [now, setNow] = useState(Date.now)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [limit, setLimit] = useState(30)
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 900px)').matches)
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 768px)').matches)
  const root = useRef<HTMLDivElement>(null)
  const resizeFocus = useRef<HTMLElement | null>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  const decisionList = useRef<CommonDecisionsHandle>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<number | null>(null)
  const selectFromRecord = useCallback((index: number | null) => { setSelectedDay(index); setSelectedTrade(null) }, [])
  const selectFromChart = useCallback((index: number) => {
    if (decisionList.current?.reveal(index)) { setSelectedDay(index); setSelectedTrade(null) }
  }, [])
  useEffect(() => {
    const media = matchMedia('(max-width: 900px)')
    const mobileMedia = matchMedia('(max-width: 768px)')
    const update = () => {
      resizeFocus.current = document.activeElement instanceof HTMLElement && root.current?.contains(document.activeElement) ? document.activeElement : null
      // The browser can blur display:none content before the media event.
      if (!resizeFocus.current && document.activeElement === document.body && lastFocused.current?.isConnected && !lastFocused.current.getClientRects().length) resizeFocus.current = lastFocused.current
      setCompact(media.matches)
      setMobile(mobileMedia.matches)
    }
    media.addEventListener('change', update)
    mobileMedia.addEventListener('change', update)
    return () => { media.removeEventListener('change', update); mobileMedia.removeEventListener('change', update) }
  }, [])
  useLayoutEffect(() => {
    if (resizeFocus.current?.isConnected) {
      if (resizeFocus.current.getClientRects().length) resizeFocus.current.focus({ preventScroll: true })
      else root.current?.closest('.client-common-bt')?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    }
    resizeFocus.current = null
  }, [compact, mobile])
  const progress = commonPreviewProgress(state, now)
  const phase = state.startedAt === undefined ? 'ready' : progress >= 1 ? 'result' : 'run'
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches)
  const action = useRef<HTMLButtonElement>(null)
  const skip = useRef<HTMLButtonElement>(null)
  const focusAfterRun = useRef(false)
  const mutate = (next: CommonBacktestPreview) => { try { onChange(next); setError(false); return true } catch { setError(true); return false } }
  useLayoutEffect(() => {
    // This route owns its scrollport. A focused control removed/reordered by
    // the phase transition can anchor the document thousands of pixels down.
    // Preserve internal reading position; only restore the fixed app shell.
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [phase])
  useEffect(() => {
    if (phase !== 'run') return
    let timer: number | undefined
    const tick = () => {
      if (commonPreviewProgress(state, Date.now()) >= 1 && document.activeElement === skip.current) focusAfterRun.current = true
      setNow(Date.now())
    }
    const update = () => { window.clearInterval(timer); tick(); if (!document.hidden) timer = window.setInterval(tick, 100) }
    update(); document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [phase, state])
  useEffect(() => {
    // Mobile is a setup → replay → results flow. Keep its chart mounted, but
    // begin each explicit setup/replay transition at the visible heading.
    if (mobile && focusAfterRun.current) {
      const shell = root.current?.closest<HTMLElement>('.client-common-bt')
      shell?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
      if (shell) shell.scrollTop = 0
      focusAfterRun.current = false
      return
    }
    if (phase === 'run' && focusAfterRun.current) { skip.current?.focus({ preventScroll: true }); focusAfterRun.current = false }
    if ((phase === 'result' || phase === 'ready') && focusAfterRun.current) { action.current?.focus({ preventScroll: true }); focusAfterRun.current = false }
  }, [phase, mobile])
  const count = phase === 'ready' ? 1 : Math.min(result.points.length, Math.max(1, Math.floor(progress * (result.points.length - 1)) + 1))
  const point = result.points[count - 1]
  const money = (value: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  const pct = (value: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value) + '%'
  const { evaluation } = result
  const reviseFirst = !evaluation.trades.length || evaluation.pnl < 0 || evaluation.nav < result.points.at(-1)!.benchmark
  const wins = evaluation.trades.filter(trade => trade.pnl > 0).length
  const trades = evaluation.trades.filter(trade => filter === 'all' || (filter === 'win' ? trade.pnl > 0 : trade.pnl <= 0))
  const decisions = phase === 'ready' ? [] : evaluation.L.evs.filter(event => event.i <= point.i && (event.k === 'entry' || event.k.startsWith('exit')))
  const eventText = (event: SourceTerminalEvent) => {
    if (language === 'ko') return event.txt
    if (event.k === 'entry') return `RSI(n−1) ${sourceTerminalRsi(event.i - 1).toFixed(1)} < ${request.parameters.rsiTh} · Δ ${pct((sourceTerminalPrices[event.i] / sourceTerminalPrices[event.i - 1] - 1) * 100)} > 0.5%${request.parameters.trendFilter ? ` · ${t('filter')}: |SMA20 − SMA60| / P > 3%` : ''}`
    return event.k === 'exit-sl' ? `${t('stop')} ${pct(request.parameters.sl)}` : event.k === 'exit-tp' ? `${t('take')} ${pct(request.parameters.tp!)}` : `${t('holding')} 25 ${t('days')}`
  }
  const change = (period = state.period, amount = state.amount) => mutate({ turnId: state.turnId, period, amount })
  const rules = [[t('stop'), `${request.parameters.sl}%`], [t('take'), request.parameters.tp === null ? t('noTake') : `${request.parameters.tp}%`], ['RSI', `< ${request.parameters.rsiTh}`], [t('filter'), t(request.parameters.trendFilter ? 'on' : 'off')]]
  if (proposal?.excludedConditions.length) rules.push([t('excludedConditions'), proposal.excludedConditions.join(', ')])
  const terms = [[t('timeframe'), t('daily')], [t('fees'), '0.2%'], [t('entry'), t('previewRule')]]
  const dl = (rows: string[][]) => <dl className="cbt-dl">{rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
  const main = <div className="cbt-main" key="main">
      <div className="cbt-cap"><div><small>{t(phase === 'ready' ? 'amount' : 'final')}</small><b>{money(point.value)}</b>{phase !== 'ready' && <i className={point.value >= state.amount ? 'up' : 'down'}>{pct((point.value / state.amount - 1) * 100)}</i>}</div>
        <div className="cbt-legend"><span className="cbt-legend-strategy">{t('strategy')}</span><span className="cbt-legend-benchmark">{t('benchmark')}</span><span>▲ {t('buy')}</span><span>▽ {t('sell')}</span><span className="cbt-legend-base">{t('amount')} {money(state.amount)}</span></div>
      </div>
      <ClientCommonBacktestChart key={signature + language} result={result} count={count} ready={phase === 'ready'} selectedDay={phase === 'result' ? selectedDay : null} onSelect={selectFromChart} />
      <div className="cbt-panel">
        <div className="cbt-status"><span>{phase === 'ready' ? t('readyNote') : commonDate(point.i)}</span>{phase === 'run' && <button ref={skip} type="button" onClick={() => { focusAfterRun.current = true; if (!mutate({ ...state, skipped: true })) focusAfterRun.current = false }}>{t('skip')}</button>}</div>
        {phase === 'run' && <progress aria-label={t('replay')} max={result.points.length} value={count} />}
        {phase !== 'ready' && <div className="cbt-cells"><div><small>{t('check')}</small><b>{decisions.filter(event => event.k === 'entry').length}</b></div><div><small>{t('trades')}</small><b>{decisions.filter(event => event.k.startsWith('exit')).length}</b></div></div>}
      </div>
      {phase === 'run' && <section className="cbt-evidence"><h3>{t('decisions')}</h3><p className="cbt-muted">{t('notice')}</p><ol className="cbt-events">{decisions.slice(-5).reverse().map(event => <li key={event.i}><time>{commonDate(event.i)}</time><b>{t(event.k === 'entry' ? 'buy' : 'sell')}</b><span>{eventText(event)}</span></li>)}</ol></section>}
    </div>
  const rail = <aside className="cbt-rail" key="rail">
      {phase === 'ready' ? <><section className="cbt-box"><h3>{t('ready')}</h3><div className="cbt-field"><small>{t('period')}</small><div className="cbt-seg" role="group" aria-label={t('period')}>{commonPeriods.map(period => <button key={period} type="button" aria-pressed={state.period === period} onClick={() => change(period)}>{t(`p${period}`)}</button>)}</div></div>
        <div className="cbt-field"><small>{t('amount')} · USD</small><div className="cbt-seg" role="group" aria-label={t('amount')}>{commonAmounts.filter(amount => [500, 1000, 3000, 10000].includes(amount)).map(amount => <button key={amount} type="button" aria-pressed={state.amount === amount} onClick={() => change(state.period, amount)}>{'$' + amount.toLocaleString(language)}</button>)}</div></div>
        <button className="cbt-primary" ref={action} type="button" onClick={() => { focusAfterRun.current = true; setFilter('all'); setLimit(30); setSelectedDay(null); setSelectedTrade(null); if (!mutate({ ...state, startedAt: Date.now(), ...(reduced.current ? { skipped: true } : {}) })) focusAfterRun.current = false }}>{t('run')}</button><p className="cbt-note">{commonDate(request.parameters.startI)} → {commonDate(request.parameters.endI)} · {result.points.length.toLocaleString(language)} {t('days')}</p>
      </section>{[[t('rules'), rules], [t('terms'), terms]].map(([label, rows]) => <details className="cbt-box cbt-fold" key={String(label)} open={matchMedia('(min-width: 901px)').matches}><summary><h3>{String(label)}</h3><Chevron /></summary>{dl(rows as string[][])}</details>)}</>
        : phase === 'run' ? <section className="cbt-box"><h3>{t('current')}</h3><ol className="cbt-steps">{(['prepare', 'replay', 'check', 'wrap'] as const).map((step, index) => <li key={step} className={index === 0 ? 'done' : index < 3 ? 'active' : ''}>{t(step)}</li>)}</ol><p className="cbt-note">{count.toLocaleString(language)} / {result.points.length.toLocaleString(language)} {t('days')}</p></section>
          : <><section className="cbt-box cbt-result" data-testid="common-result"><small>{t(`p${state.period}`)} · {money(state.amount)}</small><p className={evaluation.pnl >= 0 ? 'up' : 'down'}>{money(evaluation.pnl)}</p>{dl([[t('benchmarkPnl'), money(result.points.at(-1)!.benchmark - state.amount)], [t('compare'), money(evaluation.nav - result.points.at(-1)!.benchmark)]])}<div className="cbt-k3">{dl([[t('mdd'), pct(evaluation.r.mdd)], [t('win'), `${wins} / ${evaluation.trades.length}`], [t('hold'), `${Math.round(evaluation.r.avgHold)} ${t('days')}`]])}</div></section>
            <ClientCommonRevisionComparison session={session} onRevert={onRevert}/>
            {evaluation.trades.length===0&&<p className="rv-note">{r('none')}</p>}
            {session.sharedCopy&&<p className="rv-why">{r('copied')}</p>}
            <div className="rv-actions">
              {(!reviseFirst||session.sharedCopy)&&<button className="cbt-primary" type="button" disabled={!onPrepare} onClick={()=>{try{onPrepare?.();setError(false)}catch{setError(true)}}} aria-describedby="cbt-execution-unavailable">{t('execute')}</button>}
              {reviseFirst&&!session.sharedCopy&&onRevise&&<button className="cbt-primary" type="button" onClick={()=>{try{onRevise();setError(false)}catch{setError(true)}}}>{r('fix')}</button>}
              {reviseFirst&&!session.sharedCopy&&<button className="cbt-secondary" type="button" disabled={!onPrepare} onClick={()=>{try{onPrepare?.();setError(false)}catch{setError(true)}}} aria-describedby="cbt-execution-unavailable">{t('execute')}</button>}
              <div className="rv-links">
                {!reviseFirst&&!session.sharedCopy&&onRevise&&<><button type="button" onClick={()=>{try{onRevise();setError(false)}catch{setError(true)}}}>{r('fix')}</button><i aria-hidden="true">·</i></>}
                <button type="button" disabled={Boolean(session.sharedCopy&&!onBrowse)} onClick={()=>{try{if(session.sharedCopy)onBrowse?.();else onBack();setError(false)}catch{setError(true)}}}>{session.sharedCopy?r('browseStrategies'):t('back')}</button>
              </div>
            </div><p id="cbt-execution-unavailable" className="cbt-note">{t('unconnected')}</p>
            <button className="cbt-secondary" ref={action} type="button" onClick={() => { focusAfterRun.current = true; if (!change()) focusAfterRun.current = false; else setSelectedDay(null) }}>{t('rerun')}</button><p className="cbt-note">{t('checked')} · {result.points.length.toLocaleString(language)}</p></>}
      {error && <p role="alert" className="cbt-error">{t('savingError')}</p>}
      {proposal && phase === 'result' && <details className="cbt-box cbt-fold"><summary><h3>{t('rules')}</h3><Chevron /></summary>{dl(rules)}</details>}
      <p className="cbt-note cbt-provenance">{t('preview')}</p>
    </aside>
  return <>{renderHeader(() => {
    if (mobile && phase === 'result') {
      focusAfterRun.current = true
      if (!change()) focusAfterRun.current = false
      else { setSelectedDay(null); setSelectedTrade(null) }
    } else onBack()
  }, mobile && phase === 'result')}<div ref={root} data-testid="common-backtest" data-phase={phase} onFocusCapture={event => { if (event.target instanceof HTMLElement) lastFocused.current = event.target }}>
    <div className="cbt-id"><h2>{title}</h2><p><span>{request.pair}</span><span>{t(`p${state.period}`)}</span></p></div>
    <div className="cbt-grid">{compact && phase === 'ready' ? [rail, main] : [main, rail]}</div>
    {phase === 'result' && <div className="cbt-evidence-stack">
      <ClientCommonDecisions key={signature} ref={decisionList} evaluation={evaluation} onSelect={selectFromRecord} />
      <section className="cbt-evidence"><header><h3>{t('trades')}</h3><div className="cbt-seg" role="group" aria-label={t('trades')}>{(['all', 'win', 'loss'] as const).map(key => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setLimit(30); if (selectedTrade !== null) { setSelectedTrade(null); setSelectedDay(null) } }}>{t(key)} {key === 'all' ? evaluation.trades.length : key === 'win' ? wins : evaluation.trades.length - wins}</button>)}</div></header>
        {trades.length ? <><div className="cbt-trade-head" aria-hidden="true"><span>{t('asset')}</span><span>{t('buy')}</span><span>{t('sell')}</span><span>{t('holding')}</span><span>{t('pnl')}</span><span /></div><ol className="cbt-trades">{trades.slice(0, limit).map(trade => <li key={`${trade.entry}:${trade.exit}`}><details open={selectedTrade === trade.exit}><summary onClick={event => { event.preventDefault(); const next = selectedTrade === trade.exit ? null : trade.exit; setSelectedTrade(next); setSelectedDay(next); decisionList.current?.clear() }}><b>{request.pair}</b><span><small className="cbt-trade-caption">{t('buy')}</small><span className="cbt-chart-sr">BUY </span><time>{commonDate(trade.entry)}</time></span><span><small className="cbt-trade-caption">{t('sell')}</small><span className="cbt-chart-sr">SELL </span><time>{commonDate(trade.exit)}</time></span><span>{trade.exit - trade.entry} {t('days')}</span><b className={trade.pnl > 0 ? 'up' : 'down'}>{pct(trade.pnl * 100)}</b><Chevron /></summary>{dl([[t('pnl'), money(trade.krw)], [t('holding'), `${trade.exit - trade.entry} ${t('days')}`], [t('exit'), trade.kind === 'sl' ? t('stop') : trade.kind === 'tp' ? t('take') : '25 ' + t('days')]])}</details></li>)}</ol></> : <p>{t('empty')}</p>}
        {trades.length > limit && <button className="cbt-secondary cbt-more" type="button" onClick={() => setLimit(value => value + 30)}>{t('more')} · {limit} / {trades.length}</button>}
      </section>
      <ClientCommonMonths points={result.points} capital={state.amount} />
    </div>}
  </div></>
}
