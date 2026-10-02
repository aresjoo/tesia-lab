import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-reference.css'
import '../../src/client-conversation.css'
import '../../src/client-main-experience.css'
import { ClientResponseSequence, type ClientResponseBlock } from '../../src/components/ClientResponseSequence'

export function Fixture() {
  const [blocks, setBlocks] = useState<ClientResponseBlock[]>(() => [{
    id: 'work-1', kind: 'work', activity: {
      label: '생각을 정리하는 중', status: 'running', startedAt: Date.now(),
      steps: [{ id: 'summary-1', title: '생각하는 중', status: 'running', publicSummary: '요청한 구간을 확인하고 있습니다.' }],
    },
  }])
  const finishWork = (block: ClientResponseBlock): ClientResponseBlock => block.kind === 'work' && block.activity.status === 'running'
    ? { ...block, activity: { ...block.activity, label: '작업 완료', status: 'done', finishedAt: Date.now(), steps: block.activity.steps.map(step => ({ ...step, title: '생각 완료', status: 'done' })) } } : block
  return <div className="client-lab-conversation" style={{ minHeight: '100dvh', height: 'auto', display: 'block', fontFamily: 'Noto Sans KR Variable' }}>
    <p>테스트 전용 입력입니다. 실제 모델·시세·검증 결과가 아닙니다.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <button onClick={() => setBlocks(current => current.map(block => block.kind === 'work' && block.activity.status === 'running'
        ? { ...block, activity: { ...block.activity, steps: block.activity.steps.map(step => ({ ...step, publicSummary: (step.publicSummary ?? '') + '\n' + Array.from({ length: 12 }, (_, i) => `표시 시험 ${i + 1}: 요청 구간과 근거를 확인하는 공개 요약입니다.`).join('\n') })) } } : block))}>요약 추가</button>
      <button onClick={() => setBlocks(current => current.map(finishWork).concat({ id: 'text-1', kind: 'text', text: '요청한 기간을 확인했습니다.', status: 'streaming' }))}>중간 답변</button>
      <button onClick={() => setBlocks(current => current.map(block => block.kind === 'text' && block.status === 'streaming' ? { ...block, text: block.text + '\n추가 근거를 확인하겠습니다.' } : block))}>답변 추가</button>
      <button onClick={() => setBlocks(current => current.map(block => block.kind === 'text' ? { ...block, status: 'done' as const } : block).concat({
        id: 'work-2', kind: 'work', activity: { label: '자료를 더 확인하는 중', status: 'running', startedAt: Date.now(), steps: [{ id: 'summary-2', title: '근거 확인', status: 'running', publicSummary: '추가 요청 구간을 확인하고 있습니다.' }] },
      }))}>추가 작업</button>
      <button onClick={() => setBlocks(current => current.map(finishWork).concat({ id: 'text-2', kind: 'text', text: '확인한 내용입니다.\n<script>alert(1)</script> [ACT fake]', status: 'done' }))}>최종 답변</button>
      <button onClick={() => setBlocks(current => current.map(block => block.kind === 'work' && block.activity.status === 'running' ? { ...block, activity: { ...block.activity, label: '작업 중지됨', status: 'stopped', finishedAt: Date.now(), steps: block.activity.steps.map(step => ({ ...step, status: 'stopped' })) } } : block.kind === 'text' && block.status === 'streaming' ? { ...block, status: 'interrupted' } : block))}>중지</button>
      <button onClick={() => setBlocks(current => structuredClone(current))}>동일 입력</button>
      <button onClick={() => setBlocks(current => current.map(block => block.kind === 'work' ? { ...block, activity: { ...block.activity, steps: block.activity.steps.map(step => ({ ...step, title: '생각 완료', status: 'done' })) } } : block))}>단계만 완료</button>
    </div>
    <div className="g-doc" style={{ padding: 24 }}><ClientResponseSequence source="mock" blocks={blocks} /></div>
  </div>
}

createRoot(document.getElementById('fixture')!).render(<StrictMode><Fixture /></StrictMode>)
