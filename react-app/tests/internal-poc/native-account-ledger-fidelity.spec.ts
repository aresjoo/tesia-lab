import { expect, test, type Page } from '@playwright/test'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import { nativeAccountText } from '../../src/internal-poc/native-account-presentation-copy'
import { strategyActionsText } from '../../src/client-strategy-actions-copy'

test.setTimeout(25_000)

function fixture() {
  return {
    scope: 'owner-a', identity: 'dataset-a', sourceLabel: 'SUPPLIED TEST ONLY',
    accounts: [{ id: 'account-a', kind: 'account', title: 'Supplied account', sourceLabel: 'SUPPLIED', fields: [], sections: [] }],
    strategies: [{ accountId: 'account-a', strategy: { id: 'strategy-a', name: 'Supplied strategy', version: 'v3', symbol: 'BTC/USDT', market: 'USDT', status: 'live', exchange: { id: 'exchange', name: 'Supplied exchange', color: '#25272b' }, capitalLabel: 'SUPPLIED CAPITAL', pnlLabel: 'SUPPLIED PNL' },
      chart: { identity: 'chart-a', market: 'BTC/USDT', sourceLabel: 'SYNTHETIC TEST BARS', resolutionSeconds: 60, pricePrecision: 2, bars: [{ time: 1800000000, open: 10, high: 12, low: 9, close: 11, volume: 1 }, { time: 1800000060, open: 11, high: 13, low: 10, close: 12, volume: 2 }], fills: [] },
      agent: { events: [], sourceLabel: 'SUPPLIED OBSERVATIONS' }, dashboard: null,
      completedPresentation: { trades: [{ id: 'trade-a', exitDate: 'SUPPLIED DATE', exitReason: 'SUPPLIED EXIT' }] },
      tradeLifecycles: [{ tradeId: 'trade-a', versionIdentity: 'v3', title: 'SUPPLIED LIFECYCLE', steps: [{ title: 'SUPPLIED STEP', value: 'SUPPLIED TIME', description: 'SUPPLIED PUBLIC EVIDENCE' }] }],
    }],
    ledger: {
      pos: [{ id: 'pos-a', accountId: 'account-a', strategyId: 'strategy-a', cells: { exchange: 'Supplied exchange', strategy: 'Supplied strategy', quantity: '7.000001', unrealized: '+17.170007' }, target: { kind: 'review', id: 'review-a' } }],
      closed: [{ id: 'closed-a', accountId: 'account-a', strategyId: 'strategy-a', cells: { strategy: 'Supplied strategy', realized: '-0.000777 TOKEN' }, trade: { id: 'trade-a', versionIdentity: 'v3' }, target: { kind: 'review', id: 'review-a' } }],
      open: [], orders: [], fills: [],
      assets: [{ id: 'asset-a', accountId: 'account-a', cells: { exchange: 'Supplied exchange', equity: '123.456789 TOKEN', available: '63.200000 TOKEN', used: '26.100003 TOKEN', unrealized: '-17.170007 TOKEN' }, tone: 'dn', asset: { exchange: { name: 'Supplied exchange', color: '#334455', foreground: '#ddeeff' }, strategyCountLabel: '공급 전략 수 99개', description: '확인된 동기화 시각 · 공용 예산 원문' } }],
    },
    documents: [{ id: 'review-a', kind: 'review', title: 'Review', sourceLabel: 'SUPPLIED', fields: [], sections: [] }],
  } as NativeAccountPresentation
}

async function mount(page: Page, mode: 'supplied' | 'missing' | 'callback' | 'no-action' = 'supplied') {
  const requests: string[] = []
  page.on('request', request => { if (/\/api\//.test(request.url())) requests.push(`${request.method()} ${request.url()}`) })
  await page.route('**/ledger-fidelity.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="test-root" style="height:100dvh"></div></body></html>' }))
  await page.goto('/ledger-fidelity.html')
  await page.evaluate(async ({ data, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeTradingWorkspace.tsx', pp = '/src/client-preferences.ts', skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */skin)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp), { NativeTradingWorkspace } = await import(/* @vite-ignore */cp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('test-root'))
    const audit = { calls: [] as unknown[][], mode: 'hold', resolve: () => {}, reject: () => {} }
    const action = (...args: unknown[]) => {
      audit.calls.push(args)
      if (audit.mode === 'resolve') return Promise.resolve()
      return new Promise<void>((resolve, reject) => { audit.resolve = resolve; audit.reject = () => reject(new Error('PRIVATE_ACCOUNT_DIAGNOSTIC')) })
    }
    const render = (owner = 'owner-a', next: NativeAccountPresentation | undefined = data, alertsRequest?: number) => {
      const presentation = next && { ...next, actions: mode === 'no-action' ? undefined : { onStatus: (id: string, status: string) => action('status', id, status), onConnect: () => action('connect'), onRead: (id: string) => action('read', id) } }
      if (presentation && mode === 'callback') {
        presentation.strategies = presentation.strategies!.map(item => ({ ...item, tradeLifecycles: null, terminalActions: { onOpenTrade: id => action('trade', id) } }))
      }
      root.render(React.createElement(React.StrictMode, null, React.createElement(NativeTradingWorkspace, { accountScope: owner, presentation, alertsRequest, onReturn: () => {}, onNew: () => {}, onBrowseExchanges: () => audit.calls.push(['browse']), onNavigate: (location: unknown) => audit.calls.push(['navigate', location]) })))
    }
    Object.assign(window, { ledgerInput: data, ledgerRender: render, ledgerAudit: audit, ledgerLanguage: preferences.setClientPreference, ledgerRoot: root })
    render(mode === 'missing' ? 'owner-b' : 'owner-a')
  }, { data: fixture(), mode })
  await expect(page.locator('.native-trading-workspace')).toBeVisible()
  await page.evaluate(() => Reflect.set(window, 'ledgerChart', document.querySelector('.cp-surface')))
  return requests
}
async function bottom(page: Page, id: string) {
  const chart = page.locator('.ctt-main-tabs [role=tab]').first()
  if (await chart.isVisible()) await chart.click()
  await page.locator(`.ctt-bottom-tabs [data-tab-id="${id}"]`).click()
  return page.locator(`.ctt-bottom-pane[data-tab-id="${id}"]`)
}
async function audit(page: Page) { return page.evaluate(() => Reflect.get(window, 'ledgerAudit').calls) }
async function sameChart(page: Page) {
  expect(await page.evaluate(() => Reflect.get(window, 'ledgerChart') === document.querySelector('.cp-surface'))).toBe(true)
  await expect(page.locator('.cp-surface')).toHaveCount(1)
}

test('추가 검수: 공급 bot ID의 하이픈·밑줄 알림도 원래 터미널에서 열린다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const requests = await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput')), id = 'strategy_abcdefgh-A'
    next.strategies[0].strategy.id = id
    for (const rows of Object.values(next.ledger) as { strategyId?: string }[][]) for (const row of rows) if (row.strategyId) row.strategyId = id
    next.notifications = [{ id: 'notification-a', type: 'bot', title: 'SUPPLIED STRATEGY NOTICE', timeLabel: 'SUPPLIED TIME', read: false, target: { kind: 'bot', id } }]
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await page.locator('.client-account-bell').click()
  const notice = page.locator('[data-native-account-alerts] .nf-item')
  await expect(notice).toContainText('SUPPLIED STRATEGY NOTICE')
  await notice.click()
  expect(await audit(page)).toEqual([['read', 'notification-a']])
  await page.evaluate(() => Reflect.get(window, 'ledgerAudit').resolve())
  await expect.poll(() => audit(page)).toEqual([['read', 'notification-a'], ['navigate', { kind: 'bot', id: 'strategy_abcdefgh-A' }]])
  await sameChart(page); expect(errors).toEqual([]); expect(requests).toEqual([])
})

async function openStrategySelector(page: Page) {
  const selector = page.locator('.ctt-selector-button')
  if (await selector.getAttribute('aria-expanded') !== 'true') await selector.click()
  await expect(selector).toHaveAttribute('aria-expanded', 'true')
}

for (const via of ['direct-rail', 'bottom-pointer', 'bottom-keyboard', 'mobile-strategies'] as const) test(`계정 메뉴 후속: 계정 상세에서 ${via} 정상 이동 뒤 전략 메뉴와 초점이 유지된다`, async ({ page }, info) => {
  await page.setViewportSize({ width: via === 'mobile-strategies' ? 390 : 1440, height: 900 })
  const requests = await mount(page)
  const assets = await bottom(page, 'assets')
  await assets.locator('.ah2 button').click()
  const account = page.locator('[data-native-account-document="account-a"]')
  await expect(account).toBeVisible()
  if (via === 'bottom-pointer') await page.locator('.ctt-bottom-tabs [data-tab-id="pos"]').click()
  if (via === 'bottom-keyboard') {
    await page.locator('.ctt-bottom-tabs [data-tab-id="pos"]').focus()
    await page.keyboard.press('Home')
  }
  if (via.startsWith('bottom-')) {
    await expect(page.locator('.ctt-bottom-pane[data-tab-id="pos"]')).toBeVisible()
    await expect(page.locator('.ctt-bottom-tabs [data-tab-id="pos"]')).toHaveAttribute('aria-selected', 'true')
  }
  if (via === 'mobile-strategies') await expect(page.locator('.ctt-selector-button')).toBeVisible()
  await openStrategySelector(page)
  const trigger = page.locator('.teth-strategy-rail .mn')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.locator('.csa-menu')).toBeVisible()
  await page.screenshot({ path: info.outputPath(`account-${via}-menu.png`), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.locator('.csa-menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  if (via === 'direct-rail') await expect(account).toBeVisible()
  if (via === 'mobile-strategies') {
    await page.locator('.ctt-selector-button').click()
    await expect(account).toBeVisible()
  }
  await sameChart(page)
  expect(await audit(page)).toEqual([])
  expect(requests).toEqual([])
})

for (const via of ['bell', 'request'] as const) test(`추가 검수: 계정 상세에서 ${via} 알림 이동 뒤 전략 메뉴가 정상 열린다`, async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'assets')
  await pane.locator('.ah2 button').click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toBeVisible()
  if (via === 'bell') await page.locator('.client-account-bell').click()
  else await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-a', Reflect.get(window, 'ledgerInput'), 1))
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')).toBeVisible()
  const strategies = page.locator('.ctt-main-tabs [role=tab]').nth(1)
  if (await strategies.isVisible()) await strategies.click()
  await openStrategySelector(page)
  await page.locator('.teth-strategy-rail .mn').click()
  await expect(page.locator('.csa-menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.csa-menu')).toHaveCount(0)
  await expect(page.locator('.teth-strategy-rail .mn')).toBeFocused()
  await sameChart(page); expect(await audit(page)).toEqual([])
})

test('추가 검수: 미체결 규칙 열은 원본과 같이 우측 정렬한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.ledger.open = [{ ...next.ledger.pos[0], id: 'open-rule', cells: { ...next.ledger.pos[0].cells, rule: 'SUPPLIED 규칙 원문' } }]
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'open')
  await expect(pane.getByRole('columnheader', { name: nativeAccountText('ko', 'rule'), exact: true })).toHaveCSS('text-align', 'right')
  await expect(pane.getByRole('cell', { name: 'SUPPLIED 규칙 원문', exact: true })).toHaveCSS('text-align', 'right')
})

test('추가 검수: 알림 미도달 경로는 전달하지 않고 정상 읽음은 유지한다', async ({ page }) => {
  const requests = await mount(page)
  await page.evaluate(async () => {
    const rp = '/@id/react', cp = '/src/internal-poc/NativeAccountPanels.tsx'
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, { NativeAccountAlerts } = await import(/* @vite-ignore */cp)
    const calls = Reflect.get(window, 'ledgerAudit').calls
    Reflect.get(window, 'ledgerRoot').render(React.createElement(NativeAccountAlerts, {
      notifications: [{ id: 'missing', type: 'review', title: 'SUPPLIED MISSING REVIEW', timeLabel: 'SUPPLIED TIME', read: false, target: { kind: 'review', id: 'missing' } }, { id: 'malformed', type: 'bot', title: 'SUPPLIED MALFORMED TARGET', timeLabel: 'SUPPLIED TIME', read: false, target: { kind: 'bot', id: '../bad' } }, { id: 'available', type: 'credit', title: 'SUPPLIED PLAN', timeLabel: 'SUPPLIED TIME', read: false, target: { kind: 'plan', tab: 'plan' } }],
      pending: false, onRead: async (id: string) => { calls.push(['read', id]) }, onNavigate: (target: unknown) => calls.push(['navigate', target]), canNavigate: (target: { kind: string }) => target.kind !== 'review',
    }))
  })
  const missing = page.locator('.nf-item').filter({ hasText: 'SUPPLIED MISSING REVIEW' })
  await expect(missing).toBeEnabled(); await missing.click()
  await expect.poll(() => audit(page)).toEqual([['read', 'missing']])
  await page.locator('.nf-item').filter({ hasText: 'SUPPLIED MALFORMED TARGET' }).click()
  await expect.poll(() => audit(page)).toEqual([['read', 'missing'], ['read', 'malformed']])
  await page.locator('.nf-item').filter({ hasText: 'SUPPLIED PLAN' }).click()
  await expect.poll(() => audit(page)).toEqual([['read', 'missing'], ['read', 'malformed'], ['read', 'available'], ['navigate', { kind: 'plan', tab: 'plan' }]])
  expect(requests).toEqual([])
})

test('후속 검수: 중지 설명은 청산과 구분되고 숫자 열은 원문 그대로 우측 정렬된다', async ({ page }) => {
  const requests = await mount(page), pane = await bottom(page, 'pos')
  const stop = pane.getByRole('button', { name: 'Supplied strategy · 중지', exact: true })
  await expect(stop).toHaveAttribute('title', '전략 중지 요청이며 포지션 청산 요청이 아닙니다.')
  await expect(stop).toHaveAccessibleDescription('전략 중지 요청이며 포지션 청산 요청이 아닙니다.')
  await expect(pane.locator('th').filter({ hasText: nativeAccountText('ko', 'quantity') })).toHaveClass(/\br\b/)
  await expect(pane.locator('td').filter({ hasText: /^7\.000001$/ })).toHaveClass(/\br\b/)
  await expect(pane.locator('td').filter({ hasText: /^\+17\.170007$/ })).toHaveClass(/\br\b/)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'ledgerLanguage')('language', language), language)
    const translated = pane.getByRole('button', { name: `Supplied strategy · ${strategyActionsText(language, 'headerStop')}`, exact: true })
    await expect(translated).toHaveAttribute('title', nativeAccountText(language, 'stopNotice'))
    await expect(translated).toHaveAccessibleDescription(nativeAccountText(language, 'stopNotice'))
  }
  expect(await audit(page)).toEqual([]); expect(requests).toEqual([]); await sameChart(page)
})

test('후속 검수: 미공급 상세 링크는 비활성이고 공급되면 같은 경로로 열린다', async ({ page }) => {
  const requests = await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.documents = null
    next.accounts[0].links = [{ label: 'Supplied review link', target: { kind: 'review', id: 'review-a' } }, { label: 'Supplied plan link', target: { kind: 'plan', tab: 'plan' } }]
    Reflect.set(window, 'ledgerMissingDocs', next)
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'pos')
  await expect(pane.getByRole('button', { name: nativeAccountText('ko', 'detail'), exact: true })).toBeDisabled()
  await pane.getByRole('button', { name: 'Supplied exchange', exact: true }).click()
  const document = page.locator('[data-native-account-document="account-a"]')
  await expect(document.getByRole('button', { name: 'Supplied review link' })).toBeDisabled()
  await document.getByRole('button', { name: 'Supplied plan link' }).click()
  expect(await audit(page)).toEqual([['navigate', { kind: 'plan', tab: 'plan' }]])
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerMissingDocs'))
    next.documents = Reflect.get(window, 'ledgerInput').documents
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await document.getByRole('button', { name: 'Supplied review link' }).click()
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveCount(0)
  expect(await audit(page)).toEqual([['navigate', { kind: 'plan', tab: 'plan' }], ['navigate', { kind: 'review', id: 'review-a' }]])
  expect(requests).toEqual([]); await sameChart(page)
})

test('후속 검수: 계정 문서 미공급은 빈 상세 진입을 막고 재공급 후 복원된다', async ({ page }) => {
  const requests = await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput')); next.accounts = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'assets'), account = pane.locator('.ah2 button')
  await expect(account).toBeDisabled()
  await expect(page.locator('.cst-context-actions').getByRole('button', { name: nativeAccountText('ko', 'accounts'), exact: true })).toBeDisabled()
  await expect(page.locator('[data-native-account-document="account-a"]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-a', Reflect.get(window, 'ledgerInput')))
  await account.click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toBeVisible()
  expect(await audit(page)).toEqual([]); expect(requests).toEqual([]); await sameChart(page)
})

test('후속 검수: 알림에서 계정 상세를 열고 정확히 알림으로 복귀한다', async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 800 })
  const requests = await mount(page)
  await page.locator('.client-account-bell').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')).toBeVisible()
  const chart = page.locator('.ctt-main-tabs [role=tab]').first()
  if (await chart.isVisible()) await chart.click()
  await page.locator('.cst-context-actions').getByRole('button', { name: nativeAccountText('ko', 'accounts'), exact: true }).click()
  const document = page.locator('[data-native-account-document="account-a"]')
  await expect(document).toBeVisible()
  await document.locator('.native-plan-return button').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="alerts"]')).toBeVisible()
  expect(await audit(page)).toEqual([]); expect(requests).toEqual([]); await sameChart(page)
})

test('후속 정렬: 모든 원장 숫자 필드는 문자열 해석 없이 우측 정렬한다', async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'pos')
  await expect(pane.locator('td').filter({ hasText: /^7\.000001$/ })).toHaveCSS('text-align', 'right')
  await expect(pane.locator('td').filter({ hasText: /^\+17\.170007$/ })).toHaveCSS('text-align', 'right')
  await expect(pane.locator('td').filter({ hasText: /^Supplied exchange$/ })).toHaveCSS('text-align', 'left')
  const expected = {
    pos: ['quantity', 'entry', 'current', 'stop', 'unrealized', 'percent'],
    open: ['price', 'quantity'], orders: ['price', 'quantity'], fills: ['price', 'quantity', 'fee'],
    closed: ['entry', 'exit', 'holding', 'fee', 'realized'],
  } as const
  await page.evaluate(expected => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    for (const [tab, columns] of Object.entries(expected)) {
      const row = { ...next.ledger.pos[0], id: `${tab}-alignment`, cells: { exchange: 'Supplied exchange', strategy: 'Supplied strategy', ...Object.fromEntries(columns.map(column => [column, `${column} / SUPPLIED 原文 0.0000001`])) } }
      next.ledger[tab] = [row]
    }
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  }, expected)
  for (const [tab, columns] of Object.entries(expected)) {
    const active = await bottom(page, tab)
    for (const column of columns) {
      await expect(active.getByRole('columnheader', { name: nativeAccountText('ko', column), exact: true })).toHaveCSS('text-align', 'right')
      const cell = active.getByRole('cell', { name: `${column} / SUPPLIED 原文 0.0000001`, exact: true })
      await expect(cell).toHaveCSS('text-align', 'right')
      await expect(cell).toHaveText(`${column} / SUPPLIED 原文 0.0000001`)
    }
    await expect(active.locator('tbody td').last()).toHaveCSS('text-align', 'right')
  }
  await sameChart(page); expect(await audit(page)).toEqual([])
})

test('후속 밀도: 자산 카드 헤더는 데스크톱 밀도와 터치 타깃을 함께 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 800 })
  await mount(page)
  const pane = await bottom(page, 'assets'), header = pane.locator('.ah2'), button = header.locator('button')
  const geometry = await header.evaluate(node => {
    const button = node.querySelector('button')!, original = document.createElement('b')
    original.textContent = button.textContent; node.append(original)
    const result = { originalHeight: original.getBoundingClientRect().height, buttonHeight: button.getBoundingClientRect().height, coarse: matchMedia('(pointer:coarse)').matches }
    original.remove(); return result
  })
  await info.attach('asset-header-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
  console.info(`asset-header-${info.project.name}`, geometry)
  expect(geometry.originalHeight).toBeGreaterThan(0)
  expect(geometry.buttonHeight).toBeGreaterThanOrEqual(geometry.coarse ? 44 : 24)
  if (!geometry.coarse) expect(geometry.buttonHeight).toBeLessThanOrEqual(28)
  // Text enlargement must remain readable instead of fixing the header height.
  await header.evaluate(node => { (node.querySelector('b') as HTMLElement).style.fontSize = '25px' })
  await expect(button).toHaveCSS('font-size', '25px')
  expect(await button.evaluate(node => node.scrollHeight <= node.clientHeight && node.scrollWidth <= node.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('ledger-enlarged-header.png'), fullPage: true })
  await button.click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toBeVisible()
})

test('후속 경계: 계정 상세 소멸·owner 교체 뒤 과거 버튼과 링크는 동작하지 않는다', async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'pos')
  const detail = await pane.getByRole('button', { name: nativeAccountText('ko', 'detail'), exact: true }).elementHandle()
  const account = await pane.getByRole('button', { name: 'Supplied exchange', exact: true }).elementHandle()
  await account!.click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toBeVisible()
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput')); next.accounts = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="pos"]')).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-native-account-document="account-a"]')).toHaveCount(0)
  await account!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-b', Reflect.get(window, 'ledgerInput')))
  await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
  await detail!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await account!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(page.locator('[data-native-account-document="account-a"]')).toHaveCount(0)
  expect(await audit(page)).toEqual([])
})

test('후속 경계: 키보드로 고른 원장 탭에서도 계정 상세 왕복을 보존한다', async ({ page }) => {
  await mount(page)
  await bottom(page, 'pos')
  const pos = page.locator('.ctt-bottom-tabs [data-tab-id="pos"]')
  await pos.focus(); await page.keyboard.press('ArrowRight')
  await expect(page.locator('.ctt-bottom-tabs [data-tab-id="open"]')).toHaveAttribute('aria-selected', 'true')
  const chart = page.locator('.ctt-main-tabs [role=tab]').first()
  if (await chart.isVisible()) await chart.click()
  await page.locator('.cst-context-actions').getByRole('button', { name: nativeAccountText('ko', 'accounts'), exact: true }).click()
  await page.locator('[data-native-account-document="account-a"] .native-plan-return button').click()
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="open"]')).toHaveAttribute('data-selected', 'true')
  await sameChart(page); expect(await audit(page)).toEqual([])
})

test('자산은 원본 4칸 카드·공급 브랜드·전략 수·동기화 원문을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 800 })
  const requests = await mount(page)
  const pane = await bottom(page, 'assets'), card = pane.locator('.tft-asx')
  await expect(card).toHaveCount(1)
  await expect(pane.locator('table')).toHaveCount(0)
  await expect(card.locator('.ah2')).toContainText('공급 전략 수 99개')
  await expect(card.locator('.exb')).toHaveCSS('background-color', 'rgb(51, 68, 85)')
  await expect(card.locator('.ag2 b')).toHaveText(['123.456789 TOKEN', '63.200000 TOKEN', '26.100003 TOKEN', '-17.170007 TOKEN'])
  await expect(card.locator('.af2')).toHaveText('확인된 동기화 시각 · 공용 예산 원문')
  const cardNode = await card.elementHandle()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'ledgerLanguage')('language', language), language)
    await expect(card.locator('.ag2 small')).toHaveText(['equity', 'available', 'used', 'unrealized'].map(key => nativeAccountText(language, key as 'equity')))
    expect(await card.evaluate((node, original) => node === original, cardNode)).toBe(true)
    await expect(card).toContainText('123.456789 TOKEN')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await sameChart(page); expect(await audit(page)).toEqual([]); expect(requests).toEqual([])
  await page.screenshot({ path: info.outputPath('ledger-assets.png'), fullPage: true })
  await card.locator('.ah2 button').click()
  await expect(page.locator('[data-native-account-document="account-a"]')).toBeVisible()
  await page.locator('[data-native-account-document="account-a"] .native-plan-return button').click()
  await expect(card.locator('.ah2 button')).toBeFocused()
  await sameChart(page); expect(await audit(page)).toEqual([])
})

test('포지션 중지는 기존 callback을 한번만 전달하고 실패·재시도·언어를 유지한다', async ({ page }) => {
  const requests = await mount(page), pane = await bottom(page, 'pos')
  const pause = pane.getByRole('button', { name: `Supplied strategy · ${strategyActionsText('ko', 'headerStop')}`, exact: true })
  await expect(pause).toBeEnabled(); await pause.click()
  await expect(pause).toBeDisabled()
  await pause.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(await audit(page)).toEqual([['status', 'strategy-a', 'off']])
  await page.evaluate(() => Reflect.get(window, 'ledgerAudit').reject())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveText(nativeAccountText('ko', 'failed'))
  await page.evaluate(() => Reflect.get(window, 'ledgerLanguage')('language', 'fr'))
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveText(nativeAccountText('fr', 'failed'))
  await expect(page.locator('body')).not.toContainText('PRIVATE_ACCOUNT_DIAGNOSTIC')
  await page.evaluate(() => { Reflect.get(window, 'ledgerAudit').mode = 'resolve' })
  await pane.getByRole('button', { name: `Supplied strategy · ${strategyActionsText('fr', 'headerStop')}`, exact: true }).click()
  await expect(page.locator('.native-trading-workspace')).toContainText(nativeAccountText('fr', 'accepted'))
  expect(await audit(page)).toHaveLength(2)
  await sameChart(page); expect(requests).toEqual([])
})

test('종료 포지션에서 명시 거래 근거를 열고 완료 거래 탭·같은 차트로 돌아온다', async ({ page }) => {
  const requests = await mount(page), pane = await bottom(page, 'closed')
  await pane.locator('[data-ledger-trade]').click()
  const dialog = page.locator('dialog.client-trade-lifecycle[open]')
  await expect(dialog).toContainText('SUPPLIED PUBLIC EVIDENCE')
  await expect(dialog.locator('.lc1')).toHaveCount(1)
  await expect(page.locator('.cat-tabs [role=tab]').last()).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(pane.locator('[data-ledger-trade]')).toBeFocused()
  await pane.getByRole('button', { name: nativeAccountText('ko', 'detail'), exact: true }).click()
  expect(await audit(page)).toEqual([['navigate', { kind: 'review', id: 'review-a' }]])
  await sameChart(page); expect(requests).toEqual([])
})

for (const change of ['missing-id', 'wrong-version', 'missing-record', 'duplicate', 'wrong-strategy'] as const) {
  test(`종료 포지션 ${change} 근거는 생성·추정하지 않는다`, async ({ page }) => {
    await mount(page)
    await page.evaluate(change => {
      const next = structuredClone(Reflect.get(window, 'ledgerInput')), row = next.ledger.closed[0]
      if (change === 'missing-id') delete row.trade
      if (change === 'wrong-version') row.trade.versionIdentity = 'v2'
      if (change === 'missing-record') next.strategies[0].tradeLifecycles = null
      if (change === 'duplicate') next.strategies[0].tradeLifecycles.push(next.strategies[0].tradeLifecycles[0])
      if (change === 'wrong-strategy') row.trade.id = 'not-in-strategy'
      Reflect.get(window, 'ledgerRender')('owner-a', next)
    }, change)
    const pane = await bottom(page, 'closed')
    const action = pane.locator('[data-ledger-trade]')
    if (change === 'missing-id') await expect(action).toHaveCount(0)
    else await expect(action).toBeDisabled()
    await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    expect(await audit(page)).toEqual([]); await sameChart(page)
  })
}

test('미연결 6탭은 거래소 탐색으로 연결된다', async ({ page }) => {
  const requests = await mount(page, 'missing')
  for (const tab of ['pos', 'open', 'orders', 'fills', 'closed', 'assets']) {
    const pane = await bottom(page, tab)
    await pane.getByRole('button', { name: '거래소 연결하기', exact: true }).click()
  }
  expect(await audit(page)).toEqual(Array.from({ length: 6 }, () => ['browse']))
  expect(requests).toEqual([])
})

test('외부 거래 근거 callback은 공급행 식별자로만 호출되고 실패를 가린다', async ({ page }) => {
  await mount(page, 'callback')
  const pane = await bottom(page, 'closed')
  await pane.locator('[data-ledger-trade]').click()
  expect(await audit(page)).toEqual([['trade', 'trade-a']])
  await page.evaluate(() => Reflect.get(window, 'ledgerAudit').reject())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveText(nativeAccountText('ko', 'failed'))
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('PRIVATE_ACCOUNT_DIAGNOSTIC')
})

test('owner 교체 뒤 늦은 중지 실패는 새 계좌를 변경하지 않는다', async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'pos')
  await pane.getByRole('button', { name: `Supplied strategy · ${strategyActionsText('ko', 'headerStop')}`, exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-b', Reflect.get(window, 'ledgerInput')))
  await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
  await page.evaluate(() => Reflect.get(window, 'ledgerAudit').reject())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveCount(0)
  expect(await audit(page)).toEqual([['status', 'strategy-a', 'off']])
})

test('공급값 갱신 뒤 새 행 조작은 활성이고 이전 DOM의 제거된 행은 호출하지 않는다', async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'closed')
  const old = await pane.locator('[data-ledger-trade]').elementHandle()
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.ledger.closed[0].id = 'new-row'
    next.ledger.closed[0].cells.realized = 'NEW SUPPLIED VALUE'
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await expect(pane.locator('[data-record-id="new-row"]')).toContainText('NEW SUPPLIED VALUE')
  await expect(pane.locator('[data-ledger-trade]')).toBeEnabled()
  await old!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
  await pane.locator('[data-ledger-trade]').click()
  await expect(page.locator('dialog.client-trade-lifecycle[open]')).toBeVisible()
  expect(await audit(page)).toEqual([]); await sameChart(page)
})

for (const summary of [false, true]) {
  test(`명시 원장 거래 ID 중복은 요약 ${summary} 상태에서도 거부한다`, async ({ page }) => {
    await mount(page)
    await page.evaluate(summary => {
      const next = structuredClone(Reflect.get(window, 'ledgerInput'))
      next.ledger.closed.push({ ...next.ledger.closed[0], id: 'duplicate-trade-row' })
      if (!summary) next.strategies[0].completedPresentation = null
      Reflect.get(window, 'ledgerRender')('owner-a', next)
    }, summary)
    const pane = await bottom(page, 'closed')
    await expect(pane.locator('[data-ledger-trade]')).toHaveCount(2)
    for (const action of await pane.locator('[data-ledger-trade]').all()) await expect(action).toBeDisabled()
    expect(await audit(page)).toEqual([])
  })
}

test('요약 미공급이어도 정확한 원장 1행과 명시 기록으로 모달을 열 수 있다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.strategies[0].completedPresentation = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'closed')
  await pane.locator('td').filter({ hasText: '-0.000777 TOKEN' }).click()
  await expect(page.locator('dialog.client-trade-lifecycle[open] .lc1')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(pane.locator('[data-ledger-trade]')).toBeFocused()
  await pane.locator('.stlk').filter({ hasText: 'Supplied strategy' }).click()
  await expect(page.locator('dialog.client-trade-lifecycle[open]')).toBeVisible()
  expect(await audit(page)).toEqual([]); await sameChart(page)
})

for (const change of ['row', 'version', 'owner', 'dataset'] as const) {
  test(`열린 원장 근거 ${change} 변경은 폐기하고 이전 공급값으로 재개방하지 않는다`, async ({ page }) => {
    await mount(page)
    await (await bottom(page, 'closed')).locator('[data-ledger-trade]').click()
    await expect(page.locator('dialog.client-trade-lifecycle[open]')).toBeVisible()
    await page.evaluate(change => {
      const next = structuredClone(Reflect.get(window, 'ledgerInput'))
      if (change === 'row') next.ledger.closed = []
      if (change === 'version') next.strategies[0].strategy.version = 'v4'
      if (change === 'dataset') next.identity = 'dataset-b'
      Reflect.get(window, 'ledgerRender')(change === 'owner' ? 'owner-b' : 'owner-a', next)
    }, change)
    await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-a', Reflect.get(window, 'ledgerInput')))
    await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', 'dataset-a')
    await expect(page.locator('dialog.client-trade-lifecycle')).toHaveCount(0)
    expect(await audit(page)).toEqual([])
  })
}

test('미연결 원장 CTA는 명시 callback 우선이며 실패해도 탐색으로 우회하지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.accounts = []
    next.strategies = null
    for (const tab of Object.keys(next.ledger)) next.ledger[tab] = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'pos'), connect = pane.getByRole('button', { name: '거래소 연결하기', exact: true })
  await connect.click(); await connect.click()
  expect(await audit(page)).toEqual([['connect']])
  await page.evaluate(() => Reflect.get(window, 'ledgerAudit').reject())
  await expect(page.locator('.native-trading-workspace [role=alert]')).toHaveText(nativeAccountText('ko', 'failed'))
  expect(await audit(page)).toEqual([['connect']])
})

test('연결된 계정의 미공급 6탭은 재연결을 요구하지 않는다', async ({ page }) => {
  const requests = await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.strategies = null
    for (const tab of Object.keys(next.ledger)) next.ledger[tab] = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  for (const tab of ['pos', 'open', 'orders', 'fills', 'closed', 'assets']) {
    const pane = await bottom(page, tab)
    await expect(pane.getByRole('status')).toHaveText('거래소는 연결되어 있습니다. 아직 표시할 데이터가 없습니다.')
    await expect(pane.getByRole('button', { name: '거래소 연결하기', exact: true })).toHaveCount(0)
    await expect(pane.locator('table,.tft-asx')).toHaveCount(0)
    await expect(pane).not.toContainText(nativeAccountText('ko', 'empty'))
  }
  expect(await audit(page)).toEqual([])
  expect(requests).toEqual([])
})

test('연결 후 미공급 안내는 7언어에서 재연결 버튼 없이 갱신된다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.ledger.assets = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'assets')
  const expected = {
    ko: '거래소는 연결되어 있습니다. 아직 표시할 데이터가 없습니다.',
    en: 'Your exchange is connected. There is no data to display yet.',
    ja: '取引所は接続されています。表示できるデータはまだありません。',
    'zh-CN': '交易所已连接，暂时没有可显示的数据。',
    'zh-TW': '交易所已連接，暫時沒有可顯示的資料。',
    es: 'Tu exchange está conectado. Aún no hay datos para mostrar.',
    fr: 'Votre plateforme est connectée. Aucune donnée à afficher pour le moment.',
  }
  for (const [language, message] of Object.entries(expected)) {
    await page.evaluate(language => Reflect.get(window, 'ledgerLanguage')('language', language), language)
    await expect(pane.getByRole('status')).toHaveText(message)
    await expect(pane.locator('.tft-empty button')).toHaveCount(0)
  }
  expect(await audit(page)).toEqual([])
})

test('연결된 미공급 데이터가 실제 빈 결과 또는 공급값으로 바뀌면 안내를 교체한다', async ({ page }) => {
  await mount(page)
  const pane = await bottom(page, 'assets')
  for (const rows of [null, [], fixture().ledger.assets]) {
    await page.evaluate(rows => {
      const next = structuredClone(Reflect.get(window, 'ledgerInput'))
      next.ledger.assets = rows
      Reflect.get(window, 'ledgerRender')('owner-a', next)
    }, rows)
    if (rows === null) await expect(pane.getByRole('status')).toHaveText('거래소는 연결되어 있습니다. 아직 표시할 데이터가 없습니다.')
    else if (rows.length === 0) await expect(pane.locator('.tft-empty')).toHaveText(nativeAccountText('ko', 'empty'))
    else await expect(pane.locator('.ag2 b')).toHaveText(['123.456789 TOKEN', '63.200000 TOKEN', '26.100003 TOKEN', '-17.170007 TOKEN'])
    await expect(pane.getByRole('button', { name: '거래소 연결하기', exact: true })).toHaveCount(0)
  }
})

test('연결 제거와 owner 변경은 이전 계정의 연결 완료 안내를 남기지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    next.ledger.pos = null
    Reflect.set(window, 'connectedEmptyInput', next)
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  const pane = await bottom(page, 'pos')
  await expect(pane.getByRole('status')).toHaveText('거래소는 연결되어 있습니다. 아직 표시할 데이터가 없습니다.')
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'connectedEmptyInput'))
    next.accounts = []
    next.strategies = null
    for (const tab of Object.keys(next.ledger)) next.ledger[tab] = null
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await expect(pane.getByRole('button', { name: '거래소 연결하기', exact: true })).toBeVisible()
  await expect(pane.getByRole('status')).toHaveText(nativeAccountText('ko', 'unavailable'))
  await page.evaluate(() => Reflect.get(window, 'ledgerRender')('owner-b', Reflect.get(window, 'connectedEmptyInput')))
  await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
  const foreignPane = await bottom(page, 'pos')
  await expect(foreignPane.getByRole('button', { name: '거래소 연결하기', exact: true })).toBeVisible()
  await expect(foreignPane).not.toContainText('거래소는 연결되어 있습니다.')
  expect(await audit(page)).toEqual([])
})

test('액션과 자산 메타 미공급은 수량·브랜드·시각을 만들어내지 않는다', async ({ page }) => {
  await mount(page, 'no-action')
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'ledgerInput'))
    delete next.ledger.assets[0].asset
    delete next.ledger.assets[0].cells.available
    Reflect.get(window, 'ledgerRender')('owner-a', next)
  })
  await expect((await bottom(page, 'pos')).getByRole('button', { name: `Supplied strategy · ${strategyActionsText('ko', 'headerStop')}`, exact: true })).toBeDisabled()
  const pane = await bottom(page, 'assets')
  await expect(pane.locator('.tft-asx')).toHaveCount(1)
  await expect(pane.locator('.exb,.af2,.ah2 .mut')).toHaveCount(0)
  await expect(pane.locator('.ag2 b')).toHaveText(['123.456789 TOKEN', '—', '26.100003 TOKEN', '-17.170007 TOKEN'])
  expect(await audit(page)).toEqual([])
})
