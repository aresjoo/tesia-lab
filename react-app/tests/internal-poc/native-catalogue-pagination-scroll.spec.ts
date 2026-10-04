import { expect, test, type Page } from '@playwright/test'

// Source 9fbff821 index.html:14828 tfSS3Page: when the old grid is above
// the viewport, expose its replacement at mobile 148px / desktop 90px.
// This runs the service entry with synthetic anonymous auth HTTP only.
async function mount(page: Page) {
  const mutations: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') { mutations.push(`${request.method()} ${path}`); return route.abort('failed') }
    if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)) return route.abort('failed')
    const session = path.endsWith('/session')
    return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_page_fixture_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_page_0001', traceId: 'trace_catalogue_page_0001' },
      data: session ? { sessionId: 'session_catalogue_page_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_catalogue_page_0001', expiresAt: '2030-01-02T00:00:00Z' },
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

for (const width of [320, 1440]) {
  test(`${width}px 전략 목록 다음·이전 페이지는 원본처럼 새 카드 상단을 노출한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 720 })
    const mutations = await mount(page)
    const root = page.locator('.client-service-app'), grid = page.locator('.strategy-list-grid')
    for (const [label, targetPage] of [['다음 페이지', '2'], ['이전 페이지', '1'], ['1페이지', '1']] as const) {
      const button = page.getByRole('button', { name: label, exact: true })
      await button.scrollIntoViewIfNeeded()
      const before = { scroll: await root.evaluate(el => el.scrollTop), grid: await grid.boundingBox() }
      expect(before.grid!.y).toBeLessThan(0)
      await button.click()
      await expect(page.locator('.mk-pg[aria-current="page"]')).toHaveText(targetPage)
      await expect.soft.poll(async () => (await grid.boundingBox())!.y, { timeout: 2000 }).toBeGreaterThanOrEqual(width <= 860 ? 147 : 89)
      await expect.soft.poll(async () => (await grid.boundingBox())!.y, { timeout: 2000 }).toBeLessThanOrEqual(width <= 860 ? 149 : 91)
      await expect.soft(grid.locator('.strategy-list-card').first()).toBeInViewport({ ratio: 1, timeout: 2000 })
      await info.attach(`page-${label}-geometry`, { contentType: 'application/json', body: JSON.stringify({ width, before, after: { scroll: await root.evaluate(el => el.scrollTop), grid: await grid.boundingBox() } }) })
      await page.screenshot({ path: info.outputPath(`page-${label}.png`) })
    }
    // Source mkKindPick/mkMktPick rebuild through gContent (top 0),
    // whereas tfSS3Search updates the grid without resetting the scroll.
    await root.evaluate(el => el.scrollTo({ top: 20, behavior: 'instant' }))
    await page.getByRole('button', { name: 'AI 판단', exact: true }).click()
    await expect.poll(() => root.evaluate(el => el.scrollTop)).toBe(0)
    await page.getByRole('button', { name: '전체', exact: true }).click()
    await root.evaluate(el => el.scrollTo({ top: 20, behavior: 'instant' }))
    await page.locator('.strategy-filter-row button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: '가상자산', exact: true }).click()
    await expect.poll(() => root.evaluate(el => el.scrollTop)).toBe(0)
    await page.locator('.strategy-filter-row button[aria-haspopup="listbox"]').click()
    await page.getByRole('option', { name: '시장 전체', exact: true }).click()
    const search = page.getByRole('searchbox', { name: '전략 검색', exact: true })
    await search.focus()
    await root.evaluate(el => el.scrollTo({ top: 20, behavior: 'instant' }))
    await expect.poll(() => root.evaluate(el => el.scrollTop)).toBe(20)
    await search.pressSequentially('BTC')
    await expect(search).toHaveValue('BTC')
    await expect.poll(() => root.evaluate(el => el.scrollTop)).toBe(20)
    expect(mutations).toEqual([])
  })
}
