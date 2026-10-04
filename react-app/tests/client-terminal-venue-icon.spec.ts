import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, mode: 'rail' | 'icon' | 'surfaces' = 'rail') {
  await page.route('**/venue-icon-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/venue-icon-test.html')
  await page.evaluate(async mode => {
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientStrategyRail.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('React module missing')
    const rm = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const react = rm.default ?? rm, h = react.createElement
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    if (mode === 'rail') {
      const { ClientStrategyRail } = await import(/* @vite-ignore */ cp)
      const rows = ['binance', 'bitget'].map((id, i) => ({ id, name: `시험 전략 ${i + 1}`, symbol: 'BTCUSDT', market: '선물', version: 'v1', status: 'ready', capitalLabel: '공급값', exchange: { id, name: i ? 'Bitget' : 'Binance', color: '#333' } }))
      const events: string[] = []
      Object.assign(window, { venueEvents: events })
      root.render(h(react.StrictMode, null, h(ClientStrategyRail, { strategies: rows, selectedId: null, onSelect: (id: string) => events.push(id), onNew: () => {} })))
    } else if (mode === 'surfaces') {
      const ap = '/src/components/ClientAccountTerminal.tsx', lp = '/src/components/ClientTerminalLedger.tsx'
      const fp = '/src/client-terminal-source-fixture.ts', sp = '/src/components/ClientSourceJudgmentStatus.tsx'
      const { ClientAccountTerminal } = await import(/* @vite-ignore */ ap)
      const { sourceTerminalBottomTabs } = await import(/* @vite-ignore */ lp)
      const { sourceTerminalSeeds, evaluateSourceTerminal } = await import(/* @vite-ignore */ fp)
      const { ClientSourceJudgmentStatus, ClientTerminalVenueIcon } = await import(/* @vite-ignore */ sp)
      const seed = { ...sourceTerminalSeeds[0], exchangeId: 'bitget' }
      const result = evaluateSourceTerminal(seed.parameters, seed.capital)
      const tabs = sourceTerminalBottomTabs({ models: [{ seed, result }], selectedId: seed.id, scope: 'current', money: String, onSelect: () => {}, onPause: () => {}, onTrade: () => {} })
      const strategy = { id: 'fixture', name: '시험 전략', symbol: 'BTCUSDT', market: '선물', version: 'v1', status: 'ready', capitalLabel: '공급값', exchange: { id: 'binance', name: 'Binance', color: '#333' } }
      root.render(h(react.StrictMode, null,
        h(ClientAccountTerminal, { entries: [{ strategy, chart: null, agent: null, dashboard: null, completed: null }], onNew: () => {}, renderBottom: () => tabs }),
        h('section', { id: 'ledger-check' }, tabs.find((tab: { id: string }) => tab.id === 'assets').content),
        h('section', { id: 'status-check' }, h(ClientSourceJudgmentStatus, { seed, result, exchangeName: 'Bitget', preview: true })),
        h('section', { id: 'compat-check' }, h(ClientTerminalVenueIcon, { id: 'upbit' }))))
    } else {
      const ip = '/src/components/ClientTerminalVenueIcon.tsx'
      const { ClientTerminalVenueIcon } = await import(/* @vite-ignore */ ip)
      const render = (id: string) => root.render(h(react.StrictMode, null, h(ClientTerminalVenueIcon, { id, fallback: '??' })))
      Object.assign(window, { venueRender: render })
      render('binance')
    }
  }, mode)
}

test('동일 BI 약자 대신 Binance와 Bitget 로컬 아이콘을 표시하고 선택을 보존한다', async ({ page }) => {
  await mount(page)
  for (const [id, name] of [['binance', 'Binance'], ['bitget', 'Bitget']]) {
    const row = page.locator(`[data-strategy-id="${id}"]`), badge = row.locator('.exb')
    await expect(badge).toHaveAttribute('title', name)
    await expect(badge.locator('img')).toHaveAttribute('src', `/client-broker-assets/app-${id}.png`)
    await expect.poll(() => badge.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    expect(await badge.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBe(17)
    await row.locator('.tft-select').click()
  }
  expect(await page.evaluate(() => (window as unknown as { venueEvents: string[] }).venueEvents)).toEqual(['binance', 'bitget'])
})

test('정확한 원본 로컬 자산만 사용하고 알 수 없는 ID는 기존 대체 표시를 보존한다', async ({ page }) => {
  await mount(page, 'icon')
  const ids = ['binance', 'bitget', 'okx', 'woox', 'bybit', 'upbit', 'mexc', 'gate', 'coinbase', 'etoro', 'etrade', 'fidelity', 'ibkr', 'ig', 'kis', 'kiwoom', 'moomoo', 'robinhood', 'saxo', 'schwab', 'tiger', 'webull', 'woo']
  for (const id of ids) {
    await page.evaluate(id => Reflect.get(window, 'venueRender')(id), id)
    const src = `/client-broker-assets/app-${id === 'woo' ? 'woox' : id}.${id === 'gate' ? 'jpg' : 'png'}`
    await expect(page.locator('#fixture img')).toHaveAttribute('src', src)
    await expect(page.locator('#fixture img')).toHaveAttribute('alt', '')
    await expect.poll(() => page.locator('#fixture img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  }
  const requests: string[] = []
  page.on('request', request => { if (request.resourceType() === 'image') requests.push(request.url()) })
  for (const id of ['unknown', '../gate', 'https://invalid.example/icon.png', 'constructor', '__proto__', '']) {
    await page.evaluate(id => Reflect.get(window, 'venueRender')(id), id)
    await expect(page.locator('#fixture')).toHaveText('??')
    await expect(page.locator('#fixture img')).toHaveCount(0)
  }
  expect(requests).toEqual([])
})

test('이미지 실패 뒤 다른 거래소와 원래 거래소로 변경하면 오류가 남지 않는다', async ({ page }) => {
  await page.route('**/client-broker-assets/app-binance.png', route => route.fulfill({ status: 404, body: '' }))
  await mount(page, 'icon')
  await expect(page.locator('#fixture')).toHaveText('??')
  await page.unroute('**/client-broker-assets/app-binance.png')
  for (const id of ['bitget', 'binance']) {
    await page.evaluate(id => Reflect.get(window, 'venueRender')(id), id)
    await expect(page.locator('#fixture img')).toHaveAttribute('src', `/client-broker-assets/app-${id}.png`)
    await expect.poll(() => page.locator('#fixture img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  }
})

test('계정 터미널·원장·판단 상태는 기존 크기와 내보내기를 유지한다', async ({ page }) => {
  await mount(page, 'surfaces')
  const checks = [
    ['.cat-exchange img', 'binance', 22],
    ['#ledger-check .exb img', 'bitget', 17],
    ['#status-check .csj-venue img', 'bitget', 16],
    ['#compat-check img', 'upbit', 16],
  ] as const
  for (const [selector, id, size] of checks) {
    const img = page.locator(selector).first()
    await expect(img).toHaveAttribute('src', `/client-broker-assets/app-${id}.png`)
    await expect(img).toHaveAttribute('width', String(size))
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true)
  }
  await expect(page.locator('.cat-market-name')).toHaveText('Binance 선물')
  await expect(page.locator('#status-check .csj-venue b')).toHaveText('Bitget')
})
