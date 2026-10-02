import { expect, test, type Page } from '@playwright/test'
import { PriceDrawings, drawingTools } from '../src/chart/price-drawings'
import { priceDrawingCopy } from '../src/chart/price-drawing-copy'
import { fixture } from '../src/dev/chart-workspace-fixture'
import type { ClientLanguage } from '../src/client-preferences'

async function mount(page: Page, variant: 'analysis' | 'market' = 'analysis') {
  await page.goto('/')
  // Load the actual main shell's shared layout CSS before the standalone chart
  // hides that shell and captures pointer coordinates.
  await expect(page.locator('.client-home-content textarea')).toBeVisible()
  await page.evaluate(async ({ view, variant }) => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: mount(view, 'drawing-test-owner', variant) })
  }, { view: fixture, variant })
  await expect(page.getByRole('button', { name: '추세선', exact: true })).toBeEnabled()
}

test('도형은 가격자료와 별개이며 상한·undo/redo·취소·수정·재생차단을 보존한다', () => {
  const drawings = new PriceDrawings(), first = { time: fixture.bars[0].time, price: 100 }, last = { time: fixture.bars[1].time, price: 110 }
  const original = JSON.stringify(fixture)
  expect(drawings.place(first)).toBe(false)
  drawings.setEnabled(true); drawings.choose('trend'); drawings.place(first)
  expect(drawings.getSnapshot().pending).toBe(true); expect(drawings.getSnapshot().items).toHaveLength(0)
  drawings.place(last); const added = drawings.getSnapshot().items
  expect(added[0]).toMatchObject({ kind: 'trend', a: first, b: last })
  drawings.undo(); expect(drawings.getSnapshot().items).toHaveLength(0)
  drawings.redo(); expect(drawings.getSnapshot().items).toEqual(added)
  drawings.select(added[0].id); drawings.edit('b'); drawings.place({ ...last, price: 120 })
  expect(drawings.getSnapshot().items[0].b.price).toBe(120)
  expect(added[0].b.price).toBe(110)
  drawings.undo(); drawings.choose('rectangle'); drawings.place(first); drawings.cancel()
  expect(drawings.getSnapshot().items).toEqual(added)
  drawings.setEnabled(false); drawings.choose('horizontal'); drawings.place(last); drawings.removeSelected(); drawings.undo()
  expect(drawings.getSnapshot().items).toEqual(added)
  drawings.setEnabled(true); drawings.select(added[0].id); drawings.removeSelected()
  expect(drawings.getSnapshot().items).toHaveLength(0)
  for (let i = 0; i < 105; i++) { drawings.choose('horizontal'); drawings.place({ ...first, price: 100 + i }) }
  expect(drawings.getSnapshot().items).toHaveLength(100)
  for (let i = 0; i < 55; i++) drawings.undo()
  expect(drawings.getSnapshot().items).toHaveLength(50)
  expect(JSON.stringify(fixture)).toBe(original)
  const before = drawings.getSnapshot().items
  for (const price of [NaN, Infinity, 0, -1]) { drawings.choose('trend'); expect(drawings.place({ ...first, price })).toBe(false) }
  expect(drawings.getSnapshot().items).toEqual(before)
  const hidden = new PriceDrawings()
  hidden.setEnabled(true); hidden.choose('horizontal'); hidden.place(first); hidden.toggleHidden(); hidden.undo()
  expect(hidden.getSnapshot()).toMatchObject({ items: [], hidden: true })
  hidden.choose('trend'); expect(hidden.getSnapshot().hidden).toBe(false)
  hidden.place(first); hidden.place(last); expect(hidden.getSnapshot().items).toHaveLength(1)
})

test('7개 도구를 키보드로 그리고 변경·삭제·복구하며 같은 차트와 실제 관측을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const surface = page.locator('.cp-surface'), details = page.locator('.cp-drawing-details'), originalCanvas = await surface.locator('canvas').first().elementHandle()
  for (const [index, tool] of drawingTools.filter(tool => tool !== 'cursor').entries()) {
    await page.getByRole('button', { name: priceDrawingCopy('ko')[tool], exact: true }).click()
    await expect(surface).toBeFocused()
    await surface.press('Home'); await surface.press('Enter')
    if (!['horizontal', 'vertical'].includes(tool)) {
      await expect(details).toHaveAttribute('data-drawing-count', String(index))
      await surface.press('ArrowRight'); await surface.press('ArrowRight'); await surface.press('ArrowUp'); await surface.press('Enter')
    }
    await expect(details).toHaveAttribute('data-drawing-count', String(index + 1))
  }
  await page.getByRole('button', { name: '끝점 변경', exact: true }).click()
  await expect(page.getByRole('button', { name: '끝점 변경', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await surface.press('End'); await surface.press('Enter')
  await details.locator('summary').click()
  await expect(details.locator('li').last()).toContainText('가격 범위')
  await expect(details.locator('li').last()).toContainText(String(fixture.bars.at(-1)!.close))
  await page.getByRole('button', { name: '선택 도형 삭제', exact: true }).click()
  await expect(surface).toBeFocused()
  await expect(details).toHaveAttribute('data-drawing-count', '6')
  await page.getByRole('button', { name: '되돌리기', exact: true }).click()
  await expect(surface).toBeFocused()
  await expect(details).toHaveAttribute('data-drawing-count', '7')
  await page.getByRole('button', { name: '다시 실행', exact: true }).click()
  await expect(details).toHaveAttribute('data-drawing-count', '6')
  await page.getByRole('button', { name: '도형 숨기기', exact: true }).click()
  await expect(details).toHaveAttribute('data-drawing-hidden', 'true')
  await page.getByRole('button', { name: '도형 표시', exact: true }).click()
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.getByRole('button', { name: '%', exact: true }).click()
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  expect(await originalCanvas!.evaluate(element => element.isConnected)).toBe(true)
  await surface.focus(); await surface.press('Home'); await surface.press('ArrowRight'); await surface.press('ArrowRight')
  await expect(page.locator('.cp-fills button')).toHaveCount(2)
  await page.locator('.cp-fills button').first().click(); await expect(page.locator('#selected-fill')).toHaveText('buy-1')
  await page.screenshot({ path: info.outputPath('drawing-tools.png') })
  expect(errors).toEqual([])
})

test('포인터·터치는 같은 시간 가격에 도형을 그리고 320px/확대/7언어에서 조작을 유지한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const surface = page.locator('.cp-surface'), details = page.locator('.cp-drawing-details')
  await page.getByRole('button', { name: '추세선', exact: true }).click()
  const click = async (x: number, y: number) => info.project.name === 'mobile' ? surface.tap({ position: { x, y } }) : surface.click({ position: { x, y } })
  const box = (await surface.boundingBox())!
  await click(box.width * .2, 80); await click(box.width * .6, 140)
  await expect(details).toHaveAttribute('data-drawing-count', '1')
  await details.locator('summary').click()
  const original = await details.locator('li').innerText()
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect.poll(() => page.locator('.cp-chart').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    const dimensions = await page.locator('.cp-drawing-tools button').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height } }))
    expect(dimensions.every(d => d.w >= 44 && d.h >= 44)).toBe(true)
    await expect(details.locator('li')).toHaveText(original, { useInnerText: true })
    if (width === 320) await page.screenshot({ path: info.outputPath('drawing-tools-320.png') })
  }
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await expect(page.getByRole('group', { name: priceDrawingCopy(language).group, exact: true })).toBeVisible()
    await expect(details).toHaveAttribute('data-drawing-count', '1')
  }
  await page.setViewportSize({ width: 320, height: 1000 })
  await page.addStyleTag({ content: '.cp-chart { font-size: 200% } .cp-drawing-details { font-size: 24px } .cp-drawing-details small { font-size: 22px }' })
  expect(await page.locator('.cp-chart').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('drawing-tools-fr-200.png') })
  expect(errors).toEqual([])
})

test('미완성 도형 취소와 재생 중 차단은 도형·원본 캔버스를 보존한다', async ({ page }) => {
  await mount(page)
  const surface = page.locator('.cp-surface'), details = page.locator('.cp-drawing-details')
  await page.getByRole('button', { name: '수평선', exact: true }).click(); await surface.press('Home'); await surface.press('Enter')
  await page.getByRole('button', { name: '추세선', exact: true }).click(); await surface.press('Home'); await surface.press('Enter'); await surface.press('Escape')
  await expect(details).toHaveAttribute('data-drawing-count', '1')
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.getByRole('button', { name: '추세선', exact: true })).toBeDisabled()
  await expect(details).toHaveAttribute('data-drawing-count', '1')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.getByRole('button', { name: '추세선', exact: true })).toBeEnabled()
  await expect(details).toHaveAttribute('data-drawing-count', '1')
})

test('시장 차트 높이·도구막대·동일 종목 연속 창은 유지하고 다른 종목의 도형은 남기지 않는다', async ({ page }, info) => {
  await mount(page, 'market')
  const surface = page.locator('.cp-surface'), details = page.locator('.cp-drawing-details')
  const canvas = await surface.locator('canvas').first().elementHandle()
  await page.getByRole('button', { name: '수평선', exact: true }).click(); await surface.press('Home'); await surface.press('Enter')
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect.poll(() => surface.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(width <= 640 ? 220 : 99)
    const layout = await page.locator('.cp-market-body').evaluate(el => {
      const box = el.getBoundingClientRect(), plot = el.querySelector('.cp-surface')!.getBoundingClientRect(), tools = el.querySelector('.cp-drawing-tools')!
      return { bottom: plot.bottom - box.bottom, overflow: tools.scrollWidth - tools.clientWidth }
    })
    expect(layout.bottom).toBeLessThanOrEqual(1)
    if (width > 640) expect(layout.overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath(`drawing-market-${width}.png`) })
  }
  await page.evaluate(next => {
    (window as unknown as { priceChartHost: { render(view: typeof next): void } }).priceChartHost.render(next)
  }, { ...fixture, identity: 'next-window', bars: fixture.bars.slice(1) })
  await expect(details).toHaveAttribute('data-drawing-count', '1')
  expect(await canvas!.evaluate(el => el.isConnected)).toBe(true)
  await page.evaluate(next => {
    (window as unknown as { priceChartHost: { render(view: typeof next): void } }).priceChartHost.render(next)
  }, { ...fixture, identity: 'other-market', market: 'ETH/USDT' })
  await expect(details).toHaveAttribute('data-drawing-count', '0')
  await expect(page.getByRole('button', { name: '되돌리기', exact: true })).toBeDisabled()
  expect(await canvas!.evaluate(el => el.isConnected)).toBe(true)
})

test('드래그·포인터 취소·가격축·RSI 영역을 도형 끝점으로 오인하지 않는다', async ({ page }) => {
  await mount(page)
  const surface = page.locator('.cp-surface'), details = page.locator('.cp-drawing-details')
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: '추세선', exact: true }).click()
  const box = (await surface.boundingBox())!
  await surface.dispatchEvent('pointerdown', { pointerId: 51, isPrimary: true, button: 0, clientX: box.x + 40, clientY: box.y + 40 })
  await surface.dispatchEvent('pointerup', { pointerId: 51, isPrimary: true, button: 0, clientX: box.x + 80, clientY: box.y + 80 })
  await expect(details.locator('[role=status]')).not.toContainText('끝점을')
  await surface.dispatchEvent('pointerdown', { pointerId: 52, isPrimary: true, button: 0, clientX: box.x + 40, clientY: box.y + 40 })
  await surface.dispatchEvent('pointercancel', { pointerId: 52 })
  await surface.dispatchEvent('pointerup', { pointerId: 52, isPrimary: true, button: 0, clientX: box.x + 40, clientY: box.y + 40 })
  await expect(details.locator('[role=status]')).not.toContainText('끝점을')
  await surface.click({ position: { x: box.width - 5, y: 50 } })
  await expect(details.locator('[role=status]')).not.toContainText('끝점을')
  await surface.click({ position: { x: 40, y: box.height - 45 } })
  await expect(details.locator('[role=status]')).not.toContainText('끝점을')
  await expect(details).toHaveAttribute('data-drawing-count', '0')
  await surface.press('Home'); await surface.press('Enter'); await surface.press('ArrowRight'); await surface.press('Enter')
  await expect(details).toHaveAttribute('data-drawing-count', '1')
})
