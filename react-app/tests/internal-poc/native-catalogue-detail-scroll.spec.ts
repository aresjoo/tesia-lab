import { expect, test, type Locator, type Page } from '@playwright/test'

// Public editorial catalogue in the actual service renderer. Synthetic auth
// HTTP only; no performance producer, preview engine, or account mutations.
test.setTimeout(35_000)
async function mount(page: Page) {
  const mutations: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') { mutations.push(`${request.method()} ${path}`); return route.abort('failed') }
    if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)) return route.abort('failed')
    const session = path.endsWith('/session')
    return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_scroll_fixture_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_scroll_0001', traceId: 'trace_catalogue_scroll_0001' },
      data: session ? { sessionId: 'session_catalogue_scroll_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_catalogue_scroll_0001', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.route(`http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}/`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
  await page.goto('/#/share')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('[data-public-catalogue] .strategy-list-card')).toHaveCount(10)
  return mutations
}
async function wheelTo(page: Page, target: Locator) {
  const height = page.viewportSize()!.height
  await page.mouse.move(page.viewportSize()!.width * .6, height * .6)
  for (let i = 0; i < 30; i++) {
    const box = await target.boundingBox()
    if (box && box.y >= 40 && box.y + box.height <= height - 30) break
    const before = await page.locator('.client-service-app').evaluate(el => el.scrollTop)
    await page.mouse.wheel(0, 240)
    await expect.poll(() => page.locator('.client-service-app').evaluate(el => el.scrollTop)).toBeGreaterThan(before)
  }
  await expect(target).toBeInViewport({ ratio: 1 })
}
async function settledScroll(root: Locator) {
  let before = -1, stable = 0
  await expect.poll(async () => {
    const value = await root.evaluate(el => el.scrollTop)
    stable = value === before ? stable + 1 : 0; before = value
    return stable
  }, { intervals: [60] }).toBeGreaterThanOrEqual(2)
  return before
}
for (const width of [320, 1440]) for (const back of ['breadcrumb', 'browser'] as const) {
  test(`${width}px 목록 하단 카드 상세 진입과 ${back} 복귀는 원본처럼 새 화면 맨 위를 연다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 720 })
    const mutations = await mount(page), root = page.locator('.client-service-app')
    const cards = page.locator('[data-public-catalogue] .strategy-list-card'), target = cards.last().getByRole('link')
    const titleText = await target.getAttribute('aria-label')
    await wheelTo(page, target)
    const listScroll = await settledScroll(root), listBox = await target.boundingBox()
    expect(listScroll).toBeGreaterThan(200)
    await page.screenshot({ path: info.outputPath('list-before-detail.png') })
    await target.click()
    const heading = page.locator('.client-shared-detail .ss3-dtitle')
    await expect(heading).toHaveText(titleText!)
    const detailScroll = await settledScroll(root), detailBox = await heading.boundingBox()
    await info.attach('scroll-boundary-before-return', { contentType: 'application/json', body: JSON.stringify({ width, back, listScroll, listBox, detailScroll, detailBox }) })
    await page.screenshot({ path: info.outputPath('detail-entry.png') })
    // Keep both observations if entry fails, so return-path evidence is not lost.
    expect.soft(detailScroll).toBeLessThanOrEqual(1)
    await expect.soft(heading).toBeInViewport({ ratio: 1, timeout: 2000 })
    if (back === 'browser') await page.goBack()
    else await page.locator('.client-shared-detail .tfbk-bc button').click()
    await expect(cards).toHaveCount(10)
    const restoredScroll = await settledScroll(root)
    await info.attach('scroll-boundary-after-return', { contentType: 'application/json', body: JSON.stringify({ listScroll, restoredScroll, focus: await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label') })) }) })
    await page.screenshot({ path: info.outputPath('list-after-return.png') })
    // Original index.html gContent resets the new body's scroll on both
    // directions. Restoring the old card/offset is not a source requirement.
    expect.soft(restoredScroll).toBeLessThanOrEqual(1)
    await expect.soft(cards.first()).toBeInViewport({ ratio: 1, timeout: 2000 })
    expect(mutations).toEqual([])
  })
}
