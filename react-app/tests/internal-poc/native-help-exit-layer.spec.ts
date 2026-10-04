import { expect, test } from '@playwright/test'

test('짧은 서비스 홈 도움말은 닫히는 동안에도 배너 뒤로 순간 이동하지 않는다', async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin
  const mutations: string[] = []
  await page.setViewportSize({ width: 320, height: 320 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(request.method()); return route.abort() }
    if (url.origin !== origin) return route.abort()
    if (url.pathname.startsWith('/api/')) {
      if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort()
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"help_exit_fixture_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_help_exit_0001', traceId: 'trace_help_exit_0001' },
        data: session ? { sessionId: 'session_help_exit_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_help_exit_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  const trigger = page.locator('.site-help-trigger:visible')
  await trigger.click()
  await expect(page.locator('.site-help-pop')).toBeVisible()
  const observed = await page.evaluate(async () => {
    const panel = document.querySelector<HTMLElement>('.site-help-pop')!, host = panel.parentElement!
    const before = getComputedStyle(host).zIndex
    const closed = new Promise<void>(resolve => {
      const observer = new MutationObserver(() => {
        if (panel.dataset.surfaceClosing === 'true') { observer.disconnect(); resolve() }
      })
      observer.observe(panel, { attributes: true })
    })
    panel.querySelector<HTMLButtonElement>('.help-close')!.click()
    await closed
    panel.getAnimations().forEach(animation => animation.pause())
    return { before, after: getComputedStyle(host).zIndex, inert: panel.inert,
      duration: getComputedStyle(panel).animationDuration, name: getComputedStyle(panel).animationName }
  })
  await info.attach('exit-layer', { body: JSON.stringify(observed), contentType: 'application/json' })
  expect.soft(observed.after).toBe(observed.before)
  expect(observed.inert).toBe(true)
  expect(observed.duration).toBe('0.16s')
  expect(observed.name).toBe('client-help-out')
  // The real fallback must remove a paused exit, not leave an invisible layer.
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await trigger.evaluate(element => getComputedStyle(element.parentElement!).zIndex)).toBe('60')
  expect(mutations).toEqual([])
})
