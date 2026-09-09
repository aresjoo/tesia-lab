import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ResearchLogEntry } from './components/ClientResearchLog'
import { criticParagraphs, type ResearchCriticReview } from './research-view-model'

// Captured from acccc7f's synthetic engine: RSI40, SL-3, TP+8, research61..909.
// v1: ret8.2853, MDD-12.3673, 27 trades, 10/14 low-vol losses.
// v2 filter: ret12.8522, MDD-6.2976, 10 trades; holdout ret8.8901/MDD-3.2.
// These are immutable CLIENT MOCK fixtures, NEVER the user's strategy results.
export const MOCK_RESEARCH_ENTRIES: readonly ResearchLogEntry[] = [
  { id: 'hypothesis', elapsedSeconds: 0.9, agent: 'Strategy Architect', summary: '가설 생성됨, 많이 떨어져 과매도가 된 뒤, 가격이 다시 고개를 드는 순간의 반등을 노립니다.', state: 'done' },
  { id: 'structure', elapsedSeconds: 5.5, agent: 'Strategy Architect', summary: '조건 구조화 완료, 진입 1, 청산 2, 손실 한도 −3%', state: 'done' },
  { id: 'market', elapsedSeconds: 10.5, agent: 'Market Context', summary: '시장 데이터 준비 완료, Research 2023.01–2025.06, Holdout 봉인 유지', state: 'done' },
  { id: 'backtest-start', elapsedSeconds: 15.5, agent: 'Quant Validator', summary: '백테스트 검증 중', state: 'work' },
  { id: 'backtest', elapsedSeconds: 21, agent: 'Quant Validator', summary: '백테스트 완료, 수익 +8.3%, 최대 낙폭 −12.4%, 27회', state: 'done' },
  { id: 'sanity', elapsedSeconds: 26.5, agent: 'Sanity Check', summary: '백테스트 무결성 검사, 8/8 통과', state: 'done' },
  { id: 'critic-start', elapsedSeconds: 31.5, agent: 'Strategy Critic', summary: '전략 검토 중, 과최적화, 기간 편중, 우연 가능성', state: 'work' },
  { id: 'critic', elapsedSeconds: 37.5, agent: 'Strategy Critic', summary: '개선점 1개 발견', state: 'warn', finding: {
    title: '저변동성 구간 과잉 거래',
    professional: 'Excessive trade frequency in low-volatility regimes, 10/14 losing trades.',
    plain: '시장이 거의 움직이지 않을 때도 거래해 손실 거래의 71%가 그 구간에서 발생했습니다.',
    meaning: '횡보가 길어질수록 잔손실이 누적됩니다.',
    nextAction: '저변동성 신규 진입을 제한하고 재검증합니다.',
  } },
  { id: 'revision', elapsedSeconds: 43.5, agent: 'Strategy Architect', summary: '저변동성 진입 필터 추가, Strategy v2 생성', state: 'done' },
  { id: 'retest-start', elapsedSeconds: 47.5, agent: 'Quant Validator', summary: '수정 전략 재검증 중', state: 'work' },
  { id: 'retest', elapsedSeconds: 53, agent: 'Quant Validator', summary: '재검증 완료, 최대 낙폭 −12.4% → −6.3%', state: 'done' },
  { id: 'stability', elapsedSeconds: 59, agent: 'Quant Validator', summary: '파라미터 안정성 검사, +13%, +13%, +9% → 안정 구간', state: 'done' },
  { id: 'risk', elapsedSeconds: 65, agent: 'Risk Reviewer', summary: '스트레스 테스트 완료, 8개 시나리오 중 6 Pass', state: 'warn' },
  { id: 'concentration', elapsedSeconds: 70.5, agent: 'Strategy Critic', summary: '수익 집중도, 상위 3개 거래 72%, 소수 거래 의존', state: 'warn' },
  { id: 'holdout-start', elapsedSeconds: 76, agent: 'Sealed Holdout', summary: '봉인 해제, 연구에 사용되지 않은 2025.07–2026.08 구간 검증 중', state: 'work' },
  { id: 'holdout', elapsedSeconds: 82, agent: 'Sealed Holdout', summary: 'Holdout 결과, 수익 +8.9%, 낙폭 −3.2% → 통과', state: 'done' },
  { id: 'verdict', elapsedSeconds: 87, agent: 'Research Verdict', summary: '의견 불일치 기록, Risk Reviewer Caution', state: 'done' },
  { id: 'report-start', elapsedSeconds: 91, agent: 'Explanation', summary: '최종 보고서 작성 중', state: 'work' },
  { id: 'report', elapsedSeconds: 95, agent: 'Explanation', summary: '연구 완료, 검토가 필요합니다', state: 'done' },
]

export type ResearchDocumentView = 'chat' | 'plan' | 'activity' | 'critic'

// Source engine snapshots, not generated from the user's current strategy.
export function previewCritic(seconds: number): ResearchCriticReview | undefined {
  if (seconds < 37.5) return undefined
  const revised = seconds >= 53
  return {
    version: revised ? 2 : 1,
    bestYear: '2023',
    bestYearReturn: revised ? 8.679412514551972 : 6.121521125529082,
    profitFactor: revised ? 2.0155084972978456 : 1.2302967612831663,
    initialLowVolLossShare: 71.42857142857143,
    topThreeProfitShare: revised ? 71.93506974060078 : 42.45491372558449,
    lowVolFilterApplied: revised,
    verdict: revised ? '수익성 확인. 일관성은 Holdout, Forward에서 계속 확인 필요.' : '수익성 확인. 집중도 문제 없음.',
  }
}
export const RESEARCH_TEAM = ['Strategy Architect', 'Quant Validator', 'Sanity Check', 'Strategy Critic', 'Risk Reviewer', 'Market Context', 'Explanation']

export function previewTeam(seconds: number) {
  // Role completion follows original T() events, not completion of an individual row.
  const timing: Record<string, [number, number]> = {
    'Strategy Architect': [0.9, 5.5], 'Quant Validator': [15.5, 59], 'Sanity Check': [26.5, 26.5],
    'Strategy Critic': [31.5, 37.5], 'Risk Reviewer': [65, 65], 'Market Context': [10.5, 10.5], 'Explanation': [91, 95],
  }
  return RESEARCH_TEAM.map(name => {
    const [start, end] = timing[name]
    return { name, status: seconds < start ? '대기' : seconds < end ? '작업 중' : '완료' }
  })
}

export function previewEntries(seconds: number) {
  const rows = MOCK_RESEARCH_ENTRIES.filter(row => row.elapsedSeconds <= seconds)
  return rows.map((row, index) => row.state === 'work' && index < rows.length - 1 ? { ...row, state: 'done' as const } : row)
}

type PreviewQuestion = { view: ResearchDocumentView; question: string; answer: string }
type PreviewState = { seconds: number; status: 'idle' | 'playing' | 'paused' | 'completed'; view: ResearchDocumentView; storageError: boolean; questions: PreviewQuestion[]; clockVersion?: 1; clockStartedAt?: number }

function createPreviewStore(id: string) {
  const key = `teth-research-preview:${id}`
  let state: PreviewState = { seconds: 0, status: 'idle', view: 'chat', storageError: false, questions: [] }
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null')
    if (saved && Number.isFinite(saved.seconds) && saved.seconds >= 0 && saved.seconds <= 95 && ['idle', 'playing', 'paused', 'completed'].includes(saved.status) && ['chat', 'plan', 'activity', 'critic'].includes(saved.view)) {
      const questions = Array.isArray(saved.questions) ? saved.questions.filter((row: PreviewQuestion) => row && ['plan', 'activity', 'critic'].includes(row.view) && typeof row.question === 'string' && typeof row.answer === 'string') : []
      // Old previews paused automatically on navigation. Resume those once;
      // an explicit pause made by the versioned DEV control remains a pause.
      const status = saved.status === 'paused' && saved.clockVersion !== 1 ? 'playing' : saved.status
      const clockStartedAt = status === 'playing'
        ? Number.isFinite(saved.clockStartedAt) ? saved.clockStartedAt : Date.now() - saved.seconds * 1000
        : undefined
      const seconds = clockStartedAt === undefined ? saved.seconds : Math.min(95, Math.max(saved.seconds, (Date.now() - clockStartedAt) / 1000))
      state = { seconds, status: seconds === 95 ? 'completed' : status, view: saved.view === 'critic' && seconds < 37.5 ? 'activity' : saved.view, storageError: false, questions, clockVersion: 1, clockStartedAt }
    }
  } catch { /* Unavailable cache must not block the research UI. */ }
  const listeners = new Set<() => void>()
  let savedCount = -1
  const update = (patch: Partial<PreviewState>, persist = true) => {
    state = { ...state, ...patch }
    if (persist) {
      try { sessionStorage.setItem(key, JSON.stringify(state)); state.storageError = false }
      catch { state.storageError = true }
    }
    listeners.forEach(listener => listener())
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    view: (view: ResearchDocumentView) => update({ view }),
    start: () => { if (state.status === 'idle') update({ status: 'playing', view: 'activity', seconds: 0, questions: [], clockVersion: 1, clockStartedAt: Date.now() }) },
    ask: (question: string) => {
      if (!question.trim() || state.view === 'chat') return
      const finding = previewEntries(state.seconds).find(row => row.finding)?.finding
      const review = previewCritic(state.seconds)
      const answer = state.view === 'plan'
        ? '조건 수정은 해당 행의 수정 요청에서 할 수 있어요.'
        : state.view === 'critic' && review
          ? Object.values(criticParagraphs(review)).join('\n\n')
          : finding
          ? `${finding.plain} ${finding.meaning} ${finding.nextAction}`
          : '아직 Critic 검토 기록이 도착하지 않았습니다.'
      update({ questions: [...state.questions, { view: state.view, question: question.trim(), answer }] })
    },
    resume: () => { if (state.status === 'paused') update({ status: 'playing', clockVersion: 1, clockStartedAt: Date.now() - state.seconds * 1000 }) },
    pause: () => { if (state.status === 'playing') update({ status: 'paused', seconds: Math.min(95, Math.max(state.seconds, (Date.now() - (state.clockStartedAt ?? Date.now())) / 1000)), clockStartedAt: undefined, clockVersion: 1 }) },
    finish: () => update({ seconds: 95, status: 'completed' }),
    tick: (now = Date.now()) => {
      if (state.status !== 'playing') return
      const seconds = Math.min(95, Math.max(state.seconds, Math.floor((now - (state.clockStartedAt ?? now)) / 1000)))
      if (seconds === state.seconds) return
      const count = MOCK_RESEARCH_ENTRIES.filter(row => row.elapsedSeconds <= seconds).length
      update({ seconds, status: seconds === 95 ? 'completed' : 'playing' }, count !== savedCount || seconds === 95)
      savedCount = count
    },
  }
}

// Session-owned, timer-free state survives React view changes, including when
// storage is unavailable. Hidden/unmounted views do no rendering work. The next
// observation catches up from the wall-clock anchor, never from interval counts.
const previews = new Map<string, ReturnType<typeof createPreviewStore>>()
export function getMockResearchPreview(id: string) {
  let store = previews.get(id)
  if (!store) { store = createPreviewStore(id); previews.set(id, store) }
  return store
}
export function forgetMockResearchPreview(id: string) { previews.delete(id) }

/** Fixture-only clock. Real research must render authoritative service events. */
export function useMockResearchPreview(id: string) {
  const store = useMemo(() => getMockResearchPreview(id), [id])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    if (state.status !== 'playing') return
    let timer: number | undefined
    const sync = () => {
      window.clearInterval(timer)
      if (!document.hidden) { store.tick(); timer = window.setInterval(() => store.tick(), 1000) }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync) }
  }, [state.status, store])
  return { state, store }
}
