import { Fragment, lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, Copy, MoreHorizontal, Terminal, ThumbsDown, ThumbsUp } from 'lucide-react'
import { ClientChrome, ClientLogo } from './ClientChrome'
import { ClientComposer } from './ClientComposer'
import { ClientConversation, ClientUserMessage } from './ClientConversation'
import { ClientResearchActivity } from './ClientResearchActivity'
import { ClientLocalePanel } from './ClientLocalePanel'
import { ClientAuthDialog, ClientFeedbackDialog, ClientProfileMenu, ClientSettingsMenu, type ClientProfile } from './ClientAccountUI'
import { ClientResearchWorkspace } from './ClientResearchWorkspace'
import { ClientDelegationWorkspace } from './ClientDelegationWorkspace'
import { ClientResearchHub } from './ClientResearchHub'
import { InternalLink } from './InternalLink'
import { ClientLoadBoundary, ClientLoadFallback } from './ClientLoadBoundary'
import { ConversationCosmos } from './ConversationCosmos'
import { TethAskForm } from './TethAskForm'
import { TethThinkNode } from './TethThinkNode'
import { TethProbability } from './TethProbability'
import { TethRichText } from './TethRichText'
import { TethWorkBlock } from './TethWorkBlock'
import { workBlockFromFlowSegment } from '../teth-work-block'
import { resolveDemoMode } from '../teth-model-routing'
import { clientCopy, useClientPreferences } from '../client-preferences'
import { createClientExperienceStore, type ClientTurn } from '../client-experience-store'
import '../teth-followup.css'
import { resolveAiProxyOrigin } from '../teth-ai-client'
import { abortAiTurns, startAiTurn } from '../teth-ai-controller'
import { TETH_SYSTEM_PROMPT } from '../prompts/teth-system'
import { getSitePage } from '../site-navigation'
import type { ResearchPage, ResearchRecord } from '../research-library'
import { CLIENT_RESEARCH_FIXTURE } from '../client-research-fixtures'
import '../client-main-experience.css'

const ClientHelp = lazy(() => import('./ClientPublicPages').then(module => ({ default: module.SiteHelp })))

function AnswerActions({ text }: { text: string }) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const copyAttempt = useRef(0)
  return <div className="client-answer-actions">
    <button type="button" aria-label="좋은 답변" aria-pressed={vote === 'up'} onClick={() => setVote(vote === 'up' ? null : 'up')}><ThumbsUp size={15} /></button>
    <button type="button" aria-label="아쉬운 답변" aria-pressed={vote === 'down'} onClick={() => setVote(vote === 'down' ? null : 'down')}><ThumbsDown size={15} /></button>
    <button type="button" aria-label={copied ? '답변 복사 완료' : '답변 복사'} onClick={async () => { const attempt = ++copyAttempt.current; try { await navigator.clipboard.writeText(text); if (attempt !== copyAttempt.current) return; setCopied(true); setError('') } catch { if (attempt !== copyAttempt.current) return; setCopied(false); setError('복사 권한을 확인해주세요.') } }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
    {error && <span role="status">{error}</span>}
  </div>
}

function AiAnswerBody({ turn }: { turn: ClientTurn }) {
  const caret = <span className={turn.status === 'running' ? 'client-stream-caret' : ''} aria-hidden="true" />
  if (!turn.prob) return <div className="g-amsg"><p>{turn.answer}{caret}</p></div>
  // 확률 게이지는 모델이 <prob/> 를 배치한 지점(offset)에 맞춰 본문을 가른다.
  // 단 줄 경계가 아닌 문장 한가운데라면 문장을 찢지 않고 답변 끝에 붙인다.
  const { offset } = turn.prob
  const boundary = offset === 0 || offset >= turn.answer.length || turn.answer[offset - 1] === '\n' || turn.answer[offset] === '\n'
  if (!boundary) return <div className="g-amsg"><p>{turn.answer}{caret}</p><TethProbability up={turn.prob.up} down={turn.prob.down} /></div>
  const before = turn.answer.slice(0, offset).trimEnd()
  const after = turn.answer.slice(offset).replace(/^\n+/, '')
  return <div className="g-amsg">
    {before && <p>{before}</p>}
    <TethProbability up={turn.prob.up} down={turn.prob.down} />
    {(after || turn.status === 'running') && <p>{after}{caret}</p>}
  </div>
}

/* 스트리밍 꼬리 로더 — "작업 중… · Ns" 셔머 + 2점 바운스 (Genspark 실측 연출). */
function AiTailLoader({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return <div className="teth-tail-loader" role="status" aria-label="응답 생성 중">
    <span className="ttl-text">작업 중…{seconds >= 3 && <span className="ttl-sec"> · {seconds}s</span>}</span>
    <span className="ttl-dots" aria-hidden="true"><i /><i /></span>
  </div>
}

/* say/prob 는 본문 순서대로, work 는 인라인 WorkBlock 카드(릴레이 핸드오프)로 렌더한다.
 * 진행 중 work 가 접히면서 다음 say 가 이어지는 리듬이 데이터(flow 순서)에서 나온다. */
function AiFlowBody({ turn, onAsk }: { turn: ClientTurn; onAsk: (segmentId: string, answers: string[]) => void }) {
  const [demoMode] = useState(resolveDemoMode)
  const running = turn.status === 'running'
  const flow = turn.flow ?? []
  const lastSay = [...flow].reverse().find(segment => segment.kind === 'say')
  return <Fragment>
    {flow.map(segment => {
      if (segment.kind === 'prob') return <div className="g-amsg" key={segment.id}><TethProbability up={segment.up} down={segment.down} /></div>
      if (segment.kind === 'work') return <TethWorkBlock key={segment.id} block={workBlockFromFlowSegment(segment)} demoMode={demoMode} />
      if (segment.kind === 'ask') return <TethAskForm key={segment.id} questions={segment.questions} answers={segment.answers} onSubmit={answers => onAsk(segment.id, answers)} />
      if (segment.kind === 'think') return <TethThinkNode key={segment.id} text={segment.text} status={segment.status} seconds={segment.seconds} />
      if (segment.kind === 'tool') return <div className="teth-toolchip" key={segment.id}><Terminal size={13} aria-hidden="true" /><span className="ttc-label">{segment.label}</span>{typeof segment.count === 'number' && segment.count > 1 && <span className="ttc-count">{segment.count}회</span>}</div>
      const isLast = segment.id === lastSay?.id
      if (!segment.text.trim() && !(running && isLast)) return null
      return <div className="g-amsg" key={segment.id}><TethRichText text={segment.text} caret={running && isLast} /></div>
    })}
    {running && <AiTailLoader startedAt={turn.startedAt} />}
  </Fragment>
}

function AiConversationTurn({ turn, onEdit, onAsk }: { turn: ClientTurn; onEdit: (text: string) => void; onAsk: (segmentId: string, answers: string[]) => void }) {
  const running = turn.status === 'running'
  // flow 턴 = 단일 스트림: 사고(think 세그먼트)·툴 칩·work·say 전부 본문에 시간순
  // 인라인 — 위쪽에서 자라는 패널이 없다. running 인데 flow 가 아직 없으면(첫 이벤트
  // 대기) 꼬리 로더만 보인다. 상단 패널은 flow 없는 완결 구 스냅샷 폴백 전용.
  if (turn.flow || running) {
    return <Fragment>
      <ClientUserMessage onEdit={onEdit}>{turn.question}</ClientUserMessage>
      <AiFlowBody turn={turn} onAsk={onAsk} />
      {turn.status === 'done' && <AnswerActions text={turn.answer} />}
      {turn.status === 'stopped' && <p className="client-stopped" role="status">응답이 중지되었습니다.</p>}
    </Fragment>
  }
  const activityStatus = running ? 'running' as const : turn.status === 'stopped' ? 'stopped' as const : 'done' as const
  const workSteps = turn.trace ?? []
  const started = Boolean(turn.answer || workSteps.length)
  const thinkingStep = {
    id: 'thinking',
    title: running && !started ? '생각하는 중' : 'TETH의 생각',
    status: running ? 'running' as const : activityStatus === 'stopped' && !turn.answer ? 'stopped' as const : 'done' as const,
    detail: turn.thinking || undefined,
  }
  return <Fragment>
    <ClientUserMessage onEdit={onEdit}>{turn.question}</ClientUserMessage>
    <ClientResearchActivity label={running ? 'TETH의 생각 보기' : turn.status === 'stopped' ? '작업 중단' : `작업 완료 · ${1 + workSteps.length}단계`} status={activityStatus}
      source="service" startedAt={turn.startedAt} finishedAt={turn.finishedAt}
      steps={[thinkingStep, ...workSteps]} />
    {(turn.answer || turn.prob) && <AiAnswerBody turn={turn} />}
    {turn.status === 'done' && <AnswerActions text={turn.answer} />}
    {turn.status === 'stopped' && <p className="client-stopped" role="status">응답이 중지되었습니다.</p>}
  </Fragment>
}

function ConversationTurn({ turn, onEdit, onAsk }: { turn: ClientTurn; onEdit: (text: string) => void; onAsk: (segmentId: string, answers: string[]) => void }) {
  if (turn.source === 'ai') return <AiConversationTurn turn={turn} onEdit={onEdit} onAsk={onAsk} />
  const thinking = turn.status === 'running' && !turn.answer
  const status = thinking ? 'running' : turn.status === 'stopped' ? 'stopped' : 'done'
  return <Fragment>
    <ClientUserMessage onEdit={onEdit}>{turn.question}</ClientUserMessage>
    <ClientResearchActivity label={thinking ? '생각을 정리하는 중' : turn.status === 'stopped' ? '작업 중단, 1단계' : '작업 완료, 1단계'} status={status}
      source="mock" startedAt={turn.startedAt} finishedAt={turn.finishedAt ?? (thinking ? undefined : turn.startedAt + 1800)}
      steps={[{ id: 'thinking', title: thinking ? '생각하는 중' : '생각 완료', status, detail: '아이디어 확인 중\n검증 가능한 조건으로 만들기 위해 몇 가지를 확인합니다.' }]} />
    {turn.answer && <div className="g-amsg"><p>{turn.answer}<span className={turn.status === 'running' ? 'client-stream-caret' : ''} aria-hidden="true" /></p></div>}
    {turn.status === 'done' && <AnswerActions text={turn.answer} />}
    {turn.status === 'stopped' && <p className="client-stopped" role="status">응답이 중지되었습니다.</p>}
  </Fragment>
}

function SessionMenu({ title, onRename, onDelete }: { title: string; onRename: (text: string) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [armed, setArmed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const click = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const navigate = () => setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (!ref.current?.contains(e.target as Node)) return
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus() }
      if (!renaming && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('.client-session-pop button') ?? [])
        if (!items.length) return
        e.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key)
    window.addEventListener('popstate', navigate); window.addEventListener('teth:navigate', navigate); window.addEventListener('hashchange', navigate)
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); window.removeEventListener('popstate', navigate); window.removeEventListener('teth:navigate', navigate); window.removeEventListener('hashchange', navigate) }
  }, [open, renaming])
  useEffect(() => { if (open && !renaming) ref.current?.querySelector<HTMLButtonElement>('.client-session-pop button')?.focus() }, [open, renaming])
  useEffect(() => { if (renaming) { input.current?.focus(); input.current?.select() } }, [renaming])
  return <div className="client-session-options" ref={ref}>
    <button ref={trigger} type="button" aria-label="대화 메뉴" aria-expanded={open} onClick={() => { setOpen(!open); setArmed(false); setRenaming(false) }}><MoreHorizontal size={18} /></button>
    {open && <div className="client-session-pop" aria-label="대화 관리">{renaming ? <form onSubmit={e => { e.preventDefault(); const value = input.current?.value.trim(); if (value) { onRename(value); setOpen(false); trigger.current?.focus() } }}><input ref={input} defaultValue={title} maxLength={120} aria-label="전략 이름" /><button type="submit">저장</button></form> : <><button type="button" onClick={() => setRenaming(true)}>이름 변경</button><button className="danger" type="button" onClick={() => { if (armed) { onDelete(); setOpen(false) } else setArmed(true) }}>{armed ? '정말 삭제할까요? 되돌릴 수 없어요' : '삭제'}</button></>}</div>}
  </div>
}

/** Source-first entry point. The older funnel is NOT rendered in this shell.
 * UI preview adapters remain isolated from approved service/execution contracts.
 */
export function ClientMainExperience() {
  const { language, t } = useClientPreferences()
  const [store] = useState(createClientExperienceStore)
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const session = state.sessions.find(s => s.id === state.currentId)
  const [profile, setProfile] = useState<ClientProfile | null>(() => {
    try { const saved = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') || 'null'); return saved && typeof saved.name === 'string' && typeof saved.email === 'string' ? saved : null } catch { return null }
  })
  const [surface, setSurface] = useState<'settings' | 'locale' | 'feedback' | 'profile' | 'help' | null>(null)
  const [auth, setAuth] = useState<'login' | 'signup' | null>(null)
  const [authReturnToComposer, setAuthReturnToComposer] = useState(false)
  const [page, setPage] = useState<ResearchPage | null>(null)
  const [greetingSeed] = useState(() => Math.random())
  const input = useRef<HTMLTextAreaElement>(null)
  const [composerHeight, setComposerHeight] = useState(58)
  const [compactHome, setCompactHome] = useState(false)
  const [notice, setNotice] = useState('')
  const [storageNoticeDismissed, setStorageNoticeDismissed] = useState(false)
  // Dismissal belongs to the current failure, not every future storage outage.
  if (!state.storageError && storageNoticeDismissed) setStorageNoticeDismissed(false)
  const greetings = language === 'ko' ? clientCopy.GREETS : clientCopy.GREETS_ALL[language]
  const greeting = greetings[Math.floor(greetingSeed * greetings.length)]
  const isHome = !session && !page
  const busy = Boolean(session?.turns.some(t => t.status === 'running'))
  // AI 턴은 스트림이 직접 스토어를 갱신한다 — 65ms tick 은 mock 리빌 전용이므로
  // AI 턴만 돌고 있을 때 무의미한 고빈도 인터벌을 만들지 않는다.
  const hasTurns = state.sessions.some(s => s.turns.some(t => t.status === 'running' && t.source !== 'ai'))
  const hasJobs = hasTurns || state.sessions.some(s => s.researchStatus === '진행 중')
  const value = session?.draft ?? state.homeDraft
  const latest = session?.turns.at(-1)
  const records: ResearchRecord[] = state.sessions.map(s => ({ id: s.id, title: s.title, market: s.pair, status: s.paper ? 'Paper 실행 중' : s.researchStatus, live: s.paper || s.tradingReady, updatedAt: s.updatedAt, snapshot: s }))
  useEffect(() => {
    if (!isHome) return
    const content = document.querySelector<HTMLElement>('.client-source-app .client-home-content')
    if (!content) return
    const elements = ['.client-hero-logo', '.client-hero-title', '.client-hero-subtitle', '.client-home-pill', '.client-chip-stack', '.client-home-terms'].map(selector => content.querySelector<HTMLElement>(selector)).filter((element): element is HTMLElement => Boolean(element))
    let frame = 0
    const measure = () => {
      const heights = elements.map(element => element.getBoundingClientRect().height)
      const terms = elements.at(-1)
      const style = terms ? getComputedStyle(terms) : null
      const margins = style ? parseFloat(style.marginTop) + parseFloat(style.marginBottom) : 0
      content.style.setProperty('--client-terms-height', `${(heights.at(-1) ?? 40) + margins + 28}px`)
      setCompactHome(innerWidth <= 860 && heights.reduce((sum, height) => sum + height, 0) + margins + 248 > innerHeight)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    elements.forEach(element => observer.observe(element))
    window.addEventListener('resize', schedule)
    schedule()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', schedule) }
  }, [isHome])
  useEffect(() => {
    if (!hasJobs) return
    let timer: number | undefined
    const sync = () => { window.clearInterval(timer); if (!document.hidden) { store.tick(Date.now()); timer = window.setInterval(() => store.tick(Date.now()), hasTurns ? 65 : 1000) } }
    sync(); document.addEventListener('visibilitychange', sync); window.addEventListener('pageshow', sync)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync) }
  }, [hasJobs, hasTurns, store])
  useEffect(() => { const flush = () => store.flush(); window.addEventListener('pagehide', flush); return () => { window.removeEventListener('pagehide', flush); store.flush() } }, [store])
  useEffect(() => {
    // Keep the conversation mounted on public pages, but never its modal portals.
    const closeOverlays = () => { if (getSitePage()) { setAuth(null); setSurface(null) } }
    window.addEventListener('popstate', closeOverlays)
    window.addEventListener('teth:navigate', closeOverlays)
    return () => { window.removeEventListener('popstate', closeOverlays); window.removeEventListener('teth:navigate', closeOverlays) }
  }, [])
  useEffect(() => { if (isHome && matchMedia('(min-width: 861px)').matches) input.current?.focus({ preventScroll: true }) }, [isHome])
  useEffect(() => { if (!isHome) document.querySelector<HTMLElement>('.client-source-main')?.focus({ preventScroll: true }) }, [isHome, page, session?.id, session?.workspace])
  useEffect(() => {
    if (!auth && (!surface || surface === 'locale')) return
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    const overflow = document.body.style.overflow
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    return () => { if (root) root.inert = wasInert; document.body.style.overflow = overflow }
  }, [auth, surface])
  const home = () => { setPage(null); store.home(); setNotice('') }
  const openAuth = (mode: 'login' | 'signup', fromComposer = false) => { setAuthReturnToComposer(fromComposer); setAuth(mode) }
  const send = (text = value) => {
    if (!text.trim()) return
    setPage(null)
    // 실 AI는 명시 설정이 있을 때만 켜진다. 미설정·요청 실패는 스크립트 응답으로 폴백.
    const aiOrigin = resolveAiProxyOrigin()
    const started = store.send(text, { ai: Boolean(aiOrigin) })
    if (started && aiOrigin) startAiTurn({ origin: aiOrigin, system: TETH_SYSTEM_PROMPT, store, ...started })
  }
  const workspace = (next: 'research' | 'delegation') => { if (session) store.workspace(session.id, next) }
  const backToChat = () => { if (session) store.workspace(session.id, 'conversation') }
  const changeProfile = (next: ClientProfile | null) => {
    setProfile(next)
    try { if (next) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: next.name, email: next.email })); else sessionStorage.removeItem('teth-client-profile-preview') }
    catch { setNotice('계정 미리보기 상태를 이 탭에 저장하지 못했습니다.') }
  }
  return <div className={`tesia-shell conversation-surface client-source-app ${isHome ? 'view-landing' : 'view-briefing'}`}>
    <a className="skip-link" href="#tesia-main">본문으로 건너뛰기</a>
    <ClientChrome signedIn={Boolean(profile)} profileName={profile?.name} onHome={home} onLogin={() => openAuth('login')} onSignup={() => openAuth('signup')}
      onSettings={() => setSurface('settings')} onLocale={() => setSurface('locale')} onDashboard={() => setPage('history')} onProfile={() => setSurface('profile')}
      researchPage={page} records={records} activeResearchId={session?.id} onResearchPage={setPage} onSelectResearch={id => { setPage(null); store.select(id) }}
      onTrading={state.sessions.some(s => s.tradingReady) ? () => { const live = session?.tradingReady ? session : state.sessions.find(s => s.tradingReady)!; store.select(live.id); store.workspace(live.id, 'delegation'); setPage(null) } : undefined} />
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {page ? <ClientResearchHub page={page} records={records} onSelect={id => { store.select(id); setPage(null) }} onNew={home} onReturn={() => setPage(null)}
        onFollow={text => { home(); store.draft(text) }} shareable={state.sessions.some(s => s.researchStatus === '검토 필요') ? { id: state.sessions.find(s => s.researchStatus === '검토 필요')!.id, title: state.sessions.find(s => s.researchStatus === '검토 필요')!.title, returnRate: CLIENT_RESEARCH_FIXTURE.versions[1].ret } : undefined} externalBoundary /> : isHome ? <div className="landing-main"><section className="landing-hero" aria-labelledby="landing-title">
        <ConversationCosmos />
        <div className={`client-home-content ${value.trim() ? 'has-input' : ''} ${compactHome ? 'is-compact-home' : ''}`} style={{ '--client-composer-height': `${composerHeight}px` } as CSSProperties}>
          <span className="client-hero-logo" aria-hidden="true"><ClientLogo /></span>
          <h1 className="client-hero-title" id="landing-title">{greeting.h.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h1>
          <p className="client-hero-subtitle">{greeting.s}</p>
          <ClientComposer value={value} inputRef={input} disabled={false} onChange={store.draft} onSend={() => send()} onLogin={() => openAuth('login', true)} onHeightChange={setComposerHeight} />
          <div className="client-chip-stack"><div className="client-home-chips" aria-label="시작 아이디어" inert={Boolean(value.trim())}>{(['chip.1','chip.2','chip.3'] as const).map(key => <button key={key} type="button" onClick={() => send(t(key))}>{t(key)}</button>)}</div>
            {!profile && <div className="client-free-row" inert={!value.trim()}><button type="button" onClick={() => openAuth('signup')}><span>{t('auth.free')}</span></button></div>}
          </div>
          <p className="client-home-terms">{t('home.terms').split(/(\{[TP]\}.*?\{\/\})/g).map((part, i) => { const link = part.match(/^\{([TP])\}(.*?)\{\/\}$/); return link ? <InternalLink key={i} href={`/policies/#${link[1] === 'T' ? 'terms' : 'privacy'}`}>{link[2]}</InternalLink> : <Fragment key={i}>{part}</Fragment> })}</p>
        </div>
      </section></div> : session?.workspace === 'research' ? <ClientResearchWorkspace key={session.id} sessionId={session.id} idea={session.idea} planContext={session} onStatusChange={status => store.researchStatus(session.id, status)} onPaperChange={paper => store.paper(session.id, paper)} onBack={backToChat} onDelegate={() => workspace('delegation')} />
      : session?.workspace === 'delegation' ? <ClientDelegationWorkspace key={session.id} sessionId={session.id} idea={session.idea} onBack={backToChat} onTradingReady={() => store.tradingReady(session.id)} onShowRanking={() => setPage('ranking')} initialPage={session.tradingReady ? 'trading' : undefined} />
      : session ? <ClientConversation key={session.id} value={value} onChange={store.draft} onSend={() => send()} onStop={() => { abortAiTurns(session.id); store.stop(session.id) }} busy={busy}
        initialViewport={store.conversationViewport(session.id)} onViewportChange={view => store.saveConversationViewport(session.id, view)}
        inputLabel="TETH에게 물어보세요" sendLabel="메시지 보내기" titleLabel="대화 제목" initialTitle={session.title} onTitleChange={title => store.rename(session.id, title)}
        activityKey={`${session.turns.length}:${latest?.answer.length}:${latest?.status}:${latest?.thinking?.length ?? 0}:${latest?.trace?.length ?? 0}:${latest?.flow?.length ?? 0}`} previewTools={<></>}
        headerActions={<SessionMenu title={session.title} onRename={title => store.rename(session.id, title)} onDelete={() => { abortAiTurns(session.id); const removed = store.remove(session.id); setNotice(removed ? '전략을 삭제했어요' : '목록에서 제거했지만 저장소의 일부 기록을 삭제하지 못했습니다.') }} />}>
        {session.turns.map(turn => <ConversationTurn key={turn.id} turn={turn}
          onEdit={text => { store.draft(text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()) }}
          onAsk={(segmentId, answers) => {
            // 폼 답변 → 기록 → 요약을 다음 user 메시지로 전송해 본 분석 릴레이를 잇는다.
            const askSegment = turn.flow?.find(segment => segment.kind === 'ask' && segment.id === segmentId)
            store.answerAsk(session.id, turn.id, segmentId, answers)
            if (askSegment?.kind === 'ask') send(askSegment.questions.map((question, questionIndex) => `${question.title} — ${answers[questionIndex]}`).join('\n'))
          }} />)}
        {latest?.status === 'done' && (latest.source === 'ai'
          // 실 AI 턴: 후속 질문 = Genspark 풀폭 로우(스태거 등장), 액션 = 기존 next-actions 디자인.
          ? <>
            {latest.suggestions.length > 0 && <div className="teth-followups">
              {latest.suggestions.map((text, chipIndex) => <button className="teth-followup" style={{ '--tfu-i': chipIndex } as CSSProperties} type="button" key={text} onClick={() => send(text)}><span>{text}</span><ArrowRight className="tfu-arrow" size={14} aria-hidden="true" /></button>)}
            </div>}
            <div className="client-next-actions">{latest.actions && latest.actions.length > 0
              ? latest.actions.map(action => <button type="button" key={`${action.type}:${action.label}`} onClick={() => workspace(action.type === 'backtest' ? 'research' : 'delegation')}>{action.label} <span>{{ backtest: '과거 데이터로 검증 →', alert: '알림 조건 설정 →', delegate: '전략 맡기기 →', auto: '자동 실행 검토 →' }[action.type]}</span></button>)
              : <button type="button" onClick={() => workspace('delegation')}>전략 맡기기 <span>조건을 정하고 검증하기 →</span></button>}</div>
          </>
          : <>{latest.suggestions.length > 0 && <div className="g-chiprow">{latest.suggestions.map(text => <button className="g-qchip" type="button" key={text} onClick={() => send(text)}>{text}</button>)}</div>}
            <div className="client-next-actions">{session.phase === 'plan' && <button type="button" onClick={() => workspace('research')}>Research Plan <span>연구 계획 확인 →</span></button>}<button type="button" onClick={() => workspace('delegation')}>전략 맡기기 <span>조건을 정하고 검증하기 →</span></button></div>
          </>)}
      </ClientConversation> : null}
    </main>
    <aside className="client-development-boundary" aria-label="로컬 검수 환경"><details><summary>로컬 UI 검수 · 서비스 미연결</summary><p>클라이언트 원본 acccc7f 기반 React 화면입니다. 대화는 원본 스크립트, 연구·차트·랭킹·거래는 고정 시각 검수 데이터입니다. 인증·메일·피드백·결제·거래소 연결·주문은 실제 처리되지 않습니다. 실제 비밀번호·API 키·카드 정보를 입력하지 마세요. 원본 첫 전송 인증 시점은 PM 결정 대기이며 현재 비로그인 대화 정책을 유지합니다.</p></details></aside>
    {((state.storageError && !storageNoticeDismissed) || state.recoveryWarning || notice) && <div className="client-global-notice" role="status">{state.storageError && !storageNoticeDismissed ? '이 탭에 변경 내용을 저장하지 못했습니다. 새로고침 전에 내용을 복사해주세요.' : state.recoveryWarning ? '일부 대화 기록을 복원하지 못했습니다. 나머지 대화와 초안은 유지했습니다.' : notice}<button type="button" aria-label="알림 닫기" onClick={() => { setNotice(''); setStorageNoticeDismissed(true); if (state.recoveryWarning) store.dismissRecovery() }}>×</button></div>}
    {surface === 'locale' && <ClientLocalePanel onClose={() => setSurface(null)} />}
    {surface && surface !== 'locale' && createPortal(<div className="client-source-overlays">
      {surface === 'settings' && <ClientSettingsMenu signedIn={Boolean(profile)} onClose={() => setSurface(null)} onLocale={() => setSurface('locale')} onFeedback={() => setSurface('feedback')} onHelp={() => setSurface('help')} onDownload={() => { setSurface(null); history.pushState({}, '', '/download/'); window.dispatchEvent(new Event('teth:navigate')) }} />}
      {surface === 'feedback' && <ClientFeedbackDialog onClose={() => setSurface(null)} />}
      {surface === 'profile' && profile && <ClientProfileMenu profile={profile} onClose={() => setSurface(null)} onLogout={() => { changeProfile(null); setSurface(null); home() }} />}
      {surface === 'help' && <ClientLoadBoundary fallback={<ClientLoadFallback onClose={() => setSurface(null)} />}><Suspense fallback={<ClientLoadFallback loading onClose={() => setSurface(null)} />}><ClientHelp initialOpen onClose={() => setSurface(null)} /></Suspense></ClientLoadBoundary>}
    </div>, document.body)}
    {auth && createPortal(<div className="client-source-overlays"><ClientAuthDialog key={auth} mode={auth} returnFocus={authReturnToComposer ? input : undefined} onClose={() => setAuth(null)} onComplete={next => { changeProfile(next); setAuth(null) }} /></div>, document.body)}
  </div>
}
