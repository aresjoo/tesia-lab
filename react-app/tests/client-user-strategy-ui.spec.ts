import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page) {
  await page.route('**/user-strategy-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div class="tesia-shell conversation-surface" style="min-height:100vh;display:block"><div id="fixture"></div></div></body></html>' }))
  await page.goto('/user-strategy-test.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientUserStrategy.tsx', domPath = '/@id/react-dom/client', statePath = '/src/client-account-event-state.ts', viewPath = '/src/client-user-strategy-view.ts'
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), dm = await import(/* @vite-ignore */ domPath), { ClientUserStrategy } = await import(/* @vite-ignore */ componentPath), stateModule = await import(/* @vite-ignore */ statePath), view = await import(/* @vite-ignore */ viewPath)
    for (const path of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    const react = rm.default ?? rm, h = react.createElement, createdAt = Date.UTC(2026, 8, 15), id = String(createdAt)
    const record = { id, name: '비트코인 위임 전략', createdAt, status: 'live', environment: 'paper', parameters: { sl: -5, tp: 10, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }, score: 87, ret: 12.3, mdd: -6.2, n: 31, winRate: 54.7, origin: '원문 원본 전략', exchangeName: '공급 거래소' }
    const events = stateModule.createSourceAccountEventState({
      fillLog: [{ fid: 'f1', botId: id, side: 'b', label: '첫 번째 공급 체결', pnl: .02, kind: 'time', sim: true, at: createdAt }, { fid: 'f2', botId: id, side: 's', label: '두 번째 공급 체결', pnl: -.01, kind: 'sl', sim: true, at: createdAt }, { fid: 'foreign', botId: '0', side: 'b', label: '다른 봇 체결', pnl: .1, kind: 'tp', sim: true, at: createdAt }],
      reviews: [{ id: 'review1', fid: 'f1', botId: id, asset: 'BTC', kind: 'time', kindL: '기간 청산', pnl: .02, at: createdAt, budget: 1000, causes: [], sim: true }],
      rebates: [{ fid: 'f1', botId: id, amt: 50, at: createdAt, sim: true }, { fid: 'foreign', botId: '0', amt: 900, at: createdAt, sim: true }],
    })
    const ui = { record, events, nullRecord: false, nullEvents: false, controls: true, edit: true, position: undefined as unknown, permission: undefined as string | undefined, mode: 'sync', duplicate: false, calls: [] as unknown[][], deferred: null as null | { resolve: () => void; reject: (error: Error) => void } }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const run = (action: string) => { ui.calls.push([action, ui.record.id]); if (ui.mode === 'failure') return Promise.reject(new Error('private caller failure')); if (ui.mode === 'deferred') return new Promise<void>((resolve, reject) => { ui.deferred = { resolve, reject } }) }
    const render = () => { const props = { record: ui.nullRecord ? null : ui.record, events: ui.nullEvents ? null : ui.events, money: (value: number, signed = false) => (value < 0 ? '−' : signed ? '+' : '') + '₩' + Math.abs(value).toLocaleString('ko-KR'), onNavigate: (route: string) => ui.calls.push(['navigate', route]), onControl: ui.controls ? (action: string) => run(action) : undefined, onEdit: ui.edit ? () => run('edit') : undefined, position: ui.position, executionPermissionLabel: ui.permission }; root.render(h(react.Fragment, null, h(ClientUserStrategy, { ...props, key: 'first' }), ui.duplicate && h(ClientUserStrategy, { ...props, key: 'second' }))) }
    Object.assign(window, { userStrategyUI: ui, userStrategyModel: () => view.projectSourceUserStrategy(ui.record), unmountUserStrategy: () => root.unmount(), patchUserStrategy: (patch: object, recordPatch?: object, eventPatch?: object) => { Object.assign(ui, patch); if (recordPatch) ui.record = { ...ui.record, ...recordPatch }; if (eventPatch) ui.events = stateModule.createSourceAccountEventState({ ...ui.events, ...eventPatch }); render() } })
    render()
  })
  await expect(page.getByRole('heading', { name: '비트코인 위임 전략', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function patch(page: Page, ui: object, record?: object, events?: object) { await page.evaluate(([ui, record, events]) => Reflect.get(window, 'patchUserStrategy')(ui, record, events), [ui, record, events]) }
async function calls(page: Page) { return page.evaluate(() => Reflect.get(window, 'userStrategyUI').calls) }

test('원본 hero·정적 지표·저장설정곡선과 환경을 보존한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  await expect(page.locator('.nfxb-origin')).toHaveText('원본: 원문 원본 전략')
  await expect(page.locator('.nfxb-ring .val')).toHaveText('87/100')
  await expect(page.locator('.nfxb-bigval')).toHaveText(['+12.3%', '-6.2%'])
  await expect(page.locator('.nfxb-sdesc')).toHaveText('RSI 44 눌림 진입, 손절 -5%, 익절 +10%, 추세 필터')
  await expect(page.getByText('누적 고점 대비 최대 낙폭', { exact: true })).toBeVisible()
  await expect(page.getByText(/규칙 안에서 관리된 낙폭/)).toHaveCount(0)
  await expect(page.locator('.nfxb-specs')).toContainText('공급 거래소')
  await expect(page.locator('.nfxb-specs')).toContainText('확인되지 않음')
  await expect(page.getByText('출금 권한 없음')).toHaveCount(0)
  const expectedPath = await page.evaluate(() => {
    const eq = Reflect.get(window, 'userStrategyModel')().evaluation.r.eq as { v: number }[]
    const low = Math.min(...eq.map(point => point.v)), high = Math.max(...eq.map(point => point.v))
    return eq.map((point, i) => (i ? 'L ' : 'M ') + Math.round(i / (eq.length - 1) * 800) + ' ' + Math.round(130 - (point.v - low) / (high - low) * 115)).join(' ')
  })
  await expect(page.locator('.nfxb-line')).toHaveAttribute('d', expectedPath)
})
test('없는 기록·없는 파라미터는 demo봇/곡선/로그로 대체하지 않는다', async ({ page }) => {
  await mount(page)
  await patch(page, {}, { parameters: null })
  await expect(page.locator('.nfxb-bigval')).toHaveText(['+12.3%', '-6.2%'])
  await expect(page.locator('.nfxb-spark,.user-log')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 수정', exact: true })).toHaveCount(0)
  await patch(page, { nullRecord: true })
  await expect(page.getByText('전략을 찾을 수 없어요')).toBeVisible()
  await expect(page.locator('.nfxb-hero')).toHaveCount(0)
  await page.getByRole('button', { name: '내 트레이딩', exact: true }).click()
  expect(await calls(page)).toEqual([['navigate', '#/trade']])
})
test('같은봇의 공급 체결·복기·적립만 사용하며 미공급/빈기록을 구분한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.nfx-rows .nfx-row')).toHaveCount(2)
  await expect(page.locator('.nfxb-fee')).toContainText('+₩50')
  await expect(page.getByText('다른 봇 체결')).toHaveCount(0)
  await page.getByRole('button', { name: /첫 번째 공급 체결/ }).focus(); await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['navigate', '#/review/review1']])
  await patch(page, { nullEvents: true })
  await expect(page.getByText('주문 기록을 확인할 수 없어요')).toBeVisible()
  await expect(page.locator('.nfxb-fee')).toHaveCount(0)
  await patch(page, { nullEvents: false }, { status: 'ready' }, { fillLog: [], reviews: [], rebates: [] })
  await expect(page.getByText('아직 체결이 없어요')).toBeVisible()
  await expect(page.getByRole('button', { name: '지금 시작하기', exact: true })).toHaveCount(2)
})
test('포지션은 미공급/flat/공급텍스트를 구분하고 HTML을 해석하지 않는다', async ({ page }) => {
  await mount(page)
  await expect(page.getByText('포지션 상태를 확인할 수 없어요')).toBeVisible()
  await expect(page.getByText('현재 열린 포지션이 없어요')).toHaveCount(0)
  await patch(page, { position: null })
  await expect(page.getByText('현재 열린 포지션이 없어요')).toBeVisible()
  await patch(page, { position: { title: '<img src=x onerror=alert(1)>', description: '공급 포지션 상태', checks: ['공급된 체크 원문'] }, permission: '출금 권한 없음' })
  await expect(page.locator('.nfxb-postit')).toHaveText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.client-user-strategy img')).toHaveCount(0)
  await expect(page.locator('.nfxb-check')).toHaveText('공급된 체크 원문')
  await expect(page.locator('.nfxb-specs')).toContainText('출금 권한 없음')
})
test('상태별 제어·미공급 잠금·실패 유지·중복 요청 방지를 제공한다', async ({ page }) => {
  await mount(page)
  await patch(page, { controls: false, edit: false })
  for (const button of await page.locator('.nfxb-actions button').all()) await expect(button).toBeDisabled()
  await patch(page, { controls: true, edit: true, mode: 'deferred' })
  await page.getByRole('button', { name: '실행 일시정지', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await expect(page.locator('.nfxb-actions')).toHaveAttribute('aria-busy', 'true')
  expect((await calls(page)).map(call => call[0])).toEqual(['pause'])
  await expect(page.locator('.nfxb-st')).toHaveText('가상 실행')
  await page.evaluate(() => Reflect.get(window, 'userStrategyUI').deferred.reject(new Error('private failure')))
  await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했어요. 다시 시도해 주세요.')
  await expect(page.locator('.client-user-strategy')).not.toContainText('private failure')
  await patch(page, { mode: 'sync' }, { status: 'off' })
  await page.getByRole('button', { name: '재개', exact: true }).click()
  await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  expect((await calls(page)).at(-1)?.[0]).toBe('resume')
  await patch(page, {}, { status: 'live', environment: 'live' })
  await page.getByRole('button', { name: '가상 시뮬레이션으로 전환', exact: true }).click()
  expect((await calls(page)).at(-1)?.[0]).toBe('env')
})
test('다른 기록으로 교체하면 이전 async 완료가 새 UI에 영향을 주지 않는다', async ({ page }) => {
  await mount(page); await patch(page, { mode: 'deferred' })
  await page.getByRole('button', { name: '전략 수정', exact: true }).click()
  const nextAt = Date.UTC(2026, 8, 16)
  await patch(page, {}, { id: String(nextAt), createdAt: nextAt, name: '새 사용자 전략' })
  await page.evaluate(() => Reflect.get(window, 'userStrategyUI').deferred.reject(new Error('old failure')))
  await expect(page.getByRole('heading', { name: '새 사용자 전략', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.nfxb-actions')).toHaveAttribute('aria-busy', 'false')
})
test('로그 최근14→28의 이전내용·키보드·스크롤위치를 유지하고 체결필터는 reset한다', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 700 }); await mount(page)
  const events = page.locator('.nfxl-ev')
  await expect(events).toHaveCount(14)
  const initialLast = await events.last().getAttribute('data-bar'), initialFirst = await events.first().getAttribute('data-bar')
  const more = page.getByRole('button', { name: '이전 14개 보기', exact: true })
  await more.scrollIntoViewIfNeeded(); await more.focus()
  const before = (await more.boundingBox())!.y
  await page.keyboard.press('Enter')
  await expect(events).toHaveCount(28)
  expect(await events.last().getAttribute('data-bar')).toBe(initialLast)
  expect(Number(await events.first().getAttribute('data-bar'))).toBeLessThan(Number(initialFirst))
  await expect(more).toBeFocused()
  expect(Math.abs((await more.boundingBox())!.y - before)).toBeLessThan(3)
  await page.getByRole('button', { name: /^체결만/ }).click()
  await expect(events).toHaveCount(14)
  expect(await events.evaluateAll(rows => rows.every(row => /entry|exit/.test(row.className)))).toBe(true)
  const expected = await page.evaluate(() => Reflect.get(window, 'userStrategyModel')().evaluation.L.evs.filter((event: { k: string }) => event.k === 'entry' || event.k.startsWith('exit')).slice(-14).map((event: { txt: string }) => event.txt))
  for (const [i, text] of expected.entries()) await expect(events.nth(i)).toContainText(text)
})
test('두 전략 SVG gradient는 고유하며 원문 외부이름은 안전한 텍스트다', async ({ page }) => {
  await mount(page); await patch(page, { duplicate: true }, { name: '<svg onload=alert(1)>', origin: '원문 <b>기원</b>' })
  await expect(page.locator('h1')).toHaveText(['<svg onload=alert(1)>', '<svg onload=alert(1)>'])
  const ids = await page.locator('linearGradient').evaluateAll(elements => elements.map(element => element.id))
  expect(ids).toHaveLength(2); expect(new Set(ids).size).toBe(2)
  for (const [i, id] of ids.entries()) await expect(page.locator('.nfxb-area').nth(i)).toHaveAttribute('fill', 'url(#' + id + ')')
})

test('내부 스크롤 패널에서도 이전14개 추가 시 읽던 위치가 유지된다', async ({ page }) => {
  await mount(page)
  await page.locator('#fixture').evaluate(element => { element.style.height = '600px'; element.style.overflowY = 'auto' })
  const more = page.getByRole('button', { name: '이전 14개 보기', exact: true })
  await more.scrollIntoViewIfNeeded(); await more.focus()
  const before = (await more.boundingBox())!.y
  await page.keyboard.press('Enter')
  await expect(page.locator('.nfxl-ev')).toHaveCount(28)
  expect(Math.abs((await more.boundingBox())!.y - before)).toBeLessThan(3)
  await expect(more).toBeFocused()
})

test('점수 링 60ms모션은 상태교체·숨김복원·reduced·unmount를 정리한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await mount(page)
  await page.evaluate(() => {
    const timers = new Map<number, () => void>(), timeout = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window)
    let next = 100000, hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    Object.assign(window, {
      setTimeout: (callback: () => void, delay?: number, ...args: unknown[]) => { if (delay !== 60) return timeout(callback, delay, ...args); const id = next++; timers.set(id, callback); return id },
      clearTimeout: (id: number) => { timers.delete(id); clear(id) },
      scoreMotion: { pending: () => timers.size, finish: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()) }, hide: (value: boolean) => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) } },
    })
  })
  await patch(page, {}, { score: 80 })
  const ring = page.locator('.nfxb-ring .fg')
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 251.3/)
  expect(await page.evaluate(() => Reflect.get(window, 'scoreMotion').pending())).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'scoreMotion').finish())
  expect(await ring.evaluate(el => Number((el as SVGCircleElement).style.strokeDashoffset))).toBeCloseTo(50.26)
  await patch(page, {}, { score: 70 })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 251.3/)
  await page.evaluate(() => Reflect.get(window, 'scoreMotion').hide(true))
  expect(await ring.evaluate(el => Number((el as SVGCircleElement).style.strokeDashoffset))).toBeCloseTo(75.39)
  expect(await page.evaluate(() => Reflect.get(window, 'scoreMotion').pending())).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'scoreMotion').hide(false))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await patch(page, {}, { score: 100 })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 0/)
  expect(await page.evaluate(() => Reflect.get(window, 'scoreMotion').pending())).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await patch(page, {}, { score: 60 })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 251.3/)
  await page.evaluate(() => Reflect.get(window, 'unmountUserStrategy')())
  expect(await page.evaluate(() => Reflect.get(window, 'scoreMotion').pending())).toBe(0)
})
for (const width of [320, 1440]) test(width + 'px 원본 grid·색·날짜·숫자·44px 및 실제폰트 시각검수', async ({ page }, info) => {
  await page.setViewportSize({ width, height: 950 }); await mount(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.nfxb-hero')).toHaveCSS('background-color', 'rgb(23, 24, 27)')
  expect(await page.locator('.client-user-strategy').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Noto Sans KR Variable')
  const columns = await page.locator('.nfxb-mgrid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(width === 320 ? 1 : 3)
  for (const number of await page.locator('.nfxb-bigval,.nfxl-ev .tm2').all()) await expect(number).toHaveCSS('white-space', 'nowrap')
  if (info.project.name === 'mobile') for (const control of await page.locator('.client-user-strategy button:visible').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  for (const control of await page.locator('.client-user-strategy .nfx-btn:visible').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished)))
  await page.screenshot({ path: info.outputPath('user-strategy-' + width + '.png'), fullPage: true })
})
