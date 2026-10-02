import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import { decodeSourceUserStrategyRecord, isSourceUserStrategyId, SOURCE_USER_STRATEGY_PASS_SCORE, type SourceUserStrategyRecord } from '../src/client-user-strategy'
import { projectSourceUserStrategy, selectSourceUserStrategyActivity, type SourceUserStrategyActivity } from '../src/client-user-strategy-view'
import { evaluateSourceTerminal, sourceTerminalSeeds } from '../src/client-terminal-source-fixture'
import type { SourceAccountFill, SourceAccountReview } from '../src/client-account-event-state'

const createdAt = 1_700_000_000_000
const record: SourceUserStrategyRecord = {
  id: String(createdAt), createdAt, name: '비트코인 위임 전략', status: 'live', environment: 'paper',
  parameters: { ...sourceTerminalSeeds[0].parameters }, score: 90, ret: 10.2, mdd: -8.1, n: 12, winRate: 65,
  origin: '원본 전략', exchangeName: 'Binance',
}
const normalize = (value: unknown) => JSON.parse(JSON.stringify(value))

// Source 42a0d81 index.html tfBotView statements, executed without its HTML/DOM/render body.
// b is the source record shape; t contains supplied event ledgers only.
const originalDisplay = `
var botId=String(b.at);
var fills=(t.fillLog||[]).filter(function(f){ return String(f.botId)===botId; });
var revs=t.reviews.filter(function(r){ return String(r.botId)===botId; });
var env=b.status==='ready'?'ready':(b.status==='off'?'stop':(b.env==='paper'?'paper':'live'));
var envL={ready:'시작 대기',stop:'중지됨',paper:'가상 실행',live:'라이브 (시뮬레이션)'}[env];
var rb=t.rebates.filter(function(r){ return String(r.botId)===botId; }).reduce(function(a,r){ return a+r.amt; },0);
var p=b.p;
var ruleTxt='RSI '+p.rsiTh+' 눌림 진입, 손절 '+p.sl+'%, '+(p.tp!=null?'익절 +'+p.tp+'%':'기간 청산')+(p.trendFilter?', 추세 필터':'');
({env:env,envL:envL,ruleTxt:ruleTxt,fills:fills,revs:revs,rb:rb});`

test('eager decoder는 가격 fixture/evaluator를 로드하거나 호출하지 않는다', () => {
  const text = readFileSync('src/client-user-strategy.ts', 'utf8')
  const compiled = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports: Record<string, unknown> = {}
  let imports = 0
  runInNewContext(compiled, { exports, require: () => { imports++; throw new Error('Eager engine import') } }, { timeout: 100 })
  expect(imports).toBe(0)
  expect(typeof exports.decodeSourceUserStrategyRecord).toBe('function')
  expect(SOURCE_USER_STRATEGY_PASS_SCORE).toBe(80)
})

test('원본 사용자 봇 환경·규칙 문구를 6개 상태 조합에서 그대로 투영한다', () => {
  for (const status of ['ready', 'off', 'live'] as const) for (const environment of ['paper', 'live'] as const) {
    const input = { ...record, status, environment }
    const model = projectSourceUserStrategy(input)!
    const source = runInNewContext(originalDisplay, { b: { ...input, at: input.createdAt, env: input.environment, p: input.parameters }, t: { fillLog: [], reviews: [], rebates: [] } }, { timeout: 100 })
    expect({ env: model.environmentKey, envL: model.environmentLabel, ruleTxt: model.ruleText }).toEqual({ env: source.env, envL: source.envL, ruleTxt: source.ruleTxt })
    expect(model.record).toEqual(input)
  }
  const noTp = projectSourceUserStrategy({ ...record, parameters: { ...record.parameters, tp: null, trendFilter: false } })!
  expect(noTp.ruleText).toBe('RSI 40 눌림 진입, 손절 -5%, 기간 청산')
})

test('파라미터 없는 저장 결과는 그대로 보존하고 곡선·신호를 발명하지 않는다', () => {
  const input = { ...record, parameters: null, score: 84, ret: 36.7, n: 97 }
  const model = projectSourceUserStrategy(input)!
  expect(model.record).toEqual(input)
  expect(model.evaluation).toBeNull()
  expect(model.ruleText).toBeNull()
  expect(projectSourceUserStrategy(null)).toBeNull()
  expect(projectSourceUserStrategy(undefined)).toBeNull()
})

test('공급 파라미터별 r/L은 기존 원본 engine 결과와 같고 금액·계정 체결을 노출하지 않는다', () => {
  for (const seed of sourceTerminalSeeds) {
    const model = projectSourceUserStrategy({ ...record, parameters: seed.parameters })!
    const expected = evaluateSourceTerminal(seed.parameters, 1)
    expect(model.evaluation).toEqual({ r: expected.r, L: expected.L })
    expect(Object.keys(model.evaluation!)).toEqual(['r', 'L'])
    expect(model.record.ret).toBe(record.ret) // Reproduction never overwrites the stored snapshot.
    expect(model.record.parameters).toEqual(seed.parameters)
  }
})

test('원본 손절 비율을 계정 누적 MDD 한도로 잘못 설명하지 않는다', () => {
  const model = projectSourceUserStrategy(record)!
  expect(Math.abs(model.evaluation!.r.mdd)).toBeGreaterThan(Math.abs(record.parameters!.sl))
  expect(model.ruleText).not.toContain('관리된 낙폭')
  expect(model.ruleText).not.toContain('보장')
})

test('ID는 원본 at와 같은 숫자 문자열이며 교차 record·demo·불완전 수치를 거부한다', () => {
  for (const id of ['demo:d1', 'user:1700000000000', '01700000000000', '1e12', '../bad', 'abc', '-1', '']) {
    expect(isSourceUserStrategyId(id)).toBe(false)
    expect(decodeSourceUserStrategyRecord({ ...record, id })).toBeNull()
  }
  expect(projectSourceUserStrategy({ ...record, createdAt: createdAt + 1 })).toBeNull()
  for (const value of [NaN, Infinity, -1, .5]) expect(projectSourceUserStrategy({ ...record, n: value })).toBeNull()
  for (const [key, value] of [['score', 101], ['mdd', 1], ['ret', -101], ['winRate', 101], ['status', 'err'], ['environment', 'production'], ['parameters', undefined], ['origin', {}], ['name', ' ']] as const) {
    expect(projectSourceUserStrategy({ ...record, [key]: value })).toBeNull()
  }
  expect(projectSourceUserStrategy({ ...record, status: Object.create(null) })).toBeNull()
  expect(projectSourceUserStrategy({ ...record, environment: Object.create(null) })).toBeNull()
})

test('잘못된 파라미터/구간은 폴백 계산 없이 거부하고 음수 시작 인덱스는 원본대로 정규화한다', () => {
  for (const p of [null, {}, { sl: -5 }, { ...record.parameters, sl: NaN }, { ...record.parameters, sl: 0 }, { ...record.parameters, tp: -1 }, { ...record.parameters, trendFilter: 1 }, { ...record.parameters, startI: 60 }, { ...record.parameters, endI: 999999 }, { ...record.parameters, endI: 62, startI: 100 }, { ...record.parameters, startI: 62.5 }]) {
    if (p === null) continue // Explicitly absent is a valid summary-only record.
    expect(projectSourceUserStrategy({ ...record, parameters: p })).toBeNull()
  }
  const p = { ...record.parameters!, startI: -730 }
  const model = projectSourceUserStrategy({ ...record, parameters: p })!
  expect(model.record.parameters!.startI).toBe(-730)
  expect(model.evaluation!.r.params.startI).toBe(604)
})

function activity(): SourceUserStrategyActivity {
  const fill = (botId: string, fid: string): SourceAccountFill => ({ botId, fid, side: 's', label: 'BTC', pnl: -.052, kind: 'sl', sim: true, at: createdAt })
  const review = (botId: string, fid: string): SourceAccountReview => ({ botId, fid, id: `rv${fid}`, asset: 'BTC', kind: 'sl', kindL: '손절', pnl: -.052, at: createdAt, budget: 100, causes: [['원문 근거', '손절 규칙']], sim: true })
  return {
    fillLog: [fill(record.id, 'f1'), fill(String(createdAt + 1), 'f1'), fill('', 'orphan')],
    reviews: [review(record.id, 'f1'), review(String(createdAt + 1), 'f1')],
    rebates: [{ fid: 'f1', botId: record.id, amt: 2, at: createdAt, sim: true }, { fid: 'f1', botId: String(createdAt + 1), amt: 999, at: createdAt, sim: true }],
  }
}

test('원본 botId 필터의 VM 대조: 같은 fid인 다른 봇과 소유자 없는 체결이 섞이지 않는다', () => {
  const input = activity(), before = normalize(input)
  const selected = selectSourceUserStrategyActivity(record.id, input)
  const source = runInNewContext(originalDisplay, { b: { ...record, at: record.createdAt, env: record.environment, p: record.parameters }, t: input }, { timeout: 100 })
  expect(selected.fillLog).toEqual(normalize(source.fills))
  expect(selected.reviews).toEqual(normalize(source.revs))
  expect(selected.rebates.reduce((sum, row) => sum + row.amt, 0)).toBe(source.rb)
  expect(selected.fillLog).toHaveLength(1)
  expect(selected.rebates).toHaveLength(1)
  expect(selectSourceUserStrategyActivity(String(createdAt + 2), input)).toEqual({ fillLog: [], reviews: [], rebates: [] })
  expect(selectSourceUserStrategyActivity('demo:d1', input)).toEqual({ fillLog: [], reviews: [], rebates: [] })
  expect(input).toEqual(before)
})

test('입력/다른 모델을 변경하지 않고 복기 중첩 원인·곡선·로그를 외부 변경에서 보호한다', () => {
  const p = { ...record.parameters! }, model = projectSourceUserStrategy({ ...record, parameters: p })!
  p.sl = -99
  expect(model.record.parameters!.sl).toBe(-5)
  expect(Object.isFrozen(model.evaluation!.r.eq)).toBe(true)
  expect(Object.isFrozen(model.evaluation!.L.evs[0])).toBe(true)
  const input = activity(), selected = selectSourceUserStrategyActivity(record.id, input)
  ;(input.reviews[0].causes[0] as [string, string])[1] = '오염'
  expect(selected.reviews[0].causes[0][1]).toBe('손절 규칙')
  expect(Object.isFrozen(selected.reviews[0].causes[0])).toBe(true)
  expect(Object.isFrozen(input.reviews[0].causes[0])).toBe(false)
  const stripped = decodeSourceUserStrategyRecord({ ...record, apiKey: 'not-real', fillLog: input.fillLog })!
  expect(stripped).not.toHaveProperty('apiKey')
  expect(stripped).not.toHaveProperty('fillLog')
})
