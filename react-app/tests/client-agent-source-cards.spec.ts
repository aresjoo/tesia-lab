import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal, sourceTerminalSeeds, sourceTerminalPrices, sourceTerminalRsi, sourceTerminalSma, type SourceTerminalSeed, type SourceTerminalEvaluation } from '../src/client-terminal-source-fixture'
import type { ClientAgentEvent } from '../src/client-agent-view'
import type { ClientLanguage } from '../src/client-preferences'

async function project(page: Page, seed: SourceTerminalSeed, result: SourceTerminalEvaluation, language: ClientLanguage = 'ko') {
  await page.route('**/agent-source-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><div></div>' }))
  await page.goto('/agent-source-test.html')
  return page.evaluate(async ({ seed, result, language }) => {
    const path = '/src/client-terminal-source-view.ts'
    const { sourceAgentEvents, sourceAgentStatusSummary } = await import(/* @vite-ignore */ path)
    const before = JSON.stringify({ seed, result })
    const events: ClientAgentEvent[] = sourceAgentEvents(seed, result, (value: number) => `$${value.toFixed(2)}`, language)
    return { events, unchanged: JSON.stringify({ seed, result }) === before, status: sourceAgentStatusSummary(seed, events, language), emptyStatus: sourceAgentStatusSummary(seed, [], language) }
  }, { seed, result, language })
}

for (const seed of sourceTerminalSeeds) test(`${seed.id} 조건표는 평가 이벤트·진입 기준가·수수료 포함 결과를 설명한다`, async ({ page }) => {
  const result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const projection = await project(page, seed, result)
  expect(projection.unchanged).toBe(true)
  const events = projection.events
  expect(events.map(event => [event.id, event.type, event.text])).toEqual([...result.L.evs].reverse().map(ev => [`${seed.id}:${ev.i}`, ev.k, ev.txt]))
  expect(new Set(events.map(event => event.id)).size).toBe(events.length)
  let entry: number | null = null
  for (const ev of result.L.evs) {
    const card = events.find(event => event.id === `${seed.id}:${ev.i}`)!
    expect(card.summary).toBeUndefined()
    expect(card.detail).toBeUndefined()
    const check = card.ruleCheck!
    expect(check.barIndex).toBe(ev.i)
    expect(check.provenance).toContain('시뮬레이션')
    const price = sourceTerminalPrices[ev.i], p = seed.parameters
    if (ev.k === 'entry') entry = ev.i
    if (ev.k === 'entry' || ev.k === 'watch') {
      const rsi = sourceTerminalRsi(ev.i - 1)
      const previous = sourceTerminalPrices[ev.i - 1]
      expect(check.rows).toHaveLength(p.trendFilter ? 3 : 2)
      expect(check.rows[0].value).toBe(rsi.toFixed(1))
      expect(check.rows[0].state).toBe(rsi < p.rsiTh ? 'ok' : 'no')
      expect(check.rows[1].state).toBe(price > previous * 1.005 ? 'ok' : 'no')
      if (p.trendFilter) {
        const gap = Math.abs(sourceTerminalSma(ev.i, 20)! - sourceTerminalSma(ev.i, 60)!) / price
        expect(check.rows[2].value).toBe(`${(gap * 100).toFixed(1)}%`)
        expect(check.rows[2].state).toBe(gap > .03 ? 'ok' : 'no')
      }
      if (ev.k === 'entry') {
        expect(check.rows.every(row => row.state === 'ok')).toBe(true)
        const trade = result.trades.find(trade => trade.entry === ev.i)
        const qty = trade ? trade.capB / price : result.pos!.qty
        expect(check.outputs[0].text).toContain(qty.toFixed(4))
        expect(check.outputs[0].text).toContain(seed.symbol)
      } else expect(check.outputs).toEqual([])
    } else {
      expect(entry).not.toBeNull()
      const ep = sourceTerminalPrices[entry!]
      expect(check.rows[0].label).toContain(`$${(ep * (1 + p.sl / 100)).toFixed(2)}`)
      expect(check.rows[0].state).toBe(ev.k === 'exit-sl' ? 'hit' : 'na')
      expect(check.rows.at(-1)!.value).toBe(`${ev.i - entry!}/25`)
      if (ev.k.startsWith('exit')) {
        const trade = result.trades.find(trade => trade.exit === ev.i)!
        const exit = trade.kind === 'sl' ? ep * (1 + p.sl / 100) : trade.kind === 'tp' ? ep * (1 + p.tp! / 100) : price
        expect(check.outputs[0].text).toContain(`$${exit.toFixed(2)}`)
        expect(check.outputs[1].text).toContain(`$${trade.krw.toFixed(2)}`)
        expect(check.outputs[1].text).toContain(`${(trade.pnl * 100).toFixed(1)}%`)
        entry = null
      } else expect(check.outputs).toEqual([])
    }
  }
  if (seed.status === 'live') expect(projection.status).toBe(`규칙 검사 · ${events[0].timeLabel}`)
  else expect(projection.status).toBeUndefined()
  expect(projection.emptyStatus).toBeUndefined()
})

test('익절 없음·0원·불완전한 진입 기록은 값을 합성하지 않는다', async ({ page }) => {
  const seed = { ...sourceTerminalSeeds[5], capital: 0, parameters: { ...sourceTerminalSeeds[5].parameters, tp: null } }
  const result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const { events } = await project(page, seed, result)
  expect(events.filter(ev => ev.type === 'entry').length).toBeGreaterThan(0)
  for (const ev of events) {
    if (ev.type === 'entry') expect(ev.ruleCheck!.outputs[0].text).toContain('0.0000')
    expect(JSON.stringify(ev.ruleCheck)).not.toContain('익절')
  }
  const exit = result.L.evs.find(ev => ev.k.startsWith('exit'))!
  const partial = { ...result, L: { ...result.L, evs: [exit] } }
  const isolated = (await project(page, seed, partial)).events[0].ruleCheck!
  expect(isolated.outputs).toEqual([])
  expect(isolated.rows.every(row => row.state === 'unknown' && row.value === '—')).toBe(true)
})

test('소수 조건값은 반올림하지 않고 누락된 진입 수량도 추정하지 않는다', async ({ page }) => {
  const seed = { ...sourceTerminalSeeds[5], parameters: { ...sourceTerminalSeeds[5].parameters, rsiTh: 39.75, sl: -3.25, tp: 8.125 } }
  const result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const { events } = await project(page, seed, result, 'fr')
  const entry = events.find(event => event.type === 'entry')!
  expect(entry.ruleCheck!.rows[0].label).toContain('39,75')
  expect(entry.ruleCheck!.outputs[1].text).toContain('-3,25%')
  expect(entry.ruleCheck!.outputs[1].text).toContain('+8,125%')
  const exit = events.find(event => event.type.startsWith('exit'))!
  expect(exit.ruleCheck!.rows[0].label).toContain('-3,25%')
  expect(exit.ruleCheck!.rows[1].label).toContain('+8,125%')
  const partial = { ...result, trades: [], pos: null, L: { ...result.L, evs: result.L.evs.filter(ev => ev.i === entry.ruleCheck!.barIndex) } }
  const missing = (await project(page, seed, partial)).events[0].ruleCheck!
  expect(missing.outputs[0].text).toContain('시장가 매수 —')
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`${language} 조건 라벨은 번역하며 평가 원문과 숫자 의미를 유지한다`, async ({ page }) => {
  const seed = { ...sourceTerminalSeeds[0], parameters: { ...sourceTerminalSeeds[0].parameters, startI: 61, endI: 61 } }
  const result = evaluateSourceTerminal(seed.parameters, seed.capital)
  const { events } = await project(page, seed, result, language)
  expect(events).toHaveLength(1)
  const check = events[0].ruleCheck!
  expect(events[0].text).toBe(result.L.evs[0].txt)
  expect(check.rows[0].value).toBe(sourceTerminalRsi(60).toFixed(1).replace('.', ['fr', 'es'].includes(language) ? ',' : '.'))
  expect(check.rows[0].label).toContain('40')
  if (language !== 'ko') expect(JSON.stringify(check)).not.toMatch(/충족|관망|이전|반등|시뮬레이션/)
  expect(JSON.stringify(check)).not.toMatch(/undefined|NaN|Infinity/)
})
