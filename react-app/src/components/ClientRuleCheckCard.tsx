import { useId } from 'react'
import type { ClientAgentEvent } from '../client-agent-view'
import { useClientPreferences } from '../client-preferences'
import { ruleCheckText } from '../client-rule-check-copy'
import { terminalReadText } from '../client-terminal-read-copy'
import '../client-rule-check.css'

const eventLabel = { entry: 'eventEntry', watch: 'eventWatch', risk: 'eventRisk', 'exit-sl': 'eventSl', 'exit-tp': 'eventTp', 'exit-time': 'eventTime', scan: 'scanEvent' } as const
const summaryLabel = { entry: 'entrySummary', watch: 'watchSummary', risk: 'holdingSummary', 'exit-sl': 'slSummary', 'exit-tp': 'tpSummary', 'exit-time': 'timeSummary' } as const
const identityText = (text: string) => text

function RuleEvidence({ event }: { event: ClientAgentEvent }) {
  const { language } = useClientPreferences()
  const check = event.ruleCheck
  if (!check) return null
  return <>
    <div className="tm-rows">{check.rows.map((row, i) => <div className="tm-row" key={i} data-rule-state={row.state}><span>{row.label}</span><b className="num">{row.value}</b><i className={row.state}>{ruleCheckText(language, row.state)}</i></div>)}</div>
    {check.outputs.map((output, i) => <div className="tm-out" key={i}><small>{output.label}</small><span className={output.tone}>{output.text}</span></div>)}
    <div className="tm-provenance">{check.provenance}</div>
  </>
}

/** Latest source journal presentation, scoped to the source rule producer. */
export function ClientRuleJournal({ events, index, expanded, onToggle, nested = false, displayText = identityText }: { events: readonly ClientAgentEvent[]; index: number; expanded: boolean; onToggle: () => void; nested?: boolean; displayText?: (text: string) => string }) {
  const { language } = useClientPreferences()
  const id = useId()
  const first = events[0], last = events.at(-1)!
  const key = first.type === 'scan' ? undefined : summaryLabel[first.type]
  // Missing checks cannot support a categorical rule explanation.
  const hasEvidence = events.every(event => event.ruleCheck && event.ruleCheck.rows.length > 0 && event.ruleCheck.rows.every(row => row.state !== 'unknown'))
  const summary = first.summary !== undefined ? displayText(first.summary) : key && hasEvidence ? ruleCheckText(language, key) : displayText(first.text)
  return <li className="tb-rl" tabIndex={-1} data-agent-event={nested ? undefined : first.id} data-agent-index={nested ? undefined : index} data-agent-end-index={nested ? undefined : index + events.length - 1}>
    <button type="button" className="tb-rule-toggle" aria-expanded={expanded} aria-controls={id} onClick={onToggle}>
      <span className="tb-ft num">{events.length > 1 ? `${last.timeLabel} ~ ${first.timeLabel}` : first.timeLabel}</span>
      <b>{first.type === 'risk' ? ruleCheckText(language, 'holding') : terminalReadText(language, eventLabel[first.type])}{events.length > 1 && ` ${ruleCheckText(language, 'count', { count: String(events.length) })}`}</b>
      <span className="tb-fs">{summary} <span className="tb-fx">{ruleCheckText(language, expanded ? 'collapse' : 'full')}</span></span>
    </button>
    <ul className="tb-fr tft-event-list" id={id} hidden={!expanded}>{expanded && events.map(event => <li key={event.id} className="tb-rule-evidence" data-rule-event={event.id}>
      {events.length > 1 && <p className="tb-ft num">{event.timeLabel}</p>}
      <p className="tb-rule-original">{displayText(event.summary ?? event.text)}</p>
      <RuleEvidence event={event} />
    </li>)}</ul>
  </li>
}

/** Display only. All conditions and outcomes must be supplied by the producer. */
export function ClientRuleCheckCard({ event, index, nested = false }: { event: ClientAgentEvent; index: number; nested?: boolean }) {
  const { language } = useClientPreferences()
  const check = event.ruleCheck
  if (!check) return null
  return <li className="tm-card rule" tabIndex={-1} data-agent-event={nested ? undefined : event.id} data-watch-event={nested ? event.id : undefined} data-agent-index={nested ? undefined : index} data-agent-end-index={nested ? undefined : index}>
    <div className="tm-ch"><span className="tm-t num">{event.timeLabel}</span><span className="tm-k">{ruleCheckText(language, 'title')}</span><span className="tm-res">{terminalReadText(language, eventLabel[event.type])}</span></div>
    <RuleEvidence event={event} />
  </li>
}

export function ClientRuleWatchGroup({ events, index, expanded, onToggle, range, count, days, journalDetail, displayText }: { events: readonly ClientAgentEvent[]; index: number; expanded: boolean; onToggle: () => void; range: string; count: number; days: number; journalDetail?: { expanded: boolean; onToggle: () => void }; displayText?: (text: string) => string }) {
  const { language } = useClientPreferences()
  const id = useId()
  const title = ruleCheckText(language, 'watch', { count: String(count), days: String(days) })
  return <li className="tm-foldw" tabIndex={-1} data-agent-event={events[0].id} data-agent-index={index} data-agent-end-index={index + events.length - 1}>
    <button className="tm-fold" type="button" aria-expanded={expanded} aria-controls={id} onClick={onToggle}>
      <span className="num">{range}</span><b>{title}</b><i>{ruleCheckText(language, expanded ? 'collapse' : 'expand')}</i>
    </button>
    <ul className="tm-foldx tft-event-list" id={id} hidden={!expanded}>{expanded && (journalDetail ? <ClientRuleJournal events={events} index={index} {...journalDetail} nested displayText={displayText} /> : events.map((event, i) => <ClientRuleCheckCard key={event.id} event={event} index={index + i} nested />))}</ul>
  </li>
}
