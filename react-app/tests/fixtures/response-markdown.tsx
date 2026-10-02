import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'
import '../../src/client-conversation.css'
import { ClientResponseSequence } from '../../src/components/ClientResponseSequence'

export function Fixture() {
  const [text, setText] = useState('### 표시 시험\n공급된 답변만 표시합니다.')
  const [status, setStatus] = useState<'streaming' | 'done' | 'interrupted'>('done')
  const [shown, setShown] = useState(true)
  return <div className="client-lab-conversation" style={{ display: 'block', height: 'auto', minHeight: '100dvh', padding: 16, boxSizing: 'border-box', fontFamily: 'Noto Sans KR Variable', background: 'var(--client-0)', color: 'var(--client-text)' }}>
    <p>TEST FIXTURE · 실제 시장 분석/서버 응답이 아닙니다.</p>
    <label>표현 원문<textarea aria-label="표현 원문" value={text} onChange={event => setText(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /></label>
    <button onClick={() => setStatus('streaming')}>스트리밍 상태</button><button onClick={() => setStatus('done')}>완료 상태</button><button onClick={() => setStatus('interrupted')}>중단 상태</button>
    <button onClick={() => setShown(value => !value)}>표시 전환</button>
    {shown && <ClientResponseSequence source="service" blocks={[{ id: 'same-answer', kind: 'text', text, status }]} />}
  </div>
}
createRoot(document.getElementById('fixture')!).render(<StrictMode><Fixture /></StrictMode>)
