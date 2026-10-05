import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

async function guardNetwork(page: Page, baseURL: string | undefined, native: boolean) {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const audit = { external: [] as string[], mutations: [] as string[], unexpectedApi: [] as string[], fixtures: [] as string[] }
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
    const foreign = url.origin !== origin, mutation = !['GET', 'HEAD'].includes(method)
    const api = path === '/api' || path.startsWith('/api/')
    const fixture = native && !foreign && method === 'GET' && !url.search && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)
    if (foreign) audit.external.push(`${method} ${url.origin}${path}`)
    if (mutation) audit.mutations.push(`${method} ${path}`)
    if (!foreign && api && !fixture) audit.unexpectedApi.push(`${method} ${path}`)
    if (foreign || mutation || api && !fixture) return route.abort('blockedbyclient')
    if (fixture) {
      const session = path.endsWith('/session')
      audit.fixtures.push(path)
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...(session ? { ETag: '"guest_broker_banner_fixture_0007"' } : {}) },
        body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '7' : null, requestId: 'req_guest_broker_banner_fixture_0001', traceId: 'trace_guest_broker_banner_fixture_0001' },
          data: session ? { sessionId: 'session_guest_broker_banner_fixture_0001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
            : { csrfToken: ['csrf', 'guest', 'broker', 'banner', 'fixture', '0001'].join('_'), expiresAt: '2030-01-01T12:00:00Z' } }) })
    }
    return route.fallback()
  })
  return audit
}

for (const host of ['Main', 'Native'] as const) {
  test(`${host} fresh guest brokers 320px: 숨겨진 앱 배너는 문서 상단 조작부를 밀어내지 않는다`, async ({ page, baseURL }, info) => {
    const native = host === 'Native', audit = await guardNetwork(page, baseURL, native), errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko') })
    if (native) await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
    try {
      await page.goto(native ? '/internal-poc.html#/native-client' : '/')
      if (native) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      else await expect(page.locator('.client-home-pill')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('teth-app-banner-dismissed'))).toBeNull()
      await expect(page.locator('.client-app-banner')).toBeVisible()
      await page.screenshot({ path: info.outputPath('fresh-home-banner.png') })
      await page.locator('.client-hamburger').click()
      await page.locator('[data-sidebar-action="settings"]').click()
      await expect(page.locator('.ca-settings')).toBeVisible()
      await page.locator('.ca-settings [data-menu-action="brokers"]').click()
      await expect(page.locator(native ? '.client-broker-hub' : '.client-connection-plan')).toBeVisible()
      await expect(page.locator('.ca-settings')).toHaveCount(0)
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      })
      const geometry = await page.evaluate(() => {
        const measure = (node: Element) => {
          const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return { visible: node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }), x: box.x, y: box.y, right: box.right, bottom: box.bottom, hit: !!hit && (hit === node || node.contains(hit)) }
        }
        const auth = [...document.querySelectorAll('.client-auth-nav .client-login,.client-auth-nav .client-signup')].map(measure)
        const hamburger = [...document.querySelectorAll('.client-hamburger')].map(measure)
        const globe = [...document.querySelectorAll('.client-globe')].map(measure)
        const header = [...document.querySelectorAll('.client-broker-hub > .hub-header :is(h1,h2,button),.client-connection-plan .cpl-head :is(h1,h2,button)')].filter(node => node.checkVisibility()).map(measure)
        const controls = [...auth, ...hamburger].filter(node => node.visible)
        const collisions = controls.flatMap((a, index) => [...controls.slice(index + 1), ...header].filter(b => Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y)).map(b => [a, b]))
        return { auth, hamburger, globe, header, collisions, overflow: document.documentElement.scrollWidth - innerWidth }
      })
      await info.attach('fresh-broker-banner-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
      await page.screenshot({ path: info.outputPath('fresh-broker-document.png') })
      await expect(page.locator('.client-app-banner')).toBeHidden()
      expect.soft(geometry.auth.map(control => ({ visible: control.visible, hit: control.hit }))).toEqual([{ visible: true, hit: true }, { visible: true, hit: true }])
      for (const control of geometry.auth) expect.soft(control.y, '문서 인증 조작부는 첫 60px 밴드에 놓인다').toBeLessThan(60)
      expect.soft(geometry.hamburger.map(control => ({ visible: control.visible, hit: control.hit }))).toEqual([{ visible: true, hit: true }])
      for (const control of geometry.hamburger) expect.soft(control.y, '문서 메뉴는 첫 60px 밴드에 놓인다').toBeLessThan(60)
      expect.soft(geometry.collisions, '문서 제목·도구와 상단 조작부가 겹치지 않는다').toEqual([])
      expect.soft(geometry.globe.map(control => control.visible), '기존 mobile 언어 숨김 정책').toEqual([false])
      expect.soft(geometry.overflow).toBeLessThanOrEqual(1)
    } finally {
      await info.attach('fresh-broker-banner-network', { body: JSON.stringify({ ...audit, errors }), contentType: 'application/json' })
      expect(audit.external).toEqual([])
      expect(audit.mutations).toEqual([])
      expect(audit.unexpectedApi).toEqual([])
      expect(errors).toEqual([])
      expect(new Set(audit.fixtures)).toEqual(new Set(native ? ['/api/v1/auth/session', '/api/v1/auth/csrf'] : []))
      expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true)
    }
  })
}
