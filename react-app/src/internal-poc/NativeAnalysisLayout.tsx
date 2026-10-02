import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { nativeAnalysisText } from './native-analysis-copy'
import { NativeAutomaticPresentationContext } from './native-result-presentation-intent'
import './native-analysis-layout.css'

// View placement only. The result controller remains the sole report reader;
// its summary is portalled into the original conversation, never copied into
// an independent cache or mounted as a second result/chart controller.
const SummaryContext = createContext<{
  target: HTMLDivElement | null
  register: (target: HTMLDivElement | null) => void
  reportTarget: HTMLDivElement | null
  registerReport: (target: HTMLDivElement | null) => void
  openAnalysis: () => void
  beginDialogNavigation: () => () => void
  announce: boolean
} | null>(null)

export function NativeAnalysisSummarySlot() {
  const context = useContext(SummaryContext)
  const register = context?.register
  const attach = useCallback((target: HTMLDivElement | null) => register?.(target), [register])
  return context ? <div ref={attach} className="native-inline-result-slot" /> : null
}

/** Navigate to the already mounted result; never creates another chart reader. */
export function NativeAnalysisNavigation({ children }: { children: (openAnalysis: (() => void) | undefined) => ReactNode }) {
  return children(useContext(SummaryContext)?.openAnalysis)
}

export function NativeAnalysisInlineSummary({ children }: { children: (openAnalysis: () => void, announce: boolean) => ReactNode }) {
  const context = useContext(SummaryContext)
  return context?.target ? createPortal(children(context.openAnalysis, context.announce), context.target) : null
}

export function NativeAnalysisReportSlot() {
  const context = useContext(SummaryContext)
  const register = context?.registerReport
  const attach = useCallback((target: HTMLDivElement | null) => register?.(target), [register])
  return context ? <div ref={attach} className="native-report-document-slot" /> : null
}

export function NativeAnalysisReportPortal({ children }: { children: (openAnalysis: () => void, announce: boolean, beginDialogNavigation: () => () => void) => ReactNode }) {
  const context = useContext(SummaryContext)
  return context?.reportTarget ? createPortal(children(context.openAnalysis, context.announce, context.beginDialogNavigation), context.reportTarget) : null
}

/** Layout only. Both the original conversation and the bound result stay
 * mounted across pane changes. No second composer, transcript or API reader. */
export function NativeAnalysisLayout({ children, analysis, composerRequest, presentationActive = true }: { children: ReactNode; analysis?: ReactNode; composerRequest?: object; presentationActive?: boolean }) {
  const { language } = useClientPreferences()
  const root = useRef<HTMLDivElement>(null)
  const chat = useRef<HTMLDivElement>(null)
  const result = useRef<HTMLElement>(null)
  const [narrow, setNarrow] = useState(() => innerWidth < 1100)
  const [pane, setPane] = useState<'chat' | 'analysis'>('chat')
  const [lastComposerRequest, setLastComposerRequest] = useState(composerRequest)
  if (lastComposerRequest !== composerRequest) {
    setLastComposerRequest(composerRequest)
    if (composerRequest) setPane('chat')
  }
  const [summaryTarget, setSummaryTarget] = useState<HTMLDivElement | null>(null)
  const [reportTarget, setReportTarget] = useState<HTMLDivElement | null>(null)
  const openResultFocus = useRef(false)
  const returnDocumentFocus = useRef<{ trigger: HTMLElement | null; report: HTMLElement | null; backtestId: string | undefined } | null>(null)
  const [documentReturnRequest, setDocumentReturnRequest] = useState(0)
  const automaticReturn = useRef<{ trigger: HTMLElement | null; origin: string; selection: { value: string; start: number; end: number; direction: 'forward' | 'backward' | 'none' } | null } | null>(null)
  const [automaticReturnRequest, setAutomaticReturnRequest] = useState(0)
  const id = useId()
  const hasAnalysis = Boolean(analysis)
  const beginDialogNavigation = useCallback(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const report = trigger?.closest<HTMLElement>('.native-report-document') ?? null
    const backtestId = report?.dataset.backtestId
    const origin = window.location.href
    // On wide layouts both panes are visible, so the last narrow-pane state
    // may be analysis even when this action originates in the document.
    const originalPane = trigger && chat.current?.contains(trigger) ? 'chat' : pane
    openResultFocus.current = false
    setPane('analysis')
    return () => {
      if (window.location.href !== origin) return
      openResultFocus.current = false
      returnDocumentFocus.current = { trigger, report, backtestId }
      setPane(originalPane)
      setDocumentReturnRequest(value => value + 1)
    }
  }, [pane])
  useLayoutEffect(() => {
    const pending = returnDocumentFocus.current
    returnDocumentFocus.current = null
    // Child dialog cleanup and pane visibility are committed before restoring
    // the initiating action. A retry may remove that button, but only the same
    // captured report DOM and job can be a fallback, never a new owner's view.
    if (!pending?.backtestId || !pending.report?.isConnected || pending.report.dataset.backtestId !== pending.backtestId) return
    const target = [pending.trigger, pending.report].find(node => node?.isConnected && node.getClientRects().length && !node.closest('[hidden],[inert]'))
    target?.focus({ preventScroll: true })
    // Keep the initiating action clear of the client's composer fade. Nearest
    // scrolling preserves the reading position when it is already in view.
    if (target === pending.trigger) target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [documentReturnRequest])
  const openAnalysis = useCallback(() => {
    openResultFocus.current = true
    setPane('analysis')
    // On a wide layout no pane change is necessary. Focus the existing result
    // without stealing focus on result arrival or triggering a data request.
    if (result.current && !result.current.hidden) {
      result.current.focus({ preventScroll: true })
      openResultFocus.current = false
    }
  }, [])
  const isActiveSurface = useCallback(() => {
    const node = root.current
    return presentationActive && document.visibilityState !== 'hidden'
      && Boolean(node?.isConnected && node.getClientRects().length && !node.closest('[hidden],[inert]'))
  }, [presentationActive])
  const isForeground = useCallback(() => isActiveSurface() && !matchMedia('(prefers-reduced-motion: reduce)').matches, [isActiveSurface])
  const beginAutomaticPresentation = useCallback(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selection = (trigger instanceof HTMLTextAreaElement || trigger instanceof HTMLInputElement)
      && trigger.selectionStart !== null && trigger.selectionEnd !== null
      ? { value: trigger.value, start: trigger.selectionStart, end: trigger.selectionEnd, direction: trigger.selectionDirection ?? 'none' } : null
    const originalPane = pane, origin = window.location.href
    openResultFocus.current = false
    setPane('analysis')
    return () => {
      if (window.location.href !== origin || !root.current?.isConnected || root.current.closest('[hidden],[inert]')) return
      openResultFocus.current = false
      setPane(originalPane)
      automaticReturn.current = { trigger, origin, selection }
      setAutomaticReturnRequest(value => value + 1)
    }
  }, [pane])
  useLayoutEffect(() => {
    const pending = automaticReturn.current
    automaticReturn.current = null
    // Reduced motion prevents new replay, not an accessible return after the
    // user turns it on during replay. Hidden/other surfaces still never focus.
    if (!pending || pending.origin !== window.location.href || !isActiveSurface()) return
    const target = pending.trigger
    if (target?.isConnected && target.getClientRects().length && !target.closest('[hidden],[inert]')
      && !document.querySelector('dialog[open]')) {
      target.focus({ preventScroll: true })
      // Native modal/layout focus can collapse the selection even though the
      // composer DOM is retained. Never restore offsets into a changed draft.
      if (pending.selection && (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)
        && target.value === pending.selection.value && target.selectionStart !== null) {
        target.setSelectionRange(pending.selection.start, pending.selection.end, pending.selection.direction)
      }
    }
  }, [automaticReturnRequest, isActiveSurface])
  useLayoutEffect(() => {
    if (!hasAnalysis) openResultFocus.current = false
    if (pane === 'analysis' && hasAnalysis && openResultFocus.current && result.current && !result.current.hidden) {
      result.current.focus({ preventScroll: true })
      openResultFocus.current = false
    }
  }, [pane, hasAnalysis, narrow])
  // Only the visible conversation announces while the result pane is hidden.
  // Wide layouts already expose the existing result controller's live regions.
  const summaryContext = useMemo(() => ({ target: summaryTarget, register: setSummaryTarget, reportTarget, registerReport: setReportTarget, openAnalysis, beginDialogNavigation, announce: narrow && pane === 'chat' }), [summaryTarget, reportTarget, openAnalysis, beginDialogNavigation, narrow, pane])
  const automaticContext = useMemo(() => ({ active: presentationActive, isForeground, begin: beginAutomaticPresentation }), [presentationActive, isForeground, beginAutomaticPresentation])
  const hadAnalysis = useRef(hasAnalysis)
  const [previousHasAnalysis, setPreviousHasAnalysis] = useState(hasAnalysis)
  if (previousHasAnalysis !== hasAnalysis) {
    setPreviousHasAnalysis(hasAnalysis)
    if (!hasAnalysis) setPane('chat')
  }
  useLayoutEffect(() => {
    const node = root.current
    if (!node) return
    const resize = () => {
      const next = node.clientWidth < 940
      if (next && result.current?.contains(document.activeElement)) setPane('analysis')
      if (next && chat.current?.contains(document.activeElement)) setPane('chat')
      if (!next && document.activeElement?.hasAttribute('data-analysis-tab')) {
        const target = document.activeElement.getAttribute('data-analysis-tab') === 'analysis' ? result.current : chat.current
        target?.focus({ preventScroll: true })
      }
      setNarrow(next)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(node); resize()
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (hadAnalysis.current && !hasAnalysis && (document.activeElement === document.body || result.current?.contains(document.activeElement))) chat.current?.querySelector<HTMLButtonElement>('.g-title')?.focus({ preventScroll: true })
    hadAnalysis.current = hasAnalysis
  }, [hasAnalysis])
  const choose = (next: 'chat' | 'analysis') => {
    openResultFocus.current = false
    setPane(next)
    root.current?.querySelector<HTMLButtonElement>(`[data-analysis-tab="${next}"]`)?.focus({ preventScroll: true })
  }
  return <NativeAutomaticPresentationContext.Provider value={hasAnalysis ? automaticContext : null}><SummaryContext.Provider value={hasAnalysis ? summaryContext : null}><div ref={root} className="native-analysis-layout" data-analysis={hasAnalysis} data-narrow={narrow} data-pane={pane}>
    {hasAnalysis && narrow && <div className="native-analysis-tabs" role="tablist" aria-label={nativeAnalysisText(language, 'viewLabel')} onKeyDown={event => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        choose(event.key === 'Home' ? 'chat' : event.key === 'End' ? 'analysis' : pane === 'chat' ? 'analysis' : 'chat')
      }
    }}>
      <button type="button" id={`${id}-chat-tab`} data-analysis-tab="chat" role="tab" aria-selected={pane === 'chat'} tabIndex={pane === 'chat' ? 0 : -1} aria-controls={`${id}-chat`} onClick={() => choose('chat')}>{nativeAnalysisText(language, 'chat')}</button>
      <button type="button" id={`${id}-analysis-tab`} data-analysis-tab="analysis" role="tab" aria-selected={pane === 'analysis'} tabIndex={pane === 'analysis' ? 0 : -1} aria-controls={`${id}-analysis`} onClick={() => choose('analysis')}>{nativeAnalysisText(language, 'analysis')}</button>
    </div>}
    <section ref={result} id={`${id}-analysis`} className="native-analysis-result" tabIndex={hasAnalysis && narrow ? 0 : -1} hidden={!hasAnalysis || narrow && pane !== 'analysis'} role={hasAnalysis && narrow ? 'tabpanel' : undefined} aria-labelledby={hasAnalysis && narrow ? `${id}-analysis-tab` : undefined} aria-label={narrow ? undefined : nativeAnalysisText(language, 'analysisRegion')}>{analysis}</section>
    <div ref={chat} id={`${id}-chat`} className="native-analysis-conversation" tabIndex={hasAnalysis && narrow ? 0 : -1} hidden={hasAnalysis && narrow && pane !== 'chat'} role={hasAnalysis && narrow ? 'tabpanel' : undefined} aria-labelledby={hasAnalysis && narrow ? `${id}-chat-tab` : undefined}>{children}</div>
  </div></SummaryContext.Provider></NativeAutomaticPresentationContext.Provider>
}
