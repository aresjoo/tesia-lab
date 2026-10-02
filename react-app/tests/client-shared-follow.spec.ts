import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { decodeSharedFollow, describeSharedFollow, type SharedFollowRecord } from '../src/client-shared-follow'
import { delegationQuestions, type DelegationUiSnapshot } from '../src/client-delegation-fixtures'
import { delegationParameters, delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'

const record = (): SharedFollowRecord => ({ id: 'follow-1', owner: 'preview:a', nick: '세븐틴층', asset: '비트코인',
  parameters: delegationRecommendedParameters(), budgetIndex: 1, confirmedAt: 1000, sessionId: 'session-1', active: true })
const snapshot = (): DelegationUiSnapshot => ({ page: 'backtest', questionIndex: 5, attempt: 0, workStep: 5,
  workStartedAt: 1000, expert: false, chartInterval: '1D', parameters: delegationRecommendedParameters(),
  answers: Object.fromEntries(delegationQuestions.map(question => [question.key, { index: question.recommended, label: question.options[question.recommended][0], recommended: true }])) })
const view = (label: string, active = true, running = false) => ({ label, active, running })

test('레코드 직렬화 왕복과 허용 필드 투영은 중첩 비공급 필드도 버린다', () => {
  const value = { ...record(), ignoredPrivateFixture: 'discard', score: 99, running: true,
    parameters: { ...record().parameters, ignoredPrivateFixture: 'discard' } }
  const before = JSON.stringify(value), decoded = decodeSharedFollow(value)!
  expect(decoded).toEqual(record())
  expect(decodeSharedFollow(JSON.parse(JSON.stringify(decoded)))).toEqual(decoded)
  expect(decoded.parameters).not.toBe(value.parameters)
  expect(JSON.stringify(value)).toBe(before)
  expect(JSON.stringify(decoded)).not.toContain('discard')
})

test('기존 일반 source 파라미터의 추천·임의 손절·null 익절을 허용한다', () => {
  for (const sl of [-.001, -4, -99.9]) for (const tp of [null, .001, 17.25]) {
    const value = { ...record(), parameters: { ...record().parameters, sl, tp } }
    expect(decodeSharedFollow(value)?.parameters).toEqual(value.parameters)
  }
})

test('식별자·예산·날짜·active는 보정 없이 엄격한 범위로 제한한다', () => {
  for (const [key, limit] of [['id', 200], ['owner', 320], ['nick', 120], ['asset', 120], ['sessionId', 200]] as const) {
    expect(decodeSharedFollow({ ...record(), [key]: '가'.repeat(limit) })).toBeDefined()
    for (const bad of ['', ' ', ' a', 'a ', 'a\nb', 'a\u0000b', 'a\u007fb', '가'.repeat(limit + 1), null, 1]) expect(decodeSharedFollow({ ...record(), [key]: bad })).toBeUndefined()
  }
  for (const budgetIndex of [0, 1, 2, 3]) expect(decodeSharedFollow({ ...record(), budgetIndex })).toBeDefined()
  for (const budgetIndex of [-1, 4, .5, NaN, Infinity, '1', null]) expect(decodeSharedFollow({ ...record(), budgetIndex })).toBeUndefined()
  for (const confirmedAt of [0, 8.64e15]) expect(decodeSharedFollow({ ...record(), confirmedAt })).toBeDefined()
  for (const confirmedAt of [-1, .1, NaN, Infinity, 8.64e15 + 1, '1000', null]) expect(decodeSharedFollow({ ...record(), confirmedAt })).toBeUndefined()
  for (const active of [0, 1, 'true', null, undefined]) expect(decodeSharedFollow({ ...record(), active })).toBeUndefined()
  for (const bad of [null, undefined, [], {}, 'record']) expect(decodeSharedFollow(bad)).toBeUndefined()
})

test('원본 PRICE 구간 경계·역순·소수·누락·잘못된 source 조건을 거절한다', () => {
  const p = record().parameters
  expect(decodeSharedFollow({ ...record(), parameters: { ...p, startI: 61, endI: 61 } })).toBeDefined()
  expect(decodeSharedFollow({ ...record(), parameters: { ...p, startI: sourceTerminalPrices.length - 1 } })).toBeDefined()
  for (const change of [{ startI: 60 }, { startI: -365 }, { startI: 61.5 }, { startI: undefined }, { endI: undefined }, { endI: null }, { endI: 60 }, { endI: sourceTerminalPrices.length }, { startI: 900, endI: 800 }, { sl: 0 }, { sl: -100 }, { tp: 0 }, { tp: NaN }, { rsiTh: 101 }, { trendFilter: 1 }]) {
    expect(decodeSharedFollow({ ...record(), parameters: { ...p, ...change } })).toBeUndefined()
  }
})

for (const [status, label, running] of [['live', '실행 중', true], ['off', '실행 꺼짐', false], ['ready', '실행 준비', false], ['err', '실행 오류', false], ['error', '실행 오류', false], ['unknown', '실행 상태 확인 필요', false]] as const) {
  test(`상위 결속 등록 ${status}만 표시하며 검증 snapshot이 상태를 덮지 않는다`, () => {
    expect(describeSharedFollow(record(), undefined, { status })).toEqual(view(label, true, running))
    expect(describeSharedFollow(record(), { ...snapshot(), recoveryRequired: true }, { status })).toEqual(view(label, true, running))
    expect(describeSharedFollow({ ...record(), active: false }, snapshot(), { status })).toEqual(view('보관됨', false))
  })
}

test('검증 중은 활성귀속이지만 실행 중이 아니며 누락 UI도 활성귀속을 보존한다', () => {
  expect(describeSharedFollow(record(), undefined)).toEqual(view('검증 확인 필요'))
  for (const workStep of [0, 1, 4]) expect(describeSharedFollow(record(), { ...snapshot(), workStep })).toEqual(view('검증 중'))
  expect(describeSharedFollow(record(), { ...snapshot(), page: 'intake', parameters: undefined, answers: {}, questionIndex: 0 })).toEqual(view('조건 입력 중'))
})

test('완료 시 현재 p로 80/52를 재계산하고 저장 메타데이터 점수를 믿지 않는다', () => {
  const ui = snapshot(), low = delegationParameters(ui.answers)
  expect(evaluateDelegation(ui.parameters!, 5000000).score).toBe(80)
  expect(evaluateDelegation(low, 5000000).score).toBe(52)
  expect(describeSharedFollow(record(), ui)).toEqual(view('검증 통과'))
  expect(describeSharedFollow(record(), { ...ui, parameters: low, ...{ score: 99 } })).toEqual(view('조정 중'))
  expect(describeSharedFollow(record(), { ...ui, parameters: low, pendingParameters: ui.parameters })).toEqual(view('검증 통과'))
  expect(describeSharedFollow(record(), { ...ui, pendingParameters: low })).toEqual(view('조정 중'))
  expect(describeSharedFollow(record(), { ...ui, page: 'report' })).toEqual(view('리포트 확인'))
  expect(describeSharedFollow(record(), { ...ui, page: 'connect' })).toEqual(view('연결 단계'))
})

test('손상·미공급 설정/답변·미완료 report/connect는 fail-closed다', () => {
  const ui = snapshot()
  for (const change of [{ recoveryRequired: true }, { parameters: undefined }, { parameters: null }, { pendingParameters: { ...ui.parameters, endI: 9999 } }, { parameters: { ...ui.parameters, sl: 0 } }, { page: 'done' }, { page: 'unknown' }, { questionIndex: 4 }, { answers: {} }, { workStep: -1 }, { workStep: 6 }, { workStep: 1.5 }, { workStep: 0, workStartedAt: undefined }, { page: 'report', workStep: 4 }, { page: 'connect', workStep: 0 }]) {
    expect(describeSharedFollow(record(), { ...ui, ...change } as DelegationUiSnapshot)).toEqual(view('검증 확인 필요'))
  }
  for (const budget of [-1, 4, 1.5, NaN, '1']) expect(describeSharedFollow(record(), { ...ui, answers: { ...ui.answers, budget: { index: budget, label: '500만원', recommended: true } } } as DelegationUiSnapshot)).toEqual(view('검증 확인 필요'))
})

test('투영은 입력 레코드/중첩 설정을 변경하지 않고 순수하게 반복된다', () => {
  const r = record(), ui = snapshot(), before = JSON.stringify({ r, ui })
  Object.freeze(r.parameters); Object.freeze(r); Object.freeze(ui.parameters); Object.freeze(ui)
  expect(describeSharedFollow(r, ui)).toEqual(describeSharedFollow(r, ui))
  expect(JSON.stringify({ r, ui })).toBe(before)
})

test('모듈 로딩은 타이머·저장소·브라우저·네트워크를 접근하지 않는다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: () => ({}), fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  for (const name of ['window', 'document', 'sessionStorage', 'localStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  const compiled = ts.transpileModule(readFileSync('src/client-shared-follow.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 })
  expect(Object.keys(exports).sort()).toEqual(['decodeSharedFollow', 'describeSharedFollow'])
  expect(touches).toEqual([])
})
