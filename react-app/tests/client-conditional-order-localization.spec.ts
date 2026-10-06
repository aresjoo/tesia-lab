import { expect, test } from '@playwright/test'
import { conditionalOrderDistance, conditionalOrderLine, createConditionalOrderPreviewStore, type ConditionalOrderPreviewSpec } from '../src/client-conditional-order-preview'
import { localizedConditionalOrderDistance, localizedConditionalOrderLine, localizedConditionalOrderTtl } from '../src/client-conditional-order-locale'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const base: ConditionalOrderPreviewSpec = { asset: '비트코인', symbol: 'BTC', side: 'sell', trigger: 80000, triggerPct: null, last: 75000, qty: 'half', qtyNum: null, lev: null, ttl: '7d', exchange: 'Bitget' }

test('order locale: full side-specific sentences retain numeric thresholds, quantity, venue and leverage without mutating orders', () => {
  let count = 0
  for (const side of ['buy', 'sell', 'long', 'short'] as const) for (const qty of ['num', 'half', 'all'] as const) for (const lev of [null, 3]) for (const pct of [null, -5, 6]) {
    const spec = { ...base, side, qty, lev, qtyNum: qty === 'num' ? .125 : null, trigger: pct === null ? 80000 : null, triggerPct: pct }
    const before = JSON.stringify(spec)
    for (const language of languages) {
      const line = localizedConditionalOrderLine(spec, language)
      expect(line).toContain('BTC'); expect(line).toContain('Bitget')
      expect(line).toContain(pct === null ? '$80,000' : pct > 0 ? '+6%' : '-5%')
      if (qty === 'num') expect(line).toContain('0.125')
      if (lev !== null) expect(line).toContain('3')
      if (language === 'ko') expect(line).toBe(conditionalOrderLine(spec))
      else expect(line).not.toMatch(/[가-힣\uFFFD]|\{\w+\}/)
      const distance = localizedConditionalOrderDistance(spec, language)
      if (pct !== null) expect(distance).toBe('')
      else { expect(distance).toContain('$75,000'); expect(distance).toContain('+6.7%') }
      if (language === 'ko') expect(distance).toBe(conditionalOrderDistance(spec))
      else expect(distance).not.toMatch(/[가-힣\uFFFD]|\{\w+\}/)
      count++
    }
    expect(JSON.stringify(spec)).toBe(before)
  }
  expect(count).toBe(504)
})

test('order locale: deadline labels translate but lifecycle and stored source specification remain identical', () => {
  const memory = new Map<string, string>()
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) } }
  const store = createConditionalOrderPreviewStore({ namespace: 'locale-test', sessionId: 'session', storage, now: () => 1000, makeId: () => 'order' })
  const order = store.create(base), before = storage.getItem(store.storageKey)
  for (const language of languages) for (const ttl of ['gtc', '7d', '1d'] as const) for (const short of [true, false]) {
    const text = localizedConditionalOrderTtl(ttl, language, short)
    expect(text).not.toBe('')
    if (language !== 'ko') expect(text).not.toMatch(/[가-힣\uFFFD]/)
    localizedConditionalOrderLine(order, language)
    expect(storage.getItem(store.storageKey)).toBe(before)
    expect(store.getSnapshot().orders[0].status).toBe('draft')
  }
})
