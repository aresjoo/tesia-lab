/** Client source acccc7f: tf* / teth-copy.js. UI fixtures only, never an execution contract. */
export const delegationQuestions = [
  { key: 'asset', title: '어떤 자산으로 할까요?', description: '대화하던 자산을 기본으로 잡았어요', options: [['비트코인', '대장 코인'], ['이더리움', '2위 코인'], ['테슬라', '미국 성장주'], ['나스닥', '미국 기술주 지수']], recommended: 0 },
  { key: 'style', title: '어떤 성향이 편하세요?', description: '수익을 크게 노릴수록 흔들림도 커져요', options: [['공격적으로', '수익 우선, 흔들림 감수'], ['중립적으로', '수익과 안정의 균형'], ['안전하게', '작게 벌어도 잃지 않게']], recommended: 1 },
  { key: 'budget', title: '어느 정도 예산으로 시작할까요?', description: '검증 리포트의 수익 시뮬레이션에 쓰여요', options: [['100만원', '가볍게 시작'], ['500만원', '표준'], ['1,000만원', '본격적으로'], ['3,000만원 이상', '크게']], recommended: 1 },
  { key: 'period', title: '어느 기간의 시장으로 검증할까요?', description: '길수록 더 다양한 장세를 겪은 전략이 돼요', options: [['최근 1년', '최신 장세 위주'], ['최근 2년', '상승과 하락 모두'], ['전체 기간', '2023년부터 전부']], recommended: 1 },
  { key: 'stop', title: '얼마까지 떨어지면 멈출까요?', description: '이 선에 닿으면 자동으로 정리하고 지켜드려요', options: [['-3%까지', '짧게 끊기'], ['-5%까지', '표준'], ['-8%까지', '여유있게'], ['-12%까지', '길게 버티기']], recommended: 1 },
] as const
export type DelegationQuestionKey = typeof delegationQuestions[number]['key']
export type DelegationAnswer = { index: number; label: string; recommended: boolean }
export type DelegationAnswers = Partial<Record<DelegationQuestionKey, DelegationAnswer>>
export const delegationBudgets = [1000000, 5000000, 10000000, 30000000]
export const delegationSteps = ['시장 데이터 불러오기', '전략 조건 분석', '과거 시장에서 시뮬레이션', '위험도 계산', 'TETH Score 산출']
export const delegationPrices = { month: 599000, year: 5000000 }
export const delegationExchanges = [
  { id: 'binance', name: 'Binance', apiGuide: ['바이낸스 로그인 후 프로필 아이콘, 계정 설정으로 이동', 'API 관리(API Management) 메뉴에서 Create API 선택', '라벨에 TETH 입력 후 생성, 보안 인증 완료', 'Enable Reading과 Enable Spot Trading만 체크 (출금 권한은 켜지 마세요)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'okx', name: 'OKX', apiGuide: ['OKX 로그인 후 프로필, API 메뉴로 이동', 'API 키 생성 선택, 이름에 TETH 입력', '권한은 읽기와 거래만 선택 (출금 제외)', '패스프레이즈 설정 후 생성', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
  { id: 'woox', name: 'WOO X', apiGuide: ['WOO X 로그인 후 계정, API 관리로 이동', 'Create API Key 선택', '권한은 Read와 Trade만 허용 (Withdraw 제외)', 'API Key와 Secret Key를 복사해 아래에 붙여넣기'] },
] as const
// Explicitly deterministic visual fixtures, not calculated research or trading outcomes.
export const delegationResultFixtures = [
  { score: 74, ret: 12.8, mdd: -15.2, winRate: 54.2, n: 48, sharpe: 0.82, pf: 1.24, cagr: 6.2 },
  { score: 86, ret: 21.4, mdd: -8.6, winRate: 63.4, n: 52, sharpe: 1.62, pf: 2.01, cagr: 10.2 },
] as const
export const delegationChartFixture = Array.from({ length: 181 }, (_, i) => {
  const center = 42000 + i * 182 + Math.sin(i * .13) * 6400 + Math.sin(i * .63) * 1750
  const open = center + Math.sin(i * 1.73) * 900
  const close = center + Math.cos(i * 1.41) * 1100
  return { open, close, high: Math.max(open, close) + 680, low: Math.min(open, close) - 730, volume: 22 + Math.abs(Math.sin(i * .76)) * 58 }
})
export const delegationTradeFixture = [12, 25, 38, 50, 64, 77, 90, 104, 118, 129, 141, 153, 166, 174]
export const delegationRiskCopy = '과거 수익이 미래 수익을 보장하지 않습니다. 모든 투자의 책임은 본인에게 있습니다.'

export type DelegationUiSnapshot = {
  page: 'intake' | 'backtest' | 'report' | 'connect'
  answers: DelegationAnswers
  questionIndex: number
  attempt: number
  workStep: number
  workStartedAt?: number
  expert: boolean
  chartInterval: string
}
const uiKey = (sessionId: string) => `teth:client-delegation:${sessionId}`
// Same-page fallback only, populated exclusively by the allow-listed serializer.
// Never retain connection/payment fields here, even in memory.
const uiMemory = new Map<string, string>()
export function forgetDelegationUiMemory(sessionId: string) { uiMemory.delete(sessionId) }
/** Allow-list only. Never persist onboarding fields, credentials, UID, card data or key fragments. */
export function readDelegationUi(sessionId: string): DelegationUiSnapshot | undefined {
  try {
    const parsed: unknown = JSON.parse(uiMemory.get(sessionId) ?? sessionStorage.getItem(uiKey(sessionId)) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return
    const value = parsed as Record<string, unknown>
    if (!['intake', 'backtest', 'report', 'connect'].includes(String(value.page))) return
    const answers: DelegationAnswers = {}
    const raw = value.answers && typeof value.answers === 'object' ? value.answers as Record<string, unknown> : {}
    let count = 0
    for (const question of delegationQuestions) {
      const answer = raw[question.key]
      if (!answer || typeof answer !== 'object') break
      const index = (answer as Record<string, unknown>).index
      if (typeof index !== 'number' || !Number.isInteger(index) || !question.options[index]) break
      answers[question.key] = { index, label: question.options[index][0], recommended: (answer as Record<string, unknown>).recommended === true }
      count++
    }
    const attempt = typeof value.attempt === 'number' && Number.isInteger(value.attempt) ? Math.max(0, Math.min(5, value.attempt)) : 0
    const workStep = typeof value.workStep === 'number' && Number.isInteger(value.workStep) ? Math.max(0, Math.min(5, value.workStep)) : 0
    const page = count < 5 ? 'intake' : (value.page === 'report' || value.page === 'connect') && attempt < 1 ? 'backtest' : value.page as DelegationUiSnapshot['page']
    return { page, answers, questionIndex: count, attempt, workStep, workStartedAt: typeof value.workStartedAt === 'number' && Number.isFinite(value.workStartedAt) ? value.workStartedAt : undefined, expert: value.expert === true, chartInterval: ['1D', '1W', '1M'].includes(String(value.chartInterval)) ? String(value.chartInterval) : '1D' }
  } catch { return }
}
export function saveDelegationUi(sessionId: string, snapshot: DelegationUiSnapshot): boolean {
  try {
    const answers = Object.fromEntries(delegationQuestions.filter(q => snapshot.answers[q.key]).map(q => { const answer = snapshot.answers[q.key]!; return [q.key, { index: answer.index, recommended: answer.recommended }] }))
    const raw = JSON.stringify({ page: snapshot.page, answers, questionIndex: snapshot.questionIndex, attempt: snapshot.attempt, workStep: snapshot.workStep, workStartedAt: snapshot.workStartedAt, expert: snapshot.expert, chartInterval: snapshot.chartInterval })
    uiMemory.set(sessionId, raw)
    sessionStorage.setItem(uiKey(sessionId), raw)
    return true
  } catch { return false }
}
