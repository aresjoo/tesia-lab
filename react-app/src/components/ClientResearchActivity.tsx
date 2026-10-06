import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, CircleAlert, Square } from 'lucide-react'
import { ClientAnimatedLogo } from './ClientAnimatedLogo'
import { useConversationCopy } from '../client-conversation-copy'
import '../client-research-activity.css'
import { ClientMarketSources } from './ClientMarketResponse'
import type { MarketSource } from '../client-market-response-presentation'

/** Display projection only, not an API contract or an execution state machine.
 * Callers must supply observed task states and user-facing summaries, never
 * fabricated validation results, sources, or private model reasoning.
 */
export type ResearchActivityStep = {
  id: string
  title: string
  status: 'running' | 'done' | 'failed' | 'stopped'
  detail?: string
  /** Already public, caller-supplied work summary. Never private model reasoning. */
  publicSummary?: string
  /** Observed tool sources only, never inferred from task title or prose. */
  sources?: readonly MarketSource[]
}

export type ResearchActivityProps = {
  label: string
  status: ResearchActivityStep['status']
  /** Omit when the service has not supplied a task start time. */
  startedAt?: number
  finishedAt?: number
  steps: readonly ResearchActivityStep[]
  source: 'mock' | 'service'
}

function ActivitySummary({ text, running, visible }: { text: string; running: boolean; visible: boolean }) {
  const { c } = useConversationCopy()
  const ref = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const lastScrollTop = useRef(0)
  const previouslyRunning = useRef(running)
  useLayoutEffect(() => {
    // A reader following the live tail starts the completed record at its
    // beginning. A reader who scrolled away keeps their chosen position.
    if (previouslyRunning.current && !running && follow.current && ref.current) {
      ref.current.scrollTop = 0
      lastScrollTop.current = 0
    }
    previouslyRunning.current = running
  }, [running])
  useEffect(() => {
    const el = ref.current
    if (!el || !visible) return
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      if (document.hidden) return
      frame = requestAnimationFrame(() => {
        const overflowing = el.scrollHeight > el.clientHeight + 4
        if (running && follow.current) el.scrollTop = el.scrollHeight
        lastScrollTop.current = el.scrollTop
        el.classList.toggle('ovf', overflowing && el.scrollTop > 4)
      })
    }
    const resize = new ResizeObserver(sync)
    resize.observe(el)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => { cancelAnimationFrame(frame); resize.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [text, running, visible])
  return <div ref={ref} className="cot2" role="region" aria-label={c('activityDescription')} tabIndex={visible ? 0 : -1}
    onWheel={event => { if (event.deltaY < 0) follow.current = false }}
    onTouchStart={() => { follow.current = false }}
    onKeyDown={event => { if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) follow.current = false }}
    onScroll={event => {
      const el = event.currentTarget
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 8
      if (el.scrollTop < lastScrollTop.current - 1) follow.current = false
      else if (atBottom) follow.current = true
      lastScrollTop.current = el.scrollTop
      el.classList.toggle('ovf', el.scrollTop > 4)
    }}>{text}</div>
}

function ElapsedTime({ startedAt, finishedAt, running }: { startedAt: number; finishedAt?: number; running: boolean }) {
  const { c, language } = useConversationCopy()
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
  const duration = c('elapsedSeconds').replace('{seconds}', new Intl.NumberFormat(language).format(seconds))
  return seconds >= 2 ? <span className="els" aria-label={c('elapsedTime').replace('{duration}', duration)}>{duration}</span> : null
}

function StepIcon({ status }: { status: ResearchActivityStep['status'] }) {
  return <span className={`tic ${status}`} aria-hidden="true">
    {status === 'done' ? <Check size={10} /> : status === 'failed' ? <CircleAlert size={12} /> : status === 'stopped' ? <Square size={8} /> : <i className="activity-spinner" />}
  </span>
}

function ActivityStep({ step, parentExpanded }: { step: ResearchActivityStep; parentExpanded: boolean }) {
  const { c } = useConversationCopy()
  const id = useId()
  const detailRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(step.status === 'running')
  const [previousStatus, setPreviousStatus] = useState(step.status)
  if (step.status !== previousStatus) { setPreviousStatus(step.status); if (step.status !== 'running') setExpanded(false) }
  useLayoutEffect(() => {
    if (parentExpanded && !expanded && detailRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true })
  }, [expanded, parentExpanded])
  const stateLabel = { running: c('inProgress'), done: c('done'), failed: c('failed'), stopped: c('stopped') }[step.status]
  const hasDetail = Boolean(step.detail || step.publicSummary || step.sources?.length)
  return <li className={`ar ${step.status}${step.publicSummary ? ' think' : ''}`}>
    <StepIcon status={step.status} />
    <div className={`ab${expanded ? ' open' : ''}`}>
      {hasDetail ? <button ref={triggerRef} className="arh" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
        <span className="at">{step.title}</span><span className={`am ${step.status}`}>{stateLabel}</span><ChevronRight size={12} aria-hidden="true" />
      </button> : <div className="arh"><span className="at">{step.title}</span><span className={`am ${step.status}`}>{stateLabel}</span></div>}
      {hasDetail && <div ref={detailRef} className="ad" id={id} inert={!expanded} aria-hidden={!expanded}><div className="adin">
        {step.detail}
        {step.sources && <ClientMarketSources sources={step.sources} />}
        {step.publicSummary && <ActivitySummary text={step.publicSummary} running={step.status === 'running'} visible={expanded && parentExpanded} />}
      </div></div>}
    </div>
  </li>
}

/** React counterpart of tesia-lab acccc7f actStart / actPaint / actThink.
 * No timers advance steps or declare success. Elapsed time is local display only.
 */
export function ClientResearchActivity({ label, status, startedAt, finishedAt, steps, source }: ResearchActivityProps) {
  const { c, language } = useConversationCopy()
  const id = useId()
  const timelineRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState(status === 'running')
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [previous, setPrevious] = useState({ status, label, language, startedAt, source })
  const [closingLabel, setClosingLabel] = useState<string | null>(null)
  // Only the previous header's decoration survives the source's 240ms collapse.
  // All observed state, timeline content, announcements and elapsed time stay live.
  if (previous.status !== status || previous.label !== label || previous.language !== language || !Object.is(previous.startedAt, startedAt) || previous.source !== source) {
    const sameRun = Object.is(previous.startedAt, startedAt) && previous.source === source
    const stopping = previous.status === 'running' && status !== 'running'
    setPrevious({ status, label, language, startedAt, source })
    if (stopping && expanded && sameRun && previous.language === language && !reduced && !document.hidden) setClosingLabel(previous.label)
    else if (!sameRun || previous.language !== language || status === 'running' || previous.status !== status || previous.label !== label) setClosingLabel(null)
    if (previous.status !== status && status !== 'running') setExpanded(false)
  }
  if (reduced && closingLabel !== null) setClosingLabel(null)
  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useLayoutEffect(() => {
    if (closingLabel === null) return
    const timer = window.setTimeout(() => setClosingLabel(null), 260)
    const visibility = () => { if (document.hidden) setClosingLabel(null) }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [closingLabel])
  useLayoutEffect(() => {
    if (!expanded && timelineRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true })
  }, [expanded])
  const closing = closingLabel !== null
  return <section className={`g-act2 ${expanded ? 'open' : ''} ${status !== 'running' && !closing ? 'fin' : ''}`} aria-label={c('activityRegion')} data-source={source} data-activity-state={status} data-header-closing={closing}>
    <button ref={triggerRef} className="hd" type="button" aria-label={closing ? label : undefined} aria-expanded={expanded} aria-controls={id} onClick={() => { setClosingLabel(null); setExpanded(value => !value) }}>
      {status === 'running' || closing ? <ClientAnimatedLogo className="activity-logo" /> : <StepIcon status={status} />}
      <span className="hlb" aria-hidden={closing || undefined}>{closingLabel ?? label}</span>
      {startedAt !== undefined && Number.isFinite(startedAt) && <ElapsedTime startedAt={startedAt} finishedAt={finishedAt} running={status === 'running'} />}
      <ChevronDown size={13} className="chev" aria-hidden="true" />
    </button>
    <div ref={timelineRef} className="tl" id={id} inert={!expanded} aria-hidden={!expanded}>
      <ol className="tlin">{steps.map(step => <ActivityStep key={step.id} step={step} parentExpanded={expanded} />)}</ol>
    </div>
    <span className="activity-announcer" role="status" aria-live="polite">{label}</span>
  </section>
}
