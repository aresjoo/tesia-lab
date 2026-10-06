import { expect, test, type Page } from '@playwright/test'

// Mounted NativeServiceApp and unchanged generated SDK, synthetic GET fixtures
// only. This enforces the existing browser-session revision invariant, not a
// new schema or provider authentication guarantee.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
const sessionPath = '/api/v1/auth/session'
const csrfPath = '/api/v1/auth/csrf'
const bindingKey = 'tesia.native.session-binding'
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
type Stage = 'initial' | 'recheck-first' | 'recheck-second'
type State = { calls: string[]; blocked: string[]; errors: string[]; sessionReads: number; csrfReads: number }
const observations = new WeakMap<Page, State>()
test.afterEach(async ({ page }, testInfo) => {
  const state = observations.get(page)
  if (!state) return
  const binding = await page.evaluate(key => sessionStorage.getItem(key), bindingKey)
  testInfo.annotations.push({ type: 'SYNTHETIC_REVISION_OBSERVATION', description: JSON.stringify({ ...state, binding }) })
  expect(state.blocked, 'Every undeclared API, mutation and external request is blocked').toEqual([])
  expect(state.errors).toEqual([])
})

async function mount(page: Page, baseURL: string | undefined, sessionState: 'ANONYMOUS' | 'AUTHENTICATED',
  stage: Stage, matching: boolean, entry: '/' | '/auth/complete' = '/auth/complete') {
  if (!baseURL) throw new Error('EXPLICIT_LOOPBACK_BASE_URL_REQUIRED')
  const origin = new URL(baseURL).origin
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('LOOPBACK_ONLY')
  const state: State = { calls: [], blocked: [], errors: [], sessionReads: 0, csrfReads: 0 }
  observations.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  })
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    const api = path === '/api' || path.startsWith('/api/')
    if (!api) {
      if (method !== 'GET') { state.blocked.push('NON_FIXTURE_MUTATION'); return route.abort('blockedbyclient') }
      if (request.isNavigationRequest() && ['/', '/auth/complete'].includes(path)) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    if (method !== 'GET' || url.search || ![sessionPath, csrfPath].includes(path)) {
      state.blocked.push('UNDECLARED_API_OR_MUTATION'); return route.abort('blockedbyclient')
    }
    state.calls.push(`${method} ${path}`)
    const meta = (revision: string | null) => ({ apiContractVersion: '0.1.0', requestId: 'request_revision_fixture_01', traceId: 'trace_revision_fixture_01', resourceRevision: revision })
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === sessionPath) {
      state.sessionReads++
      if (stage !== 'initial' && state.sessionReads === 1) return route.fulfill({ status: 401, headers,
        body: JSON.stringify({ meta: meta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absence.' } }) })
      const mismatchRead = stage === 'initial' ? 1 : stage === 'recheck-first' ? 2 : 3
      const revision = !matching && state.sessionReads === mismatchRead ? '2' : '1'
      return route.fulfill({ status: 200, headers: { ...headers, ETag: '"etag_revision_fixture_0001"' },
        body: JSON.stringify({ meta: meta(revision), data: { sessionId: 'session_revision_fixture_0001', state: sessionState, revision: '1',
          issuedAt: '2030-01-01T00:00:00Z', expiresAt: sessionState === 'AUTHENTICATED' ? '2030-01-01T12:00:00Z' : '2030-01-02T00:00:00Z' } }) })
    }
    state.csrfReads++
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta(null),
      data: { csrfToken: 'csrf_revision_fixture_0001', expiresAt: '2030-01-01T12:00:00Z' } }) })
  })
  await page.goto(`${origin}${entry}`)
  if (stage !== 'initial') {
    await expect(panel(page)).toBeVisible()
    await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  }
  return state
}

for (const sessionState of ['ANONYMOUS', 'AUTHENTICATED'] as const) {
  for (const stage of ['initial', 'recheck-first', 'recheck-second'] as const) {
    test(`plain return ${sessionState} ${stage}: mismatched meta/data revision cannot adopt a session or CSRF`, async ({ page, baseURL }) => {
      const state = await mount(page, baseURL, sessionState, stage, false)
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
      await expect(page.getByRole('alert').filter({ hasText: /세션/ })).toBeVisible()
      expect(state.sessionReads).toBe(stage === 'initial' ? 1 : stage === 'recheck-first' ? 2 : 3)
      expect(state.csrfReads).toBe(0)
      expect(await page.evaluate(key => sessionStorage.getItem(key), bindingKey)).toBeNull()
      await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
      expect(state.calls.every(call => call.startsWith('GET '))).toBe(true)
    })
  }
  test(`plain return ${sessionState} initial: matching existing revision still recovers without mutation`, async ({ page, baseURL }) => {
    const state = await mount(page, baseURL, sessionState, 'initial', true)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    expect(state.csrfReads).toBe(1)
    expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: 'session_revision_fixture_0001', sessionState })
    expect(state.calls).toEqual([`GET ${sessionPath}`, `GET ${csrfPath}`])
  })
}

test('plain return authenticated matching recheck retains original successful recovery', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, 'AUTHENTICATED', 'recheck-second', true)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  expect(state.sessionReads).toBe(3); expect(state.csrfReads).toBe(1)
  expect(state.calls.every(call => call.startsWith('GET '))).toBe(true)
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
})

test('normal route browser-session already refuses mismatched revision without bootstrap', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, 'AUTHENTICATED', 'initial', false, '/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  expect(state.calls).toEqual([`GET ${sessionPath}`]); expect(state.csrfReads).toBe(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), bindingKey)).toBeNull()
})
