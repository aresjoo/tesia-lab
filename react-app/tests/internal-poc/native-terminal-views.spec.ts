import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
async function mount(page: Page, supplied = true) {
  await page.route('**/terminal-view-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><main id="fixture"></main></body></html>' }))
  await page.goto('/terminal-view-fixture.html')
  await page.evaluate(async supplied => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const path = '/src/internal-poc/NativeTerminalViews.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeTerminalDashboard, NativeTerminalCompleted } = await import(/* @vite-ignore */ path)
    const prefs = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ prefs)
    const start = Date.UTC(2024, 8, 18)
    const initialEquity = { description: '공급한 관측 NAV · USD', rangeLabel: '2024-09-18 → 2026-09-17', points: [
      { time: start, value: 10123.456, valueLabel: '10,123.456 USD', timeLabel: '2024-09-18 00:00 UTC' },
      { time: start + 86400000, value: 9876.123, valueLabel: '9,876.123 USD', timeLabel: '2024-09-19 00:00 UTC' },
      { time: start + 86400000 * 400, value: 10543.21, valueLabel: '10,543.210 USD', timeLabel: '관측 시각 3' },
      { time: start + 86400000 * 729, value: 10789.125, valueLabel: '10,789.125 USD', timeLabel: '2026-09-17 00:00 UTC' },
    ], tone: 'up', baseline: 10000 }
    const trades = Object.freeze(Array.from({ length: 30 }, (_, i) => Object.freeze({ id: `trade-${i}`, exitDate: `공급 청산일 ${i}`, exitReason: `공급 사유 ${i}`, entryPrice: '101.005 USDC', exitPrice: '103.125 USDC', holding: '17분 31초', pnl: { text: '+2.120 USDC', tone: 'up' }, side: i % 2 ? 'SHORT' : 'LONG', symbol: 'BTC/USDC', pnlPercent: { text: '+2.099%' }, fee: '0.01459 USDC', entryDate: `공급 진입일 ${i}`, whyEntered: `공급된 진입 근거 ${i}`, whyExited: `공급된 청산 근거 ${i}` })))
    const calls: unknown[] = []
    const data = { sourceLabel: '서버에서 공급한 범위', summary: { capital: { text: '10,000.00 USD' }, nav: { text: '10,789.125 USD' }, totalPnl: { text: '+789.125 USD', tone: 'up' }, totalPnlPercent: { text: '+7.89125%' }, realized: { text: '+800.125 USD', tone: 'up' }, unrealized: { text: '−11.00 USD', tone: 'dn' }, fees: { text: '12.371 USD' }, feeDescription: '공급된 실제 비용 설명' }, performance: { winRate: { text: '57.125% (457W / 343L)' }, drawdown: { text: '−8.127%', tone: 'dn' }, profitFactor: { text: '1.321' }, sharpe: { text: '1.246' }, averageHolding: { text: '31.7분' }, marketExposure: { text: '47.325%' }, tradeCount: { text: '800회' }, maxGain: { text: '+371.129 USD', tone: 'up' }, maxLoss: { text: '−126.743 USD', tone: 'dn' } }, position: { state: 'available', id: 'position-actual', side: 'SHORT', symbol: 'ETH/USDC', entryPrice: '2,100.125 USDC', currentPrice: '2,098.00 USDC', quantity: '0.012345 ETH', stopPrice: '2,123.00 USDC', targetPrice: '2,080.00 USDC', holding: '31분 2초', pnl: { text: '+0.02623 USDC', tone: 'up' }, pnlPercent: { text: '+0.1012%' } }, recentTrades: trades }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [tab, setTab] = react.useState('dashboard'), [equity, setEquity] = react.useState(initialEquity), [empty, setEmpty] = react.useState(false), [callbacks, setCallbacks] = react.useState(supplied)
      Object.assign(window, { terminalOwner: setOwner, terminalTab: setTab, terminalEquity: setEquity, terminalEmpty: setEmpty, terminalCallbacks: setCallbacks, terminalCalls: calls, terminalLanguage: (language: string) => setClientPreference('language', language) })
      const shared = { scopeId: owner, strategyId: 'strategy-a', strategyName: '공급된 전략명', onOpenTrade: callbacks ? (id: string, trigger: HTMLElement) => calls.push(['trade', id, trigger.tagName]) : undefined }
      return h('section', { className: 'client-restored-research client-source-terminal', style: { maxWidth: '740px', margin: 'auto' } },
        h('div', { hidden: tab !== 'dashboard' }, h(NativeTerminalDashboard, { ...shared, version: 'v17.4', data: supplied ? { ...data, equity, recentTrades: empty ? [] : trades, position: empty ? { state: 'empty' } : data.position } : null, onOpenPosition: callbacks ? (id: string, trigger: HTMLElement) => calls.push(['position', id, trigger.tagName]) : undefined, onOpenVersions: callbacks ? (trigger: HTMLElement) => calls.push(['versions', trigger.tagName]) : undefined })),
        h('div', { hidden: tab !== 'completed' }, h(NativeTerminalCompleted, { ...shared, data: supplied ? { sourceLabel: '공급한 완료 거래 기록', rangeLabel: '전체 800건 · 이 페이지 최근 거래', trades: empty ? [] : trades } : null })))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Host))
  }, supplied)
  await expect(page.locator('[data-native-terminal-dashboard]')).toBeVisible(); await page.evaluate(() => document.fonts.ready)
}

test('원본 dashboard 자금5개·성과8개·현재포지션·최근25개가 공급값 그대로 표시된다', async ({ page }, info) => {
  const errors: string[] = [], forbidden: string[] = []
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/client-terminal-source-fixture|client-delegation-fixture/.test(request.url())) forbidden.push(request.url()) })
  await mount(page)
  const dashboard = page.locator('[data-native-terminal-dashboard]')
  await expect(dashboard.locator(':scope > .cst-matrix').first().locator('[data-metric]')).toHaveCount(5)
  await expect(dashboard.locator(':scope > .cst-matrix.compact [data-metric]')).toHaveCount(8)
  await expect(dashboard.locator('[data-metric=winRate]')).toHaveText('승률57.125% (457W / 343L)')
  await expect(dashboard.locator('[data-metric=feeCaption]')).toContainText('공급된 실제 비용 설명12.371 USD')
  await expect(dashboard.locator('[data-metric=maxGainLoss]')).toContainText('+371.129 USD / −126.743 USD')
  await expect(dashboard.locator('.cst-position')).toContainText('SHORT'); await expect(dashboard.locator('.cst-position [data-metric=quantity]')).toContainText('0.012345 ETH')
  await expect(dashboard.locator('tbody tr')).toHaveCount(25); await expect(dashboard.locator('tbody tr').first()).toHaveAttribute('data-trade-id', 'trade-0'); await expect(dashboard.locator('tbody tr').last()).toHaveAttribute('data-trade-id', 'trade-24')
  await expect(page.getByRole('button', { name: '버전 기록 보기 (v17.4)' })).toBeVisible()
  await expect(dashboard).not.toContainText(/왕복 0\.2%|시뮬레이션|추정|진입 조건 충족|청산 규칙 실행/)
  expect(errors).toEqual([]); expect(forbidden).toEqual([])
  await page.screenshot({ path: info.outputPath('dashboard-supplied.png'), fullPage: true })
})

test('거래행·키보드·포지션·버전 동선이 정확한 ID와 trigger를 전달한다', async ({ page }) => {
  await mount(page)
  await page.locator('.cst-table tbody tr').first().locator('td').nth(1).click()
  await page.getByRole('button', { name: '공급 청산일 1 거래 추적', exact: true }).focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '포지션 상세 보기' }).click(); await page.getByRole('button', { name: '버전 기록 보기 (v17.4)' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual([['trade', 'trade-0', 'BUTTON'], ['trade', 'trade-1', 'BUTTON'], ['position', 'position-actual', 'BUTTON'], ['versions', 'BUTTON']])
  await page.evaluate(() => Reflect.get(window, 'terminalCallbacks')(false)); await expect(page.getByRole('button', { name: '포지션 상세 보기' })).toBeDisabled(); await expect(page.getByRole('button', { name: '공급 청산일 0 거래 추적', exact: true })).toBeDisabled()
})

test('완료 거래12개에 원본 상세4지표·공급 판단 원문을 유지하고 원인 생성 없이 연결한다', async ({ page }, info) => {
  await mount(page); await page.evaluate(() => Reflect.get(window, 'terminalTab')('completed'))
  const completed = page.locator('[data-native-terminal-completed]')
  await expect(completed.locator('.cst-completed-trade')).toHaveCount(12); await expect(completed).toContainText('전체 800건 · 이 페이지 최근 거래')
  await expect(completed.locator('.cst-completed-trade').first().locator('[data-metric]')).toHaveCount(4)
  await expect(completed.locator('.cst-completed-trade').first()).toContainText('WHY ENTERED공급된 진입 근거 0'); await expect(completed.locator('.cst-completed-trade').first()).toContainText('WHY EXITED공급된 청산 근거 0'); await expect(completed).toContainText('0.01459 USDC')
  await completed.getByRole('button', { name: '전체 판단 기록 →', exact: true }).nth(2).click(); expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual([['trade', 'trade-2', 'BUTTON']])
  await page.screenshot({ path: info.outputPath('completed-supplied.png'), fullPage: true })
})

test('미공급은 0이나 가짜 빈계좌가 아니며 확인된 빈목록은 원본 empty와 구분한다', async ({ page }) => {
  await mount(page, false)
  const dashboard = page.locator('[data-native-terminal-dashboard]')
  await expect(dashboard.locator(':scope > .cst-matrix.compact [data-metric]')).toHaveCount(8); await expect(dashboard.locator('.cst-position [data-metric]')).toHaveCount(6); await expect(dashboard.locator('thead th')).toHaveCount(6)
  await expect(dashboard).not.toContainText(/0회|0%|현재 포지션이 없습니다|LONG|KRW|USDT|진입 신호|실행 중이 아니/); await expect(dashboard.locator('button:enabled')).toHaveCount(0); await expect(dashboard.locator('svg')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'terminalTab')('completed')); const completed = page.locator('[data-native-terminal-completed]'); await expect(completed.locator('[data-metric]')).toHaveCount(4); await expect(completed).toContainText('WHY ENTERED—'); await expect(completed).not.toContainText('완료된 거래가 없어요')
  await mount(page); await page.evaluate(() => Reflect.get(window, 'terminalEmpty')(true)); await expect(page.getByText('현재 포지션이 없습니다.', { exact: true })).toBeVisible(); await expect(page.getByText('이 구간 체결이 없어요', { exact: true })).toBeVisible(); await page.evaluate(() => Reflect.get(window, 'terminalTab')('completed')); await expect(page.getByText('완료된 거래가 없어요', { exact: true })).toBeVisible()
})

test('NAV 실제 관측 선택·원본 SVG·탭 왕복·언어변경이 같은 노드를 보존한다', async ({ page }) => {
  await mount(page)
  const svg = page.locator('.cst-nav-chart svg'); await expect(svg).toHaveAccessibleName(/NAV 곡선.*공급한 관측 NAV/)
  await svg.evaluate(node => Reflect.set(window, 'originalNav', node)); await svg.focus(); await page.keyboard.press('End'); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('10,789.125 USD')
  await page.evaluate(() => Reflect.get(window, 'terminalTab')('completed')); await page.evaluate(() => Reflect.get(window, 'terminalTab')('dashboard')); await page.evaluate(() => Reflect.get(window, 'terminalLanguage')('en'))
  expect(await svg.evaluate(node => node === Reflect.get(window, 'originalNav'))).toBe(true); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('Observed NAV 10,789.125 USD')
  await svg.focus(); await page.keyboard.press('Home'); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('10,123.456 USD'); await page.keyboard.press('ArrowRight'); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('9,876.123 USD')
  await page.evaluate(() => Reflect.get(window, 'terminalOwner')('owner-b')); await expect.poll(() => svg.evaluate(node => node === Reflect.get(window, 'originalNav'))).toBe(false); await expect(page.locator('.cst-nav-chart [aria-live]')).not.toContainText('9,876.123 USD')
})

test('NAV single/empty/NaN/역순을 안전하게 처리하고 dense points를 bounded SVG로만 투영한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => Reflect.get(window, 'terminalEquity')({ description: '단일 실제 관측', points: [{ time: 1700000000000, value: 17.125, valueLabel: '17.125 USDC' }] })); await expect(page.locator('circle[data-observation=single]')).toHaveCount(1); await expect(page.locator('.cst-nav-chart svg')).not.toContainText(/NaN|Infinity/)
  await expect(page.locator('circle[data-observation=single]')).toHaveAttribute('cy', '68')
  await page.evaluate(() => Reflect.get(window, 'terminalEquity')({ description: '동일한 실제 관측', points: [{ time: 1700000000000, value: 17.125 }, { time: 1700000060000, value: 17.125 }] })); await expect(page.locator('.cst-nav-chart polyline')).toHaveAttribute('points', '0.00,68.00 700.00,68.00'); await expect(page.locator('.cst-nav-chart .base')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'terminalEquity')({ description: '확인된 빈 관측', points: [] })); await expect(page.getByText('곡선 데이터가 없어요', { exact: true })).toBeVisible()
  for (const invalid of ['nan', 'reverse', 'same', 'overflow']) {
    await page.evaluate(kind => Reflect.get(window, 'terminalEquity')({ description: '잘못된 입력', points: kind === 'nan' ? [{ time: 1700000000000, value: NaN }] : kind === 'reverse' ? [{ time: 1700000000001, value: 2 }, { time: 1700000000000, value: 1 }] : kind === 'same' ? [{ time: 1700000000000, value: 1 }, { time: 1700000000000, value: 2 }] : [{ time: 1700000000000, value: -Number.MAX_VALUE }, { time: 1700000000001, value: Number.MAX_VALUE }] }), invalid)
    await expect(page.getByText('NAV 관측 데이터를 표시할 수 없습니다.', { exact: true })).toBeVisible(); await expect(page.locator('.cst-nav svg')).toHaveCount(0)
  }
  await page.evaluate(() => Reflect.get(window, 'terminalEquity')({ description: '10만 실제 공급 관측 fixture', points: Array.from({ length: 100000 }, (_, i) => ({ time: 1700000000000 + i * 60000, value: i === 51234 ? 50000 : 1000 + i % 20 })), tone: 'up' }))
  await expect(page.locator('.cst-nav-chart')).toHaveAttribute('data-point-count', '100000'); expect(Number(await page.locator('.cst-nav-chart').getAttribute('data-rendered-points'))).toBeLessThanOrEqual(482)
  const points = await page.locator('.cst-nav-chart polyline').getAttribute('points'); expect(points).not.toMatch(/NaN|Infinity/); expect(points).toContain(',6.00')
})

test('7언어·320px에서 모든 숫자·원문과 표 내부 스크롤을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'terminalLanguage')(language), language)
    await expect(page.locator('[data-metric=capital]')).toContainText('10,000.00 USD'); await expect(page.locator('[data-metric=winRate]')).toContainText('57.125% (457W / 343L)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${language} dashboard`).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'terminalTab')('completed')); await expect(page.locator('.cst-completed-trade').first()).toContainText('공급된 진입 근거 0'); expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `${language} completed`).toBe(false)
    await page.evaluate(() => Reflect.get(window, 'terminalTab')('dashboard'))
  }
  await expect(page.locator('.cst-table')).toHaveJSProperty('scrollLeft', 0); await page.locator('.cst-table').evaluate(node => { node.scrollLeft = 200 }); expect(await page.locator('.cst-table').evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath('terminal-320-fr.png'), fullPage: true })
})

test('원시 긴 관측라벨·정밀수치와 point 교체는 이전 선택을 혼합하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  await page.locator('.cst-nav-chart svg').focus(); await page.keyboard.press('End'); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('10,789.125 USD')
  await page.evaluate(() => Reflect.get(window, 'terminalEquity')({ description: '다른 공급 기간', startLabel: '긴공급관측라벨'.repeat(25), endLabel: '2026-09-18 09:00:00 UTC', points: [{ time: 1700000000000, value: 0.000000125, valueLabel: '0.000000125 BTC' }, { time: 1700000060000, value: 0.000000126, valueLabel: '0.000000126 BTC' }] }))
  await expect(page.locator('.cst-nav-chart [aria-live]')).not.toContainText('10,789.125 USD'); await page.locator('.cst-nav-chart svg').focus(); await page.keyboard.press('End'); await expect(page.locator('.cst-nav-chart [aria-live]')).toContainText('0.000000126 BTC')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
})
