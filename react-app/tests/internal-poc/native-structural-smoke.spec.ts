import { expect, test, type Page } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'

const PROFILE = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
test.beforeEach(async ({ page }) => {
  await page.route('**/smoke-module-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>구조 시험 모듈</body></html>' }))
  await page.goto('/smoke-module-test.html')
})

test('existing HTML bootstrap is inert and missing report authority stays unavailable', async ({ page }) => {
  const unexpected: string[] = []
  await page.route('**/must-not-run', route => { unexpected.push(route.request().url()); return route.abort() })
  await page.route('**/internal-poc.html', route => route.fulfill({ contentType: 'text/html', headers: { 'cache-control': 'no-store' },
    body: `<html><head><meta name="tesia-structural-smoke-profile-hash" content="${PROFILE}"></head><body><script>window.forbiddenSmokeScript=true</script><img src="/must-not-run"></body></html>` }))
  const result = await page.evaluate(async profile => {
    const modulePath = '/src/internal-poc/native-structural-smoke.ts'
    const { refreshStructuralSmokeAdapter } = await import(/* @vite-ignore */ modulePath)
    const adapter = await refreshStructuralSmokeAdapter(profile)
    return { kind: adapter.kind, canReadResults: adapter.canReadResults, script: 'forbiddenSmokeScript' in window,
      metas: document.querySelectorAll('meta[name="tesia-structural-smoke-profile-hash"]').length }
  }, PROFILE)
  expect(result).toEqual({ kind: 'local-api', canReadResults: false, script: false, metas: 0 })
  expect(unexpected).toEqual([])
})

const SESSION = 'session_smoke_fixture_0001'
const meta = (revision: string | null = null) => ({ apiContractVersion: '0.1.0', requestId: 'request_smoke_fixture_0001', traceId: 'trace_smoke_fixture_0001', resourceRevision: revision })
type Harness = Awaited<ReturnType<typeof install>>
async function install(page: Page) {
  const payloads = await createFixtureRecoveryPayloads(PROFILE)
  const binding = { sessionId: SESSION, strategyVersionId: payloads.job.strategyVersionId, semanticHash: payloads.job.semanticHash, profileContentHash: PROFILE }
  const state = { sessionId: SESSION, authenticated: true, losePost: false, posts: [] as string[], resultRequests: 0,
    failReport: false, mismatch: false, swapTrades: false, waitManifest: undefined as Promise<void> | undefined,
    onCsrf: undefined as (() => void) | undefined }
  const verifier = payloads.trustedVerifierAuthority
  const values = [PROFILE, verifier.verifierPin.name, verifier.verifierPin.version, verifier.verifierPin.commitSha,
    verifier.trustAnchorContentHash, verifier.expectedReceiptContentHash, verifier.expectedSubjectContentHash]
  const names = ['structural-smoke-profile-hash', 'report-verifier-name', 'report-verifier-version', 'report-verifier-commit-sha',
    'report-trust-anchor-hash', 'report-receipt-content-hash', 'report-subject-content-hash']
  await page.route('**/internal-poc.html', route => route.fulfill({ contentType: 'text/html', headers: { 'cache-control': 'no-store' },
    body: names.map((name, index) => `<meta name="tesia-${name}" content="${values[index]}">`).join('') }))
  await page.route('**/api/v1/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    let data: unknown
    let revision: string | null = null
    let status = 200
    if (path === '/api/v1/auth/session') {
      data = { sessionId: state.sessionId, state: state.authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '2',
        issuedAt: '2026-09-13T00:00:00Z', expiresAt: '2026-09-14T00:00:00Z' }
      revision = '2'
    } else if (path === '/api/v1/auth/csrf') {
      state.onCsrf?.()
      data = { csrfToken: 'csrf_smoke_fixture_00000001', expiresAt: '2026-09-14T00:00:00Z' }
    }
    else if (path === '/api/v1/backtests' && req.method() === 'POST') {
      state.posts.push(req.headers()['idempotency-key'])
      if (state.losePost) { state.losePost = false; await route.abort('failed'); return }
      expect(req.postDataJSON()).toEqual({ strategyVersionId: binding.strategyVersionId, expectedSemanticHash: binding.semanticHash, profileId: 'STRUCTURAL_SMOKE' })
      data = payloads.job; revision = payloads.job.revision; status = 202
    } else if (path === `/api/v1/backtests/${payloads.ids.backtestId}`) {
      data = state.mismatch ? { ...payloads.job, strategyVersionId: 'sv_wrong_smoke_fixture_0001' } : payloads.job
      revision = payloads.job.revision
    } else if (path.endsWith('/report')) {
      state.resultRequests++
      if (state.failReport) { await route.abort('failed'); return }
      data = payloads.report
    } else if (path.endsWith('/manifest')) { state.resultRequests++; await state.waitManifest; data = payloads.manifest }
    else if (path.endsWith('/trades')) {
      state.resultRequests++
      const isOos = new URL(req.url()).searchParams.get('segment') === 'OOS'
      data = payloads.trades[isOos !== state.swapTrades ? 'OOS' : 'IS']
    } else { await route.abort('blockedbyclient'); return }
    await route.fulfill({ status, contentType: 'application/json', headers: revision ? { ETag: `"etag_smoke_fixture_${revision}"` } : {},
      body: JSON.stringify({ meta: meta(revision), data }) })
  })
  await page.evaluate(async binding => {
    const path = '/src/internal-poc/native-structural-smoke.ts'
    const { createNativeStructuralSmoke } = await import(/* @vite-ignore */ path)
    Object.assign(window, { smokeCurrent: true, smoke: createNativeStructuralSmoke(binding, () => (window as unknown as { smokeCurrent: boolean }).smokeCurrent) })
  }, binding)
  return { payloads, binding, state }
}

async function call(page: Page, action: 'submit' | 'status' | 'results', h: Harness) {
  return page.evaluate(async ({ action, id }) => {
    const w = window as unknown as { smoke: Record<string, (id?: string) => Promise<unknown>> }
    try { return { ok: true, value: await w.smoke[action](id) } } catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
  }, { action, id: h.payloads.ids.backtestId })
}

test('real SDK consumes explicit same-key submit, status and verified synthetic result bundle', async ({ page }) => {
  const h = await install(page)
  expect((await call(page, 'submit', h)).ok).toBe(true)
  expect((await call(page, 'status', h)).ok).toBe(true)
  const result = await call(page, 'results', h)
  expect(result.ok).toBe(true)
  expect(result.value).toMatchObject({ limitation: 'STRUCTURAL_SMOKE_SYNTHETIC_NOT_730D', job: { backtestId: h.payloads.ids.backtestId } })
  expect(h.state.posts).toHaveLength(1)
  expect(h.state.resultRequests).toBe(4)
})

test('ambiguous POST remains the same intent after module recreation', async ({ page }) => {
  const h = await install(page)
  h.state.losePost = true
  expect((await call(page, 'submit', h)).ok).toBe(false)
  await page.evaluate(async binding => {
    const path = '/src/internal-poc/native-structural-smoke.ts'
    const { createNativeStructuralSmoke } = await import(/* @vite-ignore */ path)
    Object.assign(window, { smoke: createNativeStructuralSmoke(binding, () => true) })
  }, h.binding)
  expect((await call(page, 'submit', h)).ok).toBe(true)
  expect(h.state.posts).toHaveLength(2)
  expect(h.state.posts[0]).toBe(h.state.posts[1])
})

for (const failure of ['anonymous', 'owner', 'epoch', 'storage', 'corrupt-journal'] as const) {
  test(`${failure} blocks submit before POST`, async ({ page }) => {
    const h = await install(page)
    if (failure === 'anonymous') h.state.authenticated = false
    if (failure === 'owner') h.state.sessionId = 'session_other_smoke_fixture_0001'
    if (failure === 'epoch') await page.evaluate(() => Object.assign(window, { smokeCurrent: false }))
    if (failure === 'storage') await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Synthetic storage denied') } })
    if (failure === 'corrupt-journal') await page.evaluate(binding => sessionStorage.setItem(`tesia-native-smoke-command:${JSON.stringify(binding)}`, '{'), h.binding)
    expect((await call(page, 'submit', h)).ok).toBe(false)
    expect(h.state.posts).toEqual([])
  })
}

for (const failure of ['job-binding', 'segment-swap'] as const) {
  test(`${failure} cannot produce a result bundle`, async ({ page }) => {
    const h = await install(page)
    h.state.mismatch = failure === 'job-binding'; h.state.swapTrades = failure === 'segment-swap'
    expect((await call(page, 'results', h)).ok).toBe(false)
    expect(h.state.posts).toEqual([])
  })
}

test('failed first result read keeps retry locked until every request settles', async ({ page }) => {
  const h = await install(page)
  let release: () => void = () => undefined
  h.state.failReport = true
  h.state.waitManifest = new Promise<void>(resolve => { release = resolve })
  const pending = call(page, 'results', h)
  await expect.poll(() => h.state.resultRequests).toBe(4)
  expect(await call(page, 'results', h)).toMatchObject({ ok: false, error: 'SMOKE_REQUEST_IN_FLIGHT' })
  expect(h.state.resultRequests).toBe(4)
  release()
  expect((await pending).ok).toBe(false)
  h.state.failReport = false
  expect((await call(page, 'results', h)).ok).toBe(true)
})

test('late result cannot cross a changed UI approval epoch', async ({ page }) => {
  const h = await install(page)
  let release: () => void = () => undefined
  h.state.waitManifest = new Promise<void>(resolve => { release = resolve })
  const pending = call(page, 'results', h)
  await expect.poll(() => h.state.resultRequests).toBe(4)
  await page.evaluate(() => Object.assign(window, { smokeCurrent: false }))
  release()
  expect(await pending).toMatchObject({ ok: false, error: 'SMOKE_CONTEXT_CHANGED' })
})

test('owner changes while obtaining CSRF and no POST is dispatched', async ({ page }) => {
  const h = await install(page)
  h.state.onCsrf = () => { h.state.sessionId = 'session_other_smoke_fixture_0001' }
  expect(await call(page, 'submit', h)).toMatchObject({ ok: false, error: 'SMOKE_SESSION_CHANGED' })
  expect(h.state.posts).toEqual([])
})

test('server session changes while results are pending and no bundle is returned', async ({ page }) => {
  const h = await install(page)
  let release: () => void = () => undefined
  h.state.waitManifest = new Promise<void>(resolve => { release = resolve })
  const pending = call(page, 'results', h)
  await expect.poll(() => h.state.resultRequests).toBe(4)
  h.state.sessionId = 'session_other_smoke_fixture_0001'
  release()
  expect(await pending).toMatchObject({ ok: false, error: 'SMOKE_SESSION_CHANGED' })
})

test('intent namespaces separate owner and approval without replacing prior command', async ({ page }) => {
  const h = await install(page)
  const result = await page.evaluate(async binding => {
    const path = '/src/internal-poc/native-structural-smoke.ts'
    const { structuralSmokeCommand } = await import(/* @vite-ignore */ path)
    const first = structuralSmokeCommand(binding)
    const owner = structuralSmokeCommand({ ...binding, sessionId: 'session_other_smoke_fixture_0001' })
    const approval = structuralSmokeCommand({ ...binding, strategyVersionId: 'sv_other_smoke_fixture_0001' })
    return { unique: new Set([first.idempotencyKey, owner.idempotencyKey, approval.idempotencyKey]).size,
      preserved: structuralSmokeCommand(binding).idempotencyKey === first.idempotencyKey,
      journalHasCredentials: /csrf|token|cookie/i.test(JSON.stringify(Object.values(sessionStorage))) }
  }, h.binding)
  expect(result).toEqual({ unique: 3, preserved: true, journalHasCredentials: false })
  expect(h.state.posts).toEqual([])
})

for (const failure of ['duplicate', 'wrong-profile', 'partial-verifier', 'oversized', 'cacheable', 'redirect'] as const) {
  test(`bootstrap ${failure} fails without installing authority`, async ({ page }) => {
    let body = `<meta name="tesia-structural-smoke-profile-hash" content="${failure === 'wrong-profile' ? '0'.repeat(64) : PROFILE}">`
    if (failure === 'duplicate') body += body
    if (failure === 'partial-verifier') body += '<meta name="tesia-report-verifier-name" content="fixture">'
    if (failure === 'oversized') body += 'x'.repeat(1_048_576)
    await page.route('**/internal-poc.html', route => route.fulfill({ status: failure === 'redirect' ? 302 : 200,
      contentType: 'text/html', headers: { 'cache-control': failure === 'cacheable' ? 'public' : 'no-store', ...(failure === 'redirect' ? { location: '/smoke-module-test.html' } : {}) }, body }))
    const ok = await page.evaluate(async profile => {
      const path = '/src/internal-poc/native-structural-smoke.ts'
      const { refreshStructuralSmokeAdapter } = await import(/* @vite-ignore */ path)
      try { await refreshStructuralSmokeAdapter(profile); return true } catch { return false }
    }, PROFILE)
    expect(ok).toBe(false)
  })
}
