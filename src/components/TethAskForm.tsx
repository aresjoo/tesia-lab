import { useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, CornerDownLeft, X } from 'lucide-react'
import type { TethAskQuestion } from '../teth-chips-schema'
import '../teth-ask.css'

/* 정보 부족 시 선다형 질문 폼 — 모델의 <ask> 블록(검증 통과분)을 렌더한다.
 * Genspark 리듬 그대로: 선택지 클릭 → 다음 미답 질문 자동 이동, 마지막 답이
 * 채워지는 순간 별도 버튼 없이 즉시 제출된다(직접 입력은 ↵/화살표로 확정).
 * ✕ 로 접으면 "질문 대기 중" 알약으로 축소되고 다시 펼 수 있다.
 * 답변 완료 후에는 사용자 쪽(우측) 라이트 카드 요약으로 남는다. */
export function TethAskForm({ questions, answers, onSubmit }: {
  questions: TethAskQuestion[]
  answers?: string[]
  onSubmit: (answers: string[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<(string | null)[]>(() => questions.map(() => null))
  const [customOpen, setCustomOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const customInput = useRef<HTMLTextAreaElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  if (answers) {
    // 답변 완료: 사용자 쪽 라이트 카드 — 굵은 라벨 + 값 쌍의 재요약.
    return <div className="tak-answered-row"><div className="tak-answered-card">
      {questions.map((question, questionIndex) => <div className="tak-pair" key={questionIndex}>
        <span className="tak-pair-label">{question.title}</span>
        <span className="tak-pair-value">{answers[questionIndex] ?? '—'}</span>
      </div>)}
    </div></div>
  }

  if (collapsed) {
    return <div className="teth-ask"><button type="button" className="tak-waiting" onClick={() => setCollapsed(false)}>
      <span className="tak-waiting-state">질문 대기 중</span><span className="tak-waiting-cta">이 질문에 답하기</span>
    </button></div>
  }

  const question = questions[index]
  const commit = (value: string) => {
    if (submitted) return
    const next = picked.map((answer, answerIndex) => answerIndex === index ? value : answer)
    setPicked(next)
    setCustomOpen(false)
    setCustomValue('')
    // 마지막 답이 채워지는 순간 즉시 제출 — 제출 버튼은 존재하지 않는다.
    if (next.every(answer => answer !== null)) {
      setSubmitted(true)
      onSubmit(next as string[])
      return
    }
    for (let step = 1; step <= questions.length; step++) {
      const probe = (index + step) % questions.length
      if (next[probe] === null) { setIndex(probe); break }
    }
  }
  const commitCustom = () => {
    const value = customValue.trim()
    if (value) commit(value.slice(0, 200))
  }

  return <div className="teth-ask" role="group" aria-label="TETH의 질문">
    <div className="tak-banner"><strong>TETH에 입력이 필요합니다</strong><span className="tak-banner-sub">아래에서 질문 {questions.length}개에 답변하세요 ↓</span></div>
    <div className="tak-card">
      <div className="tak-head">
        <div className="tak-title">{question.title}{question.hint && <span className="tak-hint">{question.hint}</span>}</div>
        <div className="tak-nav">
          <button type="button" aria-label="이전 질문" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft size={15} /></button>
          <span>{questions.length}개 중 {index + 1}</span>
          <button type="button" aria-label="다음 질문" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight size={15} /></button>
          <button type="button" className="tak-close" aria-label="질문 접기" onClick={() => setCollapsed(true)}><X size={15} /></button>
        </div>
      </div>
      <div className="tak-options">
        {question.options.map(option => <button key={option.label} type="button" className={picked[index] === option.label ? 'on' : ''} onClick={() => commit(option.label)}>
          <span className="tak-option-text">
            <span className="tak-label">{option.label}</span>
            {option.desc && <span className="tak-desc">{option.desc}</span>}
          </span>
          <CornerDownLeft className="tak-enter-hint" size={14} aria-hidden="true" />
        </button>)}
        {question.allowCustom && (customOpen
          ? <div className="tak-custom">
            <textarea ref={customInput} placeholder="답변을 입력하세요..." rows={2} aria-label="직접 답변" autoFocus
              value={customValue} onChange={event => setCustomValue(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); commitCustom() } }} />
            <button type="button" className={customValue.trim() ? 'tak-custom-send on' : 'tak-custom-send'} aria-label="직접 답변 확정" disabled={!customValue.trim()} onClick={commitCustom}><ArrowRight size={15} /></button>
          </div>
          : <button type="button" className="tak-custom-toggle" onClick={() => setCustomOpen(true)}>
            <span className="tak-option-text"><span className="tak-label">직접 답변 작성</span></span>
            <CornerDownLeft className="tak-enter-hint" size={14} aria-hidden="true" />
          </button>)}
      </div>
    </div>
  </div>
}
