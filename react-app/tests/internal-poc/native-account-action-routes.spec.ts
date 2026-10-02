import { expect, test, type Page } from '@playwright/test'
import type { AccountBotPresentation, AccountPeriodicPresentation, AccountPlanPresentation, AccountReviewPresentation } from '../../src/client-account-presentation'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'

test.setTimeout(25_000)
const available = '#/review/review-a'
const missing = '#/review/missing-a'
const actions = [
  { id: 'available', label: 'AVAILABLE ACTION', route: available },
  { id: 'missing', label: 'MISSING ACTION', route: missing },
  { id: 'local', label: 'LOCAL ACTION' },
  { id: 'blocked', label: 'BLOCKED LOCAL ACTION' },
]
const rows = [
  { id: 'available', label: 'AVAILABLE ROW', value: '1.00000001', route: available },
  { id: 'missing', label: 'MISSING ROW', value: '1.00000002', route: missing },
  { id: 'plain', label: 'PLAIN ROW', value: '1.00000003' },
]
const hero = { title: 'SUPPLIED HERO', label: 'SUPPLIED VALUE', value: '1.00000004' }
const plan: AccountPlanPresentation = { title: 'SUPPLIED PLAN', sourceLabel: 'SYNTHETIC UI TEST ONLY', status: { hero, gauge: null, details: rows, actions }, rebates: { hero, metrics: [], history: rows, actions }, preferences: [] }
const review: AccountReviewPresentation = { id: 'review-a', hero, sourceLabel: 'SYNTHETIC UI TEST ONLY', chips: [], causes: [], actions, reportAction: { id: 'plan', label: 'OPEN PLAN', route: '#/plan' } }
const periodic: AccountPeriodicPresentation = { id: 'period-a', hero, sourceLabel: 'SYNTHETIC UI TEST ONLY', dateLabel: 'SUPPLIED PERIOD', ring: null, metrics: [], reviews: rows, actions }
const bot: AccountBotPresentation = { id: 'bot-a', title: 'SUPPLIED BOT', sourceLabel: 'SYNTHETIC UI TEST ONLY', environment: { label: 'SUPPLIED ENVIRONMENT' }, actions, score: null, returnMetric: null, drawdownMetric: null, equity: null, orders: rows, position: null, execution: null, log: null }
const views = { plan, rebates: plan, review, periodic, bot }
type Surface = keyof typeof views
function nativeData(): NativeAccountPresentation {
  return {
    scope: 'owner-a', identity: 'route-test-a', sourceLabel: 'SYNTHETIC UI TEST ONLY', strategies: [], accounts: [],
    ledger: { pos: [], open: [], orders: [], fills: [], closed: [], assets: [] },
    plan: { title: plan.title, sourceLabel: plan.sourceLabel, sections: { plan: null, rebates: null, alerts: null }, presentation: plan },
    documents: [
      { kind: 'review', id: review.id, title: 'SUPPLIED REVIEW', sourceLabel: review.sourceLabel, fields: [], sections: [], presentation: { kind: 'review', view: review } },
      { kind: 'periodic', id: periodic.id, title: 'SUPPLIED PERIODIC', sourceLabel: periodic.sourceLabel, fields: [], sections: [], presentation: { kind: 'periodic', view: periodic } },
      { kind: 'bot', id: bot.id, title: bot.title, sourceLabel: bot.sourceLabel, fields: [], sections: [], presentation: { kind: 'bot', view: bot } },
    ],
  }
}
type Options = { surface?: Surface; native?: boolean; predicate?: boolean; navigate?: boolean; trading?: boolean; uncontrolled?: boolean }
async function mount(page: Page, options: Options = {}) {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/\/api\//.test(request.url())) requests.push(request.url()) })
  await page.route('**/account-action-routes.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101114"><div id="fixture"></div></body></html>' }))
  await page.goto('/account-action-routes.html')
  await page.evaluate(async ({ views, data, options, available }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const rp = '/@id/react', dp = '/@id/react-dom/client', sp = '/src/internal-poc/ClientServiceExperience.tsx', cp = '/src/components/ClientAccountPresentation.tsx', np = '/src/internal-poc/NativeAccountPlan.tsx', pp = '/src/client-preferences.ts'
    await import(/* @vite-ignore */sp)
    const rm = await import(/* @vite-ignore */rp), React = rm.default ?? rm, dom = await import(/* @vite-ignore */dp)
    const components = await import(/* @vite-ignore */cp), { NativeAccountPlan } = await import(/* @vite-ignore */np)
    const preferences = await import(/* @vite-ignore */pp)
    preferences.setClientPreference('language', 'ko')
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const audit = { routes: [] as unknown[], actions: [] as string[], allowed: [available], reject: undefined as undefined | (() => void) }
    const surface = options.surface ?? 'plan'
    const localAction = (id: string) => { audit.actions.push(id); return new Promise<void>((_resolve, reject) => { audit.reject = () => reject(new Error('SUPPLIED TEST FAILURE')) }) }
    const render = (next = data, owner = 'owner-a') => {
      const shared = { onNavigate: options.navigate === false ? undefined : (route: unknown) => audit.routes.push(route), onAction: localAction, isActionAvailable: (id: string) => id !== 'blocked', ...(options.predicate === false ? {} : { canNavigate: (route: string) => audit.allowed.includes(route) }) }
      const names = { plan: 'ClientAccountPlanPresentation', rebates: 'ClientAccountPlanPresentation', review: 'ClientAccountReviewPresentation', periodic: 'ClientAccountPeriodicPresentation', bot: 'ClientAccountBotPresentation' }
      const props = options.native ? {
        accountScope: owner, presentation: next, onReturn: () => {}, onTrading: options.trading ? () => audit.routes.push('#/trade') : undefined,
        onNavigate: shared.onNavigate,
        location: options.uncontrolled ? undefined : surface === 'plan' || surface === 'rebates' ? { kind: 'plan', tab: surface } : { kind: surface, id: surface === 'review' ? 'review-a' : surface === 'periodic' ? 'period-a' : 'bot-a' },
      } : { ...shared, view: views[surface], tab: surface === 'rebates' ? 'rebates' : 'plan' }
      root.render(React.createElement(React.StrictMode, null, React.createElement(options.native ? NativeAccountPlan : components[names[surface]], props)))
    }
    Object.assign(window, { routeAudit: audit, routeRender: render, routeData: data })
    render()
  }, { views, data: nativeData(), options, available })
  await expect(page.locator('.client-account-activity').first()).toBeVisible()
  expect(errors, 'fixture must mount without runtime errors').toEqual([])
  return { errors, requests }
}
async function recorded(page: Page) { return page.evaluate(() => Reflect.get(window, 'routeAudit').routes) }

for (const surface of ['plan', 'rebates', 'review', 'periodic', 'bot'] as const) {
  test(`${surface}: supplied route availability disables unreachable actions without dropping supplied text`, async ({ page }) => {
    const audit = await mount(page, { surface })
    const good = page.getByRole('button', { name: 'AVAILABLE ACTION', exact: true })
    await expect(good).toBeEnabled(); await good.click()
    expect(await recorded(page)).toEqual([available])
    await expect(page.getByRole('button', { name: 'MISSING ACTION', exact: true })).toBeDisabled({ timeout: 1500 })
    expect(audit.errors).toEqual([]); expect(audit.requests).toEqual([])
  })
}
for (const surface of ['plan', 'rebates', 'periodic', 'bot'] as const) {
  test(`${surface}: supplied route availability disables unreachable rows and preserves exact adjacent values`, async ({ page }) => {
    await mount(page, { surface })
    await page.getByRole('button', { name: 'AVAILABLE ROW 1.00000001', exact: true }).click()
    expect(await recorded(page)).toEqual([available])
    await expect(page.getByText('1.00000002', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /PLAIN ROW/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'MISSING ROW 1.00000002', exact: true })).toBeDisabled({ timeout: 1500 })
  })
}
for (const target of ['action', 'row', 'breadcrumb', 'tab'] as const) {
  test(`${target}: a target revoked after render is rechecked before dispatch`, async ({ page }) => {
    await mount(page, { surface: target === 'breadcrumb' ? 'review' : 'plan', predicate: true })
    await page.evaluate(() => { const a = Reflect.get(window, 'routeAudit'); a.allowed.push('#/trade', '#/plan'); Reflect.get(window, 'routeRender')() })
    const button = target === 'action' ? page.getByRole('button', { name: 'AVAILABLE ACTION', exact: true }) : target === 'row' ? page.getByRole('button', { name: 'AVAILABLE ROW 1.00000001', exact: true }) : target === 'breadcrumb' ? page.locator('.nfx-bc button') : page.locator('.nfx-tabs button').first()
    await expect(button).toBeEnabled()
    // No rerender: dispatch-time availability must agree with the visible port's latest facts.
    await page.evaluate(() => { Reflect.get(window, 'routeAudit').allowed = [] })
    await button.click()
    expect(await recorded(page)).toEqual([])
  })
}
test('hardcoded PLAN destinations obey the same availability predicate', async ({ page }) => {
  await mount(page)
  for (const tab of await page.locator('.nfx-tabs button').all()) await expect.soft(tab).toBeDisabled({ timeout: 1000 })
  expect(await recorded(page)).toEqual([])
})
test('hardcoded trading breadcrumb obeys the same availability predicate', async ({ page }) => {
  await mount(page, { surface: 'review' })
  await expect(page.locator('.nfx-bc button')).toBeDisabled({ timeout: 1500 })
})
test('omitted predicate preserves preview navigation; absent callback never enables a route', async ({ page }) => {
  await mount(page, { predicate: false })
  await page.getByRole('button', { name: 'MISSING ACTION', exact: true }).click()
  await page.getByRole('button', { name: 'MISSING ROW 1.00000002', exact: true }).click()
  expect(await recorded(page)).toEqual([missing, missing])
  await mount(page, { navigate: false })
  await expect(page.getByRole('button', { name: 'AVAILABLE ACTION', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'AVAILABLE ROW 1.00000001', exact: true })).toBeDisabled()
})
test('route-less actions retain availability, pending duplicate lock and failure retry', async ({ page }) => {
  const audit = await mount(page)
  await page.evaluate(() => { Reflect.get(window, 'routeAudit').allowed = []; Reflect.get(window, 'routeRender')() })
  const button = page.getByRole('button', { name: 'LOCAL ACTION', exact: true })
  await expect(page.getByRole('button', { name: 'BLOCKED LOCAL ACTION', exact: true })).toBeDisabled()
  await button.click(); await expect(button).toBeDisabled()
  await button.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(await page.evaluate(() => Reflect.get(window, 'routeAudit').actions)).toEqual(['local'])
  await page.evaluate(() => Reflect.get(window, 'routeAudit').reject())
  await expect(page.getByRole('alert')).toContainText('요청을 완료하지 못했어요')
  await expect(button).toBeEnabled(); await button.click()
  expect(await page.evaluate(() => Reflect.get(window, 'routeAudit').actions)).toEqual(['local', 'local'])
  expect(await recorded(page)).toEqual([]); expect(audit.errors).toEqual([]); expect(audit.requests).toEqual([])
})
test('native owner-bound supplied route opens, missing document action and row are disabled', async ({ page }) => {
  const audit = await mount(page, { native: true })
  await page.getByRole('button', { name: 'AVAILABLE ACTION', exact: true }).click()
  expect(await recorded(page)).toEqual([{ kind: 'review', id: 'review-a' }])
  await expect.soft(page.getByRole('button', { name: 'MISSING ACTION', exact: true })).toBeDisabled({ timeout: 1500 })
  await expect.soft(page.getByRole('button', { name: 'MISSING ROW 1.00000002', exact: true })).toBeDisabled({ timeout: 1500 })
  expect(audit.errors).toEqual([]); expect(audit.requests).toEqual([])
})
test('native target removal and owner replacement cannot activate stale document actions', async ({ page }) => {
  await mount(page, { native: true })
  const button = page.getByRole('button', { name: 'AVAILABLE ACTION', exact: true }), old = await button.elementHandle()
  await expect(button).toBeEnabled()
  await page.evaluate(() => { const next = structuredClone(Reflect.get(window, 'routeData')); next.documents = []; Reflect.get(window, 'routeRender')(next) })
  await expect.soft(button).toBeDisabled({ timeout: 1500 })
  await old!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.evaluate(() => Reflect.get(window, 'routeRender')(Reflect.get(window, 'routeData'), 'owner-b'))
  await expect(button).toHaveCount(0)
  await old!.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  expect(await recorded(page)).toEqual([])
})
test('native independent PLAN retains local tabs without a navigation callback', async ({ page }) => {
  await mount(page, { native: true, uncontrolled: true, navigate: false })
  const rebate = page.locator('.nfx-tabs button').nth(1)
  await expect(rebate).toBeEnabled(); await rebate.click()
  await expect(rebate).toHaveAttribute('aria-current', 'page')
  expect(await recorded(page)).toEqual([])
})
test('native controlled PLAN without a navigation callback cannot advertise tab changes', async ({ page }) => {
  await mount(page, { native: true, navigate: false })
  await expect(page.locator('.nfx-tabs button').nth(1)).toBeDisabled({ timeout: 1500 })
  await expect(page.locator('.nfx-tabs button').first()).toHaveAttribute('aria-current', 'page')
})
test('native document without callbacks cannot advertise PLAN navigation or trading return', async ({ page }) => {
  await mount(page, { native: true, surface: 'review', navigate: false })
  await expect.soft(page.getByRole('button', { name: 'OPEN PLAN', exact: true })).toBeDisabled({ timeout: 1500 })
  await expect.soft(page.locator('.nfx-bc button')).toBeDisabled({ timeout: 1500 })
  expect(await recorded(page)).toEqual([])
})
test('native real trading callback remains usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const audit = await mount(page, { native: true, surface: 'review', trading: true })
  const button = page.locator('.nfx-bc button')
  await expect(button).toBeEnabled(); await button.click()
  expect(await recorded(page)).toEqual(['#/trade'])
  expect(audit.errors).toEqual([]); expect(audit.requests).toEqual([])
})
