import { expect, test } from '@playwright/test'
import { lifecycleCopy, lifecycleText } from '../src/client-trade-lifecycle-copy'
import { sourceTerminalLifecycle, sourceTradeExitPrice } from '../src/client-terminal-source-ledger'
import { evaluateSourceTerminal, sourceTerminalSeeds, sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { sharedNumber, sharedPercent } from '../src/client-shared-number-format'
import { terminalReadText } from '../src/client-terminal-read-copy'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const expectedKo = {
  title: '{asset} LONG 거래 추적', region: '거래 판단 기록', close: '닫기', empty: '거래 판단 기록이 제공되지 않았습니다.',
  entryDecision: '진입 결정', orderCreated: '주문 생성', fill: '체결', positionManagement: '포지션 관리', exitDecision: '청산 결정', exitFill: '청산 체결', finalResult: '최종 결과',
  conditionsMet: '조건 충족', marketBuy: '시장가 매수, 수량 {quantity}', validated: '검증 통과 설정으로 자동 생성', filled: '전량 체결 (시뮬레이션)',
  heldBars: '{bars}봉 보유', heldBar: '{bars}봉 보유', managing: '매 봉 손절 {stop}%{target}, 25봉 규칙 평가, 조건 미도달로 유지', target: ', 익절 +{target}%',
  immediateExit: '진입 직후 청산 조건 도달', ruleExecuted: '규칙 실행', stopFill: '손절 규칙가 기준 (시뮬레이션)', targetFill: '익절 규칙가 기준 (시뮬레이션)', closeFill: '종가 기준 (시뮬레이션)', fees: '수수료 왕복 {fee}% 반영',
}
test('원본25문구·7언어·치환자와 특수 문자열을 보존한다', () => {
  expect(Object.keys(lifecycleCopy).sort()).toEqual(Object.keys(expectedKo).sort())
  for (const key of Object.keys(expectedKo) as (keyof typeof expectedKo)[]) {
    expect(lifecycleText('ko', key)).toBe(expectedKo[key])
    expect(lifecycleCopy[key]).toHaveLength(7)
    const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
    for (const language of languages) {
      const text = lifecycleText(language, key)
      expect(text.trim().length).toBeGreaterThan(0)
      expect(placeholders(text)).toEqual(placeholders(expectedKo[key]))
      expect(lifecycleText(language, 'title', { asset: '$& <script>🚀</script>' })).toContain('$& <script>🚀</script>')
    }
  }
  for (const language of ['es', 'fr'] as const) {
    const fee = sharedPercent(.2, language, 1, false)
    expect(fee).toBe('0,2%')
    expect(lifecycleText(language, 'fees', { fee: sharedNumber(.2, language) })).toContain(fee)
    expect(terminalReadText(language, 'feeCaption')).toContain(fee)
  }
})

test('모든 source 거래는7언어에서도 원본 가격·수량·손익·판단원문·ISO일자를 보존한다', () => {
  const kinds = new Set<string>()
  for (const seed of sourceTerminalSeeds) {
    const model = { seed, result: evaluateSourceTerminal(seed.parameters, seed.capital) }, before = JSON.stringify(model)
    for (const trade of model.result.trades) {
      kinds.add(trade.kind)
      const ko = sourceTerminalLifecycle(model, trade.entry, value => String(value))!
      for (const language of languages) {
        const moneyCalls: [number, boolean][] = []
        const steps = sourceTerminalLifecycle(model, trade.entry, (value, signed = false) => { moneyCalls.push([value, signed]); return `supplied:${value}` }, language)!
        const t = (key: Parameters<typeof lifecycleText>[1], values?: Record<string, string>) => lifecycleText(language, key, values)
        expect(steps.map(s => s.title)).toEqual((['entryDecision', 'orderCreated', 'fill', 'positionManagement', 'exitDecision', 'exitFill', 'finalResult'] as const).map(key => t(key)))
        expect(moneyCalls).toEqual([[sourceTerminalPrices[trade.entry], false], [sourceTradeExitPrice(model, trade), false], [trade.krw, true]])
        expect(steps[1].value).toBe(t('marketBuy', { quantity: sharedNumber(trade.capB / sourceTerminalPrices[trade.entry], language, 4) }))
        expect(steps[6].value).toBe(`supplied:${trade.krw} (${sharedPercent(trade.pnl * 100, language)})`)
        expect(steps[0].value).toBe(ko[0].value); expect(steps[4].value).toBe(ko[4].value)
        expect(steps[0].description).toBe(ko[0].description); expect(steps[4].description).toBe(ko[4].description)
        expect(steps[5].description).toBe(t(({ sl: 'stopFill', tp: 'targetFill', time: 'closeFill' } as const)[trade.kind]))
        expect(steps[6].description).toBe(t('fees', { fee: sharedNumber(.2, language) }))
        expect(JSON.stringify(model)).toBe(before)
      }
    }
  }
  expect([...kinds].sort()).toEqual(['sl', 'time', 'tp'])
})

test('관리0·1·다수와 목표 미설정·소수 기준은 표시만 바꾸고 없는 원문을 만들어내지 않는다', () => {
  const seed = sourceTerminalSeeds[0], result = evaluateSourceTerminal(seed.parameters, seed.capital)
  // Explicit presentation-branch fixtures, not claimed as evaluated executions.
  for (const bars of [0, 1, 4]) for (const target of [null, 7.5]) {
    const original = result.trades[0], trade = { ...original, exit: original.entry + bars + 1, kind: 'time' as const }
    const model = { seed, result: { ...result, trades: [trade], r: { ...result.r, params: { ...result.r.params, sl: -2.5, tp: target } }, L: { ...result.L, evs: [] } } }
    const before = JSON.stringify(model)
    for (const language of languages) {
      const steps = sourceTerminalLifecycle(model, trade.entry, String, language)!
      const t = (key: Parameters<typeof lifecycleText>[1], values?: Record<string, string>) => lifecycleText(language, key, values)
      expect(steps[3].value).toBe(t(bars === 1 ? 'heldBar' : 'heldBars', { bars: String(bars) }))
      expect(steps[3].description).toBe(bars ? t('managing', { stop: sharedNumber(-2.5, language, 'auto'), target: target === null ? '' : t('target', { target: sharedNumber(7.5, language, 'auto') }) }) : t('immediateExit'))
      expect(steps[0].description).toBe(t('conditionsMet'))
      expect(steps[4].description).toBe(t('ruleExecuted'))
    }
    expect(JSON.stringify(model)).toBe(before)
  }
})

test('관측이 일부 생략된 읽기 입력에서도 사건 인덱스로 같은 거래의 판단 원문을 찾는다', () => {
  const seed = sourceTerminalSeeds[0], result = evaluateSourceTerminal(seed.parameters, seed.capital), trade = result.trades[0]
  expect(result.L.evs.every((event, index) => event.i === result.r.params.startI + index)).toBe(true)
  const entered = result.L.evs.find(e => e.i === trade.entry)!, exited = result.L.evs.find(e => e.i === trade.exit)!
  const model = { seed, result: { ...result, L: { ...result.L, evs: [entered, exited] } } }, before = JSON.stringify(model)
  const steps = sourceTerminalLifecycle(model, trade.entry, String, 'en')!
  expect(steps[0].description).toBe(entered.txt)
  expect(steps[4].description).toBe(exited.txt)
  expect(JSON.stringify(model)).toBe(before)
})
