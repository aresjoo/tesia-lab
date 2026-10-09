import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import sourceCopy from '../src/client-reference-copy.json' with { type: 'json' }
import conversationFixture from './fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { TEST_ORIGIN } from './test-origin'

// Actual service entry/controller/panel with same-origin synthetic protocol
// responses only. Intent is private presentation state, never provider or
// account authority; these cases do not exercise a real provider or key.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' })
test.setTimeout(30_000)

type Language = keyof typeof sourceCopy.I18N['auth.title']
const languages = sourceCopy.GLC_LANGS.map(item => item.c as Language)
const anonymous = 'session_auth_intent_anonymous_0001'
const authenticated = 'session_auth_intent_authenticated_001'
const anonymousEtag = '"etag_auth_intent_anonymous_007"'
const authenticatedEtag = '"etag_auth_intent_authenticated_001"'
const csrf = 'csrf_auth_intent_fixture_000001'
const transactionId = 'oidc_tx_auth_intent_fixture_0001'
const resultId = 'oauth_result_auth_intent_fixture_001'
const ready = conversationFixture.snapshots.ready
const panel = (page: Page) => page.locator('.native-provider-login:visible')
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version,
  resourceRevision: revision, requestId: 'req_auth_intent_fixture_0001', traceId: 'trace_auth_intent_fixture_0001' })

async function mount(page: Page, options: { conversation?: boolean; hash?: string } = {}) {
  const state = { signedIn: false, starts: 0, acknowledgements: 0, external: [] as string[], unexpected: [] as string[] }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ conversation, conversationId, owner }) => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (conversation) {
      sessionStorage.setItem('tesia.native.conversation', conversationId)
      sessionStorage.setItem('tesia.native.conversation-session', owner)
    }
  }, { conversation: Boolean(options.conversation), conversationId: ready.conversationId, owner: anonymous })
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== TEST_ORIGIN) { state.external.push(`${request.method()} ${url.origin}${path}`); return route.abort('blockedbyclient') }
    if (path.startsWith('/api/')) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: state.signedIn ? authenticatedEtag : anonymousEtag }
      let data: unknown, version = '0.1.0', revision: string | null = state.signedIn ? '1' : '7', status = 200
      if (path === '/api/v1/auth/session' && request.method() === 'GET') {
        data = { sessionId: state.signedIn ? authenticated : anonymous, state: state.signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', revision,
          issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
      } else if (path === '/api/v1/auth/csrf' && request.method() === 'GET') {
        revision = null; delete headers.ETag
        data = { csrfToken: csrf, expiresAt: '2030-01-01T12:00:00Z' }
      } else if (path === '/api/v2/auth/google/transactions' && request.method() === 'POST') {
        version = '0.2.0'; revision = '0'; status = 201; state.starts++
        expect(request.postData()).toBeNull(); expect(request.headers()['if-match']).toBe(anonymousEtag)
        data = { transactionId, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
          authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' }
      } else if (path === '/api/v2/auth/google/results/current' && request.method() === 'GET') {
        version = '0.2.0'; revision = '0'
        data = { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:01:00Z',
          transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_auth_intent_result_0001' }
      } else if (path === `/api/v2/auth/google/results/${resultId}/acknowledgements` && request.method() === 'POST') {
        version = '0.2.0'; revision = '1'; state.acknowledgements++; state.signedIn = true; headers.ETag = authenticatedEtag
        data = { resultId, transactionId, session: { sessionId: authenticated, state: 'AUTHENTICATED', revision: '1',
          issuedAt: '2030-01-01T00:00:10Z', expiresAt: '2030-01-01T12:00:10Z' },
        handoffReservation: { transactionId, initiatingSessionId: anonymous, initiatingSessionRevision: '7',
          authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:10Z' } }
      } else if (options.conversation && path === `/api/v3/conversations/${ready.conversationId}` && request.method() === 'GET') {
        version = '0.3.0'; revision = ready.conversationStateRevision; headers.ETag = '"etag_auth_intent_conversation_004"'; data = ready
      } else {
        state.unexpected.push(`${request.method()} ${path}`); return route.abort('blockedbyclient')
      }
      return route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    }
    if (request.isNavigationRequest() && path === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto(`/${options.hash ?? ''}`)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return state
}

async function choose(page: Page, intent: 'login' | 'signup') {
  const account = page.getByRole('navigation', { name: '계정 메뉴', exact: true })
  const control = account.getByRole('button', { name: sourceCopy.I18N[intent === 'signup' ? 'nav.signup' : 'nav.login'].ko, exact: true })
  if (await control.isVisible()) await control.click()
  else {
    expect(intent).toBe('login')
    await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
  }
  await expect(panel(page)).toBeVisible()
  await expect(panel(page)).toHaveAttribute('data-native-auth-intent', intent)
}

for (const width of [320, 1440]) test(`${width}px login/signup 진입 intent와 7언어 원본 공통 인증 카피를 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 320 ? 844 : 900 })
  const state = await mount(page)
  await choose(page, 'login')
  await panel(page).locator('[data-native-auth-close]').click()
  await expect(panel(page)).toHaveCount(0)
  await choose(page, 'signup')
  for (const language of languages) {
    await page.evaluate(async language => {
      const { setClientPreference } = await import('/src/client-preferences.ts')
      setClientPreference('language', language)
    }, language)
    await expect(panel(page).getByRole('heading', { name: sourceCopy.I18N['auth.title'][language], exact: true })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: sourceCopy.I18N['auth.google'][language], exact: true })).toBeVisible()
    await expect(panel(page)).toHaveAttribute('data-native-auth-intent', 'signup')
  }
  expect(state.starts).toBe(0); expect(state.acknowledgements).toBe(0)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})

test('pending provider controller를 닫고 signup을 눌러도 retained login intent를 relabel하지 않는다', async ({ page }) => {
  const state = await mount(page)
  await choose(page, 'login')
  await panel(page).getByRole('button', { name: sourceCopy.I18N['auth.google'].ko, exact: true }).click()
  await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
  await panel(page).locator('[data-native-auth-close]').click()
  await expect(panel(page)).toHaveCount(0)
  await page.getByRole('navigation', { name: '계정 메뉴', exact: true })
    .getByRole('button', { name: sourceCopy.I18N['nav.signup'].ko, exact: true }).click()
  await expect(panel(page)).toHaveAttribute('data-native-auth-intent', 'login')
  expect(state.starts).toBe(1); expect(state.acknowledgements).toBe(0)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})

test('signup intent의 인증 owner 전환은 stale panel intent를 새 owner에 남기지 않는다', async ({ page }) => {
  const state = await mount(page)
  await choose(page, 'signup')
  await panel(page).getByRole('button', { name: sourceCopy.I18N['auth.google'].ko, exact: true }).click()
  await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(panel(page)).toHaveCount(0)
  await expect(page.locator('[data-native-auth-intent="signup"]')).toHaveCount(0)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  expect(state.starts).toBe(1); expect(state.acknowledgements).toBe(1); expect(state.signedIn).toBe(true)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})

test('epoch가 바뀐 retained provider controller는 새 signup 클릭으로 relabel되지 않는다', async ({ page }) => {
  const state = await mount(page, { conversation: true })
  await choose(page, 'login')
  await panel(page).getByRole('button', { name: sourceCopy.I18N['auth.google'].ko, exact: true }).click()
  await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
  await panel(page).locator('[data-native-auth-close]').click()
  await page.getByRole('button', { name: '전략 복사', exact: true }).first().click()
  await page.getByRole('button', { name: '새 전략 만들기', exact: true }).click()
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  // A visible account nav alone also exists in the conversation. Require the
  // accepted reset before testing the retained controller across its epoch.
  await expect(page.locator('.client-service-app')).toHaveClass(/\bview-landing\b/)
  await expect(page.locator('.native-strategy-workflow')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '계정 메뉴', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: '계정 메뉴', exact: true })
    .getByRole('button', { name: sourceCopy.I18N['nav.signup'].ko, exact: true }).click()
  await expect(panel(page)).toHaveAttribute('data-native-auth-intent', 'login')
  expect(state.starts).toBe(1); expect(state.acknowledgements).toBe(0)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})

test('guest trading intro CTA는 원본 signup intent로 실제 modal을 연다', async ({ page }) => {
  const state = await mount(page)
  await page.getByRole('button', { name: 'AI 트레이딩', exact: true }).first().click()
  await expect(page.locator('.txh-cta').first()).toBeVisible()
  await page.locator('.txh-cta').first().click()
  await expect(panel(page)).toHaveAttribute('data-native-auth-intent', 'signup')
  expect(state.starts).toBe(0); expect(state.acknowledgements).toBe(0)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})

test('copy direct click event와 insight mode callback은 문자열 intent로만 정규화된다', async ({ page }) => {
  const state = await mount(page, { hash: '#/share' })
  await page.getByRole('link', { name: /BNB 평균선 양방향 2배/ }).click()
  await page.getByRole('button', { name: '전략 복사하기', exact: true }).click()
  await expect(panel(page)).toHaveAttribute('data-native-auth-intent', 'login')
  const serviceSource = await readFile('src/internal-poc/ClientServiceExperience.tsx', 'utf8')
  const appSource = await readFile('src/internal-poc/NativeServiceApp.tsx', 'utf8')
  expect(serviceSource).not.toContain('signedIn={state.sessionState === \'AUTHENTICATED\'} onLogin={login}')
  expect(serviceSource).toContain("onLogin={intent => login(intent === 'signup' ? 'signup' : 'login')}")
  expect(appSource).toContain("openLogin(intent === 'signup' ? 'signup' : 'login')")
  expect(state.starts).toBe(0); expect(state.acknowledgements).toBe(0)
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([])
})
