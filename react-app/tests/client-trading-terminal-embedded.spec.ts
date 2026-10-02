import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, strict = false, selector = false) {
  await page.route('**/terminal-shell-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif;--g0:#0f1012;--g1:#17181b;--gt:#e3e3e3;--gt2:#c4c7c5;--gt3:#9aa0a6;--gl:#ffffff12;--gb:#3d6ef0;--gb2:#5b8af7"><div id="fixture"></div></body></html>' }))
  await page.goto('/terminal-shell-test.html')
  await page.evaluate(async ({ strictMode, selector }) => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const dp = '/@id/react-dom/client', cp = '/src/components/ClientTradingTerminal.tsx'
    // Hooks must share Vite's exact optimized React instance with the component.
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('React dependency was not resolved from the Vite component')
    const reactModule = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientTradingTerminal } = await import(/* @vite-ignore */ cp)
    const react = reactModule.default ?? reactModule
    const h = react.createElement
    const observations = { mounts: 0, unmounts: 0, ticks: 0, layoutConnected: [] as boolean[] }
    Object.assign(window, { terminalObservations: observations })
    function ChartProbe() {
      const element = react.useRef(null)
      react.useLayoutEffect(() => { observations.layoutConnected.push(element.current?.isConnected === true) }, [])
      react.useEffect(() => {
        observations.mounts++
        const timer = window.setInterval(() => { observations.ticks++ }, 50)
        return () => { observations.unmounts++; clearInterval(timer) }
      }, [])
      return h('div', { ref: element, 'data-testid': 'chart-probe' }, h('input', { 'aria-label': '차트 상태', defaultValue: '유지' }), h('p', null, '차트 slot'))
    }
    function Host() {
      const [active, setActive] = react.useState(false)
      const control = react.useRef(null)
      Object.assign(window, { terminalPanel: (next: string) => control.current?.showPanel(next), terminalBottom: (next: string) => control.current?.showBottom(next) })
      return h('main', { id: 'app-main', style: { marginLeft: 240, minWidth: 0 } },
        h('button', { onClick: () => setActive(true) }, '터미널에서 보기'),
        h('button', { id: 'background' }, '배경 버튼'),
        h(ClientTradingTerminal, { active, embedded: true, controlRef: control, strategySelector: selector ? { countLabel: '전략 1개', name: '검증 전략' } : undefined, onClose: () => setActive(false), title: '백테스트 결과', labels: { chart: '차트', strategies: '검증 전략', detail: '검증 지표' },
          slots: { notice: h('p', null, '조회된 결과만 표시'), strategies: h('button', null, '선택한 전략'), context: h('p', null, '검증 구간'), chart: h(ChartProbe), detail: h('button', null, '지표 도움말') },
          bottomTabs: Array.from({ length: 7 }, (_, i) => ({ id: `tab${i}`, label: `항목 ${i + 1}`, content: h('input', { 'aria-label': `기록 ${i + 1}`, defaultValue: `서버 결과 ${i + 1}` }) })),
          bottomTools: h('button', null, '거래 도구'),
        }))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { unmountTerminal: () => root.unmount() })
    root.render(strictMode ? h(react.StrictMode, null, h(Host)) : h(Host))
  }, { strictMode: strict, selector })
  await expect(page.locator('.ctt-terminal')).toBeVisible()

}

test('17d 세로 터미널의 명시 이동·7번째 원장·선택기는 숨은 탭 없이 이어진다', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 }); await mount(page, false, true)
  await page.getByRole('tab', { name: '항목 7', exact: true }).click()
  const record = page.getByRole('textbox', { name: '기록 7', exact: true })
  await record.fill('그대로 유지')
  const originalRecord = await record.elementHandle()
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '0px' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-mobile', 'true')
  await expect(page.locator('.ctt-bottom-tabs [role=tab]')).toHaveCount(7)
  await expect(page.getByRole('tab', { name: '항목 7', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(record).toHaveValue('그대로 유지')
  for (const next of ['detail', 'chart', 'detail', 'bottom', 'chart'] as const) {
    await page.evaluate(next => Reflect.get(window, 'terminalPanel')(next), next)
    const destination = page.locator(next === 'bottom' ? '.ctt-bottom-pane[data-selected=true]' : `[data-terminal-panel=${next}]`)
    await expect(destination).toBeFocused(); await expect(destination).toBeInViewport()
    for (const part of ['.ctt-market', '.ctt-bottom', '.ctt-detail']) await expect(page.locator(part)).toBeVisible()
  }
  await page.evaluate(() => Reflect.get(window, 'terminalBottom')('tab6'))
  await expect(page.locator('.ctt-bottom-pane[data-selected=true]')).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'terminalPanel')('strategies'))
  await expect(page.locator('.ctt-rail')).toBeVisible()
  await expect(page.getByRole('button', { name: '선택한 전략', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '선택한 전략', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  expect(await record.evaluate((el, old) => el === old, originalRecord)).toBe(true)
})

test('앱 main 안의 3열과 하단 탭을 표시하고 모달과 body 잠금을 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await mount(page)
  await expect(page.locator('main .ctt-terminal')).toHaveAttribute('data-embedded', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  const columns = await page.locator('.ctt-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat))
  expect(columns).toHaveLength(3)
  expect(columns[0]).toBeGreaterThanOrEqual(320)
  expect(columns[1]).toBe(264)
  expect(columns[2]).toBe(392)
  const grid = await page.locator('.ctt-grid').boundingBox()
  const bottom = await page.locator('.ctt-bottom').boundingBox()
  expect(bottom!.y).toBeGreaterThanOrEqual(grid!.y + grid!.height)
  await expect(page.getByRole('tablist', { name: '터미널 영역' })).toBeHidden()
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveCount(7)
  await page.getByRole('button', { name: '배경 버튼' }).focus()
  await expect(page.getByRole('button', { name: '배경 버튼' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('main .ctt-terminal')).toBeVisible()
})

test('사이드바를 제외한 너비에서 모바일 3탭·하단 6탭과 inert를 적용한다', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await mount(page)
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-mobile', 'true')
  const main = page.getByRole('tablist', { name: '터미널 영역' })
  const bottom = page.getByRole('tablist', { name: '거래 데이터 항목' })
  await expect(main.getByRole('tab')).toHaveCount(3)
  await expect(bottom.getByRole('tab')).toHaveCount(6)
  await main.getByRole('tab', { name: '차트', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(main.getByRole('tab', { name: '검증 지표' })).toBeFocused()
  await expect(page.locator('.ctt-market')).toHaveAttribute('inert', '')
  await expect(page.locator('.ctt-bottom')).toHaveAttribute('inert', '')
  await expect(page.getByRole('button', { name: '지표 도움말' })).toBeVisible()
  await page.evaluate(() => (document.querySelector('[aria-label="차트 상태"]') as HTMLInputElement).focus())
  await expect(main.getByRole('tab', { name: '검증 지표' })).toBeFocused()
  await main.getByRole('tab', { name: '차트', exact: true }).click()
  await bottom.getByRole('tab').first().focus()
  await page.keyboard.press('End')
  await expect(bottom.getByRole('tab', { name: '항목 6', exact: true })).toBeFocused()
  await expect(page.getByRole('textbox', { name: '기록 6', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '기록 1', exact: true })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('사이드바 폭만 바뀌어도 숨겨질 패널·하단탭 초점을 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: '지표 도움말' }).focus()
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '500px' })
  await expect(page.getByRole('button', { name: '지표 도움말' })).toBeFocused()
  await expect(page.getByRole('tab', { name: '검증 지표', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '검증 지표', exact: true }).focus()
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '240px' })
  await expect(page.locator('[data-terminal-panel=detail]')).toBeFocused()
  await page.getByRole('tab', { name: '항목 7', exact: true }).click()
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '500px' })
  await expect(page.getByRole('tab', { name: '항목 1', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: '차트', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: '기록 1', exact: true })).toBeVisible()
})

test('embedded·전체화면·viewport 왕복에서 차트 DOM과 입력 및 구독을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('textbox', { name: '차트 상태' }).fill('선택 구간 보존')
  await page.evaluate(() => Object.assign(window, { chartNode: document.querySelector('[data-testid=chart-probe]') }))
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '터미널에서 보기' })).toBeFocused()
  await expect(page.locator('main .ctt-terminal')).toHaveAttribute('data-embedded', 'true')
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '0px' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: '검증 전략', exact: true }).click()
  await expect(page.locator('.ctt-market')).toHaveAttribute('inert', '')
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByRole('textbox', { name: '차트 상태' })).toHaveValue('선택 구간 보존')
  expect(await page.evaluate(() => Reflect.get(window, 'chartNode') === document.querySelector('[data-testid=chart-probe]'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalObservations'))).toMatchObject({ mounts: 1, unmounts: 0, layoutConnected: [true] })
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('앱 가용 너비에 맞춰 키보드 분할 너비와 차트 최소 폭을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mount(page)
  const resize = page.getByRole('separator', { name: '검증 지표 너비' })
  await resize.focus()
  await page.keyboard.press('End')
  await expect(resize).toHaveAttribute('aria-valuemax', '520')
  await expect(resize).toHaveAttribute('aria-valuenow', '520')
  const columns = await page.locator('.ctt-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat))
  expect(columns).toEqual([320, 200, 520])
  await page.setViewportSize({ width: 1100, height: 900 })
  await expect(page.getByRole('tab', { name: '검증 지표', exact: true })).toBeFocused()
  await expect(resize).toBeHidden()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('[inert]'))).toBeNull()
})

test('embedded StrictMode 종료에서 차트와 잠금 상태를 정리한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, true)
  const before = await page.evaluate(() => ({ ...Reflect.get(window, 'terminalObservations') }))
  await page.evaluate(() => Reflect.get(window, 'unmountTerminal')())
  await expect(page.locator('.ctt-terminal')).toHaveCount(0)
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalObservations').unmounts)).toBe(before.unmounts + 1)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(errors).toEqual([])
})

test('본문 밖의 포커스는 사이드바 변경 뒤에도 터미널이 가져오지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: '지표 도움말' }).focus()
  await page.getByRole('button', { name: '배경 버튼' }).focus()
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '500px' })
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-mobile', 'true')
  await expect(page.getByRole('button', { name: '배경 버튼' })).toBeFocused()
  await expect(page.getByRole('tab', { name: '차트', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.evaluate(() => { document.getElementById('app-main')!.style.marginLeft = '0px' })
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(page.getByRole('textbox', { name: '차트 상태' })).toBeVisible()
  // The chart is visible in both layouts; wait for the viewport resize event/RO commit.
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
