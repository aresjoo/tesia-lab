import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds, type SourceTerminalSeed } from '../src/client-terminal-source-fixture'
import { createSourceTerminalProposal, scoreSourceTerminal, sourceParameterFingerprint, sourceVersionIncrement } from '../src/client-terminal-source-proposal'

// Original 42a0d81f4776681938fb1d08efbabbcaa7f7c67e index.html pure
// engine/tfTmSnap/tfTmSay/tfScore + teth-copy.js actual TFC.score literals.
// Original function-slices SHA: 30f1a7c831e5ce5b3a5de0586ea06d7938f24dafae36ada55e89b4cf03ddd2dc.
// VM host is a plain {innerHTML:''}; no HTML, scripts, network or storage run.
// The tfTrack tail was observed as {p2,rows,notes,un,score,passes,after} without
// changing parser/evaluation logic. These are full-field original-output hashes.
const golden = [
  ['d1', '손절 -3%로 바꿔줘', '4bef2320ed3bb97cc0e3d43fe5e6dcb0b3b6d46e8813be71274f424a56561ab0'],
  ['d1', '손절 -4% 익절 11% RSI 43 추세 필터 끄기', 'c200dcd04b03aefdd9ba28c01e5b330918405d5731d419375ae8cc0a387ad80f'],
  ['d2', '리스크 낮춰줘', '9d3f2fe40bba8627d6038242f4e0b15991bfa3a48f8ccefc835846e5f464641c'],
  ['d3', '리스크 낮춰줘', '6a3ba84cb0785b0840f8a6a1db91f365e5290d96aba96452de55a28738b60e59'],
  ['d4', '리스크 높여줘', '39b9224e06043e09a3da43f39e4688a0de4892fec4faa8786a8d8840b2763c17'],
  ['d5', '익절 15% RSI 44 추세 필터 켜기', 'da76ceac1866e574e7ca9588f53638bcbce421c5422c9aa8abb0ca96d24ee41a'],
  ['d6', '손절 -5%로 바꾸고 EMA 20과 부분 청산, 레버리지, 타임프레임 변경', 'cfa4b30c135ceaed51ecfee778b643e7aa04b4407a088a0fd5b2e59f221c3d8a'],
] as const
const seed = (id = 'd1') => sourceTerminalSeeds.find(item => item.id === id)!
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonical(record[key])]))
  }
  return value
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
for (const [id, request, sha] of golden) {
  test(`원본 후보 동등성 ${id}: ${request}`, () => {
    const response = createSourceTerminalProposal(seed(id), request)
    expect(response.kind).toBe('proposal')
    if (response.kind !== 'proposal') throw new Error('Expected proposal')
    const p = response.proposal
    expect(digest({ p2: p.parameters, rows: p.rows.map(row => [row.label, row.current, row.proposed, row.delta]), notes: p.notes, un: p.unsupported, score: p.score, passes: p.passes, after: p.after })).toBe(sha)
    expect(p.strategyId).toBe(id)
    expect(p.baseVersion).toBe(seed(id).version)
    expect(p.baseFingerprint).toBe(sourceParameterFingerprint(seed(id).parameters))
    expect(p.before.ret).toBe(evaluateSourceTerminal(seed(id).parameters, seed(id).capital).r.ret)
  })
}

test('설명은 원본 수치·문장과 원본 심층 대화 원문을 유지한다', () => {
  const result = evaluateSourceTerminal(seed().parameters, seed().capital)
  const response = createSourceTerminalProposal(seed(), '손절 기준 설명')
  expect(response).toEqual({ kind: 'explanation', title: '손절 기준',
    text: `이 전략의 손절선은 진입가 대비 -5%예요. 검증 구간에서 이 규칙이 최대 낙폭을 ${result.r.mdd.toFixed(1)}% 안에서 관리했고, 손절 청산은 총 2회 실행됐어요. 손절 폭을 좁히면 낙폭은 줄지만 거래가 짧게 끊길 수 있어요. "손절 -3%로 바꿔줘"라고 하면 실제 재검증 수치로 비교해드려요.`,
    followup: `BTC 돌파 추종 전략(BTC/USDT, 검증 수익 ${result.r.ret.toFixed(1)}%, MDD ${result.r.mdd.toFixed(1)}%)에 대해 더 깊게 분석해줘` })
  const analysis = createSourceTerminalProposal(seed('d6'), '이번 판단 다시 분석')
  expect(analysis.kind).toBe('explanation')
  if (analysis.kind === 'explanation') {
    expect(analysis.title).toBe('최근 판단')
    expect(analysis.text).toContain('마지막 평가: 조건 미충족:')
    expect(analysis.text).toContain('전봉 RSI 46 미만')
  }
})

test('원본 dead branch 교정: 인식한 동일값은 미지원이 아니라 변경 없음이다', () => {
  for (const request of ['손절 -5% 그대로', 'RSI 40', '익절 10%', '추세 필터 켜기']) {
    expect(createSourceTerminalProposal(seed(), request)).toEqual({ kind: 'unchanged', title: '변경 사항이 없어요', text: '요청한 값이 현재 설정과 같아요. 버전을 만들지 않았어요.', followup: `${request}. 이 전략 변경이 가능한지 알려줘` })
  }
  expect(createSourceTerminalProposal(seed(), '손절 -5% 그대로 레버리지 3배').kind).toBe('unsupported')
  const unsupported = createSourceTerminalProposal(seed(), '손절 -5% 그대로 레버리지 3배')
  if (unsupported.kind === 'unsupported') expect(unsupported.text).toContain('레버리지은 아직 규칙 엔진이 지원하지 않아 적용할 수 없어요.')
})

test('허용값 스냅 동점은 원본 배열의 앞 값을 선택하고 미지원 혼합을 숨기지 않는다', () => {
  const response = createSourceTerminalProposal(seed(), '손절 -4% 익절 11% RSI 43 추세 필터 끄기 EMA 20 레버리지 3배')
  expect(response.kind).toBe('proposal')
  if (response.kind !== 'proposal') return
  expect(response.proposal.parameters).toMatchObject({ sl: -3, tp: 10, rsiTh: 42, trendFilter: false })
  expect(response.proposal.rows.map(row => row.label)).toEqual(['손절선', '진입 RSI 임계', '추세 필터'])
  expect(response.proposal.notes).toEqual(['손절 -4% → 허용값 -3%로 조정', '익절 +11% → 허용값 +10%로 조정', 'RSI 43 → 허용값 42으로 조정'])
  expect(response.proposal.unsupported).toEqual(['EMA 조건', '레버리지'])
})

test('원본 score 실제 literals·80점 문턱·표본 부족 페널티를 그대로 계산한다', () => {
  const results = sourceTerminalSeeds.map(item => evaluateSourceTerminal(item.parameters, item.capital).r)
  expect(results.map(scoreSourceTerminal)).toEqual([90, 68, 83, 84, 83, 40])
  const perfect = { ...results[0], winRate: 60, cagr: 6, mdd: -6, tradeVol: 4, n: 6 }
  expect(scoreSourceTerminal(perfect)).toBe(99)
  expect(scoreSourceTerminal({ ...perfect, n: 5 })).toBe(79)
  expect(scoreSourceTerminal({ ...perfect, n: 3 })).toBe(65)
  expect(scoreSourceTerminal({ ...perfect, winRate: 0, cagr: -1, mdd: -99, tradeVol: 99 })).toBe(5)
  for (const key of ['winRate', 'cagr', 'mdd', 'tradeVol', 'n'] as const) expect(() => scoreSourceTerminal({ ...perfect, [key]: NaN })).toThrow(RangeError)
})

test('fingerprint는 정규화된 전체 6필드·소스 버전 증가식을 사용한다', () => {
  expect(sourceParameterFingerprint(seed('d2').parameters)).toBe('-5|8|46|1|604|1334')
  expect(sourceParameterFingerprint({ ...seed().parameters, tp: null })).toBe('-5||40|1|61|1334')
  for (const [from, to] of [['v3.4', 'v3.5'], ['v1.9', 'v2.0'], ['v3.9', 'v4.0'], ['invalid', 'v1.1'], ['v0', 'v1.1']]) expect(sourceVersionIncrement(from)).toBe(to)
  expect(() => sourceVersionIncrement('Infinity')).toThrow(RangeError)
  for (const parameters of [{ ...seed().parameters, sl: NaN }, { ...seed().parameters, tp: Infinity }, { ...seed().parameters, startI: .5 }, { ...seed().parameters, endI: 9000 }]) expect(() => sourceParameterFingerprint(parameters)).toThrow(RangeError)
})

test('proposal 계산은 seed와 이전 결과를 변경하거나 상태/버전을 미리 적용하지 않는다', () => {
  const before = digest(sourceTerminalSeeds)
  const first = createSourceTerminalProposal(seed(), '손절 -3%로 바꿔줘')
  if (first.kind !== 'proposal') throw new Error('Expected proposal')
  const baseline = digest(first)
  first.proposal.parameters.sl = -999
  first.proposal.score = 99
  expect(digest(createSourceTerminalProposal(seed(), '손절 -3%로 바꿔줘'))).toBe(baseline)
  expect(digest(sourceTerminalSeeds)).toBe(before)
  expect(seed().version).toBe('v3.4')
  expect(seed().status).toBe('live')
})

test('비유한 숫자와 초과 입력은 부분 스냅 없이 거절한다', () => {
  for (const request of [`손절 -${'9'.repeat(400)}% RSI 44`, `익절 ${'9'.repeat(400)}%`, `RSI ${'9'.repeat(400)}`, 'a'.repeat(4001)]) expect(createSourceTerminalProposal(seed(), request).kind).toBe('unsupported')
  expect(createSourceTerminalProposal(seed(), '').kind).toBe('unsupported')
  const invalid = { ...seed(), parameters: { ...seed().parameters, sl: NaN } } as SourceTerminalSeed
  expect(() => createSourceTerminalProposal(invalid, '손절 -3%')).toThrow(RangeError)
})
