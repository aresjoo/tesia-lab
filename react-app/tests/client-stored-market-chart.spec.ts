import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { MarketChartPresentation } from '../src/client-market-chart-presentation'

const owner = 'chart-supply@example.test', sessionId = 'chart-session', turnId = 'chart-turn'
const key = 'teth-client-experience'
function presentation(revision = 1, resolutionSeconds = 3600): MarketChartPresentation {
  return { binding: { scopeId: JSON.stringify([owner, sessionId]), messageId: turnId, observationId: `observation-${revision}` },
    seriesId: 'supplied-series', asset: 'BTC/USDT', assetLabel: '비트코인', resolutionSeconds,
    availableResolutions: [3600, 7200, 14400], state: 'ready',
    view: { identity: `view-${revision}`, market: 'BTC/USDT', resolutionSeconds, pricePrecision: 2,
      sourceLabel: '검수용 합성 관측 · 실제 시세 아님', fills: [],
      bars: Array.from({ length: 30 }, (_, i) => ({ time: 1700000000 + i * resolutionSeconds, open: 100 + revision + i,
        high: 107 + revision + i, low: 98 + revision + i, close: 105 + revision + i, volume: 50 + i })) } }
}
async function mount(page: Page, loading = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const session: ClientSession = { id: sessionId, title: '시장 관측', renamed: false, idea: '흐름을 보여주세요', draft: '작성 중인 질문',
    pair: '', mode: '', timeframe: '', risk: '', takeProfit: '', researchStatus: '초안', phase: 'plan',
    workspace: 'conversation', tradingReady: false, updatedAt: 1700000001000,
    turns: [{ id: turnId, question: '흐름을 보여주세요', answer: '공급된 관측입니다.', fullAnswer: '공급된 관측입니다.', startedAt: 1700000000000,
      status: 'done', phase: 'plan', suggestions: [], marketResponse: { version: 1, owner, blocks: [
        { id: 'chart', kind: 'market-chart', presentation: { ...presentation(), state: loading ? 'loading' : 'ready' } },
        { id: 'question', kind: 'market-question', presentation: { binding: { ...presentation().binding, observationId: 'question' },
          steps: [{ id: 'risk', title: '어떤 흐름을 볼까요?', multi: true, options: [{ id: 'stable', label: '안정적인 흐름' }] }] } },
      ] } }] }
  await page.addInitScript(({ key, session, owner }) => {
    if (sessionStorage.getItem('chart-supply-seeded')) return
    sessionStorage.setItem('chart-supply-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '차트 검수', email: owner }))
    sessionStorage.setItem(key, JSON.stringify({ sessions: [session], currentId: session.id, homeDraft: '', sharedFollows: [] }))
  }, { key, session, owner })
  await page.route('**/stored-market-chart-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' }))
  await page.goto('/stored-market-chart-test.html')
  await page.evaluate(async owner => {
    const path = '/tests/fixtures/stored-market-chart-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'chartSupplyHost', mount(owner))
  }, owner)
  await expect(page.locator('.client-market-chart canvas').first()).toBeVisible()
}
const card = (page: Page) => page.locator('.client-market-chart')
const intervals = (page: Page) => card(page).locator('.market-chart-intervals')
async function request(page: Page, hours = 2) {
  await intervals(page).getByRole('button', { name: `${hours}시간`, exact: true }).click()
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'true')
}
async function deliver(page: Page, value: unknown, index = 0) {
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests.length)).toBeGreaterThan(index)
  await page.evaluate(({ value, index }) => Reflect.get(window, 'chartSupplyHost').requests[index].resolve(value), { value, index })
}
async function remember(page: Page) { await card(page).locator('canvas').first().evaluate(el => Reflect.set(window, 'supplyCanvas', el)) }
async function retained(page: Page) { expect(await card(page).locator('canvas').first().evaluate(el => Reflect.get(window, 'supplyCanvas') === el)).toBe(true) }
async function persisted(page: Page) { return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), key) }

test('실제 공개 shell: 저장 수락 후에만 1/2/4시간 봉을 같은 canvas에 반영한다', async ({ page }, info) => {
  const errors: string[] = [], posts: string[] = []
  page.on('pageerror', error => errors.push(error.message)); page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()) })
  await mount(page); await remember(page); await request(page)
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.g-askcard').getByText('안정적인 흐름', { exact: true }).click()
  // The source question dock replaces, rather than overlaps, the composer.
  await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await page.locator('.g-composer textarea').fill('차트 대기 중 수정한 초안')
  await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').render())
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests.map((r: { signal: AbortSignal }) => r.signal.aborted))).toEqual([false])
  await deliver(page, presentation(2, 7200)); await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false'); await retained(page)
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const saved = await persisted(page)
  expect(saved.sessions[0].draft).toBe('차트 대기 중 수정한 초안')
  expect(saved.sessions[0].turns[0].marketResponse.blocks[1].presentation.state.picks).toEqual([['stable']])
  expect(saved.sessions[0].turns[0].marketResponse.blocks[0].presentation.view).toEqual(presentation(2, 7200).view)
  await request(page, 4); await deliver(page, presentation(3, 14400), 1); await retained(page)
  await expect(intervals(page).getByRole('button', { name: '4시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: info.outputPath('stored-chart-supply.png'), fullPage: true })
  expect(errors).toEqual([]); expect(posts).toEqual([])
})

test('대기 중 언어/일반 재렌더는 요청을 취소하지 않는다', async ({ page }) => {
  await mount(page); await remember(page); await request(page)
  for (const language of ['en', 'fr', 'ko']) await page.evaluate(language => Reflect.get(window, 'chartSupplyHost').language(language), language)
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[0].signal.aborted)).toBe(false)
  await deliver(page, presentation(2, 7200)); await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false'); await retained(page)
})

for (const failure of ['throw', 'scope', 'asset', 'resolution', 'ohlc', 'loading'] as const) test(`${failure}: 기존 관측을 유지하고 실패했던 주기로 재시도한다`, async ({ page }) => {
  await mount(page); await remember(page); await request(page)
  const next = presentation(2, 7200)
  if (failure === 'scope') next.binding.scopeId = 'foreign'
  if (failure === 'asset') next.asset = 'ETH/USDT'
  if (failure === 'resolution') next.resolutionSeconds = 14400
  if (failure === 'ohlc') next.view!.bars[0].high = 1
  if (failure === 'loading') next.state = 'loading'
  if (failure === 'throw') await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[0].reject())
  else await deliver(page, next)
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false'); await retained(page)
  await expect(card(page).locator('.market-chart-status')).toContainText('2시간')
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await card(page).locator('.market-chart-status button').click()
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[1].request.resolutionSeconds)).toBe(7200)
  await deliver(page, presentation(3, 7200), 1)
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

for (const change of ['remove', 'id', 'owner', 'unmount'] as const) test(`${change}: 공급 수명 종료는 즉시 취소하고 늦은 응답을 저장하지 않는다`, async ({ page }) => {
  await mount(page); await request(page)
  await page.evaluate(change => {
    const host = Reflect.get(window, 'chartSupplyHost')
    if (change === 'remove') host.connected(false)
    if (change === 'id') host.source('replacement')
    if (change === 'owner') host.source('test-source', 'someone-else')
    if (change === 'unmount') host.unmount()
  }, change)
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[0].signal.aborted)).toBe(true)
  await deliver(page, presentation(2, 7200))
  expect((await persisted(page)).sessions[0].turns[0].marketResponse.blocks[0].presentation.resolutionSeconds).toBe(3600)
  if (change !== 'unmount') await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false')
  if (change === 'id') {
    await request(page, 4); await deliver(page, presentation(3, 14400), 1)
    await expect(intervals(page).getByRole('button', { name: '4시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
})

test('저장된 loading은 실제 진행 중인 요청이 아니며 명시 재시도로 복구한다', async ({ page }) => {
  await mount(page, true); await remember(page)
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests.length)).toBe(0)
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false')
  await card(page).locator('.market-chart-status button').click()
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[0].request.resolutionSeconds)).toBe(3600)
  await deliver(page, presentation(2)); await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false'); await retained(page)
  expect((await persisted(page)).sessions[0].turns[0].marketResponse.blocks[0].presentation.state).toBe('ready')
})

test('새로고침 후 마지막 수락 주기와 봉은 복원하고 공급자 없이는 버튼을 잠근다', async ({ page }) => {
  await mount(page); await request(page); await deliver(page, presentation(2, 7200))
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await page.evaluate(async owner => {
    const path = '/tests/fixtures/stored-market-chart-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    const host = mount(owner); host.connected(false); Reflect.set(window, 'chartSupplyHost', host)
  }, owner)
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toBeDisabled()
  expect((await persisted(page)).sessions[0].turns[0].marketResponse.blocks[0].presentation.view).toEqual(presentation(2, 7200).view)
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests.length)).toBe(0)
})

for (const fault of ['denied', 'drop', 'readback'] as const) test(`${fault}: 실제 shell도 저장 실패 시 옛 차트를 유지하고 안전하게 안내한다`, async ({ page }) => {
  await mount(page); await remember(page); await request(page)
  await page.evaluate(({ key, fault }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    let written = false
    let chartCommitAttempts = 0
    Storage.prototype.setItem = function (name, value) {
      // Inject the chart response's durable-write fault only. The same key
      // also receives debounced viewport saves of the old observation; failing
      // those creates a separate storageError gate before the explicit retry.
      const chart = this === sessionStorage && name === key
        ? JSON.parse(value).sessions[0].turns[0].marketResponse.blocks[0].presentation : undefined
      if (chart?.resolutionSeconds === 7200) {
        written = true
        chartCommitAttempts++
        if (fault === 'denied') throw new Error('TEST_ONLY_DENIAL')
        if (fault === 'drop') return
      }
      return set.call(this, name, value)
    }
    Storage.prototype.getItem = function (name) {
      if (this === sessionStorage && name === key && written && fault === 'readback') throw new Error('TEST_ONLY_READBACK')
      return get.call(this, name)
    }
    Reflect.set(window, 'supplyChartCommitAttempts', () => chartCommitAttempts)
    Reflect.set(window, 'restoreSupplyStorage', () => { Storage.prototype.getItem = get; Storage.prototype.setItem = set })
  }, { key, fault })
  await deliver(page, presentation(2, 7200))
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false'); await retained(page)
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('body')).not.toContainText('TEST_ONLY_')
  expect(await page.evaluate(() => Reflect.get(window, 'supplyChartCommitAttempts')())).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'restoreSupplyStorage')())
  if (fault === 'readback') {
    await expect(page.locator('body')).toContainText('저장 여부를 확인할 수 없어요')
    await card(page).locator('.market-chart-status button').click()
    await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false')
    expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests.length)).toBe(1)
  } else {
    await card(page).locator('.market-chart-status button').click(); await deliver(page, presentation(3, 7200), 1)
    await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
})

test('새 대화로 떠난 뒤 도착한 봉은 이전 대화를 덮어쓰지 않는다', async ({ page }) => {
  await mount(page); await request(page)
  if (page.viewportSize()!.width <= 860) {
    await page.locator('.client-hamburger').click()
    await page.locator('.client-new-strategy').click()
  } else await page.locator('.client-rail-new-row button').click()
  expect(await page.evaluate(() => Reflect.get(window, 'chartSupplyHost').requests[0].signal.aborted)).toBe(true)
  await deliver(page, presentation(2, 7200))
  await expect(card(page)).toHaveCount(0)
  expect((await persisted(page)).sessions[0].turns[0].marketResponse.blocks[0].presentation.resolutionSeconds).toBe(3600)
})

for (const width of [320, 390]) test(`${width}px 차트 도구의 짧은 라벨을 글자별로 쪼개지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 }); await mount(page)
  const counts = await card(page).locator('.cp-controls button').evaluateAll(buttons => buttons.slice(0, 2).map(button => {
    const range = document.createRange(); range.selectNodeContents(button)
    return range.getClientRects().length
  }))
  expect(counts).toEqual([1, 1])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await card(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('chart-controls.png'), fullPage: true })
})
