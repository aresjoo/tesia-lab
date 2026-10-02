import { expect, test } from '@playwright/test'
import type { PriceChartView } from '../src/chart/price-chart-view'
import type { ProfessionalExternalReplay } from '../src/chart/price-replay-frame'

// Explicit display data: this checks the mutable renderer input boundary,
// not generated SDK validation or a real market/backtest producer.
const start = 1_700_000_000
const cases = [
  { mutation: 'close', shallowFreeze: false, issue: '가격 데이터의 순서와 범위를 확인할 수 없습니다.' },
  { mutation: 'fill-price', shallowFreeze: false, issue: '체결 데이터를 확인할 수 없습니다.' },
  { mutation: 'source', shallowFreeze: false, issue: '데이터 출처를 확인할 수 없습니다.' },
  { mutation: 'close', shallowFreeze: true, issue: '가격 데이터의 순서와 범위를 확인할 수 없습니다.' },
] as const

for (const sample of cases) {
  test(`동일 view 내부 ${sample.mutation} 변이${sample.shallowFreeze ? '·얕은 freeze' : ''}도 새 외부 frame에서 거절하고 canvas를 퇴장시킨다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    await page.evaluate(async ({ start, shallowFreeze }) => {
      const hostPath = '/tests/fixtures/price-chart-continuity-host.tsx'
      const { mount } = await import(/* @vite-ignore */ hostPath)
      const view: PriceChartView = {
        identity: 'mutable-display-window', market: 'BTC / USDT', sourceLabel: '명시 합성 표시 자료',
        resolutionSeconds: 60, pricePrecision: 2,
        bars: [0, 1, 2].map(index => ({ time: start + index * 60, open: 100 + index,
          high: 105 + index, low: 99 + index, close: 102 + index, volume: 10 })),
        fills: [{ id: 'entry-display', tradeId: 'trade-display', time: start, price: 102, side: 'BUY' }],
      }
      if (shallowFreeze) Object.freeze(view)
      const frame: ProfessionalExternalReplay = { attemptId: 'mutable-attempt', frame: {
        attemptId: 'mutable-attempt', viewIdentity: view.identity, time: start, progress: 0,
        state: 'playing', fillId: null,
      } }
      Reflect.set(window, '__mutablePriceView', view)
      Reflect.set(window, '__mutablePriceFrame', frame)
      Reflect.set(window, '__mutablePriceHost', mount(view, 'mutable-owner-series', { externalReplay: frame }))
    }, { start, shallowFreeze: sample.shallowFreeze })
    const canvas = page.locator('.cp-surface canvas').first()
    await expect(canvas).toBeVisible()
    await expect(page.locator('.cp-source')).toContainText('명시 합성 표시 자료')
    await expect(page.locator('.cp-empty')).toHaveCount(0)
    const validation = await page.evaluate(async mutation => {
      const view = Reflect.get(window, '__mutablePriceView') as PriceChartView
      const prior = Reflect.get(window, '__mutablePriceFrame') as ProfessionalExternalReplay
      const originalBars = view.bars
      if (mutation === 'close') view.bars[0].close = Number.NaN
      else if (mutation === 'fill-price') view.fills[0].price = 0
      else view.sourceLabel = ''
      const validatorPath = '/src/chart/price-chart-view.ts'
      const { priceChartIssue } = await import(/* @vite-ignore */ validatorPath)
      // A different external frame forces an actual parent render even when
      // memo sees the exact same (mutated) view reference.
      const next: ProfessionalExternalReplay = { ...prior, frame: { ...prior.frame, time: prior.frame.time + 30, progress: .1 } }
      Reflect.get(window, '__mutablePriceHost').frame(view, next)
      return { issue: priceChartIssue(view, true), sameView: view === Reflect.get(window, '__mutablePriceView'),
        sameBars: view.bars === originalBars, shallowFrozen: Object.isFrozen(view), nestedFrozen: Object.isFrozen(view.bars[0]),
        newFrame: prior !== next && prior.frame !== next.frame }
    }, sample.mutation)
    expect(validation).toEqual({ issue: sample.issue, sameView: true, sameBars: true,
      shallowFrozen: sample.shallowFreeze, nestedFrozen: false, newFrame: true })
    await expect(page.locator('.cp-empty').getByRole('status')).toHaveText(sample.issue, { timeout: 3000 })
    await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
    await expect(page.locator('.cp-replay')).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, '__mutablePriceHost').unmount())
  })
}
