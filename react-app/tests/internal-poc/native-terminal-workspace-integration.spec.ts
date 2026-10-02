import { expect, test, type Page } from '@playwright/test'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import { nativeTerminalViewCopy } from '../../src/internal-poc/native-terminal-view-copy'

test.setTimeout(30_000)

function fixture(): NativeAccountPresentation {
  return { scope: 'owner-a', identity: 'dataset-a', sourceLabel: 'SUPPLIED TEST INPUT', accounts: [{ id: 'account', kind: 'account', title: 'Account', sourceLabel: 'TEST', fields: [], sections: [] }],
    ledger: { pos: [], open: [], orders: [], fills: [], closed: [{ id: 'closed', accountId: 'account', strategyId: 'strategy-a', cells: { realized: 'LEGACY_LEDGER' } }], assets: [] },
    strategies: [{ accountId: 'account', strategy: { id: 'strategy-a', name: 'Supplied strategy', version: 'v3', symbol: 'BTC/USDT', market: 'USDT', status: 'off', exchange: { id: 'exchange', name: 'Supplied exchange', color: '#25272b' }, capitalLabel: 'SUPPLIED CAPITAL', pnlLabel: 'SUPPLIED PNL' },
      chart: { identity: 'chart-a', market: 'BTC/USDT', sourceLabel: 'SYNTHETIC TEST BARS', resolutionSeconds: 60, pricePrecision: 2, bars: [{ time: 1800000000, open: 10, high: 12, low: 9, close: 11, volume: 1 }, { time: 1800000060, open: 11, high: 13, low: 10, close: 12, volume: 2 }], fills: [] },
      agent: { events: [], sourceLabel: 'SUPPLIED OBSERVATIONS' }, dashboard: [{ label: 'Additional data', value: 'LEGACY_DASHBOARD' }],
      dashboardPresentation: { sourceLabel: 'SUPPLIED DASHBOARD', summary: { capital: { text: '17.125 TOKEN' }, nav: { text: '18.250 TOKEN' } }, performance: { winRate: { text: 'SUPPLIED 63.15%' } },
        equity: { description: 'Supplied observed points', points: [{ time: 1800000000000, value: 17 }, { time: 1800000060000, value: 18 }] },
        position: { state: 'available', id: 'position-a', symbol: 'BTC/USDT', side: 'LONG', entryPrice: 'SUPPLIED ENTRY' },
        recentTrades: [{ id: 'trade-a', exitDate: 'SUPPLIED DATE', exitReason: 'SUPPLIED EXIT', entryPrice: '10 TOKEN', exitPrice: '11 TOKEN' }] },
      completedPresentation: { sourceLabel: 'SUPPLIED COMPLETED', rangeLabel: 'SUPPLIED PERIOD', trades: [{ id: 'trade-a', exitDate: 'SUPPLIED DATE', exitReason: 'SUPPLIED EXIT', whyEntered: 'PUBLIC ENTRY EVIDENCE', whyExited: 'PUBLIC EXIT EVIDENCE', symbol: 'BTC/USDT', side: 'LONG' }] },
    }] }
}
async function mount(page: Page, mode: 'rich' | 'missing' | 'legacy' = 'rich') {
  await page.route('**/terminal-workspace-integration.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="test-root" style="height:100dvh"></div></body></html>' }))
  await page.goto('/terminal-workspace-integration.html')
  await page.evaluate(async ({ data, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeTradingWorkspace.tsx', pp = '/src/client-preferences.ts', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */skin)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp), { NativeTradingWorkspace } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root'))
    const calls: string[][] = [], selected = data.strategies![0]
    if (mode !== 'rich') { selected.dashboardPresentation = undefined; selected.completedPresentation = undefined }
    if (mode === 'legacy') selected.versionHistory = [{ from: 'v2', to: 'v3', timeLabel: 'SUPPLIED VERSION DATE', by: 'Provider', diff: 'SUPPLIED VERSION DETAILS' }]
    if (mode === 'rich') selected.terminalActions = { onOpenTrade: (id, trigger) => calls.push(['trade', id, String(trigger.isConnected)]), onOpenPosition: (id, trigger) => calls.push(['position', id, String(trigger.isConnected)]), onOpenVersions: trigger => calls.push(['versions', String(trigger.isConnected)]) }
    const render = (owner = 'owner-a', next = data, alertsRequest = 0) => root.render(React.createElement(NativeTradingWorkspace, { accountScope: owner, presentation: next, alertsRequest, onReturn: () => {}, onNew: () => {} }))
    Object.assign(window, { terminalIntegrationCalls: calls, terminalIntegrationRender: render, terminalIntegrationInput: data })
    render()
  }, { data: fixture(), mode })
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
  await expect(page.locator('.cp-surface')).toHaveCount(1)
  await page.evaluate(() => { Reflect.set(window, 'originalChart', document.querySelector('.cp-surface')) })
}
async function show(page: Page, index: number) {
  const detail = page.locator('.ctt-main-tabs [role=tab]').last()
  if (await detail.isVisible()) await detail.click()
  await page.locator('.cat-tabs [role=tab]').nth(index).click()
}

test('실제 workspace의 원본 전용 대시보드·완료·상세 포트는 단일 차트를 보존한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page); await show(page, 1)
  const dashboard = page.locator('[data-native-terminal-dashboard]')
  await expect(dashboard).toContainText('17.125 TOKEN'); await expect(dashboard).toContainText('SUPPLIED 63.15%')
  await expect(page.locator('.cat-brain')).toContainText('LEGACY_DASHBOARD')
  await expect(dashboard.locator('.cst-nav-chart')).toHaveAttribute('data-point-count', '2')
  await dashboard.getByRole('button', { name: '포지션 상세 보기' }).click()
  await dashboard.locator('.cst-trade-link').click(); await dashboard.locator('.cst-versions').click()
  await show(page, 2)
  const completed = page.locator('[data-native-terminal-completed]')
  await expect(completed).toContainText('PUBLIC ENTRY EVIDENCE'); await expect(completed).toContainText('PUBLIC EXIT EVIDENCE')
  await completed.locator('.cst-trade-details').click()
  expect(await page.evaluate(() => Reflect.get(window, 'terminalIntegrationCalls'))).toEqual([['position', 'position-a', 'true'], ['trade', 'trade-a', 'true'], ['versions', 'true'], ['trade', 'trade-a', 'true']])
  const chart = page.locator('.ctt-main-tabs [role=tab]').first(); if (await chart.isVisible()) await chart.click()
  await page.locator('.ctt-bottom-tabs [data-tab-id=closed]').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id=closed]')).toContainText('LEGACY_LEDGER')
  expect(await page.evaluate(() => Reflect.get(window, 'originalChart') === document.querySelector('.cp-surface'))).toBe(true)
  expect(errors).toEqual([])
})

test('전용 데이터가 없으면 미공급 원본 구조이며 임의 값·상세 실행을 만들지 않는다', async ({ page }) => {
  await mount(page, 'missing'); await show(page, 1)
  const dashboard = page.locator('[data-native-terminal-dashboard]')
  await expect(dashboard).toContainText('NAV 관측 데이터가 제공되지 않았습니다.')
  await expect(dashboard.locator('.cst-versions')).toBeDisabled(); await expect(dashboard.locator('.cst-trade-details')).toBeDisabled()
  await expect(dashboard).not.toContainText('17.125 TOKEN')
  await show(page, 2); await expect(page.locator('[data-native-terminal-completed]')).toContainText('아직 공급된 데이터가 없습니다.')
  await expect(page.locator('[data-native-terminal-completed] .cst-trade-details')).toBeDisabled()
})

test('기존 공급 versionHistory의 실제 원본 버전 모달은 호환 유지한다', async ({ page }) => {
  await mount(page, 'legacy'); await show(page, 1)
  await page.locator('.cst-versions').click(); await expect(page.locator('dialog[open]')).toContainText('SUPPLIED VERSION DETAILS')
  await page.locator('dialog[open] [data-cancel]').click()
  await expect(page.locator('.cst-versions')).toBeFocused()
})

test('표시 값이 있어도 상세 콜백을 철회하면 버튼은 비활성화하고 값과 차트는 유지한다', async ({ page }) => {
  await mount(page); await show(page, 1)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'terminalIntegrationInput') as NativeAccountPresentation
    Reflect.get(window, 'terminalIntegrationRender')('owner-a', { ...data, strategies: data.strategies!.map(item => ({ ...item, terminalActions: undefined })) })
  })
  const dashboard = page.locator('[data-native-terminal-dashboard]')
  await expect(dashboard).toContainText('17.125 TOKEN')
  await expect(dashboard.locator('.cst-versions')).toBeDisabled()
  await expect(dashboard.locator('.cst-trade-details')).toBeDisabled()
  await expect(dashboard.locator('.cst-trade-link')).toBeDisabled()
  await show(page, 2); await expect(page.locator('[data-native-terminal-completed] .cst-trade-details')).toBeDisabled()
  expect(await page.evaluate(() => Reflect.get(window, 'originalChart') === document.querySelector('.cp-surface'))).toBe(true)
})

test('owner 교체 시 이전 전략 표시와 CTA는 즉시 제거한다', async ({ page }) => {
  await mount(page); await show(page, 1)
  await page.evaluate(() => Reflect.get(window, 'terminalIntegrationRender')('owner-b'))
  await expect(page.locator('[data-native-terminal-dashboard]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('SUPPLIED DASHBOARD')
  await expect(page.locator('[data-native-terminal-completed]')).toHaveCount(0)
})

test('전역 알림 요청은 기존 알림 패널을 열고 같은 요청값은 선택을 빼앗지 않는다', async ({ page }) => {
  await mount(page)
  const request = (count: number) => page.evaluate(count => Reflect.get(window, 'terminalIntegrationRender')('owner-a', Reflect.get(window, 'terminalIntegrationInput'), count), count)
  await request(1)
  await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]')).toBeVisible()
  const chart = page.locator('.ctt-main-tabs [role=tab]').first(); if (await chart.isVisible()) await chart.click()
  await page.locator('.ctt-bottom-tabs [data-tab-id=pos]').click()
  await request(1); await expect(page.locator('.ctt-bottom-pane[data-tab-id=pos]')).toBeVisible()
  await request(2); await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'terminalIntegrationRender')('owner-b'))
  await request(3); await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]')).toBeVisible()
})

test('전략 데이터 미공급이어도 계정 알림은 첫 mount와 후속 요청에서 독립 표시한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'terminalIntegrationInput') as NativeAccountPresentation
    const next = { ...data, identity: 'notifications-only', strategies: null, accounts: null, ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null }, notifications: [{ id: 'one', type: 'review', title: '공급된 미확인 알림', read: false, timeLabel: '공급된 시각' }] }
    Reflect.set(window, 'notificationsOnlyInput', next)
    Reflect.get(window, 'terminalIntegrationRender')('owner-a', next, 1)
  })
  await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]')).toBeVisible()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]').getByRole('button', { name: /공급된 미확인 알림/ })).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'terminalIntegrationRender')('owner-a', Reflect.get(window, 'notificationsOnlyInput'), 2))
  await expect(page.locator('.ctt-bottom-pane[data-tab-id=alerts]').getByRole('button', { name: /공급된 미확인 알림/ })).toBeVisible()
})

test('7개 언어·320px 탭 이동에서 원본 바디를 유지하고 전체 가로 넘침이 없다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => { const p = '/src/client-preferences.ts'; (await import(/* @vite-ignore */p)).setClientPreference('language', language) }, language)
    await show(page, 1)
    await expect(page.locator('[data-native-terminal-dashboard]')).toContainText(nativeTerminalViewCopy(language, 'currentPosition'))
    await expect(page.locator('.cst-versions')).toHaveText(nativeTerminalViewCopy(language, 'versionHistory', { version: 'v3' }))
    await show(page, 2); await expect(page.locator('[data-native-terminal-completed]')).toContainText(nativeTerminalViewCopy(language, 'whyEntered'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await show(page, 1); await page.screenshot({ path: info.outputPath('terminal-integration-320.png'), fullPage: true })
  expect(await page.evaluate(() => Reflect.get(window, 'originalChart') === document.querySelector('.cp-surface'))).toBe(true)
})
