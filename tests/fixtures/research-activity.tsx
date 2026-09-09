import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'
import '../../src/client-conversation.css'
import { ClientResearchActivity, type ResearchActivityStep } from '../../src/components/ClientResearchActivity'

export function Fixture() {
  const [startedAt] = useState(() => Date.now())
  const [finishedAt, setFinishedAt] = useState<number>()
  const [status, setStatus] = useState<ResearchActivityStep['status']>('running')
  const [steps, setSteps] = useState<ResearchActivityStep[]>([{ id: 'think', title: '생각하는 중', status: 'running', detail: '이 문장은 렌더러 검증용 입력입니다. 실제 모델 사고나 검증 결과가 아닙니다.' }])
  return <div className="client-lab-conversation" style={{ minHeight: '100dvh', height: 'auto', display: 'block', fontFamily: 'Noto Sans KR Variable' }}>
    <p aria-label="테스트 데이터 안내">테스트 전용 미리보기이며 실제 리서치·검증이 아닙니다.</p>
    <div className="g-doc">
      <ClientResearchActivity label={status === 'running' ? '생각을 정리하는 중' : status === 'stopped' ? '작업 중지됨' : '작업 완료'} status={status} startedAt={startedAt} finishedAt={finishedAt} steps={steps} source="mock" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
        <button onClick={() => setSteps(current => [...current.map(step => ({ ...step, status: 'done' as const })), { id: 'validation', title: '조건 검증', status: 'failed', detail: '검증 실패 상태를 확인하는 테스트 데이터입니다.' }, { id: 'retry', title: '수정한 조건 재검증', status: 'running', detail: '<script>alert(1)</script> & 매우긴전략조건'.repeat(8) }])}>실패·재검증 이벤트 주입</button>
        <button onClick={() => { setStatus('done'); setFinishedAt(Date.now()); setSteps(current => current.map(step => step.status === 'running' ? { ...step, status: 'done' } : step)) }}>완료 이벤트 주입</button>
        <button onClick={() => { setStatus('stopped'); setFinishedAt(Date.now()); setSteps(current => current.map(step => step.status === 'running' ? { ...step, status: 'stopped' } : step)) }}>중지 이벤트 주입</button>
      </div>
    </div>
  </div>
}

createRoot(document.getElementById('fixture')!).render(<Fixture />)
