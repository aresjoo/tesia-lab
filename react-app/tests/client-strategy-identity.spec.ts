import { expect, test } from '@playwright/test'
import { strategyVenue, validStrategyGlyph, type StrategyGlyphEvidence } from '../src/client-strategy-identity'
import golden from './fixtures/strategy-glyph-source.json' with { type: 'json' }
import identityCopy from '../src/client-strategy-identity-copy.json' with { type: 'json' }
import kindCopy from '../src/client-strategy-filter-copy.json' with { type: 'json' }

test.beforeEach(({ page }) => { page.setDefaultTimeout(15000) })

test('명시 분류·운용 거래소는 목록에서 상세까지 같은 원문과 도식을 유지한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/sharing-service-harness.tsx'; (await import(path)).mountSharing(true, false, true) })
  const root = page.locator('#sharing-test-root'), card = root.locator('.strategy-list-card').first()
  await expect(card.locator('.strategy-identity-meta')).toHaveText('AI 판단, Binance에서 실행')
  await expect(card.locator('.strategy-identity-meta img')).toHaveAttribute('src', '/client-broker-assets/app-binance.png')
  await expect(card.locator('.strategy-glyph circle')).toHaveCount(8)
  const svg = await card.locator('.strategy-glyph').innerHTML()
  await card.getByRole('link').click()
  await expect(root.locator('.shared-detail-identity .strategy-glyph')).toHaveAttribute('width', '44')
  expect(await root.locator('.shared-detail-identity .strategy-glyph').innerHTML()).toBe(svg)
  await expect(root.locator('.shared-detail-identity')).toContainText('AI 판단')
  await root.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(root.locator('.shared-detail-info')).toContainText('운용 거래소Binance')
})

test('미공급 서비스 metadata는 이름·순서로 거래소나 판단 방식을 만들지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/sharing-service-harness.tsx'; (await import(path)).mountSharing(true) })
  const root = page.locator('#sharing-test-root'), card = root.locator('.strategy-list-card').first()
  await expect(card.locator('.strategy-identity-meta')).toHaveText('비트코인')
  await expect(card.locator('.strategy-identity-meta img')).toHaveCount(0)
  await expect(card.locator('.strategy-glyph path')).toHaveAttribute('d', 'M8 14h12M14 8v12')
  await expect(card).not.toContainText(/AI 판단|차트 규칙|Binance|Bitget|OKX/)
})

test('원본12종 SVG 출력과 좌표·도형·색을 비교하며3종 혼합 도식의 겹침만 교정한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1000, height: 1000 })
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/strategy-identity-harness.tsx'; (await import(path)).mountGlyphs() })
  await expect(page.locator('#identity-test-root section')).toHaveCount(golden.cases.length)
  for (const item of golden.cases) {
    const section = page.locator(`[data-case="${item.id}"]`)
    const shapes = await section.evaluate(el => {
      const attributes = (selector: string) => Array.from(el.querySelectorAll(selector)).map(node => ({ tag: node.tagName, attributes: Object.fromEntries(Array.from(node.attributes).map(attr => [attr.name, attr.value])) }))
      return { source: attributes('.source svg > *'), react: attributes('.react svg > *') }
    })
    if (!item.correctedOverlap) expect(shapes.react).toEqual(shapes.source)
    else {
      expect(shapes.react[0]).toEqual(shapes.source[0])
      expect(shapes.react.slice(4)).toEqual(shapes.source.slice(4))
      expect(new Set(shapes.source.slice(1,4).map(shape => shape.attributes.transform)).size).toBe(1)
      expect(new Set(shapes.react.slice(1,4).map(shape => shape.attributes.transform)).size).toBe(3)
    }
  }
  await page.screenshot({ path: info.outputPath('source-react-glyphs.png') })
})

test('불량·불일치·과도한 도식은 중립으로 제한하고 외부 로고 주소를 사용하지 않는다', () => {
  const valid: StrategyGlyphEvidence = { kind: 'agent', shape: 'circle', universeSize: 8, selectedCount: 3 }
  expect(validStrategyGlyph('agent', valid)).toBe(true)
  for (const evidence of [undefined, null, {}, { ...valid, universeSize: 1e9 }, { ...valid, universeSize: 0 }, { ...valid, universeSize: 2.5 }, { ...valid, selectedCount: 9 }, { ...valid, shape: '<svg>' }]) {
    expect(validStrategyGlyph('agent', evidence as StrategyGlyphEvidence)).toBe(false)
  }
  expect(validStrategyGlyph('rule', valid)).toBe(false)
  expect(validStrategyGlyph(undefined, valid)).toBe(false)
  for (const rsiThreshold of [NaN, Infinity, -1, 101]) expect(validStrategyGlyph('rule', { kind: 'rule', shape: 'circle', rsiThreshold, targetPercent: null, trendFilter: false })).toBe(false)
  expect(strategyVenue(undefined)).toBeNull()
  expect(strategyVenue({ name: ' ' })).toBeNull()
  expect(strategyVenue({ name: 'Unlisted venue', logo: 'https://example.invalid/tracker' as 'okx' })).toEqual({ name: 'Unlisted venue', logo: undefined })
  expect(strategyVenue({ name: 'Exact name', logo: '__proto__' as 'okx' })).toEqual({ name: 'Exact name', logo: undefined })
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`${language} 320px 긴 거래소명은 누락·겹침 없이 원문과 접근가능한 설명을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 1000 })
  const external: string[] = []; page.on('request', request => { if (request.url().includes('example.invalid')) external.push(request.url()) })
  await page.goto('/')
  await page.evaluate(async language => {
    const prefs = '/src/client-preferences.ts', fixture = '/tests/fixtures/strategy-identity-harness.tsx'
    ;(await import(prefs)).setClientPreference('language', language)
    ;(await import(fixture)).mountIdentityCards()
    await document.fonts.ready
  }, language)
  const cards = page.locator('#identity-test-root .strategy-list-card')
  await expect(cards).toHaveCount(3)
  const label = `${kindCopy[language].rule}, ${identityCopy[language].runningOn.replace('{venue}', 'Binance')}`
  await expect(cards.first().locator('.strategy-identity-meta')).toHaveText(label)
  await expect(cards.first().getByRole('link')).toHaveAccessibleDescription(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const malicious = cards.last().locator('.strategy-identity-meta')
  await expect(malicious).toContainText('<img src=x onerror=alert(1)> $& {venue}')
  await expect(malicious.locator('img')).toHaveCount(0)
  for (const card of await cards.all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth+1)).toBe(true)
    const glyph = (await card.locator('.strategy-glyph').boundingBox())!, text = (await card.locator('.skf-nm').boundingBox())!
    expect(glyph.width).toBe(28); expect(glyph.x+glyph.width).toBeLessThan(text.x)
    expect(await card.locator('.strategy-identity-meta').evaluate(el => el.scrollHeight <= el.clientHeight+1)).toBe(true)
  }
  expect(external).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`identity-${language}-320.png`), fullPage: true })
})
