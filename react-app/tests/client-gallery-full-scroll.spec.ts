import { expect, test } from '@playwright/test'

// Synthetic session for native UI only; no model, order, or provider access.
test.use({ trace: 'off', video: 'off' })
for (const surface of ['public', 'native'] as const) {
  for (const [width, height] of [[320, 740], [390, 844], [768, 960], [1100, 960], [1440, 960], [844, 390]]) {
    test(`${surface} gallery all 55 cards remain readable and selectable at ${width}x${height}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height })
      const errors: string[] = [], writes: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      if (surface === 'native') {
        await page.route('**/api/v1/auth/session', route => route.fulfill({ json: {
          meta: { apiContractVersion: '0.1.0', requestId: 'req_home_gallery_fixture_0001', traceId: 'trace_home_gallery_fixture_0001', resourceRevision: '1' },
          data: { sessionId: 'session_home_gallery_fixture_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
        }, headers: { ETag: '"home_gallery_session_etag_0001"' } }))
        await page.route('**/api/v1/auth/csrf', route => route.fulfill({ json: {
          meta: { apiContractVersion: '0.1.0', requestId: 'req_home_gallery_fixture_0001', traceId: 'trace_home_gallery_fixture_0001', resourceRevision: null },
          data: { csrfToken: 'csrf_home_gallery_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' },
        } }))
        await page.route('**/api/v3/**', route => { writes.push(route.request().method()); return route.abort() })
      }
      await page.goto(surface === 'native' ? '/internal-poc.html#/native-client' : '/')
      if (surface === 'native') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      const gallery = page.locator('.client-home-gallery'), cards = gallery.locator('.g-tpl')
      await expect(cards).toHaveCount(55)
      if (width <= 860 && height <= 560) {
        expect(await page.locator('.client-home-band').evaluate(el => getComputedStyle(el).position)).toBe('static')
      }
      expect(await gallery.locator('.g-tpls').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width <= 600 ? 1 : width <= 1100 ? 2 : 3)
      await expect.poll(() => cards.evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1'))).toBe(true)
      for (let index = 0; index < 55; index++) {
        const card = cards.nth(index)
        await card.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        const img = card.locator('img')
        if (await img.count()) await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
        await expect(card.locator('.lb')).toBeVisible()
        // A visible bounding box alone does not detect a fixed composer covering it.
        await expect.poll(() => card.evaluate(el => {
          const r = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
        }), { message: `card ${index} must not be covered by chrome/composer` }).toBe(true)
        await expect.poll(() => card.evaluate(el => {
          const r = el.querySelector('.lb')!.getBoundingClientRect()
          // A visible center does not prove that a nested scrollport hasn't
          // clipped the card's title. Check both ends of the text line too.
          return [r.top + 1, r.bottom - 1].every(y => el.contains(document.elementFromPoint(r.left + r.width / 2, y)))
        }), { message: `card ${index} title must be readable from top to bottom` }).toBe(true)
        if (height <= 560 && index === 0) await page.screenshot({ path: testInfo.outputPath(`${surface}-short-gallery-first.png`) })
      }
      await cards.last().click()
      await expect(cards.last()).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.client-template-selection')).toBeVisible()
      if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`${surface}-gallery-last-viewport.png`) })
      const input = page.locator('#strategy-idea')
      await input.scrollIntoViewIfNeeded()
      await input.fill('마지막 종목도 비교해 주세요')
      await expect(input).toHaveValue('마지막 종목도 비교해 주세요')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(errors).toEqual([])
      expect(writes).toEqual([])
      if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`${surface}-gallery-loaded.png`), fullPage: true })
    })
  }
}
