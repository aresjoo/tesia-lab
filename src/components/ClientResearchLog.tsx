import '../client-research-document.css'

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

export function ResearchFinding({ finding }: { finding: NonNullable<ResearchLogEntry['finding']> }) {
  return <div className="g-finding">
    <div>{finding.title}</div>
    <div><span className="k">Professional</span><span className="pro">{finding.professional}</span></div>
    <div><span className="k">쉽게 말하면</span>{finding.plain}</div>
    <div><span className="k">의미</span>{finding.meaning}</div>
    <div><span className="k">다음 행동</span>{finding.nextAction}</div>
  </div>
}

export function ClientResearchLog({ entries, source, status }: {
  entries: readonly ResearchLogEntry[]
  source: 'mock-replay' | 'service'
  status: 'running' | 'paused' | 'completed' | 'failed'
}) {
  return <section className="g-research-log" aria-label="연구 진행 기록" data-source={source}>
    <ol className="g-act">{entries.map(row => <li key={row.id} className={`g-act-row ${row.state}`}>
      <time className="ts" aria-label={`시작 후 ${row.elapsedSeconds}초`}>{String(Math.floor(row.elapsedSeconds / 60)).padStart(2, '0')}:{String(Math.floor(row.elapsedSeconds % 60)).padStart(2, '0')}</time>
      <span className="ic" aria-hidden="true">{row.state === 'work' ? '→' : row.state === 'warn' || row.state === 'failed' ? '!' : '✓'}</span>
      <div className="bd"><span className="ag">{row.agent}</span><span className="research-row-state">{row.state === 'warn' ? '주의: ' : row.state === 'failed' ? '실패: ' : ''}</span>{row.summary}
        {row.finding && <ResearchFinding finding={row.finding} />}
      </div>
    </li>)}</ol>
    <p className="research-log-announcer" role="status">{status === 'running' ? '연구 진행 중' : status === 'paused' ? '재생 일시 정지' : status === 'failed' ? '연구 실패' : '연구 기록 완료'}{entries.length ? ` · ${entries.at(-1)!.agent}: ${entries.at(-1)!.summary}` : ''}</p>
  </section>
}
