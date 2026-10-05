import { expect, test, type Page } from '@playwright/test'

// Original 9fb paired guest gear -> brokers/plView observations pin the
// authentication chrome. Main's plan and Native's catalogue are intentionally
// different bodies; this spec restores neither content nor auth authority.
test.use({ serviceWorkers: 'block' })

type Host = 'Main' | 'Native'
type Attempt = { method: string; origin: string; path: string }
async function guardNetwork(page: Page, baseURL: string | undefined, native: boolean) {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const audit = { external: [] as Attempt[], mutations: [] as Attempt[], unexpectedApi: [] as Attempt[], fixtures: [] as string[] }
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    const method = request.method(), path = url.pathname
    const attempt = { method, origin: url.origin, path }
    const foreign = url.origin !== origin, mutation = !['GET', 'HEAD'].includes(method)
    const api = path === '/api' || path.startsWith('/api/')
    const fixture = native && !foreign && method === 'GET' && !url.search
      && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)
    if (foreign) audit.external.push(attempt)
    if (mutation) audit.mutations.push(attempt)
    if (!foreign && api && !fixture) audit.unexpectedApi.push(attempt)
    if (foreign || mutation || api && !fixture) return route.abort('blockedbyclient')
    if (fixture) {
      const session = path.endsWith('/session')
      audit.fixtures.push(path)
      return route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'Cache-Control': 'no-store', ...(session ? { ETag: '"guest_broker_session_fixture_0007"' } : {}) },
        body: JSON.stringify({
          meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '7' : null,
            requestId: 'req_guest_broker_fixture_0001', traceId: 'trace_guest_broker_fixture_0001' },
          data: session ? { sessionId: 'session_guest_broker_fixture_0001', state: 'ANONYMOUS', revision: '7',
            issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
            : { csrfToken: ['csrf', 'guest', 'broker', 'fixture', '0001'].join('_'), expiresAt: '2030-01-01T12:00:00Z' },
        }) })
    }
    return route.fallback()
  })
  return audit
}

async function observeChrome(page: Page) {
  return page.evaluate(() => {
    const measure = (node: Element) => {
      const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      return { visible: node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }),
        rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        hit: !!hit && (hit === node || node.contains(hit)) }
    }
    const auth = [...document.querySelectorAll('.client-auth-nav .client-login,.client-auth-nav .client-signup')].map(measure)
    const globe = [...document.querySelectorAll('.client-globe')].map(measure)
    const utilities = [...document.querySelectorAll('.client-broker-hub > .hub-header button,.client-connection-plan .cpl-head button')]
      .filter(node => node.checkVisibility()).map(measure)
    const controls = [...auth, ...globe].filter(node => node.visible)
    const collisions = controls.flatMap((a, i) => [...controls.slice(i + 1), ...utilities].filter(b =>
      Math.min(a.rect.right, b.rect.right) > Math.max(a.rect.x, b.rect.x)
      && Math.min(a.rect.bottom, b.rect.bottom) > Math.max(a.rect.y, b.rect.y)).map(b => [a.rect, b.rect]))
    return { auth, globe, collisions, overflow: document.documentElement.scrollWidth - innerWidth }
  })
}

for (const host of ['Main', 'Native'] as const satisfies readonly Host[]) for (const width of [320, 1440]) {
  test(`${host} guest brokers ${width}px: 원본 상단 인증·언어 진입과 비로그인 왕복을 보존한다`, async ({ page, baseURL }, info) => {
    const native = host === 'Native', audit = await guardNetwork(page, baseURL, native)
    const errors: string[] = [], actions: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.setItem('teth-app-banner-dismissed', '1')
    })
    if (native) await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
    try {
      await page.goto(native ? '/internal-poc.html#/native-client' : '/')
      if (native) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      else await expect(page.locator('.client-home-pill')).toBeVisible()
      if (width <= 860) await page.locator('.client-hamburger').click()
      await page.locator('[data-sidebar-action="settings"]').click()
      await expect(page.locator('.ca-settings')).toBeVisible()
      await page.locator('.ca-settings [data-menu-action="brokers"]').click()
      const body = page.locator(native ? '.client-broker-hub' : '.client-connection-plan')
      await expect(body).toBeVisible()
      await expect(page.locator('.ca-settings')).toHaveCount(0)
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      })
      const originalBody = await body.innerText(), href = page.url()
      const measured = await observeChrome(page)
      await info.attach('guest-broker-chrome', { body: JSON.stringify(measured), contentType: 'application/json' })
      await page.screenshot({ path: info.outputPath('guest-broker-before-assertions.png') })
      expect.soft(measured.auth.map(control => control.visible), '원본은 두 상단 인증 버튼을 표시한다').toEqual([true, true])
      expect.soft(measured.auth.map(control => control.hit), '두 인증 버튼의 중앙이 가려지지 않는다').toEqual([true, true])
      expect.soft(measured.globe.length, '원본 언어 버튼 DOM을 유지한다').toBe(1)
      if (width > 860) expect.soft(measured.globe.map(control => ({ visible: control.visible, hit: control.hit })), 'desktop 언어 진입').toEqual([{ visible: true, hit: true }])
      else expect.soft(measured.globe.every(control => !control.visible), '원본 mobile 언어 버튼 숨김').toBe(true)
      expect.soft(measured.collisions, '상단 조작부끼리 겹치지 않는다').toEqual([])
      expect.soft(measured.overflow, '문서 가로 넘침 없음').toBeLessThanOrEqual(1)

      const login = page.locator('.client-auth-nav .client-login'), signup = page.locator('.client-auth-nav .client-signup')
      for (const [index, control] of [login, signup].entries()) {
        if (!measured.auth[index]?.visible || !measured.auth[index]?.hit) {
          actions.push(`${index === 0 ? 'login' : 'signup'}: unreachable; modal assertions not executed`)
          continue
        }
        if (index === 0) await control.click()
        else { await control.focus(); await expect(control).toBeFocused(); await page.keyboard.press('Enter') }
        const modal = page.locator(native ? 'dialog.native-auth-surface[open]' : '.ca-auth')
        await expect(modal).toBeVisible()
        await expect(modal.getByRole('button', { name: /^Google로 계속하기/ })).toBeVisible()
        await expect(modal.getByRole('button', { name: /^Apple로 계속하기/ })).toBeVisible()
        await expect(modal.locator(native ? '.au-btn.ghost.au-gap' : 'input[type="email"]')).toBeVisible()
        actions.push(index === 0 ? 'login: nonforce pointer opened; three options present' : 'signup: focused Enter opened; three options present')
        await page.keyboard.press('Escape')
        await expect(modal).toHaveCount(0)
        await expect(control).toBeFocused()
        expect(page.url()).toBe(href)
      }
      if (width > 860 && measured.globe[0]?.visible && measured.globe[0]?.hit) {
        const globe = page.locator('.client-globe')
        await globe.focus(); await expect(globe).toBeFocused(); await page.keyboard.press('Enter')
        await expect(page.locator('.client-locale-panel')).toBeVisible()
        await expect(page.locator('.client-locale-panel ul button')).toHaveCount(7)
        await page.keyboard.press('Escape')
        await expect(page.locator('.client-locale-panel')).toHaveCount(0)
        await expect(globe).toBeFocused()
        actions.push('globe: Enter opened seven-language panel; Escape restored focus')
      } else actions.push(width > 860 ? 'globe: unreachable; modal assertions not executed' : 'globe: mobile hidden policy')
      expect(await body.innerText()).toBe(originalBody)
      expect(page.url()).toBe(href)
      if (measured.auth.every(control => control.visible && control.hit)) {
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expect(login).toBeVisible(); await expect(signup).toBeVisible()
        expect((await observeChrome(page)).overflow).toBeLessThanOrEqual(1)
        await page.evaluate(() => window.scrollTo(0, 0))
        actions.push('scroll: both authentication entries retained')
      }
    } finally {
      await info.attach('guest-broker-actions', { body: JSON.stringify(actions), contentType: 'application/json' })
      await info.attach('guest-broker-network', { body: JSON.stringify({ ...audit, errors }), contentType: 'application/json' })
      expect(audit.external).toEqual([])
      expect(audit.mutations).toEqual([])
      expect(audit.unexpectedApi).toEqual([])
      expect(errors).toEqual([])
      if (native) expect(new Set(audit.fixtures)).toEqual(new Set(['/api/v1/auth/session', '/api/v1/auth/csrf']))
      else expect(audit.fixtures).toEqual([])
      expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true)
    }
  })
}
