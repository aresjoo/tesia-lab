import { expect, test, type Page } from '@playwright/test'
import type { ClientTerminalStrategy } from '../src/client-terminal-view'
import type { ClientLanguage } from '../src/client-preferences'
import { accountTerminalText } from '../src/client-account-terminal-copy'

const languages: readonly ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr']

test('검증 손익은 공급자가 명시할 때만 표시하고 서비스 상태로 추측하지 않는다', async ({ page }) => {
  await mount(page)
  const entries: ClientTerminalStrategy[] = [
    { ...rows[0], id: 'backtest', status: 'off', pnlKind: 'validation' },
    { ...rows[0], id: 'service', status: 'off' },
    { ...rows[2], id: 'missing', pnlKind: 'validation' },
  ]
  await page.evaluate(entries => (window as unknown as RailBridge).railUpdate(entries), entries)
  for (const locale of languages) {
    await setLanguage(page, locale)
    await expect(page.locator('[data-strategy-id="backtest"] .vl')).toHaveText(accountTerminalText(locale, 'validation'))
    await expect(page.locator('[data-strategy-id="backtest"] .tft-select')).toHaveAccessibleDescription(new RegExp(accountTerminalText(locale, 'validation')))
    await expect(page.locator('[data-strategy-id="service"] .vl')).toHaveCount(0)
    await expect(page.locator('[data-strategy-id="missing"] .pnl')).toHaveCount(0)
  }
})

const rows: ClientTerminalStrategy[] = [
  { id: 'one', name: '반등 전략', symbol: 'BTCUSDT', market: '선물', version: 'v1.0', status: 'live', exchange: { id: 'binance', name: 'Binance', color: '#f3ba2f', foreground: '#181818' }, capitalLabel: '₩1,000,000', pnlLabel: '+₩12,000', pnlPercentLabel: '+1.2%', pnlTone: 'up' },
  { id: 'two', name: '반등 전략', symbol: 'ETHUSDT', market: '선물', version: 'v2.0', status: 'err', exchange: { id: 'okx', name: 'OKX', color: '#212124' }, capitalLabel: '₩500,000', error: '연결을 확인하지 못했어요.' },
  { id: 'three', name: '추세 전략', symbol: 'SOLUSDT', market: '현물', version: 'v3.0', status: 'ready', exchange: { id: 'binance', name: 'Binance', color: '#f3ba2f' }, capitalLabel: '₩250,000', sharedCapital: true },
]

type RailBridge = { railUpdate: (rows: ClientTerminalStrategy[] | null) => void; railEvents: string[]; railMenuConnected: boolean }

async function setLanguage(page: Page, language: string) {
  expect(await page.evaluate(code => Reflect.get(window, 'conversationLocaleHarness').setLanguage(code), language)).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

test('전략 목록 언어 설정은 검색·필터·상태·메뉴에 반영된다', async ({ page }) => {
  await mount(page)
  await setLanguage(page, 'en')
  await expect(page.getByRole('searchbox')).not.toHaveAttribute('placeholder', /[가-힣]/)
  await expect(page.locator('.tft-rh b')).not.toContainText(/[가-힣]/)
  await expect(page.locator('.tft-rf select').first()).not.toHaveAttribute('aria-label', /[가-힣]/)
  await expect(page.locator('.st').first()).not.toContainText(/[가-힣]/)
  await expect(page.locator('.mn').first()).not.toHaveAttribute('aria-label', /전략 메뉴/)
})

for (const viewport of [320, 1440]) for (const width of [264, 320]) test(`화면${viewport}px·레일${width}px 전략7언어는 원문·수치·상태·콜백을 보존하고 메뉴와 겹치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width: viewport, height: 960 })
  const data = [...rows, { ...rows[0], id: 'four', status: 'off' as const }]
  await mount(page, data, true, width)
  const cards = await page.locator('.tft-card').elementHandles()
  const originalValues = await page.locator('.nm,.sy,.ver,.cap,.pnl').allTextContents()
  for (const language of languages) {
    await setLanguage(page, language)
    const t = (key: Parameters<typeof accountTerminalText>[1], values = {}) => accountTerminalText(language, key, values)
    await expect(page.locator('.tft-rh b')).toHaveText(t('strategies'))
    expect(await page.locator('.tft-rh b').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    const railBox = await page.locator('.teth-strategy-rail').boundingBox()
    for (const control of await page.locator('.tft-rh > *').all()) {
      const box = await control.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(railBox!.x)
      expect(box!.x + box!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width + 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await expect(page.getByRole('searchbox')).toHaveAccessibleName(t('search'))
    await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', t('search'))
    await expect(page.locator('.tft-rf select').first()).toHaveAccessibleName(t('statusFilter'))
    await expect(page.locator('.tft-rf select').last()).toHaveAccessibleName(t('exchangeFilter'))
    await expect(page.locator('.tft-rf select').first().locator('option')).toHaveText([t('allStatuses'), t('live'), t('off'), t('ready'), t('err')])
    for (const select of await page.locator('.tft-rf select').all()) {
      const fit = await select.evaluate(node => {
        const select = node as HTMLSelectElement, style = getComputedStyle(node)
        const context = document.createElement('canvas').getContext('2d')!
        context.font = style.font
        return { required: context.measureText(select.selectedOptions[0].text).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 20, width: select.clientWidth }
      })
      expect(fit.width).toBeGreaterThanOrEqual(fit.required)
    }
    for (const [index, item] of data.entries()) {
      const row = page.locator(`[data-strategy-id="${item.id}"]`)
      await expect(row.locator('.tft-select')).toHaveAccessibleName(t('selectName', { name: item.name }))
      await expect(row.locator('.mn')).toHaveAccessibleName(t('menuName', { name: item.name }))
      await expect(row.locator('.st')).toContainText(t(item.status))
      const description = [t('exchangeValue', { value: item.exchange.name }), t('statusValue', { value: t(item.status) }),
        t('symbolValue', { value: item.symbol }), t('marketValue', { value: item.market }), t('versionValue', { value: item.version }),
        t('capitalValue', { value: item.capitalLabel }), ...(item.sharedCapital ? [t('sharedCapital')] : []),
        ...(item.pnlLabel !== undefined ? [t('pnlValue', { value: item.pnlLabel })] : []),
        ...(item.pnlPercentLabel !== undefined ? [t('pnlPercentValue', { value: item.pnlPercentLabel })] : [])].join(', ')
      await expect(row.locator('.tft-select')).toHaveAccessibleDescription(description)
      expect(await row.evaluate((node, previous) => node === previous, cards[index])).toBe(true)
      const name = await row.locator('.nm').boundingBox(), status = await row.locator('.st').boundingBox(), menu = await row.locator('.mn').boundingBox()
      expect(name!.x + name!.width).toBeLessThanOrEqual(status!.x + 1)
      expect(status!.x + status!.width).toBeLessThanOrEqual(menu!.x + 1)
      expect(name!.width).toBeGreaterThan(40)
    }
    await expect(page.locator('.cap i')).toHaveAttribute('title', t('sharedCapital'))
    await expect(page.locator('.r4 button')).toHaveText(t('reconnect'))
    // The owner supplies these values and the error; only the reconnect action is localized.
    expect(await page.locator('.nm,.sy,.ver,.cap,.pnl').allTextContents()).toEqual(originalValues)
    await expect(page.locator('.r4')).toContainText(rows[1].error!)
    expect(await page.locator('.teth-strategy-rail').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toEqual([])
  }
  await page.screenshot({ path: info.outputPath(`strategy-rail-fr-${width}.png`) })
  await page.locator('.r4 button').focus()
  await expect(page.locator('.r4 button')).toBeFocused()
  await expect(page.locator('.r4 button')).toHaveCSS('outline-offset', '2px')
  await page.locator('.r4').screenshot({ path: info.outputPath('reconnect-focus-fr.png') })
  await page.locator('[data-strategy-id="two"] .mn').click()
  await page.locator('.r4 button').click()
  await page.locator('[data-strategy-id="two"] .tft-select').click()
  expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toEqual(['menu:two', 'reconnect:two', 'select:two'])
  for (const card of cards) await card.dispose()
})

test('필터 선택만 바꾸면 가장 긴 옵션의 고유 너비와 행 배치가 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mount(page, rows, true, 264)
  const filters = page.locator('.tft-rf select')
  const geometry = () => filters.evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height] }))
  const selectedTextFits = async () => {
    for (const filter of await filters.all()) {
      expect(await filter.evaluate(node => {
        const select = node as HTMLSelectElement, style = getComputedStyle(node), context = document.createElement('canvas').getContext('2d')!
        context.font = style.font
        return select.clientWidth >= context.measureText(select.selectedOptions[0].text).width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 20
      })).toBe(true)
    }
  }
  for (const language of languages) {
    await setLanguage(page, language)
    await expect(filters.first()).toHaveAccessibleName(accountTerminalText(language, 'statusFilter'))
    await page.evaluate(async () => { await document.fonts.ready })
    const before = await geometry()
    await filters.first().selectOption('live')
    await filters.last().selectOption('binance')
    expect(await geometry()).toEqual(before)
    await selectedTextFits()
    await filters.first().selectOption('err')
    await filters.last().selectOption('okx')
    expect(await geometry()).toEqual(before)
    await selectedTextFits()
    await filters.first().selectOption('all')
    await filters.last().selectOption('all')
    expect(await geometry()).toEqual(before)
    await selectedTextFits()
  }
})

test('전략7언어 전환 중 검색 IME·커서·필터와 사라진 거래소 선택을 유지한다', async ({ page }) => {
  await mount(page)
  const search = page.getByRole('searchbox'), original = await search.elementHandle()
  await page.locator('.tft-rf select').first().selectOption('err')
  await page.locator('.tft-rf select').last().selectOption('okx')
  await search.fill('ETHUSDT')
  await search.press('ArrowLeft')
  const cursor = await search.evaluate(node => (node as HTMLInputElement).selectionStart)
  await search.dispatchEvent('compositionstart', { data: '' })
  for (const language of languages) {
    await setLanguage(page, language)
    await expect(search).toHaveValue('ETHUSDT')
    await expect(search).toBeFocused()
    expect(await search.evaluate(node => (node as HTMLInputElement).selectionStart)).toBe(cursor)
    expect(await search.evaluate((node, previous) => node === previous, original)).toBe(true)
    await expect(page.locator('.tft-rf select').first()).toHaveValue('err')
    await expect(page.locator('.tft-rf select').last()).toHaveValue('okx')
    await expect(page.locator('.tft-card')).toHaveCount(1)
    await expect(page.locator('[data-strategy-id="two"]')).toBeVisible()
  }
  await search.dispatchEvent('compositionend', { data: '' })
  await page.evaluate(data => (window as unknown as RailBridge).railUpdate(data), [rows[0]])
  for (const language of languages) {
    await setLanguage(page, language)
    await expect(page.locator('.tft-rf select').last()).toHaveValue('okx')
    await expect(page.locator('.tft-empty b')).toHaveText(accountTerminalText(language, 'noMatch'))
    await expect(page.locator('.tft-empty span')).toHaveText(accountTerminalText(language, 'noMatchHint'))
  }
  expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toEqual([])
  await original?.dispose()
})

async function mount(page: Page, data: ClientTerminalStrategy[] | null = rows, callbacks = true, width = 320) {
  await page.route('**/strategy-rail-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/strategy-rail-test.html')
  await page.evaluate(async ({ data, callbacks, width }) => {
    for (const font of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/geist/wght.css']) await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Geist Variable", "Noto Sans KR Variable", sans-serif'
    const refresh = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientStrategyRail.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Vite React module missing')
    const reactModule = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientStrategyRail } = await import(/* @vite-ignore */ cp)
    const localeHarnessPath = '/tests/fixtures/conversation-locale-harness.ts'
    await import(/* @vite-ignore */ localeHarnessPath)
    const react = reactModule.default ?? reactModule, h = react.createElement
    const events: string[] = []
    Object.assign(window, { railEvents: events })
    function Host() {
      const [strategies, setStrategies] = react.useState(data), [selectedId, setSelectedId] = react.useState('one')
      Object.assign(window, { railUpdate: setStrategies })
      return h('div', { style: { width, height: 600, maxWidth: '100vw' } }, h(ClientStrategyRail, {
        strategies, selectedId, onSelect: (id: string) => { events.push(`select:${id}`); setSelectedId(id) }, onNew: () => events.push('new'),
        ...(callbacks ? { onMenu: (id: string, trigger: HTMLElement) => { events.push(`menu:${id}`); Object.assign(window, { railMenuConnected: trigger.isConnected }) }, onReconnect: (id: string) => events.push(`reconnect:${id}`) } : {}),
      }))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    root.render(h(react.StrictMode, null, h(Host)))
  }, { data, callbacks, width })
  await expect(page.getByRole('region', { name: '전략', exact: true })).toBeVisible()
  await page.evaluate(async () => { await document.fonts.load('600 12px "Noto Sans KR Variable"', '반등 전략 선물 현물'); await document.fonts.ready })
}

test('동명 전략을 ID로 선택하고 메뉴·재연결은 선택과 분리한다', async ({ page }) => {
  await mount(page)
  const second = page.locator('[data-strategy-id="two"]')
  await second.getByRole('button', { name: '반등 전략 선택' }).focus()
  await page.keyboard.press('Enter')
  await expect(second.getByRole('button', { name: '반등 전략 선택' })).toHaveAttribute('aria-pressed', 'true')
  await second.getByRole('button', { name: '반등 전략 전략 메뉴' }).click()
  await second.getByRole('button', { name: '다시 연결' }).click()
  expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toEqual(['select:two', 'menu:two', 'reconnect:two'])
  expect(await page.evaluate(() => (window as unknown as RailBridge).railMenuConnected)).toBe(true)
  await page.getByRole('button', { name: '새 전략', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toContain('new')
})

test('이름·심볼 검색과 상태·거래소 필터는 교차 적용하고 빈 결과를 구분한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('searchbox', { name: '전략 검색' }).fill('ethusdt')
  await expect(page.locator('.tft-card')).toHaveCount(1)
  await expect(page.locator('[data-strategy-id="two"]')).toBeVisible()
  await page.getByLabel('상태 필터').selectOption('ready')
  await expect(page.getByText('조건에 맞는 전략이 없어요')).toBeVisible()
  await page.getByRole('searchbox').fill('')
  await expect(page.locator('[data-strategy-id="three"]')).toBeVisible()
  await page.getByLabel('거래소 필터').selectOption('okx')
  await expect(page.getByText('조건에 맞는 전략이 없어요')).toBeVisible()
  await page.getByLabel('상태 필터').selectOption('all')
  await expect(page.locator('[data-strategy-id="two"]')).toBeVisible()
})

test('선택 버튼은 전체 거래소·상태·심볼·버전·제공 수치를 설명한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('[data-strategy-id="one"] .tft-select')).toHaveAccessibleDescription('거래소 Binance, 상태 실행 중, 심볼 BTCUSDT, 시장 선물, 버전 v1.0, 운용 자금 ₩1,000,000, 손익 +₩12,000, 손익률 +1.2%')
  await expect(page.locator('[data-strategy-id="two"] .tft-select')).toHaveAccessibleDescription('거래소 OKX, 상태 오류, 심볼 ETHUSDT, 시장 선물, 버전 v2.0, 운용 자금 ₩500,000')
  await expect(page.locator('[data-strategy-id="three"] .tft-select')).toHaveAccessibleDescription(/위임 예산 공용$/)
  const descriptions = await page.locator('.tft-select').evaluateAll(elements => elements.map(el => el.getAttribute('aria-describedby')))
  expect(new Set(descriptions).size).toBe(rows.length)
})

test('NFD·앞뒤 공백 검색은 일치하고 원래 입력과 커서 위치는 바꾸지 않는다', async ({ page }) => {
  await mount(page)
  const search = page.getByRole('searchbox')
  const decomposed = `  ${'반등'.normalize('NFD')}  `
  await search.fill(decomposed)
  await expect(page.locator('.tft-card')).toHaveCount(2)
  await expect(search).toHaveValue(decomposed)
  await search.press('ArrowLeft')
  const cursor = await search.evaluate(el => (el as HTMLInputElement).selectionStart)
  await page.evaluate(data => (window as unknown as RailBridge).railUpdate(data), rows.map(item => ({ ...item, name: item.name.normalize('NFD') })))
  await expect(page.locator('.tft-card')).toHaveCount(2)
  await expect(search).toHaveValue(decomposed)
  expect(await search.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe(cursor)
  await search.fill('  반등  ')
  await expect(page.locator('.tft-card')).toHaveCount(2)
  await expect(search).toHaveValue('  반등  ')
})

test('검색 DOM·입력기 조합·커서는 목록 갱신과 선택 후 보존된다', async ({ page }) => {
  await mount(page)
  const search = page.getByRole('searchbox')
  await search.fill('반등')
  const node = await search.elementHandle()
  await search.dispatchEvent('compositionstart', { data: '' })
  await search.dispatchEvent('compositionupdate', { data: '반등' })
  await page.evaluate(data => (window as unknown as RailBridge).railUpdate(data), [...rows].reverse())
  await expect(search).toHaveValue('반등')
  await expect(search).toBeFocused()
  expect(await node!.evaluate(el => el === document.querySelector('input[type="search"]'))).toBe(true)
  await search.dispatchEvent('compositionend', { data: '반등' })
  await search.fill('BTCUSDT')
  await search.press('ArrowLeft')
  const before = await search.evaluate(el => (el as HTMLInputElement).selectionStart)
  await page.evaluate(data => (window as unknown as RailBridge).railUpdate(data), rows)
  expect(await search.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe(before)
  await search.press('x')
  await expect(search).toHaveValue('BTCUSDxT')
})

test('미공급·확인된 빈목록·콜백 부재를 실제 실행이나 수치로 채우지 않는다', async ({ page }) => {
  await mount(page, null, false)
  await expect(page.getByText('전략 정보를 확인하지 못했습니다.')).toBeVisible()
  await expect(page.locator('.ct2')).toHaveText('—')
  await page.evaluate(() => (window as unknown as RailBridge).railUpdate([]))
  await expect(page.getByText('아직 실행 중인 전략이 없습니다.')).toBeVisible()
  await expect(page.locator('.ct2')).toHaveText('0')
  await page.evaluate(data => (window as unknown as RailBridge).railUpdate(data), rows)
  await expect(page.locator('[data-strategy-id="two"] .mn')).toBeDisabled()
  await expect(page.getByRole('button', { name: '다시 연결' })).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="two"] .pnl')).toHaveCount(0)
  await expect(page.locator('.tft-rfoot')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as RailBridge).railEvents)).toEqual([])
})

test('넓은 화면은 데스크톱 기하를 유지하고 coarse 입력에만 44px 메뉴를 적용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mount(page)
  const coarse = await page.evaluate(() => matchMedia('(pointer:coarse)').matches)
  const menu = await page.locator('.mn').first().boundingBox()
  expect(menu!.width).toBe(coarse ? 44 : 22)
  expect(menu!.height).toBe(coarse ? 44 : 24)
  expect(await page.locator('.tft-select').first().evaluate(el => getComputedStyle(el).paddingRight)).toBe(coarse ? '52px' : '14px')
  expect(await page.locator('.tft-card.on').evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('0px')
  await expect(page.locator('.tft-card.on')).toHaveCSS('box-shadow', 'rgb(154, 154, 154) 0px 0px 0px 2px inset')
})

for (const width of [264, 320]) test(`${width}px에서 긴 이름·금액·오류가 메뉴와 겹치거나 가로로 넘치지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await mount(page, [{ ...rows[1], name: '아주 긴 이름으로 표시되는 동일한 전략의 자산 운용 상세 이름', symbol: 'LONGSYMBOLWITHOUTSPACES0123456789', capitalLabel: '₩123,456,789,000', pnlLabel: '-₩123,456,789,000', pnlPercentLabel: '-123.45%', error: '연결오류상세WITHOUTSPACES0123456789012345678901234567890123456789' }], true, width)
  expect(await page.locator('.teth-strategy-rail').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const name = await page.locator('.nm').boundingBox(), state = await page.locator('.r1 .st').boundingBox(), menu = await page.locator('.mn').boundingBox()
  expect(name!.x + name!.width).toBeLessThanOrEqual(state!.x)
  expect(state!.x + state!.width).toBeLessThanOrEqual(menu!.x)
  expect(name!.width).toBeGreaterThan(60)
  expect(menu!.width).toBeGreaterThanOrEqual(44)
  expect(menu!.height).toBeGreaterThanOrEqual(44)
  expect(await page.locator('.st').evaluate(el => getComputedStyle(el).flexShrink)).toBe('0')
  await page.locator('.mn').focus()
  await expect(page.locator('.mn')).toBeFocused()
})
