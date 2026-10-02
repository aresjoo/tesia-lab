import { expect, test, type Page } from '@playwright/test'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'

test.setTimeout(25_000)

function fixture(): NativeAccountPresentation {
  const links = [
    { label: 'SUPPLIED REVIEW', target: { kind: 'review' as const, id: 'review_abcdefgh-A' } },
    { label: 'SUPPLIED PERIODIC', target: { kind: 'periodic' as const, id: 'periodic_abcdefgh-A' } },
    { label: 'SUPPLIED BOT DOCUMENT', target: { kind: 'bot' as const, id: 'bot_abcdefgh-A' } },
    { label: 'MISSING REVIEW', target: { kind: 'review' as const, id: 'missing-review' } },
    { label: 'INVALID TARGET', target: { kind: 'review' as const, id: '../bad' } },
  ]
  return {
    scope: 'owner-a', identity: 'navigation-a', sourceLabel: 'SUPPLIED TEST ONLY',
    accounts: [{ id: 'account-a', kind: 'account', title: 'Supplied account', sourceLabel: 'SUPPLIED', fields: [], sections: [] }],
    strategies: [{ accountId: 'account-a', strategy: { id: '../bad', name: 'Supplied strategy', version: 'v3', symbol: 'BTC/USDT', market: 'USDT', status: 'live', exchange: { id: 'exchange', name: 'Supplied exchange', color: '#25272b' }, capitalLabel: 'SUPPLIED CAPITAL', pnlLabel: 'SUPPLIED PNL' }, chart: null, agent: { events: [], sourceLabel: 'SUPPLIED' }, dashboard: null }],
    ledger: { pos: [], open: [], orders: [], fills: [], closed: [], assets: [] },
    documents: [
      { id: 'origin', kind: 'review', title: 'Origin', sourceLabel: 'SUPPLIED', fields: [], sections: [], links },
      ...links.slice(0, 3).map(link => ({ id: link.target.id, kind: link.target.kind, title: link.label, sourceLabel: 'SUPPLIED', fields: [], sections: [] })),
    ],
    plan: { title: 'SUPPLIED PLAN', sourceLabel: 'SUPPLIED', sections: { plan: null, rebates: null, alerts: null }, links },
  }
}

async function mount(page: Page, surface: 'plan' | 'document' | 'trading') {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (/\/api\//.test(request.url())) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/account-navigation-gates.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/account-navigation-gates.html')
  await page.evaluate(async ({ data, surface }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', wp = '/src/internal-poc/NativeTradingWorkspace.tsx', ap = '/src/internal-poc/NativeAccountPlan.tsx', sp = '/src/internal-poc/ClientServiceExperience.tsx', pp = '/src/client-preferences.ts'
    await import(/* @vite-ignore */sp)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp)
    const { NativeAccountPlan } = await import(/* @vite-ignore */ap), { NativeTradingWorkspace } = await import(/* @vite-ignore */wp), preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')), calls: unknown[] = []
    const render = (next = data, owner = 'owner-a') => root.render(React.createElement(React.StrictMode, null, React.createElement(surface === 'trading' ? NativeTradingWorkspace : NativeAccountPlan, {
      accountScope: owner, presentation: next, location: surface === 'document' ? { kind: 'review', id: 'origin' } : { kind: 'plan', tab: 'plan' }, onReturn: () => {}, onNew: () => {}, onNavigate: (target: unknown) => calls.push(target),
    })))
    Object.assign(window, { navigationData: data, navigationRender: render, navigationCalls: calls })
    render()
  }, { data: fixture(), surface })
  await expect(page.locator(surface === 'trading' ? '.native-trading-workspace' : '.native-service-plan')).toBeVisible()
  return { requests, errors }
}

for (const surface of ['plan', 'document'] as const) test(`${surface} 공급 링크는 존재하는 안전한 문서만 열고 미공급·잘못된 목적지는 비활성이다`, async ({ page }) => {
  const { requests, errors } = await mount(page, surface)
  for (const label of ['SUPPLIED REVIEW', 'SUPPLIED PERIODIC', 'SUPPLIED BOT DOCUMENT']) {
    const button = page.getByRole('button', { name: label, exact: true })
    await expect(button).toBeEnabled(); await button.click()
  }
  expect(await page.evaluate(() => Reflect.get(window, 'navigationCalls'))).toEqual([
    { kind: 'review', id: 'review_abcdefgh-A' }, { kind: 'periodic', id: 'periodic_abcdefgh-A' }, { kind: 'bot', id: 'bot_abcdefgh-A' },
  ])
  for (const label of ['MISSING REVIEW', 'INVALID TARGET']) await expect.soft(page.getByRole('button', { name: label, exact: true })).toBeDisabled()
  expect(errors).toEqual([]); expect(requests).toEqual([])
})

test('같은 공급 identity에서 목적지 삭제·owner 교체 후 오래된 문서 링크는 이동하지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page, 'plan')
  const button = page.getByRole('button', { name: 'SUPPLIED REVIEW', exact: true }), old = await button.elementHandle()
  await expect(button).toBeEnabled()
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'navigationData'))
    next.documents = next.documents.filter((item: { id: string }) => item.id !== 'review_abcdefgh-A')
    Reflect.get(window, 'navigationRender')(next)
  })
  await expect(button).toBeDisabled()
  await old!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.evaluate(() => Reflect.get(window, 'navigationRender')(Reflect.get(window, 'navigationData'), 'owner-b'))
  await expect(button).toHaveCount(0)
  await old!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(await page.evaluate(() => Reflect.get(window, 'navigationCalls'))).toEqual([])
  expect(errors).toEqual([]); expect(requests).toEqual([])
})

test('전략 대시보드 상세 버튼은 실제 라우트 도달성과 같은 활성 상태를 갖는다', async ({ page }) => {
  const { requests, errors } = await mount(page, 'trading')
  const detail = page.locator('.ctt-main-tabs [role=tab]').nth(2)
  if (await detail.isVisible()) await detail.click()
  await page.locator('.cat-tabs [role=tab]').nth(1).click()
  const button = page.locator('.cat-brain [role=tabpanel]:visible .cst-context-actions').getByRole('button', { name: '전략 상세', exact: true })
  await expect(button).toBeDisabled()
  await page.evaluate(() => {
    const next = structuredClone(Reflect.get(window, 'navigationData'))
    next.strategies[0].strategy.id = 'strategy_abcdefgh-A'
    Reflect.get(window, 'navigationRender')(next)
  })
  await expect(button).toBeEnabled(); await button.click()
  expect(await page.evaluate(() => Reflect.get(window, 'navigationCalls'))).toEqual([{ kind: 'bot', id: 'strategy_abcdefgh-A' }])
  expect(errors).toEqual([]); expect(requests).toEqual([])
})
