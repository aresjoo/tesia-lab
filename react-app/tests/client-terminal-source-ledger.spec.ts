import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds, sourceTerminalPrices, type SourceTerminalSeed } from '../src/client-terminal-source-fixture'
import { sourceRuleExitPrice, sourceTradeExitPrice, sourceTerminalOrderRows, sourceTerminalAssets, sourceTerminalLifecycle, type SourceTerminalModel } from '../src/client-terminal-source-ledger'

const models: SourceTerminalModel[] = sourceTerminalSeeds.map(seed => ({ seed, result: evaluateSourceTerminal(seed.parameters, seed.capital) }))
const money = (value: number, signed = false) => `${value < 0 ? '−' : signed ? '+' : ''}₩${Math.round(Math.abs(value)).toLocaleString('ko')}`
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonical(record[key])]))
  }
  return value
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')

// Golden records derived by observing the unmodified numerical variables in
// original 42a0d81 index.html tfTmPane, with only rendering helpers stubbed.
// Pure function-slice SHA: 2fc2cd38745b9f732cf7d44f6b638f3b98797edffca38dd741dfe4dc20e623e7.
// Original HTML/scripts/network/storage are never executed by these tests.
test('전체 96개 원본 주문/체결 가격·수량·편도 수수료·순서를 그대로 유지한다', () => {
  const rows = sourceTerminalOrderRows(models)
  expect(rows).toHaveLength(96)
  expect(digest(rows)).toBe('dbde6dac0847bb42e8737d7b55b3b97341a7f0bdcc7413cfd48dbd8058d4755e')
  expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
})

test('기본 여섯 전략의 거래소 자산 집계는 원본 수치와 정확히 같다', () => {
  const assets = sourceTerminalAssets(models)
  expect(digest(assets)).toBe('a67d149d55f3f9473a4171157c2f32f9c9ef1784e9fc885d4e9961b1cc61a02e')
  expect(assets.map(asset => asset.exchangeId)).toEqual(['binance', 'okx', 'woox'])
  expect(assets.every(asset => asset.strategyCount === 2 && asset.used === 0 && asset.unrealized === 0)).toBe(true)
})

test('최근 8거래 역순·SELL 다음 BUY를 유지하며 수수료를 손익에서 다시 차감하지 않는다', () => {
  const model = models[0], before = digest(model)
  const rows = sourceTerminalOrderRows([model])
  expect(rows).toHaveLength(16)
  model.result.trades.slice(-8).reverse().forEach((trade, index) => {
    const [sell, buy] = rows.slice(index * 2, index * 2 + 2)
    expect(sell.side).toBe('SELL')
    expect(buy.side).toBe('BUY')
    expect(sell.index).toBe(trade.exit)
    expect(buy.index).toBe(trade.entry)
    expect(sell.entryIndex).toBe(trade.entry)
    expect(buy.entryIndex).toBe(trade.entry)
    expect(sell.quantity).toBe(trade.capB / sourceTerminalPrices[trade.entry])
    expect(buy.quantity).toBe(sell.quantity)
    expect(sell.fee).toBe(trade.capB * .001)
    expect(buy.fee + sell.fee).toBe(trade.capB * .002)
  })
  expect(digest(model)).toBe(before)
})

test('손절·익절은 규칙 체결가이고 기간 청산만 평가 종가를 사용한다', () => {
  for (const kind of ['sl', 'tp', 'time'] as const) {
    const model = models.find(item => item.result.trades.some(trade => trade.kind === kind))!
    const trade = model.result.trades.find(item => item.kind === kind)!
    const p = model.result.r.params, entry = sourceTerminalPrices[trade.entry]
    const expected = kind === 'sl' ? entry * (1 + p.sl / 100) : kind === 'tp' ? entry * (1 + p.tp! / 100) : sourceTerminalPrices[trade.exit]
    expect(sourceTradeExitPrice(model, trade)).toBe(expected)
    if (kind !== 'time') expect(sourceTradeExitPrice(model, trade)).not.toBe(sourceTerminalPrices[trade.exit])
    const changedLabelOnly = { ...model, seed: { ...model.seed, parameters: { ...model.seed.parameters, sl: -99, tp: 99 } } }
    expect(sourceTradeExitPrice(changedLabelOnly, trade)).toBe(expected)
  }
})

test('공유 표와 터미널이 같은 평가 파라미터의 청산가·수수료 차감 손익을 사용한다', () => {
  const kinds = new Set<string>()
  for (const model of models) {
    const before = digest(model)
    for (const trade of model.result.r.trades) {
      kinds.add(trade.kind)
      const price = sourceRuleExitPrice(model.result.r.params, trade)
      const expected = trade.kind === 'sl' ? sourceTerminalPrices[trade.entry] * (1 + model.result.r.params.sl / 100)
        : trade.kind === 'tp' ? sourceTerminalPrices[trade.entry] * (1 + model.result.r.params.tp! / 100) : sourceTerminalPrices[trade.exit]
      expect(price).toBe(expected)
      expect(price / sourceTerminalPrices[trade.entry] - 1 - .002).toBeCloseTo(trade.pnl, 12)
      const terminalTrade = model.result.trades.find(row => row.entry === trade.entry)!
      expect(price).toBe(sourceTradeExitPrice(model, terminalTrade))
    }
    expect(digest(model)).toBe(before)
  }
  expect([...kinds].sort()).toEqual(['sl', 'time', 'tp'])
})

function openModel(id: string, capital: number, capitalShared: boolean, status: SourceTerminalSeed['status'] = 'live', exchangeId = 'binance'): SourceTerminalModel {
  const parameters = { ...models[0].seed.parameters, endI: models[0].result.trades[0].entry + 1 }
  const seed = { ...models[0].seed, id, capital, capitalShared, status, exchangeId, parameters }
  return { seed, result: evaluateSourceTerminal(parameters, capital) }
}

test('공유 위임 원금과 사용액은 거래소별 한 번만 합산하고 개별 손익은 모두 반영한다', () => {
  const first = openModel('a', 100, true), second = openModel('b', 100, true), separate = openModel('c', 50, false), other = openModel('d', 100, true, 'live', 'okx')
  const assets = sourceTerminalAssets([first, second, separate, other])
  expect(assets).toHaveLength(2)
  const asset = assets[0]
  expect(asset.equity).toBe(100 + first.result.pnl + second.result.pnl + separate.result.nav)
  expect(asset.used).toBe(150)
  expect(asset.available).toBe(asset.equity - 150)
  expect(asset.unrealized).toBe(first.result.pos!.krw + second.result.pos!.krw + separate.result.pos!.krw)
  expect(asset.strategyCount).toBe(3)
  expect(asset.shared).toBe(true)
  expect(assets[1].used).toBe(100)
  expect(assets[1].equity).toBe(100 + other.result.pnl)
})

test('중지/대기 전략은 평가 NAV에는 포함되지만 사용액·미실현에는 포함되지 않는다', () => {
  const off = openModel('off', 100, true, 'off'), live = openModel('live', 70, true), ready = openModel('ready', 50, false, 'ready')
  const [asset] = sourceTerminalAssets([off, live, ready])
  expect(asset.equity).toBe(100 + off.result.pnl + live.result.pnl + ready.result.nav)
  expect(asset.used).toBe(70)
  expect(asset.unrealized).toBe(live.result.pos!.krw)
  expect(asset.strategyCount).toBe(3)
})

test('미연결과 특수 거래소 키를 안전하게 별도 그룹화하며 음수 가용금액도 숨기지 않는다', () => {
  const unlinked = openModel('a', 100, false, 'live', '')
  const special = openModel('b', 100, false, 'live', '__proto__')
  const negative: SourceTerminalModel = { ...unlinked, result: { ...unlinked.result, nav: 70 } }
  const assets = sourceTerminalAssets([negative, special])
  expect(assets.map(asset => asset.exchangeId)).toEqual(['unlinked', '__proto__'])
  expect(assets[0].available).toBe(-30)
  expect(assets[1].equity).toBe(special.result.nav)
})

test('라이프사이클은 원본 7단계·24봉 관리·수량·청산 설명과 최종 손익을 보존한다', () => {
  const model = models[0], trade = model.result.trades[0], steps = sourceTerminalLifecycle(model, trade.entry, money)!
  expect(steps.map(step => step.title)).toEqual(['진입 결정', '주문 생성', '체결', '포지션 관리', '청산 결정', '청산 체결', '최종 결과'])
  expect(steps[0].value).toMatch(/^2023-04-\d\d$/)
  expect(steps[0].description).toBe('진입 조건 충족: 전봉 RSI 37.0 < 임계 40, 반등 +0.70%, 추세 필터 통과')
  expect(steps[1]).toEqual({ title: '주문 생성', value: '시장가 매수, 수량 612.3556', description: '검증 통과 설정으로 자동 생성' })
  expect(steps[2]).toEqual({ title: '체결', value: '₩22,863', description: '전량 체결 (시뮬레이션)' })
  expect(steps[3]).toEqual({ title: '포지션 관리', value: '24봉 보유', description: '매 봉 손절 -5%, 익절 +10%, 25봉 규칙 평가, 조건 미도달로 유지' })
  expect(steps[4].value).toMatch(/^2023-05-\d\d$/)
  expect(steps[4].description).toBe('보유 25봉 경과, 기간 청산 규칙 실행 (+4.3%)')
  expect(steps[5]).toEqual({ title: '청산 체결', value: '₩23,841', description: '종가 기준 (시뮬레이션)' })
  expect(steps[6]).toEqual({ title: '최종 결과', value: '+₩571,118 (+4.1%)', description: '수수료 왕복 0.2% 반영' })
})

test('lifecycle 통화는 주입한 formatter를 소비하고 원본 거래 결과를 바꾸지 않는다', () => {
  const model = models[1], trade = model.result.trades[0], before = digest(model)
  const steps = sourceTerminalLifecycle(model, trade.entry, (value, signed) => `${signed ? 'SIGNED:' : 'VALUE:'}${value}`)!
  expect(steps[2].value).toBe(`VALUE:${sourceTerminalPrices[trade.entry]}`)
  expect(steps[5].value).toBe(`VALUE:${sourceTradeExitPrice(model, trade)}`)
  expect(steps[6].value).toContain(`SIGNED:${trade.krw}`)
  expect(steps[0].description).toBe(model.result.L.evs[trade.entry - model.result.r.params.startI].txt)
  expect(digest(model)).toBe(before)
})

test('없는 거래·빈 목록은 결과를 만들지 않고 잘못된 가격 인덱스는 거절한다', () => {
  expect(sourceTerminalLifecycle(models[0], -1, money)).toBeNull()
  expect(sourceTerminalLifecycle(models[0], NaN, money)).toBeNull()
  expect(sourceTerminalOrderRows([])).toEqual([])
  expect(sourceTerminalAssets([])).toEqual([])
  const trade = models[0].result.trades[0]
  expect(() => sourceTradeExitPrice(models[0], { ...trade, entry: -1 })).toThrow(RangeError)
  expect(() => sourceTradeExitPrice(models[0], { ...trade, exit: 99999 })).toThrow(RangeError)
  expect(() => sourceTradeExitPrice(models[0], { ...trade, entry: 1.5 })).toThrow(RangeError)
})

test('새 배열/행을 반환하므로 표시 소비자의 변경이 다음 결과에 전파되지 않는다', () => {
  const before = digest(models), orders = sourceTerminalOrderRows(models), assets = sourceTerminalAssets(models)
  orders[0].price = -123; assets[0].equity = -123
  expect(digest(sourceTerminalOrderRows(models))).toBe('dbde6dac0847bb42e8737d7b55b3b97341a7f0bdcc7413cfd48dbd8058d4755e')
  expect(digest(sourceTerminalAssets(models))).toBe('a67d149d55f3f9473a4171157c2f32f9c9ef1784e9fc885d4e9961b1cc61a02e')
  expect(digest(models)).toBe(before)
})
