import { expect, test, type Page } from '@playwright/test'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import { lifecycleText } from '../../src/client-trade-lifecycle-copy'

test.setTimeout(25_000)

function fixture(): NativeAccountPresentation {
  return {
    scope: 'owner-a', identity: 'dataset-a', sourceLabel: 'SUPPLIED TEST DATA',
    accounts: [{ id: 'account', kind: 'account', title: 'Supplied account', sourceLabel: 'TEST', fields: [], sections: [] }],
    ledger: { pos: [], open: [], orders: [], fills: [], closed: [], assets: [] },
    strategies: [{ accountId: 'account', strategy: { id: 'strategy-a', name: 'Supplied strategy', version: 'v3', symbol: 'BTC/USDT', market: 'USDT', status: 'off', exchange: { id: 'exchange', name: 'Supplied exchange', color: '#25272b' }, capitalLabel: 'SUPPLIED CAPITAL', pnlLabel: 'SUPPLIED PNL' },
      chart: { identity: 'chart-a', market: 'BTC/USDT', sourceLabel: 'SYNTHETIC TEST BARS', resolutionSeconds: 60, pricePrecision: 2, bars: [{ time: 1800000000, open: 10, high: 12, low: 9, close: 11, volume: 1 }, { time: 1800000060, open: 11, high: 13, low: 10, close: 12, volume: 2 }], fills: [] },
      agent: { events: [], sourceLabel: 'SUPPLIED OBSERVATIONS' }, dashboard: null,
      dashboardPresentation: { sourceLabel: 'SUPPLIED DASHBOARD', recentTrades: [{ id: 'trade-a', exitDate: 'SUPPLIED DATE', exitReason: 'SUPPLIED EXIT' }] },
      completedPresentation: { sourceLabel: 'SUPPLIED COMPLETED', trades: [{ id: 'trade-a', exitDate: 'SUPPLIED DATE', exitReason: 'SUPPLIED EXIT', whyEntered: 'ENTRY OBSERVATION', whyExited: 'EXIT OBSERVATION' }] },
      tradeLifecycles: [{ tradeId: 'trade-a', versionIdentity: 'v3', title: 'BTC SHORT 공급된 거래 기록', steps: [
        { title: '진입 결정', value: 'SUPPLIED ENTRY TIME', description: '검증자가 제공한 공개 진입 근거' },
        { title: '주문 생성', value: 'SUPPLIED ORDER STATUS', description: '아직 체결 근거는 공급되지 않았습니다.' },
        { title: '청산 결정', value: 'SUPPLIED EXIT TIME', description: '검증자가 제공한 공개 청산 근거' },
      ] }],
    }],
  }
}

async function mount(page: Page, mode: 'supplied' | 'callback' | 'reject' = 'supplied') {
  await page.route('**/terminal-lifecycle-integration.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="test-root" style="height:100dvh"></div></body></html>' }))
  await page.goto('/terminal-lifecycle-integration.html')
  await page.evaluate(async ({ data, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeTradingWorkspace.tsx', pp = '/src/client-preferences.ts', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */skin)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp), { NativeTradingWorkspace } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root'))
    const calls: string[][] = []
    if (mode !== 'supplied') {
      data.strategies![0].tradeLifecycles = null
      data.strategies![0].terminalActions = { onOpenTrade: (id, trigger) => {
        calls.push([id, String(trigger.isConnected)])
        if (mode === 'reject') return new Promise<void>((_resolve, reject) => { Reflect.set(window, 'rejectLifecycle', () => reject(new Error('PRIVATE_PROVIDER_SECRET'))) })
      } }
    }
    const render = (owner = 'owner-a', next = data) => root.render(React.createElement(React.StrictMode, null, React.createElement(NativeTradingWorkspace, { accountScope: owner, presentation: next, onReturn: () => {}, onNew: () => {} })))
    Object.assign(window, { lifecycleCalls: calls, lifecycleRender: render, lifecycleInput: data })
    render()
  }, { data: fixture(), mode })
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
  await expect(page.locator('.cp-surface')).toHaveCount(1)
  await page.evaluate(() => Reflect.set(window, 'lifecycleChart', document.querySelector('.cp-surface')))
}

async function show(page: Page, index: number) {
  const detail = page.locator('.ctt-main-tabs [role=tab]').last()
  if (await detail.isVisible()) await detail.click()
  await page.locator('.cat-tabs [role=tab]').nth(index).click()
}
async function open(page: Page, index = 2) {
  await show(page, index)
  await page.locator(index === 2 ? '[data-native-terminal-completed] .cst-trade-details' : '[data-native-terminal-dashboard] .cst-trade-link').click()
}
async function sameChart(page: Page) {
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleChart') === document.querySelector('.cp-surface'))).toBe(true)
  await expect(page.locator('.cp-surface')).toHaveCount(1)
}

test('완료 거래·대시보드는 원본 상세창에 공급된 단계만 표시하고 같은 차트와 초점을 보존한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page); await open(page)
  const dialog = page.locator('dialog.client-trade-lifecycle[open]')
  await expect(dialog).toContainText('BTC SHORT 공급된 거래 기록')
  await expect(dialog.locator('ol.tft-lc > li.lc1')).toHaveCount(3)
  await expect(dialog.locator('.lc-heading b')).toHaveText(['진입 결정', '주문 생성', '청산 결정'])
  await expect(dialog).not.toContainText('전량 체결'); await expect(dialog).not.toContainText('수수료 왕복')
  await expect(dialog.locator('.dx')).toBeFocused()
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0)
  await expect(page.locator('[data-native-terminal-completed] .cst-trade-details')).toBeFocused()
  await sameChart(page); await open(page, 1)
  await expect(dialog.locator('.lc1')).toHaveCount(3)
  await dialog.locator('.dx').click()
  await expect(page.locator('.cst-trade-link')).toBeFocused(); await sameChart(page)
  expect(errors).toEqual([])
})

for (const change of ['version', 'record', 'trade', 'owner', 'dataset'] as const) {
  test(`${change} 변경은 상세를 닫고 늦은 이전 공급값으로 재개방하지 않는다`, async ({ page }) => {
    await mount(page); await open(page)
    await page.evaluate(change => {
      const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
      const next = structuredClone(data), item = next.strategies![0]
      if (change === 'version') item.strategy.version = 'v4'
      if (change === 'record') item.tradeLifecycles = [{ ...item.tradeLifecycles![0], steps: [{ title: '수정된 근거', value: 'CORRECTED', description: '새 공급값' }] }]
      if (change === 'trade') { item.dashboardPresentation = { recentTrades: [] }; item.completedPresentation = { trades: [] } }
      if (change === 'dataset') next.identity = 'dataset-b'
      Reflect.get(window, 'lifecycleRender')(change === 'owner' ? 'owner-b' : 'owner-a', next)
    }, change)
    await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && !!(document.activeElement as HTMLElement | null)?.getClientRects().length)).toBe(true)
    await page.evaluate(() => Reflect.get(window, 'lifecycleRender')('owner-a', Reflect.get(window, 'lifecycleInput')))
    await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', 'dataset-a')
    await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    if (change !== 'owner' && change !== 'dataset') await sameChart(page)
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
}

test('상세창을 닫은 후 공급값 갱신은 자동 재개방하지 않는다', async ({ page }) => {
  await mount(page); await open(page); await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation)
    next.strategies![0].tradeLifecycles![0].steps = [{ title: '나중에 공급된 근거', value: 'LATE', description: '새 공급값' }]
    Reflect.get(window, 'lifecycleRender')('owner-a', next)
  })
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0); await sameChart(page)
})

for (const mode of ['missing', 'mismatch', 'duplicate', 'malformed', 'empty'] as const) {
  test(`${mode} 기록은 임의 금융 단계 생성 없이 명시 공급 상태를 따른다`, async ({ page }) => {
    await mount(page)
    await page.evaluate(mode => {
      const next = structuredClone(Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation), item = next.strategies![0]
      if (mode === 'missing') item.tradeLifecycles = null
      if (mode === 'mismatch') item.tradeLifecycles![0].versionIdentity = 'v2'
      if (mode === 'duplicate') item.tradeLifecycles = [item.tradeLifecycles![0], { ...item.tradeLifecycles![0], versionIdentity: 'v2' }]
      if (mode === 'malformed') item.tradeLifecycles![0].title = ' '
      if (mode === 'empty') item.tradeLifecycles![0].steps = []
      Reflect.get(window, 'lifecycleRender')('owner-a', next)
    }, mode)
    await show(page, 2)
    if (mode === 'empty') {
      await page.locator('[data-native-terminal-completed] .cst-trade-details').click()
      await expect(page.locator('dialog .lc1')).toHaveCount(0)
      await expect(page.locator('dialog .empty')).toHaveText(lifecycleText('ko', 'empty'))
    } else {
      await expect(page.locator('[data-native-terminal-completed] .cst-trade-details')).toBeDisabled()
      await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    }
    await sameChart(page)
  })
}

test('미공급의 기존 callback은 호환되고 callback이 늦게 공급해도 상세는 자동 열리지 않는다', async ({ page }) => {
  await mount(page, 'callback'); await open(page)
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleCalls'))).toEqual([['trade-a', 'true']])
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
  await page.evaluate(record => {
    const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
    Reflect.get(window, 'lifecycleRender')('owner-a', { ...data, strategies: data.strategies!.map(item => ({ ...item, tradeLifecycles: record })) })
  }, fixture().strategies![0].tradeLifecycles)
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
  await open(page); await expect(page.locator('dialog .lc1')).toHaveCount(3)
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleCalls'))).toHaveLength(1)
})

test('일부 거래 기록만 공급되면 누락·중복·버전 불일치 행은 각각 비활성화한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation), item = next.strategies![0]
    const base = item.tradeLifecycles![0]
    const trades = ['trade-a', 'missing', 'duplicate', 'mismatch'].map(id => ({ id, exitDate: id, exitReason: 'SUPPLIED REASON' }))
    item.dashboardPresentation = { recentTrades: trades }; item.completedPresentation = { trades }
    item.tradeLifecycles = [base, { ...base, tradeId: 'duplicate' }, { ...base, tradeId: 'duplicate', versionIdentity: 'v2' }, { ...base, tradeId: 'mismatch', versionIdentity: 'v2' }]
    Reflect.get(window, 'lifecycleRender')('owner-a', next)
  })
  for (const index of [1, 2]) {
    await show(page, index)
    const surface = page.locator(index === 1 ? '[data-native-terminal-dashboard]' : '[data-native-terminal-completed]')
    await expect(surface.locator('[data-trade-id=trade-a] button')).toBeEnabled()
    for (const id of ['missing', 'duplicate', 'mismatch']) {
      await expect(surface.locator(`[data-trade-id=${id}] button`)).toBeDisabled()
    }
    if (index === 1) {
      await surface.locator('[data-trade-id=missing] td').nth(1).click()
      await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
      await expect(page.locator('[role=alert]')).toHaveCount(0)
    }
  }
  await sameChart(page)
})

test('무효한 공급 기록이 있어도 명시한 외부 상세 요청 callback은 활성 상태를 유지한다', async ({ page }) => {
  await mount(page, 'callback')
  await page.evaluate(record => {
    const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
    Reflect.get(window, 'lifecycleRender')('owner-a', { ...data, strategies: data.strategies!.map(item => ({ ...item, tradeLifecycles: [{ ...record, versionIdentity: 'stale-version' }] })) })
  }, fixture().strategies![0].tradeLifecycles![0])
  await open(page)
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleCalls'))).toEqual([['trade-a', 'true']])
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
})

test('비동기 fallback 실패는 안전한 오류만 표시하고 owner 변경 후 늦은 실패는 버린다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, 'reject'); await open(page)
  await open(page)
  expect(await page.evaluate(() => Reflect.get(window, 'lifecycleCalls'))).toHaveLength(1)
  await page.evaluate(() => Reflect.get(window, 'rejectLifecycle')())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_PROVIDER_SECRET')
  await open(page)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
    Reflect.get(window, 'lifecycleRender')('owner-b', { ...data, scope: 'owner-b', identity: 'dataset-b' })
  })
  await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', 'dataset-b')
  await page.evaluate(() => Reflect.get(window, 'rejectLifecycle')())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('같은 버전의 일반 props 갱신은 요청 실패 안내를 유실하지 않지만 버전 변경은 늦은 오류를 버린다', async ({ page }) => {
  await mount(page, 'reject'); await open(page)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
    Reflect.get(window, 'lifecycleRender')('owner-a', { ...data, sourceLabel: 'UPDATED OBSERVATIONS' })
  })
  await expect(page.locator('.native-trading-workspace')).toContainText('UPDATED OBSERVATIONS')
  await page.evaluate(() => Reflect.get(window, 'rejectLifecycle')())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toBeVisible()
  await open(page)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'lifecycleInput') as NativeAccountPresentation
    Reflect.get(window, 'lifecycleRender')('owner-a', { ...data, strategies: data.strategies!.map(item => ({ ...item, strategy: { ...item.strategy, version: 'v4' } })) })
  })
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'rejectLifecycle')())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveCount(0)
})

test('320px·7언어에서도 원본 단계 본문이 잘리지 않고 닫기와 초점 복귀가 동작한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', language)
    }, language)
    await open(page)
    const dialog = page.locator('dialog.client-trade-lifecycle[open]')
    await expect(dialog.getByRole('button', { name: lifecycleText(language, 'close'), exact: true })).toBeFocused()
    await expect(dialog.getByRole('region', { name: lifecycleText(language, 'region') })).toBeVisible()
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (language === 'ko') await page.screenshot({ path: info.outputPath('terminal-lifecycle-320.png'), fullPage: true })
    await dialog.locator('.dx').click()
    await expect(page.locator('[data-native-terminal-completed] .cst-trade-details')).toBeFocused()
  }
  await sameChart(page)
})
