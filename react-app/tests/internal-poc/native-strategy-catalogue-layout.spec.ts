import { expect, test, type Page } from '@playwright/test'

test('펼친 desktop 사이드바도 공개 목록의 키보드 복귀를 가리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const posts = await openCatalogue(page)
  await page.locator('.client-rail-logo-row button').click()
  await expect(page.locator('.client-sidebar')).toHaveClass(/mobile-open/)
  const back = page.locator('.native-strategies > .hub-header button')
  await back.focus()
  await expect(back).toBeFocused()
  await page.screenshot({ path: info.outputPath('expanded-sidebar-return.png') })
  expect(await back.evaluate(element => {
    const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return Boolean(hit && (hit === element || element.contains(hit)))
  }), 'Focused return is not behind the expanded navigation').toBe(true)
  const header = await page.locator('.native-strategies > .hub-header').boundingBox()
  const sidebar = await page.locator('.client-sidebar').boundingBox()
  expect(header!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width)
  await back.press('Enter')
  await expect(page.locator('.landing-hero h1')).toBeVisible()
  expect(posts).toEqual([])
})

// Actual service renderer; only authentication HTTP is an explicit fixture.
// No preview engine, fabricated returns, or business mutations are enabled.
async function openCatalogue(page: Page) {
  const posts: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    if (request.method() === 'POST') posts.push(pathname)
    if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(pathname)) return route.abort('failed')
    const session = pathname.endsWith('/session')
    await route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_layout_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_layout_0001', traceId: 'trace_catalogue_layout_0001' },
      data: session ? { sessionId: 'session_catalogue_layout_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_catalogue_layout_0001', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.route(`http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}/`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
  await page.goto('/#/share')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('[data-public-catalogue] .strategy-list-card').first()).toBeVisible()
  return posts
}

for (const width of [390, 768, 1440]) test(`${width}px 공개 목록은 원본 폭·필터 순서와 비합성 성과 경계를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const posts = await openCatalogue(page)
  const catalogue = page.locator('[data-public-catalogue]'), filters = catalogue.locator('.strategy-filters')
  const grid = catalogue.locator('.strategy-list-grid'), card = grid.locator('.strategy-list-card').first()
  const metrics = await catalogue.evaluate(el => {
    const rect = (selector: string) => {
      const node = el.querySelector(selector)!, box = node.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right }
    }
    return { filters: rect('.strategy-filters'), grid: rect('.strategy-list-grid'), card: rect('.strategy-list-card'),
      sort: rect('.strategy-list-sort'), market: rect('.tfbk-dropwrap'), search: rect('.ss3-search') }
  })
  // Original 9fbff821 measured at these same widths: 350/728/1160px content.
  expect(metrics.grid.width).toBeCloseTo(width === 1440 ? 1160 : width - 40, 0)
  expect(metrics.card.width).toBeCloseTo(width === 1440 ? 571 : width === 768 ? 357 : 350, 0)
  expect(metrics.grid.x).toBeCloseTo(width === 1440 ? 172 : 20, 0)
  expect(metrics.filters.x).toBeCloseTo(metrics.grid.x, 0)
  expect(metrics.filters.y).toBe(width === 1440 ? 40 : 72)
  expect(metrics.grid.y - metrics.filters.bottom).toBeCloseTo(18, 0)
  expect(metrics.market.x - metrics.sort.right).toBeCloseTo(width === 390 ? 8 : 10, 0)
  if (width === 390) {
    // Deliberate accessibility improvement: original search was only 69.97px.
    expect(metrics.search.width).toBeCloseTo(metrics.grid.width, 0)
    expect(metrics.search.y).toBeGreaterThanOrEqual(metrics.sort.bottom + 8)
  } else {
    expect(metrics.search.y).toBeCloseTo(metrics.sort.y, 0)
    expect(metrics.search.right).toBeCloseTo(metrics.grid.right, 0)
  }
  await expect(filters.locator('.ss3-tabs')).toHaveCount(0)
  await expect(grid).toHaveCSS('gap', width === 1440 ? '18px' : '14px')
  await expect(card.locator('.skf-ret b > [aria-hidden]')).toHaveText('—')
  await expect(catalogue.locator('canvas')).toHaveCount(0)
  await expect(catalogue.getByRole('combobox').locator('option[value="ret"]')).toHaveAttribute('disabled', '')
  expect(metrics.sort.height).toBeGreaterThanOrEqual(44)
  expect(metrics.search.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.native-strategies > .hub-header')).toHaveCSS('position', 'absolute')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`catalogue-${width}.png`) })
  // The removed visual toolbar still provides a keyboard-accessible return.
  const back = page.locator('.native-strategies > .hub-header button')
  await back.focus()
  await expect(back).toBeInViewport()
  await expect(back).toBeFocused()
  expect(await back.evaluate(el => {
    const box = el.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return hit === el || el.contains(hit)
  })).toBe(true)
  await page.keyboard.press('Enter')
  await expect(catalogue).toHaveCount(0)
  await expect(page.locator('.landing-hero h1')).toBeVisible()
  await page.goto('/#/share')
  await expect(card).toBeVisible()
  await card.getByRole('link').focus()
  await page.keyboard.press('Enter')
  await expect(catalogue.locator('.client-shared-detail')).toBeVisible()
  await expect(page.locator('.native-strategies > .hub-header')).toHaveCSS('clip-path', 'none')
  expect(posts).toEqual([])
})
