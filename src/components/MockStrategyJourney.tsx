import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  FileDiff,
  FlaskConical,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  mockStrategyFlowAdapter,
  type MockBacktestProgress,
  type MockBacktestResult,
  type MockStrategyDraft,
  type MockStrategyRevision,
} from '../mock-strategy-flow'

type JourneyStage = 'compose' | 'summary' | 'revision' | 'approved' | 'running' | 'result'

const stages: Array<{ key: JourneyStage; label: string }> = [
  { key: 'compose', label: '아이디어' },
  { key: 'summary', label: '전략 요약' },
  { key: 'revision', label: '수정 비교' },
  { key: 'approved', label: '승인' },
  { key: 'running', label: '백테스트' },
  { key: 'result', label: '결과' },
]

const initialIdea = 'BTC 4시간봉에서 단기 이평선이 장기 이평선을 위로 돌파하고 RSI가 강하면 매수해. 손실은 작게 제한하고 싶어.'

export function MockStrategyJourney() {
  const [stage, setStage] = useState<JourneyStage>('compose')
  const [idea, setIdea] = useState('')
  const [draft, setDraft] = useState<MockStrategyDraft | null>(null)
  const [revision, setRevision] = useState<MockStrategyRevision | null>(null)
  const [result, setResult] = useState<MockBacktestResult | null>(null)
  const [progress, setProgress] = useState<MockBacktestProgress>({ percent: 0, label: '준비 중' })
  const [isLoading, setIsLoading] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const currentIndex = stages.findIndex((item) => item.key === stage)

  useEffect(() => {
    if (stage !== 'compose') headingRef.current?.focus()
  }, [stage])

  const createDraft = async (fail = false) => {
    const trimmed = idea.trim()
    if (!trimmed) {
      setError('전략 아이디어를 한 문장 이상 입력해 주세요.')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const nextDraft = await mockStrategyFlowAdapter.structureIdea(trimmed, { fail })
      setDraft(nextDraft)
      setStage('summary')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mock 전략 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const createRevision = async () => {
    if (!draft) return
    setError('')
    setIsLoading(true)
    try {
      setRevision(await mockStrategyFlowAdapter.proposeRevision(draft))
      setStage('revision')
    } catch {
      setError('Mock 수정안을 만들지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const runBacktest = async (fail = false) => {
    const approvedStrategy = revision?.strategy ?? draft
    if (!approvedStrategy) return
    setError('')
    setProgress({ percent: 0, label: 'Mock 작업 준비' })
    setStage('running')
    try {
      const nextResult = await mockStrategyFlowAdapter.runBacktest(approvedStrategy, setProgress, { fail })
      setResult(nextResult)
      setStage('result')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mock 백테스트에 실패했습니다.')
    }
  }

  const reset = () => {
    setStage('compose')
    setIdea('')
    setDraft(null)
    setRevision(null)
    setResult(null)
    setProgress({ percent: 0, label: '준비 중' })
    setIsApproved(false)
    setError('')
  }

  return (
    <div className="msj-shell">
      <header className="msj-header">
        <a className="msj-brand" href="#/" aria-label="TESIA AI 홈으로 이동">TESIA <span>AI</span></a>
        <div className="msj-mock-badge"><FlaskConical aria-hidden="true" /> Mock POC</div>
        <p>실제 API · OAuth · 거래소 연결 없음</p>
      </header>

      <main className="msj-main">
        <aside className="msj-rail" aria-label="전략 검증 단계">
          <p className="msj-eyebrow">STRATEGY LAB</p>
          <h1>상상한 전략을<br />검증 가능한 규칙으로</h1>
          <p>대화부터 결과까지 한 흐름으로 확인하는 프론트엔드 전용 시연입니다.</p>
          <ol>
            {stages.map((item, index) => {
              const complete = index < currentIndex
              const active = index === currentIndex
              return (
                <li key={item.key} className={active ? 'active' : complete ? 'complete' : ''} aria-current={active ? 'step' : undefined}>
                  <span>{complete ? <Check aria-hidden="true" /> : index + 1}</span>
                  {item.label}
                </li>
              )
            })}
          </ol>
          <div className="msj-boundary"><ShieldCheck aria-hidden="true" /><span><strong>안전 경계</strong>이 화면은 주문을 만들거나 자금을 이동하지 않습니다.</span></div>
        </aside>

        <section className="msj-workspace" aria-live="polite" aria-busy={isLoading || stage === 'running'}>
          {stage === 'compose' && (
            <div className="msj-panel msj-compose" data-state={idea ? 'ready' : 'empty'}>
              <div className="msj-title-row">
                <span className="msj-step-label"><MessageSquareText aria-hidden="true" /> 01 · 자연어 대화</span>
                <span>Presentation Mock</span>
              </div>
              <h2 ref={headingRef}>어떤 매매를 해보고 싶나요?</h2>
              <p className="msj-lead">완벽한 용어는 필요 없습니다. 평소 생각하던 방식으로 적어주세요.</p>

              {!idea && (
                <div className="msj-empty" role="status">
                  <CircleDashed aria-hidden="true" />
                  <div><strong>아직 전략 아이디어가 없습니다.</strong><span>예시를 불러오거나 아래 입력란에서 시작하세요.</span></div>
                </div>
              )}

              <label className="msj-input-label" htmlFor="mock-strategy-idea">전략 아이디어</label>
              <textarea
                id="mock-strategy-idea"
                value={idea}
                onChange={(event) => { setIdea(event.target.value); if (error) setError('') }}
                placeholder="예: 비트코인 4시간봉에서 추세가 강해질 때만 매수하고 싶어…"
                aria-describedby="mock-input-help mock-flow-error"
              />
              <div className="msj-input-meta" id="mock-input-help"><span>거래쌍 · 시간봉 · 진입 · 손실 제한을 자연스럽게 포함해 보세요.</span><span>{idea.length}자</span></div>
              {error && <div id="mock-flow-error" className="msj-error" role="alert"><AlertTriangle aria-hidden="true" /><span>{error}</span></div>}
              <div className="msj-actions">
                <button className="msj-secondary" type="button" onClick={() => setIdea(initialIdea)}>예시 불러오기</button>
                <button className="msj-ghost" type="button" onClick={() => createDraft(true)} disabled={isLoading}>Mock 오류 재현</button>
                <button className="msj-primary" type="button" onClick={() => createDraft()} disabled={isLoading}>
                  {isLoading ? <><LoaderCircle className="msj-spin" aria-hidden="true" /> 구조화 중</> : <>전략으로 정리 <ArrowRight aria-hidden="true" /></>}
                </button>
              </div>
            </div>
          )}

          {stage === 'summary' && draft && (
            <div className="msj-panel">
              <div className="msj-title-row"><span className="msj-step-label"><Sparkles aria-hidden="true" /> 02 · 전략 요약</span><span>MOCK-v0.1</span></div>
              <h2 ref={headingRef} tabIndex={-1}>말씀하신 내용을 이렇게 이해했어요.</h2>
              <p className="msj-lead">백테스트에 넣기 전에 잘못 해석된 조건이 없는지 확인하세요.</p>
              <div className="msj-strategy-title"><span>초안</span><strong>{draft.title}</strong><small>{draft.market}</small></div>
              <dl className="msj-definition-list">
                <div><dt>기준 시간</dt><dd>{draft.timeframe}</dd></div>
                <div><dt>방향</dt><dd>{draft.direction}</dd></div>
                <div><dt>진입</dt><dd>{draft.entry}</dd></div>
                <div><dt>청산</dt><dd>{draft.exit}</dd></div>
                <div><dt>리스크</dt><dd>{draft.risk}</dd></div>
              </dl>
              <div className="msj-assumptions"><strong>Mock 계산 가정</strong><ul>{draft.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>
              {error && <div className="msj-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}
              <div className="msj-actions">
                <button className="msj-secondary" type="button" onClick={() => setStage('compose')}><ArrowLeft aria-hidden="true" /> 원문 수정</button>
                <button className="msj-primary" type="button" onClick={createRevision} disabled={isLoading}>{isLoading ? <><LoaderCircle className="msj-spin" aria-hidden="true" /> 비교 중</> : <><FileDiff aria-hidden="true" /> 안전한 수정안 비교</>}</button>
              </div>
            </div>
          )}

          {stage === 'revision' && revision && (
            <div className="msj-panel">
              <div className="msj-title-row"><span className="msj-step-label"><FileDiff aria-hidden="true" /> 03 · 수정 Diff</span><span>{revision.version}</span></div>
              <h2 ref={headingRef} tabIndex={-1}>의도는 유지하고 위험 조건을 명확히 했어요.</h2>
              <p className="msj-lead">바뀐 규칙만 나란히 비교합니다. 승인 전에는 어떤 백테스트도 시작하지 않습니다.</p>
              <div className="msj-diff-list">
                {revision.changes.map((change) => (
                  <article key={change.field}>
                    <h3>{change.field}</h3>
                    <div><span>이전</span><p>{change.before}</p></div>
                    <div className="after"><span>수정</span><p>{change.after}</p></div>
                    <small>{change.reason}</small>
                  </article>
                ))}
              </div>
              <div className="msj-actions">
                <button className="msj-secondary" type="button" onClick={() => setStage('summary')}><ArrowLeft aria-hidden="true" /> 요약으로</button>
                <button className="msj-primary" type="button" onClick={() => setStage('approved')}>수정안 선택 <ArrowRight aria-hidden="true" /></button>
              </div>
            </div>
          )}

          {stage === 'approved' && revision && (
            <div className="msj-panel msj-approval">
              <div className="msj-title-row"><span className="msj-step-label"><ShieldCheck aria-hidden="true" /> 04 · 명시적 승인</span><span>{revision.version}</span></div>
              <h2 ref={headingRef} tabIndex={-1}>승인한 버전만 Mock 검증에 사용합니다.</h2>
              <p className="msj-lead">이 승인은 시연용 백테스트 범위에만 적용되며 주문 권한을 부여하지 않습니다.</p>
              <div className="msj-approval-summary"><span>검증 대상</span><strong>{revision.strategy.title}</strong><small>{revision.strategy.market} · {revision.strategy.timeframe}</small></div>
              <label className="msj-checkbox">
                <input type="checkbox" checked={isApproved} onChange={(event) => setIsApproved(event.target.checked)} />
                <span><strong>{revision.version}의 조건과 Mock 계산 가정을 확인했습니다.</strong>실제 성과 보장이나 실거래 승인이 아님을 이해합니다.</span>
              </label>
              <div className="msj-actions">
                <button className="msj-secondary" type="button" onClick={() => setStage('revision')}><ArrowLeft aria-hidden="true" /> Diff 다시 보기</button>
                <button className="msj-ghost" type="button" disabled={!isApproved} onClick={() => runBacktest(true)}>Mock 실패 1회 재현</button>
                <button className="msj-primary" type="button" disabled={!isApproved} onClick={() => runBacktest()}><FlaskConical aria-hidden="true" /> Mock 백테스트 시작</button>
              </div>
            </div>
          )}

          {stage === 'running' && (
            <div className="msj-panel msj-running">
              <div className="msj-title-row"><span className="msj-step-label"><LoaderCircle className={error ? '' : 'msj-spin'} aria-hidden="true" /> 05 · 백테스트 진행</span><span>LOCAL MOCK</span></div>
              <h2 ref={headingRef} tabIndex={-1}>{error ? 'Mock 처리가 중단됐습니다.' : '과거 데이터를 재생하고 있어요.'}</h2>
              <p className="msj-lead">브라우저 안의 고정 fixture만 사용합니다. 외부 시세나 거래소에는 연결하지 않습니다.</p>
              <div className="msj-progress" aria-label={`Mock 백테스트 ${progress.percent}%`}>
                <div><span>{progress.label}</span><strong>{progress.percent}%</strong></div>
                <progress max="100" value={progress.percent}>{progress.percent}%</progress>
              </div>
              {!error && <div className="msj-skeleton" aria-hidden="true"><span /><span /><span /></div>}
              {error && <div className="msj-error" role="alert"><AlertTriangle aria-hidden="true" /><span><strong>재시도할 수 있습니다.</strong>{error} 승인된 Mock 버전은 유지됩니다.</span></div>}
              {error && <div className="msj-actions"><button className="msj-secondary" type="button" onClick={() => setStage('approved')}>승인 화면으로</button><button className="msj-primary" type="button" onClick={() => runBacktest()}><RotateCcw aria-hidden="true" /> 같은 버전 재시도</button></div>}
            </div>
          )}

          {stage === 'result' && result && (
            <div className="msj-panel msj-result">
              <div className="msj-title-row"><span className="msj-step-label"><CheckCircle2 aria-hidden="true" /> 06 · 결과</span><span>MOCK RESULT</span></div>
              <h2 ref={headingRef} tabIndex={-1}>수익 가능성보다 약한 구간을 먼저 확인하세요.</h2>
              <div className="msj-verdict"><div><span>판정</span><strong>{result.verdict}</strong></div><p>{result.period}<br />{result.candleCount}</p></div>
              <div className="msj-metrics" aria-label="Mock 백테스트 핵심 지표">
                {result.metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong className={metric.tone}>{metric.value}</strong></div>)}
              </div>
              <div className="msj-findings"><strong>다음 검증 전에 확인할 점</strong><ul>{result.findings.map((item) => <li key={item}><AlertTriangle aria-hidden="true" />{item}</li>)}</ul></div>
              <div className="msj-final-boundary"><ShieldCheck aria-hidden="true" /><p><strong>여기까지가 이번 POC의 경계입니다.</strong>이 결과는 고정 Mock fixture에서 나온 시연값이며 투자 조언이나 실거래 신호가 아닙니다.</p></div>
              <div className="msj-report-example" role="note" aria-label="별도 합성 보고서 안내">
                <strong>별도 합성 보고서 UI 예시</strong>
                <p>아래 보고서는 지금 만든 전략의 상세 결과가 아닙니다. RSI 과매도 회귀 · 15분봉 · 30일 고정 fixture를 사용하는 독립 화면 예시입니다.</p>
                <a href="/reporting-demo.html" aria-describedby="mock-report-separation">별도 보고서 예시 보기 <ArrowRight aria-hidden="true" /></a>
                <span id="mock-report-separation">실제 730일 백테스트 결과나 투자 성과가 아닙니다.</span>
              </div>
              <div className="msj-actions"><button className="msj-secondary" type="button" onClick={reset}><RotateCcw aria-hidden="true" /> 새 아이디어로 초기화</button><button className="msj-primary" type="button" disabled><Check aria-hidden="true" /> 실제 실행은 아직 잠김</button></div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
