import { expect, test, type Page } from '@playwright/test'
import { catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueJudgments } from '../src/client-catalogue-judgments'
import { catalogueTerminalModel, splitCatalogueThought } from '../src/client-catalogue-terminal'
import { catalogueTerminalText } from '../src/client-catalogue-terminal-copy'
import type { CataloguePreviewResult } from '../src/client-catalogue-preview'
import type { ClientLanguage } from '../src/client-preferences'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'

const owner = 'terminal-judgment@example.test', key = catalogueCopyStorageKey(owner)
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
test.setTimeout(60_000)

test('31개 원본 전략: 결정·정리조건·현재 수익률과 원문 보존, 표시만으로 결과를 변경하지 않는다', async () => {
  const data = await loadCatalogueMarketData()
  let futurePositions = 0, spotPositions = 0, flat = 0
  for (const strategy of catalogueStrategies) {
    const result = strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data)
    const value: CataloguePreviewResult = { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected', calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v }, result }
    value.judgments = catalogueJudgments(value, data)
    const before = JSON.stringify(value), open = result.state.open
    const positions = Array.isArray(open) ? open : open ? [open] : []
    const ko = catalogueTerminalModel(value, 'ko')
    expect(ko.holdings).toHaveLength(positions.length)
    expect(ko.thought).not.toMatch(/undefined|NaN|null|\+null/)
    expect(splitCatalogueThought(ko.thought).head).toMatch(/^저는 .+ (정리합니다|진입합니다)\.$/)
    expect(splitCatalogueThought(ko.thought).rest).toBe(value.judgments.find(m => m.k === 'now')?.t)
    expect(ko.history).toEqual(value.judgments.filter(m => m.k !== 'now' && m.k !== 'intro'))
    if (!positions.length) { flat++; expect(ko.thought).toContain('저는 지금 현금으로 기다립니다.') }
    for (const [i, position] of positions.entries()) {
      expect(ko.holdings[i].percent).toBe('pnl' in position ? position.pnl : position.chg)
      if ('pnl' in position) futurePositions++; else spotPositions++
    }
    for (const language of languages) {
      const model = catalogueTerminalModel(value, language)
      expect(model.holdings).toEqual(ko.holdings)
      expect(model.thought).toBe(ko.thought)
      expect(model.rule).not.toMatch(/undefined|NaN|null/)
      if (language !== 'ko') expect(model.headline).not.toMatch(/롱|숏/)
    }
    expect(JSON.stringify(value)).toBe(before)
  }
  expect(futurePositions).toBeGreaterThan(0); expect(spotPositions).toBeGreaterThan(0); expect(flat).toBeGreaterThan(0)
  expect(splitCatalogueThought('진입가 12.34입니다. 다음 조건을 확인합니다. 나머지 원문.')).toEqual({ head: '진입가 12.34입니다. 다음 조건을 확인합니다.', rest: '나머지 원문.' })
})

async function seed(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: owner })), owner)
  await page.goto('/')
  await page.evaluate(async owner => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const { catalogueCopyMinimum } = await import('/src/client-catalogue-copy-setup.ts')
    const { findCatalogueStrategy } = await import('/src/client-catalogue.ts')
    const c = createCatalogueCopyAccountController(owner)
    for (const strategyId of ['d1', 'f7', 'h1']) {
      const result = await c.start({ id: strategyId, strategyId, at: Date.UTC(2026, 8, 1), settings: { amount: catalogueCopyMinimum(findCatalogueStrategy(strategyId)!), loss: -20, existing: 'copy', cap: 95 } })
      if (!result.ok) throw Error(result.error)
    }
    c.dispose()
    // Hash navigation below keeps this document; exclude fixture construction.
    const messages = Reflect.get(window, 'copyWorkerMessages') as unknown[] | undefined
    if (messages) messages.length = 0
  }, owner)
  await page.goto('/#/trade')
  await expect(page.locator('.cctj-body')).toBeVisible()
}

test('모바일 종목 헤더 안의 메뉴: 스크롤·드로어·전체화면·화면 왕복에도 같은 차트를 보존한다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page)
  const header = page.locator('.ctm-header'), menu = header.locator('.client-hamburger')
  const canvas = page.locator('.catalogue-market-chart canvas').first()
  await expect(canvas).toBeVisible()
  const original = await canvas.elementHandle()
  const ledger = await page.evaluate(key => sessionStorage.getItem(key), key)
  await expect(page.locator('.client-hamburger')).toHaveCount(1)
  await expect(menu).toBeVisible()
  const checkPlacement = async () => {
    const box = await header.boundingBox(), button = await menu.boundingBox()
    expect(box && button).toBeTruthy()
    expect(button!.x).toBeGreaterThanOrEqual(box!.x)
    expect(button!.y).toBeGreaterThanOrEqual(box!.y)
    expect(button!.x + button!.width).toBeLessThanOrEqual(box!.x + box!.width)
    expect(button!.y + button!.height).toBeLessThanOrEqual(box!.y + box!.height)
    expect(await menu.evaluate(el => getComputedStyle(el).position)).toBe('static')
  }
  await checkPlacement()
  await page.locator('.client-source-terminal').evaluate(el => { el.scrollTop = 280 })
  await expect.poll(() => page.locator('.client-source-terminal').evaluate(el => el.scrollTop)).toBeGreaterThan(200)
  await checkPlacement()
  await menu.click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
  await expect(page.locator('.client-source-main')).toHaveAttribute('inert', '')
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(page.locator('.client-source-main')).not.toHaveAttribute('inert')
  await menu.click()
  await page.setViewportSize({ width: 1440, height: 844 })
  await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  await expect(page.locator('.client-source-main')).not.toHaveAttribute('inert')
  await expect(page.locator('.client-rail-logo-row button')).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  const expand = header.locator('.cat-expand')
  await expand.click()
  await expect(page.locator('dialog.ctt-modal')).toBeVisible()
  await expect(menu).toBeHidden()
  const symbolInModal = await header.locator('.ctm-symbol').boundingBox()
  const modalHeader = await header.boundingBox()
  expect(symbolInModal!.x - modalHeader!.x).toBeLessThan(20)
  await page.keyboard.press('Escape')
  await expect(expand).toBeFocused()
  expect(await canvas.evaluate((node, old) => node === old, original)).toBe(true)
  for (const width of [1440, 860, 320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.locator('.client-hamburger')).toHaveCount(1)
    if (width <= 860) { await expect(menu).toBeVisible(); await checkPlacement() }
    else await expect(menu).toBeHidden()
    expect(await canvas.evaluate((node, old) => node === old, original)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('integrated-terminal-menu.png') })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.evaluate(async () => { const { setClientPreference } = await import('/src/client-preferences.ts'); setClientPreference('language', 'fr') })
  await page.addStyleTag({ content: '.ctm-header .ctm-symbol b{font-size:36px!important}.ctm-header :is(.ctm-state,.ctm-source){font-size:24px!important}.ctm-header dt{font-size:24px!important}.ctm-header dd{font-size:26px!important}' })
  await checkPlacement()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await menu.click()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await page.screenshot({ path: info.outputPath('integrated-terminal-menu-fr-200.png') })
  await page.setViewportSize({ width: 320, height: 480 })
  await expect(header).toHaveCSS('position', 'relative')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeInViewport()
  await page.goto('/#/share')
  await expect(page.locator('.client-hamburger')).toBeVisible()
  await expect(header.locator('.client-hamburger')).toHaveCount(0)
  await page.goto('/#/trade')
  await expect(menu).toBeVisible()
  expect(await canvas.evaluate((node, old) => node === old, original)).toBe(true)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(ledger)
  expect(errors).toEqual([])
})

test('복사 전략과 차트 종목은 함께 전환되고 과거 스냅샷을 실시간 가격·개인체결로 표시하지 않는다', async ({ page }, testInfo) => {
  const errors: string[] = [], external: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('request', r => { if (/binance|bitget|okx\.com/.test(r.url())) external.push(r.url()) })
  await seed(page)
  const chart = page.locator('.catalogue-market-chart'), buttons = page.locator('.cctj-selector button')
  await expect(chart).toHaveAttribute('data-strategy-id', 'd1')
  await expect(chart.locator('.cst-close-chart canvas').first()).toBeVisible()
  await expect(page.locator('.ctm-symbol b')).toHaveText(await chart.locator('.cst-close-chart header b').innerText())
  await expect(page.locator('.ctm-symbol b')).not.toContainText('USDT')
  await expect(page.locator('.ctm-symbol > span:not(.ctm-symbol-icon)')).toHaveText('1D · 종가')
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  await buttons.nth(1).click()
  await expect(page.locator('.cctj-body')).toHaveAttribute('data-copy-id', 'f7')
  await expect(chart).toHaveAttribute('data-strategy-id', 'f7')
  await chart.scrollIntoViewIfNeeded()
  await expect(chart.locator('.cp-surface canvas').first()).toBeVisible()
  await expect(chart.getByRole('button', { name: 'VWAP', exact: true })).toBeDisabled()
  await expect(chart.getByRole('button', { name: '거래량', exact: true })).toBeDisabled()
  await expect(chart.locator('.cp-quote dd').last()).toHaveText('—')
  await expect(chart.locator(':scope > .cp-note')).toContainText('거래량 미제공')
  await expect(page.locator('.ctm-price b')).toHaveText('—')
  await expect(chart.locator('.cp-execution,.cp-fills')).toHaveCount(0)
  const symbol = await chart.getAttribute('data-asset')
  expect(symbol).toBeTruthy()
  const { catalogueTitle } = await import('../src/client-catalogue')
  await expect(page.locator('.ctm-symbol b')).toHaveText(`${catalogueTitle(symbol!)}/USDT`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath('copy-market.png'), fullPage: true })
  await buttons.nth(0).click(); await buttons.nth(1).click()
  await expect(chart).toHaveAttribute('data-strategy-id', 'f7')
  await expect(page.locator('.cctj-body')).toHaveAttribute('data-copy-id', 'f7')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
  expect(errors).toEqual([]); expect(external).toEqual([])
})

test('가격 조회만 실패하면 이전 종목·canvas를 숨기고 명시 재시도로 같은 복사 종목을 복구한다', async ({ page }) => {
  await page.addInitScript(() => {
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function(message: unknown, options?: StructuredSerializeOptions) {
      if ((message as { kind?: string }).kind === 'market' && Reflect.get(window, 'rejectMarket')) throw Error('TEST_ONLY_PRICE_FAILURE')
      return post.call(this, message, options)
    }
  })
  await seed(page)
  await expect(page.locator('.catalogue-market-chart')).toHaveAttribute('data-strategy-id', 'd1')
  await page.evaluate(() => Reflect.set(window, 'rejectMarket', true))
  await page.locator('.cctj-selector button').nth(1).click()
  await expect(page.locator('.cctj-body')).toHaveAttribute('data-copy-id', 'f7')
  const retry = page.locator('.ctt-chart').getByRole('button', { name: '다시 시도', exact: true })
  await expect(retry).toBeVisible()
  await expect(page.locator('.catalogue-market-chart')).toHaveCount(0)
  await expect(page.locator('.ctm-symbol b')).toHaveText('—')
  await page.evaluate(() => Reflect.set(window, 'rejectMarket', false))
  await retry.click()
  await expect(page.locator('.catalogue-market-chart')).toHaveAttribute('data-strategy-id', 'f7')
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
})

test('복사 가격의 7언어·320px·200%는 종목과 같은 canvas를 보존하며 원장을 바꾸지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 960 })
  await seed(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  for (const [index, chartClass] of ['.cst-close-chart', '.cp-surface'].entries()) {
    await page.locator('.cctj-selector button').nth(index).click()
    const canvas = page.locator(`${chartClass} canvas`).first()
    await expect(canvas).toBeVisible()
    const node = await canvas.elementHandle(), symbol = await page.locator('.ctm-symbol b').innerText()
    for (const language of languages) {
      await page.evaluate(async language => { const { setClientPreference } = await import('/src/client-preferences.ts'); setClientPreference('language', language) }, language)
      await expect(page.locator('.ctm-symbol b')).toHaveText(symbol)
      expect(await canvas.evaluate((el, previous) => el === previous, node)).toBe(true)
      expect(await page.locator('.catalogue-market-chart').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
  }
  await page.addStyleTag({ content: '.catalogue-market-chart .cp-chart{font-size:26px!important}.catalogue-market-chart .cp-source,.catalogue-market-chart .cp-footer,.catalogue-market-chart .cp-quote,.catalogue-market-chart .cp-studies,.catalogue-market-chart .cp-note{font-size:24px!important}' })
  const chart = page.locator('.catalogue-market-chart')
  await expect(chart.locator(':scope > .cp-note')).toHaveCSS('font-size', '24px')
  await expect(chart.locator('.cp-controls button').first()).toHaveCSS('font-size', '26px')
  await chart.scrollIntoViewIfNeeded()
  expect(await chart.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await chart.locator('.cp-toolbar button').first().click()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath('copy-market-fr-200.png') })
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
})

test('선택한 복사만 Worker에 조회하고 오류 복구·빠른 전환에도 이전 응답과 원장이 섞이지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const messages: { kind: string; strategyId?: string; indices?: number[] }[] = []
    Reflect.set(window, 'copyWorkerMessages', messages)
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function(message: unknown, options?: StructuredSerializeOptions) {
      messages.push(structuredClone(message) as typeof messages[number])
      if (Reflect.get(window, 'copyWorkerFailure')) throw Error('test-only worker send failure')
      return post.call(this, message, options)
    }
  })
  await seed(page)
  const panel = page.locator('.cctj'), body = panel.locator('.cctj-body'), buttons = panel.locator('.cctj-selector button')
  const messages = () => page.evaluate(() => Reflect.get(window, 'copyWorkerMessages') as { kind: string; strategyId?: string; indices?: number[] }[])
  expect([...new Set((await messages()).filter(m => m.kind === 'run').map(m => m.strategyId))]).toEqual(['d1'])
  expect((await messages()).filter(m => m.kind === 'copy').every(m => m.indices?.length === 0)).toBe(true)
  const original = await page.evaluate(key => sessionStorage.getItem(key), key)
  await page.evaluate(() => Reflect.set(window, 'copyWorkerFailure', true))
  await buttons.nth(2).click()
  await expect(panel.locator('.cctj-pending button')).toBeVisible()
  await expect(body).toHaveCount(0)
  await page.evaluate(() => Reflect.set(window, 'copyWorkerFailure', false))
  await panel.locator('.cctj-pending button').click()
  await expect(body).toHaveAttribute('data-copy-id', 'h1')
  await buttons.nth(1).click(); await buttons.nth(0).click()
  await expect(body).toHaveAttribute('data-copy-id', 'd1')
  await expect(panel.locator('.cctj-status')).toContainText('코인 셋 나눠 담기')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(original)
})

for (const width of [320, 768, 1440]) test(`${width}px 복사 선택·두문장·전문·관리 연결과 읽기전용 보존`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await seed(page)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  const panel = page.locator('.cctj'), body = panel.locator('.cctj-body'), thought = panel.locator('.cctj-thought')
  const original = await page.evaluate(key => sessionStorage.getItem(key), key)
  await expect(panel.locator('.cctj-selector button')).toHaveCount(3)
  for (const [i, id] of ['d1', 'f7', 'h1'].entries()) {
    const button = panel.locator('.cctj-selector button').nth(i)
    await button.click(); await expect(body).toHaveAttribute('data-copy-id', id)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.locator('h3')).toHaveCSS('font-size', '20px')
    await expect(panel.locator('h3')).toHaveCSS('font-weight', '400')
    if (width === 320) await expect(panel.locator('.cctj-positions dd').first()).toHaveCSS('text-align', 'left')
    await expect(thought.locator('h4')).toHaveText('TETH의 생각')
    await expect(thought.locator('p')).toHaveCSS('font-size', '16px')
    const more = thought.getByRole('button', { name: '더 보기', exact: true })
    await more.click(); await expect(thought.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    const expandedText = await thought.locator('p').innerText()
    await thought.getByRole('button', { name: '접기', exact: true }).click()
    expect((await thought.locator('p').innerText()).length).toBeLessThan(expandedText.length)
    const row = panel.locator('.cctj-feed details').first()
    await row.locator('summary').focus(); await page.keyboard.press('Enter'); await expect(row).toHaveAttribute('open', '')
    await page.keyboard.press('Enter'); await expect(row).not.toHaveAttribute('open', '')
    await expect(panel.locator('.cctj-basis')).toContainText('원본 전략')
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(original)
  await panel.locator('.cctj-selector button').first().click(); await expect(body).toHaveAttribute('data-copy-id', 'd1')
  await panel.locator('.cctj-thought').scrollIntoViewIfNeeded()
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))) })
  await page.screenshot({ path: info.outputPath('copy-brain.png') })
  await panel.locator('.cctj-selector button').nth(2).click(); await expect(body).toHaveAttribute('data-copy-id', 'h1')
  await panel.getByRole('button', { name: '복사 관리', exact: true }).click()
  await expect(page.locator('.catalogue-copy-management')).toBeVisible()
  await expect(page).toHaveURL(/h1/)
  await page.locator('.catalogue-copy-management .ss3-back').click()
  await expect(body).toHaveAttribute('data-copy-id', 'h1')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(original)
  expect(errors).toEqual([])
})

test('7언어·200% 글자: 선택과 펼친 원문 보존, 배치와 버튼 접근 유지', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 1100 }); await seed(page)
  const panel = page.locator('.cctj'), thought = panel.locator('.cctj-thought')
  await panel.locator('.cctj-selector button').nth(1).click()
  await expect(panel.locator('.cctj-body')).toHaveAttribute('data-copy-id', 'f7')
  await thought.getByRole('button', { name: '더 보기', exact: true }).click()
  const text = await thought.locator('p').innerText()
  for (const language of languages) {
    await page.evaluate(async language => { const { setClientPreference } = await import('/src/client-preferences.ts'); setClientPreference('language', language) }, language)
    await expect(thought.locator('h4')).toHaveText(catalogueTerminalText(language, 'thought'))
    await expect(thought.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(await thought.locator('p').innerText()).toBe(text)
    await expect(panel.locator('.cctj-body')).toHaveAttribute('data-copy-id', 'f7')
    expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(panel.getByRole('button', { name: catalogueTerminalText(language, 'manage'), exact: true })).toBeEnabled()
  }
  await page.addStyleTag({ content: '.cctj h3{font-size:40px!important}.cctj p,.cctj dd,.cctj dt,.cctj button,.cctj-summary,.cctj-feed details>p{font-size:32px!important}.cctj-date,.cctj-feed b,.cctj h4{font-size:28px!important}' })
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await thought.scrollIntoViewIfNeeded()
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))) })
  await page.screenshot({ path: info.outputPath('copy-brain-200.png') })
  await panel.getByRole('button', { name: catalogueTerminalText('fr', 'manage'), exact: true }).click()
  await expect(page.locator('.catalogue-copy-management')).toBeVisible()
})

test.describe('원본 날짜의 시간대 독립성', () => {
  test.use({ timezoneId: 'Asia/Seoul' })
  test('한국 시간대에서도 time datetime과 보이는 판단 날짜가 같은 날이다', async ({ page }) => {
    await seed(page)
    const times = page.locator('.cctj-feed time')
    expect(await times.count()).toBeGreaterThan(0)
    for (const time of await times.all()) {
      const parts = (await time.innerText()).match(/\d+/g)!
      expect(await time.getAttribute('datetime')).toBe(parts.map((p, i) => i === 0 ? p : p.padStart(2, '0')).join('-'))
    }
  })
})
