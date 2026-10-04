import { expect, test, type Page } from '@playwright/test'

test.setTimeout(35_000)

// Actual service renderer; anonymous auth transport fixture only. No ranking,
// strategy execution, preview engine, or fabricated performance is introduced.
async function mount(page: Page) {
  const mutations: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') { mutations.push(`${request.method()} ${path}`); return route.abort('failed') }
    if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)) return route.abort('failed')
    const session = path.endsWith('/session')
    return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_keyboard_fixture_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_keyboard_0001', traceId: 'trace_catalogue_keyboard_0001' },
      data: session ? { sessionId: 'session_catalogue_keyboard_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_catalogue_keyboard_0001', expiresAt: '2030-01-02T00:00:00Z' },
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
  test(`${width}px 메뉴 Escape 복귀는 화면에 남고 외부 클릭·상세 탭·로그인 취소를 보존한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 720 })
    const mutations = await mount(page)
    const trigger = page.locator('.strategy-filter-row button[aria-haspopup="listbox"]')
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('listbox')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    await expect(trigger).toBeInViewport({ ratio: 1 })
    await trigger.click()
    const search = page.getByRole('searchbox', { name: '전략 검색', exact: true })
    // At 320px the open menu correctly covers the input centre. Click the
    // exposed input edge, an actual outside target, without force/DOM events.
    await search.click({ position: { x: 8, y: 20 } })
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(search).toBeFocused()
    await trigger.click()
    await page.mouse.move(width - 15, 620)
    await page.mouse.wheel(0, 700)
    await expect.poll(async () => (await trigger.boundingBox())!.y).toBeLessThan(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await expect(trigger).toBeFocused()
    // Source desktop close does not restore a visible focus target either.
    // This is a narrow accessibility improvement, not a new mobile sheet.
    await expect.soft(trigger).toBeInViewport({ ratio: 1, timeout: 2000 })
    await page.screenshot({ path: info.outputPath('menu-scroll-escape.png') })
    await page.locator('.strategy-list-card').first().getByRole('link').click()
    const tabs = page.getByRole('tab')
    await tabs.first().focus()
    await page.keyboard.press('End')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home')
    await expect(tabs.first()).toBeFocused()
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
    const analysis = page.locator('.shared-detail-analysis')
    const detailUrl = page.url()
    await analysis.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(analysis).toBeFocused()
    await expect(analysis).toBeInViewport({ ratio: 1 })
    expect(page.url()).toBe(detailUrl)
    expect(mutations).toEqual([])
  })
}

for (const width of [320, 1440]) for (const key of ['Enter', 'Space']) {
  test(`${width}px ${key} 페이지 탐색은 새 카드로 키보드를 이어주고 포인터 동작은 보존한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 720 })
    const mutations = await mount(page)
    const first = page.locator('.strategy-list-card').first().getByRole('link')
    const next = page.getByRole('button', { name: '다음 페이지', exact: true })
    // Source tfSS3Page (index.html:14828) scrolls a replaced grid into view
    // but discards the old control. This is an explicit a11y improvement:
    // keyboard users must continue from a visible card, not an offscreen pager.
    await next.focus()
    await page.keyboard.press(key)
    await expect(page.locator('.mk-pg[aria-current="page"]')).toHaveText('2')
    await expect.soft(first).toBeFocused({ timeout: 2000 })
    await expect(first).toBeInViewport({ ratio: 1 })
    const current = page.getByRole('button', { name: '2페이지', exact: true })
    await current.focus()
    await page.keyboard.press(key)
    await expect.soft(first).toBeFocused({ timeout: 2000 })
    await expect(first).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: info.outputPath('keyboard-current-page.png') })
    // A real pointer activation must not unexpectedly move keyboard focus to
    // the first card. Existing pointer scroll behavior remains source-faithful.
    await next.click()
    await expect(page.locator('.mk-pg[aria-current="page"]')).toHaveText('3')
    await expect(next).toBeFocused()
    await expect(first).not.toBeFocused()
    await expect(first).toBeInViewport({ ratio: 1 })
    expect(mutations).toEqual([])
  })

  test(`${width}px ${key} 첫·끝 페이지에서 비활성화되는 탐색 버튼도 새 카드로 초점을 넘긴다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 720 })
    const mutations = await mount(page)
    const first = page.locator('.strategy-list-card').first().getByRole('link')
    for (const [start, label, target] of [['9', '다음 페이지', '10'], ['2', '이전 페이지', '1']] as const) {
      await page.getByRole('button', { name: `${start}페이지`, exact: true }).click()
      const control = page.getByRole('button', { name: label, exact: true })
      await control.focus()
      await page.keyboard.press(key)
      await expect(page.locator('.mk-pg[aria-current="page"]')).toHaveText(target)
      await expect(control).toBeDisabled()
      await expect.soft(first).toBeFocused({ timeout: 2000 })
      await expect(first).toBeInViewport({ ratio: 1 })
      await info.attach(`page-${target}-focus`, { contentType: 'application/json', body: JSON.stringify(await page.evaluate(() => ({
        tag: document.activeElement?.tagName, className: document.activeElement?.className,
        page: document.querySelector('.mk-pg[aria-current]')?.textContent,
      }))) })
      await page.screenshot({ path: info.outputPath(`page-${target}-focus.png`) })
    }
    expect(mutations).toEqual([])
  })
}
