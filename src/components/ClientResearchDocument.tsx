import { useState } from 'react'
import { Check, Copy, MessageSquare } from 'lucide-react'
import { ClientResearchLog, type ResearchLogEntry } from './ClientResearchLog'
import { criticParagraphs, type ResearchCriticReview } from '../research-view-model'
import '../client-research-document.css'

type PlanProps = {
  pair: string; timeframe: string; entry: string; risk: string; exit: string; title: string
  code: string; signedIn: boolean; copied: boolean; copyError: boolean; started: boolean
  onStart: () => void; onSignup: () => void; onEdit: (field?: string) => void; onBacktest: () => void; onCopy: () => void
}

export function ClientResearchPlan({ pair, timeframe, entry, risk, exit, title, code, signedIn, copied, copyError, started, onStart, onSignup, onEdit, onBacktest, onCopy }: PlanProps) {
  const [signup, setSignup] = useState(false)
  const rows = [
    ['대상', `${pair}, ${timeframe}`], ['진입', entry], ['손실 한도', risk], ['청산', exit],
    ['Research 데이터', '2023.01 – 2025.06'], ['Holdout 데이터', '2025.07 – 2026.08, 봉인'],
    ['거래 비용', '수수료, 슬리피지 포함'], ['검증', '7단계, 위험 조정 수익 우선'],
  ]
  return <section className="g-adoc research-plan-document" aria-label="연구 계획 문서">
    <h3>Research Plan</h3><p className="meta">{pair}, {timeframe}, 행 위에서 수정 요청</p>
    <p className="g-note">{title}</p>
    <dl>{rows.map(([key, value], index) => <div className="g-row" key={key}><dt className="k">{key}</dt><dd className="v">{value}</dd>{index > 0 && index < 4 && <button className="cbtn" type="button" aria-label={`${key} 수정 요청`} onClick={() => onEdit(key)}><MessageSquare size={13} /></button>}</div>)}</dl>
    <div className="g-plan-actions">
      <button className="g-primary" type="button" onClick={() => signedIn ? onStart() : setSignup(true)}>{started ? '연구 과정 보기' : '연구 시작'}</button>
      <button className="g-qchip" type="button" onClick={() => onEdit()}>조건 수정</button>
    </div>
    {signup && !signedIn && <section className="research-inline-signup" aria-label="연구 시작을 위한 계정 안내">
      <h3>백테스트 결과를 받아보세요</h3><p>Mock 계정으로 연구 화면을 미리 확인할 수 있어요. 실제 소셜 로그인은 실행하지 않습니다.</p>
      <div className="g-plan-actions"><button className="g-primary" type="button" onClick={() => { setSignup(false); onSignup(); onStart() }}>Mock 계정으로 계속</button><button className="g-qchip" type="button" onClick={() => setSignup(false)}>취소</button></div>
    </section>}
    <details className="research-legacy-tools"><summary>전략 규칙 및 기존 Mock 백테스트</summary>
      <pre aria-label="전략 규칙 미리보기" tabIndex={0}><code>{code}</code></pre>
      <div className="g-plan-actions"><button className="g-qchip" type="button" aria-label="백테스트 시작" onClick={onBacktest}>백테스트 시작</button><button className="g-qchip" type="button" aria-label={copied ? '전략 복사 완료' : copyError ? '전략 복사 실패, 다시 시도' : '전략 복사'} onClick={onCopy}>{copied ? <Check size={14} /> : <Copy size={14} />} 전략 복사</button></div>
      <p role="status">{copied ? '전략 규칙을 클립보드에 복사했습니다.' : copyError ? '복사 권한을 확인한 뒤 다시 시도해주세요.' : '기존 결과 화면은 별도 Mock 시나리오입니다.'}</p>
    </details>
  </section>
}

export function ClientResearchRun({ entries, source, status, completionSummary }: {
  entries: readonly ResearchLogEntry[]
  source: 'mock-replay' | 'service'
  status: 'running' | 'paused' | 'completed' | 'failed'
  completionSummary?: string
}) {
  return <section className="research-run-document" aria-label="연구 진행 문서">
    <ClientResearchLog entries={entries} source={source} status={status} />
    {status === 'completed' && <div className="research-completion"><h3>연구 완료</h3>{completionSummary && <p className="g-note">{completionSummary}</p>}</div>}
  </section>
}

export function ClientCriticReview({ review }: { review: ResearchCriticReview }) {
  const paragraphs = criticParagraphs(review)
  return <section className="g-adoc research-critic-document" aria-label="Critic Review 문서" data-version={review.version}>
    <h3>Critic Review</h3><div className="meta">Builder 주장 → Critic 반박 → 데이터</div>
    <div className="research-critic-blocks">
      <div><span className="g-tag">Builder</span><p>{paragraphs.builder}</p></div>
      <div><span className="g-tag warn">Critic</span><p>{paragraphs.critic}</p></div>
      <div><span className="g-tag ok">Verdict</span><p>{paragraphs.verdict}</p></div>
    </div>
  </section>
}
