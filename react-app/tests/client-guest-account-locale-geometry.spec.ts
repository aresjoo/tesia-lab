import { expect, test } from '@playwright/test'
import fixture from './fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Real service-main and normal hero question. Only declared SDK responses are
// fulfilled locally: CREATE/TURN are fixtures, never backend mutations/auth GO.
test.use({ serviceWorkers: 'block' })
const ready = fixture.snapshots.ready
const turn = fixture.documents.find(document => document.name === 'turn')!.value
const question = '비트코인 조건을 확인해줘'
const routes = [['plan', '#/plan'], ['bot', '#/trade/bot/probe1'], ['review', '#/review/probe1'], ['periodic', '#/periodic/probe1']] as const

for (const width of [320, 861, 1440]) for (const [kind, fragment] of routes) for (const phase of ['home', 'conversation'] as const) {
  test(`Native guest French ${width}px ${kind} ${phase}: 인증·문서·복귀 조작부를 가리지 않고 원위치로 돌아간다`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local test origin required')
    const origin = new URL(baseURL).origin
    const audit = { external: [] as string[], mutations: [] as string[], unexpectedApi: [] as string[], fixtures: [] as string[] }
    const errors: string[] = []
    page.on('pageerror', () => errors.push('PAGE_ERROR'))
    const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_boundary_fixture_0001', traceId: 'trace_boundary_fixture_0001' })
    await page.context().route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
      const foreign = url.origin !== origin, api = path === '/api' || path.startsWith('/api/')
      const auth = !foreign && method === 'GET' && !url.search && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)
      const create = phase === 'conversation' && !foreign && !url.search && method === 'POST' && path === '/api/v3/conversations'
      const message = phase === 'conversation' && !foreign && !url.search && method === 'POST' && path === `/api/v3/conversations/${ready.conversationId}/messages`
      const declared = auth || create || message, mutation = !['GET', 'HEAD'].includes(method)
      if (foreign) audit.external.push(method)
      if (mutation && !declared) audit.mutations.push(method)
      if (api && !declared) audit.unexpectedApi.push(method)
      if (foreign || mutation && !declared || api && !declared) return route.abort('blockedbyclient')
      if (auth) {
        const session = path.endsWith('/session'); audit.fixtures.push(method + ' ' + path)
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...(session ? { ETag: '"etag_boundary_fixture_0007"' } : {}) }, body: JSON.stringify({ meta: meta('0.1.0', session ? '7' : null), data: session
          ? { sessionId: 'session_boundary_fixture_0001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: ['csrf', 'boundary', 'synthetic', 'fixture', '0001'].join('_'), expiresAt: '2030-01-01T12:00:00Z' } }) })
      }
      if (create || message) {
        audit.fixtures.push(method + ' ' + path)
        return route.fulfill({ status: create ? 201 : 200, contentType: 'application/json', headers: { ETag: `"boundary_conversation_etag_000${create ? 4 : 5}"`, 'Cache-Control': 'no-store' }, body: JSON.stringify({ meta: meta('0.3.0', create ? ready.conversationStateRevision : '5'), data: create ? ready : turn }) })
      }
      if (request.isNavigationRequest() && path === '/guest-account-locale-native.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>' })
      return route.fallback()
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
    await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
    try {
      await page.goto('/guest-account-locale-native.html')
      const shell = page.locator('.client-service-app')
      await expect(shell).toHaveAttribute('data-service-phase', 'ready')
      if (phase === 'conversation') {
        await page.locator('#strategy-idea').fill(question); await page.locator('#strategy-idea').press('Enter')
        await expect(page.locator('.g-composer textarea')).toBeEnabled()
        await expect(page.locator('.g-act2.fin')).toHaveCount(1)
        await expect(page.locator('.g-umsg')).toHaveCount(1)
        expect(audit.fixtures.filter(call => call === 'POST /api/v3/conversations')).toHaveLength(1)
        expect(audit.fixtures.filter(call => call.endsWith('/messages'))).toHaveLength(1)
      } else await expect(page.locator('#strategy-idea')).toBeVisible()
      const originalURL = page.url(), originalMessages = await page.locator('.g-umsg').allTextContents()
      await page.evaluate(hash => { location.hash = hash }, fragment)
      const accountDocument = page.locator('.native-service-plan'), back = page.locator('.native-plan-return button')
      await expect(accountDocument).toBeVisible(); await expect(back).toHaveCount(1); await expect(back).toBeVisible()
      expect(page.url()).toBe(origin + '/guest-account-locale-native.html' + fragment)
      await page.evaluate(async () => { await document.fonts.ready; for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
      const geometry = await page.evaluate(() => {
        const measure = (node: Element) => {
          const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return { text: node.textContent?.trim(), visible: node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }), x: box.x, y: box.y, right: box.right, bottom: box.bottom, hit: hit === node || !!hit && node.contains(hit) }
        }
        const auth = [...document.querySelectorAll('.client-auth-nav .client-login,.client-auth-nav .client-signup')].map(measure)
        const headings = [...document.querySelectorAll('.native-service-plan :is(h1,h2,.nfx-bc)')].filter(node => node.checkVisibility()).map(measure)
        const buttons = [...document.querySelectorAll('.native-plan-return button,.native-service-plan .nfx-cta button')].filter(node => node.checkVisibility()).map(measure)
        const targets = [...headings, ...buttons]
        const overlaps = (a: typeof auth[number], b: typeof auth[number]) => Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y)
        const collisions = auth.filter(control => control.visible).flatMap(control => targets.filter(target => overlaps(control, target)).map(target => ({ control, target })))
        return { auth, headings, buttons, collisions, back: measure(document.querySelector('.native-plan-return button')!), globe: [...document.querySelectorAll('.client-globe')].map(measure), overflow: document.documentElement.scrollWidth - innerWidth }
      })
      await info.attach('guest-account-locale-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
      await page.screenshot({ path: info.outputPath('guest-account-locale.png') })
      expect.soft(geometry.auth).toHaveLength(2)
      expect.soft(geometry.auth.map(control => control.visible)).toEqual([true, true])
      expect.soft(geometry.auth.map(control => control.hit), '로그인·무료 시작 중앙을 가리지 않는다').toEqual([true, true])
      expect.soft(geometry.headings.length, '실제 문서 제목·breadcrumb 대상이 존재한다').toBeGreaterThan(0)
      expect.soft(geometry.buttons.length, '실제 복귀 button 대상이 존재한다').toBeGreaterThan(0)
      expect.soft(geometry.collisions, '인증 행과 실제 제목·복귀·button 충돌0').toEqual([])
      expect.soft(geometry.globe.map(control => control.visible)).toEqual([width >= 861])
      if (width >= 861) expect.soft(geometry.globe.map(control => control.hit)).toEqual([true])
      expect.soft(geometry.overflow).toBeLessThanOrEqual(0)
      // A failed hit must remain RED rather than spending the click timeout or
      // forcing through the occluder. GREEN still requires a real nonforce click.
      expect(geometry.back.hit, '복귀 버튼 중앙이 기존 header·인증에 가려지지 않는다').toBe(true)
      await back.click()
      await expect(accountDocument).toHaveCount(0)
      expect(page.url()).toBe(originalURL)
      if (phase === 'home') await expect(page.locator('#strategy-idea')).toBeVisible()
      else { await expect(shell).toHaveClass(/\bview-briefing\b/); expect(await page.locator('.g-umsg').allTextContents()).toEqual(originalMessages); await expect(page.locator('.g-act2.fin')).toHaveCount(1) }
    } finally {
      await info.attach('guest-account-locale-network', { body: JSON.stringify({ ...audit, errors, actualBackendMutations: 0 }), contentType: 'application/json' })
      expect(audit.external).toEqual([]); expect(audit.mutations).toEqual([]); expect(audit.unexpectedApi).toEqual([]); expect(errors).toEqual([])
      expect(new Set(audit.fixtures.filter(call => call.startsWith('GET')))).toEqual(new Set(['GET /api/v1/auth/session', 'GET /api/v1/auth/csrf']))
      expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true)
    }
  })
}
