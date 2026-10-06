import { expect, test, type Page } from '@playwright/test'

// Mounted service-main + SDK. All auth responses below are declared synthetic
// fixtures. No provider, actual login, bootstrap, ACK, claim or product writes.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const fixtureSession = 'session_transition_fixture_01'
const meta = (version = '0.1.0', revision: string | null = null) => ({ apiContractVersion: version,
  requestId: 'req_transition_fixture_01', traceId: 'trace_transition_fixture_01', resourceRevision: revision })
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
type Evidence = { calls: string[]; blocked: string[]; errors: string[]; sessionReads: number; resultReads: number;
  held: boolean; observations: unknown[] }
const observations = new WeakMap<Page, Evidence>()
test.afterEach(async ({ page }, info) => {
  const evidence = observations.get(page)
  if (!evidence) return
  info.annotations.push({ type: 'SYNTHETIC_RETURN_TRANSITION', description: JSON.stringify(evidence) })
  console.log('SYNTHETIC_RETURN_TRANSITION', JSON.stringify(evidence))
  expect(evidence.blocked).toEqual([])
  expect(evidence.errors).toEqual([])
  expect(evidence.calls.every(call => call.startsWith('GET '))).toBe(true)
})
async function mount(page: Page, baseURL: string | undefined, hold: 'result' | 'second-recheck') {
  // Use the suite's owned loopback origin, including its default port. An
  // agent-specific port must not make this regression fail in normal CI.
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('OWNED_LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const evidence: Evidence = { calls: [], blocked: [], errors: [], sessionReads: 0, resultReads: 0, held: false, observations: [] }
  observations.set(page, evidence)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  page.on('pageerror', error => evidence.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
  })
  await page.context().route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (url.origin !== origin || method !== 'GET') { evidence.blocked.push(`${method} ${url.origin === origin ? path : 'EXTERNAL'}`); return route.abort('blockedbyclient') }
    if (!path.startsWith('/api/')) {
      if (req.isNavigationRequest() && ['/', '/auth/complete'].includes(path)) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    if (url.search || !['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path)) {
      evidence.blocked.push(`${method} ${path}`); return route.abort('blockedbyclient')
    }
    evidence.calls.push(`${method} ${path}`)
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === '/api/v1/auth/session') {
      evidence.sessionReads++
      if (hold === 'result' || evidence.sessionReads === 1) return route.fulfill({ status: 401, headers,
        body: JSON.stringify({ meta: meta(), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic missing session.' } }) })
      if (evidence.sessionReads === 3) { evidence.held = true; await gate }
      return route.fulfill({ headers: { ...headers, ETag: '"etag_transition_fixture_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: {
        sessionId: fixtureSession, state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' } }) })
    }
    if (path === '/api/v1/auth/csrf') return route.fulfill({ headers, body: JSON.stringify({ meta: meta(), data: {
      csrfToken: 'csrf_transition_fixture_01', expiresAt: '2030-01-01T12:00:00Z' } }) })
    evidence.resultReads++
    if (hold === 'result' && evidence.resultReads === 1) { evidence.held = true; await gate }
    return route.fulfill({ headers: { ...headers, ETag: '"etag_result_transition_01"' }, body: JSON.stringify({ meta: meta('0.2.0', '0'), data: {
      resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK',
      issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:01:00Z',
      transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_transition_01' } }) })
  })
  await page.goto(`${origin}/auth/complete`)
  await expect(panel(page)).toBeVisible()
  return { evidence, release }
}
async function leaveReturn(page: Page) {
  // Browser same-document navigation is possible while the modal owns focus;
  // no programmatic auth button click or business dispatch is synthesized.
  await page.evaluate(() => { history.pushState(null, '', '/auth/complete#/trade'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.getByRole('dialog', { name: '로그인', exact: true })).toBeHidden()
}
async function returnExplicitly(page: Page) {
  await page.getByRole('region', { name: 'AI가 스스로 판단해 거래합니다', exact: true }).getByRole('button', { name: '시작하기', exact: true }).click()
  await page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/complete$/)
  await expect(panel(page)).toBeVisible()
}
async function observe(page: Page) {
  return page.evaluate(() => ({ phase: document.querySelector('.client-service-app')?.getAttribute('data-service-phase'),
    tag: document.activeElement?.tagName, inPanel: Boolean(document.activeElement?.closest('.cs-native-login')),
    focusedLabel: document.activeElement?.getAttribute('aria-label'), focusedText: document.activeElement?.textContent?.slice(0, 100) }))
}

test('held result crosses departure and explicit return: completion keeps focus in the retained login panel', async ({ page, baseURL }) => {
  const { evidence, release } = await mount(page, baseURL, 'result')
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await expect.poll(() => evidence.held).toBe(true)
  try {
    await leaveReturn(page)
    await returnExplicitly(page)
    evidence.observations.push({ beforeRelease: await observe(page) })
    expect(evidence.sessionReads).toBe(1); expect(evidence.resultReads).toBe(1)
  } finally { release() }
  await expect(panel(page).getByRole('button', { name: '닫기', exact: true })).toBeEnabled()
  evidence.observations.push({ afterRelease: await observe(page) })
  expect(evidence.sessionReads).toBe(1); expect(evidence.resultReads).toBe(1)
  // Retirement discards authority-bearing results, not settlement of the
  // retained presentation. Enabled controls must not announce a busy request.
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
  await expect(panel(page).getByRole('status')).toHaveText('원래 요청을 다시 확인하려면 아래 버튼을 직접 눌러주세요.')
  await expect.poll(async () => (await observe(page)).inPanel).toBe(true)
  await expect(panel(page).locator('[data-native-auth-close]')).toBeFocused()
})

test('held second session observation crosses departure: explicit return is not stranded in loading with silent result clicks', async ({ page, baseURL }) => {
  const { evidence, release } = await mount(page, baseURL, 'second-recheck')
  await panel(page).getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect.poll(() => evidence.held).toBe(true)
  try { await leaveReturn(page) } finally { release() }
  await expect(page.locator('.native-auth-surface .native-provider-login').last()).toHaveAttribute('aria-busy', 'false')
  await returnExplicitly(page)
  evidence.observations.push({ afterReturn: await observe(page) })
  const result = panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true })
  await expect(result).toBeEnabled()
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
  await expect(panel(page).locator('[data-native-auth-close]')).toBeFocused()
  await result.click()
  evidence.observations.push({ afterResultClick: await observe(page), resultReads: evidence.resultReads })
  expect.soft(await page.evaluate(() => sessionStorage.getItem('tesia.native.session-binding'))).toBeNull()
  expect.soft(evidence.calls.filter(call => call === 'GET /api/v1/auth/csrf')).toHaveLength(0)
  await expect.soft(page.locator('.client-service-app')).not.toHaveAttribute('data-service-phase', 'loading')
  await expect.poll(() => evidence.resultReads).toBe(1)
})

test('return recheck and off-route close reuse the selected language without dispatching authentication', async ({ page, baseURL }) => {
  const { evidence, release } = await mount(page, baseURL, 'result')
  try {
    await page.evaluate(async () => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', 'en')
    })
    await expect(page.locator('.cs-native-login').getByRole('button', { name: 'Check session again', exact: true })).toBeVisible()
    await expect(page.locator('.cs-native-login').getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
    await page.evaluate(() => { history.pushState(null, '', '/auth/complete#/trade'); window.dispatchEvent(new Event('teth:navigate')) })
    await expect(page.locator('.native-auth-surface')).not.toBeVisible()
    await page.locator('.txh-hero .txh-cta').click()
    // Off-route explanatory copy has no approved translation yet. Only the
    // existing recheck/close dictionary keys are covered, not that KO region.
    await expect(page.locator('.native-auth-surface [data-native-auth-close]').filter({ visible: true })).toHaveAttribute('aria-label', 'Close')
    expect(evidence.resultReads).toBe(0)
    expect(evidence.sessionReads).toBe(1)
  } finally { release() }
})
