import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, FileText, Pencil, Square } from 'lucide-react'
import '../client-conversation.css'
import { ClientResearchActivity } from './ClientResearchActivity'
import type { ResearchDocumentView } from '../mock-research-preview'
import { ClientIcon } from './ClientIcon'
import type { ConversationViewport } from '../client-experience-store'

type ConversationProps = {
  children: ReactNode
  artifact?: ReactNode
  notice?: ReactNode
  previewTools?: ReactNode
  value: string
  onChange: (value: string) => void
  onSend: () => void
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
  onTitleChange?: (title: string) => void
  headerActions?: ReactNode
  initialViewport?: ConversationViewport
  onViewportChange?: (view: ConversationViewport) => void
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
}

export function ClientUserMessage({ children, onEdit, editDisabled = false }: { children: string; onEdit: (text: string) => void; editDisabled?: boolean }) {
  const [copyState, setCopyState] = useState('')
  const copyAttempt = useRef(0)
  return <div className="g-urow">
    <div className="g-uacts">
      <button type="button" aria-label="메시지 수정" disabled={editDisabled} onClick={() => { if (!editDisabled) onEdit(children) }}><Pencil size={13} /></button>
      <button type="button" aria-label={copyState === 'copied' ? '메시지 복사 완료' : '메시지 복사'} onClick={async () => {
        const attempt = ++copyAttempt.current
        try { await navigator.clipboard.writeText(children); if (attempt === copyAttempt.current) setCopyState('copied') }
        catch { if (attempt === copyAttempt.current) setCopyState('error') }
      }}>{copyState === 'copied' ? <Check size={13} /> : <Copy size={13} />}</button>
    </div>
    <div className="g-umsg">{children}</div>
    {copyState === 'error' && <span className="g-copy-error" role="status">복사 권한을 확인해주세요.</span>}
  </div>
}

export function ClientThinking() {
  const [startedAt] = useState(() => Date.now())
  return <div aria-label="TETH가 생각 중입니다" role="status" aria-live="off">
    <ClientResearchActivity label="생각을 정리하는 중" status="running" startedAt={startedAt} source="mock"
      steps={[{ id: 'prepare', title: '생각하는 중', status: 'running' }]} />
  </div>
}

/** React rendering of tesia-lab acccc7f's g-center/g-doc/g-composer/g-aux.
 * Domain data and actions stay in the caller; no client demo proxy or auth is imported.
 */
export function ClientConversation({ children, artifact, notice, previewTools, value, onChange, onSend, onStop, busy, canStop = true, inputDisabled = false, maxLength, inputLabel, sendLabel, titleLabel, context, activityKey, initialTitle = '새 전략', onTitleChange, headerActions, workspace, initialViewport, onViewportChange }: ConversationProps) {
  const [tab, setTab] = useState<'chat' | 'plan'>('chat')
  const [localTitle, setTitle] = useState(initialTitle)
  const title = onTitleChange ? initialTitle : localTitle
  const [editingTitle, setEditingTitle] = useState(false)
  const [unread, setUnread] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const titleTrigger = useRef<HTMLButtonElement>(null)
  const returnTitleFocus = useRef(false)
  const [restoredViewport] = useState(initialViewport)
  const viewportCallback = useRef(onViewportChange)
  const lastActivity = useRef(activityKey)
  const followRef = useRef(true)
  const lastQuestion = useRef('')
  const spacerRef = useRef<HTMLDivElement>(null)
  const activeTab = workspace?.view ?? (artifact ? tab : 'chat')
  const documentScrollPositions = useRef<Partial<Record<ResearchDocumentView, number>>>({})

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const savedTop = documentScrollPositions.current[activeTab]
    el.scrollTop = savedTop ?? 0
    // Restore the destination's follow state, not the previous short document's.
    const spacer = spacerRef.current
    const bottom = activeTab === 'chat' && spacer ? spacer.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : el.scrollHeight
    followRef.current = savedTop === undefined || bottom - el.scrollTop - el.clientHeight < 140
  }, [activeTab])

  useLayoutEffect(() => { viewportCallback.current = onViewportChange }, [onViewportChange])
  useLayoutEffect(() => {
    const el = scrollRef.current, spacer = spacerRef.current
    if (!el || !spacer) return
    if (restoredViewport) {
      spacer.style.height = `${restoredViewport.spacer}px`
      el.scrollTop = restoredViewport.top
      followRef.current = restoredViewport.follow
      lastQuestion.current = restoredViewport.questionKey
    }
    const capture = () => viewportCallback.current?.({ top: el.scrollTop, spacer: spacer.getBoundingClientRect().height, follow: followRef.current, questionKey: lastQuestion.current })
    window.addEventListener('pagehide', capture)
    return () => { capture(); window.removeEventListener('pagehide', capture) }
  }, [restoredViewport])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    let frame = 0
    let disposed = false
    const resize = () => {
      if (disposed) return
      input.style.height = '30px'
      input.style.height = `${Math.min(120, Math.max(30, input.scrollHeight))}px`
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
  }, [value])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    const observer = new ResizeObserver(() => {
      composer.parentElement?.style.setProperty('--g-composer-height', `${composer.getBoundingClientRect().height}px`)
    })
    observer.observe(composer)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const spacer = spacerRef.current
    if (!scroll || !spacer || activeTab !== 'chat') return
    const rows = scroll.querySelectorAll<HTMLElement>('.g-urow')
    const question = rows.item(rows.length - 1)
    const questionKey = `${rows.length}:${question?.querySelector('.g-umsg')?.textContent || ''}`
    if (question && questionKey !== lastQuestion.current) {
      lastQuestion.current = questionKey
      spacer.style.height = `${Math.max(0, scroll.clientHeight - 170)}px`
      scroll.scrollTop += question.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20
      followRef.current = true
      setUnread(false)
    }
    // Track actual content, not the blank area retained below the last question.
    const contentBottom = spacer.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop
    if (followRef.current) {
      if (contentBottom > scroll.scrollTop + scroll.clientHeight - 20) scroll.scrollTop = Math.max(0, contentBottom - scroll.clientHeight + 20)
    } else if (lastActivity.current !== activityKey) setUnread(true)
    lastActivity.current = activityKey
    if (!busy) {
      const currentHeight = spacer.getBoundingClientRect().height
      const contentHeight = scroll.scrollHeight - currentHeight
      spacer.style.height = `${Math.max(0, scroll.scrollTop + scroll.clientHeight - contentHeight)}px`
    }
  }, [activityKey, busy, activeTab])

  useEffect(() => {
    if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select() }
    else if (returnTitleFocus.current) { titleTrigger.current?.focus(); returnTitleFocus.current = false }
  }, [editingTitle])

  useLayoutEffect(() => {
    if (activeTab === 'activity' && followRef.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [activeTab, activityKey])

  const changeTab = (next: ResearchDocumentView) => {
    if (next === activeTab) return
    documentScrollPositions.current[activeTab] = scrollRef.current?.scrollTop || 0
    if (workspace) workspace.onViewChange(next)
    else if (next === 'chat' || next === 'plan') setTab(next)
  }

  return <div className="client-conversation-frame"><div className={`client-lab-conversation${workspace?.started ? ' has-research-workspace' : ''}`}>
    <section className="g-center" aria-label="TETH AI 대화">
      <header className="g-chead">
        {editingTitle ? <input ref={titleRef} className="g-title-input" aria-label="대화 제목 수정" defaultValue={title} maxLength={120}
          onBlur={(event) => { const next = event.target.value.trim() || '새 전략'; setTitle(next); onTitleChange?.(next); setEditingTitle(false) }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter') { event.preventDefault(); returnTitleFocus.current = true; event.currentTarget.blur() }
            if (event.key === 'Escape') { event.preventDefault(); returnTitleFocus.current = true; event.currentTarget.value = title; event.currentTarget.blur() }
          }} /> : <h1 aria-label={titleLabel}><button ref={titleTrigger} className="g-title" type="button" title={title} aria-label="대화 제목 수정" onClick={() => setEditingTitle(true)}><span>{title}</span><Pencil size={12} /></button></h1>}
        {context && <span className="sub">{context}</span>}
        <nav className="g-tabs" aria-label="대화 문서">
          <button className={`g-tab ${activeTab === 'chat' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'chat'} onClick={() => changeTab('chat')}>대화</button>
          {artifact && <button className={`g-tab ${activeTab === 'plan' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'plan'} onClick={() => changeTab('plan')}>Research Plan</button>}
          {workspace?.started && <button className={`g-tab ${activeTab === 'activity' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'activity'} onClick={() => changeTab('activity')}>Activity</button>}
          {workspace?.critic && <button className={`g-tab ${activeTab === 'critic' ? 'on' : ''}`} type="button" aria-pressed={activeTab === 'critic'} onClick={() => changeTab('critic')}>Critic Review</button>}
        </nav>
        {workspace?.started && activeTab === 'activity' && workspace.status === 'running' && <span className="g-tag g-research-status"><span className="g-dot run" aria-hidden="true" />연구 진행 중</span>}
        {!previewTools && <span className="g-demo">Mock</span>}
        {headerActions}
      </header>
      <div className="g-scroll" ref={scrollRef} onScroll={() => {
        const el = scrollRef.current
        if (!el) return
        documentScrollPositions.current[activeTab] = el.scrollTop
        const spacer = spacerRef.current
        const contentBottom = activeTab === 'chat' && spacer ? spacer.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : el.scrollHeight
        followRef.current = contentBottom - el.scrollTop - el.clientHeight < 140
        if (activeTab === 'chat') viewportCallback.current?.({ top: el.scrollTop, spacer: spacer?.getBoundingClientRect().height ?? 0, follow: followRef.current, questionKey: lastQuestion.current })
        if (followRef.current) setUnread(false)
      }}>
        {notice}
        <div className="g-doc" hidden={activeTab !== 'chat'}>
          <div className="g-thread" aria-busy={busy}>{children}<div ref={spacerRef} className="g-spacer" aria-hidden="true" /></div>
        </div>
        {artifact && <div className="g-doc g-plan" hidden={activeTab !== 'plan'}>{artifact}{activeTab === 'plan' && workspace?.replies}</div>}
        {workspace?.started && <div className="g-doc g-adoc" hidden={activeTab !== 'activity'}>{workspace.activity}{activeTab === 'activity' && workspace.replies}</div>}
        {workspace?.critic && <div className="g-doc g-adoc" hidden={activeTab !== 'critic'}>{workspace.critic}{activeTab === 'critic' && workspace.replies}</div>}
      </div>
      {unread && activeTab === 'chat' && <button className="g-newmsg" type="button" onClick={() => {
        const el = scrollRef.current
        if (el && spacerRef.current) {
          const contentBottom = spacerRef.current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
          el.scrollTop = Math.max(0, contentBottom - el.clientHeight + 24)
        }
        followRef.current = true
        setUnread(false)
      }}><ArrowDown size={13} />새 응답</button>}
      <div className="g-composer-wrap" ref={composerRef} hidden={activeTab === 'activity' && workspace?.status === 'running'}>
        <div className="g-composer">
          {activeTab !== 'chat' && <span className="g-ctx"><FileText size={12} />{activeTab === 'plan' ? 'Research Plan' : activeTab === 'activity' ? 'Activity' : 'Critic Review'}</span>}
          <textarea ref={inputRef} value={value} aria-label={inputLabel} placeholder="시장에 대해 무엇이든 물어보세요" rows={1} disabled={inputDisabled} maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (!busy && !inputDisabled && value.trim()) {
                  if (workspace && activeTab !== 'chat') workspace.onAsk(value)
                  else { changeTab('chat'); onSend() }
                }
              }
            }} />
          <div className="g-composer-row"><span className="g-model" /><button className="g-send" type="button" aria-label={busy ? canStop ? '응답 중지' : '응답 기다리는 중' : sendLabel} disabled={busy ? !canStop : inputDisabled || !value.trim()} onClick={() => {
            if (busy && canStop) onStop()
            else if (workspace && activeTab !== 'chat') workspace.onAsk(value)
            else { changeTab('chat'); onSend() }
          }}>{busy && canStop ? <Square size={11} fill="currentColor" /> : <ArrowUp size={17} />}</button></div>
        </div>
      </div>
    </section>
    {artifact && <aside className="g-aux" aria-label="Artifacts">
      <h2 className="g-sec">Artifacts</h2>
      <button className={`g-art ${activeTab === 'plan' ? 'on' : ''}`} type="button" aria-label="Research Plan 문서 열기" onClick={() => changeTab('plan')}><ClientIcon name="document" size={14} /><span className="t">Research Plan</span></button>
      {workspace?.critic && <button className={`g-art ${activeTab === 'critic' ? 'on' : ''}`} type="button" aria-label="Critic Review 문서 열기" onClick={() => changeTab('critic')}><ClientIcon name="document" size={14} /><span className="t">Critic Review</span></button>}
      <h2 className="g-sec">Research Team</h2>
      {workspace?.team.map(member => <div className="g-team-row" key={member.name}><span>{member.name}</span><span className="st">{(member.status === '작업 중' || member.status === '완료') && <span className={`g-dot ${member.status === '완료' ? 'ok' : 'run'}`} aria-hidden="true" />}{member.status}</span></div>)}
    </aside>}
  </div>{previewTools}</div>
}
