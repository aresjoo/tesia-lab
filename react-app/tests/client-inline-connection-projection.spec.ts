import { expect, test } from '@playwright/test'
import type { ClientSession, ClientTurn } from '../src/client-experience-store'
import { inlineConnectionMatches, projectInlineConnectionUi, type InlineBacktestRecord } from '../src/client-inline-backtest'
import type { DelegationUiSnapshot } from '../src/client-delegation-fixtures'
import { sourceTerminalPrices, type NormalizedSourceTerminalParameters } from '../src/client-terminal-source-fixture'

// Public source-preview projection only. It is not service validation,
// registration authority, an exchange connection, or an execution grant.
const parameters: NormalizedSourceTerminalParameters = {
  sl: -5,
  tp: 12,
  rsiTh: 44,
  trendFilter: true,
  startI: 61,
  endI: sourceTerminalPrices.length - 1,
}

function turn(id = 'inline-turn'): ClientTurn {
  return {
    id,
    question: 'ETH 추세 1시간봉 손절 5%, 익절 12%',
    answer: '검증 완료',
    fullAnswer: '검증 완료',
    startedAt: 1_700_000_000_000,
    finishedAt: 1_700_000_002_000,
    status: 'done',
    suggestions: [],
    phase: 'plan',
    inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters },
  }
}

function record(source = turn(), ordinal = 7): InlineBacktestRecord {
  return { pair: 'ETH/USDT', timeframe: '1시간봉', parameters, turnId: source.id, ordinal, completedAt: source.finishedAt! + 1_100 }
}

function session(marker: string | null = 'inline-turn'): ClientSession {
  const source = turn(), result = record(source)
  return {
    id: 'projection-session',
    title: '인라인 연결',
    renamed: false,
    idea: source.question,
    draft: '보존할 초안',
    pair: 'BTC/USDT',
    mode: 'dip',
    timeframe: '일봉',
    risk: '−3%',
    takeProfit: '+8%',
    researchStatus: '초안',
    phase: 'plan',
    turns: [source],
    updatedAt: 1_700_000_010_000,
    workspace: 'delegation',
    tradingReady: false,
    inlineResults: [result],
    ...(marker === null ? {} : { inlineConnectionTurnId: marker }),
  }
}

function stored(overrides: Partial<DelegationUiSnapshot> = {}): DelegationUiSnapshot {
  return {
    inlineResult: true,
    inlineTurnId: 'inline-turn',
    page: 'connect',
    answers: {
      asset: { index: 1, label: '이더리움', recommended: false },
      style: { index: 1, label: '중립적으로', recommended: false },
      budget: { index: 1, label: '500만원', recommended: false },
      period: { index: 2, label: '전체 기간', recommended: false },
      stop: { index: 1, label: '-5%까지', recommended: false },
    },
    questionIndex: 5,
    attempt: 7,
    workStep: 5,
    expert: false,
    chartInterval: '1D',
    parameters,
    ...overrides,
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

test('선택 marker가 없는 legacy 세션은 기존 delegation snapshot을 그대로 반환한다', () => {
  const legacy = stored({ page: 'report' })
  expect(projectInlineConnectionUi(session(null), legacy)).toBe(legacy)
  expect(projectInlineConnectionUi(session(null))).toBeUndefined()
})

test('marker는 정제된 완료 결과에서만 고정 연결 projection을 만든다', () => {
  const input = session()
  const actual = projectInlineConnectionUi(input)
  expect(actual).toEqual({
    inlineResult: true,
    inlineTurnId: 'inline-turn',
    page: 'connect',
    answers: {
      asset: { index: 1, label: '이더리움', recommended: false },
      style: { index: 1, label: '중립적으로', recommended: false },
      budget: { index: 1, label: '500만원', recommended: false },
      period: { index: 2, label: '전체 기간', recommended: false },
      stop: { index: 1, label: '-5%까지', recommended: false },
    },
    questionIndex: 5,
    attempt: 7,
    workStep: 5,
    expert: false,
    chartInterval: '1D',
    parameters,
  })
  expect(inlineConnectionMatches(input, actual)).toBe(true)
})

test('같은 결과와 일치한 저장값에서도 표시 선택만 보존하고 권위 필드와 임의 필드는 폐기한다', () => {
  const input = session()
  const prior = {
    ...stored({
      page: 'report',
      expert: true,
      chartInterval: '1W',
      attempt: 999,
      answers: { ...stored().answers, budget: { index: 3, label: '저장값은 권위가 아님', recommended: true } },
    }),
    apiKey: 'must-not-project',
    secretKey: 'must-not-project',
  } as DelegationUiSnapshot & { apiKey: string; secretKey: string }
  const actual = projectInlineConnectionUi(input, prior)!
  expect(actual).toMatchObject({ page: 'report', expert: true, chartInterval: '1W', attempt: 7,
    answers: { budget: { index: 1, label: '500만원', recommended: false } }, parameters })
  expect(Object.hasOwn(actual, 'apiKey')).toBe(false)
  expect(Object.hasOwn(actual, 'secretKey')).toBe(false)
  expect(projectInlineConnectionUi(input, stored({ page: 'backtest', expert: true, chartInterval: '1M' }))).toMatchObject({
    page: 'connect', expert: true, chartInterval: '1M',
  })
})

test('다른 결과·파라미터의 저장 projection은 표시 상태까지 이어받지 않는다', () => {
  const actual = projectInlineConnectionUi(session(), stored({
    page: 'report',
    expert: true,
    chartInterval: '1M',
    parameters: { ...parameters, sl: -3 },
  }))!
  expect(actual).toMatchObject({ page: 'connect', expert: false, chartInterval: '1D', parameters: { sl: -5 } })
})

test('잘못된 marker와 활성 shared copy는 delegation 연결로 승격하지 않는다', () => {
  expect(projectInlineConnectionUi(session('missing-turn'), stored())).toBeUndefined()
  const detached = session()
  detached.inlineResults = [{ ...detached.inlineResults![0], completedAt: detached.turns[0].finishedAt! + 1_099 }]
  expect(projectInlineConnectionUi(detached, stored())).toBeUndefined()
  const shared = session()
  shared.sharedCopy = { owner: 'owner@example.test', nick: 'source', confirmedAt: 1_700_000_000_000, returnId: null, active: true }
  expect(projectInlineConnectionUi(shared, stored())).toBeUndefined()
})

test('projection은 세션·결과·저장 snapshot을 변경하거나 객체를 재사용하지 않는다', () => {
  const input = deepFreeze(session()), prior = deepFreeze(stored({ page: 'report', expert: true }))
  const beforeSession = JSON.stringify(input), beforeStored = JSON.stringify(prior)
  const actual = projectInlineConnectionUi(input, prior)!
  expect(JSON.stringify(input)).toBe(beforeSession)
  expect(JSON.stringify(prior)).toBe(beforeStored)
  expect(actual).not.toBe(prior)
  expect(actual.parameters).not.toBe(input.inlineResults![0].parameters)
  expect(actual.answers).not.toBe(prior.answers)
})
