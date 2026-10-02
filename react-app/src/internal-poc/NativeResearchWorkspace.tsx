import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { ClientIcon } from '../components/ClientIcon'
import { ClientResearchLog } from '../components/ClientResearchLog'
import { clientResearchLabel } from '../client-research-label'
import { useClientPreferences } from '../client-preferences'
import {
  RESEARCH_DOCUMENT_SURFACES, RESEARCH_DOCUMENT_KINDS, RESEARCH_ROLE_SURFACES, openResearchDocument, researchView,
  type NativeResearchWorkspaceProps, type NativeResearchView, type NativeResearchCompletionPresentation,
} from './native-research-workspace-model'
import '../client-restored-research.css'
import { nativeResearchText as text } from './native-research-workspace-copy'
import { NativeResearchDocuments } from './NativeResearchDocuments'
import { NativeAnalysisNavigation } from './NativeAnalysisLayout'
import { NativeResearchThread } from './NativeResearchThread'

/** Source gDoc/g-tabs/g-aux presentation with caller-supplied observations.
 * Does not fetch, store, time, infer, cancel or manufacture research results.
 */
export function NativeResearchWorkspace(props: NativeResearchWorkspaceProps) {
  return <NativeAnalysisNavigation>{openAnalysis => <ResearchWorkspaceScope key={props.scopeId} {...props} onOpenAnalysis={props.onOpenAnalysis ?? openAnalysis} />}</NativeAnalysisNavigation>
}

function ResearchWorkspaceScope({
  scopeId, title, titleEditor, onBack, strategyDocument, documents = [], typedDocuments = [], entries = [], status = 'unavailable', statusLabel,
  team = [], hypothesis, critic, completion, completionPresentation, notice, analysis, analysisOpen = false, onOpenAnalysis, onCloseAnalysis,
  view: suppliedView, onViewChange, composer, composerHasContext = false, visible = true, threadForDocument, threadEntriesForDocument, threadActivity,
}: NativeResearchWorkspaceProps) {
  const { language } = useClientPreferences()
  const label = (text: string) => clientResearchLabel(text, language)
  const prefix = useId()
  const baseContent = new Map([
    ['plan', strategyDocument], ['hypo', hypothesis], ['critic', critic],
  ])
  const supplied = new Map(documents.map(document => [document.id, document]))
  const typed = new Map(typedDocuments.map(document => [document.id, document]))
  const surfaces = [
    ...RESEARCH_DOCUMENT_SURFACES.map(surface => ({ ...surface, ...(typed.get(surface.id)?.title ? { title: typed.get(surface.id)!.title! } : {}), ...supplied.get(surface.id) })),
    ...documents.filter(document => !RESEARCH_DOCUMENT_SURFACES.some(surface => surface.id === document.id)),
    ...typedDocuments.filter(document => !RESEARCH_DOCUMENT_SURFACES.some(surface => surface.id === document.id)).map(document => ({ id: document.id, title: document.title ?? document.id })),
  ].filter((document, index, all) => all.findIndex(other => other.id === document.id) === index)
  const [localView, setLocalView] = useState<NativeResearchView>({ activeDocumentId: 'plan', openDocumentIds: ['plan', 'activity'] })
  const currentView = researchView(suppliedView ?? localView, surfaces.map(document => document.id))
  const active = currentView.activeDocumentId
  const openTabKey = currentView.openDocumentIds.join('\u0000')
  const [auxOpen, setAuxOpen] = useState(false)
  const tabs = useRef<HTMLElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const aux = useRef<HTMLElement>(null)
  const auxTrigger = useRef<HTMLButtonElement>(null)
  const positions = useRef(new Map<string, number>())
  const threadEnd = useRef<HTMLDivElement>(null)
  const nearThreadEnd = useRef(true)
  const lastThreadActivity = useRef(threadActivity)
  const [whatIfActivities, setWhatIfActivities] = useState<Record<string, { documentId: string; messageId: string }>>({})
  const lastWhatIfActivities = useRef(new Map<string, string>())
  const validWhatIfEvents = useRef(new Set<string>())
  const [unreadThreads, setUnreadThreads] = useState<Record<string, string>>({})
  const onWhatIfActivity = useCallback((documentId: string, messageId: string, present: boolean) => {
    if (present) {
      validWhatIfEvents.current.add(messageId)
      setWhatIfActivities(value => ({ ...value, [documentId]: { documentId, messageId } }))
    } else {
      validWhatIfEvents.current.delete(messageId)
      setWhatIfActivities(value => {
        if (value[documentId]?.messageId !== messageId) return value
        const next = { ...value }; delete next[documentId]; return next
      })
      setUnreadThreads(value => {
        if (value[documentId] !== messageId) return value
        const next = { ...value }; delete next[documentId]; return next
      })
    }
  }, [])
  const focusTab = useRef(false)
  const lastDocument = useRef(active)
  const wasAnalysisOpen = useRef(analysisOpen)
  const wasVisible = useRef(visible)
  const analysisTrigger = useRef<HTMLElement | null>(null)
  const panelId = (id: string) => `${prefix}-panel-${encodeURIComponent(id)}`
  const tabId = (id: string) => `${prefix}-tab-${encodeURIComponent(id)}`
  const open = (id: string, moveFocus = true) => {
    if (!surfaces.some(document => document.id === id)) return
    if (scroll.current) positions.current.set(active, scroll.current.scrollTop)
    const next = openResearchDocument(currentView, id)
    focusTab.current = moveFocus
    setLocalView(next)
    onViewChange?.(next)
    setAuxOpen(false)
  }
  useLayoutEffect(() => {
    if (lastDocument.current !== active && scroll.current) scroll.current.scrollTop = positions.current.get(active) ?? 0
    lastDocument.current = active
    if (focusTab.current) {
      tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
      focusTab.current = false
    }
    if (wasAnalysisOpen.current && !analysisOpen && analysisTrigger.current?.isConnected
      && analysisTrigger.current.getClientRects().length && !analysisTrigger.current.closest('[hidden], [inert]')) analysisTrigger.current.focus({ preventScroll: true })
    wasAnalysisOpen.current = analysisOpen
    if (!wasVisible.current && visible && !analysisOpen) {
      const focused = document.activeElement
      // The opening trigger is now hidden. Repair only lost/hidden focus, never
      // steal a surviving composer focus/selection when its DOM host moves.
      if (!(focused instanceof HTMLElement) || focused === document.body || !focused.getClientRects().length || focused.closest('[hidden], [inert]')) {
        tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
      }
    }
    wasVisible.current = visible
    if (auxOpen) aux.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }, [active, analysisOpen, auxOpen, visible])
  useLayoutEffect(() => {
    const nav = tabs.current
    if (!nav || !visible || analysisOpen) return
    let disposed = false, frame = 0
    const revealSelected = () => {
      if (disposed || !nav.isConnected || !nav.clientWidth || nav.closest('[hidden], [inert]')) return
      const selected = nav.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!selected) return
      const viewport = nav.getBoundingClientRect(), tab = selected.getBoundingClientRect()
      const delta = tab.left < viewport.left ? tab.left - viewport.left
        : tab.right > viewport.right ? tab.right - viewport.right : 0
      if (Math.abs(delta) > 0.5) nav.scrollLeft += delta
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(revealSelected) }
    revealSelected()
    const observer = new ResizeObserver(schedule)
    observer.observe(nav)
    nav.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab => observer.observe(tab))
    void document.fonts.ready.then(revealSelected)
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame) }
  }, [active, analysisOpen, visible, openTabKey])
  useLayoutEffect(() => {
    const previous = lastThreadActivity.current
    lastThreadActivity.current = threadActivity
    const incoming = []
    if (threadActivity && (previous?.messageId !== threadActivity.messageId || previous.documentId !== threadActivity.documentId)) {
      incoming.push({ ...threadActivity, messageId: JSON.stringify(['message', threadActivity.documentId, threadActivity.messageId]), isCurrent: () => true })
    }
    for (const activity of Object.values(whatIfActivities)) {
      if (lastWhatIfActivities.current.get(activity.documentId) !== activity.messageId) {
        incoming.push({ ...activity, userSubmitted: false, isCurrent: () => validWhatIfEvents.current.has(activity.messageId) })
      }
    }
    lastWhatIfActivities.current = new Map(Object.values(whatIfActivities).map(activity => [activity.documentId, activity.messageId]))
    for (const event of incoming) {
      if (!event.isCurrent()) continue
      const canFollow = visible && !analysisOpen && active === event.documentId
        && (event.userSubmitted || nearThreadEnd.current)
      if (!canFollow) {
        if (!event.userSubmitted) queueMicrotask(() => {
          if (event.isCurrent()) setUnreadThreads(value => ({ ...value, [event.documentId]: event.messageId }))
        })
        continue
      }
      // Scroll the document, never the page/composer or an unrelated active tab.
      if (scroll.current && threadEnd.current) scroll.current.scrollTop = scroll.current.scrollHeight
      queueMicrotask(() => setUnreadThreads(value => {
        if (!event.isCurrent() || !Object.hasOwn(value, event.documentId)) return value
        const next = { ...value }; delete next[event.documentId]; return next
      }))
    }
  }, [active, analysisOpen, visible, threadActivity, whatIfActivities])
  const closeAux = () => { setAuxOpen(false); auxTrigger.current?.focus({ preventScroll: true }) }
  const openAnalysis = useCallback(() => {
    analysisTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    onOpenAnalysis?.()
  }, [onOpenAnalysis])
  const roles = [
    ...RESEARCH_ROLE_SURFACES.map(name => team.find(member => member.name === name) ?? { id: name, name, status: 'unavailable' as const }),
    ...team.filter(member => !RESEARCH_ROLE_SURFACES.some(name => name === member.name)),
  ]
  const teamStatus = { unavailable: 'notSupplied', waiting: 'waiting', working: 'working', done: 'done', failed: 'roleFailed' } as const
  const contentFor = (id: string) => supplied.get(id)?.content ?? baseContent.get(id)
  const documentFor = (id: string) => typed.get(id) ?? (Object.hasOwn(RESEARCH_DOCUMENT_KINDS, id)
    ? { id, kind: RESEARCH_DOCUMENT_KINDS[id as keyof typeof RESEARCH_DOCUMENT_KINDS], state: 'unavailable' as const }
    : undefined)
  const documentAvailable = (id: string) => {
    const content = contentFor(id), document = typed.get(id)
    return content != null && typeof content !== 'boolean' && (typeof content !== 'string' || content.trim() !== '')
      || document?.state === 'ready' && document.data != null
  }
  const bodyFor = (id: string) => {
    const content = contentFor(id), document = documentFor(id)
    // Actual plan/report controller content is retained. Explicit structured
    // findings may accompany it; unavailable fallback must not mask real data.
    return <>{document && (content == null || typed.has(id)) && <NativeResearchDocuments scopeId={scopeId} document={document} active={visible && active === id && !analysisOpen} onOpenDocument={open} onOpenAnalysis={onOpenAnalysis ? openAnalysis : undefined} />}{content}</>
  }
  return <div className="client-restored-research native-research-workspace" data-source="service" data-scope={scopeId} data-research-status={status}>
    <div hidden={!analysisOpen} style={!analysisOpen ? { display: 'none' } : { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} data-research-analysis="true">
      {onCloseAnalysis && <button type="button" className="g-btn-t" onClick={onCloseAnalysis}>{text(language, 'backDocument')}</button>}
      {analysis ?? <p className="g-note">{text(language, 'missingAnalysis')}</p>}
    </div>
    <div className="rw-workspace" hidden={analysisOpen} style={analysisOpen ? { display: 'none' } : undefined}>
      <section className="rw-center">
        <header className="rw-header">
          <div className="rw-title">
            <button type="button" className="g-btn-t" aria-label={text(language, 'back')} onClick={onBack}>←</button>
            <div className="rw-heading">{titleEditor ?? <span title={title}>{title || text(language, 'newStrategy')}</span>}</div>
            <span className="g-tag">{status === 'running' && <span className="g-dot run" />}{statusLabel ?? text(language, status)}</span>
            <button ref={auxTrigger} type="button" className="rw-mobile-artifacts g-btn-t" aria-label={text(language, 'openArtifacts', { label: label('Artifacts') })} aria-expanded={auxOpen} aria-controls={`${prefix}-aux`} onClick={() => setAuxOpen(value => !value)}><ClientIcon name="document" /> {label('Artifacts')}</button>
          </div>
          <nav ref={tabs} className="rw-tabs" role="tablist" aria-label={text(language, 'openedDocuments')} onKeyDown={event => {
            if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const ids = currentView.openDocumentIds, index = ids.indexOf(active)
            open(ids[event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length])
          }}>{currentView.openDocumentIds.map(id => <button type="button" role="tab" key={id} id={tabId(id)} aria-controls={panelId(id)} tabIndex={id === active ? 0 : -1} aria-selected={id === active} className={id === active ? 'on' : ''} onClick={() => open(id)}>{label(surfaces.find(document => document.id === id)!.title)}</button>)}</nav>
        </header>
        <div ref={scroll} className="rw-scroll" onScroll={event => {
          const element = event.currentTarget
          positions.current.set(active, element.scrollTop)
          nearThreadEnd.current = element.scrollHeight - element.clientHeight - element.scrollTop < 96
          if (visible && !analysisOpen && element.clientHeight > 0 && nearThreadEnd.current && unreadThreads[active]) setUnreadThreads(value => {
            const next = { ...value }; delete next[active]; return next
          })
        }}>
          {notice}
          {surfaces.map(document => <article key={document.id} id={panelId(document.id)} role="tabpanel" aria-label={text(language, 'document', { label: label(document.title) })} className="g-doc g-adoc" hidden={active !== document.id} style={active !== document.id ? { display: 'none' } : undefined}>
            <NativeResearchThread documentId={document.id} entries={threadEntriesForDocument?.(document.id)} legacy={threadForDocument?.(document.id)} onWhatIfActivity={onWhatIfActivity}>
            {document.id === 'activity' ? <>
              <ClientResearchLog entries={entries} source="service" status={status} />
              {completion !== undefined ? <div className="rw-complete">{completion}</div>
                : completionPresentation?.kind === status && <ResearchCompletion key={`${completionPresentation.kind}:${completionPresentation.revision}:${completionPresentation.kind === 'stopped' && !!completionPresentation.onResume}`} presentation={completionPresentation} documentAvailable={documentAvailable} onOpen={open} />}
            </> : contentFor(document.id) != null || documentFor(document.id) ? bodyFor(document.id) : <><h3>{label(document.title)}</h3><p className="g-note">{text(language, 'missingDocument', { label: label(document.title) })}</p></>}
            {document.id === 'plan' && onOpenAnalysis && <div className="ra-entry"><button type="button" className="g-btn g-btn-s" onClick={openAnalysis}>{text(language, 'chart')} <span aria-hidden="true">↗</span></button></div>}
            </NativeResearchThread>
          </article>)}
          <div ref={threadEnd} />
        </div>
        {composer !== undefined && <div className="rw-composer-wrap">{unreadThreads[active] && <button type="button" className="native-thread-unread g-btn-t" onClick={() => {
          if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
          nearThreadEnd.current = true
          setUnreadThreads(value => { const next = { ...value }; delete next[active]; return next })
          tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
        }}>↓ {text(language, 'newResponse')}</button>}{!composerHasContext && <div className="rw-context"><ClientIcon name="document" size={12} />{label(surfaces.find(document => document.id === active)!.title)}</div>}{composer}</div>}
      </section>
      <aside ref={aux} id={`${prefix}-aux`} className={`rw-aux${auxOpen ? ' is-open' : ''}`} aria-label={label('Artifacts')} onKeyDown={event => {
        if (!auxOpen || event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); closeAux() }
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')].filter(button => button.getClientRects().length > 0)
          const first = buttons[0], last = buttons.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
        <div className="rw-aux-heading">{label('Artifacts')}<button type="button" className="rw-mobile-artifacts g-btn-t" aria-label={text(language, 'closeArtifacts', { label: label('Artifacts') })} onClick={closeAux}>×</button></div>
        {surfaces.map(document => <button type="button" className={`rw-artifact${active === document.id ? ' on' : ''}`} key={document.id} aria-current={active === document.id ? 'page' : undefined} onClick={() => open(document.id, auxOpen)}><ClientIcon name="document" size={14} /><span>{label(document.title)}</span><small>{unreadThreads[document.id] ? text(language, 'newResponse') : supplied.get(document.id)?.statusLabel ?? typed.get(document.id)?.statusLabel ?? (document.id === 'activity' ? entries.length ? '' : text(language, 'notSupplied') : contentFor(document.id) == null && typed.get(document.id)?.state !== 'ready' ? text(language, 'notSupplied') : '')}</small></button>)}
        <div className="rw-aux-heading rw-team-heading">{label('Research Team')}</div>
        {roles.map(member => <div className="rw-team" key={member.id} data-research-role={member.name} data-role-status={member.status}><span>{label(member.name)}</span><small>{member.status === 'working' && <i className="g-dot run" />}{member.status === 'done' && <i className="g-dot ok" />}{member.statusLabel ?? text(language, teamStatus[member.status])}</small></div>)}
      </aside>
    </div>
  </div>
}

/** Mirrors gFinishRun/gActivity's follow-up body, without the fixture producer. */
function ResearchCompletion({ presentation, documentAvailable, onOpen }: {
  presentation: NativeResearchCompletionPresentation
  documentAvailable: (id: string) => boolean
  onOpen: (id: string) => void
}) {
  const { language } = useClientPreferences()
  const descriptionId = useId()
  const onResume = presentation.kind === 'stopped' ? presentation.onResume : undefined
  const [phase, setPhase] = useState<'idle' | 'pending' | 'submitted' | 'failed'>('idle')
  // Scope/revision/permission withdrawal remounts this card. Merely recreating
  // an inline callback during navigation must not unlock an outstanding request.
  const request = useRef<object | null>(null)
  useLayoutEffect(() => {
    request.current = null
    return () => { request.current = null }
  }, [])
  const resume = async () => {
    if (!onResume || request.current || phase === 'submitted') return
    const token = {}
    request.current = token
    setPhase('pending')
    try {
      await onResume()
      if (request.current === token) setPhase('submitted')
    } catch {
      if (request.current === token) {
        request.current = null
        setPhase('failed')
      }
    }
  }
  const summary: string[] = []
  if (presentation.kind === 'completed' && presentation.summary) {
    const observed = presentation.summary
    for (const [count, key] of [[observed.completedStages, 'completedStages'], [observed.strategyRevisions, 'strategyRevisions'], [observed.backtests, 'backtestRuns']] as const) {
      if (count !== undefined && Number.isSafeInteger(count) && count >= 0) summary.push(text(language, key, { count }))
    }
    if (observed.holdout === 'passed' || observed.holdout === 'warning') summary.push(text(language, observed.holdout === 'passed' ? 'holdoutPassed' : 'holdoutWarning'))
  }
  const target = presentation.kind === 'completed' ? presentation.reportDocumentId ?? 'report' : presentation.planDocumentId ?? 'plan'
  const available = documentAvailable(target)
  const pending = phase === 'pending'
  return <section className="rw-complete" aria-label={text(language, presentation.kind === 'completed' ? 'completed' : 'researchInterrupted')} data-completion-kind={presentation.kind}>
    <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--gt)' }}>{text(language, presentation.kind === 'completed' ? 'completed' : 'researchInterrupted')}</h3>
    {presentation.kind === 'completed'
      ? <p className="g-note" style={{ marginTop: 4 }}>{summary.length ? summary.join(', ') : text(language, 'missingCompletionSummary')}</p>
      : presentation.reason && <p className="g-note" style={{ marginTop: 4, overflowWrap: 'anywhere' }}>{presentation.reason}</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {presentation.kind === 'completed'
        ? <button type="button" className="g-btn g-btn-p" style={{ maxWidth: '100%', whiteSpace: 'normal' }} disabled={!available} aria-describedby={!available ? descriptionId : undefined} onClick={() => onOpen(target)}>{text(language, 'openFinalReport')}</button>
        : <>
          <button type="button" className="g-btn g-btn-p" style={{ maxWidth: '100%', whiteSpace: 'normal' }} disabled={!onResume || pending || phase === 'submitted'} aria-busy={pending || undefined} aria-describedby={!onResume ? descriptionId : undefined} onClick={() => { void resume() }}>{text(language, pending ? 'resumePending' : 'resumeResearch')}</button>
          <button type="button" className="g-btn g-btn-t" style={{ maxWidth: '100%' }} disabled={!available} onClick={() => onOpen(target)}>{text(language, 'viewResearchPlan')}</button>
        </>}
    </div>
    {presentation.kind === 'completed' && !available && <p id={descriptionId} className="g-note" style={{ marginTop: 8 }}>{text(language, 'reportUnavailable')}</p>}
    {presentation.kind === 'stopped' && !onResume && <p id={descriptionId} className="g-note" style={{ marginTop: 8 }}>{text(language, 'resumeUnavailable')}</p>}
    {phase === 'failed' && <p role="alert" className="g-note" style={{ marginTop: 8 }}>{text(language, 'resumeFailed')}</p>}
    {phase === 'submitted' && <p role="status" className="g-note" style={{ marginTop: 8 }}>{text(language, 'resumeSubmitted')}</p>}
  </section>
}
