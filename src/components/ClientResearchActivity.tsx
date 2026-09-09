import { useEffect, useId, useState } from 'react'
import { Check, ChevronDown, ChevronRight, CircleAlert, Square } from 'lucide-react'
import { ClientLogo } from './ClientChrome'
import '../client-research-activity.css'

/** Display projection only, not an API contract or an execution state machine.
 * Callers must supply observed task states and user-facing summaries, never
 * fabricated validation results, sources, or private model reasoning.
 */
export type ResearchActivityStep = {
  id: string
  title: string
  status: 'running' | 'done' | 'failed' | 'stopped'
  detail?: string
}

type ActivityProps = {
  label: string
  status: ResearchActivityStep['status']
  startedAt: number
  finishedAt?: number
  steps: readonly ResearchActivityStep[]
  source: 'mock' | 'service'
}

function ElapsedTime({ startedAt, finishedAt, running }: { startedAt: number; finishedAt?: number; running: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    let timer: number | undefined
    const sync = () => {
      window.clearInterval(timer)
      timer = undefined
      if (!document.hidden) {
        setNow(Date.now())
        timer = window.setInterval(() => setNow(Date.now()), 1000)
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sync) }
  }, [running, startedAt])
  // A missing service timestamp is unknown, not a duration invented by the UI.
  const end = running ? now : finishedAt
  if (end === undefined) return null
  const seconds = Math.max(0, Math.floor((end - startedAt) / 1000))
  return seconds >= 2 ? <span className="els" aria-label={`경과 시간 ${seconds}초`}>{seconds}초</span> : null
}

function StepIcon({ status }: { status: ResearchActivityStep['status'] }) {
  return <span className={`tic ${status}`} aria-hidden="true">
    {status === 'done' ? <Check size={10} /> : status === 'failed' ? <CircleAlert size={12} /> : status === 'stopped' ? <Square size={8} /> : <span className="g-tdots"><i /><i /><i /></span>}
  </span>
}

function ActivityStep({ step }: { step: ResearchActivityStep }) {
  const id = useId()
  const [expanded, setExpanded] = useState(step.status === 'running')
  const [previousStatus, setPreviousStatus] = useState(step.status)
  if (step.status !== previousStatus) { setPreviousStatus(step.status); if (step.status !== 'running') setExpanded(false) }
  const stateLabel = { running: '진행 중', done: '완료', failed: '실패', stopped: '중지됨' }[step.status]
  return <li className={`ar ${step.status}`}>
    <StepIcon status={step.status} />
    <div className="ab">
      {step.detail ? <button className="arh" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <span className="at">{step.title}</span><span className={`am ${step.status}`}>{stateLabel}</span><ChevronRight size={12} aria-hidden="true" />
      </button> : <div className="arh"><span className="at">{step.title}</span><span className={`am ${step.status}`}>{stateLabel}</span></div>}
      {step.detail && <div className="ad" id={id} hidden={!expanded}>{step.detail}</div>}
    </div>
  </li>
}

/** React counterpart of tesia-lab acccc7f actStart / actPaint / actThink.
 * No timers advance steps or declare success. Elapsed time is local display only.
 */
export function ClientResearchActivity({ label, status, startedAt, finishedAt, steps, source }: ActivityProps) {
  const id = useId()
  const [expanded, setExpanded] = useState(status === 'running')
  const [previousStatus, setPreviousStatus] = useState(status)
  if (status !== previousStatus) { setPreviousStatus(status); if (status !== 'running') setExpanded(false) }
  return <section className={`g-act2 ${expanded ? 'open' : ''} ${status !== 'running' ? 'fin' : ''}`} aria-label="TETH 작업 과정" data-source={source}>
    <button className="hd" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      {status === 'running' ? <ClientLogo className="activity-logo" /> : <StepIcon status={status} />}
      <span className="hlb">{label}</span>
      <ElapsedTime startedAt={startedAt} finishedAt={finishedAt} running={status === 'running'} />
      <ChevronDown size={13} className="chev" aria-hidden="true" />
    </button>
    <div className="tl" id={id} hidden={!expanded}>
      <ol className="tlin">{steps.map(step => <ActivityStep key={step.id} step={step} />)}</ol>
    </div>
    <span className="activity-announcer" role="status" aria-live="polite">{label}</span>
  </section>
}
