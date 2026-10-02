import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ClientIcon } from './ClientIcon'
import { ClientResearchChart as ResearchChart } from './ClientResearchChart'
import { ClientResearchLog } from './ClientResearchLog'
import { ClientCriticReview } from './ClientResearchDocument'
import { previewCritic, previewEntries, previewTeam, useMockResearchPreview } from '../mock-research-preview'
import { CLIENT_RESEARCH_FIXTURE as FIXTURE, RESEARCH_DOCUMENTS, researchDocumentTitle as rawTitleOf, researchPercent as pct, type ClientResearchDocumentId as DocId } from '../client-research-fixtures'
import '../client-restored-research.css'
import { parsePercentageEdit, readStoredPercentage } from '../client-percentage-input'
import { readResearchDocumentCache, writeResearchDocumentCache } from '../client-research-cache'
import { ClientLoadBoundary } from './ClientLoadBoundary'
import { newAnalysisView, type ResearchAnalysisView, type ResearchVersion } from '../client-research-analysis'
import { formatReferenceMoney, useClientPreferences } from '../client-preferences'
import { sourceMoney } from '../client-preview-money'
import { clientResearchLabel } from '../client-research-label'
import { CLIENT_RESEARCH_CAPITAL_KRW } from '../client-research-registration'
import type { ResearchPlanContext } from '../client-research-lifecycle'
import { useConversationCopy } from '../client-conversation-copy'
import { nativeResearchText } from '../internal-poc/native-research-workspace-copy'

const Analysis = lazy(() => import('./ClientResearchAnalysis').then(module => ({ default: module.ClientResearchAnalysis })))
type AnalysisLocation = { owner: string; doc: 'bt1' | 'bt2' | 'report'; version: ResearchVersion }
function readAnalysisLocation(owner: string, seconds: number): AnalysisLocation | null {
  const value = history.state?.tethResearchAnalysis as Partial<AnalysisLocation> | undefined
  if (!value || value.owner !== owner || !['bt1', 'bt2', 'report'].includes(value.doc ?? '') || !availableDoc(value.doc, seconds)) return null
  const expected = value.doc === 'bt1' ? 0 : 1
  return value.version === expected ? value as AnalysisLocation : null
}

type Reply = { doc: DocId; question: string; answer: string }
function AnalysisFallback({ loading = false, onClose }: { loading?: boolean; onClose: () => void }) {
  const action = useRef<HTMLButtonElement>(null)
  useEffect(() => { action.current?.focus({ preventScroll: true }) }, [loading])
  return <section className="rw-analysis-fallback" onKeyDown={event => {
    if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onClose() }
  }}>
    <div role={loading ? 'status' : 'alert'}><p>{loading ? '차트를 불러오는 중입니다.' : '차트를 불러오지 못했습니다. 문서와 질문은 그대로 유지됩니다.'}</p></div>
    <button ref={action} type="button" className="g-btn g-btn-s" onClick={onClose}>문서로 돌아가기</button>
  </section>
}
type WorkspaceState = { active: DocId; tabs: DocId[]; drafts: Partial<Record<DocId, string>>; rowDrafts: Record<string, string>; replies: Reply[]; positions: Partial<Record<DocId, number>>; edits: Record<string, string>; paper: boolean; paused: boolean }
const validDoc = (id: unknown): id is DocId => id === 'activity' || RESEARCH_DOCUMENTS.some(row => row[0] === id)
const availableDoc = (id: unknown, seconds: number): id is DocId => validDoc(id) && (id === 'activity' || seconds >= (RESEARCH_DOCUMENTS.find(row => row[0] === id)?.[2] ?? 0))
function initialState(id: string, seconds: number): WorkspaceState {
  const base: WorkspaceState = { active: 'plan', tabs: ['plan'], drafts: {}, rowDrafts: {}, replies: [], positions: {}, edits: {}, paper: false, paused: false }
  try {
    const cached = readResearchDocumentCache(id)
    const value = cached as Partial<WorkspaceState> | null
    if (!value || typeof value !== 'object') return base
    const active: DocId = availableDoc(value.active, seconds) ? value.active : 'plan'
    const tabs: DocId[] = Array.isArray(value.tabs) ? [...new Set<DocId>(value.tabs.filter((doc: unknown): doc is DocId => availableDoc(doc, seconds)))].slice(0, 5) : []
    if (!tabs.includes(active)) {
      if (tabs.length === 5) tabs.pop()
      tabs.push(active)
    }
    return { ...base, active, tabs,
      drafts: Object.fromEntries(Object.entries(value.drafts ?? {}).filter(([key, val]) => validDoc(key) && typeof val === 'string')),
      rowDrafts: Object.fromEntries(Object.entries(value.rowDrafts ?? {}).filter(([key, val]) => validDoc(key.split(':')[0]) && typeof val === 'string')),
      edits: Object.fromEntries(Object.entries(value.edits ?? {}).filter(([key, val]) => {
        if (typeof val !== 'string') return false
        if (key !== '손절' && key !== '익절') return true
        return readStoredPercentage(val) !== null
      }).map(([key, val]) => [key, String(val)])),
      positions: Object.fromEntries(Object.entries(value.positions ?? {}).filter(([key, val]) => validDoc(key) && typeof val === 'number' && Number.isFinite(val) && val >= 0)),
      replies: Array.isArray(value.replies) ? value.replies.filter((r: Reply) => r && validDoc(r.doc) && typeof r.question === 'string' && typeof r.answer === 'string') : [], paper: value.paper === true, paused: value.paused === true }
  } catch { return base }
}

function ResearchCommentIcon({ label, className }: { label?: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" /></svg>
}

function Row({ label, value, draft, onDraftChange, onComment }: { label: string; value: string; draft: string; onDraftChange: (value: string) => void; onComment?: (value: string) => string | false | void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const close = (submitted = false) => { setOpen(false); if (submitted) onDraftChange(''); setError(''); trigger.current?.focus() }
  return <>
    <div className="g-row"><span className="k">{label}</span><span className="v">{value}</span>{onComment && <button ref={trigger} className="cbtn" type="button" aria-label={`${label} 수정 요청`} aria-expanded={open} onClick={() => { if (open) close(); else setOpen(true) }}><ResearchCommentIcon /></button>}</div>
    {open && <form className="g-inline-input" onSubmit={e => {
      e.preventDefault()
      if (!draft.trim()) { input.current?.focus(); return }
      const failure = onComment?.(draft.trim())
      if (failure === false) { input.current?.focus(); return }
      if (failure) { setError(failure); input.current?.focus(); return }
      close(true)
    }}>
      <input ref={input} autoFocus aria-label={`${label} 코멘트`} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} placeholder="수정 요청, 예: -2%로" value={draft} onChange={e => { onDraftChange(e.target.value); setError('') }} onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }} />
      <button className="g-btn g-btn-s" type="submit" disabled={!draft.trim()}>적용</button><button className="g-btn-t" type="button" onClick={() => close()}>취소</button>
      {error && <p className="rw-input-error" id={errorId} role="alert">{error}</p>}
    </form>}
  </>
}
function Stats({ values }: { values: [string, string, ('up' | 'down')?][] }) {
  return <div className="g-vstat">{values.map(([label, value, tone]) => <div key={label}><div className="k">{label}</div><div className={`v ${tone ?? ''}`}>{value}</div></div>)}</div>
}

export type ClientResearchPlanContext = ResearchPlanContext
type ResearchWorkspaceProps = { sessionId: string; idea: string; titleEditor?: ReactNode; onBack: () => void; onDelegate?: () => void; planContext?: ClientResearchPlanContext; onStatusChange?: (status: '초안' | '진행 중' | '검토 필요') => void; registered?: boolean; onStartPaper?: () => boolean; onOpenTrading?: () => void; onBeforeAi?: () => boolean; onStartResearch?: () => boolean; focusOnMount?: boolean }
export function ClientResearchWorkspace(props: ResearchWorkspaceProps) {
  return <ResearchWorkspaceSession key={props.sessionId} {...props} />
}
function ResearchWorkspaceSession({ sessionId, idea, titleEditor, onBack, onDelegate, planContext, onStatusChange, registered = false, onStartPaper, onOpenTrading, onBeforeAi, onStartResearch, focusOnMount = false }: ResearchWorkspaceProps) {
  const { currency, language } = useClientPreferences()
  const { c } = useConversationCopy()
  const labelOf = (value: string) => clientResearchLabel(value, language)
  const titleOf = (id: DocId) => labelOf(rawTitleOf(id))
  const exampleMoney = (usd: number) => formatReferenceMoney(usd, currency, language)
  const { state: replay, store } = useMockResearchPreview(`restored:${sessionId}`)
  const [state, setState] = useState(() => initialState(sessionId, replay.seconds))
  const [analysis, setAnalysis] = useState<AnalysisLocation | null>(() => readAnalysisLocation(sessionId, replay.seconds))
  const root = useRef<HTMLDivElement>(null)
  const entryFocused = useRef(false)
  useEffect(() => {
    if (!focusOnMount || entryFocused.current) return
    entryFocused.current = true
    // A restored full-chart view owns its focus. Ordinary document updates
    // must not pull focus away from an input or another tab after entry.
    if (!analysis) root.current?.querySelector<HTMLElement>('.rw-tabs [aria-selected="true"]')?.focus({ preventScroll: true })
  }, [analysis, focusOnMount])
  const analysisViews = useRef<[ResearchAnalysisView, ResearchAnalysisView]>([newAnalysisView(), newAnalysisView()])
  const [analysisView, setAnalysisView] = useState(newAnalysisView)
  const analysisTrigger = useRef<HTMLElement | null>(null)
  const analysisClosing = useRef(false)
  const [auxOpen, setAuxOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [storageWarningDismissed, setStorageWarningDismissed] = useState(false)
  const displayNotice = [notice, replay.recoveryRequired ? '저장된 연구 진행을 확인할 수 없어요. 새로고침 후 다시 확인해주세요.' : (storageError || replay.storageError) && !storageWarningDismissed ? '브라우저 저장에 실패했습니다. 새로고침 시 초기화될 수 있으니 내용을 복사해 두세요.' : ''].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(' ')
  const [connectionPreview, setConnectionPreview] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const rejectedStart = useRef(false)
  useLayoutEffect(() => {
    if (!rejectedStart.current) return
    rejectedStart.current = false
    // A notice reduces the mobile document viewport. Keep the initiating
    // control visible without stealing its keyboard focus for a toast.
    scroll.current?.querySelector<HTMLButtonElement>('.rw-actions .g-btn-p')?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
  }, [notice])
  const composer = useRef<HTMLTextAreaElement>(null)
  const tabNav = useRef<HTMLElement>(null)
  const auxPanel = useRef<HTMLElement>(null)
  const auxTrigger = useRef<HTMLButtonElement>(null)
  const follow = useRef(true)
  const previousStatus = useRef(replay.status)
  const mounted = useRef(true)
  const active = state.active
  const positions = useRef(state.positions)
  const restoringPosition = useRef(false)
  const savePositionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveView = useRef(() => {})
  const elapsed = replay.seconds
  const latestElapsed = useRef(elapsed)
  useLayoutEffect(() => { latestElapsed.current = elapsed }, [elapsed])
  useEffect(() => {
    const navigate = () => {
      const next = readAnalysisLocation(sessionId, latestElapsed.current)
      if (next) setAnalysisView(analysisViews.current[next.version])
      setAnalysis(next); analysisClosing.current = false
      if (!next) requestAnimationFrame(() => {
        const target = analysisTrigger.current?.isConnected ? analysisTrigger.current : scroll.current?.querySelector<HTMLButtonElement>('.ra-entry button')
        if (target?.isConnected && target.getClientRects().length) target.focus({ preventScroll: true })
      })
    }
    window.addEventListener('popstate', navigate)
    return () => window.removeEventListener('popstate', navigate)
  }, [sessionId])
  function openAnalysis(version: ResearchVersion) {
    const doc = active === 'report' ? 'report' : version === 0 ? 'bt1' : 'bt2'
    if (!availableDoc(doc, elapsed) || analysis) return
    positions.current[active] = scroll.current?.scrollTop ?? 0
    saveView.current()
    analysisTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const next: AnalysisLocation = { owner: sessionId, doc, version }
    try { history.pushState({ ...history.state, tethResearchAnalysis: next }, '', location.href) }
    catch { setNotice('차트를 열지 못했습니다. 현재 문서와 초안은 유지됩니다.'); return }
    setAnalysisView(analysisViews.current[version]); setAuxOpen(false); setAnalysis(next)
  }
  function closeAnalysis() {
    if (analysisClosing.current) return
    analysisClosing.current = true
    if (readAnalysisLocation(sessionId, elapsed)) history.back()
    else { setAnalysis(null); analysisClosing.current = false }
  }
  const available = RESEARCH_DOCUMENTS.filter(([id, , at]) => elapsed >= at && !['connect', 'run', 'live'].includes(id))
  const status = replay.status === 'playing' ? 'running' : replay.status === 'completed' ? 'completed' : 'paused'
  const activeDraft = state.drafts[active] ?? ''
  const review = previewCritic(elapsed)
  // UI selection context only, not Strategy AST or a claim that this fixture ran these inputs.
  const planPair = planContext ? planContext.pair || '미설정' : 'BTC/USDT'
  const planTimeframe = planContext ? planContext.timeframe || '미설정' : '1일봉'
  const planRisk = state.edits['손절'] ?? (planContext ? planContext.risk || '미설정' : '−3%')
  const planTake = state.edits['익절'] ?? (planContext ? planContext.takeProfit || '미설정' : '+8%')
  const isTrend = planContext?.mode === 'trend'
  const hypothesis = isTrend
    ? { pro: 'Momentum continuation following volume-confirmed breakouts within established uptrends.', plain: '거래가 몰리며 상승 흐름이 확인될 때, 그 흐름이 이어지는 구간을 노립니다.' }
    : { pro: 'Mean-reversion entry after oversold conditions, confirmed by initial price recovery.', plain: '많이 떨어져 과매도가 된 뒤, 가격이 다시 고개를 드는 순간의 반등을 노립니다.' }
  const planEntry = planContext?.parameters
    ? `전봉 RSI ${planContext.parameters.rsiTh} 이하 + 당일 +0.5% 반등${planContext.parameters.trendFilter ? ' + 추세 필터(20/60 이평)' : ''}`
    : planContext ? isTrend ? '20일 이동평균 상향 돌파 + 거래량 확인' : 'RSI 30 이하 과매도 후 20일 이동평균 회복' : 'RSI(14) < 40 + 직전 대비 +0.5% 반등'
  const planRows = [['대상', `${planPair}, ${planTimeframe}`], ['진입', planEntry], ['손절', planRisk], ['익절', planTake], ['Research 데이터', '2023.01 ~ 2025.06'], ['Holdout 데이터', '2025.07 ~ 2026.08, 연구에 쓰지 않은 최근 데이터'], ['거래 비용', '수수료, 슬리피지 포함'], ['검증', '7단계, 위험 조정 수익 우선']]
  useEffect(() => {
    // A missing replay cache is not evidence that an already registered
    // research became a draft. Do not manufacture a completed replay either.
    if (registered && replay.status === 'idle') return
    onStatusChange?.(replay.status === 'idle' ? '초안' : replay.status === 'completed' ? '검토 필요' : '진행 중')
  }, [replay.status, registered, onStatusChange])
  useEffect(() => {
    saveView.current = () => {
      const saved = writeResearchDocumentCache(sessionId, { ...state, positions: positions.current })
      if (mounted.current) {
        setStorageError(!saved)
        if (saved) setStorageWarningDismissed(false)
      }
    }
    saveView.current()
  }, [sessionId, state])
  useEffect(() => {
    const save = () => { clearTimeout(savePositionTimer.current); saveView.current() }
    window.addEventListener('pagehide', save)
    return () => { save(); window.removeEventListener('pagehide', save) }
  }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useLayoutEffect(() => {
    const field = composer.current
    if (!field) return
    let frame = 0, disposed = false
    const resize = () => {
      if (disposed) return
      field.style.height = 'auto'
      const style = getComputedStyle(field)
      const oneLine = parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const contentHeight = field.scrollHeight
      field.style.height = `${Math.min(140, Math.max(parseFloat(style.minHeight), contentHeight))}px`
      field.closest('.rw-composer')?.classList.toggle('multi', contentHeight > oneLine + 1)
    }
    resize()
    let width = field.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === width) return
      width = entry.contentRect.width
      cancelAnimationFrame(frame); frame = requestAnimationFrame(resize)
    })
    observer.observe(field)
    void document.fonts.ready.then(resize)
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame) }
  }, [activeDraft, active, analysis])
  useLayoutEffect(() => {
    const nav = tabNav.current
    if (!nav || analysis) return
    let disposed = false, frame = 0
    const revealSelected = () => {
      if (disposed || !nav.isConnected || !nav.clientWidth) return
      const selected = nav.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!selected) return
      const viewport = nav.getBoundingClientRect(), tab = selected.getBoundingClientRect()
      // Only scroll this strip. Fonts, a restored tab or the sidebar can change
      // its geometry after mount; never move the document or steal input focus.
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
  }, [active, analysis, state.tabs])
  useEffect(() => {
    const breakpoint = matchMedia('(max-width:1100px)')
    // Chromium may blur a newly display:none control before matchMedia fires.
    // Remember keyboard focus, but discard it on an unrelated pointer action.
    let lastFocused: HTMLElement | null = null
    const rememberFocus = (event: FocusEvent) => { lastFocused = event.target instanceof HTMLElement ? event.target : null }
    const clearFocus = () => { lastFocused = null }
    const resize = () => {
      setAuxOpen(false)
      const focused = document.activeElement === document.body ? lastFocused : document.activeElement
      if (!(focused instanceof HTMLElement) || focused.closest('[hidden],[inert]')) return
      if (!auxPanel.current?.contains(focused) && focused !== auxTrigger.current) return
      if (breakpoint.matches) auxTrigger.current?.focus({ preventScroll: true })
      else if (!focused.getClientRects().length) auxPanel.current?.querySelector<HTMLButtonElement>('.rw-artifact')?.focus({ preventScroll: true })
    }
    const navigate = () => { lastFocused = null; setAuxOpen(false) }
    breakpoint.addEventListener('change', resize)
    document.addEventListener('focusin', rememberFocus); document.addEventListener('pointerdown', clearFocus, true)
    window.addEventListener('popstate', navigate); window.addEventListener('teth:navigate', navigate); window.addEventListener('hashchange', navigate)
    return () => { breakpoint.removeEventListener('change', resize); document.removeEventListener('focusin', rememberFocus); document.removeEventListener('pointerdown', clearFocus, true); window.removeEventListener('popstate', navigate); window.removeEventListener('teth:navigate', navigate); window.removeEventListener('hashchange', navigate) }
  }, [])
  useEffect(() => {
    if (!auxOpen) return
    auxPanel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = () => { setAuxOpen(false); auxTrigger.current?.focus() }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
      if (event.key === 'Tab') {
        const buttons = Array.from(auxPanel.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        const first = buttons[0], last = buttons.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const outside = (event: PointerEvent) => { if (!auxPanel.current?.contains(event.target as Node) && !auxTrigger.current?.contains(event.target as Node)) close() }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [auxOpen])
  const openDoc = (doc: DocId) => {
    if (!availableDoc(doc, elapsed) && !(doc === 'live' && registered)) return
    const position = scroll.current?.scrollTop ?? 0
    setState(old => { const tabs = old.tabs.includes(doc) ? old.tabs : [...old.tabs, doc]; if (tabs.length > 5) tabs.splice(1, 1); return { ...old, active: doc, tabs, positions: { ...old.positions, [old.active]: position } } })
    setAuxOpen(false)
    if (auxOpen) requestAnimationFrame(() => tabNav.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true }))
  }
  useLayoutEffect(() => {
    const element = scroll.current
    if (!element || analysis) return
    const target = positions.current[active] ?? 0
    let disposed = false, frame = 0
    restoringPosition.current = true
    element.scrollTop = target
    follow.current = element.scrollHeight - element.clientHeight - element.scrollTop < 140
    // A fallback font/short textarea can temporarily clamp scrollTop. Preserve
    // the requested position until fonts and the composer have their final size.
    const userTookOver = () => { restoringPosition.current = false }
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    events.forEach(event => element.addEventListener(event, userTookOver, { passive: true }))
    void document.fonts.ready.then(() => {
      if (disposed) return
      frame = requestAnimationFrame(() => {
        if (restoringPosition.current) {
          element.scrollTop = active === 'activity' && follow.current ? element.scrollHeight : target
          positions.current[active] = element.scrollTop
          restoringPosition.current = false
        }
      })
    })
    return () => { disposed = true; restoringPosition.current = false; cancelAnimationFrame(frame); events.forEach(event => element.removeEventListener(event, userTookOver)) }
  }, [active, analysis]) // Restore the original document after closing its chart artifact.
  const entryCount = previewEntries(elapsed).length
  useEffect(() => { if (active === 'activity' && follow.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'auto' }) }, [entryCount, active])
  useEffect(() => {
    const justFinished = previousStatus.current !== 'completed' && replay.status === 'completed'
    previousStatus.current = replay.status
    if (!justFinished || active !== 'activity') return
    const timer = window.setTimeout(() => setState(old => { if (old.active !== 'activity') return old; const tabs = old.tabs.includes('report') ? old.tabs : [...old.tabs, 'report' as const]; if (tabs.length > 5) tabs.splice(1, 1); return { ...old, active: 'report', tabs } }), 1200)
    return () => window.clearTimeout(timer)
  }, [replay.status, active])
  function ask(question: string, answer?: string, clearComposer = true, doc: DocId = active) {
    const text = question.trim(); if (!text) return
    if (onBeforeAi && !onBeforeAi()) return false
    const replies: Partial<Record<DocId, string>> = { plan: '조건과 검증 범위를 연구 계획에 정리했습니다. 행의 코멘트에서 변경할 조건을 남길 수 있어요.', hypo: `${hypothesis.plain} 이 패턴이 연구 구간과 봉인 구간 모두에서 확인되어야 가설이 유지됩니다.`, strat1: '초기 조건은 RSI(14) < 40과 직전 대비 +0.5% 반등입니다. 손절 −3%, 익절 +8%, 최대 보유 25일, 비용 왕복 0.2%를 적용합니다.', strat2: '저변동성 구간의 신규 진입을 제한하는 필터를 추가했습니다. 손절과 익절은 유지하고 같은 연구 구간에서 재검증합니다.', critic: '저변동성 구간에 손실 거래 71%가 집중되어 필터를 추가했습니다. 상위 3개 거래의 수익 집중도도 함께 확인해야 합니다.', holdout: '전략 제작에 사용되지 않은 2025.07 ~ 2026.08 데이터입니다. 연구와 분리된 구간에서도 성격이 유지되는지 확인합니다.', stress: '일부러 불리한 조건에서 재검증합니다. 횡보장과 회복장에서는 성과 약화가 남아 있습니다.', report: '수익성 판단은 일치하지만 위험 심사는 낙폭과 손실 지속 기간 측면에서 보류했습니다. 다수결로 덮지 않고 실제 체결 차이는 가상 검증에서 확인합니다.' }
    const reply = answer ?? replies[doc] ?? (doc === 'bt1' || doc === 'bt2' ? `수익률만이 아니라 최대 낙폭, 거래 수, 승률과 연도별 손익을 함께 확인하세요. ${doc === 'bt1' ? 'v1은' : 'v2는'} ${FIXTURE.versions[doc === 'bt1' ? 0 : 1].n}회 거래, 최대 낙폭 ${FIXTURE.versions[doc === 'bt1' ? 0 : 1].mdd.toFixed(1)}%입니다.` : '현재 문서와 연구 기록을 기준으로 확인할 내용을 남겼습니다.')
    setState(old => ({ ...old, drafts: clearComposer ? { ...old.drafts, [doc]: '' } : old.drafts, replies: [...old.replies, { doc, question: text, answer: reply }] }))
    requestAnimationFrame(() => { if (mounted.current && !analysis) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'auto' }) })
  }
  function edit(label: string, value: string) {
    if (active === 'plan' && replay.status === 'idle' && (label === '손절' || label === '익절')) {
      const parsed = parsePercentageEdit(value)
      if (parsed.kind === 'error') return parsed.message
      if (parsed.kind === 'value') {
        const formatted = `${label === '손절' ? '−' : '+'}${Math.abs(parsed.value)}%`
        setState(old => ({ ...old, edits: { ...old.edits, [label]: formatted } }))
        setNotice(`계획에 반영했어요, ${label} ${formatted}. 현재 연구 예시의 조건은 바뀌지 않습니다.`)
        return
      }
    }
    return ask(`${labelOf(label)}: ${value}`, '수정 요청을 이 문서에 남겼습니다. 검증이 끝난 버전의 조건은 그대로 유지됩니다.', false)
  }
  function begin() {
    if (replay.status !== 'idle') { openDoc('activity'); return }
    if (onBeforeAi && !onBeforeAi()) return
    try {
      if (onStartResearch) { if (!onStartResearch()) return } else store.start()
      setNotice('')
      setState(old => ({ ...old, active: 'activity', tabs: ['activity', 'plan'] })); follow.current = true
    } catch (error) { rejectedStart.current = true; setNotice(error instanceof Error ? error.message : '연구를 시작하지 못했어요. 현재 계획은 유지됩니다.') }
  }
  const renderRow = (label: string, value: string) => <Row key={label} label={labelOf(label)} value={value} draft={state.rowDrafts[`${active}:${label}`] ?? ''} onDraftChange={draft => setState(old => ({ ...old, rowDrafts: { ...old.rowDrafts, [`${active}:${label}`]: draft } }))} onComment={text => edit(label, text)} />
  function renderBacktest(version: 0 | 1) {
    const v = FIXTURE.versions[version]
    return <><h3>{labelOf(`Backtest v${version + 1}`)}</h3><div className="meta">연구 2023.01 ~ 2025.06, 비용 반영</div><Stats values={[["수익률", pct(v.ret), 'up'], ['최대 낙폭', `${v.mdd.toFixed(1)}%`, 'down'], ['승률', `${v.winRate.toFixed(1)}%`], ['거래', `${v.n}회`], ['수익 팩터', v.pf.toFixed(2)]]} /><ResearchChart version={version} /><div className="ra-entry"><button type="button" className="g-btn g-btn-s" onClick={() => openAnalysis(version)}>차트로 자세히 보기 <span aria-hidden="true">↗</span></button></div><ResearchChart version={version} equity /><h3>연도별</h3><table className="g-table"><thead><tr><th>연도</th><th>손익</th><th>거래</th><th>승률</th></tr></thead><tbody>{Object.entries(v.byYear).map(([year, row]) => <tr key={year}><td className="num">{year}</td><td className={`num ${row.pnl >= 0 ? 'up' : 'down'}`}>{pct(row.pnl * 100)}</td><td className="num">{row.n}</td><td className="num">{Math.round(row.w / row.n * 100)}%</td></tr>)}</tbody></table><div className="g-note rw-spaced">최대 낙폭 {v.mdd.toFixed(1)}%, 가장 좋았던 시점 대비 자산이 최대 {Math.abs(v.mdd).toFixed(1)}% 감소했습니다. {exampleMoney(10000)} 기준 약 {exampleMoney(Math.round(10000 * (1 + v.mdd / 100)))} ({currency === 'USD' ? '예시 계산' : '고정 예시 환산'}).</div></>
  }
  let content: ReactNode
  if (active === 'plan') content = <><h3>{labelOf('Research Plan')}</h3><div className="meta">{planPair}, {planTimeframe}, 행 위에서 <span className="rw-comment-symbol"><ResearchCommentIcon className="rw-comment-hint-icon" label="코멘트 아이콘" />로</span> 수정 요청</div><div className="g-note rw-spaced">{hypothesis.plain}</div><div className="rw-rows">{planRows.map(([label, value]) => renderRow(label, state.edits[label] ?? value))}</div><div className="rw-actions"><button className="g-btn g-btn-p" onClick={begin}>{replay.status === 'idle' ? '연구 시작' : '연구 과정 보기'}</button><button className="g-btn-t" onClick={onBack}>조건 수정</button></div></>
  else if (active === 'activity') content = <><ClientResearchLog entries={previewEntries(elapsed)} source="mock-replay" status={status} />{replay.status === 'completed' && <div className="rw-complete"><h3>연구 완료</h3><div className="g-note">검증 7단계 완료, 전략 수정 1회, 백테스트 {FIXTURE.report.backtestCount}회, 봉인 구간 통과</div><div className="rw-actions"><button className="g-btn g-btn-p" onClick={() => openDoc('report')}>최종 보고서 열기</button></div></div>}</>
  else if (active === 'hypo') content = <><h3>{labelOf('Investment Hypothesis')}</h3><div className="g-note rw-hypothesis">{hypothesis.pro}</div><h3>쉽게 말하면</h3><div>{hypothesis.plain}</div><h3>검증 기준</h3><div className="g-note">이 패턴이 연구 구간과 봉인 구간 모두에서 확인되어야 가설이 유지됩니다. 결과는 백테스트와 봉인 구간 검증 문서에서 확인하세요.</div></>
  else if (active === 'strat1' || active === 'strat2') content = <><h3>{labelOf(`Strategy v${active === 'strat1' ? 1 : 2}`)}</h3><div className="meta">{active === 'strat1' ? '처음 만든 조건' : '저변동성 진입 필터 추가'}{active === 'strat2' && elapsed < 53 ? ' · 재검증 전' : ''}</div><div className="rw-spaced">{[['진입', `RSI(14) < 40 + 직전 대비 +0.5% 반등${active === 'strat2' ? ' + 저변동성 필터' : ''}`], ['손절', '−3%'], ['익절', '+8%'], ['최대 보유', '25일'], ['비용', '왕복 0.2%']].map(([label, value]) => renderRow(label, value))}</div></>
  else if (active === 'bt1' || active === 'bt2') content = renderBacktest(active === 'bt1' ? 0 : 1)
  else if (active === 'critic') content = review ? <ClientCriticReview review={review} /> : <div className="g-note">전략 검토 중</div>
  else if (active === 'stress') content = <><h3>{labelOf('Stress Test')}</h3><div className="meta">일부러 불리한 조건에서 재검증</div><div className="rw-table-scroll"><table className="g-table rw-spaced"><thead><tr><th>시나리오</th><th>결과</th><th>판정</th></tr></thead><tbody>{FIXTURE.stress.map(row => <tr key={row.name}><td>{row.name}</td><td className="num">{row.mdd === null ? `최저 ${pct(row.ret)}` : `수익 ${pct(row.ret)}, 낙폭 ${row.mdd.toFixed(1)}%`}</td><td className={row.grade === 'Pass' ? 'up' : row.grade === 'Warning' ? 'warn' : 'down'}>{row.grade}</td></tr>)}</tbody></table></div></>
  else if (active === 'holdout') content = <><h3>{labelOf('Holdout Test')}</h3><div className="meta">🔒 전략 제작에 사용되지 않은 데이터, 2025.07 ~ 2026.08</div><Stats values={[["수익 (연환산)", `${pct(FIXTURE.versions[1].cagr, 0)} → ${pct(FIXTURE.holdout.cagr, 0)}`], ['낙폭', `${FIXTURE.versions[1].mdd.toFixed(1)}% → ${FIXTURE.holdout.mdd.toFixed(1)}%`], ['거래', `${FIXTURE.versions[1].n} → ${FIXTURE.holdout.n}회`]]} /><div className="g-note rw-spaced">처음 보는 구간에서도 성격이 유지되었습니다, 과최적화 신호 낮음.</div></>
  else if (active === 'report') {
    const result = FIXTURE.versions[1], report = FIXTURE.report
    const disagreements = report.opinions.filter(opinion => opinion.v !== 'Pass')
    content = <>
      <h3>과매도 반등 전략</h3>
      <div className="meta">BTC/USDT, 1일봉, 연구 v2, 데모: 표준 샘플 데이터로 검증 과정을 시연 중</div>
      <div className="rw-verdict"><p>{report.verdict.line}</p><span className={`g-tag ${report.verdict.grade[1] === 'v-good' ? 'ok' : 'warn'}`}>{report.verdict.grade[0]}</span></div>
      <Stats values={[
        ['연구 수익', pct(result.ret), result.ret >= 0 ? 'up' : 'down'],
        ['봉인 구간 수익', pct(FIXTURE.holdout.ret), FIXTURE.holdout.ret >= 0 ? 'up' : 'down'],
        ['최대 낙폭', `${result.mdd.toFixed(1)}%`, 'down'], ['수익 팩터', result.pf.toFixed(2)],
      ]} />
      <div className="ra-entry"><button type="button" className="g-btn g-btn-s" onClick={() => openAnalysis(1)}>차트로 자세히 보기 <span aria-hidden="true">↗</span></button></div>
      <h3>근거</h3>
      <div className="rw-evidence">
        <div>✓ 가설 확인, {report.bestYear}년 {pct(report.bestYearPnl)} <button className="g-btn-t" onClick={() => openDoc('bt2')}>근거</button></div>
        <div>✓ 봉인 구간 {FIXTURE.holdout.ret > 0 ? '통과' : '미통과'} <button className="g-btn-t" onClick={() => openDoc('holdout')}>근거</button></div>
        <div>{report.cliff ? '! 파라미터 불안정' : '✓ 파라미터 안정 (±2 유지)'}</div>
        <div>! {report.worstYear}년 성과 약화 ({pct(report.worstYearPnl)})</div>
        <div>? 급격한 시장 구조 변화, 검증되지 않음</div>
      </div>
      {disagreements.length > 0 && <><h3>의견 불일치</h3><div className="g-note">
        {report.opinions.map(opinion => `${labelOf(opinion.who)}, ${opinion.v}`).join(', ')}<br />
        수익성 판단은 일치하나 {labelOf(disagreements[0].who)}는 {disagreements[0].why} 측면에서 보류. 다수결로 덮지 않습니다.
      </div></>}
      <h3>검증 무결성</h3>
      <div className="g-note">백테스트 {report.backtestCount}회, 무결성 검사 {report.sanity.filter(check => check.p).length}/{report.sanity.length}, 수정 {FIXTURE.versions.length - 1}회, 봉인 구간 유지<br /><b>가장 높은 수익이 아니라, 가장 많은 검증을 버틴 전략입니다.</b></div>
      <h3>아직 모르는 것</h3><div className="g-note">급격한 시장 구조 변화, 실제 체결 차이(가상 검증에서 확인), 극단적 유동성 부족, 수수료 정책 변경</div>
      <h3>만약에</h3>
      <div className="rw-actions rw-compact">{['수수료 2배', '진입 1캔들 지연', '손절 -2%'].map((label, index) => <button className="g-qchip" key={label} onClick={() => {
        const r = FIXTURE.whatif[index]
        ask(label, `만약에 · ${label}, 수익 ${pct(Number(r[1]))}, 낙폭 ${Number(r[2]).toFixed(1)}%, ${r[3]}회 (정식 연구 아님)`, false)
      }}>{label}</button>)}</div>
      <div className="rw-actions"><button className="g-btn g-btn-p" onClick={() => openDoc('connect')}>거래소 연결</button><button className="g-btn-t" onClick={() => openDoc('activity')}>연구 과정 보기</button>{onDelegate && <button className="g-btn-t" onClick={onDelegate}>전략 위임</button>}</div>
    </>
  }
  else if (active === 'connect') content = <div className="g-card-center"><h3 className="ct">거래소 연결</h3><button className="g-fbtn p" onClick={() => { setConnectionPreview(true); setNotice('현재는 연결 화면 미리보기입니다. 계정 연결이나 권한 요청을 실행하지 않았습니다.') }}>Binance로 간편 연결</button><button className="g-fbtn s" onClick={() => setNotice('파트너 거래소 연결은 실제 서비스 연동 이후 제공됩니다.')}>파트너 거래소로 시작</button><table className="g-table"><tbody><tr><td>잔고, 시세 조회</td><td className="up">요청함</td></tr><tr><td>주문 실행</td><td className="up">요청함</td></tr><tr><td>출금</td><td>요청 안 함</td></tr></tbody></table><div className="g-note">연결은 설정에서 언제든 해제할 수 있습니다</div>{connectionPreview && <button className="g-btn g-btn-s" onClick={() => openDoc('run')}>실행 확인 화면 보기</button>}</div>
  else if (active === 'run') content = <>
    <h3>실행 확인</h3><div className="meta">연구 검증 → 백테스트 검증 → <b>가상 검증</b> → 실전</div>
    <div className="rw-spaced">{[['전략', '과매도 반등 전략'], ['조건', 'BTC/USDT, 1일봉'], ['손절 / 익절', '−3% / +8%'], ['투자금', `${sourceMoney(CLIENT_RESEARCH_CAPITAL_KRW, currency, language)} (고정 예시)`], ['검증', `${pct(FIXTURE.versions[1].ret)}, 낙폭 ${FIXTURE.versions[1].mdd.toFixed(1)}%, 봉인 구간 통과`]].map(([label, value]) => renderRow(label, value))}</div>
    <div className="g-note rw-spaced">가상 검증은 실제 주문 없이 실시간으로 체결을 재현합니다. 시작하면 AI 트레이딩에서 관리해요.</div>
    <div className="rw-actions"><button className="g-btn g-btn-p" onClick={() => {
      if (replay.status !== 'completed') { setNotice('연구 결과가 없어요, 연구를 먼저 완료해주세요.'); return }
      if (registered) onOpenTrading?.()
      else if (!onStartPaper) setNotice('전략을 등록할 화면을 불러오지 못했어요. 다시 열어주세요.')
      else onStartPaper()
    }}>{registered ? 'AI 트레이딩에서 열기' : '가상 검증으로 시작'}</button>
      <button className="g-btn g-btn-s" onClick={() => setNotice('실제 자금 실행은 데모에서 잠겨 있어요. 가상 검증으로 먼저 확인해보세요.')}>실전 시작 (데모 잠금)</button></div>
  </>
  else content = <><h3>과매도 반등 전략</h3>
    <div className="meta"><span className="g-tag ok">가상 검증, 실제 주문 없음</span></div>
    <div className="g-note rw-spaced">{registered ? '이 전략은 AI 트레이딩에 추가됐어요. 실행 상태와 성과는 터미널에서 확인하세요.' : '연구 결과를 확인하고 AI 트레이딩에서 가상 검증을 시작하세요.'}</div>
    <div className="rw-actions"><button className="g-btn g-btn-p" onClick={() => registered ? onOpenTrading?.() : openDoc('run')}>{registered ? 'AI 트레이딩에서 열기' : '실행 확인'}</button></div>
  </>

  return <div ref={root} className="client-restored-research" data-source="client-fixture">
    {analysis && <ClientLoadBoundary key={analysis.doc} fallback={<AnalysisFallback onClose={closeAnalysis} />}>
      <Suspense fallback={<AnalysisFallback loading onClose={closeAnalysis} />}>
        <Analysis version={analysis.version} originTitle={titleOf(analysis.doc)} view={analysisView} onViewChange={view => { analysisViews.current[analysis.version] = view }} onClose={closeAnalysis}
          draft={state.drafts[analysis.doc] ?? ''} onDraftChange={draft => setState(old => ({ ...old, drafts: { ...old.drafts, [analysis.doc]: draft } }))}
          thread={<>{state.replies.filter(reply => reply.doc === analysis.doc).map((reply,index) => <div key={index}><div className="rw-user-message">{reply.question}</div><div className="rw-answer">{reply.answer}</div></div>)}</>}
          onAsk={(question, reference) => ask(reference ? question + '\n\n참고: ' + reference : question, reference ? reference + '\n문서에 기록된 거래입니다. 조건 변경은 새 검증이 필요하며 기존 결과는 그대로 유지됩니다.' : undefined, true, analysis.doc)} />
      </Suspense>
    </ClientLoadBoundary>}
    <div className="rw-workspace" hidden={Boolean(analysis)} style={analysis ? { display: 'none' } : undefined}><section className="rw-center"><header className="rw-header"><div className="rw-title"><button type="button" className="g-btn-t" aria-label="대화로 돌아가기" onClick={onBack}>←</button><div className="rw-heading">{titleEditor ?? <span title={idea}>{idea || '과매도 반등 전략'}</span>}</div>{replay.status === 'playing' && <span className="g-tag"><span className="g-dot run" />연구 진행 중</span>}<button ref={auxTrigger} className="rw-mobile-artifacts g-btn-t" aria-label={`${labelOf('Artifacts')} 열기`} aria-expanded={auxOpen} onClick={() => setAuxOpen(v => !v)}><ClientIcon name="document" /> {labelOf('Artifacts')}</button></div><nav ref={tabNav} className="rw-tabs" role="tablist" aria-label="열린 연구 문서" onKeyDown={e => { if (e.defaultPrevented || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); const index = state.tabs.indexOf(active); const next = e.key === 'Home' ? 0 : e.key === 'End' ? state.tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + state.tabs.length) % state.tabs.length; openDoc(state.tabs[next]); requestAnimationFrame(() => tabNav.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()) }}>{state.tabs.map(doc => <button type="button" role="tab" tabIndex={active === doc ? 0 : -1} aria-selected={active === doc} className={active === doc ? 'on' : ''} key={doc} onClick={() => openDoc(doc)}>{titleOf(doc)}</button>)}</nav></header><div className="rw-scroll" ref={scroll} onScroll={e => { if (analysis || restoringPosition.current) return; const node = e.currentTarget; follow.current = node.scrollHeight - node.clientHeight - node.scrollTop < 140; positions.current[active] = node.scrollTop; clearTimeout(savePositionTimer.current); savePositionTimer.current = setTimeout(() => saveView.current(), 250) }}><article className="g-doc g-adoc" aria-label={`${titleOf(active)} 문서`} key={active}>{content}<div className="rw-thread">{state.replies.filter(reply => reply.doc === active).map((reply, index) => <div key={index}><div className="rw-user-message">{reply.question}</div><div className="rw-answer">{reply.answer}</div></div>)}</div></article></div>{!(active === 'activity' && replay.status === 'playing') && <div className="rw-composer-wrap"><form className="rw-composer" onSubmit={e => { e.preventDefault(); ask(activeDraft) }}><div className="rw-context">{nativeResearchText(language, 'composerContext', { label: titleOf(active) })}</div><textarea ref={composer} aria-label={`${titleOf(active)}에 질문`} placeholder={c('placeholder')} rows={1} value={activeDraft} onChange={e => setState(old => ({ ...old, drafts: { ...old.drafts, [active]: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(activeDraft) } }} /><button aria-label="문서 질문 보내기" type="submit" disabled={!activeDraft.trim()}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg></button></form></div>}</section><aside ref={auxPanel} className={`rw-aux${auxOpen ? ' is-open' : ''}`} aria-label={labelOf('Artifacts')}><div className="rw-aux-heading">{labelOf('Artifacts')}<button className="rw-mobile-artifacts g-btn-t" aria-label={`${labelOf('Artifacts')} 닫기`} onClick={() => { setAuxOpen(false); auxTrigger.current?.focus({ preventScroll: true }) }}>×</button></div>{available.map(([id, title]) => <button className={`rw-artifact ${active === id ? 'on' : ''}`} key={id} onClick={() => openDoc(id)}><ClientIcon name="document" size={14} /><span>{labelOf(title)}</span>{id === 'report' && <small className="warn">검토 필요</small>}</button>)}{registered && <button className={`rw-artifact ${active === 'live' ? 'on' : ''}`} onClick={() => openDoc('live')}><ClientIcon name="document" size={14} /><span>Live</span><small>Paper</small></button>}<div className="rw-aux-heading rw-team-heading">{labelOf('Research Team')}</div>{previewTeam(elapsed).map(member => <div className="rw-team" key={member.name}><span>{labelOf(member.name)}</span><small>{member.status === '작업 중' && <i className="g-dot run" />}{member.status === '완료' && <i className="g-dot ok" />}{member.status}</small></div>)}</aside></div>{displayNotice && <div className="rw-notice" role="status"><span>{displayNotice}</span><button aria-label="안내 닫기" onClick={() => { setNotice(''); setStorageWarningDismissed(true) }}>×</button></div>}{import.meta.env.DEV && new URLSearchParams(window.location.search).get('ui-debug') === '1' && <details className="rw-preview-tools"><summary>개발 미리보기 · 샘플 데이터</summary><p>클라이언트 원본의 고정 예시로 화면을 검수합니다. 입력한 아이디어의 실제 검증 결과가 아니며 AI·백테스트·연결·주문을 실행하지 않습니다. 조건 편집은 메모에만 반영되며 예시 수치는 바뀌지 않습니다.</p><p>선택한 계획: {planPair} · {planTimeframe} · {isTrend ? '추세 추종' : '하락 후 반등'} · 손절 {planRisk} · 익절 {planTake}<br />고정 원본 재생 사례: BTC/USDT · 1일봉 · RSI 40 반등 · 손절 −3% · 익절 +8%. Activity·Strategy·Backtest 이후의 수치는 이 고정 사례입니다.</p>{replay.status !== 'idle' && <div><span>{Math.floor(elapsed)}초 / 95초</span>{replay.status === 'playing' ? <button onClick={store.pause}>일시 정지</button> : replay.status === 'paused' ? <button onClick={store.resume}>계속 재생</button> : null}{replay.status !== 'completed' && <button onClick={store.finish}>샘플 재생 완료</button>}</div>}</details>}</div>
}
