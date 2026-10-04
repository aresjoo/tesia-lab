import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, controlled = true, shell = false, withRows = true, bootstrap = false, open = true) {
  await page.route('**/strategy-view-state.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="fixture"></div></body></html>' }))
  await page.goto(`/strategy-view-state.html${bootstrap ? '#/share/s/supplied-author' : ''}`)
  await page.evaluate(async ({ controlled, shell, withRows, bootstrap }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/src/styles.css', '/src/client-reference.css', '/node_modules/@fontsource-variable/noto-sans-kr/wght.css']) await import(/* @vite-ignore */path)
    const path = shell ? '/src/internal-poc/ClientServiceExperience.tsx' : '/src/internal-poc/NativeStrategies.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React')
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dp = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */dp), NativeStrategies = shell ? null : (await import(/* @vite-ignore */path)).NativeStrategies
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx', Shell = shell ? (await import(/* @vite-ignore */shellPath)).ClientServiceExperience : null
    const pp = '/src/client-preferences.ts'; (await import(/* @vite-ignore */pp)).setClientPreference('language', 'ko')
    const h = React.createElement
    // Explicit display fixtures, not backend producer or approval evidence.
    const parameters = { sl: -4, tp: 10, rsiTh: 31, trendFilter: false, startI: 0, endI: 40 }
    const result = { params: parameters, eq: [{ i: 0, v: 1 }, { i: 1, v: 1.03 }, { i: 2, v: 1.02 }, { i: 3, v: 1.123 }], trades: [{ entry: 0, exit: 1, pnl: .03, kind: 'tp', lowVol: false }, { entry: 2, exit: 3, pnl: .09, kind: 'time', lowVol: false }], ret: 12.3, mdd: -1, winRate: 100, n: 2, pf: 4, byYear: { '2031': { prod: 1.123, pnl: .123, n: 2, w: 2 } }, worstYear: '2031', bestYear: '2031', worstYearPnl: 12.3, bestYearPnl: 12.3, mddStartI: 1, mddEndI: 2, underwaterDays: 1, cagr: 12, sharpe: 1, sortino: 1, calmar: 1, exposure: 50, tradeVol: 1, avgHold: 1, lossCount: 0, lowVolLosses: 0, lowVolLossShare: 0, costImpact: .2 }
    const denseResult = { ...result, eq: Array.from({ length: 41 }, (_, i) => ({ i, v: 1 + .123 * i / 40 })) }
    const row = { kind: 'rule', market: 'crypto', nick: 'supplied-author', title: '공급된 전략', asset: '비트코인', score: 88, followers: 17, parameters, result: denseResult, description: '표시 입력 검증용 전략' }
    const secondRow = { ...row, nick: 'sort-order-second', title: '방향 검증 전략', result: { ...denseResult, ret: 6.1, eq: Array.from({ length: 41 }, (_, i) => ({ i, v: 1 + .061 * i / 40 })) } }
    const account = { id: 'owner-a-copy', nick: row.nick, status: 'active', startedAt: Date.UTC(2031, 0, 1), asset: 'USDC', pairs: ['BTC/USDT'], sharePercent: 7, metrics: null, invested: null, recovered: null, returnPercent: null }
    function Host() {
      const [visible, setVisible] = React.useState(true), [owner, setOwner] = React.useState(bootstrap ? null : 'owner-a'), [identity, setIdentity] = React.useState('dataset-a'), [revision, setRevision] = React.useState(0)
      const [view, setView] = React.useState(null), [supplied, setSupplied] = React.useState(true)
      // Mirrors shell ownership: discard on account/dataset/loss, not ordinary data refresh.
      const boundView = supplied && view?.owner === owner && view?.datasetIdentity === identity ? view : null
      if (view && !boundView) setView(null)
      Object.assign(window, { strategySetOwner: setOwner, strategySetIdentity: setIdentity, strategyRefresh: () => setRevision((value: number) => value + 1), strategySupply: setSupplied, strategyView: view, strategyInjectView: setView })
      const presentation = supplied ? { state: 'ready', message: String(revision), strategies: withRows ? [row, secondRow] : [], watched: [], periodResult: (strategy: typeof row) => withRows ? strategy.result : null, indexToDate: (i: number) => new Date(Date.UTC(2031, 0, 1 + i)), follows: { state: 'ready', rows: [] },
        ...(withRows ? { setup: { asset: 'USDC', availableBalance: 777, minimumAmount: 50, pairs: ['BTC/USDT'], sharePercent: 7 }, copyAccounts: { asset: 'USDC', activeCount: 1, metrics: null, accounts: { state: 'ready', rows: [account] } } } : {}),
      } : undefined
      if (shell) return h(Shell, { nativeAccounts: true, accountScope: owner, sharingPresentation: presentation ? { scope: owner, identity, data: presentation } : undefined,
        state: { phase: 'ready', sessionState: owner ? 'AUTHENTICATED' : 'ANONYMOUS', messages: [{ id: 'one', role: 'user', text: '기존 대화' }], input: '', busy: false, inputDisabled: false,
          source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
          onInput: () => {}, onSend: async () => {}, onReset: async () => {}, onRecover: undefined, onLogout: undefined } })
      return h('main', { className: 'client-shell', style: { minHeight: '100dvh' } }, h('button', { onClick: () => setVisible((value: boolean) => !value) }, visible ? '다른 화면 열기' : '전략 공유 복귀'), visible && h(NativeStrategies, {
        owner, datasetIdentity: identity, viewState: controlled ? boundView : undefined, onViewStateChange: controlled ? setView : undefined,
        onReturn: () => setVisible(false), shouldFocus: () => false, onTabChange: () => {}, executionContent: h('p', null, '공급된 내 전략 영역'),
        presentation,
      }))
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, { controlled, shell, withRows, bootstrap })
  if (shell && !bootstrap && open) await openSharing(page)
  if (shell && !open) { await expect(page.locator('.g-thread')).toBeVisible(); return }
  await expect(page.locator('.native-strategies')).toBeVisible()
}
const surface = (page: Page) => page.locator('.native-strategies')
const tabs = (page: Page) => surface(page).locator('.ss3-tabs button')
async function assertPublicFallback(page: Page) {
  // Source 9fbff821:index.html:24605 removes public catalogue tabs. The
  // deployed fa8601e NativeStrategies also selects this renderer on supply loss.
  await expect(surface(page).locator('[data-public-catalogue]')).toBeVisible()
  await expect(tabs(page)).toHaveCount(0)
  await expect(surface(page).locator('.strategy-list-link').first()).toBeVisible()
  const sort = surface(page).getByRole('combobox', { name: '정렬 기준', exact: true })
  await expect(sort).toHaveValue('pick')
  // This Playwright version retargets an option inside a label to its select
  // for toBeDisabled; inspect the real options and native keyboard behavior.
  for (const value of ['ret', 'fw']) {
    const option = sort.locator(`option[value="${value}"]`)
    await expect(option).toHaveAttribute('disabled', '')
    await expect(option).toHaveJSProperty('disabled', true)
  }
  await expect(sort).toBeEnabled()
  await test.info().attach('unavailable-sort-options', { contentType: 'application/json', body: JSON.stringify(await sort.evaluate(element => ({
    disabled: (element as HTMLSelectElement).disabled, ariaDisabled: element.getAttribute('aria-disabled'),
    options: Array.from((element as HTMLSelectElement).options, option => ({ value: option.value, disabled: option.disabled, ariaDisabled: option.getAttribute('aria-disabled') })),
  }))) })
  await sort.focus(); await page.keyboard.press('ArrowDown')
  await expect(sort).toHaveValue('pick')
  await expect(surface(page).getByRole('link', { name: '공급된 전략', exact: true })).toHaveCount(0)
  await expect(surface(page).locator('.cpx, .cps-wrap')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'strategyView'))).toBeNull()
}
async function openSharing(page: Page) {
  const menu = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true })
  if (!(await menu.isVisible())) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  await menu.click()
  await expect(surface(page)).toBeVisible()
}
async function choices(page: Page) {
  await surface(page).getByRole('searchbox').fill('입력 중인 전략')
  // Final source index.html:24647–24648 exposes pick/ret/fw only.
  const sort = surface(page).getByRole('combobox', { name: '정렬 기준', exact: true })
  await sort.selectOption('ret'); await sort.selectOption('ret')
  await surface(page).getByRole('button', { name: /^시장:/ }).click()
  await page.getByRole('option', { name: '가상자산', exact: true }).click()
}
async function assertReturnSort(page: Page) {
  await expect(surface(page).getByRole('combobox', { name: '정렬 기준', exact: true })).toHaveValue('ret')
  const input = surface(page).getByRole('searchbox'), draft = await input.inputValue()
  await input.fill('')
  // Test actual supplied daily evidence order, including uncontrolled consumers.
  await expect(surface(page).locator('.skf-nm h3')).toHaveText(['방향 검증 전략', '공급된 전략'])
  await input.fill(draft)
}
async function roundtrip(page: Page) {
  await page.getByRole('button', { name: '다른 화면 열기', exact: true }).click()
  await expect(surface(page)).toHaveCount(0)
  await page.getByRole('button', { name: '전략 공유 복귀', exact: true }).click()
}

test('다른 화면 왕복 후 원본 탭·검색·정렬방향·자산 선택을 유지한다', async ({ page }) => {
  await mount(page); await choices(page)
  await tabs(page).nth(1).click(); await roundtrip(page)
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
  await tabs(page).nth(2).click(); await roundtrip(page)
  await expect(tabs(page).nth(2)).toHaveAttribute('aria-pressed', 'true')
  await tabs(page).nth(0).click()
  await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
  await assertReturnSort(page)
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('가상자산')
})

test('row 갱신은 유지하고 owner·dataset·공급 소멸 뒤에는 이전 선택을 폐기한다', async ({ page }) => {
  await mount(page); await choices(page)
  await page.evaluate(() => Reflect.get(window, 'strategyRefresh')())
  await roundtrip(page)
  await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
  for (const [action, value] of [['strategySetOwner', 'owner-b'], ['strategySetIdentity', 'dataset-b'], ['strategySupply', false]] as const) {
    await tabs(page).nth(1).click()
    await page.evaluate(({ action, value }) => Reflect.get(window, action)(value), { action, value })
    if (action === 'strategySupply') await assertPublicFallback(page)
    else await expect(tabs(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(surface(page).getByRole('searchbox')).toHaveValue('')
    await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('시장 전체')
  }
  await page.evaluate(() => Reflect.get(window, 'strategySupply')(true)); await roundtrip(page)
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(surface(page).getByRole('searchbox')).toHaveValue('')
  await expect(surface(page).getByRole('combobox', { name: '정렬 기준', exact: true })).toHaveValue('pick')
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('시장 전체')
})

test('controlled 미사용도 dataset 교체는 초안을 폐기하고 기본 호환을 유지한다', async ({ page }) => {
  await mount(page, false); await choices(page)
  await page.evaluate(() => Reflect.get(window, 'strategyRefresh')())
  await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
  await page.evaluate(() => Reflect.get(window, 'strategySetIdentity')('dataset-other'))
  await expect(surface(page).getByRole('searchbox')).toHaveValue('')
})

for (const controlled of [true, false]) test(`필터 초기화는 검색과 자산을 함께 비우고 정렬은 유지한다 controlled=${controlled}`, async ({ page }) => {
  await mount(page, controlled); await choices(page)
  await surface(page).getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(surface(page).getByRole('searchbox')).toHaveValue('')
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('시장 전체')
  await assertReturnSort(page)
})

test('7언어·320px·키보드 왕복에서도 값이 보존되고 저장소를 쓰지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page); await choices(page)
  const before = await page.evaluate(() => ({ local: Object.keys(localStorage).filter(key => /sharing|copy/.test(key)), session: Object.keys(sessionStorage).filter(key => /sharing|copy/.test(key)) }))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const pp = '/src/client-preferences.ts'; (await import(/* @vite-ignore */pp)).setClientPreference('language', language) }, language)
    await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
    await tabs(page).nth(1).focus(); await page.keyboard.press('Enter'); await roundtrip(page)
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
    await tabs(page).nth(0).focus(); await page.keyboard.press('Space')
    await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage).filter(key => /sharing|copy/.test(key)), session: Object.keys(sessionStorage).filter(key => /sharing|copy/.test(key)) }))).toEqual(before)
})

test('실제 서비스 셸의 대화 왕복·행 갱신은 선택을 유지하고 계정·dataset·미공급은 폐기한다', async ({ page }) => {
  await mount(page, true, true); await choices(page); await tabs(page).nth(1).click()
  await surface(page).locator('.hub-header button').click()
  await expect(surface(page)).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'strategyRefresh')())
  await openSharing(page)
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
  await tabs(page).nth(0).click()
  await expect(surface(page).getByRole('searchbox')).toHaveValue('입력 중인 전략')
  await assertReturnSort(page)
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('가상자산')
  for (const [action, value] of [['strategySetIdentity', 'dataset-b'], ['strategySetOwner', 'owner-b'], ['strategySupply', false]] as const) {
    await surface(page).getByRole('searchbox').fill('폐기할 검색')
    await tabs(page).nth(1).click()
    await page.evaluate(({ action, value }) => Reflect.get(window, action)(value), { action, value })
    if (!(await surface(page).isVisible())) await openSharing(page)
    if (action === 'strategySupply') await assertPublicFallback(page)
    else await expect(tabs(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(surface(page).getByRole('searchbox')).toHaveValue('')
    await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('시장 전체')
  }
  // Public exploration remains usable without private tabs or fabricated data;
  // these local choices must not revive the removed producer's view snapshot.
  await surface(page).getByRole('searchbox').fill('존재하지 않는 공개 검색')
  await expect(surface(page).locator('.strategy-list-link')).toHaveCount(0)
  await surface(page).getByRole('searchbox').fill('')
  await surface(page).getByRole('button', { name: /^시장:/ }).click()
  await page.getByRole('option', { name: '가상자산', exact: true }).click()
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('가상자산')
  await expect(surface(page).locator('.strategy-list-link').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'strategyView'))).toBeNull()
  await page.evaluate(() => Reflect.get(window, 'strategySupply')(true))
  await expect(tabs(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(surface(page).getByRole('searchbox')).toHaveValue('')
  await expect(surface(page).getByRole('combobox', { name: '정렬 기준', exact: true })).toHaveValue('pick')
  await expect(surface(page).getByRole('button', { name: /^시장:/ })).toContainText('시장 전체')
})

test('공급 전략 상세와 허브 왕복은 새 제목에 키보드 초점을 옮긴다', async ({ page }) => {
  await mount(page, true, true, true)
  await surface(page).getByRole('link', { name: '공급된 전략', exact: true }).click()
  await expect(surface(page).locator('.ss3-dtitle')).toBeFocused()
  await surface(page).locator('.tfbk-bc button').click()
  await expect(surface(page).locator('.hub-header h1')).toBeFocused()
})

test('카피 설정 및 실제 공급 카피 상세 진입은 native 제목에 초점을 옮긴다', async ({ page }) => {
  await mount(page, true, true, true)
  await surface(page).getByRole('link', { name: '공급된 전략', exact: true }).click()
  await surface(page).locator('.shared-detail-profile').click()
  await surface(page).getByRole('button', { name: '카피하기', exact: true }).click()
  await expect(surface(page).locator('.cps-wrap')).toBeVisible()
  await expect(surface(page).locator('.hub-header h1')).toBeFocused()
  await surface(page).locator('.cpp > .ss3-back').click()
  await surface(page).locator('.cpp > .ss3-back').click()
  await tabs(page).nth(1).click()
  await surface(page).getByRole('button', { name: '상세', exact: true }).click()
  await expect(surface(page).locator('.cpx')).toBeVisible()
  await expect(surface(page).locator('.hub-header h1')).toBeFocused()
})

for (const loss of ['dataset', 'supply', 'owner'] as const) test(`상세 라우트는 ${loss} 변경 시 이전 copyId와 URL을 폐기한다`, async ({ page }) => {
  await mount(page, true, true, true); await tabs(page).nth(1).click()
  await surface(page).getByRole('button', { name: '상세', exact: true }).click()
  await expect(page).toHaveURL(/#\/share\/c\/owner-a-copy$/)
  if (loss === 'dataset') await page.evaluate(() => Reflect.get(window, 'strategySetIdentity')('dataset-b'))
  if (loss === 'supply') await page.evaluate(() => Reflect.get(window, 'strategySupply')(false))
  if (loss === 'owner') await page.evaluate(() => Reflect.get(window, 'strategySetOwner')('owner-b'))
  await expect(page).not.toHaveURL(/owner-a-copy/)
  if (!(await surface(page).isVisible())) await openSharing(page)
  await expect(surface(page).locator('.tfbk-filters')).toBeVisible()
  await expect(surface(page).locator('.cpx')).toHaveCount(0)
})

test('초기 비인증 deep link는 동일 진입의 첫 계정 공급 때 보존된다', async ({ page }) => {
  await mount(page, true, true, true, true)
  await expect(page).toHaveURL(/#\/share\/s\/supplied-author$/)
  await page.evaluate(() => Reflect.get(window, 'strategySetOwner')('owner-a'))
  await expect(page).toHaveURL(/#\/share\/s\/supplied-author$/)
  await expect(surface(page).locator('.ss3-dtitle')).toContainText('공급된 전략')
})

test('느린 공유화면 로딩 중 다른 키보드 조작을 하면 도착 제목이 초점을 탈취하지 않는다', async ({ page }) => {
  await mount(page, true, true, true, false, false)
  let release!: () => void, requested = false
  const hold = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/internal-poc/NativeStrategies.tsx', async route => { requested = true; await hold; await route.continue() })
  try {
    const menu = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'sharing'), exact: true })
    if (!(await menu.isVisible())) await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
    await menu.click(); await expect.poll(() => requested).toBe(true)
    await page.locator('.client-account-utility button').focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('.client-account-utility button')).toBeFocused()
    await page.evaluate(() => Reflect.set(window, 'strategyFocusBeforeArrival', document.activeElement))
    release(); await expect(surface(page)).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.activeElement === Reflect.get(window, 'strategyFocusBeforeArrival'))).toBe(true)
    await expect(surface(page).locator('.hub-header h1')).not.toBeFocused()
  } finally { release(); await page.unroute('**/src/internal-poc/NativeStrategies.tsx') }
})
