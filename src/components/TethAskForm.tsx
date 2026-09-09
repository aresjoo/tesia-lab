import { useRef, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TethAskQuestion } from '../teth-chips-schema'
import '../teth-ask.css'

/* 정보 부족 시 선다형 질문 폼 — 모델의 <ask> 블록(검증 통과분)을 렌더한다.
 * 선택지 클릭 → 다음 질문 자동 이동, 마지막까지 답하면 요약을 다음 user
 * 메시지로 전송한다(onSubmit). 답변 완료 후에는 읽기 전용 요약으로 접힌다. */
export function TethAskForm({ questions, answers, onSubmit }: {
  questions: TethAskQuestion[]
  answers?: string[]
  onSubmit: (answers: string[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<(string | null)[]>(() => questions.map(() => null))
  const [customOpen, setCustomOpen] = useState(false)
  const customInput = useRef<HTMLTextAreaElement>(null)
  const [submitted, setSubmitted] = useState(false)

  if (answers) {
    // 이미 답변된 폼: 읽기 전용 요약으로 축소.
    return <div className="teth-ask answered">
      <div className="tak-done"><Check size={13} aria-hidden="true" /> 답변 완료</div>
      <dl>{questions.map((question, questionIndex) => <div key={questionIndex}><dt>{question.title}</dt><dd>{answers[questionIndex] ?? '—'}</dd></div>)}</dl>
    </div>
  }

  const question = questions[index]
  const allAnswered = picked.every(answer => answer !== null)
  const choose = (value: string) => {
    const next = picked.map((answer, answerIndex) => answerIndex === index ? value : answer)
    setPicked(next)
    setCustomOpen(false)
    if (index < questions.length - 1) setIndex(index + 1)
  }
  const submit = () => {
    if (!allAnswered || submitted) return
    setSubmitted(true)
    onSubmit(picked as string[])
  }

  return <div className="teth-ask" role="group" aria-label="TETH의 질문">
    <div className="tak-banner"><strong>TETH에 입력이 필요합니다</strong> 아래에서 질문 {questions.length}개에 답변하세요 ↓</div>
    <div className="tak-card">
      <div className="tak-head">
        <div className="tak-title">{question.title}{question.hint && <span className="tak-hint">{question.hint}</span>}</div>
        <div className="tak-nav">
          <span>{questions.length}개 중 {index + 1}</span>
          <button type="button" aria-label="이전 질문" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={14} /></button>
          <button type="button" aria-label="다음 질문" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="tak-options">
        {question.options.map(option => <button key={option.label} type="button" className={picked[index] === option.label ? 'on' : ''} onClick={() => choose(option.label)}>
          <span className="tak-label">{option.label}</span>
          {option.desc && <span className="tak-desc">{option.desc}</span>}
        </button>)}
        {question.allowCustom && (customOpen
          ? <div className="tak-custom">
            <textarea ref={customInput} placeholder="답변을 입력하세요..." rows={2} aria-label="직접 답변" defaultValue={picked[index] && !question.options.some(o => o.label === picked[index]) ? picked[index]! : ''} />
            <button type="button" aria-label="직접 답변 확정" onClick={() => { const value = customInput.current?.value.trim(); if (value) choose(value.slice(0, 200)) }}><ArrowRight size={14} /></button>
          </div>
          : <button type="button" className="tak-custom-toggle" onClick={() => setCustomOpen(true)}><span className="tak-label">직접 답변 작성</span></button>)}
      </div>
      {allAnswered && <button type="button" className="tak-submit" disabled={submitted} onClick={submit}>답변 보내기 <ArrowRight size={14} aria-hidden="true" /></button>}
    </div>
  </div>
}
