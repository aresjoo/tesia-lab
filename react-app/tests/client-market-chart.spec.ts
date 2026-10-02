import { expect, test, type Page } from '@playwright/test'
import type { MarketChartPresentation } from '../src/client-market-chart-presentation'

function presentation(revision = 1, resolutionSeconds = 3600): MarketChartPresentation {
  return { binding: { scopeId: 'owner-a/conversation-a', messageId: 'assistant-a', observationId: `observation-${revision}` },
    seriesId: 'market-a', asset: 'BTC / USDT', assetLabel: '비트코인', resolutionSeconds,
    availableResolutions: [3600, 7200, 14400, 86400], state: 'ready',
    view: { identity: `view-${revision}`, market: 'BTC / USDT', resolutionSeconds, pricePrecision: 2,
      sourceLabel: '검수용 합성 관측값, 실시간 시세 아님', fills: [],
      bars: Array.from({ length: 45 }, (_, i) => ({ time: 1_700_000_000 + i * resolutionSeconds, open: 100+i+revision, high: 107+i+revision, low: 98+i+revision, close: 105+i+revision, volume: 50+i })) },
  }
}
async function mount(page: Page, options: { native?: boolean; research?: boolean; connected?: boolean; failedRenderer?: boolean } = {}) {
  if (options.failedRenderer) await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    expect(body).toContain('chart = createChart(node, {')
    await route.fulfill({ response, body: body.replace('chart = createChart(node, {', 'if (!window.__marketAllowRenderer) { throw new Error("TEST_ONLY_RENDERER"); } chart = createChart(node, {') })
  })
  await page.route('**/market-chart-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' }))
  await page.goto('/market-chart-test.html')
  await page.evaluate(async ({ value, options }) => {
    const path = '/tests/fixtures/market-chart-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'marketChartHost', mount(value, options))
  }, { value: presentation(), options })
  if (options.research) await page.locator('[data-native-open-research]').click()
  if (options.failedRenderer) await expect(page.locator('.cp-failure')).toBeVisible()
  else await expect(page.locator('.cp-surface:visible canvas').first()).toBeVisible()
}
const card = (page: Page) => page.locator('.client-market-chart:visible')
function scenarioPresentation(): MarketChartPresentation {
  const p = presentation(3, 86400)
  return { ...p, scenario: { binding: p.binding, seriesId: p.seriesId, viewIdentity: p.view!.identity, asset: p.asset,
    resolutionSeconds: p.resolutionSeconds, upperPrice: 178.25, lowerPrice: 122.5,
    horizonTime: p.view!.bars.at(-1)!.time + 86400 * 7, basisLabel: '최근 30봉 관측 범위 기반 시나리오' } }
}
const intervals = (page: Page) => card(page).locator('.market-chart-intervals')
async function update(page: Page, value: MarketChartPresentation) {
  await page.evaluate(value => Reflect.get(window, 'marketChartHost').update(value), value)
}
async function remember(page: Page) {
  await page.evaluate(() => Reflect.set(window, 'originalMarketCanvas', document.querySelector('.cp-surface canvas')))
}
async function retained(page: Page) {
  expect(await page.evaluate(() => Reflect.get(window, 'originalMarketCanvas') === document.querySelector('.cp-surface canvas'))).toBe(true)
}

test('가독 높이·실제 canvas·지표를 유지하고 백테스트 재생이나 외부 widget을 만들지 않는다', async ({ page }, info) => {
  const external: string[] = [], errors: string[] = []
  page.on('request', req => { if (!new URL(req.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) external.push(req.url()) })
  page.on('pageerror', e => errors.push(e.message))
  await mount(page)
  expect(await card(page).locator('.cp-market-body').evaluate(el => el.getBoundingClientRect().height)).toBe(info.project.name === 'mobile' ? 430 : 380)
  await expect(card(page).locator('.cp-playback,.cp-replay')).toHaveCount(0)
  for (const name of ['EMA 20', 'RSI 14', 'VWAP', 'BB 20·2']) {
    await card(page).getByRole('button', { name, exact: true }).click()
    await expect(card(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  expect(await card(page).locator('.cp-surface').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(100)
  await expect(card(page).locator('.cp-surface')).toBeVisible()
  await page.screenshot({ path: info.outputPath('market-chart.png'), fullPage: true })
  expect(errors).toEqual([]); expect(external).toEqual([])
})

test('관측 갱신·동일 입력·언어 변경은 canvas를 보존하고 새 가격을 읽는다', async ({ page }) => {
  await mount(page); await remember(page)
  await card(page).locator('.cp-surface').focus(); await page.keyboard.press('Home')
  await expect(card(page).locator('.cp-quote dd').nth(1)).toHaveText('101')
  await update(page, presentation(2)); await retained(page)
  await expect(card(page).locator('.cp-quote dd').nth(1)).toHaveText('146')
  await update(page, structuredClone(presentation(2))); await retained(page)
  for (const language of ['en', 'fr', 'ko']) { await page.evaluate(language => Reflect.get(window, 'marketChartHost').language(language), language); await retained(page) }
})

test('요청 수락만으로 옛 봉의 주기를 바꾸지 않고 동일 canvas에 새 공급 주기를 적용한다', async ({ page }) => {
  await mount(page); await remember(page)
  await expect(card(page).locator('.client-animated-logo')).toHaveCount(0)
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  await expect(card(page).locator('.market-chart-status .client-animated-logo')).toHaveCount(1)
  // The chart has its own crosshair live region; assert the request status,
  // without removing either independent accessibility announcement.
  await expect(card(page).locator('.market-chart-status[role="status"]')).toContainText('2시간')
  await retained(page)
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].request.resolutionSeconds)).toBe(7200)
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].resolve(true))
  await expect(card(page).locator('.client-animated-logo')).toHaveCount(0)
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await update(page, presentation(2, 7200)); await retained(page)
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('같은 series의 새 관측은 이전 요청을 취소하고 늦은 실패가 새 pending을 지우지 못한다', async ({ page }) => {
  await mount(page)
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  await update(page, presentation(2))
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].signal.aborted)).toBe(true)
  await intervals(page).getByRole('button', { name: '4시간', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].reject())
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'true')
  await expect(card(page).locator('.market-chart-status')).not.toContainText('못했습니다')
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[1].resolve(false))
  await expect(card(page).locator('.market-chart-status')).toContainText('못했습니다')
  await expect(intervals(page).getByRole('button', { name: '2시간', exact: true })).toBeEnabled()
})

test('자산·주기 불일치는 옛 봉을 새 헤더 아래 표시하지 않고 공급 재시도가 가능하다', async ({ page }) => {
  await mount(page)
  await update(page, { ...presentation(), asset: 'ETH / USDT', assetLabel: '이더리움' })
  await expect(card(page).locator('canvas')).toHaveCount(0)
  await expect(card(page).locator('.market-chart-empty')).toContainText('맞는 가격')
  await card(page).getByRole('button', { name: '다시 불러오기', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].request.asset)).toBe('ETH / USDT')
})

test('동일 카드 포트 재연결은 이전 요청을 폐기하고 일반 입력 재렌더는 요청을 유지한다', async ({ page }) => {
  await mount(page, { native: true })
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  await page.locator('.g-composer textarea:visible').fill('새로 작성 중인 질문')
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].signal.aborted)).toBe(false)
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').port('other-owner'))
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].signal.aborted)).toBe(true)
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false')
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').port('owner-a'))
  await intervals(page).getByRole('button', { name: '4시간', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].reject())
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'true')
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[1].resolve(true))
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('새로 작성 중인 질문')
})

for (const rejected of [false, true]) test(`실패한 시간봉을 그대로 재시도한다 ${rejected ? 'reject' : 'false'}`, async ({ page }) => {
  await mount(page)
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  await page.evaluate(rejected => {
    const request = Reflect.get(window, 'marketChartHost').requests[0]
    if (rejected) request.reject(); else request.resolve(false)
  }, rejected)
  await expect(card(page).locator('.market-chart-status')).toContainText('2시간')
  await card(page).getByRole('button', { name: '다시 불러오기', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[1].request.resolutionSeconds)).toBe(7200)
  await expect(card(page).locator('.market-chart-status')).toContainText('2시간')
  await expect(intervals(page).getByRole('button', { name: '1시간', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('선택지에서 사라진 실패 주기는 재시도할 수 없고 남은 주기를 선택할 수 있다', async ({ page }) => {
  await mount(page)
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].resolve(false))
  await update(page, { ...presentation(), availableResolutions: [3600, 14400] })
  await expect(card(page).getByRole('button', { name: '다시 불러오기', exact: true })).toBeDisabled()
  await intervals(page).getByRole('button', { name: '4시간', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[1].request.resolutionSeconds)).toBe(14400)
})

test('현재 주기가 공급 선택지에 없으면 오류 재시도를 활성화하지 않는다', async ({ page }) => {
  await mount(page)
  await update(page, { ...presentation(), state: 'error', availableResolutions: [7200] })
  await expect(card(page).getByRole('button', { name: '다시 불러오기', exact: true })).toBeDisabled()
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].request.resolutionSeconds)).toBe(7200)
})

test('시장 재검증과 공급 실패에서는 일치하는 기존 차트를 보존하고 복구 버튼을 제공한다', async ({ page }) => {
  await mount(page); await remember(page)
  await update(page, { ...presentation(), state: 'loading' }); await retained(page)
  await expect(card(page).locator('.bd')).toHaveAttribute('aria-busy', 'true')
  await expect(card(page).locator('.market-chart-status .client-animated-logo')).toHaveCount(1)
  await update(page, { ...presentation(), state: 'error' }); await retained(page)
  await expect(card(page).getByRole('button', { name: '다시 불러오기', exact: true })).toBeVisible()
  await expect(card(page).locator('.client-animated-logo')).toHaveCount(0)
})

test('자료가 없는 실제 대기는 한 곳에서 안내하고 공급·미제공·실패 뒤 로고를 남기지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await mount(page, { native: true })
  await update(page, { ...presentation(), state: 'loading', view: undefined })
  await expect(card(page).locator('.market-chart-empty')).toHaveAttribute('role', 'status')
  await expect(card(page).getByRole('status')).toHaveCount(1)
  await expect(card(page).locator('.market-chart-empty .client-animated-logo')).toHaveCount(1)
  await expect(card(page).locator('.market-chart-status')).toHaveCount(0)
  await expect(card(page).locator('canvas')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests.length)).toBe(0)
  await page.locator('.g-composer textarea:visible').fill('데이터를 기다리는 동안 남기는 초안')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'marketChartHost').language(language), language)
    expect(await card(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await expect(page.locator('.g-composer textarea:visible')).toHaveValue('데이터를 기다리는 동안 남기는 초안')
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(card(page).locator('.client-animated-logo')).toHaveCSS('opacity', '1')
  await expect(card(page).locator('mask path')).toHaveCSS('stroke-dashoffset', '0px')
  await page.screenshot({ path: info.outputPath('data-loading-fr-320.png') })
  for (const state of ['unavailable', 'error'] as const) {
    await update(page, { ...presentation(), state, view: undefined })
    await expect(card(page).locator('.client-animated-logo')).toHaveCount(0)
    await expect(card(page).getByRole('status')).toHaveCount(1)
  }
  await update(page, presentation())
  await expect(card(page).locator('canvas').first()).toBeVisible()
  await expect(card(page).locator('.client-animated-logo')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests.length)).toBe(0)
})

test('320px 7언어·전체 보조지표에서 높이와 가로 경계를 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 }); await mount(page)
  for (const name of ['RSI 14', 'VWAP', 'BB 20·2']) await card(page).getByRole('button', { name, exact: true }).click()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'marketChartHost').language(language), language)
    const layout = await card(page).evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, wide: [...el.querySelectorAll('*')].filter(node => node.getBoundingClientRect().right > el.getBoundingClientRect().right).map(node => ({ tag: node.tagName, className: node.className, width: node.getBoundingClientRect().width })) }))
    expect(layout.scroll, JSON.stringify({ language, ...layout })).toBeLessThanOrEqual(layout.client)
    expect(await card(page).locator('.cp-market-body').evaluate(el => el.getBoundingClientRect().height)).toBe(430)
    expect(await card(page).locator('.cp-surface').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThan(220)
  }
  await page.screenshot({ path: info.outputPath('market-chart-fr-320.png'), fullPage: true })
})

test('좁은 화면 renderer 실패의 재시도는 잘리지 않고 같은 입력을 복구한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 }); await mount(page, { failedRenderer: true })
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').language('fr'))
  await expect(card(page).locator('.cp-failure button')).toBeVisible()
  const body = await card(page).locator('.cp-market-body').boundingBox(), button = await card(page).locator('.cp-failure button').boundingBox()
  expect(button!.y + button!.height).toBeLessThanOrEqual(body!.y + body!.height)
  await page.screenshot({ path: info.outputPath('market-chart-error-fr-320.png'), fullPage: true })
  await page.evaluate(() => Reflect.set(window, '__marketAllowRenderer', true))
  await card(page).locator('.cp-failure button').click()
  await expect(card(page).locator('.cp-failure')).toHaveCount(0)
  await expect(card(page).locator('.cp-surface canvas').first()).toBeVisible()
})

for (const research of [false, true]) test(`실제 ${research ? '연구 문서' : '일반 대화'} 표시층에서 차트·입력·owner 포트가 이어진다`, async ({ page }, info) => {
  await mount(page, { native: true, research })
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('계속 작성하던 질문')
  await intervals(page).getByRole('button', { name: '2시간', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests.length)).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').requests[0].resolve(true))
  await update(page, presentation(2, 7200))
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('계속 작성하던 질문')
  await page.screenshot({ path: info.outputPath(`market-native-${research ? 'research' : 'chat'}.png`), fullPage: true })
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').port('other-owner'))
  await expect(intervals(page).getByRole('button', { name: '4시간', exact: true })).toBeDisabled()
})

test('동일 series 두 카드가 별도 key를 가지며 공급 포트가 없을 때 조작을 성공으로 꾸미지 않는다', async ({ page }) => {
  const errors: string[] = []; page.on('console', item => { if (item.type() === 'error') errors.push(item.text()) })
  await mount(page, { connected: false })
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').duplicate())
  await expect(card(page)).toHaveCount(2)
  await expect(card(page).first().locator('.market-chart-intervals button').first()).toBeDisabled()
  expect(errors.filter(text => /same key|unique.*key/i.test(text))).toEqual([])
})

test('원본 시나리오는 실제 공급된 일봉·대상가격만 사용하고 일반 갱신에 재생하지 않는다', async ({ page }, info) => {
  await mount(page)
  await update(page, scenarioPresentation())
  const scenario = card(page).locator('.client-market-scenario'), canvas = scenario.locator('canvas')
  await expect(scenario).toContainText('참고용, 예측 보장 아님')
  await expect(scenario.locator('.scenario-values')).toContainText('178.25')
  await expect(scenario.locator('.scenario-values')).toContainText('122.5')
  expect(await canvas.evaluate(el => el.getBoundingClientRect().height)).toBe(info.project.name === 'mobile' ? 140 : 172)
  await expect(canvas).toHaveAttribute('data-progress', '1')
  await page.evaluate(() => Reflect.set(window, 'scenarioCanvas', document.querySelector('.client-market-scenario canvas')))
  await update(page, structuredClone(scenarioPresentation()))
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').language('en'))
  expect(await page.evaluate(() => Reflect.get(window, 'scenarioCanvas') === document.querySelector('.client-market-scenario canvas'))).toBe(true)
  await expect(canvas).toHaveAttribute('data-progress', '1')
  await expect(canvas).toHaveAttribute('aria-label', /Upside 178.25/)
  await scenario.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('scenario.png'), fullPage: true })
})

test('결속·데이터가 맞지 않는 시나리오는 표시하지 않으며 원 차트는 유지한다', async ({ page }) => {
  await mount(page)
  const good = scenarioPresentation()
  const bad = [
    { ...good, scenario: undefined },
    ...[
      { asset: 'ETH / USDT' }, { seriesId: 'other' }, { viewIdentity: 'other' }, { resolutionSeconds: 3600 },
      { binding: { ...good.binding, observationId: 'old' } }, { binding: { ...good.binding, scopeId: 'other' } },
      { upperPrice: 90 }, { lowerPrice: 200 }, { upperPrice: -1 }, { upperPrice: Infinity },
      { horizonTime: good.view!.bars.at(-1)!.time }, { basisLabel: '' },
    ].map(delta => ({ ...good, scenario: { ...good.scenario!, ...delta } })),
    { ...good, view: { ...good.view!, bars: good.view!.bars.slice(0, 9) } },
    { ...good, view: { ...good.view!, bars: good.view!.bars.map((b, i) => i === 0 ? { ...b, low: b.high + 1 } : b) } },
    { ...good, resolutionSeconds: 3600 },
  ]
  for (const value of bad) {
    await update(page, value)
    await expect(card(page).locator('.client-market-scenario')).toHaveCount(0)
  }
  await update(page, good)
  await expect(card(page).locator('.client-market-scenario')).toBeVisible()
})

test('시나리오 테마 전환은 최종값을 다시 그리며 제거 뒤 draw를 남기지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await mount(page)
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.clearRect
    Reflect.set(window, 'scenarioDraws', 0)
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if ((this.canvas as HTMLCanvasElement).dataset.scenarioProbe === 'yes') Reflect.set(window, 'scenarioDraws', Reflect.get(window, 'scenarioDraws') + 1)
      return original.apply(this, args)
    }
  })
  await update(page, scenarioPresentation())
  const canvas = card(page).locator('.client-market-scenario canvas')
  await expect(canvas).toHaveAttribute('data-progress', '1')
  const dark = await canvas.evaluate(el => { el.dataset.scenarioProbe = 'yes'; return (el as HTMLCanvasElement).toDataURL() })
  await page.evaluate(() => document.body.classList.add('light'))
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).not.toBe(dark)
  await expect(canvas).toHaveAttribute('data-progress', '1')
  await page.evaluate(() => document.body.classList.remove('light'))
  await expect.poll(() => canvas.evaluate(el => (el as HTMLCanvasElement).toDataURL())).toBe(dark)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const next = scenarioPresentation()
  await update(page, { ...next, scenario: { ...next.scenario!, upperPrice: 185 } })
  await expect.poll(async () => Number(await canvas.getAttribute('data-progress'))).toBeLessThan(1)
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').unmount())
  const draws = await page.evaluate(() => Reflect.get(window, 'scenarioDraws'))
  await page.evaluate(() => document.body.classList.add('light'))
  await page.waitForTimeout(80)
  expect(await page.evaluate(() => Reflect.get(window, 'scenarioDraws'))).toBe(draws)
})

test('시나리오 복원·모션감소·백그라운드 전환은 최종 프레임을 유지한다', async ({ page }) => {
  await mount(page)
  const good = scenarioPresentation()
  await update(page, { ...good, scenario: { ...good.scenario!, restored: true } })
  await expect(card(page).locator('.client-market-scenario canvas')).toHaveAttribute('data-progress', '1')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await update(page, good)
  await expect(card(page).locator('.client-market-scenario canvas')).toHaveAttribute('data-progress', '1')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await update(page, { ...good, scenario: { ...good.scenario!, upperPrice: 180 } })
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(card(page).locator('.client-market-scenario canvas')).toHaveAttribute('data-progress', '1')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(card(page).locator('.client-market-scenario canvas')).toHaveAttribute('data-progress', '1')
  await update(page, presentation(4))
  await expect(card(page).locator('.client-market-scenario')).toHaveCount(0)
})

test('320px 7언어 시나리오 숫자·고지·시점은 잘리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page); await update(page, scenarioPresentation())
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'marketChartHost').language(language), language)
    const scenario = card(page).locator('.client-market-scenario')
    expect(await scenario.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    const label = await scenario.locator('.lb').boundingBox(), canvas = await scenario.locator('canvas').boundingBox()
    expect(label!.y + label!.height).toBeLessThan(canvas!.y)
    await expect(scenario.locator('canvas')).toHaveAttribute('data-progress', '1')
  }
  await card(page).locator('.client-market-scenario').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('scenario-fr-320.png'), fullPage: true })
})

test('작은 양수 시나리오를 0으로 반올림하지 않는다', async ({ page }) => {
  await mount(page)
  const good = scenarioPresentation()
  await update(page, { ...good, scenario: { ...good.scenario!, lowerPrice: 1e-15 } })
  await expect(card(page).locator('.scenario-values dd').last()).toHaveText('0.000000000000001')
})

for (const research of [false, true]) test(`시나리오가 실제 ${research ? '연구' : '대화'} 표시층에 붙고 기존 질문을 보존한다`, async ({ page }) => {
  await mount(page, { native: true, research })
  await update(page, scenarioPresentation())
  await expect(card(page).locator('.client-market-scenario')).toBeVisible()
  await expect(page.locator('.g-composer textarea:visible')).toHaveValue('계속 작성하던 질문')
})

for (const duplicate of [false, true]) for (const research of [false, true]) test(`늦은 시나리오 삽입·제거는 ${research ? '연구' : '대화'}에서 읽는 문단 위치를 보존한다 ${duplicate ? '두 카드' : '한 카드'}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, { native: true, research })
  const good = scenarioPresentation()
  await update(page, { ...good, scenario: undefined })
  if (duplicate) await page.evaluate(() => Reflect.get(window, 'marketChartHost').duplicate())
  await page.evaluate(() => Reflect.get(window, 'marketChartHost').longAnswer())
  const paragraph = page.locator(research ? '.rw-scroll:visible p' : '.g-scroll:visible p').filter({ hasText: /^읽고 있는 문단 15\./ })
  await paragraph.scrollIntoViewIfNeeded()
  await page.waitForTimeout(180)
  const before = await paragraph.boundingBox()
  await update(page, good)
  await expect.poll(async () => (await paragraph.boundingBox())!.y).toBeCloseTo(before!.y, 0)
  await update(page, { ...good, scenario: undefined })
  await expect.poll(async () => (await paragraph.boundingBox())!.y).toBeCloseTo(before!.y, 0)
})
