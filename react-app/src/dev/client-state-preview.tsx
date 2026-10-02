import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../styles.css'
import '../client-reference.css'
import '../client-workspace.css'
import '../client-integration.css'
import '../client-main-experience.css'
import '../client-delegation.css'
import { ClientAccountPlan } from '../components/ClientAccountActivity'
import { ClientBrokers, type BrokerConnectionState } from '../components/ClientBrokers'
import ClientSourceTerminalWorkspace from '../components/ClientSourceTerminalWorkspace'
import { ClientDelegationChart } from '../components/ClientDelegationChart'
import { useClientPreferences } from '../client-preferences'
import { sourceMoney } from '../client-preview-money'
import { CLIENT_BROKERS } from '../client-broker-fixtures'
import { setSourceNotificationPreference } from '../client-account-event-state'
import { ClientStateControls } from './ClientStateControls'
import { createSourceQaState, resetSourceQaState, toggleSourceQaState, sourceQaBrokerState, type SourceQaKey } from './client-state-preview-model'

// Isolated review surface, not a replacement product shell. These props never
// reach ClientMainExperience, an SDK controller, credentials or account storage.
const pages = [['plan', 'PLAN 및 크레딧'], ['brokers', '거래소'], ['trading', '내 트레이딩'], ['result', '검증 결과']] as const
type PreviewPage = typeof pages[number][0]
export function Preview() {
  const [state, setState] = useState(createSourceQaState)
  const [page, setPage] = useState<PreviewPage>('plan')
  const [planTab, setPlanTab] = useState<'plan' | 'rebates' | 'alerts'>('plan')
  const [now, setNow] = useState(() => Date.now())
  const eventSequence = useRef(0)
  const { language, currency } = useClientPreferences()
  const signedIn = state.user !== null
  const toggle = (key: SourceQaKey) => {
    const eventNow = Date.now()
    const event = { now: eventNow, id: `source-qa:${eventNow}:${++eventSequence.current}` }
    if (key === 'login' && signedIn) { setPage('plan'); setPlanTab('plan') }
    setNow(eventNow)
    setState(previous => toggleSourceQaState(previous, key, event))
  }
  const navigate = (route?: string) => {
    setPage('plan')
    setPlanTab(route === '#/plan/rebates' ? 'rebates' : route === '#/plan/alerts' ? 'alerts' : 'plan')
  }
  const connectionState = (id: string): BrokerConnectionState => sourceQaBrokerState(state, id, CLIENT_BROKERS.find(broker => broker.id === id)?.conn === true)
  return <div className="source-state-preview client-source-app">
    <header><p>로컬 UI 검수 · 실제 계정·거래소/API 미연결</p><nav aria-label="로컬 검수 화면">{pages.map(([id, title]) => <button type="button" key={id} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>{title}</button>)}</nav></header>
    <main key={state.generation}>
      {page === 'plan' && <ClientAccountPlan state={state.account} signedIn={signedIn} now={now} tab={planTab} previewBillingMode={state.billing.mode} money={(value, signed) => sourceMoney(value, currency, language, signed)} onNavigate={navigate} onPreference={(key, value) => setState(previous => ({ ...previous, account: setSourceNotificationPreference(previous.account, key, value) }))} />}
      {page === 'brokers' && <ClientBrokers authenticated={signedIn} connectionState={connectionState} presentationScope={`${state.generation}:${signedIn}:${state.api?.ex ?? ''}:${state.plan ?? ''}:${state.uid ?? ''}`} onTitleChange={() => {}} />}
      {page === 'trading' && (signedIn ? <div className="source-preview-terminal"><ClientSourceTerminalWorkspace accountState={state.account} now={now} onNew={() => navigate()} onAsk={() => navigate()} onAccountNavigate={navigate} accountDataMode={state.api ? 'source-preview' : 'connection-required'} onConnectExchange={() => setPage('brokers')} previewBillingMode={state.billing.mode} /></div> : <section className="source-preview-result"><h1>내 트레이딩</h1><p>로그인하고 바로 시작하세요</p></section>)}
      {page === 'result' && <section className="tfw source-preview-result"><h1>검증 결과</h1>{state.verified ? <><div className="tfw-chart"><ClientDelegationChart asset="비트코인" evaluation={state.verified.evaluation} compact /></div><p>TETH SCORE {state.verified.score} · 거래 {state.verified.result.n}회</p><p>데이터: 원본 공통 합성 일봉 시뮬레이션. 체결: 판정·진입·기간 청산은 봉 종가, 손절·익절은 규칙가 가정(일중·갭·슬리피지 미반영). 비용: 완료 거래당 0.2% 반영.</p></> : <p>검증 통과 전략 OFF</p>}</section>}
    </main>
    <ClientStateControls state={state} onToggle={toggle} onReset={() => { setNow(Date.now()); setState(resetSourceQaState); setPage('plan'); setPlanTab('plan') }} />
  </div>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<StrictMode><Preview /></StrictMode>)
