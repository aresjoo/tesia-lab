import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ClientAgentEvent, ClientAgentOperation } from '../client-agent-view'
import { useClientPreferences } from '../client-preferences'
import { terminalReadText } from '../client-terminal-read-copy'
import { ClientRuleCheckCard, ClientRuleJournal, ClientRuleWatchGroup } from './ClientRuleCheckCard'
import { ruleCheckText } from '../client-rule-check-copy'
import '../client-agent-feed.css'

export type ClientAgentFeedProps = {
  strategyId: string
  /** Latest first; the presentation never sorts or manufactures events. */
  events: readonly ClientAgentEvent[] | null
  operations?: readonly ClientAgentOperation[]
  sourceLabel: string
  statusSummary?: string
  watchSummary?: (count: number) => string
  error?: string
  onReconnect?: () => void
  /** Latest client layout only for source-rule events, not a service contract. */
  ruleJournal?: boolean
}

const eventLabels = {
  entry: ['eventEntry', 'en'], 'exit-tp': ['eventTp', 'tp'], 'exit-sl': ['eventSl', 'sl'],
  'exit-time': ['eventTime', 'tm'], watch: ['eventWatch', 'wa'], risk: ['eventRisk', 'ho'], scan: ['scanEvent', 'sc'],
} as const
type Part = 'prompt' | 'rationale' | 'decision' | 'watch'
const sectionKey = (id: string, part: Part) => JSON.stringify([id, part])

function Disclosure({ title, part, expanded, onToggle, children }: { title: string; part: Part; expanded: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId()
  return <div className="ags" data-agent-section={part}>
    <button className="agt" type="button" aria-expanded={expanded} aria-controls={id} onClick={onToggle}><span className="ar" aria-hidden="true">{expanded ? '▼' : '▶'}</span>{title}</button>
    <div id={id} className="agx" hidden={!expanded}>{expanded && children}</div>
  </div>
}

function AgentHeader({ event, timeLabel = event.timeLabel }: { event: ClientAgentEvent; timeLabel?: string }) {
  const { language } = useClientPreferences()
  const [label, tone] = eventLabels[event.type]
  return <div className="agh"><span className="sp2" aria-hidden="true">✦</span><b>{terminalReadText(language, 'agentName')}</b><span className="dv2" aria-hidden="true" /><span className={`evb ${tone}`}>{terminalReadText(language, label)}</span><span className="tm">{timeLabel}</span></div>
}

function EventRow({ event, index, expanded, onToggle }: { event: ClientAgentEvent; index: number; expanded: ReadonlySet<string>; onToggle: (id: string) => void }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1]) => terminalReadText(language, key)
  const detail = event.detail, ticket = detail?.ticket
  const props = (part: Part) => ({ part, expanded: expanded.has(sectionKey(event.id, part)), onToggle: () => onToggle(sectionKey(event.id, part)) })
  return <li className={`tft-agc ${eventLabels[event.type][1]}`} data-agent-event={event.id} data-agent-index={index} data-agent-end-index={index} tabIndex={-1}>
    <AgentHeader event={event} />
    <div className="agb">{event.summary ?? event.text}</div>
    {detail && (detail.settings.length > 0 || detail.rawSettings !== undefined) && <Disclosure title={t('promptSection')} {...props('prompt')}>
      {detail.settings.map((field, i) => <div className="kv" key={i}><span>{field.label}</span><b>{field.value}</b></div>)}
      {detail.rawSettings !== undefined && <details className="tft-raw"><summary>{t('rawSettings')}</summary><pre tabIndex={0}>{detail.rawSettings}</pre></details>}
    </Disclosure>}
    {!!detail?.analysis.length && <Disclosure title={t('rationaleSection')} {...props('rationale')}>
      {detail.analysis.map((item, i) => <div className="an" key={i}><b>{item.title}</b><p>{item.text}</p></div>)}
    </Disclosure>}
    {ticket && <Disclosure title={t('decisionSection')} {...props('decision')}>
      <div className="tft-tk"><div className="th2"><span className={`sg ${ticket.signal === 'BUY' ? 'b' : ticket.signal === 'CLOSE' ? 'c' : 'h'}`}>{ticket.signal}</span><b>{ticket.title}</b><span className="as2">{ticket.symbol}</span></div>
        {ticket.fields.length > 0 && <div className="tg2">{ticket.fields.map((field, i) => <span className="c3" key={i}><small>{field.label}</small><b>{field.value}</b></span>)}</div>}
        {ticket.justification !== undefined && <div className="js"><small>{t('justification')}</small>{ticket.justification}</div>}
        {ticket.invalidation !== undefined && <div className="js iv"><small>{t('invalidation')}</small>{ticket.invalidation}</div>}
      </div>
    </Disclosure>}
  </li>
}

function WatchRow({ events, index, expanded, onToggle, summary, range }: { events: readonly ClientAgentEvent[]; index: number; expanded: boolean; onToggle: () => void; summary?: string; range: string }) {
  const { language } = useClientPreferences()
  const title = terminalReadText(language, 'watchDetails', { count: String(events.length) })
  return <li className="tft-agc wfold" data-agent-event={events[0].id} data-agent-index={index} data-agent-end-index={index + events.length - 1} tabIndex={-1} aria-label={title}>
    <AgentHeader event={events[0]} timeLabel={range} />
    <div className="agb">{summary ?? events[0].summary ?? events[0].text}</div>
    <Disclosure part="watch" title={title} expanded={expanded} onToggle={onToggle}>
      {events.map(event => <div className="an" key={event.id} data-watch-event={event.id}><b className="num">{event.timeLabel}</b><p>{event.text}</p></div>)}
    </Disclosure>
  </li>
}

function StrategyFeed({ strategyId, events, operations = [], sourceLabel, statusSummary, watchSummary, error, onReconnect, ruleJournal = false }: ClientAgentFeedProps) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1], values?: Readonly<Record<string, string>>) => terminalReadText(language, key, values)
  const [filter, setFilter] = useState<'all' | 'fills'>('all')
  const [limit, setLimit] = useState(14)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const root = useRef<HTMLElement>(null)
  const revealIndex = useRef<number | null>(null)
  const rows = useMemo(() => filter === 'all' ? events ?? [] : events?.filter(event => event.type === 'entry' || event.type.startsWith('exit-')) ?? [], [events, filter])
  const packed = useMemo(() => {
    const groups: { events: ClientAgentEvent[]; index: number }[] = []
    rows.forEach((event, index) => {
      const previous = groups.at(-1)
      if ((event.type === 'watch' && previous?.events[0].type === 'watch') || (ruleJournal && event.type === 'risk' && event.ruleCheck && previous?.events[0].type === 'risk' && previous.events[0].ruleCheck)) previous!.events.push(event)
      else groups.push({ events: [event], index })
    })
    return groups
  }, [rows, ruleJournal])
  const stop = packed.findIndex(group => group.index >= limit)
  const shownGroups = ruleJournal ? packed.slice(0, limit) : stop < 0 ? packed : packed.slice(0, stop)
  const total = ruleJournal ? packed.length : rows.length
  const visibleCount = ruleJournal ? shownGroups.reduce((count, group) => count + group.events.length, 0) : Math.min(rows.length, limit)
  useLayoutEffect(() => {
    const target = revealIndex.current
    if (target === null) return
    const card = [...(root.current?.querySelectorAll<HTMLElement>('[data-agent-index]') ?? [])].find(node => Number(node.dataset.agentIndex) <= target && Number(node.dataset.agentEndIndex) >= target)
    card?.focus()
    revealIndex.current = null
  }, [limit])
  const toggle = (id: string) => setExpanded(previous => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return <section ref={root} className="teth-agent-feed" data-rule-journal={ruleJournal || undefined} aria-label={t('feed')} data-agent-strategy={strategyId} data-visible-count={visibleCount}>
    {operations.length > 0 && <><div className="tft-fsec">{t('operations')}</div><ul className="tft-event-list" aria-label={t('operations')}>{operations.slice(0, 6).map(operation => <li className="tft-ev op" key={operation.id} data-agent-operation={operation.id}>
      <span className="ax" aria-hidden="true"><i /></span><div className="bd"><div className="mh"><span className="tm">{operation.timeLabel}</span><span className="bg">{operation.label}</span>{operation.version !== undefined && <span className="vr">{operation.version}</span>}</div><div className="tx">{operation.text}</div>{operation.diff !== undefined && <div className="tx2">{operation.diff}</div>}</div>
    </li>)}</ul></>}
    {error && <div className="tft-ev sl" role="alert"><span className="ax" aria-hidden="true"><i /></span><div className="bd"><div className="mh"><span className="bg">{t('error')}</span></div><div className="tx">{error}</div>{onReconnect && <div className="tx2"><button className="tft-reconnect" type="button" onClick={onReconnect}>{t('reconnect')}</button></div>}</div></div>}
    {events !== null && statusSummary && <div className="tft-nowbar">{statusSummary}</div>}
    <div className="tft-fsec tft-feed-heading"><span>{t('decisionHistory')} <small>{sourceLabel}</small></span><div className="tft-filters" role="group" aria-label={t('historyFilter')}><button className={`ffc${filter === 'all' ? ' on' : ''}`} type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('all')}</button><button className={`ffc${filter === 'fills' ? ' on' : ''}`} type="button" aria-pressed={filter === 'fills'} onClick={() => setFilter('fills')}>{ruleJournal ? ruleCheckText(language, 'trades') : t('fillsOnly')}</button></div></div>
    {events === null ? <div className="tft-empty" role="status"><b>{t('unavailable')}</b></div>
      : visibleCount === 0 ? <div className="tft-empty" role="status"><b>{t(events.length === 0 ? 'empty' : 'emptyFills')}</b>{events.length === 0 && <span>{t('firstEvaluation')}</span>}</div>
        : <ul className="tft-event-list" aria-label={t('historyList')}>{shownGroups.map(group => {
          const last = group.events.at(-1)!
          if (ruleJournal && group.events.every(event => event.ruleCheck) && (group.events.length === 1 || group.events[0].type !== 'watch')) return <ClientRuleJournal key={last.id} events={group.events} index={group.index} expanded={expanded.has(sectionKey(last.id, 'decision'))} onToggle={() => toggle(sectionKey(last.id, 'decision'))} />
          if (group.events.length > 1) {
            const props = { events: ruleJournal ? group.events : group.events.slice(0, limit - group.index), index: group.index, expanded: expanded.has(sectionKey(last.id, 'watch')), onToggle: () => toggle(sectionKey(last.id, 'watch')), range: `${last.timeLabel} ~ ${group.events[0].timeLabel}` }
            if (group.events.every(event => event.ruleCheck)) return <ClientRuleWatchGroup key={last.id} {...props} journalDetail={ruleJournal ? { expanded: expanded.has(sectionKey(last.id, 'decision')), onToggle: () => toggle(sectionKey(last.id, 'decision')) } : undefined} count={group.events.length} days={Math.abs(group.events[0].ruleCheck!.barIndex - last.ruleCheck!.barIndex) + 1} />
            return <WatchRow key={last.id} {...props} summary={watchSummary?.(group.events.length)} />
          }
          return group.events[0].ruleCheck
            ? <ClientRuleCheckCard key={group.events[0].id} event={group.events[0]} index={group.index} />
            : <EventRow key={group.events[0].id} event={group.events[0]} index={group.index} expanded={expanded} onToggle={toggle} />
        })}</ul>}
    {total > limit && <button className="tft-more" type="button" onClick={() => { revealIndex.current = ruleJournal ? packed[limit].index : limit; setLimit(value => value + 20) }}>{t('moreHistory', { count: String(rows.length - visibleCount) })}</button>}
  </section>
}

/** Original tfTmSelect resets the new strategy's feed without changing its data. */
export function ClientAgentFeed(props: ClientAgentFeedProps) {
  return <StrategyFeed key={props.strategyId} {...props} />
}
