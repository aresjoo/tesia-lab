import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, initial: 'empty' | 'missing' | 'populated' = 'empty') {
  await page.route('**/e08-terminal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#171717;color:white;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/e08-terminal-test.html')
  await page.evaluate(async initial => {
    const runtimePath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ runtimePath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientAccountTerminal.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientAccountTerminal } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    const row = { strategy: { id: 'a', name: 'BTC 관측 전략', symbol: 'BTC/USDT', market: '현물', version: 'v1', status: 'live', exchange: { id: 'test', name: 'TEST', color: '#333' }, capitalLabel: '$1,000', pnlLabel: '+$12', pnlTone: 'up' }, chart: null, agent: h('input', { 'aria-label': '초안', defaultValue: '' }), dashboard: h('p', null, '지표'), completed: h('p', null, '거래') }
    function Host() {
      const [entries, setEntries] = react.useState(initial === 'empty' ? [] : initial === 'missing' ? null : [row])
      Object.assign(window, { setE08Entries: (value: string) => setEntries(value === 'empty' ? [] : value === 'missing' ? null : [row]) })
      return h(ClientAccountTerminal, { entries, onNew: () => {}, emptyDetail: h('button', { type: 'button' }, '전략 찾기'), renderBottom: () => [{ id: 'pos', label: '포지션', count: entries?.length, content: h('p', null, '원장') }] })
    }
    ;(dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture')).render(h(react.StrictMode, null, h(Host)))
  }, initial)
  await expect(page.locator('.ctt-terminal')).toBeVisible()
}
async function update(page: Page, value: string) {
  await page.evaluate(value => Reflect.get(window, 'setE08Entries')(value), value)
}
async function openStrategies(page: Page) {
  // Source selector mode displays chart/analysis together; its old pane tabs are hidden.
  await expect(page.locator('.ctt-main-tabs')).toBeHidden()
  await page.locator('.ctt-selector-button').click()
  await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
}
async function expectSourceRegions(page: Page) {
  for (const selector of ['.ctt-market', '.ctt-detail', '.ctt-bottom']) {
    await expect(page.locator(selector)).toBeVisible()
    expect(await page.locator(selector).evaluate(node => node.inert)).toBe(false)
  }
}

for (const width of [320, 768, 1440]) test(`e08 ${width}px 최초 빈 계정은 원본 모바일 판단 우선·데스크톱 기본을 유지한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page)
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', width <= 768 ? 'detail' : 'chart')
  await expect(page.getByRole('button', { name: '전략 찾기', exact: true })).toBeVisible()
  if (width <= 768) {
    await openStrategies(page)
    await expect(page.getByRole('button', { name: '새 전략 만들기', exact: true })).toBeVisible()
    await update(page, 'missing'); await update(page, 'empty')
    await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'detail')
    await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('e08 미확인 목록은 빈 계정이 아니며 첫 정상 빈 응답에서만 모바일 안내를 연다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, 'missing')
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'chart')
  await expect(page.getByRole('button', { name: '전략 찾기', exact: true })).toHaveCount(0)
  await update(page, 'empty')
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'detail')
  await page.locator('.ctt-market').click()
  await expectSourceRegions(page)
  await update(page, 'populated'); await update(page, 'empty')
  // Clicking the visible source chart is not navigation through a legacy pane tab.
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'detail')
  await expectSourceRegions(page)
})

test('e08 응답 전에 연 원본 전략 메뉴와 초안은 뒤늦은 빈 응답이 탈취하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, 'missing')
  await openStrategies(page)
  const search = page.locator('.teth-strategy-rail').getByRole('searchbox')
  await search.fill('작성 중인 검색')
  const original = await search.elementHandle()
  await update(page, 'empty')
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'chart')
  await expect(page.locator('.ctt-selector-button')).toHaveAttribute('aria-expanded', 'true')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('작성 중인 검색')
  expect(await search.evaluate((node, before) => node === before, original)).toBe(true)
  await expectSourceRegions(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  // Observe the intermediate desktop resize before returning to mobile; browser
  // resize events may otherwise coalesce the two viewport changes.
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-mobile', 'false')
  await page.setViewportSize({ width: 390, height: 900 })
  // Source resize follows the focused strategies region to detail and restores
  // that same search control; both chart and detail remain visible.
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'detail')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('작성 중인 검색')
  await expectSourceRegions(page)
})

test('e08 보유 전략 삭제는 최초 빈 계정 진입과 다르며 현재 차트 선택을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mount(page, 'populated')
  await update(page, 'empty')
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-panel', 'chart')
})

test('e08 레일·선택선·숫자 위계와 전체화면 스타일이 같다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await mount(page, 'populated')
  const rail = page.locator('.teth-strategy-rail')
  const verify = async () => {
    await page.locator('.ctt-selector-button').click()
    await expect(rail.locator('.tft-rh b')).toHaveCSS('font-size', '18px')
    await expect(rail.locator('.nm')).toHaveCSS('font-size', '16px')
    await expect(rail.locator('.nm')).toHaveCSS('font-weight', '400')
    await expect(rail.getByRole('searchbox')).toHaveCSS('background-color', 'rgb(33, 33, 33)')
    await expect(rail.getByRole('searchbox')).toHaveCSS('border-radius', '999px')
    await expect(rail.locator('.tft-card.on')).toHaveCSS('border-left-width', '0px')
    await expect(rail.locator('.tft-card.on')).toHaveCSS('border-radius', '16px')
    await expect(rail.locator('.st-live.st')).toHaveCSS('color', 'rgb(205, 205, 205)')
    await expect(rail.locator('.pnl.up')).toHaveCSS('color', 'rgb(86, 196, 134)')
    await expect(page.locator('.cat-tabs [aria-selected=true]')).toHaveCSS('border-bottom-color', 'rgb(154, 154, 154)')
    await expect(page.locator('.ctt-bottom-tabs [aria-selected=true]')).toHaveCSS('border-bottom-color', 'rgb(154, 154, 154)')
    await page.keyboard.press('Escape')
  }
  await verify()
  const draft = page.getByRole('textbox', { name: '초안', exact: true })
  await draft.fill('작성 중인 문장')
  const element = await draft.elementHandle()
  await page.getByRole('button', { name: '터미널 전체화면' }).click()
  await expect(page.locator('.ctt-modal')).toBeVisible(); await verify()
  expect(await draft.evaluate((node, original) => node === original, element)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(draft).toHaveValue('작성 중인 문장')
  await verify()
})
