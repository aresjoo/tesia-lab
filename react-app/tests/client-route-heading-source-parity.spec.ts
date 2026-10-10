import { expect, test, type Page } from '@playwright/test'

// Final ares 9fbff821 source HTML SHA256:
// f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321.
// Independent source DOM measurements, not a recapture of the 1260-pair suite:
// L582 header44; L7071/7183 plan8/12; L7285 checkout72; L7802 desktop40;
// L24698 home-only banner. Desktop h1 inherits1.6; mobile px uses1.3 (L7286).
const source = {
  desktop: { planY: 48, postY: 40, titleHeight: 51.1875, introY: 148.390625 },
  mobile: { planY: 12, postY: 72, planHeight: 41.59375, postHeight: 41.59375, checkoutHeight: 51.1875, introY: 120.390625 },
} as const

async function localOnly(page: Page, member: boolean) {
  await page.routeWebSocket('**/*', socket => socket.close())
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient')
    return route.continue()
  })
  await page.addInitScript(member => {
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethTheme', 'dark')
    if (member) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '원본 배치 검수', email: 'route-parity@example.test' }))
  }, member)
}

async function rect(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
  return page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

async function unobstructedCenter(page: Page, selector: string) {
  await rect(page, selector)
  expect(await page.locator(selector).evaluate(element => {
    const r = element.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return top === element || !!top && element.contains(top)
  }), `${selector} center is unobstructed`).toBe(true)
}

async function touchAndOcclusion(page: Page, selector: string) {
  const r = await rect(page, selector)
  expect(r.width, `${selector} width`).toBeGreaterThanOrEqual(44)
  expect(r.height, `${selector} height`).toBeGreaterThanOrEqual(44)
  await unobstructedCenter(page, selector)
}

test('source desktop connection heading geometry across plan and all post-plan routes', async ({ page }, info) => {
  await localOnly(page, true); await page.setViewportSize({ width: 1440, height: 900 })
  const results = []
  for (const step of ['plan', 'free', 'account', 'authorize', 'checkout']) {
    await page.goto(`/#/connect/${step}?exchange=bitget`)
    await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step', step)
    const title = await rect(page, '#connection-plan-title')
    expect(title.y).toBeCloseTo(step === 'plan' ? source.desktop.planY : source.desktop.postY, 1)
    expect(title.height).toBeCloseTo(source.desktop.titleHeight, 1)
    if (step === 'plan') await expect(page.locator('.cpl-back')).toBeHidden()
    else await touchAndOcclusion(page, '.cpl-back')
    results.push({ step, title })
  }
  await info.attach('desktop-source-geometry', { body: JSON.stringify(results), contentType: 'application/json' })
})

test('source mobile connection heading geometry and preserved 44px route controls', async ({ page }, info) => {
  await localOnly(page, true)
  const results = []
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const step of ['plan', 'free', 'account', 'authorize', 'checkout']) {
      await page.goto(`/#/connect/${step}?exchange=bitget`)
      await expect(page.getByTestId('connection-plan')).toHaveAttribute('data-step', step)
      const title = await rect(page, '#connection-plan-title')
      expect(title.y).toBeCloseTo(step === 'plan' ? source.mobile.planY : source.mobile.postY, 1)
      expect(title.height).toBeCloseTo(step === 'checkout' ? source.mobile.checkoutHeight : source.mobile.postHeight, 1)
      await expect(page.locator('.client-app-banner')).toBeHidden()
      await touchAndOcclusion(page, '.client-hamburger')
      if (step === 'plan') await expect(page.locator('.cpl-back')).toBeHidden()
      else await touchAndOcclusion(page, '.cpl-back')
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      results.push({ width, step, title })
    }
  }
  await info.attach('mobile-source-geometry', { body: JSON.stringify(results), contentType: 'application/json' })
})

test('source intro header40/44 and eyebrow1.6 preserve guest auth and home banner state', async ({ page }, info) => {
  await localOnly(page, false)
  const results = []
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/#/trade')
    await expect(page.locator('.txh')).toBeVisible()
    await expect(page.locator('.client-app-banner')).toBeHidden()
    const title = await rect(page, '.txh-hero h1'), eyebrow = await rect(page, '.txh-eyebrow')
    expect(title.y).toBeCloseTo(width > 860 ? source.desktop.introY : source.mobile.introY, 1)
    expect(eyebrow.height).toBeCloseTo(22.390625, 1)
    // Source auth paint is 30px desktop / 36px mobile (source L1551), not
    // an assertion that all controls must grow to 44px. The host hit wrapper
    // may differ; preserve the source pill size and actual unobstructed center.
    for (const selector of ['.client-auth-nav .client-login', '.client-auth-nav .client-signup']) {
      await unobstructedCenter(page, selector)
      const pill = await rect(page, `${selector} .client-auth-pill`)
      expect(pill.height).toBeCloseTo(width > 860 ? 30 : 36, 1)
    }
    if (width <= 860) {
      await touchAndOcclusion(page, '.client-hamburger')
      await page.goto('/')
      await expect(page.locator('.client-app-banner')).toBeVisible()
      expect(await page.evaluate(() => sessionStorage.getItem('teth-app-banner-dismissed'))).toBeNull()
      await page.locator('.client-banner-close').click()
      await page.goto('/#/trade')
      expect((await rect(page, '.txh-hero h1')).y).toBeCloseTo(source.mobile.introY, 1)
      await page.goto('/'); await expect(page.locator('.client-app-banner')).toBeHidden()
      // Reset only this synthetic test state so the next viewport starts fresh.
      await page.evaluate(() => sessionStorage.removeItem('teth-app-banner-dismissed'))
    }
    results.push({ width, title, eyebrow })
  }
  await info.attach('intro-source-geometry', { body: JSON.stringify(results), contentType: 'application/json' })
})
