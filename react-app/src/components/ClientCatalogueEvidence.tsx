import { useCataloguePreviewLocale } from '../client-catalogue-preview-locale'
import { useStaticUiCopy } from '../client-static-ui-copy'
import { useClientPreferences } from '../client-preferences'
import { conditionNumber } from '../client-condition-number'
import { Fragment, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { catalogueAssets } from '../client-catalogue'
import type { CatalogueBacktestObservation } from '../client-catalogue-backtest'
import type { CatalogueEvidenceDecision, CatalogueEvidenceDailyGroup, CatalogueEvidencePair } from '../client-catalogue-backtest-evidence-types'
import { catalogueDateReader } from '../client-catalogue-presentation'
import { catalogueEvidencePageSize, evidenceRows, evidenceText, type EvidenceFilter, type EvidenceRow, type EvidenceSort, type EvidenceState } from '../client-catalogue-evidence-state'
import { catalogueBacktestCopy } from '../client-catalogue-backtest-copy'
import '../client-catalogue-evidence.css'

const pct = (v: number) => { const rounded = +v.toFixed(1); return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%` }
const sign = (v: number) => { const rounded = +v.toFixed(1); return rounded > 0 ? 'mk-up' : rounded < 0 ? 'mk-dn' : '' }
const priceNumber = (v: number) => Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(4)
const price = (v: number) => '$' + priceNumber(v)
const money = (v: number) => `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`
const signedMoney = (v: number) => { const rounded = Math.round(v); return `${rounded > 0 ? '+' : rounded < 0 ? '-' : ''}$${Math.abs(rounded).toLocaleString()}` }
const Chevron = () => <svg className="cv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
function dateReader(value: CatalogueBacktestObservation, format?: (date: Date) => string) {
  const read = catalogueDateReader(value.calendar)
  return (index: number) => { const d = read(index); return format ? format(d) : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` }
}
function Facts({ rows, futures }: { rows: readonly CatalogueEvidencePair[]; futures?: boolean }) {
  const previewLocale = useCataloguePreviewLocale()
  return <dl className="bt-dl">{rows.map(([label, content], index) => <div key={index}><dt>{previewLocale.text(evidenceText(label, futures))}</dt><dd className="num">{previewLocale.text(evidenceText(content, futures))}</dd></div>)}</dl>
}
function Ups({ ups, value }: { ups?: readonly string[] | null; value: CatalogueBacktestObservation }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  if (!ups) return null
  return <div className="bt-ups"><small>{localeUi("그날 오름세로 본 종목 ")}<i>{localeUi("가격이 60일 평균보다 위")}</i></small><ul>{catalogueAssets(value.strategy).map(asset => <li key={asset} className={ups.includes(asset) ? 'y' : 'n'}>{previewLocale.text(evidenceText(asset))}</li>)}</ul></div>
}
type MiniMark = readonly [number, string, string]
type MiniLine = readonly [number, string, string, ('stop' | 'target')?, number?]
/** Source btMini: the supplied snapshot CLOSE prices, not an invented OHLC path. */
function Mini({ value, asset, from, to, marks, lines = [], hold }: { value: CatalogueBacktestObservation; asset: string; from: number; to: number; marks: readonly MiniMark[]; lines?: readonly MiniLine[]; hold?: readonly [number, number] }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const { language } = useClientPreferences()
  const prices = value.evidence.prices.series.find(p => p.asset === asset)?.values
  if (!prices?.length) return null
  const lo = Math.max(0, from), hi = Math.min(prices.length - 1, to), visible = prices.slice(lo, hi + 1), extent = [...visible, ...lines.map(line => line[0])]
  const min = Math.min(...extent), max = Math.max(...extent), pad = (max - min) * .12 || 1, low = min - pad, high = max + pad
  const x = (i: number) => 6 + (i - lo) / Math.max(1, hi - lo) * 316, y = (p: number) => 22 + (1 - (p - low) / (high - low)) * 128
  const path = visible.map((p, i) => `${i ? 'L' : 'M'}${x(lo + i).toFixed(1)} ${y(p).toFixed(1)}`).join(' '), date = dateReader(value, previewLocale.shortDate)
  return <svg className="bt-mini" viewBox="0 0 400 176" role="img" aria-label={localeUi('{asset} 가격', { asset: previewLocale.text(asset) })} data-price-source="client-snapshot-close">
    {hold && <rect x={x(Math.max(lo, hold[0]))} y="22" width={Math.max(2, x(Math.min(hi, hold[1])) - x(Math.max(lo, hold[0])))} height="128" fill="rgba(255,255,255,.06)"/>}
    <path d={path} fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="1.5" strokeLinejoin="round"/>
    {lines.map(([p, label, color, kind, threshold], index) => {
      const full = previewLocale.text(label), percent = kind && threshold !== undefined ? `${conditionNumber(threshold, language)}%` : undefined
      // The source reserves only 70px for this axis label. Use standard trading
      // notation outside Korean; keep the complete localized meaning in title.
      const compact = language !== 'ko' && percent ? `${kind === 'stop' ? 'SL' : 'TP'} ${percent}` : full
      return <g key={index}><line x1="6" x2="322" y1={y(p)} y2={y(p)} stroke={color} strokeDasharray="3 4" strokeOpacity=".7"/><text x="330" y={y(p) + 4} fontSize="12" fill={color}>{language !== 'ko' && percent && <title>{full}</title>}{compact}</text></g>
    })}
    {!lines.length && [max, min].map((p, i) => <text key={i} x="330" y={y(p) + 4} fontSize="12" fill="#8b9096">{priceNumber(p)}</text>)}
    {marks.filter(mark => mark[0] >= lo && mark[0] <= hi).map(([i, label, color], index) => <g key={index} data-price-marker={i}><circle cx={x(i)} cy={y(prices[i])} r="5" fill={color} stroke="#15171a" strokeWidth="2"/><text x={x(i)} y={y(prices[i]) - 12 < 18 ? y(prices[i]) + 22 : y(prices[i]) - 12} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={color}>{previewLocale.text(label)}</text></g>)}
    <text x="6" y="169" fontSize="12" fill="#8b9096">{date(lo)}</text><text x="322" y="169" textAnchor="end" fontSize="12" fill="#8b9096">{date(hi)}</text>
  </svg>
}
type DisplayTrade = { id: number; asset: string; entry: number; exit: number | null; ep: number; xp: number; cost: number; got: number; pnl: number; side?: number; lev?: number; open: boolean; days: number }
function displayTrades(value: CatalogueBacktestObservation): DisplayTrade[] {
  const end = value.result.eq.at(-1)!.i
  const rows: DisplayTrade[] = value.result.trades.map(t => ({ ...t, pnl: t.pnl * 100, open: false, days: t.exit - t.entry }))
  const open = value.result.state.open
  for (const position of Array.isArray(open) ? open : open ? [open] : []) {
    const pnl = 'pnl' in position ? position.pnl : position.chg
    rows.push({ id: position.tid, asset: position.k, entry: position.entry, exit: null, ep: position.ep, xp: position.px, cost: position.cost, got: position.cost * (1 + pnl / 100), pnl, side: 'side' in position ? position.side : undefined, lev: 'lev' in position ? position.lev : undefined, open: true, days: end - position.entry })
  }
  return rows.sort((a, b) => b.entry - a.entry)
}
function TradeMini({ value, trade }: { value: CatalogueBacktestObservation; trade: DisplayTrade }) {
  const localeUi = useStaticUiCopy()
  const s = value.strategy, end = trade.exit ?? value.result.eq.at(-1)!.i, futures = !!s.fut
  const marks: MiniMark[] = [[trade.entry, localeUi.fixed(futures ? `${trade.side === -1 ? '숏' : '롱'} 진입` : '매수'), trade.side === -1 ? '#b08cf5' : '#2fb98a']]
  if (trade.exit !== null) marks.push([trade.exit, localeUi.fixed(futures ? '청산' : '매도'), trade.pnl >= 0 ? '#2fb98a' : '#f0566a'])
  const lines: MiniLine[] = []
  if (futures) { if (s.sl) lines.push([trade.ep * (1 - (trade.side ?? 1) * s.sl / 100), localeUi('손절 {value}%', { value: s.sl }), '#f0566a', 'stop', s.sl]) }
  else if (s.kind !== 'agent') { if (s.tp != null) lines.push([trade.ep * (1 + s.tp / 100), localeUi('목표 +{value}%', { value: s.tp }), '#2fb98a', 'target', s.tp]); lines.push([trade.ep * (1 + s.sl / 100), localeUi('손절 {value}%', { value: s.sl }), '#f0566a', 'stop', s.sl]) }
  return <Mini value={value} asset={trade.asset} from={trade.entry - 14} to={end + 10} marks={marks} lines={lines} hold={[trade.entry, end]}/>
}
function DecisionDetail({ d, value, trades }: { d: CatalogueEvidenceDecision; value: CatalogueBacktestObservation; trades: readonly DisplayTrade[] }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const trade = d.tid == null ? undefined : trades.find(t => t.id === d.tid)
  const later = Math.min(value.result.eq.at(-1)!.i, d.i + 25), after = d.k === 'skip' && d.out?.mute && later > d.i ? d.out : null, futures = !!value.strategy.fut
  const ai = value.strategy.kind === 'agent' || value.strategy.kind === 'mix' && value.strategy.gate > 0
  return <div className="bt-dd-in" data-testid="backtest-selected-evidence">
    {ai && <div className="bt-jb fail"><h4>{localeUi("그날 TETH의 판단")}</h4><p className="f">{localeUi(catalogueBacktestCopy.judgmentUnavailable)}</p></div>}
    {!!d.chain && <div className="bt-dd-ch"><div className="bt-chain"><span className="ok">{localeUi("규칙 신호")}</span><span className="ai">{localeUi("AI 확인")}</span><span className={d.k === 'skip' ? 'no' : 'go'}>{d.k === 'skip' ? localeUi("보류") : futures ? localeUi("진입") : localeUi("매수")}</span></div></div>}
    {d.a && <div className="bt-dd-c"><small>{previewLocale.text(evidenceText(d.a))} {futures ? localeUi("현물 종가(참고)") : localeUi("가격")}, {trade ? futures ? localeUi("진입 전후") : localeUi("매수 전후") : localeUi("그 무렵")} <i>USD</i></small>{trade ? <TradeMini value={value} trade={trade}/> : <Mini value={value} asset={d.a} from={d.i - 25} to={d.i + 25} marks={[[d.i, d.k === 'skip' ? '보류' : evidenceText(d.tag, futures), d.k === 'skip' ? '#f0b840' : '#9aa0a6']]}/>}</div>}
    <div className="bt-dd-f"><div className="bt-blk"><h4>{d.k === 'sell' ? futures ? localeUi("청산 내용") : localeUi("판 내용") : localeUi("그날 확인한 조건")}</h4><Facts rows={d.facts} futures={futures}/><Ups ups={d.ups} value={value}/></div>
      {d.a && after && <div className="bt-blk"><h4>{localeUi("그 뒤 가격")}</h4><p className="bt-after">{localeUi.rich('그 뒤 {days}일 동안 {asset}의 가격은 {change} 움직였습니다.', { days: later - d.i, asset: d.tk, change: <b className={`num ${sign(after.v)}`}>{pct(after.v)}</b> })}</p></div>}</div>
  </div>
}
function DailyDetail({ group, value }: { group: CatalogueEvidenceDailyGroup; value: CatalogueBacktestObservation }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const members = group.decisionIndices.map(ix => value.evidence.decisions[ix]), first = members[0], buys = members.filter(d => d.k === 'buy'), futures = !!value.strategy.fut
  const pair = (p: CatalogueEvidencePair | null | undefined) => p ? p.map(text => previewLocale.text(evidenceText(text, futures))).join(', ') : ''
  return <div className="bt-dd-in one" data-testid="backtest-selected-evidence"><div className="bt-dd-f"><div className="bt-blk"><h4>{localeUi("그날 확인한 조건")}</h4><Facts futures={futures} rows={[[ 'AI가 비교한 것', pair(first.p0)], ['시장 확인', pair(first.p1)], ['결정', group.out === 'buy' ? localeUi('{asset} 매수', { asset: previewLocale.text(group.title) }) : pair(first.p2)]]}/><Ups ups={group.ups} value={value}/></div>{!!buys.length && <div className="bt-blk"><h4>{futures ? localeUi("그날 진입한 종목") : localeUi("그날 산 종목")}</h4><Facts futures={futures} rows={buys.map(d => [d.tk, localeUi('{value}, 비중 {weight}, {comparison}', { value: d.facts[0]?.[1] ?? '', weight: d.facts[1]?.[1] ?? '', comparison: previewLocale.text(d.cmp, futures) })])}/></div>}</div></div>
}

export function ClientCatalogueEvidence({ value, state, onChange }: { value: CatalogueBacktestObservation; state: EvidenceState; onChange: (next: EvidenceState) => void }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const host = useRef<HTMLDivElement>(null), [openHolds, setOpenHolds] = useState<ReadonlySet<string>>(new Set())
  const { tradeFilter, tradeCount } = state
  const rows = useMemo(() => evidenceRows(value.evidence, value.strategy, state.filter, state.sort), [value, state.filter, state.sort]), trades = useMemo(() => displayTrades(value), [value]), date = dateReader(value, previewLocale.date), readDate = catalogueDateReader(value.calendar), futures = !!value.strategy.fut
  const chosen = state.selection?.runId === value.runId ? state.selection : null
  useLayoutEffect(() => {
    if (!chosen) return
    const frame = requestAnimationFrame(() => host.current?.querySelector<HTMLElement>('.bt-row.on')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }))
    return () => cancelAnimationFrame(frame)
  }, [chosen])
  const filter = (next: EvidenceFilter) => { setOpenHolds(new Set()); onChange({ ...state, filter: next, count: catalogueEvidencePageSize, group: null, selection: chosen?.type === 'trade' ? chosen : null }) }
  const ai = value.strategy.kind === 'agent' || value.strategy.kind === 'mix' && value.strategy.gate > 0, decisions = value.evidence.decisions
  const tabs: [EvidenceFilter, string, number, string][] = []
  if (ai) tabs.push(['opp', value.strategy.kind === 'agent' ? '다시 비교한 날' : '검토한 기회', evidenceRows(value.evidence, value.strategy, 'opp', 'new').length, value.strategy.kind === 'agent' ? '일' : '번'])
  tabs.push(['buy', futures ? '진입' : '매수', decisions.filter(d => d.k === 'buy').length, '건'])
  if (ai) tabs.push(['skip', value.strategy.kind === 'agent' ? '쉬어 감' : '보류', decisions.filter(d => d.k === 'skip').length, value.strategy.kind === 'agent' ? '일' : '건'])
  tabs.push(['sell', futures ? '청산' : '매도', decisions.filter(d => d.k === 'sell').length, '건'], ['all', '전체 기록', evidenceRows(value.evidence, value.strategy, 'all', 'new').length, '건'])
  const renderRow = (row: EvidenceRow, holdKey?: string) => {
    const d = row.value, daily = row.type === 'daily', on = chosen?.type === row.type && chosen.index === d.ix, members = daily ? row.value.decisionIndices.map(ix => decisions[ix]) : [row.value], buys = members.filter(d => d.k === 'buy'), dot = buys[0] ?? members[0]
    const act = daily ? d.out === 'buy' ? `${d.title} ${d.tag}` : d.title : row.value.act || d.title
    const say = daily ? buys.length > 1 ? localeUi('{count}종목을 비교해 순위가 높은 {buys}종목을 나눠 매수했습니다', { count: catalogueAssets(value.strategy).length, buys: buys.length }) : members[0]?.say || d.why : row.value.say || d.why
    return <div key={`${row.type}:${d.ix}`} className={`bt-row v2 k-${d.k}${on ? ' on' : ''}${!daily && state.group && d.ix >= state.group.first && d.ix <= state.group.last && d.k === 'skip' ? ' grp' : ''}`} data-decision-index={daily ? undefined : d.ix} data-daily-group-index={daily ? d.ix : undefined} data-event-index={row.type === 'decision' ? row.value.eventIndex : undefined} data-run-id={d.runId}>
      <button type="button" className="bt-rb" aria-expanded={on} onClick={() => { if (on && holdKey) setOpenHolds(current => new Set(current).add(holdKey)); onChange({ ...state, selection: on ? null : { runId: value.runId, type: row.type, index: d.ix, j: d.j } }) }}><time className="num">{date(d.i)}</time><i className={`bt-dt k-${dot.k}${dot.side === -1 ? ' s' : ''}`} aria-hidden="true"/><b>{previewLocale.text(evidenceText(act, futures))}</b><span className="wy">{previewLocale.text(evidenceText(say, futures))}</span>{row.type === 'decision' && row.value.out && <span className={`ot${row.value.out.mute ? ' m' : ''}`}><small>{previewLocale.text(evidenceText(row.value.out.t, futures))}</small><i className={`num ${sign(row.value.out.v)}`}>{pct(row.value.out.v)}</i></span>}<Chevron/></button>
      {on && (row.type === 'daily' ? <DailyDetail group={row.value} value={value}/> : <DecisionDetail d={row.value} value={value} trades={trades}/>)}
    </div>
  }
  const visible = rows.slice(0, Math.max(catalogueEvidencePageSize, state.count)), blocks: React.ReactNode[] = []
  let month = ''
  for (let index = 0; index < visible.length; index++) {
    const row = visible[index], dt = readDate(row.value.i), ym = `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`
    if (state.sort !== 'big' && ym !== month) { month = ym; blocks.push(<div className="bt-ym" key={`month:${ym}`}><b>{previewLocale.month(dt)}</b><span className="num">{localeUi('{count}건', { count: rows.filter(r => { const d = readDate(r.value.i); return d.getFullYear() === dt.getFullYear() && d.getMonth() === dt.getMonth() }).length })}</span></div>) }
    const group = [row]
    if (row.value.title === '그대로 유지') while (index + 1 < visible.length && visible[index + 1].value.title === '그대로 유지' && (state.sort === 'big' || readDate(visible[index + 1].value.i).getMonth() === dt.getMonth() && readDate(visible[index + 1].value.i).getFullYear() === dt.getFullYear())) group.push(visible[++index])
    if (group.length < 2) { blocks.push(renderRow(row)); continue }
    const key = `${row.type}:${row.value.ix}`, expanded = openHolds.has(key) || group.some(r => chosen?.type === r.type && chosen.index === r.value.ix)
    blocks.push(<div className="bt-hold-group" key={`hold:${key}`}><div className="bt-row v2 skb-grp"><button type="button" className="bt-rb" aria-expanded={expanded} onClick={() => { const next = new Set(openHolds); if (expanded) { next.delete(key); if (group.some(member => chosen?.type === member.type && chosen.index === member.value.ix)) onChange({ ...state, selection: null }) } else next.add(key); setOpenHolds(next) }}><time className="num">{date(row.value.i)}</time><i className="bt-dt k-hold" aria-hidden="true"/><b>{localeUi('그대로 유지 {count}번', { count: group.length })}</b><span className="wy">{localeUi('{from}부터 {to}까지 조건에 맞아 그대로 뒀습니다', { from: date(group.at(-1)!.value.i).replace(/^\d+\. /, ''), to: date(row.value.i).replace(/^\d+\. /, '') })}</span><Chevron/></button></div>{expanded && <div className="bt-hold-members">{group.map(member => renderRow(member, key))}</div>}</div>)
  }
  const filteredTrades = trades.filter(t => tradeFilter === 'win' ? !t.open && t.pnl > 0 : tradeFilter === 'loss' ? !t.open && t.pnl <= 0 : true)
  return <div className="bt-ev catalogue-evidence" ref={host} data-run-id={value.runId}>
    <section className="bt-sec-b" id="bt-dec"><header className="v2"><h3>{localeUi("판단 기록")}</h3><label className="bt-sort"><span>{localeUi("정렬")}</span><select aria-label={localeUi("정렬")} value={state.sort} onChange={e => { setOpenHolds(new Set()); onChange({ ...state, sort: e.target.value as EvidenceSort, count: catalogueEvidencePageSize, selection: null }) }}><option value="new">{localeUi("최신순")}</option><option value="old">{localeUi("오래된순")}</option><option value="big">{localeUi("결과가 큰 순")}</option></select></label></header>
      <div className="bt-s4" role="tablist" aria-label={localeUi("판단 종류")}>{tabs.map(([key, label, count, unit]) => <button type="button" role="tab" aria-selected={state.filter === key} key={key} className={`k-${key}`} onClick={() => filter(key)}><small>{previewLocale.text(label)}</small><b className="num">{count}<i>{previewLocale.text(unit)}</i></b></button>)}</div>
      <div className="bt-list v2" id="bt-dl">{blocks}{!rows.length && <p className="bt-none">{localeUi("이 종류의 판단은 없었습니다")}</p>}{rows.length > state.count ? <button type="button" className="bt-more" onClick={() => onChange({ ...state, count: state.count + catalogueEvidencePageSize * 2 })}><span className="u">{localeUi("이전 판단 더 보기")}</span><i className="num">{localeUi('{total}건 중 {shown}건 표시', { total: rows.length, shown: state.count })}</i></button> : rows.length > catalogueEvidencePageSize && <p className="bt-end num">{localeUi('{count}건을 모두 봤습니다', { count: rows.length })}</p>}</div>
    </section>
    <section className="bt-sec-b" id="bt-trs"><header><h3>{localeUi("거래 내역")}</h3><div className="bt-chips" role="group" aria-label={localeUi("거래 종류")}>{[['all', localeUi('전체 {count}건', { count: trades.length })], ['win', localeUi('수익 {count}건', { count: trades.filter(t => !t.open && t.pnl > 0).length })], ['loss', localeUi('손실 {count}건', { count: trades.filter(t => !t.open && t.pnl <= 0).length })]].map(([key, label]) => <button key={key} type="button" aria-pressed={tradeFilter === key} onClick={() => { onChange({ ...state, tradeFilter: key as 'all' | 'win' | 'loss', tradeCount: 8, selection: chosen?.type === 'trade' ? null : chosen }) }}>{previewLocale.text(label)}</button>)}</div></header>
      <div className="bt-list bt-tlist" id="bt-tl"><div className="bt-th"><span>{localeUi("종목")}</span><span>{futures ? localeUi("진입일") : localeUi("산 날")}</span><span>{futures ? localeUi("청산일") : localeUi("판 날")}</span><span className="r">{localeUi("보유 기간")}</span><span className="r">{localeUi("손익")}</span><span/></div>
        {filteredTrades.slice(0, tradeCount).map(t => { const on = chosen?.type === 'trade' && chosen.index === t.id; return <div key={t.id} className={`bt-row bt-tr${on ? ' on' : ''}`} data-trade-id={t.id}><button type="button" className="bt-rb" aria-expanded={on} onClick={() => onChange({ ...state, selection: on ? null : { runId: value.runId, type: 'trade', index: t.id, j: t.entry - value.result.eq[0].i } })}><b>{previewLocale.text(evidenceText(t.asset))}{t.side && <i className={`bt-sd${t.side < 0 ? ' s' : ''}`}>{t.side > 0 ? localeUi("롱") : localeUi("숏")}{t.lev && t.lev > 1 ? ` ${localeUi("{value}배", { value: t.lev })}` : ''}</i>}</b><time className="num"><i>{futures ? localeUi("진입") : localeUi("매수")}</i>{date(t.entry)}</time><time className="num"><i>{futures ? localeUi("청산") : localeUi("매도")}</i>{t.open ? localeUi("보유 중") : date(t.exit!)}</time><span className="r num">{localeUi("{days}일", { days: t.days })}</span><span className={`r num ${sign(t.pnl)}`}>{pct(t.pnl)}</span><Chevron/></button>{on && <TradeDetail value={value} trade={t}/>}</div> })}
        {!filteredTrades.length && <p className="bt-none">{localeUi("이 종류의 거래는 없었습니다")}</p>}{filteredTrades.length > tradeCount && <button type="button" className="bt-more" onClick={() => onChange({ ...state, tradeCount: tradeCount + 12 })}>{localeUi('이전 거래 {count}건 더 보기', { count: Math.min(12, filteredTrades.length - tradeCount) })}</button>}
      </div>
    </section>
    <EvidenceMonths value={value}/><EvidenceMetrics value={value}/>
  </div>
}

function TradeDetail({ value, trade: t }: { value: CatalogueBacktestObservation; trade: DisplayTrade }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const date = dateReader(value, previewLocale.date), futures = !!value.strategy.fut, mv = (t.xp / t.ep - 1) * (futures ? t.side ?? 1 : 1) * 100, lev = t.lev ?? 1, cost = t.pnl - mv * lev
  const fields: CatalogueEvidencePair[] = [...(futures ? [[ '방향과 배수', localeUi('{direction} {value}배', { direction: localeUi(t.side === -1 ? '숏' : '롱'), value: lev })] as const] : []), [futures ? '진입일' : '산 날', `${date(t.entry)}, ${price(t.ep)}`], [t.open ? '지금 가격' : futures ? '청산일' : '판 날', `${t.open ? '' : `${date(t.exit!)}, `}${price(t.xp)}`], ['들고 있던 기간', localeUi('{days}일', { days: t.days })], [futures ? '넣은 돈(증거금)' : '넣은 돈', money(value.amount * t.cost)]]
  const performance: CatalogueEvidencePair[] = [['가격이 움직인 만큼', futures && t.side === -1 ? localeUi('{value}, 숏이라 내릴수록 이익', { value: pct(mv) }) : pct(mv)], ...(futures && lev > 1 ? [[localeUi('레버리지 {value}배 반영', { value: lev }), pct(mv * lev)] as const] : []), ...(!t.open ? [[futures ? '수수료와 펀딩비' : '수수료', futures ? pct(cost) : localeUi('{value}, 살 때와 팔 때 0.1%씩', { value: pct(cost) })] as const] : []), [t.open ? '지금 손익' : '이 거래의 손익', `${pct(t.pnl)}, ${signedMoney(value.amount * (t.got - t.cost))}`]]
  const why = value.evidence.decisions.find(d => d.tid === t.id && d.k === 'sell')?.why
  return <div className="bt-dd-in"><div className="bt-dd-c"><small>{localeUi(futures ? '{asset} 현물 종가(참고), 진입 전후 ' : '{asset} 가격, 매수 전후 ', { asset: previewLocale.text(evidenceText(t.asset)) })}<i>USD</i></small><TradeMini value={value} trade={t}/><p className="bt-cap2">{localeUi(futures ? '밝은 구간이 포지션을 들고 있던 기간입니다' : '밝은 구간이 들고 있던 기간입니다')}</p></div><div className="bt-dd-f"><div className="bt-blk"><h4>{localeUi("거래")}</h4><Facts rows={fields}/></div><div className="bt-blk"><h4>{localeUi("손익이 나온 과정")}</h4><Facts rows={performance}/>{why && <p className="bt-after">{localeUi(futures ? '청산한 이유: {reason}' : '판 이유: {reason}', { reason: previewLocale.text(evidenceText(why, futures)) })}</p>}</div></div></div>
}
function EvidenceMonths({ value }: { value: CatalogueBacktestObservation }) {
  const localeUi = useStaticUiCopy()
  const read = catalogueDateReader(value.calendar), months: { year: number; month: number; base: number; last: number; firstDay: number; lastDay: number; days: number }[] = []
  value.result.eq.forEach((p, index) => { const d = read(p.i), last = months.at(-1); if (!last || last.year !== d.getFullYear() || last.month !== d.getMonth() + 1) months.push({ year: d.getFullYear(), month: d.getMonth() + 1, base: index ? value.result.eq[index - 1].v : 1, last: p.v, firstDay: d.getDate(), lastDay: d.getDate(), days: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }); else { last.last = p.v; last.lastDay = d.getDate() } })
  const data = months.map(m => ({ ...m, ret: (m.last / m.base - 1) * 100, part: m.firstDay > 1 || m.lastDay < m.days })), full = data.filter(m => !m.part), years = [...new Set(data.map(m => m.year))], positions = Array.from({ length: 12 }, (_, i) => i + 1)
  // Final source annual totals compound the one-decimal displayed monthly values.
  const annual = (year: number) => (data.filter(m => m.year === year).reduce((n, m) => n * (1 + Number(m.ret.toFixed(1)) / 100), 1) - 1) * 100
  const cls = (n: number) => { const rounded = +n.toFixed(1); return rounded > 0 ? 'u' : rounded < 0 ? 'd' : '' }
  const monthlyPercent = (n: number) => Math.abs(n) < .05 ? '0%' : pct(n)
  return <section className="bt-sec-b"><header><h3>{localeUi("월별 수익률")}</h3><span>{full.length >= 3 ? localeUi('한 달 전체를 계산한 {total}개월 중 {positive}개월에 수익이 났습니다.', { total: full.length, positive: full.filter(m => m.ret >= .05).length }) : full.length ? localeUi("시작한 달과 마지막 달은 일부 기간만 계산했습니다.") : ''}</span></header>
    {!full.length ? <p className="skb-mt-short">{localeUi.rich('아직 한 달이 안 됐습니다. 지금까지 {return}입니다.', { return: <b className={`num ${cls(value.result.ret)}`}>{pct(value.result.ret)}</b> })}</p> : <><div className="skb-mtw"><table className="skb-mt"><thead><tr><th scope="col">{localeUi("연도")}</th>{positions.map(m => <th scope="col" key={m}>{localeUi.month(m)}</th>)}<th scope="col">{localeUi("누적")}</th></tr></thead><tbody>{years.map(year => <tr key={year}><th scope="row">{year}</th>{positions.map(month => { const m = data.find(m => m.year === year && m.month === month); return <td key={month} className={m ? cls(m.ret) : 'e'}>{m ? <>{monthlyPercent(m.ret)}{m.part && <small>{localeUi("일부")}</small>}</> : '-'}</td> })}<td className={`yr ${cls(annual(year))}`}>{pct(annual(year))}</td></tr>)}</tbody></table></div><div className="skb-mtm">{years.map(year => <Fragment key={year}><div className="y">{year}<span className={`num ${cls(annual(year))}`}>{localeUi("누적 ")}{pct(annual(year))}</span></div><div className="g">{positions.map(month => { const m = data.find(m => m.year === year && m.month === month); return <div key={month} className={`c${m ? '' : ' e'}`}><em>{localeUi.month(month)}</em><b className={`num ${m ? cls(m.ret) : ''}`}>{m ? monthlyPercent(m.ret) : '-'}</b>{m?.part && <small>{localeUi("일부")}</small>}</div> })}</div></Fragment>)}</div></>}
  </section>
}
function MetricTerm({ label, hint }: { label: string; hint: string }) {
  const id = useId(), [open, setOpen] = useState(false)
  return <button type="button" className="mkd-term" aria-label={label} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onPointerEnter={event => { if (event.pointerType !== 'touch') setOpen(true) }} onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setOpen(false) }} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) } }}>{label}{open && <span className="mkd-tip" id={id} role="tooltip">{hint}</span>}</button>
}
function EvidenceMetrics({ value }: { value: CatalogueBacktestObservation }) {
  const localeUi = useStaticUiCopy()
  const previewLocale = useCataloguePreviewLocale()
  const r = value.result, futures = !!value.strategy.fut
  const rows = [
    ['승률', `${Math.round(r.winRate)}%`, '끝난 거래 중 이익으로 끝난 거래의 비율입니다.'],
    ['손익비', r.pf == null ? '—' : r.pf.toFixed(2), '이긴 거래에서 번 돈을 진 거래에서 잃은 돈으로 나눈 값입니다. 1보다 크면 번 돈이 더 많습니다.'],
    ['1년으로 환산한 수익률', r.cagr == null ? '—' : pct(r.cagr), '이 기간의 수익률을 1년 기준으로 바꾼 값입니다.'],
    [futures ? '포지션을 들고 있던 시간' : '종목을 들고 있던 시간', r.exposure == null ? '—' : `${Math.round(Math.min(100, r.exposure))}%`, `전체 기간 중 ${futures ? '포지션을' : '종목을'} 들고 있던 날의 비율입니다. 나머지는 현금으로 기다렸습니다.`],
    ['낸 수수료', r.costImpact == null ? '—' : `${(value.amount * r.costImpact / 100).toFixed(1)}`, `${futures ? '진입과 청산 때' : '살 때와 팔 때'} 낸 수수료를 모두 더한 값입니다. 위 결과는 이 수수료를 뺀 뒤의 값입니다.`],
    ['가장 길게 회복을 기다린 기간', r.underwaterDays == null ? '—' : localeUi('{days}일', { days: r.underwaterDays }), '잔고가 그 전 가장 높았던 값으로 돌아오기까지 걸린 가장 긴 기간입니다.'],
  ]
  return <details className="bt-tech"><summary>{localeUi("자세한 지표")}<Chevron/></summary><dl className="bt-dl bt-tech-g">{rows.map(([label, result, hint]) => <div key={label}><dt><MetricTerm label={previewLocale.text(label)} hint={previewLocale.text(hint)}/></dt><dd className="num">{previewLocale.text(result)}</dd></div>)}</dl></details>
}
