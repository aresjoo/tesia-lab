import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../client-restored-research.css'
import { ClientBacktestWorkspace } from '../components/ClientBacktestWorkspace'
import { fixture } from './chart-workspace-fixture'
import './chart-workspace-preview.css'

export function Preview() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<{ text: string; reference?: string }[]>([])
  return <main className="client-restored-research bw-preview">
    <div className="bw-preview-notice">로컬 UI 검수 · 합성 입력 · 실제 백테스트/API 미연결</div>
    {open ? <ClientBacktestWorkspace view={fixture} title="전략 연구" draft={draft} onDraftChange={setDraft} onClose={() => setOpen(false)}
      thread={<>{messages.map((message, index) => <div className="rw-user-message" key={index}>{message.reference && <small>{message.reference}<br /></small>}{message.text}</div>)}</>}
      onAsk={(text, fill) => { setMessages(items => [...items, { text, reference: fill ? `${fill.side} · ${fill.id}` : undefined }]); setDraft('') }} />
      : <section className="bw-preview-entry"><h1>차트 작업 공간 검수</h1><p>60초 결과 재생 → 체결 확인 → 같은 대화에서 질문</p><p>이 화면은 준비된 UI 동작만 확인합니다. 질문은 이 화면에만 표시되며 AI에 전송하지 않습니다.</p><button autoFocus type="button" onClick={() => setOpen(true)}>차트 작업 공간 열기</button>{draft && <p>보존된 초안: {draft}</p>}</section>}
  </main>
}

createRoot(document.getElementById('root')!).render(<Preview />)
