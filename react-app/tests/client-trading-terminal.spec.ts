import { expect, test, type Page } from '@playwright/test'

test('전체화면 종료는 원래 스크롤 값과 important 우선순위를 정확히 복원한다', async ({ page }) => {
  await mount(page, true)
  await page.getByRole('textbox', { name: '차트 상태' }).fill('닫아도 같은 차트')
  const probe = await page.getByTestId('chart-probe').elementHandle()
  const counts = await page.evaluate(() => Reflect.get(window, 'terminalObservations'))
  for (const value of ['auto', 'scroll', 'hidden']) {
    await page.evaluate(value => document.body.style.setProperty('overflow', value, 'important'), value)
    await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual([value, 'important'])
    await expect(page.getByRole('button', { name: '터미널에서 보기', exact: true })).toBeFocused()
    expect(await page.getByTestId('chart-probe').evaluate((node, old) => node === old, probe)).toBe(true)
    await expect(page.getByRole('textbox', { name: '차트 상태' })).toHaveValue('닫아도 같은 차트')
  }
  const after = await page.evaluate(() => Reflect.get(window, 'terminalObservations'))
  expect(after.mounts).toBe(counts.mounts)
  expect(after.unmounts).toBe(counts.unmounts)
})

test('전체화면 중 다른 화면이 교체한 스크롤 설정을 닫기에서 덮지 않는다', async ({ page }) => {
  await mount(page)
  for (const [value, priority] of [['hidden', 'important'], ['auto', 'important'], ['clip', '']]) {
    await page.evaluate(() => document.body.style.removeProperty('overflow'))
    await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.evaluate(({ value, priority }) => document.body.style.setProperty('overflow', value, priority), { value, priority })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(await page.evaluate(() => [document.body.style.getPropertyValue('overflow'), document.body.style.getPropertyPriority('overflow')])).toEqual([value, priority])
  }
})

async function mount(page: Page, strict = false) {
  await page.route('**/terminal-shell-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif;--g0:#0f1012;--g1:#17181b;--gt:#e3e3e3;--gt2:#c4c7c5;--gt3:#9aa0a6;--gl:#ffffff12;--gb:#3d6ef0;--gb2:#5b8af7"><div id="fixture"></div></body></html>' }))
  await page.goto('/terminal-shell-test.html')
  await page.evaluate(async strictMode => {
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
      return h(react.Fragment, null,
        h('button', { onClick: () => setActive(true) }, '터미널에서 보기'),
        h('button', { id: 'background' }, '배경 버튼'),
        h(ClientTradingTerminal, { active, onClose: () => setActive(false), title: '백테스트 결과', labels: { chart: '차트', strategies: '검증 전략', detail: '검증 지표' },
          slots: { notice: h('p', null, '조회된 결과만 표시'), strategies: h('button', null, '선택한 전략'), context: h('p', null, '검증 구간'), chart: h(ChartProbe), detail: h('button', null, '지표 도움말') },
          bottomTabs: Array.from({ length: 7 }, (_, i) => ({ id: `tab${i}`, label: `항목 ${i + 1}`, content: h('input', { 'aria-label': `기록 ${i + 1}`, defaultValue: `서버 결과 ${i + 1}` }) })),
          bottomTools: h('button', null, '거래 도구'),
        }))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { unmountTerminal: () => root.unmount() })
    root.render(strictMode ? h(react.StrictMode, null, h(Host)) : h(Host))
  }, strict)
  await expect(page.locator('.ctt-terminal')).toBeVisible()
}

test('기본 결과 모든 slot 표시 → 전체화면 → 복귀에서도 같은 DOM과 재생 유지', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '지표 도움말' })).toBeVisible()
  for (let i = 1; i <= 7; i++) await expect(page.getByRole('textbox', { name: `기록 ${i}`, exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: '차트 상태' }).fill('사용자가 선택한 범위')
  await page.evaluate(() => Object.assign(window, { terminalChartNode: document.querySelector('[data-testid=chart-probe]') }))
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await expect(page.getByRole('dialog', { name: '백테스트 결과' })).toBeVisible()
  await expect(page.getByRole('button', { name: '터미널 닫기' })).toBeFocused()
  await expect(page.locator('.ctt-modal')).toHaveJSProperty('open', true)
  expect(await page.evaluate(() => document.querySelector('.ctt-modal')?.matches(':modal'))).toBe(true)
  await page.evaluate(() => document.getElementById('background')?.focus())
  expect(await page.evaluate(() => document.activeElement?.id)).not.toBe('background')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '터미널에서 보기' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: '차트 상태' })).toHaveValue('사용자가 선택한 범위')
  expect(await page.evaluate(() => (window as unknown as { terminalChartNode: Element }).terminalChartNode === document.querySelector('[data-testid=chart-probe]'))).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { terminalObservations: { mounts: number; unmounts: number } }).terminalObservations)).toMatchObject({ mounts: 1, unmounts: 0 })
  expect(await page.evaluate(() => (window as unknown as { terminalObservations: { layoutConnected: boolean[] } }).terminalObservations.layoutConnected)).toEqual([true])
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('하단 탭 키보드와 모바일 6항목, 숨김 영역의 재생은 계속 진행', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  const tabs = page.getByRole('tablist', { name: '거래 데이터 항목' })
  const isMobile = (page.viewportSize()?.width ?? 0) <= 960
  await expect(tabs.getByRole('tab')).toHaveCount(isMobile ? 6 : 7)
  await tabs.getByRole('tab').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: '항목 2' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: '기록 2', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '기록 1', exact: true })).toBeHidden()
  if (isMobile) {
    const main = page.getByRole('tablist', { name: '터미널 영역' })
    await main.getByRole('tab', { name: '차트', exact: true }).focus()
    await page.keyboard.press('End')
    await expect(main.getByRole('tab', { name: '검증 지표' })).toBeFocused()
    await expect(page.getByRole('button', { name: '지표 도움말' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '차트 상태' })).toBeHidden()
    const ticks = await page.evaluate(() => (window as unknown as { terminalObservations: { ticks: number } }).terminalObservations.ticks)
    await expect.poll(() => page.evaluate(() => (window as unknown as { terminalObservations: { ticks: number } }).terminalObservations.ticks)).toBeGreaterThan(ticks)
    await page.evaluate(() => (document.querySelector('[aria-label="차트 상태"]') as HTMLInputElement)?.focus())
    await expect(main.getByRole('tab', { name: '검증 지표' })).toBeFocused()
    await main.getByRole('tab', { name: '차트', exact: true }).click()
    await expect(page.getByRole('textbox', { name: '기록 2', exact: true })).toBeVisible()
  } else {
    await page.getByRole('button', { name: '지표 도움말' }).focus()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: '지표 도움말' })).toBeFocused()
    await expect(page.getByRole('tab', { name: '검증 지표', exact: true })).toHaveAttribute('aria-selected', 'true')
  }
  expect(await page.evaluate(() => (window as unknown as { terminalObservations: { mounts: number; unmounts: number } }).terminalObservations)).toMatchObject({ mounts: 1, unmounts: 0 })
})

test('분할 너비 키보드 및 포인터 취소 후 움직임 정지', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  const resize = page.getByRole('separator', { name: '검증 지표 너비' })
  await resize.focus()
  await page.keyboard.press('Home')
  await expect(resize).toHaveAttribute('aria-valuenow', '320')
  await page.keyboard.press('End')
  await expect(resize).toHaveAttribute('aria-valuenow', '560')
  await page.keyboard.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', '544')
  const bounds = await resize.boundingBox()
  await page.mouse.move(bounds!.x + 3, bounds!.y + 20)
  await page.mouse.down()
  await page.mouse.move(bounds!.x + 43, bounds!.y + 20)
  await expect(resize).toHaveAttribute('aria-valuenow', '504')
  await resize.dispatchEvent('pointercancel', { pointerId: 1 })
  await page.mouse.move(bounds!.x + 83, bounds!.y + 20)
  await page.mouse.up()
  await expect(resize).toHaveAttribute('aria-valuenow', '504')
  expect(await page.locator('.ctt-detail').evaluate(el => Math.round(el.getBoundingClientRect().width))).toBe(504)
})

test('다른 경로로 이동하면 top-layer 및 스크롤 잠금 정리', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await page.evaluate(() => { history.pushState({}, '', '#/insight'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.querySelector('.ctt-modal')?.matches(':modal'))).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await expect(page.getByRole('button', { name: '지표 도움말' })).toBeVisible()
})

test('데스크톱 전용 7번째 하단탭 초점이 모바일 첫 탭으로 복원된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await page.getByRole('tab', { name: '항목 7', exact: true }).click()
  await expect(page.getByRole('tab', { name: '항목 7', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: '항목 1', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: '항목 1', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: '기록 1', exact: true })).toBeVisible()
})

test('리사이즈 손잡이가 모바일에서 사라지면 해당 영역 탭으로 초점을 잇는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await page.getByRole('separator', { name: '검증 지표 너비' }).focus()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: '검증 지표', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: '지표 도움말' })).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.ctt-modal')))).toBe(true)
})

test('모바일 영역 탭이 데스크톱에서 숨겨져도 같은 영역으로 초점을 잇는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  for (const [name, panel] of [['검증 지표', 'detail'], ['검증 전략', 'strategies'], ['차트', 'chart']]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('tab', { name, exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator(`[data-terminal-panel="${panel}"]`)).toBeFocused()
  }
  await page.getByRole('button', { name: '터미널 닫기' }).focus()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: '터미널 닫기' })).toBeFocused()
})

test('모바일 지표에서 데스크톱 하단으로 이동한 뒤 축소해도 하단 초점을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  for (const name of ['항목 2', '기록 2', '거래 도구']) {
    await page.getByRole('tab', { name: '검증 지표', exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('tab', { name: '항목 2', exact: true }).click()
    const target = name === '기록 2' ? page.getByRole('textbox', { name, exact: true }) : name === '거래 도구' ? page.getByRole('button', { name, exact: true }) : page.getByRole('tab', { name, exact: true })
    await target.focus()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(target).toBeFocused()
    await expect(page.getByRole('tab', { name: '차트', exact: true })).toHaveAttribute('aria-selected', 'true')
  }
})

test('포인터로 초점을 해제한 뒤 resize가 이전 영역으로 강제 이동하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await page.getByRole('button', { name: '지표 도움말' }).focus()
  await page.locator('.ctt-chart p').click()
  await expect(page.getByRole('button', { name: '지표 도움말' })).not.toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('tab', { name: '차트', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: '차트 상태' })).toBeVisible()
})

test('StrictMode와 활성 portal unmount에서 DOM 및 스크롤 잠금 안전하게 정리', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, true)
  const before = await page.evaluate(() => ({ ...(window as unknown as { terminalObservations: { mounts: number; unmounts: number } }).terminalObservations }))
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  await page.getByRole('button', { name: '터미널 닫기' }).click()
  await page.getByRole('button', { name: '터미널에서 보기' }).click()
  expect(await page.evaluate(() => (window as unknown as { terminalObservations: { mounts: number; unmounts: number } }).terminalObservations)).toMatchObject({ mounts: before.mounts, unmounts: before.unmounts })
  await page.evaluate(() => (window as unknown as { unmountTerminal: () => void }).unmountTerminal())
  await expect(page.locator('.ctt-terminal')).toHaveCount(0)
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(await page.evaluate(() => (window as unknown as { terminalObservations: { unmounts: number } }).terminalObservations.unmounts)).toBe(before.unmounts + 1)
  expect(errors).toEqual([])
})
