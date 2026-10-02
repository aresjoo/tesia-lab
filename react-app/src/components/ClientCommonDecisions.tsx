import { Fragment, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { commonDecisionFilters, commonDecisionRows, commonHoldingGroups, selectCommonDecisions, type CommonDecisionSort, type CommonDecisionFilter, type CommonDecisionRow } from '../client-common-decisions'
import { commonBacktestText } from '../client-common-backtest-copy'
import { commonDate } from '../client-common-backtest-preview'
import { useClientPreferences } from '../client-preferences'
import { sourceTerminalDate, type SourceTerminalEvaluation } from '../client-terminal-source-fixture'

export type CommonDecisionsHandle = { reveal: (index: number) => boolean; clear: () => void }
export default function ClientCommonDecisions({ evaluation, ref, onSelect }: { evaluation: SourceTerminalEvaluation; ref?: Ref<CommonDecisionsHandle>; onSelect: (index: number | null) => void }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  const rows = useMemo(() => commonDecisionRows(evaluation), [evaluation])
  const [filter, setFilter] = useState<CommonDecisionFilter>('allRecords')
  const [sort, setSort] = useState<CommonDecisionSort>('new')
  const [limit, setLimit] = useState(12)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [openGroups, setOpenGroups] = useState<ReadonlySet<number>>(() => new Set())
  const prefix = useId()
  const focusNext = useRef<number | null>(null)
  const [revealRevision, setRevealRevision] = useState(0)
  useLayoutEffect(() => {
    if (focusNext.current === null) return
    document.getElementById(`${prefix}-${focusNext.current}-button`)?.focus()
    focusNext.current = null
  }, [limit, prefix, revealRevision])
  useImperativeHandle(ref, () => ({ clear() { setExpanded(null) }, reveal(index) {
    const row = rows.find(row => row.event.i === index)
    if (!row) return false
    const nextFilter = filter === 'allRecords' || row.kind === filter ? filter : 'allRecords'
    const list = selectCommonDecisions(rows, nextFilter, sort)
    const position = list.findIndex(row => row.event.i === index)
    const group = commonHoldingGroups(list).find(group => group.some(row => row.event.i === index))
    if (group) setOpenGroups(previous => new Set([...previous, group[0].event.i]))
    setFilter(nextFilter); setLimit(value => Math.max(value, position + 3)); setExpanded(index)
    focusNext.current = index
    setRevealRevision(value => value + 1)
    return true
  } }), [rows, filter, sort])
  const selected = useMemo(() => selectCommonDecisions(rows, filter, sort), [rows, filter, sort])
  const holdGroups = useMemo(() => new Map(commonHoldingGroups(selected).flatMap(group => group.map(row => [row.event.i, group] as const))), [selected])
  const months = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of selected) { const month = commonDate(row.event.i).slice(0, 7); counts.set(month, (counts.get(month) ?? 0) + 1) }
    return counts
  }, [selected])
  const fmt = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
  const pct = (n: number) => new Intl.NumberFormat(language, { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' }).format(n) + '%'
  const money = (n: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
  const p = evaluation.r.params
  const rule = (row: CommonDecisionRow) => {
    if (language === 'ko') return row.event.txt
    if (row.kind === 'buy' || row.kind === 'watch') return `RSI(n−1) ${fmt.format(row.rsi)} ${row.rsi < p.rsiTh ? '<' : '≥'} ${fmt.format(p.rsiTh)} · Δ ${pct(row.change)} ${row.change > .5 ? '>' : '≤'} ${fmt.format(.5)}%${p.trendFilter ? ` · |SMA20 − SMA60| / P ${row.trendGap > 3 ? '>' : '≤'} 3%` : ''}`
    if (row.event.k === 'exit-sl') return `${t('stop')} ${pct(p.sl)}`
    if (row.event.k === 'exit-tp') return `${t('take')} ${pct(p.tp!)}`
    if (row.event.k === 'exit-time') return `${t('holding')} 25 ${t('days')}`
    return `${t('waiting')} · ${t('stop')} ${pct(p.sl)} · ${t('take')} ${p.tp === null ? t('noTake') : pct(p.tp)}`
  }
  return <section className="cbt-evidence cbt-decisions" data-testid="common-decisions" data-visible-count={Math.min(limit, selected.length)}>
    <header><h3>{t('decisions')}</h3><label className="cbt-sort"><span>{t('sort')}</span><select value={sort} onChange={event => { setSort(event.target.value as CommonDecisionSort); setLimit(12); setExpanded(null); onSelect(null) }}>
      {(['new', 'old', 'big'] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}
    </select></label></header>
    <div className="cbt-decision-counts" role="group" aria-label={t('kinds')}>
      {commonDecisionFilters.map(kind => <button key={kind} type="button" data-kind={kind} aria-pressed={filter === kind} onClick={() => { setFilter(kind); setLimit(12); setExpanded(null); onSelect(null) }}><small>{t(kind)}</small><b>{fmt.format(kind === 'allRecords' ? rows.length : rows.filter(row => row.kind === kind).length)}</b></button>)}
    </div>
    <p className="cbt-muted">{t('notice')}</p>
    <div className="cbt-decision-list">
      {selected.slice(0, limit).map((row, index) => {
        const { event, outcome } = row, month = commonDate(event.i).slice(0, 7), isOpen = expanded === event.i
        const id = `${prefix}-${event.i}`
        const group = holdGroups.get(event.i), leader = group?.[0].event.i, isGroupOpen = leader !== undefined && openGroups.has(leader)
        const groupTitle = group && t('holdGroup').replace('{count}', fmt.format(group.length))
        const groupRange = group && t('holdRange').replace('{from}', commonDate(Math.min(group[0].event.i, group.at(-1)!.event.i))).replace('{to}', commonDate(Math.max(group[0].event.i, group.at(-1)!.event.i)))
        return <Fragment key={event.i}>
          {sort !== 'big' && (index === 0 || month !== commonDate(selected[index - 1].event.i).slice(0, 7)) && <div className="cbt-month"><b>{new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long' }).format(sourceTerminalDate(event.i))}</b><span>{fmt.format(months.get(month)!)}</span></div>}
          {group && leader === event.i && <div className="cbt-hold-group"><button type="button" aria-expanded={isGroupOpen} aria-controls={group.filter(item => selected.indexOf(item) < limit).map(item => `${prefix}-${item.event.i}-row`).join(' ')} aria-label={`${groupTitle}, ${groupRange}`} onClick={() => {
            setOpenGroups(previous => { const next = new Set(previous); if (next.has(leader)) next.delete(leader); else next.add(leader); return next })
            if (isGroupOpen && group.some(item => item.event.i === expanded)) { setExpanded(null); onSelect(null) }
          }}><time>{commonDate(event.i)}</time><b>{groupTitle}</b><span>{groupRange}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button></div>}
          <div className="cbt-decision-row" id={`${id}-row`} data-kind={row.kind} data-outcome={outcome?.pnl} hidden={!!group && !isGroupOpen}>
            <button type="button" id={`${id}-button`} aria-expanded={isOpen} aria-controls={id} onClick={() => { setExpanded(isOpen ? null : event.i); onSelect(isOpen ? null : event.i) }}>
              <time dateTime={commonDate(event.i)}>{commonDate(event.i)}</time><i className="cbt-decision-dot" aria-hidden="true" /><b>{t(row.kind)}</b><span className="cbt-decision-why">{rule(row)}</span>
              <span className={outcome ? outcome.pnl > 0 ? 'up' : 'down' : ''}>{outcome ? pct(outcome.pnl * 100) : ''}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <div id={id} hidden={!isOpen} className="cbt-decision-detail" role="region" aria-labelledby={`${id}-button`}>
              {isOpen && <><div><h4>{t('decisionRule')}</h4><p>{rule(row)}</p><h4>{t('facts')}</h4><dl className="cbt-dl">{[[t('price'), money(row.price)], [t('previousRsi'), fmt.format(row.rsi)], [t('dailyChange'), pct(row.change)], [t('trendGap'), pct(row.trendGap)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
                {outcome && <div><h4>{t('outcome')}</h4><dl className="cbt-dl">{[[t('buy'), commonDate(outcome.entry)], [t('sell'), commonDate(outcome.exit)], [t('holding'), `${outcome.exit - outcome.entry} ${t('days')}`], [t('pnl'), `${money(outcome.krw)} (${pct(outcome.pnl * 100)})`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>}</>}
            </div>
          </div>
        </Fragment>
      })}
      {!selected.length && <p className="cbt-muted" role="status">{t('noDecisions')}</p>}
    </div>
    {selected.length > 12 && <button className="cbt-secondary cbt-more cbt-decisions-more" type="button" aria-disabled={limit >= selected.length} onClick={event => {
      if (limit >= selected.length) return
      const next = selected[limit]
      setLimit(value => value + 24)
      // Keep keyboard reading order on the first newly revealed row, not below it.
      if (event.detail === 0) {
        const group = holdGroups.get(next.event.i)
        if (group) setOpenGroups(previous => new Set([...previous, group[0].event.i]))
        focusNext.current = next.event.i
      }
    }}><span>{limit >= selected.length ? t('allViewed') : t('moreDecisions')}</span><i>{fmt.format(Math.min(limit, selected.length))} / {fmt.format(selected.length)}</i></button>}
  </section>
}
