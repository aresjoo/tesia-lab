import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { evaluatedText, evaluatedEvidenceLabel, evaluatedGateLabel, evaluatedContextLabel, type EvaluatedCatalogue, type EvaluatedStrategy } from '../client-evaluated-strategy-catalogue'
import { evaluatedStrategyIdentity } from '../client-evaluated-strategy-identity'
import { evaluatedExecutionDestination, evaluatedExecutionHint } from '../client-evaluated-execution'
import { evaluatedDetailText, evaluatedPeriodLabel, evaluatedJudgmentHeading, evaluatedMixPolicyCopy } from '../client-evaluated-detail-copy'
import type { SharedLocation } from '../client-shared-strategies'
import { sharedPercent } from '../client-shared-number-format'
import { catalogueFirstSentence } from '../client-catalogue-first-sentence'
import { catalogueHeaderText } from '../client-catalogue-detail-header-copy'
import { sharingCopy } from '../client-sharing-copy'
import { useCatalogueOrdersNavigation } from '../use-catalogue-orders-navigation'
import type { CatalogueChartInterval, CatalogueChartMode } from '../client-catalogue-chart'
import { ClientEvaluatedStrategyChart, ClientEvaluatedStrategyChartControls, type EvaluatedChartSeries } from './ClientEvaluatedStrategyChart'
import { ClientSharedDetailShell } from './ClientSharedDetailShell'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import copy from '../client-catalogue-ui-copy.json'
import kindCopy from '../client-strategy-filter-copy.json'
import judgmentCopy from '../client-catalogue-judgment-copy.json'
import ordersCopy from '../client-catalogue-orders-copy.json'
import '../client-catalogue.css'
import '../client-catalogue-detail-header.css'
import '../client-catalogue-judgments.css'
import '../client-shared-performance.css'
import type { IssuedSourceBinding } from '../copy-execution/presentation'
import { sharingUnavailable } from '../client-sharing-presentation'
import { discoveredPolicyDetails } from '../client-discovered-strategy-catalogue'
import { ceilMinimumUsdt } from '../client-execution-minimum'

type Props = {
  item: EvaluatedStrategy; catalogue: EvaluatedCatalogue; location: SharedLocation
  title: RefObject<HTMLHeadingElement | null>; onNavigate: (value: SharedLocation, replace?: boolean) => void
  onWatch?: () => void; onCopyLink?: () => void; watched?: boolean; watchDisabled?: boolean
  onCopy?: () => void; copyBusy?: boolean; minimumUsdt?: string | null; issuedBinding?: IssuedSourceBinding | null
}

export function ClientEvaluatedStrategyDetail({ item, catalogue, location, title, onNavigate, onWatch, onCopyLink, onCopy, copyBusy = false, minimumUsdt, issuedBinding, watched = false, watchDisabled = false }: Props) {
  const { language } = useClientPreferences(), text = copy[language], jud = judgmentCopy[language]
  const t = (key: Parameters<typeof evaluatedText>[1]) => evaluatedText(language, key)
  const h = (key: Parameters<typeof catalogueHeaderText>[1]) => catalogueHeaderText(language, key)
  const id = useId(), [expanded, setExpanded] = useState(false), [days, setDays] = useState(30)
  const [mode, setMode] = useState<CatalogueChartMode>('ret'), [interval, setInterval] = useState<CatalogueChartInterval>('day')
  const [menuOpen, setMenuOpen] = useState(false)
  const [captionAt, setCaptionAt] = useState<string | null>(null)
  const menu = useRef<HTMLDivElement>(null), menuTrigger = useRef<HTMLButtonElement>(null), menuItems = useRef<(HTMLButtonElement | null)[]>([])
  const reveal = useRef<HTMLLIElement>(null), revealPending = useRef(false)
  const navigation = useCatalogueOrdersNavigation(location, onNavigate)
  const identity = evaluatedStrategyIdentity(item, language), execution = evaluatedExecutionDestination(language, Boolean(issuedBinding))
  const minimum = minimumUsdt ? ceilMinimumUsdt(minimumUsdt) : null
  const label = (value: string | null) => evaluatedEvidenceLabel(language, value)
  const context = (key: Parameters<typeof evaluatedContextLabel>[1], count = 0) => evaluatedContextLabel(language, key, count)
  const date = (at: string) => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)) + ' UTC'
  const lastDay = new Date(Date.parse(catalogue.period.endExclusive) - 1).toISOString()
  const periodLabel = `${catalogue.period.startAt.slice(0, 10)} → ${lastDay.slice(0, 10)}`
  const number = (value: string | number) => new Intl.NumberFormat(language, { maximumFractionDigits: 8 }).format(Number(value))
  const signClass = (value: number) => value < 0 ? 'catalogue-loss' : value > 0 ? 'catalogue-gain' : undefined
  const amount = Number(item.equity[0].value)
  const observationDate = (at: string) => at.slice(0, 10)
  const closingMonth = (at: string) => new Date(Date.parse(at) - (Date.parse(at) % 86_400_000 === 0 ? 1 : 0)).toISOString().slice(0, 7)
  const chartWindow = useMemo(() => {
    const end = Date.parse(item.equity.at(-1)!.at), cutoff = days ? end - days * 86_400_000 : -Infinity
    // Use the last real observation at the boundary; never pad missing days.
    let start = item.equity.findIndex(point => Date.parse(point.at) >= cutoff)
    if (start < 0) start = item.equity.length - 1
    if (start && Date.parse(item.equity[start].at) > cutoff) start--
    const points = item.equity.slice(start), first = Number(points[0].value)
    return { points, first, full: start === 0, percent: start === 0 ? Number(item.evaluation.returnPct) : (Number(points.at(-1)!.value) / first - 1) * 100 }
  }, [item, days])
  const series: EvaluatedChartSeries = {
    points: chartWindow.points.map((point, i) => ({ i, date: observationDate(point.at), at: point.at, month: i === 0 ? point.at.slice(0, 7) : closingMonth(point.at), value: mode === 'bal' ? Number(point.value) : mode === 'pnl' ? Number(point.value) - chartWindow.first : (Number(point.value) / chartWindow.first - 1) * 100 })),
    flat: chartWindow.points.every(point => Number(point.value) === chartWindow.first),
  }
  if (interval === 'month') {
    const last = new Map<string, typeof series.points[number]>()
    for (const point of series.points) last.set(point.month!, point)
    series.points = [series.points[0], ...Array.from(last.values()).filter(point => point !== series.points[0])]
  }
  const captionPoint = item.equity.find(point => point.at === captionAt) ?? item.equity.at(-1)!
  const period = evaluatedPeriodLabel(language, days)
  const judgmentHeading = evaluatedJudgmentHeading(language, item.kind)
  const metrics = [[`${period} ${text.return}`, sharedPercent(chartWindow.percent, language)], [text.mdd, chartWindow.full ? sharedPercent(Number(Number(item.evaluation.maxDrawdownPct).toFixed(2)) === 0 ? 0 : -Number(item.evaluation.maxDrawdownPct), language, 2, false) : '—'], [text.win, item.evaluation.winRatePct === null || item.evaluation.tradeCount < 5 ? '—' : sharedPercent(Number(item.evaluation.winRatePct), language, 2, false)], [text.trades, number(item.evaluation.tradeCount)]]
  const mixPolicy = evaluatedMixPolicyCopy(item, language)
  const generated = item.discovery ? discoveredPolicyDetails(item, language) : null
  const description = generated ? generated.summary : item.kind === 'rule' ? `${identity.description} ${context('ruleTiming')}` : item.kind === 'mix' ? mixPolicy.description : identity.description
  const originalRule = item.kind === 'rule' && !item.discovery
  const author = originalRule ? context('ruleAuthor') : item.author.name
  const row = { nick: item.id, title: identity.name, asset: item.symbol, kind: item.kind, description, author }
  const info = [[kindCopy[language].kindLabel, kindCopy[language][item.kind]], [text.target, item.symbol], [text.instrument, `${text.futures} · ${text.long} / ${text.short}`], [evaluatedDetailText(language, 'execution'), execution.label], [evaluatedDetailText(language, 'recordSource'), 'Binance USD-M · BTCUSDT'], [text.record, periodLabel], [t('policy'), generated ? generated.parameters : description], [evaluatedDetailText(language, 'basis'), generated ? generated.basis : item.kind === 'mix' ? mixPolicy.basis : evaluatedDetailText(language, item.kind === 'rule' ? 'ruleBasis' : 'agentBasis')], [context(originalRule ? 'authorMethod' : 'requestedModel'), originalRule ? author : item.author.requestedModel ?? '—']]
  const modelLogos: Record<string, string> = { codex: 'openai', claude: 'claude', gemini: 'gemini', deepseek: 'deepseek', qwen: 'qwen', kimi: 'kimi' }
  const modelLogo = modelLogos[item.author.name.toLowerCase()]
  const closeMenu = () => { setMenuOpen(false); menuTrigger.current?.focus({ preventScroll: true }) }
  useLayoutEffect(() => { if (menuOpen) menuItems.current.find(button => button && !button.disabled)?.focus({ preventScroll: true }) }, [menuOpen])
  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: PointerEvent | FocusEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', outside, true); document.addEventListener('focusin', outside)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('focusin', outside) }
  }, [menuOpen])
  useLayoutEffect(() => { if (revealPending.current) { revealPending.current = false; reveal.current?.focus({ preventScroll: true }); reveal.current?.scrollIntoView({ block: 'nearest' }) } }, [expanded])
  const actions = [
    { label: sharingCopy(language, 'TETH에게 분석시키기'), run: undefined, disabled: true },
    { label: h(watched ? 'unwatch' : 'watch'), run: onWatch, disabled: watchDisabled || !onWatch, pressed: watched },
    { label: h('copyLink'), run: onCopyLink, disabled: !onCopyLink },
  ]
  const header = <header className="shared-detail-head catalogue-source-header">
    <div className="shared-detail-title-row"><div className="shared-detail-identity"><ClientStrategyGlyph kind={item.kind} size={44}/><div className="shared-detail-title"><h2 className="ss3-dtitle" ref={title} tabIndex={-1}>{identity.name}</h2><div className="ss3-dsub"><b>{kindCopy[language][item.kind]}</b><span>{evaluatedDetailText(language, 'scope')} · {item.symbol}</span><span>{modelLogo && <img src={`/assets/ai-logos/${modelLogo}.svg`} width="16" height="16" alt=""/>} {identity.byline || author}</span></div></div></div><div className="shared-detail-tools"><button type="button" className="shared-detail-share" aria-label={h('copyLink')} disabled={!onCopyLink} onClick={onCopyLink}><Share2 size={17} aria-hidden="true"/></button><button type="button" className="shared-detail-watch" aria-pressed={watched} disabled={watchDisabled || !onWatch} onClick={onWatch}>{h(watched ? 'unwatch' : 'watch')}</button></div></div>
    <p className="ss3-ddescription">{description}</p>{!onCopy && <span id={`${id}-copy-reason`} className="sr-only">{issuedBinding ? sharingUnavailable(language) : t('copyUnavailable')}</span>}<span id={`${id}-verify-reason`} className="sr-only">{evaluatedDetailText(language, 'verifyUnavailable')}</span>
    <div className="ss3-dacts shared-detail-actions"><button type="button" className="wbtn" disabled={!onCopy || copyBusy} aria-busy={copyBusy} onClick={onCopy} title={!onCopy ? issuedBinding ? sharingUnavailable(language) : t('copyUnavailable') : undefined} aria-describedby={!onCopy ? `${id}-copy-reason` : undefined}>{h('copy')}</button><button type="button" className="shared-detail-analysis" disabled title={evaluatedDetailText(language, 'verifyUnavailable')} aria-describedby={`${id}-verify-reason`}>{h('verify')}</button><div className="catalogue-source-meta"><span className="catalogue-source-venue" title={evaluatedExecutionHint(language, Boolean(issuedBinding))}><img src={execution.logo} alt="" width="16" height="16"/>{execution.label}</span><span data-catalogue-source-minimum>{h('minimum')} {minimum ? `${minimum} USDT` : '—'}</span><span data-catalogue-source-since>{h('since')} {catalogue.period.startAt.slice(0, 10)}</span></div><div className="catalogue-source-more" ref={menu}><button ref={menuTrigger} type="button" aria-label={h('more')} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuOpen ? `${id}-menu` : undefined} onClick={() => setMenuOpen(!menuOpen)} onKeyDown={event => { if (!event.nativeEvent.isComposing && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setMenuOpen(true) } }}>⋯</button>{menuOpen && <div id={`${id}-menu`} className="catalogue-source-menu" role="menu" aria-label={h('more')} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu() }
      else if (event.key === 'Tab') setMenuOpen(false)
      else if (['Home', 'End', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); const enabled = menuItems.current.filter(button => button && !button.disabled), index = enabled.indexOf(document.activeElement as HTMLButtonElement), next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length; enabled[next]?.focus({ preventScroll: true }) }
    }}>{actions.map((action, index) => <button key={action.label} ref={button => { menuItems.current[index] = button }} type="button" role={action.pressed === undefined ? "menuitem" : "menuitemcheckbox"} disabled={action.disabled} aria-checked={action.pressed} onClick={() => { closeMenu(); action.run?.() }}>{action.label}</button>)}</div>}</div></div>
  </header>
  const sortedJudgments = [...item.judgments].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return <div data-evaluated-strategy={item.id} data-policy-version={item.policyVersionId} data-catalogue-revision={catalogue.revision} data-source-account={item.sourceAgentId ?? undefined} data-identity-basis={item.author.identityBasis ?? undefined} data-start-at={catalogue.period.startAt} data-end-exclusive={catalogue.period.endExclusive}><ClientSharedDetailShell row={row} info={info} location={location} title={title} onNavigate={onNavigate} onCopy={() => {}} onAnalyze={() => {}} onWatch={onWatch ?? (() => {})} onCopyLink={onCopyLink ?? (() => {})} watched={watched} analyzing={false} header={header}>
    <div hidden={navigation.full}>
      <section className="catalogue-performance" aria-label={text.performance}><h3>{text.performance}</h3><div className="catalogue-kpis">{metrics.map(([label, value], index) => <div key={label} data-evaluated-metric={['ret', 'mdd', 'win', 'n'][index]}><small>{label}</small><b className={index === 0 ? signClass(chartWindow.percent) : undefined}>{value}</b></div>)}</div>
        <ClientEvaluatedStrategyChartControls days={days} mode={mode} interval={interval} onDays={value => { setCaptionAt(null); setDays(value) }} onMode={value => { setCaptionAt(null); setMode(value) }} onInterval={value => { setCaptionAt(null); setInterval(value) }} amount={chartWindow.first}/>
        {series.points.length >= 2 ? <ClientEvaluatedStrategyChart key={`${item.id}:${days}:${mode}:${interval}`} onSelectPoint={setCaptionAt} series={series} mode={mode} interval={interval} days={days} amount={mode === 'bal' ? amount : chartWindow.first}/> : <p role="status">—</p>}
        <p className="catalogue-since">{captionPoint.at.slice(0, 10)} · {text.since} {sharedPercent((Number(captionPoint.value) / amount - 1) * 100, language)}</p>
        {item.evaluation.fillCount > 2 * item.evaluation.tradeCount && <p className="mt2">{context('monthEnd')}</p>}
        <EvaluatedCalendar item={item} catalogue={catalogue}/>
      </section>
      <section className="catalogue-judgments" aria-label={judgmentHeading}><header><h3>{judgmentHeading}</h3></header><ol>{sortedJudgments.slice(0, expanded ? undefined : 3).map((judgment, index) => <li key={judgment.id} ref={index === 3 ? reveal : undefined} tabIndex={-1} data-evaluated-judgment={judgment.id} data-source-rationale={judgment.rationale ?? undefined} data-gate-reason={judgment.gate?.reason}><span className="catalogue-judgment-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{judgment.effectiveAction === 'open_long' || judgment.effectiveAction === 'open_short' ? <path d={judgment.effectiveAction === 'open_long' ? 'M12 19V5m-6 6 6-6 6 6' : 'M12 5v14m-6-6 6 6 6-6'}/> : <><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8"/></>}</svg></span><div className="catalogue-judgment-body"><div className="catalogue-judgment-heading"><h4>{label(judgment.sourceAction)}{judgment.effectiveAction !== judgment.sourceAction ? ` → ${label(judgment.effectiveAction)}` : ''} · {label(judgment.status)}</h4><div className="catalogue-judgment-date"><time dateTime={judgment.at}>{date(judgment.at)}</time></div></div><EvaluatedRationale text={item.discovery ? (judgment.rationale ?? '—').replace(/ · 모델 생성 규칙을 결정론적으로 평가$/, '') : originalRule ? description : judgment.rationale ?? '—'}/>{judgment.gate && <p className="catalogue-judgment-repeat">{t('gate')}: {evaluatedGateLabel(language, judgment.gate)}</p>}</div></li>)}</ol>{item.judgments.length > 3 && <button type="button" className="catalogue-judgments-more" aria-expanded={expanded} onClick={() => { revealPending.current = !expanded; setExpanded(value => !value) }}>{expanded ? jud.close : jud.more.replace('{count}', String(item.judgments.length - 3))}</button>}{item.kind === 'mix' && <p className="mt2">{context('blocked', item.judgments.filter(judgment => judgment.gate?.allowed === false).length)}</p>}</section>
      <EvaluatedOrders item={item} full={false} open={navigation.open} back={navigation.back} openRef={navigation.openRef}/>
    </div>
    {navigation.full && <EvaluatedOrders item={item} full open={navigation.open} back={navigation.back} headingRef={navigation.headingRef}/>}
  </ClientSharedDetailShell></div>
}

function EvaluatedOrders({ item, full, open, back, openRef, headingRef }: { item: EvaluatedStrategy; full: boolean; open: () => void; back: () => void; openRef?: RefObject<HTMLButtonElement | null>; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  const { language } = useClientPreferences(), text = copy[language], words = ordersCopy[language]
  const [limit, setLimit] = useState(30), table = useRef<HTMLTableElement>(null), revealFrom = useRef<number | null>(null)
  useLayoutEffect(() => {
    const index = revealFrom.current
    if (index === null) return
    revealFrom.current = null
    const row = table.current?.tBodies[0]?.rows[index]
    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [limit])
  const trades = [...item.trades].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt))
  const number = (value: string | number) => new Intl.NumberFormat(language, { maximumFractionDigits: 8 }).format(Number(value))
  const date = (at: string) => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at)) + ' UTC'
  const backButton = <button type="button" className="catalogue-orders-link" onClick={back}><ChevronLeft size={18}/>{words.back}</button>
  return <section className={`catalogue-orders${full ? ' catalogue-orders-full' : ''}`} aria-label={text.orders}>
    {full && backButton}<div className="ss3-ch"><h3 ref={headingRef} tabIndex={full ? -1 : undefined}>{full ? text.orders : <button type="button" className="catalogue-orders-link" ref={openRef} onClick={open}>{text.orders}<ChevronRight size={18}/></button>}</h3><span className="mt2">{evaluatedText(language, 'trades')} · {number(trades.length)}</span></div>
    <div className="shared-trades-scroll" role="region" aria-label={evaluatedDetailText(language, 'tradeTable')} tabIndex={0}><table ref={table} className="ss3-tbl"><thead><tr>{[text.target, words.type, text.entry, text.exit, text.price, text.units, text.amount].map((label, index) => <th key={label} scope="col" className={index >= 4 ? 'shared-number' : undefined}>{label}</th>)}</tr></thead><tbody>{trades.slice(0, full ? limit : 5).map(trade => <tr key={trade.id} data-evaluated-trade={trade.id} data-exit-reason={trade.exitReason} data-net-pnl={trade.netPnl} data-return-pct={trade.returnPct} tabIndex={full ? -1 : undefined}><td>{item.symbol}</td><td>{evaluatedEvidenceLabel(language, trade.side)}<small>{evaluatedEvidenceLabel(language, trade.exitReason)}</small></td><td><time dateTime={trade.openedAt}>{date(trade.openedAt)}</time></td><td><time dateTime={trade.closedAt}>{date(trade.closedAt)}</time></td><td className="shared-number">—</td><td className="shared-number">—</td><td className="shared-number">—<small className={Number(trade.netPnl) < 0 ? 'catalogue-loss' : Number(trade.netPnl) > 0 ? 'catalogue-gain' : undefined}>{evaluatedDetailText(language, 'pnl')} {number(trade.netPnl)} USDT · {trade.returnPct === null ? '—' : sharedPercent(Number(trade.returnPct), language)}</small></td></tr>)}{!trades.length && <tr><td colSpan={7} className="catalogue-orders-empty">{words.empty}</td></tr>}</tbody></table></div>
    {full && limit < trades.length && <button type="button" className="shared-detail-analysis" onClick={() => { revealFrom.current = limit; setLimit(value => value + 50) }}>{words.older}</button>}{full && backButton}
  </section>
}

function EvaluatedCalendar({ item, catalogue }: { item: EvaluatedStrategy; catalogue: EvaluatedCatalogue }) {
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const { language } = useClientPreferences(), id = useId()
  const start = new Date(catalogue.period.startAt), year = start.getUTCFullYear(), month = start.getUTCMonth()
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(), leading = start.getUTCDay()
  const values = new Map<number, number>()
  for (let index = 1; index < item.equity.length; index++) {
    const point = item.equity[index], previous = item.equity[index - 1], end = Date.parse(point.at)
    if (end - Date.parse(previous.at) > 86_400_000) continue
    // Midnight valuations close the previous UTC trading day; intraday points
    // belong to their observed civil day. Multiple observations compound.
    const at = new Date(end % 86_400_000 === 0 ? end - 1 : end)
    if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month) continue
    const day = at.getUTCDate(), ratio = Number(point.value) / Number(previous.value)
    values.set(day, (1 + (values.get(day) ?? 0) / 100) * ratio * 100 - 100)
  }
  const recordedDays = [...values.keys()].sort((a, b) => a - b)
  const selectedDay = activeDay !== null && values.has(activeDay) ? activeDay : recordedDays[0]
  const format = new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'long' })
  const weekday = new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', weekday: 'short' })
  const prevLabel = { ko: '이전 월', en: 'Previous month', ja: '前月', 'zh-CN': '上个月', 'zh-TW': '上個月', es: 'Mes anterior', fr: 'Mois précédent' }[language]
  const nextLabel = { ko: '다음 월', en: 'Next month', ja: '翌月', 'zh-CN': '下个月', 'zh-TW': '下個月', es: 'Mes siguiente', fr: 'Mois suivant' }[language]
  return <div className="client-shared-performance"><section className="tfbk-card"><div className="cin ss3-blk"><div className="ss3-ch shared-calendar-heading"><h3><button type="button" className="cal-nav" disabled aria-label={prevLabel}>‹</button><span id={`${id}-month`}>{format.format(start)}</span><button type="button" className="cal-nav" disabled aria-label={nextLabel}>›</button></h3><span className="mt2">{sharedPercent(Number(item.evaluation.returnPct), language)} · {item.evaluation.tradeCount} {copy[language].trades}</span></div><div className="cal-hd" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <span key={index}>{weekday.format(new Date(Date.UTC(2023, 0, 1 + index)))}</span>)}</div><div className="cal-g" role="group" aria-labelledby={`${id}-month`}>{Array.from({ length: leading }, (_, index) => <span className="cal-c" key={`empty-${index}`} aria-hidden="true"/>)}{Array.from({ length: days }, (_, index) => { const day = index + 1, value = values.get(day), label = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, percent = value === undefined ? '—' : sharedPercent(value, language, 2); return <span key={day} data-evaluated-calendar-day={label} data-daily-return={value} className={`cal-c ${value === undefined ? 'off' : value >= .005 ? 'u' : value <= -.005 ? 'd' : 'z'}`} style={value === undefined ? undefined : { '--a': Math.min(1, Math.abs(value) / 12) } as CSSProperties} role="img" aria-label={`${label} · ${percent}`} tabIndex={value === undefined ? undefined : day === selectedDay ? 0 : -1} onFocus={() => setActiveDay(day)} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
      const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
      if (event.key !== 'Home' && event.key !== 'End' && !(event.key in steps)) return
      event.preventDefault()
      const index = recordedDays.indexOf(day), nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? recordedDays.length - 1 : Math.max(0, Math.min(recordedDays.length - 1, index + steps[event.key]))
      const next = recordedDays[nextIndex]
      const target = event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-evaluated-calendar-day$="-${String(next).padStart(2, '0')}"]`)
      target?.focus({ preventScroll: true })
    }}><span aria-hidden="true">{day}{value !== undefined && <i>{sharedPercent(value, language, 1)}</i>}</span>{value !== undefined && <span className="cal-tooltip" aria-hidden="true">{percent}</span>}</span> })}</div></div></section></div>
}

function EvaluatedRationale({ text }: { text: string }) {
  const { head, rest } = catalogueFirstSentence(text)
  return <p><strong>{head}</strong>{rest}</p>
}
