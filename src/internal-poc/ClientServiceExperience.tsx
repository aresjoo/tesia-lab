import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import '../styles.css'
import '../funnel-v2.css'
import '../conversation-shell.css'
import '../client-reference.css'
import '../client-workspace.css'
import '../client-main-experience.css'
import '../client-integration.css'
import { ClientChrome, ClientLogo } from '../components/ClientChrome'
import { ClientComposer } from '../components/ClientComposer'
import { ClientConversation, ClientUserMessage } from '../components/ClientConversation'
import { ClientResearchActivity } from '../components/ClientResearchActivity'
import { ClientLocalePanel } from '../components/ClientLocalePanel'
import { ConversationCosmos } from '../components/ConversationCosmos'
import { clientCopy, useClientPreferences } from '../client-preferences'
import type { InternalPocPresentation } from './InternalPocApp'
import './client-service.css'

function PendingOperation({ source }: { source: 'service' | 'mock' }) {
  const [startedAt] = useState(() => Date.now())
  return <ClientResearchActivity source={source} label="응답 기다리는 중" status="running" startedAt={startedAt}
    steps={[{ id: 'request', title: '서버 응답 확인', status: 'running', detail: '요청을 보냈습니다. 응답이 도착하면 이 대화에 이어집니다.' }]} />
}

/** Same client presentation; all authoritative state/actions belong to InternalPocApp.
 * This module is reachable only from the separately built internal entrypoint.
 */
export function ClientServiceExperience({ state }: { state: InternalPocPresentation }) {
  const { language, t } = useClientPreferences()
  const input = useRef<HTMLTextAreaElement>(null)
  const recoveryNotice = useRef<HTMLParagraphElement>(null)
  const [composerHeight, setComposerHeight] = useState(72)
  const [localeOpen, setLocaleOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('새 전략')
  const [confirmReset, setConfirmReset] = useState(false)
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const hasConversation = state.messages.some(message => message.role === 'user') || Boolean(state.workflow)
  const isHome = !hasConversation && state.phase === 'ready'
  const greeting = (language === 'ko' ? clientCopy.GREETS : clientCopy.GREETS_ALL[language])[0]
  const available = state.phase === 'ready' && !state.inputDisabled
  const unavailable = () => setNotice('이 내부 연결에서는 전략 대화와 검증을 사용할 수 있습니다. 계정 로그인·연구 목록·거래소 연결은 아직 연결되지 않았습니다.')
  const send = (value = state.input) => {
    if (!available) return
    if (!hasConversation) setTitle(value.trim().slice(0, 40) || '새 전략')
    void state.onSend(value)
  }
  const newConversation = () => {
    if (state.busy) { setNotice('요청을 처리 중입니다. 응답을 확인한 뒤 새 전략을 시작해주세요.'); return }
    if (hasConversation) setConfirmReset(true)
    else state.onReset()
  }
  const recover = state.onRecover
  useLayoutEffect(() => {
    if (state.phase !== 'ready' || state.recovery !== 'RESTORED') return
    // A restored draft is not a newly streamed answer. Start at its recovery
    // context once; subsequent messages retain the original chat auto-follow.
    const scroll = recoveryNotice.current?.closest<HTMLElement>('.g-scroll')
    if (scroll) scroll.scrollTop = 0
  }, [state.phase, state.recovery])
  const recoveryCopy = state.recovery === 'RESTORED'
    ? `서버에서 진행 상태를 다시 확인했습니다. 이전 대화 내용은 복원하지 않았습니다. ${state.inputDisabled ? '아래 문서에서 진행 상태와 다음 단계를 확인해주세요.' : '아래 초안을 확인하고 대화를 이어가세요.'}`
    : '현재 세션에서 이전 초안을 이어갈 수 없어 새 대화를 준비했습니다. 서버 초안은 삭제하지 않았습니다.'
  return <div className={`tesia-shell conversation-surface client-source-app client-service-app ${isHome ? 'view-landing' : 'view-briefing'}`} data-service-phase={state.phase}
    onClickCapture={event => {
      const link = (event.target as Element).closest('a[href]')
      if (link?.getAttribute('href')?.startsWith('/')) {
        event.preventDefault(); event.stopPropagation()
        setNotice('소개·다운로드 페이지는 공개 UI 검수 화면에서 볼 수 있습니다. 이 내부 연결에서는 현재 대화를 유지합니다.')
      }
    }}>
    <a className="skip-link" href="#tesia-main" onClick={event => { event.preventDefault(); document.getElementById('tesia-main')?.focus() }}>본문으로 건너뛰기</a>
    <ClientChrome signedIn={state.sessionState === 'AUTHENTICATED'} onHome={newConversation}
      onLogin={unavailable} onSignup={unavailable} onProfile={unavailable}
      onSettings={() => setLocaleOpen(true)} onLocale={() => setLocaleOpen(true)}
      onDashboard={unavailable} onResearchPage={unavailable} />
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {isHome ? <div className="landing-main"><section className="landing-hero" aria-labelledby="landing-title">
        <ConversationCosmos />
        <div className={`client-home-content ${state.input.trim() ? 'has-input' : ''}`} style={{ '--client-composer-height': `${composerHeight}px` } as CSSProperties}>
          <span className="client-hero-logo" aria-hidden="true"><ClientLogo /></span>
          <h1 className="client-hero-title" id="landing-title">{greeting.h.split('\n').map((line, index) => <span key={index}>{line}</span>)}</h1>
          <p className="client-hero-subtitle">{greeting.s}</p>
          <ClientComposer value={state.input} inputRef={input} disabled={!available} maxLength={1000} onChange={state.onInput}
            onSend={() => send()} onLogin={unavailable} onHeightChange={setComposerHeight} />
          <div className="client-chip-stack"><div className="client-home-chips" aria-label="시작 아이디어" inert={Boolean(state.input.trim())}>
            {(['chip.1', 'chip.2', 'chip.3'] as const).map(key => <button key={key} type="button" onClick={() => send(t(key))}>{t(key)}</button>)}
          </div></div>
        </div>
      </section></div> : <ClientConversation value={state.input} onChange={state.onInput} onSend={() => send()}
        onStop={() => undefined} canStop={false} busy={state.busy || state.phase === 'loading'} inputDisabled={!available} maxLength={1000}
        inputLabel="TETH에게 물어보세요" sendLabel="메시지 보내기" titleLabel="대화 제목" initialTitle={title} onTitleChange={setTitle}
        activityKey={`${state.phase}:${state.messages.length}:${state.busy}:${Boolean(state.workflow)}`} previewTools={<></>}
        headerActions={state.onLogout && <button className="client-service-logout" type="button" disabled={state.busy} onClick={() => void state.onLogout?.()}>로그아웃</button>}>
        {state.recovery && <p ref={recoveryNotice} className="client-service-recovery" role="status">{recoveryCopy}</p>}
        {state.phase === 'loading' ? <PendingOperation source={state.source} /> : state.phase === 'logged-out' ? <div className="g-amsg"><h2>로그아웃 응답을 확인했습니다.</h2><p>이 세션은 종료되었습니다. 새 세션에서 다시 시작할 수 있습니다.</p></div> : <>
          {state.messages.filter(message => message.id !== 'welcome').map(message => message.role === 'user'
            ? <Fragment key={message.id}><ClientUserMessage editDisabled={!available} onEdit={text => { if (!available) return; state.onInput(text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()) }}>{message.text}</ClientUserMessage>
              {message.delivery === 'uncertain' && <p className="client-service-delivery" data-delivery="uncertain">이 메시지의 응답을 확인하지 못했습니다.</p>}</Fragment>
            : <div key={message.id} className="g-amsg" data-source={state.source}><p>{message.text}</p></div>)}
          {state.busy && <PendingOperation source={state.source} />}
          {!state.busy && state.quickReplies.length > 0 && <div className="g-chiprow" aria-label="추가 확인">
            {state.quickReplies.map(reply => <button className="g-qchip" type="button" key={reply} disabled={!available} onClick={() => send(reply)}>{reply}</button>)}
          </div>}
          {state.workflow && <div className="client-service-document" aria-label="서버 전략 검토">{state.workflow}</div>}
          <div className="client-service-outcome">{state.outcome}</div>
        </>}
        <div className="client-service-issue">{state.issue}</div>
        {recover && <button type="button" className="g-qchip" onClick={recover}>{state.phase === 'logged-out' ? '새 세션 시작' : '세션 다시 확인'}</button>}
      </ClientConversation>}
    </main>
    <aside className="client-development-boundary" aria-label="로컬 연결 환경"><details><summary>{state.source === 'mock' ? 'Mock fixture 검수' : '내부 서비스 연결 · 공개 배포 아님'}</summary>
      <p>{state.source === 'mock' ? '자동화 시험용 고정 응답입니다. 실제 서버 결과가 아닙니다.' : 'v0.1 서버 세션·전략 대화·검증을 연결합니다. 현재 설치된 compiler는 offline이며 외부 AI 모델·Google 로그인·실거래는 연결되지 않았습니다. 이 실행기의 신규 백테스트는 합성 데이터이며 봉인된 실제 730일 결과와 다릅니다. 언어 설정은 화면 표시용이며 서버 응답은 한국어입니다.'}</p>
    </details></aside>
    {(notice || confirmReset || (isHome && state.recovery && !recoveryDismissed)) && <div className="client-global-notice" role="status">{confirmReset ? '새 전략을 시작하면 현재 화면의 대화는 사라집니다. 서버 작업을 취소하는 동작은 아닙니다.' : notice || recoveryCopy}
      {confirmReset && <button type="button" onClick={state.onReset}>새 전략 시작</button>}
      <button type="button" aria-label="알림 닫기" onClick={() => { setNotice(''); setConfirmReset(false); setRecoveryDismissed(true) }}>닫기</button>
    </div>}
    {localeOpen && <ClientLocalePanel onClose={() => setLocaleOpen(false)} />}
  </div>
}
