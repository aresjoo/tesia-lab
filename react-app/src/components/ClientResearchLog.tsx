import '../client-research-document.css'
import { clientResearchLabel } from '../client-research-label'
import { useClientPreferences } from '../client-preferences'
import { nativeResearchText as text } from '../internal-poc/native-research-workspace-copy'

/** View model only. Service adapters must supply observed events and evidence. */
export type ResearchLogEntry = {
  id: string
  elapsedSeconds: number
  agent: string
  summary: string
  state: 'work' | 'done' | 'warn' | 'failed'
  finding?: {
    title: string
    professional: string
    plain: string
    meaning: string
    nextAction: string
  }
}

/** Service observations may omit elapsed time; never infer it from row order. */
export type ResearchObservedLogEntry = Omit<ResearchLogEntry, 'elapsedSeconds'> & { elapsedSeconds?: number }

export function ResearchFinding({ finding }: { finding: NonNullable<ResearchLogEntry['finding']> }) {
  const { language } = useClientPreferences()
  return <div className="g-finding">
    <div>{finding.title}</div>
    <div><span className="k">{text(language, 'plain')}</span>{finding.plain}</div>
    <div><span className="k">{text(language, 'professional')}</span><span className="pro">{finding.professional}</span></div>
    <div><span className="k">{text(language, 'meaning')}</span>{finding.meaning}</div>
    <div><span className="k">{text(language, 'nextAction')}</span>{finding.nextAction}</div>
  </div>
}

export function ClientResearchLog({ entries, source, status }: {
  entries: readonly ResearchObservedLogEntry[]
  source: 'mock-replay' | 'service'
  status: 'unavailable' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped'
}) {
  const { language } = useClientPreferences()
  return <section className="g-research-log" aria-label={text(language, 'log')} data-source={source}>
    <ol className="g-act">{entries.map(row => <li key={row.id} className={`g-act-row ${row.state}`}>
      {row.elapsedSeconds !== undefined && Number.isFinite(row.elapsedSeconds) && row.elapsedSeconds >= 0
        ? <time className="ts" aria-label={text(language, 'elapsed', { seconds: row.elapsedSeconds })}>{String(Math.floor(row.elapsedSeconds / 60)).padStart(2, '0')}:{String(Math.floor(row.elapsedSeconds % 60)).padStart(2, '0')}</time>
        : <span className="ts" aria-label={text(language, 'missingElapsed')}>—</span>}
      <span className="ic" aria-hidden="true">{row.state === 'work' ? '→' : row.state === 'warn' || row.state === 'failed' ? '!' : '✓'}</span>
      <div className="bd"><span className="ag" data-agent={row.agent}>{clientResearchLabel(row.agent, language)}</span><span className="research-row-state">{row.state === 'warn' ? text(language, 'warning') : row.state === 'failed' ? text(language, 'failure') : ''}</span>{row.summary}
        {row.finding && <ResearchFinding finding={row.finding} />}
      </div>
    </li>)}</ol>
    {source === 'service' && entries.length === 0 && <p className="g-note">{text(language, 'missingLog')}</p>}
    <p className="research-log-announcer" role="status">{text(language, status === 'paused' && source === 'mock-replay' ? 'replayPaused' : status === 'stopped' ? 'logStopped' : status === 'completed' ? 'logCompleted' : status)}{entries.length ? ` · ${clientResearchLabel(entries.at(-1)!.agent, language)}: ${entries.at(-1)!.summary}` : ''}</p>
  </section>
}
