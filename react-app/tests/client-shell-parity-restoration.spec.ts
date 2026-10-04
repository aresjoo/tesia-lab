import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
async function service(page: Page, baseURL: string) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET' || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)) return route.abort()
    const session = path.endsWith('/session')
    return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"shell_parity_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_shell_parity_0001', traceId: 'trace_shell_parity_0001' },
      data: session ? { sessionId: 'session_shell_parity_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_shell_parity_0001', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.route(`${baseURL}/`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
}
async function open(page: Page, width: number, signedIn = false) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(signedIn => {
    localStorage.setItem('tethLang', 'ko')
    if (signedIn) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원본 검수', email: 'shell-parity@example.test' }))
  }, signedIn)
  await page.goto('/')
  await expect(page.locator('.client-home-content')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function drawer(page: Page) {
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
}

test('원본 검정 사이드바는 모바일과 desktop 확대 상태에서 유지된다', async ({ page }) => {
  await open(page, 390)
  for (const width of [390, 860, 861, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await drawer(page)
    await expect(page.locator('.client-sidebar')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    await page.keyboard.press('Escape')
    await expect(page.locator('.client-sidebar')).not.toHaveClass(/mobile-open/)
  }
})

test('실제 service renderer도 검정 메뉴와 860px 경계의 링크 가시성을 계승한다', async ({ page, baseURL }) => {
  await service(page, baseURL!)
  await open(page, 390)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  for (const width of [390, 860, 861, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await drawer(page)
    await expect(page.locator('.client-sidebar')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    if (width <= 860) await expect(page.locator('.client-drawer-links')).toBeVisible()
    else await expect(page.locator('.client-drawer-links')).toBeHidden()
    await page.keyboard.press('Escape')
  }
})

test('정보·다운로드 하단 링크는 원본처럼 모바일에서만 표시되고 desktop 헤더 링크는 유지된다', async ({ page }) => {
  await open(page, 1440)
  await drawer(page)
  await expect(page.locator('.client-drawer-links')).toBeHidden()
  await expect(page.locator('.client-auth-nav a[href="/about/"]')).toBeVisible()
  await expect(page.locator('.client-auth-nav a[href="/download/"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 900 })
  await drawer(page)
  const links = page.locator('.client-drawer-links')
  await expect(links).toBeVisible()
  await expect(links.locator('a')).toHaveCount(2)
  await links.locator('a[href="/about/"]').focus()
  await page.keyboard.press('Tab')
  await expect(links.locator('a[href="/download/"]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/download\/$/)
  await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
})

test('모바일 다운로드는 32px 흰 pill과 44px 클릭영역을 분리하고 배너 닫힘을 유지한다', async ({ page }) => {
  await open(page, 320)
  for (const width of [320, 390, 860]) {
    await page.setViewportSize({ width, height: 900 })
    const target = page.locator('.client-download')
    const pill = target.locator('.client-download-pill')
    await expect(pill).toHaveCSS('height', '32px')
    await expect(pill).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const hit = await target.boundingBox(), paint = await pill.boundingBox(), close = await page.locator('.client-banner-close').boundingBox()
    expect(hit!.height).toBeGreaterThanOrEqual(44)
    expect(Math.abs(hit!.y + hit!.height / 2 - paint!.y - paint!.height / 2)).toBeLessThanOrEqual(1)
    expect(hit!.x + hit!.width).toBeLessThanOrEqual(close!.x)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
  await page.locator('.client-banner-close').click()
  await expect(page.locator('.client-app-banner')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.client-home-content')).toBeVisible()
  await expect(page.locator('.client-app-banner')).toHaveCount(0)
})

test('회원 연구 기록과 거래소 연결 SVG는 고정 원본 9fb의 도형·stroke를 보존한다', async ({ page }) => {
  await open(page, 1440, true)
  await drawer(page)
  const history = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true }).locator('svg')
  await expect(history).toHaveAttribute('stroke-width', '1.7')
  await expect(history.locator('circle')).toHaveAttribute('cx', '11')
  await expect(history.locator('circle')).toHaveAttribute('cy', '11')
  await expect(history.locator('circle')).toHaveAttribute('r', '7')
  await expect(history.locator('path')).toHaveAttribute('d', 'M20 20l-4-4')
  const brokers = page.locator('.client-sidebar').getByRole('button', { name: '거래소 연결', exact: true }).locator('svg')
  await expect(brokers).toHaveAttribute('stroke-width', '1.6')
  expect(await brokers.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d')))).toEqual([
    'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7',
    'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  ])
})
