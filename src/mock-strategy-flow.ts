// Presentation-only mock adapter for the vertical POC journey.
// This file is deliberately not an API, trading-domain contract, or execution model.

export type MockStrategyDraft = {
  id: string
  sourceIdea: string
  title: string
  market: string
  timeframe: string
  direction: string
  entry: string
  exit: string
  risk: string
  assumptions: string[]
}

export type MockStrategyChange = {
  field: '진입 조건' | '청산 조건' | '리스크'
  before: string
  after: string
  reason: string
}

export type MockStrategyRevision = {
  version: 'MOCK-v0.2'
  changes: MockStrategyChange[]
  strategy: MockStrategyDraft
}

export type MockBacktestProgress = {
  percent: number
  label: string
}

export type MockBacktestResult = {
  verdict: '조건부 통과'
  period: string
  candleCount: string
  metrics: Array<{ label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }>
  findings: string[]
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const mockDelay = () => (import.meta.env.VITE_E2E_FAST === 'true' ? 5 : 420)

export const mockStrategyFlowAdapter = {
  async structureIdea(sourceIdea: string, options?: { fail?: boolean }): Promise<MockStrategyDraft> {
    await wait(mockDelay())
    if (options?.fail) throw new Error('Mock AI 응답을 불러오지 못했습니다.')

    return {
      id: 'mock-strategy-001',
      sourceIdea,
      title: 'BTC 추세 전환 매수 · 변동성 방어',
      market: 'BTC/USDT · 선물 (Mock)',
      timeframe: '4시간봉',
      direction: '롱 전용',
      entry: '20 EMA가 60 EMA를 상향 돌파하고 RSI(14)가 55 이상일 때 다음 캔들 시가 진입',
      exit: '20 EMA 하향 이탈 또는 진입가 대비 -3% 도달 시 전량 청산',
      risk: '1회 손실 한도 자산의 1% · 레버리지 미적용',
      assumptions: [
        '수수료와 슬리피지는 각각 0.05%로 가정합니다.',
        '동일 캔들 안에서 손절과 진입이 겹치면 손절을 먼저 적용합니다.',
      ],
    }
  },

  async proposeRevision(draft: MockStrategyDraft): Promise<MockStrategyRevision> {
    await wait(mockDelay())
    const changes: MockStrategyChange[] = [
      {
        field: '진입 조건',
        before: draft.entry,
        after: '20 EMA가 60 EMA를 상향 돌파하고 RSI(14)가 55~72일 때 다음 캔들 시가 진입',
        reason: '과매수 구간의 추격 진입을 줄입니다.',
      },
      {
        field: '청산 조건',
        before: draft.exit,
        after: '20 EMA 하향 이탈 또는 ATR(14) 1.8배 손절에 도달하면 전량 청산',
        reason: '가격 수준에 따라 손절 폭이 달라지도록 보정합니다.',
      },
      {
        field: '리스크',
        before: draft.risk,
        after: '1회 손실 한도 자산의 0.75% · 동시 포지션 1개 · 레버리지 미적용',
        reason: '단일 전략의 최대 노출을 명시합니다.',
      },
    ]

    return {
      version: 'MOCK-v0.2',
      changes,
      strategy: {
        ...draft,
        entry: changes[0].after,
        exit: changes[1].after,
        risk: changes[2].after,
      },
    }
  },

  async runBacktest(
    _strategy: MockStrategyDraft,
    onProgress: (progress: MockBacktestProgress) => void,
    options?: { fail?: boolean },
  ): Promise<MockBacktestResult> {
    const checkpoints: MockBacktestProgress[] = [
      { percent: 18, label: 'Mock 캔들 검증' },
      { percent: 46, label: '진입·청산 규칙 재생' },
      { percent: 74, label: '수수료·슬리피지 반영' },
      { percent: 100, label: 'Mock 결과 요약' },
    ]

    for (const checkpoint of checkpoints) {
      await wait(mockDelay())
      onProgress(checkpoint)
      if (options?.fail && checkpoint.percent === 46) {
        throw new Error('Mock 시계열 처리 중 연결이 끊겼습니다.')
      }
    }

    return {
      verdict: '조건부 통과',
      period: '2024.01.01—2025.12.31 (Mock)',
      candleCount: '4,380개 Mock 캔들',
      metrics: [
        { label: '누적 수익률', value: '+24.8%', tone: 'positive' },
        { label: '최대 낙폭', value: '-11.6%', tone: 'negative' },
        { label: '승률', value: '58.2%', tone: 'neutral' },
        { label: '총 거래', value: '146회', tone: 'neutral' },
      ],
      findings: [
        '횡보 구간에서는 4회 연속 손실이 발생했습니다.',
        '수수료를 두 배로 높이면 누적 수익률은 +17.1%로 감소합니다.',
        '실제 주문 전에는 거래소별 최소 주문 수량과 레버리지 제한 검증이 필요합니다.',
      ],
    }
  },
}
