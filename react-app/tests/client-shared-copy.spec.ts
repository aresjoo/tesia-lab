import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { prepareSharedCopy, type SharedCopyRequest } from '../src/client-shared-copy'
import { sourceSharedStrategies, sharedPeriodResult } from '../src/client-shared-strategies'
import { delegationBudgets, delegationQuestions, saveDelegationUi, readDelegationUi, forgetDelegationUiMemory } from '../src/client-delegation-fixtures'
import { canResumeDelegationConnection } from '../src/client-delegation-connection'

const rows = sourceSharedStrategies()
const request = (): SharedCopyRequest => ({ nick: rows[0].nick, budgetIndex: 1, sl: -5, tp: 12 })

for (const row of rows) for (let budgetIndex = 0; budgetIndex < 4; budgetIndex++) {
  test(`${row.nick} · 예산 ${budgetIndex}: 전체 원본 조건과 실제 자산을 새 미완료 검증으로 전달`, () => {
    const actual = prepareSharedCopy({ nick: row.nick, budgetIndex, sl: -12, tp: 15 }, 123456)
    expect(actual.row).toEqual(row)
    expect(actual.ui).toMatchObject({ page: 'backtest', questionIndex: 5, attempt: 0, workStep: 0, workStartedAt: 123456, expert: false, chartInterval: '1D' })
    expect(actual.ui.parameters).toEqual({ ...row.parameters, sl: -12, tp: 15 })
    expect(actual.ui.pendingParameters).toEqual(actual.ui.parameters)
    expect(actual.ui.pendingParameters).not.toBe(actual.ui.parameters)
    expect(actual.ui.answers.asset?.label).toBe(row.asset)
    expect(actual.ui.answers.budget?.index).toBe(budgetIndex)
    expect(delegationBudgets[actual.ui.answers.budget!.index]).toBe([1000000, 5000000, 10000000, 30000000][budgetIndex])
    expect(actual.ui.answers.period?.index).toBe(row.parameters.startI! > 61 ? 1 : 2)
    expect(actual.ui.answers.style?.index).toBe(1)
    for (const question of delegationQuestions) {
      const answer = actual.ui.answers[question.key]!
      expect(answer.label).toBe(question.options[answer.index][0])
    }
    expect(canResumeDelegationConnection(actual.ui)).toBe(false)
  })
}

test('허용 손절/익절 16개 조합만 보존하고 입력과 원본을 변경하지 않는다', () => {
  const before = JSON.stringify(rows)
  for (const sl of [-3, -5, -8, -12]) for (const tp of [8, 10, 12, 15]) {
    const input = Object.freeze({ ...request(), sl, tp }), serialized = JSON.stringify(input)
    const output = prepareSharedCopy(input, 0)
    expect(output.ui.parameters).toMatchObject({ sl, tp })
    expect(JSON.stringify(input)).toBe(serialized)
  }
  expect(JSON.stringify(sourceSharedStrategies())).toBe(before)
})

test('각 호출의 row/result/parameters는 이전 출력의 변경에 영향받지 않는다', () => {
  const first = prepareSharedCopy(request(), 10)
  first.row.parameters.rsiTh = 999
  first.row.result.eq[0].v = 999
  first.ui.parameters!.sl = -999
  first.ui.pendingParameters!.tp = 999
  const second = prepareSharedCopy(request(), 11)
  expect(second.row).toEqual(rows[0])
  expect(second.ui.parameters).toMatchObject({ sl: -5, tp: 12 })
  expect(second.ui.pendingParameters).toEqual(second.ui.parameters)
})

test('상세 1년 보기나 요청의 위조 결과/기간은 복제 원본 구간에 관여하지 않는다', () => {
  const row = rows.find(candidate => candidate.parameters.startI === 61)!
  const short = sharedPeriodResult(row, '1y')
  expect(short.params.startI).not.toBe(row.parameters.startI)
  const input = { ...request(), nick: row.nick, score: 100, price: 1, parameters: short.params, period: '1y' }
  const { ui } = prepareSharedCopy(input, 1)
  expect(ui.parameters?.startI).toBe(61)
  expect(Object.keys(ui).sort()).toEqual(['answers', 'attempt', 'chartInterval', 'expert', 'page', 'parameters', 'pendingParameters', 'questionIndex', 'workStartedAt', 'workStep'])
})

test('누락·알 수 없는 전략·문자 숫자·비유한 값·허용 밖 설정을 거절한다', () => {
  for (const bad of [null, undefined, {}, { ...request(), nick: '' }, { ...request(), nick: '미공급' }, { ...request(), nick: ` ${rows[0].nick}` },
    ...[-1, 4, .5, NaN, Infinity, '1', null].map(budgetIndex => ({ ...request(), budgetIndex })),
    ...[-4, 3, NaN, Infinity, '-5', null].map(sl => ({ ...request(), sl })),
    ...[0, 9, -8, NaN, Infinity, '8', null].map(tp => ({ ...request(), tp }))]) {
    expect(() => prepareSharedCopy(bad as SharedCopyRequest, 1)).toThrow(RangeError)
  }
  for (const now of [NaN, Infinity, -Infinity, '1', null, undefined]) expect(() => prepareSharedCopy(request(), now as number)).toThrow(RangeError)
})

test('허용 직렬화 후 메모리를 비운 실제 restore에서도 자산·예산·파라미터가 동일하다', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'), data = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } })
  try {
    for (const [index, row] of rows.entries()) {
      const id = `shared-copy-roundtrip-${index}`, { ui } = prepareSharedCopy({ ...request(), nick: row.nick, budgetIndex: index % 4 }, 123)
      expect(saveDelegationUi(id, ui)).toBe(true)
      forgetDelegationUiMemory(id)
      expect(readDelegationUi(id)).toEqual(ui)
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

test('준비 함수는 브라우저·저장소·타이머·네트워크 없이 호출된다', () => {
  const compiled = ts.transpileModule(readFileSync('src/client-shared-copy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports: Record<string, typeof prepareSharedCopy> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: (name: string) => name.includes('fixtures') ? { delegationQuestions }
    : name.includes('strategies') ? { sourceSharedStrategies }
      : { normalizeSourceTerminalParameters: (p: object) => ({ ...p }) },
    fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  for (const name of ['window', 'document', 'sessionStorage', 'localStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  runInNewContext(compiled, context, { timeout: 1000 })
  expect(exports.prepareSharedCopy(request(), 1).ui.workStep).toBe(0)
  expect(touches).toEqual([])
})
