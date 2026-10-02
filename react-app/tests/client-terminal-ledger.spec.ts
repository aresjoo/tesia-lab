import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page) {
  await page.route('**/terminal-ledger-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3"><div id="fixture" style="max-width:100%;width:1000px"></div></body></html>' }))
  await page.goto('/terminal-ledger-test.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientTerminalLedger.tsx', dp = '/@id/react-dom/client'
    // The pane factory has only a type-only React import; probe its existing preference dependency.
    const source = await (await fetch('/src/client-preferences.ts')).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { sourceTerminalBottomTabs } = await import(/* @vite-ignore */ cp)
    const fixturePath = '/src/client-terminal-source-fixture.ts'
    const { sourceTerminalSeeds, evaluateSourceTerminal } = await import(/* @vite-ignore */ fixturePath)
    const viewPath = '/src/client-terminal-source-view.ts'
    const { sourceMoney } = await import(/* @vite-ignore */ viewPath)
    // Match client-bootstrap imports and the actual .tesia-shell.conversation-surface font stack.
    for (const fontPath of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ fontPath)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", -apple-system, BlinkMacSystemFont, sans-serif'
    const react = rm.default ?? rm, h = react.createElement
    const models = sourceTerminalSeeds.slice(0, 3).map((seed: { parameters: object; capital: number }) => ({ seed: { ...seed }, result: evaluateSourceTerminal(seed.parameters, seed.capital) }))
    // Explicit UI branch fixture: one live position, an off position, and a live flat strategy.
    const position = { entryI: 61, entryP: 100, curP: 102, stopP: 95, tpP: 110, qty: 2, chg: .02, krw: 4, bars: 5 }
    models[0].result = { ...models[0].result, pos: position }
    models[1].result = { ...models[1].result, pos: position }
    models[2].result = { ...models[2].result, pos: null }
    const state = { tab: 'pos', scope: 'current', selectedId: models[0].seed.id, empty: false, currency: '', pauseDisabled: [] as string[], calls: [] as unknown[][], models }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const money = (value: number, signed = false) => state.currency ? sourceMoney(value, state.currency, 'ko', signed) : `${value < 0 ? '−' : signed ? '+' : ''}W${Math.round(Math.abs(value))}`
    const render = () => {
      const tabs = sourceTerminalBottomTabs({ models: state.empty ? [] : state.models, selectedId: state.selectedId, scope: state.scope, money,
        onSelect: (id: string) => state.calls.push(['select', id]), onPause: (id: string) => state.calls.push(['pause', id]),
        pauseDisabled: (id: string) => state.pauseDisabled.includes(id),
        onTrade: (id: string, entry: number, trigger: HTMLElement) => state.calls.push(['trade', id, entry, trigger.tagName, trigger.isConnected]),
      })
      Object.assign(window, { ledgerPositionCount: tabs.find((tab: { id: string }) => tab.id === 'pos')?.count })
      root.render(h(react.Fragment, null,
        h('div', { role: 'tablist', 'aria-label': '원장 탭', style: { display: 'flex', flexWrap: 'wrap' } }, tabs.map((tab: { id: string; label: string }) => h('button', { key: tab.id, role: 'tab', 'aria-selected': tab.id === state.tab, onClick: () => { state.tab = tab.id; render() } }, tab.label))),
        h('div', { id: 'pane' }, tabs.find((tab: { id: string }) => tab.id === state.tab)?.content)))
    }
    Object.assign(window, { ledgerState: state, patchLedger: (patch: object) => { Object.assign(state, patch); render() }, changeLedgerName: (value: string) => { state.models = state.models.map((model: { seed: object }, index: number) => index ? model : { ...model, seed: { ...model.seed, name: value } }); render() } })
    render()
  })
  await expect(page.getByRole('tab', { name: '포지션', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function pane(page: Page, label: string) { await page.getByRole('tab', { name: label, exact: true }).click() }
async function patch(page: Page, next: object) { await page.evaluate(value => Reflect.get(window, 'patchLedger')(value), next) }
async function calls(page: Page) { return page.evaluate(() => Reflect.get(window, 'ledgerState').calls) }

test('e08 포지션 배지는 현재·전체·없는 선택·중지·빈 목록에서 표의 실제 행 수와 같다', async ({ page }) => {
  await mount(page)
  const check = async (count: number) => {
    await expect(page.locator('tbody tr')).toHaveCount(count)
    expect(await page.evaluate(() => Reflect.get(window, 'ledgerPositionCount'))).toBe(count)
  }
  await check(1)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'ledgerState')
    Reflect.get(window, 'patchLedger')({ models: state.models.map((model: { seed: object }, i: number) => i === 1 ? { ...model, seed: { ...model.seed, status: 'live' } } : model), scope: 'all' })
  })
  await check(2)
  await patch(page, { scope: 'current', selectedId: 'd2' }); await check(1)
  await patch(page, { selectedId: 'd3' }); await check(0)
  await patch(page, { selectedId: 'missing' }); await check(0)
  await patch(page, { selectedId: null }); await check(2)
  await patch(page, { empty: true }); await check(0)
})

test('e08 원장 숫자는16px·제목14px, 방향 배지는 중립이고 손익 숫자만 색을 유지한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.tft-tbl th').first()).toHaveCSS('font-size', '14px')
  await expect(page.locator('.tft-tbl td').first()).toHaveCSS('font-size', '16px')
  await expect(page.locator('.sd').first()).toHaveCSS('color', 'rgb(236, 236, 236)')
  await expect(page.locator('.sd').first()).toHaveCSS('border-radius', '999px')
  await expect(page.locator('td.up').first()).toHaveCSS('color', 'rgb(78, 192, 141)')
})

test('공급자가 중지를 잠그면 원장도 비활성이고 해제 후 명시 클릭만 전달한다', async ({ page }) => {
  await mount(page)
  const button = page.getByRole('button', { name: 'BTC 돌파 추종 중지', exact: true })
  await patch(page, { pauseDisabled: ['d1'] }); await expect(button).toBeDisabled()
  await button.evaluate(element => element.click()); expect(await calls(page)).toEqual([])
  await patch(page, { pauseDisabled: [] }); await expect(button).toBeEnabled()
  await button.click(); expect(await calls(page)).toEqual([['pause', 'd1']])
})

test('대기 중인 전략만 잠그고 같은 원장의 다른 전략 제어는 유지한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const state = Reflect.get(window, 'ledgerState')
    // Explicit branch fixture: the second supplied position is now live.
    Reflect.get(window, 'patchLedger')({ models: state.models.map((model: { seed: object }, i: number) => i === 1 ? { ...model, seed: { ...model.seed, status: 'live' } } : model), scope: 'all', pauseDisabled: ['d1'] })
  })
  const controls = page.locator('.client-terminal-ledger .tbtn')
  await expect(controls).toHaveCount(2)
  await expect(controls.nth(0)).toBeDisabled(); await expect(controls.nth(1)).toBeEnabled()
  await controls.nth(1).click(); expect(await calls(page)).toEqual([['pause', 'd2']])
})

test('원본 첫 여섯 탭과 현재 범위·단일 출처 note를 보존한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('tab')).toHaveText(['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션', '자산'])
  await expect(page.locator('#pane .tft-tnote')).toHaveText('검증 시뮬레이션 파생 기록이에요, 현재 전략 범위')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('BTC 돌파 추종')
  await expect(page.locator('tbody')).not.toContainText('ETH 추세 추종')
  await expect(page.locator('tbody')).toContainText('W100')
  await expect(page.locator('tbody')).toContainText('+W4')
  await expect(page.locator('tbody')).toContainText('+2.0%')
  expect(await calls(page)).toEqual([])
})

test('포지션·미체결은 live+pos만이며 중지와 전략 선택은 공급 콜백만 호출한다', async ({ page }) => {
  await mount(page)
  await patch(page, { scope: 'all' })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const pause = page.getByRole('button', { name: 'BTC 돌파 추종 중지', exact: true })
  await pause.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  expect(await calls(page)).toEqual([['pause', 'd1']])
  await pane(page, '미체결 주문')
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.locator('tbody')).toContainText('손절 STOP')
  await expect(page.locator('tbody')).toContainText('익절 LIMIT')
  await expect(page.locator('tbody')).toContainText('규칙 주문, 취소는 전략 중지로')
  await expect(page.getByRole('button', { name: /취소/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'BTC 돌파 추종', exact: true }).first().click()
  expect(await calls(page)).toEqual([['pause', 'd1'], ['select', 'd1']])
})

test('주문·체결은 전략마다 최근 8거래를 SELL→BUY 순서로 표시한다', async ({ page }) => {
  await mount(page)
  await pane(page, '주문 내역')
  const count = await page.evaluate(() => Math.min(8, Reflect.get(window, 'ledgerState').models[0].result.trades.length) * 2)
  await expect(page.locator('tbody tr')).toHaveCount(count)
  await expect(page.locator('tbody .sd').first()).toHaveText('SELL')
  await expect(page.locator('tbody .sd').nth(1)).toHaveText('BUY')
  await expect(page.locator('tbody .okst')).toHaveCount(count)
  await pane(page, '체결 내역')
  await expect(page.locator('tbody tr')).toHaveCount(count)
  const fee = await page.evaluate(() => Math.round(Reflect.get(window, 'ledgerState').models[0].result.trades.at(-1).capB * .001))
  await expect(page.locator('tbody tr').first().locator('td').last()).toHaveText(`W${fee}`)
  await expect(page.locator('tbody tr').nth(1).locator('td').last()).toHaveText(`W${fee}`)
  await patch(page, { scope: 'all' })
  const allCount = await page.evaluate(() => Reflect.get(window, 'ledgerState').models.reduce((sum: number, model: { result: { trades: unknown[] } }) => sum + Math.min(8, model.result.trades.length) * 2, 0))
  await expect(page.locator('tbody tr')).toHaveCount(allCount)
  await expect(page.locator('.tft-tnote')).toHaveText('검증 시뮬레이션 파생 기록이에요, 전체 전략 범위')
})

test('종료 포지션 최근 10개는 키보드·행 클릭으로 전략 선택 후 같은 거래 상세를 연다', async ({ page }) => {
  await mount(page)
  await pane(page, '종료 포지션')
  const trade = await page.evaluate(() => {
    const trades = Reflect.get(window, 'ledgerState').models[0].result.trades
    return { count: Math.min(10, trades.length), entry: trades.at(-1).entry }
  })
  await expect(page.locator('tbody tr')).toHaveCount(trade.count)
  const detail = page.getByRole('button', { name: /종료 포지션 상세/ }).first()
  await detail.focus(); await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['select', 'd1'], ['trade', 'd1', trade.entry, 'BUTTON', true]])
  await page.locator('tbody tr').first().locator('td').nth(2).click()
  expect(await calls(page)).toEqual([['select', 'd1'], ['trade', 'd1', trade.entry, 'BUTTON', true], ['select', 'd1'], ['trade', 'd1', trade.entry, 'BUTTON', true]])
})

test('자산은 선택·scope에 무관하게 전체이며 가짜 방금 동기화를 표시하지 않는다', async ({ page }) => {
  await mount(page)
  await pane(page, '자산')
  await expect(page.getByRole('article')).toHaveCount(3)
  await expect(page.locator('.tft-tnote')).toHaveText('계정 전체 범위, 검증 시뮬레이션 파생이에요')
  await expect(page.locator('.ag2').first().locator('small')).toHaveText(['Equity', 'Available', 'Used', '미실현'])
  const before = await page.locator('#pane').innerText()
  await patch(page, { scope: 'all', selectedId: 'd2' })
  expect(await page.locator('#pane').innerText()).toBe(before)
  await expect(page.locator('#pane')).not.toContainText('방금 전')
  await expect(page.locator('.af2')).toHaveText(['고정 체험 데이터, 시뮬레이션', '고정 체험 데이터, 시뮬레이션', '고정 체험 데이터, 시뮬레이션'])
})

test('빈 목록과 현재 대상 없음은 원본 빈 상태를 표시한다', async ({ page }) => {
  await mount(page)
  await patch(page, { selectedId: 'missing' })
  await expect(page.getByText('현재 포지션이 없습니다.', { exact: true })).toBeVisible()
  await patch(page, { empty: true })
  for (const label of ['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션', '자산']) {
    await pane(page, label)
    await expect(page.locator('.tft-empty')).toBeVisible()
    await expect(page.locator('.tft-tnote')).toHaveCount(1)
    await expect(page.locator('tbody')).toHaveCount(0)
  }
})

test('선택 없는 현재 scope는 원본처럼 전체이고 외부 전략명은 텍스트로 유지한다', async ({ page }) => {
  await mount(page)
  await patch(page, { selectedId: null })
  await pane(page, '주문 내역')
  await expect(page.locator('tbody')).toContainText('ETH 추세 추종')
  await page.evaluate(() => Reflect.get(window, 'changeLedgerName')('<script>전략 & 원문</script>'))
  await expect(page.getByRole('button', { name: '<script>전략 & 원문</script>', exact: true }).first()).toBeVisible()
  await expect(page.locator('#pane script')).toHaveCount(0)
})

test('320px에서 표 내부 키보드 스크롤·자산 가독성·포인터 터치 영역을 유지한다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.setViewportSize({ width: 320, height: 640 })
  for (const label of ['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션']) {
    await pane(page, label)
    const region = page.getByRole('region', { name: `${label} 표` })
    await region.focus(); await page.keyboard.press('ArrowRight')
    await expect.poll(() => region.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (info.project.name === 'mobile') for (const button of await page.locator('#pane button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await pane(page, '자산')
  await page.evaluate(() => document.fonts.ready)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  for (const value of await page.locator('.ag2 b').all()) expect(await value.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.locator('#pane').screenshot({ path: info.outputPath('ledger-assets-320.png') })
  await page.setViewportSize({ width: 1200, height: 800 })
  await pane(page, '종료 포지션')
  await page.locator('#pane').screenshot({ path: info.outputPath('ledger-closed-1200.png') })
  expect(errors).toEqual([])
})

test('390·1280px의 350~400px 자산 카드에서 실제 BTC·USDT 고액을 한 줄로 읽는다', async ({ page }, info) => {
  await mount(page)
  await page.evaluate(() => {
    const s = Reflect.get(window, 'ledgerState')
    Reflect.get(window, 'patchLedger')({ models: s.models.map((model: { seed: object; result: object }) => ({ ...model, seed: { ...model.seed, capital: 765432101234.56 }, result: { ...model.result, nav: 987654321012.34 } })) })
  })
  await pane(page, '자산')
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.locator('#fixture').evaluate((element, size) => { (element as HTMLElement).style.width = `${size === 1280 ? 1120 : size}px` }, width)
    for (const currency of ['BTC', 'USDT']) {
      await patch(page, { currency })
      await page.evaluate(() => document.fonts.ready)
      const cards = await page.locator('.tft-asx').evaluateAll(elements => elements.map(element => {
        const values = [...element.querySelectorAll('.ag2 b')]
        return { width: element.getBoundingClientRect().width, values: values.map(value => {
          const range = document.createRange(); range.selectNodeContents(value)
          return { lines: range.getClientRects().length, text: value.textContent, width: range.getBoundingClientRect().width, available: value.clientWidth }
        }) }
      }))
      await page.locator('#pane').screenshot({ path: info.outputPath(`assets-${width}-${currency}.png`) })
      expect(cards.every(card => card.width >= 350 && card.width <= 400)).toBe(true)
      expect(cards.flatMap(card => card.values).every(value => value.lines === 1 && value.width <= value.available + 1)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
  }
})

test('한계 금액은 숫자·단위를 자르지 않고 자산 영역 안에서 키보드 스크롤한다', async ({ page }) => {
  await mount(page)
  await page.setViewportSize({ width: 390, height: 800 })
  await page.evaluate(() => {
    const s = Reflect.get(window, 'ledgerState')
    Reflect.get(window, 'patchLedger')({ currency: 'USDT', models: s.models.map((model: { seed: object; result: object }) => ({ ...model, seed: { ...model.seed, capital: 1e99 }, result: { ...model.result, nav: 1e100 } })) })
  })
  await pane(page, '자산')
  await page.evaluate(() => document.fonts.ready)
  const amounts = page.getByRole('region', { name: 'Binance 자산 금액', exact: true })
  expect(await amounts.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await amounts.focus()
  await expect(amounts).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => amounts.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  for (const value of await amounts.locator('b').all()) expect(await value.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element)
    return range.getClientRects().length
  })).toBe(1)
})
