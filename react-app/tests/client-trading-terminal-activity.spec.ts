import { expect, test, type Page } from '@playwright/test'

const bottomIds = ['pos', 'open', 'orders', 'fills', 'closed', 'assets', 'rebates', 'alerts', 'reports']
const bottomLabels = ['포지션', '미체결 주문', '주문 내역', '체결 내역', '종료 포지션', '자산', '정산', '알림', '보고서']

async function mount(page: Page, account = false, bellOnly = false) {
  await page.route('**/terminal-activity-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012;color:#e3e3e3;font-family:sans-serif;--gt:#e3e3e3;--gt2:#c4c7c5;--gt3:#9aa0a6;--g2:#1d1f23;--gl:#ffffff12;--gb:#3d6ef0;--gb2:#5b8af7"><div id="fixture"></div></body></html>' }))
  await page.goto('/terminal-activity-test.html')
  await page.evaluate(async ({ account, bottomIds, bottomLabels, bellOnly }) => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = account ? '/src/components/ClientAccountTerminal.tsx' : '/src/components/ClientTradingTerminal.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    const toolStyle = document.createElement('style')
    toolStyle.textContent = '.activity-header-tool{border-radius:50%;padding:0;background:rgb(30,31,35);width:36px;height:36px}'
    document.head.append(toolStyle)
    const observations = { mounts: 0, unmounts: 0 }
    function Chart() {
      react.useEffect(() => { observations.mounts++; return () => { observations.unmounts++ } }, [])
      return h('div', { id: 'activity-chart' }, h('canvas'), h('input', { 'aria-label': '차트 메모', defaultValue: '차트 상태' }))
    }
    function Host() {
      const control = react.useRef(null), [active, setActive] = react.useState(false), [count, setCount] = react.useState(3)
      Object.assign(window, { activityObservations: observations, activityShow: (id: string) => control.current?.showBottom(id), activityCount: setCount })
      const headerTools = h('div', null,
        h('button', { id: 'activity-bell', className: 'activity-header-tool', 'aria-label': '알림 열기', onClick: () => control.current?.showBottom('alerts') }, '알림'),
        h('button', { 'aria-label': '정산 열기', onClick: () => control.current?.showBottom('rebates') }, '정산'),
        h('button', { 'aria-label': '보고서 열기', onClick: () => control.current?.showBottom('reports') }, '보고서'))
      const bottomTabs = bottomIds.map((id, index) => ({ id, label: bottomLabels[index], hiddenFromTabs: bellOnly && id === 'alerts', count: id === 'alerts' ? count : id === 'reports' ? 2 : undefined,
        content: h('div', null, h('h3', null, `${bottomLabels[index]} 공급 내용`), h('input', { 'aria-label': `${id} 필터`, defaultValue: '' }), h('p', null, '공급된 기록 '.repeat(50))) })).filter(tab => !bellOnly || !['rebates', 'reports'].includes(tab.id))
      // A hidden pane may precede the visible tabs; it must not steal initial selection or a mobile slot.
      if (bellOnly) bottomTabs.unshift(bottomTabs.pop()!)
      if (account) return h(component.ClientAccountTerminal, { controlRef: control, onNew: () => {}, headerTools,
        entries: [{ strategy: { id: 's1', name: '공급 전략', status: 'live', symbol: 'BTC/USDT', market: '현물', version: 'v1', exchange: { id: 'ex', name: '거래소', color: '#333' }, capitalLabel: '공급 자본' }, chart: null, chartContent: h(Chart), agent: h('input', { 'aria-label': 'Agent 초안', defaultValue: '이어갈 질문' }), dashboard: '대시보드 공급', completed: '완료 공급' }], renderBottom: () => bottomTabs })
      return h(react.Fragment, null, h('button', { onClick: () => setActive(true) }, '터미널 전체화면'), h(component.ClientTradingTerminal, { embedded: true, active, onClose: () => setActive(false), controlRef: control, title: '공급 터미널', headerTools,
        labels: { chart: '차트', strategies: '전략', detail: 'Agent' }, slots: { strategies: h('button', null, '전략 선택'), chart: h(Chart), context: '공급 컨텍스트', detail: h('input', { 'aria-label': 'Agent 초안', defaultValue: '이어갈 질문' }) }, bottomTabs, bottomTools: h('button', null, '현재 전략 범위') }))
    }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { unmountActivity: () => root.unmount() })
    root.render(h(Host))
  }, { account, bottomIds, bottomLabels, bellOnly })
  await expect(page.locator('.ctt-terminal')).toBeVisible()
}

const pane = (page: Page, id: string) => page.locator(`.ctt-bottom-pane[data-tab-id="${id}"]`)
test('벨 전용 알림은 6탭 밖에서 열리고 반응형·전체화면에서도 초안과 차트를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page, false, true)
  const tabs = page.getByRole('tablist', { name: '거래 데이터 항목' })
  await expect(tabs.getByRole('tab')).toHaveCount(6)
  await expect(pane(page, 'alerts')).toBeHidden()
  const order = await page.locator('.ctt-grid').evaluate(el => Array.from(el.children).map(child => (child as HTMLElement).dataset.terminalPanel))
  expect(order).toEqual(['chart', 'strategies', 'detail'])
  const market = await page.locator('.ctt-market').boundingBox()
  const rail = await page.locator('.ctt-rail').boundingBox()
  const detail = await page.locator('.ctt-detail').boundingBox()
  expect(market!.x + market!.width).toBeLessThanOrEqual(rail!.x + 1)
  expect(rail!.x + rail!.width).toBeLessThanOrEqual(detail!.x + 1)
  await page.getByRole('textbox', { name: '차트 메모' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '전략 선택' })).toBeFocused()
  await page.evaluate(() => Object.assign(window, { chartNode: document.querySelector('#activity-chart') }))
  await page.getByRole('button', { name: '알림 열기' }).click()
  await expect(pane(page, 'alerts')).toBeFocused()
  await expect(pane(page, 'alerts')).toHaveAttribute('role', 'region')
  await expect(pane(page, 'alerts')).not.toHaveAttribute('aria-labelledby')
  await expect(tabs.locator('[aria-selected="true"]')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'alerts 필터' }).fill('읽지 않은 기록')
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toHaveValue('읽지 않은 기록')
    if (width === 320) {
      await expect(page.locator('.ctt-market')).toBeHidden()
      await page.getByRole('tablist', { name: '터미널 영역' }).getByRole('tab', { name: '차트', exact: true }).click()
      await tabs.getByRole('tab', { name: '포지션', exact: true }).click()
      await expect(page.locator('.ctt-market')).toBeVisible()
      await expect(pane(page, 'alerts')).toBeHidden()
      await expect(tabs.getByRole('tab', { name: '포지션', exact: true })).toBeFocused()
      await page.getByRole('button', { name: '알림 열기' }).click()
      await page.getByRole('textbox', { name: 'alerts 필터' }).focus()
    } else {
      await expect(page.locator('.ctt-market')).toBeVisible()
      await expect(page.locator('.ctt-rail')).toBeVisible()
      await expect(page.locator('.ctt-detail')).toBeVisible()
    }
  }
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await expect(pane(page, 'alerts')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tabs.getByRole('tab')).toHaveCount(6)
  await tabs.getByRole('tab', { name: '포지션', exact: true }).click()
  await expect(pane(page, 'alerts')).toBeHidden()
  expect(await page.evaluate(() => Reflect.get(window, 'chartNode') === document.querySelector('#activity-chart'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'activityObservations'))).toEqual({ mounts: 1, unmounts: 0 })
})

async function mobilePanel(page: Page, name: string) { await page.getByRole('tablist', { name: '터미널 영역' }).getByRole('tab', { name, exact: true }).click() }

test('데스크톱 9탭 배지와 showBottom 포커스는 공급 값만 반영한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await mount(page)
  const tabs = page.getByRole('tablist', { name: '거래 데이터 항목' })
  await expect(tabs.getByRole('tab')).toHaveCount(9)
  await expect(tabs.locator('[data-tab-id=alerts] .ct')).toHaveText('3')
  await expect(tabs.locator('[data-tab-id=reports] .ct')).toHaveText('2')
  await page.getByRole('button', { name: '알림 열기' }).click()
  await expect(pane(page, 'alerts')).toBeFocused()
  await expect(tabs.locator('[data-tab-id=alerts]')).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('textbox', { name: 'alerts 필터' }).fill('미읽음')
  await page.getByRole('button', { name: '알림 열기' }).click()
  await expect(pane(page, 'alerts')).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toHaveValue('미읽음')
  await page.evaluate(() => Reflect.get(window, 'activityCount')(0))
  await expect(tabs.locator('[data-tab-id=alerts] .ct')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'activityShow')('없는 ID'))
  await expect(pane(page, 'alerts')).toBeFocused()
})

test('320px 알림·정산·보고서는 모바일 6탭을 늘리지 않고 독립 본문을 연다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 }); await mount(page)
  await expect(page.getByRole('tablist', { name: '터미널 영역' }).getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveCount(6)
  await page.evaluate(() => Object.assign(window, { chartNode: document.querySelector('#activity-chart') }))
  for (const [id, name] of [['alerts', '알림'], ['rebates', '정산'], ['reports', '보고서']]) {
    await page.getByRole('button', { name: `${name} 열기` }).click()
    await expect(pane(page, id)).toBeVisible(); await expect(pane(page, id)).toBeFocused()
    await expect(page.locator('.ctt-market')).toBeHidden(); await expect(page.locator('.ctt-detail')).toBeHidden()
    await expect(page.locator('.ctt-market')).toHaveAttribute('inert')
    await expect(page.getByRole('tablist', { name: '거래 데이터 항목' })).toHaveCount(0)
    await expect(page.getByRole('tablist', { name: '터미널 영역' }).locator('[aria-selected=true]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '현재 전략 범위' })).toBeVisible()
    expect(await pane(page, id).evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  }
  await mobilePanel(page, 'Agent')
  await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('이어갈 질문')
  await expect(pane(page, 'reports')).toBeHidden()
  await mobilePanel(page, '차트')
  await expect(pane(page, 'reports')).toBeVisible()
  await expect(pane(page, 'reports')).toHaveAttribute('role', 'region')
  await expect(pane(page, 'reports')).not.toHaveAttribute('aria-labelledby')
  await expect(page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab')).toHaveCount(6)
  await page.getByRole('tablist', { name: '거래 데이터 항목' }).getByRole('tab', { name: '체결 내역' }).click()
  await expect(pane(page, 'fills')).toBeVisible(); await expect(pane(page, 'reports')).toBeHidden()
  expect(await page.evaluate(() => Reflect.get(window, 'chartNode') === document.querySelector('#activity-chart'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'activityObservations'))).toEqual({ mounts: 1, unmounts: 0 })
})

test('Account 헤더 도구는 전체화면 왕복에 유효 노드 하나이고 초안·차트를 유지한다', async ({ page }) => {
  await mount(page, true)
  // Source account terminal keeps chart and judgment together with its strategy selector.
  await expect(page.getByRole('tablist', { name: '터미널 영역' })).toBeHidden()
  await expect(page.locator('.ctt-selector-button')).toBeVisible()
  await page.getByRole('textbox', { name: 'Agent 초안' }).fill('보존할 질문')
  await page.evaluate(() => Object.assign(window, { chartNode: document.querySelector('#activity-chart') }))
  for (const expanded of [false, true, false]) {
    if (expanded) await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
    else if (await page.getByRole('button', { name: '터미널 닫기' }).count()) await page.getByRole('button', { name: '터미널 닫기' }).click()
    await expect(page.locator('#activity-bell')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '알림 열기' })).toBeVisible()
    await expect(page.locator('#activity-bell')).toHaveCSS('border-radius', '50%')
    expect(await page.locator('#activity-bell').evaluate(el => { const rect = el.getBoundingClientRect(); return rect.width === rect.height })).toBe(true)
    await page.getByRole('button', { name: '알림 열기' }).click()
    await expect(pane(page, 'alerts')).toBeFocused()
    expect(await page.locator('#activity-bell').evaluate(el => !el.closest('[hidden],[inert]'))).toBe(true)
    await expect(page.locator('.ctt-selector-button')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Agent 초안' })).toHaveValue('보존할 질문')
  }
  expect(await page.evaluate(() => Reflect.get(window, 'chartNode') === document.querySelector('#activity-chart'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'activityObservations'))).toEqual({ mounts: 1, unmounts: 0 })
})

test('명시 알림의 초점은 데스크톱→모바일→데스크톱에서 같은 본문에 남는다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await mount(page)
  await page.getByRole('button', { name: '알림 열기' }).click()
  await page.getByRole('textbox', { name: 'alerts 필터' }).fill('보존')
  await page.setViewportSize({ width: 390, height: 640 })
  await expect(pane(page, 'alerts')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toBeFocused()
  await expect(page.locator('.ctt-market')).toBeHidden()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'alerts 필터' })).toHaveValue('보존')
  await expect(page.locator('.ctt-bottom-tabs [data-tab-id=alerts]')).toHaveAttribute('aria-selected', 'true')
})

test('탭·너비 조작은 IME·수정키를 가로채지 않고 일반 키만 처리한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await mount(page)
  const tabs = page.getByRole('tablist', { name: '거래 데이터 항목' }), first = tabs.getByRole('tab').first()
  await first.focus()
  for (const flags of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { keyCode: 229 }]) {
    await first.dispatchEvent('keydown', { key: 'End', ...flags })
    await expect(first).toHaveAttribute('aria-selected', 'true')
  }
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: '미체결 주문' })).toBeFocused()
  const separator = page.getByRole('separator', { name: 'Agent 너비' })
  const original = await separator.getAttribute('aria-valuenow')
  await separator.dispatchEvent('keydown', { key: 'End', ctrlKey: true })
  await expect(separator).toHaveAttribute('aria-valuenow', original!)
  await page.setViewportSize({ width: 390, height: 640 })
  const main = page.getByRole('tablist', { name: '터미널 영역' }).getByRole('tab', { name: '차트', exact: true })
  await main.dispatchEvent('keydown', { key: 'End', isComposing: true })
  await expect(main).toHaveAttribute('aria-selected', 'true')
})
