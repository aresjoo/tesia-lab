import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import type { ProfessionalChartControl, ProfessionalReplayEnd, ProfessionalRendererState } from '../components/ClientProfessionalPriceChart'
import { ClientLazyResultChart as ClientProfessionalPriceChart } from '../components/ClientLazyResultChart'
import { containingBar, priceChartIssue, type PriceFill } from '../chart/price-chart-view'
import { ClientTradingTerminal, type ClientTradingTerminalControl, type ClientTradingTerminalProps } from '../components/ClientTradingTerminal'
import { createNativeServiceApi, type NativeChartWindowSelection, type NativeFillMarkers, type NativeJob, type NativeReport, type NativeTrades } from './native-service-api'
import './native-service-result.css'
import { nativeFillChartTarget } from './native-fill-navigation'
import { formatResultRatePercent } from './native-result-number-format'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { nativeResultText, nativeResultNavigationText, type NativeResultTextKey } from './native-result-copy'
import { NativeInlineResult } from './NativeInlineResult'
import { NativeTradeDetail } from './NativeTradeDetail'
import { NativeReportDocument } from './NativeReportDocument'
import { NativeAnalysisReportPortal } from './NativeAnalysisLayout'
import { nativeInlineResultCopy } from './native-inline-result-copy'
import { useNativeAutomaticPresentation, type NativeResultPresentationRequest } from './native-result-presentation-intent'
import type { NativeReplayChartReader } from './native-replay-chart-reader'
import type { NativeReplayReaderFactory } from './native-replay-reader-scope'
import { createNativePeriodReplayController, type NativePeriodReplayController, type NativePeriodReplayControllerState } from './native-period-replay-controller'
import { createNativeReplayFillLane, type NativeReplayFillLane } from './native-replay-fill-lane'

type NativeApi = ReturnType<typeof createNativeServiceApi>
type Chart = Awaited<ReturnType<NativeApi['chart']>>
export type NativeServiceResultStatus = { backtestId: string; state: 'loading' | 'ready' | 'error'; label: string; reportReady: boolean }
type NativeResultProps = { api: NativeApi; job: NativeJob; embedded?: boolean; previous?: boolean; onStatusChange?: (status: NativeServiceResultStatus) => void; onEditDraft?: () => void; editDisabled?: boolean; automaticPresentation?: NativeResultPresentationRequest; createReplayReader?: NativeReplayReaderFactory }
type TradeLocation = { cursor?: string; pageNumber: number; priorCursors: (string | undefined)[] }
const firstTradeLocation = (): TradeLocation => ({ pageNumber: 1, priorCursors: [] })
const MAX_TRADE_PAGE_LOCATIONS = 50 // Navigation hints only; never cached rows or server authority.
const MAX_MARKER_PAGE_LOCATIONS = 50
type MarkerLocation = { cursor?: string; pageNumber: number; priorCursors: (string | undefined)[] }
const firstMarkerLocation = (): MarkerLocation => ({ pageNumber: 1, priorCursors: [] })
const decimal = (value: string) => value // Preserve the server decimal; never recalculate PnL in the browser.
const rate = (value: string, language: ClientLanguage) => formatResultRatePercent(value, nativeResultText(language, 'tinyNegative')) ?? nativeResultText(language, 'rateOutOfRange')
const rateRows = [['metricNetReturn', 'netReturnRate'], ['metricBuyAndHold', 'buyAndHoldReturnRate'], ['metricMdd', 'maxDrawdownRate'], ['metricWinRate', 'winRate']] as const
const tradeColumns = ['tradeEntryFill', 'tradeEntryPrice', 'tradeExitPrice', 'tradeQuantity', 'tradeFees', 'tradeFunding', 'tradeNetPnl', 'tradeExitReason', 'fillTimes'] as const

type BeginDocumentNavigation = () => () => void
type ReportPortalProps = Omit<ComponentProps<typeof NativeReportDocument>, 'onOpenAnalysis' | 'announce' | 'onOpenTrades' | 'onReplay'> & {
  onOpenTrades: (begin: BeginDocumentNavigation) => void
  onReplay: (begin: BeginDocumentNavigation) => void
}
// The portal supplies navigation, not controller refs. Keep rendering the
// document separate from the imperative actions invoked only by its buttons.
function NativeResultReportPortal({ onOpenTrades, onReplay, ...props }: ReportPortalProps) {
  return <NativeAnalysisReportPortal>{(openAnalysis, announce, begin) => <NativeReportDocument {...props}
    onOpenAnalysis={openAnalysis} announce={announce} onOpenTrades={() => onOpenTrades(begin)} onReplay={() => onReplay(begin)} />}</NativeAnalysisReportPortal>
}

/** Read-only projection. Receipt validation and cross-response binding are in
 * the generated SDK + native-service-api; this view never grants authority. */
export function NativeServiceResult(props: NativeResultProps) {
  return <NativeServiceResultView key={props.job.backtestId} {...props} />
}

function NativeServiceResultView({ api, job, embedded, previous, onStatusChange, onEditDraft, editDisabled = false, automaticPresentation, createReplayReader }: NativeResultProps) {
  const { language } = useClientPreferences()
  const r = (key: NativeResultTextKey, values: Readonly<Record<string, string | number>> = {}) => nativeResultText(language, key, values)
  const fillCopy = {
    title: nativeResultNavigationText(language, 'title'), unqueried: nativeResultNavigationText(language, 'unqueried'),
    outside: nativeResultNavigationText(language, 'outside'), gap: nativeResultNavigationText(language, 'gap'),
    entry: (value: string) => nativeResultNavigationText(language, 'entry', { value }),
    exit: (value: string) => nativeResultNavigationText(language, 'exit', { value }),
  }
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [presentation, setPresentation] = useState<'loading' | 'ready' | 'playing' | null>(null)
  const presentationRef = useRef(presentation)
  const presentationOrigin = useRef<'document' | 'analysis' | 'automatic'>('analysis')
  const automaticContext = useNativeAutomaticPresentation()
  const seenAutomaticRequest = useRef<NativeResultPresentationRequest | undefined>(undefined)
  const automaticCandidate = useRef<{ request: NativeResultPresentationRequest; api: NativeApi; job: NativeJob; running: boolean } | null>(null)
  const [reducedReplayNotice, setReducedReplayNotice] = useState(false)
  const presentationEpoch = useRef(0)
  const replayReader = useRef<NativeReplayChartReader | null>(null)
  const periodAttempt = useRef<{ controller: NativePeriodReplayController; lane: NativeReplayFillLane; owner: AbortController; timer: number; retrying: boolean; tick: () => void; detachReader: () => void } | null>(null)
  const [periodState, setPeriodState] = useState<NativePeriodReplayControllerState | null>(null)
  const [periodIssue, setPeriodIssue] = useState<'fills' | 'price' | 'display' | null>(null)
  const [periodRetrying, setPeriodRetrying] = useState(false)
  const disposeReplayReader = useCallback(() => {
    const attempt = periodAttempt.current
    periodAttempt.current = null
    if (attempt) {
      attempt.detachReader()
      window.clearInterval(attempt.timer)
      attempt.owner.abort()
      attempt.controller.dispose(); attempt.lane.dispose()
    }
    replayReader.current?.dispose()
    replayReader.current = null
  }, [])
  const chartControl = useRef<ProfessionalChartControl>(null)
  // Renderer availability is distinct from the validity of a verified report.
  const [rendererState, setRendererState] = useState<ProfessionalRendererState>('unavailable')
  const rendererChanged = useCallback((value: ProfessionalRendererState) => {
    setRendererState(value)
    const attempt = periodAttempt.current
    if (!attempt) return
    if (value === 'error') setPeriodState(attempt.controller.suspend(performance.now(), 'RENDER_FAILED'))
    else if (value === 'ready') { attempt.controller.resume('RENDER_FAILED'); attempt.tick() }
  }, [])
  const terminalControl = useRef<ClientTradingTerminalControl>(null)
  const openTradesPending = useRef(false)
  const returnFromDocument = useRef<(() => void) | null>(null)
  const consumeDocumentReturn = useCallback(() => {
    const restore = returnFromDocument.current
    returnFromDocument.current = null
    restore?.()
  }, [])
  useLayoutEffect(() => {
    if (!terminalOpen || !openTradesPending.current) return
    openTradesPending.current = false
    // Select/focus only after the existing terminal has entered its dialog.
    // Reuse its controller and loaded rows; opening a document is not a read.
    terminalControl.current?.showBottom('trades')
  }, [terminalOpen])
  const markerEpoch = useRef(0), markerWorking = useRef(false)
  const resultRoot = useRef<HTMLElement>(null)
  const skipFocus = useRef<HTMLButtonElement>(null)
  const beforeTransition = useRef<DOMRect | null>(null)
  const transition = useRef<Animation | null>(null)
  const rememberBounds = () => { beforeTransition.current = resultRoot.current?.querySelector('.cp-chart')?.getBoundingClientRect() ?? null }
  const finishPresentation = useCallback(() => {
    disposeReplayReader()
    setPeriodState(null); setPeriodRetrying(false)
    automaticCandidate.current = null
    presentationEpoch.current++
    if (!presentationRef.current) return
    beforeTransition.current = resultRoot.current?.querySelector('.cp-chart')?.getBoundingClientRect() ?? null
    presentationRef.current = null; setPresentation(null); setTerminalOpen(false)
    consumeDocumentReturn()
  }, [consumeDocumentReturn, disposeReplayReader])
  const replayChanged = useCallback((playing: boolean, reason?: ProfessionalReplayEnd) => {
    if (playing) { setReducedReplayNotice(false); return }
    if (presentationRef.current === 'playing') {
      if (reason === 'reduced' && presentationOrigin.current === 'document') setReducedReplayNotice(true)
      finishPresentation()
    } else if (reason) setReducedReplayNotice(false)
  }, [finishPresentation])
  const presenting = Boolean(presentation)
  useLayoutEffect(() => {
    const node = resultRoot.current?.querySelector<HTMLElement>('.cp-chart'), before = beforeTransition.current
    beforeTransition.current = null
    transition.current?.cancel()
    if (node && before && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const after = node.getBoundingClientRect()
      if (before.width && before.height && after.width && after.height) transition.current = node.animate([
        { transformOrigin: 'top left', transform: `translate(${before.x - after.x}px,${before.y - after.y}px) scale(${before.width / after.width},${before.height / after.height})` },
        { transformOrigin: 'top left', transform: 'none' },
      ], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' })
    }
    if (presenting) skipFocus.current?.focus({ preventScroll: true })
    else if (document.activeElement === document.body) resultRoot.current?.querySelector<HTMLButtonElement>('dialog[open] [data-terminal-close]')?.focus({ preventScroll: true })
    return () => transition.current?.cancel()
  }, [presenting])
  useEffect(() => {
    if (presentation !== 'ready' || presentationRef.current !== 'ready') return
    if (periodAttempt.current) return
    // Child effects have applied this bound marker page before starting the
    // existing renderer. No second chart, synthetic fills, or server job.
    presentationRef.current = 'playing'
    if (!chartControl.current?.play()) finishPresentation()
  }, [presentation, finishPresentation])
  useEffect(() => () => { presentationEpoch.current++; disposeReplayReader() }, [disposeReplayReader])
  const loadingFocus = useRef<HTMLDivElement>(null)
  const resultFocus = useRef<HTMLParagraphElement>(null)
  const refreshFocusPending = useRef(false)
  const restoreResultFocus = useRef(false)
  const observeLoadingFocus = useCallback((node: HTMLDivElement | null) => {
    if (!node && loadingFocus.current?.contains(document.activeElement)) restoreResultFocus.current = true
    loadingFocus.current = node
  }, [])
  const [report, setReport] = useState<NativeReport | null>(null)
  const [segment, setSegment] = useState<'IS' | 'OOS'>('OOS')
  const [periodBinding, setPeriodBinding] = useState({ api, job, report, segment, createReplayReader })
  if (periodBinding.api !== api || periodBinding.job !== job || periodBinding.report !== report
    || periodBinding.segment !== segment || periodBinding.createReplayReader !== createReplayReader) {
    // Retire the old error before committing another result lifetime. Keeping
    // only a visibility guard would resurrect it if the old props returned.
    setPeriodBinding({ api, job, report, segment, createReplayReader })
    setPeriodIssue(null)
  }
  const [storedPage, setPage] = useState<{ data: NativeTrades; backtestId: string; segment: 'IS' | 'OOS' } | null>(null)
  // The API owns full binding validation. These request coordinates only keep
  // an already-validated page out of a different local view.
  const page = storedPage?.backtestId === job.backtestId && storedPage.segment === segment ? storedPage.data : null
  const [chart, setChart] = useState<Chart | null>(null)
  const [error, setError] = useState(false)
  const [chartError, setChartError] = useState(false)
  const [chartSelection, setChartSelection] = useState<NativeChartWindowSelection>({})
  const [chartLoading, setChartLoading] = useState(false)
  const [chartRetry, setChartRetry] = useState(0)
  const [tradeError, setTradeError] = useState(false)
  const [loadingPage, setLoadingPage] = useState(false)
  const [tradeDetail, setTradeDetail] = useState<{ api: NativeApi; job: NativeJob; report: NativeReport; page: NativeTrades; rowIndex: number; trigger: HTMLElement } | null>(null)
  const detailBindingCurrent = tradeDetail?.api === api && tradeDetail.job === job && tradeDetail.report === report && tradeDetail.page === page
  // Retire the selection, rather than merely hide it, as soon as its data
  // lifetime changes. A later return to old props cannot resurrect a dialog.
  const detailAvailable = detailBindingCurrent && !loadingPage && !tradeError && !presentation && !error && report
  if (tradeDetail && !detailAvailable) setTradeDetail(null)
  const activeTradeDetail = detailAvailable ? tradeDetail : null
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const focusVisible = (node: HTMLElement | null) => {
      if (document.activeElement === document.body && node?.getClientRects().length && !node.closest('[hidden],[inert]')) node.focus({ preventScroll: true })
    }
    // Only an explicit refresh owns this handoff. Initial loading and late
    // responses must not take focus from the conversation or a hidden pane.
    if (!report && refreshFocusPending.current) {
      refreshFocusPending.current = false
      focusVisible(loadingFocus.current)
    }
    if (report && restoreResultFocus.current) {
      restoreResultFocus.current = false
      focusVisible(resultFocus.current)
    }
  }, [report, retry])
  const [tradeLocation, setTradeLocation] = useState<TradeLocation>(firstTradeLocation)
  const pageNumber = tradeLocation.pageNumber
  const [tradeAttempt, setTradeAttempt] = useState<TradeLocation>(firstTradeLocation)
  const tradeEpoch = useRef(0), tradeWorking = useRef(false)
  const [markers, setMarkers] = useState<NativeFillMarkers | null>(null)
  const [selectedFill, setSelectedFill] = useState<NativeFillMarkers['markers'][number] | null>(null)
  const [fillNotice, setFillNotice] = useState<'outside' | 'gap' | null>(null)
  const fillOrigin = useRef<Element | null>(null)
  const fillFocusPending = useRef(false)
  const fillErrorFocusPending = useRef(false)
  const chartRetryFocus = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (!chartError || !fillErrorFocusPending.current) return
    fillErrorFocusPending.current = false
    const target = chartRetryFocus.current
    if (target && !target.disabled && document.activeElement !== target && target.getClientRects().length && !target.closest('[hidden],[inert]')
      && (document.activeElement === document.body || document.activeElement === fillOrigin.current)) {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [chartError])
  useEffect(() => {
    if (!selectedFill) return
    // A late result may update the chart, but must not override a newer user
    // interaction, including clicks on non-focusable text or scrolling.
    const relinquish = () => { fillFocusPending.current = false }
    document.addEventListener('pointerdown', relinquish, true)
    document.addEventListener('keydown', relinquish, true)
    document.addEventListener('wheel', relinquish, { capture: true, passive: true })
    return () => {
      document.removeEventListener('pointerdown', relinquish, true)
      document.removeEventListener('keydown', relinquish, true)
      document.removeEventListener('wheel', relinquish, true)
    }
  }, [selectedFill])
  const currentMarkers = chart && page && markers?.manifestContentHash === chart.manifest.manifestContentHash
    && markers.binding.segment === segment && markers.tradeManifestContentHash === page.tradeManifestContentHash ? markers : null
  // A selection belongs to exactly these already-validated pages. Never turn
  // a chart display ID into a cursor, a ledger lookup, or trading authority.
  const [tradeSelection, setTradeSelection] = useState<{ page: NativeTrades; markers: NativeFillMarkers; rowIndex: number; fillRef: string } | null>(null)
  const tradeSelectionTarget = useRef<HTMLElement | null>(null)
  const [markerLocation, setMarkerLocation] = useState<MarkerLocation>(firstMarkerLocation)
  const [markerLoading, setMarkerLoading] = useState(false)
  const [markerError, setMarkerError] = useState(false)
  const [markerAttempt, setMarkerAttempt] = useState<MarkerLocation>(firstMarkerLocation)
  const closeTerminal = useCallback(() => {
    automaticCandidate.current = null
    setTradeDetail(null)
    const phase = presentationRef.current
    finishPresentation()
    if (phase === 'loading') {
      // Retire only the pending marker commit, never the server job.
      markerEpoch.current++; markerWorking.current = false; setMarkerLoading(false)
    }
    if (phase === 'playing') chartControl.current?.skip()
    setTerminalOpen(false)
    consumeDocumentReturn()
  }, [finishPresentation, consumeDocumentReturn])
  useLayoutEffect(() => {
    const boundary = presentationEpoch
    if (presentationRef.current) closeTerminal()
    return () => { boundary.current++; disposeReplayReader() }
  }, [api, job, report, segment, createReplayReader, closeTerminal, disposeReplayReader])
  const activeTradeSelection = tradeSelection?.page === page && tradeSelection?.markers === currentMarkers
    && !chartLoading && !chartError && !loadingPage && !markerLoading && !presentation ? tradeSelection : null
  useLayoutEffect(() => {
    if (!activeTradeSelection) return
    const target = tradeSelectionTarget.current
    // The terminal's child layout effect reveals its existing bottom pane
    // first. No delayed focus can steal a later interaction or tab selection.
    if (target?.isConnected && target.getClientRects().length && !target.closest('[hidden],[inert]')) {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [activeTradeSelection])
  // View status only. Changing a listener never restarts an API request or
  // invents a server job transition; asynchronous request guards stay below.
  const resultState: NativeServiceResultStatus['state'] = error || chartError || tradeError || markerError || periodIssue ? 'error'
    : !report || report.binding.backtestId !== job.backtestId || !chart || !page || chartLoading || loadingPage || markerLoading ? 'loading' : 'ready'
  const resultStateLabel = r(resultState === 'error' ? 'statusNeedsCheck' : resultState === 'ready' ? 'statusReady' : 'statusChecking')
  // Confirmed report availability is independent of optional detail reads.
  // Presentation only; the controller still rechecks the owner before editing.
  const reportReady = Boolean(!error && report && report.binding.backtestId === job.backtestId)
  useEffect(() => {
    onStatusChange?.({ backtestId: job.backtestId, state: resultState,
      label: resultStateLabel, reportReady })
  }, [job.backtestId, resultState, resultStateLabel, reportReady, onStatusChange])
  useEffect(() => () => { markerEpoch.current++; markerWorking.current = false }, [api, job.backtestId])
  const clearMarkers = useCallback(() => {
    setReducedReplayNotice(false)
    setTradeSelection(null)
    fillFocusPending.current = false
    fillErrorFocusPending.current = false
    setSelectedFill(null); setFillNotice(null)
    markerEpoch.current++; markerWorking.current = false
    setMarkers(null); setMarkerError(false); setMarkerLoading(false); setMarkerLocation(firstMarkerLocation()); setMarkerAttempt(firstMarkerLocation())
  }, [setReducedReplayNotice, setTradeSelection, setSelectedFill, setFillNotice, setMarkers, setMarkerError, setMarkerLoading, setMarkerLocation, setMarkerAttempt])
  useEffect(() => {
    let active = true
    void api.report(job).then(value => { if (active) { setReport(value); setError(false) } })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [api, job, retry])
  useEffect(() => {
    if (!report || report.binding.backtestId !== job.backtestId) return
    const generation = ++tradeEpoch.current
    tradeWorking.current = true
    void api.trades(report, segment, tradeAttempt.cursor).then(value => {
      if (generation === tradeEpoch.current) {
        setPage({ data: value, backtestId: job.backtestId, segment }); setTradeLocation(tradeAttempt)
        setTradeError(false)
      }
    }).catch(failure => {
      if (generation !== tradeEpoch.current) return
      setTradeError(true)
      if (failure && typeof failure === 'object' && 'code' in failure
        && ['AUTHENTICATION_REQUIRED', 'FORBIDDEN'].includes(String(failure.code))) {
        setPage(null)
        clearMarkers()
      }
    }).finally(() => {
      if (generation === tradeEpoch.current) { tradeWorking.current = false; setLoadingPage(false) }
    })
    return () => { tradeEpoch.current = generation + 1; tradeWorking.current = false }
  }, [api, job.backtestId, report, segment, tradeAttempt, clearMarkers])
  useEffect(() => {
    if (!report) return
    let active = true
    void api.chart(job, report, segment, chartSelection)
      .then(value => { if (active) { setChart(value); setChartError(false); setChartLoading(false) } })
      .catch(failure => {
        if (!active) return
        setChartError(true); setChartLoading(false)
        if (failure && typeof failure === 'object' && 'code' in failure
          && ['AUTHENTICATION_REQUIRED', 'FORBIDDEN'].includes(String(failure.code))) {
          // Loss of access is not a transient window failure. Remove the old
          // price projection and its overlay, including pending marker reads.
          const restoreFillFocus = fillFocusPending.current
            && (document.activeElement === fillOrigin.current || document.activeElement === document.body)
          setChart(null); clearMarkers()
          // The selected ledger button disappears with its marker. Restore
          // only this explicit navigation, never an unrelated read or focus.
          fillErrorFocusPending.current = restoreFillFocus
        }
      })
    return () => { active = false }
  }, [api, job, report, segment, retry, chartSelection, chartRetry, clearMarkers])
  const changeSegment = (value: 'IS' | 'OOS') => {
    if (presentationRef.current || value === segment) return
    clearMarkers()
    tradeEpoch.current++; tradeWorking.current = false
    setTradeLocation(firstTradeLocation()); setTradeAttempt(firstTradeLocation()); setLoadingPage(false)
    setSegment(value); setPage(null); setChart(null); setTradeError(false); setChartError(false)
    setChartSelection({}); setChartLoading(false)
  }
  const refresh = () => {
    if (presentationRef.current) return
    refreshFocusPending.current = Boolean(resultRoot.current?.contains(document.activeElement))
    clearMarkers()
    tradeEpoch.current++; tradeWorking.current = false
    setReport(null); setTradeLocation(firstTradeLocation()); setTradeAttempt(firstTradeLocation()); setLoadingPage(false)
    setError(false)
    setPage(null); setChart(null); setTradeError(false); setChartError(false); setRetry(value => value + 1)
    setChartSelection({}); setChartLoading(false)
  }
  const selectChart = (selection: NativeChartWindowSelection) => {
    if (presentationRef.current) return
    clearMarkers()
    setChartSelection(selection); setChartError(false); setChartLoading(true)
  }
  const retryChart = () => {
    if (presentationRef.current) return
    setTradeSelection(null)
    // Bound window retries preserve the verified marker page/requested fill
    // and reject a different manifest. Fresh selection retries reread metadata.
    if (selectedFill && currentMarkers) {
      fillOrigin.current = document.activeElement; fillFocusPending.current = true
    }
    setChartError(false); setChartLoading(true); setChartRetry(value => value + 1)
  }
  const requestTradePage = (location: TradeLocation) => {
    if (presentationRef.current || !report || tradeWorking.current || location.priorCursors.length > MAX_TRADE_PAGE_LOCATIONS) return
    setTradeDetail(null)
    setTradeSelection(null)
    tradeWorking.current = true; setLoadingPage(true); setTradeError(false)
    setTradeAttempt({ ...location })
  }
  const loadMarkers = async (location: MarkerLocation = firstMarkerLocation()) => {
    if (!chart || !page || chartLoading || chartError || loadingPage || markerWorking.current || location.priorCursors.length > MAX_MARKER_PAGE_LOCATIONS) return false
    setTradeSelection(null)
    const generation = ++markerEpoch.current
    markerWorking.current = true; setMarkerLoading(true)
    setMarkerError(false); setMarkerAttempt(location)
    try {
      // Ordinary pagination (and injected API-only previews) remains separate
      // from the dedicated whole-period reader and its disposal lifetime.
      const value = await api.markers(chart.manifest, page, location.cursor)
      if (generation === markerEpoch.current) { setMarkers(value); setSelectedFill(null); setFillNotice(null); setMarkerLocation(location); setMarkerError(false); setMarkerAttempt(location); return true }
    } catch (failure) {
      if (generation === markerEpoch.current) {
        setMarkerError(true); setMarkerAttempt(location)
        if (failure && typeof failure === 'object' && 'code' in failure
          && ['AUTHENTICATION_REQUIRED', 'FORBIDDEN'].includes(String(failure.code))) setMarkers(null)
      }
    } finally {
      if (generation === markerEpoch.current) { markerWorking.current = false; setMarkerLoading(false) }
    }
    return false
  }
  const requestMarkers = (location: MarkerLocation = firstMarkerLocation()) => {
    if (!presentationRef.current) void loadMarkers(location)
  }
  const replayAvailable = rendererState === 'ready' && !presentation && Boolean(report && !error && chart && !priceChartIssue(chart.view) && page && !chartLoading && !chartError && !loadingPage && !markerLoading)
  const startPresentation = async (origin: 'document' | 'analysis' | 'automatic' = 'analysis') => {
    if (rendererState !== 'ready' || presentationRef.current || !report || error || !chart || priceChartIssue(chart.view) || !page || chartLoading || chartError || loadingPage || markerWorking.current) return
    const epoch = ++presentationEpoch.current
    presentationOrigin.current = origin
    setReducedReplayNotice(false)
    setPeriodIssue(null)
    // A deliberate full-window entry starts at the beginning, even when an
    // earlier inline replay is already near its end. It never restarts a job.
    chartControl.current?.skip()
    rememberBounds()
    terminalControl.current?.showPanel('chart')
    presentationRef.current = 'loading'; setPresentation('loading'); setTerminalOpen(true)
    if (createReplayReader) {
      const owner = new AbortController()
      try {
        const reader = createReplayReader({ job, report, trades: page, segment, expectedManifestContentHash: chart.manifest.manifestContentHash })
        const isCurrent = () => presentationEpoch.current === epoch && !owner.signal.aborted && reader.isActive()
        replayReader.current = reader
        const range = chart.manifest.segmentBounds
        const attemptId = `${job.backtestId}:${segment}:${epoch}`
        const lane = createNativeReplayFillLane({ attemptId, reader, ownerSignal: owner.signal, isCurrent,
          from: Date.parse(range.fromInclusive) / 1000, to: Date.parse(range.toExclusive) / 1000 })
        const controller = createNativePeriodReplayController({ attemptId, reader, ownerSignal: owner.signal, isCurrent,
          segmentRange: range, identity: { seriesId: chart.window.seriesId, resolution: chart.window.resolution,
            expectedManifestContentHash: chart.manifest.manifestContentHash, availableRange: chart.navigation.availableRange } })
        const attempt = { controller, lane, owner, timer: 0, retrying: false, tick: () => {}, detachReader: () => {} }
        const tick = () => {
          if (periodAttempt.current !== attempt) return
          if (!isCurrent()) { closeTerminal(); return }
          const fills = lane.getState()
          if (fills.status === 'disposed' || controller.getState().status === 'disposed') { closeTerminal(); return }
          if (fills.failure) controller.suspend(performance.now(), 'FILL_READ_FAILED')
          else if (fills.status !== 'loading') controller.resume('FILL_READ_FAILED')
          // A price window is not evidence that the first fill page is valid.
          // Do not flash an empty playback before initial verification settles.
          if (fills.total === null && !fills.failure && !controller.getState().paint) return
          const next = controller.step(performance.now(), fills.frame)
          if (next.status === 'disposed') { closeTerminal(); return }
          if (next.clock.executionCount !== fills.consumed) lane.acknowledge(next.clock)
          const issue = fills.failure === 'DISPLAY_INVALID' || next.failure === 'DISPLAY_INVALID' ? 'display'
            : fills.failure || next.failure === 'FILL_READ_FAILED' ? 'fills' : next.failure && next.failure !== 'RENDER_FAILED' ? 'price' : null
          setPeriodIssue(issue)
          setPeriodState(next)
          // Failed automatic preparation must not leave an unsolicited modal.
          // Once painting starts, keep the last frame and explicit retry.
          if (issue && !next.paint && origin === 'automatic') { closeTerminal(); return }
          if (next.paint && presentationRef.current === 'loading') {
            presentationRef.current = 'playing'; setPresentation('playing')
          }
          const acknowledged = lane.getState()
          if (acknowledged.needsPage && acknowledged.status === 'ready' && !acknowledged.failure) void lane.advance()
          // Renderer completion acknowledges restoration of the same canvas.
          if (next.status === 'complete') window.clearInterval(attempt.timer)
        }
        attempt.tick = tick
        periodAttempt.current = attempt
        const retire = () => { if (periodAttempt.current === attempt) closeTerminal() }
        reader.retirementSignal.addEventListener('abort', retire, { once: true })
        attempt.detachReader = () => reader.retirementSignal.removeEventListener('abort', retire)
        if (reader.retirementSignal.aborted) { closeTerminal(); return }
        attempt.timer = window.setInterval(tick, 80)
        controller.start(); void lane.start()
      } catch (failure) {
        owner.abort()
        if (!(failure instanceof Error && failure.message === 'NATIVE_REPLAY_DISPOSED')) setPeriodIssue('display')
        closeTerminal()
      }
      return
    }
    const loaded = await loadMarkers(firstMarkerLocation())
    if (epoch !== presentationEpoch.current) return
    if (origin === 'automatic' && (!automaticCandidate.current?.request.isCurrent() || !automaticForeground())) {
      closeTerminal(); return
    }
    if (loaded) { presentationRef.current = 'ready'; setPresentation('ready') }
    else {
      disposeReplayReader()
      presentationRef.current = null; setPresentation(null)
      // An automatic attempt must not strand an unsolicited failed modal.
      // Manual requests retain their existing visible error/retry surface.
      if (origin === 'automatic') { automaticCandidate.current = null; setTerminalOpen(false); consumeDocumentReturn() }
    }
  }
  const retryPeriod = async () => {
    const attempt = periodAttempt.current
    if (!attempt || attempt.retrying || attempt.lane.getState().failure === 'DISPLAY_INVALID') return
    attempt.retrying = true; setPeriodRetrying(true)
    try {
      await attempt.lane.retry()
      if (periodAttempt.current !== attempt) return
      if (!attempt.lane.getState().failure) attempt.controller.resume('FILL_READ_FAILED')
      await attempt.controller.retry()
      if (periodAttempt.current === attempt) attempt.tick()
    } finally {
      attempt.retrying = false
      if (periodAttempt.current === attempt) setPeriodRetrying(false)
    }
  }
  const automaticForeground = () => Boolean(automaticContext?.active && automaticContext.isForeground()
    && ![...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]')]
      .some(dialog => dialog.getClientRects().length && !dialog.closest('[hidden],[inert]')
        && !(automaticCandidate.current?.running && resultRoot.current?.contains(dialog))))
  // A completion event is consumed on arrival, not on later readiness. Leaving
  // the foreground or failing a read retires it permanently; returning, locale
  // changes and retry buttons never queue another automatic presentation.
  useEffect(() => {
    if (automaticPresentation && seenAutomaticRequest.current !== automaticPresentation) {
      seenAutomaticRequest.current = automaticPresentation
      const accepted = automaticPresentation.consume()
      automaticCandidate.current = accepted && automaticPresentation.backtestId === job.backtestId && !previous
        && automaticPresentation.isCurrent() && automaticForeground() && !presentationRef.current && !terminalOpen
        ? { request: automaticPresentation, api, job, running: false } : null
    }
    const candidate = automaticCandidate.current
    if (!candidate) return
    if (candidate.api !== api || candidate.job !== job || candidate.request !== automaticPresentation
      || !candidate.request.isCurrent() || !automaticForeground() || rendererState === 'error' && !periodAttempt.current || error || chartError || tradeError || markerError || chart && priceChartIssue(chart.view)) {
      if (candidate.running) closeTerminal()
      else automaticCandidate.current = null
      return
    }
    if (!candidate.running && replayAvailable) {
      candidate.running = true
      returnFromDocument.current = automaticContext!.begin()
      void startPresentation('automatic')
    }
  })
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const retire = () => {
      if (!automaticCandidate.current || document.visibilityState !== 'hidden' && !motion.matches) return
      if (automaticCandidate.current.running) closeTerminal()
      else automaticCandidate.current = null
    }
    document.addEventListener('visibilitychange', retire)
    motion.addEventListener('change', retire)
    return () => { document.removeEventListener('visibilitychange', retire); motion.removeEventListener('change', retire) }
  }, [closeTerminal])
  const inspectFill = (marker: NativeFillMarkers['markers'][number]) => {
    if (rendererState !== 'ready' || !chart || chartLoading || chartError || loadingPage || markerWorking.current || presentationRef.current
      || !currentMarkers?.markers.includes(marker)) return
    setTradeSelection(null)
    const target = nativeFillChartTarget(marker.occurredAt, chart.navigation.availableRange, chart.window)
    if (target.kind === 'unavailable') { setFillNotice('outside'); return }
    fillOrigin.current = document.activeElement
    fillFocusPending.current = true
    chartControl.current?.skip()
    setFillNotice(null); setSelectedFill({ ...marker })
    terminalControl.current?.showPanel('chart')
    if (target.kind === 'request') {
      // Keep this one verified marker page across a same-manifest price-window
      // lookup. A different returned manifest will invalidate currentMarkers.
      setChartSelection({ seriesId: chart.window.seriesId, fromInclusive: target.fromInclusive, resolution: chart.window.resolution, expectedManifestContentHash: chart.manifest.manifestContentHash })
      setChartError(false); setChartLoading(true)
    }
  }
  const inspectTrade = (fill: PriceFill) => {
    if (!page || !currentMarkers || chartLoading || chartError || loadingPage || tradeWorking.current
      || markerWorking.current || presentationRef.current) return
    const marker = currentMarkers.markers.find(item => item.fillRef === fill.id)
    if (!marker) return
    const rowIndex = page.trades.findIndex(trade => trade.entryFillRef === marker.tradeEntryFillRef
      && trade.exitFillRef === marker.tradeExitFillRef)
    fillFocusPending.current = false
    setSelectedFill(null); setFillNotice(null)
    setTradeSelection({ page, markers: currentMarkers, rowIndex, fillRef: marker.fillRef })
    terminalControl.current?.showBottom('trades')
  }
  useEffect(() => {
    if (rendererState !== 'ready' || !selectedFill || !chart || chartLoading || chartError || presentation || !currentMarkers?.markers.some(marker => marker.fillRef === selectedFill.fillRef && marker.fillContentHash === selectedFill.fillContentHash)) return
    if (nativeFillChartTarget(selectedFill.occurredAt, chart.navigation.availableRange, chart.window).kind !== 'visible') return
    const time = Date.parse(selectedFill.occurredAt) / 1000
    const frame = requestAnimationFrame(() => {
      if (containingBar(chart.view, time) === null || priceChartIssue(chart.view)) setFillNotice('gap')
      else chartControl.current?.selectFill(selectedFill.fillRef)
      const target = resultRoot.current?.querySelector<HTMLElement>('.cp-surface')
      if (fillFocusPending.current && target?.getClientRects().length && !target.closest('[hidden],[inert]') && (document.activeElement === fillOrigin.current || document.activeElement === document.body)) {
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      }
      fillFocusPending.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedFill, chart, chartLoading, chartError, currentMarkers, presentation, rendererState])
  // Keep the presentation shell mounted during revalidation. The old data is
  // still cleared, but a slow/error response must not dismiss a user's modal.
  const handleOpenDocumentTrades = (beginDialogNavigation: () => () => void) => {
    if (presentationRef.current) return
    const originalPanel = terminalControl.current?.getPanel() ?? 'chart'
    const restoreDocument = beginDialogNavigation()
    returnFromDocument.current = () => {
      terminalControl.current?.showPanel(originalPanel)
      restoreDocument()
    }
    openTradesPending.current = true
    setTerminalOpen(true)
  }
  const handleReplayDocument = (beginDialogNavigation: () => () => void) => {
    if (!replayAvailable || presentationRef.current || markerWorking.current) return
    const originalPanel = terminalControl.current?.getPanel() ?? 'chart'
    const restoreDocument = beginDialogNavigation()
    returnFromDocument.current = () => {
      terminalControl.current?.showPanel(originalPanel)
      restoreDocument()
    }
    void startPresentation('document')
  }
  const renderResult = (slots: ClientTradingTerminalProps['slots'], bottomTabs: ClientTradingTerminalProps['bottomTabs']) =>
    <><NativeInlineResult report={report} job={job} error={error} previous={previous} detailState={resultState} onEditDraft={onEditDraft} editDisabled={editDisabled || !reportReady} />
    <NativeResultReportPortal report={report} job={job} error={Boolean(error)} previous={previous} detailState={resultState} tradeSegment={segment} onOpenTrades={handleOpenDocumentTrades} onReplay={handleReplayDocument} replayAvailable={replayAvailable} reducedReplayNotice={reducedReplayNotice} onRetry={refresh} onEditDraft={onEditDraft} editDisabled={editDisabled || !reportReady} />
    <section ref={resultRoot} className="native-service-result" data-presentation={presentation ? 'true' : undefined} aria-label={report && !error ? r('resultTitle') : r('reportStatusRegion')} data-native-report={!error ? report?.binding.backtestId : undefined}>
      <h2>{r('resultTitle')}</h2>
      <button type="button" aria-disabled={!replayAvailable} onClick={() => void startPresentation()}>{r('viewOnChart')}</button>
      <button type="button" disabled={!report || Boolean(error)} onClick={() => setTerminalOpen(true)}>{r('openTerminal')}</button>
      <ClientTradingTerminal active={terminalOpen} embedded={embedded} controlRef={terminalControl} onClose={closeTerminal} title={r('terminalTitle')}
        headerTools={presentation && <><span role="status">{periodState?.status === 'error' ? r('statusNeedsCheck') : presentation === 'loading' || periodState?.status === 'waiting' ? r('presentationLoading') : r('presentationPlaying')}</span><button ref={skipFocus} type="button" onClick={closeTerminal}>{r('skipToResult')}</button></>}
        labels={{ strategies: r('panelSegments'), chart: r('panelChart'), detail: r('panelMetrics') }} slots={slots} bottomTabs={bottomTabs} />
    </section>
    {activeTradeDetail && <NativeTradeDetail trade={activeTradeDetail.page.trades[activeTradeDetail.rowIndex]}
      trigger={activeTradeDetail.trigger} onClose={() => setTradeDetail(null)} />}</>
  if (error || !report || report.binding.backtestId !== job.backtestId) return renderResult({
    strategies: null, context: <strong>{r('resultTitle')}</strong>, detail: null,
    notice: <div ref={observeLoadingFocus} tabIndex={-1}>{error ? <section role="alert"><p>{r('reportFetchFailed')}</p><button onClick={refresh}>{r('retryReport')}</button></section>
      : <p role="status">{r('verifyingReport')}</p>}</div>, chart: null,
  }, [])
  const projection = report.nativeEnvelope.projection
  const synthetic = projection.evidenceClass === 'SYNTHETIC_CONTRACT_FIXTURE'
  // Display only original server fills inside the displayed request window.
  // The unchanged renderer leaves price gaps unmarked; no OHLC-derived fills.
  const visibleMarkers = chart ? currentMarkers?.markers.filter(marker => nativeFillChartTarget(marker.occurredAt, chart.navigation.availableRange, chart.window).kind === 'visible') ?? [] : []
  const chartView = chart ? { ...chart.view,
    fills: visibleMarkers.map(marker => ({ id: marker.fillRef, tradeId: `${marker.tradeEntryFillRef} / ${marker.tradeExitFillRef}`,
      time: Date.parse(marker.occurredAt) / 1000, price: Number(marker.price), side: marker.side })) } : null
  const replayPaint = presentation ? periodState?.paint : null
  const displayedChart = replayPaint?.window ?? chart
  const limitationsBody = <>
    <p>{r('limitationHeadline')}</p>
    <section aria-label={r('assumptionsRegion')}>
      <h3>{r('beforeInterpreting')}</h3>
      <p>{r('nonCausalFill')}</p>
      <ul>
        <li>{r('symbolRuleSubstitute')}</li>
        <li>{r('mddSampling')}</li>
        <li>{r('independentSegments')}</li>
      </ul>
      <details><summary>{r('serverPolicies')}</summary>
        <p>{projection.splitPolicy}</p>
        {projection.segments.map(item => <dl key={item.segment}><dt>{r('segmentPolicy', { segment: item.segment })}</dt>
          <dd>{item.initialStatePolicy}</dd><dd>{item.limitations.executionPricePolicy}</dd>
          <dd>{item.limitations.symbolRuleHistoricalAccuracy}</dd><dd>{item.limitations.maxDrawdownSampling}</dd>
          <dd>intraminuteDrawdownVerified={String(item.limitations.intraminuteDrawdownVerified)}</dd>
        </dl>)}
      </details>
    </section>
  </>
  const limitationsPanel = <>
    <p ref={resultFocus} tabIndex={-1} role="status">{synthetic ? r('syntheticNotice') : r('historicalNotice')}</p>
    {resultState !== 'ready' && <p data-testid="native-result-detail-status" role={resultState === 'error' ? 'alert' : 'status'}>
      {nativeInlineResultCopy[language][resultState === 'error' ? 'detailError' : 'detailLoading']}
    </p>}
    {presentation || embedded ? <details><summary>{embedded && !presentation ? r('mmrUnverifiedPrefix') : ''}{r('limitationsSummary')}</summary>{limitationsBody}</details> : limitationsBody}
  </>
  const metricsPanel = <>
    <div className="native-metric-scroll" role="region" aria-label={r('comparisonTableRegion')} tabIndex={0} style={{ overflowX: 'auto' }}><table><caption>{r('comparisonCaption')}</caption>
      <thead><tr><th scope="col">{r('metricColumn')}</th>{projection.segments.map(item => <th scope="col" key={item.segment}>{item.segment}</th>)}</tr></thead>
      <tbody>
        <tr><th scope="row">{r('periodUtc')}</th>{projection.segments.map(item => <td key={item.segment}>{r('periodRange', { from: item.evaluationStartInclusive, to: item.evaluationEndExclusive })}</td>)}</tr>
        <tr><th scope="row">{r('initialCapital')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.metrics.initialCapital)}</td>)}</tr>
        <tr><th scope="row">{r('finalEquity')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.metrics.finalEquity)}</td>)}</tr>
        {rateRows.map(([label, field]) => <tr key={field}><th scope="row">{r(label)}</th>{projection.segments.map(item => <td key={item.segment}>{rate(item.metrics[field], language)}</td>)}</tr>)}
        <tr><th scope="row">{r('tradeCountRow')}</th>{projection.segments.map(item => <td key={item.segment}>{item.summary.tradeCount}</td>)}</tr>
        <tr><th scope="row">{r('netPnlRow')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.summary.netPnl)}</td>)}</tr>
        <tr><th scope="row">{r('feeCostRow')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.costs.feeCost)}</td>)}</tr>
        <tr><th scope="row">{r('slippageCostRow')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.costs.slippageCost)}</td>)}</tr>
        <tr><th scope="row">{r('fundingCashflowRow')}</th>{projection.segments.map(item => <td key={item.segment}>{decimal(item.costs.fundingCashflow)}</td>)}</tr>
      </tbody>
    </table></div>
    <p>{r('percentRounding')}</p>
    <p>{r('slippageIncluded')}</p>
    <details className="native-metric-raw">
      <summary>{r('viewRawRates')}</summary>
      <div className="native-metric-scroll" role="region" aria-label={r('rawRateTableRegion')} tabIndex={0} style={{ overflowX: 'auto' }}><table>
        <caption>{r('rawRateCaption')}</caption>
        <thead><tr><th scope="col">{r('metricColumn')}</th>{projection.segments.map(item => <th scope="col" key={item.segment}>{item.segment}</th>)}</tr></thead>
        <tbody>{rateRows.map(([label, field]) => <tr key={field}><th scope="row">{r(label)}</th>{projection.segments.map(item => <td key={item.segment}>{item.metrics[field]}</td>)}</tr>)}</tbody>
      </table></div>
    </details>
  </>
  const selectedSeries = chart?.manifest.series.find(item => item.seriesId === (chartSelection.seriesId ?? chart.window.seriesId))
  const chartPanel = <>
    <h3>{r('segmentChartTitle', { segment })}</h3>
    {periodIssue && <section data-native-replay-error role="alert"><p>{r(periodIssue === 'fills' ? 'markersError' : 'chartError')}</p>
      {presentation ? periodIssue !== 'display' && <button disabled={periodRetrying} onClick={() => void retryPeriod()}>{r(periodIssue === 'fills' ? 'retryMarkerPage' : 'retryChartRange')}</button>
        : <button aria-disabled={!replayAvailable} onClick={() => void startPresentation()}>{r('viewOnChart')}</button>}
    </section>}
    {chartError && <p role="alert">{r('chartError')} {chart && r('chartErrorLastWindow')}</p>}
    {(chartLoading || (!chart && !chartError)) && <p role="status">{r('chartLoading')} {chart && r('chartLoadingKeepWindow')}</p>}
    {(chartLoading || chartError) && chartSelection.seriesId && <p>{r('requestedChartData', { series: chartSelection.seriesId, resolution: chartSelection.resolution ?? '' })}</p>}
    {(chartLoading || chartError) && chartSelection.fromInclusive && <p>{r('requestedStart', { from: chartSelection.fromInclusive, resolution: chartSelection.resolution ?? '' })}</p>}
    {chartError && <button ref={chartRetryFocus} disabled={presenting || chartLoading} onClick={retryChart}>{r(chartSelection.expectedManifestContentHash ? 'retryChartRange' : 'retryChartData')}</button>}
    {chart && <>
      <div className="native-chart-toolbar"><label>{r('chartData')} <select disabled={presenting} aria-label={r('chartData')} value={chartSelection.seriesId ?? chart.window.seriesId}
        onChange={event => {
          const series = chart.manifest.series.find(item => item.seriesId === event.target.value)
          const resolution = chartSelection.resolution ?? chart.window.resolution
          // Explicit selection starts a fresh manifest read; range navigation
          // and its retries remain bound to their previously observed manifest.
          if (series) selectChart({ seriesId: series.seriesId, resolution: series.supportedResolutions.includes(resolution) ? resolution : series.nativeResolution })
        }}>
        {chart.manifest.series.map(item => <option key={item.seriesId} value={item.seriesId}>{item.seriesId}</option>)}
      </select></label>
      <label>{r('chartResolution')} <select disabled={presenting} aria-label={r('chartResolution')} value={chartSelection.resolution ?? chart.window.resolution}
        onChange={event => selectChart({ seriesId: selectedSeries?.seriesId, resolution: event.target.value as Chart['window']['resolution'] })}>
        {(selectedSeries?.supportedResolutions ?? chart.navigation.supportedResolutions).map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <div data-native-controls="chart-range" aria-label={r('chartRangeNav')}>
        <button disabled={presenting || chartLoading || !chart.navigation.previousFromInclusive} onClick={() => selectChart({ seriesId: chart.window.seriesId, resolution: chart.window.resolution, fromInclusive: chart.navigation.previousFromInclusive!, expectedManifestContentHash: chart.manifest.manifestContentHash })}>{r('previousChartRange')}</button>
        <button disabled={presenting || chartLoading || !chart.navigation.nextFromInclusive} onClick={() => selectChart({ seriesId: chart.window.seriesId, resolution: chart.window.resolution, fromInclusive: chart.navigation.nextFromInclusive!, expectedManifestContentHash: chart.manifest.manifestContentHash })}>{r('nextChartRange')}</button>
      </div></div>
      <ClientProfessionalPriceChart view={replayPaint?.view ?? chartView} externalReplay={replayPaint?.replay ?? undefined}
        // Resolution changes replace observations, not their annotation owner.
        // A new result, segment, manifest or price series still starts clean.
        continuityKey={JSON.stringify([job.backtestId, segment, chart.manifest.manifestContentHash, chart.window.seriesId])}
        autoReplay={false} controlRef={chartControl} onReplayChange={replayChanged} onRendererStateChange={rendererChanged} onFillSelect={inspectTrade} externalSkip={Boolean(presentation)} />
      <p>{r('availableRange', { from: chart.navigation.availableRange.fromInclusive, to: chart.navigation.availableRange.toExclusive })}</p>
      <p>{displayedChart!.view.sourceLabel} · {r('liquidationUnavailableShort')}</p><p>{r('displayedWindow', { from: displayedChart!.window.requestedRange.fromInclusive, to: displayedChart!.window.requestedRange.toExclusive, resolution: displayedChart!.window.resolution })}</p>
      {chart.window.priceKind === 'mark' && <p role="status">{r('markPriceNotice')}</p>}
      {displayedChart!.window.coverage.status !== 'COMPLETE' && <p role="status">{r('missingRanges', { count: displayedChart!.window.coverage.missingRanges.length })}</p>}
      <section hidden={Boolean(presentation && createReplayReader)} data-native-controls="fill-markers" aria-label={r('fillMarkerLookup')}>
        {fillNotice && <p role="status">{fillCopy[fillNotice]}</p>}
        {!currentMarkers && !markerLoading && !markerError && <p>{r('markersNotQueried')}</p>}
        <button disabled={presenting || !page || chartLoading || chartError || loadingPage || markerLoading} onClick={() => requestMarkers()}>{currentMarkers ? r('reloadFirstMarkerPage') : r('fillMarkerLookup')}</button>
        {markerLoading && <p role="status">{r('markersLoading')} {currentMarkers && r('markersKeepPage')}</p>}
        {markerError && <><p role="alert">{r('markersError')} {currentMarkers && r('markersErrorKeepPage')}</p>
          <button disabled={presenting || markerLoading || chartLoading || chartError || !page} onClick={() => requestMarkers(markerAttempt)}>{r('retryMarkerPage')}</button></>}
        {currentMarkers && <>
          <p>{r('markerPageSummary', { page: markerLocation.pageNumber, count: currentMarkers.markers.length, visible: visibleMarkers.length })}</p>
          {currentMarkers.markers.length === 0 && <p>{r('markerPageEmpty')}</p>}
          <button disabled={presenting || markerLoading || chartLoading || chartError || loadingPage || !markerLocation.priorCursors.length} onClick={() => requestMarkers({ cursor: markerLocation.priorCursors.at(-1), pageNumber: markerLocation.pageNumber - 1, priorCursors: markerLocation.priorCursors.slice(0, -1) })}>{r('previousMarkerPage')}</button>
          {currentMarkers.nextCursor && <button disabled={presenting || markerLoading || chartLoading || chartError || loadingPage} onClick={() => requestMarkers({ cursor: currentMarkers.nextCursor, pageNumber: markerLocation.pageNumber + 1, priorCursors: [...markerLocation.priorCursors, markerLocation.cursor].slice(-MAX_MARKER_PAGE_LOCATIONS) })}>{r('nextMarkerPage')}</button>}
          {markerLocation.pageNumber > markerLocation.priorCursors.length + 1 && <p>{r('markerHistoryLimit')}</p>}
          {currentMarkers.markers.length > 0 && <details className="native-fill-inspector"><summary>{fillCopy.title}</summary>
<ul>{currentMarkers.markers.map(marker => <li key={marker.fillRef}><button type="button" disabled={rendererState !== 'ready' || markerLoading || chartLoading || chartError || loadingPage || Boolean(presentation)} aria-pressed={selectedFill?.fillRef === marker.fillRef} onClick={() => inspectFill(marker)} aria-label={(marker.leg === 'ENTRY' ? fillCopy.entry : fillCopy.exit)(`${marker.occurredAt} · ${marker.side} · ${marker.price} · ${marker.fillRef}`)}>
              <b data-side={marker.side}>{marker.side}</b><time dateTime={marker.occurredAt}>{marker.occurredAt.replace('T', ' ').replace('Z', ' UTC')}</time><span>{marker.price}</span><small>{marker.fillRef}</small>
            </button></li>)}</ul>
          </details>}
        </>}
      </section>
    </>}
  </>
  const tradesPanel = <>
    <h3>{r('segmentTradesTitle', { segment })}</h3>
    {activeTradeSelection?.rowIndex === -1 && <p className="native-trade-selection-notice" role="status" tabIndex={-1}
      ref={node => { tradeSelectionTarget.current = node }}>{nativeResultNavigationText(language, 'tradeNotOnPage', { page: pageNumber })}
      <small>{activeTradeSelection.fillRef}</small></p>}
    {tradeError && <><p role="alert">{page ? r('tradePageError') : r('tradesError')}</p>
      <button disabled={presenting || loadingPage} onClick={() => requestTradePage(tradeAttempt)}>{r('retryTradePage')}</button></>}
    {loadingPage && page && <p role="status">{r('tradePageLoadingKeep')}</p>}
    {!page ? !tradeError && <p role="status">{r('tradesLoading')}</p> : <>
      <p>{r('tradePageSummary', { page: pageNumber, count: page.trades.length })}</p>
      {page.trades.length === 0 ? <p>{r('tradePageEmpty')}</p> : <div style={{ overflowX: 'auto' }}><table>
        <thead><tr>{tradeColumns.map(key => <th scope="col" key={key}>{key === 'fillTimes' ? fillCopy.title : r(key)}</th>)}</tr></thead>
        <tbody>{page.trades.map((trade, rowIndex) => {
          const matching = currentMarkers?.markers.filter(marker => marker.tradeEntryFillRef === trade.entryFillRef && marker.tradeExitFillRef === trade.exitFillRef) ?? []
          const selected = activeTradeSelection?.rowIndex === rowIndex
          return <tr key={JSON.stringify([trade.entryFillRef, trade.exitFillRef])} tabIndex={-1} aria-current={selected ? 'true' : undefined}
            ref={selected ? node => { tradeSelectionTarget.current = node } : undefined}><td>{selected && <span className="native-trade-selected-label">{nativeResultNavigationText(language, 'selectedTrade')}</span>}<span data-native-entry-fill>{trade.entryFillRef}</span>
              <button type="button" className="native-trade-detail-trigger" aria-haspopup="dialog" aria-label={`${r('tradeDetail')} · ${trade.entryFillRef}`} disabled={presenting || loadingPage || tradeError} onClick={event => {
                if (!page || !report || tradeWorking.current || presentationRef.current || loadingPage || tradeError) return
                setTradeDetail({ api, job, report, page, rowIndex, trigger: event.currentTarget })
              }}>{r('tradeDetail')}</button>
            </td><td>{trade.entryPrice}</td><td>{trade.exitPrice}</td><td>{trade.quantity}</td><td>{trade.fees}</td><td>{trade.funding}</td><td>{trade.netPnl}</td><td>{trade.exitReason}</td><td className="native-trade-times">{matching.length ? matching.map(marker => <button type="button" key={marker.fillRef} disabled={rendererState !== 'ready' || markerLoading || chartLoading || chartError || loadingPage || Boolean(presentation)} aria-pressed={selectedFill?.fillRef === marker.fillRef} onClick={() => inspectFill(marker)} aria-label={(marker.leg === 'ENTRY' ? fillCopy.entry : fillCopy.exit)(`${marker.occurredAt} · ${marker.side} · ${marker.price} · ${marker.fillRef}`)}>{marker.side} · <time dateTime={marker.occurredAt}>{marker.occurredAt.replace('T', ' ').replace('Z', ' UTC')}</time></button>) : fillCopy.unqueried}</td></tr>
        })}</tbody>
      </table></div>}
    </>}
    <div data-native-controls="trade-pages" aria-label={r('tradePageNav')}>
      <button disabled={presenting || loadingPage || pageNumber === 1} onClick={() => requestTradePage(firstTradeLocation())}>{r('firstTradePage')}</button>
      <button disabled={presenting || loadingPage || !page || !tradeLocation.priorCursors.length} onClick={() => requestTradePage({ cursor: tradeLocation.priorCursors.at(-1), pageNumber: pageNumber - 1, priorCursors: tradeLocation.priorCursors.slice(0, -1) })}>{r('previousTradePage')}</button>
      {page?.nextCursor && <button disabled={presenting || loadingPage} onClick={() => requestTradePage({ cursor: page.nextCursor, pageNumber: pageNumber + 1, priorCursors: [...tradeLocation.priorCursors, tradeLocation.cursor].slice(-MAX_TRADE_PAGE_LOCATIONS) })}>{r('nextTradePage')}</button>}
    </div>
    {pageNumber > tradeLocation.priorCursors.length + 1 && <p>{r('markerHistoryLimit')}</p>}
  </>
  const sourcePanel = <>
    <h3>{r('currentRun')}</h3>
    <p>{r('currentRunNotice')}</p>
    <div data-native-controls="segments" aria-label={r('segmentSelector')}>{(['IS', 'OOS'] as const).map(value => <button key={value} disabled={presenting} aria-pressed={segment === value} onClick={() => changeSegment(value)}>{value}</button>)}</div>
    <button disabled={presenting} onClick={refresh}>{r('reloadResultDetail')}</button>
    <details><summary>{r('sourceAndIntegrity')}</summary><dl>
      <dt>{r('bindingJob')}</dt><dd>{report.binding.backtestId}</dd><dt>{r('bindingReportHash')}</dt><dd>{report.binding.nativeEnvelopeContentHash}</dd>
      <dt>{r('bindingProjectionHash')}</dt><dd>{report.binding.projectionContentHash}</dd><dt>{r('bindingTerminalSealHash')}</dt><dd>{report.binding.terminalSealContentHash}</dd>
    </dl></details>
  </>
  return renderResult({ notice: limitationsPanel, strategies: sourcePanel, context: <><strong>{chart?.view.market ?? r('priceDataChecking')}</strong><span>{r('contextBacktest', { segment })}</span>{presentation && presentation !== 'loading' && (replayPaint || currentMarkers) && <span>{r(replayPaint ? 'presentationChronologicalVisibleCount' : 'presentationVisibleCount', { visible: replayPaint ? replayPaint.view.fills.filter(fill => containingBar(replayPaint.view, fill.time) !== null).length : visibleMarkers.length })}</span>}</>, chart: chartPanel, detail: metricsPanel },
    [{ id: 'trades', label: r('tradesTab'), content: tradesPanel }])
}
