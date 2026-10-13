import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { CopyResponse, VersionResponse, VersionListResponse } from '../src/copy-execution/fixtures/api-v0.18/types'
const cases = JSON.parse(readFileSync(new URL('./copy-execution/wire-cases.json', import.meta.url), 'utf8')) as { cases: { name: string; value: unknown }[] }

test.setTimeout(35000)
const original = readFileSync(new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url), 'utf8')
const catalogue = JSON.parse(original), item = catalogue.items[0], sourceSha = createHash('sha256').update(original).digest('hex')
type WireSamples = { version: VersionResponse; 'copy-unconnected': CopyResponse; 'version-list': VersionListResponse }
const sample = <Name extends keyof WireSamples>(name: Name) => structuredClone(cases.cases.find(row => row.name === name)!.value) as WireSamples[Name]
async function mount(page: Page, mode: 'normal' | 'unbound' | 'stale' | 'lost' | 'settling' | 'lost-start' | 'never-ready' | 'ready-quote-stale' | 'ready-budget-low' = 'normal', development = false) {
  const version = sample('version'), sessionId = 'session_fixture_000001', connectionId = 'connection_fixture_00001'
  const binding = { sourceSha, sourceId: item.id, strategyId: version.data.strategyId, versionId: version.data.versionId, policyHash: version.data.policyHash, environment: 'demo' }
  const deployment = JSON.stringify({ schema: 1, environment: 'demo', bindings: mode === 'unbound' ? [] : [binding] })
  const pin = createHash('sha256').update(deployment).digest('hex'), posts: { path: string; body: Record<string, unknown>; key: string }[] = []
  const state = { minimum: mode !== 'stale', created: false, active: false, lose: mode === 'lost', loseStart: mode === 'lost-start', settings: {} as Record<string, unknown>, createdAt: 0, settlingReads: 0, copyReads: 0, startReadCounts: [] as number[], readyRead: false, abortCreateRead: false, abortStartRead: false, availableLow: false, abortAfterCsrf: false, abortAfterStartCsrf: false, abortConnectionRead: false }
  const copy = () => {
    const value = sample('copy-unconnected'); value.data.versionId = binding.versionId; value.data.policyHash = binding.policyHash; value.data.connectionId = connectionId
    Object.assign(value.data, state.settings)
    value.data.state = state.active ? 'ACTIVE' : 'CREATED'; value.data.revision = state.active ? 1 : 0
    value.data.execution.origin = 'synthetic'; value.data.execution.observedAt = new Date().toISOString()
    const settling = mode === 'never-ready' || mode === 'settling' && state.created && Date.now() - state.createdAt < 300
    value.data.execution.availability.start = { available: !state.active && !settling, reason: state.active ? 'RUNTIME_UNAVAILABLE' : settling ? 'ACCOUNT_FACTS_UNAVAILABLE' : null }
    value.data.execution.availability.pause = { available: true, reason: null }; value.data.execution.availability.stop = { available: true, reason: null }
    return value
  }
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: original }))
  await page.route('**/__teth/execution-minimum', route => {
    const now = Date.now()
    if (!state.minimum) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"MINIMUM_MARKET_STALE"}' })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ schemaVersion: 'bitget-copy-minimum-0.1', venue: 'bitget', symbol: 'BTCUSDT', asOf: new Date(now - 1).toISOString(), expiresAt: new Date(now + 2999).toISOString(), snapshotRuleSha256: 'b'.repeat(64), quoteSha256: 'c'.repeat(64), estimates: { [item.policyVersionId]: { descriptorPolicyHash: item.provenance.policyDefinitionSha256, minimumAllocationUsdt: '334.92280000', requiredAvailableUsdt: '334.92280000', requiredMaxLossUsdt: '0.41865350', riskRequiredAvailableUsdt: '16.82987070', status: 'estimated' } } }) })
  })
  await page.route('**/assets/copy-execution-deployment.json', route => route.fulfill({ contentType: 'application/json', body: deployment }))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/\/$/, '')
    if (request.method() !== 'GET') posts.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] ?? '' })
    const json = (value: unknown, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store', ...headers }, body: JSON.stringify(value) })
    const meta = { apiContractVersion: '0.1.0', requestId: 'request_fixture_000001', traceId: 'trace_fixture_000001', resourceRevision: path.endsWith('/session') ? '1' : null }
    if (path === '/api/v1/auth/session') return json({ meta, data: { sessionId, state: 'AUTHENTICATED', revision: '1', issuedAt: '2026-10-12T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }, 200, { ETag: '"session_fixture_000001"' })
    if (path === '/api/v1/auth/csrf') { if (state.abortAfterCsrf || state.abortAfterStartCsrf && state.created) { state.abortAfterCsrf = false; state.abortAfterStartCsrf = false; state.abortConnectionRead = true } return json({ meta, data: { csrfToken: 'csrf_fixture_000000001', expiresAt: '2030-01-02T00:00:00Z' } }) }
    if (path === '/api/v1/exchange-connections') { if (state.abortConnectionRead) { state.abortConnectionRead = false; return route.abort() } return json({ apiContractVersion: '0.12.0', data: { connections: [{ connectionId, exchangeId: 'bitget', connectedAt: '2026-10-12T00:00:00Z', maskedAccountLabel: '***01', status: 'connected', permissionsVerified: true, permissions: { read: true, spotTrade: true, futuresTrade: true, withdrawal: false } }] } }) }
    if (path.endsWith('/account')) {
      const section = (status: string, items: unknown[] = []) => ({ status, reason: status === 'unavailable' ? 'PROVIDER_UNAVAILABLE' : null, items })
      const balances = section('ok', [{ coin: 'USDT', equity: null, balance: null, available: state.availableLow || mode === 'ready-budget-low' && state.readyRead ? '100.0000' : '1000.0000', frozen: null, locked: null, unrealizedPnl: null }])
      return json({ apiContractVersion: '0.17.0', data: { connectionId, exchangeId: 'bitget', accountMode: 'classic', observedAt: new Date(Date.now() - 100).toISOString(), products: [{ product: 'spot', balances, positions: section('not_applicable') }, { product: 'USDT-FUTURES', balances, positions: section('ok') }, ...['USDC-FUTURES', 'COIN-FUTURES'].map(product => ({ product, balances: section('unavailable'), positions: section('unavailable') }))] } })
    }
    if (path === '/api/v1/copy-strategy-versions') { const rows = sample('version-list'); return json(rows) }
    if (path.startsWith('/api/v1/copy-strategy-versions/')) { if (state.abortCreateRead) { state.abortCreateRead = false; return route.abort() } return json(version) }
    if (path === '/api/v1/strategy-copies' && request.method() === 'GET') return json({ apiContractVersion: '0.18.0', data: [], nextCursor: null })
    if (path === '/api/v1/strategy-copies' && request.method() === 'POST') { state.created = true; state.createdAt = Date.now(); state.settings = request.postDataJSON(); delete state.settings.apiContractVersion; delete state.settings.environment; delete state.settings.versionId; if (state.lose) { state.lose = false; return route.abort() } return json(copy(), 201) }
    if (path.endsWith('/start')) { state.startReadCounts.push(state.copyReads); state.active = true; if (state.loseStart) { state.loseStart = false; return route.abort() } return json(copy()) }
    if (path.endsWith('/pause') || path.endsWith('/stop')) return json(copy())
    if (path.startsWith('/api/v1/strategy-copies/')) {
      state.copyReads++
      if (state.abortStartRead && state.copyReads === 2) { state.abortStartRead = false; return route.abort() }
      if (mode === 'settling' && state.created && state.settlingReads++ === 0) return json({ apiContractVersion: '0.18.0', error: { code: 'EXECUTION_UNAVAILABLE', message: 'EXECUTION_UNAVAILABLE' } }, 503)
      const response = copy()
      if (state.created && response.data.execution.availability.start.available) {
        state.readyRead = true
        if (mode === 'ready-quote-stale') state.minimum = false
      }
      return json(response)
    }
    return route.abort()
  })
  await page.goto('/#/share')
  if (development) await page.evaluate(async ({ version, id, sourceSha }) => {
    const transformed = await (await fetch('/tests/copy-execution/runtime-harness.tsx')).text()
    const reactPath = transformed.match(/from ["']([^"']*\/react\.js[^"']*)["']/)?.[1], rootPath = transformed.match(/from ["']([^"']*\/react-dom_client\.js[^"']*)["']/)?.[1]
    if (!reactPath || !rootPath) throw new Error('ACTUAL_REACT_MODULE_UNAVAILABLE')
    const hookPath = '/src/copy-execution/use-copy-execution.ts', fixturePath = '/src/copy-execution/candidate-fixture.ts', rendererPath = '/src/internal-poc/NativeStrategies.tsx'
    const React = (await import(reactPath)).default, { createRoot } = (await import(rootPath)).default
    const { useCandidateCopyExecution } = await import(hookPath), { api18CandidateFixture } = await import(fixturePath), { NativeStrategies } = await import(rendererPath)
    const node = document.createElement('main'); document.body.replaceChildren(node); let budgetReads = 0, availableUsdt = '1000.75'
    const owner = 'session_fixture_000001', session = { current: async () => ({ body: { data: { sessionId: owner, state: 'AUTHENTICATED' } } }), csrf: async () => ({ body: { data: { csrfToken: 'csrf_fixture_000000001' } } }) }
    const input = { fixture: api18CandidateFixture, connectionId: 'connection_fixture_00001', environment: 'demo',
      readIssuedBinding: async (_scope: unknown, source: { sourceSha: string; sourceId: string }) => ({ ...source, strategyId: version.strategyId, versionId: version.versionId, policyHash: version.policyHash, environment: 'demo' }),
      readAvailableBudget: async () => ({ availableUsdt, revision: `budget_fixture_${++budgetReads}`, expiresAtMs: Date.now() + 10000 }) }
    function Harness() {
      const [location, navigate] = React.useState({ nick: id, period: 'all' })
      const actual = useCandidateCopyExecution(input, true, session, () => ({ sessionId: owner, sessionState: 'AUTHENTICATED' }), owner)
      // Explicit presentation fixture only; the real hook still reads and validates its SDK-issued version.
      const port = actual ? { ...actual, bindingForSource: (source: { sourceSha: string; sourceId: string }) => source.sourceSha === sourceSha && source.sourceId === id ? { ...source, strategyId: version.strategyId, versionId: version.versionId, policyHash: version.policyHash, environment: 'demo' } : null } : undefined
      return React.createElement('div', { className: 'client-source-app' }, React.createElement(NativeStrategies, { owner, catalogueCopyExecution: port, location, onNavigate: navigate, signedIn: true, onLogin: () => undefined, onReturn: () => navigate({ period: 'all' }), shouldFocus: () => true, onTabChange: () => undefined }))
    }
    createRoot(node).render(React.createElement(Harness)); Reflect.set(window, 'actualWorkflow', { budgetReads: () => budgetReads, budget: (value: string) => { availableUsdt = value } })
  }, { version: version.data, id: item.id, sourceSha })
  else await page.evaluate(async ({ pin, id }) => { const module = await import('/tests/fixtures/evaluated-copy-runtime-harness.tsx'); window.copyFixture = module.mountEvaluatedCopyRuntime(pin, id) }, { pin, id: item.id })
  return { state, posts }
}
test('actual SDK production hook connects the exact evaluated source to fresh minimum setup and start', async ({ page }) => {
  const { posts } = await mount(page)
  const detail = page.locator('[data-evaluated-strategy]')
  await expect(detail.locator('[data-catalogue-source-minimum]')).toHaveText('최소 운용 금액 334.93 USDT')
  await expect.poll(() => page.evaluate(() => window.copyFixture.initialization())).toBe('deployment-loaded')
  const copy = detail.getByRole('button', { name: '전략 복사하기', exact: true }); await expect(copy).toBeEnabled(); await copy.click()
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible()
  const amount = dialog.getByLabel('복사 예산', { exact: true }); await amount.fill('334.92279999')
  await expect(dialog.locator('button[type="submit"]')).toBeDisabled()
  await amount.fill('400'); await dialog.locator('button[type="submit"]').click()
  await expect(dialog).not.toBeVisible()
  expect(posts.map(p => p.path)).toEqual(['/api/v1/strategy-copies', `/api/v1/strategy-copies/${sample('copy-unconnected').data.subscriptionId}/start`])
  expect(posts[0].body.allocationUsdt).toBe('400'); expect(posts[0].body.versionId).toBe(sample('version').data.versionId)
  await expect(page.locator('[data-metric="net"]')).toHaveText('—')
})
test('unbound source and failed quotes authorize no create; fresh confirmation rechecks an expired quote', async ({ page }) => {
  const { state, posts } = await mount(page)
  const copy = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
  await expect(copy).toBeEnabled(); await copy.click()
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  state.minimum = false; await dialog.locator('button[type="submit"]').click()
  await expect(dialog).toBeVisible(); expect(posts).toEqual([])
  await page.reload(); await mount(page, 'unbound')
  await expect(page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })).toBeDisabled()
})

test('UNKNOWN create replays the original body and key despite quote failure, while a new start stays blocked', async ({ page }) => {
  const { state, posts } = await mount(page, 'lost')
  const copy = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
  await expect(copy).toBeEnabled(); await copy.click()
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  const confirm = dialog.locator('button[type="submit"]'); await confirm.click()
  await expect.poll(() => posts.length).toBe(1)
  await expect(confirm).toHaveAttribute('aria-busy', 'false')
  state.minimum = false; await confirm.click()
  await expect.poll(() => posts.length).toBe(2)
  expect(posts[1]).toEqual(posts[0]); expect(posts.map(row => row.path)).toEqual(['/api/v1/strategy-copies', '/api/v1/strategy-copies'])
  await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(copy).toBeEnabled(); await copy.click()
  await expect(page.locator('[data-metric="net"]')).toHaveText('—')
})


test('a single confirmation waits for newly created signed account facts and sends exactly one start', async ({ page }) => {
  const { state, posts } = await mount(page, 'settling')
  const detail = page.locator('[data-evaluated-strategy]')
  const button = detail.getByRole('button', { name: '전략 복사하기', exact: true }); await expect(button).toBeEnabled(); await button.click()
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  await dialog.locator('button[type="submit"]').click()
  await expect(dialog).not.toBeVisible()
  expect(state.settlingReads).toBeGreaterThanOrEqual(3)
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies', `/api/v1/strategy-copies/${sample('copy-unconnected').data.subscriptionId}/start`])
})

test('UNKNOWN start replays its original key and revision without readiness reads or fresh quotes', async ({ page }) => {
  const { state, posts } = await mount(page, 'lost-start')
  const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
  await expect(button).toBeEnabled(); await button.click()
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  const confirm = dialog.locator('button[type="submit"]'); await confirm.click()
  await expect.poll(() => posts.length).toBe(2)
  await expect(confirm).toHaveAttribute('aria-busy', 'false')
  state.minimum = false
  await confirm.click()
  await expect(dialog).not.toBeVisible()
  expect(posts).toHaveLength(3); expect(posts[2]).toEqual(posts[1])
  expect(posts[1].body.expectedRevision).toBe(0)
  expect(state.startReadCounts).toHaveLength(2); expect(state.startReadCounts[1]).toBe(state.startReadCounts[0])
})

test('permanent readiness failure terminates after four reads with no start POST', async ({ page }) => {
  const { state, posts } = await mount(page, 'never-ready')
  const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
  await expect(button).toBeEnabled(); await button.click()
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  const confirm = dialog.locator('button[type="submit"]'); await confirm.click()
  await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(state.copyReads).toBe(4)
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies'])
  await expect(dialog).toBeVisible()
})

for (const mode of ['ready-quote-stale', 'ready-budget-low'] as const) {
  test(`ready copy rechecks ${mode} before its first start POST`, async ({ page }) => {
    const { state, posts } = await mount(page, mode)
    const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
    await expect(button).toBeEnabled(); await button.click()
    const dialog = page.getByRole('dialog'); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
    const confirm = dialog.locator('button[type="submit"]'); await confirm.click()
    await expect(confirm).toHaveAttribute('aria-busy', 'false')
    expect(state.readyRead).toBe(true)
    expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies'])
    await expect(dialog).toBeVisible()
  })
}


for (const mode of ['settling', 'never-ready', 'lost', 'lost-start'] as const) {
  test(`development actual hook preserves readiness and replay boundaries for ${mode}`, async ({ page }) => {
    const { state, posts } = await mount(page, mode, true)
    await page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '전략 복사', exact: true })
    await expect(dialog).toBeVisible(); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
    const confirm = dialog.locator('button[type="submit"]'); await confirm.click()
    if (mode === 'never-ready') {
      await expect(confirm).toHaveAttribute('aria-busy', 'false')
      expect(state.copyReads).toBe(4); expect(posts).toHaveLength(1); await expect(dialog).toBeVisible()
    } else if (mode === 'settling') {
      await expect(dialog).not.toBeVisible(); expect(state.settlingReads).toBeGreaterThanOrEqual(3)
      expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies', `/api/v1/strategy-copies/${sample('copy-unconnected').data.subscriptionId}/start`])
      expect(await page.evaluate(() => Reflect.get(window, 'actualWorkflow').budgetReads())).toBe(3)
    } else {
      await expect.poll(() => posts.length).toBe(mode === 'lost' ? 1 : 2)
      await expect(confirm).toHaveAttribute('aria-busy', 'false')
      const budgets = await page.evaluate(() => Reflect.get(window, 'actualWorkflow').budgetReads())
      await confirm.click(); await expect(dialog).not.toBeVisible()
      if (mode === 'lost-start') {
        expect(posts).toHaveLength(3); expect(posts[2]).toEqual(posts[1]); expect(state.startReadCounts).toHaveLength(2); expect(state.startReadCounts[1]).toBe(state.startReadCounts[0])
        expect(await page.evaluate(() => Reflect.get(window, 'actualWorkflow').budgetReads())).toBe(budgets)
      } else {
        expect(posts).toHaveLength(3); expect(posts[1]).toEqual(posts[0]); expect(posts[2].path.endsWith('/start')).toBe(true)
        expect(await page.evaluate(() => Reflect.get(window, 'actualWorkflow').budgetReads())).toBe(budgets + 1)
      }
      expect(posts.at(-1)!.body.expectedRevision).toBe(0)
    }
  })
}


// GET failure is not a sent mutation: every first POST still needs fresh money evidence.
for (const development of [false, true]) for (const stage of ['create', 'start'] as const) for (const failure of ['quote', 'budget'] as const) {
  test(`exact intent ${development ? 'development' : 'service'} ${stage} preflight GET failure cannot bypass fresh ${failure}`, async ({ page }) => {
    const { state, posts } = await mount(page, 'normal', development)
    const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true })
    await expect(button).toBeEnabled(); await button.click()
    const dialog = page.getByRole('dialog', { name: '전략 복사', exact: true }); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
    const confirm = dialog.locator('button[type="submit"]')
    if (stage === 'create') state.abortCreateRead = true
    else state.abortStartRead = true
    await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
    expect(posts.map(post => post.path)).toEqual(stage === 'create' ? [] : ['/api/v1/strategy-copies'])
    if (failure === 'quote') state.minimum = false
    else if (development) await page.evaluate(() => Reflect.get(window, 'actualWorkflow').budget('100'))
    else state.availableLow = true
    await confirm.click(); await expect.poll(async () => await dialog.count() === 0 || await confirm.getAttribute('aria-busy') === 'false').toBe(true)
    expect(posts.map(post => post.path)).toEqual(stage === 'create' ? [] : ['/api/v1/strategy-copies'])
    await expect(dialog).toBeVisible()
  })
}


test('SDK dispatch preparation failed before raw create POST still requires fresh quote', async ({ page }) => {
  const { state, posts } = await mount(page)
  const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true }); await expect(button).toBeEnabled(); await button.click()
  const dialog = page.getByRole('dialog', { name: '전략 복사', exact: true }); await dialog.getByLabel('복사 예산', { exact: true }).fill('400')
  state.abortAfterCsrf = true
  const confirm = dialog.locator('button[type="submit"]'); await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(posts).toHaveLength(0); expect(state.abortConnectionRead).toBe(false)
  state.minimum = false; await confirm.click(); await expect.poll(async () => await dialog.count() === 0 || await confirm.getAttribute('aria-busy') === 'false').toBe(true)
  expect(posts).toHaveLength(0); await expect(dialog).toBeVisible()
})


test('SDK start pre-dispatch authority failure recovers with original create settings and one start POST', async ({ page }) => {
  const { state, posts } = await mount(page)
  const button = page.locator('[data-evaluated-strategy]').getByRole('button', { name: '전략 복사하기', exact: true }); await expect(button).toBeEnabled(); await button.click()
  const dialog = page.getByRole('dialog', { name: '전략 복사', exact: true }), amount = dialog.getByLabel('복사 예산', { exact: true })
  await amount.fill('400'); state.abortAfterStartCsrf = true
  const confirm = dialog.locator('button[type="submit"]'); await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies']); expect(state.abortConnectionRead).toBe(false)
  state.minimum = false; await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies'])
  state.minimum = true; state.availableLow = true; await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies'])
  state.availableLow = false
  await amount.fill('500'); await confirm.click(); await expect(confirm).toHaveAttribute('aria-busy', 'false')
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies'])
  await amount.fill('400'); await confirm.click(); await expect(dialog).not.toBeVisible()
  expect(posts.map(post => post.path)).toEqual(['/api/v1/strategy-copies', `/api/v1/strategy-copies/${sample('copy-unconnected').data.subscriptionId}/start`])
  expect(posts[1].body.expectedRevision).toBe(0); expect(posts[0].body.allocationUsdt).toBe('400')
})
