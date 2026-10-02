import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientResearchLog, type ResearchLogEntry } from '../../src/components/ClientResearchLog'
import '../../src/client-reference.css'
export function Fixture() {
  const [entries, setEntries] = useState<ResearchLogEntry[]>([{ id: 'validator', elapsedSeconds: 0, agent: 'Quant Validator', summary: '백테스트 검증 중', state: 'work' }])
  return <div className="tesia-shell conversation-surface client-lab-conversation">
    <div className="g-doc" style={{ width: '100%', padding: 24 }}>
      <p>테스트 전용 이벤트 주입 화면, 실제 서비스 결과가 아닙니다.</p>
      <button type="button" onClick={() => setEntries(rows => [...rows, { id: 'critic', elapsedSeconds: 70, agent: 'Strategy Critic', summary: '개선점 1개 발견', state: 'warn', finding: { title: '저변동성 구간 과잉 거래', professional: 'Evidence: <script>alert(1)</script>', plain: '테스트 데이터에서 확인한 문제입니다.', meaning: '경고를 완료 상태로 덮어쓰지 않습니다.', nextAction: '수정된 조건으로 다시 검증합니다.' } }])}>Critic 이벤트 주입</button>
      <ClientResearchLog entries={entries} source="service" status="running" />
    </div>
  </div>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
