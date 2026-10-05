import { expect, test, type Page, type TestInfo } from '@playwright/test'

// 파일 안의 공개 UI 검수만 격리합니다. 실제 인증/외부 요청은 허용하지 않습니다.
test.use({ serviceWorkers: 'block' })

type GuardRequest = { method: string; origin: string; path: string }
async function installNetworkGuard(page: Page, baseURL: string | undefined, native = false) {
  if (!baseURL) throw new Error('로컬 UI 검수 주소가 필요합니다.')
  const origin = new URL(baseURL).origin
  const audit = { external: [] as GuardRequest[], mutations: [] as GuardRequest[], unexpectedApi: [] as GuardRequest[], blocked: [] as (GuardRequest & { reason: string })[], fixtures: [] as string[] }
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
    const observed = { method, origin: url.origin, path }
    const foreign = url.origin !== origin, mutation = !['GET', 'HEAD'].includes(method)
    const api = path === '/api' || path.startsWith('/api/')
    const fixture = !foreign && native && method === 'GET' && url.search === '' && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)
    if (foreign) audit.external.push(observed)
    if (mutation) audit.mutations.push(observed)
    if (!foreign && api && !fixture) audit.unexpectedApi.push(observed)
    const reason = foreign ? 'external' : mutation ? 'mutation' : api && !fixture ? 'unexpected-api' : ''
    if (reason) {
      audit.blocked.push({ ...observed, reason })
      return route.abort('blockedbyclient')
    }
    if (fixture) {
      audit.fixtures.push(path)
      const session = path.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_auth_parity_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_auth_parity_0001', traceId: 'trace_catalogue_auth_parity_0001' },
        data: session ? { sessionId: 'session_catalogue_auth_parity_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_catalogue_auth_parity_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    // fallback을 사용해 합성 canary의 하위 abort-tripwire도 우회하지 않습니다.
    return route.fallback()
  })
  return { origin, audit }
}

async function expectNoNetworkAttempts(guard: Awaited<ReturnType<typeof installNetworkGuard>>, info: TestInfo) {
  await info.attach('catalogue-network-guard', { body: JSON.stringify(guard.audit), contentType: 'application/json' })
  expect(guard.audit.external).toEqual([])
  expect(guard.audit.mutations).toEqual([])
  expect(guard.audit.unexpectedApi).toEqual([])
  expect(guard.audit.blocked).toEqual([])
}

async function returnUtility(page: Page, info: TestInfo, pointer: boolean) {
  const back = page.locator('.client-sharing-hub > .hub-header > button')
  await back.focus(); await expect(back).toBeFocused(); await expect(back).toBeVisible()
  const geometry = await back.evaluate(async n => {
    const measure = () => {
      const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      const auth = [...document.querySelectorAll('.client-auth-nav button')].map(n => n.getBoundingClientRect())
      return { rect: r.toJSON(), full: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        hit: !!hit && (hit === n || n.contains(hit)), overlapsAuth: auth.some(a => Math.min(a.right, r.right) > Math.max(a.x, r.x) && Math.min(a.bottom, r.bottom) > Math.max(a.y, r.y)) }
    }
    // Focus style retirement can occur after focus() resolves. Observe actual
    // frames, without altering CSS/scroll/click or relaxing geometry checks.
    const immediate = measure()
    let previous = '', stable = 0, current = immediate
    for (let frame = 1; frame <= 120; frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      current = measure()
      const key = JSON.stringify(current)
      const valid = document.activeElement === n && current.full && current.hit && !current.overlapsAuth
      stable = valid ? (key === previous ? stable + 1 : 1) : 0
      previous = key
      if (stable === 3) return { ...current, immediate, stableFrames: stable, observedFrames: frame }
    }
    return { ...current, immediate, stableFrames: stable, observedFrames: 120 }
  })
  await expect(back).toBeFocused()
  await info.attach('keyboard-return-utility', { body: JSON.stringify(geometry), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('guest-keyboard-return-utility.png') })
  expect(geometry).toMatchObject({ full: true, hit: true, overlapsAuth: false })
  expect(geometry.stableFrames).toBeGreaterThanOrEqual(3)
  expect(geometry.rect.width).toBeGreaterThanOrEqual(44)
  expect(geometry.rect.height).toBeGreaterThanOrEqual(44)
  if (pointer) await back.click(); else await back.press('Enter')
  await expect(page.locator('.client-sharing-hub')).toHaveCount(0)
}

// Original 9fbff821 final overrides: fresh guest intro → sidebar catalogue →
// first detail retains both top auth CTAs at 320/844/1440. Private paired
// browser captures pin that observation; this Mock test only opens/cancels the
// local auth surface, never fabricates a profile or completes account creation.
for (const width of [320, 844, 1440]) for (const surface of ['list', 'detail'] as const) {
  test(`guest ${width}px ${surface}: 원본 상단 인증 동선과 footer를 보존한다`, async ({ page, baseURL }, info) => {
    const guard = await installNetworkGuard(page, baseURL)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#/trade')
    await expect(page.locator('.txh')).toBeVisible()
    const login = page.locator('.client-auth-nav .client-login')
    const signup = page.locator('.client-auth-nav .client-signup')
    await expect(login).toBeVisible()
    await expect(signup).toBeVisible()
    const menu = page.locator('.client-hamburger')
    if (await menu.isVisible()) await menu.click()
    await page.getByRole('button', { name: '전략 복사', exact: true }).click()
    await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    if (surface === 'detail') {
      await page.locator('.strategy-list-card').first().getByRole('link').click()
      await expect(page.locator('.catalogue-source-header')).toBeVisible()
    }
    const footer = page.locator('.client-site-footer')
    await expect(footer).toHaveCount(1)
    const footerText = await footer.innerText()
    const geometry = await page.evaluate(() => {
      const box = (n: Element) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
      const auth = [...document.querySelectorAll<HTMLElement>('.client-auth-nav button')].map(n => ({ text: n.innerText, visible: n.checkVisibility(), rect: box(n) }))
      const content = [...document.querySelectorAll<HTMLElement>('.client-sharing-hub > .hub-header button,.strategy-filters button,.strategy-filters select,.catalogue-source-header button,.client-shared-detail > .tfbk-bc button')].filter(n => n.checkVisibility() && n.getBoundingClientRect().width > 1 && (!n.closest('.hub-header') || n.closest('.hub-header')!.getBoundingClientRect().width > 1)).map(n => ({ text: n.innerText, rect: box(n) }))
      const collisions = auth.flatMap(a => content.filter(c => Math.min(a.rect.right, c.rect.right) > Math.max(a.rect.x, c.rect.x) && Math.min(a.rect.bottom, c.rect.bottom) > Math.max(a.rect.y, c.rect.y)).map(c => [a.text, c.text]))
      return { guestAuthMounted: !!document.querySelector('.client-auth-nav'), auth, content, collisions, overflow: document.documentElement.scrollWidth - innerWidth }
    })
    await info.attach('guest-auth-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('guest-auth-before-assertion.png') })
    await expect(login).toBeVisible()
    await expect(signup).toBeVisible()
    expect(geometry.collisions).toEqual([])
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    for (const button of [login, signup]) {
      await button.focus()
      await expect(button).toBeFocused()
      expect(await button.evaluate(n => { const r = n.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === n || n.contains(hit)) })).toBe(true)
      const href = page.url()
      await page.keyboard.press('Enter')
      await expect(page.locator('.ca-auth')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.ca-auth')).toHaveCount(0)
      await expect(button).toBeFocused()
      expect(page.url()).toBe(href)
    }
    expect(await footer.innerText()).toBe(footerText)
    // Current service-boundary copy is intentional; it is not original copy.
    expect(footerText).toContain('로그인만으로 거래소 연결이나 거래가 실행되지 않습니다.')
    if (surface === 'detail') {
      await page.locator('.client-shared-detail > .tfbk-bc button').click()
      await expect(page.locator('.strategy-list-card').first()).toBeVisible()
      await page.locator('.strategy-list-card').first().getByRole('link').click()
      await expect(page.locator('.catalogue-source-header')).toBeVisible()
    }
    await returnUtility(page, info, surface === 'detail')
    await expectNoNetworkAttempts(guard, info)
    expect(errors).toEqual([])
  })
}

// Actual service entry and shared Chrome. Only anonymous session/CSRF GETs
// are explicit protocol fixtures; every mutation/provider request is blocked.
for (const width of [320, 844, 1440]) for (const surface of ['list', 'detail'] as const) {
  test(`native guest ${width}px ${surface}: 상단 인증 선택은 공개 host에서도 도달한다`, async ({ page, baseURL }, info) => {
    const guard = await installNetworkGuard(page, baseURL, true)
    const mutations = guard.audit.mutations, errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })

    // global guard 등록 뒤 같은 context의 LIFO override, GET만 HTML을 공급합니다.
    await page.context().route(guard.origin + '/', route => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    })
    await page.goto('/#/share')
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.locator('[data-public-catalogue] .strategy-list-card').first()).toBeVisible()
    if (surface === 'detail') {
      await page.locator('[data-public-catalogue] .strategy-list-link').first().click()
      await expect(page.locator('[data-public-catalogue] .client-shared-detail')).toBeVisible()
    }
    const login = page.locator('.client-auth-nav .client-login'), signup = page.locator('.client-auth-nav .client-signup')
    const geometry = await page.evaluate(() => {
      const box = (n: Element) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
      const auth = [...document.querySelectorAll<HTMLElement>('.client-auth-nav button')].map(n => ({ text: n.innerText, visible: n.checkVisibility(), rect: box(n) }))
      const content = [...document.querySelectorAll<HTMLElement>('.client-sharing-hub > .hub-header button,.strategy-filters button,.strategy-filters select,.catalogue-source-header button,.client-shared-detail > .tfbk-bc button')].filter(n => n.checkVisibility() && n.getBoundingClientRect().width > 1 && (!n.closest('.hub-header') || n.closest('.hub-header')!.getBoundingClientRect().width > 1)).map(n => ({ text: n.innerText, rect: box(n) }))
      const collisions = auth.flatMap(a => content.filter(c => Math.min(a.rect.right, c.rect.right) > Math.max(a.rect.x, c.rect.x) && Math.min(a.rect.bottom, c.rect.bottom) > Math.max(a.rect.y, c.rect.y)).map(c => [a.text, c.text]))
      return { auth, shell: document.querySelector('.client-service-app')?.className, content, collisions, overflow: document.documentElement.scrollWidth - innerWidth }
    })
    await info.attach('native-guest-before-assertion', { body: JSON.stringify(geometry), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('native-guest-auth-before-assertion.png') })
    await expect(login).toBeVisible(); await expect(signup).toBeVisible()
    expect(geometry.collisions).toEqual([])
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    for (const button of [login, signup]) {
      await button.focus(); await expect(button).toBeFocused()
      expect(await button.evaluate(n => { const r = n.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === n || n.contains(hit)) })).toBe(true)
      const href = page.url()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('region', { name: '실제 계정 로그인', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.native-auth-surface[open]')).toHaveCount(0)
      await expect(button).toBeFocused()
      expect(page.url()).toBe(href)
    }
    await expect(page.locator('.client-site-footer')).toHaveCount(1)
    if (surface === 'detail') {
      await page.locator('[data-public-catalogue] .client-shared-detail > .tfbk-bc button').click()
      await expect(page.locator('[data-public-catalogue] .strategy-list-card').first()).toBeVisible()
      await page.locator('[data-public-catalogue] .strategy-list-link').first().click()
      await expect(page.locator('[data-public-catalogue] .client-shared-detail')).toBeVisible()
    }
    await returnUtility(page, info, surface === 'detail')
    await expectNoNetworkAttempts(guard, info)
    expect(mutations).toEqual([]); expect(errors).toEqual([])
  })
}


// Mock/Native 각각 별도 canary, 기존 24개 UI 사례와 합산/동일키 승계하지 않습니다.
for (const native of [false, true]) {
  test('network guard ' + (native ? 'native' : 'mock') + ': 외부·비API POST·미허용 API는 전송 전에 차단한다', async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('로컬 canary 주소가 필요합니다.')
    const origin = new URL(baseURL).origin, tripwire: GuardRequest[] = [], errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    // 가장 먼저 등록합니다. global guard의 allow/fallback 회귀도 실제 네트워크 전에 차단합니다.
    await page.context().route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      tripwire.push({ method: request.method(), origin: url.origin, path: url.pathname })
      return route.abort('blockedbyclient')
    })
    const guard = await installNetworkGuard(page, baseURL, native)
    await page.context().route(origin + '/', route => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>합성 네트워크 차단 검수</body></html>' })
    })
    await page.goto('/')
    if (native) {
      const fixtures = await page.evaluate(async () => Promise.all(['/api/v1/auth/session', '/api/v1/auth/csrf'].map(async path => (await fetch(path)).status)))
      expect(fixtures).toEqual([200, 200])
      expect(guard.audit.fixtures.sort()).toEqual(['/api/v1/auth/csrf', '/api/v1/auth/session'])
    }
    const rejected = await page.evaluate(async () => (await Promise.allSettled([
      fetch('https://catalogue-guard.invalid/api/v1/auth/session', { mode: 'no-cors' }),
      fetch('/', { method: 'POST', body: 'synthetic-canary' }),
      fetch('/api/guard-canary'),
    ])).map(result => result.status))
    await info.attach('network-guard-canary', { body: JSON.stringify({ native, audit: guard.audit, tripwire, rejected }), contentType: 'application/json' })
    expect(rejected).toEqual(['rejected', 'rejected', 'rejected'])
    expect(tripwire).toEqual([])
    expect(guard.audit.external).toEqual([{ method: 'GET', origin: 'https://catalogue-guard.invalid', path: '/api/v1/auth/session' }])
    expect(guard.audit.mutations).toEqual([{ method: 'POST', origin, path: '/' }])
    expect(guard.audit.unexpectedApi).toEqual([{ method: 'GET', origin, path: '/api/guard-canary' }])
    expect(guard.audit.blocked.map(request => request.reason).sort()).toEqual(['external', 'mutation', 'unexpected-api'])
    if (!native) expect(guard.audit.fixtures).toEqual([])
    await expect(page.locator('.ca-auth,.native-auth-surface')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
