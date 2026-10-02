import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'
import '../../src/client-conversation.css'
import { ClientResearchActivity, type ResearchActivityStep } from '../../src/components/ClientResearchActivity'

export function Fixture() {
  const params = new URLSearchParams(window.location.search)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [finishedAt, setFinishedAt] = useState<number>()
  const [status, setStatus] = useState<ResearchActivityStep['status']>(params.get('terminal') === 'done' ? 'done' : 'running')
  const [owner, setOwner] = useState(0)
  const [shown, setShown] = useState(true)
  const [steps, setSteps] = useState<ResearchActivityStep[]>([{ id: 'think', title: '생각하는 중', status: params.get('terminal') === 'done' ? 'done' : 'running', detail: '이 문장은 렌더러 검증용 입력입니다. 실제 모델 사고나 검증 결과가 아닙니다.' }])
  return <div className={params.has('native') ? 'native-history-scope' : 'client-lab-conversation'} style={{ minHeight: '100dvh', height: 'auto', display: 'block', fontFamily: 'Noto Sans KR Variable' }}>
    <p aria-label="테스트 데이터 안내">테스트 전용 미리보기이며 실제 리서치·검증이 아닙니다.</p>
    <div className="g-doc">
      {shown && <ClientResearchActivity key={owner} label={status === 'running' ? '생각을 정리하는 중' : status === 'stopped' ? '작업 중지됨' : status === 'failed' ? '작업 실패' : '작업 완료'} status={status} startedAt={startedAt} finishedAt={finishedAt} steps={steps} source="mock" />}
      {params.has('pair') && <ClientResearchActivity label="다른 연구 진행 중" status="running" steps={[]} source="mock" />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
        <button onClick={() => setSteps(current => [...current.map(step => ({ ...step, status: 'done' as const })), { id: 'validation', title: '조건 검증', status: 'failed', detail: '검증 실패 상태를 확인하는 테스트 데이터입니다.' }, { id: 'retry', title: '수정한 조건 재검증', status: 'running', detail: '<script>alert(1)</script> & 매우긴전략조건'.repeat(8) }])}>실패·재검증 이벤트 주입</button>
        <button onClick={() => { setStatus('done'); setFinishedAt(Date.now()); setSteps(current => current.map(step => step.status === 'running' ? { ...step, status: 'done' } : step)) }}>완료 이벤트 주입</button>
        <button onClick={() => { setStatus('stopped'); setFinishedAt(Date.now()); setSteps(current => current.map(step => step.status === 'running' ? { ...step, status: 'stopped' } : step)) }}>중지 이벤트 주입</button>
        <button onClick={() => { setStatus('failed'); setFinishedAt(Date.now()); setSteps(current => current.map(step => step.status === 'running' ? { ...step, status: 'failed' } : step)) }}>실패 이벤트 주입</button>
        <button onClick={() => { setStatus('running'); setStartedAt(Date.now()); setFinishedAt(undefined); setSteps(current => current.map(step => ({ ...step, status: 'running' }))) }}>재시작 이벤트 주입</button>
        <button onClick={() => { setOwner(value => value + 1); setStatus('running'); setStartedAt(Date.now()); setFinishedAt(undefined); setSteps(current => current.map(step => ({ ...step, status: 'running' }))) }}>연구 교체</button>
        <button onClick={() => setShown(false)}>표시 제거</button>
      </div>
    </div>
  </div>
}

createRoot(document.getElementById('fixture')!).render(<Fixture />)
