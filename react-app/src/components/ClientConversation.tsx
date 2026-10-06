import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ClientPersistentRegion } from './ClientPersistentRegion'
import { ClientQuestionDockTarget } from './ClientQuestionDock'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, FileText, Pencil, Square } from 'lucide-react'
import '../client-conversation.css'
import type { ResearchDocumentView } from '../mock-research-preview'
import { clientResearchLabel } from '../client-research-label'
import { ClientIcon } from './ClientIcon'
import type { ConversationViewport } from '../client-experience-store'
import { useConversationCopy } from '../client-conversation-copy'
import { useClientPreviewToast } from '../use-client-preview-toast'

// DOM rectangles include CSS zoom; scrollTop/clientHeight and CSS heights do
// not. Keep following, spacer persistence and restore in layout coordinates.
function layoutScale(element: HTMLElement) {
  return element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth : 1
}
function contentTop(element: HTMLElement, scroll: HTMLElement) {
  return (element.getBoundingClientRect().top - scroll.getBoundingClientRect().top) / layoutScale(scroll) + scroll.scrollTop
}

type ConversationProps = {
  children: ReactNode
  artifact?: ReactNode
  /** Presentation only: service drafts must not imply a research plan or team. */
  artifactLabel?: string
  artifactOpenLabel?: string
  /** Route to the existing document workspace without creating a second document. */
  onOpenArtifact?: () => void
  onOpenReport?: () => void
  /** Read-only service document; its identity only scopes presentation state. */
  reportArtifact?: { identity: string; label: string; openLabel: string; content: ReactNode }
  showResearchTeam?: boolean
  /** Observed work/result state, shown while its original conversation is hidden. */
  conversationNotice?: ReactNode
  /** Persistent local recovery status, in layout so it never covers controls. */
  persistentNotice?: ReactNode
  composerNotice?: ReactNode
  notice?: ReactNode
  previewTools?: ReactNode
  value: string
  onChange: (value: string) => void
  onSend: () => void
  /** Caller-owned feedback only; never submits or cancels a pending request. */
  onBusySend?: () => void
  onStop: () => void
  busy: boolean
  /** A service request has no cancellation authority unless explicitly supplied. */
  canStop?: boolean
  inputDisabled?: boolean
  maxLength?: number
  inputLabel: string
  sendLabel: string
  titleLabel: string
  context?: string
  activityKey: string
  initialTitle?: string
  /** Controller-owned persistent title editor; source inline styling retained. */
  titleEditor?: ReactNode
  headerActions?: ReactNode
  initialViewport?: ConversationViewport
  onViewportChange?: (view: ConversationViewport) => void
  /** Viewport snapshot only, never delays the request or changes its status. */
  arrivalRect?: DOMRect
  /** One-shot navigation after a caller-confirmed edit; never submits text. */
  composerRequest?: object
  /** Same controlled composer, different document host; no second draft. */
  composerTarget?: HTMLElement | null
  /** Label for a caller-owned document using the same portalled composer. */
  composerContext?: string
  /** Display-only question context; must never replace the controlled draft. */
  composerPlaceholder?: string
  workspace?: {
    view: ResearchDocumentView
    onViewChange: (view: ResearchDocumentView) => void
    started: boolean
    status: 'running' | 'completed'
    activity: ReactNode
    critic?: ReactNode
    team: readonly { name: string; status: string }[]
    onAsk: (question: string) => void
    replies?: ReactNode
  }
} & (
  | { onTitleChange?: undefined; onTitleReset?: never }
  // Reset is a controlled presentation default, not an authored title.
  | { onTitleChange: (title: string) => void; onTitleReset?: () => void }
)

export function ClientUserMessage({ children, onEdit, editDisabled = false, resultCard }: { children: string; onEdit: (text: string) => void; editDisabled?: boolean; resultCard?: ReactNode }) {
  const { c, language } = useConversationCopy()
  const [copyState, setCopyState] = useState('')
  const copyAttempt = useRef(0)
  const copyNotice = useRef('')
  const { toast, showToast } = useClientPreviewToast()
  useLayoutEffect(() => { copyNotice.current = language === 'ko' ? '복사 완료' : c('copiedMessage') }, [c, language])
  useLayoutEffect(() => () => { copyAttempt.current += 1 }, [children])
  return <><div className="g-urow">
    <div className="g-uacts">
      <button type="button" aria-label={c('editMessage')} disabled={editDisabled} onClick={() => { if (!editDisabled) onEdit(children) }}><Pencil size={13} /></button>
      <button type="button" aria-label={c(copyState === 'copied' ? 'copiedMessage' : 'copyMessage')} onClick={async () => {
        const attempt = ++copyAttempt.current
        try { await navigator.clipboard.writeText(children); if (attempt === copyAttempt.current) { setCopyState('copied'); showToast(copyNotice.current) } }
        catch { if (attempt === copyAttempt.current) setCopyState('error') }
      }}>{copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}</button>
    </div>
    <div className={`g-umsg${resultCard?' an-umsg':''}`}>{resultCard?<><div className="an-card">{resultCard}</div><div className="an-line">{children.split('\n')[0]}</div></>:children}</div>
    {copyState === 'error' && <span className="g-copy-error" role="status">{c('copyError')}</span>}
  </div>{toast.text && createPortal(<div className="client-source-overlays">
    <div data-user-message-copy-notice className={`ca-code-toast${toast.visible ? ' show' : ''}`} role={toast.visible ? 'status' : undefined} aria-live="polite" aria-atomic="true">{toast.text}</div>
  </div>, document.body)}</>
}

/** React rendering of tesia-lab acccc7f's g-center/g-doc/g-composer/g-aux.
 * Domain data and actions stay in the caller; no client demo proxy or auth is imported.
 */
export function ClientConversation({ children, artifact, artifactLabel: suppliedArtifactLabel, artifactOpenLabel, onOpenArtifact, onOpenReport, reportArtifact, showResearchTeam = true, conversationNotice, persistentNotice, composerNotice, notice, previewTools, value, onChange, onSend, onBusySend, onStop, busy, canStop = true, inputDisabled = false, maxLength, inputLabel, sendLabel, titleLabel, context, activityKey, initialTitle = '새 전략', titleEditor, onTitleChange, onTitleReset, headerActions, workspace, initialViewport, onViewportChange, arrivalRect, composerRequest, composerTarget, composerContext, composerPlaceholder }: ConversationProps) {
  const { c, statusLabel, language } = useConversationCopy()
  const labelOf = (value: string) => clientResearchLabel(value, language)
  const artifactLabel = suppliedArtifactLabel ?? labelOf('Research Plan')
  const placeholder = composerPlaceholder ?? c('placeholder')
  const [tab, setTab] = useState<'chat' | 'plan' | 'report'>('chat')
  const [lastComposerRequest, setLastComposerRequest] = useState(composerRequest)
  if (lastComposerRequest !== composerRequest) {
    setLastComposerRequest(composerRequest)
    if (composerRequest && !workspace) setTab('chat')
  }
  const [previousReportIdentity, setPreviousReportIdentity] = useState(reportArtifact?.identity)
  if (previousReportIdentity !== reportArtifact?.identity) {
    setPreviousReportIdentity(reportArtifact?.identity)
    if (!reportArtifact && tab === 'report') setTab('chat')
  }
  const [localTitle, setTitle] = useState(initialTitle)
  const title = onTitleChange ? initialTitle : localTitle
  const [editingTitle, setEditingTitle] = useState(false)
  const titleEdited = useRef(false)
  const [unread, setUnread] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const titleTrigger = useRef<HTMLButtonElement>(null)
  const chatTabRef = useRef<HTMLButtonElement>(null)
  const reportTabRef = useRef<HTMLButtonElement>(null)
  const returnTitleFocus = useRef(false)
  const [restoredViewport] = useState(initialViewport)
  const [initialArrival] = useState(arrivalRect)
  const viewportCallback = useRef(onViewportChange)
  const lastActivity = useRef(activityKey)
  const lastIntakeFocus = useRef<{ node: HTMLElement; text: string | null } | null>(null)
  const lastFollowLayout = useRef<{ activityKey: string; busy: boolean; activeTab: string; visible: boolean; bottom: number; height: number; width: number; questionKey: string; language: string } | null>(null)
  const lastObservedContent = useRef<{ bottom: number; width: number; language: string } | null>(null)
  const lastChildren = useRef(children)
  const pendingContentChange = useRef(false)
  const followRef = useRef(true)
  const lastScrollTop = useRef<number | null>(null)
  const automaticScroll = useRef<{ at: number; top: number } | null>(null)
  const intakeRevealFrame = useRef(0)
  const intakeAnchor = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => () => cancelAnimationFrame(intakeRevealFrame.current), [])
  const scrollTo = useCallback((element: HTMLElement, top: number) => {
    if (Math.abs(element.scrollTop - top) > 1) {
      element.scrollTop = top
      automaticScroll.current = { at: performance.now(), top: element.scrollTop }
    }
    lastScrollTop.current = element.scrollTop
  }, [])
  const lastQuestion = useRef('')
  const spacerRef = useRef<HTMLDivElement>(null)
  const [viewportVisible, setViewportVisible] = useState(true)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Observe actual layout: both navigation and the mobile analysis pane may
    // hide an ancestor. Only visibility transitions re-render, not each resize.
    const observer = new ResizeObserver(() => setViewportVisible(Boolean(el.clientWidth && el.clientHeight)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const activeTab = workspace?.view ?? (tab === 'report' ? (reportArtifact ? 'report' : 'chat') : tab === 'plan' && artifact ? 'plan' : 'chat')
  const documentScrollPositions = useRef<Partial<Record<ResearchDocumentView | 'report', number>>>({})
  const documentFollowStates = useRef<Partial<Record<ResearchDocumentView | 'report', boolean>>>({})
  const lastReportIdentity = useRef(reportArtifact?.identity)
  const reportHadFocus = useRef(false)
  const handledComposerRequest = useRef(composerRequest)
  useLayoutEffect(() => {
    if (handledComposerRequest.current === composerRequest) return
    handledComposerRequest.current = composerRequest
    const input = inputRef.current
    if (composerRequest && activeTab === 'chat' && input && !input.disabled && !input.closest('[hidden],[inert]')) input.focus({ preventScroll: true })
  }, [composerRequest, activeTab, composerTarget])
  const reportIdentity = reportArtifact?.identity
  const lastDocumentTab = useRef<typeof activeTab | undefined>(undefined)
  const restoredReportIdentity = useRef(reportIdentity)

  useLayoutEffect(() => {
    const trackFocus = (event: FocusEvent) => {
      const target = event.target
      reportHadFocus.current = target instanceof Element && Boolean(frameRef.current?.contains(target) && target.closest('.g-report,[data-report-document-control]'))
    }
    document.addEventListener('focusin', trackFocus)
    return () => document.removeEventListener('focusin', trackFocus)
  }, [])

  useLayoutEffect(() => {
    if (lastReportIdentity.current !== reportIdentity) {
      delete documentScrollPositions.current.report
      delete documentFollowStates.current.report
      if (reportHadFocus.current && document.activeElement === document.body) (reportIdentity ? reportTabRef : chatTabRef).current?.focus({ preventScroll: true })
      reportHadFocus.current = false
      lastReportIdentity.current = reportIdentity
    }
  }, [reportIdentity])

  useLayoutEffect(() => {
    // Translation can widen preceding tabs without changing the selection.
    // Keep the selected document visible; never move keyboard focus here.
    const button = reportTabRef.current
    if (activeTab !== 'report' || !button) return
    let disposed = false
    const reveal = () => {
      if (!disposed && button.getClientRects().length) button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(button)
    if (button.parentElement) observer.observe(button.parentElement)
    void document.fonts.ready.then(reveal)
    return () => { disposed = true; observer.disconnect() }
  }, [activeTab, language, reportIdentity])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !el.clientHeight || !viewportVisible) return
    // Returning from a modal/pane must not overwrite its explicit focus reveal.
    // A different report still starts with its own document position.
    if (lastDocumentTab.current === activeTab && (activeTab !== 'report' || restoredReportIdentity.current === reportIdentity)) return
    lastDocumentTab.current = activeTab
    restoredReportIdentity.current = reportIdentity
    const savedTop = documentScrollPositions.current[activeTab]
    scrollTo(el, savedTop ?? 0)
    // Restore the destination's follow state, not the previous short document's.
    const spacer = spacerRef.current
    const bottom = activeTab === 'chat' && spacer ? contentTop(spacer, el) : el.scrollHeight
    followRef.current = documentFollowStates.current[activeTab] ?? (savedTop === undefined || bottom - el.scrollTop - el.clientHeight < 40)
  }, [activeTab, reportIdentity, viewportVisible, scrollTo])

  useLayoutEffect(() => { viewportCallback.current = onViewportChange }, [onViewportChange])
  useLayoutEffect(() => {
    const el = scrollRef.current, spacer = spacerRef.current
    if (!el || !spacer) return
    if (restoredViewport) {
      spacer.style.height = `${restoredViewport.spacer}px`
      scrollTo(el, restoredViewport.top)
      followRef.current = restoredViewport.follow
      lastQuestion.current = restoredViewport.questionKey
    }
    const capture = () => viewportCallback.current?.({ top: el.scrollTop, spacer: spacer.offsetHeight, follow: followRef.current, questionKey: lastQuestion.current })
    window.addEventListener('pagehide', capture)
    return () => { capture(); window.removeEventListener('pagehide', capture) }
  }, [restoredViewport, scrollTo])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    let frame = 0
    let disposed = false
    const resize = () => {
      if (disposed) return
      const desktop = matchMedia('(min-width:861px)').matches
      const base = desktop ? 21 : 30
      // Measure at single-line width first; otherwise .multi's wider textarea
      // can oscillate between layouts for exactly two lines.
      input.parentElement?.classList.remove('multi')
      input.style.height = `${base}px`
      const multi = input.scrollHeight > base + (desktop ? 2 : 10) || value.includes('\n')
      input.parentElement?.classList.toggle('multi', multi)
      input.style.height = `${Math.min(desktop ? 147 : 120, Math.max(base, input.scrollHeight))}px`
    }
    resize()
    let width = input.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return
      width = entry.contentRect.width
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(resize)
    })
    observer.observe(input)
    void document.fonts.ready.then(resize)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect() }
  }, [value, placeholder, composerTarget])

  useLayoutEffect(() => {
    if (!initialArrival || !matchMedia('(min-width:861px)').matches) return
    const el = composerRef.current?.querySelector<HTMLElement>('.g-composer')
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (!el || motion.matches || document.documentElement.classList.contains('client-motion-paused')) return
    const to = el.getBoundingClientRect()
    if (!to.width || !initialArrival.width) return
    const animation = el.animate([
      { transform: `translate(${initialArrival.left - to.left}px, ${initialArrival.top - to.top}px) scale(${initialArrival.width / to.width}, ${initialArrival.height / to.height})` },
      { transform: 'none' },
    ], { duration: 400, easing: 'cubic-bezier(.3,0,.15,1)' })
    el.style.transformOrigin = 'top left'
    const finish = () => animation.cancel()
    const hidden = () => { if (document.hidden) finish() }
    window.addEventListener('resize', finish)
    document.addEventListener('visibilitychange', hidden)
    motion.addEventListener('change', finish)
    el.addEventListener('input', finish)
    el.addEventListener('pointerdown', finish)
    return () => { animation.cancel(); el.style.transformOrigin = ''; window.removeEventListener('resize', finish); document.removeEventListener('visibilitychange', hidden); motion.removeEventListener('change', finish); el.removeEventListener('input', finish); el.removeEventListener('pointerdown', finish) }
  }, [initialArrival])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    const observer = new ResizeObserver(() => {
      const height = composer.offsetHeight
      // The composer lives in a movable portal; its immediate parent is no
      // longer the layout ancestor shared by the unread-response button.
      if (height > 0) centerRef.current?.style.setProperty('--g-composer-height', `${height}px`)
    })
    observer.observe(composer)
    return () => observer.disconnect()
  }, [composerTarget])

  const followContentLayout = useCallback((contentChanged = false) => {
    if (contentChanged) pendingContentChange.current = true
    const scroll = scrollRef.current
    const spacer = spacerRef.current
    // A hide/show may finish before ResizeObserver delivers its next frame.
    // Remember skipped layout work on the commit itself, then catch up on the
    // first visible commit even when the activity key no longer changes.
    if (!viewportVisible || !scroll || !spacer || !scroll.clientHeight || activeTab !== 'chat') { lastFollowLayout.current = null; return }
    const previous = lastFollowLayout.current
    const rows = scroll.querySelectorAll<HTMLElement>('.g-urow,.client-market-question-summary')
    const question = rows.item(rows.length - 1)
    const questionKey = `${rows.length}:${question?.dataset.questionAnchor || question?.querySelector('.g-umsg')?.textContent || ''}`
    const changed = pendingContentChange.current
    pendingContentChange.current = false
    // Controller-owned outcomes and child-only updates can grow without a new
    // conversation activity key. Measure content, excluding our blank spacer.
    const contentBottom = contentTop(spacer, scroll)
    const width = scroll.clientWidth, height = scroll.clientHeight
    if (previous && previous.activityKey === activityKey && previous.busy === busy && previous.activeTab === activeTab && previous.visible === viewportVisible
      && previous.bottom === contentBottom && previous.height === height && previous.width === width && previous.questionKey === questionKey && previous.language === language) return
    const observed = lastObservedContent.current
    // Reflow/translation alone is not a new response. Keep a visible baseline
    // across hidden commits, so newly supplied content is caught on return.
    const contentGrew = changed && observed && observed.width === width && observed.language === language && contentBottom > observed.bottom + 1
    lastObservedContent.current = { bottom: contentBottom, width, language }
    lastFollowLayout.current = { activityKey, busy, activeTab, visible: viewportVisible, bottom: contentBottom, height, width, questionKey, language }
    const focused = document.activeElement
    const intakeFocus = focused instanceof HTMLElement && focused.tagName === 'H3' && scroll.contains(focused)
      && focused.closest('.client-source-intake,.client-strategy-summary') ? focused : null
    const revealIntake = intakeFocus && (intakeAnchor.current === intakeFocus || lastIntakeFocus.current?.node !== intakeFocus || lastIntakeFocus.current.text !== intakeFocus.textContent)
    lastIntakeFocus.current = intakeFocus ? { node: intakeFocus, text: intakeFocus.textContent } : null
    if (question && questionKey !== lastQuestion.current) {
      lastQuestion.current = questionKey
      spacer.style.height = `${Math.max(0, scroll.clientHeight - 170)}px`
      scrollTo(scroll, contentTop(question, scroll) - 20)
      followRef.current = true
      setUnread(false)
    }
    if (revealIntake) followRef.current = false
    // Selecting an answer is an explicit reading gesture, even when the last
    // short answer fitted without a scroll. Incoming text must not pull that
    // selection out of view. Selections outside this transcript do not opt out.
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount
      && selection.getRangeAt(0).intersectsNode(scroll)) followRef.current = false
    // Track actual content, not the blank area retained below the last question.
    if (followRef.current) {
      if (contentBottom > scroll.scrollTop + scroll.clientHeight - 20) scrollTo(scroll, Math.max(0, contentBottom - scroll.clientHeight + 20))
    } else if (lastActivity.current !== activityKey || contentGrew) setUnread(true)
    lastActivity.current = activityKey
    if (!busy) {
      const currentHeight = spacer.offsetHeight
      const contentHeight = scroll.scrollHeight - currentHeight
      spacer.style.height = `${Math.max(0, scroll.scrollTop + scroll.clientHeight - contentHeight)}px`
    }
    // Preserve explicit focus through delayed viewport/font reflow. A reading
    // gesture clears the anchor, so later layout never pulls the reader back.
    if (revealIntake) {
      scrollTo(scroll, contentTop(intakeFocus, scroll) - 8)
      setUnread(false)
    }
  }, [viewportVisible, activeTab, activityKey, busy, scrollTo, language])
  // Run on every parent commit: hide/show may be coalesced by ResizeObserver.
  useLayoutEffect(() => {
    const changed = lastChildren.current !== children
    lastChildren.current = children
    followContentLayout(changed)
  })
  useLayoutEffect(() => {
    const scroll = scrollRef.current, thread = spacerRef.current?.parentElement
    if (!scroll || !thread) return
    let frame = 0
    // A child controller may commit without rendering ClientConversation.
    // Do not resize the observed thread synchronously inside its observer.
    // Share the mutation frame so child commits keep their pending-content bit.
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; followContentLayout() })
    })
    // Resize alone (fonts/translation/reflow) is not an incoming response.
    // Child DOM commits can represent new supplied content without a parent
    // render; consume those changes before ResizeObserver's layout callback.
    const mutations = new MutationObserver(records => {
      if (!records.some(record => record.target !== spacerRef.current)) return
      pendingContentChange.current = true
      // Keep hidden arrivals pending without measuring their detached layout.
      // Multiple child commits share one frame; ResizeObserver may consume the
      // pending change first when the same commit also changes thread size.
      if (!viewportVisible || activeTab !== 'chat' || frame) return
      frame = requestAnimationFrame(() => { frame = 0; followContentLayout() })
    })
    mutations.observe(thread, { subtree: true, childList: true, characterData: true })
    observer.observe(thread)
    observer.observe(scroll)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect() }
  }, [followContentLayout, viewportVisible, activeTab])

  useEffect(() => {
    if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select() }
    else if (returnTitleFocus.current) { titleTrigger.current?.focus(); returnTitleFocus.current = false }
  }, [editingTitle])

  useLayoutEffect(() => {
    if (viewportVisible && activeTab === 'activity' && followRef.current && scrollRef.current?.clientHeight) scrollTo(scrollRef.current, scrollRef.current.scrollHeight)
  }, [activeTab, activityKey, viewportVisible, scrollTo])

  const changeTab = (next: ResearchDocumentView | 'report') => {
    if (next === 'plan' && onOpenArtifact) { onOpenArtifact(); return }
    if (next === 'report' && onOpenReport) { onOpenReport(); return }
    if (next === activeTab) return
    documentScrollPositions.current[activeTab] = scrollRef.current?.scrollTop || 0
    documentFollowStates.current[activeTab] = followRef.current
    if (workspace) { if (next !== 'report') workspace.onViewChange(next) }
    else if (next === 'chat' || next === 'plan' || next === 'report') setTab(next)
  }

  const composer = (
      <div className="g-composer-wrap" ref={composerRef} hidden={activeTab === 'activity' && workspace?.status === 'running'}>
        <ClientQuestionDockTarget />
        {composerNotice}
        <div className="g-composer">
          {composerContext ? <div className="native-research-context"><span className="g-ctx">{composerContext}</span></div>
            : activeTab !== 'chat' && <span className="g-ctx"><FileText size={12} />{activeTab === 'report' ? reportArtifact?.label : activeTab === 'plan' ? artifactLabel : labelOf(activeTab === 'activity' ? 'Activity' : 'Critic Review')}</span>}
          <textarea ref={inputRef} value={value} aria-label={inputLabel} placeholder={placeholder} rows={1} disabled={inputDisabled} maxLength={maxLength} spellCheck={false} autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault()
                // A held key from an action that returned focus here is not a
                // new send gesture. The next distinct Enter still sends.
                if (event.repeat) return
                if (busy && !inputDisabled) { onBusySend?.(); return }
                if (!busy && !inputDisabled && value.trim()) {
                  if (workspace && activeTab !== 'chat') workspace.onAsk(value)
                  else { changeTab('chat'); onSend() }
                }
              }
            }} />
          <div className="g-composer-row"><span className="g-model" /><button className="g-send" type="button" aria-label={busy ? c(canStop ? 'stop' : 'waiting') : sendLabel} disabled={busy ? !canStop : inputDisabled || !value.trim()} onClick={() => {
            if (busy && canStop) onStop()
            else if (workspace && activeTab !== 'chat') workspace.onAsk(value)
            else { changeTab('chat'); onSend() }
          }}>{busy && canStop ? <Square size={11} fill="currentColor" /> : <ArrowUp size={17} />}</button></div>
        </div>
      </div>
  )
  return <div ref={frameRef} className="client-conversation-frame"><div className={`client-lab-conversation${workspace?.started ? ' has-research-workspace' : ''}`}>
    <section ref={centerRef} className="g-center" aria-label={c('conversationRegion')}>
      <header className="g-chead">
        {titleEditor ?? (editingTitle ? <input ref={titleRef} className="g-title-input" aria-label={c('editTitle')} defaultValue={title} maxLength={120}
          onChange={() => { titleEdited.current = true }}
          onBlur={(event) => {
            if (titleEdited.current) {
              const next = event.target.value.trim()
              if (!next && onTitleReset) onTitleReset()
              else if (next) { setTitle(next); onTitleChange?.(next) }
            }
            titleEdited.current = false
            setEditingTitle(false)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter') { event.preventDefault(); returnTitleFocus.current = true; event.currentTarget.blur() }
            if (event.key === 'Escape') { event.preventDefault(); returnTitleFocus.current = true; titleEdited.current = false; event.currentTarget.value = title; event.currentTarget.blur() }
          }} /> : <h1 aria-label={titleLabel}><button ref={titleTrigger} className="g-title" type="button" title={title} aria-label={c('editTitle')} onClick={() => { titleEdited.current = false; setEditingTitle(true) }}><span>{title}</span><Pencil size={12} /></button></h1>)}
        {context && <span className="sub">{context}</span>}
        <nav className="g-tabs" aria-label={c('conversationDocuments')}>
          <button ref={chatTabRef} className={`g-tab ${activeTab === 'chat' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'chat'} onClick={() => changeTab('chat')}>{c('chat')}</button>
          {artifact && <button className={`g-tab ${activeTab === 'plan' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'plan'} onClick={() => changeTab('plan')}>{artifactLabel}</button>}
          {reportArtifact && !workspace && <button ref={reportTabRef} data-report-document-control className={`g-tab ${activeTab === 'report' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'report'} onClick={() => changeTab('report')}>{reportArtifact.label}</button>}
          {workspace?.started && <button className={`g-tab ${activeTab === 'activity' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'activity'} onClick={() => changeTab('activity')}>{labelOf('Activity')}</button>}
          {workspace?.critic && <button className={`g-tab ${activeTab === 'critic' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'critic'} onClick={() => changeTab('critic')}>{labelOf('Critic Review')}</button>}
        </nav>
        {workspace?.started && activeTab === 'activity' && workspace.status === 'running' && <span className="g-tag g-research-status"><span className="g-dot run" aria-hidden="true" />{c('researchRunning')}</span>}
        {!previewTools && <span className="g-demo">Mock</span>}
        {headerActions}
      </header>
      {persistentNotice && <div className="g-conversation-notice"><div role="alert">{persistentNotice}</div></div>}
      {activeTab !== 'chat' && conversationNotice && <div className="g-conversation-notice">
        <div role="status">{conversationNotice}</div>
        <button type="button" onClick={() => { changeTab('chat'); chatTabRef.current?.focus({ preventScroll: true }) }}><ArrowLeft size={13} aria-hidden="true" />{c('chat')}</button>
      </div>}
      <div className="g-scroll" ref={scrollRef}
      onWheel={() => { intakeAnchor.current = null }}
      onTouchStart={() => { intakeAnchor.current = null }}
      onPointerDown={() => { intakeAnchor.current = null }}
      onKeyDown={() => { intakeAnchor.current = null }}
      onFocusCapture={event => {
        const target = event.target
        if (!(target instanceof HTMLElement) || target.tagName !== 'H3'
          || !target.closest('.client-source-intake,.client-strategy-summary')) { intakeAnchor.current = null; return }
        intakeAnchor.current = target
        followRef.current = false
        cancelAnimationFrame(intakeRevealFrame.current)
        // Focus can change after the parent's layout effect without changing
        // content dimensions. Reveal once after that commit, not on reflows.
        intakeRevealFrame.current = requestAnimationFrame(() => {
          const scroll = scrollRef.current
          if (!scroll || intakeAnchor.current !== target || !target.isConnected || document.activeElement !== target || target.closest('[hidden],[inert]')) return
          followRef.current = false
          scrollTo(scroll, contentTop(target, scroll) - 8)
          setUnread(false)
        })
      }} onScroll={() => {
        const el = scrollRef.current
        if (!el || !el.clientHeight) return
        documentScrollPositions.current[activeTab] = el.scrollTop
        const spacer = spacerRef.current
        const contentBottom = activeTab === 'chat' && spacer ? contentTop(spacer, el) : el.scrollHeight
        const previousTop = lastScrollTop.current
        lastScrollTop.current = el.scrollTop
        const automatic = automaticScroll.current
        // Source gScrollAttach: upward reading detaches above 60px; returning
        // within 40px reattaches. Never infer intent from content growth alone.
        // Ignore our own queued scroll event for 140ms, but do not swallow a
        // user's intervening move to a different position during that window.
        const ownScroll = automatic && performance.now() - automatic.at < 140 && Math.abs(el.scrollTop - automatic.top) < 2
        if (!ownScroll) {
          const gap = contentBottom - el.scrollTop - el.clientHeight
          if (previousTop !== null && el.scrollTop < previousTop - 2 && gap > 60) followRef.current = false
          else if (gap < 40) followRef.current = true
        }
        documentFollowStates.current[activeTab] = followRef.current
        if (activeTab === 'chat') viewportCallback.current?.({ top: el.scrollTop, spacer: spacer?.offsetHeight ?? 0, follow: followRef.current, questionKey: lastQuestion.current })
        if (followRef.current) setUnread(false)
      }}>
        {notice}
        <div className="g-doc" hidden={activeTab !== 'chat'}>
          <div className="g-thread" aria-busy={busy}>{children}<div ref={spacerRef} className="g-spacer" aria-hidden="true" /></div>
        </div>
        {artifact && <div className="g-doc g-plan" hidden={activeTab !== 'plan'}>{artifact}{activeTab === 'plan' && workspace?.replies}</div>}
        {reportArtifact && !workspace && <div key={reportArtifact.identity} className="g-doc g-adoc g-report" hidden={activeTab !== 'report'}>{reportArtifact.content}</div>}
        {workspace?.started && <div className="g-doc g-adoc" hidden={activeTab !== 'activity'}>{workspace.activity}{activeTab === 'activity' && workspace.replies}</div>}
        {workspace?.critic && <div className="g-doc g-adoc" hidden={activeTab !== 'critic'}>{workspace.critic}{activeTab === 'critic' && workspace.replies}</div>}
      </div>
      {unread && activeTab === 'chat' && <button className="g-newmsg" type="button" onClick={() => {
        const el = scrollRef.current
        // Keyboard activation can retain the old answer selection. Explicit
        // resume consumes that reading gesture, not selections elsewhere.
        const selection = window.getSelection()
        if (el && selection && !selection.isCollapsed && selection.rangeCount
          && selection.getRangeAt(0).intersectsNode(el)) selection.removeAllRanges()
        if (el && spacerRef.current) {
          const contentBottom = spacerRef.current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
          scrollTo(el, Math.max(0, contentBottom - el.clientHeight + 24))
        }
        followRef.current = true
        setUnread(false)
      }}><ArrowDown size={13} />{c('newResponse')}</button>}
      <ClientPersistentRegion target={composerTarget} contents>{composer}</ClientPersistentRegion>
    </section>
    {(artifact || reportArtifact && !workspace) && <aside className="g-aux" aria-label={labelOf('Artifacts')}>
      <h2 className="g-sec">{labelOf('Artifacts')}</h2>
      {artifact && <button className={`g-art ${activeTab === 'plan' ? 'on' : ''}`} type="button" aria-label={artifactOpenLabel ?? c('openPlan')} onClick={() => changeTab('plan')}><ClientIcon name="document" size={14} /><span className="t">{artifactLabel}</span></button>}
      {reportArtifact && !workspace && <button data-report-document-control className={`g-art ${activeTab === 'report' ? 'on' : ''}`} type="button" aria-label={reportArtifact.openLabel} onClick={() => changeTab('report')}><ClientIcon name="document" size={14} /><span className="t">{reportArtifact.label}</span></button>}
      {workspace?.critic && <button className={`g-art ${activeTab === 'critic' ? 'on' : ''}`} type="button" aria-label={c('openCritic')} onClick={() => changeTab('critic')}><ClientIcon name="document" size={14} /><span className="t">{labelOf('Critic Review')}</span></button>}
      {showResearchTeam && <h2 className="g-sec">{labelOf('Research Team')}</h2>}
      {workspace?.team.map(member => <div className="g-team-row" key={member.name}><span>{labelOf(member.name)}</span><span className="st">{(member.status === '작업 중' || member.status === '완료') && <span className={`g-dot ${member.status === '완료' ? 'ok' : 'run'}`} aria-hidden="true" />}{statusLabel(member.status)}</span></div>)}
    </aside>}
  </div>{previewTools}</div>
}
