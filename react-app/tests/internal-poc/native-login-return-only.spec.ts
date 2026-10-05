import { expect, test, type Page } from '@playwright/test'

// Actual React panel/controller/generated SDK in an explicit Vite HTML fixture.
// Host callbacks are test-only adoption outcomes, never an API authorization.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
const oldOwner = 'session_return_panel_old_0001', authOwner = 'session_return_panel_auth_0001'
const resultId = 'oauth_result_return_panel_0001', transactionId = 'oidc_tx_return_panel_0001'
const anonymousEtag = '"etag_return_panel_anon_007"', authenticatedEtag = '"etag_return_panel_auth_001"'
const resultEtag = '"etag_return_panel_result_001"', ackCsrf = 'csrf_return_panel_ack_fixture_001'
const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_return_panel_fixture_001', traceId: 'trace_return_panel_fixture_001' })
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const selectResult = (page: Page) => panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true })
const confirm = (page: Page) => panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
type Options = { returnOnly?: boolean; current?: boolean; rejectHost?: boolean; loseAck?: boolean; holdResult?: boolean; holdAck?: boolean; holdStart?: boolean }
type State = { calls: string[]; blocked: string[]; keys: string[]; starts: number; results: number; acks: number; errors: string[];
  releaseResult: () => void; releaseAck: () => void; releaseStart: () => void; harnessModules: string[] }
const observations = new WeakMap<Page, State>()
test.afterEach(async ({ page }, testInfo) => {
  const state = observations.get(page)
  if (!state) return
  testInfo.annotations.push({ type: 'SYNTHETIC_RETURN_PANEL_ONLY', description: JSON.stringify({ ...state, releaseResult: undefined, releaseAck: undefined }) })
  expect(state.blocked).toEqual([]); expect(state.errors).toEqual([])
})

async function mount(page: Page, baseURL: string | undefined, options: Options = {}) {
  if (!baseURL) throw new Error('EXPLICIT_LOOPBACK_BASE_URL_REQUIRED')
  const origin = new URL(baseURL).origin
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('LOOPBACK_ONLY')
  let releaseResult!: () => void, releaseAck!: () => void, releaseStart!: () => void
  const resultGate = new Promise<void>(resolve => { releaseResult = resolve })
  const ackGate = new Promise<void>(resolve => { releaseAck = resolve })
  const startGate = new Promise<void>(resolve => { releaseStart = resolve })
  const state: State = { calls: [], blocked: [], keys: [], starts: 0, results: 0, acks: 0, errors: [], releaseResult, releaseAck, releaseStart, harnessModules: [] }
  observations.set(page, state)
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(({ oldOwner, anonymousEtag }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('tesia.native.auth-claim-precondition', JSON.stringify({ provider: 'GOOGLE', sessionId: oldOwner, revision: '7', etag: anonymousEtag }))
  }, { oldOwner, anonymousEtag })
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="panel-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default:React} = await import('__REACT_MODULE__'); const {default:ReactDOM} = await import('__REACT_DOM_MODULE__');
    const {NativeLoginPanel} = await import('/src/internal-poc/NativeLoginPanel.tsx');
    const root=ReactDOM.createRoot(document.getElementById('panel-root'));
    const control=window.returnHarness={current:${options.current !== false},hidden:false,resume:0,adoptions:0,sessionRecoveries:0,emailAdoptions:0,rejectHost:${options.rejectHost === true},returnOnly:${options.returnOnly !== false}};
    control.render=()=>root.render(React.createElement(NativeLoginPanel,{returnOnly:control.returnOnly,hidden:control.hidden,resumeToken:control.resume,returning:true,sourceLayout:false,providers:['GOOGLE','APPLE'],enabledProviders:['GOOGLE'],emailAvailable:true,isCurrent:()=>control.current,
      onAuthenticated:async()=>{control.adoptions++;if(control.rejectHost)throw new Error('SYNTHETIC_HOST_REFUSAL');},
      onSessionRecovered:async()=>{control.sessionRecoveries++;if(control.rejectHost)throw new Error('SYNTHETIC_HOST_REFUSAL');},
      onEmailAuthenticated:()=>{control.emailAdoptions++;},onClose:()=>{control.hidden=true;control.render();}}));
    control.setCurrent=value=>{control.current=value;control.render();};control.setReturnOnly=value=>{control.returnOnly=value;control.render();};control.reopen=()=>{control.hidden=false;control.resume++;control.render();};control.hide=()=>{control.hidden=true;control.render();};control.render();
  </script></body></html>`
  // A single context guard owns all routes, including external and exact /api.
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    const api = path === '/api' || path.startsWith('/api/')
    if (!api) {
      if (method !== 'GET') { state.blocked.push('NON_FIXTURE_MUTATION'); return route.abort('blockedbyclient') }
      if (request.isNavigationRequest() && path === '/auth/complete' && !url.search) {
        // Fixed local PUBLIC source GET, never an auth/API request. Consume the
        // real Vite import identities instead of creating a second React copy.
        const compiled = await route.fetch({ url: `${origin}/src/internal-poc/service-main.tsx`, method: 'GET' })
        expect(compiled.status()).toBe(200)
        const body = await compiled.text()
        const react = body.match(/["'](\/node_modules\/\.vite(?:-e2e-[0-9]+)?\/deps\/react\.js\?v=[A-Za-z0-9]+)["']/)?.[1]
        const dom = body.match(/["'](\/node_modules\/\.vite(?:-e2e-[0-9]+)?\/deps\/react-dom_client\.js\?v=[A-Za-z0-9]+)["']/)?.[1]
        if (!react || !dom) throw new Error('EXACT_VITE_MODULE_IDENTITIES_REQUIRED')
        state.harnessModules = [react, dom]
        return route.fulfill({ contentType: 'text/html', body: html.replace('__REACT_MODULE__', react).replace('__REACT_DOM_MODULE__', dom) })
      }
      return route.continue()
    }
    const declared = !url.search && (method === 'GET' && ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path)
      || method === 'POST' && ['/api/v2/auth/google/transactions', ackPath].includes(path))
    if (!declared) { state.blocked.push('UNDECLARED_API'); return route.abort('blockedbyclient') }
    state.calls.push(`${method} ${path}`)
    const signedIn = (await request.allHeaders()).cookie?.includes('teth_return_panel_fixture=confirmed') ?? false
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (status: number, version: string, revision: string | null, data: unknown) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    if (path === '/api/v1/auth/session') {
      headers.ETag = signedIn ? authenticatedEtag : anonymousEtag
      return respond(200, '0.1.0', signedIn ? '1' : '7', { sessionId: signedIn ? authOwner : oldOwner, state: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', revision: signedIn ? '1' : '7',
        issuedAt: signedIn ? '2030-01-01T00:01:10Z' : '2030-01-01T00:00:00Z', expiresAt: signedIn ? '2030-01-01T12:01:10Z' : '2030-01-02T00:00:00Z' })
    }
    if (path === '/api/v1/auth/csrf') return respond(200, '0.1.0', null, { csrfToken: 'csrf_return_panel_session_fixture_01', expiresAt: '2030-01-01T12:01:10Z' })
    if (path.endsWith('/transactions')) {
      state.starts++; expect(request.postData()).toBeNull(); if (options.holdStart) await startGate; headers.ETag = resultEtag
      return respond(201, '0.2.0', '0', { transactionId, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' })
    }
    if (path.endsWith('/results/current')) {
      state.results++; if (options.holdResult) await resultGate; headers.ETag = resultEtag
      return respond(200, '0.2.0', '0', { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:01:00Z', expiresAt: '2030-01-01T00:02:00Z',
        transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: ackCsrf })
    }
    state.acks++; expect(request.postData()).toBeNull()
    expect(request.headers()['x-csrf-token']).toBe(ackCsrf); expect(request.headers()['if-match']).toBe(resultEtag)
    expect(request.headers()['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/); state.keys.push(request.headers()['idempotency-key'])
    if (options.holdAck) await ackGate
    if (options.loseAck && state.acks === 1) return route.abort('failed')
    headers.ETag = authenticatedEtag; headers['Set-Cookie'] = 'teth_return_panel_fixture=confirmed; HttpOnly; SameSite=Lax; Path=/'
    return respond(200, '0.2.0', '1', { resultId, transactionId, session: { sessionId: authOwner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' },
      handoffReservation: { transactionId, initiatingSessionId: oldOwner, initiatingSessionRevision: '7', authenticatedSessionId: authOwner, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:01:10Z' } })
  })
  await page.goto(`${origin}/auth/complete`)
  await expect(panel(page)).toBeVisible()
  return state
}

async function setCurrent(page: Page, current: boolean) {
  await page.evaluate(current => (window as unknown as { returnHarness: { setCurrent: (current: boolean) => void } }).returnHarness.setCurrent(current), current)
}
async function observationsInPage(page: Page) {
  return page.evaluate(() => {
    const h = (window as unknown as { returnHarness: { adoptions: number; sessionRecoveries: number; emailAdoptions: number } }).returnHarness
    return { adoptions: h.adoptions, sessionRecoveries: h.sessionRecoveries, emailAdoptions: h.emailAdoptions }
  })
}
async function ready(page: Page) { await selectResult(page).click(); await expect(confirm(page)).toBeVisible() }

for (const width of [1440, 390]) test(`returnOnly ${width}: original provider marks remain but initiation/email never dispatch; explicit result and ACK still work`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await mount(page, baseURL)
  const google = panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true }), apple = panel(page).getByRole('button', { name: 'Apple로 계속하기 준비 중', exact: true })
  await expect(google).toHaveAttribute('aria-disabled', 'true'); await expect(apple).toHaveAttribute('aria-disabled', 'true')
  await expect(google.locator('svg')).toHaveAttribute('viewBox', '0 0 48 48'); await expect(apple.locator('svg')).toHaveAttribute('viewBox', '0 0 24 24')
  // aria-disabled deliberately prevents locator.click. A real pointer hit at
  // the visible element center exercises the browser event without force.
  await expect(google).toBeVisible()
  const box = await google.boundingBox()
  if (!box) throw new Error('VISIBLE_PROVIDER_HITBOX_REQUIRED')
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await google.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await google.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  const email = panel(page).getByRole('button', { name: /이메일/ })
  await expect(email).toBeDisabled(); await email.evaluate(node => (node as HTMLButtonElement).click())
  expect(state.calls).toEqual([]); expect(state.starts).toBe(0)
  await ready(page); expect(state.acks).toBe(0); await confirm(page).click()
  await expect.poll(async () => (await observationsInPage(page)).adoptions).toBe(1)
  await expect(panel(page).getByRole('status')).toContainText('브라우저 세션의 로그인을 확인했습니다.')
  expect(state.starts).toBe(0); expect(state.acks).toBe(1)
  expect((await observationsInPage(page)).emailAdoptions).toBe(0)
})

test('default-off normal panel retains explicit START and never auto-acknowledges', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { returnOnly: false })
  await panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
  expect(state.starts).toBe(1); expect(state.results).toBe(0); expect(state.acks).toBe(0)
})

test('normal START pending then returnOnly retains controller but discards late initiation link and can explicitly read result', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { returnOnly: false, holdStart: true })
  await panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect.poll(() => state.starts).toBe(1)
  await page.evaluate(() => (window as unknown as { returnHarness: { setReturnOnly: (value: boolean) => void } }).returnHarness.setReturnOnly(true))
  const response = page.waitForResponse(response => response.url().endsWith('/transactions'))
  state.releaseStart(); await response
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
  await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toHaveCount(0)
  await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
  await expect(confirm(page)).toBeVisible()
  expect(state.starts).toBe(1); expect(state.results).toBe(1); expect(state.acks).toBe(0)
})

test('returnOnly current=false blocks configured explicit result/session operations as well as START', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { current: false })
  await selectResult(page).evaluate(node => (node as HTMLButtonElement).click())
  await panel(page).getByRole('button', { name: 'Google 로그인 세션만 다시 확인', exact: true }).evaluate(node => (node as HTMLButtonElement).click())
  expect(state.calls).toEqual([]); expect((await observationsInPage(page)).adoptions).toBe(0)
})

test('returnOnly hidden retained panel cannot dispatch recovery via a synthetic hidden click', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL)
  await page.evaluate(() => (window as unknown as { returnHarness: { hide: () => void } }).returnHarness.hide())
  await expect(panel(page)).toHaveCount(0)
  await page.locator('.native-auth-recovery button').first().evaluate(node => (node as HTMLButtonElement).click())
  expect(state.calls).toEqual([])
})

test('returnOnly delayed result from a stale scope never exposes ACK or accepted success', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { holdResult: true })
  await selectResult(page).click(); await expect.poll(() => state.results).toBe(1)
  await setCurrent(page, false)
  const response = page.waitForResponse(response => response.url().endsWith('/results/current'))
  state.releaseResult(); await response
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(confirm(page)).toHaveCount(0); expect(state.acks).toBe(0)
  expect((await observationsInPage(page)).adoptions).toBe(0)
})

test('returnOnly same-key reopen after stale result completion releases busy without accepting stale result', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { holdResult: true })
  await selectResult(page).click(); await expect.poll(() => state.results).toBe(1)
  await setCurrent(page, false)
  await page.evaluate(() => (window as unknown as { returnHarness: { hide: () => void } }).returnHarness.hide())
  await expect(panel(page)).toHaveCount(0)
  const response = page.waitForResponse(response => response.url().endsWith('/results/current'))
  state.releaseResult(); await response
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect((await observationsInPage(page)).adoptions).toBe(0)
  expect(state.starts).toBe(0); expect(state.acks).toBe(0)
  // Same React component/controller and same resumeToken: only restore the
  // caller's presentation predicate. Never replay result/ACK automatically.
  await page.evaluate(() => {
    const h = (window as unknown as { returnHarness: { current: boolean; hidden: boolean; render: () => void } }).returnHarness
    h.current = true; h.hidden = false; h.render()
  })
  await expect(panel(page)).toBeVisible()
  await expect(confirm(page)).toHaveCount(0)
  expect(state.results).toBe(1); expect(state.acks).toBe(0)
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
})

test('returnOnly verified ACK whose host rejects adoption never paints confirmed success', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { rejectHost: true })
  await ready(page); await confirm(page).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  expect((await observationsInPage(page)).adoptions).toBe(1); expect(state.acks).toBe(1)
  await expect(panel(page).getByRole('status').filter({ hasText: '브라우저 세션의 로그인을 확인했습니다.' })).toHaveCount(0)
  expect(state.starts).toBe(0)
})

test('returnOnly ACK in flight across a stale scope cannot invoke host adoption or show success', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { holdAck: true })
  await ready(page); await confirm(page).click(); await expect.poll(() => state.acks).toBe(1)
  await setCurrent(page, false)
  const response = page.waitForResponse(response => response.url().endsWith('/acknowledgements'))
  state.releaseAck(); await response
  await expect.poll(() => state.calls.filter(call => call === 'GET /api/v1/auth/csrf').length).toBeGreaterThan(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect((await observationsInPage(page)).adoptions).toBe(0)
  await expect(panel(page).getByRole('status').filter({ hasText: '브라우저 세션의 로그인을 확인했습니다.' })).toHaveCount(0)
})

test('returnOnly lost ACK closes and reopens the same controller; explicit replay preserves key and condition without START', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, { loseAck: true })
  await ready(page); await confirm(page).click(); await expect(panel(page).getByRole('alert')).toBeVisible()
  expect(state.keys).toHaveLength(1)
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click(); await expect(panel(page)).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { returnHarness: { reopen: () => void } }).returnHarness.reopen())
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: '같은 로그인 확정 요청으로 세션 재확인', exact: true }).click()
  await expect.poll(async () => (await observationsInPage(page)).adoptions).toBe(1)
  expect(state.acks).toBe(2); expect(state.keys).toHaveLength(2); expect(state.keys[1]).toBe(state.keys[0]); expect(state.starts).toBe(0)
  expect(state.results).toBe(1)
})
