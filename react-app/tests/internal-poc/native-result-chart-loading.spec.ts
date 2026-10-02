import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'
import { resultHost } from './helpers/native-result-presentation-host'
import { marketChartText } from '../../src/client-market-chart-copy'

const rendererPath = '/src/components/ClientProfessionalPriceChart.tsx'
const rendererRoute = '**/src/components/ClientProfessionalPriceChart.tsx*'
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const slot = (page: Page) => page.locator('[data-native-chart-load]')
const skip = (page: Page) => page.getByRole('button', { name: 'Skip · 결과 보기', exact: true })
const audit = (page: Page) => page.evaluate(() => Reflect.get(window, 'automaticResultAudit') as {
  consumed: number; markers: number; readerCreated: number; readerDisposed: number
  statuses: { state: string; reportReady: boolean }[]
})
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
async function language(page: Page, value: string) {
  await page.evaluate(value => Reflect.get(window, 'setAutomaticResultLanguage')(value), value)
}
async function holdRenderer(page: Page, fail = false) {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const requests: string[] = []
  await page.route(rendererRoute, async route => {
    requests.push(new URL(route.request().url()).pathname)
    await gate
    if (fail) await route.fulfill({ status: 503, contentType: 'text/plain', body: 'TEST_ONLY_RENDERER_CHUNK_UNAVAILABLE' })
    else await route.fallback()
  })
  return { release, requests }
}
async function preparedWithoutRenderer(page: Page) {
  await expect.poll(async () => (await audit(page)).statuses.at(-1)).toMatchObject({ state: 'ready', reportReady: true })
  await expect(slot(page)).toHaveAttribute('data-native-chart-load', 'loading')
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
  await expect(page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'true')
  expect((await audit(page)).readerCreated).toBe(0)
  expect((await audit(page)).markers).toBe(0)
  await expect(skip(page)).toHaveCount(0)
}

// SDK-valid synthetic reads through the real result controller. These are not
// producer, authentication, source-custody or built-asset acceptance tests.
test('결과가 없으면 renderer 요청 0, 첫 결과 슬롯 로딩 중에도 보고서 상태와 대화 입력을 유지한다', async ({ page }) => {
  const held = await holdRenderer(page)
  const control = await resultHost(page, { mountOnDelivery: true, replayReader: true, boundedReplayPrices: true })
  try {
    expect(held.requests).toHaveLength(0)
    const input = page.locator('.g-composer textarea'), composer = await input.elementHandle()
    await input.fill('코드 로딩 중에도 보존할 질문')
    await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
    await expect.poll(async () => (await audit(page)).consumed).toBe(1)
    await preparedWithoutRenderer(page)
    for (const value of languages) {
      await language(page, value)
      await expect(slot(page).getByRole('status', { includeHidden: true })).toHaveText(marketChartText(value, 'rendererLoading'))
      await expect(input).toHaveValue('코드 로딩 중에도 보존할 질문')
      expect(await composer!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
      expect((await audit(page)).statuses.at(-1)?.reportReady).toBe(true)
    }
    await language(page, 'ko')
    held.release()
    await expect(skip(page)).toBeVisible()
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
    const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
    expect((await audit(page)).consumed).toBe(1)
    expect((await audit(page)).readerCreated).toBe(1)
    await skip(page).click()
    await expect(skip(page)).toHaveCount(0)
    await expect(input).toHaveValue('코드 로딩 중에도 보존할 질문')
    await expect(input).toBeFocused()
    expect(await composer!.evaluate(node => node.isConnected)).toBe(true)
    expect(await canvas!.evaluate(node => node.isConnected && node === document.querySelector('.cp-surface canvas'))).toBe(true)
    await language(page, 'fr'); await language(page, 'ko'); await flush(page)
    expect((await audit(page)).consumed).toBe(1)
    expect((await audit(page)).readerCreated).toBe(1)
    expect((await audit(page)).readerDisposed).toBe(1)
    expect(held.requests).toHaveLength(1)
    expect(control.errors).toEqual([])
  } finally { held.release() }
})

for (const abandon of ['owner', 'hidden', 'navigation'] as const) test(`renderer 대기 중 ${abandon} 이탈·복귀는 늦은 자동 재생을 만들지 않는다`, async ({ page }) => {
  const held = await holdRenderer(page)
  const control = await resultHost(page, { mountOnDelivery: true, replayReader: true, boundedReplayPrices: true })
  try {
    await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
    await expect.poll(async () => (await audit(page)).consumed).toBe(1)
    await preparedWithoutRenderer(page)
    if (abandon === 'owner') await page.evaluate(() => Reflect.get(window, 'replaceAutomaticOwner')())
    if (abandon === 'hidden') {
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
      await flush(page)
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')) })
    }
    if (abandon === 'navigation') {
      if ((page.viewportSize()?.width ?? 0) <= 1024) await page.locator('.client-hamburger').click()
      await page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true }).click()
      await expect(page.locator('.native-strategies')).toBeVisible()
      await flush(page)
      await page.goBack()
      await expect(page.locator('.native-strategies')).toBeHidden()
    }
    held.release()
    await expect(page.locator('.cp-surface canvas').first()).toBeAttached()
    await language(page, 'fr'); await language(page, 'ko'); await flush(page)
    await expect(skip(page)).toHaveCount(0)
    expect((await audit(page)).consumed).toBe(1)
    expect((await audit(page)).readerCreated).toBe(0)
    expect((await audit(page)).markers).toBe(0)
    await expect(page.locator('.g-composer textarea')).toHaveValue('자동 재생 뒤에도 보존할 질문')
    expect(control.requests.filter(url => url.pathname.endsWith('/chronological-fill-markers'))).toHaveLength(0)
    expect(control.errors).toEqual([])
  } finally { held.release() }
})

test('chunk 503은 renderer 실패로 자동 후보를 폐기하고 보고서·초안·포커스는 보존한다', async ({ page }) => {
  const held = await holdRenderer(page, true)
  const documents: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(new URL(request.url()).pathname) })
  const control = await resultHost(page, { mountOnDelivery: true, replayReader: true, boundedReplayPrices: true })
  try {
    const input = page.locator('.g-composer textarea'), composer = await input.elementHandle()
    await input.fill('새로고침 전까지만 화면에 남는 초안')
    await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
    await preparedWithoutRenderer(page)
    held.release()
    await expect(slot(page)).toHaveAttribute('data-native-chart-load', 'failed')
    for (const value of languages) {
      await language(page, value)
      await expect(slot(page).getByRole('alert', { includeHidden: true })).toHaveText(marketChartText(value, 'rendererFailed'))
      await expect(slot(page).getByRole('button', { name: marketChartText(value, 'rendererReload'), exact: true, includeHidden: true })).toBeAttached()
      await expect(input).toHaveValue('새로고침 전까지만 화면에 남는 초안')
      expect(await composer!.evaluate(node => node.isConnected && node === document.activeElement)).toBe(true)
      expect((await audit(page)).statuses.at(-1)?.reportReady).toBe(true)
    }
    await language(page, 'ko'); await flush(page)
    await expect(page.locator('.native-service-result').getByRole('button', { name: '차트로 결과 보기', exact: true, includeHidden: true })).toHaveAttribute('aria-disabled', 'true')
    await expect(skip(page)).toHaveCount(0)
    expect((await audit(page)).readerCreated).toBe(0)
    expect((await audit(page)).consumed).toBe(1)
    expect(held.requests).toHaveLength(1)
    expect(documents).toEqual(['/auto-result-test.html'])
    expect(control.errors).toEqual([])
    const analysis = page.locator('[data-analysis-tab="analysis"]')
    if (await analysis.isVisible()) await analysis.click()
    await Promise.all([
      page.waitForEvent('request', request => request.isNavigationRequest() && request.frame() === page.mainFrame()),
      slot(page).getByRole('button', { name: marketChartText('ko', 'rendererReload'), exact: true }).click(),
    ])
    expect(documents).toEqual(['/auto-result-test.html', '/auto-result-test.html'])
    // The helper intentionally does not restore its in-memory root on reload.
    // A built service must bootstrap/revalidate its session; no draft guarantee.
  } finally { held.release() }
})

test('로딩 중 결과가 퇴장하면 늦은 코드 평가가 차트·reader·자동 모달을 되살리지 않는다', async ({ page }) => {
  const held = await holdRenderer(page)
  const control = await resultHost(page, { mountOnDelivery: true, replayReader: true, boundedReplayPrices: true })
  try {
    await page.evaluate(() => Reflect.get(window, 'deliverAutomaticResult')())
    await preparedWithoutRenderer(page)
    await page.evaluate(() => Reflect.get(window, 'retireAutomaticResult')())
    const response = page.waitForResponse(response => new URL(response.url()).pathname === rendererPath)
    held.release()
    await (await response).finished()
    await page.evaluate(async () => { const path = '/src/components/ClientProfessionalPriceChart.tsx'; await import(/* @vite-ignore */ path) })
    await flush(page)
    await expect(page.locator('.native-service-result,.cp-surface canvas,dialog[open]')).toHaveCount(0)
    expect((await audit(page)).readerCreated).toBe(0)
    expect(control.errors).toEqual([])
  } finally { held.release() }
})
