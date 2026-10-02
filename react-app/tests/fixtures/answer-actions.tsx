import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'
import '../../src/client-conversation.css'
import '../../src/client-main-experience.css'
import { ClientAnswerActions } from '../../src/components/ClientAnswerActions'
export function Fixture() {
  const [text, setText] = useState('**답변 원문**\n두 번째 줄 <script>literal</script>')
  const [shown, setShown] = useState(true)
  const [identity, setIdentity] = useState<string | undefined>(undefined)
  return <main className="client-lab-conversation" style={{ display:'block', boxSizing:'border-box', height:'auto', minHeight:'100dvh', padding:16, background:'var(--client-0)', color:'var(--client-text)', fontFamily:'Noto Sans KR Variable' }}>
    <p>표현 시험 · 실제 의견 전송 없음</p>
    <textarea aria-label="답변 원문" value={text} onChange={event => setText(event.target.value)} style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit' }} />
    <button onClick={() => setShown(value => !value)}>표시 전환</button>
    <button onClick={() => setIdentity(value => value === 'first' ? 'second' : 'first')}>답변 식별자 전환</button>
    {shown && <ClientAnswerActions text={text} contentIdentity={identity} />}
  </main>
}
createRoot(document.getElementById('fixture')!).render(<StrictMode><Fixture /></StrictMode>)
